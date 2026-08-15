import { FileHelper } from '@start9labs/start-sdk'
import { sdk } from './sdk'

/**
 * GitLab refuses to upgrade across too wide a gap.
 *
 * Each release hard-codes a single floor — `min_version` in
 * `omnibus-ctl/lib/gitlab_ctl/upgrade_check.rb` — and the container's
 * entrypoint runs `gitlab-ctl upgrade-check` against it before doing anything
 * else. The check passes only if the *installed* version's major/minor is at or
 * above that floor. Fail it and the entrypoint exits under `set -e`, so the
 * service simply never starts.
 *
 * The floor is not a moving target within a release: it is one number, and it
 * rises roughly once per major cycle (19.1 and 19.2 both require 18.11; 18.11
 * required 18.8). Keeping a copy here lets the package say something useful
 * *before* handing control to an entrypoint that would otherwise die with the
 * reason buried in its logs.
 *
 * MUST be updated whenever the image tag is bumped — see UPDATING.md. Read it
 * out of the candidate image with:
 *
 *   docker run --rm --entrypoint sh gitlab/gitlab-ce:<TAG> -c \
 *     "grep -oE \"'[0-9]+\\.[0-9]+'\" \
 *      /opt/gitlab/embedded/service/omnibus-ctl/lib/gitlab_ctl/upgrade_check.rb | head -1"
 */
export const MIN_UPGRADE_FROM = '18.11'

/**
 * The version file GitLab writes into its data directory. Present only once an
 * instance has been provisioned, so its absence means a fresh install.
 */
export const installedVersionFile = FileHelper.string({
  base: sdk.volumes.main,
  subpath: './var-opt-gitlab/gitlab-rails/VERSION',
})

/** Compare `major.minor` pairs. True when `version` is at or above `floor`. */
export function meetsFloor(version: string, floor: string): boolean {
  const [vMaj, vMin] = version
    .trim()
    .split('.')
    .map((n) => parseInt(n, 10))
  const [fMaj, fMin] = floor
    .trim()
    .split('.')
    .map((n) => parseInt(n, 10))
  // Unparseable: fail open and let GitLab's own check decide.
  if (!Number.isFinite(vMaj) || !Number.isFinite(vMin)) return true
  if (vMaj !== fMaj) return vMaj > fMaj
  return vMin >= fMin
}

export type GateResult =
  | { kind: 'fresh-install' }
  | { kind: 'ok'; installed: string }
  | { kind: 'too-old'; installed: string; floor: string }

/**
 * Decide whether this image can take over the data already on the volume.
 *
 * Fails open on anything unreadable or unparseable: blocking a start because
 * we could not read a file would be worse than the failure being pre-empted,
 * and GitLab's own check still runs immediately afterwards.
 */
export async function checkUpgradeGate(): Promise<GateResult> {
  const raw = await installedVersionFile.read().once()
  if (!raw || !raw.trim()) return { kind: 'fresh-install' }

  const installed = raw.trim()
  return meetsFloor(installed, MIN_UPGRADE_FROM)
    ? { kind: 'ok', installed }
    : { kind: 'too-old', installed, floor: MIN_UPGRADE_FROM }
}
