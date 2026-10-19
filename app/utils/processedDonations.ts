/**
 * Shaping helpers for Processing's Processed list (pages/blood-center/processed.vue).
 *
 * Whether a row may still be handed over or rejected is the server's call
 * (`can` on each row, mirroring LaboratoryService's guards); these decide how
 * a row reads and what a refusal says.
 */

export type HandoverStatus = 'awaiting_handover' | 'handed_over' | 'rejected'

export interface ProcessedBag {
  id?: number
  component_id?: number
  component: string | null
  /** The suffix on the bag's number (PRBC, FFP…). */
  code?: string | null
  volume_ml: number | null
  quantity: number
  bag_number: string | null
}

/** One chip in the list's Components cell: a component, by its label code, and how many bags of it. */
export interface ComponentChip {
  code: string
  name: string
  count: number
}

export interface ProcessedRow {
  donation_id: number
  code: string
  status: HandoverStatus
  components: ProcessedBag[]
  bag_count: number
  units_booked: number
  rejection_reason?: string | null
  correction_pending?: boolean
  /** Why the breakdown can no longer be corrected, as the correction route would refuse it. */
  locked?: 'handed_over' | 'rejected' | null
  can?: { hand_over?: boolean, reject?: boolean, correct?: boolean }
}

/** One bag as the edit form keeps it. */
export interface BagForm {
  component_id: number | null
  volume_ml: number | null
}

/**
 * The hand-over filter, everything Processing has processed first; and what
 * waits for the component technologist's decision on a correction.
 */
export const STATUS_FILTERS = [
  { value: '', label: 'All processed' },
  { value: 'awaiting_handover', label: 'Awaiting hand-over' },
  { value: 'handed_over', label: 'Handed over' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'correction_pending', label: 'Correction pending' },
] as const

/**
 * A saved breakdown as the edit form's rows: one per bag. A breakdown from
 * before volumes were kept has a count and no volume; it opens as that many
 * rows, each waiting for its volume.
 */
export function editableBags(components: Pick<ProcessedBag, 'component_id' | 'volume_ml' | 'quantity'>[] | null | undefined): BagForm[] {
  const rows = (components ?? []).flatMap((bag) => Array.from(
    { length: bag.volume_ml ? 1 : Math.max(1, Number(bag.quantity) || 1) },
    () => ({ component_id: bag.component_id ?? null, volume_ml: bag.volume_ml ?? null }),
  ))

  return rows.length ? rows : [{ component_id: null, volume_ml: null }]
}

/** A bag the server would take: a component and a whole volume of 1 to 1000 mL. */
export function isCompleteBag(bag: BagForm): boolean {
  const volume = Number(bag.volume_ml)

  return Boolean(bag.component_id) && Number.isInteger(volume) && volume >= 1 && volume <= 1000
}

/** The body a breakdown correction carries: the same one recording it sends. */
export function breakdownPayload(rows: BagForm[]): { component_id: number, volume_ml: number }[] {
  return rows.filter(isCompleteBag).map((bag) => ({ component_id: Number(bag.component_id), volume_ml: Number(bag.volume_ml) }))
}

/**
 * Whether the form says something other than what is saved. Bag order counts:
 * it decides each bag's number.
 */
export function breakdownChanged(saved: BagForm[], next: BagForm[]): boolean {
  const key = (rows: BagForm[]) => rows.map((bag) => `${bag.component_id ?? ''}:${bag.volume_ml ?? ''}`).join('|')

  return key(saved) !== key(next)
}

/** Why a row's breakdown cannot be corrected from the list, in words; null when it can. */
export function correctionLockText(row: Pick<ProcessedRow, 'locked' | 'correction_pending' | 'can'>): string | null {
  if (row.can?.correct) return null

  switch (row.locked) {
    case 'handed_over':
      return 'This unit has been handed over to Issuance, so its breakdown is fixed.'
    case 'rejected':
      return 'This unit was rejected, so its breakdown is fixed.'
  }

  if (row.correction_pending) return 'A correction to this breakdown is already waiting for a decision.'

  return 'Your role does not file corrections to the component breakdown.'
}

/** One bag in words: its component and volume, or its count for a breakdown from before volumes were kept. */
export function bagText(bag: Pick<ProcessedBag, 'component' | 'volume_ml' | 'quantity'>): string {
  const name = bag.component || 'Component'

  if (bag.volume_ml) return `${name} · ${bag.volume_ml} mL`

  return `${name} × ${Math.max(1, Number(bag.quantity) || 1)}`
}

/**
 * The breakdown as the list's cell reads it: each component once, with its
 * count when there is more than one bag of it ("2 × Packed RBC, FFP").
 */
export function breakdownSummary(components: Pick<ProcessedBag, 'component' | 'quantity'>[] | null | undefined): string {
  const counts = new Map<string, number>()

  for (const bag of components ?? []) {
    const name = bag.component || 'Component'
    counts.set(name, (counts.get(name) ?? 0) + Math.max(1, Number(bag.quantity) || 1))
  }

  return [...counts].map(([name, count]) => (count > 1 ? `${count} × ${name}` : name)).join(', ')
}

/**
 * The breakdown as the list's chips (project owner, 2026-10-19): one per
 * component, by the code printed on its bag label, counting repeated bags, in
 * the order they were declared. Full names wrap mid-word in a narrow column;
 * codes keep every row the same height. The full name is the chip's tooltip.
 */
export function componentChips(components: Pick<ProcessedBag, 'component' | 'code' | 'quantity'>[] | null | undefined): ComponentChip[] {
  const chips = new Map<string, ComponentChip>()

  for (const bag of components ?? []) {
    const name = bag.component || 'Component'
    const code = bag.code || name
    const chip = chips.get(code) ?? { code, name, count: 0 }

    chip.count += Math.max(1, Number(bag.quantity) || 1)
    chips.set(code, chip)
  }

  return [...chips.values()]
}

/** How far Issuance has got with a unit that was handed over; null before then. */
export function bookedText(row: Pick<ProcessedRow, 'status' | 'units_booked' | 'bag_count'>): string | null {
  if (row.status !== 'handed_over') return null
  if (!row.units_booked) return 'Not booked in yet'

  return row.units_booked >= row.bag_count ? 'All booked in' : `${row.units_booked} of ${row.bag_count} booked in`
}

/** Why a row offers no hand-over, in words; null when it does. */
export function handoverBlockedText(row: Pick<ProcessedRow, 'status' | 'can'>): string | null {
  if (row.can?.hand_over) return null

  switch (row.status) {
    case 'handed_over':
      return 'Already handed over to Issuance.'
    case 'rejected':
      return 'This unit was rejected, so it can never be handed over.'
  }

  return 'The component technologist hands units over to Issuance.'
}

/**
 * A refusal from the laboratory status route, in words a technologist can act on.
 */
export function handoverErrorText(err: { message?: string, data?: { code?: string } } | null | undefined): string {
  switch (err?.data?.code) {
    case 'donation_already_final':
      return 'This donation has already been handed over or rejected. The list has been refreshed.'
    case 'components_missing':
      return 'This unit has no component breakdown recorded, so it cannot be handed over.'
    case 'donation_not_collected':
      return 'The counter has not finished with this donation yet.'
    case 'facility_missing':
      return 'This account is not linked to a facility.'
    default:
      return err?.message || 'Something went wrong. Try again.'
  }
}
