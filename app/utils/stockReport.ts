/**
 * Shaping helpers for the Daily Blood Stock Inventory screen.
 *
 * The server sends the report already grouped into the sheet's tables; these
 * turn a table into what the grid needs to draw — how wide each component's
 * column group is, which expiry slot holds what, which ABO band a row sits in,
 * and which counts to box because they expire today or tomorrow. Kept apart
 * from the page so they can be tested without rendering it.
 */

export interface ExpiryEntry {
  date: string
  units: number
  expires_today: boolean
  expires_tomorrow: boolean
}

export interface StockCell {
  total: number
  by_expiry: ExpiryEntry[]
  expiring_soon: number
}

export interface StockColumn {
  id: number
  name: string
  role: string | null
  dated: boolean
  shelf_life_configured: boolean
  date_slots: number
  total: number
}

export interface StockTable {
  key: string
  rh: 'positive' | 'negative' | 'all'
  title: string
  columns: StockColumn[]
  rows: Array<{ blood_type: string; abo: string | null; rh: string | null; cells: Record<string, StockCell> }>
  total: number
}

const BANDS: Record<string, string> = {
  A: 'band-a',
  B: 'band-b',
  O: 'band-o',
  AB: 'band-ab',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * The colour band a blood type's row sits in, as on the paper sheet.
 */
export function bandClass(abo: string | null | undefined): string {
  return abo ? BANDS[abo] ?? '' : ''
}

/**
 * An expiry date the way the sheet writes it: `2026-05-16` becomes `16-May`.
 *
 * Read from the string itself rather than through Date, which would shift a
 * bare date by the viewer's timezone offset and could land on the wrong day.
 */
export function formatExpiry(date: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '')

  if (!match) return ''

  return `${Number(match[3])}-${MONTHS[Number(match[2]) - 1] ?? ''}`
}

/**
 * How many grid columns a component takes: its date slots plus a total, or one.
 */
export function columnWidth(column: StockColumn): number {
  return column.dated ? column.date_slots + 1 : 1
}

/**
 * The full width of a table: the blood type column plus every component group.
 */
export function tableSpan(table: StockTable): number {
  return 1 + table.columns.reduce((sum, column) => sum + columnWidth(column), 0)
}

/**
 * Whether any column in a table is broken down by date, which takes two lines per row.
 */
export function hasDatedColumns(table: StockTable): boolean {
  return table.columns.some((column) => column.dated)
}

/**
 * A cell's expiry entries padded to the column's slot count, so every row lines up.
 */
export function slotEntries(cell: StockCell | undefined, slots: number): Array<ExpiryEntry | null> {
  return Array.from({ length: slots }, (_, i) => cell?.by_expiry?.[i] ?? null)
}

/**
 * Whether a count expires today or tomorrow, and is boxed on the sheet.
 */
export function isSoon(entry: ExpiryEntry | null | undefined): boolean {
  return Boolean(entry && (entry.expires_today || entry.expires_tomorrow))
}

/**
 * The name the PDF is saved under, matching the server's own.
 */
export function stockReportFilename(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')

  return `stock-inventory-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.pdf`
}

/**
 * Why a chosen logo file would be refused, or null when it may be sent.
 *
 * PNG or JPEG only — WebP is refused because the logo is printed through
 * dompdf — and 2 MB at most. The server checks the same things again.
 */
export function logoProblem(file: { type?: string; size?: number } | null | undefined): string | null {
  if (!file) return 'Choose an image to upload.'

  if (!['image/png', 'image/jpeg'].includes(file.type ?? '')) {
    return 'The logo must be a PNG or JPG file.'
  }

  if ((file.size ?? 0) > 2 * 1024 * 1024) {
    return 'The logo must be 2 MB or smaller.'
  }

  return null
}
