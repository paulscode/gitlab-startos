import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'gitlab',
  title: 'GitLab',
  license: 'MIT',
  packageRepo: 'https://github.com/paulscode/gitlab-startos',
  upstreamRepo: 'https://gitlab.com/gitlab-org/omnibus-gitlab',
  marketingUrl: 'https://about.gitlab.com/',
  donationUrl: null,
  description: { short, long },
  volumes: ['main'],
  images: {
    gitlab: {
      // The official Omnibus CE image: a self-contained GitLab with PostgreSQL,
      // Redis, Gitaly, Workhorse, Puma, Sidekiq, nginx and sshd under runit.
      // Bump this tag and startos/versions/current.ts together — see UPDATING.md.
      source: { dockerTag: 'gitlab/gitlab-ce:19.2.2-ce.0' },
      // Upstream publishes amd64 and arm64 only; there is no riscv64 build.
      // Both are built here, but releases currently ship x86_64 only because
      // aarch64 has not been validated on real hardware and GitLab documents
      // outstanding ARM issues.
      arch: ['x86_64', 'aarch64'],
    },
  },
  dependencies: {},
  // GitLab idles around 3 GiB with Puma trimmed to two workers. Below 4 GiB the
  // install is not worth attempting, so refuse it rather than let the user
  // discover that by watching it get OOM-killed.
  hardwareRequirements: {
    ram: 4096,
  },
})
