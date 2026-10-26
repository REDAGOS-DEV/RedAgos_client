/**
 * Keep the hospital / blood-bank portal closed until it has a backend, and
 * keep each staff member to the pages their role covers.
 *
 * Blood-bank accounts are real now — a Super Admin creates them through
 * Facility Management, and they hold `blood_bank` and sign in like anyone else.
 * While `NUXT_PUBLIC_HOSPITAL_PORTAL_ENABLED` is off, every `/hospital` route
 * goes to an honest unavailable page rather than a broken one.
 *
 * Once it is on, a page may declare the hospital ability it needs (hospital
 * roles, project owner 2026-10-11):
 *
 *   definePageMeta({ middleware: ['auth', 'hospital-portal'], requires: 'hospital.inventory.view' })
 *
 * A staff member whose role lacks it lands on the dashboard instead of a page
 * that renders its chrome and then 403s every request. This is presentation,
 * not security: the server refuses the endpoint with `can:` either way.
 */
const HOSPITAL_HOME = '/hospital/dashboard'

export default defineNuxtRouteMiddleware(async (to) => {
  const { hospitalPortalEnabled } = useRuntimeConfig().public

  if (hospitalPortalEnabled) {
    return requireHospitalRole(to)
  }

  // Already there — bailing avoids a redirect loop.
  if (to.path === '/hospital/unavailable') {
    return
  }

  return navigateTo('/hospital/unavailable')
})

async function requireHospitalRole(to: { path: string, meta: Record<string, unknown> }) {
  // A list means any one of them.
  const required = to.meta.requires as string | string[] | undefined

  // No token is `auth`'s problem, not ours; bailing avoids racing it to the login.
  if (!required || import.meta.server || !localStorage.getItem('_token')) {
    return
  }

  const { ensureUser, can } = useUser()

  // Awaited: on a hard refresh no page has fetched the user yet.
  const user = await ensureUser()

  // An unusable token or a down API: leave it, rather than bounce on a blip.
  if (!user || can(required) || to.path === HOSPITAL_HOME) {
    return
  }

  return navigateTo(HOSPITAL_HOME)
}
