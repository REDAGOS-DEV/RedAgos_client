import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { SEROLOGY_MARKERS, serologyPayload } from '~/utils/serology'
import { OUTCOME_FILTERS, changedMarkers, correctionDiff, lockText, markerHeading, readingLabel, readingsOf } from '~/utils/serologyResults'

/**
 * TTI Testing's results list (project owner, 2026-10-18), a tab on the
 * Testing page.
 *
 * What is locked in: the columns read as short marker names; Edit only files a
 * correction of readings that changed, carrying the same body the queue's
 * Serology card sends; a row the server says cannot be corrected tells the
 * technologist why; and only TTI Testing is offered the tab.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

const clearPanel = [
  { marker: 'hiv', result: 'non_reactive' as const },
  { marker: 'hbsag', result: 'non_reactive' as const },
  { marker: 'hcv', result: 'non_reactive' as const },
  { marker: 'syphilis', result: 'non_reactive' as const },
  { marker: 'malaria', result: 'non_reactive' as const },
]

describe('serology results columns', () => {
  it('heads each column with the marker name, without its gloss', () => {
    expect(SEROLOGY_MARKERS.map((marker) => markerHeading(marker.label))).toEqual(['HIV', 'HBsAg', 'HCV', 'Syphilis', 'Malaria'])
    expect(markerHeading('HBsAg (Hepatitis B)')).toBe('HBsAg')
  })

  it('filters on the whole panel, everything first, and on what waits for verification', () => {
    expect(OUTCOME_FILTERS.map((option) => option.value)).toEqual(['', 'non_reactive', 'reactive', 'awaiting_verification', 'correction_pending'])
  })
})

describe('editing a saved panel', () => {
  it('reads a row into the form the queue keeps, blank where a marker is missing', () => {
    expect(readingsOf({ markers: clearPanel })).toEqual({
      hiv: 'non_reactive', hbsag: 'non_reactive', hcv: 'non_reactive', syphilis: 'non_reactive', malaria: 'non_reactive',
    })
    expect(readingsOf({ markers: null }).hiv).toBe('')
  })

  it('names only the markers that changed', () => {
    const saved = readingsOf({ markers: clearPanel })

    expect(changedMarkers(saved, { ...saved })).toEqual([])
    expect(changedMarkers(saved, { ...saved, malaria: 'reactive' })).toEqual(['malaria'])
  })

  it('lists only what a pending correction would change, in words', () => {
    const saved = readingsOf({ markers: clearPanel })

    expect(correctionDiff(saved, { ...saved, malaria: 'reactive' })).toEqual([
      { marker: 'malaria', label: 'Malaria', from: 'non_reactive', to: 'reactive' },
    ])
    expect(correctionDiff(saved, saved)).toEqual([])
    expect(correctionDiff(saved, null)).toEqual([])
    expect(readingLabel('non_reactive')).toBe('Non-reactive')
    expect(readingLabel('')).toBe('—')
  })

  it('files the same body as the queue, confirmed only when it turns reactive', () => {
    const saved = readingsOf({ markers: clearPanel })

    expect(serologyPayload({ ...saved, hcv: 'reactive' }, true)).toMatchObject({ hcv: 'reactive', confirm_reactive: true })
    expect(serologyPayload(saved, true)).not.toHaveProperty('confirm_reactive')
  })
})

describe('a row that cannot be corrected', () => {
  it('says nothing when the server allows a correction', () => {
    expect(lockText({ locked: null, correction_pending: false, can: { correct: true } })).toBeNull()
  })

  it('says a reactive panel waiting for the supervisor has set nothing off', () => {
    expect(lockText({ locked: 'awaiting_verification', correction_pending: false, can: { correct: false, verify: false } }))
      .toMatch(/waiting for the Laboratory Supervisor[\s\S]*Nothing has happened yet/)
  })

  it('gives the reason the correction route would refuse, lock first', () => {
    expect(lockText({ locked: 'reactive', correction_pending: false, can: { correct: false } })).toMatch(/never be corrected/)
    expect(lockText({ locked: 'rejected', correction_pending: false, can: { correct: false } })).toMatch(/rejected/)
    expect(lockText({ locked: 'units_released', correction_pending: true, can: { correct: false } })).toMatch(/left quarantine/)
    expect(lockText({ locked: null, correction_pending: true, can: { correct: false } })).toMatch(/waiting for a decision/)
    expect(lockText({ locked: null, correction_pending: false, can: { correct: false } })).toMatch(/does not file corrections/)
  })
})

describe('the Serology Results page', () => {
  const page = source('app/pages/blood-center/serology-results.vue')
  const component = source('app/components/BloodCenter/SerologyResults.vue')
  const service = source('app/api/bloodcenter/BloodCenterService.ts')
  const nav = source('app/composables/useBloodCenterNav.ts')

  it('is its own sidebar page, for TTI Testing alone, and the link asks the same', () => {
    expect(page).toContain("requires: 'lab.record_serology'")
    expect(nav).toMatch(/label: 'Serology Results', path: '\/blood-center\/serology-results'[^}]*badge: 'verification'[^}]*requires: 'lab\.record_serology'/)
  })

  it('edits in place from a pen in Actions, with no detour to the unit', () => {
    expect(component).toContain("@click=\"openEdit(row, 'edit')\"")
    expect(component).toMatch(/:disabled="!row\.can\?\.correct"[\s\S]{0,400}<AssetIcon name="pencil"/)
    expect(component).not.toContain('Open the unit')
    expect(page).not.toContain('openUnit')
  })

  it('reads the list and its export from the serology-results routes', () => {
    expect(service).toContain('/laboratory/serology-results`')
    expect(service).toContain('/laboratory/serology-results/export')
  })

  it('files a correction from its own dialog, reason included, with no second popup', () => {
    expect(component).toContain("subject: 'serology'")
    expect(component).toContain('reason: editing.value.reason.trim()')
    expect(component).not.toContain('CorrectionRequestDialog')
    expect(component).not.toContain('recordSerology')
  })

  it('lets the Laboratory Supervisor approve or reject a pending correction there', () => {
    expect(component).toContain('row.correction?.can_decide')
    expect(component).toContain('bloodCenterService.approveCorrection(correction.id)')
    expect(component).toContain("bloodCenterService.rejectCorrection(correction.id, { note: editing.value.note.trim() })")
    // A correction that turns a marker reactive is confirmed before approval.
    expect(component).toContain('(proposedReactive.length > 0 && !editing.confirmed)')
  })

  it('opens the donation the testing queue sent it', () => {
    expect(page).toContain(':initial-donation="initialDonation"')
    expect(component).toContain('search.value = `DON-${wanted}`')
  })
})

describe('a reactive result waits for a second person', () => {
  const page = source('app/pages/blood-center/testing.vue')
  const referrals = source('app/pages/blood-center/counselling-referrals.vue')
  const resultsPage = source('app/pages/blood-center/serology-results.vue')
  const sidebar = source('app/components/BloodCenter/sidebar.vue')
  const component = source('app/components/BloodCenter/SerologyResults.vue')
  const service = source('app/api/bloodcenter/BloodCenterService.ts')

  it('verifies and returns through the supervisor routes, offered only where the server allows', () => {
    expect(service).toContain('/serology/verify`')
    expect(service).toContain('/serology/return`')
    expect(component).toContain('row.can?.verify')
    expect(component).toMatch(/:disabled="Boolean\(acting\) \|\| !editing\.confirmed"/)
  })

  it("tells a technologist that saving reactive only sends it to the supervisor", () => {
    expect(page).toContain("canVerify ? 'Confirm reactive result' : 'Save for verification'")
    expect(page).toContain("can('lab.verify_serology')")
  })

  it('no longer promises that the donor is contacted by itself', () => {
    expect(page).not.toContain('ask the donor, without saying why, to contact the centre')
    expect(component).not.toContain('they are asked to')
  })

  it('asks the donor to get in touch by hand, from the mail icon on an open referral', () => {
    expect(service).toContain('/contact-request`')
    expect(referrals).toMatch(/v-if="referral\.is_open"[\s\S]{0,300}openContact\(referral\)/)
    expect(referrals).toContain('No contact request sent yet')
  })

  it("lands the supervisor's notification on the waiting results, old tab links included", () => {
    expect(resultsPage).toContain(':initial-outcome="initialOutcome"')
    expect(page).toContain("if (route.query.tab === 'results')")
    expect(page).toContain('navigateTo(`/blood-center/serology-results${outcome}`, { replace: true })')
  })

  it('counts what waits in the sidebar, the referrals from the unaudited summary', () => {
    expect(sidebar).toContain("can('lab.verify_serology')")
    expect(sidebar).toContain('counsellingReferralsSummary()')
    expect(sidebar).toContain('watch(badgeRefresh, () => loadCounts())')
  })
})
