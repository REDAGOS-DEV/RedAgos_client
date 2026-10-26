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
  /**
   * An ability the guide also needs, for a page everyone opens but only some
   * use this way (the Admin's part of the dashboard and of Settings).
   */
  requires?: string
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
    path: '/blood-center/donations',
    summary: 'Arrival, screening and the collection itself, in one place: the Donation Counter.',
    steps: [
      'A booked donor: on Donations, choose Scan QR and scan their Donor Portal QR. The counter opens with them.',
      'A walk-in: in Donor Management, choose the heart beside an eligible donor. The counter opens with them.',
      'A visit already under way: on Donations, choose Continue on its row.',
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
      'Save. When they are eligible, the heart beside their name starts their donation at the counter.',
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
      { q: 'How do I add new units?', a: 'New units are booked in at Stock Intake, once Processing hands over their labelled bags.' },
    ],
  },
  {
    id: 'intake',
    title: 'Book units into stock',
    department: 'Issuance',
    path: '/blood-center/inventory-intake',
    summary: 'Processing hands over bags that testing has cleared and that carry their final labels. They go straight into stock.',
    steps: [
      'Scan the donation barcode, or pick the donation from the list.',
      'Set each bag\'s storage location. The expiry is the one on its label.',
      'Book the bags in. They are available in Blood Inventory at once.',
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
      { q: 'How do I fix a wrong payment?', a: 'Open the invoice and find the payment under Payment history. Choose Correct to change the amount or method, or Void if it was recorded in error. A void is only possible on the day the payment was taken, and the Billing Supervisor approves both.' },
      { q: 'Why is a bill marked "Held"?', a: 'A patient bill holds the blood until it is paid in full or met by the government subsidy. Once it is cleared, the units can be released.' },
      { q: 'How is a weekly hospital bill paid?', a: 'Weekly orders are settled by the hospital outside RedAgos. Once the order closes, record the hospital\'s payment reference on its invoice.' },
    ],
  },
  {
    id: 'invoices',
    title: 'Read an invoice',
    department: 'Billing',
    path: '/blood-center/billing',
    summary: 'One invoice for each billable request, raised the moment stock is reserved for it.',
    steps: [
      'Choose Patient invoices or Hospital invoices.',
      'Open an invoice to see its lines, payments and issued revisions.',
      'Issue the invoice to hand over, or take payment from there.',
    ],
    questions: [
      { q: 'What is the government subsidy?', a: 'It waives the whole bill and clears the blood for release. No payment is recorded; anything collected before stays on record, and any refund is settled outside RedAgos.' },
      { q: 'Why is there more than one revision?', a: 'Each invoice is frozen when it is issued. Issuing again after the bill changes adds a revision; earlier ones stay as they were.' },
      { q: 'Why do older invoices start with SOA-?', a: 'They were issued before invoices were named so. An issued number never changes; new ones start with INV-.' },
    ],
  },
  {
    id: 'statements',
    title: 'Draw a hospital\'s Statement of Account',
    department: 'Billing',
    path: '/blood-center/statements',
    summary: 'A hospital\'s invoices, payments and remaining balance over a period.',
    steps: [
      'Choose the hospital and the period.',
      'Read the opening balance, what was invoiced and paid, and the balance left.',
      'Print it or download the PDF to send to the hospital.',
    ],
    questions: [
      { q: 'Why are patient invoices not on it?', a: 'A patient transfusion invoice is paid by the patient or watcher. A hospital\'s statement covers what the hospital owes: its weekly replenishment invoices.' },
      { q: 'Does it have a number?', a: 'No. It is drawn from the billing journal each time, for any period, and comes out the same for the same period.' },
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
      'The head of that record\'s department approves or rejects it here. A rejection needs a note.',
      'A head\'s own correction is applied as it is filed.',
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
      'Pick Light, Dark or Device mode.',
      'Pick one of the colours, or the eyedropper for any colour of your own. Reset to default undoes both.',
    ],
    questions: [
      { q: 'Does my colour change it for everyone?', a: 'No. It is saved on this device only, and used in every RedAgos portal on it.' },
    ],
  },
  {
    id: 'notifications',
    title: 'Choose your notifications',
    department: 'Account',
    path: '/blood-center/settings',
    summary: 'What RedAgos tells you about, from your role, in the bell at the top.',
    steps: [
      'Open Settings and choose Notifications.',
      'Each notice says why you get it. The ones marked Always on hold up a patient or a donor when missed, so they stay on.',
      'Turn the others on or off. The change is saved at once.',
    ],
  },

  // ---- More guides, by department ----
  {
    id: 'appointments',
    title: 'See and book appointments',
    department: 'Donor / Collection',
    path: '/blood-center/appointments',
    summary: 'Every booked visit at this centre, and booking one for a donor.',
    steps: [
      'Filter by status to see today\'s visits, or the ones still to come.',
      'To book for a donor, choose the donor, a date and a free time slot.',
      'A donor booked here gets the same reminders as one who booked in the donor portal.',
    ],
  },
  {
    id: 'deferrals',
    title: 'Record a deferral',
    department: 'Donor / Collection',
    path: '/blood-center/deferrals',
    summary: 'Donors who may not give for now, and why.',
    steps: [
      'Choose the donor and whether the deferral is temporary or permanent.',
      'Pick the deferral code, or Other and type the reason. Records show the code only; click Reason beside a code to read it.',
      'For a temporary one, set the date it starts and the date it ends.',
    ],
    questions: [
      { q: 'Does the donor see the reason?', a: 'No. The donor\'s deferral notice gives the code, such as R1, never the reason. In the portal they see that they are deferred and, for a temporary one, the date they can give again.' },
      { q: 'A reason is not on the list. What now?', a: 'Pick Other and type it; the donor\'s notice then gives no reason at all. If it keeps coming up, the Screening Physician adds a code under Management > Deferral Codes. Codes on a donor\'s record are never renamed or reused; retire one to stop offering it.' },
    ],
  },
  {
    id: 'serology-results',
    title: 'Verify a reactive result',
    department: 'Testing',
    path: '/blood-center/serology-results',
    summary: 'Reactive serology results wait here until a second person verifies them.',
    steps: [
      'Filter by Awaiting verification. The bell tells you when one arrives.',
      'Open the result and check it against the bench record.',
      'Verify it, or return it to the technologist with a note.',
    ],
    questions: [
      { q: 'Can I verify a result I recorded myself?', a: 'No. A reactive result is always checked by a second person.' },
    ],
  },
  {
    id: 'referrals',
    title: 'Follow up a reactive donor',
    department: 'Counselling',
    path: '/blood-center/counselling-referrals',
    summary: 'The Donor Counselling Physician\'s medical referrals: donors whose reactive result Testing verified.',
    steps: [
      'Start with the referrals still pending. The bell reminds you of any not acted on after three days.',
      'Ask the donor to get in touch with the mail icon: they get an email and a portal notice to call the centre, which name no result.',
      'Record their consent, choose free (public) or private, and name the provider. Then mark them referred.',
      'When the confirmatory report comes back, record it per marker. The centre\'s Confirmatory SOP gives the decision; you confirm it.',
    ],
    questions: [
      { q: 'Is the donor permanently deferred after a reactive result?', a: 'No. A reactive screen is not a diagnosis. The donor is deferred pending confirmatory testing until you record the documented result; the SOP then decides whether they are permanently or temporarily deferred, retested, or cleared.' },
      { q: 'Can I choose a different decision from the SOP\'s?', a: 'No. You confirm the decision the SOP gives for the results. If it looks wrong, check the results, or approve a corrected SOP version under Management > Confirmatory SOP.' },
      { q: 'Does clearing the donor release the blood?', a: 'No. The reactive unit stays rejected whatever the donor\'s outcome.' },
      { q: 'Does closing a referral lift the deferral?', a: 'No. The referral is the follow-up; only a confirmatory result changes the donor\'s eligibility.' },
    ],
  },
  {
    id: 'confirmatory-sop',
    title: 'Keep the confirmatory SOP',
    department: 'Counselling',
    path: '/blood-center/confirmatory-sop',
    requires: 'confirmatory_sop.configure',
    summary: 'For each marker and confirmatory result, what becomes of the donor, from the centre\'s own SOP.',
    steps: [
      'Name the SOP document, then choose a decision for every marker and result.',
      'A temporary deferral needs its number of days; an indeterminate result needs the days until the retest.',
      'Approve. The new version takes effect at once; earlier decisions keep the version they were made under.',
    ],
  },
  {
    id: 'processed',
    title: 'Hand processed units over to Issuance',
    department: 'Processing',
    path: '/blood-center/processed',
    summary: 'Units whose components are recorded, waiting to be handed to Issuance.',
    steps: [
      'Filter by Awaiting hand-over.',
      'Open a donation and check its bags.',
      'Hand it over. The units then appear in Issuance\'s intake.',
    ],
  },
  {
    id: 'stock-thresholds',
    title: 'Set minimum stock levels',
    department: 'Issuance',
    path: '/blood-center/stock-thresholds',
    summary: 'The fewest units of each blood type and component the centre should hold.',
    steps: [
      'For each blood type and component, set its minimum (and its par level, if you use one).',
      'Save. A cell that falls below its minimum shows as low, and its viewers are told.',
    ],
  },
  {
    id: 'stock-report',
    title: 'Print the daily stock report',
    department: 'Issuance',
    path: '/blood-center/stock-report',
    summary: 'Today\'s stock by blood type and component, ready to print or file.',
    steps: [
      'Open Daily Stock Report and check the figures.',
      'Download the PDF. It carries the centre\'s logos and who prepared it.',
    ],
  },
  {
    id: 'admin-dashboard',
    title: 'Keep your team and setup in order',
    department: 'Management',
    path: '/blood-center/dashboard',
    requires: 'staff.manage',
    summary: 'The Admin\'s dashboard: what waits for you, who fills each key post, and the centre\'s setup.',
    steps: [
      'Start with Needs you: each card opens the place to act.',
      'Role coverage lists the posts each department needs. One shown in red has no one: Assign opens Staff Accounts.',
      'Centre setup shows whether the logos for printed documents are uploaded.',
    ],
    questions: [
      { q: 'Why does a missing Laboratory Supervisor matter?', a: 'Reactive results can only be verified by them. Without one, those results wait.' },
    ],
  },
  {
    id: 'staff',
    title: 'Add a staff account and give it a role',
    department: 'Management',
    path: '/blood-center/staff',
    summary: 'Everyone who works in this centre\'s portal, their department and what they may do.',
    steps: [
      'Choose Add staff and enter the name, email and title (such as RMT).',
      'Pick the department and one or more of its roles. With several, choose the main one.',
      'Set the privileges (read, write, update, delete) and save. They are sent a way to sign in.',
      'To stop an account, change its status to Suspended or Deactivated rather than removing it.',
    ],
  },
  {
    id: 'audit-log',
    title: 'See who did what',
    department: 'Management',
    path: '/blood-center/audit-log',
    summary: 'Every recorded action in this centre: when, who and on what record.',
    steps: [
      'Filter by module (Staff, Collection, Inventory...) or by kind of action.',
      'Each row names the person, the action and the record it touched.',
    ],
    questions: [
      { q: 'Can an entry be changed or deleted?', a: 'No. The log is a record of what happened and cannot be edited.' },
    ],
  },
  {
    id: 'reports',
    title: 'Read the centre\'s reports',
    department: 'Management',
    path: '/blood-center/reports',
    summary: 'Donations, requests, units, staff changes and activity for a period, counted from the records.',
    steps: [
      'Pick a period: the last 7 or 30 days, this month, or a custom range.',
      'Switch between Centre, Staff & access and Activity.',
      'Export CSV saves the tab on screen for a spreadsheet.',
    ],
  },
  {
    id: 'financial-reports',
    title: 'Read the Financial Reports',
    department: 'Management',
    path: '/blood-center/financial-reports',
    summary: 'The centre\'s money for a period: what was collected and how, what the subsidy met, what is still owed, and the invoices by component and hospital.',
    steps: [
      'Choose the period at the top.',
      'Read collections over time and by method, net of voids.',
      'Check receivables: what patients and hospitals still owe today, by how long ago they were invoiced.',
      'Compare the period\'s invoices by component and by hospital.',
    ],
    questions: [
      { q: 'Who sees it?', a: 'The Billing Supervisor, the Blood Center Admin and the Supervisor.' },
      { q: 'Why does Outstanding not follow the period?', a: 'What is owed is counted as of today, whenever it was invoiced. The period sets what was invoiced, collected and settled.' },
    ],
  },
  {
    id: 'forecast',
    title: 'Plan the weeks ahead',
    department: 'Management',
    path: '/blood-center/forecast',
    // Out of the sidebar since 2026-10-25; opened from Reports & Analytics.
    via: { path: '/blood-center/reports', label: 'Reports & Analytics' },
    summary: 'What your department should expect in the next four weeks, from the last twelve: demand, donors to recruit, donations to process, samples to test or billing ahead.',
    steps: [
      'Open Demand Forecast. It shows your department\'s part; the Supervisor sees every part.',
      'Read the figure a week and its range: the range is the lowest and highest of the last four weeks.',
      'Act on the flags: Short or Watch on stock, Recruit on a blood type that needs more donors.',
      'The hatched bars are the weeks ahead. Recent weeks count more, so a busy month lifts the forecast.',
    ],
    questions: [
      { q: 'Is the forecast a prediction?', a: 'It is a planning guide: a weighted average of this centre\'s own records, not a model. A sudden emergency will not be in it.' },
      { q: 'Why is it empty?', a: 'It needs requests or donations in the last twelve weeks. It fills in as the centre records them.' },
    ],
  },
  {
    id: 'centre-settings',
    title: 'Set the centre\'s logos and donor emails',
    department: 'Management',
    path: '/blood-center/settings',
    requires: 'center.configure',
    summary: 'What the centre\'s printed documents and donor emails carry.',
    steps: [
      'Open Settings and choose Center.',
      'Upload the centre logo and the left report logo. They print on receipts, statements and the stock report.',
      'Under Donor emails, edit the Thank-You and Eligibility Reminder wording. Insert a detail adds the donor\'s name, dates and more; the preview shows what a donor receives.',
    ],
  },
]

/**
 * Help for each role: what the job is in RedAgos, and the guides to start
 * with. Keyed by staff role, and by management level for the Admin and the
 * Supervisor. Only guides the person may open are shown.
 */
export const ROLE_HELP: Record<string, { summary: string, start: string[] }> = {
  screening_physician: { summary: 'You screen donors, decide whether they may give today, and approve Collection\'s corrections.', start: ['collection', 'deferrals', 'corrections'] },
  phlebotomist: { summary: 'You collect the blood and label every bag and tube.', start: ['collection', 'donors'] },
  apheresis_specialist: { summary: 'You collect blood components by apheresis and label them.', start: ['collection', 'donors'] },
  medical_receptionist: { summary: 'You welcome donors, book their visits and run the mobile drives.', start: ['appointments', 'donors', 'drives'] },
  component_technologist: { summary: 'You separate units into components, hand them to Issuance, and approve Processing\'s corrections.', start: ['processing', 'processed', 'corrections'] },
  processing_assistant: { summary: 'You help separate units into components and hand them to Issuance.', start: ['processing', 'processed'] },
  serology_technologist: { summary: 'You type each unit and run its serology panel.', start: ['testing', 'serology-results'] },
  lab_supervisor: { summary: 'You verify reactive results and approve Testing\'s corrections. A verified reactive result goes to the Donor Counselling Physician as a medical referral.', start: ['serology-results', 'testing'] },
  counselling_physician: { summary: 'You follow up donors whose reactive result Testing verified: contact, consent, the referral, and the confirmatory result that the centre\'s SOP decides on.', start: ['referrals', 'confirmatory-sop'] },
  inventory_control_officer: { summary: 'You keep the stock, decide on hospital requests and approve Issuance\'s corrections.', start: ['requests', 'stock-thresholds', 'intake'] },
  dispatch_coordinator: { summary: 'You release units for hospital requests.', start: ['fulfillment', 'inventory', 'requests'] },
  it_data_clerk: { summary: 'You keep the stock records and the daily report up to date.', start: ['inventory', 'stock-report'] },
  billing_clerk: { summary: 'You take payments at the counter and issue receipts.', start: ['counter', 'receipts', 'cash-shifts'] },
  billing_supervisor: { summary: 'You head Billing: invoices, statements, the journal, its corrections and the Financial Reports.', start: ['invoices', 'statements', 'financial-reports'] },
  admin: { summary: 'You keep the centre\'s team, its setup and its records in order. You do not do department work.', start: ['admin-dashboard', 'staff', 'centre-settings'] },
  supervisor: { summary: 'You watch every department and the centre\'s figures, without doing their work.', start: ['reports', 'inventory', 'requests'] },
}

/** Terms staff meet across RedAgos. */
export const HELP_GLOSSARY: { term: string; meaning: string }[] = [
  { term: 'PTR', meaning: 'Patient Transfusion Request: a patient\'s need for blood, which one or more centres may supply.' },
  { term: 'Invoice', meaning: 'What one billable request is charged (INV-…). Not a BIR-registered invoice and not an official receipt.' },
  { term: 'SOA', meaning: 'Statement of Account: a hospital\'s invoices, payments and remaining balance over a period.' },
  { term: 'AR', meaning: 'Payment Acknowledgement Receipt: issued for each payment taken.' },
  { term: 'TTI', meaning: 'Transfusion-transmissible infections: the serology panel each unit is tested for.' },
  { term: 'Immunohematology', meaning: 'Blood typing: the unit\'s ABO group and Rh type.' },
  { term: 'Quarantine', meaning: 'Bags still with Processing while testing clears their donation. Their base label says "not for issue".' },
  { term: 'FEFO', meaning: 'First expiry, first out: issue the unit that expires soonest.' },
  { term: 'Walk-in', meaning: 'A request a watcher brings to the centre instead of the hospital blood bank sending it.' },
  { term: 'Weekly replenishment', meaning: 'A hospital\'s restocking order, billed to the hospital and settled outside RedAgos.' },
  { term: 'Correction', meaning: 'An approved change to a saved record. Records are never edited directly.' },
]

/**
 * Whether this account sees a guide: it can open the guide's page (or the
 * page it is reached from), and holds the guide's own ability if it names one.
 */
export function guideVisible(guide: HelpGuide, allowedPaths: Set<string>, can?: (_ability: string) => boolean): boolean {
  if (guide.requires && !(can?.(guide.requires) ?? false)) return false
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
