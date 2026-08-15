import { setPrimaryUrl as setPrimaryUrlAction } from '../actions/setPrimaryUrl'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { getHttpInterfaceUrls } from '../utils'

/**
 * Keep the stored primary URL honest.
 *
 * Seeds the LAN address at install so a fresh instance works with no user
 * action. Afterwards this watches the available addresses: if the chosen one
 * disappears — the user turned off a gateway, say — GitLab would keep printing
 * clone URLs nobody can reach, so raise a task rather than silently reassigning
 * it. Picking a replacement automatically would rewrite every clone URL on the
 * instance without the user asking.
 */
export const setPrimaryUrl = sdk.setupOnInit(async (effects) => {
  const urls = await getHttpInterfaceUrls(effects)
  const current = await storeJson.read((s) => s.primaryUrl).const(effects)

  if (!current) {
    // Prefer the .local address: it is the one every StartOS user has, and the
    // only one available before Tor or clearnet is configured.
    const seed = urls.find((u) => u.includes('.local')) ?? urls[0]
    if (seed) {
      await storeJson.merge(
        effects,
        { primaryUrl: seed },
        { allowWriteAfterConst: true },
      )
    }
    return
  }

  if (urls.length && !urls.includes(current)) {
    await sdk.action.createOwnTask(
      effects,
      setPrimaryUrlAction,
      'critical',
      {
        reason: i18n(
          'The address GitLab treats as canonical is no longer available. Choose another.',
        ),
      },
    )
  }
})
