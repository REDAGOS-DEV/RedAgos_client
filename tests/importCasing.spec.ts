import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * Every `~/…` import must match a tracked file exactly, including case.
 *
 * The team develops on Windows, whose filesystem is case-insensitive, so
 * `~/components/Donor/DashboardPage.vue` resolved happily against a directory
 * actually named `donor`. On Linux — CI, and production — it does not, and the
 * build fails. That is finding H6.
 *
 * It has already happened twice: once in the imports, and once in the git index
 * itself, where `app/components/Donor/` stayed capitalised long after the
 * working copy was lowercase. Both were invisible locally.
 *
 * This compares against `git ls-files` rather than the filesystem on purpose.
 * The filesystem is the thing that lies here; the index is what CI checks out.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function tracked(): Set<string> {
  const out = execFileSync('git', ['ls-files', 'app'], { cwd: root, encoding: 'utf8' })
  return new Set(out.split('\n').filter(Boolean).map((p) => p.replace(/\\/g, '/')))
}

/** Source files that could carry an import. */
function sources(files: Set<string>): string[] {
  return [...files].filter((f) => /\.(vue|ts|js|mjs)$/.test(f))
}

const IMPORT_RE = /(?:from|import)\s+['"](~\/[^'"]+)['"]/g

/**
 * Commented-out imports are documentation, not references — several files keep
 * one as a note for work not done yet. Matching them would make the check cry
 * wolf, and a check people learn to ignore is worse than no check.
 */
function withoutComments(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      const t = line.trimStart()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
}

describe('import casing', () => {
  const files = tracked()

  it('has files to check', () => {
    expect(sources(files).length).toBeGreaterThan(50)
  })

  it('resolves every ~/ import against a tracked path, case-sensitively', () => {
    const broken: string[] = []

    for (const file of sources(files)) {
      const text = withoutComments(readFileSync(path.join(root, file), 'utf8'))

      for (const m of text.matchAll(IMPORT_RE)) {
        const spec = m[1]!
        // `~` is the `app/` srcDir.
        const base = 'app/' + spec.slice(2)

        // An import may omit the extension, or point at a directory index.
        const candidates = [
          base,
          `${base}.ts`, `${base}.js`, `${base}.mjs`, `${base}.vue`,
          `${base}/index.ts`, `${base}/index.js`, `${base}/index.vue`,
        ]

        // Skip specifiers with a query or non-file suffix (e.g. `?raw` assets),
        // which resolve through the bundler rather than a bare path.
        if (spec.includes('?')) continue

        // Assets are tracked but may be binary; existence is still the test.
        if (!candidates.some((c) => files.has(c))) {
          broken.push(`${file}  ->  ${spec}`)
        }
      }
    }

    expect(broken, `\n${broken.join('\n')}\n`).toEqual([])
  })

  /**
   * A directory tracked under two spellings means one of them is a ghost that
   * only exists on a case-insensitive checkout.
   */
  it('tracks each directory under exactly one spelling', () => {
    const seen = new Map<string, string>()
    const clashes: string[] = []

    for (const f of files) {
      const dir = f.slice(0, f.lastIndexOf('/'))
      const key = dir.toLowerCase()
      const prev = seen.get(key)
      if (prev && prev !== dir) {
        clashes.push(`${prev}  vs  ${dir}`)
      } else {
        seen.set(key, dir)
      }
    }

    expect([...new Set(clashes)]).toEqual([])
  })
})
