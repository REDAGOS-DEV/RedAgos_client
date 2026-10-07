/**
 * Request and fulfilment, as the two portals show them.
 *
 * A request is what was asked for; its fulfilment is what was provided. The API
 * keeps them apart — every line's `quantity` is the requested figure and never
 * changes, and the fulfilment figures beside it are derived — and this module
 * keeps them apart on screen too. It also owns the walk-in form: the state the
 * dialog edits, the checks each step makes, and the payload the API takes.
 *
 * Pure functions only, so the rules can be tested without mounting a page.
 */

import type {
  BloodRequest,
  BloodRequestItem,
  ComponentOption,
  CreateWalkInPayload,
  DuplicateMatch,
  DuplicateRelation,
  LineFulfilmentStatus,
  UrgencyLevel,
} from '~/types/bloodRequest'
import { LINE_STATUS_LABELS, LINE_STATUS_TONES } from '~/types/bloodRequest'

export type Tone = 'info' | 'progress' | 'warning' | 'success' | 'danger' | 'muted'

/* ------------------------------------------------------------------ *
 * Fulfilment table
 * ------------------------------------------------------------------ */

export interface FulfilmentRow {
  id: number
  component: string
  requested: number
  reserved: number
  fulfilled: number
  received: number
  remaining: number
  allocatable: number
  status: LineFulfilmentStatus
  statusLabel: string
  tone: Tone
  closed: boolean
  closureLabel: string | null
  closureNote: string | null
}

/**
 * Work out a line's status when the API did not send one.
 *
 * The API always sends it on a detail view; this is the fallback for a line
 * loaded without its figures, and it follows the same order the server does.
 */
export function deriveLineStatus(item: BloodRequestItem): LineFulfilmentStatus {
  const requested = item.quantity ?? 0
  const fulfilled = item.fulfilled_quantity ?? 0

  if (fulfilled >= requested && requested > 0) return 'fulfilled'
  if (item.closed_at && (item.reserved_quantity ?? 0) === 0) return 'closed_short'
  if (fulfilled > 0) return 'partial'

  return 'unfulfilled'
}

/** One row per requested component: what was asked for, and what was provided. */
export function fulfilmentRows(request: Pick<BloodRequest, 'items'> | null | undefined): FulfilmentRow[] {
  return (request?.items ?? []).map((item) => {
    const requested = item.quantity ?? 0
    const fulfilled = item.fulfilled_quantity ?? 0
    const status = item.line_status ?? deriveLineStatus(item)

    return {
      id: item.id,
      component: item.component?.name ?? '—',
      requested,
      reserved: item.reserved_quantity ?? 0,
      fulfilled,
      received: item.received_quantity ?? 0,
      remaining: item.remaining_quantity ?? Math.max(0, requested - fulfilled),
      allocatable: item.allocatable_quantity ?? 0,
      status,
      statusLabel: item.line_status_label ?? LINE_STATUS_LABELS[status],
      tone: LINE_STATUS_TONES[status],
      closed: Boolean(item.closed_at),
      closureLabel: item.closure_reason_label ?? null,
      closureNote: item.closure_note ?? null,
    }
  })
}

export function fulfilmentTotals(rows: FulfilmentRow[]) {
  return rows.reduce(
    (totals, row) => ({
      requested: totals.requested + row.requested,
      reserved: totals.reserved + row.reserved,
      fulfilled: totals.fulfilled + row.fulfilled,
      received: totals.received + row.received,
      remaining: totals.remaining + row.remaining,
    }),
    { requested: 0, reserved: 0, fulfilled: 0, received: 0, remaining: 0 },
  )
}

/**
 * Whether the rest of a line may be closed from this screen.
 *
 * Only while the request is open and the line still has something this
 * facility could supply: a line fully held or released has nothing left to
 * close, and the API refuses it.
 */
export function canCloseLine(row: FulfilmentRow, requestOpen: boolean): boolean {
  return requestOpen && !row.closed && row.allocatable > 0
}

/* ------------------------------------------------------------------ *
 * Duplicates
 * ------------------------------------------------------------------ */

export const DUPLICATE_RELATION_LABELS: Record<DuplicateRelation, string> = {
  here: 'Already at this blood center',
  continue: 'Units still unallocated',
  duplicate: 'Open request for the same patient',
}

/**
 * The matches a new walk-in has to be justified against.
 *
 * A walk-in that continues a Patient Transfusion Request adds to it, so that
 * request is not a duplicate of it. Everything else found for the patient is.
 */
export function matchesNeedingAcknowledgement(matches: DuplicateMatch[], transfusionRequestId: number | null): DuplicateMatch[] {
  return matches.filter((match) => match.id !== transfusionRequestId)
}

/* ------------------------------------------------------------------ *
 * Walk-in form
 * ------------------------------------------------------------------ */

export interface WalkInLine {
  componentId: number | null
  /** Set when the line answers a line of an existing Patient Transfusion Request. */
  requirementItemId: number | null
  quantity: number | string
  /** The most a continuing line may ask for: what is still unallocated. */
  maxQuantity: number | null
  indicationCode: string
  indicationOther: string
}

export interface WalkInForm {
  hospitalId: number | null
  presentedReference: string
  /** The Patient Transfusion Request this walk-in adds this centre's share to. */
  transfusionRequestId: number | null
  transfusionReference: string | null
  patient: {
    surname: string
    firstName: string
    middleName: string
    age: number | string | null
    sex: '' | 'male' | 'female'
  }
  bloodTypeId: number | null
  urgency: UrgencyLevel
  attendingPhysician: string
  patientWard: string
  patientRecordNumber: string
  lines: WalkInLine[]
  representative: {
    name: string
    relationship: string
    contact: string
    idType: string
    idNumber: string
  }
  verification: {
    /** The hospital blood bank said yes on the phone. Nothing is saved otherwise. */
    confirmed: boolean
    verifierName: string
    verifierPosition: string
    verifierContact: string
    /** A datetime-local value: YYYY-MM-DDTHH:mm, in the counter's own time. */
    verifiedAt: string
    notes: string
  }
  duplicateAcknowledgement: string
}

export function blankLine(): WalkInLine {
  return { componentId: null, requirementItemId: null, quantity: 1, maxQuantity: null, indicationCode: '', indicationOther: '' }
}

/** Render a date as a datetime-local input value, in local time. */
export function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Read a datetime-local value back as an ISO timestamp the API can compare. */
export function localInputToIso(value: string): string | null {
  if (!value) return null

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function blankWalkInForm(now: Date = new Date()): WalkInForm {
  return {
    hospitalId: null,
    presentedReference: '',
    transfusionRequestId: null,
    transfusionReference: null,
    patient: { surname: '', firstName: '', middleName: '', age: null, sex: '' },
    bloodTypeId: null,
    urgency: 'routine',
    attendingPhysician: '',
    patientWard: '',
    patientRecordNumber: '',
    lines: [blankLine()],
    representative: { name: '', relationship: '', contact: '', idType: '', idNumber: '' },
    verification: {
      confirmed: false,
      verifierName: '',
      verifierPosition: '',
      verifierContact: '',
      verifiedAt: toLocalInputValue(now),
      notes: '',
    },
    duplicateAcknowledgement: '',
  }
}

/**
 * Turn the form into this centre's share of an existing Patient Transfusion Request.
 *
 * The patient, blood type, components and indications are the requirement's
 * — the API copies them from there and ignores anything typed — so the form
 * shows them read-only and offers only what is still unallocated.
 */
export function applyContinueMatch(form: WalkInForm, match: DuplicateMatch): WalkInForm {
  return {
    ...form,
    transfusionRequestId: match.id,
    transfusionReference: match.reference_number,
    patient: {
      surname: match.patient.surname ?? '',
      firstName: match.patient.first_name ?? '',
      middleName: match.patient.middle_name ?? '',
      age: match.patient.age ?? null,
      sex: match.patient.sex ?? '',
    },
    bloodTypeId: match.blood_type?.id ?? form.bloodTypeId,
    urgency: match.urgency_level ?? form.urgency,
    lines: match.lines
      .filter((line) => line.unallocated > 0)
      .map((line) => ({
        componentId: line.component.id,
        requirementItemId: line.transfusion_request_item_id,
        quantity: line.unallocated,
        maxQuantity: line.unallocated,
        indicationCode: '',
        indicationOther: '',
      })),
  }
}

/** Undo applyContinueMatch: a new requirement again, with fresh lines. */
export function clearContinuation(form: WalkInForm): WalkInForm {
  return { ...form, transfusionRequestId: null, transfusionReference: null, lines: [blankLine()] }
}

export type WalkInStep = 'lookup' | 'verify' | 'details'

function blank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === ''
}

/**
 * What stops a step from moving on, in the words staff will read.
 *
 * The API enforces all of this again; checking here means a watcher is not
 * kept waiting while the counter submits a form the server will refuse.
 */
export function walkInStepProblems(form: WalkInForm, step: WalkInStep, components: ComponentOption[] = []): string[] {
  const problems: string[] = []
  const continuing = form.transfusionRequestId !== null

  if (step === 'lookup') {
    if (!form.hospitalId) problems.push("Choose the patient's hospital blood bank.")

    if (!continuing) {
      if (blank(form.patient.surname)) problems.push('Enter the patient surname.')
      if (blank(form.patient.firstName)) problems.push('Enter the patient first name.')
    }

    return problems
  }

  if (step === 'verify') {
    if (!form.verification.confirmed) {
      problems.push('A walk-in request can only be recorded once the hospital blood bank has confirmed it.')

      return problems
    }

    if (blank(form.verification.verifierName)) problems.push('Enter who at the hospital confirmed the request.')
    if (blank(form.verification.verifierPosition)) problems.push('Enter their position.')
    if (blank(form.verification.verifierContact)) problems.push('Enter the number you called.')

    const at = localInputToIso(form.verification.verifiedAt)

    if (!at) {
      problems.push('Enter when the hospital confirmed the request.')
    } else if (new Date(at).getTime() > Date.now() + 5 * 60 * 1000) {
      problems.push('The confirmation cannot be in the future.')
    }

    return problems
  }

  // details
  if (!continuing) {
    const age = Number(form.patient.age)

    if (blank(form.patient.age) || !Number.isInteger(age) || age < 0 || age > 130) problems.push('Enter the patient age.')
    if (!form.patient.sex) problems.push('Select the patient sex.')
    if (!form.bloodTypeId) problems.push('Select the blood type required.')
  }

  if (blank(form.representative.name)) problems.push('Enter the name of the watcher presenting the request.')
  if (blank(form.representative.relationship)) problems.push('Enter how the watcher is related to the patient.')
  if (blank(form.representative.contact)) problems.push("Enter the watcher's contact number.")
  if (!blank(form.representative.idType) && blank(form.representative.idNumber)) problems.push('Enter the ID number of the ID presented.')

  const lines = form.lines.filter((line) => line.componentId !== null || line.requirementItemId !== null)

  if (lines.length === 0) problems.push('Add at least one blood component.')

  const seen = new Set<number>()

  for (const line of lines) {
    const component = components.find((option) => option.id === line.componentId)
    const name = component?.name ?? 'this component'
    const quantity = Number(line.quantity)

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) problems.push(`Enter a quantity of 1 to 100 for ${name}.`)
    if (line.maxQuantity !== null && quantity > line.maxQuantity) problems.push(`Only ${line.maxQuantity} unit(s) of ${name} are still unallocated.`)

    if (line.componentId !== null) {
      if (seen.has(line.componentId)) problems.push(`${name} is listed twice.`)
      seen.add(line.componentId)
    }

    // A continuing line carries the requirement's certified indication.
    if (continuing || !component) continue

    const codes = component.indication_codes ?? []
    const chosen = codes.find((code) => code.code === line.indicationCode)

    if (codes.length > 0 && !chosen) problems.push(`Select the indication for ${name}.`)
    if (chosen?.requires_explanation && blank(line.indicationOther)) problems.push(`Specify the indication for ${name}.`)
  }

  return problems
}

function optional(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()

  return trimmed === '' ? null : trimmed
}

/**
 * The payload POST /blood-center/blood-requests/walk-in takes.
 *
 * `verification.confirmed` is always true here: the dialog only reaches this
 * after the hospital said yes, and a "no" leaves nothing to send.
 */
export function buildWalkInPayload(form: WalkInForm): CreateWalkInPayload {
  const continuing = form.transfusionRequestId !== null
  const lines = form.lines.filter((line) => line.componentId !== null || line.requirementItemId !== null)

  const payload: CreateWalkInPayload = {
    hospital_id: Number(form.hospitalId),
    urgency_level: form.urgency,
    presented_reference: optional(form.presentedReference),
    attending_physician: optional(form.attendingPhysician),
    patient_ward: optional(form.patientWard),
    patient_record_number: optional(form.patientRecordNumber),
    items: lines.map((line) => continuing
      ? { transfusion_request_item_id: Number(line.requirementItemId), quantity: Number(line.quantity) }
      : {
          component_id: Number(line.componentId),
          quantity: Number(line.quantity),
          indication_code: optional(line.indicationCode),
          indication_other: optional(line.indicationOther),
        }),
    representative: {
      name: form.representative.name.trim(),
      relationship: form.representative.relationship.trim(),
      contact: form.representative.contact.trim(),
      id_type: optional(form.representative.idType),
      id_number: optional(form.representative.idNumber),
    },
    verification: {
      confirmed: true,
      verifier_name: form.verification.verifierName.trim(),
      verifier_position: form.verification.verifierPosition.trim(),
      verifier_contact: form.verification.verifierContact.trim(),
      verified_at: localInputToIso(form.verification.verifiedAt) ?? '',
      notes: optional(form.verification.notes),
    },
    duplicate_acknowledgement: optional(form.duplicateAcknowledgement),
  }

  if (continuing) {
    payload.transfusion_request_id = form.transfusionRequestId
  } else {
    payload.patient_surname = form.patient.surname.trim()
    payload.patient_first_name = form.patient.firstName.trim()
    payload.patient_middle_name = optional(form.patient.middleName)
    payload.patient_age = Number(form.patient.age)
    payload.patient_sex = form.patient.sex as 'male' | 'female'
    payload.blood_type_id = Number(form.bloodTypeId)
  }

  return payload
}
