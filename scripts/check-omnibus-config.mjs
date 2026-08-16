// Boot the GitLab image this package ships and prove the configuration it
// generates still reconfigures cleanly.
//
// This exists because of a failure mode that has already bitten twice: Omnibus
// *removes* configuration keys across releases, and a removed key is a hard
// abort, not a warning. `gitlab-ctl reconfigure` refuses to run and the service
// never starts. `grafana[...]` and `mattermost[...]` are both gone as of 19.x,
// and several keys this package relies on are deprecated — which is the state a
// key is in immediately before it is removed.
//
// Left to chance, the discovery event is a user's install failing after an
// update. This turns it into a build failure instead.
//
// The config comes from startos/omnibusConfig.ts — the same code that runs in
// production — rather than a copy maintained here, which would drift and be
// wrong exactly when it mattered.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CONTAINER = 'gitlab-omnibus-cfgcheck'
// Long enough for a full Chef converge plus database migrations on a cold,
// slow CI runner. Reference hardware does it in about four minutes.
const TIMEOUT_MS = 20 * 60 * 1000

function imageTagFromManifest() {
  const src = readFileSync('startos/manifest/index.ts', 'utf8')
  const m = src.match(/dockerTag:\s*'([^']+)'/)
  if (!m) throw new Error('could not find dockerTag in startos/manifest/index.ts')
  return m[1]
}

function docker(args, opts = {}) {
  return spawnSync('docker', args, { encoding: 'utf8', ...opts })
}

const out = mkdtempSync(join(tmpdir(), 'omnibus-cfg-'))
let started = false
try {
  execFileSync(
    'npx',
    ['tsc', 'startos/omnibusConfig.ts', '--outDir', out, '--module', 'es2022',
     '--target', 'es2022', '--moduleResolution', 'bundler', '--ignoreConfig'],
    { stdio: 'inherit' },
  )
  const { omnibusConfig } = await import(join(out, 'omnibusConfig.js'))

  // Representative of a real install: an external URL StartOS would supply, a
  // non-default SSH port (StartOS rarely grants 22), and SMTP populated so the
  // mail keys are exercised too.
  const config = omnibusConfig({
    externalUrl: 'https://cfgcheck.local',
    sshPort: 2222,
    initialRootPassword: 'CfgCheckPassword-1234',
    smtp: {
      host: 'smtp.example.com',
      port: 587,
      from: 'gitlab@example.com',
      username: 'gitlab',
      password: 'unused',
      security: 'starttls',
    },
  })

  const image = imageTagFromManifest()
  console.log(`\nchecking ${image}\n`)

  docker(['rm', '-f', CONTAINER], { stdio: 'ignore' })
  const pull = docker(['pull', image], { stdio: 'inherit' })
  if (pull.status !== 0) throw new Error(`docker pull failed for ${image}`)

  const run = docker([
    'run', '-d', '--name', CONTAINER, '--shm-size', '256m',
    '-e', `GITLAB_OMNIBUS_CONFIG=${config}`,
    image,
  ])
  if (run.status !== 0) throw new Error(`docker run failed: ${run.stderr}`)
  started = true

  const deadline = Date.now() + TIMEOUT_MS
  let verdict = null
  while (Date.now() < deadline && !verdict) {
    await new Promise((r) => setTimeout(r, 10_000))
    const logs = docker(['logs', CONTAINER]).stdout ?? ''

    if (/Removed configurations found/.test(logs)) {
      verdict = { ok: false, why: 'config uses a key Omnibus has REMOVED', logs }
    } else if (/UnknownConfigOptionError/.test(logs)) {
      verdict = { ok: false, why: 'config uses a key Omnibus does not recognise', logs }
    } else if (/gitlab Reconfigured!/.test(logs)) {
      verdict = { ok: true, logs }
    } else if (!docker(['inspect', '-f', '{{.State.Running}}', CONTAINER]).stdout?.trim()?.startsWith('true')) {
      verdict = { ok: false, why: 'container exited before reconfigure completed', logs }
    }
  }

  if (!verdict) {
    throw new Error(`reconfigure did not finish within ${TIMEOUT_MS / 60000} minutes`)
  }

  if (!verdict.ok) {
    console.error(`\nFAILED: ${verdict.why}\n`)
    console.error(verdict.logs.split('\n').slice(-40).join('\n'))
    process.exit(1)
  }

  // Reconfigure succeeded — now catch keys on their way out. Every deprecation
  // here is ours, because GITLAB_OMNIBUS_CONFIG is the only configuration this
  // container has. Today's deprecation is tomorrow's hard abort, so treat it as
  // a failure now rather than after it breaks someone's install.
  const dep = verdict.logs.match(/Deprecations:\n([\s\S]*?)\n\n/)
  if (dep) {
    console.error('\nFAILED: the config uses deprecated keys:\n')
    console.error(dep[1])
    console.error('Move to the replacement keys before they are removed.\n')
    process.exit(1)
  }

  console.log('\nomnibus config ok — reconfigured cleanly, no deprecations\n')
} finally {
  if (started) {
    docker(['rm', '-f', CONTAINER], { stdio: 'ignore' })
  }
  rmSync(out, { recursive: true, force: true })
}
