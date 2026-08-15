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

## Remaining before release

- [ ] **Backup / restore round trip.** Take a backup, wipe, restore, confirm the
      instance comes back with its repositories, users and secrets intact. This
      is the one advertised guarantee not yet exercised.
- [ ] **Push a real repository** over HTTPS and over SSH — create a project, add
      an SSH key, clone, commit, push. Endpoints answer correctly but no actual
      Git traffic has been pushed through them.
- [ ] **Exercise Set Primary URL end to end**: switch to the Tor address,
      restart, confirm generated links and clone URLs follow.
- [ ] **Configure Email**: verify against a real SMTP server; confirm a password
      reset email actually arrives.
- [ ] **Reset Root Password**: run it and confirm the new password works and the
      old one does not.
- [ ] **Upgrade rehearsal.** Install this version, then update to the next patch
      release and confirm migrations complete. This is the highest-value
      remaining test — see UPDATING.md.
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
