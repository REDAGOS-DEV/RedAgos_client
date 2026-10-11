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
    expect(page).toContain("definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.inventory.view' })")
  })

  it('offers stock-in and the bag actions only to the roles that hold them', () => {
    expect(page).toContain("can('hospital.inventory.stock_in')")
    expect(page).toContain("can('hospital.inventory.handle')")
    expect(page).toContain("can('hospital.inventory.discard')")
  })

  it('takes every action through the service', () => {
    for (const call of ['tagUnit(', 'crossmatchUnit(', 'transfuseUnit(', 'releaseTag(', 'confirmUnitReturn(', 'discardUnit(', 'inventorySummary(', 'tagEvents(', 'stockIn(']) {
      expect(page).toContain(`hospitalService.${call}`)
    }
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
})

describe('the hospital navigation', () => {
  it('lists the inventory in the sidebar, the breadcrumb and the search', () => {
    expect(source('app/components/Hospital/Sidebar.vue')).toContain("path: '/hospital/inventory'")

    const layout = source('app/layouts/hospitaldashboard.vue')
    expect(layout).toContain("'/hospital/inventory': 'Blood Bank Inventory'")
    expect(layout).toContain("path: '/hospital/inventory', icon: 'package'")
  })
})

describe('receipt and the patient page', () => {
  it('tells staff how many received bags went onto the shelf', () => {
    expect(source('app/pages/hospital/bloodrequests/[id].vue')).toContain('response?.stocked_count')
  })

  it('shows the patient\'s bags on their transfusion request', () => {
    expect(source('app/pages/hospital/transfusion-requests/[id].vue'))
      .toContain('hospitalService.inventory({ transfusion_request_id: Number(requestId.value), per_page: 100 })')
  })
})
