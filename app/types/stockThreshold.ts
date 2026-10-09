/**
 * Minimum stock per blood type and component, for a blood centre or a hospital
 * blood bank. One shape serves both portals: the server counts whichever shelf
 * belongs to the signed-in facility.
 */

/**
 * Where one cell stands against its minimum.
 *
 * `unmonitored` means no minimum is set, which says nothing about whether the
 * shelf is well stocked. `critical` is an empty shelf under a minimum.
 */
export type StockStatus = 'unmonitored' | 'ok' | 'low' | 'critical'

export interface StockThresholdCell {
  blood_type_id: number
  blood_type_code: string
  component_id: number
  component_name: string
  /** Issuable units now: available, and not past their date. */
  available: number
  minimum_units: number | null
  alerts_enabled: boolean
  status: StockStatus
  /** How many units short of the minimum; 0 when not short or not monitored. */
  shortfall: number
  alerted_at: string | null
  updated_by: string | null
  updated_at: string | null
}

export interface StockThresholdStatus {
  facility: { id: number; name: string; type: 'blood_center' | 'blood_bank' }
  blood_types: Array<{ id: number; code: string }>
  components: Array<{ id: number; name: string; code: string }>
  cells: StockThresholdCell[]
  /** Cells under their minimum, empty shelves first, then the largest gap. */
  low: StockThresholdCell[]
  totals: { monitored: number; ok: number; low: number; critical: number }
  as_of: string
}

/** One cell of a save. A null minimum clears the threshold. */
export interface StockThresholdInput {
  blood_type_id: number
  component_id: number
  minimum_units: number | null
  alerts_enabled?: boolean
}

export interface SaveStockThresholdsPayload {
  thresholds: StockThresholdInput[]
}

/** What the grid keeps for a cell while it is being edited. */
export interface StockThresholdDraft {
  /**
   * What the input holds: '' means no minimum. Vue types the value of a
   * `type="number"` input as a number once it parses, so both are possible.
   */
  minimum: string | number
  alerts_enabled: boolean
}
