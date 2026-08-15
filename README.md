<p align="center">
  <img src="icon.svg" alt="GitLab Logo" width="21%">
</p>

# GitLab on StartOS

> Everything not listed in this document should behave the same as upstream
> GitLab. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

GitLab is a DevOps platform combining Git hosting, issue tracking, merge requests, wikis and a CI/CD engine. This package wraps the official GitLab Community Edition Omnibus image ([gitlab-org/omnibus-gitlab](https://gitlab.com/gitlab-org/omnibus-gitlab)), which bundles PostgreSQL, Redis, Gitaly, Workhorse, Puma, Sidekiq, nginx and OpenSSH into a single container supervised by runit.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Troubleshooting](#troubleshooting)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

The package runs the upstream GitLab Community Edition image unmodified — there is no custom Dockerfile and no patching of GitLab itself. All configuration is injected through the `GITLAB_OMNIBUS_CONFIG` environment variable, which Omnibus evaluates before reading its own config file.

| | |
| --- | --- |
| Image source | `gitlab/gitlab-ce`, upstream and unmodified |
| Architectures | x86_64 (aarch64 is built but not currently released) |
| Entrypoint | Default (`/assets/init-container`), run as PID 1 |

The image's entrypoint starts `runsvdir`, which supervises roughly ten services inside the one container, then runs `gitlab-ctl reconfigure` — a full Chef converge that generates every config file from the injected settings. This is why first boot is slow and why a bad configuration value fails the whole service rather than one component.

The package runs a single subcontainer, **`gitlab-sub`**, which hosts every GitLab service. Attach to a running install with:

```
start-cli package attach gitlab
```

Actions do **not** run in a second container. They call GitLab's REST API over the internal bridge instead — see [File Models](#file-models) for why a short-lived container cannot run `gitlab-rails` here.

## Volume and Data Layout

All persistent state lives on one volume, so a single backup captures the whole instance. The Omnibus image expects its three state trees at fixed absolute paths, so they are mounted as separate subpaths of that volume.

| Volume | Subpath | Mount point | Contents |
| --- | --- | --- | --- |
| `main` | `/etc-gitlab` | `/etc/gitlab` | Generated `gitlab.rb`, secrets, SSH host keys |
| `main` | `/var-opt-gitlab` | `/var/opt/gitlab` | Repositories, PostgreSQL cluster, uploads, LFS objects |
| `main` | `/var-log-gitlab` | `/var/log/gitlab` | Per-service logs |

The database is the PostgreSQL cluster embedded in the image, living under `/var/opt/gitlab/postgresql`. There is no external database and no option to use one through this package.

StartOS-side state is kept in `store.json` at the root of the `main` volume — outside all three mounts, so GitLab never sees it.

## File Models

The package owns exactly one file model, and deliberately does **not** model GitLab's own configuration.

**`store.json`** (`main` volume root) holds StartOS-side state only: the chosen primary URL, the generated initial root password and whether it has been acknowledged, the SMTP selection, and an admin API token the package mints for its own use. It is created at install with a generated password and an empty URL, then written only by actions and by the service's own startup logic. Nothing in the container can read or write it.

The internal API token exists because actions cannot run `gitlab-rails` themselves: `gitlab-ctl reconfigure` writes `database.yml`, `gitlab.yml` and `secrets.yml` into the container's image layer rather than onto a volume, so a short-lived container started from the image has no working Rails at all. The service mints the token during startup, where Rails does work, and actions call GitLab's REST API over the internal bridge instead. The token is re-issued on every start, which bounds how long a leaked copy stays valid.

**`/etc/gitlab/gitlab.rb` is not modelled, and hand edits to it do not survive.** Omnibus evaluates `GITLAB_OMNIBUS_CONFIG` *before* reading `gitlab.rb`, and this package rebuilds that variable from scratch on every start. Any key the package sets — the external URL, the nginx and proxy-header settings, the Puma and Sidekiq sizing, the SSH port, the disabled components, the SMTP block — is re-asserted on every start and will silently override an edit to `gitlab.rb`. Keys the package does *not* set are left entirely to the user and persist normally, so `gitlab.rb` remains the right place for settings this package has no opinion about.

The values delivered by environment variable are consumed only during `gitlab-ctl reconfigure`, which runs at container start. A configuration change therefore requires a service restart; it is not picked up live.

## Dependencies

None. The Omnibus image bundles every service GitLab needs.

The GitLab Runner package depends on *this* package, not the reverse — GitLab is fully usable without a runner, minus CI/CD execution.

## Network Access and Interfaces

Two interfaces, both on the same host, so they share an address.

| Interface | Type | Container port | Purpose |
| --- | --- | --- | --- |
| `http` | `ui` | 80 | Web UI, REST and GraphQL APIs, git clone/push over HTTPS |
| `ssh` | `api` | 22 | git clone/push over SSH, as user `git` |

StartOS terminates TLS in front of the container, so nginx serves plaintext internally and is told via `X-Forwarded-Proto` that the original request was HTTPS. This keeps generated links and redirects on `https` rather than downgrading users.

The SSH interface requests external port 22 but does not always get it — StartOS assigns another port if 22 is taken. Whatever port is assigned is fed back to GitLab as `gitlab_shell_ssh_port`, so the clone URLs shown in the UI match reality.

## Installation and First-Run Flow

Installation differs from upstream in three ways worth knowing.

**No setup wizard, and the administrator is created explicitly.** This package generates a strong root password at install and surfaces it through the Initial Credentials action; sign in as `root`. It also creates the account itself rather than relying on GitLab's own seeding, which does not run on the code path this container takes — GitLab logs "Default admin account has been configured" either way, so that message is not evidence the account exists.

**The primary URL is chosen for you, once.** At install the package seeds the LAN (`.local`) address as GitLab's canonical URL so a fresh instance works immediately. Change it with the Set Primary URL action if you want Tor or a clearnet domain to be canonical instead.

**First boot takes several minutes** — around four on reference hardware, longer on slow disks. `gitlab-ctl reconfigure` runs a full Chef converge and then the database migrations. Subsequent starts take roughly twenty seconds. The health check's grace period accommodates this; a service that is still "starting" after fifteen minutes is a genuine fault, not slowness.

## Actions

Five actions, all user-facing; none are hidden.

**Initial Credentials** — Run after installing, to retrieve the generated root password. Changes nothing except marking the credentials acknowledged. Instant, no interruption, safe to repeat. Disables itself once Reset Root Password has superseded the generated value, because it would otherwise show a password that no longer works.

**Set Primary URL** — Run when you want a different address to be canonical: exposing GitLab over Tor or a domain, or after disabling the gateway the current URL depends on. Writes `store.json` only. Instant, but **requires a restart to take effect**, and that restart re-runs reconfigure (a couple of minutes). Safe to repeat. Existing local clones keep working; their remotes point at the old address until updated by hand.

**Reset Root Password** — Run when the root password is lost or must be rotated. Changes the `root` user's password immediately via GitLab's API and clears the stored initial password. Near-instant, does not interrupt service. Safe to repeat, but each run invalidates the previous password. **Returns the new password, which is shown once and not stored** — capture it before dismissing.

**Configure Email** — Run to enable outgoing mail for password resets, confirmations and notifications, using either the StartOS system SMTP relay or your own server. Writes `store.json` only; **requires a restart** to apply. Safe to repeat.

**Create Runner Token** — Run to attach a CI/CD runner. Creates an instance-level runner via GitLab's API and returns its authentication token. Near-instant, does not interrupt service. Each run creates a **new, additional** runner registration rather than replacing one, so repeated runs leave stale runner entries in the admin area to clean up. **The token is shown once**; GitLab keeps no retrievable copy. The GitLab Runner package calls this action automatically, so you only need it by hand for a runner running elsewhere.

## Tasks

The package raises one task.

**Retrieve initial credentials** — Raised once, after GitLab first becomes reachable, pointing at the Initial Credentials action. Severity `important`, so it is prominent but does not block the service. Cleared by running that action. It does not return once acknowledged, and is never raised at all if the generated password has already been superseded by Reset Root Password.

**Primary URL unavailable** — Raised when the address stored as canonical is no longer among the addresses StartOS exposes, which typically means a gateway was turned off. Severity `critical`, so it suspends the ordinary controls until resolved. Cleared by running Set Primary URL and choosing an available address. It can return if the chosen address later disappears again. The package deliberately does not pick a replacement automatically, because doing so would silently rewrite every clone URL on the instance.

## Health Checks

One check, `Web Interface`, with a fifteen-minute grace period.

It probes `/-/readiness` over loopback **from inside the container**, not over the network. GitLab restricts its monitoring endpoints to `127.0.0.0/8` by default, so an external probe receives a 404 regardless of whether the service is healthy — widening that allowlist would expose unauthenticated health data to the LAN, since proxied traffic also arrives from the internal bridge.

A "still starting" result during the first several minutes after install is expected — that is reconfigure and the migrations. The same result persisting past the grace period means reconfigure failed; the service logs will show a Chef stack trace, and the cause is almost always a rejected configuration value. After an upgrade it may instead mean the migrations are still running, which can legitimately take a while on a large instance.

## Backups and Restore

The strategy is a **wholesale volume copy** (`ofVolumes`) of the single `main` volume. Nothing is dumped and replayed; the PostgreSQL data directory is captured as files.

This is safe because StartOS stops the service for the duration of a backup and restarts it afterwards, so the database is quiescent and its files are internally consistent. No `gitlab-backup create` or `pg_dump` step is involved.

Everything is captured: repositories, the database, uploads, LFS objects, CI artifacts, secrets, SSH host keys and the StartOS-side `store.json`. Nothing is deliberately excluded — which also means logs and any accumulated CI artifacts are copied, so backup size tracks total instance size rather than just the useful data.

A restored instance needs nothing re-entered. Because `/etc/gitlab` is included, the secrets that encrypt database values are restored alongside the database they decrypt — a mismatch there is the usual cause of a restored GitLab that cannot read its own CI variables, and this strategy avoids it. SSH host keys are preserved too, so clients do not see a host-key-changed warning.

## Limitations and Differences

1. **The container registry is disabled.** Enabling it requires its own port, its own TLS trust configuration on every Docker or Podman client, and unbounded disk. It is not available through this package.
2. **GitLab Pages is disabled.** It requires wildcard DNS and a separate domain, which the StartOS addressing model does not currently accommodate.
3. **Prometheus monitoring is disabled**, saving roughly 400 MB of RAM. GitLab's built-in performance dashboards will be empty.
4. **The Kubernetes agent server (KAS) is disabled.** Kubernetes integration is not available.
5. **Mattermost is unavailable.** It was removed from the Omnibus package upstream and is no longer bundled at any setting.
6. **Puma runs two workers and Sidekiq nine threads**, trimmed for a single-box deployment. A busy instance with many concurrent users will feel this.
7. **Only one canonical URL at a time.** GitLab bakes a single `external_url` into generated links and email. Reaching it over LAN, Tor and a domain simultaneously works, but links generated by the server always use whichever address is set as primary.
8. **Configuration changes require a restart**, since Omnibus applies them during reconfigure at container start.
9. **aarch64 is not released.** The image is built for it, but it has not been validated and upstream documents outstanding ARM issues.
10. **An external PostgreSQL or Redis cannot be used.** The bundled ones are not optional through this package.

## Troubleshooting

**Service stays "starting" past the grace period, having previously worked.**
Check the service logs for a Chef stack trace ending in `Removed configurations found` or `UnknownConfigOptionError`. This means an Omnibus configuration key the package sets was removed upstream in the version just installed. There is no user-side fix; it requires a package update.

**Service stays "starting" on a first install, no stack trace.**
Reconfigure is still running. Confirm by attaching and running `gitlab-ctl status` — services listed as `down` that keep restarting indicate a real fault, whereas a short service list means the converge has not reached them yet. Give it the full fifteen minutes before treating it as failed.

**Clone over SSH is refused, or asks for a password.**
GitLab's SSH port is often not 22 — check the address shown on the `ssh` interface. Also confirm the key is on your GitLab profile, not just on the machine; `git@…` authentication is by key only and never accepts a password.

**Links in emails or the UI point at an unreachable address.**
The primary URL is set to an address that is no longer exposed. Run Set Primary URL and choose a current one, then restart.

**Cannot sign in as root after a restore or a password change.**
Run Reset Root Password. Note that Initial Credentials will show the *original* generated password, which is wrong after any rotation — the action disables itself in that case precisely to avoid this confusion.

**A CI job stays pending forever.**
No runner is attached, or the attached runner does not accept untagged jobs. Check Admin Area → CI/CD → Runners; if the runner is missing, use the GitLab Runner package or Create Runner Token.

**Disk fills up unexpectedly.**
CI job artifacts and logs accumulate under `/var/opt/gitlab` and are never pruned automatically at default settings. Configure artifact expiry in GitLab's CI/CD settings.

---

## Quick Reference for AI Consumers

```yaml
package_id: gitlab
image: gitlab/gitlab-ce
architectures: [x86_64]
subcontainers: [gitlab-sub]
volumes:
  main: /etc/gitlab, /var/opt/gitlab, /var/log/gitlab
file_models:
  - store.json
startos_managed_env_vars:
  - GITLAB_OMNIBUS_CONFIG
  - GITLAB_SKIP_TAIL_LOGS
dependencies: none
interfaces:
  http: { type: ui, port: 80 }
  ssh: { type: api, port: 22 }
actions:
  - show-initial-credentials
  - set-primary-url
  - reset-root-password
  - configure-smtp
  - create-runner-token
tasks:
  - { action: show-initial-credentials, severity: important }
  - { action: set-primary-url, severity: critical }
health_checks:
  - primary
```
