import { describe, it, expect } from 'vitest'
import {
  allocationProblems,
  allocationTotals,
  allocationWarnings,
  buildAllocationShares,
  buildTransfusionPayload,
  canCancelTransfusion,
  canCloseRequirementLine,
  canWithdrawAllocation,
  fefoFill,
  setShare,
  suggestedSplit,
  transfusionProgressLabel,
  type TransfusionDraft,
} from '~/utils/transfusionSourcing'
import type { SourcingPlan, TransfusionRequest } from '~/types/bloodRequest'

/**
 * Splitting a patient's need across blood centres.
 *
 * What is locked in: the suggestion fills earliest expiry first, exactly as
 * the API suggests; staff may ask for less than the patient needs but never
 * more; and what is sent is one allocation per centre with a line per
 * component asked of it.
 */

const A = { id: 1, name: 'Davao Blood Center', address: null }
const B = { id: 2, name: 'Tagum Blood Center', address: null }
const C = { id: 3, name: 'Digos Blood Center', address: null }
const D = { id: 4, name: 'Mati Blood Center', address: null }

/** O+ PRBC 5 and platelets 2, as the API plans it: A expires first, then B, then C. */
function plan(): SourcingPlan {
  return {
    blood_type: { id: 7, code: 'O+' },
    advisory: true,
    as_of: '2026-09-30T08:00:00+08:00',
    lines: [
      {
        transfusion_request_item_id: null,
        component: { id: 10, name: 'Packed RBC' },
        quantity: 5,
        facilities: [
          { facility: A, available: 1, earliest_expiry: '2026-10-02', suggested: 1 },
          { facility: B, available: 3, earliest_expiry: '2026-10-04', suggested: 3 },
          { facility: C, available: 4, earliest_expiry: '2026-10-09', suggested: 1 },
        ],
        other_facilities: [D],
        suggested_total: 5,
        shortfall: 0,
      },
      {
        transfusion_request_item_id: null,
        component: { id: 20, name: 'Platelet Concentrate' },
        quantity: 2,
        facilities: [{ facility: B, available: 1, earliest_expiry: '2026-10-01', suggested: 1 }],
        other_facilities: [A, C, D],
        suggested_total: 1,
        shortfall: 1,
      },
    ],
  }
}

describe('the suggested split', () => {
  it('fills earliest expiry first until the need is covered', () => {
    expect(fefoFill(plan().lines[0].facilities, 5)).toEqual({ 1: 1, 2: 3, 3: 1 })
  })

  it('matches what the API suggested, component by component', () => {
    const split = suggestedSplit(plan())

    expect(split).toEqual({ 10: { 1: 1, 2: 3, 3: 1 }, 20: { 2: 1 } })

    for (const line of plan().lines) {
      for (const holding of line.facilities) {
        expect(split[line.component.id][holding.facility.id] ?? 0).toBe(holding.suggested)
      }
    }
  })

  it('leaves what the shelves cannot cover unasked', () => {
    expect(allocationTotals(plan(), suggestedSplit(plan()))[1]).toMatchObject({ required: 2, allocated: 1, remaining: 1, over: 0 })
  })
})

describe('Required / Allocated / Remaining', () => {
  it('adds up what each centre is asked for against what the patient needs', () => {
    const split = setShare(suggestedSplit(plan()), 10, 3, 0)

    expect(allocationTotals(plan(), split)[0]).toEqual({
      componentId: 10,
      component: 'Packed RBC',
      required: 5,
      allocated: 4,
      remaining: 1,
      over: 0,
    })
  })

  it('refuses asking for more than the patient needs', () => {
    const split = setShare(suggestedSplit(plan()), 10, 4, 2)

    expect(allocationTotals(plan(), split)[0]).toMatchObject({ allocated: 7, remaining: 0, over: 2 })
    expect(allocationProblems(plan(), split)).toEqual([
      'Packed RBC: 7 unit(s) allocated but only 5 needed. Remove 2.',
    ])
  })

  it('allows a shortfall, and says it will stay unallocated', () => {
    const split = setShare(suggestedSplit(plan()), 10, 3, 0)

    expect(allocationProblems(plan(), split)).toEqual([])
    expect(allocationWarnings(plan(), split)).toContain('1 unit(s) of Packed RBC will stay unallocated; you can ask another facility later.')
  })

  it('refuses asking nobody for anything', () => {
    expect(allocationProblems(plan(), {})).toEqual(['Ask at least one facility for at least one unit.'])
  })

  it('warns, without refusing, when a centre is asked for more than it shows', () => {
    const split = setShare(setShare({}, 10, 1, 2), 20, 4, 1)

    expect(allocationProblems(plan(), split)).toEqual([])
    expect(allocationWarnings(plan(), split)).toEqual(expect.arrayContaining([
      'Davao Blood Center shows 1 Packed RBC available but is asked for 2.',
      'Mati Blood Center shows no matching Platelet Concentrate today.',
    ]))
  })

  it('reads typed quantities as whole units and drops anything at nought', () => {
    let split = setShare({}, 10, 1, '2')
    split = setShare(split, 10, 2, '-3')
    split = setShare(split, 10, 3, '1.9')

    expect(split).toEqual({ 10: { 1: 2, 3: 1 } })
  })
})

describe('what is sent', () => {
  it('asks each centre once, with a line per component asked of it', () => {
    expect(buildAllocationShares(plan(), suggestedSplit(plan()))).toEqual([
      { facility_id: 1, lines: [{ component_id: 10, quantity: 1 }] },
      { facility_id: 2, lines: [{ component_id: 10, quantity: 3 }, { component_id: 20, quantity: 1 }] },
      { facility_id: 3, lines: [{ component_id: 10, quantity: 1 }] },
    ])
  })

  it('sends the patient, the need and the split as the API takes them', () => {
    const draft: TransfusionDraft = {
      bloodTypeId: 7,
      urgency: 'emergency',
      patient: { surname: ' Dela Cruz ', firstName: 'Juan', middleName: ' ', age: '54', sex: 'male' },
      lines: [
        { component_id: 10, quantity: 5, indication_code: 'R-1' },
        { component_id: 20, quantity: 2, indication_code: 'P-1', indication_other: null },
      ],
    }

    const payload = buildTransfusionPayload(draft, plan(), suggestedSplit(plan()))

    expect(payload).toMatchObject({
      internal_stock_confirmed: true,
      blood_type_id: 7,
      urgency_level: 'emergency',
      patient_surname: 'Dela Cruz',
      patient_middle_name: null,
      patient_age: 54,
      patient_sex: 'male',
      lines: [
        { component_id: 10, quantity: 5, indication_code: 'R-1' },
        { component_id: 20, quantity: 2, indication_code: 'P-1' },
      ],
    })
    expect(payload.allocations).toHaveLength(3)
    expect(payload.lines[1]).not.toHaveProperty('indication_other')
  })
})

describe('reading a Patient Transfusion Request', () => {
  function request(overrides: Partial<TransfusionRequest> = {}): TransfusionRequest {
    return {
      status: 'processing',
      is_open: true,
      needs_allocation: true,
      totals: { required: 5, requested: 5, awaiting: 0, approved: 4, fulfilled: 0, received: 0, remaining: 1, unallocated: 1 },
      ...overrides,
    } as TransfusionRequest
  }

  it('says how much is approved rather than just "processing"', () => {
    expect(transfusionProgressLabel(request())).toBe('Approved 4 of 5')
  })

  it('tells an unanswered request from one nobody has been asked for', () => {
    const awaiting = { required: 5, requested: 5, awaiting: 5, approved: 0, fulfilled: 0, received: 0, remaining: 5, unallocated: 0 }

    expect(transfusionProgressLabel(request({ status: 'pending', needs_allocation: false, totals: awaiting }))).toBe('Awaiting facility response')
    expect(transfusionProgressLabel(request({ status: 'pending', totals: { ...awaiting, awaiting: 0, unallocated: 5 } }))).toBe('Needs a facility')
  })

  it('marks a finished short request as closed', () => {
    expect(transfusionProgressLabel(request({ status: 'partial', is_open: false }))).toBe('Partially Fulfilled (Closed)')
    expect(transfusionProgressLabel(request({ status: 'fulfilled', is_open: false }))).toBe('Fulfilled')
  })

  it('offers to withdraw only a share nobody has answered', () => {
    expect(canWithdrawAllocation({ status: 'pending' }, true)).toBe(true)
    expect(canWithdrawAllocation({ status: 'processing' }, true)).toBe(false)
    expect(canWithdrawAllocation({ status: 'pending' }, false)).toBe(false)
  })

  it('offers to close a component while any of it is still being asked for', () => {
    expect(canCloseRequirementLine({ closed_at: null, awaiting: 0, unallocated: 1 }, true)).toBe(true)
    expect(canCloseRequirementLine({ closed_at: null, awaiting: 2, unallocated: 0 }, true)).toBe(true)
    expect(canCloseRequirementLine({ closed_at: null, awaiting: 0, unallocated: 0 }, true)).toBe(false)
    expect(canCloseRequirementLine({ closed_at: '2026-09-30', awaiting: 1, unallocated: 0 }, true)).toBe(false)
  })

  it('offers to cancel only while nothing is approved', () => {
    expect(canCancelTransfusion(request())).toBe(false)
    expect(canCancelTransfusion(request({ totals: { ...request().totals, approved: 0 } }))).toBe(true)
  })
})
