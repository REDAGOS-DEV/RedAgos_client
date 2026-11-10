import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  REGISTRATION_STEPS,
  adultBirthDateCutoff,
  checkRegistrationStep,
  emptyRegistrationForm,
  idPhotoProblem,
  registrationPayload,
  useDonorRegistration,
  type DonorRegistrationForm,
} from '~/composables/useDonorRegistration'

/**
 * Donor registration in three steps (project owner, 2026-11-10): Continue
 * checks the step on screen only, Back keeps everything, and the account is
 * made by one request on the last step, with the valid ID required and its
 * photo optional.
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

function file(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('the steps', () => {
  it('are Account, Personal details, then Contact and ID', () => {
    expect(REGISTRATION_STEPS.map(entry => entry.title)).toEqual(['Account', 'Personal details', 'Contact and ID'])
  })

  it('start on step 1 with an empty form', () => {
    const { registration } = setup()
    expect(registration.step.value).toBe(1)
    expect(registration.form).toEqual(emptyRegistrationForm())
  })
})

describe('Continue checks only the step on screen', () => {
  it('keeps an empty step 1 on screen, with its own fields marked and no others', () => {
    const { registration } = setup()

    expect(registration.next()).toBe(false)
    expect(registration.step.value).toBe(1)
    expect(Object.keys(registration.errors).sort()).toEqual(['email', 'password', 'password_confirmation'])
    expect(registration.firstInvalidInputId()).toBe('email')
  })

  it('asks for a real address and a password the server will take', () => {
    const { registration, form } = setup()
    fill(form, { email: 'maria@example', password: 'secret12', confirmPassword: 'secret13' })

    registration.next()

    expect(registration.errors.email).toBe('Please enter a valid email address.')
    expect(registration.errors.password).toBe('Use at least 8 characters, with upper and lower case letters and a number.')
    expect(registration.errors.password_confirmation).toBe('Password confirmation does not match.')
  })

  it('moves on from a complete step 1 without looking at the later steps', () => {
    const { registration, form } = setup()
    fill(form, ACCOUNT)

    expect(registration.next()).toBe(true)
    expect(registration.step.value).toBe(2)
    expect(registration.errors).toEqual({})
  })

  it('refuses someone under 18 on step 2', () => {
    const { registration, form } = setup()
    fill(form, { ...ACCOUNT, ...PERSONAL, dob: '2008-11-11' })
    registration.next()

    expect(registration.next()).toBe(false)
    expect(registration.step.value).toBe(2)
    expect(registration.errors.birth_date).toBe('You must be at least 18 years old to register as a donor.')
    expect(registration.firstInvalidInputId()).toBe('dob')
  })

  it('takes someone who turns 18 today', () => {
    expect(adultBirthDateCutoff(TODAY)).toBe('2008-11-10')
    expect(checkRegistrationStep(2, { ...emptyRegistrationForm(), ...PERSONAL, dob: '2008-11-10' }, TODAY)).toEqual({})
  })

  it('keeps "I don\'t know yet" as an answer for the blood type', () => {
    expect(checkRegistrationStep(2, { ...emptyRegistrationForm(), ...PERSONAL, bloodType: '' }, TODAY)).toEqual({})
  })

  it('needs the names and a gender on step 2', () => {
    const problems = checkRegistrationStep(2, emptyRegistrationForm(), TODAY)
    expect(Object.keys(problems).sort()).toEqual(['birth_date', 'first_name', 'gender', 'last_name'])
  })

  it('clears a shown error as soon as the field is right, and stays quiet about fields not yet tried', () => {
    const { registration, form } = setup()
    registration.next()
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
  function atStepThree(contact: Partial<DonorRegistrationForm>) {
    const setupResult = setup()
    fill(setupResult.form, { ...ACCOUNT, ...PERSONAL })
    setupResult.registration.next()
    setupResult.registration.next()
    fill(setupResult.form, { ...CONTACT, ...contact })
    return setupResult
  }

  it('needs both the type and the number', async () => {
    const { registration, register } = atStepThree({ validIdType: '', validIdNumber: '' })

    expect(await registration.submit()).toBe(false)
    expect(registration.errors.valid_id_type).toBe('Please choose your valid ID.')
    expect(registration.errors.valid_id_number).toBe('Please enter the number on your ID.')
    expect(registration.firstInvalidInputId()).toBe('validIdType')
    expect(register).not.toHaveBeenCalled()
  })

  it('needs the number when only the type is chosen', async () => {
    const { registration, register } = atStepThree({ validIdNumber: '' })

    expect(await registration.submit()).toBe(false)
    expect(Object.keys(registration.errors)).toEqual(['valid_id_number'])
    expect(register).not.toHaveBeenCalled()
  })

  it('checks the number against the chosen type', async () => {
    // Twelve digits is a UMID, not a PhilSys number.
    const { registration, register } = atStepThree({ validIdType: 'philsys', validIdNumber: '123456789012' })

    expect(await registration.submit()).toBe(false)
    expect(registration.errors.valid_id_number).toBe('PhilSys number: 16 digits, e.g. 1234567890123456.')
    expect(register).not.toHaveBeenCalled()

    // The same number is right for a UMID.
    registration.form.validIdType = 'umid'
    expect(registration.errors.valid_id_number).toBeUndefined()
  })

  it('takes a number as printed for a type with no fixed numbering', () => {
    const problems = checkRegistrationStep(3, { ...emptyRegistrationForm(), ...CONTACT, validIdType: 'postal_id', validIdNumber: 'PRN 100-1234-5678' }, TODAY)
    expect(problems).toEqual({})
  })

  it('needs a mobile number, an address and the terms', () => {
    const problems = checkRegistrationStep(3, { ...emptyRegistrationForm(), validIdType: 'philsys', validIdNumber: '1234567890123456' }, TODAY)
    expect(Object.keys(problems).sort()).toEqual(['address', 'phone', 'terms_accepted'])

    expect(checkRegistrationStep(3, { ...emptyRegistrationForm(), ...CONTACT, phone: '+63821234567' }, TODAY).phone)
      .toBe('Please enter a valid Philippine mobile number.')
  })

  it('does not need the ID photo', async () => {
    const { registration, register } = atStepThree({})

    expect(registration.idPhoto.value).toBeNull()
    expect(await registration.submit()).toBe(true)
    expect(register).toHaveBeenCalledOnce()
  })
})

describe('Back keeps every value', () => {
  it('goes back without checking, and the values come back on every step', () => {
    const { registration, form } = setup()

    fill(form, ACCOUNT)
    registration.next()
    fill(form, PERSONAL)
    registration.next()
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
    expect(registration.next()).toBe(true)
    expect(registration.next()).toBe(true)
    expect(registration.step.value).toBe(3)
    expect(form).toMatchObject({ ...ACCOUNT, ...PERSONAL, phone: '+639171234567', address: 'Buhangin', validIdType: 'umid' })
  })

  it('keeps a held ID photo across the steps', () => {
    const { registration, form } = setup()
    fill(form, { ...ACCOUNT, ...PERSONAL })
    registration.next()
    registration.next()
    const photo = file('id.jpg', 'image/jpeg', 2048)
    registration.chooseIdPhoto(photo)

    registration.back()
    registration.next()

    expect(registration.idPhoto.value).toBe(photo)
  })
})

describe('Create account', () => {
  function complete() {
    const setupResult = setup()
    fill(setupResult.form, ACCOUNT)
    setupResult.registration.next()
    fill(setupResult.form, PERSONAL)
    setupResult.registration.next()
    fill(setupResult.form, CONTACT)
    return setupResult
  }

  it('sends nothing until the last step', () => {
    const { register } = complete()
    expect(register).not.toHaveBeenCalled()
  })

  it('sends every field once, in the body the one-page form sent', async () => {
    const { registration, register } = complete()

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

  it('sends "I don\'t know yet" as a null blood type, and never the ID photo', async () => {
    const { registration, register, form } = complete()
    form.bloodType = ''
    registration.chooseIdPhoto(file('id.png', 'image/png', 1024))

    await registration.submit()

    const payload = register.mock.calls[0]![0]
    expect(payload.blood_type).toBeNull()
    expect(Object.keys(payload)).not.toContain('valid_id_image')
    expect(Object.values(payload).some(value => value instanceof Blob)).toBe(false)
  })

  it('sends once when pressed twice', async () => {
    const { registration, register } = complete()

    await Promise.all([registration.submit(), registration.submit()])

    expect(register).toHaveBeenCalledOnce()
  })

  it('goes back to the step of a field the server refused, and shows its message there', async () => {
    const { registration, register, form } = complete()
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
    const { registration, register } = complete()
    register.mockRejectedValueOnce(new Error('Too Many Attempts.'))

    expect(await registration.submit()).toBe(false)

    expect(registration.step.value).toBe(3)
    expect(registration.submitError.value).toBe('Too Many Attempts.')
  })

  it('checks the earlier steps again before sending', async () => {
    const { registration, register, form } = complete()
    form.email = ''

    expect(await registration.submit()).toBe(false)

    expect(registration.step.value).toBe(1)
    expect(register).not.toHaveBeenCalled()
  })

  it('payload maps the form one to one', () => {
    expect(registrationPayload({ ...emptyRegistrationForm(), ...ACCOUNT, ...PERSONAL, ...CONTACT }).valid_id_number)
      .toBe('1234567890123456')
  })
})

describe('the ID photo (optional)', () => {
  it.each([
    ['image/jpeg'],
    ['image/png'],
    ['image/webp'],
  ])('takes %s', (type) => {
    expect(idPhotoProblem({ type, size: 1024 })).toBe('')
  })

  it('refuses anything that is not an image, and an image over 4 MB', () => {
    expect(idPhotoProblem({ type: 'application/pdf', size: 1024 })).toBe('Choose a JPG, PNG or WEBP image.')
    expect(idPhotoProblem({ type: 'image/gif', size: 1024 })).toBe('Choose a JPG, PNG or WEBP image.')
    expect(idPhotoProblem({ type: 'image/jpeg', size: 4 * 1024 * 1024 })).toBe('')
    expect(idPhotoProblem({ type: 'image/jpeg', size: 4 * 1024 * 1024 + 1 })).toBe('Your ID photo must be 4 MB or smaller.')
  })

  it('keeps a refused file out and says why; Remove lets it go', () => {
    const { registration } = setup()

    expect(registration.chooseIdPhoto(file('id.pdf', 'application/pdf', 100))).toBe(false)
    expect(registration.idPhoto.value).toBeNull()
    expect(registration.idPhotoError.value).toBe('Choose a JPG, PNG or WEBP image.')

    const photo = file('id.jpg', 'image/jpeg', 100)
    expect(registration.chooseIdPhoto(photo)).toBe(true)
    expect(registration.idPhoto.value).toBe(photo)
    expect(registration.idPhotoError.value).toBe('')

    registration.removeIdPhoto()
    expect(registration.idPhoto.value).toBeNull()
  })

  it('goes up after sign-in through the profile upload, with the registered ID', async () => {
    const { registration, form } = setup()
    fill(form, CONTACT)
    const photo = file('id.jpg', 'image/jpeg', 100)
    registration.chooseIdPhoto(photo)
    const submitIdentity = vi.fn().mockResolvedValue({})

    expect(await registration.sendIdPhoto(submitIdentity)).toBe(true)

    const data: FormData = submitIdentity.mock.calls[0]![0]
    expect(data.get('valid_id_type')).toBe('philsys')
    expect(data.get('valid_id_number')).toBe('1234567890123456')
    expect((data.get('valid_id_image') as File).name).toBe('id.jpg')
  })

  it('sends nothing when no photo was chosen', async () => {
    const { registration } = setup()
    const submitIdentity = vi.fn()

    expect(await registration.sendIdPhoto(submitIdentity)).toBe(false)
    expect(submitIdentity).not.toHaveBeenCalled()
  })
})

describe('the page', () => {
  const page = readFileSync(
    path.join(fileURLToPath(new URL('..', import.meta.url)), 'app/pages/auth/donor/register.vue'),
    'utf8',
  )

  it('shows "Step X of 3" with Back and Continue', () => {
    expect(page).toContain('Step {{ step }} of {{ REGISTRATION_STEPS.length }}')
    expect(page).toMatch(/@click="onBack"[\s\S]*?Back/)
    expect(page).toContain('Continue')
    expect(page).toContain("'Create account'")
  })

  it('marks only the ID photo optional, and offers no Skip', () => {
    expect(page.match(/class="au-optional"/g)).toHaveLength(1)
    expect(page).toMatch(/ID photo <span class="au-optional">Optional<\/span>/)
    expect(page).not.toMatch(/>\s*Skip\b/)
  })

  it('takes image files only for the photo', () => {
    expect(page).toContain('accept="image/jpeg,image/png,image/webp"')
  })

  it('keeps the email verification step after registering', () => {
    expect(page).toContain('<EmailCodeStep v-if="registeredEmail"')
    expect(page).toContain('rememberPendingVerification(registeredEmail.value)')
  })
})
