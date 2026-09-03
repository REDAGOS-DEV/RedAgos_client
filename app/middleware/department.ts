/**
 * Keep a blood-centre staff member out of pages their department does not cover.
 *
 * This runs after `auth`, which only checks that a token exists. It is
 * presentation, not security: the server refuses the underlying endpoint with
 * `can:` regardless. What it buys is that a Billing staffer who types an
 * inventory URL lands somewhere useful instead of on a page that renders
 * chrome and then 403s every request it makes.
 *
 * Declare the ability a page needs alongside its layout:
 *
 *   definePageMeta({ middleware: ['auth', 'department'], requires: 'inventory.view' })
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  // No token at all is `auth`'s problem, not ours. Bailing here avoids racing
  // it to the login redirect.
  if (!localStorage.getItem('_token')) {
    return
  }

  const required = to.meta.requires as string | undefined

  const { ensureUser, can } = useUser()

  // Awaited, because on a hard refresh no page has fetched the user yet and a
  // permission check against an empty list would bounce everybody.
  const user = await ensureUser()

  // The token is present but unusable — expired, revoked, or the API is down.
  // Leave it alone: redirecting on a failed fetch would turn a transient
  // network error into a permanent bounce away from the page.
  if (!user) {
    return
  }

  if (!required || can(required)) {
    return
  }

  const home = departmentHome(user)

  // A home page that is itself gated would loop, so stop if we are already there.
  if (to.path === home) {
    return
  }

  return navigateTo(home)
})
