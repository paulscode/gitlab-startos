import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { mintRunner } from './mintRunner'

/**
 * The no-input twin of Create Runner Token, for the GitLab Runner package to
 * call directly.
 *
 * It exists because a service can only invoke another service's action when
 * that action takes **no input**: the SDK validates submitted input against the
 * spec captured by a prior `getActionInput` on the same event, and a
 * cross-service call cannot perform that handshake — the two calls get
 * different event ids. Granting `access: 'dependent'` gets a caller past the
 * access check and no further.
 *
 * So the values are fixed rather than passed:
 *
 * - **untagged, accepting untagged jobs** — a tagged runner that refuses
 *   untagged jobs silently ignores most pipelines, which reads as the runner
 *   being broken. Tags can be added afterwards in GitLab's runner settings.
 * - **a fixed description** — the caller cannot supply one. Rename it in
 *   GitLab if you run more than one.
 *
 * Hidden from the UI: a user reaching for this by hand wants Create Runner
 * Token, which lets them choose both.
 */
export const createRunnerTokenAuto = sdk.Action.withoutInput(
  'create-runner-token-auto',

  async ({ effects }) => ({
    name: i18n('Create Runner Token (automatic)'),
    description: i18n(
      'Used by the GitLab Runner package to register itself. Creates an untagged runner that accepts any job.',
    ),
    warning: null,
    allowedStatuses: 'only-running',
    group: null,
    // Not user-facing: the equivalent action with input is the one to reach for.
    visibility: 'hidden',
    access: 'dependent',
  }),

  async ({ effects }) => {
    const token = await mintRunner(effects, {
      description: 'StartOS Runner',
      tags: [],
      runUntagged: true,
    })

    return {
      version: '1',
      title: i18n('Runner Token'),
      message: i18n(
        'Give this token to your runner. It is shown once; GitLab does not store a retrievable copy.',
      ),
      result: {
        type: 'single',
        value: token,
        copyable: true,
        qr: false,
        masked: true,
      },
    }
  },
)
