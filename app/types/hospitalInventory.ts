/**
 * A hospital blood bank's own stock, as the API speaks it.
 *
 * Bags reach a hospital's shelf only by receipt. A Tag is one specific bag
 * held for one specific patient: Tag Assigned keeps it in storage with 24
 * hours for crossmatching; Tag Crossmatched means it has left storage with 24
 * hours for the transfusion. When a period runs out — or staff release the
 * tag — it ends as Untagged Assigned or Untagged Crossmatched. A crossmatched
 * bag that comes back waits as Pending Return until staff confirm it is in
 * storage again, or discard it.
 *
 * The single source for these literals and their labels in the client, the
 * way types/bloodRequest.ts is for requests.
 */

import type { Tone } from '~/utils/requestFulfilment'

/** hospital_units.status — where a bag in the hospital's custody stands. */
export type HospitalUnitStatus =
  | 'available'
  | 'tag_assigned'
  | 'tag_crossmatched'
  | 'pending_return'
  | 'transfused'
  | 'expired'
  | 'discarded'

/** unit_tags.status — one patient's hold on one bag, and how it ended. */
export type UnitTagStatus =
  | 'tag_assigned'
  | 'tag_crossmatched'
  | 'transfused'
  | 'untagged_assigned'
  | 'untagged_crossmatched'

/** Why a tag ended without a transfusion. */
export type UntagReason = 'crossmatch_deadline_expired' | 'transfusion_deadline_expired' | 'released_by_staff'

/** The actions a bag offers, each one route on the API. */
export type UnitAction = 'tag' | 'crossmatch' | 'transfuse' | 'release' | 'return' | 'discard'

export interface TagPatient {
  full_name: string | null
  surname: string
  first_name: string
  middle_name: string | null
  age: number
  sex: 'male' | 'female'
  record_number: string | null
  ward: string | null
  attending_physician: string | null
  blood_type: string | null
}

export interface UnitTag {
  id: number
  status: UnitTagStatus
  status_label: string
  description: string
  patient: TagPatient
  transfusion_request: { id: number; reference_number: string | null } | null
  tagged_at: string
  crossmatch_deadline_at: string
  crossmatched_at: string | null
  transfusion_deadline_at: string | null
  transfused_at: string | null
  untagged_at: string | null
  untag_reason: UntagReason | null
  untag_reason_label: string | null
  untag_note: string | null
  untagged_by_system: boolean
  returned_at: string | null
  /** The deadline an active tag is running against; null once it has ended. */
  deadline_at: string | null
  seconds_remaining: number | null
  deadline_passed: boolean
  actors?: {
    tagged_by: string | null
    crossmatched_by: string | null
    transfused_by: string | null
    untagged_by: string | null
    returned_by: string | null
  }
}

/** One ended tag, as the tag-events list returns it. */
export interface UnitTagEvent extends UnitTag {
  unit: {
    unit_id: string | null
    bag_number?: string | null
    status: HospitalUnitStatus | null
    blood_type: string | null
    component: string | null
  }
}

export interface HospitalUnit {
  id: number
  /** The bag's key: its RedAgos bag number, or an internal key for an external bag. Used in routes. */
  unit_id: string
  /** The number staff see: the sender's own for an external bag, otherwise `unit_id`. */
  bag_number?: string
  /** The number an outside blood service printed on the bag; null for a RedAgos bag. */
  external_unit_number?: string | null
  status: HospitalUnitStatus
  status_label: string
  blood_type: { id: number | null; code: string | null }
  component: { id: number | null; name: string | null }
  volume_ml: number | null
  expiry_date: string | null
  days_remaining: number | null
  bag_expired: boolean
  stocked_at: string | null
  /**
   * Where the bag came from: the request it was received for — the PTR, when
   * it was a patient's share — or a delivery from outside RedAgos.
   */
  source: {
    type?: 'request' | 'direct_distribution'
    request_id: number | null
    reference_number: string | null
    transfusion_request_id: number | null
    transfusion_reference: string | null
    weekly_request_id?: number | null
    direct_distribution?: {
      id: number
      source_name: string | null
      external_unit_number: string
      quantity?: number
      requested_for?: string | null
    } | null
  }
  active_tag: UnitTag | null
  /** Why a bag pending return is out of storage: the tag that ended. */
  last_tag: UnitTag | null
  expired_at: string | null
  discarded_at: string | null
  discard_reason: string | null
}

export interface HospitalInventorySummary {
  totals: Record<HospitalUnitStatus, number>
  by_blood_type: Array<{ blood_type_id: number; code: string; available: number }>
  near_expiry: { within_3_days: number }
  /** Active tags past their deadline. Above zero for more than a minute means the sweep is down. */
  overdue_active_tags: number
  as_of: string
}

export interface HospitalInventoryFilters {
  status?: HospitalUnitStatus
  blood_type_id?: number
  component_id?: number
  transfusion_request_id?: number
  expiring_within_days?: number
  search?: string
  per_page?: number
  page?: number
}

export interface TagEventFilters {
  status?: 'transfused' | 'untagged_assigned' | 'untagged_crossmatched'
  untag_reason?: UntagReason
  search?: string
  per_page?: number
  page?: number
}

export interface TagUnitPayload {
  transfusion_request_id?: number | null
  patient_surname?: string
  patient_first_name?: string
  patient_middle_name?: string | null
  patient_age?: number | null
  patient_sex?: 'male' | 'female' | ''
  patient_record_number?: string | null
  patient_ward?: string | null
  attending_physician?: string | null
  patient_blood_type_id?: number | null
}

/** What every bag action returns: a message and the bag as it now stands. */
export interface UnitActionResult {
  message: string
  unit: HospitalUnit
}

export const HOSPITAL_UNIT_STATUS_LABELS: Record<HospitalUnitStatus, string> = {
  available: 'Available',
  tag_assigned: 'Tag Assigned',
  tag_crossmatched: 'Tag Crossmatched',
  pending_return: 'Pending Return',
  transfused: 'Transfused',
  expired: 'Expired',
  discarded: 'Discarded',
}

/**
 * The tone each bag status is drawn in.
 *
 * Tag Assigned and Tag Crossmatched must never look alike: they are different
 * operational stages, one still in the fridge and one at the bedside.
 */
export const HOSPITAL_UNIT_STATUS_TONES: Record<HospitalUnitStatus, Tone> = {
  available: 'success',
  tag_assigned: 'info',
  tag_crossmatched: 'progress',
  pending_return: 'warning',
  transfused: 'muted',
  expired: 'danger',
  discarded: 'muted',
}

export const UNIT_TAG_STATUS_LABELS: Record<UnitTagStatus, string> = {
  tag_assigned: 'Tag Assigned',
  tag_crossmatched: 'Tag Crossmatched',
  transfused: 'Transfused',
  untagged_assigned: 'Untagged Assigned',
  untagged_crossmatched: 'Untagged Crossmatched',
}

export const UNIT_TAG_STATUS_TONES: Record<UnitTagStatus, Tone> = {
  tag_assigned: 'info',
  tag_crossmatched: 'progress',
  transfused: 'success',
  untagged_assigned: 'warning',
  untagged_crossmatched: 'warning',
}

/** The line under an active tag saying what it waits for. */
export const TAG_STAGE_LABELS: Record<'tag_assigned' | 'tag_crossmatched', string> = {
  tag_assigned: 'Crossmatch pending',
  tag_crossmatched: 'Awaiting transfusion',
}

export const UNTAG_REASON_LABELS: Record<UntagReason, string> = {
  crossmatch_deadline_expired: 'Crossmatch deadline expired',
  transfusion_deadline_expired: 'Transfusion deadline expired',
  released_by_staff: 'Released by staff',
}

/** Every refusal the hospital inventory routes can give, and what to tell staff. */
export const UNIT_REFUSAL_MESSAGES: Record<string, string> = {
  unit_not_found: 'That bag is not in your blood bank.',
  unit_not_available: 'That bag is no longer available — it may have just been tagged. The list has been refreshed.',
  invalid_transition: 'That step does not apply to the bag as it now stands. The list has been refreshed.',
  tag_deadline_passed: 'The 24-hour period for this tag has ended. The bag is being released from the patient.',
  bag_expired: 'This bag is past its expiry date and cannot be issued to a patient.',
  unit_not_discardable: 'This bag cannot be discarded as it stands. Release its tag first.',
  transfusion_request_not_found: 'That Patient Transfusion Request was not found.',
  transfusion_request_closed: 'That Patient Transfusion Request was cancelled. Tag the bag to the patient directly instead.',
}

/** Status filter options, in lifecycle order. */
export const HOSPITAL_UNIT_STATUSES: HospitalUnitStatus[] = [
  'available',
  'tag_assigned',
  'tag_crossmatched',
  'pending_return',
  'transfused',
  'expired',
  'discarded',
]
