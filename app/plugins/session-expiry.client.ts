import { onUnauthorized } from '~/api/unauthorized'

/**
 * Send a user whose session has been rejected back to their portal's login.
 *
 * Before this, a 401 was indistinguishable from any other failure: every
 * request on the page failed with a generic message and nothing offered a way
 * back. An expired or revoked token left the user stuck on a dashboard that
 * would never load again until they cleared storage by hand.
 *
 * Client-only. On the server there is no session to expire and no window to
 * navigate.
 */
export default defineNuxtPlugin(() => {
  const router = useRouter()

  // Single-flight. A dashboard fires six requests at mount; when the token is
  // dead all six answer 401 within a few milliseconds. Without this latch each
  // one starts its own redirect, and the last writes a `redirect` query built
  // from a URL the user has already left.
  let redirecting = false

  onUnauthorized(() => {
    if (redirecting) return

    const current = router.currentRoute.value

    // The login request itself answers 401 on bad credentials. Redirecting the
    // login page to the login page would discard the error the user needs to
    // read, and look like the form silently did nothing.
    if (isAuthRoute(current.path)) return

    redirecting = true

    // Local-only clear: the token is already dead server-side, so calling
    // logout() would POST /logout, take another 401, and re-enter here.
    const { clearSession } = useUser()
    clearSession()

    const target = loginRouteFor(current.path)

    // fullPath keeps query and hash, so the user lands back where they were
    // rather than on the portal's default page.
    router.replace({
      path: target,
      query: { redirect: current.fullPath, reason: 'session_expired' },
    }).finally(() => {
      redirecting = false
    })
  })
})
