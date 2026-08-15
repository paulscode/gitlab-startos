import { storeJson } from '../fileModels/store.json'
import { sdk } from '../sdk'
import { generateRootPassword } from '../utils'

/**
 * Create the store on first install and mint the initial root password.
 *
 * The password has to exist before main assembles GITLAB_OMNIBUS_CONFIG, since
 * `initial_root_password` is only honoured on the very first reconfigure — once
 * the users table exists Omnibus ignores it. Generating it here rather than in
 * main also keeps it stable across restarts.
 */
export const seedStore = sdk.setupOnInit(async (effects) => {
  const existing = await storeJson.read().const(effects)
  if (existing) return

  await storeJson.merge(
    effects,
    {
      primaryUrl: '',
      initialRootPassword: generateRootPassword(),
      rootPasswordAcknowledged: false,
      smtp: { selection: 'disabled', value: {} },
    },
    { allowWriteAfterConst: true },
  )
})
