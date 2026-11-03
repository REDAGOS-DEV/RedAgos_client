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
  /**
   * Left out of the sidebar and the page search, but still named in the
   * breadcrumb: a page reached only from another page's links.
   */
  hidden?: boolean
  /** Other pages that light this link up as the current one (tabs of one page). */
  alsoActiveOn?: readonly string[]
}

export interface BloodCenterNavGroup {
  label: string | null
  items: BloodCenterNavItem[]
  /**
   * Departments whose staff never see this group, whatever they hold. For a
   * read a department keeps for one page's sake but should not browse to: the
   * group is hidden, the ability (and so the page and its endpoint) stays.
   * An Admin or Supervisor is never hidden from a group this way.
   */
  hiddenFrom?: readonly string[]
}

/**
 * The abilities that open the Donation page (the Collection department's
 * counter), any one of which will do.
 *
 * The counter is one page worked by three roles: the receptionist opens the
 * donation, the physician screens, the chair collects. Shared by the nav item
 * and the page's own meta so the two cannot disagree.
 */
export const COLLECTION_ABILITIES = ['donations.register', 'donations.screen', 'donations.collect'] as const

/**
 * The abilities that open the demand forecast, one per part of it (the
 * server's DemandForecastService): demand, collection, processing, testing,
 * billing. The Supervisor holds inventory.view; the Admin none of them.
 */
export const FORECAST_ABILITIES = ['inventory.view', 'donations.view', 'lab.record_components', 'lab.record_serology', 'billing.record_payment'] as const

/**
 * The abilities that open Reports & Analytics: the centre's reports (the
 * Admin and the Supervisor), Donor & Collection's, and Testing's (either
 * section, 2026-10-24). The other departments' reports are still to come;
 * they have the forecast meanwhile.
 */
export const REPORTS_ABILITIES = ['reports.view_all', 'donations.view', 'lab.record_serology', 'lab.record_immunohematology'] as const

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
 * counter. An Admin or Supervisor who also holds a role lands where that role
 * does; the overview stays one click away in the sidebar.
 */
const ROLE_HOME: Record<string, string> = {
  // Donations, where a visit is started (Scan QR) or carried on (Continue):
  // the counter has no way in of its own (project owner, 2026-10-24).
  screening_physician: '/blood-center/donations',
  phlebotomist: '/blood-center/donations',
  apheresis_specialist: '/blood-center/donations',
  medical_receptionist: '/blood-center/appointments',
  component_technologist: '/blood-center/laboratory',
  processing_assistant: '/blood-center/laboratory',
  serology_technologist: '/blood-center/testing',
  lab_supervisor: '/blood-center/testing',
  inventory_control_officer: '/blood-center/storage',
  dispatch_coordinator: '/blood-center/fulfillment',
  it_data_clerk: '/blood-center/inventory',
  billing_clerk: '/blood-center/billing-dashboard',
  billing_supervisor: '/blood-center/billing-dashboard',
}

/**
 * Where each department lands, for an account holding a custom role.
 *
 * Every predefined role is in ROLE_HOME; a typed role has no entry there, so
 * its department decides.
 */
const DEPARTMENT_HOME: Record<string, string> = {
  collection: '/blood-center/donations',
  // Each laboratory department has its own page. TTI Testing records the
  // serology panel and works its referral list; Processing separates the
  // unit and completes or rejects it.
  testing: '/blood-center/testing',
  processing: '/blood-center/laboratory',
  issuance: '/blood-center/storage',
  billing: '/blood-center/billing-dashboard',
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

  // The Admin and the Supervisor both start at the overview they monitor.
  return user.management_level ? BLOOD_CENTER_OVERVIEW : '/blood-center/settings'
}

/*
 * Overview first: the dashboards, so each person starts from their own. Then
 * each department's working pages, then management, then Account (Settings)
 * at the very bottom.
 *
 * The Donor/Collection department is two groups (owner, 2026-10-16): Donor for
 * the people, Collection for the donations. Issuance's group is headed "Stock
 * and Supply" (owner, 2026-10-19). Other department group labels follow
 * Department::label() on the server.
 */
const NAV_GROUPS: BloodCenterNavGroup[] = [
  {
    label: 'Overview',
    items: [
      // The dashboards: where each person starts their day. The centre-wide
      // one is management's; the Donor/Collection one is the counter's own
      // (donations.view, held by every role there and no one else).
      { label: 'Center Dashboard', path: BLOOD_CENTER_OVERVIEW, icon: 'layout-dashboard', requires: 'reports.view_all', keywords: 'home summary overall center overview' },
      { label: 'Collection Dashboard', path: '/blood-center/collection-dashboard', icon: 'layout-dashboard', requires: 'donations.view', keywords: 'home donor collection today counter pool eligible trend drives' },
      // Testing's own (project owner, 2026-10-22). lab.record_serology, as on
      // the server: it splits results by marker, which Processing never sees.
      { label: 'Testing Dashboard', path: '/blood-center/testing-dashboard', icon: 'layout-dashboard', requires: 'lab.record_serology', keywords: 'home testing laboratory lab bench queue serology typing reactive verify turnaround referrals trend' },
      // Processing's own (project owner, 2026-10-22): the department that records breakdowns.
      { label: 'Processing Dashboard', path: '/blood-center/processing-dashboard', icon: 'layout-dashboard', requires: 'lab.record_components', keywords: 'home processing component separation bags breakdown labels hand over turnaround trend' },
      { label: 'Issuance Dashboard', path: '/blood-center/storage', icon: 'warehouse', requires: 'inventory.create', keywords: 'issuance storage stock units release' },
      // Billing's own (project owner, 2026-10-27): the counter's day, what is owed, collections.
      { label: 'Billing Dashboard', path: '/blood-center/billing-dashboard', icon: 'layout-dashboard', requires: 'billing.record_payment', keywords: 'home billing counter collected today owed outstanding aging collections method hospitals settle payments forecast' },
    ],
  },
  {
    label: 'Donor',
    items: [
      { label: 'Donor Management', path: '/blood-center/donors', icon: 'users', requires: 'donors.view_contact', keywords: 'donors donor records profile history contact recruitment export remind eligible' },
      { label: 'Appointments', path: '/blood-center/appointments', icon: 'calendar', requires: 'appointments.view', keywords: 'booking schedule walk-in' },
      // Deferrals recorded on a donor outside a visit (project owner,
      // 2026-10-18). The list carries reasons, so the clinical record's holder.
      { label: 'Deferrals', path: '/blood-center/deferrals', icon: 'user-x', requires: 'donors.view_clinical', keywords: 'deferral defer deferred lift temporary permanent indefinite reason ineligible' },
    ],
  },
  {
    label: 'Collection',
    items: [
      // The list of every visit (project owner, 2026-10-17), and the counter
      // where a visit is recorded.
      { label: 'Donations', path: '/blood-center/donations', icon: 'list', requires: 'donations.view', keywords: 'donations records list history visits open in progress bag export' },
      // Not in the sidebar (project owner, 2026-10-24): a visit reaches the
      // counter from Donations (Scan QR, Continue) or Donor Management (Start
      // donation), with the donor already identified.
      { label: 'Donation Counter', path: '/blood-center/donation', icon: 'heart', requires: COLLECTION_ABILITIES, hidden: true },
      { label: 'Blood Donation Drive', path: '/blood-center/drives', icon: 'route', requires: 'drives.manage', keywords: 'mobile drive event donation drives' },
    ],
  },
  {
    label: 'Testing',
    items: [
      // Serology and Immunohematology share one link (project owner,
      // 2026-10-22); they were a link each. The page opens on the test its
      // holder records, and someone who records both switches views there.
      { label: 'Blood Testing', path: '/blood-center/testing', icon: 'flask-conical', requires: TESTING_ABILITIES, keywords: 'lab laboratory testing immunohematology typing abo rh forward reverse antibody screen tti serology hiv hbsag hcv syphilis vdrl malaria barcode sticker queue record' },
      // Their own pages (project owner, 2026-10-18; they were tabs on the
      // Testing page). The badge on each counts what waits for its holder.
      { label: 'Serology Results', path: '/blood-center/serology-results', icon: 'clipboard-list', badge: 'verification', requires: 'lab.record_serology', keywords: 'tti serology results list reactive non-reactive export csv verify verification correction hiv hbsag hcv syphilis malaria' },
      { label: 'Counselling Referrals', path: '/blood-center/counselling-referrals', icon: 'life-buoy', badge: 'referrals', requires: 'lab.referrals', keywords: 'counselling referrals reactive donor follow-up refer doctor contact request email mail notify referred closed' },
    ],
  },
  {
    label: 'Processing',
    items: [
      { label: 'Component Processing', path: '/blood-center/laboratory', icon: 'package-check', requires: 'lab.record_components', keywords: 'lab laboratory processing components separation breakdown bags label' },
      // Every unit with its breakdown recorded, where the hand-over to
      // Issuance is made (project owner, 2026-10-19). The badge counts what
      // waits for the component technologist to hand over.
      { label: 'Processed', path: '/blood-center/processed', icon: 'check-check', badge: 'handover', requires: 'lab.record_components', keywords: 'processed list components hand over handover issuance complete release reject bags export csv' },
      // Processing defines the components and how long each keeps; the price
      // is Billing's, under Component Prices.
      { label: 'Blood Components', path: '/blood-center/blood-components', icon: 'flask-conical', requires: 'components.configure', keywords: 'component add new shelf life expiry days code catalogue settings' },
    ],
  },
  {
    // The Issuance department's pages, headed "Stock and Supply" in the
    // sidebar (project owner, 2026-10-19). The department keeps its name.
    label: 'Stock and Supply',
    items: [
      { label: 'Blood Inventory', path: '/blood-center/inventory', icon: 'droplets', requires: 'inventory.view', keywords: 'stock units expiry fefo' },
      { label: 'Stock Intake', path: '/blood-center/inventory-intake', icon: 'package-check', requires: 'inventory.create', keywords: 'intake shelve book in units donation cleared' },
      { label: 'Incoming Requests', path: '/blood-center/bloodrequests', icon: 'clipboard-check', badge: 'pending', requires: 'requests.view', keywords: 'hospital requests walk-in watcher follow-up partial fulfilment' },
      // Split on the invoice (2026-10-31): still owing, then cleared to go out.
      { label: 'Request Fulfillment', path: '/blood-center/fulfillment', icon: 'building-2', badge: 'urgent', requires: 'requests.release', keywords: 'allocate issue invoice balance unpaid' },
      { label: 'For Dispatch', path: '/blood-center/dispatch', icon: 'truck', requires: 'requests.release', keywords: 'release dispatch transport paid cleared confirmation' },
    ],
    // Not Billing's (project owner, 2026-10-20). Its clerk and supervisor keep
    // requests.view, read-only, because a statement reads the request it bills
    // for; they just do not browse Stock and Supply's pages.
    hiddenFrom: ['billing'],
  },
  {
    label: 'Billing',
    items: [
      // No Cash Shifts entry: the counter runs without shifts (one billing staff
      // member). When the server turns them on, the counter links to their history.
      { label: 'Billing Counter', path: '/blood-center/pos', icon: 'philippine-peso', requires: 'billing.record_payment', keywords: 'pos point of sale counter cashier cash change tendered gcash qr receipt print restocking settlement' },
      // The project owner's terms (2026-10-25): an invoice is one billable
      // request; a Statement of Account sums up a hospital's invoices,
      // payments and balance over a period; a receipt proves a payment.
      // The badge counts invoices still to be paid (the billing summary).
      { label: 'Invoices', path: '/blood-center/billing', icon: 'file-text', badge: 'invoices', requires: 'billing.view', keywords: 'invoice inv bill billing request patient weekly hospital settlement subsidy balance' },
      { label: 'Statements', path: '/blood-center/statements', icon: 'clipboard', requires: 'billing.view', keywords: 'statement of account soa hospital period invoices payments balance opening closing' },
      // Receipts and Transactions are one list of payments seen two ways
      // (2026-10-27): one link, two tabs on the pages (PaymentsTabs).
      { label: 'Payments', path: '/blood-center/receipts', icon: 'receipt', requires: 'billing.record_payment', alsoActiveOn: ['/blood-center/billing-transactions'], keywords: 'payments receipt acknowledgement ar reprint print 80mm pdf void transactions journal ledger history export csv correction' },
      { label: 'Payments', path: '/blood-center/billing-transactions', icon: 'list', requires: 'billing.record_payment', hidden: true },
      // Last, together: the prices and the programs that change them, the
      // Billing Supervisor's alone (billing.prices).
      { label: 'Component Prices', path: '/blood-center/component-prices', icon: 'sliders-horizontal', requires: 'billing.prices', keywords: 'price pricing component fee charge unit cost peso settings' },
      // Scheduled subsidies, discounts and promos, beside the prices they
      // change (2026-10-27; they were under Management).
      { label: 'Billing Programs', path: '/blood-center/billing-programs', icon: 'tags', requires: 'billing.prices', keywords: 'subsidy discount promo effective date schedule billing relief' },
    ],
    // Not Issuance's (project owner, 2026-10-19). Its officer and dispatch
    // coordinator keep billing.view, read-only, because Fulfillment reads each
    // request's statement to say whether it is cleared for release; they just
    // do not browse Billing's pages.
    hiddenFrom: ['issuance'],
  },
  {
    label: 'Management',
    items: [
      { label: 'Staff Accounts', path: '/blood-center/staff', icon: 'user-check', requires: 'staff.manage', keywords: 'staff team department roles' },
      // The Admin's alone (project owner, 2026-10-21).
      { label: 'Audit Log', path: '/blood-center/audit-log', icon: 'history', requires: 'audit.view', keywords: 'audit log activity history trail who did what sign in login logout failed user action' },
      { label: 'Reports & Analytics', path: '/blood-center/reports', icon: 'bar-chart', requires: REPORTS_ABILITIES, keywords: 'report analytics past period export snbc record collection testing serology reactive typing' },
      // In Demand Forecast's place (project owner, 2026-10-25): the Billing
      // Supervisor's and both management levels' (reports.financial).
      { label: 'Financial Reports', path: '/blood-center/financial-reports', icon: 'chart', requires: 'reports.financial', keywords: 'financial report money collections collected cash card gcash bank subsidy receivables outstanding aging component hospital revenue' },
      // Out of the sidebar since 2026-10-25; still opened from Reports & Analytics.
      { label: 'Demand Forecast', path: '/blood-center/forecast', icon: 'trending-up', requires: FORECAST_ABILITIES, hidden: true, keywords: 'forecast demand projection weeks ahead shortage recruit donors workload planning emergency' },
      // These two under Management rather than Stock and Supply (project
      // owner, 2026-10-19). Their abilities are unchanged, so who sees each is
      // too: the thresholds are read with inventory.view and set only with
      // inventory.thresholds, the sheet is read with inventory.stock_report.
      { label: 'Stock Thresholds', path: '/blood-center/stock-thresholds', icon: 'sliders-horizontal', requires: 'inventory.view', keywords: 'threshold minimum low stock alert shortage reorder level notification' },
      { label: 'Daily Stock Report', path: '/blood-center/stock-report', icon: 'clipboard-list', requires: 'inventory.stock_report', keywords: 'daily stock inventory report pdf print rh expiry sheet' },
      // The codes every deferral is recorded under (project owner,
      // 2026-10-24), under Management rather than Donor (owner, same day).
      // Kept by the Screening Physician, read by the clinical record's holders.
      { label: 'Deferral Codes', path: '/blood-center/deferral-codes', icon: 'lock', requires: ['deferrals.configure', 'donors.view_clinical'], keywords: 'deferral codes reason code r1 confidential settings retire add' },
      { label: 'Corrections', path: '/blood-center/corrections', icon: 'pencil', badge: 'corrections', requires: 'corrections.request', keywords: 'correction amend mistake approve reject edit request' },
    ],
  },
  {
    label: 'Account',
    items: [
      // For everyone; Settings first, then Help Center (2026-10-27).
      { label: 'Settings', path: '/blood-center/settings', icon: 'settings', keywords: 'profile password preferences' },
      // Reached from the bell's "View all"; named here for the breadcrumb and search (2026-10-31).
      { label: 'Notifications', path: '/blood-center/notifications', icon: 'bell', hidden: true, keywords: 'notifications alerts inbox unread emergency messages' },
      { label: 'Help Center', path: '/blood-center/help', icon: 'life-buoy', keywords: 'help guide how to faq questions glossary support manual' },
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

/** Each department's own nav groups, so a member's groups can be put first. */
const DEPARTMENT_GROUPS: Record<string, readonly string[]> = {
  collection: ['Donor', 'Collection'],
  testing: ['Testing'],
  processing: ['Processing'],
  issuance: ['Stock and Supply'],
  billing: ['Billing'],
}


export function useBloodCenterNav() {
  const { can, user } = useUser()

  /**
   * Groups the current user may see, with empty groups dropped.
   *
   * Arranged by role, presentation only (what is visible is still decided by
   * `requires`). An Admin or Supervisor sees the groups in their fixed order;
   * anyone else sees their own department's groups right after Overview.
   */
  const navGroups = computed<BloodCenterNavGroup[]>(() => {
    const department = user.value?.management_level ? null : user.value?.department ?? null

    const visible = NAV_GROUPS
      .filter((group) => !(department && group.hiddenFrom?.includes(department)))
      .map((group) => ({ ...group, items: group.items.filter((item) => !item.hidden && can(item.requires)) }))
      .filter((group) => group.items.length > 0)

    if (!user.value || user.value.management_level) return visible

    // Overview (dashboards) first and Account (Settings) last for everyone;
    // between them, a staff member's own department comes before the rest.
    const home = DEPARTMENT_GROUPS[user.value.department ?? ''] ?? []
    const overview = visible.filter((group) => group.label === 'Overview')
    const account = visible.filter((group) => group.label === 'Account')
    const middle = visible.filter((group) => group.label !== 'Overview' && group.label !== 'Account')

    return [
      ...overview,
      ...middle.filter((group) => home.includes(group.label ?? '')),
      ...middle.filter((group) => !home.includes(group.label ?? '')),
      ...account,
    ]
  })

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
    const items = NAV_GROUPS.flatMap((group) => group.items)
    const match = items.find((item) => item.path === path)

    if (match) return match.label

    // A page reached without the query its links carry (e.g. /blood-center/testing
    // with no ?test=): one link to it gives that label, several give their group's.
    const base = path.split('?')[0]
    const sameBase = items.filter((item) => item.path.split('?')[0] === base)

    if (sameBase.length === 1) return sameBase[0]!.label
    if (sameBase.length > 1) {
      return NAV_GROUPS.find((group) => group.items.includes(sameBase[0]!))?.label ?? ''
    }

    return ''
  }

  /**
   * The department a page belongs to, for the breadcrumb. Read from the full
   * list, so it still names the department when the sidebar shows no headings.
   */
  function sectionForPath(path: string): string {
    const base = path.split('?')[0]
    return NAV_GROUPS.find((group) => group.items.some((item) => item.path.split('?')[0] === base))?.label ?? ''
  }

  return { navGroups, searchablePages, userMenuItems, labelForPath, sectionForPath, can }
}
