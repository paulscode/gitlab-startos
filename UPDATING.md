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
