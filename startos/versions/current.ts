import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '19.2.2:0',
  releaseNotes: {
    en_US:
      'Initial release of GitLab Community Edition for StartOS. Git hosting over HTTPS and SSH, issues, merge requests, wikis and CI/CD. Pair with the GitLab Runner package to run pipelines on your own hardware.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
