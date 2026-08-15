import { FileHelper } from '@start9labs/start-sdk'
import { sdk } from './sdk'
import { MIN_UPGRADE_FROM, meetsFloor, nextHop } from './upgradeRules'

export {
  MIN_UPGRADE_FROM,
  RELEASES_URL,
  RELEASE_HISTORY,
  upgradeBlockedMessage,
} from './upgradeRules'

/**
 * The version file GitLab writes into its data directory. Present only once an
 * instance has been provisioned, so its absence means a fresh install.
 */
export const installedVersionFile = FileHelper.string({
  base: sdk.volumes.main,
  subpath: './var-opt-gitlab/gitlab-rails/VERSION',
})

export type GateResult =
  | { kind: 'fresh-install' }
  | { kind: 'ok'; installed: string }
  | {
      kind: 'too-old'
      installed: string
      floor: string
      /** Null when nothing published can bridge the gap. */
      nextHop: string | null
    }

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
    : {
        kind: 'too-old',
        installed,
        floor: MIN_UPGRADE_FROM,
        nextHop: nextHop(installed),
      }
}
