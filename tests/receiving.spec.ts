import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  UNIT_NUMBER_PATTERN,
  awaitingBagsFor,
  isRequestDay,
  isoWeekdayOf,
  matchScannedBag,
  normalizeUnitNumber,
  receiptsByRequest,
  scheduleSummary,
  sortedWeekdays,
} from '~/utils/receiving'

const root = path.resolve(__dirname, '..')
const source = (file: string) => readFileSync(path.join(root, file), 'utf8')

describe('external unit identifiers', () => {
  it('normalises a typed number the way a scanned barcode is', () => {
    expect(normalizeUnitNumber(' prc-920923323 ')).toBe('PRC-920923323')
    expect(normalizeUnitNumber('PRC-92092\t3323\r\n')).toBe('PRC-920923323')
    expect(normalizeUnitNumber(null)).toBe('')
  })

  it('accepts letters, numbers and dashes up to fifty characters', () => {
    expect(UNIT_NUMBER_PATTERN.test('PRC-920923323')).toBe(true)
    expect(UNIT_NUMBER_PATTERN.test('PRC_920923323')).toBe(false)
    expect(UNIT_NUMBER_PATTERN.test('A'.repeat(50))).toBe(true)
    expect(UNIT_NUMBER_PATTERN.test('A'.repeat(51))).toBe(false)
  })
})

describe('request days', () => {
  it('orders days Monday first and drops strays', () => {
    expect(sortedWeekdays([5, 1, 3, 3, 9, 0, '2'])).toEqual([1, 2, 3, 5])
  })

  it('names the days for a label', () => {
    expect(scheduleSummary([5, 1, 3])).toBe('Mon · Wed · Fri')
    expect(scheduleSummary([])).toBe('No request days')
  })

  it('says whether a weekday is a request day', () => {
    expect(isRequestDay([1, 3, 5], 3)).toBe(true)
    expect(isRequestDay([1, 3, 5], 2)).toBe(false)
  })

  it('reads a request day as a calendar date, whatever the browser timezone', () => {
    expect(isoWeekdayOf('2026-10-05')).toBe(1)
    expect(isoWeekdayOf('2026-10-11')).toBe(7)
  })
})

describe('receiving a dispatched delivery by scan', () => {
  const awaiting = [
    { allocation_id: 11, request_id: 1, unit_id: '1234567-PRBC' },
    { allocation_id: 12, request_id: 1, unit_id: '1234568-PRBC' },
    { allocation_id: 21, request_id: 2, unit_id: '7654321-FFP' },
  ]

  it('ticks a scanned bag that is on the delivery', () => {
    expect(matchScannedBag(awaiting, new Set(), '1234567-prbc\r')).toEqual({ kind: 'matched', bag: awaiting[0] })
  })

  it('says so when a bag is scanned twice rather than counting it again', () => {
    expect(matchScannedBag(awaiting, new Set([11]), '1234567-PRBC').kind).toBe('already_scanned')
  })

  it('treats a number that was not dispatched as unknown, which Direct Distribution books as external', () => {
    expect(matchScannedBag(awaiting, new Set(), 'PRC-920923323')).toEqual({ kind: 'unknown', unit_id: 'PRC-920923323' })
    expect(matchScannedBag(awaiting, new Set(), '   ').kind).toBe('empty')
  })

  it('confirms per blood request, naming only the bags that arrived', () => {
    const groups = receiptsByRequest(awaiting, new Set([11, 21]))

    expect([...groups]).toEqual([[1, [11]], [2, [21]]])
  })
})

describe('the bags dispatched for a patient', () => {
  const allocations = [
    {
      id: 5,
      blood_type: { code: 'O+' },
      items: [{ id: 50, component: { name: 'Packed RBC' } }],
      allocations: [
        { id: 501, request_item_id: 50, unit_id: '111-PRBC', status: 'released', received_at: null, expiry_date: '2026-11-01', released_at: '2026-10-05T01:00:00Z' },
        { id: 502, request_item_id: 50, unit_id: '112-PRBC', status: 'released', received_at: '2026-10-05T02:00:00Z' },
        { id: 503, request_item_id: 50, unit_id: '113-PRBC', status: 'allocated', received_at: null },
      ],
    },
  ]

  it('lists only the units dispatched and not yet received', () => {
    expect(awaitingBagsFor(allocations)).toEqual([
      {
        allocation_id: 501,
        request_id: 5,
        unit_id: '111-PRBC',
        blood_type: 'O+',
        component: 'Packed RBC',
        expiry_date: '2026-11-01',
        released_at: '2026-10-05T01:00:00Z',
      },
    ])
  })

  it('is empty before a patient is chosen', () => {
    expect(awaitingBagsFor(null)).toEqual([])
    expect(awaitingBagsFor(undefined)).toEqual([])
  })
})

describe('the receiving routes and pages', () => {
  const service = source('app/api/hospital/HospitalService.ts')

  it('calls each receiving route', () => {
    for (const route of [
      "'/hospital/replenishment-schedules'",
      '/hospital/replenishment-schedules/${targetFacilityId}`',
      "'/hospital/weekly-requests/status'",
      "'/hospital/weekly-requests'",
      '/hospital/weekly-requests/${id}`',
      "'/hospital/direct-distributions'",
      "'/hospital/external-blood-sources'",
    ]) {
      expect(service).toContain(route)
    }
  })

  it('has no replenishment request of its own any more', () => {
    expect(service).not.toContain('createRequest(')
    expect(service).not.toContain("'/hospital/blood-requests',\n      'POST'")
  })

  it('puts both pages under Receiving in the sidebar, the breadcrumb and the search', () => {
    const sidebar = source('app/components/Hospital/Sidebar.vue')
    expect(sidebar).toContain("label: 'Receiving'")
    expect(sidebar).toContain("{ label: 'Weekly Request', path: '/hospital/receiving/weekly'")
    expect(sidebar).toContain("path: '/hospital/receiving/direct-distribution'")
    expect(sidebar).not.toContain('Replenishment')

    const layout = source('app/layouts/hospitaldashboard.vue')
    expect(layout).toContain("'/hospital/receiving/weekly': 'Receiving / Weekly Request'")
    expect(layout).toContain("'/hospital/receiving/direct-distribution': 'Receiving / Direct Distribution'")
  })

  it('makes every receiving page a hospital portal page', () => {
    for (const page of [
      'app/pages/hospital/receiving/weekly/index.vue',
      'app/pages/hospital/receiving/weekly/new.vue',
      'app/pages/hospital/receiving/weekly/[id].vue',
      'app/pages/hospital/receiving/direct-distribution/index.vue',
    ]) {
      expect(source(page)).toContain("definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })")
    }
  })
})

describe('the weekly request form', () => {
  const form = source('app/pages/hospital/receiving/weekly/new.vue')

  it('asks for a date, component, blood type and units, and no indication', () => {
    const template = form.slice(0, form.indexOf('<script'))

    expect(template).toContain('Request date')
    expect(template).toContain('Blood component')
    expect(template).toContain('Blood type')
    expect(template).toContain('Number of units')
    expect(template.toLowerCase()).not.toContain('indication')
    expect(form).not.toContain('indication_code')
  })

  it('does not use a class name Tailwind also defines, which broke the Blood Type alignment', () => {
    expect(form).not.toMatch(/class="grid"/)
    expect(form).not.toMatch(/^\.grid\b/m)
  })

  it('sends the lines to the API', () => {
    expect(form).toContain('hospitalService.createWeeklyRequest(')
    expect(form).toContain('lines: lines.value.map')
  })

  it('shows requested and supplied separately on the detail page', () => {
    const detail = source('app/pages/hospital/receiving/weekly/[id].vue')

    expect(detail).toContain('>Requested</th>')
    expect(detail).toContain('>Supplied</th>')
    expect(detail).toContain('>Not supplied</th>')
    expect(detail).toContain('item.fulfilled_quantity')
  })
})

describe('direct distribution', () => {
  const page = source('app/pages/hospital/receiving/direct-distribution/index.vue')

  it('is tied to a patient transfusion request', () => {
    expect(page).toContain('hospitalService.listTransfusionRequests(')
    expect(page).toContain('transfusion_request_id: ptr.value.id')
  })

  it('offers a scan action and an optional typed external identifier', () => {
    expect(page).toContain('Scan Blood Unit')
    expect(page).toContain('External unit identifier')
    expect(page).toContain('Typing is optional')
  })

  it('confirms a dispatched RedAgos bag through its request and books anything else as external', () => {
    expect(page).toContain('hospitalService.confirmReceipt(bag.request_id, [bag.allocation_id])')
    expect(page).toContain('hospitalService.receiveDirectDistribution(')
  })

  it('records the source facility from a pick list, and who received it', () => {
    expect(page).toContain('Source facility')
    expect(page).toContain('hospitalService.externalBloodSources()')
    expect(page).toContain('Receiving staff')
  })

  it('offers a second way in with no request and no scanner: identifier, how many units, who requested it', () => {
    const template = page.slice(0, page.indexOf('<script'))

    expect(template).toContain('Without a request')
    expect(template).toContain('Number of units received')
    expect(template).toContain('Requested by / patient')
    expect(page).toContain("requested_for: batch.requested_for")
    expect(page).toContain('quantity: Number(batch.quantity)')
  })

  it('never generates a barcode of its own', () => {
    expect(page.toLowerCase()).not.toContain('generate')
  })
})

describe('replenishment lives only in the weekly request', () => {
  it('removes the replenishment option and endpoint call from New Request', () => {
    const form = source('app/pages/hospital/bloodrequests/newrequest.vue')

    expect(form).not.toContain("'replenishment'")
    expect(form).not.toContain('sendReplenishment')
    expect(form).not.toContain('createRequest(')
  })

  it('shows the external number wherever a bag is listed', () => {
    expect(source('app/pages/hospital/inventory.vue')).toContain('unit.bag_number || unit.unit_id')
  })

  it('dispatches a weekly request whole', () => {
    expect(source('app/pages/blood-center/fulfillment.vue'))
      .toContain('request.selected.length && !request.weekly_request ? request.selected : undefined')
  })
})
