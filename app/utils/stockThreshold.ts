import type {
  StockStatus,
  StockThresholdCell,
  StockThresholdDraft,
  StockThresholdInput,
} from '~/types/stockThreshold'

/**
 * Shaping helpers for the stock-threshold grid, banner and per-type health.
 *
 * Kept apart from the pages so they can be tested without rendering one. The
 * server decides every status; nothing here judges a count against a minimum.
 */

/** The order blood types are always listed in, matching the Issuance tiles. */
const BLOOD_TYPE_ORDER = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

/** The key a cell is addressed by in drafts and in the payload. */
export function cellKey(bloodTypeId: number, componentId: number): string {
  return `${bloodTypeId}:${componentId}`
}

/** Blood types in the conventional A, B, AB, O order, unknown codes last. */
export function orderBloodTypes<T extends { code: string }>(types: T[]): T[] {
  const rank = (code: string) => {
    const index = BLOOD_TYPE_ORDER.indexOf(code)
    return index === -1 ? BLOOD_TYPE_ORDER.length : index
  }

  return [...types].sort((a, b) => rank(a.code) - rank(b.code))
}

/** The draft a cell starts as: what is saved. */
export function draftFor(cell: StockThresholdCell): StockThresholdDraft {
  return {
    minimum: cell.minimum_units === null ? '' : String(cell.minimum_units),
    alerts_enabled: cell.alerts_enabled,
  }
}

/** The draft's minimum as trimmed text, whatever type the input handed back. */
function textOf(draft: StockThresholdDraft): string {
  return String(draft.minimum ?? '').trim()
}

/** The minimum a draft means: a whole number of at least one, or null for none. */
export function minimumOf(draft: StockThresholdDraft): number | null {
  const text = textOf(draft)

  if (text === '') return null

  const value = Number(text)

  return Number.isFinite(value) ? Math.trunc(value) : null
}

/** Whether a draft's minimum is something the server will accept. */
export function isValidMinimum(draft: StockThresholdDraft): boolean {
  const text = textOf(draft)

  if (text === '') return true

  const value = Number(text)

  return Number.isInteger(value) && value >= 1 && value <= 9999
}

/**
 * The cells whose draft differs from what is saved, as a save payload.
 *
 * Only changed cells are sent: an unchanged one would be skipped by the server
 * anyway, but sending the whole grid on every save buries what changed. A cell
 * with no minimum and no change is never sent, so the bell toggle on an empty
 * cell does not create a row by itself.
 */
export function diffDrafts(
  cells: StockThresholdCell[],
  drafts: Record<string, StockThresholdDraft>,
): StockThresholdInput[] {
  const changes: StockThresholdInput[] = []

  for (const cell of cells) {
    const draft = drafts[cellKey(cell.blood_type_id, cell.component_id)]

    if (!draft) continue

    const minimum = minimumOf(draft)

    if (minimum === null && cell.minimum_units === null) continue

    if (minimum === cell.minimum_units && draft.alerts_enabled === cell.alerts_enabled) continue

    changes.push({
      blood_type_id: cell.blood_type_id,
      component_id: cell.component_id,
      minimum_units: minimum,
      alerts_enabled: draft.alerts_enabled,
    })
  }

  return changes
}

const LABELS: Record<StockStatus, string> = {
  unmonitored: 'Not monitored',
  ok: 'Healthy',
  low: 'Low',
  critical: 'Out of stock',
}

export function stockStatusLabel(status: StockStatus): string {
  return LABELS[status]
}

/** "O+ Packed RBC — 2 of 10", the way a chip or a sentence names a shortage. */
export function describeCell(cell: StockThresholdCell): string {
  return `${cell.blood_type_code} ${cell.component_name} — ${cell.available} of ${cell.minimum_units ?? '—'}`
}

/** Short form for a chip: "O+ PRBC 2/10", falling back to the full name. */
export function chipLabel(cell: StockThresholdCell, componentCodes: Record<number, string> = {}): string {
  const component = componentCodes[cell.component_id] ?? cell.component_name

  return `${cell.blood_type_code} ${component} ${cell.available}/${cell.minimum_units ?? '—'}`
}

/** Cells under their minimum, empty shelves first, then the largest gap. */
export function sortLow(cells: StockThresholdCell[]): StockThresholdCell[] {
  const tier = (cell: StockThresholdCell) => (cell.status === 'critical' ? 0 : 1)

  return cells
    .filter((cell) => cell.status === 'low' || cell.status === 'critical')
    .sort((a, b) =>
      tier(a) - tier(b)
      || b.shortfall - a.shortfall
      || a.blood_type_code.localeCompare(b.blood_type_code)
      || a.component_name.localeCompare(b.component_name),
    )
}

/**
 * How one blood type stands across every component it has a minimum for.
 *
 * The worst monitored cell wins, so a type that is fine in red cells but empty
 * in platelets reads as short rather than healthy. A type with no minimum at
 * all is `unmonitored`, and the caller decides how to draw that.
 */
export function typeHealth(cells: StockThresholdCell[], bloodTypeId: number): StockStatus {
  const own = cells.filter((cell) => cell.blood_type_id === bloodTypeId && cell.status !== 'unmonitored')

  if (own.length === 0) return 'unmonitored'
  if (own.some((cell) => cell.status === 'critical')) return 'critical'
  if (own.some((cell) => cell.status === 'low')) return 'low'

  return 'ok'
}

/** The same, looked up by the code the inventory summary uses. */
export function typeHealthByCode(cells: StockThresholdCell[], bloodTypeCode: string): StockStatus {
  const id = cells.find((cell) => cell.blood_type_code === bloodTypeCode)?.blood_type_id

  return id === undefined ? 'unmonitored' : typeHealth(cells, id)
}
