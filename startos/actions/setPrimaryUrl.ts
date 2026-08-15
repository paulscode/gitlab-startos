import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { getHttpInterfaceUrls } from '../utils'

const { InputSpec, Value } = sdk

export const inputSpec = InputSpec.of({
  url: Value.dynamicSelect(async ({ effects }) => {
    const urls = await getHttpInterfaceUrls(effects)
    return {
      name: i18n('Primary URL'),
      values: urls.reduce(
        (obj, url) => ({ ...obj, [url]: url }),
        {} as Record<string, string>,
      ),
      default: '',
    }
  }),
})

export const setPrimaryUrl = sdk.Action.withInput(
  'set-primary-url',

  async ({ effects }) => ({
    name: i18n('Set Primary URL'),
    description: i18n(
      'Choose which of your addresses GitLab treats as canonical. It is baked into clone URLs, generated links and outgoing email.',
    ),
    warning: i18n(
      'Changing this rewrites the clone URLs GitLab shows. Existing local clones keep working, but their remotes will point at the old address until updated.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => ({
    url: (await storeJson.read((s) => s.primaryUrl).once()) || undefined,
  }),

  async ({ effects, input }) => {
    await storeJson.merge(effects, { primaryUrl: input.url })
    return {
      version: '1',
      title: i18n('Primary URL Set'),
      message: i18n(
        'Restart GitLab for the new address to take effect. Reconfiguration takes a couple of minutes.',
      ),
      result: null,
    }
  },
)
