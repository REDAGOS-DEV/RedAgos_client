import { describe, it, expect } from 'vitest'
import {
  applyContinueMatch,
  blankWalkInForm,
  buildWalkInPayload,
  canCloseLine,
  clearContinuation,
  fulfilmentRows,
  fulfilmentTotals,
  localInputToIso,
  matchesNeedingAcknowledgement,
  toLocalInputValue,
  walkInStepProblems,
  type WalkInForm,
} from '~/utils/requestFulfilment'
import {
  bloodTypeCodes,
  bloodTypeSummary,
  componentSummary,
  hasMixedBloodTypes,
  requestLineLabel,
  requestStage,
  requestStatusLabel,
  type BloodRequest,
  type ComponentOption,
  type DuplicateMatch,
} from '~/types/bloodRequest'

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
      { id: 11, component: { id: 1, name: 'Packed RBC' }, quantity: 2, fulfilled_quantity: 2, reserved_quantity: 0, received_quantity: 2, remaining_quantity: 0, allocatable_quantity: 0, line_status: 'fulfilled', line_status_label: 'Fulfilled' },
      { id: 12, component: { id: 2, name: 'Fresh Frozen Plasma' }, quantity: 2, fulfilled_quantity: 1, reserved_quantity: 0, received_quantity: 0, remaining_quantity: 1, allocatable_quantity: 1, line_status: 'partial', line_status_label: 'Partially Fulfilled' },
      { id: 13, component: { id: 3, name: 'Platelet Concentrate' }, quantity: 1, fulfilled_quantity: 0, reserved_quantity: 0, received_quantity: 0, remaining_quantity: 1, allocatable_quantity: 1, line_status: 'unfulfilled', line_status_label: 'Unfulfilled' },
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
    request.items = request.items.map((item) => ({ ...item, line_status: undefined, line_status_label: undefined }))

    expect(fulfilmentRows(request).map((row) => row.status)).toEqual(['fulfilled', 'partial', 'unfulfilled'])
  })

  it('offers to close only lines that still have something to supply, on an open request', () => {
    const rows = fulfilmentRows(scenario())

    expect(rows.map((row) => canCloseLine(row, true))).toEqual([false, true, true])
    expect(rows.map((row) => canCloseLine(row, false))).toEqual([false, false, false])
  })
})

describe('a weekly request restocking several blood types in one request', () => {
  function weekly(): BloodRequest {
    return {
      status: 'pending',
      is_open: true,
      blood_type: { id: null, code: null },
      blood_types: ['A+', 'AB+', 'O-'],
      items: [
        { id: 21, blood_type: { id: 1, code: 'A+' }, component: { id: 5, name: 'Cryoprecipitate' }, quantity: 12 },
        { id: 22, blood_type: { id: 4, code: 'AB+' }, component: { id: 5, name: 'Cryoprecipitate' }, quantity: 12 },
        { id: 23, blood_type: { id: 8, code: 'O-' }, component: { id: 3, name: 'Platelet Concentrate' }, quantity: 12 },
      ],
    } as unknown as BloodRequest
  }

  it('names every blood type it asks for', () => {
    expect(bloodTypeCodes(weekly())).toEqual(['A+', 'AB+', 'O-'])
    expect(bloodTypeSummary(weekly())).toBe('A+, AB+, O-')
    expect(hasMixedBloodTypes(weekly())).toBe(true)
  })

  it('names each line with its blood type, so one component in two types reads as two lines', () => {
    expect(fulfilmentRows(weekly()).map((row) => row.component)).toEqual([
      'A+ Cryoprecipitate',
      'AB+ Cryoprecipitate',
      'O- Platelet Concentrate',
    ])
  })

  it('lists each component once in the one-line summary', () => {
    expect(componentSummary(weekly())).toBe('Cryoprecipitate, Platelet Concentrate')
  })

  it('reads the types from the lines when the request was loaded without them', () => {
    const request = { ...weekly(), blood_types: undefined }

    expect(bloodTypeCodes(request)).toEqual(['A+', 'AB+', 'O-'])
  })

  it('leaves a request of one blood type reading as before', () => {
    const single = scenario({ blood_type: { id: 7, code: 'O+' }, blood_types: ['O+'] })

    expect(bloodTypeSummary(single)).toBe('O+')
    expect(hasMixedBloodTypes(single)).toBe(false)
    expect(requestLineLabel(single, single.items[0]!)).toBe('Packed RBC')
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

describe('a walk-in continuing a Patient Transfusion Request', () => {
  it('takes the patient and offers only the unallocated units', () => {
    const match = {
      id: 40,
      reference_number: 'PTR-4-0012',
      relation: 'continue',
      allocation: null,
      facilities: ['Tagum Blood Center'],
      patient: { surname: 'Dela Cruz', first_name: 'Juan', middle_name: null, age: 54, sex: 'male', full_name: 'DELA CRUZ, Juan' },
      blood_type: { id: 7, code: 'O+' },
      urgency_level: 'emergency',
      lines: [
        { transfusion_request_item_id: 11, component: { id: 1, name: 'Packed RBC' }, required: 2, approved: 2, fulfilled: 2, unallocated: 0 },
        { transfusion_request_item_id: 12, component: { id: 2, name: 'Fresh Frozen Plasma' }, required: 2, approved: 1, fulfilled: 1, unallocated: 1 },
      ],
      unallocated_quantity: 1,
    } as unknown as DuplicateMatch

    const form = applyContinueMatch(blankWalkInForm(), match)

    expect(form.transfusionRequestId).toBe(40)
    expect(form.transfusionReference).toBe('PTR-4-0012')
    expect(form.patient.surname).toBe('Dela Cruz')
    expect(form.bloodTypeId).toBe(7)
    expect(form.lines).toEqual([
      { componentId: 2, requirementItemId: 12, quantity: 1, maxQuantity: 1, indicationCode: '', indicationOther: '' },
    ])

    expect(clearContinuation(form).transfusionRequestId).toBeNull()
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
      { componentId: 1, requirementItemId: null, quantity: '2', maxQuantity: null, indicationCode: 'R-1', indicationOther: '' },
      { componentId: 2, requirementItemId: null, quantity: 2, maxQuantity: null, indicationCode: 'F-1', indicationOther: '' },
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

  it('refuses the same component twice and a continuation above what is unallocated', () => {
    const form = completed()
    form.lines[1].componentId = 1
    form.lines[1].indicationCode = 'R-1'

    expect(walkInStepProblems(form, 'details', COMPONENTS)).toContain('Packed RBC is listed twice.')

    const continuing = completed()
    continuing.transfusionRequestId = 40
    continuing.lines = [{ componentId: 2, requirementItemId: 12, quantity: 3, maxQuantity: 1, indicationCode: '', indicationOther: '' }]

    expect(walkInStepProblems(continuing, 'details', COMPONENTS)).toEqual([
      'Only 1 unit(s) of Fresh Frozen Plasma are still unallocated.',
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
    expect(payload).not.toHaveProperty('transfusion_request_id')
  })

  it('sends a continuation as requirement lines only, leaving the patient to the requirement', () => {
    const form = completed()
    form.transfusionRequestId = 40
    form.lines = [{ componentId: 2, requirementItemId: 12, quantity: 1, maxQuantity: 1, indicationCode: '', indicationOther: '' }]

    const payload = buildWalkInPayload(form)

    expect(payload.transfusion_request_id).toBe(40)
    expect(payload.items).toEqual([{ transfusion_request_item_id: 12, quantity: 1 }])
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
