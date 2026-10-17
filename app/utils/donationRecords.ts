/**
 * Shaping helpers for the Donations list (blood-center/donations.vue).
 *
 * What each viewer may know about a visit is the server's call; these only
 * decide how a visit's status reads.
 */

/** The status filter, in the order a visit runs. "Open" is a visit not yet drawn. */
export const DONATION_STATUS_FILTERS = [
  { value: 'open', label: 'Open visits' },
  { value: 'registered', label: 'Registered' },
  { value: 'screening', label: 'Screening' },
  { value: 'collected', label: 'Collected' },
  { value: 'tested', label: 'Tested' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Closed or deferred' },
] as const

export type DonationTone = 'info' | 'ok' | 'warn' | 'crit' | 'neutral'

/**
 * The dot colour for a visit. Open visits read blue (registered) or amber
 * (screening); a drawn bag on its way through the laboratory reads blue; a
 * completed one green; a deferral or a laboratory rejection red; a visit
 * simply closed grey.
 */
export function donationTone(status: string, label?: string | null): DonationTone {
  switch (status) {
    case 'registered': return 'info'
    case 'screening': return 'warn'
    case 'collected':
    case 'tested': return 'info'
    case 'completed': return 'ok'
    case 'rejected': return label === 'Closed' ? 'neutral' : 'crit'
    default: return 'neutral'
  }
}
