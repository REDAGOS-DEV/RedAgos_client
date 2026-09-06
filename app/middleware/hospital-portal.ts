/**
 * Keep the hospital / blood-bank portal closed until it has a backend.
 *
 * Blood-bank accounts are real now — a Super Admin creates them through
 * Facility Management, and they hold `blood_bank` and sign in like anyone else.
 * What they do not have yet is anything to do: the Laravel app still has no
 * `/hospital/*` routes, so every page under `/hospital` renders its chrome and
 * then fails every request it makes, and two of them crash outright on an
 * undefined `useApi()`.
 *
 * Showing a broken portal is worse than showing a closed one, so this sends
 * those routes to an honest unavailable page instead.
 *
 * Flip `NUXT_PUBLIC_HOSPITAL_PORTAL_ENABLED=true` once the endpoints exist.
 * This is presentation, not security: the server is the gate either way.
 */
export default defineNuxtRouteMiddleware((to) => {
  const { hospitalPortalEnabled } = useRuntimeConfig().public

  if (hospitalPortalEnabled) {
    return
  }

  // Already there — bailing avoids a redirect loop.
  if (to.path === '/hospital/unavailable') {
    return
  }

  return navigateTo('/hospital/unavailable')
})
