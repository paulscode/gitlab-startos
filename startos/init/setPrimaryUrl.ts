import { setPrimaryUrl as setPrimaryUrlAction } from '../actions/setPrimaryUrl'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { getHttpInterfaceUrls } from '../utils'

/** Scheme + hostname, ignoring the port. Null if the URL will not parse. */
function hostOf(url: string): string | null {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.hostname}`
  } catch {
    return null
  }
}

/**
 * Keep the stored primary URL honest.
 *
 * Seeds the LAN address at install so a fresh instance works with no user
 * action, then keeps the stored choice pointing at something reachable.
 *
 * The subtlety is that a stored URL carries a port StartOS assigns, and it
 * reassigns them freely — every reinstall or restore hands out different ones.
 * Comparing whole URLs therefore reports "your address disappeared" for what is
 * really the same address on a new port, which is not a decision the user made
 * and not one they should be asked about. Worse, raising a critical task there
 * blocks the service from starting: a restore would land the user with a GitLab
 * that will not boot until they re-pick the address they already had, at
 * exactly the moment they are least equipped to reason about it.
 *
 * So the choice is tracked by *host*, not by URL. A port move heals silently. A
 * host genuinely disappearing — the user turned off a gateway — still warrants
 * telling them, because their clone URLs and email links are about to change,
 * but not by making the service unstartable over it.
 */
export const setPrimaryUrl = sdk.setupOnInit(async (effects) => {
  const urls = await getHttpInterfaceUrls(effects)
  const current = await storeJson.read((s) => s.primaryUrl).const(effects)

  // No addresses exported yet; nothing sensible to decide. main falls back to
  // the live address, and this runs again when interfaces settle.
  if (!urls.length) return

  if (!current) {
    // Prefer the .local address: every StartOS user has one, and it is the only
    // address available before Tor or a domain is configured.
    const seed = urls.find((u) => u.includes('.local')) ?? urls[0]
    await storeJson.merge(
      effects,
      { primaryUrl: seed },
      { allowWriteAfterConst: true },
    )
    return
  }

  // Still exactly right.
  if (urls.includes(current)) return

  // Same host, new port — StartOS reassigned it. Heal quietly; the user's
  // choice has not changed.
  const currentHost = hostOf(current)
  const sameHost = currentHost
    ? urls.find((u) => hostOf(u) === currentHost)
    : undefined
  if (sameHost) {
    console.info(
      `Primary URL moved to a new port (${current} -> ${sameHost}); updating.`,
    )
    await storeJson.merge(
      effects,
      { primaryUrl: sameHost },
      { allowWriteAfterConst: true },
    )
    // A previous run may have raised the task before this healing existed.
    await sdk.action
      .clearTask(effects, `${sdk.manifest.id}:${setPrimaryUrlAction.id}`)
      .catch(() => null)
    return
  }

  // The host itself is gone. Fall back to something reachable so the service
  // still starts — booting with an unreachable external_url would give every
  // user broken clone URLs — and prompt for a deliberate choice.
  const fallback = urls.find((u) => u.includes('.local')) ?? urls[0]
  console.warn(
    `Primary URL ${current} is no longer available; falling back to ${fallback}.`,
  )
  await storeJson.merge(
    effects,
    { primaryUrl: fallback },
    { allowWriteAfterConst: true },
  )

  await sdk.action.createOwnTask(effects, setPrimaryUrlAction, 'important', {
    reason: i18n(
      'The address GitLab treated as canonical is no longer available. It is now using a different one — confirm or change it.',
    ),
  })
})
