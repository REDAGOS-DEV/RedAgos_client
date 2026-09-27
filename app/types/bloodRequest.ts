/**
 * The blood request vocabulary, as the API actually speaks it.
 *
 * Before this file the client carried four mutually incompatible sets of
 * status strings and three of urgency, none of which matched the database:
 * `useBloodRequestDetails` spoke Title Case ("Ready for Pickup"), the request
 * list spoke lower case ("ready"), the incoming queue spoke a third set
 * ("Under Review"), and the fulfilment page ran an eight-stage pipeline of its
 * own. None of them could ever have round-tripped, because the schema has only
 * ever accepted the six values below.
 *
 * This module is the single source of truth. Import the types and the label
 * maps from here rather than restating literals in a component.
 */

/** blood_requests.status — the coarse lifecycle of the request itself. */
export type BloodRequestStatus =
  | 'pending'
  | 'processing'
  | 'partial'
  | 'fulfilled'
  | 'rejected'
  | 'cancelled'

/**
 * blood_requests.urgency_level — the only two the schema accepts.
 *
 * The DOH request form calls these ROUTINE and STAT, and so does the UI. The
 * stored value stays `emergency`, because the triage scope, the emergency
 * banner and the submission notification all key off it. See PRIORITY_LABELS.
 */
export type UrgencyLevel = 'routine' | 'emergency'

/**
 * blood_requests.request_purpose — why the request was raised.
 *
 * Separate from urgency and never to be merged with it: a restock can be STAT
 * and a named-patient transfusion can be routine. This decides whether the
 * request carries patient identity at all.
 */
export type RequestPurpose = 'patient_transfusion' | 'replenishment'

/**
 * blood_requests.request_source — where the request was keyed in.
 *
 * A separate axis from purpose. A walk-in is still a Patient Transfusion
 * request from the patient's hospital; the watcher simply brought it to a blood
 * centre, which confirmed it with the hospital by phone and entered it there.
 */
export type RequestSource = 'blood_bank_portal' | 'blood_center_walk_in'

/**
 * How far one line of a request has been met. Derived by the API from what was
 * released, forwarded and closed — never stored.
 */
export type LineFulfilmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'forwarded' | 'closed_short'

/** Why the rest of a line will not be supplied by the facility handling it. */
export type LineClosureReason = 'unavailable' | 'not_needed'

/** request_allocations.status — one bag's hold against one request. */
export type AllocationStatus = 'allocated' | 'released' | 'cancelled'

/** blood_units.status — where a bag is in its own life. */
export type BloodUnitStatus =
  | 'available'
  | 'reserved'
  | 'issued'
  | 'expired'
  | 'discarded'

/** billings.status */
export type BillingStatus = 'unpaid' | 'partial' | 'paid' | 'void'

/** payments.payment_method / payments.status */
export type PaymentMethod = 'cash' | 'gcash'
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export interface FacilityStub {
  id: number
  name: string
  address: string | null
}

export interface BloodTypeStub {
  id: number
  code: string | null
}

export interface ComponentStub {
  id: number
  name: string | null
}

export interface RequestAllocation {
  id: number
  /** Which line of the request this bag answers. */
  request_item_id: number | null
  unit_id: string
  status: AllocationStatus
  status_label: string
  expiry_date: string | null
  storage_location?: string | null
  allocated_at: string | null
  released_at: string | null
  received_at: string | null
}

/**
 * One component asked for on a request, with the indication claimed for it.
 *
 * `quantity` is what was requested and never changes. The fulfilment figures
 * beside it say what was provided: fulfilled is what the centre released,
 * received what the hospital confirmed, forwarded what another facility was
 * asked for instead, and remaining is requested less fulfilled.
 *
 * `allocated_count` and `outstanding_quantity` are only sent when the caller
 * loaded allocations with units — the detail views.
 */
export interface BloodRequestItem {
  id: number
  /** On a follow-up: the line of the original request this line carries. */
  parent_item_id?: number | null
  component: ComponentStub
  quantity: number
  indication_code: string | null
  indication_label: string | null
  indication_description: string | null
  indication_other: string | null
  /** The criterion to show: the requester's own words for an "Others" code. */
  indication_text: string | null
  closed_at?: string | null
  closure_reason?: LineClosureReason | null
  closure_reason_label?: string | null
  closure_note?: string | null
  reserved_quantity?: number
  fulfilled_quantity?: number
  received_quantity?: number
  forwarded_quantity?: number
  remaining_quantity?: number
  /** What this facility may still hold for the line. */
  allocatable_quantity?: number
  /** What may still be asked of another facility. */
  forwardable_quantity?: number
  line_status?: LineFulfilmentStatus
  line_status_label?: string
  allocated_count?: number
  outstanding_quantity?: number
}

/** The other end of a follow-up link: a reference, where it went, how far it got. */
export interface RequestStub {
  id: number
  reference_number: string
  facility: FacilityStub | null
  status: BloodRequestStatus
  status_label: string
  is_open: boolean
}

/** The watcher who presented a walk-in, and who at the hospital confirmed it. */
export interface WalkInDetails {
  representative: {
    name: string
    relationship: string
    contact: string
    id_type: string | null
    id_type_label: string | null
    id_number: string | null
  }
  presented_reference: string | null
  attending_physician: string | null
  patient_ward: string | null
  patient_record_number: string | null
  verification: {
    method: 'phone'
    verifier_name: string
    verifier_position: string
    verifier_contact: string
    verified_at: string | null
    recorded_by: string | null
    notes: string | null
  }
  duplicate_acknowledgement: string | null
}

/** Null on a replenishment request, which has no patient. */
export interface PatientDetails {
  surname: string | null
  first_name: string | null
  middle_name: string | null
  /** "SURNAME, First Middle", as the form prints it. */
  full_name: string | null
  age: number | null
  sex: 'male' | 'female' | null
}

export interface BloodRequest {
  id: number
  reference_number: string
  requesting_facility: FacilityStub | null
  /** Absent on the fulfilling side's projection, which always means itself. */
  target_facility?: FacilityStub | null
  request_purpose: RequestPurpose
  purpose_label: string
  request_source: RequestSource
  source_label: string
  is_walk_in: boolean
  /** The hospital user who submitted it. Null on a walk-in. */
  requester_name: string | null
  /** The blood-centre staff member who entered a walk-in. */
  recorder_name: string | null
  patient: PatientDetails | null
  blood_type: BloodTypeStub
  /** What the request asks for. A form can tick several components. */
  items: BloodRequestItem[]
  /** The sum of every line's units. Derived server-side, never stored. */
  quantity: number
  urgency_level: UrgencyLevel
  urgency_label: string
  is_emergency?: boolean
  status: BloodRequestStatus
  status_label: string
  /** False once nothing more may be done: terminal, or partial with every remainder closed or forwarded. */
  is_open: boolean
  closed_at: string | null
  /** Held units that still lay claim to stock. Counted in SQL, not derived here. */
  allocated_count: number
  received_count: number
  /** What this facility still has to find. */
  outstanding_quantity: number
  /** Released units — fulfilment is counted at dispatch. */
  fulfilled_quantity: number
  /** Requested less fulfilled. */
  remaining_quantity: number
  forwarded_quantity: number
  forwardable_quantity: number
  rejection_reason: string | null
  request_date: string | null
  reviewed_at: string | null
  fulfilled_at: string | null
  /** The request this follow-up carries a remainder for. */
  parent: RequestStub | null
  follow_ups: RequestStub[]
  walk_in: WalkInDetails | null
  allocations?: RequestAllocation[]
}

/** One entry of a request's history, as GET …/history returns it. */
export interface RequestEventLine {
  request_item_id: number
  component: string | null
  requested: number
  reserved: number
  fulfilled: number
  received: number
  forwarded: number
  remaining: number
  status: LineFulfilmentStatus
  status_label: string | null
}

export interface RequestEvent {
  id: number
  event: string
  event_label: string
  from_status: BloodRequestStatus | null
  to_status: BloodRequestStatus | null
  to_status_label: string | null
  actor: { id: number; name: string } | null
  actor_facility: { id: number; name: string } | null
  item: { id: number; component: string | null } | null
  related_request: { id: number; reference_number: string; facility: string | null } | null
  lines: RequestEventLine[]
  unit_count: number
  unit_ids: string[]
  meta: Record<string, unknown>
  note: string | null
  created_at: string | null
}

/**
 * A request the hospital already has for the walk-in's patient.
 *
 *  - here: already addressed to this centre and open — open it instead.
 *  - follow_up: part-filled at another centre — record this as its follow-up.
 *  - duplicate: anything else — a second request, allowed only with a reason.
 */
export type DuplicateRelation = 'here' | 'follow_up' | 'duplicate'

export interface DuplicateMatch {
  id: number
  reference_number: string
  relation: DuplicateRelation
  facility: { id: number; name: string } | null
  request_source: RequestSource
  source_label: string
  status: BloodRequestStatus
  status_label: string
  is_open: boolean
  request_date: string | null
  blood_type: BloodTypeStub
  urgency_level: UrgencyLevel
  patient: PatientDetails
  lines: Array<{
    request_item_id: number
    component: ComponentStub
    requested: number
    reserved: number
    fulfilled: number
    forwardable: number
  }>
  forwardable_quantity: number
}

/** GET /blood-center/blood-requests/walk-in/reference */
export interface WalkInReference {
  hospitals: Array<{ id: number; name: string; address: string | null; phone: string | null }>
  blood_types: Array<{ id: number; code: string; label: string }>
  components: ComponentOption[]
  priorities: Array<{ value: UrgencyLevel; label: string }>
  purpose: { value: RequestPurpose; label: string }
  id_types: Array<{ value: string; label: string }>
  duplicate_window_days: number
}

export interface CreateWalkInPayload {
  hospital_id: number
  parent_request_id?: number | null
  urgency_level: UrgencyLevel
  patient_surname?: string
  patient_first_name?: string
  patient_middle_name?: string | null
  patient_age?: number
  patient_sex?: 'male' | 'female'
  blood_type_id?: number
  presented_reference?: string | null
  attending_physician?: string | null
  patient_ward?: string | null
  patient_record_number?: string | null
  items: Array<{
    component_id?: number
    parent_item_id?: number
    quantity: number
    indication_code?: string | null
    indication_other?: string | null
  }>
  representative: {
    name: string
    relationship: string
    contact: string
    id_type?: string | null
    id_number?: string | null
  }
  verification: {
    confirmed: true
    verifier_name: string
    verifier_position: string
    verifier_contact: string
    verified_at: string
    notes?: string | null
  }
  duplicate_acknowledgement?: string | null
}

export interface CreateFollowUpPayload {
  target_facility_id: number
  urgency_level?: UrgencyLevel
  items: Array<{ parent_item_id: number; quantity: number }>
}

export interface AvailabilityHolding {
  facility: FacilityStub
  available: number
  /** How much of the ask this facility covers — not the same as what it holds. */
  can_fulfil: number
  covers_request: boolean | null
  earliest_expiry: string | null
}

export interface AvailabilityResult {
  criteria: {
    blood_type: BloodTypeStub
    component: ComponentStub
    quantity: number | null
  }
  facilities: AvailabilityHolding[]
  totals: { facilities_with_stock: number; units_available: number }
  /** Always true. A search result is never a hold — see the API's own note. */
  advisory: boolean
  as_of: string
}

export interface Billing {
  id: number
  request_id: number
  total_amount: number
  collected: number
  status: BillingStatus
  status_label: string
  is_zero_rated: boolean
  clears_release: boolean
  billing_date: string | null
}

export interface CreateBloodRequestItemPayload {
  component_id: number
  quantity: number
  indication_code: string | null
  /** Required when the chosen code is an "Others" code. */
  indication_other?: string | null
}

export interface CreateBloodRequestPayload {
  target_facility_id: number
  blood_type_id: number
  urgency_level: UrgencyLevel
  request_purpose: RequestPurpose
  /** Required for a transfusion, omitted for a replenishment. */
  patient_surname?: string | null
  patient_first_name?: string | null
  patient_middle_name?: string | null
  patient_age?: number | null
  patient_sex?: 'male' | 'female' | null
  items: CreateBloodRequestItemPayload[]
}

/** GET /hospital/reference-data — what the request form is built from. */
export interface IndicationCodeOption {
  code: string
  label: string
  description: string
  /** True for the "Others" codes, which the form says trigger a review. */
  requires_explanation: boolean
}

export interface ComponentOption {
  id: number
  name: string
  indication_codes: IndicationCodeOption[]
}

export interface RequestReferenceData {
  blood_types: Array<{ id: number; code: string; label: string }>
  components: ComponentOption[]
  purposes: Array<{ value: RequestPurpose; label: string; requires_patient: boolean }>
  priorities: Array<{ value: UrgencyLevel; label: string }>
}

export interface BloodRequestFilters {
  status?: BloodRequestStatus
  urgency_level?: UrgencyLevel
  request_source?: RequestSource
  blood_type_id?: number
  component_id?: number
  search?: string
  per_page?: number
  page?: number
}

/**
 * Display labels, kept beside the types they describe.
 *
 * The API already sends `status_label` and `urgency_label`; these exist for the
 * places that only have the raw value to hand, such as a filter pill built from
 * the status list rather than from a row.
 */
export const REQUEST_STATUS_LABELS: Record<BloodRequestStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  partial: 'Partially Fulfilled',
  fulfilled: 'Fulfilled',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  routine: 'Routine',
  emergency: 'Emergency',
}

/**
 * The same two levels as the DOH request form names them.
 *
 * Use these anywhere the user is looking at request paperwork; URGENCY_LABELS
 * remains for the operational screens that have always said "Emergency".
 */
export const PRIORITY_LABELS: Record<UrgencyLevel, string> = {
  routine: 'Routine',
  emergency: 'STAT',
}

export const REQUEST_PURPOSE_LABELS: Record<RequestPurpose, string> = {
  patient_transfusion: 'Patient Transfusion',
  replenishment: 'Blood Bank Replenishment',
}

export const REQUEST_PURPOSES: RequestPurpose[] = ['patient_transfusion', 'replenishment']

export const REQUEST_SOURCE_LABELS: Record<RequestSource, string> = {
  blood_bank_portal: 'Blood Bank Portal',
  blood_center_walk_in: 'Blood Center Walk-in',
}

export const REQUEST_SOURCES: RequestSource[] = ['blood_bank_portal', 'blood_center_walk_in']

export const LINE_STATUS_LABELS: Record<LineFulfilmentStatus, string> = {
  unfulfilled: 'Unfulfilled',
  partial: 'Partially Fulfilled',
  fulfilled: 'Fulfilled',
  forwarded: 'Forwarded to another facility',
  closed_short: 'Closed — not supplied',
}

export const LINE_STATUS_TONES: Record<LineFulfilmentStatus, 'info' | 'progress' | 'warning' | 'success' | 'danger' | 'muted'> = {
  unfulfilled: 'danger',
  partial: 'warning',
  fulfilled: 'success',
  forwarded: 'info',
  closed_short: 'muted',
}

export const ALLOCATION_STATUS_LABELS: Record<AllocationStatus, string> = {
  allocated: 'Reserved',
  released: 'Released',
  cancelled: 'Cancelled',
}

/** Every status, in lifecycle order, for filter controls. */
export const REQUEST_STATUSES: BloodRequestStatus[] = [
  'pending',
  'processing',
  'partial',
  'fulfilled',
  'rejected',
  'cancelled',
]

export const URGENCY_LEVELS: UrgencyLevel[] = ['routine', 'emergency']

/**
 * The tone a status should be rendered in.
 *
 * Kept here so a badge in the hospital portal and one in the blood centre
 * cannot drift into disagreeing about what "partial" looks like.
 */
export const REQUEST_STATUS_TONES: Record<BloodRequestStatus, 'info' | 'progress' | 'warning' | 'success' | 'danger' | 'muted'> = {
  pending: 'info',
  processing: 'progress',
  partial: 'warning',
  fulfilled: 'success',
  rejected: 'danger',
  cancelled: 'muted',
}

/**
 * Name the components a request asks for, in one line.
 *
 * A request can tick several components on one form, but a table row has room
 * for one phrase. Two are listed in full because that is the common case; past
 * that it counts the rest rather than overflowing the column.
 */
export function componentSummary(request: Pick<BloodRequest, 'items'>): string {
  const names = (request.items ?? [])
    .map((item) => item.component?.name)
    .filter((name): name is string => Boolean(name))

  if (names.length === 0) return '\u2014'
  if (names.length <= 2) return names.join(', ')

  return `${names[0]}, ${names[1]} +${names.length - 2} more`
}

/**
 * The status as it should read, including whether a partial request is finished.
 *
 * A partially fulfilled request whose every remainder was closed or forwarded
 * keeps the `partial` status — that is what was supplied — but can no longer be
 * filled, so it reads "Partially Fulfilled (Closed)".
 */
export function requestStatusLabel(request: Pick<BloodRequest, 'status' | 'status_label' | 'is_open'>): string {
  const label = request.status_label || REQUEST_STATUS_LABELS[request.status] || request.status

  return request.status === 'partial' && request.is_open === false ? `${label} (Closed)` : label
}

/**
 * Describe where a request has got to, for a progress timeline.
 *
 * Fulfilment is counted at dispatch, so the status says how much the centre
 * has provided. Receipt is recorded per unit by the hospital and read here from
 * the counts, because it no longer moves the status.
 */
export function requestStage(request: BloodRequest): string {
  if (request.status === 'rejected') return 'Rejected'
  if (request.status === 'cancelled') return 'Cancelled'
  if (request.status === 'pending') return request.is_walk_in ? 'Recorded at blood center' : 'Submitted'

  const fulfilled = request.fulfilled_quantity ?? 0
  const receivedAll = fulfilled > 0 && (request.received_count ?? 0) >= fulfilled

  if (request.status === 'fulfilled') return receivedAll ? 'Received' : 'Fulfilled — awaiting receipt'

  if (request.status === 'partial') {
    if (request.is_open === false) return receivedAll ? 'Partially fulfilled — closed, received' : 'Partially fulfilled — closed'

    return 'Partially fulfilled'
  }

  if (request.allocated_count > 0) return 'Stock reserved'

  return 'Under review'
}
