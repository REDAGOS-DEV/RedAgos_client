import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { StockThresholdCell, StockThresholdDraft } from '~/types/stockThreshold'
import {
  cellKey,
  chipLabel,
  describeCell,
  diffDrafts,
  draftFor,
  isValidMinimum,
  minimumOf,
  orderBloodTypes,
  sortLow,
  stockStatusLabel,
  typeHealth,
  typeHealthByCode,
} from '~/utils/stockThreshold'

/**
 * Minimum stock per blood type and component, for both portals.
 *
 * What is locked in: the grid only ever sends what changed, an empty field
 * means "no minimum" rather than zero, a blood type is graded by its worst
 * monitored component, each portal's calls reach the right endpoint, and the
 * pages carry the right gates and are linked from both navigations.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

const runtimeConfig = { public: { apiBaseURL: 'http://api.test/api' } }
vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

vi.stubGlobal('localStorage', {
  store: new Map<string, string>(),
  getItem(k: string) { return this.store.get(k) ?? null },
  setItem(k: string, v: string) { this.store.set(k, v) },
  removeItem(k: string) { this.store.delete(k) },
})

const { bloodCenterService } = await import('~/api/bloodcenter/BloodCenterService')
const { hospitalService } = await import('~/api/hospital/HospitalService')

beforeEach(() => {
  fetchMock.mockReset()
})

function cell(over: Partial<StockThresholdCell> = {}): StockThresholdCell {
  return {
    blood_type_id: 1,
    blood_type_code: 'O+',
    component_id: 10,
    component_name: 'Packed RBC',
    available: 4,
    minimum_units: 10,
    alerts_enabled: true,
    status: 'low',
    shortfall: 6,
    alerted_at: null,
    updated_by: null,
    updated_at: null,
    ...over,
  }
}

function drafts(cells: StockThresholdCell[]): Record<string, StockThresholdDraft> {
  return Object.fromEntries(cells.map((c) => [cellKey(c.blood_type_id, c.component_id), draftFor(c)]))
}

describe('drafts and what gets saved', () => {
  it('starts a draft as what is saved, and an unset minimum as an empty field', () => {
    expect(draftFor(cell())).toEqual({ minimum: '10', alerts_enabled: true })
    expect(draftFor(cell({ minimum_units: null, status: 'unmonitored', shortfall: 0 }))).toEqual({ minimum: '', alerts_enabled: true })
  })

  it('reads an empty field as no minimum, never as zero', () => {
    expect(minimumOf({ minimum: '', alerts_enabled: true })).toBeNull()
    expect(minimumOf({ minimum: '   ', alerts_enabled: true })).toBeNull()
    expect(minimumOf({ minimum: '12', alerts_enabled: true })).toBe(12)
  })

  it('accepts what Vue hands back for a number input, which may be a number', () => {
    expect(minimumOf({ minimum: 12, alerts_enabled: true })).toBe(12)
    expect(isValidMinimum({ minimum: 12, alerts_enabled: true })).toBe(true)
    expect(isValidMinimum({ minimum: 0, alerts_enabled: true })).toBe(false)
  })

  it('accepts only whole numbers from 1 to 9999, or nothing', () => {
    const valid = (minimum: string) => isValidMinimum({ minimum, alerts_enabled: true })

    expect(valid('')).toBe(true)
    expect(valid('1')).toBe(true)
    expect(valid('9999')).toBe(true)
    expect(valid('0')).toBe(false)
    expect(valid('10000')).toBe(false)
    expect(valid('2.5')).toBe(false)
    expect(valid('-3')).toBe(false)
    expect(valid('abc')).toBe(false)
  })

  it('sends nothing when nothing changed', () => {
    const cells = [cell(), cell({ blood_type_id: 2, blood_type_code: 'A+' })]

    expect(diffDrafts(cells, drafts(cells))).toEqual([])
  })

  it('sends only the cells that changed', () => {
    const cells = [cell(), cell({ blood_type_id: 2, blood_type_code: 'A+', minimum_units: 5 })]
    const edited = drafts(cells)
    edited[cellKey(1, 10)]!.minimum = '15'

    expect(diffDrafts(cells, edited)).toEqual([
      { blood_type_id: 1, component_id: 10, minimum_units: 15, alerts_enabled: true },
    ])
  })

  it('sends a null minimum to clear a threshold that exists', () => {
    const cells = [cell()]
    const edited = drafts(cells)
    edited[cellKey(1, 10)]!.minimum = ''

    expect(diffDrafts(cells, edited)).toEqual([
      { blood_type_id: 1, component_id: 10, minimum_units: null, alerts_enabled: true },
    ])
  })

  it('sends a mute as a change of its own', () => {
    const cells = [cell()]
    const edited = drafts(cells)
    edited[cellKey(1, 10)]!.alerts_enabled = false

    expect(diffDrafts(cells, edited)).toEqual([
      { blood_type_id: 1, component_id: 10, minimum_units: 10, alerts_enabled: false },
    ])
  })

  it('never creates a row from a toggle on a cell that has no minimum', () => {
    const empty = cell({ minimum_units: null, status: 'unmonitored', shortfall: 0 })
    const edited = drafts([empty])
    edited[cellKey(1, 10)]!.alerts_enabled = false

    expect(diffDrafts([empty], edited)).toEqual([])
  })
})

describe('reading the grid', () => {
  it('lists blood types A, B, AB, O with negatives after positives, unknown codes last', () => {
    const codes = orderBloodTypes([{ code: 'O-' }, { code: 'XX' }, { code: 'A+' }, { code: 'AB+' }, { code: 'B-' }]).map((t) => t.code)

    expect(codes).toEqual(['A+', 'B-', 'AB+', 'O-', 'XX'])
  })

  it('orders shortages with empty shelves first, then the biggest gap', () => {
    const low = [
      cell({ blood_type_code: 'B+', blood_type_id: 3, shortfall: 2 }),
      cell({ blood_type_code: 'A+', blood_type_id: 2, shortfall: 9 }),
      cell({ blood_type_code: 'O-', blood_type_id: 4, status: 'critical', available: 0, shortfall: 1 }),
      cell({ blood_type_code: 'AB+', blood_type_id: 5, status: 'ok', shortfall: 0 }),
    ]

    expect(sortLow(low).map((c) => c.blood_type_code)).toEqual(['O-', 'A+', 'B+'])
  })

  it('grades a blood type by its worst monitored component', () => {
    const cells = [
      cell({ component_id: 10, status: 'ok', shortfall: 0 }),
      cell({ component_id: 11, status: 'low' }),
      cell({ component_id: 12, status: 'unmonitored', minimum_units: null, shortfall: 0 }),
      cell({ blood_type_id: 2, blood_type_code: 'A+', component_id: 10, status: 'ok', shortfall: 0 }),
      cell({ blood_type_id: 3, blood_type_code: 'B+', component_id: 10, status: 'critical', available: 0 }),
      cell({ blood_type_id: 3, blood_type_code: 'B+', component_id: 11, status: 'low' }),
      cell({ blood_type_id: 4, blood_type_code: 'AB+', component_id: 10, status: 'unmonitored', minimum_units: null, shortfall: 0 }),
    ]

    expect(typeHealth(cells, 1)).toBe('low')
    expect(typeHealth(cells, 2)).toBe('ok')
    expect(typeHealth(cells, 3)).toBe('critical')
    // Nothing monitored is not the same as healthy.
    expect(typeHealth(cells, 4)).toBe('unmonitored')
    expect(typeHealth(cells, 99)).toBe('unmonitored')
  })

  it('looks a blood type up by the code the inventory summary uses', () => {
    const cells = [cell({ blood_type_code: 'O+', status: 'low' })]

    expect(typeHealthByCode(cells, 'O+')).toBe('low')
    expect(typeHealthByCode(cells, 'AB-')).toBe('unmonitored')
    expect(typeHealthByCode([], 'O+')).toBe('unmonitored')
  })

  it('names a shortage the way a chip and a sentence do', () => {
    expect(describeCell(cell())).toBe('O+ Packed RBC — 4 of 10')
    expect(chipLabel(cell())).toBe('O+ Packed RBC 4/10')
    expect(chipLabel(cell(), { 10: 'PRBC' })).toBe('O+ PRBC 4/10')
  })

  it('labels every level', () => {
    expect(stockStatusLabel('ok')).toBe('Healthy')
    expect(stockStatusLabel('low')).toBe('Low')
    expect(stockStatusLabel('critical')).toBe('Out of stock')
    expect(stockStatusLabel('unmonitored')).toBe('Not monitored')
  })
})

describe('endpoints', () => {
  it('reads and saves a centre\'s thresholds under its inventory namespace', async () => {
    fetchMock.mockResolvedValue({})
    await bloodCenterService.stockThresholds()
    await bloodCenterService.saveStockThresholds({ thresholds: [{ blood_type_id: 1, component_id: 2, minimum_units: 5 }] })

    const [readUrl, readConfig] = fetchMock.mock.calls[0]!
    const [saveUrl, saveConfig] = fetchMock.mock.calls[1]!

    expect(readUrl).toBe('/blood-center/inventory/thresholds')
    expect(readConfig.method).toBe('GET')
    expect(saveUrl).toBe('/blood-center/inventory/thresholds')
    expect(saveConfig.method).toBe('PUT')
    expect(saveConfig.body).toEqual({ thresholds: [{ blood_type_id: 1, component_id: 2, minimum_units: 5 }] })
  })

  it('reads and saves a hospital\'s thresholds under its own inventory namespace', async () => {
    fetchMock.mockResolvedValue({})
    await hospitalService.stockThresholds()
    await hospitalService.saveStockThresholds({ thresholds: [{ blood_type_id: 1, component_id: 2, minimum_units: null }] })

    const [readUrl, readConfig] = fetchMock.mock.calls[0]!
    const [saveUrl, saveConfig] = fetchMock.mock.calls[1]!

    expect(readUrl).toBe('/hospital/inventory/thresholds')
    expect(readConfig.method).toBe('GET')
    expect(saveUrl).toBe('/hospital/inventory/thresholds')
    expect(saveConfig.method).toBe('PUT')
    expect(saveConfig.body).toEqual({ thresholds: [{ blood_type_id: 1, component_id: 2, minimum_units: null }] })
  })

  it('never puts the facility in a request: it comes from the token', () => {
    for (const file of ['app/api/bloodcenter/BloodCenterService.ts', 'app/api/hospital/HospitalService.ts']) {
      const service = source(file)
      const block = service.slice(service.indexOf('stockThresholds'), service.indexOf('saveStockThresholds') + 300)

      expect(block, file).not.toContain('facility_id')
    }
  })
})

describe('pages and navigation', () => {
  it('lets anyone who can see the inventory open the centre page, and only the right post edit it', () => {
    const page = source('app/pages/blood-center/stock-thresholds.vue')

    expect(page).toContain("requires: 'inventory.view'")
    expect(page).toContain("middleware: ['auth', 'department']")
    expect(page).toContain("layout: 'blood-centerdashboard'")
    expect(page).toContain(":editable=\"can('inventory.thresholds')\"")
  })

  it('opens the hospital page to every blood-bank account, always editable', () => {
    const page = source('app/pages/hospital/stock-thresholds.vue')

    expect(page).toContain("middleware: ['auth', 'hospital-portal']")
    expect(page).toContain("layout: 'hospitaldashboard'")
    expect(page).toMatch(/^\s+editable$/m)
  })

  it('links the centre page from the Issuance navigation under the ability the server checks', () => {
    const nav = source('app/composables/useBloodCenterNav.ts')

    expect(nav).toMatch(/label: 'Stock Thresholds', path: '\/blood-center\/stock-thresholds'[^}]*requires: 'inventory\.view'/)
  })

  it('links the hospital page from its sidebar, its search and its breadcrumb', () => {
    expect(source('app/components/Hospital/Sidebar.vue')).toContain("path: '/hospital/stock-thresholds'")

    const layout = source('app/layouts/hospitaldashboard.vue')
    expect(layout).toContain("label: 'Stock Thresholds', path: '/hospital/stock-thresholds'")
    expect(layout).toContain("'/hospital/stock-thresholds': 'Stock Thresholds'")
  })

  it('shows the banner on every screen that watches the shelf, linking to the right page', () => {
    const centre = ['inventory', 'storage', 'dashboard']
    const hospital = ['inventory', 'dashboard']

    for (const page of centre) {
      const file = source(`app/pages/blood-center/${page}.vue`)

      expect(file, page).toContain('<LowStockBanner :cells="lowStock" to="/blood-center/stock-thresholds"')
      expect(file, page).toContain('stockThresholds(')
    }

    for (const page of hospital) {
      const file = source(`app/pages/hospital/${page}.vue`)

      expect(file, page).toContain('<LowStockBanner :cells="lowStock" to="/hospital/stock-thresholds"')
      expect(file, page).toContain('hospitalService.stockThresholds(')
    }
  })

  it('never lets a failed threshold load take a page down with it', () => {
    // A load that is only a convenience must not be able to blank the page.
    expect(source('app/pages/blood-center/inventory.vue')).toContain('bloodCenterService.stockThresholds().catch(() => null)')
    expect(source('app/pages/blood-center/storage.vue')).toContain("console.error('Failed to load stock thresholds:'")
  })

  it('grades the inventory page by the facility\'s minimums instead of inventing a threshold', () => {
    const page = source('app/pages/blood-center/inventory.vue')

    expect(page).toContain('typeHealthByCode(stockCells.value, code)')
    expect(page).not.toContain('Grading "low" needs a per-type minimum')
  })

  it('keeps the panel\'s props apart from its own functions', () => {
    // `load`/`save` used to be both a prop and a function, so the Refresh
    // button called the prop and the screen never reloaded.
    const panel = source('app/components/common/StockThresholdsPanel.vue')

    expect(panel).toContain('fetchStatus: () => Promise<StockThresholdStatus>')
    expect(panel).toContain('saveStatus: (_payload: SaveStockThresholdsPayload)')
    expect(panel).toContain('@click="loadStatus(false)"')
    expect(panel).not.toMatch(/\bload: \(\)/)
    expect(panel).not.toMatch(/props\.(load|save)\b/)

    for (const file of ['app/pages/blood-center/stock-thresholds.vue', 'app/pages/hospital/stock-thresholds.vue']) {
      const page = source(file)

      expect(page, file).toContain(':fetch-status=')
      expect(page, file).toContain(':save-status=')
      expect(page, file).not.toMatch(/ :(load|save)=/)
    }
  })

  it('exports no name another util or composable already exports', () => {
    // Nuxt auto-imports every export of app/utils and app/composables into one
    // global namespace, and on a clash the later file silently wins. `statusLabel`
    // here once displaced the one in useBloodRequestDetails for every page that
    // relied on the auto-import.
    const EXPORT_RE = /export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g
    const dirs = ['app/utils', 'app/composables']
    const ours = new Set(['app/utils/stockThreshold.ts', 'app/utils/hospitalNotifications.ts', 'app/composables/useHospitalUnreadCount.ts'])

    const exportsOf = (file: string) => [...source(file).matchAll(EXPORT_RE)].map((m) => m[1]!)
    const files = dirs.flatMap((dir) =>
      readdirSync(path.join(root, dir))
        .filter((name) => /\.(ts|js)$/.test(name))
        .map((name) => `${dir}/${name}`),
    )

    const clashes: string[] = []

    for (const file of ours) {
      for (const name of exportsOf(file)) {
        for (const other of files.filter((f) => f !== file)) {
          if (exportsOf(other).includes(name)) clashes.push(`${name}: ${file} and ${other}`)
        }
      }
    }

    expect(clashes).toEqual([])
  })

  it('keeps the grid\'s notification toggle labelled and its state off colour alone', () => {
    const grid = source('app/components/common/StockThresholdGrid.vue')

    expect(grid).toContain(':aria-pressed=')
    expect(grid).toContain('notifications ${item.draft.alerts_enabled')
    // The mute is drawn as a slash, not just a dimmer bell.
    expect(grid).toContain('.bell--muted::after')
  })
})
