/*
 * Expected Laravel endpoints (adjust paths to match your actual routes):
 *   GET /api/hospital/blood-requests/:id
 *       -> { request: {...}, history: [...] }
 *   GET /api/blood-inventory/availability
 *       -> [{ blood_type, units_available, status }, ...]
 *
 * The shape of `request` is expected to roughly look like:
 * {
 *   id, reference_number, status, priority,
 *   request_date, required_date, estimated_completion,
 *   hospital, department, requesting_physician, patient_reference_number,
 *   purpose, notes,
 *   blood_type, blood_component, units_requested, compatibility, special_requirements,
 *   clinical_indication, diagnosis, additional_notes,
 *   documents: [{ id, name, url, mime_type, size }],
 *   timeline: [{ step, label, status: 'completed'|'current'|'upcoming', timestamp }]
 * }
 *
 * If your backend doesn't return `timeline` explicitly, this composable will
 * derive it from `status` — see buildTimeline() below. Prefer having the
 * backend send it directly since it owns the source of truth.
 */

export const REQUEST_STATUSES = [
  'Pending',
  'Approved',
  'Processing',
  'Ready for Pickup',
  'Completed',
  'Rejected',
  'Cancelled',
]

const TIMELINE_STEPS = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'approved', label: 'Approved' },
  { key: 'preparing', label: 'Preparing Blood Units' },
  { key: 'ready_for_pickup', label: 'Ready for Pickup' },
  { key: 'completed', label: 'Completed' },
]

// Maps a request status to how far along the timeline we are, only used as
// a fallback when the backend does not send an explicit `timeline` array.
const STATUS_TO_STEP_INDEX = {
  Pending: 0,
  Approved: 2,
  Processing: 3,
  'Ready for Pickup': 4,
  Completed: 5,
  Rejected: 1,
  Cancelled: 0,
}

export function statusBadgeColor(status) {
  switch (status) {
    case 'Completed':
    case 'Approved':
      return 'success'
    case 'Pending':
    case 'Processing':
      return 'warning'
    case 'Ready for Pickup':
      return 'info'
    case 'Rejected':
    case 'Cancelled':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function buildTimeline(request) {
  if (!request) return []

  // Prefer backend-provided timeline so timestamps/labels stay authoritative.
  if (Array.isArray(request.timeline) && request.timeline.length) {
    return request.timeline
  }

  const currentIndex = STATUS_TO_STEP_INDEX[request.status] ?? 0
  const isTerminatedEarly = request.status === 'Rejected' || request.status === 'Cancelled'

  return TIMELINE_STEPS.map((step, index) => {
    let stepStatus = 'upcoming'
    if (isTerminatedEarly) {
      stepStatus = index <= currentIndex ? 'completed' : 'upcoming'
    } else if (index < currentIndex) {
      stepStatus = 'completed'
    } else if (index === currentIndex) {
      stepStatus = 'current'
    }
    return {
      step: step.key,
      label: step.label,
      status: stepStatus,
      timestamp: null, // unknown unless backend supplies real timestamps
    }
  })
}

export const useBloodRequestDetails = (requestId) => {
  // Uses the project's existing useApi() composable (same one powering
  // useBloodRequests.js) so auth cookies / base URL handling stay consistent.
  const request = ref(null)
  const history = ref([])
  const bloodAvailability = ref([])

  const isLoadingRequest = ref(true)
  const isLoadingAvailability = ref(true)
  const requestError = ref(null)
  const availabilityError = ref(null)

  const timeline = computed(() => buildTimeline(request.value))

  const progressPercent = computed(() => {
    const steps = timeline.value
    if (!steps.length) return 0
    const completedCount = steps.filter((s) => s.status === 'completed').length
    const hasCurrent = steps.some((s) => s.status === 'current')
    const numerator = completedCount + (hasCurrent ? 0.5 : 0)
    return Math.round((numerator / steps.length) * 100)
  })

  async function fetchRequest() {
    isLoadingRequest.value = true
    requestError.value = null
    try {
      const { data, error } = await useApi().get(`/hospital/bloodrequests/${requestId}`)
      if (error?.value) throw error.value
      request.value = data?.value?.request ?? data?.value ?? null
      history.value = data?.value?.history ?? []
    } catch (err) {
      requestError.value = err
      request.value = null
      history.value = []
    } finally {
      isLoadingRequest.value = false
    }
  }

  async function fetchAvailability() {
    isLoadingAvailability.value = true
    availabilityError.value = null
    try {
      const { data, error } = await useApi().get('/blood-inventory/availability')
      if (error?.value) throw error.value
      bloodAvailability.value = data?.value ?? []
    } catch (err) {
      availabilityError.value = err
      bloodAvailability.value = []
    } finally {
      isLoadingAvailability.value = false
    }
  }

  async function refresh() {
    await Promise.all([fetchRequest(), fetchAvailability()])
  }

  return {
    request,
    history,
    bloodAvailability,
    timeline,
    progressPercent,
    isLoadingRequest,
    isLoadingAvailability,
    requestError,
    availabilityError,
    fetchRequest,
    fetchAvailability,
    refresh,
  }
}