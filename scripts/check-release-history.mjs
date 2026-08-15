// Build-time validation of the GitLab upgrade path this package can offer.
//
// Compiles startos/upgradeRules.ts on its own (it has no imports, precisely so
// this can) and runs its own validator plus a simulation of user recovery.
//
// The rule that matters: publishing a release whose upgrade floor sits above
// the previous release strands everyone on that previous release permanently.
// No runtime message can rescue them, so it has to fail the build instead.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = mkdtempSync(join(tmpdir(), 'upgrade-rules-'))
try {
  execFileSync(
    'npx',
    ['tsc', 'startos/upgradeRules.ts', '--outDir', out, '--module', 'es2022',
     '--target', 'es2022', '--moduleResolution', 'bundler', '--ignoreConfig'],
    { stdio: 'inherit' },
  )

  const rules = await import(join(out, 'upgradeRules.js'))
  const problems = rules.validateReleaseHistory()

  if (problems.length) {
    console.error('\nRelease history is unsound:\n')
    for (const p of problems) console.error(`  - ${p}`)
    console.error('')
    process.exit(1)
  }

  // Show the recovery path from the oldest release, so a reviewer can see how
  // many hops a long-dormant instance faces.
  const hist = rules.RELEASE_HISTORY
  const newest = hist[hist.length - 1].version
  let cur = hist[0].version
  const path = []
  for (let i = 0; i < 20 && rules.compareVersions(cur, newest) < 0; i++) {
    const h = rules.nextHop(cur)
    if (!h) break
    path.push(h)
    cur = h
  }
  console.log(
    `release history ok — ${hist.length} release(s); ` +
      `worst-case recovery from ${hist[0].version}: ` +
      (path.length ? `${path.length} hop(s) [${path.join(' -> ')}]` : 'none needed'),
  )
} finally {
  rmSync(out, { recursive: true, force: true })
}
