/**
 * One line under each hospital page's title, for the person reading it
 * (project owner, 2026-11-01). Worded from what their role may do there, by
 * ability rather than role name, so the Head reads the line for doing the work
 * and a role that only reads a page is told who does.
 */
type Can = (ability: string) => boolean

const LINES: Record<string, (can: Can) => string> = {
  dashboard: (can) => {
    const requests = can('hospital.requests.manage')
    const stock = can('hospital.inventory.handle')
    if (requests && stock) return 'Your blood bank today: patient requests, weekly restock and the stock on the shelf.'
    if (requests) return 'Your patient requests and weekly restock today, and what is waiting on you.'
    if (stock) return 'Your stock today: what is on the shelf, running low or close to expiry.'
    return 'Your blood bank today.'
  },
  patientRequests: (can) => (can('hospital.requests.manage')
    ? 'Raise blood requests for your patients, follow them, and confirm the bags when they arrive.'
    : 'Follow the blood requests raised for your patients. Requesting staff raise them.'),
  newRequest: () => 'Request blood for one patient. Your own stock is checked first, before asking a blood center.',
  requestDetails: (can) => (can('hospital.requests.manage')
    ? 'Where this request stands, and what to do next.'
    : 'Where this request stands.'),
  weekly: (can) => (can('hospital.requests.manage')
    ? 'Send each blood center its restock on your request days, then receive what it dispatches.'
    : 'The restock sent to each blood center and what came of it. Requesting staff send it.'),
  availability: (can) => (can('hospital.requests.manage')
    ? 'See which blood centers hold what you need, then raise the request.'
    : 'See which blood centers hold a blood type and component.'),
  track: () => 'Search a reference number to see how far along a request is.',
  inventory: (can) => (can('hospital.inventory.handle')
    ? 'Tag bags to patients, record crossmatch and transfusion, and release or discard them.'
    : 'Every bag in your blood bank and the patient it is tagged to. Inventory staff handle the bags.'),
  stockIntake: (can) => (can('hospital.receiving.direct')
    ? 'Put arrived bags on the shelf so they can be tagged, or add a bag from outside RedAgos.'
    : 'Put arrived bags on the shelf so they can be tagged.'),
  thresholds: (can) => (can('hospital.inventory.thresholds')
    ? 'Set the PAR and critical levels for each blood type and component, so you restock before a shelf runs out.'
    : 'The PAR and critical levels for each blood type and component. Inventory staff set them.'),
  inventoryReport: () => 'Fill your inventory form from the bags on the shelf, and keep each report as its PDF.',
  requestDays: (can) => (can('hospital.schedules.manage')
    ? 'The days you send each blood center your weekly request. A weekly request can only be sent on one of them, once a day.'
    : 'The days your blood bank sends each blood center its weekly request. Requesting staff set them.'),
  staff: () => 'Your blood bank\'s staff accounts, and the role each one holds.',
  notifications: () => 'What has changed on your blood bank\'s requests and stock.',
}

export function hospitalPageSubtitle(page: keyof typeof LINES, can: Can): string {
  return LINES[page]?.(can) ?? ''
}
