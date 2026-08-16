/**
 * Generates the Ruby that Omnibus evaluates before it reads
 * /etc/gitlab/gitlab.rb.
 *
 * Deliberately free of imports so the build can boot a real GitLab image
 * against this exact config and prove it still reconfigures — see
 * `scripts/check-omnibus-config.mjs`. A hand-maintained copy of the config in
 * the test would drift from the one that ships, which would make the test
 * worthless precisely when it mattered.
 */

/** Structural match for the SDK's SmtpValue, kept local to avoid an import. */
export type SmtpConfig = {
  host: string
  port: number
  from: string
  username: string
  password?: string | null
  security: string
}

export type OmnibusOptions = {
  externalUrl: string
  sshPort: number | null
  initialRootPassword: string | null
  smtp: SmtpConfig | null
}

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
export function omnibusConfig(opts: OmnibusOptions): string {
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
