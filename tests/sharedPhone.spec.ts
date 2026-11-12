import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { blankDonorForm, donorFormFrom, editPayload, registerPayload } from '~/utils/donorRecords'

/**
 * A household's shared mobile number (project owner, 2026-11-12).
 *
 * In remote areas one phone serves the whole family. Wherever staff type a
 * donor's phone, Personal | Shared sits with it: a Shared number may repeat,
 * a Personal one already on file is said under the phone, and someone else's
 * Personal number is asked about before it is saved as Shared.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

describe('the donor form helpers', () => {
  it('start Personal', () => {
    expect(blankDonorForm().phone_shared).toBe(false)
  })

  it('send Personal or Shared with a phone, and never without one', () => {
    const base = { ...blankDonorForm(), first_name: 'Maria', last_name: 'Dela Cruz' }

    expect(registerPayload({ ...base, phone: '+639171234567', phone_shared: true })).toMatchObject({ phone: '+639171234567', phone_shared: true })
    expect(registerPayload({ ...base, phone: '+639171234567' })).toMatchObject({ phone_shared: false })
    expect(registerPayload({ ...base, phone_shared: true })).not.toHaveProperty('phone_shared')
  })

  it('send the confirmation only when staff gave it', () => {
    const form = { ...blankDonorForm(), first_name: 'Maria', phone: '+639171234567', phone_shared: true }

    expect(registerPayload(form)).not.toHaveProperty('confirm_shared_phone')
    expect(registerPayload(form, { confirmSharedPhone: true })).toMatchObject({ confirm_shared_phone: true })
  })

  it('read Shared from the record, only with a number', () => {
    expect(donorFormFrom({ phone: '+639171234567', phone_shared: true }).phone_shared).toBe(true)
    expect(donorFormFrom({ phone: null, phone_shared: true }).phone_shared).toBe(false)
    expect(donorFormFrom({ phone: '+639171234567' }).phone_shared).toBe(false)
  })

  it('send Shared in an edit only when it changed', () => {
    const original = donorFormFrom({ first_name: 'Maria', phone: '+639171234567', phone_shared: false })

    expect(editPayload({ ...original }, original)).toEqual({})
    expect(editPayload({ ...original, phone_shared: true }, original)).toEqual({ phone_shared: true })
    expect(editPayload({ ...original, phone_shared: true }, original, { confirmSharedPhone: true }))
      .toEqual({ phone_shared: true, confirm_shared_phone: true })
  })

  it('leave Shared to the server when the number is cleared', () => {
    const original = donorFormFrom({ first_name: 'Maria', phone: '+639171234567', phone_shared: true })

    expect(editPayload({ ...original, phone: '', phone_shared: false }, original)).toEqual({ phone: null })
  })

  it('send no confirmation with nothing to save', () => {
    const original = donorFormFrom({ first_name: 'Maria' })

    expect(editPayload({ ...original }, original, { confirmSharedPhone: true })).toEqual({})
  })
})

describe('the Personal | Shared control', () => {
  const toggle = read('app/components/common/PhoneKindToggle.vue')

  it('is a two-option radio group, Personal then Shared', () => {
    expect(toggle).toContain('role="radiogroup"')
    expect(toggle).toContain('role="radio"')
    expect(toggle).toContain("{ label: 'Personal', shared: false }")
    expect(toggle).toContain("{ label: 'Shared', shared: true }")
  })
})

describe('where staff type a donor phone', () => {
  const donors = read('app/pages/blood-center/donors.vue')
  const quick = read('app/components/BloodCenter/QuickDonorForm.vue')

  it('pairs the phone with Personal | Shared on Donor Management and the paper form', () => {
    expect(donors).toContain('<PhoneKindToggle v-model="form.data.phone_shared"')
    expect(quick).toContain('<PhoneKindToggle v-model="form.phone_shared"')
  })

  it('asks before saving someone else\'s Personal number as Shared, in the page', () => {
    for (const source of [donors, quick]) {
      expect(source).toContain("err?.data?.code === 'phone_personal_elsewhere'")
      expect(source).toContain('Save as Shared')
      expect(source).not.toMatch(/window\.confirm|\bconfirm\(/)
    }
    expect(donors).toContain("submitForm(null, { confirmSharedPhone: true })")
    expect(quick).toContain('@click="submit(undefined, true)"')
  })

  it('says a shared number is Shared on the list and the profile', () => {
    expect(donors).toContain('phoneShared: Boolean(row.phone && row.phone_shared)')
    expect(donors).toContain('<span v-if="donor.phone && donor.phoneShared" class="phone-shared">Shared</span>')
    expect(donors).toContain('<span v-if="profile.phone && profile.phoneShared" class="fact__sub">Shared</span>')
  })

  it('leaves the portal sign-up without the choice: a portal number is the donor\'s own', () => {
    expect(read('app/pages/auth/donor/register.vue')).not.toContain('PhoneKindToggle')
    expect(read('app/pages/donor/profile.vue')).not.toContain('PhoneKindToggle')
  })
})
