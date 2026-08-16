import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '19.2.2:1',
  releaseNotes: {
    en_US: `GitLab itself is unchanged; this release fixes the handover to the GitLab Runner package.

- The GitLab Runner package can now register itself. Its Configure action previously failed with an error about the action not being invokable by other services.
- Reworded the marketplace description, which wrapped in a way that read as though the app had problems.

**On ARM (aarch64) this build remains untested.**`,
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
    // A range vertex rather than one file per past version: everything
    // released so far carries the same data, so any of it reaches the current
    // version in a single hop and no chain of no-op migrations has to exist.
    other: {
      '<19.2.2:1': {
        up: async ({ effects }) => {},
      },
    },
  },
})
