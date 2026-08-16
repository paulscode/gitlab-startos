import { T } from '@start9labs/start-sdk'
import { showInitialCredentials } from './actions/showInitialCredentials'
import { ensureRootUser } from './ensureRootUser'
import {
  generateInternalToken,
  mintInternalTokenScript,
} from './gitlabApi'
import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { checkUpgradeGate, upgradeBlockedMessage } from './upgradeGate'
import { httpInterfaceId, mainHostId, mount, sshInterfaceId } from './utils'

/**
 * Ruby evaluated by Omnibus before it reads /etc/gitlab/gitlab.rb.
 *
 * Two rules govern what may appear here, both learned the hard way:
 *
 *  1. A key Omnibus has *removed* is a hard abort, not a warning — reconfigure
 *     refuses to run and the service never starts. `grafana[...]` and
 *     `mattermost[...]` are both removed as of 19.x. Never reintroduce them.
 *  2. Prefer the current spelling of keys that have moved. `nginx['listen_port']`
 *     and `nginx['listen_https']` still work but are deprecated in favour of the
 *     `gitlab_rails['nginx'][...]` forms, and deprecated keys become removed keys.
 */
function omnibusConfig(opts: {
  externalUrl: string
  sshPort: number | null
  initialRootPassword: string | null
  smtp: T.SmtpValue | null
}): string {
  const lines = [
    `external_url ${JSON.stringify(opts.externalUrl)}`,

    // StartOS terminates TLS ahead of us. nginx serves plaintext on 80 while
    // Rails is told the request arrived over HTTPS, so generated links and
    // redirects use https rather than downgrading the user to http.
    `gitlab_rails['nginx']['listen_port'] = 80`,
    `gitlab_rails['nginx']['listen_https'] = false`,
    `gitlab_rails['nginx']['proxy_set_headers'] = { 'X-Forwarded-Proto' => 'https', 'X-Forwarded-Ssl' => 'on' }`,
    // The OS owns certificates; GitLab must not try to obtain its own.
    `letsencrypt['enable'] = false`,

    // Trimmed for a single-box deployment. These bring idle memory from roughly
    // 4.5 GiB to around 3 GiB with no user-visible loss on a small instance.
    `gitlab_pages['enable'] = false`,
    `prometheus_monitoring['enable'] = false`,
    `gitlab_kas['enable'] = false`,
    `puma['worker_processes'] = 2`,
    `sidekiq['max_concurrency'] = 9`,
    `postgresql['shared_buffers'] = '256MB'`,

    // The container registry needs its own port, its own TLS trust story on
    // every client, and unbounded disk. Off until that is built out properly.
    `registry['enable'] = false`,
    `gitlab_rails['registry_enabled'] = false`,
  ]

  // The SSH port GitLab advertises in clone URLs must be the port StartOS
  // actually assigned externally, which is not necessarily 22.
  if (opts.sshPort !== null) {
    lines.push(`gitlab_rails['gitlab_shell_ssh_port'] = ${opts.sshPort}`)
  }

  // Belt and braces. This is only consumed by `db:seed_fu`, which Omnibus runs
  // on the seeding path but not on the `db:migrate` path it actually takes
  // here — so it frequently does nothing at all, and the "Default admin account
  // has been configured" line it prints is not evidence an account exists. The
  // initial-credentials oneshot is what actually guarantees the account; this
  // stays because it costs nothing and does the right thing when seeding runs.
  if (opts.initialRootPassword) {
    lines.push(
      `gitlab_rails['initial_root_password'] = ${JSON.stringify(opts.initialRootPassword)}`,
    )
  }

  if (opts.smtp) {
    const s = opts.smtp
    lines.push(
      `gitlab_rails['smtp_enable'] = true`,
      `gitlab_rails['smtp_address'] = ${JSON.stringify(s.host)}`,
      `gitlab_rails['smtp_port'] = ${s.port}`,
      `gitlab_rails['gitlab_email_from'] = ${JSON.stringify(s.from)}`,
      `gitlab_rails['smtp_tls'] = ${s.security === 'tls'}`,
      `gitlab_rails['smtp_enable_starttls_auto'] = ${s.security === 'starttls'}`,
    )
    if (s.username) {
      lines.push(
        `gitlab_rails['smtp_user_name'] = ${JSON.stringify(s.username)}`,
        `gitlab_rails['smtp_authentication'] = 'login'`,
      )
    }
    if (s.password) {
      lines.push(`gitlab_rails['smtp_password'] = ${JSON.stringify(s.password)}`)
    }
  } else {
    lines.push(`gitlab_rails['smtp_enable'] = false`)
  }

  return lines.join('\n')
}

export const main = sdk.setupMain(async ({ effects }) => {
  console.info(i18n('Starting GitLab!'))

  const store = await storeJson.read().const(effects)
  if (!store) throw new Error(i18n('Store not found'))

  // GitLab will not upgrade across too wide a version gap, and enforces that in
  // its entrypoint by exiting before it does anything. Catch it here instead so
  // the user gets a sentence naming the version to install first, rather than a
  // container that dies with the reason buried in its logs.
  const gate = await checkUpgradeGate()
  if (gate.kind === 'too-old') {
    const message = upgradeBlockedMessage(gate)
    console.error(message)

    // Report the condition as a failing health check rather than throwing.
    //
    // Throwing does stop GitLab from launching, which is the important part —
    // but it surfaces nowhere the user looks: it never reaches the log stream,
    // leaves `statusInfo.error` null, and the dashboard shows the service as
    // "Starting" forever. Someone waiting on that has no reason to suspect it
    // will never finish, let alone to go reading logs.
    //
    // A standalone health check has no process behind it, so GitLab still never
    // starts and there is no crash loop — but the dashboard shows a failed
    // check carrying the explanation and the version to install next.
    return sdk.Daemons.of(effects).addHealthCheck('upgrade-blocked', {
      ready: {
        display: i18n('Upgrade Blocked'),
        // The condition cannot change while the service runs: it is decided by
        // what is on disk. Poll slowly; the first result is the lasting one.
        trigger: sdk.trigger.cooldownTrigger(60_000),
        fn: async () => ({ result: 'failure' as const, message }),
      },
      requires: [],
    })
  }

  // Both values come off the one host record, and only these two are returned,
  // so main re-runs when the web address or the assigned SSH port changes and
  // not on unrelated host churn.
  const { externalUrl, assignedSshPort } = await sdk.host
    .getOwn(effects, mainHostId, (host) => {
      if (!host) return { externalUrl: null, assignedSshPort: null }
      const ifaces = Object.values(host.bindings).flatMap((b) =>
        Object.values(b.interfaces),
      )
      const http = ifaces.find((i) => i.id === httpInterfaceId)
      const ssh = ifaces.find((i) => i.id === sshInterfaceId)
      return {
        externalUrl: http
          ? (http.addressInfo.nonLocal.format()[0] ?? null)
          : null,
        assignedSshPort: ssh
          ? (ssh.addressInfo
              .filter({ exclude: { kind: 'plugin' } })
              .hostnames?.[0]?.port ?? null)
          : null,
      }
    })
    .const()

  // The user's stored choice wins; the live address is only a fallback for the
  // window between install and the init watcher seeding the store.
  const chosenUrl = store.primaryUrl || externalUrl
  if (!chosenUrl) {
    throw new Error(
      i18n('No web address is available yet. Enable one in the Interfaces tab.'),
    )
  }

  let smtp: T.SmtpValue | null = null
  if (store.smtp.selection === 'system') {
    smtp = await sdk.getSystemSmtp(effects).const()
    const customFrom = store.smtp.value['customFrom'] as string | undefined
    if (smtp && customFrom) smtp.from = customFrom
  } else if (store.smtp.selection === 'custom') {
    smtp = store.smtp.value as unknown as T.SmtpValue
  }

  const subcontainer = sdk.SubContainer.of(
    effects,
    // runit needs a writable /run for its supervise directories and service
    // sockets; sharing the container's own /run is what makes runsvdir work
    // as PID 1 here.
    { imageId: 'gitlab', sharedRun: true },
    mount,
    'gitlab-sub',
  )

  return sdk.Daemons.of(effects)
    .addDaemon('primary', {
      subcontainer,
      exec: {
        // /assets/init-container: generates SSH host keys, starts runsvdir, then
        // runs `gitlab-ctl reconfigure`. Running it as PID 1 is exactly what the
        // upstream image expects.
        command: sdk.useEntrypoint(),
        env: {
          GITLAB_OMNIBUS_CONFIG: omnibusConfig({
            externalUrl: chosenUrl,
            sshPort: assignedSshPort,
            initialRootPassword: store.initialRootPassword || null,
            smtp,
          }),
          // The daemon's stdout is the service log already; `gitlab-ctl tail`
          // on top of it duplicates every line.
          GITLAB_SKIP_TAIL_LOGS: 'true',
        },
      },
      ready: {
        display: i18n('Web Interface'),
        // First boot runs a full Chef converge plus database migrations, which
        // took just under four minutes on reference hardware. Fifteen minutes
        // leaves room for slower disks without masking a genuine hang.
        gracePeriod: 900_000,
        fn: async () => {
          // Deliberately not an HTTP check from outside the container: GitLab's
          // monitoring_whitelist defaults to 127.0.0.0/8, so /-/health answers
          // 404 to anything arriving over the LXC bridge. Widening the
          // whitelist would also expose those unauthenticated endpoints to the
          // LAN, since proxied traffic arrives from the bridge too. Probing
          // from inside over loopback avoids both problems.
          const res = await subcontainer.exec([
            'curl',
            '-sf',
            '-o',
            '/dev/null',
            '--max-time',
            '10',
            `http://127.0.0.1/-/readiness`,
          ])
          return res.exitCode === 0
            ? {
                result: 'success' as const,
                message: i18n('GitLab is ready'),
              }
            : {
                result: 'starting' as const,
                message: i18n(
                  'GitLab is still starting. First boot takes several minutes.',
                ),
              }
        },
      },
      requires: [],
    })
    .addOneshot('initial-credentials', {
      subcontainer,
      exec: {
        fn: async () => {
          if (!store.initialRootPassword) return null

          // Guarantee the administrator account exists before telling the user
          // to sign in. Omnibus only creates it when it takes the seeding path,
          // which is not the path it takes here — see ensureRootUser.ts. Runs
          // after `primary` so the database is up.
          // Rails takes 40-60s just to boot, well past exec's 30s default,
          // which would SIGKILL these before they did anything.
          const railsExec = (command: string[]) =>
            subcontainer.exec(command, undefined, 300_000)

          const outcome = await ensureRootUser(
            railsExec,
            store.initialRootPassword,
          )

          if (outcome === null) {
            console.error(
              'Could not verify the administrator account. Use the Reset Root Password action if you cannot sign in.',
            )
            return null
          }

          // Re-issue the package's own admin API token. Actions use it instead
          // of booting Rails themselves, which they cannot do — reconfigure
          // writes Rails' config into the image layer, so a throwaway
          // subcontainer has no database.yml, gitlab.yml or secrets.yml.
          // Re-minting each start also bounds the lifetime of a leaked token.
          const internalToken = generateInternalToken()
          const minted = await railsExec([
            'gitlab-rails',
            'runner',
            mintInternalTokenScript(internalToken),
          ])
          if (
            minted.exitCode === 0 &&
            String(minted.stdout).includes('STARTOS_TOKEN_OK')
          ) {
            await storeJson.merge(
              effects,
              { internalToken },
              { allowWriteAfterConst: true },
            )
          } else {
            console.error(
              'Could not mint the internal API token; actions that manage users or runners will be unavailable until the next restart.',
            )
          }

          // Raise the "here is your password" task once, and only once GitLab
          // is actually reachable — surfacing it earlier would send the user to
          // a login page that is not up yet.
          if (!store.rootPasswordAcknowledged) {
            await sdk.action.createOwnTask(
              effects,
              showInitialCredentials,
              'important',
              {
                reason: i18n(
                  'Retrieve the generated root password and sign in for the first time',
                ),
              },
            )
          }
          return null
        },
      },
      requires: ['primary'],
    })
})
