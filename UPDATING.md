# Updating GitLab

## Tracking upstream

GitLab publishes a minor release monthly and patch releases more often. The
Community Edition images are `gitlab/gitlab-ce` on Docker Hub, tagged
`<version>-ce.0`.

Find the newest stable tag:

```sh
TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:gitlab/gitlab-ce:pull" | jq -r .token)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://registry.hub.docker.com/v2/repositories/gitlab/gitlab-ce/tags?page_size=50&ordering=last_updated" \
  | jq -r '.results[].name' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+-ce\.0$' | head
```

## What to change

Two places, and they must move together:

1. `startos/manifest/index.ts` — `images.gitlab.source.dockerTag`
2. `startos/versions/current.ts` — `version` (and add a `VersionInfo` entry for
   the version being replaced, in `startos/versions/`)

## Before releasing a bump

**Verify the configuration still reconfigures.** This is the failure mode that
actually bites. Omnibus removes configuration keys across minor releases, and a
removed key is a hard abort — `gitlab-ctl reconfigure` refuses to run and the
service never starts. Two keys have already been lost this way (`grafana` and
`mattermost`), and several the package relies on are deprecated.

Boot the candidate image with the config this package generates and confirm both
that it succeeds and that it prints no new deprecations:

```sh
docker run --rm --name gitlab-cfgcheck --shm-size 256m \
  -e GITLAB_OMNIBUS_CONFIG="$(cat <<'RUBY'
external_url 'https://example.local'
gitlab_rails['nginx']['listen_port'] = 80
gitlab_rails['nginx']['listen_https'] = false
letsencrypt['enable'] = false
gitlab_pages['enable'] = false
prometheus_monitoring['enable'] = false
gitlab_kas['enable'] = false
puma['worker_processes'] = 2
sidekiq['max_concurrency'] = 9
postgresql['shared_buffers'] = '256MB'
registry['enable'] = false
gitlab_rails['registry_enabled'] = false
RUBY
)" \
  gitlab/gitlab-ce:<NEW_TAG> 2>&1 | tee /tmp/cfgcheck.log

grep -E 'Reconfigured!|Deprecations:|Removed configurations' /tmp/cfgcheck.log
```

Any `Deprecations:` block naming a key this package sets must be resolved by
moving to the replacement key **before** release, not after it becomes fatal.

**Check the upgrade path.** GitLab does not permit arbitrary version jumps and
enforces this at boot via `gitlab-ctl upgrade-check`. Consult
<https://docs.gitlab.com/update/> and make sure the version graph does not offer
a jump upstream forbids — if one is required, add the intermediate version as
its own release.

**Rehearse the upgrade.** Install the current release, then update to the
candidate on a real StartOS box. Database migrations run on first boot after an
upgrade and can take considerably longer than a normal start.

## The upgrade floor — check this on every bump

GitLab refuses to upgrade across too wide a version gap. Each release hard-codes
a single floor, and the container entrypoint enforces it *before* doing anything
else; failing it means the service never starts.

Read the candidate image's floor:

```sh
docker run --rm --entrypoint sh gitlab/gitlab-ce:<NEW_TAG> -c \
  "grep -oE \"'[0-9]+\.[0-9]+'\" \
   /opt/gitlab/embedded/service/omnibus-ctl/lib/gitlab_ctl/upgrade_check.rb | head -1"
```

Then:

1. **Update `MIN_UPGRADE_FROM` in `startos/upgradeGate.ts`** to match. The
   package uses it to fail with a readable message instead of a dead container.

2. **If the floor rose above the previous release's upstream version, this
   release is a required stop.** StartOS offers every user a single hop from
   whatever they have to the newest version, so someone who skipped several
   releases would otherwise be handed an update that cannot start. Say so
   plainly at the top of the release notes — name the version they must install
   first — and keep that intermediate version published so they can.

3. If the floor did not move, no special handling is needed.
