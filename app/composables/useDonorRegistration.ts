import { computed, reactive, ref, watch } from 'vue'
import { VALID_ID_TYPE_OPTIONS, idNumberProblem, stripIdNumber } from '~/utils/validId'

/**
 * Donor registration as three steps (project owner, 2026-11-10):
 *
 *   1  Account            email, password, confirm password
 *   2  Personal details   names, birth date, gender, blood type
 *   3  Contact and ID     phone, address, valid ID (required), ID photo
 *                         (optional), terms, Create account
 *
 * Continue checks only the step on screen; Back checks nothing. Every value
 * lives in one form for the whole visit, so moving between the steps loses
 * nothing. Nothing reaches the server until Create account on step 3, and then
 * as one request with the same body as the one-page form sent, so no partial
 * account is ever made.
 *
 * The checks mirror the server's RegisterDonorRequest and use its messages.
 * The server still decides: whatever it refuses is shown on the field it names,
 * on that field's step.
 *
 * The ID photo is not part of the registration request, which takes JSON and
 * no file. It is held here and sent through the profile's own upload
 * (POST /donors/identity) once the new donor first signs in.
 */

export type RegistrationStep = 1 | 2 | 3

export const REGISTRATION_STEPS: readonly { step: RegistrationStep, title: string }[] = [
  { step: 1, title: 'Account' },
  { step: 2, title: 'Personal details' },
  { step: 3, title: 'Contact and ID' },
]

export const LAST_STEP: RegistrationStep = 3

export interface DonorRegistrationForm {
  email: string
  password: string
  confirmPassword: string
  firstName: string
  lastName: string
  /** 'YYYY-MM-DD', as the date picker gives it. */
  dob: string
  gender: string
  /** '' is "I don't know yet", sent as null. */
  bloodType: string
  /** E.164 (+639171234567), as the phone field gives it. */
  phone: string
  address: string
  validIdType: string
  /** The number alone, as the ID number field gives it. */
  validIdNumber: string
  agreedToTerms: boolean
}

/** The request body, unchanged from the one-page form. */
export interface DonorRegistrationPayload {
  first_name: string
  last_name: string
  email: string
  phone: string
  blood_type: string | null
  gender: string
  birth_date: string
  address: string
  valid_id_type: string | null
  valid_id_number: string | null
  password: string
  password_confirmation: string
  terms_accepted: boolean
}

/** Errors are kept under the server's field names, so its 422 lands on the same fields. */
export type RegistrationField =
  | 'email' | 'password' | 'password_confirmation'
  | 'first_name' | 'last_name' | 'birth_date' | 'gender' | 'blood_type'
  | 'phone' | 'address' | 'valid_id_type' | 'valid_id_number' | 'terms_accepted'

export const REGISTRATION_GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

/** "I don't know yet" is the empty value: it is sent as null. */
export const BLOOD_TYPE_OPTIONS: { value: string, label: string }[] = [
  { value: '', label: "I don't know yet" },
  ...BLOOD_TYPES.map(type => ({ value: type, label: type })),
]

/** RegisterDonorRequest::MINIMUM_AGE_YEARS. */
export const MINIMUM_AGE_YEARS = 18

// RegisterDonorRequest's phone rule; the phone field gives +63 numbers.
const MOBILE_PATTERN = /^(?:\+63|63|0)9\d{9}$/
// Stricter than the server's email:rfc (which takes "name@host"), so a missing
// ".com" is caught here rather than in a verification code that never arrives.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function emptyRegistrationForm(): DonorRegistrationForm {
  return {
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    dob: '',
    gender: '',
    bloodType: '',
    phone: '',
    address: '',
    validIdType: '',
    validIdNumber: '',
    agreedToTerms: false,
  }
}

/** The latest birth date that is 18 today, 'YYYY-MM-DD' in local time. */
export function adultBirthDateCutoff(today: Date): string {
  const cutoff = new Date(today.getFullYear() - MINIMUM_AGE_YEARS, today.getMonth(), today.getDate())
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`
}

function realDate(iso: string): boolean {
  const match = iso.match(ISO_DATE)
  if (!match) return false
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

/** What Password::min(8)->mixedCase()->numbers() asks for. */
export function passwordProblem(password: string): string {
  if (!password) return 'Password is required.'
  const strong = password.length >= 8
    && /\p{Lu}/u.test(password)
    && /\p{Ll}/u.test(password)
    && /\p{N}/u.test(password)
  return strong ? '' : 'Use at least 8 characters, with upper and lower case letters and a number.'
}

interface FieldRule {
  step: RegistrationStep
  /** The control a failed check focuses (its id). */
  inputId: string
  /** The form values the check reads: a change to any re-checks a shown error. */
  reads: (keyof DonorRegistrationForm)[]
  check: (form: DonorRegistrationForm, today: Date) => string
}

/** In the order the fields stand on their steps: the first failing one is focused. */
export const REGISTRATION_RULES: Readonly<Record<RegistrationField, FieldRule>> = {
  // ── 1 Account ──
  email: {
    step: 1,
    inputId: 'email',
    reads: ['email'],
    check: ({ email }) => {
      const value = email.trim()
      if (!value) return 'Email address is required.'
      if (!EMAIL_PATTERN.test(value)) return 'Please enter a valid email address.'
      if (value.length > 150) return 'Email address must not be greater than 150 characters.'
      return ''
    },
  },
  password: {
    step: 1,
    inputId: 'password',
    reads: ['password'],
    check: ({ password }) => passwordProblem(password),
  },
  password_confirmation: {
    step: 1,
    inputId: 'confirmPassword',
    reads: ['confirmPassword', 'password'],
    check: ({ password, confirmPassword }) => {
      if (!confirmPassword) return 'Please re-enter your password.'
      return confirmPassword === password ? '' : 'Password confirmation does not match.'
    },
  },

  // ── 2 Personal details ──
  first_name: {
    step: 2,
    inputId: 'firstName',
    reads: ['firstName'],
    check: ({ firstName }) => {
      if (!firstName.trim()) return 'First name is required.'
      return firstName.trim().length > 150 ? 'First name must not be greater than 150 characters.' : ''
    },
  },
  last_name: {
    step: 2,
    inputId: 'lastName',
    reads: ['lastName'],
    check: ({ lastName }) => {
      if (!lastName.trim()) return 'Last name is required.'
      return lastName.trim().length > 150 ? 'Last name must not be greater than 150 characters.' : ''
    },
  },
  birth_date: {
    step: 2,
    inputId: 'dob',
    reads: ['dob'],
    check: ({ dob }, today) => {
      if (!dob) return 'Date of birth is required.'
      if (!realDate(dob)) return 'Please enter a valid date of birth.'
      return dob > adultBirthDateCutoff(today)
        ? `You must be at least ${MINIMUM_AGE_YEARS} years old to register as a donor.`
        : ''
    },
  },
  gender: {
    step: 2,
    inputId: 'gender',
    reads: ['gender'],
    check: ({ gender }) => {
      if (!gender) return 'Gender is required.'
      return REGISTRATION_GENDERS.some(option => option.value === gender) ? '' : 'Please select a valid gender.'
    },
  },
  blood_type: {
    step: 2,
    inputId: 'bloodType',
    reads: ['bloodType'],
    // Optional: "I don't know yet" is a real answer.
    check: ({ bloodType }) =>
      !bloodType || (BLOOD_TYPES as readonly string[]).includes(bloodType) ? '' : 'Please select a valid blood type.',
  },

  // ── 3 Contact and ID ──
  phone: {
    step: 3,
    inputId: 'phone',
    reads: ['phone'],
    check: ({ phone }) => {
      if (!phone) return 'Phone number is required.'
      return MOBILE_PATTERN.test(phone) ? '' : 'Please enter a valid Philippine mobile number.'
    },
  },
  address: {
    step: 3,
    inputId: 'address',
    reads: ['address'],
    check: ({ address }) => {
      if (!address.trim()) return 'Address is required.'
      return address.trim().length > 255 ? 'Address must not be greater than 255 characters.' : ''
    },
  },
  valid_id_type: {
    step: 3,
    inputId: 'validIdType',
    reads: ['validIdType'],
    check: ({ validIdType }) => {
      if (!validIdType) return 'Please choose your valid ID.'
      return VALID_ID_TYPE_OPTIONS.some(option => option.value === validIdType) ? '' : 'Please select a valid ID type.'
    },
  },
  valid_id_number: {
    step: 3,
    inputId: 'validIdNumber',
    reads: ['validIdNumber', 'validIdType'],
    check: ({ validIdType, validIdNumber }) => {
      const number = stripIdNumber(validIdNumber)
      if (!number) return 'Please enter the number on your ID.'
      if (number.length > 50) return 'The ID number must not be greater than 50 characters.'
      return idNumberProblem(validIdType, validIdNumber)
    },
  },
  terms_accepted: {
    step: 3,
    inputId: 'terms',
    reads: ['agreedToTerms'],
    check: ({ agreedToTerms }) =>
      agreedToTerms ? '' : 'You must agree to the Terms of Service and Privacy Policy.',
  },
}

const FIELDS = Object.keys(REGISTRATION_RULES) as RegistrationField[]

export function fieldsOfStep(step: RegistrationStep): RegistrationField[] {
  return FIELDS.filter(field => REGISTRATION_RULES[field].step === step)
}

/** The problems on one step, by field; empty when it may be left. */
export function checkRegistrationStep(
  step: RegistrationStep,
  form: DonorRegistrationForm,
  today: Date = new Date(),
): Partial<Record<RegistrationField, string>> {
  const problems: Partial<Record<RegistrationField, string>> = {}
  for (const field of fieldsOfStep(step)) {
    const problem = REGISTRATION_RULES[field].check(form, today)
    if (problem) problems[field] = problem
  }
  return problems
}

/** The one request Create account sends: the same body as the one-page form. */
export function registrationPayload(form: DonorRegistrationForm): DonorRegistrationPayload {
  return {
    first_name: form.firstName,
    last_name: form.lastName,
    email: form.email,
    phone: form.phone,
    // An unanswered blood type is sent as null, not '', so the server stores
    // "not known" rather than being handed something to look up.
    blood_type: form.bloodType || null,
    gender: form.gender,
    birth_date: form.dob,
    address: form.address,
    valid_id_type: form.validIdType || null,
    valid_id_number: form.validIdNumber || null,
    password: form.password,
    password_confirmation: form.confirmPassword,
    terms_accepted: form.agreedToTerms,
  }
}

/* ── The ID photo ─────────────────────────────────────────────── */

// StoreDonorIdentityRequest: jpg, png or webp, 4096 KB at most.
export const ID_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ID_PHOTO_MAX_BYTES = 4 * 1024 * 1024

/** Why a chosen file cannot be the ID photo, or '' when it can. */
export function idPhotoProblem(file: { type: string, size: number }): string {
  if (!(ID_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return 'Choose a JPG, PNG or WEBP image.'
  }
  return file.size > ID_PHOTO_MAX_BYTES ? 'Your ID photo must be 4 MB or smaller.' : ''
}

/** The multipart body POST /donors/identity takes: the registered ID and its photo. */
export function idPhotoSubmission(form: Pick<DonorRegistrationForm, 'validIdType' | 'validIdNumber'>, photo: Blob): FormData {
  const data = new FormData()
  data.append('valid_id_type', form.validIdType)
  data.append('valid_id_number', form.validIdNumber)
  data.append('valid_id_image', photo)
  return data
}

/* ── The form ─────────────────────────────────────────────────── */

export interface UseDonorRegistrationOptions {
  /** Sends the registration: donorService.register. */
  register: (payload: DonorRegistrationPayload) => Promise<unknown>
  /** Today, for the age check. */
  today?: () => Date
}

export function useDonorRegistration({ register, today = () => new Date() }: UseDonorRegistrationOptions) {
  const form = reactive(emptyRegistrationForm())
  const step = ref<RegistrationStep>(1)
  const errors = reactive<Partial<Record<RegistrationField, string>>>({})
  const submitting = ref(false)
  // A refusal that names no field: the network, the rate limit, the server.
  const submitError = ref('')

  const idPhoto = ref<File | null>(null)
  const idPhotoError = ref('')

  const currentStep = computed(() => REGISTRATION_STEPS[step.value - 1]!)
  const isLastStep = computed(() => step.value === LAST_STEP)

  function setError(field: RegistrationField, message: string) {
    if (message) errors[field] = message
    else delete errors[field]
  }

  // A shown error follows the field as it is corrected, and goes once it is
  // right. A field with no error stays quiet until the next Continue, so
  // nobody is told off halfway through typing an address.
  for (const field of FIELDS) {
    const rule = REGISTRATION_RULES[field]
    watch(
      () => rule.reads.map(key => form[key]),
      () => { if (errors[field]) setError(field, rule.check(form, today())) },
      { flush: 'sync' },
    )
  }

  /** Checks one step and shows what it found. */
  function validateStep(target: RegistrationStep): boolean {
    const problems = checkRegistrationStep(target, form, today())
    for (const field of fieldsOfStep(target)) setError(field, problems[field] ?? '')
    return Object.keys(problems).length === 0
  }

  /** The control to focus for the first problem on a step, if it has one. */
  function firstInvalidInputId(target: RegistrationStep = step.value): string | null {
    const field = fieldsOfStep(target).find(name => errors[name])
    return field ? REGISTRATION_RULES[field].inputId : null
  }

  /** Continue: on to the next step if this one is complete. */
  function next(): boolean {
    if (isLastStep.value || submitting.value) return false
    submitError.value = ''
    if (!validateStep(step.value)) return false
    step.value = (step.value + 1) as RegistrationStep
    return true
  }

  /** Back: no checks, and every value stays as it was. */
  function back(): boolean {
    if (step.value === 1 || submitting.value) return false
    submitError.value = ''
    step.value = (step.value - 1) as RegistrationStep
    return true
  }

  /**
   * Shows the server's refusal on its fields. Returns whether any field took
   * one; the step moves to the first that did.
   */
  function applyServerErrors(error: any): boolean {
    const reported = error?.errors
    if (!reported || typeof reported !== 'object') return false

    let earliest: RegistrationStep | null = null
    for (const [field, messages] of Object.entries(reported)) {
      if (!(field in REGISTRATION_RULES)) continue
      const message = Array.isArray(messages) ? String(messages[0] ?? '') : String(messages)
      if (!message) continue
      setError(field as RegistrationField, message)
      const at = REGISTRATION_RULES[field as RegistrationField].step
      earliest = earliest === null ? at : (Math.min(earliest, at) as RegistrationStep)
    }

    if (earliest === null) return false
    step.value = earliest
    return true
  }

  /**
   * Create account: every step is checked again, then the one request. Comes
   * back true once the account exists and the code step can follow.
   */
  async function submit(): Promise<boolean> {
    if (submitting.value) return false
    submitError.value = ''

    for (const target of REGISTRATION_STEPS.map(entry => entry.step)) {
      if (!validateStep(target)) {
        step.value = target
        return false
      }
    }

    submitting.value = true
    try {
      await register(registrationPayload(form))
      return true
    } catch (error: any) {
      if (!applyServerErrors(error)) {
        submitError.value = error?.message || 'Something went wrong while creating your account. Please try again.'
      }
      return false
    } finally {
      submitting.value = false
    }
  }

  /** Takes a picked file as the ID photo, or says why it cannot be. */
  function chooseIdPhoto(file: File | null | undefined): boolean {
    if (!file) return false
    const problem = idPhotoProblem(file)
    idPhotoError.value = problem
    if (problem) return false
    idPhoto.value = file
    return true
  }

  function removeIdPhoto() {
    idPhoto.value = null
    idPhotoError.value = ''
  }

  /**
   * Sends the held photo with the registered ID through the profile's upload,
   * once signed in. Nothing to send is not a failure.
   */
  async function sendIdPhoto(submitIdentity: (data: FormData) => Promise<unknown>): Promise<boolean> {
    if (!idPhoto.value) return false
    await submitIdentity(idPhotoSubmission(form, idPhoto.value))
    idPhoto.value = null
    return true
  }

  return {
    form,
    step,
    currentStep,
    isLastStep,
    errors,
    submitting,
    submitError,
    idPhoto,
    idPhotoError,
    validateStep,
    firstInvalidInputId,
    next,
    back,
    submit,
    chooseIdPhoto,
    removeIdPhoto,
    sendIdPhoto,
  }
}
