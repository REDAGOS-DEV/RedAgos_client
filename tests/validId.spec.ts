import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  ID_NUMBER_FORMATS,
  VALID_ID_TYPE_OPTIONS,
  cleanIdNumber,
  formatIdNumber,
  idNumberProblem,
} from '~/utils/validId'

/**
 * Philippine ID numbers: checked against their type once the spaces and
 * hyphens are gone, hyphenated as the card prints them while typed, and kept
 * and sent as the number alone. The server checks the same shapes
 * (ValidIdType::numberPattern()).
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

describe('the shape each type is checked against', () => {
  const RIGHT: Array<[string, string]> = [
    ['philsys', '1234567890123456'],
    ['drivers_license', 'N0112123456'],
    ['tin', '123456789'],
    ['tin', '123456789000'],
    ['sss_id', '3412345678'],
    ['umid', '000312345678'],
    ['philhealth', '123456789012'],
    ['pagibig', '121234567890'],
    ['passport', 'P1234567A'],
  ]

  const WRONG: Array<[string, string]> = [
    ['philsys', '123456789012345'],
    ['drivers_license', '01121234567'],
    ['drivers_license', 'NO112123456'],
    ['tin', '1234567890'],
    ['sss_id', '34123456789'],
    ['umid', '00031234567'],
    ['philhealth', '1234567890123'],
    ['pagibig', '12123456789'],
    ['passport', 'EB1234567'],
    ['passport', 'P12345678'],
  ]

  it.each(RIGHT)('takes a %s number of the right shape', (type, number) => {
    expect(idNumberProblem(type, number)).toBe('')
  })

  it.each(WRONG)('refuses a %s number of another shape: %s', (type, number) => {
    expect(idNumberProblem(type, number)).not.toBe('')
  })

  it('strips spaces and hyphens, and reads small letters as capitals, before checking', () => {
    expect(idNumberProblem('philsys', '1234-5678-9012-3456')).toBe('')
    expect(idNumberProblem('philsys', ' 1234 5678 9012 3456 ')).toBe('')
    expect(idNumberProblem('drivers_license', 'n01-12-123456')).toBe('')
    expect(idNumberProblem('sss_id', '34-1234567-8')).toBe('')
  })

  it('says what the number is, with an example written without symbols', () => {
    expect(idNumberProblem('philsys', '1234')).toBe('PhilSys number: 16 digits, e.g. 1234567890123456.')
    expect(idNumberProblem('drivers_license', '0112123456')).toBe("Driver's license number: 1 letter and 10 digits, e.g. A1234567890.")
    expect(idNumberProblem('tin', '1234567890')).toBe('TIN: 9 or 12 digits, e.g. 123456789 or 123456789000.')
    expect(idNumberProblem('passport', 'P1234567')).toBe('Passport number: 1 letter, 7 digits and 1 letter, e.g. P1234567A.')

    for (const spec of Object.values(ID_NUMBER_FORMATS)) {
      for (const example of spec.examples) {
        expect(example).toMatch(/^[A-Z0-9]+$/)
        expect(spec.pattern.test(example)).toBe(true)
      }
    }
  })

  it('leaves a blank number to the form, and a type with no format alone', () => {
    expect(idNumberProblem('philsys', '')).toBe('')
    expect(idNumberProblem('philsys', ' - ')).toBe('')
    expect(idNumberProblem('postal_id', 'PRN 1001 4123 4567 P')).toBe('')
    expect(idNumberProblem('', 'anything')).toBe('')
    expect(idNumberProblem(null, 'anything')).toBe('')
  })
})

describe('what the field keeps', () => {
  it('keeps the number alone, whatever was pasted round it', () => {
    expect(cleanIdNumber('philsys', '1234-5678-9012-3456')).toBe('1234567890123456')
    expect(cleanIdNumber('philsys', 'PCN: 1234 5678 9012 3456')).toBe('1234567890123456')
    expect(cleanIdNumber('drivers_license', 'n01-12-123456')).toBe('N0112123456')
    expect(cleanIdNumber('passport', 'p1234567a')).toBe('P1234567A')
  })

  it('stops at the length the number has', () => {
    expect(cleanIdNumber('philsys', '12345678901234567890')).toBe('1234567890123456')
    expect(cleanIdNumber('sss_id', '34-1234567-89')).toBe('3412345678')
    expect(cleanIdNumber('tin', '123-456-789-0001')).toBe('123456789000')
  })

  it('keeps a type with no format as typed', () => {
    expect(cleanIdNumber('voters_id', '7501-0012A-B1234')).toBe('7501-0012A-B1234')
    expect(cleanIdNumber(null, 'PH-123')).toBe('PH-123')
  })
})

describe('the hyphens as the card prints them', () => {
  it('hyphenates each type to its mask', () => {
    expect(formatIdNumber('philsys', '1234567890123456')).toBe('1234-5678-9012-3456')
    expect(formatIdNumber('drivers_license', 'N0112123456')).toBe('N01-12-123456')
    expect(formatIdNumber('tin', '123456789000')).toBe('123-456-789-000')
    expect(formatIdNumber('sss_id', '3412345678')).toBe('34-1234567-8')
    expect(formatIdNumber('umid', '000312345678')).toBe('0003-1234567-8')
    expect(formatIdNumber('philhealth', '123456789012')).toBe('12-345678901-2')
    expect(formatIdNumber('pagibig', '121234567890')).toBe('1212-3456-7890')
    expect(formatIdNumber('passport', 'P1234567A')).toBe('P1234567A')
  })

  it('adds a hyphen only once the next group is started', () => {
    expect(formatIdNumber('philsys', '1234')).toBe('1234')
    expect(formatIdNumber('philsys', '12345')).toBe('1234-5')
    expect(formatIdNumber('tin', '123456789')).toBe('123-456-789')
    expect(formatIdNumber('sss_id', '')).toBe('')
  })

  it('every mask holds as many characters as the number', () => {
    for (const [type, spec] of Object.entries(ID_NUMBER_FORMATS)) {
      expect(formatIdNumber(type, cleanIdNumber(type, spec.mask.replace(/A/g, 'B').replace(/0/g, '1'))).length, type)
        .toBe(spec.mask.length)
    }
  })
})

describe('every typed ID number box is the ID number field', () => {
  const FIELDS = [
    'app/components/profile/IdentityVerification.vue',
    'app/pages/auth/donor/register.vue',
    'app/components/BloodCenter/WalkInRequestDialog.vue',
    'app/pages/blood-center/donors.vue',
  ]

  for (const file of FIELDS) {
    it(`${file} uses it, for the type picked beside it`, () => {
      const text = source(file)
      expect(text.match(/<IdNumberField\b/g) ?? []).toHaveLength(1)
      expect(text).toMatch(/<IdNumberField[^>]*:id-type="/)
      expect(text).toContain("import IdNumberField from '~/components/common/IdNumberField.vue'")
    })
  }

  it('picks the type in the field itself on Donor Management, as the phone field picks its country (project owner, 2026-11-03)', () => {
    const donors = source('app/pages/blood-center/donors.vue')
    expect(donors).toMatch(/<IdNumberField[^>]*v-model:id-type="form\.data\.valid_id_type"/)
    expect(donors).toMatch(/<IdNumberField[^>]*\btype-picker\b/)
  })

  it('offers one list of ID types, the server\'s', () => {
    expect(VALID_ID_TYPE_OPTIONS.map(option => option.value)).toEqual([
      'philsys', 'umid', 'drivers_license', 'passport', 'postal_id', 'prc_id', 'voters_id', 'sss_id', 'tin', 'philhealth', 'pagibig',
    ])
    expect(source('app/composables/useIdentityDocument.js')).toContain('idTypeOptions: VALID_ID_TYPE_OPTIONS')
    expect(source('app/pages/auth/donor/register.vue')).toContain('const validIdTypes = VALID_ID_TYPE_OPTIONS')
  })
})
