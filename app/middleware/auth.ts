/**
 * Keep signed-out users off the portal pages.
 *
 * Presentation only — the server refuses every endpoint regardless. What this
 * buys is that someone without a token lands on their portal's login instead of
 * a dashboard shell that 401s every request it makes.
 *
 * The login-route map lives in `utils/authRoutes` because the 401 handler
 * (`plugins/session-expiry.client.ts`) has to send people to exactly the same
 * places, and two copies would drift.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) {
    return
  }

  if (localStorage.getItem('_token')) {
    return
  }

  return navigateTo({
    path: loginRouteFor(to.path),
    query: {
      redirect: to.fullPath,
    },
  })
})
