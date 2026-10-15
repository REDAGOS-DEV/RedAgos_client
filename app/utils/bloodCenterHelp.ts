/**
 * The blood-center portal's help: one guide per page, grouped by department,
 * plus the terms staff meet across RedAgos.
 *
 * The Help Center and the top bar search read from here, so the wording is
 * changed in one place without touching a page. A shortcut listed here must
 * already work on its page; the help only describes.
 */

/** One key or a run of keys pressed together, e.g. ['Ctrl', 'F']. */
export type ShortcutKeys = string[]

export interface HelpShortcut {
  label: string
  /** Each entry is one way to do it; alternatives show as "or". */
  keys: ShortcutKeys[]
  /** Where it works, when that is narrower than the whole page. */
  note?: string
}

export interface HelpQuestion {
  q: string
  a: string
}

export interface HelpGuide {
  /** Used in links: /blood-center/help?guide=<id>. */
  id: string
  title: string
  /** The sidebar group the page sits in. */
  department: HelpDepartment
  /** The page the guide is about, without its query. */
  path: string
  /**
   * For a page with no sidebar link of its own: the sidebar page it is
   * reached from, whose access decides who sees the guide, and its name.
   */
  via?: { path: string; label: string }
  /** What the page is for, in a sentence. */
  summary: string
  steps: string[]
  shortcuts?: HelpShortcut[]
  questions?: HelpQuestion[]
}

export const HELP_DEPARTMENTS = ['Donor / Collection', 'Testing', 'Processing', 'Issuance', 'Billing', 'Management', 'Account'] as const
export type HelpDepartment = (typeof HELP_DEPARTMENTS)[number]

export const HELP_GUIDES: HelpGuide[] = [
  // ---- Donor / Collection ----
  {
    id: 'collection',
    title: 'Take a donor through a visit',
    department: 'Donor / Collection',
    path: '/blood-center/collection',
    summary: 'Arrival, screening and the collection itself, in one place.',
    steps: [
      'Scan the donor once on arrival.',
      'Carry on with screening; the visit continues from that scan.',
      'Record the collection with the donation barcode sticker that goes on the form, every bag and tube.',
    ],
    questions: [
      { q: 'Where do the tubes go next?', a: 'Once the collection is recorded, the donation appears in the Testing queue.' },
    ],
  },
  {
    id: 'donors',
    title: 'Register a walk-in donor',
    department: 'Donor / Collection',
    path: '/blood-center/donors',
    summary: 'Every donor this centre knows, and a form to add a new one.',
    steps: [
      'Choose Register walk-in.',
      'Enter the name, birth date and the number on a valid ID. Sex and blood type are optional.',
      'Save. The donor can now be found by name when they arrive.',
    ],
  },
  {
    id: 'drives',
    title: 'Schedule a donation drive',
    department: 'Donor / Collection',
    path: '/blood-center/drives',
    summary: 'Mobile drives this centre runs, and how many donors each can take.',
    steps: [
      'Choose Create drive.',
      'Enter the name, the venue, the date, the capacity and the start and end times.',
      'Save. The drive is listed under Upcoming.',
    ],
    questions: [
      { q: 'Can I edit a drive after saving it?', a: 'Not yet. Editing a drive is not available in this version.' },
    ],
  },

  // ---- Testing ----
  {
    id: 'testing',
    title: 'Record typing and serology results',
    department: 'Testing',
    path: '/blood-center/testing',
    summary: 'Each drawn unit\'s blood typing (immunohematology) and its serology (TTI) panel.',
    steps: [
      'Scan the barcode sticker on a tube, or pick a unit from the queue.',
      'Enter what the medical technologist found.',
      'Save. A passing result clears its section of the unit.',
    ],
    questions: [
      { q: 'Can I change a saved result?', a: 'Only through a correction, which is applied once it is approved. RedAgos records what was found; it does not perform or interpret any test.' },
      { q: 'The barcode is not found.', a: 'The queue shows units waiting for the test you are on. Switch the view to All to look across both tests.' },
    ],
  },

  // ---- Processing ----
  {
    id: 'processing',
    title: 'Record component processing',
    department: 'Processing',
    path: '/blood-center/laboratory',
    summary: 'What each unit was separated into, and whether it is cleared for issue.',
    steps: [
      'Pick a unit from the list.',
      'Record the components it was separated into.',
      'Clear it for issue, or reject it. Testing\'s outcome shows here as it is recorded.',
    ],
  },

  // ---- Issuance ----
  {
    id: 'inventory',
    title: 'Find units in stock',
    department: 'Issuance',
    path: '/blood-center/inventory',
    summary: 'Every unit on the shelf by blood type and component, and what is about to expire.',
    steps: [
      'Click a blood-type column in the chart to filter the records below.',
      'Narrow the list with the component, status and expiry filters.',
      'Use the storage and expiry columns to pick the unit that expires first.',
    ],
    questions: [
      { q: 'How do I add new units?', a: 'New units are booked in at Stock Intake, once their donation has cleared testing.' },
      { q: 'Why can\'t I issue a unit in quarantine?', a: 'A donation\'s bags leave quarantine together, and only once TTI testing and immunohematology have both cleared it. They are then released at Stock Intake.' },
    ],
  },
  {
    id: 'intake',
    title: 'Book units into stock',
    department: 'Issuance',
    path: '/blood-center/inventory-intake',
    summary: 'Processed bags go into quarantine first, and are released and labelled once testing clears.',
    steps: [
      'Pick the processed donation and book its bags into quarantine, with expiry and storage location.',
      'Wait for TTI testing and immunohematology to clear the donation.',
      'Release the bags and label them. They are now available in Blood Inventory.',
    ],
  },
  {
    id: 'requests',
    title: 'Review a blood request',
    department: 'Issuance',
    path: '/blood-center/bloodrequests',
    summary: 'Requests from hospital blood banks, sent through the portal or brought in by a watcher.',
    steps: [
      'Open a request to see the patient, the units asked for and the priority.',
      'Choose Approve and reserve to hold the units, or reject it with a reason.',
      'For a watcher at the counter, use New Walk-in Request.',
    ],
    questions: [
      { q: 'A watcher brought a request. What do I do?', a: 'Choose New Walk-in Request. You call the patient\'s hospital blood bank to confirm it; if the hospital does not confirm, nothing is recorded.' },
      { q: 'Where do approved requests go?', a: 'Approving reserves the selected units and moves the request to Request Fulfillment, where they are released.' },
    ],
  },
  {
    id: 'fulfillment',
    title: 'Release units for a request',
    department: 'Issuance',
    path: '/blood-center/fulfillment',
    summary: 'Dispatch the units held for each request. Releasing them is what fulfils it, partly or fully.',
    steps: [
      'Open a request that is ready for release.',
      'Dispatch the units held for it.',
      'The hospital then confirms each unit arrived.',
    ],
    questions: [
      { q: 'How do walk-in units leave?', a: 'A walk-in\'s units usually leave with the watcher who presented the request.' },
    ],
  },

  // ---- Billing ----
  {
    id: 'counter',
    title: 'Take a payment at the counter',
    department: 'Billing',
    path: '/blood-center/pos',
    summary: 'Take payment for patient bills and record weekly hospital settlements.',
    steps: [
      'Scan the request barcode, or pick who is waiting from the list.',
      'Check the bill: the units, the amount due and what was paid before.',
      'Take cash or GCash, then print the receipt.',
    ],
    shortcuts: [
      { label: 'Scan a barcode', keys: [['/'], ['F2']] },
      { label: 'Clear the bill', keys: [['Esc']] },
      { label: 'Complete the payment', keys: [['Enter']], note: 'in the amount field' },
    ],
    questions: [
      { q: 'How do I fix a wrong payment?', a: 'Open the statement and find the payment under Payment history. Choose Correct to change the amount or method, or Void if it was recorded in error. A void is only possible on the day the payment was taken, and the Billing Supervisor approves both.' },
      { q: 'Why is a bill marked "Held"?', a: 'A patient bill holds the blood until it is paid in full or met by the government subsidy. Once it is cleared, the units can be released.' },
      { q: 'How is a weekly hospital bill paid?', a: 'Weekly orders are settled by the hospital outside RedAgos. Once the order closes, record the hospital\'s payment reference on its statement.' },
    ],
  },
  {
    id: 'statements',
    title: 'Read a statement',
    department: 'Billing',
    path: '/blood-center/billing',
    summary: 'A bill is raised the moment stock is reserved for a request.',
    steps: [
      'Choose Patient bills or Hospital statements.',
      'Open a statement to see its lines, payments and issued revisions.',
      'Issue a statement to hand over, or take payment from there.',
    ],
    questions: [
      { q: 'What is the government subsidy?', a: 'It waives the whole bill and clears the blood for release. No payment is recorded; anything collected before stays on record, and any refund is settled outside RedAgos.' },
      { q: 'Why is there more than one revision?', a: 'Each statement is frozen when it is issued. Issuing again after the bill changes adds a revision; earlier ones stay as they were.' },
    ],
  },
  {
    id: 'receipts',
    title: 'Find or reprint a receipt',
    department: 'Billing',
    path: '/blood-center/receipts',
    summary: 'Every acknowledgement receipt this centre has issued, one for each payment taken.',
    steps: [
      'Search by receipt number, request reference or patient, or filter by date.',
      'Open it to see the details, or switch to As printed.',
      'Print the 80mm slip or download the PDF.',
    ],
    questions: [
      { q: 'Why is an old receipt marked void?', a: 'A corrected payment\'s old receipt stays on record, voided, beside its replacement.' },
      { q: 'Is it an official receipt?', a: 'No. It acknowledges payment received; it is not a BIR official receipt.' },
    ],
  },
  {
    id: 'cash-shifts',
    title: 'Check a cash shift',
    department: 'Billing',
    path: '/blood-center/cash-shifts',
    via: { path: '/blood-center/pos', label: 'Cash Shifts' },
    summary: 'Each shift at the counter: the float, what was taken, what the drawer should hold, and what was counted.',
    steps: [
      'Pick a date range, then a shift from the list.',
      'Compare what the drawer should hold with what was counted, and read the shift\'s transactions.',
    ],
  },
  {
    id: 'transactions',
    title: 'Check the billing journal',
    department: 'Billing',
    path: '/blood-center/billing-transactions',
    summary: 'Every money event on this centre\'s bills, numbered and in order. Nothing here is ever edited.',
    steps: [
      'Search by transaction, request or payment reference, or filter by date and type.',
      'Read each day\'s entries; a void shows which transaction it reverses.',
      'Export CSV for the same filters.',
    ],
  },

  // ---- Management ----
  {
    id: 'corrections',
    title: 'Request or approve a correction',
    department: 'Management',
    path: '/blood-center/corrections',
    summary: 'Saved records are never edited directly; a mistake is fixed by an approved correction.',
    steps: [
      'Whoever entered the record requests a correction from that record\'s page.',
      'The department\'s approver or the Center Admin approves or rejects it here. A rejection needs a note.',
      'An approved correction is applied under the same rules as the original.',
    ],
    questions: [
      { q: 'Is there anything I can edit directly?', a: 'A unit\'s storage location and expiry date: the Inventory Control Officer edits those directly.' },
    ],
  },

  // ---- Account ----
  {
    id: 'settings',
    title: 'Change your portal colour or theme',
    department: 'Account',
    path: '/blood-center/settings',
    summary: 'Your profile, password and how the portal looks.',
    steps: [
      'Open Settings and choose Appearance.',
      'Pick a portal colour, and Light, Dark or System mode.',
    ],
  },
]

/** Terms staff meet across RedAgos. */
export const HELP_GLOSSARY: { term: string; meaning: string }[] = [
  { term: 'PTR', meaning: 'Patient Transfusion Request: a patient\'s need for blood, which one or more centres may supply.' },
  { term: 'SOA', meaning: 'Statement of Account: what a request is billed. Not an invoice and not an official receipt.' },
  { term: 'AR', meaning: 'Payment Acknowledgement Receipt: issued for each payment taken.' },
  { term: 'TTI', meaning: 'Transfusion-transmissible infections: the serology panel each unit is tested for.' },
  { term: 'Immunohematology', meaning: 'Blood typing: the unit\'s ABO group and Rh type.' },
  { term: 'Quarantine', meaning: 'Where booked-in bags wait until testing clears their donation.' },
  { term: 'FEFO', meaning: 'First expiry, first out: issue the unit that expires soonest.' },
  { term: 'Walk-in', meaning: 'A request a watcher brings to the centre instead of the hospital blood bank sending it.' },
  { term: 'Weekly replenishment', meaning: 'A hospital\'s restocking order, billed to the hospital and settled outside RedAgos.' },
  { term: 'Correction', meaning: 'An approved change to a saved record. Records are never edited directly.' },
]

/** Whether this account sees a guide: it can open the guide's page (or the page it is reached from). */
export function guideVisible(guide: HelpGuide, allowedPaths: Set<string>): boolean {
  return allowedPaths.has(guide.via?.path ?? guide.path)
}

/** Guides whose words hold every word of `query`, for the top bar search. */
export function searchGuides(query: string, guides: HelpGuide[]): HelpGuide[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return guides.filter((g) => {
    const text = [g.title, g.summary, g.department, ...g.steps, ...(g.questions ?? []).flatMap((x) => [x.q, x.a])].join(' ').toLowerCase()
    return words.every((w) => text.includes(w))
  })
}
