import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const source = (file: string) => readFileSync(path.join(root, file), 'utf8')

describe('the hospital service', () => {
  const service = source('app/api/hospital/HospitalService.ts')

  it('calls each hospital inventory route, escaping the bag number', () => {
    for (const route of [
      "'/hospital/inventory'",
      "'/hospital/inventory/summary'",
      "'/hospital/inventory/tag-events'",
      '/hospital/inventory/${encodeURIComponent(unit)}`',
      '/hospital/inventory/${encodeURIComponent(unit)}/tag`',
      '/hospital/inventory/${encodeURIComponent(unit)}/crossmatch`',
      '/hospital/inventory/${encodeURIComponent(unit)}/transfuse`',
      '/hospital/inventory/${encodeURIComponent(unit)}/release`',
      '/hospital/inventory/${encodeURIComponent(unit)}/return`',
      '/hospital/inventory/${encodeURIComponent(unit)}/discard`',
    ]) {
      expect(service).toContain(route)
    }
  })
})

describe('the hospital inventory page', () => {
  const page = source('app/pages/hospital/inventory.vue')
  const labels = source('app/types/hospitalInventory.ts')

  it('is a hospital portal page every hospital role may read', () => {
    expect(page).toContain("definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.inventory.view', keepalive: true })")
  })

  it('offers the bag actions only to the roles that hold them', () => {
    expect(page).toContain("can('hospital.inventory.handle')")
    expect(page).toContain("can('hospital.inventory.discard')")
  })

  it('takes every action through the service', () => {
    for (const call of ['tagUnit(', 'crossmatchUnit(', 'transfuseUnit(', 'releaseTag(', 'confirmUnitReturn(', 'discardUnit(', 'inventorySummary(', 'tagEvents(', 'inventoryActivity(', 'stockThresholds(']) {
      expect(page).toContain(`hospitalService.${call}`)
    }
  })

  it('shows the blood type cards as the centre does, filtering the list (project owner, 2026-11-01)', () => {
    expect(page).toContain('<HospitalBloodTypeAvailability')
    expect(page).toContain('@select="toggleTypeFilter"')
    expect(page).toContain('"types expiring" "list activity"')
  })

  it('still opens the list on a type from the dashboard', () => {
    expect(page).toContain('Number(route.query.blood_type_id)')

    const dashboard = source('app/pages/hospital/dashboard.vue')
    expect(dashboard).toContain('<HospitalBloodTypeAvailability v-if="thresholds || thresholdsLoading" :thresholds="thresholds" />')
    expect(source('app/components/Hospital/BloodTypeAvailability.vue')).toContain('{ to: `/hospital/inventory?blood_type_id=${card.id}` }')
  })

  it('opens Tag History on what a dashboard Untagged tile counts (project owner, 2026-11-07)', () => {
    const dashboard = source('app/pages/hospital/dashboard.vue')
    expect(dashboard).toContain('label="Untagged Crossmatch" :value="untaggedCrossmatched"')
    expect(dashboard).toContain('to="/hospital/inventory?tag_status=untagged_crossmatched&untag_reason=transfusion_deadline_expired"')
    expect(dashboard).toContain('label="Untagged Assigned" :value="untaggedAssigned"')
    expect(dashboard).toContain('to="/hospital/inventory?tag_status=untagged_assigned&untag_reason=crossmatch_deadline_expired"')
    expect(dashboard).toContain('data.untagged_crossmatched')
    expect(dashboard).toContain('data.untagged_assigned')

    expect(page).toContain('if (startTagStatus || startUntagReason) openTagHistory()')
    expect(page).toContain('status: startTagStatus, untagReason: startUntagReason')
    expect(page).toContain('untag_reason: eventFilters.untagReason || undefined')
  })

  it('leaves stock-in to Stock Intake (project owner, 2026-10-28)', () => {
    expect(page).not.toContain('hospitalService.stockIn(')
    expect(page).not.toContain('matchStockInScan')
  })

  it('explains every refusal the API can give', () => {
    for (const code of [
      'unit_not_found',
      'unit_not_available',
      'invalid_transition',
      'tag_deadline_passed',
      'bag_expired',
      'unit_not_discardable',
      'transfusion_request_not_found',
      'transfusion_request_closed',
    ]) {
      expect(labels).toContain(code)
    }
    expect(page).toContain('UNIT_REFUSAL_MESSAGES[code]')
  })

  it('counts down on the server clock and never writes when a deadline passes', () => {
    expect(page).toContain('serverSkew(data.as_of, Date.now())')
    expect(page).toContain("'Deadline passed — releasing'")

    const sweepWatch = page.slice(page.indexOf('watch(anyOverdue'), page.indexOf('onMounted('))
    expect(sweepWatch).toContain('refresh()')
    expect(sweepWatch).not.toMatch(/releaseTag|crossmatchUnit|transfuseUnit/)
  })

  it('asks for a reason before releasing a tag or discarding a bag', () => {
    expect(page).toContain("dialog?.kind === 'release'")
    expect(page).toContain("dialog?.kind === 'discard'")
    expect(source('app/components/Hospital/UnitReasonDialog.vue')).toContain(":disabled=\"busy || !reason.trim()\"")
  })

  it('reserves a bag for a blood donor partner from its menu or drawer (project owner, 2026-11-07)', () => {
    expect(page).toContain("reserve: { label: 'Reserve for blood donor partner', icon: 'lock' }")
    expect(page).toContain("unreserve: { label: 'Release reservation', icon: 'unlock' }")
    // Offered on an untagged bag in date, and released while the bag is still here.
    expect(page).toContain("...(!reserved && unit.status === 'available' && !unit.bag_expired ? ['reserve'] : [])")
    expect(page).toContain("...(reserved && ON_HAND.includes(unit.status) ? ['unreserve'] : [])")
    expect(page).toContain("dialog?.kind === 'reserve'")
    expect(page).toContain('hospitalService.reserveUnit(unit.unit_id, partner)')
    expect(page).toContain('hospitalService.unreserveUnit(unit.unit_id)')
    // Listed, badged and named in the report's purple.
    expect(page).toContain("{ value: 'reserved', label: 'Reserved for partner' }")
    expect(page).toContain('hospitalUnitStatusTag(unit.status, unit.days_remaining, Boolean(unit.partner_reservation))')
    expect(page).toContain('--inv-partner: #7B1FA2;')
    expect(page).toContain('Reserved For')

    const service = source('app/api/hospital/HospitalService.ts')
    expect(service).toContain('`/hospital/inventory/${encodeURIComponent(unit)}/reserve`, \'POST\', { partner }')
    expect(service).toContain('`/hospital/inventory/${encodeURIComponent(unit)}/unreserve`, \'POST\'')

    // Tagging is still open, with the partner named.
    expect(source('app/components/Hospital/TagUnitDialog.vue')).toContain('Reserved for blood donor partner {{ unit.partner_reservation.partner }}.')
  })
})

describe('the hospital Stock Intake page', () => {
  const page = source('app/pages/hospital/stock-intake.vue')

  it('is a page of its own, for the roles that stock bags in', () => {
    expect(page).toContain("definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.inventory.stock_in', keepalive: true })")
    expect(page).toContain("can('hospital.inventory.discard')")
  })

  it('lists the arrived bags, scans them and stocks them in through the service', () => {
    expect(page).toContain("hospitalService.inventory({ status: 'received', per_page: 100 })")
    expect(page).toContain('matchStockInScan(code, arrived.value, ticked.value)')
    expect(page).toContain('hospitalService.stockIn(')
    expect(page).toContain('hospitalService.discardUnit(')
    expect(page).toContain('UNIT_REFUSAL_MESSAGES[code]')
  })

  it('picks every bag\'s storage location from the list, never optional (project owner, 2026-10-30)', () => {
    const template = page.slice(0, page.indexOf('<script'))

    expect(template).toContain('placeholder="Select a location"')
    expect(template).toContain(':options="locationOptions"')
    expect(template).not.toContain('Optional')
    expect(template).not.toContain('<datalist')
    expect(template).toContain(':disabled="!canStockIn"')
    expect(page).toContain('storage_location: locations[id],')
    expect(page).not.toContain('|| null')
  })

  it('adds a blood unit from outside RedAgos through Direct Distribution\'s receipt (project owner, 2026-10-30)', () => {
    expect(page).toContain("const canAdd = computed(() => can('hospital.receiving.direct'))")
    // The toolbar's primary action, as New Donor is on the centre's Donor Management (project owner, 2026-10-30).
    expect(page).toContain('<button v-if="canAdd" type="button" class="btn-primary" @click="addingUnit = true">')
    expect(page).toContain('<HospitalAddBloodUnitDialog v-if="addingUnit" @added="onUnitAdded" @close="addingUnit = false" />')

    const dialog = source('app/components/Hospital/AddBloodUnitDialog.vue')
    expect(dialog).toContain('v-focus-trap')
    expect(dialog).toContain('@dialog-escape="!busy && $emit(\'close\')"')
    expect(dialog).toContain('hospitalService.receiveDirectDistribution({')
    expect(dialog).not.toContain('transfusion_request_id')

    // Only what the bag says: no source, requester, volume or time received (project owner, 2026-10-30).
    const template = dialog.slice(0, dialog.indexOf('<script'))
    for (const removed of ['Source facility', 'Requested by', 'Volume (mL)', 'Date / time received']) {
      expect(template).not.toContain(removed)
    }
    for (const field of ['external_blood_source_id', 'requested_for', 'volume_ml', 'received_at']) {
      expect(dialog).not.toContain(field)
    }

    // A bag with no source still says where it came from.
    expect(page).toContain("source_name || 'outside RedAgos'")
  })
})

describe('the hospital Inventory Report', () => {
  const page = source('app/pages/hospital/inventory-report.vue')

  it('is a hospital portal page every hospital role may read', () => {
    expect(page).toContain("definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.inventory.view', keepalive: true })")
  })

  it('is set up first and generated on request, never on arrival (project owner, 2026-10-28)', () => {
    expect(page).toContain("{ value: 'type', label: 'One sheet per type'")
    expect(page).toContain("{ value: 'all', label: 'All types on one sheet'")
    expect(page).toContain('v-model="config.components"')
    expect(page).toContain('v-model="config.bloodTypes"')
    expect(page).toContain('v-model="config.by"')
    expect(page).toContain('@click="generate"')
    expect(page).toContain('hospitalService.generateInventoryReport(chosen)')
    // Arriving loads the choices and the archive, never a report.
    expect(page).toContain('loadOptions()')
    expect(page).not.toMatch(/onMounted\([^)]*generate/)
  })

  it('keeps each generated report as its PDF, listed under Generated Reports (project owner, 2026-10-29)', () => {
    expect(page).toContain('Report Settings')
    expect(page).toContain('Generated Reports')
    expect(page).toContain('hospitalService.inventoryReports({ page, per_page: 10 })')
    expect(page).toContain('hospitalService.downloadInventoryReport(item.id)')
    // The preview's Download is the report just kept, not a fresh build.
    expect(page).toContain('@click="downloadReport(current)"')

    const service = source('app/api/hospital/HospitalService.ts')
    expect(service).toMatch(/'\/hospital\/inventory\/reports',\s*'POST'/)
    expect(service).toContain("this.request<Paginated<HospitalInventoryReportRecord>>('/hospital/inventory/reports', 'GET', params)")
    expect(service).toContain('`/hospital/inventory/reports/${encodeURIComponent(String(id))}/pdf`')
    expect(service).not.toContain('/hospital/inventory/sheet')
  })

  it('reads a kept report on the page, never in another browser tab (project owner, 2026-11-01)', () => {
    expect(page).toContain('<CenterModal')
    expect(page).toContain('URL.revokeObjectURL(viewing.value.url)')
    expect(page).not.toContain('window.open')
  })

  it('colour codes each section as the PDF does (project owner, 2026-11-07)', () => {
    // Both the bag and its expiry take the colour; the marks stay for a grey copy.
    expect(page.match(/:class="cellTone\(column\.cells\[row - 1\], section\.key\)"/g)).toHaveLength(2)
    // CROSSMATCHED: waiting for transfusion blue, transfused green.
    expect(page).toContain("if (section === 'crossmatched') return cell.transfused ? 'form__cell--transfused' : 'form__cell--waiting'")
    expect(page).toContain('.form__cell--waiting { color: #1565C0; }')
    expect(page).toContain('.form__cell--transfused { color: #2E7D32; }')
    expect(page).toContain('title="Transfused today">(TF)</abbr>')
    // UNCROSSMATCHED: tagged pink, reserved purple, the rest black.
    expect(page).toContain("if (cell.tagged) return 'form__cell--tagged'")
    expect(page).toContain("return cell.reserved ? 'form__cell--reserved' : ''")
    expect(page).toContain('.form__cell--tagged { color: #D81B60; }')
    expect(page).toContain('.form__cell--reserved { color: #7B1FA2; }')
    expect(page).toContain('title="Tagged to a patient, waiting for crossmatch">(T)</abbr>')
    expect(page).toContain('title="Reserved for a blood donor partner">(R)</abbr>')
    // The day's transfusions are counted apart from the bags still here.
    expect(page).toContain("{ label: 'Transfused today', value: transfusedTotal.value }")
  })

  it('names the pages of the other components that follow the form', () => {
    expect(page).toContain("page.kind === 'other'")
    expect(source('app/types/hospitalInventory.ts')).toContain("kind: 'form' | 'other'")
  })

  it('is listed under Reports in the sidebar, the breadcrumb and the search', () => {
    const sidebar = source('app/components/Hospital/Sidebar.vue')
    const group = sidebar.slice(sidebar.indexOf("label: 'Reports'"), sidebar.indexOf("label: 'System'"))
    expect(group).toContain("path: '/hospital/inventory-report'")

    const layout = source('app/layouts/hospitaldashboard.vue')
    expect(layout).toContain("'/hospital/inventory-report': 'Reports / Inventory Report'")
    expect(layout).toContain("path: '/hospital/inventory-report', icon: 'clipboard-list'")
  })
})

describe('the hospital navigation', () => {
  it('lists the inventory in the sidebar, the breadcrumb and the search', () => {
    expect(source('app/components/Hospital/Sidebar.vue')).toContain("path: '/hospital/inventory'")

    const layout = source('app/layouts/hospitaldashboard.vue')
    expect(layout).toContain("'/hospital/inventory': 'Blood Bank Inventory'")
    expect(layout).toContain("path: '/hospital/inventory', icon: 'package'")
  })

  it('lists Stock Intake under Stock and Supply, for the roles that stock bags in', () => {
    const sidebar = source('app/components/Hospital/Sidebar.vue')
    const group = sidebar.slice(sidebar.indexOf("label: 'Stock and Supply'"), sidebar.indexOf("label: 'System'"))
    expect(group).toContain("{ label: 'Stock Intake', path: '/hospital/stock-intake', icon: 'package-check', requires: 'hospital.inventory.stock_in' }")

    const layout = source('app/layouts/hospitaldashboard.vue')
    expect(layout).toContain("'/hospital/stock-intake': 'Stock Intake'")
    expect(layout).toContain("path: '/hospital/stock-intake', icon: 'package-check'")
  })
})

describe('receipt and the patient page', () => {
  it('tells staff how many received bags went onto the shelf', () => {
    expect(source('app/pages/hospital/bloodrequests/[id].vue')).toContain('response?.stocked_count')
  })

  it('shows the patient\'s bags on their transfusion request', () => {
    expect(source('app/components/Hospital/TransfusionRequestDetail.vue'))
      .toContain('hospitalService.inventory({ transfusion_request_id: Number(requestId.value), per_page: 100 })')
  })
})
