/**
 * The registration waiting on its verification code, kept across a reload.
 *
 * Registration ends on the code step. A refresh would otherwise throw it away
 * and show the empty form again, and registering a second time only gets "this
 * email is already taken". So the address is kept, and the page puts the code
 * step back.
 *
 * Since 2026-11-03 the address is verified with a code typed on that same
 * step, so nothing has to travel between tabs any more; the cross-tab marker
 * the emailed link needed is gone.
 */

/** The registration awaiting verification in this browser. */
const PENDING_KEY = '_pending_verification'

/**
 * How long a pending registration is worth restoring.
 *
 * A code only lasts ten minutes, but the step stays useful past that: it is
 * where "Resend code" lives. A day is long enough to come back to, short
 * enough that a stale step does not greet someone who has since moved on.
 */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000

export type PendingVerification = { email: string, at: number }

/**
 * localStorage, or null where there is none.
 *
 * Absent during SSR, and throwing rather than merely missing in Safari private
 * browsing and wherever site data is blocked. None of this is load-bearing, so
 * every access degrades to "nothing stored" instead of taking the page down.
 *
 * Feature-detected rather than gated on `import.meta.client`, which would make
 * every function below a no-op under the node test environment.
 */
function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Record that this browser has a registration waiting on its code. */
export function rememberPendingVerification(email: string): void {
  try {
    store()?.setItem(PENDING_KEY, JSON.stringify({ email, at: Date.now() } satisfies PendingVerification))
  } catch { /* storage unavailable: a reload just shows the form */ }
}

/** The pending registration, if there is one and it has not gone stale. */
export function readPendingVerification(): PendingVerification | null {
  let raw: string | null

  try {
    raw = store()?.getItem(PENDING_KEY) ?? null
  } catch {
    return null
  }

  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as PendingVerification

    if (!parsed?.email || Date.now() - parsed.at > PENDING_TTL_MS) {
      clearPendingVerification()
      return null
    }

    return parsed
  } catch {
    clearPendingVerification()
    return null
  }
}

/** Forget the pending registration once its address is verified. */
export function clearPendingVerification(): void {
  try {
    store()?.removeItem(PENDING_KEY)
  } catch { /* as above */ }
}
