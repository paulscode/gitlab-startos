/**
 * Upgrade-path rules. Deliberately free of imports so the build can validate
 * the release history without pulling in the SDK — see
 * `scripts/check-release-history.mjs`, wired into `npm run check`.
 *
 * GitLab refuses to upgrade across too wide a version gap. Each release
 * hard-codes a single floor — `min_version` in
 * `omnibus-ctl/lib/gitlab_ctl/upgrade_check.rb` — and the container entrypoint
 * enforces it before doing anything else. Fail it and the entrypoint exits
 * under `set -e`, so the service simply never starts.
 */

/**
 * The floor enforced by the GitLab release this package currently ships.
 *
 * MUST be updated whenever the image tag is bumped — see UPDATING.md. Read it
 * out of the candidate image with:
 *
 *   docker run --rm --entrypoint sh gitlab/gitlab-ce:<TAG> -c \
 *     "grep -oE \"'[0-9]+\\.[0-9]+'\" \
 *      /opt/gitlab/embedded/service/omnibus-ctl/lib/gitlab_ctl/upgrade_check.rb | head -1"
 */
export const MIN_UPGRADE_FROM = '18.11'

/** Where users can obtain older releases to step through. */
export const RELEASES_URL =
  'https://github.com/paulscode/gitlab-startos/releases'

/**
 * Every GitLab version this package has shipped, with the upgrade floor that
 * version enforces. One entry per release, oldest first.
 *
 * This exists so a stranded instance can be told which release to install
 * *next*, rather than merely that it is stranded. Recovery can need more than
 * one hop, because the floor itself rises over time: reaching a release that
 * requires 18.11 may first require one that requires 18.8.
 *
 * **Append to this on every release.** Two rules govern it, both enforced by
 * `validateReleaseHistory` at build time:
 *
 *  1. Entries are ordered and unique.
 *  2. Every entry must be reachable from the one before it. If a new release's
 *     floor is above the previous release's version, users sitting on that
 *     previous release cannot reach the new one at all — and no amount of
 *     retrying will help them. Publish an intermediate release that satisfies
 *     the new floor *first*, then the one that requires it.
 *
 * Only versions published as installable artifacts belong here. Recommending a
 * GitLab release this package never shipped sends users looking for something
 * that does not exist.
 */
export const RELEASE_HISTORY: ReadonlyArray<{
  version: string
  floor: string
}> = [{ version: '19.2.2', floor: MIN_UPGRADE_FROM }]

/** Order two dotted version strings. Missing components count as zero. */
export function compareVersions(a: string, b: string): number {
  const pa = a
    .trim()
    .split('.')
    .map((n) => parseInt(n, 10) || 0)
  const pb = b
    .trim()
    .split('.')
    .map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return 0
}

/** Compare `major.minor` pairs. True when `version` is at or above `floor`. */
export function meetsFloor(version: string, floor: string): boolean {
  const [vMaj, vMin] = version
    .trim()
    .split('.')
    .map((n) => parseInt(n, 10))
  const [fMaj, fMin] = floor
    .trim()
    .split('.')
    .map((n) => parseInt(n, 10))
  // Unparseable: fail open and let GitLab's own check decide.
  if (!Number.isFinite(vMaj) || !Number.isFinite(vMin)) return true
  if (vMaj !== fMaj) return vMaj > fMaj
  return vMin >= fMin
}

/**
 * The furthest published release this instance can legally jump to right now.
 *
 * "Furthest" rather than "next oldest" deliberately: it minimises how many
 * install-then-update cycles the user sits through, and every candidate is
 * equally legal, so stepping smaller buys nothing.
 *
 * Returns null when no published release can accept this version — a genuinely
 * stranded instance, where the honest answer is to say so rather than name a
 * version that will fail the same way.
 */
export function nextHop(installed: string): string | null {
  const reachable = RELEASE_HISTORY.filter(
    (r) =>
      meetsFloor(installed, r.floor) &&
      compareVersions(r.version, installed) > 0,
  )
  if (!reachable.length) return null
  return reachable.reduce((best, r) =>
    compareVersions(r.version, best.version) > 0 ? r : best,
  ).version
}

/**
 * The message shown when the gate blocks a start.
 *
 * Written to be actionable on its own: the user is looking at a service that
 * will not start and needs to know exactly what to install, where to get it,
 * and that they may have to do it more than once.
 */
export function upgradeBlockedMessage(gate: {
  installed: string
  floor: string
  nextHop: string | null
}): string {
  const lead = `GitLab cannot upgrade directly from the installed version (${gate.installed}); this release requires ${gate.floor} or newer.`

  const action = gate.nextHop
    ? `Install GitLab ${gate.nextHop} from ${RELEASES_URL}, start it and let it finish, then update again. More than one step may be needed — repeat until the update succeeds.`
    : `No published release of this package can upgrade from ${gate.installed}. See ${RELEASES_URL} and https://docs.gitlab.com/update/ for the supported upgrade path.`

  return `${lead} ${action} Your data has not been modified.`
}

/**
 * Build-time validation of RELEASE_HISTORY. Returns human-readable problems;
 * an empty array means the history is sound.
 *
 * The reachability rule is the one that matters: publishing a release whose
 * floor sits above the previous release strands every user on that previous
 * release permanently, and nothing at runtime can rescue them.
 */
export function validateReleaseHistory(
  history: ReadonlyArray<{ version: string; floor: string }> = RELEASE_HISTORY,
): string[] {
  const problems: string[] = []

  if (!history.length) {
    return ['RELEASE_HISTORY is empty; it must list at least the current release.']
  }

  history.forEach((r, i) => {
    if (i === 0) return
    const prev = history[i - 1]
    if (compareVersions(r.version, prev.version) <= 0) {
      problems.push(
        `RELEASE_HISTORY is not strictly increasing: ${prev.version} is followed by ${r.version}.`,
      )
    }
    if (!meetsFloor(prev.version, r.floor)) {
      problems.push(
        `Unreachable release: ${r.version} requires ${r.floor} or newer, but the release before it is ${prev.version}. ` +
          `Anyone on ${prev.version} could never update. Publish an intermediate release at or above ${r.floor} first.`,
      )
    }
  })

  const current = history[history.length - 1]
  if (current.floor !== MIN_UPGRADE_FROM) {
    problems.push(
      `The newest RELEASE_HISTORY entry (${current.version}, floor ${current.floor}) disagrees with MIN_UPGRADE_FROM (${MIN_UPGRADE_FROM}).`,
    )
  }

  return problems
}
