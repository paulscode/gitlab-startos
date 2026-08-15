import { storeJson } from '../fileModels/store.json'
import { gitlabApi } from '../gitlabApi'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { generateRootPassword } from '../utils'

export const resetRootPassword = sdk.Action.withoutInput(
  'reset-root-password',

  async ({ effects }) => ({
    name: i18n('Reset Root Password'),
    description: i18n(
      'Generate a new password for the built-in "root" administrator and display it.',
    ),
    warning: i18n(
      'This replaces the current root password immediately. Anyone relying on the old one will be locked out.',
    ),
    // Goes through GitLab's API, so the service has to be up.
    allowedStatuses: 'only-running',
    group: null,
    visibility: 'enabled',
  }),

  async ({ effects }) => {
    const password = generateRootPassword()

    // The administrator is always id 1: it is the first user the instance
    // creates, and the package creates it itself when GitLab's own seeding
    // does not run.
    const res = await gitlabApi(effects, 'PUT', '/users/1', { password })

    if (!res.ok) {
      throw new Error(i18n('Could not reset the password: ') + res.message)
    }

    // The generated install password is no longer the truth; drop it so the
    // Initial Credentials action stops offering a stale value.
    await storeJson.merge(effects, {
      initialRootPassword: '',
      rootPasswordAcknowledged: true,
    })

    return {
      version: '1',
      title: i18n('Root Password Reset'),
      message: i18n(
        'Save this password now — it is not stored and cannot be shown again.',
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
