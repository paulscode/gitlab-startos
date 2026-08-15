import { T } from '@start9labs/start-sdk'

/**
 * Ruby that guarantees an administrator account exists, using the password this
 * package generated at install.
 *
 * Why this is needed rather than trusting `gitlab_rails['initial_root_password']`:
 * that setting is consumed by `db:seed_fu`, which Omnibus only runs when it
 * decides the database needs seeding. When it instead takes the `db:migrate`
 * path — which is what happens here — the schema is built by the migrations and
 * the seed never runs, leaving a database with a valid schema, zero users, and
 * no way to log in. Omnibus still prints "Default admin account has been
 * configured" in that case, so the log is not evidence the account exists.
 *
 * Written to be idempotent and non-destructive: if an administrator is already
 * present, this touches nothing. It never resets the password of an existing
 * account — Reset Root Password is the action for that.
 */
export function ensureRootUserScript(password: string): string {
  const pw = JSON.stringify(password)
  return [
    // Any existing admin means the instance is already usable; leave it alone.
    `if User.where(admin: true).exists?`,
    `  puts "STARTOS_ADMIN=exists"`,
    `else`,
    `  u = User.find_by(username: 'root') || User.new(username: 'root')`,
    `  u.name = 'Administrator'`,
    `  u.email = 'admin@example.com' if u.email.blank?`,
    `  u.admin = true`,
    `  u.password = ${pw}`,
    `  u.password_confirmation = ${pw}`,
    // Without this GitLab treats the password as machine-generated and forces a
    // reset on first login, which the user cannot complete without email.
    `  u.password_automatically_set = false`,
    `  u.skip_confirmation!`,
    `  u.save!`,
    `  puts "STARTOS_ADMIN=created"`,
    `end`,
  ].join('\n')
}

/** Parse the sentinel this script prints. Null when it did not run cleanly. */
export function parseEnsureRootResult(
  stdout: string | Buffer,
): 'exists' | 'created' | null {
  const m = String(stdout).match(/STARTOS_ADMIN=(exists|created)/)
  return (m?.[1] as 'exists' | 'created') ?? null
}

export type EnsureRootExec = (
  command: string[],
) => Promise<{ exitCode: number | null; stdout: string | Buffer }>

/** Run the script via a subcontainer exec, returning what it did. */
export async function ensureRootUser(
  exec: EnsureRootExec,
  password: string,
): Promise<'exists' | 'created' | null> {
  const res = await exec([
    'gitlab-rails',
    'runner',
    ensureRootUserScript(password),
  ])
  if (res.exitCode !== 0) return null
  return parseEnsureRootResult(res.stdout)
}

export type { T }
