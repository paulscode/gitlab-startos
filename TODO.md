# TODO — GitLab on StartOS

## Done

- Manifest, image, volumes, hardware requirements
- HTTP + SSH interfaces on one host; assigned SSH port fed back to GitLab
- Omnibus config generation, reverse-proxy headers, trimmed component set
- In-container health check (GitLab restricts `/-/health` to loopback)
- Root-user bootstrap, five actions, one-time credentials task
- Primary-URL seeding + unavailability watcher
- Backups (whole-volume), version graph, README, instructions, UPDATING
- Verified on StartOS: clean install → reconfigure → login as root over LAN
  HTTPS; git-over-HTTPS and git-over-SSH endpoints live; monitoring endpoints
  confirmed *not* externally reachable

## Verified on hardware

- Git push **and** clone over HTTPS, and push over SSH, against a real project.
  Clone URLs carry the dynamically assigned HTTP and SSH ports correctly.
- Web login end to end (CSRF, session, proxy headers).
- Monitoring endpoints confirmed **not** reachable from outside the container.
- **Upgrade rehearsal**: 19.1.4 installed, seeded with a project and commit,
  then updated in place to 19.2.2. Migrations ran, all services came back, and
  the repository, user and admin account survived.
- Reset Root Password: new password authenticates, stale one retired, and the
  Initial Credentials action correctly reports itself superseded afterwards.
- Create Runner Token: the exact API path the action uses returns a `glrt-`
  token over the internal bridge.

## Remaining before release

- [ ] **Backup / restore round trip.** Blocked: `backup create` authenticates
      against the StartOS master password, which the packager must supply. A
      CIFS target is already registered on the box (`cifs-0`) for this. Run:
      `start-cli backup create cifs-0 <server-password> --package-ids gitlab`
      then uninstall, reinstall and restore, and confirm repositories, users
      and secrets all come back.
- [ ] **Exercise Set Primary URL end to end**: needs a second address (Tor or a
      domain) enabled on the box; only the LAN address exists today.
- [ ] **Configure Email**: verify against a real SMTP server; confirm a password
      reset email actually arrives.
- [ ] **Reconfigure smoke test in CI.** Automate the check in UPDATING.md so a
      removed Omnibus key fails the build rather than the user's install.
- [ ] Replace `icon.svg` if a better-quality official mark is available.

## Deferred

- **Translations.** English only. `startos/i18n/dictionaries/translations.ts`
  takes complete locale blocks — a partial one will not compile.
- **aarch64.** Built by `make` but not released; `RELEASE_ARCHES` gates it.
  Needs validation on real ARM hardware, and GitLab documents outstanding ARM
  issues.
- **Container registry.** Deliberately disabled: needs its own port, CA trust on
  every client, and unbounded disk.
