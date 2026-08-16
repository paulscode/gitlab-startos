import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '19.2.2:0',
  releaseNotes: {
    en_US:
      `Initial release of GitLab Community Edition for StartOS. Git hosting over HTTPS and SSH, issues, merge requests, wikis and CI/CD. Pair with the GitLab Runner package to run pipelines on your own hardware.

**On ARM (aarch64) this build is untested.** It is published so ARM users can try it, but it has not been run on ARM hardware, and GitLab documents outstanding issues on that architecture. Take a backup before relying on it, and please report what you find. The x86_64 build has been tested.`,
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
