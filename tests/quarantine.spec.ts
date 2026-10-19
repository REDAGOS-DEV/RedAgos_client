import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const source = (file: string) => readFileSync(path.join(root, file), 'utf8')

describe('the quarantine panel', () => {
  const panel = source('app/components/BloodCenter/QuarantinePanel.vue')

  it('lists quarantined units and releases per donation', () => {
    expect(panel).toContain("bloodCenterService.inventory({ status: 'quarantined', per_page: 100 })")
    expect(panel).toContain('bloodCenterService.releaseQuarantine(group.donationId)')
  })

  it('offers the release only to the ability that holds it, and only when the server says it is releasable', () => {
    expect(panel).toContain("can('inventory.release_quarantine')")
    expect(panel).toContain('v-if="canRelease && !group.state.locked"')
    expect(panel).toContain(':disabled="busy === group.donationId || !group.state.releasable"')
  })

  it('explains every refusal the server can give', () => {
    for (const code of ['tti_not_cleared', 'immunohematology_not_cleared', 'donation_rejected', 'unit_past_expiry', 'nothing_quarantined']) {
      expect(panel).toContain(code)
    }
  })

  it('is on the inventory page', () => {
    expect(source('app/pages/blood-center/inventory.vue')).toContain('<BloodCenterQuarantinePanel')
  })
})

describe('Processing after quarantine', () => {
  const page = source('app/pages/blood-center/laboratory.vue')
  const processed = source('app/pages/blood-center/processed.vue')

  it('hands over on the component breakdown alone', () => {
    // The bench marks the hand-over as next once the breakdown is recorded,
    // whatever Testing has done.
    const handover = page.slice(page.indexOf("key: 'release'"), page.indexOf("key: 'release'") + 200)

    expect(handover).toContain('hasComponents')
    expect(handover).not.toContain('hasResult')

    // The act is on the Processed list, offered on the server's say-so alone.
    expect(processed).toContain("decide('handover', { status: 'completed' })")
    expect(processed).toContain(':disabled="!row.can?.hand_over"')
    expect(processed).not.toContain('clearances?.tti &&')
    expect(processed).not.toContain("'Clear for issue'")
  })

  it('shows which departments have cleared the donation', () => {
    expect(page).toContain('selected.clearances?.tti')
    expect(page).toContain('selected.clearances?.immunohematology')
  })
})
