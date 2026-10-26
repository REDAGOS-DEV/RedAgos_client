/**
 * The Receiving section's pure rules: request days, typed bag numbers, and
 * matching scanned bags against a delivery.
 *
 * Mirrors the server so staff are told before a request is made. The server
 * stays the authority: it normalises bag numbers the same way, enforces the
 * request days, and refuses a number already recorded anywhere.
 */

import type { IsoWeekday } from '~/types/receiving'
import { WEEKDAY_LABELS, WEEKDAYS } from '~/types/receiving'
import { normalizeBarcode } from '~/utils/phlebotomy'

/** What a typed bag number may hold: it becomes the bag's id, and every bag route matches [A-Za-z0-9-]. */
export const UNIT_NUMBER_PATTERN = /^[A-Z0-9-]{1,50}$/

/**
 * Strip what a scanner appends and what a person types differently.
 *
 * The same normalisation as a donation barcode, so "prc-920923323 " and
 * "PRC-920923323" are one bag. Matches StoreDirectDistributionRequest.
 */
export function normalizeUnitNumber(value: string | null | undefined): string {
  return normalizeBarcode(value)
}

/** Request days in Monday-first order, duplicates and strays dropped. */
export function sortedWeekdays(days: Array<number | string>): IsoWeekday[] {
  const valid = new Set(
    days.map((day) => Number(day)).filter((day): day is IsoWeekday => WEEKDAYS.includes(day as IsoWeekday)),
  )

  return WEEKDAYS.filter((day) => valid.has(day))
}

/** Name request days for a label: "Mon · Wed · Fri". */
export function scheduleSummary(days: Array<number | string>): string {
  const sorted = sortedWeekdays(days)

  return sorted.length ? sorted.map((day) => WEEKDAY_LABELS[day]).join(' · ') : 'No request days'
}

/** Whether an ISO weekday is one of the request days. */
export function isRequestDay(days: Array<number | string>, isoWeekday: number): boolean {
  return sortedWeekdays(days).includes(isoWeekday as IsoWeekday)
}

/** The ISO weekday (1 = Monday … 7 = Sunday) of a Y-m-d date, read as a calendar date. */
export function isoWeekdayOf(date: string): IsoWeekday {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()

  return (weekday === 0 ? 7 : weekday) as IsoWeekday
}

/** One bag awaiting receipt on a delivery: a dispatched hold not yet confirmed. */
export interface AwaitingBag {
  allocation_id: number
  request_id: number
  unit_id: string
}

export type ScanResult =
  | { kind: 'matched'; bag: AwaitingBag }
  | { kind: 'already_scanned'; bag: AwaitingBag }
  | { kind: 'unknown'; unit_id: string }
  | { kind: 'empty' }

/**
 * Match one scanned or typed bag number against the bags awaiting receipt.
 *
 * A number that is on the delivery and not yet ticked is a match; one already
 * ticked is said so rather than counted twice; one not on the delivery is
 * unknown — a bag that arrived without being dispatched for this request.
 */
export function matchScannedBag(awaiting: AwaitingBag[], scanned: Set<number>, input: string): ScanResult {
  const unitId = normalizeUnitNumber(input)

  if (!unitId) return { kind: 'empty' }

  const bag = awaiting.find((candidate) => normalizeUnitNumber(candidate.unit_id) === unitId)

  if (!bag) return { kind: 'unknown', unit_id: unitId }

  return scanned.has(bag.allocation_id) ? { kind: 'already_scanned', bag } : { kind: 'matched', bag }
}

/** The parts of a Patient Transfusion Request's facility allocation this needs. */
interface AllocationLike {
  id: number
  items?: Array<{ id: number; component?: { name?: string | null } | null }>
  blood_type?: { code?: string | null } | null
  allocations?: Array<{
    id: number
    request_item_id: number | null
    unit_id: string
    status: string
    received_at: string | null
    expiry_date?: string | null
    released_at?: string | null
  }>
}

export interface AwaitingBagDetail extends AwaitingBag {
  blood_type: string | null
  component: string | null
  expiry_date: string | null
  released_at: string | null
}

/**
 * The bags a Patient Transfusion Request's centres have dispatched and the blood bank has not received.
 *
 * Direct Distribution matches a scan against these first: a RedAgos bag
 * dispatched for the patient is confirmed received through its own request,
 * never booked a second time as an external one.
 */
export function awaitingBagsFor(facilityAllocations: AllocationLike[] | null | undefined): AwaitingBagDetail[] {
  return (facilityAllocations ?? []).flatMap((request) => {
    const components = new Map((request.items ?? []).map((item) => [item.id, item.component?.name ?? null]))

    return (request.allocations ?? [])
      .filter((hold) => hold.status === 'released' && !hold.received_at)
      .map((hold) => ({
        allocation_id: hold.id,
        request_id: request.id,
        unit_id: hold.unit_id,
        blood_type: request.blood_type?.code ?? null,
        component: hold.request_item_id === null ? null : (components.get(hold.request_item_id) ?? null),
        expiry_date: hold.expiry_date ?? null,
        released_at: hold.released_at ?? null,
      }))
  })
}

/**
 * Group ticked bags by the blood request they were dispatched for.
 *
 * Receipt is confirmed per request, so one weekly delivery is confirmed as one
 * call — or one per blood type, for a weekly request sent before its lines
 * carried their own — each naming only the bags that actually arrived.
 */
export function receiptsByRequest(awaiting: AwaitingBag[], scanned: Set<number>): Map<number, number[]> {
  const groups = new Map<number, number[]>()

  for (const bag of awaiting) {
    if (!scanned.has(bag.allocation_id)) continue

    groups.set(bag.request_id, [...(groups.get(bag.request_id) ?? []), bag.allocation_id])
  }

  return groups
}
