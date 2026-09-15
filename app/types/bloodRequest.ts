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

/** blood_requests.urgency_level — the only two the schema accepts. */
export type UrgencyLevel = 'routine' | 'emergency'

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
  unit_id: string
  status: AllocationStatus
  status_label: string
  expiry_date: string | null
  storage_location?: string | null
  allocated_at: string | null
  released_at: string | null
  received_at: string | null
}

export interface BloodRequest {
  id: number
  reference_number: string
  requesting_facility: FacilityStub | null
  /** Absent on the fulfilling side's projection, which always means itself. */
  target_facility?: FacilityStub | null
  blood_type: BloodTypeStub
  component: ComponentStub
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

export interface CreateBloodRequestPayload {
  target_facility_id: number
  blood_type_id: number
  component_id: number
  quantity: number
  urgency_level: UrgencyLevel
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
