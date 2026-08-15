import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { generateRootPassword, mount } from '../utils'

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
    // The reset drives gitlab-rails, which needs the database up — so GitLab
    // must be running for this to work.
    allowedStatuses: 'only-running',
    group: null,
    visibility: 'enabled',
  }),

  async ({ effects }) => {
    const password = generateRootPassword()

    // Run against the live service: gitlab-rails talks to the Postgres cluster
    // that the running instance owns, over its socket on the shared volume.
    const result = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'gitlab' },
      mount,
      'gitlab-reset-password',
      async (sub) =>
        sub.exec([
          'gitlab-rails',
          'runner',
          // find_by! raises if root was renamed or deleted, which surfaces as a
          // non-zero exit and a visible error rather than silent success.
          `u = User.find_by!(username: 'root'); u.password = u.password_confirmation = ${JSON.stringify(password)}; u.password_automatically_set = false; u.save!`,
        ]),
    )

    if (result.exitCode !== 0) {
      throw new Error(
        i18n('Could not reset the password. Check the service logs.'),
      )
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
