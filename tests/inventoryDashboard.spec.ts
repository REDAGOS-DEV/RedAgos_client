import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { StockThresholdCell } from '~/types/stockThreshold'
import {
  activityKindMeta,
  daysLeftLabel,
  isRareBloodType,
  orderDashboardTypes,
  pageWindow,
  remainingDaysTag,
  timeAgo,
  typeCoverage,
  unitAvailability,
  unitStatusTag,
} from '~/utils/inventoryDashboard'

/**
 * The Blood Inventory dashboard.
 *
 * What is locked in: a type's ring measures its minimums and cannot be inflated
 * by a surplus in one component, a unit's status and availability read the same
 * way everywhere, the page reaches the centre's own endpoints without ever
 * naming a facility, and it keeps the behaviours other features depend on.
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

function cell(over: Partial<StockThresholdCell> = {}): StockThresholdCell {
  return {
    blood_type_id: 1,
    blood_type_code: 'O+',
    component_id: 1,
    component_name: 'Packed RBC',
    available: 0,
    minimum_units: null,
    alerts_enabled: true,
    status: 'unmonitored',
    shortfall: 0,
    alerted_at: null,
    updated_by: null,
    updated_at: null,
    ...over,
  }
}

describe('blood type cards', () => {
  it('lays the types out positives first, then negatives', () => {
    const codes = ['A-', 'AB+', 'O-', 'B+', 'A+', 'O+', 'AB-', 'B-'].map((code) => ({ code }))

    expect(orderDashboardTypes(codes).map((t) => t.code)).toEqual(['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'])
  })

  it('marks every Rh-negative type as rare', () => {
    expect(['O-', 'A-', 'B-', 'AB-'].every(isRareBloodType)).toBe(true)
    expect(['O+', 'A+', 'B+', 'AB+'].some(isRareBloodType)).toBe(false)
  })

  it('has no ring value for a type with no minimum set', () => {
    expect(typeCoverage([cell({ available: 40 })], 1)).toBeNull()
  })

  it('does not let a surplus in one component hide an empty shelf in another', () => {
    const cells = [
      cell({ component_id: 1, available: 500, minimum_units: 10, status: 'ok' }),
      cell({ component_id: 2, available: 0, minimum_units: 10, status: 'critical' }),
    ]

    expect(typeCoverage(cells, 1)).toBe(50)
  })

  it('reads 100 only when every minimum is met', () => {
    expect(typeCoverage([cell({ available: 9, minimum_units: 10 }), cell({ component_id: 2, available: 1000, minimum_units: 1000 })], 1)).toBe(99)
    expect(typeCoverage([cell({ available: 10, minimum_units: 10 })], 1)).toBe(100)
  })

  it('counts only the type asked about', () => {
    const cells = [
      cell({ available: 5, minimum_units: 10 }),
      cell({ blood_type_id: 2, blood_type_code: 'A+', available: 0, minimum_units: 10 }),
    ]

    expect(typeCoverage(cells, 1)).toBe(50)
  })
})

describe('unit status', () => {
  it('calls an available unit within a week of its date Expiring Soon', () => {
    expect(unitStatusTag('available', 7).label).toBe('Expiring Soon')
    expect(unitStatusTag('available', 0).label).toBe('Expiring Soon')
    expect(unitStatusTag('available', 8).label).toBe('Available')
    // Held units are not the ones to issue next, whatever their date.
    expect(unitStatusTag('reserved', 2).label).toBe('Reserved')
  })

  it('colours only health: green, amber, red, and neutral for everything else', () => {
    const tones = ['available', 'reserved', 'quarantined', 'issued', 'expired', 'discarded']
      .flatMap((status) => [unitStatusTag(status, 30).tone, unitAvailability(status).tone])
      .concat(['booked_in', 'released', 'reserved', 'issued', 'discarded'].map((kind) => activityKindMeta(kind).tone))

    expect(new Set(tones)).toEqual(new Set(['success', 'warning', 'danger', 'neutral', 'muted'].filter((t) => tones.includes(t as never))))
    expect(tones.every((t) => ['success', 'warning', 'danger', 'neutral', 'muted'].includes(t))).toBe(true)
    expect(unitStatusTag('expired', -1).tone).toBe('danger')
    expect(activityKindMeta('discarded').tone).toBe('danger')
  })

  it('says whether a unit can be handed out', () => {
    expect(unitAvailability('available').label).toBe('In Stock')
    expect(unitAvailability('reserved').label).toBe('Reserved')
    expect(unitAvailability('quarantined').label).toBe('On Hold')
    for (const status of ['issued', 'expired', 'discarded']) {
      expect(unitAvailability(status).label).toBe('Not Available')
    }
  })

  it('counts no days left on a unit that has gone', () => {
    expect(remainingDaysTag('issued', 12).label).toBe('—')
    expect(remainingDaysTag('discarded', 12).label).toBe('—')
    expect(remainingDaysTag('expired', -2).label).toBe('Expired')
    expect(remainingDaysTag('available', 0).label).toBe('Today')
    expect(remainingDaysTag('available', 1).label).toBe('1 day')
    expect(remainingDaysTag('available', 5)).toEqual({ label: '5 days', tone: 'warning' })
    expect(remainingDaysTag('available', 2).tone).toBe('danger')
    expect(remainingDaysTag('available', 30).tone).toBe('neutral')
  })

  it('words the expiring panel\'s pill', () => {
    expect(daysLeftLabel(0)).toBe('Expires today')
    expect(daysLeftLabel(1)).toBe('1 day left')
    expect(daysLeftLabel(6)).toBe('6 days left')
  })
})

describe('pagination', () => {
  it('draws every page when there are few', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('keeps the first and last page and the current one with its neighbours', () => {
    expect(pageWindow(1, 186)).toEqual([1, 2, 3, 4, '…', 186])
    expect(pageWindow(50, 186)).toEqual([1, '…', 49, 50, 51, '…', 186])
    expect(pageWindow(186, 186)).toEqual([1, '…', 183, 184, 185, 186])
  })
})

describe('activity', () => {
  const now = Date.parse('2026-10-16T12:00:00Z')

  it('says how long ago something happened', () => {
    expect(timeAgo('2026-10-16T11:59:30Z', now)).toBe('Just now')
    expect(timeAgo('2026-10-16T11:55:00Z', now)).toBe('5 minutes ago')
    expect(timeAgo('2026-10-16T10:00:00Z', now)).toBe('2 hours ago')
    expect(timeAgo('2026-10-15T12:00:00Z', now)).toBe('1 day ago')
    expect(timeAgo(null, now)).toBe('')
  })

  it('names every kind the server sends, and survives one it does not know', () => {
    for (const kind of ['booked_in', 'released', 'reserved', 'issued', 'hold_returned', 'updated', 'reinstated', 'discarded', 'expired']) {
      expect(activityKindMeta(kind).label).not.toBe('Updated')
    }
    expect(activityKindMeta('something_new').label).toBe('Updated')
  })

  it('reads the centre\'s activity, optionally for one unit, from its own endpoint', async () => {
    fetchMock.mockResolvedValue({ data: [] })

    await bloodCenterService.inventoryActivity({ unit_id: 'RA1-1-01', per_page: 50 })

    const [url, config] = fetchMock.mock.calls[0]!
    expect(url).toBe('/blood-center/inventory/activity')
    expect(config.method).toBe('GET')
    expect(config.params).toEqual({ unit_id: 'RA1-1-01', per_page: 50 })
  })
})

describe('the inventory page', () => {
  const page = source('app/pages/blood-center/inventory.vue')

  it('never names a facility: the server scopes every read to the signed-in centre', () => {
    expect(page).not.toMatch(/facility_id\s*:/)
    expect(page).not.toContain('facilityId')
  })

  it('pages the unit list on the server rather than slicing one download', () => {
    expect(page).toContain('bloodCenterService.inventory(unitParams(page))')
    expect(page).toContain('per_page: PAGE_SIZE')
    expect(page).not.toContain('per_page: 100')
  })

  it('fills its panels from real endpoints, failing each one on its own', () => {
    expect(page).toContain('bloodCenterService.inventorySummary()')
    expect(page).toContain('bloodCenterService.inventory({ expiring_within_days: 7, per_page: 6 }).catch(() => null)')
    expect(page).toContain('bloodCenterService.inventoryActivity({ per_page: 6 }).catch(() => null)')
  })

  it('offers each action only to the posts the server admits', () => {
    expect(page).toContain("const canRegisterUnits = computed(() => can('inventory.create'))")
    expect(page).toContain("const canDiscardUnits = computed(() => can('inventory.discard'))")
    expect(page).toContain('v-if="canRegisterUnits" to="/blood-center/inventory-intake"')
  })

  it('keeps its dark palette on the page, never on <html>', () => {
    // Vue compiles `:global(.dark) .x` to plain `.dark`: the page's tokens
    // would land on the root element and repaint the header and sidebar.
    const style = page.split('<style')[1] ?? ''

    expect(style).toContain(':global(.dark .inv-tones)')
    expect(style).not.toMatch(/^\s*:global\(\.dark\)\s+[^\s`]/m)
  })

  it('keeps colour for state only, never as a container background', () => {
    const style = page.split('<style')[1] ?? ''

    expect(style).not.toMatch(/background:[^;]*rgba\(var\(--rb-(success|warning|accent|primary|purple|teal)-rgb\)/)
    expect(style).not.toMatch(/background:\s*var\(--rb-(primary|accent|purple|teal)\)/)
  })

  it('discards with a stated reason, through a dialog rather than a browser prompt', () => {
    expect(page).toContain('bloodCenterService.discardBloodUnit(row.id, { reason })')
    expect(page).not.toContain('window.prompt')
  })
})
