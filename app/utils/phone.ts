/**
 * Phone numbers as the portal's phone field (components/common/PhoneField)
 * takes them.
 *
 * Every number is Philippine. The field sends E.164 (+639171234567), the form
 * users.phone stores and the server's AccountIdentity::normalizePhilippinePhone()
 * makes of a 09…, 63… or +63… number.
 *
 * The number after +63 has a real length, and the field stops there:
 *   mobile    10 digits, always 9 first   917 123 4567
 *   landline   9 digits: Metro Manila's 2 + 8, or a province's 2-digit area
 *              code + 7                    2 8123 4567 · 32 555 0101
 * Account phones are mobiles only; a few contact fields take a landline too.
 */

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2. */
  code: string
  name: string
  /** Country calling code, without the +. */
  dial: string
}

/** The countries the field offers. The server accepts Philippine numbers only. */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { code: 'PH', name: 'Philippines', dial: '63' },
]

export const MOBILE_DIGITS = 10
export const LANDLINE_DIGITS = 9

/**
 * The digits after +63, from whatever was typed, pasted or stored: drops the
 * spaces, dashes and brackets, a leading +63 or 63, and the 0 a local number
 * starts with. Not cut to length.
 */
export function nationalDigits(value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  let digits = text.replace(/\D/g, '')

  if (text.startsWith('+')) {
    if (digits.startsWith('63')) digits = digits.slice(2)
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1)
  } else if (digits.startsWith('63') && digits.length > LANDLINE_DIGITS + 1) {
    // 639171234567 or 63281234567: the country code without its +. Shorter
    // runs are left alone, as 63 is also Iligan's area code.
    digits = digits.slice(2)
  }

  return digits.replace(/^0+/, '')
}

/** How many digits the number may run to: a mobile's 10, a landline's 9. */
export function maxNationalDigits(digits: string, landline = false): number {
  if (!landline || digits === '' || digits.startsWith('9')) return MOBILE_DIGITS
  return LANDLINE_DIGITS
}

/** The national digits, cut to the length the number can really have. */
export function limitNationalDigits(digits: string, landline = false): string {
  return digits.slice(0, maxNationalDigits(digits, landline))
}

/**
 * Spaced as the number is read, also part-way through typing:
 * 9171234567 → "917 123 4567", 281234567 → "2 8123 4567",
 * 325550101 → "32 555 0101".
 */
export function groupNationalDigits(digits: string): string {
  const sizes = digits.startsWith('9') ? [3, 3, 4] : digits.startsWith('2') ? [1, 4, 4] : [2, 3, 4]
  const groups: string[] = []
  let at = 0
  for (const size of sizes) {
    if (at >= digits.length) break
    groups.push(digits.slice(at, at + size))
    at += size
  }
  if (at < digits.length) groups.push(digits.slice(at))
  return groups.join(' ')
}

/** "+63" and the national digits; empty for no number. */
export function toE164(digits: string, country: PhoneCountry = PHONE_COUNTRIES[0]!): string {
  return digits ? `+${country.dial}${digits}` : ''
}

/**
 * A stored number the local way, for reading:
 * +639171234567 → "0917 123 4567", +63281234567 → "(02) 8123 4567",
 * +63325550101 → "(032) 555 0101". Anything else comes back as it was.
 */
export function formatPhoneNumber(value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  if (!text) return ''

  const digits = nationalDigits(text)
  if (/^9\d{9}$/.test(digits)) return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  if (/^2\d{8}$/.test(digits)) return `(02) ${digits.slice(1, 5)} ${digits.slice(5)}`
  if (/^[3-8]\d{8}$/.test(digits)) return `(0${digits.slice(0, 2)}) ${digits.slice(2, 5)} ${digits.slice(5)}`
  return text
}
