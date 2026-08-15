# AGENTS.md

This is a StartOS service-package repository — it builds a `.s9pk` for StartOS.

Develop it inside a StartOS packaging workspace created by `start-cli s9pk init-workspace`,
which provides the packaging guide and agent context one level up. If you're reading this in a
bare clone with no workspace, the full guide is at <https://docs.start9.com/packaging>.

Work this package's `TODO.md` from top to bottom. Keep `README.md` (the package's technical reference — the only one an AI support or administering agent reads) and `instructions.md` (end-user docs) in sync with your changes.

## This repo

This package wraps the upstream GitLab Community Edition Omnibus image without
modifying it. All GitLab configuration is generated in `startos/main.ts` and
injected via `GITLAB_OMNIBUS_CONFIG`; nothing writes `gitlab.rb` directly.

Two constraints that are easy to violate and expensive to discover:

- **Never set an Omnibus key that upstream has removed.** Reconfigure aborts and
  the service never starts. Prefer current spellings over deprecated ones —
  `gitlab_rails['nginx'][...]`, not bare `nginx[...]`. `UPDATING.md` has the
  pre-release check that catches this.
- **Health checks must run inside the container.** GitLab restricts `/-/health`
  and `/-/readiness` to `127.0.0.0/8`, so probing over the bridge returns 404.
  Widening the allowlist would expose them to the LAN, because proxied traffic
  also arrives from the bridge.
