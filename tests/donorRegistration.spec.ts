import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  REGISTRATION_STEPS,
  adultBirthDateCutoff,
  checkRegistrationStep,
  emptyRegistrationForm,
  registrationPayload,
  stepPayload,
  useDonorRegistration,
  type DonorRegistrationForm,
} from '~/composables/useDonorRegistration'

/**
 * Donor registration in three steps (project owner, 2026-11-10): Continue
 * checks the step on screen only, Back keeps everything, and the account is
 * made by one request on the last step, with the valid ID required; its
 * photo is added later from the profile.
 */

const TODAY = new Date(2026, 10, 10) // 10 Nov 2026, local time

const ACCOUNT = { email: 'maria@example.com', password: 'Secret123', confirmPassword: 'Secret123' }
const PERSONAL = { firstName: 'Maria', lastName: 'Santos', dob: '1995-05-20', gender: 'female', bloodType: 'O+' }
const CONTACT = {
  phone: '+639171234567',
  address: 'Buhangin, Davao City, Davao del Sur',
  validIdType: 'philsys',
  validIdNumber: '1234567890123456',
  agreedToTerms: true,
}

function setup() {
  const register = vi.fn().mockResolvedValue({ message: 'Registered.' })
  const registration = useDonorRegistration({ register, today: () => TODAY })
  return { register, registration, form: registration.form }
}

function fill(form: DonorRegistrationForm, values: Partial<DonorRegistrationForm>) {
  Object.assign(form, values)
}

describe('the steps', () => {
  it('are Account, Personal details, then Contact and ID', async () => {
    expect(REGISTRATION_STEPS.map(entry => entry.title)).toEqual(['Account', 'Personal details', 'Contact and ID'])
  })

  it('start on step 1 with an empty form', async () => {
    const { registration } = setup()
    expect(registration.step.value).toBe(1)
    expect(registration.form).toEqual(emptyRegistrationForm())
  })
})

describe('Continue checks only the step on screen', () => {
  it('keeps an empty step 1 on screen, with its own fields marked and no others', async () => {
    const { registration } = setup()

    expect(await registration.next()).toBe(false)
    expect(registration.step.value).toBe(1)
    expect(Object.keys(registration.errors).sort()).toEqual(['email', 'password', 'password_confirmation'])
    expect(registration.firstInvalidInputId()).toBe('email')
  })

  it('asks for a real address and a password the server will take', async () => {
    const { registration, form } = setup()
    fill(form, { email: 'maria@example', password: 'secret12', confirmPassword: 'secret13' })

    await registration.next()

    expect(registration.errors.email).toBe('Please enter a valid email address.')
    expect(registration.errors.password).toBe('Use at least 8 characters, with upper and lower case letters and a number.')
    expect(registration.errors.password_confirmation).toBe('Password confirmation does not match.')
  })

  it('moves on from a complete step 1 without looking at the later steps', async () => {
    const { registration, form } = setup()
    fill(form, ACCOUNT)

    expect(await registration.next()).toBe(true)
    expect(registration.step.value).toBe(2)
    expect(registration.errors).toEqual({})
  })

  it('refuses someone under 18 on step 2', async () => {
    const { registration, form } = setup()
    fill(form, { ...ACCOUNT, ...PERSONAL, dob: '2008-11-11' })
    await registration.next()

    expect(await registration.next()).toBe(false)
    expect(registration.step.value).toBe(2)
    expect(registration.errors.birth_date).toBe('You must be at least 18 years old to register as a donor.')
    expect(registration.firstInvalidInputId()).toBe('dob')
  })

  it('takes someone who turns 18 today', async () => {
    expect(adultBirthDateCutoff(TODAY)).toBe('2008-11-10')
    expect(checkRegistrationStep(2, { ...emptyRegistrationForm(), ...PERSONAL, dob: '2008-11-10' }, TODAY)).toEqual({})
  })

  it('keeps "I don\'t know yet" as an answer for the blood type', () => {
    expect(checkRegistrationStep(2, { ...emptyRegistrationForm(), ...PERSONAL, bloodType: '' }, TODAY)).toEqual({})
  })

  it('needs the names and a gender on step 2', async () => {
    const problems = checkRegistrationStep(2, emptyRegistrationForm(), TODAY)
    expect(Object.keys(problems).sort()).toEqual(['birth_date', 'first_name', 'gender', 'last_name'])
  })

  it('clears a shown error as soon as the field is right, and stays quiet about fields not yet tried', async () => {
    const { registration, form } = setup()
    await registration.next()
    expect(registration.errors.email).toBeTruthy()

    form.email = 'maria@'
    expect(registration.errors.email).toBe('Please enter a valid email address.')

    form.email = 'maria@example.com'
    expect(registration.errors.email).toBeUndefined()

    // Re-checked when the password it must match changes, too.
    fill(form, { password: 'Secret123', confirmPassword: 'Secret123' })
    expect(registration.errors.password_confirmation).toBeUndefined()
  })
})

describe('the valid ID is required on step 3', () => {
  async function atStepThree(contact: Partial<DonorRegistrationForm>) {
    const setupResult = setup()
    fill(setupResult.form, { ...ACCOUNT, ...PERSONAL })
    await setupResult.registration.next()
    await setupResult.registration.next()
    fill(setupResult.form, { ...CONTACT, ...contact })
    return setupResult
  }

  it('needs both the type and the number', async () => {
    const { registration, register } = await atStepThree({ validIdType: '', validIdNumber: '' })

    expect(await registration.submit()).toBe(false)
    expect(registration.errors.valid_id_type).toBe('Please choose your valid ID.')
    expect(registration.errors.valid_id_number).toBe('Please enter the number on your ID.')
    expect(registration.firstInvalidInputId()).toBe('validIdType')
    expect(register).not.toHaveBeenCalled()
  })

  it('needs the number when only the type is chosen', async () => {
    const { registration, register } = await atStepThree({ validIdNumber: '' })

    expect(await registration.submit()).toBe(false)
    expect(Object.keys(registration.errors)).toEqual(['valid_id_number'])
    expect(register).not.toHaveBeenCalled()
  })

  it('checks the number against the chosen type', async () => {
    // Twelve digits is a UMID, not a PhilSys number.
    const { registration, register } = await atStepThree({ validIdType: 'philsys', validIdNumber: '123456789012' })

    expect(await registration.submit()).toBe(false)
    expect(registration.errors.valid_id_number).toBe('PhilSys number: 16 digits, e.g. 1234567890123456.')
    expect(register).not.toHaveBeenCalled()

    // The same number is right for a UMID.
    registration.form.validIdType = 'umid'
    expect(registration.errors.valid_id_number).toBeUndefined()
  })

  it('takes a number as printed for a type with no fixed numbering', async () => {
    const problems = checkRegistrationStep(3, { ...emptyRegistrationForm(), ...CONTACT, validIdType: 'postal_id', validIdNumber: 'PRN 100-1234-5678' }, TODAY)
    expect(problems).toEqual({})
  })

  it('needs a mobile number, an address and the terms', async () => {
    const problems = checkRegistrationStep(3, { ...emptyRegistrationForm(), validIdType: 'philsys', validIdNumber: '1234567890123456' }, TODAY)
    expect(Object.keys(problems).sort()).toEqual(['address', 'phone', 'terms_accepted'])

    expect(checkRegistrationStep(3, { ...emptyRegistrationForm(), ...CONTACT, phone: '+63821234567' }, TODAY).phone)
      .toBe('Please enter a valid Philippine mobile number.')
  })

  it('needs no ID photo', async () => {
    const { registration, register } = await atStepThree({})

    expect(await registration.submit()).toBe(true)
    expect(register).toHaveBeenCalledOnce()
  })
})

describe('Back keeps every value', () => {
  it('goes back without checking, and the values come back on every step', async () => {
    const { registration, form } = setup()

    fill(form, ACCOUNT)
    await registration.next()
    fill(form, PERSONAL)
    await registration.next()
    fill(form, { phone: '+639171234567', address: 'Buhangin', validIdType: 'umid' })

    // Step 3 is half done: Back still goes, and says nothing about it.
    expect(registration.back()).toBe(true)
    expect(registration.step.value).toBe(2)
    expect(registration.errors).toEqual({})
    expect(registration.back()).toBe(true)
    expect(registration.step.value).toBe(1)
    expect(registration.back()).toBe(false)

    expect(form).toMatchObject({ ...ACCOUNT, ...PERSONAL, phone: '+639171234567', address: 'Buhangin', validIdType: 'umid' })

    // And forward again without retyping anything.
    expect(await registration.next()).toBe(true)
    expect(await registration.next()).toBe(true)
    expect(registration.step.value).toBe(3)
    expect(form).toMatchObject({ ...ACCOUNT, ...PERSONAL, phone: '+639171234567', address: 'Buhangin', validIdType: 'umid' })
  })
})

describe('Create account', () => {
  async function complete() {
    const setupResult = setup()
    fill(setupResult.form, ACCOUNT)
    await setupResult.registration.next()
    fill(setupResult.form, PERSONAL)
    await setupResult.registration.next()
    fill(setupResult.form, CONTACT)
    return setupResult
  }

  it('sends nothing until the last step', async () => {
    const { register } = await complete()
    expect(register).not.toHaveBeenCalled()
  })

  it('sends every field once, in the body the one-page form sent', async () => {
    const { registration, register } = await complete()

    expect(await registration.submit()).toBe(true)

    expect(register).toHaveBeenCalledOnce()
    expect(register).toHaveBeenCalledWith({
      first_name: 'Maria',
      last_name: 'Santos',
      email: 'maria@example.com',
      phone: '+639171234567',
      blood_type: 'O+',
      gender: 'female',
      birth_date: '1995-05-20',
      address: 'Buhangin, Davao City, Davao del Sur',
      valid_id_type: 'philsys',
      valid_id_number: '1234567890123456',
      password: 'Secret123',
      password_confirmation: 'Secret123',
      terms_accepted: true,
    })
  })

  it('sends "I don\'t know yet" as a null blood type', async () => {
    const { registration, register, form } = await complete()
    form.bloodType = ''

    await registration.submit()

    expect(register.mock.calls[0]![0].blood_type).toBeNull()
  })

  it('sends once when pressed twice', async () => {
    const { registration, register } = await complete()

    await Promise.all([registration.submit(), registration.submit()])

    expect(register).toHaveBeenCalledOnce()
  })

  it('goes back to the step of a field the server refused, and shows its message there', async () => {
    const { registration, register, form } = await complete()
    register.mockRejectedValueOnce(Object.assign(new Error('This email address is already registered. (and 1 more error)'), {
      errors: {
        email: ['This email address is already registered.'],
        phone: ['This phone number is already registered.'],
      },
    }))

    expect(await registration.submit()).toBe(false)

    expect(registration.step.value).toBe(1)
    expect(registration.errors.email).toBe('This email address is already registered.')
    expect(registration.errors.phone).toBe('This phone number is already registered.')
    expect(registration.submitError.value).toBe('')
    expect(registration.firstInvalidInputId()).toBe('email')
    expect(form).toMatchObject({ ...ACCOUNT, ...PERSONAL, ...CONTACT })

    // A new address clears the server's word on the old one.
    form.email = 'maria.santos@example.com'
    expect(registration.errors.email).toBeUndefined()
  })

  it('says a refusal with no field on it above the buttons', async () => {
    const { registration, register } = await complete()
    register.mockRejectedValueOnce(new Error('Too Many Attempts.'))

    expect(await registration.submit()).toBe(false)

    expect(registration.step.value).toBe(3)
    expect(registration.submitError.value).toBe('Too Many Attempts.')
  })

  it('checks the earlier steps again before sending', async () => {
    const { registration, register, form } = await complete()
    form.email = ''

    expect(await registration.submit()).toBe(false)

    expect(registration.step.value).toBe(1)
    expect(register).not.toHaveBeenCalled()
  })

  it('payload maps the form one to one', async () => {
    expect(registrationPayload({ ...emptyRegistrationForm(), ...ACCOUNT, ...PERSONAL, ...CONTACT }).valid_id_number)
      .toBe('1234567890123456')
  })
})

describe('the page', () => {
  const page = readFileSync(
    path.join(fileURLToPath(new URL('..', import.meta.url)), 'app/pages/auth/donor/register.vue'),
    'utf8',
  )

  it('shows "Step X of 3" with Back and Continue', async () => {
    expect(page).toContain('Step {{ step }} of {{ REGISTRATION_STEPS.length }}')
    expect(page).toMatch(/@click="onBack"[\s\S]*?Back/)
    expect(page).toContain('Continue')
    expect(page).toContain("'Create account'")
  })

  it('marks nothing optional on step 3, offers no Skip, and asks for no ID photo (2026-11-11)', async () => {
    expect(page).not.toContain('class="au-optional"')
    expect(page).not.toMatch(/>\s*Skip\b/)
    expect(page).not.toMatch(/type="file"/)
    expect(page).toContain('You can add a photo of your ID later from your profile to finish setting up your account.')
  })

  it('keeps the email verification step after registering', async () => {
    expect(page).toContain('<EmailCodeStep v-if="registeredEmail"')
    expect(page).toContain('rememberPendingVerification(registeredEmail.value)')
  })
})

describe('Continue asks the server about the step (2026-11-11)', () => {
  function withCheck(check = vi.fn().mockResolvedValue(undefined)) {
    const register = vi.fn().mockResolvedValue({})
    const registration = useDonorRegistration({ register, checkStep: check, today: () => TODAY })
    return { registration, register, check, form: registration.form }
  }

  function taken(field: string, message: string) {
    return Object.assign(new Error(message), { errors: { [field]: [message] } })
  }

  it('says on step 1 that the address is already registered, and stays there', async () => {
    const { registration, form, check, register } = withCheck(
      vi.fn().mockRejectedValueOnce(taken('email', 'This email address is already registered.')),
    )
    fill(form, ACCOUNT)

    expect(await registration.next()).toBe(false)

    expect(registration.step.value).toBe(1)
    expect(registration.errors.email).toBe('This email address is already registered.')
    expect(registration.firstInvalidInputId()).toBe('email')
    expect(registration.submitError.value).toBe('')
    expect(check).toHaveBeenCalledWith(1, {
      email: 'maria@example.com',
      password: 'Secret123',
      password_confirmation: 'Secret123',
    })
    expect(register).not.toHaveBeenCalled()
  })

  it('sends only the step\'s own fields', async () => {
    const { registration, form, check } = withCheck()
    fill(form, { ...ACCOUNT, ...PERSONAL, ...CONTACT })

    await registration.next()
    await registration.next()

    expect(check).toHaveBeenNthCalledWith(2, 2, {
      first_name: 'Maria',
      last_name: 'Santos',
      birth_date: '1995-05-20',
      gender: 'female',
      blood_type: 'O+',
    })
  })

  it('does not ask while the step fails its own checks', async () => {
    const { registration, check } = withCheck()

    expect(await registration.next()).toBe(false)
    expect(check).not.toHaveBeenCalled()
  })

  it('moves on once a new address passes, and does not ask again for unchanged values', async () => {
    const { registration, form, check } = withCheck(
      vi.fn()
        .mockRejectedValueOnce(taken('email', 'This email address is already registered.'))
        .mockResolvedValue(undefined),
    )
    fill(form, ACCOUNT)
    await registration.next()

    form.email = 'maria.santos@example.com'
    expect(registration.errors.email).toBeUndefined()
    expect(await registration.next()).toBe(true)
    expect(registration.step.value).toBe(2)

    registration.back()
    expect(await registration.next()).toBe(true)
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('stays on the step when the server cannot be reached, and says so', async () => {
    const { registration, form } = withCheck(vi.fn().mockRejectedValueOnce(new Error('Network error.')))
    fill(form, ACCOUNT)

    expect(await registration.next()).toBe(false)
    expect(registration.step.value).toBe(1)
    expect(registration.submitError.value).toBe('Network error.')
  })

  it('shows it is checking, and ignores a second Continue meanwhile', async () => {
    let finish!: () => void
    const { registration, form, check } = withCheck(vi.fn(() => new Promise<void>((resolve) => { finish = resolve })))
    fill(form, ACCOUNT)

    const first = registration.next()
    expect(registration.checking.value).toBe(true)
    expect(await registration.next()).toBe(false)
    expect(registration.back()).toBe(false)

    finish()
    expect(await first).toBe(true)
    expect(registration.checking.value).toBe(false)
    expect(check).toHaveBeenCalledOnce()
  })

  it('maps the step payload from the same body Create account sends', () => {
    expect(stepPayload(2, { ...emptyRegistrationForm(), ...PERSONAL, bloodType: '' }).blood_type).toBeNull()
  })
})
