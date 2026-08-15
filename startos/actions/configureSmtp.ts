import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'

const { InputSpec } = sdk

const inputSpec = InputSpec.of({
  smtp: sdk.inputSpecConstants.smtpInputSpec,
})

export const configureSmtp = sdk.Action.withInput(
  'configure-smtp',

  async ({ effects }) => ({
    name: i18n('Configure Email'),
    description: i18n(
      'Set the outgoing mail server GitLab uses for sign-up confirmations, password resets and notifications.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => {
    const smtp = await storeJson.read((s) => s.smtp).once()
    return smtp ? { smtp: smtp as never } : {}
  },

  async ({ effects, input }) => {
    await storeJson.merge(effects, {
      smtp: input.smtp as unknown as {
        selection: string
        value: Record<string, unknown>
      },
    })
    return {
      version: '1',
      title: i18n('Email Settings Saved'),
      message: i18n(
        'Restart GitLab to apply the new mail settings. Reconfiguration takes a couple of minutes.',
      ),
      result: null,
    }
  },
)
