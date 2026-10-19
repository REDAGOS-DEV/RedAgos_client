import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { DONATION_STATUS_FILTERS, donationTone } from '~/utils/donationRecords'
import { eligibilityBadge, reminderSkipSummary } from '~/utils/donorRecords'

/**
 * The Donations list, and a visit in progress on Donor Management
 * (project owner, 2026-10-17).
 *
 * The two came together: the counter refused a donor "with a donation in
 * progress" while Donor Management called them eligible and no list showed
 * the open visit. What is locked in: the open visit is listed and can be
 * closed, and the donor reads "Visit in progress", not eligible.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

// Line endings normalised: a Windows checkout (core.autocrlf) writes CRLF.
function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n')
}

describe('a visit in progress on Donor Management', () => {
  it('reads as a visit in progress, never eligible', () => {
    expect(eligibilityBadge({ eligibility: 'in_progress' })).toMatchObject({ key: 'in_progress', label: 'Visit in progress', tone: 'info' })
  })

  it('explains a reminder skipped for it', () => {
    expect(reminderSkipSummary({ in_progress: 1 })).toBe('1 is in a visit now')
  })

  it('refuses a reminder in the email dialog', () => {
    expect(source('app/pages/blood-center/donors.vue')).toContain("[donor.eligibility?.key === 'in_progress', 'This donor is in a visit at your centre right now.']")
  })
})

describe('donation helpers', () => {
  it('filters open visits first, then each status in the order a visit runs', () => {
    expect(DONATION_STATUS_FILTERS.map((s) => s.value)).toEqual(['open', 'registered', 'screening', 'collected', 'tested', 'completed', 'rejected'])
  })

  it('colours a closed visit by why it closed', () => {
    expect(donationTone('rejected', 'Closed')).toBe('neutral')
    expect(donationTone('rejected', 'Deferred')).toBe('crit')
    expect(donationTone('completed')).toBe('ok')
    expect(donationTone('screening')).toBe('warn')
  })
})

describe('the donations service', () => {
  it('reads the centre-scoped list and carries its filters into the export', async () => {
    const { bloodCenterService } = await import('~/api/bloodcenter/BloodCenterService')
    const request = vi.fn(async () => ({}))
    const requestBlob = vi.fn(async () => new Blob())
    ;(bloodCenterService as any).request = request
    ;(bloodCenterService as any).requestBlob = requestBlob

    await bloodCenterService.donationRecords({ status: 'open' })
    await bloodCenterService.exportDonationRecords({ status: 'open', search: '' })

    expect(request).toHaveBeenCalledWith('/blood-center/donation-records', 'GET', { status: 'open' })
    expect(requestBlob).toHaveBeenCalledWith('/blood-center/donation-records/export?status=open')
  })
})

describe('the donations page', () => {
  const page = source('app/pages/blood-center/donations.vue')
  const nav = source('app/composables/useBloodCenterNav.ts')

  it('is gated on donations.view, exactly as its nav link is', () => {
    expect(page).toContain("requires: 'donations.view'")
    expect(nav).toMatch(/label: 'Donations', path: '\/blood-center\/donations'[^}]*requires: 'donations\.view'/)
  })

  it('is built like Donor Management: search, filters, export, refresh, table, pager', () => {
    for (const text of ['Search donor / donation ID / bag…', 'All statuses', 'All groups', 'Export', 'Refresh', 'Donation Counter', 'record(s)']) {
      expect(page).toContain(text)
    }
  })

  it('closes a visit left open through the counter\'s own route', () => {
    expect(page).toContain("bloodCenterService.updateDonationStatus(closing.row.id, {\n      status: 'rejected',")
    expect(page).toContain('v-if="row.open && canClose"')
    expect(page).toContain(':disabled="!row.can.close"')
  })

  it('never shows a name the viewer may not see', () => {
    expect(page).toContain('row.donor && !row.donor.blinded')
    expect(page).toContain('Identity hidden')
  })
})
