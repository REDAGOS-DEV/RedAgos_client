import { ref } from 'vue'

/**
 * MOCK / DEV VERSION of useIncomingRequests.
 *
 * Same exported shape as the real composable (requests, summary, activity,
 * loading, error, isMutating, fetchRequests, fetchSummary, fetchRequestDetail,
 * approveAndReserve, rejectRequest, fetchActivity) so IncomingRequests.vue
 * does not need any changes when the real backend is ready — just swap this
 * file back out for the one that calls useApi().
 *
 * Delete this file once GET/PATCH /blood-center/bloodrequests* are live.
 *
 * Kini kay dili ma-branch sa `useMocks` nga flag sama sa Reports/fulfillment:
 * ang tinuod nga implementasyon naa sa ubos isip comment ug nag-agi sa
 * `useApi()` nga wala pa ma-define. Imbes magpakaaron-ingnon nga mo-switch,
 * mo-warn ta sa dev kung gi-off ang flag apan fixture data gihapon ang gipakita.
 *
 * Walay `/blood-center/bloodrequests` nga route ang Laravel — tan-awa ang
 * endpoint matrix. Phase P ni.
 */

function delay(ms = 450) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toRefResult(value, err = null) {
  return { data: ref(value), error: ref(err) }
}

let seq = 46 // next REQ number after the seeded ones below

const now = new Date()
function isoDaysFromNow(days) {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function labelDaysFromNow(days, timeLabel = '2:00 PM') {
  if (days === 0) return `Today, ${timeLabel}`
  if (days === 1) return `Tomorrow, ${timeLabel}`
  return `${isoDaysFromNow(days)}, ${timeLabel}`
}

const MASTER_REQUESTS = [
  {
    id: 'REQ-2026-0045',
    hospital: "St. Luke's Medical Center",
    contact: 'Dr. Reyes',
    requestedBy: 'Dr. Reyes',
    department: 'Emergency Department',
    phone: '(02) 8723-0301',
    email: 'er.desk@stlukes.ph',
    address: '279 E. Rodriguez Sr. Ave, Quezon City',
    bloodType: 'O-',
    component: 'Packed RBC',
    units: 4,
    available: 6,
    compatibleTypes: ['O-', 'O+'],
    priority: 'Emergency',
    status: 'Pending',
    requestDate: labelDaysFromNow(0, '9:12 AM'),
    requestDateISO: isoDaysFromNow(0),
    neededBy: labelDaysFromNow(0, '2:00 PM'),
    neededByISO: isoDaysFromNow(0),
    reason: 'Multiple trauma patient, active hemorrhage in ER.',
    notes: 'Patient is Rh-sensitized; strictly O-negative units required.',
    batches: [
      { code: 'BU-2026-018', units: 3, unitsToReserve: 3, expiry: 'Aug 22, 2026', location: 'Cold Storage A-2', compatible: true },
      { code: 'BU-2026-024', units: 3, unitsToReserve: 1, expiry: 'Aug 27, 2026', location: 'Cold Storage A-3', compatible: true },
    ],
  },
  {
    id: 'REQ-2026-0044',
    hospital: 'Manila Doctors Hospital',
    contact: 'Dr. Santos',
    requestedBy: 'Dr. Maria Santos',
    department: 'Surgery',
    phone: '(02) 8558-0888',
    email: 'surgery@maniladoctors.ph',
    address: '667 United Nations Ave, Ermita, Manila',
    bloodType: 'A+',
    component: 'Whole Blood',
    units: 3,
    available: 9,
    compatibleTypes: ['A+', 'AB+'],
    priority: 'Routine',
    status: 'Pending',
    requestDate: labelDaysFromNow(0, '8:40 AM'),
    requestDateISO: isoDaysFromNow(0),
    neededBy: labelDaysFromNow(2, '10:00 AM'),
    neededByISO: isoDaysFromNow(2),
    reason: 'Scheduled elective cardiac surgery.',
    notes: '',
    batches: [
      { code: 'BU-2026-011', units: 5, unitsToReserve: 3, expiry: 'Aug 19, 2026', location: 'Cold Storage B-1', compatible: true },
    ],
  },
  {
    id: 'REQ-2026-0043',
    hospital: 'Philippine General Hospital',
    contact: 'Dr. Cruz',
    requestedBy: 'Dr. John Cruz',
    department: 'Obstetrics',
    phone: '(02) 8554-8400',
    email: 'ob.blood@pgh.gov.ph',
    address: 'Taft Ave, Ermita, Manila',
    bloodType: 'B+',
    component: 'Fresh Frozen Plasma',
    units: 6,
    available: 2,
    compatibleTypes: ['B+', 'AB+'],
    priority: 'Urgent',
    status: 'Under Review',
    requestDate: labelDaysFromNow(0, '7:55 AM'),
    requestDateISO: isoDaysFromNow(0),
    neededBy: labelDaysFromNow(0, '6:00 PM'),
    neededByISO: isoDaysFromNow(0),
    reason: 'Postpartum hemorrhage, coagulopathy risk.',
    notes: 'OB team requesting priority processing.',
    batches: [
      { code: 'BU-2026-031', units: 2, unitsToReserve: 2, expiry: 'Aug 14, 2026', location: 'Cold Storage C-1', compatible: true },
    ],
  },
  {
    id: 'REQ-2026-0042',
    hospital: 'Makati Medical Center',
    contact: 'Dr. Villanueva',
    requestedBy: 'Maria Santos, RN',
    department: 'Oncology',
    phone: '(02) 8888-8999',
    email: 'oncology@makatimed.net.ph',
    address: '2 Amorsolo St, Legazpi Village, Makati',
    bloodType: 'O+',
    component: 'Packed RBC',
    units: 2,
    available: 14,
    compatibleTypes: ['O+'],
    priority: 'Routine',
    status: 'Approved',
    requestDate: labelDaysFromNow(-1, '11:20 AM'),
    requestDateISO: isoDaysFromNow(-1),
    neededBy: labelDaysFromNow(1, '9:00 AM'),
    neededByISO: isoDaysFromNow(1),
    reason: 'Pre-chemotherapy anemia correction.',
    notes: '',
    batches: [
      { code: 'BU-2026-009', units: 4, unitsToReserve: 2, expiry: 'Aug 17, 2026', location: 'Cold Storage A-1', compatible: true },
    ],
  },
  {
    id: 'REQ-2026-0041',
    hospital: 'The Medical City',
    contact: 'Dr. Bautista',
    requestedBy: 'Dr. Ana Bautista',
    department: 'Pediatrics',
    phone: '(02) 8988-1000',
    email: 'peds@themedicalcity.com',
    address: 'Ortigas Ave, Pasig City',
    bloodType: 'AB-',
    component: 'Platelets',
    units: 5,
    available: 0,
    compatibleTypes: ['AB-'],
    priority: 'Emergency',
    status: 'Under Review',
    requestDate: labelDaysFromNow(0, '6:10 AM'),
    requestDateISO: isoDaysFromNow(0),
    neededBy: labelDaysFromNow(0, '11:00 AM'),
    neededByISO: isoDaysFromNow(0),
    reason: 'Pediatric leukemia patient, severe thrombocytopenia.',
    notes: 'Rare type — check partner blood centers for compatible units.',
    batches: [],
  },
  {
    id: 'REQ-2026-0040',
    hospital: 'Cardinal Santos Medical Center',
    contact: 'Dr. Fernandez',
    requestedBy: 'Dr. Miguel Fernandez',
    department: 'Internal Medicine',
    phone: '(02) 8727-0001',
    email: 'im@cardinalsantos.com.ph',
    address: 'Wilson St, San Juan City',
    bloodType: 'A-',
    component: 'Packed RBC',
    units: 2,
    available: 5,
    compatibleTypes: ['A-', 'O-'],
    priority: 'Urgent',
    status: 'Pending',
    requestDate: labelDaysFromNow(0, '5:45 AM'),
    requestDateISO: isoDaysFromNow(0),
    neededBy: labelDaysFromNow(0, '4:00 PM'),
    neededByISO: isoDaysFromNow(0),
    reason: 'Severe anemia secondary to GI bleed.',
    notes: '',
    batches: [
      { code: 'BU-2026-014', units: 5, unitsToReserve: 2, expiry: 'Aug 20, 2026', location: 'Cold Storage A-2', compatible: true },
    ],
  },
  {
    id: 'REQ-2026-0039',
    hospital: 'Chinese General Hospital',
    contact: 'Dr. Lim',
    requestedBy: 'John Cruz, RN',
    department: 'Emergency Department',
    phone: '(02) 8711-4141',
    email: 'er@chgh.org.ph',
    address: 'Blumentritt Rd, Sta. Cruz, Manila',
    bloodType: 'O+',
    component: 'Packed RBC',
    units: 3,
    available: 8,
    compatibleTypes: ['O+'],
    priority: 'Routine',
    status: 'Rejected',
    requestDate: labelDaysFromNow(-2, '2:15 PM'),
    requestDateISO: isoDaysFromNow(-2),
    neededBy: labelDaysFromNow(-1, '9:00 AM'),
    neededByISO: isoDaysFromNow(-1),
    reason: 'Elective transfusion for chronic anemia.',
    notes: 'Duplicate of REQ-2026-0037.',
    batches: [],
  },
  {
    id: 'REQ-2026-0038',
    hospital: 'St. Luke\'s Medical Center - Global City',
    contact: 'Dr. Tan',
    requestedBy: 'Dr. Patricia Tan',
    department: 'Cardiology',
    phone: '(02) 8789-7700',
    email: 'cardio@stlukes.ph',
    address: '32nd St, Bonifacio Global City, Taguig',
    bloodType: 'B-',
    component: 'Packed RBC',
    units: 4,
    available: 3,
    compatibleTypes: ['B-', 'O-'],
    priority: 'Urgent',
    status: 'Approved',
    requestDate: labelDaysFromNow(-1, '3:30 PM'),
    requestDateISO: isoDaysFromNow(-1),
    neededBy: labelDaysFromNow(0, '8:00 AM'),
    neededByISO: isoDaysFromNow(0),
    reason: 'Post-CABG recovery, hemoglobin drop.',
    notes: '',
    batches: [
      { code: 'BU-2026-021', units: 3, unitsToReserve: 3, expiry: 'Aug 16, 2026', location: 'Cold Storage B-2', compatible: true },
    ],
  },
]

let dataset = MASTER_REQUESTS.map((r) => ({ ...r }))

const MASTER_ACTIVITY = [
  { id: 'act-1', type: 'emergency', description: 'Emergency request received', hospital: "St. Luke's Medical Center", time: '5 minutes ago', staff: 'System' },
  { id: 'act-2', type: 'approved', description: 'Request approved', hospital: 'Makati Medical Center', time: '20 minutes ago', staff: 'Maria Santos' },
  { id: 'act-3', type: 'reserved', description: 'Inventory reserved — 3 O+ Packed RBC units', hospital: "St. Luke's Medical Center - Global City", time: '35 minutes ago', staff: 'Rico Alvarez' },
  { id: 'act-4', type: 'rejected', description: 'Request rejected', hospital: 'Chinese General Hospital', time: '1 hour ago', staff: 'John Cruz' },
  { id: 'act-5', type: 'received', description: 'Request received', hospital: 'The Medical City', time: '2 hours ago', staff: 'System' },
]
let activityLog = MASTER_ACTIVITY.map((a) => ({ ...a }))

/* FILTERING */
function applyFilters(list, params = {}) {
  let result = [...list]

  if (params.filter && params.filter !== 'All') {
    const f = params.filter
    if (['Emergency', 'Urgent', 'Routine'].includes(f)) {
      result = result.filter((r) => r.priority === f)
    } else {
      result = result.filter((r) => r.status === f)
    }
  }

  if (params.search) {
    const q = params.search.toLowerCase()
    result = result.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.hospital.toLowerCase().includes(q) ||
        (r.contact || '').toLowerCase().includes(q) ||
        (r.requestedBy || '').toLowerCase().includes(q)
    )
  }

  if (params.hospital) result = result.filter((r) => r.hospital === params.hospital)
  if (params.blood_type) result = result.filter((r) => r.bloodType === params.blood_type)
  if (params.component) result = result.filter((r) => r.component === params.component)
  if (params.priority) result = result.filter((r) => r.priority === params.priority)
  if (params.status) result = result.filter((r) => r.status === params.status)
  if (params.date) result = result.filter((r) => r.requestDateISO === params.date)
  if (params.needed_by) result = result.filter((r) => r.neededByISO === params.needed_by)

  // Newest / most urgent first
  const priorityRank = { Emergency: 0, Urgent: 1, Routine: 2 }
  result.sort((a, b) => (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3))

  return result
}

function computeSummary(list) {
  const pending = list.filter((r) => r.status === 'Pending').length
  const emergency = list.filter((r) => r.priority === 'Emergency' && r.status !== 'Rejected').length
  const underReview = list.filter((r) => r.status === 'Under Review').length
  const readyForFulfillment = list.filter((r) => r.status === 'Approved').length

  return {
    pending,
    pendingTrend: 'Awaiting staff review',
    pendingTrendUp: null,
    emergency,
    emergencyTrend: emergency > 0 ? 'Requires immediate action' : 'None active',
    emergencyTrendUp: null,
    underReview,
    underReviewTrend: 'Currently being assessed',
    underReviewTrendUp: null,
    readyForFulfillment,
    readyTrend: 'Approved and inventory available',
    readyTrendUp: true,
  }
}

/* COMPOSABLE */
export function useIncomingRequests() {
  // Ang flag nag-ingon nga naka-off ang mock, apan mock gihapon ni nga file.
  // Ipakita sa dev aron dili hilom nga bakak ang flag.
  if (import.meta.dev && !useRuntimeConfig().public.useMocks) {
    console.warn(
      '[useIncomingRequests] useMocks=false apan mock gihapon ni nga composable. ' +
      'Walay /blood-center/bloodrequests nga endpoint (Phase P).'
    )
  }

  const requests = ref([])
  const loading = ref(false)
  const error = ref(null)
  const mutatingIds = ref(new Set())

  function isMutating(id) {
    return mutatingIds.value.has(id)
  }

  async function fetchRequests(params = {}) {
    loading.value = true
    error.value = null
    await delay()

    try {
      requests.value = applyFilters(dataset, params)
    } catch (err) {
      error.value = err
      requests.value = []
    }

    loading.value = false
    return toRefResult(requests.value, null)
  }

  const summary = ref(null)
  async function fetchSummary() {
    await delay(250)
    summary.value = computeSummary(dataset)
    return toRefResult(summary.value, null)
  }

  async function fetchRequestDetail(id) {
    await delay(300)
    const found = dataset.find((r) => r.id === id)
    if (!found) return toRefResult(null, { message: 'Request not found' })
    return toRefResult({ ...found })
  }

  async function approveAndReserve(id, payload = {}) {
    mutatingIds.value.add(id)
    await delay(600)

    const idx = dataset.findIndex((r) => r.id === id)
    if (idx === -1) {
      mutatingIds.value.delete(id)
      return toRefResult(null, { message: 'Request not found' })
    }

    const target = dataset[idx]
    if (target.available < target.units) {
      mutatingIds.value.delete(id)
      return toRefResult(null, { message: 'Insufficient inventory to approve this request.' })
    }

    dataset[idx] = { ...target, status: 'Approved' }
    const uIdx = requests.value.findIndex((r) => r.id === id)
    if (uIdx !== -1) requests.value[uIdx] = { ...dataset[idx] }

    activityLog = [
      {
        id: `act-${Date.now()}`,
        type: 'approved',
        description: 'Request approved',
        hospital: target.hospital,
        time: 'just now',
        staff: 'You',
      },
      {
        id: `act-${Date.now() + 1}`,
        type: 'reserved',
        description: `Inventory reserved — ${target.units} ${target.bloodType} ${target.component} units`,
        hospital: target.hospital,
        time: 'just now',
        staff: 'You',
      },
      ...activityLog,
    ]

    mutatingIds.value.delete(id)
    return toRefResult({ ...dataset[idx] }, null)
  }

  async function rejectRequest(id, payload = {}) {
    mutatingIds.value.add(id)
    await delay(600)

    const idx = dataset.findIndex((r) => r.id === id)
    if (idx === -1) {
      mutatingIds.value.delete(id)
      return toRefResult(null, { message: 'Request not found' })
    }

    const target = dataset[idx]
    dataset[idx] = {
      ...target,
      status: 'Rejected',
      rejectionReason: payload.reason || 'Other',
      rejectionNotes: payload.notes || '',
    }
    const uIdx = requests.value.findIndex((r) => r.id === id)
    if (uIdx !== -1) requests.value[uIdx] = { ...dataset[idx] }

    activityLog = [
      {
        id: `act-${Date.now()}`,
        type: 'rejected',
        description: `Request rejected — ${payload.reason || 'Other'}`,
        hospital: target.hospital,
        time: 'just now',
        staff: 'You',
      },
      ...activityLog,
    ]

    mutatingIds.value.delete(id)
    return toRefResult({ ...dataset[idx] }, null)
  }

  const activity = ref([])
  async function fetchActivity() {
    await delay(300)
    activity.value = [...activityLog]
    return toRefResult(activity.value, null)
  }

  return {
    requests,
    summary,
    activity,
    loading,
    error,
    isMutating,
    fetchRequests,
    fetchSummary,
    fetchRequestDetail,
    approveAndReserve,
    rejectRequest,
    fetchActivity,
  }
}
/** 
export function useIncomingRequests() {
  const { get, post, patch } = useApi()

  const requests = ref([])
  const loading = ref(false)
  const error = ref(null)

  // mutating state per-request-id, so a single row can show a
  // "working…" state without disabling the whole table
  const mutatingIds = ref(new Set())

  function isMutating(id) {
    return mutatingIds.value.has(id)
  }

  /**
   * GET /blood-center/bloodrequests
   * Only returns Pending / Under Review / Approved (not yet fulfilled).
   * Filtering by hospital/type/component/priority/status/date/search is
   * done server-side via query params so pagination + counts stay correct.
   
  async function fetchRequests(params = {}) {
    loading.value = true
    error.value = null

    const { data, error: fetchError } = await get('/blood-center/bloodrequests', { params })

    if (fetchError.value) {
      error.value = fetchError.value
      requests.value = []
    } else {
      requests.value = data.value?.data ?? data.value ?? []
    }

    loading.value = false
    return { data, error: fetchError }
  }

  /**
   * GET /blood-center/bloodrequests/summary
   * { pending, emergency, underReview, readyForFulfillment }
   
  const summary = ref(null)
  async function fetchSummary() {
    const { data, error: fetchError } = await get('/blood-center/bloodrequests/summary')
    if (!fetchError.value) summary.value = data.value
    return { data, error: fetchError }
  }

  /**
   * GET /blood-center/bloodrequests/:id
   * Full detail payload for the review drawer (hospital info, requested
   * blood, inventory availability + suggested batches, timeline).
  
  async function fetchRequestDetail(id) {
    const { data, error: fetchError } = await get(`/blood-center/bloodrequests/${id}`)
    return { data, error: fetchError }
  }

  /**
   * PATCH /blood-center/bloodrequests/:id/approve
   * Approves the request and reserves the selected inventory batches.
   
  async function approveAndReserve(id, payload = {}) {
    mutatingIds.value.add(id)
    const { data, error: fetchError } = await patch(`/blood-center/bloodrequests/${id}/approve`, payload)

    if (!fetchError.value) {
      const idx = requests.value.findIndex(r => r.id === id)
      if (idx !== -1) requests.value[idx] = { ...requests.value[idx], status: 'Approved' }
    }

    mutatingIds.value.delete(id)
    return { data, error: fetchError }
  }

  /**
   * PATCH /blood-center/bloodrequests/:id/reject
  
  async function rejectRequest(id, payload = {}) {
    mutatingIds.value.add(id)
    const { data, error: fetchError } = await patch(`/blood-center/bloodrequests/${id}/reject`, payload)

    if (!fetchError.value) {
      const idx = requests.value.findIndex(r => r.id === id)
      if (idx !== -1) requests.value[idx] = { ...requests.value[idx], status: 'Rejected' }
    }

    mutatingIds.value.delete(id)
    return { data, error: fetchError }
  }

  /**
   * GET /blood-center/bloodrequests/activity
   * Recent activity feed shown at the bottom of the page.
   
  const activity = ref([])
  async function fetchActivity() {
    const { data, error: fetchError } = await get('/blood-center/bloodrequests/activity')
    if (!fetchError.value) activity.value = data.value?.data ?? data.value ?? []
    return { data, error: fetchError }
  }

  return {
    requests,
    summary,
    activity,
    loading,
    error,
    isMutating,
    fetchRequests,
    fetchSummary,
    fetchRequestDetail,
    approveAndReserve,
    rejectRequest,
    fetchActivity,
  }
} 
*/