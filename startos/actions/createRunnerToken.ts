import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { gitlabApi } from '../gitlabApi'

const { InputSpec, Value } = sdk

export const inputSpec = InputSpec.of({
  description: Value.text({
    name: i18n('Runner Name'),
    description: i18n('How this runner is labelled in the GitLab admin area.'),
    required: true,
    default: 'startos-runner',
  }),
  tags: Value.text({
    name: i18n('Tags'),
    description: i18n(
      'Comma-separated tags. Jobs can target a runner by tag; leave blank for none.',
    ),
    required: false,
    default: null,
  }),
  runUntagged: Value.toggle({
    name: i18n('Run Untagged Jobs'),
    description: i18n(
      'Allow this runner to pick up jobs that specify no tags. Usually what you want for a single runner.',
    ),
    default: true,
  }),
})

/**
 * Mints a runner authentication token (the `glrt-` kind).
 *
 * GitLab removed the old shared registration tokens, so a runner is now created
 * server-side first and handed its own token. Doing that through
 * Ci::Runners::CreateRunnerService in-container avoids requiring the user to
 * mint a personal access token just to register a runner on their own box.
 *
 * The GitLab Runner package calls this cross-package, which is what makes
 * one-click runner setup possible. It is also useful on its own for attaching
 * a runner that lives somewhere else.
 */
export const createRunnerToken = sdk.Action.withInput(
  'create-runner-token',

  async ({ effects }) => ({
    name: i18n('Create Runner Token'),
    description: i18n(
      'Register a new CI/CD runner and return its authentication token.',
    ),
    warning: null,
    // Creating the runner writes to the database, so GitLab has to be up.
    allowedStatuses: 'only-running',
    group: null,
    visibility: 'enabled',
    // Actions default to user-only: another service calling this would be
    // rejected with "cannot be invoked directly by other services". The GitLab
    // Runner package declares GitLab as a dependency precisely so it can mint
    // itself a token without making the user copy one between two pages of the
    // same server, so it needs to be reachable by dependents.
    access: 'dependent',
  }),

  inputSpec,

  async () => ({}),

  async ({ effects, input }) => {
    const tagList = (input.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const res = await gitlabApi<{ id: number; token: string }>(
      effects,
      'POST',
      '/user/runners',
      {
        runner_type: 'instance_type',
        description: input.description,
        // GitLab's form encoding takes repeated/array params as a CSV string.
        tag_list: tagList.join(','),
        run_untagged: input.runUntagged,
      },
    )

    if (!res.ok) {
      throw new Error(
        i18n('GitLab refused to create the runner: ') + res.message,
      )
    }

    const token = res.value.token

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

