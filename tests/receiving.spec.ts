import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
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
import { handoverWhen, requestStage, supplyPlanSummary } from '~/types/bloodRequest'

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

  it('treats a number that was not dispatched as unknown', () => {
    expect(matchScannedBag(awaiting, new Set(), 'PRC-920923323')).toEqual({ kind: 'unknown', unit_id: 'PRC-920923323' })
    expect(matchScannedBag(awaiting, new Set(), '   ').kind).toBe('empty')
  })

  it('confirms per blood request, naming only the bags that arrived', () => {
    const groups = receiptsByRequest(awaiting, new Set([11, 21]))

    expect([...groups]).toEqual([[1, [11]], [2, [21]]])
  })
})

describe('the bags on their way', () => {
  const requests = [
    {
      id: 5,
      target_facility: { name: 'Davao Blood Center' },
      blood_type: { code: 'O+' },
      items: [
        { id: 50, component: { name: 'Packed RBC' } },
        { id: 51, blood_type: { code: 'A+' }, component: { name: 'Fresh Frozen Plasma' } },
      ],
      allocations: [
        { id: 501, request_item_id: 50, unit_id: '111-PRBC', status: 'released', received_at: null, expiry_date: '2026-11-01', released_at: '2026-10-05T01:00:00Z' },
        { id: 502, request_item_id: 50, unit_id: '112-PRBC', status: 'released', received_at: '2026-10-05T02:00:00Z' },
        { id: 503, request_item_id: 50, unit_id: '113-PRBC', status: 'allocated', received_at: null },
        { id: 504, request_item_id: 51, unit_id: '114-FFP', status: 'released', received_at: null },
      ],
    },
  ]

  it('lists only the units dispatched and not yet received, with the center that sent them', () => {
    expect(awaitingBagsFor(requests)).toEqual([
      {
        allocation_id: 501,
        request_id: 5,
        unit_id: '111-PRBC',
        blood_type: 'O+',
        component: 'Packed RBC',
        centre: 'Davao Blood Center',
        expiry_date: '2026-11-01',
        released_at: '2026-10-05T01:00:00Z',
      },
      {
        allocation_id: 504,
        request_id: 5,
        unit_id: '114-FFP',
        blood_type: 'A+',
        component: 'Fresh Frozen Plasma',
        centre: 'Davao Blood Center',
        expiry_date: null,
        released_at: null,
      },
    ])
  })

  it('is empty before anything is loaded', () => {
    expect(awaitingBagsFor(null)).toEqual([])
    expect(awaitingBagsFor(undefined)).toEqual([])
  })
})

describe('receiving a whole delivery from the lists (project owner, 2026-10-30)', () => {
  const dialog = source('app/components/Hospital/ReceiveDeliveryDialog.vue')

  it('offers Receive on a row only while units are on their way, to whoever confirms receipt', () => {
    const patients = source('app/pages/hospital/bloodrequests/index.vue')
    expect(patients).toContain('v-if="canReceive && req.awaiting_receipt"')
    expect(patients).toContain('awaiting_receipt: r.totals?.awaiting_receipt ?? 0,')
    expect(patients).toContain('kind="transfusion"')

    const weekly = source('app/pages/hospital/receiving/weekly/index.vue')
    expect(weekly).toContain('v-if="canReceive && weekly.totals.awaiting_receipt"')
    expect(weekly).toContain('kind="weekly"')

    for (const page of [patients, weekly]) {
      expect(page).toContain("const canReceive = computed(() => can('hospital.receipt.confirm'))")
      expect(page).toContain('<HospitalReceiveDeliveryDialog')
    }
  })

  it('lists the bags, then confirms every one, one call per blood request', () => {
    expect(dialog).toContain('hospitalService.showWeeklyRequest(props.requestId)')
    expect(dialog).toContain('hospitalService.showTransfusionRequest(props.requestId)')
    expect(dialog).toContain('const bags = computed(() => awaitingBagsFor(requests.value))')
    expect(dialog).toContain('receiptsByRequest(bags.value, everyBag)')
    expect(dialog).toContain('hospitalService.confirmReceipt(requestId, allocationIds)')
  })

  it('says the bags are at Stock Intake and leads there', () => {
    expect(dialog).toContain('at Stock Intake for a storage location')
    expect(dialog).toContain('to="/hospital/stock-intake"')
  })

  it('is a dialog of its own, contained and closed by Escape', () => {
    expect(dialog).toContain('v-focus-trap')
    expect(dialog).toContain('@dialog-escape="!busy && $emit(\'close\')"')
  })

  it('reads the weekly request\'s bags through the same helper', () => {
    expect(source('app/pages/hospital/receiving/weekly/[id].vue')).toContain('const awaiting = computed(() => awaitingBagsFor(weekly.value?.requests))')
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
    ]) {
      expect(service).toContain(route)
    }
  })

  it('has no replenishment request of its own any more', () => {
    expect(service).not.toContain('createRequest(')
    expect(service).not.toContain("'/hospital/blood-requests',\n      'POST'")
  })

  it('puts Patient Request and Weekly Request under Receiving in the sidebar, the breadcrumb and the search', () => {
    const sidebar = source('app/components/Hospital/Sidebar.vue')
    expect(sidebar).toContain("label: 'Receiving'")
    expect(sidebar).toContain("{ label: 'Patient Request', path: '/hospital/bloodrequests'")
    expect(sidebar).toContain("{ label: 'Weekly Request', path: '/hospital/receiving/weekly'")
    expect(sidebar).not.toContain('Replenishment')

    const layout = source('app/layouts/hospitaldashboard.vue')
    expect(layout).toContain("'/hospital/bloodrequests': 'Receiving / Patient Request'")
    expect(layout).toContain("{ label: 'Patient Request', path: '/hospital/bloodrequests'")
    expect(layout).toContain("'/hospital/receiving/weekly': 'Receiving / Weekly Request'")
  })

  it('has no Direct Distribution page, link or search entry (project owner, 2026-10-30)', () => {
    expect(existsSync(path.join(root, 'app/pages/hospital/receiving/direct-distribution'))).toBe(false)
    for (const file of [
      'app/components/Hospital/Sidebar.vue',
      'app/layouts/hospitaldashboard.vue',
      'app/pages/hospital/transfusion-requests/[id].vue',
    ]) {
      expect(source(file)).not.toContain('/hospital/receiving/direct-distribution')
    }
  })

  it('puts Request Days under Facility Settings in the sidebar, the breadcrumb and the search', () => {
    const sidebar = source('app/components/Hospital/Sidebar.vue')
    expect(sidebar).toMatch(/label: 'Facility Settings',\s*items: \[\s*\{ label: 'Request Days', path: '\/hospital\/request-days'/)
    expect(sidebar).toContain("'Facility Settings': 'building-2'")

    const layout = source('app/layouts/hospitaldashboard.vue')
    expect(layout).toContain("'/hospital/request-days': 'Facility Settings / Request Days'")
    expect(layout).toContain("{ label: 'Request Days', path: '/hospital/request-days'")
  })

  it('keeps the request days on their own page, and only today\'s status on Weekly Request', () => {
    const days = source('app/pages/hospital/request-days.vue')
    expect(days).toContain('<HospitalWeekdayPicker')
    expect(days).toContain('hospitalService.saveReplenishmentSchedule(')
    expect(days).toContain('hospitalService.deleteReplenishmentSchedule(')
    expect(days).toContain("can('hospital.schedules.manage')")

    const weekly = source('app/pages/hospital/receiving/weekly/index.vue')
    expect(weekly).not.toContain('HospitalWeekdayPicker')
    expect(weekly).not.toContain('ReplenishmentSchedule(')
    expect(weekly).toContain('to="/hospital/request-days"')
  })

  it('makes every receiving page a hospital portal page, for the roles that work it', () => {
    for (const [page, ability] of [
      ['app/pages/hospital/receiving/weekly/index.vue', 'hospital.requests.view'],
      ['app/pages/hospital/request-days.vue', 'hospital.requests.view'],
      ['app/pages/hospital/receiving/weekly/new.vue', 'hospital.requests.manage'],
      ['app/pages/hospital/receiving/weekly/[id].vue', 'hospital.requests.view'],
    ]) {
      expect(source(page)).toContain(`definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: '${ability}' })`)
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

describe('what the center confirmed (project owner, 2026-10-29)', () => {
  const detail = readFileSync(path.join(root, 'app/pages/hospital/receiving/weekly/[id].vue'), 'utf8')

  it('shows when and how the order arrives, and how many units', () => {
    expect(detail).toContain('<section v-for="request in planned"')
    expect(detail).toContain('{{ handoverWhen(request.supply_plan.scheduled_at) }}')
    expect(detail).toContain('{{ request.committed_quantity ?? 0 }} of {{ request.quantity }}')
  })

  it('says it is still waiting while the center has not confirmed', () => {
    expect(detail).toContain('<p v-if="weekly.is_open && !planned.length" class="note">')
  })

  it('reads a confirmed weekly request as such', () => {
    expect(readFileSync(path.join(root, 'app/types/receiving.ts'), 'utf8')).toContain("confirmed: 'info',")
  })
})

describe('a supply plan in words', () => {
  it('names the hand-over and when, and nothing without a plan', () => {
    const at = new Date(2026, 9, 30, 9, 0).toISOString()

    expect(supplyPlanSummary({ handover_method: 'delivery', scheduled_at: at })).toBe(`Delivery · ${handoverWhen(at)}`)
    expect(supplyPlanSummary({ handover_method: 'pickup', scheduled_at: at })).toMatch(/^Pick-up · /)
    expect(handoverWhen(at)).toMatch(/Oct 30.*9:00\sAM$/)
    expect(supplyPlanSummary(null)).toBe('')
    expect(handoverWhen(null)).toBe('—')
  })

  it('reads a confirmed order as such until stock is reserved', () => {
    const order = { status: 'pending', is_walk_in: false, allocated_count: 0, supply_plan: { handover_method: 'pickup' } } as never

    expect(requestStage(order)).toBe('Order confirmed')
  })
})
