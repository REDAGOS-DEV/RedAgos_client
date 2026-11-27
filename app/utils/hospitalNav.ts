/*
 * The hospital portal's menu, by section: the sidebar draws it, and the
 * header's breadcrumb names the section and page from it (2026-11-26).
 *
 * Each item names the hospital ability its page needs (hospital roles,
 * project owner 2026-10-11), and a role without it does not see the item.
 * Presentation only: the server refuses the endpoints with `can:` either way.
 */
export interface HospitalNavItem {
  label: string
  path: string
  icon: string
  badge?: string
  // A list means any one of them.
  requires?: string | string[]
}

export interface HospitalNavGroup {
  label: string
  items: HospitalNavItem[]
}

export const HOSPITAL_NAV_GROUPS: HospitalNavGroup[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', path: '/hospital/dashboard', icon: 'layout-dashboard' },
      // The blood bank's own requests and the bags they brought, laid out as
      // the blood centre's Inventory History (project owner, 2026-11-26),
      // right under the Dashboard. Either ability: requesting staff see their
      // requests alone.
      { label: 'Request History', path: '/hospital/request-history', icon: 'history', requires: ['hospital.requests.view', 'hospital.inventory.view'] },
    ],
  },
  {
    label: 'Receiving',
    items: [
      // Patient Request sits under Receiving; there is no "Requests" folder.
      // Track Requests is back on the menu (2026-11-27): it now lists every
      // request the blood bank raised. Blood Availability came back on 2026-11-01, rebuilt. Direct
      // Distribution is gone: outside blood is added on Stock Intake
      // (project owner, 2026-10-30).
      { label: 'Patient Request', path: '/hospital/bloodrequests', icon: 'clipboard-list', badge: 'pending', requires: 'hospital.requests.view' },
      { label: 'Weekly Request', path: '/hospital/receiving/weekly', icon: 'calendar-check', requires: 'hospital.requests.view' },
      { label: 'Track Requests', path: '/hospital/trackrequests', icon: 'route', requires: 'hospital.requests.view' },
      { label: 'Blood Availability', path: '/hospital/bloodavailability', icon: 'search', requires: 'hospital.requests.view' },
    ],
  },
  {
    label: 'Stock and Supply',
    items: [
      { label: 'Blood Bank Inventory', path: '/hospital/inventory', icon: 'package', requires: 'hospital.inventory.view' },
      // Stock-in's own page, apart from the inventory (project owner, 2026-10-28).
      { label: 'Stock Intake', path: '/hospital/stock-intake', icon: 'package-check', requires: 'hospital.inventory.stock_in' },
      { label: 'Stock Thresholds', path: '/hospital/stock-thresholds', icon: 'sliders-horizontal', requires: 'hospital.inventory.view' },
      // Other hospitals' open Blood Requests, supplied from this shelf's
      // near-expiry bags (project owner, 2026-11-28).
      { label: "Other Hospitals' Requests", path: '/hospital/supply-requests', icon: 'send', requires: 'hospital.inventory.view' },
    ],
  },
  {
    // The blood bank's own reports, starting with its paper inventory sheet
    // (project owner, 2026-10-28).
    label: 'Reports',
    items: [
      { label: 'Inventory Report', path: '/hospital/inventory-report', icon: 'clipboard-list', requires: 'hospital.inventory.view' },
    ],
  },
  {
    // How the blood bank is set up, starting with the days each center gets
    // its weekly request, off the Weekly Request page (project owner, 2026-10-30).
    label: 'Facility Settings',
    items: [
      { label: 'Request Days', path: '/hospital/request-days', icon: 'calendar', requires: 'hospital.requests.view' },
    ],
  },
  // Ang Finance group (billing, transactions) kay gitangtang: walay page files
  // para niini, so 404 ang tanan. Ibalik ni kung naa nay backend + page — tan-awa
  // ang Phase P sa audit plan. Help Center came back on 2026-11-02, with its page.
  {
    label: 'System',
    items: [
      { label: 'Staff', path: '/hospital/staff', icon: 'id-card', requires: 'hospital.staff.manage' },
      { label: 'Help Center', path: '/hospital/help', icon: 'help-circle' },
      // My activity is the Settings page's Activity tab; not in the sidebar (project owner, 2026-11-11).
      { label: 'Settings', path: '/hospital/settings', icon: 'settings' },
    ],
  },
]
