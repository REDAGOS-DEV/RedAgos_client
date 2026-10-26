/**
 * Shaping helpers for TTI Testing's results list (BloodCenter/SerologyResults.vue).
 *
 * Whether a panel can still be corrected is the server's call (`can.correct`
 * and `locked` on each row, the reasons the correction route would refuse);
 * these decide how a row reads and what the correction carries.
 */

import { SEROLOGY_MARKERS, type MarkerReading, type SerologyMarkerOption } from './serology'

export interface SerologyResultMarker {
  marker: string
  label?: string
  result: MarkerReading | null
  result_label?: string | null
}

export interface SerologyResultRow {
  donation_id: number
  code: string
  outcome: 'reactive' | 'non_reactive'
  markers: SerologyResultMarker[] | null
  /** Reactive, saved by a technologist, not yet verified: it has set nothing off. */
  awaiting_verification?: boolean
  correction_pending?: boolean
  locked?: 'awaiting_verification' | 'reactive' | 'rejected' | 'units_released' | null
  can?: { correct?: boolean, verify?: boolean }
}

/**
 * The overall filter. A panel is reactive when any one marker is; awaiting
 * verification is a reactive panel the Laboratory Supervisor has not yet
 * checked against the bench record.
 */
export const OUTCOME_FILTERS = [
  { value: '', label: 'All results' },
  { value: 'non_reactive', label: 'Non-reactive' },
  { value: 'reactive', label: 'Reactive' },
  { value: 'awaiting_verification', label: 'Awaiting verification' },
  { value: 'correction_pending', label: 'Correction pending' },
] as const

export type SerologySort = 'newest' | 'oldest' | 'reactive_first'

/**
 * A marker's name as a column heading, without its gloss:
 * "HBsAg (Hepatitis B)" reads "HBsAg".
 */
export function markerHeading(label: string): string {
  return label.split('(')[0]!.trim() || label
}

/** A row's readings by marker, in the shape the recording form keeps them. */
export function readingsOf(
  row: Pick<SerologyResultRow, 'markers'>,
  markers: SerologyMarkerOption[] = SEROLOGY_MARKERS,
): Record<string, MarkerReading> {
  const readings = Object.fromEntries(markers.map((marker) => [marker.value, ''])) as Record<string, MarkerReading>

  for (const entry of row.markers ?? []) {
    if (entry.marker in readings) readings[entry.marker] = entry.result ?? ''
  }

  return readings
}

/** The markers whose reading differs from what is saved. */
export function changedMarkers(
  saved: Record<string, MarkerReading>,
  next: Record<string, MarkerReading>,
  markers: SerologyMarkerOption[] = SEROLOGY_MARKERS,
): string[] {
  return markers.filter((marker) => (saved[marker.value] ?? '') !== (next[marker.value] ?? '')).map((marker) => marker.value)
}

/** A marker a pending correction would change, as the review lists it. */
export interface CorrectionDiff {
  marker: string
  label: string
  from: MarkerReading
  to: MarkerReading
}

/**
 * What a pending correction would change: only the markers whose proposed
 * reading differs from the saved one, in the panel's order.
 */
export function correctionDiff(
  saved: Record<string, MarkerReading>,
  changes: Record<string, MarkerReading> | null | undefined,
  markers: SerologyMarkerOption[] = SEROLOGY_MARKERS,
): CorrectionDiff[] {
  return markers
    .filter((marker) => changes?.[marker.value] && changes[marker.value] !== saved[marker.value])
    .map((marker) => ({
      marker: marker.value,
      label: markerHeading(marker.label),
      from: saved[marker.value] ?? '',
      to: changes![marker.value]!,
    }))
}

/** A reading in words. */
export function readingLabel(reading: MarkerReading | null | undefined): string {
  if (reading === 'reactive') return 'Reactive'
  if (reading === 'non_reactive') return 'Non-reactive'
  return '—'
}

/**
 * Why a row cannot be corrected from the list, in words; null when it can.
 *
 * The lock comes first, in CorrectionService's order. A pending correction is
 * not a lock: the panel waits on that decision.
 */
export function lockText(row: Pick<SerologyResultRow, 'locked' | 'correction_pending' | 'can'>): string | null {
  if (row.can?.correct) return null

  switch (row.locked) {
    case 'awaiting_verification':
      return 'Saved as reactive and waiting for the Laboratory Supervisor to verify it against the bench record. Nothing has happened yet: the donation is not rejected and the donor is not deferred. The supervisor verifies it, or returns it for re-entry.'
    case 'reactive':
      return 'A reactive result can never be corrected. It has already rejected the donation, deferred the donor pending confirmatory testing and sent a medical referral to the Donor Counselling Physician.'
    case 'rejected':
      return 'This donation has been rejected, so its test results are locked.'
    case 'units_released':
      return 'Units from this donation have already left quarantine, so this result can no longer be corrected.'
  }

  if (row.correction_pending) return 'A correction to this panel is already waiting for a decision.'

  return 'Your role does not file corrections to the serology panel.'
}
