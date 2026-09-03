/**
 * Keep a signed-in user inside the portal their role belongs to.
 *
 * Before this, `auth` only checked that *a* token existed, so any authenticated
 * user could open `/admin/registrations` or `/blood-center/inventory` and get
 * the full shell — which then 403'd every request it made. A donor could read
 * the admin page's chrome, headings and empty tables.
 *
 * This is presentation, not security. The server holds the line either way:
 * 68 of its 93 routes carry a `role:` guard and 31 carry a `can:` ability, and
 * `RequireRole` aborts 403 regardless of what the client believes. What this
 * buys is that people land somewhere useful instead of on a page that renders
 * and then fails.
 *
 * Global rather than per-page: the mapping is keyed on path prefix, so one file
 * covers every portal route and there is no per-page opt-in to forget — which
 * is exactly how four hospital pages ended up with no guard at all.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  const required = portalRoleFor(to.path)

  // Not a portal route (landing page, auth screens, legal) — nothing to check.
  if (!required) {
    return
  }

  // No token is `auth`'s problem. Bailing avoids racing it to the login
  // redirect and producing two navigations.
  if (!localStorage.getItem('_token')) {
    return
  }

  const { ensureUser } = useUser()

  // Awaited: on a hard refresh no page has fetched the user yet, and checking
  // roles against an empty list would bounce everybody.
  const user = await ensureUser()

  // Token present but unusable — expired, revoked, or the API is down. Leave it
  // alone. The 401 handler owns the expired case, and redirecting on a failed
  // fetch would turn a transient network error into a permanent bounce.
  if (!user) {
    return
  }

  if (user.roles?.includes(required)) {
    return
  }

  const home = portalHomeFor(user)

  // A home that is itself out of reach would loop.
  if (to.path === home) {
    return
  }

  return navigateTo(home)
})
