import type {
  StockStatus,
  StockThresholdCell,
  StockThresholdDraft,
  StockThresholdInput,
  ThresholdLevel,
  ThresholdProblem,
} from '~/types/stockThreshold'

/**
 * Shaping helpers for the stock-threshold tables, banner and per-type health.
 *
 * Kept apart from the pages so they can be tested without rendering one. The
 * server decides every status; nothing here judges a count against a level.
 * What is checked here is only what the user typed: that each level is a
 * whole number in range, and that a critical level does not sit above PAR.
 */

/** The order blood types are always listed in, matching the Issuance tiles. */
const BLOOD_TYPE_ORDER = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

/** Components by code, whole blood first and then as a bag is split; unknown codes go last. */
const COMPONENT_ORDER = ['WB', 'PRBC', 'WRBC', 'PC', 'PLT', 'FFP', 'CRYO', 'CSP']

const LEVEL_MAX = 9999

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

/** Components with whole blood first and the plasma products last, unknown codes after by name. */
export function orderComponents<T extends { code: string; name: string }>(components: T[]): T[] {
  const rank = (code: string) => {
    const index = COMPONENT_ORDER.indexOf(code.toUpperCase())
    return index === -1 ? COMPONENT_ORDER.length : index
  }

  return [...components].sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name))
}

/** "O+ Packed RBC", the way a message names a cell. */
export function thresholdCellLabel(cell: StockThresholdCell): string {
  return `${cell.blood_type_code} ${cell.component_name}`
}

/** The draft a cell starts as: what is saved. */
export function draftFor(cell: StockThresholdCell): StockThresholdDraft {
  return {
    minimum: cell.minimum_units === null ? '' : String(cell.minimum_units),
    par: cell.par_units === null ? '' : String(cell.par_units),
    alerts_enabled: cell.alerts_enabled,
  }
}

/** What an input holds as trimmed text, whatever type it handed back. */
function textOf(value: string | number | null | undefined): string {
  return String(value ?? '').trim()
}

/** The level an input means: a whole number, or null for none. */
export function levelOf(value: string | number | null | undefined): number | null {
  const text = textOf(value)

  if (text === '') return null

  const parsed = Number(text)

  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

/** Whether an input holds something the server will accept: nothing, or a whole number from 1 to 9999. */
export function isValidLevel(value: string | number | null | undefined): boolean {
  const text = textOf(value)

  if (text === '') return true

  const parsed = Number(text)

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= LEVEL_MAX
}

/** The critical level a draft means. */
export function minimumOf(draft: StockThresholdDraft): number | null {
  return levelOf(draft.minimum)
}

/** The PAR level a draft means. */
export function parOf(draft: StockThresholdDraft): number | null {
  return levelOf(draft.par)
}

/** Whether a draft's critical level is something the server will accept. */
export function isValidMinimum(draft: StockThresholdDraft): boolean {
  return isValidLevel(draft.minimum)
}

/** Whether the levels on screen put the critical level above PAR. */
export function levelConflict(draft: StockThresholdDraft): boolean {
  if (!isValidLevel(draft.minimum) || !isValidLevel(draft.par)) return false

  const minimum = minimumOf(draft)
  const par = parOf(draft)

  return minimum !== null && par !== null && minimum > par
}

/**
 * Whether a draft differs from what is saved, for one table.
 *
 * The critical table owns the notification toggle as well as the level. A
 * toggle on a cell with no critical level, saved or typed, is not a change: it
 * would create a row by itself.
 */
function isChanged(level: ThresholdLevel, cell: StockThresholdCell, draft: StockThresholdDraft): boolean {
  if (level === 'par') return parOf(draft) !== cell.par_units

  const minimum = minimumOf(draft)

  if (minimum === null && cell.minimum_units === null) return false

  return minimum !== cell.minimum_units || draft.alerts_enabled !== cell.alerts_enabled
}

/**
 * The cells whose critical level or notification toggle differs from what is saved, as a save payload.
 *
 * Only changed cells are sent, and only their critical side: the PAR level is
 * left out, so the server keeps whatever PAR is saved.
 */
export function diffCritical(
  cells: StockThresholdCell[],
  drafts: Record<string, StockThresholdDraft>,
): StockThresholdInput[] {
  return cells.flatMap((cell) => {
    const draft = drafts[cellKey(cell.blood_type_id, cell.component_id)]

    return draft && isChanged('critical', cell, draft)
      ? [{
          blood_type_id: cell.blood_type_id,
          component_id: cell.component_id,
          minimum_units: minimumOf(draft),
          alerts_enabled: draft.alerts_enabled,
        }]
      : []
  })
}

/** The cells whose PAR level differs from what is saved, as a save payload that leaves the critical level alone. */
export function diffPar(
  cells: StockThresholdCell[],
  drafts: Record<string, StockThresholdDraft>,
): StockThresholdInput[] {
  return cells.flatMap((cell) => {
    const draft = drafts[cellKey(cell.blood_type_id, cell.component_id)]

    return draft && isChanged('par', cell, draft)
      ? [{ blood_type_id: cell.blood_type_id, component_id: cell.component_id, par_units: parOf(draft) }]
      : []
  })
}

/**
 * What stops one table from being saved, cell by cell.
 *
 * - A value that is not a whole number from 1 to 9999.
 * - A changed cell whose levels on screen put the critical level above PAR.
 * - A changed cell that is fine on screen but would not be once saved, because
 *   the other table's half of the fix is not saved yet. The server keeps the
 *   other level as it is saved, so the message says which table to save first.
 */
export function thresholdProblems(
  level: ThresholdLevel,
  cells: StockThresholdCell[],
  drafts: Record<string, StockThresholdDraft>,
): ThresholdProblem[] {
  const problems: ThresholdProblem[] = []

  for (const cell of cells) {
    const key = cellKey(cell.blood_type_id, cell.component_id)
    const draft = drafts[key]

    if (!draft) continue

    const label = thresholdCellLabel(cell)
    const own = level === 'par' ? draft.par : draft.minimum

    if (!isValidLevel(own)) {
      problems.push({ key, message: `${label}: enter a whole number from 1 to ${LEVEL_MAX}, or leave it blank.` })
      continue
    }

    if (!isChanged(level, cell, draft)) continue

    const minimum = minimumOf(draft)
    const par = parOf(draft)

    if (levelConflict(draft)) {
      problems.push({
        key,
        message: level === 'par'
          ? `${label}: the PAR level (${par}) is below the critical level (${minimum}).`
          : `${label}: the critical level (${minimum}) is above the PAR level (${par}).`,
      })
      continue
    }

    if (level === 'par' && par !== null && cell.minimum_units !== null && par < cell.minimum_units) {
      problems.push({
        key,
        message: `${label}: save the Critical Level first. Its saved critical level (${cell.minimum_units}) is above this PAR level (${par}).`,
      })
    }

    if (level === 'critical' && minimum !== null && cell.par_units !== null && minimum > cell.par_units) {
      problems.push({
        key,
        message: `${label}: save the PAR Level first. Its saved PAR level (${cell.par_units}) is below this critical level (${minimum}).`,
      })
    }
  }

  return problems
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

/** Cells under their critical level, empty shelves first, then the largest gap. */
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
 * How one blood type stands across every component it has a critical level for.
 *
 * The worst monitored cell wins, so a type that is fine in red cells but empty
 * in platelets reads as short rather than healthy. A type with no critical
 * level at all is `unmonitored`, and the caller decides how to draw that.
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
