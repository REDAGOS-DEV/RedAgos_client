/**
 * Paper records: a remote drive's screening and phlebotomy, written on paper
 * and typed in once the sheets and bags come back (project owner, 2026-10-17).
 *
 * One sheet per drive and day. Each donor on it becomes an ordinary donation
 * dated on the drive's day, so every clock time here is put on that day, never
 * on today. The server holds the same rules (RecordPaperDonationRequest); these
 * say what is missing before a request is made.
 */

import { atTimeOn, normalizeBarcode, phlebotomyProblems } from './phlebotomy'
import { OTHER_DEFERRAL, deferralChoiceComplete, deferralChoicePayload } from './deferralCodes'

export interface PaperSheet {
  id: number
  code: string
  drive: { id: number | null; name: string; location: string | null; in_redagos: boolean }
  held_on: string
  starts_at: string
  screened_by_name: string | null
  phlebotomist_name: string | null
  notify_donors: boolean
  notes: string | null
  created_by: string | null
  counts: { rows: number; drawn: number; deferred: number }
  can: { delete: boolean }
}

/** The four boxes of the form's REMARKS, accepted first. */
export const PAPER_OUTCOMES = [
  { value: 'accepted', label: 'Accepted' },
  { value: 'temporarily_deferred', label: 'Temporarily Deferred' },
  { value: 'permanently_deferred', label: 'Permanently Deferred' },
  { value: 'indefinite_deferral', label: 'Indefinite Deferral' },
] as const

export type PaperOutcome = (typeof PAPER_OUTCOMES)[number]['value']

/** Whole numbers on the server (RecordScreeningRequest); the rest may carry a decimal. */
const WHOLE_VITALS = ['systolic_bp', 'diastolic_bp', 'pulse_bpm', 'weight_kg'] as const
const DECIMAL_VITALS = ['temperature_c', 'haemoglobin_g_dl'] as const
const TEXT_FIELDS = [
  'general_appearance',
  'skin',
  'heent',
  'heart_and_lungs',
  'sleep',
  'meal',
  'meds',
  'allergies',
  'notes',
] as const

type Vital = (typeof WHOLE_VITALS)[number] | (typeof DECIMAL_VITALS)[number]
type TextField = (typeof TEXT_FIELDS)[number]

/** One donor's record as the entry form holds it, all as typed. */
export type PaperRowForm = {
  screened_time: string
  screened_by_name: string
  outcome: PaperOutcome
  /** The deferral code written on the paper, from the centre's list, or OTHER_DEFERRAL. */
  deferral_code: string
  /** The reason as written, under Other. */
  other_reason: string
  fingerprick_blood_type_id: number | null
  /** Accepted only: was the bag drawn, or did the draw not go ahead? */
  draw: 'collected' | 'failed'
  draw_failed_reason: string
  blood_bag_type: string
  donation_barcode: string
  started_time: string
  ended_time: string
  volume_ml: number | string | null
  phlebotomist_name: string
  /** Drawn, but the bag will not reach the laboratory. */
  not_to_lab: boolean
  not_to_lab_reason: string
} & Record<Vital, number | string | null> & Record<TextField, string>

/** The drive's day as a local date, so a clock time lands on it rather than on today. */
export function sheetDay(heldOn: string): Date {
  const [y, m, d] = heldOn.split('-').map(Number)

  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** A blank row, starting from the names the sheet says most rows carry. */
export function blankPaperRow(sheet: Pick<PaperSheet, 'screened_by_name' | 'phlebotomist_name'>): PaperRowForm {
  return {
    screened_time: '',
    screened_by_name: sheet.screened_by_name ?? '',
    outcome: 'accepted',
    deferral_code: '',
    other_reason: '',
    systolic_bp: null,
    diastolic_bp: null,
    pulse_bpm: null,
    temperature_c: null,
    weight_kg: null,
    haemoglobin_g_dl: null,
    fingerprick_blood_type_id: null,
    general_appearance: '',
    skin: '',
    heent: '',
    heart_and_lungs: '',
    sleep: '',
    meal: '',
    meds: '',
    allergies: '',
    notes: '',
    draw: 'collected',
    draw_failed_reason: '',
    // No bag pre-selected, as at the counter: it decides what the bag can be
    // separated into, so it has to be a deliberate choice.
    blood_bag_type: '',
    donation_barcode: '',
    started_time: '',
    ended_time: '',
    volume_ml: 450,
    phlebotomist_name: sheet.phlebotomist_name ?? '',
    not_to_lab: false,
    not_to_lab_reason: '',
  }
}

/** Whether the row carries a phlebotomist box: accepted, and drawn. */
export function expectsCollection(form: Pick<PaperRowForm, 'outcome' | 'draw'>): boolean {
  return form.outcome === 'accepted' && form.draw === 'collected'
}

function filled(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

/**
 * Everything wrong with the row, in the order the form prints it. Empty when
 * ready. The donor is the caller's to check: it is chosen, not typed.
 */
export function paperRowProblems(form: PaperRowForm, heldOn: string, now: Date = new Date()): string[] {
  const problems: string[] = []
  const day = sheetDay(heldOn)

  if (!form.screened_by_name.trim()) problems.push('Give the name of the physician who screened the donor.')

  if (filled(form.screened_time)) {
    const at = atTimeOn(day, form.screened_time)

    if (!at) problems.push('The screening time is not a valid time.')
    else if (new Date(at) > now) problems.push('The screening time cannot be in the future.')
  }

  if (form.outcome !== 'accepted') {
    if (!deferralChoiceComplete(form.deferral_code.trim(), form.other_reason)) {
      problems.push(form.deferral_code === OTHER_DEFERRAL
        ? 'Give the reason written on the paper.'
        : 'Choose the deferral code written on the paper.')
    }

    return problems
  }

  if (form.draw === 'failed') {
    if (!form.draw_failed_reason.trim()) problems.push('Say why the draw was not completed.')

    return problems
  }

  problems.push(...phlebotomyProblems(form, day, now))

  if (!form.phlebotomist_name.trim()) problems.push('Give the name of the phlebotomist.')
  if (form.not_to_lab && !form.not_to_lab_reason.trim()) problems.push('Say why the bag will not reach the laboratory.')

  return problems
}

/**
 * What the row sends. Blanks are left out rather than sent: the server takes
 * an empty string as a value. Every time is put on the drive's day.
 */
export function paperRowPayload(
  form: PaperRowForm,
  heldOn: string,
  donorUuid: string,
  confirmInterval = false,
): Record<string, any> {
  const day = sheetDay(heldOn)
  const payload: Record<string, any> = {
    donor_uuid: donorUuid,
    screened_by_name: form.screened_by_name.trim(),
    outcome: form.outcome,
  }

  if (filled(form.screened_time)) payload.screened_at = atTimeOn(day, form.screened_time)

  for (const key of WHOLE_VITALS) {
    if (filled(form[key])) payload[key] = Math.round(Number(form[key]))
  }

  for (const key of DECIMAL_VITALS) {
    if (filled(form[key])) payload[key] = Number(form[key])
  }

  if (form.fingerprick_blood_type_id) payload.fingerprick_blood_type_id = Number(form.fingerprick_blood_type_id)

  for (const key of TEXT_FIELDS) {
    if (filled(form[key])) payload[key] = form[key].trim()
  }

  if (form.outcome !== 'accepted') {
    Object.assign(payload, deferralChoicePayload(form.deferral_code.trim(), form.other_reason))
  } else if (form.draw === 'failed') {
    payload.draw_failed = true
    payload.draw_failed_reason = form.draw_failed_reason.trim()
  } else {
    payload.collection = {
      blood_bag_type: form.blood_bag_type,
      donation_barcode: normalizeBarcode(form.donation_barcode),
      started_at: atTimeOn(day, form.started_time),
      ended_at: atTimeOn(day, form.ended_time),
      volume_ml: Number(form.volume_ml),
      phlebotomist_name: form.phlebotomist_name.trim(),
    }

    if (form.not_to_lab) {
      payload.not_to_lab = true
      payload.not_to_lab_reason = form.not_to_lab_reason.trim()
    }
  }

  if (confirmInterval) payload.confirm_interval = true

  return payload
}

/** "12 donors · 10 drawn · 2 deferred" */
export function sheetSummary(counts: PaperSheet['counts']): string {
  const parts = [`${counts.rows} donor${counts.rows === 1 ? '' : 's'}`]

  if (counts.rows) parts.push(`${counts.drawn} drawn`, `${counts.deferred} deferred`)

  return parts.join(' · ')
}

/** Whole days from the drive to today, for the hint on an old sheet. */
export function daysSinceDrive(heldOn: string, today: Date = new Date()): number {
  const start = sheetDay(heldOn)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}
