import { hospitalService } from '~/api/hospital/HospitalService'
import { buildTimeline } from '~/composables/useBloodRequestDetails'
import { requestStage } from '~/types/bloodRequest'

/**
 * Tracking a request by the reference number on its paperwork.
 *
 * Rewritten to call the real API. The previous version used `useApi()`, which
 * does not exist in this repository, and hit two endpoints that were never
 * built (`/hospital/trackrequests/recent` and `/hospital/trackrequests/search`).
 * Recent requests now come from the requester's own request list, and a lookup
 * goes through the reference-number route the API actually serves.
 */
export const useTrackRequests = () => {
  const referenceInput = ref('')

  const recentRequests = ref([])
  const isLoadingRecent = ref(false)
  const recentError = ref(null)

  const trackedData = ref(null)
  const isSearching = ref(false)
  const hasSearched = ref(false)
  const searchError = ref(null)

  const request = computed(() => trackedData.value)
  const timeline = computed(() => buildTimeline(trackedData.value))
  const stage = computed(() => (trackedData.value ? requestStage(trackedData.value) : null))

  /**
   * Updates feed, derived from the allocations rather than an event log.
   *
   * The API stores no per-request activity stream, so this reconstructs one
   * from the timestamps that do exist. It is honest about that: nothing here
   * is invented, every entry corresponds to a recorded moment.
   */
  const updates = computed(() => {
    const req = trackedData.value
    if (!req) return []

    const entries = []

    if (req.request_date) {
      entries.push({ label: 'Request submitted', at: req.request_date, tone: 'info' })
    }

    if (req.reviewed_at) {
      entries.push({
        label: req.status === 'rejected' ? 'Request rejected' : 'Request reviewed',
        at: req.reviewed_at,
        tone: req.status === 'rejected' ? 'danger' : 'success',
        detail: req.rejection_reason ?? null,
      })
    }

    for (const allocation of req.allocations ?? []) {
      if (allocation.allocated_at) {
        entries.push({
          label: `Unit ${allocation.unit_id} reserved`,
          at: allocation.allocated_at,
          tone: 'progress',
        })
      }
      if (allocation.released_at) {
        entries.push({
          label: `Unit ${allocation.unit_id} dispatched`,
          at: allocation.released_at,
          tone: 'progress',
        })
      }
      if (allocation.received_at) {
        entries.push({
          label: `Unit ${allocation.unit_id} received`,
          at: allocation.received_at,
          tone: 'success',
        })
      }
    }

    if (req.fulfilled_at) {
      entries.push({ label: 'Request fulfilled', at: req.fulfilled_at, tone: 'success' })
    }

    return entries.sort((a, b) => new Date(b.at) - new Date(a.at))
  })

  /**
   * Attachments are not supported by the API yet.
   *
   * Blood requests carry no documents: the schema has no attachment table and
   * the Capstone mandates document storage for donation records only. Kept as
   * an empty list so the page's document panel renders its empty state rather
   * than failing on an undefined.
   */
  const documents = computed(() => [])

  /**
   * Pickup details, as far as the API models them.
   */
  const pickup = computed(() => {
    const req = trackedData.value
    if (!req) return null

    const released = (req.allocations ?? []).filter((a) => a.released_at)

    return {
      facility: req.target_facility?.name ?? null,
      address: req.target_facility?.address ?? null,
      units_dispatched: released.length,
      dispatched_at: released[0]?.released_at ?? null,
      awaiting_confirmation: released.filter((a) => !a.received_at).length,
    }
  })

  const progressPercent = computed(() => {
    const steps = timeline.value
    if (!steps.length) return 0
    const completed = steps.filter((s) => s.status === 'completed').length
    const hasCurrent = steps.some((s) => s.status === 'current')
    return Math.round(((completed + (hasCurrent ? 0.5 : 0)) / steps.length) * 100)
  })

  /**
   * The requester's most recent requests, for the quick-pick dropdown.
   */
  async function fetchRecent() {
    isLoadingRecent.value = true
    recentError.value = null

    try {
      const response = await hospitalService.listRequests({ per_page: 10 })
      recentRequests.value = response?.data ?? []
    } catch (err) {
      recentError.value = err?.message ?? 'Could not load recent requests.'
      recentRequests.value = []
    } finally {
      isLoadingRecent.value = false
    }
  }

  async function searchByReference(reference = referenceInput.value) {
    const trimmed = String(reference ?? '').trim()

    if (!trimmed) {
      searchError.value = 'Enter a reference number to track.'
      return
    }

    isSearching.value = true
    searchError.value = null
    hasSearched.value = true

    try {
      const response = await hospitalService.trackRequest(trimmed)
      trackedData.value = response?.request ?? null
      referenceInput.value = trimmed
    } catch (err) {
      searchError.value =
        err?.status === 404
          ? 'No request found for that reference number.'
          : (err?.message ?? 'Could not look up that reference number.')
      trackedData.value = null
    } finally {
      isSearching.value = false
    }
  }

  function selectRecent(candidate) {
    const reference = typeof candidate === 'string' ? candidate : candidate?.reference_number
    if (reference) {
      return searchByReference(reference)
    }
  }

  function refreshStatus() {
    if (trackedData.value?.reference_number) {
      return searchByReference(trackedData.value.reference_number)
    }
  }

  function clearSearch() {
    referenceInput.value = ''
    trackedData.value = null
    hasSearched.value = false
    searchError.value = null
  }

  return {
    referenceInput,
    recentRequests,
    isLoadingRecent,
    recentError,
    trackedData,
    request,
    timeline,
    stage,
    updates,
    documents,
    pickup,
    progressPercent,
    isSearching,
    hasSearched,
    searchError,
    fetchRecent,
    searchByReference,
    selectRecent,
    refreshStatus,
    clearSearch,
  }
}
