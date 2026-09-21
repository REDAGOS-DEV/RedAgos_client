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
 * Derived, never stored. The API keeps request status deliberately coarse and
 * records dispatch and receipt per allocated unit, so the finer steps here are
 * a reading of those rows rather than a status the server sends.
 */
export function buildTimeline(request) {
  if (!request) return []

  const allocations = request.allocations ?? []
  const released = allocations.filter((a) => a.status === 'released')
  const received = allocations.filter((a) => a.received_at)

  const terminal = ['rejected', 'cancelled'].includes(request.status)

  const steps = [
    {
      key: 'submitted',
      label: 'Submitted',
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
      label: 'Dispatched',
      done: released.length > 0,
      timestamp: released[0]?.released_at ?? null,
    },
    {
      key: 'received',
      label: 'Received',
      done: received.length > 0,
      timestamp: received[0]?.received_at ?? null,
    },
    {
      key: 'completed',
      label: 'Completed',
      done: request.status === 'fulfilled',
      timestamp: request.fulfilled_at,
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
  const history = ref([])
  const bloodAvailability = ref([])

  const isLoadingRequest = ref(true)
  const isLoadingAvailability = ref(false)
  const requestError = ref(null)
  const availabilityError = ref(null)

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
      // The API keeps no separate event log for a request; the timeline above
      // is built from the request's own timestamps instead.
      history.value = []
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

      const response = await hospitalService.availability({
        blood_type_id: request.value.blood_type?.id,
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
  async function confirmReceipt(allocationIds) {
    await hospitalService.confirmReceipt(requestId, allocationIds)
    await fetchRequest()
  }

  async function cancelRequest(reason) {
    await hospitalService.cancelRequest(requestId, reason)
    await fetchRequest()
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
    requestError,
    availabilityError,
    fetchRequest,
    fetchAvailability,
    confirmReceipt,
    cancelRequest,
    refresh,
  }
}
