import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  HOSPITAL_HELP_DEPARTMENTS,
  HOSPITAL_HELP_GUIDES,
  HOSPITAL_ROLE_HELP,
  hospitalGuidesFor,
  searchHospitalGuides,
} from '../app/utils/hospitalHelp'

const source = (file: string) => readFileSync(path.resolve(process.cwd(), file), 'utf8')

// The abilities each hospital role holds, from the server's HospitalPermissions.
const SHARED = ['hospital.requests.view', 'hospital.inventory.view']
const INVENTORY = [...SHARED, 'hospital.inventory.stock_in', 'hospital.inventory.handle', 'hospital.inventory.discard', 'hospital.inventory.thresholds', 'hospital.receiving.direct']
const REQUESTING = [...SHARED, 'hospital.requests.manage', 'hospital.schedules.manage', 'hospital.receipt.confirm', 'hospital.billing.view']
const HEAD = [...new Set([...INVENTORY, ...REQUESTING, 'hospital.staff.manage'])]
const as = (abilities: string[]) => (ability: string) => abilities.includes(ability)

describe('the hospital help guides', () => {
  it('shows each role the jobs it can do, and not the others', () => {
    const inventory = hospitalGuidesFor(as(INVENTORY)).map((guide) => guide.id)
    expect(inventory).toContain('stock-in')
    expect(inventory).toContain('tag-bag')
    expect(inventory).not.toContain('new-request')
    expect(inventory).not.toContain('staff')

    const requesting = hospitalGuidesFor(as(REQUESTING)).map((guide) => guide.id)
    expect(requesting).toContain('new-request')
    expect(requesting).toContain('receive-delivery')
    expect(requesting).not.toContain('stock-in')
    expect(requesting).not.toContain('staff')

    expect(hospitalGuidesFor(as(HEAD))).toHaveLength(HOSPITAL_HELP_GUIDES.length)
  })

  it('points every guide at a page that exists', () => {
    for (const guide of HOSPITAL_HELP_GUIDES) {
      const page = `app/pages${guide.path}`
      expect(existsSync(`${page}.vue`) || existsSync(`${page}/index.vue`), guide.path).toBe(true)
    }
  })

  it('files every guide under a sidebar group', () => {
    const sidebar = source('app/components/Hospital/Sidebar.vue')
    for (const department of HOSPITAL_HELP_DEPARTMENTS) {
      if (department === 'Receiving') continue
      expect(sidebar).toContain(`label: '${department}'`)
    }
  })

  it('starts each role on guides it can open', () => {
    const roles: Record<string, string[]> = { head: HEAD, requesting_staff: REQUESTING, inventory_staff: INVENTORY }
    for (const [role, abilities] of Object.entries(roles)) {
      const open = hospitalGuidesFor(as(abilities)).map((guide) => guide.id)
      for (const id of HOSPITAL_ROLE_HELP[role]!.start) expect(open, `${role}: ${id}`).toContain(id)
    }
  })

  it('finds a guide by the words in it', () => {
    expect(searchHospitalGuides('crossmatch 24 hours', HOSPITAL_HELP_GUIDES).map((guide) => guide.id)).toContain('tag-bag')
    expect(searchHospitalGuides('   ', HOSPITAL_HELP_GUIDES)).toEqual([])
  })

  it('names buttons that are on the pages it describes', () => {
    const says = [
      ['app/pages/hospital/stock-intake.vue', 'Add Blood Unit'],
      ['app/pages/hospital/request-days.vue', 'Add Center'],
      ['app/pages/hospital/staff.vue', 'Add Staff'],
      ['app/pages/hospital/inventory.vue', 'Tag History'],
      ['app/pages/hospital/inventory-report.vue', 'Generate Report'],
      ['app/pages/hospital/inventory-report.vue', 'View PDF'],
      ['app/pages/hospital/bloodrequests/newrequest.vue', 'Find facilities'],
      ['app/pages/hospital/bloodrequests/newrequest.vue', 'View my stock'],
      ['app/pages/hospital/receiving/weekly/index.vue', 'Send request'],
    ]
    for (const [file, words] of says) expect(source(file!), `${file}: ${words}`).toContain(words)
  })
})

describe('the hospital Help Center page', () => {
  it('is in the sidebar, the breadcrumb and the search', () => {
    expect(source('app/components/Hospital/Sidebar.vue')).toContain("path: '/hospital/help'")
    const layout = source('app/layouts/hospitaldashboard.vue')
    expect(layout).toContain("'/hospital/help': 'Help Center'")
    expect(layout).toContain('searchHospitalGuides(q, hospitalGuidesFor(can))')
  })
})
