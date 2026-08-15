import { T, utils } from '@start9labs/start-sdk'
import { storeJson } from './fileModels/store.json'
import { sdk } from './sdk'
import { mainHostId, uiPort } from './utils'

/**
 * Actions talk to GitLab over its REST API rather than by running
 * `gitlab-rails` in a throwaway subcontainer.
 *
 * That is not a stylistic preference. `gitlab-ctl reconfigure` generates
 * `database.yml`, `gitlab.yml`, `secrets.yml` and the `gitlab-rails-rc` wrapper
 * config into the *image layer*, not onto a volume — a fresh subcontainer
 * starts from the pristine image, where none of them exist, so Rails cannot
 * boot at all. Mounting them out is not viable either: they live alongside
 * shipped application config that must not be shadowed.
 *
 * The API path is also an order of magnitude faster. Booting Rails costs 40-60
 * seconds and roughly 3 GB of container; an API call answers in about a second.
 */

/** Token the package mints for its own use. Prefixed like any GitLab PAT. */
export function generateInternalToken() {
  return (
    'glpat-' +
    utils.getDefaultString({ charset: 'a-z,A-Z,0-9', len: 20 })
  )
}

/** Ruby that (re)mints the package's internal admin token. */
export function mintInternalTokenScript(token: string): string {
  return [
    `u = User.find_by!(username: 'root')`,
    // Revoke any previous one so a leaked token stops working after a restart.
    `u.personal_access_tokens.where(name: 'startos-internal').find_each(&:revoke!)`,
    `t = u.personal_access_tokens.create!(scopes: ['api'], name: 'startos-internal', expires_at: 365.days.from_now)`,
    `t.set_token(${JSON.stringify(token)})`,
    `t.save!`,
    `puts "STARTOS_TOKEN_OK"`,
  ].join('; ')
}

/**
 * Base URL for GitLab's API as reachable from outside its container.
 *
 * Uses the internal bridge rather than the user-facing address: it is plain
 * HTTP, so there is no certificate to trust, and it does not depend on which
 * gateways the user has enabled.
 */
export async function apiBaseUrl(effects: T.Effects): Promise<string | null> {
  const addr = await sdk.host
    .getBridgeAddress(effects, {
      hostId: mainHostId,
      internalPort: uiPort,
      ssl: false,
    })
    .once()
  return addr ? `http://${addr}/api/v4` : null
}

export type ApiResult<A> =
  | { ok: true; value: A }
  | { ok: false; status: number | null; message: string }

/** Call the GitLab API as the package's internal admin. */
export async function gitlabApi<A = unknown>(
  effects: T.Effects,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: Record<string, string | number | boolean>,
): Promise<ApiResult<A>> {
  const base = await apiBaseUrl(effects)
  if (!base) {
    return {
      ok: false,
      status: null,
      message: 'GitLab is not reachable on the internal network.',
    }
  }

  const token = await storeJson.read((s) => s.internalToken).once()
  if (!token) {
    return {
      ok: false,
      status: null,
      message:
        'GitLab has not finished starting for the first time. Wait for it to report ready, then try again.',
    }
  }

  const init: RequestInit = {
    method,
    headers: {
      'PRIVATE-TOKEN': token,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
  }
  if (body) {
    init.body = new URLSearchParams(
      Object.entries(body).map(([k, v]) => [k, String(v)]),
    ).toString()
  }

  const res = await fetch(`${base}${path}`, init)
  const text = await res.text()

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      // GitLab returns {"message": ...} or {"error": ...}; fall back to raw.
      message: (() => {
        try {
          const j = JSON.parse(text)
          return String(j.message ?? j.error ?? text).slice(0, 300)
        } catch {
          return text.slice(0, 300)
        }
      })(),
    }
  }

  return { ok: true, value: (text ? JSON.parse(text) : null) as A }
}
