/**
 * The hospital blood bank's help: one guide per job, grouped as the sidebar is,
 * plus the terms staff meet (project owner, 2026-11-02).
 *
 * The Help Center and the top bar search read from here, so the wording is
 * changed in one place without touching a page. It only describes: a step named
 * here must already work on its page, for the roles that see the guide.
 */

export interface HospitalHelpQuestion {
  q: string
  a: string
}

export interface HospitalHelpGuide {
  /** Used in links: /hospital/help?guide=<id>. */
  id: string
  title: string
  /** The sidebar group the page sits in. */
  department: HospitalHelpDepartment
  /** The page the guide is about. */
  path: string
  /** What the link to that page is called. */
  pageLabel: string
  /** The ability the job needs; a guide with none is for every hospital role. */
  requires?: string
  /** What the job is, in a sentence. */
  summary: string
  steps: string[]
  questions?: HospitalHelpQuestion[]
}

export const HOSPITAL_HELP_DEPARTMENTS = ['Receiving', 'Stock and Supply', 'Reports', 'Facility Settings', 'System'] as const
export type HospitalHelpDepartment = (typeof HOSPITAL_HELP_DEPARTMENTS)[number]

export const HOSPITAL_HELP_GUIDES: HospitalHelpGuide[] = [
  // ---- Receiving ----
  {
    id: 'new-request',
    title: 'Request blood for a patient',
    department: 'Receiving',
    path: '/hospital/bloodrequests/newrequest',
    pageLabel: 'New Blood Request',
    requires: 'hospital.requests.manage',
    summary: 'Ask one or more blood centers for what one patient needs.',
    steps: [
      'On Patient Request, press New Request.',
      'Check your own stock first. View my stock shows what is on your shelf. Tick the line once your inventory cannot cover this patient.',
      'Enter the patient, the blood type and the priority: Routine, or STAT when it cannot wait. Add Needed by if the blood must arrive by a set time.',
      'Add each component with its units and indication. A component can only be listed once.',
      'Press Find facilities, then choose which blood center is asked for what.',
      'Review the request and press Send request.',
    ],
    questions: [
      {
        q: 'It says this patient already has an active request. What do I do?',
        a: 'Open that request if it covers the same need, instead of sending a second one. If some of its units are still unallocated, ask another facility from there.',
      },
      {
        q: 'Will I lose what I typed if I leave the page?',
        a: 'Your draft is kept for this browser tab, and the form offers it back when you return. Sending the request or starting over clears it.',
      },
    ],
  },
  {
    id: 'follow-requests',
    title: 'Follow a patient\'s request',
    department: 'Receiving',
    path: '/hospital/bloodrequests',
    pageLabel: 'Patient Request',
    requires: 'hospital.requests.view',
    summary: 'See how far along each request is, and which are waiting on something.',
    steps: [
      'Open Patient Request. Open STAT requests are listed first.',
      'Press a figure at the top, or a quick filter such as To receive or Needs a facility, to narrow the list.',
      'Press a row for its quick view, or open its full details for the facilities asked, the bags and the history.',
      'Staff who raise requests can cancel one from its details while it can still be cancelled.',
    ],
  },
  {
    id: 'receive-delivery',
    title: 'Receive a delivery',
    department: 'Receiving',
    path: '/hospital/bloodrequests',
    pageLabel: 'Patient Request',
    requires: 'hospital.receipt.confirm',
    summary: 'Confirm that the bags a blood center sent have arrived.',
    steps: [
      'Once a center dispatches, or you pick up, the row shows Receive on Patient Request or Weekly Request.',
      'Press Receive. It lists what is on its way.',
      'Confirm to take the whole delivery in one go.',
      'If the delivery came short, open the request\'s own page and receive it bag by bag.',
      'The received bags go to Stock Intake, where inventory staff put them on a shelf.',
    ],
    questions: [
      {
        q: 'I received the bags. Why are they not in the inventory\'s available stock?',
        a: 'Receiving has two steps. A received bag waits as Awaiting stock-in until it is put on a shelf at Stock Intake. Only then can it be tagged to a patient.',
      },
    ],
  },
  {
    id: 'weekly-request',
    title: 'Send your weekly request',
    department: 'Receiving',
    path: '/hospital/receiving/weekly',
    pageLabel: 'Weekly Request',
    requires: 'hospital.requests.manage',
    summary: 'Restock your shelf from a blood center on your request days.',
    steps: [
      'Open Weekly Request. Today shows a card for each blood center, with the ones due today first.',
      'On a center that is Due today, press Send request.',
      'Add a line for each component and blood type, with the units you want, and send it.',
      'The center supplies what it can. You may be sent all, part or none of what you asked for.',
      'Receive what it dispatches. Only the units you actually receive are added to your inventory.',
    ],
    questions: [
      {
        q: 'Why can I not send a weekly request today?',
        a: 'A weekly request can only be sent on one of that center\'s request days, once a day. The card says Not a request day and shows the next one, or Sent today if one has already gone.',
      },
      {
        q: 'What does missed mean on a center\'s card?',
        a: 'A request day in the last 4 weeks when no weekly request was sent to that center.',
      },
    ],
  },
  {
    id: 'availability',
    title: 'See which center has the blood',
    department: 'Receiving',
    path: '/hospital/bloodavailability',
    pageLabel: 'Blood Availability',
    requires: 'hospital.requests.view',
    summary: 'Look up which blood centers hold a blood type and component.',
    steps: [
      'Open Blood Availability and choose a blood type and a component. The results come up on their own.',
      'Add the units you need, if you know them, to see which centers can cover it.',
      'Staff who raise requests can press New Request, and the form opens on what you searched for.',
    ],
    questions: [
      {
        q: 'Does a center hold the blood for me once I see it here?',
        a: 'No. It is a guide, as of now. Nothing is held until a request is raised and the center approves it.',
      },
    ],
  },
  {
    id: 'track-request',
    title: 'Track a request by its reference',
    department: 'Receiving',
    path: '/hospital/trackrequests',
    pageLabel: 'Track Requests',
    requires: 'hospital.requests.view',
    summary: 'Find a request from its reference number and see each step it has passed.',
    steps: [
      'Open Track Requests from the Dashboard.',
      'Type the reference number and search, or pick one from your recent requests.',
      'The steps show what has happened and when, with the blood center\'s details.',
    ],
  },

  // ---- Stock and Supply ----
  {
    id: 'stock-in',
    title: 'Put arrived bags on the shelf',
    department: 'Stock and Supply',
    path: '/hospital/stock-intake',
    pageLabel: 'Stock Intake',
    requires: 'hospital.inventory.stock_in',
    summary: 'Turn received bags into stock that can be tagged to a patient.',
    steps: [
      'Open Stock Intake. It lists the bags whose arrival was confirmed.',
      'Scan each bag, or type its number. Each scanned bag is ticked.',
      'Pick a storage location for every bag. It cannot be left out.',
      'Press Stock in. The bags are now in your inventory, free to tag.',
      'For a bag from outside RedAgos, press Add Blood Unit and enter what the bag says.',
    ],
    questions: [
      {
        q: 'Why can I not stock in this bag?',
        a: 'A bag past its expiry date cannot be stocked in. Discard it instead. If the list says it was already stocked in, a colleague did it first.',
      },
    ],
  },
  {
    id: 'tag-bag',
    title: 'Tag a bag and record its transfusion',
    department: 'Stock and Supply',
    path: '/hospital/inventory',
    pageLabel: 'Blood Bank Inventory',
    requires: 'hospital.inventory.handle',
    summary: 'Hold one bag for one patient, from tag to crossmatch to transfusion.',
    steps: [
      'On Blood Bank Inventory, find the bag and open its row menu, then press Tag to patient.',
      'Choose the patient\'s blood request, or enter the patient. The bag stays in storage as Tag Assigned, with 24 hours to crossmatch.',
      'After the crossmatch, press Record crossmatch. The bag leaves storage as Tag Crossmatched, with 24 hours to transfuse.',
      'After the transfusion, press Record transfusion.',
      'If the patient no longer needs it, press Release tag and give the reason.',
    ],
    questions: [
      {
        q: 'Why did the tag on my bag disappear?',
        a: 'Each stage has 24 hours, and the countdown shows on the row. When it runs out, the system releases the tag on its own. Tag History shows what ended and why.',
      },
      {
        q: 'What do I do with a bag at Pending Return?',
        a: 'It left storage and its tag ended. Once it is back, press Back in storage to make it available again, or Discard if it cannot be used.',
      },
      {
        q: 'Why can I not discard this bag?',
        a: 'A tagged bag has to have its tag released first.',
      },
    ],
  },
  {
    id: 'reserve-for-partner',
    title: 'Reserve a bag for the blood donor partner program',
    department: 'Stock and Supply',
    path: '/hospital/inventory',
    pageLabel: 'Blood Bank Inventory',
    requires: 'hospital.inventory.handle',
    summary: 'Set a bag aside for the blood donor partner program. It stays in storage but is no longer for patients, and prints purple on the Inventory Report.',
    steps: [
      'On Blood Bank Inventory, open the bag or its row menu, then press Reserve for donor partner.',
      'Press Reserve bag. The bag shows as Reserved for Donor Partner.',
      'To give it back to patients, press Release reservation. It is available again.',
    ],
    questions: [
      {
        q: 'Can a reserved bag be tagged to a patient?',
        a: 'No. Release the reservation first. Until then it cannot be tagged.',
      },
      {
        q: 'Does a reserved bag count as available stock?',
        a: 'No. It is left out of the available counts, the stock levels and the minimum-stock alerts. If 10 Packed RBC are on the shelf and 3 are reserved, 7 are available for patients.',
      },
      {
        q: 'How do I list the reserved bags?',
        a: 'Set Status to Reserved for Donor Partner.',
      },
    ],
  },
  {
    id: 'read-inventory',
    title: 'Read your inventory',
    department: 'Stock and Supply',
    path: '/hospital/inventory',
    pageLabel: 'Blood Bank Inventory',
    requires: 'hospital.inventory.view',
    summary: 'See what is on the shelf, what is short and what expires soon.',
    steps: [
      'The figures at the top give the totals. Press Expiring Soon, Tagged to Patients or Pending Return to list those bags.',
      'Blood Type Availability shows each type against its critical level. Press a card to list only that type, and press it again to show all.',
      'Search by bag number or tagged patient, or filter the list by blood type, component, expiry risk or status.',
      'Press a bag for its details, its tags and its movement history.',
      'Tag History lists the tags that ended, and Recent Activity lists what moved.',
    ],
  },
  {
    id: 'thresholds',
    title: 'Set your stock levels',
    department: 'Stock and Supply',
    path: '/hospital/stock-thresholds',
    pageLabel: 'Stock Thresholds',
    requires: 'hospital.inventory.thresholds',
    summary: 'Decide how much you want to hold, and when to be warned.',
    steps: [
      'Open Stock Thresholds. It lists each blood type and component against what is on your shelf.',
      'Set the PAR level, the stock you aim to keep, and the critical level, the least you can hold before a low-stock alert.',
      'Save your changes. Blood types are graded on the inventory and the dashboard from these levels.',
    ],
    questions: [
      {
        q: 'Why does every blood type say No level set?',
        a: 'No critical level has been set yet, so no type can be graded. Inventory staff or the Head set them here.',
      },
    ],
  },

  // ---- Reports ----
  {
    id: 'inventory-report',
    title: 'Generate the inventory report',
    department: 'Reports',
    path: '/hospital/inventory-report',
    pageLabel: 'Inventory Report',
    requires: 'hospital.inventory.view',
    summary: 'Fill your inventory form from the bags on the shelf, and keep it as a PDF.',
    steps: [
      'Open Inventory Report. Your last settings in this browser are already chosen.',
      'Choose the blood components and blood types, and whether each type gets its own sheet.',
      'Press Generate Report. The sheets appear beside the settings, as they print.',
      'Press Download PDF, or View PDF to read it here.',
      'Every report is kept under Generated Reports, to open or download again exactly as it was.',
    ],
    questions: [
      {
        q: 'Which bags does the report list?',
        a: 'Only bags in date on your shelf, as of the moment you generate it. It is not created on its own: someone has to press Generate Report.',
      },
      {
        q: 'What do the colours and marks mean on a sheet?',
        a: 'Under Crossmatched, a blue bag is waiting for its transfusion, and a green bag, marked (TF), was transfused that day. Under Uncrossmatched, a black bag is on the shelf and not tagged, a pink bag, marked (T), is tagged to a patient and still waiting for its crossmatch, and a purple bag, marked (R), is reserved for the blood donor partner program.',
      },
    ],
  },

  // ---- Facility Settings ----
  {
    id: 'request-days',
    title: 'Set your request days',
    department: 'Facility Settings',
    path: '/hospital/request-days',
    pageLabel: 'Request Days',
    requires: 'hospital.schedules.manage',
    summary: 'Choose the days you send each blood center your weekly request.',
    steps: [
      'Open Request Days and press Add Center.',
      'Choose the blood center you restock from and the days you send it your weekly request.',
      'Press a center\'s edit button to change its days, or its remove button to stop restocking from it.',
    ],
  },

  // ---- System ----
  {
    id: 'staff',
    title: 'Manage your staff',
    department: 'System',
    path: '/hospital/staff',
    pageLabel: 'Staff',
    requires: 'hospital.staff.manage',
    summary: 'Give each colleague an account and the role that fits their work.',
    steps: [
      'Open Staff. The cards at the top say what each role covers.',
      'Press Add Staff, enter their details and choose their role.',
      'Press a row\'s edit button to change a colleague\'s role or title, or its remove button to remove the account.',
    ],
    questions: [
      {
        q: 'Why can I not remove my own account?',
        a: 'Another Head has to remove it.',
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Use your notifications',
    department: 'System',
    path: '/hospital/notifications',
    pageLabel: 'Notifications',
    summary: 'See what changed on your requests and stock, and go straight to it.',
    steps: [
      'The bell shows how many are unread. Open it for the latest, or press See all notifications.',
      'Anything urgent and unread comes first, under Needs Action. The rest are grouped by day.',
      'Press a notification to mark it read and go to what it is about.',
      'Use the tabs to show only Unread, Blood Requests or Stock Alerts.',
    ],
  },
  {
    id: 'settings',
    title: 'Change your account settings',
    department: 'System',
    path: '/hospital/settings',
    pageLabel: 'Settings',
    summary: 'Your profile, password and how the portal looks.',
    steps: [
      'Open Settings from the sidebar.',
      'Update your profile and photo, change your password, or choose the appearance you prefer.',
    ],
  },
]

/** What each role does here, and the guides to start with. Keyed by users.hospital_role. */
export const HOSPITAL_ROLE_HELP: Record<string, { summary: string, start: string[] }> = {
  head: {
    summary: 'You run the blood bank: every request, all the stock, and your team\'s accounts.',
    start: ['staff', 'new-request', 'tag-bag'],
  },
  requesting_staff: {
    summary: 'You request blood for patients and for the weekly restock, and confirm what arrives.',
    start: ['new-request', 'weekly-request', 'receive-delivery'],
  },
  inventory_staff: {
    summary: 'You keep the shelf: stock bags in, tag them to patients, and record what happens to them.',
    start: ['stock-in', 'tag-bag', 'thresholds'],
  },
}

/** Terms staff meet across the portal. */
export const HOSPITAL_HELP_GLOSSARY: { term: string; meaning: string }[] = [
  { term: 'PTR', meaning: 'A patient\'s blood request, which one or more blood centers may supply.' },
  { term: 'RQ', meaning: 'What one blood center was asked to supply for a request.' },
  { term: 'WR', meaning: 'A weekly request: your restock from a blood center, with no patient.' },
  { term: 'STAT', meaning: 'A patient request that cannot wait. Open STAT requests are listed first.' },
  { term: 'Request day', meaning: 'A day you send a blood center your weekly request.' },
  { term: 'Awaiting stock-in', meaning: 'A bag that has arrived but is not on a shelf yet, so it is not stock.' },
  { term: 'Tag Assigned', meaning: 'A bag held for one patient, still in storage, with 24 hours to crossmatch.' },
  { term: 'Tag Crossmatched', meaning: 'A crossmatched bag out of storage for one patient, with 24 hours to transfuse.' },
  { term: 'Pending Return', meaning: 'A bag out of storage whose tag ended. Confirm it is back, or discard it.' },
  { term: 'PAR level', meaning: 'The stock you aim to keep of a blood type and component.' },
  { term: 'Critical level', meaning: 'The least you can hold before a low-stock alert is sent.' },
]

/** The guides this account's abilities cover. */
export function hospitalGuidesFor(can: (_ability: string) => boolean): HospitalHelpGuide[] {
  return HOSPITAL_HELP_GUIDES.filter((guide) => !guide.requires || can(guide.requires))
}

/** Guides whose words hold every word of `query`, for the top bar search. */
export function searchHospitalGuides(query: string, guides: HospitalHelpGuide[]): HospitalHelpGuide[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return guides.filter((guide) => {
    const text = [guide.title, guide.summary, guide.department, ...guide.steps, ...(guide.questions ?? []).flatMap((x) => [x.q, x.a])].join(' ').toLowerCase()
    return words.every((word) => text.includes(word))
  })
}
