/**
 * Stock levels per blood type and component, for a blood centre or a hospital
 * blood bank. One shape serves both portals: the server counts whichever shelf
 * belongs to the signed-in facility.
 *
 * Each cell has two levels. The critical level (`minimum_units`) is the one a
 * low-stock alert is judged against. The PAR level (`par_units`) is the stock
 * the facility aims to keep; it is reported, never alerted on. The critical
 * level may not sit above PAR.
 */

/**
 * Where one cell stands against its critical level.
 *
 * `unmonitored` means no critical level is set, which says nothing about
 * whether the shelf is well stocked. `critical` is an empty shelf under a
 * critical level.
 */
export type StockStatus = 'unmonitored' | 'ok' | 'low' | 'critical'

/** Which of a cell's two levels a table edits. */
export type ThresholdLevel = 'par' | 'critical'

export interface StockThresholdCell {
  blood_type_id: number
  blood_type_code: string
  component_id: number
  component_name: string
  /** Issuable units now: available, and not past their date. */
  available: number
  /** The critical level. */
  minimum_units: number | null
  par_units: number | null
  alerts_enabled: boolean
  status: StockStatus
  /** How many units short of the critical level; 0 when not short or not monitored. */
  shortfall: number
  /** How many units short of PAR; 0 when at or over it, or when no PAR is set. */
  to_par: number
  alerted_at: string | null
  updated_by: string | null
  updated_at: string | null
}

export interface StockThresholdStatus {
  facility: { id: number; name: string; type: 'blood_center' | 'blood_bank' }
  blood_types: Array<{ id: number; code: string }>
  components: Array<{ id: number; name: string; code: string }>
  cells: StockThresholdCell[]
  /** Cells under their critical level, empty shelves first, then the largest gap. */
  low: StockThresholdCell[]
  totals: { monitored: number; ok: number; low: number; critical: number; below_par: number }
  as_of: string
}

/**
 * One cell of a save. A level left out keeps its saved value, and a null
 * clears it, so the PAR and critical tables save apart.
 */
export interface StockThresholdInput {
  blood_type_id: number
  component_id: number
  minimum_units?: number | null
  par_units?: number | null
  alerts_enabled?: boolean
}

export interface SaveStockThresholdsPayload {
  thresholds: StockThresholdInput[]
}

/**
 * What the screen keeps for a cell while it is being edited.
 *
 * `minimum` and `par` hold what their inputs hold: '' means no level. Vue types
 * the value of a `type="number"` input as a number once it parses, so both are
 * possible.
 */
export interface StockThresholdDraft {
  minimum: string | number
  par: string | number
  alerts_enabled: boolean
}

/** Something that stops one table from being saved, tied to the cell it is about. */
export interface ThresholdProblem {
  key: string
  message: string
}

/** One blood type's row in a level table: each component's cell and its draft. */
export interface StockLevelRow {
  type: { id: number; code: string }
  items: Array<{
    key: string
    component: { id: number; name: string; code: string }
    cell: StockThresholdCell
    draft: StockThresholdDraft
  }>
}
