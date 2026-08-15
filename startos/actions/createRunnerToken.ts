import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { mount } from '../utils'

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
  }),

  inputSpec,

  async () => ({}),

  async ({ effects, input }) => {
    const tagList = (input.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const params = {
      runner_type: 'instance_type',
      description: input.description,
      tag_list: tagList,
      run_untagged: input.runUntagged,
    }

    const script = [
      `user = User.find_by!(username: 'root')`,
      `res = ::Ci::Runners::CreateRunnerService.new(user: user, params: ${rubyLiteral(params)}).execute`,
      // Print a sentinel rather than the bare token so the surrounding Rails
      // boot chatter cannot be mistaken for the value.
      `if res.success? then puts "STARTOS_TOKEN=#{res.payload[:runner].token}" else puts "STARTOS_ERROR=#{res.message}" end`,
    ].join('; ')

    const result = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'gitlab' },
      mount,
      'gitlab-create-runner',
      async (sub) => sub.exec(['gitlab-rails', 'runner', script]),
    )

    const stdout = String(result.stdout)
    const token = stdout.match(/STARTOS_TOKEN=(\S+)/)?.[1]

    if (result.exitCode !== 0 || !token) {
      const err = stdout.match(/STARTOS_ERROR=(.*)/)?.[1]
      throw new Error(
        err
          ? i18n('GitLab refused to create the runner: ') + err
          : i18n('Could not create the runner. Check the service logs.'),
      )
    }

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

/** Render a JS value as a Ruby literal. Only the shapes used above. */
function rubyLiteral(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(rubyLiteral).join(', ')}]`
  if (value !== null && typeof value === 'object') {
    const pairs = Object.entries(value).map(
      ([k, v]) => `${k}: ${rubyLiteral(v)}`,
    )
    return `{ ${pairs.join(', ')} }`
  }
  // JSON string/number/boolean literals are valid Ruby literals, and
  // JSON.stringify escapes quotes and backslashes for us.
  return JSON.stringify(value)
}
