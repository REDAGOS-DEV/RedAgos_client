import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  formatPhoneNumber,
  groupNationalDigits,
  limitNationalDigits,
  nationalDigits,
  toE164,
} from '~/utils/phone'

/**
 * One phone field everywhere (project owner, 2026-11-02): the flag and +63 on
 * the left, the number on the right, and no more digits than a Philippine
 * number has: 10 for a mobile, 9 for a landline.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

function vueFiles(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name)
    if (entry.isDirectory()) return vueFiles(relative)
    return entry.name.endsWith('.vue') ? [relative] : []
  })
}

// What the server takes for an account phone (RegisterDonorRequest and the rest).
const SERVER_MOBILE = /^(?:\+63|63|0)9\d{9}$/

describe('reading a number', () => {
  it('takes the digits after +63 however the number was written', () => {
    for (const written of ['09171234567', '0917 123 4567', '0917-123-4567', '+639171234567', '+63 917 123 4567', '639171234567', '9171234567']) {
      expect(nationalDigits(written)).toBe('9171234567')
    }
  })

  it('reads a landline with or without its 0', () => {
    expect(nationalDigits('(02) 8123 4567')).toBe('281234567')
    expect(nationalDigits('+63 2 8123 4567')).toBe('281234567')
    expect(nationalDigits('(082) 227-2731')).toBe('822272731')
  })

  it('keeps a short run that only starts like the country code', () => {
    // 63 is also an area code (Iligan), so 63… is stripped only at country-code length.
    expect(nationalDigits('632211234')).toBe('632211234')
    expect(nationalDigits('(063) 221 1234')).toBe('632211234')
  })

  it('reads nothing as nothing', () => {
    expect(nationalDigits('')).toBe('')
    expect(nationalDigits(null)).toBe('')
    expect(nationalDigits(undefined)).toBe('')
    expect(nationalDigits('+63')).toBe('')
  })
})

describe('the real length', () => {
  it('stops a mobile at 10 digits', () => {
    expect(limitNationalDigits('917123456789')).toBe('9171234567')
    expect(limitNationalDigits('917123456789', true)).toBe('9171234567')
  })

  it('stops a landline at 9 digits where one is taken', () => {
    expect(limitNationalDigits('2812345678', true)).toBe('281234567')
    expect(limitNationalDigits('8222727319', true)).toBe('822272731')
  })

  it('leaves a mobile-only field at 10, whatever the first digit', () => {
    expect(limitNationalDigits('2812345678')).toBe('2812345678')
  })
})

describe('spacing as it is read', () => {
  it('groups a mobile 3-3-4, also part-way through typing', () => {
    expect(groupNationalDigits('9171234567')).toBe('917 123 4567')
    expect(groupNationalDigits('917')).toBe('917')
    expect(groupNationalDigits('9171')).toBe('917 1')
    expect(groupNationalDigits('9171234')).toBe('917 123 4')
    expect(groupNationalDigits('')).toBe('')
  })

  it('groups Metro Manila 1-4-4 and a province 2-3-4', () => {
    expect(groupNationalDigits('281234567')).toBe('2 8123 4567')
    expect(groupNationalDigits('822272731')).toBe('82 227 2731')
  })
})

describe('what the field sends', () => {
  it('sends E.164, which the server takes for an account phone', () => {
    expect(toE164('9171234567')).toBe('+639171234567')
    expect(toE164('9171234567')).toMatch(SERVER_MOBILE)
    expect(toE164('')).toBe('')
  })
})

describe('reading a stored number back', () => {
  it('shows it the local way', () => {
    expect(formatPhoneNumber('+639171234567')).toBe('0917 123 4567')
    expect(formatPhoneNumber('+63281234567')).toBe('(02) 8123 4567')
    expect(formatPhoneNumber('+63822272731')).toBe('(082) 227 2731')
    expect(formatPhoneNumber('(082) 227-2731')).toBe('(082) 227 2731')
  })

  it('leaves anything else as it was written', () => {
    expect(formatPhoneNumber('local 204')).toBe('local 204')
    expect(formatPhoneNumber('8123-4567')).toBe('8123-4567')
    expect(formatPhoneNumber(null)).toBe('')
  })
})

describe('every phone text box is the phone field', () => {
  const PHONE_FIELDS: Record<string, number> = {
    'app/components/BloodCenter/QuickDonorForm.vue': 1,
    'app/components/BloodCenter/SupplyPlanDialog.vue': 1,
    'app/components/BloodCenter/WalkInRequestDialog.vue': 1,
    'app/pages/admin/facilities.vue': 2,
    'app/pages/auth/donor/register.vue': 1,
    'app/pages/blood-center/donors.vue': 1,
    'app/pages/blood-center/settings.vue': 1,
    'app/pages/blood-center/staff.vue': 1,
    'app/pages/drives/[token].vue': 3,
    'app/pages/donor/profile.vue': 3,
    'app/pages/hospital/settings.vue': 1,
    'app/pages/hospital/staff.vue': 1,
  }

  for (const [file, count] of Object.entries(PHONE_FIELDS)) {
    it(`${file} uses it`, () => {
      const text = source(file)
      expect(text.match(/<PhoneField\b/g) ?? []).toHaveLength(count)
      expect(text).toContain("import PhoneField from '~/components/common/PhoneField.vue'")
    })
  }

  it('leaves no plain tel input anywhere else', () => {
    const offenders = vueFiles('app')
      .filter(file => !file.endsWith(`${path.sep}PhoneField.vue`))
      .filter(file => /<input\b[^>]*(type="tel"|inputmode="tel")/.test(source(file)))
    expect(offenders).toEqual([])
  })

  it('takes a landline only on the contact numbers that may be one', () => {
    expect(source('app/components/BloodCenter/SupplyPlanDialog.vue')).toMatch(/<PhoneField[^>]*\blandline\b/)
    expect(source('app/components/BloodCenter/WalkInRequestDialog.vue')).toMatch(/<PhoneField[^>]*\blandline\b/)
    const profile = source('app/pages/donor/profile.vue')
    expect(profile).toMatch(/<PhoneField id="pf-tel"[^>]*\blandline\b/)
    expect(profile).toMatch(/<PhoneField id="pf-cp-number"[^>]*\blandline\b/)
    expect(profile).not.toMatch(/<PhoneField id="pf-mobile"[^>]*\blandline\b/)
  })
})
