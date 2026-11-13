/**
 * Bag numbers: [centre]-[barcode]-[component], e.g. SNBC-21627990-PRBC
 * (project owner, 2026-11-13).
 *
 * Every bag a RedAgos blood centre books carries one: the abbreviation of the
 * centre that collected it, the donation's barcode sticker, and the
 * component's code. A second bag of the same component ends -2. Every bag
 * from one donation shares the sticker, so scanning the sticker (digits only)
 * names all of them, and typing the full number names one.
 *
 * Mirrors the server's BagNumbers, which stays the authority. Bags a hospital
 * received from outside RedAgos keep their DD-… ids and the sender's own
 * number; they never parse as a bag number.
 */
import { normalizeBarcode } from '~/utils/phlebotomy'

export interface BagNumberParts {
  /** The collecting centre's abbreviation, or null when typed without it. */
  centre: string | null
  /** The donation's barcode sticker. */
  sticker: string
  /** The component's code: PRBC, FFP… */
  component: string
  /** 1 for the first bag of the component, 2 for the -2… */
  sequence: number
}

const BAG_NUMBER = /^(?:([A-Z]{2,6})-)?(\d+)-([A-Z][A-Z0-9]*)(?:-(\d+))?$/

/** A scanned or typed code as a bag number is written: no spaces or scanner control characters, in capitals. */
export function normalizeBagCode(value: string | null | undefined): string {
  return normalizeBarcode(value)
}

/** The parts of a bag number, or null when the text is not one. */
export function parseBagNumber(value: string | null | undefined): BagNumberParts | null {
  const match = BAG_NUMBER.exec(normalizeBagCode(value))

  if (!match) return null

  return {
    centre: match[1] ?? null,
    sticker: match[2]!,
    component: match[3]!,
    sequence: match[4] ? Number(match[4]) : 1,
  }
}

/** Whether a scanned or typed code is a bare barcode sticker: digits only. */
export function isSticker(code: string | null | undefined): boolean {
  return /^\d+$/.test(normalizeBagCode(code))
}

/**
 * Whether a scanned or typed code names this bag: its full number in any
 * case, or the sticker of the donation it came from.
 */
export function bagMatchesCode(code: string | null | undefined, bagNumber: string | null | undefined): boolean {
  const wanted = normalizeBagCode(code)
  const bag = normalizeBagCode(bagNumber)

  if (!wanted || !bag) return false
  if (wanted === bag) return true

  return isSticker(wanted) && parseBagNumber(bag)?.sticker === wanted
}
