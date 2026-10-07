/**
 * The hospital blood bank's Receiving section, as the API speaks it.
 *
 * Two inflows. A **weekly request** is the scheduled restock the blood bank
 * sends a blood center on its request days (Mon/Wed/Fri, say): one order per
 * center per request day, written as one replenishment request per blood type.
 * The center supplies what it can; whatever it does not is closed as
 * unavailable when it dispatches. A **direct distribution** is a delivery from
 * outside RedAgos — the Philippine Red Cross, say — whose bags carry no RedAgos
 * barcode, so staff type each bag's own number.
 *
 * The single source for these shapes and their refusal messages in the client,
 * the way types/bloodRequest.ts is for requests.
 */

import type { BloodRequest } from '~/types/bloodRequest'
import type { HospitalUnitStatus } from '~/types/hospitalInventory'

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface FacilityRef {
  id: number
  name: string
  address: string | null
}

/** The days the blood bank sends one center its weekly request. */
export interface ReplenishmentSchedule {
  id: number
  target_facility: FacilityRef | null
  days_of_week: IsoWeekday[]
  /** "Mon, Wed, Fri". */
  days_label: string
  updated_by: string | null
  created_at: string | null
  updated_at: string | null
}

/** One past request day, and whether a weekly request went out on it. */
export interface RequestDay {
  date: string
  weekday: IsoWeekday
  sent: boolean
  weekly_request: { id: number; reference_number: string } | null
}

/** Where one schedule stands today. Derived by the API, never stored. */
export interface ScheduleStatus {
  schedule: ReplenishmentSchedule
  is_request_day: boolean
  sent_today: { id: number; reference_number: string } | null
  due_today: boolean
  next_request_day: string | null
  /** Request days of the last four weeks, newest first. */
  recent: RequestDay[]
  missed_count: number
  last_missed_day: string | null
}

/** GET /hospital/weekly-requests/status */
export interface WeeklyStatus {
  /** Today's operational date, Asia/Manila. */
  as_of: string
  today_weekday: IsoWeekday
  schedules: ScheduleStatus[]
}

export type WeeklyRequestStatus = 'submitted' | 'in_progress' | 'fulfilled' | 'partial' | 'not_supplied'

export interface WeeklyTotals {
  requested: number
  fulfilled: number
  received: number
  awaiting_receipt: number
  /** What can no longer come: the remainder of a closed, rejected or cancelled request. */
  not_supplied: number
}

export interface WeeklyRequest {
  id: number
  reference_number: string
  request_day: string
  submitted_at: string | null
  requester_name: string | null
  target_facility: FacilityRef | null
  status: WeeklyRequestStatus
  status_label: string
  is_open: boolean
  totals: WeeklyTotals
  /** One replenishment request per blood type. Allocations only on the detail view. */
  requests: BloodRequest[]
}

/** One line of a weekly request: no indication, a weekly request has no patient to certify one for. */
export interface WeeklyRequestLine {
  component_id: number
  blood_type_id: number
  quantity: number
}

/** POST /hospital/weekly-requests */
export interface CreateWeeklyRequestPayload {
  target_facility_id: number
  lines: WeeklyRequestLine[]
}

/** A blood service outside RedAgos a bag can be received from. */
export interface ExternalBloodSource {
  id: number
  name: string
  code: string | null
}

/** One bag of an external receipt, and where it now stands. */
export interface DirectDistributionUnit {
  /** The bag's key, used in routes. Never shown. */
  unit_id: string
  /** What staff see: the sender's identifier, with "#n" when one identifier covered several bags. */
  bag_number: string
  status: HospitalUnitStatus | null
  status_label: string | null
}

/**
 * Blood received from outside RedAgos under one identifier.
 *
 * For a Patient Transfusion Request it is one bag; without one it is a typed
 * batch of `quantity` bags, with who requested them.
 */
export interface DirectDistribution {
  id: number
  /** The identifier the sender gave it. RedAgos never replaces it. */
  external_unit_number: string
  quantity: number
  source: ExternalBloodSource | null
  transfusion_request: { id: number; reference_number: string } | null
  /** Who asked for a batch received without a request: a patient, ward or physician. */
  requested_for: string | null
  blood_type: { id: number | null; code: string | null }
  component: { id: number | null; name: string | null }
  volume_ml: number | null
  collection_date: string | null
  expiry_date: string | null
  days_remaining: number | null
  units: DirectDistributionUnit[]
  received_at: string | null
  received_by: string | null
}

/** POST /hospital/direct-distributions: one bag for a request, or a typed batch without one. */
export interface ReceiveDirectDistributionPayload {
  /** Set for a bag received for a patient's request; then quantity is 1. */
  transfusion_request_id?: number | null
  /** Set instead of a request: who asked for the blood. */
  requested_for?: string | null
  /** How many bags arrived under the identifier, 1–100. Only without a request. */
  quantity?: number | null
  external_blood_source_id: number
  external_unit_number: string
  blood_type_id: number
  component_id: number
  volume_ml?: number | null
  collection_date?: string | null
  expiry_date: string
  /** ISO 8601 with an offset; omitted means now. */
  received_at?: string | null
}

export const WEEKDAY_LABELS: Record<IsoWeekday, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
}

export const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]

export const WEEKLY_STATUS_TONES: Record<WeeklyRequestStatus, 'info' | 'progress' | 'warning' | 'success' | 'danger' | 'muted'> = {
  submitted: 'info',
  in_progress: 'progress',
  fulfilled: 'success',
  partial: 'warning',
  not_supplied: 'danger',
}

/** Every refusal the Receiving routes can give, and what to tell staff. */
export const RECEIVING_REFUSAL_MESSAGES: Record<string, string> = {
  no_request_schedule: 'Set your request days for this blood center before sending it a weekly request.',
  not_a_request_day: 'Today is not one of your request days for this blood center. A restock that cannot wait can be sent as a STAT request.',
  weekly_request_exists: "Today's weekly request to this blood center has already been sent.",
  weekly_request_not_found: 'That weekly request was not found.',
  schedule_not_found: 'You keep no request days for that blood center.',
  external_unit_already_received: 'Blood under this identifier has already been received from that blood service.',
  redagos_unit: 'This is a RedAgos bag. Receive it from the request it was dispatched for.',
  transfusion_request_not_found: 'That Patient Transfusion Request was not found.',
  transfusion_request_closed: 'That Patient Transfusion Request was cancelled.',
  nothing_to_confirm: 'Nothing on this request is waiting to be received.',
}
