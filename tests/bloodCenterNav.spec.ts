import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// `useBloodCenterNav` reaches for Nuxt's auto-imported `useUser` and
// `computed` at call time, so stubbing them per test is enough.
import { useBloodCenterNav } from '~/composables/useBloodCenterNav'

/**
 * Which groups a staff member's sidebar shows.
 *
 * What is locked in: Issuance keeps billing.view for Fulfillment's payment
 * check but never sees the Billing group (project owner, 2026-10-19), in the
 * sidebar, the ⌘F search or the profile menu, while Billing's own staff and
 * a Supervisor still do.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

let currentUser: Record<string, unknown> | null = null
let abilities: string[] = []

function signIn(user: Record<string, unknown>, held: string[]): void {
  currentUser = user
  abilities = held
}

beforeEach(() => {
  currentUser = null
  abilities = []
  vi.stubGlobal('computed', (getter: () => unknown) => ({ get value() { return getter() } }))
  vi.stubGlobal('useUser', () => ({
    user: { get value() { return currentUser } },
    can: (required?: string | readonly string[]) => required === undefined
      || (Array.isArray(required) ? required.some((a) => abilities.includes(a)) : abilities.includes(required as string)),
  }))
})

function groupLabels(): (string | null)[] {
  return useBloodCenterNav().navGroups.value.map((group) => group.label)
}

describe('the Billing group', () => {
  // The Inventory Control Officer's reads, billing.view among them.
  const OFFICER = ['inventory.view', 'inventory.create', 'requests.view', 'requests.release', 'billing.view']

  it('is hidden from Issuance even though it holds billing.view', () => {
    signIn({ department: 'issuance', management_level: null }, OFFICER)

    expect(groupLabels()).toContain('Stock and Supply')
    expect(groupLabels()).not.toContain('Billing')
  })

  it('leaves no way to it in the search or the profile menu either', () => {
    signIn({ department: 'issuance', management_level: null }, OFFICER)
    const nav = useBloodCenterNav()

    expect(nav.searchablePages.value.map((item) => item.path)).not.toContain('/blood-center/billing')
    expect(nav.userMenuItems.value.map((item) => item.path)).not.toContain('/blood-center/billing')
  })

  it('stays for Billing\'s own staff', () => {
    signIn({ department: 'billing', management_level: null }, ['billing.view', 'billing.create', 'billing.record_payment', 'requests.view'])

    expect(groupLabels()).toContain('Billing')
  })

  it('stays for a Supervisor, whatever department they came from', () => {
    signIn({ department: 'issuance', management_level: 'supervisor' }, ['reports.view_all', 'inventory.view', 'billing.view'])

    expect(groupLabels()).toContain('Billing')
  })
})

describe('the Issuance department\'s group', () => {
  it('is headed Stock and Supply, and still comes first for its own staff', () => {
    signIn({ department: 'issuance', management_level: null }, ['inventory.view', 'inventory.create', 'requests.view'])

    const labels = groupLabels()
    expect(labels).not.toContain('Issuance')
    // Overview first for everyone, then the member's own department.
    expect(labels.slice(0, 2)).toEqual(['Overview', 'Stock and Supply'])
  })

  it('is hidden from Billing even though it holds requests.view (project owner, 2026-10-20)', () => {
    signIn({ department: 'billing', management_level: null }, ['billing.view', 'billing.create', 'billing.record_payment', 'requests.view'])
    const nav = useBloodCenterNav()

    expect(groupLabels()).not.toContain('Stock and Supply')
    expect(nav.searchablePages.value.map((item) => item.path)).not.toContain('/blood-center/bloodrequests')
    expect(nav.userMenuItems.value.map((item) => item.path)).not.toContain('/blood-center/bloodrequests')
  })

  it('stays for a Supervisor, whatever department they came from', () => {
    signIn({ department: 'billing', management_level: 'supervisor' }, ['reports.view_all', 'requests.view', 'billing.view'])

    expect(groupLabels()).toContain('Stock and Supply')
  })
})

describe('Stock Thresholds and the Daily Stock Report', () => {
  it.each(['/blood-center/stock-thresholds', '/blood-center/stock-report'])('%s sits under Management, not Stock and Supply', (page) => {
    signIn(
      { department: 'issuance', management_level: null },
      ['inventory.view', 'inventory.create', 'inventory.thresholds', 'inventory.stock_report', 'reports.view_own'],
    )

    const groups = useBloodCenterNav().navGroups.value
    const pathsIn = (label: string) => groups.find((group) => group.label === label)?.items.map((item) => item.path) ?? []

    expect(pathsIn('Management')).toContain(page)
    expect(pathsIn('Stock and Supply')).not.toContain(page)
    expect(useBloodCenterNav().sectionForPath(page)).toBe('Management')
  })
})

describe('Fulfillment\'s payment notice', () => {
  const page = readFileSync(path.join(root, 'app/components/BloodCenter/FulfillmentBoard.vue'), 'utf8')

  it('links to Billing only for whoever can take the payment', () => {
    expect(page).toContain(`v-if="!gateFor(request).ok && can('billing.record_payment')" to="/blood-center/billing"`)
  })

  it('leaves a blocked statement to Billing rather than letting Issuance apply subsidy', () => {
    expect(page).not.toContain('applySubsidy(')
    expect(page).not.toContain("can('billing.subsidise')")
    expect(page).toContain(`v-if="!gateFor(request).ok && can('billing.record_payment')" to="/blood-center/billing"`)
  })

  it('places scheduled subsidy, discount and promo control under Management', () => {
    const nav = readFileSync(path.join(root, 'app/composables/useBloodCenterNav.ts'), 'utf8')
    expect(nav).toMatch(/label: 'Billing Programs'[\s\S]*?path: '\/blood-center\/billing-programs'[\s\S]*?requires: 'billing\.prices'/)
  })
})
