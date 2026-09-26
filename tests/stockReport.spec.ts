import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  bandClass,
  columnWidth,
  formatExpiry,
  hasDatedColumns,
  isSoon,
  logoProblem,
  slotEntries,
  stockReportFilename,
  tableSpan,
} from '~/utils/stockReport'

/**
 * The Daily Blood Stock Inventory, its facility logo, and Processing's volumes.
 *
 * What is locked in: the grid lines up the way the paper sheet does, a bare
 * expiry date is never shifted by the viewer's timezone, a logo dompdf cannot
 * print is refused before upload, each page and endpoint carries the right
 * ability, and Processing records a volume per bag rather than a count.
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

beforeEach(() => {
  fetchMock.mockReset()
})

const dated = { id: 1, name: 'Packed RBC', role: 'prbc', dated: true, shelf_life_configured: true, date_slots: 3, total: 9 }
const frozen = { id: 2, name: 'Fresh Frozen Plasma', role: 'ffp', dated: false, shelf_life_configured: true, date_slots: 0, total: 4 }

describe('laying out the sheet', () => {
  it('gives a dated component its date slots plus a total, and anything else one column', () => {
    expect(columnWidth(dated)).toBe(4)
    expect(columnWidth(frozen)).toBe(1)
  })

  it('spans the blood type column plus every component group', () => {
    const table = { key: 'rh_negative', rh: 'negative', title: 'RH NEGATIVE', columns: [dated, frozen], rows: [], total: 13 } as any

    expect(tableSpan(table)).toBe(1 + 4 + 1)
    expect(hasDatedColumns(table)).toBe(true)
    expect(hasDatedColumns({ ...table, columns: [frozen] })).toBe(false)
  })

  it('pads a row\'s expiry dates so every row of a column lines up', () => {
    const entry = { date: '2026-05-16', units: 8, expires_today: false, expires_tomorrow: false }
    const slots = slotEntries({ total: 8, by_expiry: [entry], expiring_soon: 0 }, 3)

    expect(slots).toEqual([entry, null, null])
    expect(slotEntries(undefined, 2)).toEqual([null, null])
  })

  it('bands each row by its ABO group, as the paper does', () => {
    expect(bandClass('A')).toBe('band-a')
    expect(bandClass('B')).toBe('band-b')
    expect(bandClass('O')).toBe('band-o')
    expect(bandClass('AB')).toBe('band-ab')
    expect(bandClass(null)).toBe('')
  })

  it('writes an expiry the way the sheet does, without shifting the day', () => {
    // Parsed from the string, not through Date, which would move a bare date
    // by the viewer's UTC offset.
    expect(formatExpiry('2026-05-16')).toBe('16-May')
    expect(formatExpiry('2026-04-30')).toBe('30-Apr')
    expect(formatExpiry('2026-01-01')).toBe('1-Jan')
    expect(formatExpiry('')).toBe('')
  })

  it('boxes only what expires today or tomorrow', () => {
    expect(isSoon({ date: '2026-04-30', units: 4, expires_today: true, expires_tomorrow: false })).toBe(true)
    expect(isSoon({ date: '2026-05-01', units: 9, expires_today: false, expires_tomorrow: true })).toBe(true)
    expect(isSoon({ date: '2026-05-16', units: 8, expires_today: false, expires_tomorrow: false })).toBe(false)
    expect(isSoon(null)).toBe(false)
  })

  it('names the PDF after the moment it was taken', () => {
    expect(stockReportFilename(new Date(2026, 3, 30, 8, 5))).toBe('stock-inventory-2026-04-30-0805.pdf')
  })
})

describe('the facility logo', () => {
  it('accepts PNG and JPG up to 2 MB', () => {
    expect(logoProblem({ type: 'image/png', size: 200_000 })).toBeNull()
    expect(logoProblem({ type: 'image/jpeg', size: 2 * 1024 * 1024 })).toBeNull()
  })

  it('refuses WebP, which dompdf cannot print, and anything oversized', () => {
    expect(logoProblem({ type: 'image/webp', size: 1000 })).toBe('The logo must be a PNG or JPG file.')
    expect(logoProblem({ type: 'application/pdf', size: 1000 })).toBe('The logo must be a PNG or JPG file.')
    expect(logoProblem({ type: 'image/png', size: 3 * 1024 * 1024 })).toBe('The logo must be 2 MB or smaller.')
    expect(logoProblem(null)).toBe('Choose an image to upload.')
  })

  it('is shown only to supervisors, who alone may change it', () => {
    const card = source('app/components/BloodCenter/FacilityLogoCard.vue')

    expect(card).toContain("can('center.configure')")
    expect(card).toMatch(/<section v-if="canConfigure"/)
    // The facility is never chosen on the client.
    expect(card).not.toContain('facility_id')
  })
})

describe('endpoints', () => {
  it('reads the stock report from the inventory namespace', async () => {
    fetchMock.mockResolvedValueOnce({ tables: [] })
    await bloodCenterService.stockReport()

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/inventory/stock-report')
    expect(config.method).toBe('GET')
  })

  it('downloads the PDF as a blob', async () => {
    fetchMock.mockResolvedValueOnce(new Blob(['%PDF-']))
    await bloodCenterService.downloadStockReport()

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/inventory/stock-report/pdf')
    expect(config.responseType).toBe('blob')
  })

  it('removes the facility logo on its own route', async () => {
    fetchMock.mockResolvedValueOnce({})
    await bloodCenterService.removeFacilityLogo()

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/facility/logo')
    expect(config.method).toBe('DELETE')
  })
})

describe('pages and navigation', () => {
  it('keeps the stock report with Issuance', () => {
    const page = source('app/pages/blood-center/stock-report.vue')
    const nav = source('app/composables/useBloodCenterNav.ts')

    expect(page).toContain("requires: 'inventory.create'")
    expect(nav).toMatch(/label: 'Daily Stock Report', path: '\/blood-center\/stock-report'[^}]*requires: 'inventory\.create'/)
  })

  it('records a volume per bag in Processing, not a count', () => {
    const page = source('app/pages/blood-center/laboratory.vue')

    expect(page).toContain('volume_ml: Number(row.volume_ml)')
    expect(page).not.toContain('v-model.number="row.quantity"')
    // Every row must be complete: a half-filled bag is never dropped silently.
    expect(page).toContain('componentRows.value.every(isCompleteBag)')
  })

  it('uses the renamed platelet component everywhere the hospital picks one', () => {
    for (const file of ['app/pages/hospital/bloodavailability.vue', 'app/pages/hospital/bloodrequests/index.vue']) {
      expect(source(file), file).toContain("'Platelet Concentrate'")
      expect(source(file), file).not.toContain("'Platelets'")
    }
  })
})
