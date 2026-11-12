/**
 * An input that holds digits and nothing else: a donation barcode sticker
 * (project owner, 2026-11-11). Letters, spaces, dashes and symbols never
 * appear; the server refuses them too (RecordCollectionRequest).
 */
const NOT_A_DIGIT = /\D/g

/** The value with everything but 0–9 taken out. */
export function cleanDigits(value: string): string {
  return value.replace(NOT_A_DIGIT, '')
}

/**
 * The input's value cleaned, and where the caret goes so it stays after the
 * same digit rather than jumping to the end. Null when there is nothing to do.
 */
export function cleanedDigitsInput(value: string, caret: number | null): { value: string, caret: number } | null {
  const cleaned = cleanDigits(value)
  if (cleaned === value) return null

  return {
    value: cleaned,
    caret: caret === null ? cleaned.length : cleanDigits(value.slice(0, caret)).length,
  }
}
