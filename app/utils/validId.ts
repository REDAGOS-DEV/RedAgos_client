/**
 * Government ID numbers as the portal's ID number field
 * (components/common/IdNumberField) takes them.
 *
 * The value kept and sent is the number alone, letters in capitals and no
 * spaces or hyphens: the form donor_profiles.valid_id_number stores and the
 * server's AccountIdentity::normalizeValidIdNumber() makes of what was typed.
 * The hyphens are the field's own, put in as the number is typed, where the
 * card prints them.
 *
 * The server checks the same shapes (ValidIdType::numberPattern()). An ID with
 * no format here (Postal, PRC, Voter's ID) takes the number as printed.
 */

/**
 * The ID types a donor or a watcher may present: the server's ValidIdType.
 * `short` is what the ID number field's own type picker shows, where the
 * number needs the room.
 */
export const VALID_ID_TYPE_OPTIONS: { value: string, label: string, short?: string }[] = [
  { value: 'philsys', label: 'PhilSys (National ID)', short: 'PhilSys' },
  { value: 'umid', label: 'UMID' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'passport', label: 'Passport' },
  { value: 'postal_id', label: 'Postal ID' },
  { value: 'prc_id', label: 'PRC ID' },
  { value: 'voters_id', label: "Voter's ID" },
  { value: 'sss_id', label: 'SSS ID' },
  { value: 'tin', label: 'TIN ID' },
  { value: 'philhealth', label: 'PhilHealth ID' },
  { value: 'pagibig', label: 'Pag-IBIG ID' },
]

export interface IdNumberFormat {
  /** What the number is called in the error: "PhilSys number". */
  name: string
  /** The number as the card prints it, 0 a digit and A a letter; also the placeholder. */
  mask: string
  pattern: RegExp
  /** What the number is: "16 digits". */
  rule: string
  /** Numbers of the right shape, written without symbols. */
  examples: readonly string[]
  /** Whether it holds letters as well as digits. */
  letters: boolean
  /** The longest it runs to. */
  length: number
}

function format(spec: Omit<IdNumberFormat, 'letters' | 'length'>): IdNumberFormat {
  return { ...spec, letters: spec.mask.includes('A'), length: spec.mask.replace(/-/g, '').length }
}

export const ID_NUMBER_FORMATS: Readonly<Record<string, IdNumberFormat>> = {
  philsys: format({ name: 'PhilSys number', mask: '0000-0000-0000-0000', pattern: /^\d{16}$/, rule: '16 digits', examples: ['1234567890123456'] }),
  drivers_license: format({ name: "Driver's license number", mask: 'A00-00-000000', pattern: /^[A-Z]\d{10}$/, rule: '1 letter and 10 digits', examples: ['A1234567890'] }),
  tin: format({ name: 'TIN', mask: '000-000-000-000', pattern: /^\d{9}(\d{3})?$/, rule: '9 or 12 digits', examples: ['123456789', '123456789000'] }),
  sss_id: format({ name: 'SSS number', mask: '00-0000000-0', pattern: /^\d{10}$/, rule: '10 digits', examples: ['1234567890'] }),
  umid: format({ name: 'UMID number (CRN)', mask: '0000-0000000-0', pattern: /^\d{12}$/, rule: '12 digits', examples: ['123456789012'] }),
  philhealth: format({ name: 'PhilHealth number', mask: '00-000000000-0', pattern: /^\d{12}$/, rule: '12 digits', examples: ['123456789012'] }),
  pagibig: format({ name: 'Pag-IBIG number', mask: '0000-0000-0000', pattern: /^\d{12}$/, rule: '12 digits', examples: ['123456789012'] }),
  passport: format({ name: 'Passport number', mask: 'A0000000A', pattern: /^[A-Z]\d{7}[A-Z]$/, rule: '1 letter, 7 digits and 1 letter', examples: ['P1234567A'] }),
}

/** The format of an ID type's number, or null for a type with none here. */
export function idNumberFormat(type: string | null | undefined): IdNumberFormat | null {
  return (type && ID_NUMBER_FORMATS[type]) || null
}

/** Spaces and hyphens out, letters in capitals: the number as it is checked. */
export function stripIdNumber(value: string | null | undefined): string {
  return String(value ?? '').replace(/[\s-]+/g, '').toUpperCase()
}

/**
 * What the field keeps of whatever was typed or pasted: the characters the
 * type's number holds, no more of them than it has. A type with no format
 * keeps the text as typed.
 */
export function cleanIdNumber(type: string | null | undefined, value: string | null | undefined): string {
  const spec = idNumberFormat(type)
  if (!spec) return String(value ?? '')

  return stripIdNumber(value)
    .replace(spec.letters ? /[^A-Z0-9]/g : /\D/g, '')
    .slice(0, spec.length)
}

/**
 * Hyphenated where the card prints it, also part-way through typing:
 * 1234567890123456 → "1234-5678-9012-3456", 12345 → "1234-5".
 * A type with no format comes back as it was.
 */
export function formatIdNumber(type: string | null | undefined, value: string | null | undefined): string {
  const spec = idNumberFormat(type)
  if (!spec) return String(value ?? '')

  const number = cleanIdNumber(type, value)
  const groups: string[] = []
  let at = 0
  for (const group of spec.mask.split('-')) {
    if (at >= number.length) break
    groups.push(number.slice(at, at + group.length))
    at += group.length
  }
  return groups.join('-')
}

/**
 * Why the number does not fit its type, with an example — "PhilSys number:
 * 16 digits, e.g. 1234567890123456." — or '' when it does, when it is blank
 * (the form says whether one is needed) or when its type has no format.
 * Spaces and hyphens are dropped first, so a pasted "1234-5678-…" is fine.
 */
export function idNumberProblem(type: string | null | undefined, value: string | null | undefined): string {
  const spec = idNumberFormat(type)
  const number = stripIdNumber(value)
  if (!spec || !number || spec.pattern.test(number)) return ''

  return `${spec.name}: ${spec.rule}, e.g. ${spec.examples.join(' or ')}.`
}
