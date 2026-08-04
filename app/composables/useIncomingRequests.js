export function useIncomingRequests() {
  //const { get, post, patch } = useApi()

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
   */
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
   */
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
   */
  async function fetchRequestDetail(id) {
    const { data, error: fetchError } = await get(`/blood-center/bloodrequests/${id}`)
    return { data, error: fetchError }
  }

  /**
   * PATCH /blood-center/bloodrequests/:id/approve
   * Approves the request and reserves the selected inventory batches.
   */
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
   */
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
   */
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