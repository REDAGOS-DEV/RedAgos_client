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
 * The coverage fields are only sent when the caller loaded allocations — a
 * listing has not, and reporting every line as uncovered would be worse than
 * saying nothing.
 */
export interface BloodRequestItem {
  id: number
  component: ComponentStub
  quantity: number
  indication_code: string | null
  indication_label: string | null
  indication_description: string | null
  indication_other: string | null
  /** The criterion to show: the requester's own words for an "Others" code. */
  indication_text: string | null
  allocated_count?: number
  outstanding_quantity?: number
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
  /** Held units that still lay claim to stock. Counted in SQL, not derived here. */
  allocated_count: number
  received_count: number
  outstanding_quantity: number
  rejection_reason: string | null
  request_date: string | null
  reviewed_at: string | null
  fulfilled_at: string | null
  allocations?: RequestAllocation[]
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
 * Describe where a request has got to, for a progress timeline.
 *
 * Derived from the request's own counts rather than stored: the API keeps
 * request status coarse on purpose and records dispatch and receipt on the
 * allocations, so the finer stage is a reading of those two numbers.
 */
export function requestStage(request: BloodRequest): string {
  if (request.status === 'rejected') return 'Rejected'
  if (request.status === 'cancelled') return 'Cancelled'
  if (request.status === 'fulfilled') return 'Completed'
  if (request.status === 'pending') return 'Submitted'

  const allocations = request.allocations ?? []
  const released = allocations.filter((a) => a.status === 'released')

  if (request.received_count > 0) return 'Partially received'
  if (released.length > 0) return 'Dispatched'
  if (request.allocated_count > 0) return 'Stock reserved'

  return 'Under review'
}
