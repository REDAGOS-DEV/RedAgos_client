import { readonly, ref } from 'vue'

/**
 * How many API requests are on the wire right now (client only).
 *
 * Read by the "Launching Workspace" screen after sign-in: it stays up until
 * the portal's first requests have answered, so the user lands on a page with
 * its data rather than on skeletons. `BaseService` counts its own requests
 * here, as it reports a 401 to `unauthorized.ts`, without knowing who reads it.
 */
const inFlight = ref(0)

export const apiRequestsInFlight = readonly(inFlight)

/** Counts `work` as in flight until it settles, either way. */
export async function trackRequest<T>(work: Promise<T>): Promise<T> {
  inFlight.value += 1
  try {
    return await work
  } finally {
    inFlight.value -= 1
  }
}
