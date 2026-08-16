# Releasing

Two independent distribution paths, deliberately kept apart.

## GitHub Actions: what runs where

| Workflow | Runs on | Needs secrets | Active in this repo |
| --- | --- | --- | --- |
| `config-smoke.yml` | PRs touching the config, weekly, manual | no | **yes** |
| `build.yml` | PRs | no | **yes** |
| `release.yml` | version tags | `DEV_KEY`, S3 credentials | no — Start9-Community only |
| `tagAndRelease.yml` | pushes to `master` | `DEV_KEY`, S3 credentials | no — Start9-Community only |

The two publishing workflows are guarded with
`if: github.repository_owner == 'Start9-Community'`. They are kept intact
because that fork is where the community pipeline runs them, but they stay inert
here for two reasons: they would need the StartOS developer key copied into
GitHub secrets, and they publish to an S3-backed registry rather than the
maintainer's own VPS. Releases from this repo are built locally and published by
hand instead.

The checks that need no secrets do run here, which is the part worth having on
every pull request.

## Releasing a new version

Everything below happens on the build machine except step 3, which happens on
the air-gapped one.

**1. Bump and verify.** Follow `UPDATING.md` — image tag, `current.ts`,
`MIN_UPGRADE_FROM`, `RELEASE_HISTORY` — then:

```sh
npm run check         # types + release-history reachability
npm run check:config  # boots the real image, proves the config reconfigures
```

**2. Build.**

```sh
make release          # -> builds/<version>/*.s9pk + SHA256SUMS
```

**3. Sign, off-box.** Carry `builds/<version>/SHA256SUMS` to the air-gapped
machine, sign it, and bring the detached signature back beside it:

```sh
gpg --armor --detach-sign SHA256SUMS     # -> SHA256SUMS.asc
```

Signatures are gitignored (`*.asc`, `*.sig`, `*.gpg`) — they live only in
`builds/`, which is gitignored too, and in the published release.

**4. Tag and publish to GitHub.**

```sh
git tag "$(make -s print-tag)"           # v<upstream>_<revision>, e.g. v19.2.2_0
git push origin "$(make -s print-tag)"   # push tags individually
make publish-github
```

`publish-github` re-verifies the checksums before uploading (the files have been
carried around since they were generated), refuses any asset at or above
GitHub's 2 GiB limit, warns if no signature is present, shows exactly what it is
about to publish and to which repo, and asks before doing it.

**5. Publish to the registry.** From the registry checkout:

```sh
cd ~/workspace/start9-store/start9-040
make publish PKG=/mnt/Black/gitlab-apps/gitlab-startos/builds
make categorize          # only needed when categories change
```

Its `publish.sh` picks the newest version directory and the `*-040.s9pk` inside
it, uploads to the VPS, then indexes it.

## Why GitHub releases are not optional

When an update crosses GitLab's upgrade floor, the package refuses to start and
tells the user to install a specific older release first, pointing at the
releases page. If that release was never published there, the instruction is a
dead end and the user is stranded.

So: **keep old releases published**, and never delete one that
`RELEASE_HISTORY` names.

## Asset size

GitHub caps a single release asset at 2 GiB. The x86_64 s9pk is about 1.1 GiB,
so there is roughly 45% headroom — but it grows with GitLab. `publish-github`
fails rather than letting a too-large upload get partway.

This is also why the package ships per-architecture s9pks rather than one
universal file: a combined build measured 2.05 GiB, over the limit.

## Community registry

Submission is a separate, later process — see the packaging guide's Publishing
page. In outline: email `submissions@start9.com`, Start9 forks this repo into
`Start9-Community`, and from then on changes go as pull requests against that
fork, where the guarded workflows above do the building and publishing.
