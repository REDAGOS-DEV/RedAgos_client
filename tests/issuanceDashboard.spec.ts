import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  stockSparkline,
  stockTypeAlert,
  stockTypeCards,
  stockWeekChange,
  type StockAlertCell,
  type StockTrendPoint,
} from '~/utils/issuanceDashboard'

/**
 * The Issuance dashboard (blood-center/storage.vue), rebuilt from the owner's
 * mock-up on 2026-10-19.
 *
 * What is locked in: the week's change is measured against the trend's first
 * day and never prints a percentage of nothing, a sparkline does not turn one
 * unit into a cliff, every blood type gets a card whose parts add up to its
 * shelf, and the page reads only open requests and offers release only to
 * whoever can release.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

function point(date: string, levels: Partial<StockTrendPoint> = {}): StockTrendPoint {
  return { date, available: 0, expiring_soon: 0, reserved: 0, quarantined: 0, ...levels }
}

describe('stockWeekChange', () => {
  it('compares today with the first day of the trend', () => {
    const trend = [point('2026-10-12', { available: 200 }), point('2026-10-18', { available: 999 }), point('2026-10-19', { available: 224 })]
    expect(stockWeekChange(trend, 'available')).toEqual({ direction: 'up', text: '+12%' })
  })

  it('says which way it went when it fell', () => {
    const trend = [point('2026-10-12', { reserved: 8 }), point('2026-10-19', { reserved: 6 })]
    expect(stockWeekChange(trend, 'reserved')).toEqual({ direction: 'down', text: '−25%' })
  })

  it('reads flat when nothing moved', () => {
    const trend = [point('2026-10-12'), point('2026-10-19')]
    expect(stockWeekChange(trend, 'quarantined')).toEqual({ direction: 'flat', text: '0%' })
  })

  it('counts units instead of a percentage of nothing', () => {
    const one = [point('2026-10-12'), point('2026-10-19', { quarantined: 1 })]
    const many = [point('2026-10-12'), point('2026-10-19', { quarantined: 5 })]
    expect(stockWeekChange(one, 'quarantined')).toEqual({ direction: 'up', text: '+1 unit' })
    expect(stockWeekChange(many, 'quarantined')).toEqual({ direction: 'up', text: '+5 units' })
  })

  it('never rounds a real change away', () => {
    const trend = [point('2026-10-12', { available: 2725 }), point('2026-10-19', { available: 2726 })]
    expect(stockWeekChange(trend, 'available')).toEqual({ direction: 'up', text: '+<1%' })
  })

  it('has nothing to say without a week behind it', () => {
    expect(stockWeekChange([], 'available')).toBeNull()
    expect(stockWeekChange([point('2026-10-19', { available: 3 })], 'available')).toBeNull()
  })
})

describe('stockSparkline', () => {
  it('stays inside its box and ends on the last value', () => {
    const spark = stockSparkline([3, 9, 1, 6], 96, 34)!
    const ys = [...spark.line.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((m) => Number(m[1]))

    expect(ys).toHaveLength(4)
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(34)
    }
    expect(spark.end.x).toBeCloseTo(93)
    expect(spark.area.endsWith('Z')).toBe(true)
  })

  it('keeps one unit in thousands a flat line, not a cliff', () => {
    const spark = stockSparkline([2725, 2725, 2726], 96, 34)!
    const ys = [...spark.line.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((m) => Number(m[1]))

    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1)
  })

  it('draws a flat series through the middle', () => {
    const spark = stockSparkline([0, 0, 0], 96, 34)!
    expect(spark.end.y).toBeCloseTo(17)
  })

  it('needs two points to draw a line', () => {
    expect(stockSparkline([5], 96, 34)).toBeNull()
  })
})

describe('stockTypeCards', () => {
  it('gives every blood type a card, in the usual order, even with no stock', () => {
    const cards = stockTypeCards([{ code: 'O-', available: 4, expiring_soon: 0, reserved: 0, quarantined: 0 }])

    expect(cards.map((card) => card.code)).toEqual(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    expect(cards[0]!.available).toBe(0)
    expect(cards[7]!.available).toBe(4)
  })

  it('splits the shelf into parts that add up, expiring units taken out of available', () => {
    const [card] = stockTypeCards([{ code: 'A+', available: 337, expiring_soon: 10, reserved: 5, quarantined: 2 }])

    expect(card!.available).toBe(337)
    expect(card!.segments).toEqual([
      { key: 'fresh', count: 327 },
      { key: 'expiring', count: 10 },
      { key: 'reserved', count: 5 },
      { key: 'quarantined', count: 2 },
    ])
    expect(card!.onShelf).toBe(344)
    expect(card!.segments.reduce((sum, s) => sum + s.count, 0)).toBe(card!.onShelf)
  })

  it('keeps a type it does not know about, after the eight', () => {
    const cards = stockTypeCards([{ code: 'Bombay', available: 1, expiring_soon: 0, reserved: 0, quarantined: 0 }])
    expect(cards.at(-1)!.code).toBe('Bombay')
  })
})

describe('stockTypeAlert', () => {
  const codes = new Map([[4, 'PC'], [3, 'FFP'], [2, 'PRBC']])
  const cell = (overrides: Partial<StockAlertCell>): StockAlertCell => ({
    blood_type_code: 'A+', component_id: 4, component_name: 'Platelet Concentrate',
    available: 0, minimum_units: 15, status: 'critical', ...overrides,
  })

  it('names the component that is out, by its bag-label code', () => {
    expect(stockTypeAlert([cell({})], 'A+', codes)).toEqual({
      tone: 'critical',
      short: 'PC out',
      full: 'Out of stock: Platelet Concentrate (0 of 15)',
    })
  })

  it('counts the rest when more than one is out', () => {
    const alert = stockTypeAlert([
      cell({}),
      cell({ component_id: 3, component_name: 'Fresh Frozen Plasma', minimum_units: 10 }),
    ], 'A+', codes)

    expect(alert!.short).toBe('PC +1 out')
    expect(alert!.full).toBe('Out of stock: Platelet Concentrate (0 of 15), Fresh Frozen Plasma (0 of 10)')
  })

  it('lets out of stock outrank low, and still mentions the low one', () => {
    const alert = stockTypeAlert([
      cell({ component_id: 2, component_name: 'Packed RBC', available: 3, minimum_units: 10, status: 'low' }),
      cell({}),
    ], 'A+', codes)

    expect(alert!.tone).toBe('critical')
    expect(alert!.short).toBe('PC out')
    expect(alert!.full).toBe('Out of stock: Platelet Concentrate (0 of 15). Below critical level: Packed RBC (3 of 10)')
  })

  it('says low when nothing is out', () => {
    const alert = stockTypeAlert([cell({ available: 4, status: 'low' })], 'A+', codes)
    expect(alert).toEqual({ tone: 'warning', short: 'PC low', full: 'Below critical level: Platelet Concentrate (4 of 15)' })
  })

  it('falls back to the name when a component has no code', () => {
    expect(stockTypeAlert([cell({ component_id: 99, component_name: 'Granulocytes' })], 'A+', codes)!.short).toBe('Granulocytes out')
  })

  it('has nothing to say about a healthy type, or another type\'s shortage', () => {
    expect(stockTypeAlert([cell({ status: 'ok', available: 40 })], 'A+', codes)).toBeNull()
    expect(stockTypeAlert([cell({})], 'O-', codes)).toBeNull()
  })
})

describe('the page', () => {
  const page = source('app/pages/blood-center/storage.vue')

  it('lists only requests still open, in the queue\'s own order', () => {
    expect(page).toContain('incomingRequests({ open: 1, per_page: REQUEST_ROWS })')
  })

  it('offers the release queue only to someone who can release', () => {
    expect(page).toContain("can('requests.release')")
    expect(page).toMatch(/v-if="canRelease" to="\/blood-center\/fulfillment" class="btn-primary/)
  })

  it('reads the week\'s trend and the shelf by type from the summary', () => {
    expect(page).toContain('summary.value?.trend')
    expect(page).toContain('summary.value?.stock_by_blood_type')
  })

  it('keeps its dark palette on its own root', () => {
    // `:global(.dark) .iss` compiles to plain `.dark` and would repaint the app.
    const css = page.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toContain(':global(.dark .iss)')
    expect(css).not.toMatch(/:global\(\.dark\)\s+\.iss/)
  })
})
