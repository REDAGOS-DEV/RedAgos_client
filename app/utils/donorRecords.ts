/**
 * Shaping helpers for the Donors page (blood-center/donors.vue).
 *
 * Kept apart from the page so they can be tested without rendering it. Who is
 * eligible, deferred or inactive is the server's call (DonorStanding); these
 * only decide how that is shown and what a form sends back.
 */

/** The blood groups in the order the filter lists them. */
export const BLOOD_GROUP_ORDER = ['A-', 'A+', 'B-', 'B+', 'AB-', 'AB+', 'O-', 'O+']

/** Blood groups in filter order, unknown codes last. */
export function orderBloodGroups<T extends { code: string }>(types: T[]): T[] {
  const rank = (code: string) => {
    const index = BLOOD_GROUP_ORDER.indexOf(code)
    return index === -1 ? BLOOD_GROUP_ORDER.length : index
  }

  return [...types].sort((a, b) => rank(a.code) - rank(b.code))
}

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const

export function genderLabel(value: string | null | undefined): string {
  return GENDER_OPTIONS.find((g) => g.value === value)?.label ?? ''
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const text = String(value)
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** 2026-07-28 → 28-Jul-2026, the format the list and profile read in. */
export function formatShortDate(value: string | null | undefined): string {
  const d = toDate(value)
  if (!d) return ''
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`
}

/** Whole years between a birth date and today, or null without one. */
export function ageFrom(birthDate: string | null | undefined, today: Date = new Date()): number | null {
  const b = toDate(birthDate)
  if (!b) return null
  let age = today.getFullYear() - b.getFullYear()
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age -= 1
  return age
}

/** "Male · 28y", whatever of the two is known. */
export function donorSubline(gender: string | null | undefined, birthDate: string | null | undefined, today?: Date): string {
  const age = ageFrom(birthDate, today)
  return [genderLabel(gender), age === null ? '' : `${age}y`].filter(Boolean).join(' · ')
}

/**
 * +639171234567 → 0917 123 4567, the way staff read a number aloud.
 * Anything else is shown as stored.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const m = /^\+63(9\d{2})(\d{3})(\d{4})$/.exec(phone)
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : phone
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

/**
 * The donor's recognition tier, from how many times they have given.
 *
 * Not a clinical or a server value: a thank-you on the badge. The cut-offs are
 * the page's own until the centre asks for others.
 */
export const DONOR_TIERS = [
  { min: 25, key: 'platinum', label: 'Platinum' },
  { min: 10, key: 'gold', label: 'Gold' },
  { min: 5, key: 'silver', label: 'Silver' },
  { min: 1, key: 'bronze', label: 'Bronze' },
] as const

export function donorTier(totalDonations: number | null | undefined): { key: string, label: string } | null {
  const total = Number(totalDonations) || 0
  const tier = DONOR_TIERS.find((t) => total >= t.min)
  return tier ? { key: tier.key, label: tier.label } : null
}

export type DonorBadgeTone = 'ok' | 'info' | 'warn' | 'crit' | 'neutral'

interface StandingLike {
  eligibility?: string | null
  next_eligible_date?: string | null
  deferral?: { kind?: string | null, outcome_label?: string | null, recorded_on?: string | null } | null
}

const DEFERRAL_HINT: Record<string, string> = {
  permanent: 'Permanently deferred',
  indefinite: 'Indefinite deferral',
  temporary: 'Temporarily deferred until screened again',
}

/**
 * The eligibility badge: Eligible, From 26-Oct-2026, or Deferred.
 *
 * A temporary deferral reads amber like a waiting period; one with no end
 * reads red. The contact list is told only that the donor is deferred.
 */
export function eligibilityBadge(row: StandingLike): { key: string, label: string, tone: DonorBadgeTone, hint: string } {
  if (row.eligibility === 'deferred') {
    const kind = row.deferral?.kind ?? ''
    const since = row.deferral?.recorded_on ? ` since ${formatShortDate(row.deferral.recorded_on)}` : ''
    return {
      key: 'deferred',
      label: 'Deferred',
      tone: kind === 'temporary' ? 'warn' : 'crit',
      hint: `${DEFERRAL_HINT[kind] ?? 'Deferred'}${since}`,
    }
  }

  // A visit open at this centre, not yet drawn: the counter refuses a second
  // one, so the list must not say eligible (project owner, 2026-10-17).
  if (row.eligibility === 'in_progress') {
    return {
      key: 'in_progress',
      label: 'Visit in progress',
      tone: 'info',
      hint: 'Registered or being screened at your centre now',
    }
  }

  if (row.eligibility === 'waiting' && row.next_eligible_date) {
    return {
      key: 'waiting',
      label: `From ${formatShortDate(row.next_eligible_date)}`,
      tone: 'warn',
      hint: 'The donation interval has not passed yet',
    }
  }

  return { key: 'eligible', label: 'Eligible', tone: 'ok', hint: 'Can donate today' }
}

/** The fields the Register / Edit donor form holds, all as strings. */
export interface DonorForm {
  first_name: string
  last_name: string
  gender: string
  birth_date: string
  blood_type_id: string
  phone: string
  email: string
  address: string
  occupation: string
  last_donation_date: string
  status: string
  notes: string
  valid_id_number: string
}

export function blankDonorForm(): DonorForm {
  return {
    first_name: '',
    last_name: '',
    gender: '',
    birth_date: '',
    blood_type_id: '',
    phone: '',
    email: '',
    address: '',
    occupation: '',
    last_donation_date: '',
    status: 'active',
    notes: '',
    valid_id_number: '',
  }
}

/** The form as it opens for an existing donor. */
export function donorFormFrom(profile: Record<string, any>): DonorForm {
  const text = (v: unknown) => (v === null || v === undefined ? '' : String(v))

  return {
    first_name: text(profile.first_name),
    last_name: text(profile.last_name),
    gender: text(profile.gender),
    birth_date: text(profile.birth_date).slice(0, 10),
    blood_type_id: text(profile.blood_type_id),
    phone: formatPhone(profile.phone).replace(/\s/g, ''),
    email: text(profile.email),
    address: text(profile.address),
    occupation: text(profile.occupation),
    last_donation_date: text(profile.declared_last_donation_date).slice(0, 10),
    status: text(profile.status) || 'active',
    notes: text(profile.notes),
    valid_id_number: text(profile.valid_id_number),
  }
}

const NUMERIC = new Set(['blood_type_id'])

/**
 * What a Register form sends: every filled field, trimmed. The server treats
 * an empty string as a value, so blanks are left out rather than sent.
 */
export function registerPayload(form: DonorForm): Record<string, string | number> {
  const payload: Record<string, string | number> = {}

  for (const [key, raw] of Object.entries(form)) {
    const value = String(raw ?? '').trim()
    if (value === '') continue
    payload[key] = NUMERIC.has(key) ? Number(value) : value
  }

  return payload
}

/**
 * What an Edit form sends: only the fields that changed, with a cleared
 * field sent as null so it is cleared on the server too. The valid ID number
 * is never sent; it is registered once and not edited here.
 */
export function editPayload(form: DonorForm, original: DonorForm): Record<string, string | number | null> {
  const payload: Record<string, string | number | null> = {}

  for (const key of Object.keys(form) as (keyof DonorForm)[]) {
    if (key === 'valid_id_number') continue

    const value = String(form[key] ?? '').trim()
    const before = String(original[key] ?? '').trim()
    if (value === before) continue

    payload[key] = value === '' ? null : (NUMERIC.has(key) ? Number(value) : value)
  }

  return payload
}

const SKIP_LABELS: Record<string, [string, string]> = {
  not_yet_eligible: ['is not due yet', 'are not due yet'],
  in_progress: ['is in a visit now', 'are in a visit now'],
  deferred: ['is deferred', 'are deferred'],
  recently_reminded: ['was reminded in the last 7 days', 'were reminded in the last 7 days'],
  opted_out: ['turned reminders off', 'turned reminders off'],
  no_email: ['has no email address', 'have no email address'],
}

/** "4 are not due yet · 1 has no email address", for the reminder dialog. */
export function reminderSkipSummary(skipped: Record<string, number> | null | undefined): string {
  if (!skipped) return ''

  return Object.entries(SKIP_LABELS)
    .filter(([key]) => (skipped[key] ?? 0) > 0)
    .map(([key, [one, many]]) => `${skipped[key]} ${skipped[key] === 1 ? one : many}`)
    .join(' · ')
}

/** donors-2026-10-16.csv */
export function exportFilename(today: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `donors-${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}.csv`
}
