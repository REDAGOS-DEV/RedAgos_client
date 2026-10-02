/**
 * The time left on a hospital blood bank tag, and what a bag offers next.
 *
 * Tag Assigned and Tag Crossmatched each last 24 hours. The API says when a
 * tag's deadline is and stamps every response with its own clock (`as_of`);
 * the page ticks a local clock between loads. Measuring against the server's
 * clock rather than the browser's keeps a countdown honest on a machine whose
 * clock is wrong, and the page never acts on reaching zero — the server's
 * sweep untags, and the page only refreshes to show it.
 *
 * Pure functions only, so the rules can be tested without mounting a page.
 */

import type { HospitalUnit, HospitalUnitStatus, UnitAction } from '~/types/hospitalInventory'

export type DeadlineTier = 'ok' | 'soon' | 'critical' | 'overdue'

const HOUR = 3_600_000

/**
 * How far the browser's clock is from the server's, in milliseconds.
 *
 * Positive when the browser runs ahead. `receivedAtMs` is the browser's clock
 * when the response arrived.
 */
export function serverSkew(asOf: string | null | undefined, receivedAtMs: number): number {
  const server = asOf ? Date.parse(asOf) : Number.NaN

  return Number.isNaN(server) ? 0 : receivedAtMs - server
}

/** Milliseconds left until a deadline, never below zero. */
export function remainingMs(deadlineIso: string | null | undefined, nowMs: number, skewMs = 0): number {
  const deadline = deadlineIso ? Date.parse(deadlineIso) : Number.NaN

  if (Number.isNaN(deadline)) return 0

  return Math.max(0, deadline - (nowMs - skewMs))
}

/** Time left as staff read it: "18h 32m", "45m", "under a minute", or "Overdue". */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Overdue'

  const totalMinutes = Math.floor(ms / 60_000)

  if (totalMinutes < 1) return 'under a minute'

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`
}

/**
 * How urgent a running deadline is, for its colour and its row marker.
 *
 * Under 6 hours is soon; under 2 is critical. Thresholds are a display
 * choice, not a rule — the rule is the deadline itself.
 */
export function deadlineTier(ms: number): DeadlineTier {
  if (ms <= 0) return 'overdue'
  if (ms < 2 * HOUR) return 'critical'
  if (ms < 6 * HOUR) return 'soon'

  return 'ok'
}

/**
 * The actions a bag in this status offers, mirroring the API's transition map.
 *
 * Offering only these is a courtesy: the server re-checks every one under
 * lock and refuses anything else.
 */
export function actionsFor(status: HospitalUnitStatus, bagExpired = false): UnitAction[] {
  switch (status) {
    case 'available':
      return bagExpired ? ['discard'] : ['tag', 'discard']
    case 'tag_assigned':
      return bagExpired ? ['release'] : ['crossmatch', 'release']
    case 'tag_crossmatched':
      return bagExpired ? ['release'] : ['transfuse', 'release']
    case 'pending_return':
      return ['return', 'discard']
    case 'expired':
      return ['discard']
    default:
      return []
  }
}

/**
 * The Patient Transfusion Request a bag was received for, to suggest when tagging it.
 */
export function suggestedRequirement(unit: Pick<HospitalUnit, 'source'>): { id: number; reference: string | null } | null {
  const id = unit.source?.transfusion_request_id

  return id ? { id, reference: unit.source.transfusion_reference ?? null } : null
}

/**
 * Whether a patient's blood type differs from the bag's, worth a warning before tagging.
 *
 * A warning, never a block: crossmatching is the clinical check, and RedAgos
 * records it rather than performs it.
 */
export function bloodTypeMismatch(patientType: string | null | undefined, bagType: string | null | undefined): boolean {
  return Boolean(patientType && bagType && patientType !== bagType)
}
