/**
 * Shaping helpers for the Deferrals page (blood-center/deferrals.vue):
 * deferrals the screening physician records on a donor by hand, outside a
 * visit, and lifts later.
 *
 * Whether a donor is deferred is the server's call; these only decide how a
 * deferral reads and what the New Deferral form sends.
 */

import { deferralChoicePayload } from '~/utils/deferralCodes'

/** The three deferrals the DOH form knows, mildest first. */
export const DEFERRAL_TYPES = [
  { value: 'temporarily_deferred', label: 'Temporary' },
  { value: 'indefinite_deferral', label: 'Indefinite' },
  { value: 'permanently_deferred', label: 'Permanent' },
] as const

export const TEMPORARY = 'temporarily_deferred'

export const DEFERRAL_STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'lifted', label: 'Lifted' },
] as const

/** How long a temporary deferral runs unless the physician says otherwise. */
export const DEFAULT_TEMPORARY_DAYS = 30

export type DeferralTone = 'ok' | 'info' | 'warn' | 'crit' | 'neutral'

/** temporary | indefinite | permanent, as the table's Type column reads it. */
export function deferralKindBadge(kind: string | null | undefined): { label: string, tone: DeferralTone } {
  switch (kind) {
    case 'permanent': return { label: 'Permanent', tone: 'crit' }
    case 'indefinite': return { label: 'Indefinite', tone: 'info' }
    case 'temporary': return { label: 'Temporary', tone: 'warn' }
    default: return { label: 'Deferred', tone: 'neutral' }
  }
}

/** active | expired | lifted. Only an active one still keeps the donor away. */
export function deferralStatusBadge(status: string | null | undefined): { label: string, tone: DeferralTone } {
  switch (status) {
    case 'active': return { label: 'Active', tone: 'ok' }
    case 'expired': return { label: 'Expired', tone: 'neutral' }
    case 'lifted': return { label: 'Lifted', tone: 'neutral' }
    default: return { label: '—', tone: 'neutral' }
  }
}

/** A Y-m-d date some days after another, in local time. */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export interface DeferralForm {
  donorUuid: string
  outcome: string
  /** One of the centre's deferral codes (the server copies its reason), or OTHER_DEFERRAL. */
  code: string
  /** The reason typed under Other. */
  otherReason: string
  from: string
  until: string
}

/**
 * What POST /deferrals takes: the code, or the reason typed under Other. The
 * Until date travels only with a temporary deferral; the form says it is
 * ignored otherwise.
 */
export function deferralPayload(form: DeferralForm): Record<string, string> {
  return {
    donor_uuid: form.donorUuid,
    outcome: form.outcome,
    ...deferralChoicePayload(form.code, form.otherReason),
    deferred_on: form.from,
    ...(form.outcome === TEMPORARY ? { ends_on: form.until } : {}),
  }
}
