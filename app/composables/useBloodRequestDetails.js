import { hospitalService } from '~/api/hospital/HospitalService'
import {
  REQUEST_STATUSES as CANONICAL_STATUSES,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_TONES,
  requestStage,
} from '~/types/bloodRequest'

/**
 * One blood request, as the requesting hospital sees it.
 *
 * Rewritten to call the real API through HospitalService. The previous version
 * called `useApi()`, which is defined nowhere in this repository — every page
 * using it threw as soon as it mounted. It also spoke a status vocabulary
 * ("Ready for Pickup", "Approved") the schema has never accepted; the canonical
 * set now lives in ~/types/bloodRequest and is re-exported here so existing
 * imports keep working.
 */

export const REQUEST_STATUSES = CANONICAL_STATUSES

/**
 * Map a request status to the badge classes the detail pages use.
 */
export function statusBadgeColor(status) {
  const tone = REQUEST_STATUS_TONES[status] ?? 'muted'

  return {
    info: 'bg-blue-100 text-blue-700',
    progress: 'bg-indigo-100 text-indigo-700',
    warning: 'bg-amber-100 text-amber-700',
    success: 'bg-emerald-100 text-emerald-700',
    danger: 'bg-red-100 text-red-700',
    muted: 'bg-slate-100 text-slate-600',
  }[tone]
}

/**
 * Human label for a status value.
 */
export function statusLabel(status) {
  return REQUEST_STATUS_LABELS[status] ?? status
}

/**
 * Build the progress timeline from a request and its allocations.
 *
 * Derived, never stored. Fulfilment is counted at dispatch, so the request is
 * fulfilled — or partially fulfilled and closed — once the centre has released
 * everything it will supply; receipt is the hospital's own confirmation per
 * unit and comes after it, read from the allocations.
 */
export function buildTimeline(request) {
  if (!request) return []

  const allocations = request.allocations ?? []
  const released = allocations.filter((a) => a.status === 'released')
  const received = allocations.filter((a) => a.received_at)
  const lastReceived = received.map((a) => a.received_at).sort().at(-1) ?? null

  const terminal = ['rejected', 'cancelled'].includes(request.status)
  const finishedShort = request.status === 'partial' && request.is_open === false
  const fulfilledQuantity = request.fulfilled_quantity ?? released.length

  const steps = [
    {
      key: 'submitted',
      label: request.is_walk_in ? 'Recorded at blood center — confirmed by phone' : 'Submitted',
      done: true,
      timestamp: request.request_date,
    },
    {
      key: 'reviewed',
      label: request.status === 'rejected' ? 'Rejected' : 'Reviewed',
      done: Boolean(request.reviewed_at),
      timestamp: request.reviewed_at,
    },
    {
      key: 'reserved',
      label: 'Stock reserved',
      done: request.allocated_count > 0,
      timestamp: allocations[0]?.allocated_at ?? null,
    },
    {
      key: 'dispatched',
      label: 'Units released',
      done: released.length > 0,
      timestamp: released[0]?.released_at ?? null,
    },
    {
      key: 'completed',
      label: finishedShort ? 'Partially fulfilled — closed' : 'Fulfilled',
      done: request.status === 'fulfilled' || finishedShort,
      timestamp: request.fulfilled_at ?? request.closed_at ?? null,
    },
    {
      key: 'received',
      label: 'Received by the hospital',
      done: fulfilledQuantity > 0 && received.length >= fulfilledQuantity,
      timestamp: lastReceived,
    },
  ]

  const firstPending = steps.findIndex((s) => !s.done)

  return steps.map((step, index) => ({
    step: step.key,
    label: step.label,
    status: step.done ? 'completed' : index === firstPending && !terminal ? 'current' : 'upcoming',
    timestamp: step.timestamp,
  }))
}

export const useBloodRequestDetails = (requestId) => {
  const request = ref(null)
  // The request's own event log, from GET …/history.
  const history = ref([])
  const bloodAvailability = ref([])

  const isLoadingRequest = ref(true)
  const isLoadingAvailability = ref(false)
  const isLoadingHistory = ref(false)
  const requestError = ref(null)
  const availabilityError = ref(null)
  const historyError = ref(null)

  const timeline = computed(() => buildTimeline(request.value))

  const stage = computed(() => (request.value ? requestStage(request.value) : null))

  const progressPercent = computed(() => {
    const steps = timeline.value
    if (!steps.length) return 0
    const completedCount = steps.filter((s) => s.status === 'completed').length
    const hasCurrent = steps.some((s) => s.status === 'current')
    return Math.round(((completedCount + (hasCurrent ? 0.5 : 0)) / steps.length) * 100)
  })

  async function fetchRequest() {
    isLoadingRequest.value = true
    requestError.value = null

    try {
      const response = await hospitalService.showRequest(requestId)
      request.value = response?.request ?? null
      // Loaded alongside rather than awaited: a slow history must not hold
      // up the request itself.
      if (request.value) fetchHistory()
    } catch (err) {
      requestError.value = err?.message ?? 'Could not load this blood request.'
      request.value = null
    } finally {
      isLoadingRequest.value = false
    }
  }

  /**
   * Look up how much matching stock the network currently holds.
   *
   * Advisory: nothing here is reserved for this request. What is actually held
   * is `request.allocated_count` and the allocations list.
   */
  async function fetchAvailability() {
    if (!request.value) return

    isLoadingAvailability.value = true
    availabilityError.value = null

    try {
      // A request asks per component now, and the availability endpoint
      // answers for one. The first line is the one shown beside the request;
      // `component` on the request itself no longer exists, and reading it
      // here sent component_id: undefined and got a 422 back.
      const firstLine = request.value.items?.[0]

      if (!firstLine) {
        bloodAvailability.value = []
        return
      }

      // The line's own type: a weekly request's lines can each differ.
      const response = await hospitalService.availability({
        blood_type_id: firstLine.blood_type?.id ?? request.value.blood_type?.id,
        component_id: firstLine.component?.id,
        quantity: firstLine.outstanding_quantity || request.value.outstanding_quantity || undefined,
      })
      bloodAvailability.value = response?.facilities ?? []
    } catch (err) {
      availabilityError.value = err?.message ?? 'Could not load blood availability.'
      bloodAvailability.value = []
    } finally {
      isLoadingAvailability.value = false
    }
  }

  /**
   * Confirm that dispatched units arrived, then refresh.
   */
  /** Confirm receipt, returning the API's answer — including how many bags went onto the shelf. */
  async function confirmReceipt(allocationIds) {
    const response = await hospitalService.confirmReceipt(requestId, allocationIds)
    await fetchRequest()

    return response
  }

  async function cancelRequest(reason) {
    await hospitalService.cancelRequest(requestId, reason)
    await fetchRequest()
  }

  /**
   * Everything that has happened to the request, oldest first — who did it,
   * from which facility, and each line's figures at that moment.
   */
  async function fetchHistory() {
    isLoadingHistory.value = true
    historyError.value = null

    try {
      const response = await hospitalService.requestHistory(requestId)
      history.value = response?.events ?? []
    } catch (err) {
      historyError.value = err?.message ?? 'Could not load the request history.'
      history.value = []
    } finally {
      isLoadingHistory.value = false
    }
  }

  /**
   * Close the rest of one line this blood bank no longer needs, then refresh.
   */
  async function closeLine(itemId, note) {
    const result = await hospitalService.closeRequestLine(requestId, itemId, note)
    await fetchRequest()

    return result
  }

  async function refresh() {
    await fetchRequest()
    await fetchAvailability()
  }

  return {
    request,
    history,
    bloodAvailability,
    timeline,
    stage,
    progressPercent,
    isLoadingRequest,
    isLoadingAvailability,
    isLoadingHistory,
    requestError,
    availabilityError,
    historyError,
    fetchRequest,
    fetchAvailability,
    fetchHistory,
    confirmReceipt,
    cancelRequest,
    closeLine,
    refresh,
  }
}
