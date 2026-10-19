/**
 * Shaping helpers for the Issuance dashboard (blood-center/storage.vue).
 *
 * Every count comes from the server's inventory summary; these decide only
 * how a count is drawn.
 */

/** The order the dashboard lists blood types in, as Stock Thresholds does. */
const TYPE_ORDER = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

/** One day of the summary's `trend`: the four headline levels at its close. */
export interface StockTrendPoint {
  date: string
  available: number
  expiring_soon: number
  reserved: number
  quarantined: number
}

export type StockLevelKey = 'available' | 'expiring_soon' | 'reserved' | 'quarantined'

export interface StockWeekChange {
  direction: 'up' | 'down' | 'flat'
  text: string
}

/**
 * Today against the same day last week, the trend's first point.
 *
 * A percentage when last week had something to compare against, and the plain
 * number of units when it had none, since "+∞%" says nothing. A real change
 * that rounds to 0% still says which way it went.
 */
export function stockWeekChange(trend: StockTrendPoint[], key: StockLevelKey): StockWeekChange | null {
  if (trend.length < 2) return null

  const then = trend[0]![key]
  const now = trend[trend.length - 1]![key]
  const diff = now - then

  if (diff === 0) return { direction: 'flat', text: '0%' }

  const direction = diff > 0 ? 'up' : 'down'
  const sign = diff > 0 ? '+' : '−'
  const size = Math.abs(diff)

  if (then === 0) return { direction, text: `${sign}${size} ${size === 1 ? 'unit' : 'units'}` }

  const percent = Math.round((size / then) * 100)
  return { direction, text: `${sign}${percent < 1 ? '<1' : percent}%` }
}

export interface StockSparkline {
  line: string
  area: string
  end: { x: number, y: number }
}

/**
 * A sparkline's paths in a width × height box.
 *
 * The vertical range is never narrower than a tenth of the largest value, so
 * one unit moving in a stock of thousands stays a flat line instead of being
 * stretched into a cliff. A flat series sits in the middle.
 */
export function stockSparkline(values: number[], width: number, height: number, pad = 3): StockSparkline | null {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, max * 0.1, 1)
  const low = min - (span - (max - min)) / 2
  const step = (width - pad * 2) / (values.length - 1)

  const points = values.map((value, i) => ({
    x: pad + i * step,
    y: pad + (height - pad * 2) * (1 - (value - low) / span),
  }))

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('')
  const first = points[0]!
  const end = points[points.length - 1]!

  return {
    line,
    area: `${line}L${end.x.toFixed(1)},${height}L${first.x.toFixed(1)},${height}Z`,
    end,
  }
}

/** The parts of a stock-threshold cell a type card reads. */
export interface StockAlertCell {
  blood_type_code: string
  component_id: number
  component_name: string
  available: number
  minimum_units: number | null
  status: string
}

export interface StockTypeAlert {
  tone: 'critical' | 'warning'
  /** For a narrow card: the first component by its bag-label code, and how many more. */
  short: string
  /** Every component named, with its count against its critical level. */
  full: string
}

/**
 * What a type card says about its components against their critical levels.
 *
 * The server grades each cell: `critical` is out of stock under a critical
 * level, `low` is below the level but not empty. Out of stock outranks low.
 * The short form ("PC out", "PC +1 low") fits a card an eighth of the panel
 * wide; the full form is for the tooltip and screen readers.
 */
export function stockTypeAlert(
  cells: StockAlertCell[],
  bloodTypeCode: string,
  codes: Map<number, string>,
): StockTypeAlert | null {
  const own = cells.filter((cell) => cell.blood_type_code === bloodTypeCode)
  const out = own.filter((cell) => cell.status === 'critical')
  const low = own.filter((cell) => cell.status === 'low')

  if (!out.length && !low.length) return null

  const shortList = (list: StockAlertCell[]): string => {
    const first = codes.get(list[0]!.component_id) || list[0]!.component_name
    return list.length > 1 ? `${first} +${list.length - 1}` : first
  }
  const fullList = (list: StockAlertCell[]): string =>
    list.map((cell) => `${cell.component_name} (${cell.available} of ${cell.minimum_units ?? '—'})`).join(', ')

  const full = [
    out.length ? `Out of stock: ${fullList(out)}` : '',
    low.length ? `Below critical level: ${fullList(low)}` : '',
  ].filter(Boolean).join('. ')

  return out.length
    ? { tone: 'critical', short: `${shortList(out)} out`, full }
    : { tone: 'warning', short: `${shortList(low)} low`, full }
}

/** One row of the summary's `stock_by_blood_type`. */
export interface StockTypeRow {
  code: string
  available: number
  expiring_soon: number
  reserved: number
  quarantined: number
}

export type StockSegmentKey = 'fresh' | 'expiring' | 'reserved' | 'quarantined'

export interface StockSegment {
  key: StockSegmentKey
  count: number
}

export interface StockTypeCard {
  code: string
  /** Units that can be issued, the card's headline (expiring ones included). */
  available: number
  /** Everything on the shelf: available, held and not yet cleared. */
  onShelf: number
  /** Always all four, in the legend's order, so the counts line up across cards. */
  segments: StockSegment[]
}

/**
 * One card per blood type, in the usual order, each with its shelf split into
 * the legend's four parts. Expiring units are part of `available`, so the
 * fresh part is what is left once they are taken out. A type with no stock
 * still gets a card: a zero is information.
 */
export function stockTypeCards(rows: StockTypeRow[]): StockTypeCard[] {
  const byCode = new Map(rows.map((row) => [row.code, row]))
  const codes = [...TYPE_ORDER, ...rows.map((row) => row.code).filter((code) => !TYPE_ORDER.includes(code))]

  return codes.map((code) => {
    const row = byCode.get(code)
    const available = row?.available ?? 0
    const expiring = Math.min(row?.expiring_soon ?? 0, available)
    const reserved = row?.reserved ?? 0
    const quarantined = row?.quarantined ?? 0

    return {
      code,
      available,
      onShelf: available + reserved + quarantined,
      segments: [
        { key: 'fresh', count: available - expiring },
        { key: 'expiring', count: expiring },
        { key: 'reserved', count: reserved },
        { key: 'quarantined', count: quarantined },
      ],
    }
  })
}
