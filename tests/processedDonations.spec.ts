import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  STATUS_FILTERS,
  bagText,
  bookedText,
  breakdownChanged,
  breakdownPayload,
  breakdownSummary,
  componentChips,
  correctionLockText,
  editableBags,
  handoverBlockedText,
  handoverErrorText,
  isCompleteBag,
} from '~/utils/processedDonations'

/**
 * Processing's Processed list (project owner, 2026-10-19): every unit with a
 * recorded breakdown, and where the hand-over to Issuance is made. It was the
 * last card on Component Processing.
 *
 * What is locked in: the hand-over and the rejection are offered on the
 * server's say-so per row and go through the laboratory status route; a
 * refusal says what to do; Component Processing no longer hands over, but
 * still rejects a unit that cannot be separated; and only Processing is
 * offered the page.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

describe('how a processed row reads', () => {
  it('filters on the hand-over, everything first, and on what waits for a correction decision', () => {
    expect(STATUS_FILTERS.map((option) => option.value)).toEqual(['', 'awaiting_handover', 'handed_over', 'rejected', 'correction_pending'])
  })

  it('sums the breakdown by component, counting repeated bags', () => {
    expect(breakdownSummary([
      { component: 'Packed RBC', quantity: 1 },
      { component: 'FFP', quantity: 1 },
      { component: 'Packed RBC', quantity: 1 },
    ])).toBe('2 × Packed RBC, FFP')
    // A breakdown from before volumes were kept carries a real count.
    expect(breakdownSummary([{ component: 'Platelets', quantity: 3 }])).toBe('3 × Platelets')
    expect(breakdownSummary(null)).toBe('')
  })

  it('shows the breakdown as one chip per component, by its bag-label code, in declared order', () => {
    expect(componentChips([
      { component: 'Whole Blood', code: 'WB', quantity: 1 },
      { component: 'Packed RBC', code: 'PRBC', quantity: 1 },
      { component: 'Fresh Frozen Plasma', code: 'FFP', quantity: 1 },
      { component: 'Packed RBC', code: 'PRBC', quantity: 1 },
    ])).toEqual([
      { code: 'WB', name: 'Whole Blood', count: 1 },
      { code: 'PRBC', name: 'Packed RBC', count: 2 },
      { code: 'FFP', name: 'Fresh Frozen Plasma', count: 1 },
    ])
    // A legacy row's count, and a row the server sent no code for, still read.
    expect(componentChips([{ component: 'Platelets', code: null, quantity: 3 }])).toEqual([{ code: 'Platelets', name: 'Platelets', count: 3 }])
    expect(componentChips(null)).toEqual([])
  })

  it('names a bag by its volume, or by its count when no volume was kept', () => {
    expect(bagText({ component: 'FFP', volume_ml: 200, quantity: 1 })).toBe('FFP · 200 mL')
    expect(bagText({ component: 'Platelets', volume_ml: null, quantity: 2 })).toBe('Platelets × 2')
  })

  it("follows Issuance's booking-in only once the unit is handed over", () => {
    expect(bookedText({ status: 'awaiting_handover', units_booked: 0, bag_count: 2 })).toBeNull()
    expect(bookedText({ status: 'handed_over', units_booked: 0, bag_count: 2 })).toBe('Not booked in yet')
    expect(bookedText({ status: 'handed_over', units_booked: 1, bag_count: 2 })).toBe('1 of 2 booked in')
    expect(bookedText({ status: 'handed_over', units_booked: 2, bag_count: 2 })).toBe('All booked in')
  })

  it('says why a row offers no hand-over', () => {
    expect(handoverBlockedText({ status: 'awaiting_handover', can: { hand_over: true } })).toBeNull()
    expect(handoverBlockedText({ status: 'awaiting_handover', can: { hand_over: false } }))
      .toBe('The component technologist hands units over to Issuance.')
    expect(handoverBlockedText({ status: 'handed_over', can: { hand_over: false } })).toBe('Already handed over to Issuance.')
    expect(handoverBlockedText({ status: 'rejected' })).toContain('rejected')
  })

  it("explains the status route's refusals, and falls back to the server's own words", () => {
    expect(handoverErrorText({ data: { code: 'donation_already_final' } })).toContain('already been handed over or rejected')
    expect(handoverErrorText({ data: { code: 'components_missing' } })).toContain('no component breakdown')
    expect(handoverErrorText({ message: 'This account is not linked to a facility.', data: { code: 'x' } }))
      .toBe('This account is not linked to a facility.')
  })
})

describe('correcting a saved breakdown', () => {
  const saved = [
    { component_id: 1, component: 'Packed RBC', volume_ml: 250, quantity: 1, bag_number: '1234567-PRBC' },
    { component_id: 2, component: 'FFP', volume_ml: 200, quantity: 1, bag_number: '1234567-FFP' },
  ]

  it('opens the saved bags as rows, a legacy count as that many rows waiting for a volume', () => {
    expect(editableBags(saved)).toEqual([{ component_id: 1, volume_ml: 250 }, { component_id: 2, volume_ml: 200 }])
    expect(editableBags([{ component_id: 3, volume_ml: null, quantity: 2 }])).toEqual([
      { component_id: 3, volume_ml: null },
      { component_id: 3, volume_ml: null },
    ])
    expect(editableBags([])).toEqual([{ component_id: null, volume_ml: null }])
  })

  it('takes only whole volumes of 1 to 1000 mL with a component, as recording does', () => {
    expect(isCompleteBag({ component_id: 1, volume_ml: 250 })).toBe(true)
    expect(isCompleteBag({ component_id: null, volume_ml: 250 })).toBe(false)
    expect(isCompleteBag({ component_id: 1, volume_ml: 0 })).toBe(false)
    expect(isCompleteBag({ component_id: 1, volume_ml: 1001 })).toBe(false)
    expect(isCompleteBag({ component_id: 1, volume_ml: 12.5 })).toBe(false)
  })

  it('files only a change, carrying the body recording sends', () => {
    const rows = editableBags(saved)

    expect(breakdownChanged(rows, editableBags(saved))).toBe(false)
    expect(breakdownChanged(rows, [...rows, { component_id: 2, volume_ml: 180 }])).toBe(true)
    // Order decides each bag's number, so a reorder is a change.
    expect(breakdownChanged(rows, [...rows].reverse())).toBe(true)
    expect(breakdownPayload([{ component_id: 1, volume_ml: 240 }, { component_id: null, volume_ml: 100 }]))
      .toEqual([{ component_id: 1, volume_ml: 240 }])
  })

  it('says why a row cannot be corrected', () => {
    expect(correctionLockText({ can: { correct: true } })).toBeNull()
    expect(correctionLockText({ locked: 'handed_over', can: { correct: false } })).toContain('handed over')
    expect(correctionLockText({ locked: 'rejected' })).toContain('rejected')
    expect(correctionLockText({ locked: null, correction_pending: true })).toContain('already waiting')
  })
})

describe('the Processed page', () => {
  const page = source('app/pages/blood-center/processed.vue')
  const service = source('app/api/bloodcenter/BloodCenterService.ts')
  const nav = source('app/composables/useBloodCenterNav.ts')
  const sidebar = source('app/components/BloodCenter/sidebar.vue')

  it('is its own sidebar page under Processing, and the link asks what the page does', () => {
    expect(page).toContain("requires: 'lab.record_components'")
    expect(nav).toMatch(/label: 'Processed', path: '\/blood-center\/processed'[^}]*badge: 'handover'[^}]*requires: 'lab\.record_components'/)
  })

  it('reads the list and its export from the processed routes', () => {
    expect(service).toContain('/laboratory/processed`')
    expect(service).toContain('/laboratory/processed/export')
  })

  it('hands over and rejects from Actions, on the server\'s say-so, through the status route', () => {
    expect(page).toMatch(/:disabled="!row\.can\?\.hand_over"[\s\S]{0,400}Hand over/)
    expect(page).toContain(':disabled="!row.can?.reject"')
    expect(page).toContain('bloodCenterService.updateLaboratoryStatus(row.donation_id, payload)')
    expect(page).toContain("decide('handover', { status: 'completed' })")
    expect(page).toContain("decide('reject', { status: 'rejected', rejection_reason: reason })")
    // A rejection needs its reason.
    expect(page).toContain("!open.reason.trim()")
  })

  it('opens the unit Component Processing sent it, on its breakdown when asked', () => {
    expect(page).toContain('search.value = `DON-${wanted}`')
    expect(page).toContain("route.query.open === 'edit' ? editMode(row) : (row.can?.hand_over ? 'handover' : 'view')")
  })

  it('edits the breakdown in place from a pen in Actions, as Serology Results does', () => {
    expect(page).toMatch(/:disabled="!row\.can\?\.correct"[\s\S]{0,300}<AssetIcon name="pencil"/)
    expect(page).toContain("@click=\"openRow(row, 'edit')\"")
    expect(page).not.toContain('CorrectionRequestDialog')
  })

  it('files the correction from its own dialog, reason included', () => {
    expect(page).toContain("subject: 'components'")
    expect(page).toContain('reason: open.value.reason.trim()')
    expect(page).toContain('changes: { components: breakdownPayload(open.value.form) }')
    expect(page).toContain("isHead ? 'Apply correction' : 'Request correction'")
  })

  it('lets the component technologist approve or reject a pending correction there', () => {
    expect(page).toContain('v-if="row.correction?.can_decide"')
    expect(page).toContain('bloodCenterService.approveCorrection(correction.id)')
    expect(page).toContain('bloodCenterService.rejectCorrection(correction.id, { note })')
    expect(page).toContain(':disabled="Boolean(acting) || !open.note.trim()"')
  })

  it('counts what waits for the hand-over, for the role that hands over', () => {
    expect(sidebar).toContain("processedDonations({ status: 'awaiting_handover', per_page: 1 })")
    expect(sidebar).toContain("can('lab.update_status')")
    expect(page).toContain('badgeRefresh.value++')
  })
})

describe('Component Processing after the move', () => {
  const page = source('app/pages/blood-center/laboratory.vue')

  it('no longer hands over, and sends a processed unit to the Processed list', () => {
    expect(page).not.toContain("updateLaboratoryStatus(selected.value.id, { status: 'completed' })")
    expect(page).toContain('/blood-center/processed?donation=${selected.id}')
  })

  it('works only what has no breakdown yet', () => {
    expect(page).toContain("{ stage: 'processing' }")
  })

  it('still rejects a unit that cannot be separated', () => {
    expect(page).toContain("status: 'rejected',")
    expect(page).toMatch(/v-if="!hasComponents && canUpdateStatus && !isFinal"[\s\S]{0,300}Cannot process this unit\?/)
  })

  it('shows a saved breakdown read-only, viewed or edited on the Processed list', () => {
    expect(page).not.toContain('CorrectionRequestDialog')
    expect(page).not.toContain("'Request correction'")
    expect(page).toContain('/blood-center/processed?donation=${selected.id}&open=edit')
    expect(page).toContain('View or edit on the Processed list')
  })

  it('sends a completed unit to the Processed list, not to inventory Processing cannot read', () => {
    expect(page).not.toContain('to="/blood-center/inventory"')
    expect(page).toContain('View on the Processed list')
  })

  it('opens the unit the Processed list sent it, for a correction or a reprint', () => {
    expect(page).toContain('const wanted = Number(route.query.donation)')
    expect(page).toContain('await openDonation(wanted)')
  })
})
