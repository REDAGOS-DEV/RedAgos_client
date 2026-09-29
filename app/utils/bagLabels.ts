/**
 * What goes on a blood bag's printed labels, in the two phases the centre labels in.
 *
 * Phase 1 — the BASE label, printed by Processing when the bag is separated:
 * what the product is and its number, and nothing that says it is safe. No
 * blood type, no clearance.
 *
 * Phase 2 — the FINAL label, printed by Issuance when the bag leaves
 * quarantine: the verified blood type, the expiry and the clearance codes.
 * The server only gives this for bags already released, so a "cleared" label
 * can never be printed for a bag that is not.
 *
 * Neither prints a barcode: every bag already carries the donation's
 * pre-printed sticker, and the bag number is that sticker plus the component.
 * Neither names the donor.
 */

export type LabelVariant = 'base' | 'final'

export interface BaseLabel {
  bag_number: string
  component: string
  volume_ml: number | null
  donation_barcode: string | null
}

export interface FinalLabel {
  unit_id: string
  abo: string
  rh: string
  component: string
  volume_ml: number | null
  expiry: string
  donation_barcode: string | null
  clearances: string[]
  released: string | null
  facility: string | null
}

export type PrintableLabel = BaseLabel | FinalLabel

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * A date as a label prints it: `2026-10-12` becomes `12 Oct 2026`.
 *
 * Read from the string, not through Date, so a bare expiry date is never moved
 * a day by the viewer's timezone.
 */
export function labelDate(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')

  if (!match) return ''

  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1] ?? ''} ${match[1]}`
}

/**
 * The ABO group in large type, with the Rh factor spelled out beside it.
 */
export function splitBloodType(code: string | null | undefined): { abo: string; rh: string } {
  const match = /^(AB|A|B|O)([+-])$/.exec((code ?? '').trim().toUpperCase())

  if (!match) return { abo: code ?? '—', rh: '' }

  return { abo: match[1]!, rh: match[2] === '+' ? 'Rh POSITIVE' : 'Rh NEGATIVE' }
}

/**
 * Phase 1 labels from Processing's view of a donation: one per numbered bag.
 *
 * A bag declared before volumes and stickers were kept has no number, so it
 * cannot be labelled here.
 */
export function baseLabelsFrom(donation: {
  donation_barcode?: string | null
  components?: Array<{ bag_number?: string | null; component?: string | null; volume_ml?: number | null }>
} | null | undefined): BaseLabel[] {
  return (donation?.components ?? [])
    .filter((bag) => Boolean(bag.bag_number))
    .map((bag) => ({
      bag_number: bag.bag_number as string,
      component: bag.component ?? '',
      volume_ml: bag.volume_ml ?? null,
      donation_barcode: donation?.donation_barcode ?? null,
    }))
}

interface LabelsPayload {
  donation_barcode?: string | null
  facility?: string | null
  clearances?: Array<{ label?: string; code?: string; issued_at?: string | null; issued_by?: string | null }>
  units?: Array<{
    unit_id: string
    blood_type?: string | null
    component?: string | null
    volume_ml?: number | null
    expiry_date?: string | null
    released_at?: string | null
    released_by?: string | null
  }>
}

/**
 * Phase 2 labels from the server's label data, optionally only for some bags.
 */
export function finalLabelsFrom(payload: LabelsPayload | null | undefined, onlyUnitIds: string[] | null = null): FinalLabel[] {
  const clearances = (payload?.clearances ?? []).map((token) => [
    token.label,
    token.code,
    labelDate(token.issued_at),
    token.issued_by,
  ].filter(Boolean).join(' · '))

  return (payload?.units ?? [])
    .filter((unit) => !onlyUnitIds || onlyUnitIds.includes(unit.unit_id))
    .map((unit) => {
      const { abo, rh } = splitBloodType(unit.blood_type)

      return {
        unit_id: unit.unit_id,
        abo,
        rh,
        component: unit.component ?? '',
        volume_ml: unit.volume_ml ?? null,
        expiry: labelDate(unit.expiry_date),
        donation_barcode: payload?.donation_barcode ?? null,
        clearances,
        released: unit.released_at
          ? `Released ${labelDate(unit.released_at)}${unit.released_by ? ` by ${unit.released_by}` : ''}`
          : null,
        facility: payload?.facility ?? null,
      }
    })
}
