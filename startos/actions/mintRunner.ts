import { T } from '@start9labs/start-sdk'
import { gitlabApi } from '../gitlabApi'
import { i18n } from '../i18n'

/**
 * Create an instance-level runner and return its authentication token.
 *
 * Shared by the two actions that mint runners: the user-facing one, which takes
 * a name and tags, and the no-input one a dependent service calls.
 */
export async function mintRunner(
  effects: T.Effects,
  opts: { description: string; tags: string[]; runUntagged: boolean },
): Promise<string> {
  const res = await gitlabApi<{ id: number; token: string }>(
    effects,
    'POST',
    '/user/runners',
    {
      runner_type: 'instance_type',
      description: opts.description,
      // GitLab's form encoding takes repeated/array params as a CSV string.
      tag_list: opts.tags.join(','),
      run_untagged: opts.runUntagged,
    },
  )

  if (!res.ok) {
    throw new Error(i18n('GitLab refused to create the runner: ') + res.message)
  }

  return res.value.token
}
