import { sdk } from './sdk'

/**
 * Every piece of GitLab state — /etc/gitlab, /var/opt/gitlab and
 * /var/log/gitlab — is a subpath of the single `main` volume, so backing up
 * that volume captures all of it.
 *
 * No pg_dump orchestration is needed: StartOS stops the service for the
 * duration of a backup and restarts it afterwards, so the Postgres cluster is
 * quiescent and a file-level copy is consistent.
 *
 * This is a full copy each time. If repositories grow large enough that backup
 * duration becomes a problem, switch to Backups.ofSyncs and give
 * /var-opt-gitlab/git-data/repositories its own incremental sync — but do not
 * layer a sync on top of ofVolumes, which would copy that tree twice.
 */
export const { createBackup, restoreInit } = sdk.setupBackups(
  async ({ effects }) => sdk.Backups.ofVolumes('main'),
)
