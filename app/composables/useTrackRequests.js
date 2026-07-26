/**
 * This page is tracking-only (not a management page), so this composable
 * only ever reads data. Nothing is hardcoded — recent tracked requests,
 * the searched request, its timeline, latest updates, documents, and
 * pickup info all come from the Laravel backend.
 *
 * Expected Laravel endpoints (adjust paths to match your actual routes):
 *
 *   GET /hospital/track-requests/recent
 *       -> [{ reference_number, blood_type, status, updated_at }, ...]
 *
 *   GET /hospital/track-requests/search?reference_number=BBR-2026-000125
 *       -> {
 *            request: {...},           // same shape as blood request details
 *            timeline: [...],          // optional, falls back to buildTimeline()
 *            updates: [...],           // [{ id, icon, description, timestamp }]
 *            documents: [...],         // [{ id, label, name, url }]
 *            pickup: {
 *              estimated_pickup_time, pickup_location,
 *              blood_center_contact, operating_hours
 *            }
 *          }
 *       -> 404 if reference number does not match any request
 */

export const useTrackRequests = () => {
  // Uses the project's existing useApi() composable, same as
  // useBloodRequestDetails.js, so auth cookies / base URL handling
  // stay consistent across pages.
  const referenceInput = ref('')

  const recentRequests = ref([])
  const isLoadingRecent = ref(false)
  const recentError = ref(null)

  const trackedData = ref(null) // { request, timeline, updates, documents, pickup }
  const isSearching = ref(false)
  const hasSearched = ref(false)
  const searchError = ref(null) // 'not_found' | 'generic' | null

  const request = computed(() => trackedData.value?.request ?? null)
  const updates = computed(() => trackedData.value?.updates ?? [])
  const documents = computed(() => trackedData.value?.documents ?? [])
  const pickup = computed(() => trackedData.value?.pickup ?? null)

  const timeline = computed(() => {
    if (!trackedData.value) return []
    if (Array.isArray(trackedData.value.timeline) && trackedData.value.timeline.length) {
      return trackedData.value.timeline
    }
    return buildTimeline(request.value)
  })

  const progressPercent = computed(() => {
    const steps = timeline.value
    if (!steps.length) return 0
    const completedCount = steps.filter((s) => s.status === 'completed').length
    const hasCurrent = steps.some((s) => s.status === 'current')
    const numerator = completedCount + (hasCurrent ? 0.5 : 0)
    return Math.round((numerator / steps.length) * 100)
  })

  async function fetchRecent() {
    isLoadingRecent.value = true
    recentError.value = null
    try {
      const { data, error } = await useApi().get('/hospital/trackrequests/recent')
      if (error?.value) throw error.value
      recentRequests.value = data?.value ?? []
    } catch (err) {
      recentError.value = err
      recentRequests.value = []
    } finally {
      isLoadingRecent.value = false
    }
  }

  async function searchByReference(referenceNumber) {
    const ref = (referenceNumber ?? referenceInput.value ?? '').trim()
    if (!ref) return

    referenceInput.value = ref
    isSearching.value = true
    hasSearched.value = true
    searchError.value = null

    try {
      const { data, error } = await useApi().get('/hospital/trackrequests/search', {
        params: { reference_number: ref },
      })
      if (error?.value) {
        const status = error.value?.statusCode ?? error.value?.response?.status
        searchError.value = status === 404 ? 'not_found' : 'generic'
        trackedData.value = null
        return
      }
      if (!data?.value?.request) {
        searchError.value = 'not_found'
        trackedData.value = null
        return
      }
      trackedData.value = data.value
    } catch (err) {
      searchError.value = 'generic'
      trackedData.value = null
    } finally {
      isSearching.value = false
    }
  }

  function selectRecent(referenceNumber) {
    return searchByReference(referenceNumber)
  }

  async function refreshStatus() {
    if (!request.value?.reference_number) return
    await searchByReference(request.value.reference_number)
  }

  function clearSearch() {
    trackedData.value = null
    hasSearched.value = false
    searchError.value = null
    referenceInput.value = ''
  }

  return {
    referenceInput,
    recentRequests,
    isLoadingRecent,
    recentError,
    trackedData,
    request,
    timeline,
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