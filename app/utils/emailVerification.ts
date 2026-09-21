/**
 * Hand-off between the tab that registered and the tab that verified.
 *
 * Registration ends on the "Check your email" panel, but the verification link
 * is opened from a mail client — almost always in a *second* tab. The tab
 * holding the panel has no way to learn what happened over there: the state was
 * a plain `ref`, so it sat on the resend button forever and a refresh threw it
 * away and showed the empty form again.
 *
 * There is deliberately no "is this address verified?" endpoint to poll. The
 * guest resend at `/api/email/resend-verification` answers identically whatever
 * the address turns out to be, precisely so nobody can discover which addresses
 * are registered, and a status endpoint would hand back exactly that oracle.
 *
 * So the signal travels the only way it safely can: the tab that *did* the
 * verification records it, and `storage` events carry that to the other tabs of
 * the same browser. The marker is written in one place only — after the API has
 * answered 200/204 on `POST /api/email/verify` — so acting on it is acting on a
 * confirmed backend result, never on a guess that the link was clicked.
 *
 * A donor who verifies on a different device than they registered on gets no
 * signal, which is why the panel keeps its "Already verified? Sign In" link.
 */

/** The registration awaiting verification in this browser. */
const PENDING_KEY = '_pending_verification'

/** Written only after the API confirms the address is verified. */
const VERIFIED_KEY = '_email_verified'

/**
 * How long a pending registration is worth restoring.
 *
 * The link itself only lasts 60 minutes, but the panel stays useful past that —
 * it is where the resend button lives. A day is long enough to come back to,
 * short enough that a stale panel does not greet someone who has since moved on.
 */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000

export type PendingVerification = { email: string, at: number }

/**
 * localStorage, or null where there is none.
 *
 * Absent during SSR, and throwing rather than merely missing in Safari private
 * browsing and wherever site data is blocked. None of this is load-bearing —
 * losing it costs the hand-off, not the verification — so every access degrades
 * to "nothing stored" instead of taking the page down with it.
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

function read(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    store()?.setItem(key, value)
  } catch { /* storage unavailable — the hand-off is best-effort */ }
}

function remove(key: string): void {
  try {
    store()?.removeItem(key)
  } catch { /* as above */ }
}

/**
 * Record that this browser has a registration waiting on its verification link.
 *
 * Clears any marker left by an earlier registration in the same browser, so a
 * second sign-up cannot be bounced straight to login by a stale signal.
 */
export function rememberPendingVerification(email: string): void {
  remove(VERIFIED_KEY)
  write(PENDING_KEY, JSON.stringify({ email, at: Date.now() } satisfies PendingVerification))
}

/** The pending registration, if there is one and it has not gone stale. */
export function readPendingVerification(): PendingVerification | null {
  const raw = read(PENDING_KEY)

  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as PendingVerification

    if (!parsed?.email || Date.now() - parsed.at > PENDING_TTL_MS) {
      clearVerificationHandoff()
      return null
    }

    return parsed
  } catch {
    clearVerificationHandoff()
    return null
  }
}

/**
 * Record a verification the API has confirmed.
 *
 * Called from exactly one place — the verify-email page, once `POST
 * /api/email/verify` has answered successfully. Nothing else may write this.
 */
export function markEmailVerified(): void {
  write(VERIFIED_KEY, String(Date.now()))
}

/** Has a confirmed verification been recorded in this browser? */
export function hasVerifiedSignal(): boolean {
  return read(VERIFIED_KEY) !== null
}

/** Forget both sides of the hand-off once it has been acted on. */
export function clearVerificationHandoff(): void {
  remove(PENDING_KEY)
  remove(VERIFIED_KEY)
}

/**
 * Run `handler` when another tab in this browser records a verification.
 *
 * `storage` fires only in the tabs that did *not* write the value, which is
 * exactly the audience here: the tab still showing "Check your email".
 * Returns the unsubscribe function for `onBeforeUnmount`.
 */
export function onEmailVerified(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const listener = (event: StorageEvent) => {
    // `newValue === null` is a removal — our own clean-up, not a verification.
    if (event.key === VERIFIED_KEY && event.newValue !== null) {
      handler()
    }
  }

  window.addEventListener('storage', listener)

  return () => window.removeEventListener('storage', listener)
}
