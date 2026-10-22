import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const source = (file: string) => readFileSync(path.join(root, file), 'utf8')

// Release is gone (project owner, 2026-10-22): Processing hands over only
// cleared, labelled bags, so nothing waits in quarantine at Issuance.
describe('no quarantine release', () => {
  const intake = source('app/pages/blood-center/inventory-intake.vue')

  it('has no panel, no Release tab and no release call', () => {
    expect(existsSync(path.join(root, 'app/components/BloodCenter/QuarantinePanel.vue'))).toBe(false)
    expect(intake).not.toContain('BloodCenterQuarantinePanel')
    expect(intake).not.toContain("step === 'release'")
    expect(source('app/pages/blood-center/inventory.vue')).not.toContain('BloodCenterQuarantinePanel')
    expect(source('app/api/bloodcenter/BloodCenterService.ts')).not.toContain('releaseQuarantine')
  })

  it('books a ready donation into stock and holds back one that is not', () => {
    expect(intake).toContain('const canBook = computed(() => Boolean(selected.value?.into_stock)')
    expect(intake).toContain('Not ready to book in')
    expect(intake).not.toContain('into quarantine')
    for (const code of ['donation_not_cleared', 'labels_not_printed']) {
      expect(intake).toContain(`case '${code}'`)
    }
  })
})

describe('Processing after quarantine', () => {
  const page = source('app/pages/blood-center/laboratory.vue')
  const processed = source('app/pages/blood-center/processed.vue')

  it('hands over on the component breakdown alone', () => {
    // The bench sends a unit with a breakdown to the Processed list,
    // whatever Testing has done.
    expect(page).toContain("'Hand over on the Processed list'")

    // The act is on the Processed list, offered on the server's say-so alone.
    expect(processed).toContain("decide('handover', { status: 'completed' })")
    expect(processed).toContain(':disabled="!row.can?.hand_over"')
    expect(processed).not.toContain('clearances?.tti &&')
    expect(processed).not.toContain("'Clear for issue'")
  })

  it('no longer shows the Testing results on the bench (project owner, 2026-10-22)', () => {
    expect(page).not.toContain('Testing results')
    // The clearances only decide whether the final labels can print.
    expect(page).toContain('const cleared = computed(() => Boolean(selected.value?.clearances?.tti && selected.value?.clearances?.immunohematology))')
  })
})
