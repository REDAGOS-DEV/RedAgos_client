/**
 * Stocking in arrived bags by scanning them (hospital receiving, project
 * owner 2026-10-11): inventory staff scan each bag's barcode as they put it
 * away, and only scanned (or ticked) bags are stocked in.
 *
 * Pure, so the matching can be tested without mounting the page.
 */
import { bagMatchesCode, normalizeBagCode } from '~/utils/bagNumber'

/** The parts of an arrived bag a scan can match. */
export interface ScannableBag {
  unit_id: string
  bag_number?: string | null
  external_unit_number?: string | null
  bag_expired?: boolean
}

export type StockInScanResult =
  | { kind: 'scanned'; unitId: string; label: string }
  | { kind: 'unknown'; code: string }
  | { kind: 'expired'; code: string }
  | { kind: 'already'; code: string }

/**
 * Which arrived bag a scanned or typed code is.
 *
 * A RedAgos bag carries its bag number (SNBC-21627990-PRBC) and its
 * donation's barcode sticker; a bag from outside carries the sender's number.
 * A sticker and a sender's number are each shared by several bags (every bag
 * of a donation, every bag of a batch), so each scan takes the next of them
 * not yet scanned. Case and surrounding space are ignored, as a scanner or a
 * hand may add either.
 */
export function matchStockInScan(code: string, arrived: ScannableBag[], scanned: string[]): StockInScanResult {
  const wanted = normalizeBagCode(code)
  const same = (value: string | null | undefined) => Boolean(value) && normalizeBagCode(value) === wanted

  const matches = arrived.filter((bag) => bagMatchesCode(wanted, bag.bag_number)
    || bagMatchesCode(wanted, bag.unit_id)
    || same(bag.external_unit_number))

  if (!matches.length) return { kind: 'unknown', code: wanted }

  const inDate = matches.filter((bag) => !bag.bag_expired)

  if (!inDate.length) return { kind: 'expired', code: wanted }

  const next = inDate.find((bag) => !scanned.includes(bag.unit_id))

  if (!next) return { kind: 'already', code: wanted }

  return { kind: 'scanned', unitId: next.unit_id, label: next.bag_number || next.unit_id }
}
