import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { expirySweepWarning } from '../app/utils/expirySweep'

const root = path.resolve(__dirname, '..')
const source = (file: string) => readFileSync(path.join(root, file), 'utf8')

const NOW = new Date('2026-11-10T04:00:00Z') // 12:00 noon in Manila

describe('expirySweepWarning', () => {
  it('says nothing while the check is on time', () => {
    expect(expirySweepWarning({ last_completed_at: '2026-11-09T16:30:00+00:00', overdue: false }, NOW)).toBeNull()
  })

  it('says nothing before the summary has loaded', () => {
    expect(expirySweepWarning(null, NOW)).toBeNull()
    expect(expirySweepWarning(undefined, NOW)).toBeNull()
  })

  it('names when the check last finished, in Manila time', () => {
    // 16:30 UTC on the 7th is 00:30 on the 8th in Manila.
    expect(expirySweepWarning({ last_completed_at: '2026-11-07T16:30:00+00:00', overdue: true }, NOW)).toBe(
      'The nightly expiry check last finished Nov 8, 12:30 AM. Units past their expiry date may still be counted as available.',
    )
  })

  it('adds the year when the last run was in another one', () => {
    expect(expirySweepWarning({ last_completed_at: '2025-12-30T16:30:00+00:00', overdue: true }, NOW)).toBe(
      'The nightly expiry check last finished Dec 31, 2025, 12:30 AM. Units past their expiry date may still be counted as available.',
    )
  })

  it('says so when no run has ever finished', () => {
    expect(expirySweepWarning({ last_completed_at: null, overdue: true }, NOW)).toBe(
      'The nightly expiry check has no finished run on record. Units past their expiry date may still be counted as available.',
    )
  })
})

describe('the pages that show it', () => {
  const pages = {
    'Blood Inventory': 'app/pages/blood-center/inventory.vue',
    'Issuance dashboard': 'app/pages/blood-center/storage.vue',
  }

  for (const [name, file] of Object.entries(pages)) {
    it(`${name} words the summary's expiry_sweep with the shared helper`, () => {
      const page = source(file)

      expect(page).toContain("import { expirySweepWarning } from '~/utils/expirySweep'")
      expect(page).toMatch(/expirySweepWarning\(summary\.value\?\.expiry_sweep\)/)
      expect(page).toMatch(/v-if="sweepWarning"[^>]*role="alert"/)
    })
  }
})
