import { readonly, ref, watch } from 'vue'
import { apiRequestsInFlight } from '~/api/activity'

/**
 * The "Launching Workspace" screen between sign-in and the portal.
 *
 * Sign-in hands over to it once the password is accepted; it covers loading
 * the profile, opening the portal and the portal's first requests, then fades
 * out on a page that has its data. The screen itself is
 * components/common/WorkspaceLaunchScreen.vue, mounted once in app.vue so it
 * outlives the route change from /auth/login to the portal.
 *
 * Kept outside the composable, as useUser's `inFlight`: the login page that
 * starts it is gone by the time it ends. Only ever set on the client.
 */

// Long enough to read, so a fast sign-in does not flash it.
const MIN_VISIBLE_MS = 700
// No request on the wire for this long counts as loaded. Covers the tick
// between the page mounting and its first fetch, and the gap between two
// fetches a page makes one after the other.
const QUIET_MS = 400
// Never longer than this, whatever a page is still waiting on.
const MAX_VISIBLE_MS = 12_000

const launching = ref(false)
let shownAt = 0
let quietTimer: ReturnType<typeof setTimeout> | null = null
let capTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let stopWatching: (() => void) | null = null

function clearTimers() {
  for (const timer of [quietTimer, capTimer, hideTimer]) {
    if (timer) clearTimeout(timer)
  }
  quietTimer = capTimer = hideTimer = null
  stopWatching?.()
  stopWatching = null
}

/** Show the screen. Sign-in calls this once the password is accepted. */
function begin() {
  clearTimers()
  shownAt = Date.now()
  launching.value = true
}

/**
 * The portal is open: hide the screen once its requests go quiet, no sooner
 * than MIN_VISIBLE_MS after it appeared and no later than MAX_VISIBLE_MS.
 */
function settle() {
  if (!launching.value) return

  clearTimers()
  capTimer = setTimeout(finish, Math.max(0, shownAt + MAX_VISIBLE_MS - Date.now()))
  stopWatching = watch(apiRequestsInFlight, (count) => {
    if (quietTimer) clearTimeout(quietTimer)
    quietTimer = count === 0 ? setTimeout(finish, QUIET_MS) : null
  }, { immediate: true })
}

function finish() {
  clearTimers()
  hideTimer = setTimeout(() => {
    hideTimer = null
    launching.value = false
  }, Math.max(0, shownAt + MIN_VISIBLE_MS - Date.now()))
}

/** Sign-in failed after all: back to the form at once. */
function cancel() {
  clearTimers()
  launching.value = false
}

export function useWorkspaceLaunch() {
  return {
    launching: readonly(launching),
    begin,
    settle,
    cancel,
  }
}
