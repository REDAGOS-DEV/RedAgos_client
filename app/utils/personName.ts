/**
 * What a person's name may hold — the server's App\Rules\PersonName, kept in
 * step: letters (with their accents), spaces, hyphens, apostrophes and periods,
 * so "Ma. Luisa", "Dela Cruz", "Santos-Reyes" and "O'Brien" type as they are.
 *
 * Variation selectors are marks too, but only ever restyle an emoji; without
 * them in the set, stripping "Ma❤️ria" would leave an invisible character in
 * the name. Both apostrophes, because a phone keyboard types the curly one.
 */
const NOT_IN_A_NAME = /[^\p{L}\p{Mn}\p{Mc}'’. -]|[︀-️\u{E0100}-\u{E01EF}]/gu

/** The name with every emoji, digit and other symbol taken out. */
export function cleanPersonName(value: string): string {
  return value.replace(NOT_IN_A_NAME, '')
}

/**
 * The input's value cleaned, and where the caret goes so it stays after the
 * same letter rather than jumping to the end. Null when there is nothing to do.
 */
export function cleanedNameInput(value: string, caret: number | null): { value: string, caret: number } | null {
  const cleaned = cleanPersonName(value)
  if (cleaned === value) return null

  return {
    value: cleaned,
    caret: caret === null ? cleaned.length : cleanPersonName(value.slice(0, caret)).length,
  }
}
