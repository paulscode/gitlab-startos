import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

export const showInitialCredentials = sdk.Action.withoutInput(
  'show-initial-credentials',

  async ({ effects }) => ({
    name: i18n('Initial Credentials'),
    description: i18n(
      'Show the password generated for the built-in "root" administrator at install.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    // Deliberately unconditional. Action metadata is evaluated once at init, so
    // gating visibility on store contents would freeze whatever was true then —
    // the action would stay visible after the password is superseded, and stay
    // hidden if the store had not yet been seeded. The run function reports the
    // live state instead, which is always accurate.
    visibility: 'enabled',
  }),

  async ({ effects }) => {
    const store = await storeJson.read().once()
    const password = store?.initialRootPassword

    if (!password) {
      return {
        version: '1',
        title: i18n('Not Available'),
        message: i18n(
          'No generated password is on record. Use Reset Root Password to set a new one.',
        ),
        result: null,
      }
    }

    // Raising the task is a one-time nudge; the action itself stays available.
    await storeJson.merge(effects, { rootPasswordAcknowledged: true })

    return {
      version: '1',
      title: i18n('Initial Credentials'),
      message: i18n(
        'Sign in as "root" with this password, then change it from your GitLab profile.',
      ),
      result: {
        type: 'single',
        value: password,
        copyable: true,
        qr: false,
        masked: true,
      },
    }
  },
)
