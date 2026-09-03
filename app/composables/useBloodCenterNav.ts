/**
 * The one definition of Blood Center navigation.
 *
 * Four surfaces used to carry their own copy of this list — the sidebar, the
 * header profile menu, the ⌘F search index and the dashboard quick actions.
 * Filtering one of them would have left the other three offering routes the
 * server refuses, so they all read from here instead.
 *
 * `requires` is a permission the server also enforces on the matching endpoint.
 * Hiding a link is presentation; the `can:` middleware is the actual gate.
 */

export interface BloodCenterNavItem {
  label: string
  path: string
  icon: string
  /** Key into the sidebar's badge counts, when the item shows one. */
  badge?: string
  /** Ability needed to see this item. Omitted means everyone in the portal. */
  requires?: string
  /** Extra terms the ⌘F search should match on. */
  keywords?: string
}

export interface BloodCenterNavGroup {
  label: string | null
  items: BloodCenterNavItem[]
}

/**
 * Where each department lands after signing in.
 *
 * A supervisor who also works in a department lands in that department; the
 * overview stays one click away in the sidebar. A management-only supervisor
 * lands on the overview.
 */
const DEPARTMENT_HOME: Record<string, string> = {
  collection: '/blood-center/collection',
  laboratory: '/blood-center/laboratory',
  inventory: '/blood-center/storage',
  billing: '/blood-center/billing',
}

export const BLOOD_CENTER_OVERVIEW = '/blood-center/dashboard'

/**
 * The route a blood-centre user should be sent to after login.
 *
 * Staff who hold no department yet are sent to settings rather than to an
 * empty filtered shell, so the reason they can see nothing is visible.
 */
export function departmentHome(user: Record<string, any> | null | undefined): string {
  if (!user) {
    return BLOOD_CENTER_OVERVIEW
  }

  const home = user.department ? DEPARTMENT_HOME[user.department] : undefined

  if (home) {
    return home
  }

  return user.is_supervisor ? BLOOD_CENTER_OVERVIEW : '/blood-center/settings'
}

const NAV_GROUPS: BloodCenterNavGroup[] = [
  {
    label: 'Main',
    items: [
      // Gated on reports.view_all, which only the management level holds — the
      // overview spans every department, so it is not a department's own view.
      { label: 'Overview', path: BLOOD_CENTER_OVERVIEW, icon: 'layout-dashboard', requires: 'reports.view_all', keywords: 'home summary overall' },

      // Each department dashboard is gated on an ability distinctive to that
      // department, never on a shared read. inventory.view, for instance, is
      // held by Collection and Laboratory too, so gating Storage on it would
      // have shown them a dashboard that is not theirs.
      { label: 'Collection Dashboard', path: '/blood-center/collection', icon: 'heart', requires: 'donors.manage', keywords: 'donor collection donation' },
      { label: 'Laboratory Dashboard', path: '/blood-center/laboratory', icon: 'flask-conical', requires: 'lab.view', keywords: 'lab processing screening testing' },
      { label: 'Storage Dashboard', path: '/blood-center/storage', icon: 'warehouse', requires: 'inventory.create', keywords: 'storage stock units' },
      { label: 'Billing Dashboard', path: '/blood-center/billing', icon: 'credit-card', requires: 'billing.create', keywords: 'billing payment finance' },
    ],
  },
  {
    label: 'Blood Management',
    items: [
      { label: 'Blood Inventory', path: '/blood-center/inventory', icon: 'droplets', requires: 'inventory.view', keywords: 'stock units expiry fefo' },
      { label: 'Incoming Requests', path: '/blood-center/bloodrequests', icon: 'clipboard-check', badge: 'pending', requires: 'requests.view', keywords: 'hospital requests' },
      { label: 'Requests Fulfillment', path: '/blood-center/fulfillment', icon: 'building-2', badge: 'urgent', requires: 'requests.process', keywords: 'allocate release dispatch' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Donation Drives', path: '/blood-center/drives', icon: 'heart', requires: 'drives.manage', keywords: 'mobile drive event' },
      { label: 'Appointments', path: '/blood-center/appointments', icon: 'calendar', requires: 'appointments.view', keywords: 'booking schedule walk-in' },
      { label: 'Donor Management', path: '/blood-center/donors', icon: 'users', requires: 'donors.view', keywords: 'donor profile history' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Billing and Payments', path: '/blood-center/billing', icon: 'credit-card', requires: 'billing.view', keywords: 'invoice receipt gcash cash' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { label: 'Reports & Analytics', path: '/blood-center/reports', icon: 'bar-chart', requires: 'reports.view_own', keywords: 'report analytics forecast' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Staff Accounts', path: '/blood-center/staff', icon: 'user-check', requires: 'staff.manage', keywords: 'staff team department roles' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', path: '/blood-center/settings', icon: 'settings', keywords: 'profile password preferences' },
      // Help & Support removed: /blood-center/support has no page, so the link
      // 404'd. Restore it together with the page, not before.
    ],
  },
]

/**
 * The header profile dropdown, drawn from the same list so it cannot drift.
 */
const USER_MENU_PATHS = [
  '/blood-center/settings',
  '/blood-center/bloodrequests',
  '/blood-center/billing',
  '/blood-center/staff',
]

export function useBloodCenterNav() {
  const { can } = useUser()

  /** Groups the current user may see, with empty groups dropped. */
  const navGroups = computed<BloodCenterNavGroup[]>(() =>
    NAV_GROUPS
      .map((group) => ({ ...group, items: group.items.filter((item) => can(item.requires)) }))
      .filter((group) => group.items.length > 0)
  )

  /** Every permitted item, flattened — the ⌘F search index. */
  const searchablePages = computed<BloodCenterNavItem[]>(() =>
    navGroups.value.flatMap((group) => group.items)
  )

  /** The header profile dropdown, filtered the same way. */
  const userMenuItems = computed<BloodCenterNavItem[]>(() =>
    USER_MENU_PATHS
      .map((path) => searchablePages.value.find((item) => item.path === path))
      .filter((item): item is BloodCenterNavItem => Boolean(item))
  )

  /**
   * Look up a nav item's label, for the header breadcrumb.
   */
  function labelForPath(path: string): string {
    const match = NAV_GROUPS
      .flatMap((group) => group.items)
      .find((item) => item.path === path)

    return match?.label ?? ''
  }

  return { navGroups, searchablePages, userMenuItems, labelForPath, can }
}
