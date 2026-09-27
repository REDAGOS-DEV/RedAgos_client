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
  /**
   * Ability needed to see this item — or a list, any one of which will do.
   * Omitted means everyone in the portal. Must match the page's own
   * `definePageMeta({ requires })`, or the link would bounce.
   */
  requires?: string | readonly string[]
  /** Extra terms the ⌘F search should match on. */
  keywords?: string
}

export interface BloodCenterNavGroup {
  label: string | null
  items: BloodCenterNavItem[]
}

/**
 * The abilities that open the collection page, any one of which will do.
 *
 * The counter is one page worked by three roles: the receptionist opens the
 * donation, the physician screens, the chair collects. Shared by the nav item
 * and the page's own meta so the two cannot disagree.
 */
export const COLLECTION_ABILITIES = ['donations.register', 'donations.screen', 'donations.collect'] as const

/**
 * The abilities that open the testing page, which TTI Testing and
 * Immunohematology share: each works its own card on it.
 */
export const TESTING_ABILITIES = ['lab.record_serology', 'lab.record_immunohematology'] as const


/**
 * Where each staff role lands after signing in.
 *
 * Checked before the department, because roles in one department do different
 * work: a receptionist starts at the appointment list, a physician at the
 * counter. A supervisor who also holds a role lands where that role does; the
 * overview stays one click away in the sidebar.
 */
const ROLE_HOME: Record<string, string> = {
  screening_physician: '/blood-center/collection',
  phlebotomist: '/blood-center/collection',
  apheresis_specialist: '/blood-center/collection',
  medical_receptionist: '/blood-center/appointments',
  component_technologist: '/blood-center/laboratory',
  processing_assistant: '/blood-center/laboratory',
  serology_technologist: '/blood-center/testing',
  lab_supervisor: '/blood-center/testing',
  inventory_control_officer: '/blood-center/storage',
  dispatch_coordinator: '/blood-center/fulfillment',
  it_data_clerk: '/blood-center/inventory',
  billing_clerk: '/blood-center/billing',
}

/**
 * Where each department lands, for an account holding a custom role.
 *
 * Every predefined role is in ROLE_HOME; a typed role has no entry there, so
 * its department decides.
 */
const DEPARTMENT_HOME: Record<string, string> = {
  collection: '/blood-center/collection',
  // Each laboratory department has its own page. TTI Testing records the
  // serology panel and works its referral list; Processing separates the
  // unit and completes or rejects it.
  testing: '/blood-center/testing',
  processing: '/blood-center/laboratory',
  issuance: '/blood-center/storage',
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

  const home = (user.staff_role ? ROLE_HOME[user.staff_role] : undefined)
    ?? (user.department ? DEPARTMENT_HOME[user.department] : undefined)

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
      // held by Processing and Recruitment too, so gating Issuance on it would
      // have shown them a dashboard that is not theirs. The laboratory
      // departments share lab.view, so each is gated on its own write instead.
      { label: 'Collection Dashboard', path: '/blood-center/collection', icon: 'heart', requires: COLLECTION_ABILITIES, keywords: 'donor collection donation screening phlebotomy apheresis' },
      { label: 'TTI Testing', path: '/blood-center/testing', icon: 'flask-conical', requires: TESTING_ABILITIES, keywords: 'lab laboratory testing tti serology immunohematology typing abo rh forward reverse antibody screen hiv hbsag hcv syphilis malaria referral counselling segment' },
      { label: 'Processing', path: '/blood-center/laboratory', icon: 'package-check', requires: 'lab.record_components', keywords: 'lab laboratory processing components separation release clear' },
      { label: 'Issuance Dashboard', path: '/blood-center/storage', icon: 'warehouse', requires: 'inventory.create', keywords: 'issuance storage stock units release' },
      { label: 'Billing Dashboard', path: '/blood-center/billing', icon: 'credit-card', requires: 'billing.create', keywords: 'billing payment finance' },
    ],
  },
  {
    label: 'Blood Management',
    items: [
      { label: 'Blood Inventory', path: '/blood-center/inventory', icon: 'droplets', requires: 'inventory.view', keywords: 'stock units expiry fefo' },
      // inventory.create rather than inventory.view: Collection, Testing and
      // Processing all read stock, but only Issuance books it in.
      { label: 'Stock Intake', path: '/blood-center/inventory-intake', icon: 'package-check', requires: 'inventory.create', keywords: 'intake shelve book in units donation cleared' },
      // Issuance prepares and signs the daily sheet, so it carries Issuance's
      // own ability rather than the inventory.view every lab department holds.
      { label: 'Daily Stock Report', path: '/blood-center/stock-report', icon: 'clipboard-list', requires: 'inventory.create', keywords: 'daily stock inventory report pdf print rh expiry sheet' },
      { label: 'Incoming Requests', path: '/blood-center/bloodrequests', icon: 'clipboard-check', badge: 'pending', requires: 'requests.view', keywords: 'hospital requests walk-in watcher follow-up partial fulfilment' },
      // requests.release, the same as the page: dispatch holds it without
      // requests.process, which only the Inventory Control Officer holds.
      { label: 'Requests Fulfillment', path: '/blood-center/fulfillment', icon: 'building-2', badge: 'urgent', requires: 'requests.release', keywords: 'allocate release dispatch transport' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Donation Drives', path: '/blood-center/drives', icon: 'heart', requires: 'drives.manage', keywords: 'mobile drive event' },
      // Every role that saves a correctable record holds corrections.request,
      // and every approver does too, so one ability opens the page.
      { label: 'Corrections', path: '/blood-center/corrections', icon: 'pencil', badge: 'corrections', requires: 'corrections.request', keywords: 'correction amend mistake approve reject edit request' },
      { label: 'Appointments', path: '/blood-center/appointments', icon: 'calendar', requires: 'appointments.view', keywords: 'booking schedule walk-in' },
      // donors.view_contact: Recruitment reaches the page as a contact list.
      { label: 'Donor Management', path: '/blood-center/donors', icon: 'users', requires: 'donors.view_contact', keywords: 'donor profile history contact recruitment' },
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
      { label: 'Blood Components', path: '/blood-center/blood-components', icon: 'flask-conical', requires: 'center.configure', keywords: 'shelf life expiry price component settings' },
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
