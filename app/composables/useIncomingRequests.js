import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_TONES } from '~/types/bloodRequest'

/**
 * The blood centre's incoming request queue.
 *
 * This file used to be a fixture store: 300 lines of seeded Davao hospitals
 * with the real implementation commented out beneath, because no backend route
 * existed. It does now, so the fixtures are gone and every value below comes
 * from the API.
 *
 * Fields the fixtures carried that the schema does not have — requester name,
 * department, phone, email, patient details — are not reconstructed here.
 * Inventing them was what made the mock convincing and the contract wrong; a
 * screen that needs them needs a schema decision first.
 */
export const useIncomingRequests = () => {
  const requests = ref([])
  const summary = ref(null)
  const selected = ref(null)
  const inventory = ref(null)

  const isLoading = ref(false)
  const isLoadingDetail = ref(false)
  const error = ref(null)
  const actionError = ref(null)
  const isActing = ref(false)

  const filters = reactive({
    status: undefined,
    urgency_level: undefined,
    blood_type_id: undefined,
    component_id: undefined,
    search: undefined,
  })

  const meta = ref({ current_page: 1, last_page: 1, total: 0 })

  const emergencies = computed(() => requests.value.filter((r) => r.is_emergency))

  const awaitingRelease = computed(() =>
    requests.value.filter((r) => r.allocated_count > 0 && r.status === 'processing'),
  )

  /**
   * Badge tone for a status, shared with the hospital portal so the two
   * portals cannot disagree about what a status looks like.
   */
  function toneFor(status) {
    return REQUEST_STATUS_TONES[status] ?? 'muted'
  }

  function labelFor(status) {
    return REQUEST_STATUS_LABELS[status] ?? status
  }

  function activeFilters() {
    return Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
    )
  }

  async function fetchRequests(page = 1) {
    isLoading.value = true
    error.value = null

    try {
      const response = await bloodCenterService.incomingRequests({ ...activeFilters(), page })
      requests.value = response?.data ?? []
      meta.value = {
        current_page: response?.current_page ?? 1,
        last_page: response?.last_page ?? 1,
        total: response?.total ?? 0,
      }
    } catch (err) {
      error.value = err?.message ?? 'Could not load incoming requests.'
      requests.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function fetchSummary() {
    try {
      summary.value = await bloodCenterService.incomingRequestsSummary()
    } catch {
      // A failed counter must not blank the queue itself, which is the part
      // staff actually need. The cards fall back to their empty state.
      summary.value = null
    }
  }

  /**
   * Open one request beside the live stock that could fill it.
   *
   * Reading holds nothing — the availability figure is advisory, and
   * allocation re-checks every unit under a lock before reserving.
   */
  async function openRequest(id) {
    isLoadingDetail.value = true
    actionError.value = null

    try {
      const response = await bloodCenterService.reviewRequest(id)
      selected.value = response?.request ?? null
      inventory.value = response?.inventory ?? null
    } catch (err) {
      actionError.value = err?.message ?? 'Could not load that request.'
      selected.value = null
      inventory.value = null
    } finally {
      isLoadingDetail.value = false
    }
  }

  function closeRequest() {
    selected.value = null
    inventory.value = null
    actionError.value = null
  }

  /**
   * Run an action, refresh what it changed, and surface any refusal.
   *
   * The API refuses with a `code` and a message written for staff, so the
   * message is shown as-is rather than replaced with a generic one.
   */
  async function act(operation) {
    isActing.value = true
    actionError.value = null

    try {
      const result = await operation()
      await Promise.all([fetchRequests(meta.value.current_page), fetchSummary()])
      if (selected.value) await openRequest(selected.value.id)
      return result
    } catch (err) {
      actionError.value = err?.message ?? 'That action could not be completed.'
      throw err
    } finally {
      isActing.value = false
    }
  }

  function allocate(id, quantity) {
    return act(() => bloodCenterService.allocateRequest(id, quantity))
  }

  function reject(id, reason) {
    return act(() => bloodCenterService.rejectRequest(id, reason))
  }

  function releaseHolds(id, reason, allocationIds) {
    return act(() => bloodCenterService.releaseHolds(id, reason, allocationIds))
  }

  function release(id, allocationIds) {
    return act(() => bloodCenterService.releaseRequest(id, allocationIds))
  }

  async function refresh() {
    await Promise.all([fetchRequests(), fetchSummary()])
  }

  return {
    requests,
    summary,
    selected,
    inventory,
    emergencies,
    awaitingRelease,
    filters,
    meta,
    isLoading,
    isLoadingDetail,
    isActing,
    error,
    actionError,
    toneFor,
    labelFor,
    fetchRequests,
    fetchSummary,
    openRequest,
    closeRequest,
    allocate,
    reject,
    releaseHolds,
    release,
    refresh,
  }
}
