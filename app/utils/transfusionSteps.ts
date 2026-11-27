/**
 * The four steps a hospital follows a Patient Transfusion Request through
 * (2026-11-26): the list row, the quick view and the full details all draw
 * these, so a request reads the same wherever it is opened.
 *
 * Fulfilment is counted at dispatch, so "Fulfilled" alone would read as done
 * while units still wait at the door; Received is the step that closes it here.
 */
import type { TransfusionStepTimes } from '~/types/bloodRequest'

export const TRANSFUSION_STEPS = ['Submitted', 'Approved', 'Released', 'Received'] as const

/** The least of a request these read: the list's raw row or the full projection. */
interface StepSubject {
  status: string
  is_open?: boolean
  totals?: { awaiting_receipt?: number } | null
}

interface HistoryEvent {
  event: string
  created_at?: string | null
  at?: string | null
}

export function isHaltedStatus(status: string | null | undefined): boolean {
  return status === 'rejected' || status === 'cancelled'
}

/** Units dispatched to this blood bank and not yet confirmed. */
export function awaitingReceipt(request: StepSubject | null | undefined): number {
  return request?.totals?.awaiting_receipt ?? 0
}

/** The step a request is on; TRANSFUSION_STEPS.length once nothing is left to do. */
export function transfusionStepIndex(request: StepSubject): number {
  if (isHaltedStatus(request.status)) return 0
  if (awaitingReceipt(request) > 0) return 3
  if (request.status === 'fulfilled' || (request.status === 'partial' && request.is_open === false)) {
    return TRANSFUSION_STEPS.length
  }

  return ({ pending: 0, processing: 1, partial: 2 } as Record<string, number>)[request.status] ?? 0
}

/** The step's time key in TransfusionStepTimes. */
export const STEP_TIME_KEYS = ['submitted', 'approved', 'released', 'received'] as const

/**
 * The same times the list API sends as `step_times`, read off a request's
 * history instead: the latest of each kind of event.
 */
export function stepTimesFromEvents(events: HistoryEvent[], submitted: string | null): TransfusionStepTimes {
  const latest = (kind: string): string | null => events
    .filter((event) => event.event === kind)
    .map((event) => event.created_at ?? event.at ?? null)
    .filter((at): at is string => Boolean(at))
    .sort()
    .at(-1) ?? null

  return {
    submitted,
    approved: latest('allocated'),
    released: latest('released'),
    received: latest('receipt_confirmed'),
  }
}

/**
 * How long ago, always as a span ("3h ago", "15d ago"), never a date, so it
 * never repeats a date already shown beside it.
 */
export function sinceShort(iso: string | null | undefined, now = Date.now()): string {
  const at = iso ? new Date(iso).getTime() : Number.NaN
  if (Number.isNaN(at)) return ''
  const minutes = Math.max(0, Math.floor((now - at) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return `${Math.floor(hours / 24)}d ago`
}
