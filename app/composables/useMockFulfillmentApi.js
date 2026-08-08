/**
 * composables/useMockFulfillmentApi.js
 *
 * Drop-in mock replacement for Nuxt's global `$fetch`, scoped to the
 * Request Fulfillment endpoints defined in pages/bloodcenter/fulfillment.vue.
 *
 * WALA PAY BACKEND, so this simulates:
 *   GET  /api/blood-center/fulfillment                -> queue
 *   GET  /api/blood-center/fulfillment/alert           -> alert
 *   GET  /api/blood-center/fulfillment/dispatch-panel  -> dispatch panel
 *   GET  /api/blood-center/fulfillment/activity        -> activity log
 *   GET  /api/blood-center/fulfillment/:id             -> request detail
 *   PATCH  .../:id/checklist/:itemKey                  -> toggle checklist
 *   PATCH  .../:id/save                                -> save progress
 *   POST   .../:id/advance                             -> advance stage
 *   PATCH  .../:id/notes                                -> save dispatch notes
 *   POST   /api/blood-center/fulfillment/export         -> export report
 *
 * HOW TO USE (in pages/bloodcenter/fulfillment.vue):
 *   Add ONE line near the top of <script setup>, right after the
 *   `useDarkMode()` line and before `endpoints` is defined:
 *
 *     const $fetch = useMockFulfillmentApi()
 *
 *   This shadows Nuxt's auto-imported $fetch only within this component,
 *   so every existing `$fetch(endpoints.xxx, ...)` call in the file keeps
 *   working unchanged. Once the real Laravel endpoints exist, delete that
 *   one line and everything talks to the real API again.
 */

const BASE = '/api/blood-center/fulfillment'

const STAGE_ORDER = [
  'Approved',
  'Inventory Reserved',
  'Preparing',
  'Quality Check',
  'Ready for Dispatch',
  'Dispatched',
  'Delivered',
  'Completed',
]

function slug(stage) {
  return (stage || '').toLowerCase().replace(/\s+/g, '-')
}

function delay(ms = 450) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Seed data (Davao-context hospitals)
// ---------------------------------------------------------------------------

function seedRequests() {
  return [
    {
      id: 'REQ-2026-0045',
      hospital: 'Southern Philippines Medical Center (SPMC)',
      contactPerson: 'Dr. Antonio Reyes',
      department: 'Blood Bank Unit',
      bloodType: 'O-',
      component: 'Packed RBC',
      reservedUnits: 4,
      batchIds: ['BU-2026-018', 'BU-2026-024'],
      assignedStaff: 'Maria Santos',
      dispatchMethod: 'Hospital Pickup',
      priority: 'Critical',
      neededBy: '2026-08-08T14:00:00',
      stage: 'Preparing',
      courier: '', vehicle: '', trackingNumber: '', estimatedArrival: '', recipientName: '',
      dispatchNotes: '',
      units: [
        { batchId: 'BU-2026-018', bloodType: 'O-', component: 'Packed RBC', units: 2, collectionDate: '2026-07-20', expiryDate: '2026-08-24', storageLocation: 'Fridge A · Shelf 2', status: 'Verified' },
        { batchId: 'BU-2026-024', bloodType: 'O-', component: 'Packed RBC', units: 2, collectionDate: '2026-07-22', expiryDate: '2026-08-26', storageLocation: 'Fridge A · Shelf 2', status: 'Pending' },
      ],
      checklist: [
        { key: 'verify-type', label: 'Verify Blood Type', done: true },
        { key: 'verify-component', label: 'Verify Blood Component', done: true },
        { key: 'verify-expiry', label: 'Verify Expiry Date', done: true },
        { key: 'inspect-bag', label: 'Inspect Blood Bag Integrity', done: false },
        { key: 'print-labels', label: 'Print Blood Labels', done: false },
        { key: 'package-units', label: 'Package Blood Units', done: false },
        { key: 'prepare-docs', label: 'Prepare Dispatch Documents', done: false },
        { key: 'assign-courier', label: 'Assign Courier / Pickup Method', done: false },
      ],
    },
    {
      id: 'REQ-2026-0046',
      hospital: 'Davao Doctors Hospital',
      contactPerson: 'Dr. Liza Fernandez',
      department: 'Laboratory / Blood Bank',
      bloodType: 'A+',
      component: 'Platelet Concentrate',
      reservedUnits: 6,
      batchIds: ['BU-2026-031'],
      assignedStaff: 'Carlo Bautista',
      dispatchMethod: 'Courier',
      priority: 'High',
      neededBy: '2026-08-08T16:30:00',
      stage: 'Quality Check',
      courier: '', vehicle: '', trackingNumber: '', estimatedArrival: '', recipientName: '',
      dispatchNotes: '',
      units: [
        { batchId: 'BU-2026-031', bloodType: 'A+', component: 'Platelet Concentrate', units: 6, collectionDate: '2026-08-02', expiryDate: '2026-08-09', storageLocation: 'Platelet Agitator 1', status: 'Verified' },
      ],
      checklist: [
        { key: 'verify-type', label: 'Verify Blood Type', done: true },
        { key: 'verify-component', label: 'Verify Blood Component', done: true },
        { key: 'verify-expiry', label: 'Verify Expiry Date', done: true },
        { key: 'inspect-bag', label: 'Inspect Blood Bag Integrity', done: true },
        { key: 'print-labels', label: 'Print Blood Labels', done: true },
        { key: 'package-units', label: 'Package Blood Units', done: false },
        { key: 'prepare-docs', label: 'Prepare Dispatch Documents', done: false },
        { key: 'assign-courier', label: 'Assign Courier / Pickup Method', done: false },
      ],
    },
    {
      id: 'REQ-2026-0047',
      hospital: 'Brokenshire Memorial Hospital',
      contactPerson: 'Dr. Ramon Ty',
      department: 'Blood Bank Unit',
      bloodType: 'B+',
      component: 'Fresh Frozen Plasma',
      reservedUnits: 3,
      batchIds: ['BU-2026-011'],
      assignedStaff: 'Nico Villareal',
      dispatchMethod: 'Internal Transport',
      priority: 'Standard',
      neededBy: '2026-08-09T09:00:00',
      stage: 'Ready for Dispatch',
      courier: 'RedAgos Internal Transport', vehicle: 'Van · DVO-1123', trackingNumber: '', estimatedArrival: '2026-08-09T08:30:00', recipientName: 'Angela Dizon',
      dispatchNotes: 'For OR stock — standby use.',
      units: [
        { batchId: 'BU-2026-011', bloodType: 'B+', component: 'Fresh Frozen Plasma', units: 3, collectionDate: '2026-06-30', expiryDate: '2027-06-30', storageLocation: 'Freezer B · Shelf 1', status: 'Verified' },
      ],
      checklist: [
        { key: 'verify-type', label: 'Verify Blood Type', done: true },
        { key: 'verify-component', label: 'Verify Blood Component', done: true },
        { key: 'verify-expiry', label: 'Verify Expiry Date', done: true },
        { key: 'inspect-bag', label: 'Inspect Blood Bag Integrity', done: true },
        { key: 'print-labels', label: 'Print Blood Labels', done: true },
        { key: 'package-units', label: 'Package Blood Units', done: true },
        { key: 'prepare-docs', label: 'Prepare Dispatch Documents', done: true },
        { key: 'assign-courier', label: 'Assign Courier / Pickup Method', done: true },
      ],
    },
    {
      id: 'REQ-2026-0048',
      hospital: 'Davao Regional Medical Center',
      contactPerson: 'Dr. Wilfredo Cruz',
      department: 'Blood Bank Unit',
      bloodType: 'AB+',
      component: 'Packed RBC',
      reservedUnits: 2,
      batchIds: ['BU-2026-009'],
      assignedStaff: 'Maria Santos',
      dispatchMethod: 'Courier',
      priority: 'High',
      neededBy: '2026-08-08T18:00:00',
      stage: 'Dispatched',
      courier: 'Lalamove Rider — J. Ponce', vehicle: 'Motorcycle · DVO-8842', trackingNumber: 'LM-DVO-58231', estimatedArrival: '2026-08-08T13:15:00', recipientName: 'Kim Alvarez',
      dispatchNotes: 'Handle with cold-chain box.',
      units: [
        { batchId: 'BU-2026-009', bloodType: 'AB+', component: 'Packed RBC', units: 2, collectionDate: '2026-07-15', expiryDate: '2026-08-19', storageLocation: 'Fridge A · Shelf 3', status: 'Verified' },
      ],
      checklist: [
        { key: 'verify-type', label: 'Verify Blood Type', done: true },
        { key: 'verify-component', label: 'Verify Blood Component', done: true },
        { key: 'verify-expiry', label: 'Verify Expiry Date', done: true },
        { key: 'inspect-bag', label: 'Inspect Blood Bag Integrity', done: true },
        { key: 'print-labels', label: 'Print Blood Labels', done: true },
        { key: 'package-units', label: 'Package Blood Units', done: true },
        { key: 'prepare-docs', label: 'Prepare Dispatch Documents', done: true },
        { key: 'assign-courier', label: 'Assign Courier / Pickup Method', done: true },
      ],
    },
    {
      id: 'REQ-2026-0050',
      hospital: 'Philippine Red Cross — Davao Chapter',
      contactPerson: 'Dr. Grace Villanueva',
      department: 'Blood Services',
      bloodType: 'O-',
      component: 'Packed RBC',
      reservedUnits: 3,
      batchIds: ['BU-2026-027'],
      assignedStaff: 'Nico Villareal',
      dispatchMethod: 'Courier',
      priority: 'Critical',
      neededBy: '2026-08-08T13:30:00',
      stage: 'Preparing',
      courier: '', vehicle: '', trackingNumber: '', estimatedArrival: '', recipientName: '',
      dispatchNotes: '',
      units: [
        { batchId: 'BU-2026-027', bloodType: 'O-', component: 'Packed RBC', units: 3, collectionDate: '2026-07-25', expiryDate: '2026-08-29', storageLocation: 'Fridge A · Shelf 2', status: 'Pending' },
      ],
      checklist: [
        { key: 'verify-type', label: 'Verify Blood Type', done: true },
        { key: 'verify-component', label: 'Verify Blood Component', done: false },
        { key: 'verify-expiry', label: 'Verify Expiry Date', done: false },
        { key: 'inspect-bag', label: 'Inspect Blood Bag Integrity', done: false },
        { key: 'print-labels', label: 'Print Blood Labels', done: false },
        { key: 'package-units', label: 'Package Blood Units', done: false },
        { key: 'prepare-docs', label: 'Prepare Dispatch Documents', done: false },
        { key: 'assign-courier', label: 'Assign Courier / Pickup Method', done: false },
      ],
    },
    {
      id: 'REQ-2026-0049',
      hospital: 'San Pedro Hospital',
      contactPerson: 'Dr. Corazon Uy',
      department: 'Blood Bank Unit',
      bloodType: 'O+',
      component: 'Whole Blood',
      reservedUnits: 5,
      batchIds: ['BU-2026-002'],
      assignedStaff: 'Carlo Bautista',
      dispatchMethod: 'Hospital Pickup',
      priority: 'Standard',
      neededBy: '2026-08-07T17:00:00',
      stage: 'Completed',
      courier: '', vehicle: '', trackingNumber: '', estimatedArrival: '', recipientName: 'Paolo Ramos',
      dispatchNotes: 'Picked up directly by requesting personnel.',
      units: [
        { batchId: 'BU-2026-002', bloodType: 'O+', component: 'Whole Blood', units: 5, collectionDate: '2026-07-10', expiryDate: '2026-08-14', storageLocation: 'Fridge B · Shelf 1', status: 'Verified' },
      ],
      checklist: [
        { key: 'verify-type', label: 'Verify Blood Type', done: true },
        { key: 'verify-component', label: 'Verify Blood Component', done: true },
        { key: 'verify-expiry', label: 'Verify Expiry Date', done: true },
        { key: 'inspect-bag', label: 'Inspect Blood Bag Integrity', done: true },
        { key: 'print-labels', label: 'Print Blood Labels', done: true },
        { key: 'package-units', label: 'Package Blood Units', done: true },
        { key: 'prepare-docs', label: 'Prepare Dispatch Documents', done: true },
        { key: 'assign-courier', label: 'Assign Courier / Pickup Method', done: true },
      ],
    },
  ]
}

// Module-level reactive-ish store (plain object is fine; Vue components
// re-fetch via useAsyncData/refresh rather than needing deep reactivity here).
let requests = seedRequests()
let activityLog = [
  { id: 1, type: 'info', icon: 'package', description: '3 O- Packed RBC units reserved for PRC Davao Chapter.', staff: 'Nico Villareal', timestamp: '10:15 AM' },
  { id: 2, type: 'warning', icon: 'shield-check', description: 'REQ-2026-0046 moved to Quality Check.', staff: 'Carlo Bautista', timestamp: '9:50 AM' },
  { id: 3, type: 'success', icon: 'truck', description: 'REQ-2026-0048 dispatched via courier, tracking LM-DVO-58231.', staff: 'Maria Santos', timestamp: '9:20 AM' },
  { id: 4, type: 'success', icon: 'check-circle', description: 'REQ-2026-0049 fulfillment completed and archived.', staff: 'Carlo Bautista', timestamp: 'Yesterday, 4:45 PM' },
]
let activitySeq = activityLog.length

function pushActivity({ type, icon, description, staff = 'You' }) {
  activityLog.unshift({
    id: ++activitySeq, type, icon, description, staff,
    timestamp: new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
  })
  activityLog = activityLog.slice(0, 12)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function handleQueue(params = {}) {
  const statusFilter = params.status && params.status !== 'all' ? params.status : null

  let list = requests.filter((r) => {
    // Completed requests leave the active queue unless explicitly filtered for.
    if (r.stage === 'Completed' && statusFilter !== 'completed') return false
    if (statusFilter && slug(r.stage) !== statusFilter) return false
    if (params.dispatchStatus && slug(r.stage) !== params.dispatchStatus) return false
    if (params.hospital && r.hospital !== params.hospital) return false
    if (params.bloodType && r.bloodType !== params.bloodType) return false
    if (params.component && r.component !== params.component) return false
    if (params.priority && r.priority !== params.priority) return false
    if (params.courier && r.courier !== params.courier) return false
    if (params.date && !r.neededBy.startsWith(params.date)) return false
    if (params.search) {
      const q = String(params.search).toLowerCase()
      const haystack = [r.id, r.hospital, r.bloodType, ...r.batchIds].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const activePool = requests.filter((r) => r.stage !== 'Completed')
  const statusCounts = { all: activePool.length }
  for (const stage of STAGE_ORDER) statusCounts[slug(stage)] = requests.filter((r) => r.stage === stage).length

  return {
    requests: list.map((r) => ({
      id: r.id, hospital: r.hospital, department: r.department, bloodType: r.bloodType,
      component: r.component, reservedUnits: r.reservedUnits, batchIds: r.batchIds,
      assignedStaff: r.assignedStaff, dispatchMethod: r.dispatchMethod, stage: r.stage, neededBy: r.neededBy,
    })),
    kpis: [
      { key: 'ready-prep', icon: 'package', accent: '#2563EB', trend: 8, value: requests.filter((r) => r.stage === 'Inventory Reserved').length, label: 'Ready for Preparation', description: 'Approved requests waiting for blood-unit preparation.' },
      { key: 'preparing', icon: 'loader', accent: '#F59E0B', trend: -4, value: requests.filter((r) => r.stage === 'Preparing').length, label: 'Preparing', description: 'Requests currently being prepared.' },
      { key: 'ready-dispatch', icon: 'box', accent: '#0F766E', trend: 12, value: requests.filter((r) => r.stage === 'Ready for Dispatch').length, label: 'Ready for Dispatch', description: 'Completed preparation, ready to leave the Blood Center.' },
      { key: 'fulfilled-today', icon: 'circle-check-big', accent: '#2E7D32', trend: 5, value: requests.filter((r) => r.stage === 'Completed').length, label: 'Fulfilled Today', description: 'Requests successfully completed today.' },
    ],
    statusCounts,
    filterOptions: {
      hospitals: [...new Set(requests.map((r) => r.hospital))],
      bloodTypes: [...new Set(requests.map((r) => r.bloodType))],
      components: [...new Set(requests.map((r) => r.component))],
      priorities: [...new Set(requests.map((r) => r.priority))],
      couriers: [...new Set(requests.map((r) => r.courier).filter(Boolean))],
    },
    meta: { total: list.length },
  }
}

function handleAlert() {
  const qc = requests.find((r) => r.stage === 'Quality Check')
  if (qc) {
    return {
      title: 'Attention Required',
      description: `${qc.id} requires quality verification before it can be dispatched.`,
      actionLabel: 'Review Request',
      actionType: 'open-drawer',
      requestId: qc.id,
    }
  }
  const dispatchSoon = requests.find((r) => {
    if (r.stage !== 'Ready for Dispatch') return false
    const minutes = (new Date(r.neededBy) - new Date()) / 60000
    return minutes > 0 && minutes <= 30
  })
  if (dispatchSoon) {
    return {
      title: 'Attention Required',
      description: `${dispatchSoon.id} is scheduled for dispatch within the next 30 minutes.`,
      actionLabel: 'Review Request',
      actionType: 'open-drawer',
      requestId: dispatchSoon.id,
    }
  }
  return null
}

function handleDispatchPanel() {
  return {
    scheduled: requests.filter((r) => r.stage === 'Ready for Dispatch').length,
    inTransit: requests.filter((r) => r.stage === 'Dispatched').length,
    deliveredToday: requests.filter((r) => r.stage === 'Delivered').length,
    avgPrepTime: '38 min',
  }
}

function handleDetail(id) {
  const r = requests.find((x) => x.id === id)
  if (!r) throw new Error(`Request ${id} not found`)
  return { ...r, units: r.units.map((u) => ({ ...u })), checklist: r.checklist.map((c) => ({ ...c })) }
}

function handleChecklistUpdate(id, itemKey, body) {
  const r = requests.find((x) => x.id === id)
  if (!r) throw new Error(`Request ${id} not found`)
  const item = r.checklist.find((c) => c.key === itemKey)
  if (item) item.done = !!body.done
  return { ok: true }
}

function handleSaveProgress(id, body) {
  const r = requests.find((x) => x.id === id)
  if (!r) throw new Error(`Request ${id} not found`)
  if (Array.isArray(body.checklist)) r.checklist = body.checklist.map((c) => ({ ...c }))
  if (typeof body.dispatchNotes === 'string') r.dispatchNotes = body.dispatchNotes
  return { ok: true }
}

function handleAdvanceStage(id) {
  const r = requests.find((x) => x.id === id)
  if (!r) throw new Error(`Request ${id} not found`)
  const idx = STAGE_ORDER.indexOf(r.stage)
  if (idx < STAGE_ORDER.length - 1) {
    r.stage = STAGE_ORDER[idx + 1]
  }
  pushActivity({
    type: r.stage === 'Completed' ? 'success' : 'info',
    icon: r.stage === 'Completed' ? 'circle-check-big' : r.stage === 'Dispatched' ? 'truck' : r.stage === 'Delivered' ? 'map-pin' : 'shield-check',
    description: `${r.id} moved to ${r.stage}.`,
    staff: r.assignedStaff,
  })
  return { stage: r.stage }
}

function handleDispatchNotes(id, body) {
  const r = requests.find((x) => x.id === id)
  if (!r) throw new Error(`Request ${id} not found`)
  r.dispatchNotes = body.notes ?? ''
  return { ok: true }
}

function handleExport() {
  return { downloadUrl: '#mock-export-not-available-yet' }
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useMockFulfillmentApi() {
  return async function mockFetch(url, options = {}) {
    await delay()
    const method = (options.method || 'GET').toUpperCase()
    const path = url.startsWith(BASE) ? url.slice(BASE.length) : url
    const body = options.body || {}
    const params = options.params || {}

    if (path === '' && method === 'GET') return handleQueue(params)
    if (path === '/alert' && method === 'GET') return handleAlert()
    if (path === '/dispatch-panel' && method === 'GET') return handleDispatchPanel()
    if (path === '/activity' && method === 'GET') return activityLog
    if (path === '/export' && method === 'POST') return handleExport()

    const checklistMatch = path.match(/^\/([^/]+)\/checklist\/([^/]+)$/)
    if (checklistMatch && method === 'PATCH') return handleChecklistUpdate(checklistMatch[1], checklistMatch[2], body)

    const saveMatch = path.match(/^\/([^/]+)\/save$/)
    if (saveMatch && method === 'PATCH') return handleSaveProgress(saveMatch[1], body)

    const advanceMatch = path.match(/^\/([^/]+)\/advance$/)
    if (advanceMatch && method === 'POST') return handleAdvanceStage(advanceMatch[1])

    const notesMatch = path.match(/^\/([^/]+)\/notes$/)
    if (notesMatch && method === 'PATCH') return handleDispatchNotes(notesMatch[1], body)

    const detailMatch = path.match(/^\/([^/]+)$/)
    if (detailMatch && method === 'GET') return handleDetail(detailMatch[1])

    throw new Error(`useMockFulfillmentApi: no mock handler for ${method} ${url}`)
  }
}