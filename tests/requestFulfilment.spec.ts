import { describe, it, expect } from 'vitest'
import {
  applyFollowUpMatch,
  blankWalkInForm,
  buildFollowUpPayload,
  buildWalkInPayload,
  canCloseLine,
  clearFollowUp,
  forwardableRows,
  fulfilmentRows,
  fulfilmentTotals,
  localInputToIso,
  matchesNeedingAcknowledgement,
  toLocalInputValue,
  walkInStepProblems,
  type WalkInForm,
} from '~/utils/requestFulfilment'
import { requestStage, requestStatusLabel, type BloodRequest, type ComponentOption, type DuplicateMatch } from '~/types/bloodRequest'

/**
 * Request versus fulfilment, and the walk-in form.
 *
 * What is locked in: the requested figure is shown as it was asked and never
 * recomputed from what was supplied; a line reports its own outcome; a
 * finished partial request reads as closed; and a walk-in cannot be sent
 * unless the hospital confirmed it — the form has nothing to send on a "no".
 */

const COMPONENTS: ComponentOption[] = [
  {
    id: 1,
    name: 'Packed RBC',
    indication_codes: [
      { code: 'R-1', label: 'R-1', description: 'Hb < 7', requires_explanation: false },
      { code: 'R-5', label: 'R-5', description: 'Others, please specify.', requires_explanation: true },
    ],
  },
  {
    id: 2,
    name: 'Fresh Frozen Plasma',
    indication_codes: [{ code: 'F-1', label: 'F-1', description: 'Bleeding', requires_explanation: false }],
  },
  { id: 3, name: 'Platelet Concentrate', indication_codes: [{ code: 'P-1', label: 'P-1', description: 'Low platelets', requires_explanation: false }] },
]

/** The scenario the workflow was specified against, as the API projects it. */
function scenario(overrides: Partial<BloodRequest> = {}): BloodRequest {
  return {
    status: 'partial',
    status_label: 'Partially Fulfilled',
    is_open: true,
    items: [
      { id: 11, component: { id: 1, name: 'Packed RBC' }, quantity: 2, fulfilled_quantity: 2, reserved_quantity: 0, received_quantity: 2, forwarded_quantity: 0, remaining_quantity: 0, allocatable_quantity: 0, forwardable_quantity: 0, line_status: 'fulfilled', line_status_label: 'Fulfilled' },
      { id: 12, component: { id: 2, name: 'Fresh Frozen Plasma' }, quantity: 2, fulfilled_quantity: 1, reserved_quantity: 0, received_quantity: 0, forwarded_quantity: 0, remaining_quantity: 1, allocatable_quantity: 1, forwardable_quantity: 1, line_status: 'partial', line_status_label: 'Partially Fulfilled' },
      { id: 13, component: { id: 3, name: 'Platelet Concentrate' }, quantity: 1, fulfilled_quantity: 0, reserved_quantity: 0, received_quantity: 0, forwarded_quantity: 0, remaining_quantity: 1, allocatable_quantity: 1, forwardable_quantity: 1, line_status: 'unfulfilled', line_status_label: 'Unfulfilled' },
    ],
    ...overrides,
  } as unknown as BloodRequest
}

describe('the fulfilment table', () => {
  it('shows each line as requested beside what was fulfilled and what remains', () => {
    const rows = fulfilmentRows(scenario())

    expect(rows.map((row) => [row.component, row.requested, row.fulfilled, row.remaining, row.status])).toEqual([
      ['Packed RBC', 2, 2, 0, 'fulfilled'],
      ['Fresh Frozen Plasma', 2, 1, 1, 'partial'],
      ['Platelet Concentrate', 1, 0, 1, 'unfulfilled'],
    ])
  })

  it('totals the request without touching the requested figure', () => {
    const totals = fulfilmentTotals(fulfilmentRows(scenario()))

    expect(totals.requested).toBe(5)
    expect(totals.fulfilled).toBe(3)
    expect(totals.remaining).toBe(2)
  })

  it('derives a line status the same way the API does when none was sent', () => {
    const request = scenario()
    request.items = request.items.map(({ line_status, line_status_label, ...rest }) => rest)

    expect(fulfilmentRows(request).map((row) => row.status)).toEqual(['fulfilled', 'partial', 'unfulfilled'])
  })

  it('offers to close only lines that still have something to supply, on an open request', () => {
    const rows = fulfilmentRows(scenario())

    expect(rows.map((row) => canCloseLine(row, true))).toEqual([false, true, true])
    expect(rows.map((row) => canCloseLine(row, false))).toEqual([false, false, false])
  })

  it('lists only the lines that can still be sourced elsewhere', () => {
    expect(forwardableRows(scenario()).map((row) => row.id)).toEqual([12, 13])
  })
})

describe('the request status as it reads', () => {
  it('marks a finished partial request as closed', () => {
    expect(requestStatusLabel(scenario())).toBe('Partially Fulfilled')
    expect(requestStatusLabel(scenario({ is_open: false }))).toBe('Partially Fulfilled (Closed)')
    expect(requestStatusLabel({ status: 'fulfilled', status_label: 'Fulfilled', is_open: false })).toBe('Fulfilled')
  })

  it('reads receipt from the counts rather than the status', () => {
    const fulfilled = scenario({ status: 'fulfilled', fulfilled_quantity: 5, received_count: 3 })
    expect(requestStage(fulfilled)).toBe('Fulfilled — awaiting receipt')

    expect(requestStage({ ...fulfilled, received_count: 5 })).toBe('Received')
    expect(requestStage(scenario({ status: 'pending', is_walk_in: true }))).toBe('Recorded at blood center')
  })
})

describe('a follow-up for the remainder', () => {
  it('asks only for what each line can still forward, dropping lines left at zero', () => {
    const rows = forwardableRows(scenario())

    expect(buildFollowUpPayload(9, { 12: 5, 13: 0 }, rows)).toEqual({
      target_facility_id: 9,
      items: [{ parent_item_id: 12, quantity: 1 }],
    })
  })

  it('takes the patient and lines from the original when a walk-in continues it', () => {
    const match = {
      id: 40,
      reference_number: 'RQ-4-0012',
      relation: 'follow_up',
      patient: { surname: 'Dela Cruz', first_name: 'Juan', middle_name: null, age: 54, sex: 'male', full_name: 'DELA CRUZ, Juan' },
      blood_type: { id: 7, code: 'O+' },
      urgency_level: 'emergency',
      lines: [
        { request_item_id: 11, component: { id: 1, name: 'Packed RBC' }, requested: 2, reserved: 0, fulfilled: 2, forwardable: 0 },
        { request_item_id: 12, component: { id: 2, name: 'Fresh Frozen Plasma' }, requested: 2, reserved: 0, fulfilled: 1, forwardable: 1 },
      ],
    } as unknown as DuplicateMatch

    const form = applyFollowUpMatch(blankWalkInForm(), match)

    expect(form.parentRequestId).toBe(40)
    expect(form.patient.surname).toBe('Dela Cruz')
    expect(form.bloodTypeId).toBe(7)
    expect(form.lines).toEqual([
      { componentId: 2, parentItemId: 12, quantity: 1, maxQuantity: 1, indicationCode: '', indicationOther: '' },
    ])

    expect(clearFollowUp(form).parentRequestId).toBeNull()
  })

  it('does not count the request being continued as a duplicate of it', () => {
    const matches = [{ id: 40 }, { id: 41 }] as DuplicateMatch[]

    expect(matchesNeedingAcknowledgement(matches, 40).map((m) => m.id)).toEqual([41])
    expect(matchesNeedingAcknowledgement(matches, null)).toHaveLength(2)
  })
})

describe('the walk-in form', () => {
  function completed(): WalkInForm {
    const form = blankWalkInForm(new Date(Date.now() - 60_000))

    form.hospitalId = 3
    form.patient = { surname: ' Dela Cruz ', firstName: 'Juan', middleName: '', age: '54', sex: 'male' }
    form.bloodTypeId = 7
    form.urgency = 'emergency'
    form.lines = [
      { componentId: 1, parentItemId: null, quantity: '2', maxQuantity: null, indicationCode: 'R-1', indicationOther: '' },
      { componentId: 2, parentItemId: null, quantity: 2, maxQuantity: null, indicationCode: 'F-1', indicationOther: '' },
    ]
    form.representative = { name: 'Pedro Dela Cruz', relationship: 'Son', contact: '09171234567', idType: '', idNumber: '' }
    form.verification = {
      ...form.verification,
      confirmed: true,
      verifierName: 'Ana Lim',
      verifierPosition: 'Medical Technologist',
      verifierContact: '(082) 222-1234',
    }

    return form
  }

  it('cannot get past verification unless the hospital said yes', () => {
    const form = completed()
    form.verification.confirmed = false

    expect(walkInStepProblems(form, 'verify')).toEqual([
      'A walk-in request can only be recorded once the hospital blood bank has confirmed it.',
    ])
  })

  it('needs the person who confirmed it named', () => {
    const form = completed()
    form.verification.verifierName = ' '
    form.verification.verifierPosition = ''

    expect(walkInStepProblems(form, 'verify')).toEqual([
      'Enter who at the hospital confirmed the request.',
      'Enter their position.',
    ])
  })

  it('refuses a confirmation time in the future', () => {
    const form = completed()
    form.verification.verifiedAt = toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000))

    expect(walkInStepProblems(form, 'verify')).toContain('The confirmation cannot be in the future.')
  })

  it('checks every line against the indications its component allows', () => {
    const form = completed()
    form.lines[0].indicationCode = 'R-5'
    form.lines[1].indicationCode = ''

    expect(walkInStepProblems(form, 'details', COMPONENTS)).toEqual([
      'Specify the indication for Packed RBC.',
      'Select the indication for Fresh Frozen Plasma.',
    ])
  })

  it('refuses the same component twice and a follow-up above what is left', () => {
    const form = completed()
    form.lines[1].componentId = 1
    form.lines[1].indicationCode = 'R-1'

    expect(walkInStepProblems(form, 'details', COMPONENTS)).toContain('Packed RBC is listed twice.')

    const followUp = completed()
    followUp.parentRequestId = 40
    followUp.lines = [{ componentId: 2, parentItemId: 12, quantity: 3, maxQuantity: 1, indicationCode: '', indicationOther: '' }]

    expect(walkInStepProblems(followUp, 'details', COMPONENTS)).toEqual([
      'Only 1 unit(s) of Fresh Frozen Plasma are left to source.',
    ])
  })

  it('is complete once every step is filled in', () => {
    const form = completed()

    expect(walkInStepProblems(form, 'lookup')).toEqual([])
    expect(walkInStepProblems(form, 'verify')).toEqual([])
    expect(walkInStepProblems(form, 'details', COMPONENTS)).toEqual([])
  })

  it('sends the patient, lines, watcher and verifier as the API takes them', () => {
    const payload = buildWalkInPayload(completed())

    expect(payload).toMatchObject({
      hospital_id: 3,
      urgency_level: 'emergency',
      patient_surname: 'Dela Cruz',
      patient_age: 54,
      blood_type_id: 7,
      items: [
        { component_id: 1, quantity: 2, indication_code: 'R-1', indication_other: null },
        { component_id: 2, quantity: 2, indication_code: 'F-1', indication_other: null },
      ],
      representative: { name: 'Pedro Dela Cruz', relationship: 'Son', contact: '09171234567', id_type: null, id_number: null },
      verification: { confirmed: true, verifier_name: 'Ana Lim', verifier_position: 'Medical Technologist' },
      duplicate_acknowledgement: null,
    })
    expect(payload.verification.verified_at).toMatch(/Z$/)
    expect(payload).not.toHaveProperty('parent_request_id')
  })

  it('sends a follow-up as parent lines only, leaving the patient to the original', () => {
    const form = completed()
    form.parentRequestId = 40
    form.lines = [{ componentId: 2, parentItemId: 12, quantity: 1, maxQuantity: 1, indicationCode: '', indicationOther: '' }]

    const payload = buildWalkInPayload(form)

    expect(payload.parent_request_id).toBe(40)
    expect(payload.items).toEqual([{ parent_item_id: 12, quantity: 1 }])
    expect(payload).not.toHaveProperty('patient_surname')
    expect(payload).not.toHaveProperty('blood_type_id')
  })

  it('round-trips the confirmation time through the datetime input', () => {
    const at = new Date(2026, 8, 27, 14, 30)

    expect(toLocalInputValue(at)).toBe('2026-09-27T14:30')
    expect(localInputToIso('2026-09-27T14:30')).toBe(at.toISOString())
    expect(localInputToIso('')).toBeNull()
  })
})
