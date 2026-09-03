/**
 * Where each portal sends someone who needs to sign in.
 *
 * Two places need this and must agree: the `auth` route middleware (no token
 * before the page renders) and the 401 handler (the token was rejected
 * mid-session). Two copies would drift, and the failure would be silent — a
 * user bounced to the wrong portal's login.
 */
export const LOGIN_ROUTES: Record<string, string> = {
  '/donor': '/auth/donor/login',
  '/hospital': '/auth/hospital/login',
  '/blood-center': '/auth/blood-center/login',
  '/admin': '/auth/admin/login',
}

/** Fallback when a path matches no portal prefix. */
export const ROLE_SELECTION = '/auth/role-selection'

/**
 * The login page for whichever portal `path` belongs to.
 */
export function loginRouteFor(path: string): string {
  const prefix = Object.keys(LOGIN_ROUTES).find((p) => path.startsWith(p))

  return prefix ? LOGIN_ROUTES[prefix]! : ROLE_SELECTION
}

/**
 * Is this already an unauthenticated page?
 *
 * The 401 handler must not redirect away from one: the sign-in request itself
 * answers 401 on bad credentials, and bouncing the login page to the login page
 * would wipe the error the user needs to read.
 */
export function isAuthRoute(path: string): boolean {
  return path.startsWith('/auth/') || path === '/' || path.startsWith('/legal/')
}

/**
 * Which role each portal belongs to.
 *
 * These are the canonical names Laravel returns — `UserResource` sends
 * `roles->pluck('name')`, and `RequireRole` compares against the same column,
 * so `blood_bank` here is the same string the server checks. The kebab-case
 * aliases the login screens send (`hospital`, `blood-center`) are a wire format
 * only; they are normalised server-side by `RoleName::normalize()` and never
 * appear on a loaded user.
 */
export const PORTAL_ROLES: Record<string, string> = {
  '/donor': 'donor',
  '/hospital': 'blood_bank',
  '/blood-center': 'blood_center',
  '/admin': 'admin',
}

/** The role required to be in this portal, if the path is inside one. */
export function portalRoleFor(path: string): string | null {
  const prefix = Object.keys(PORTAL_ROLES).find((p) => path.startsWith(p))

  return prefix ? PORTAL_ROLES[prefix]! : null
}

/**
 * Where a signed-in user belongs, given the roles they actually hold.
 *
 * Used to redirect someone who opened another portal's URL. Blood-centre staff
 * are handed to `departmentHome()` rather than a fixed page, because their
 * landing page depends on their department.
 */
export function portalHomeFor(user: { roles?: string[] } | null | undefined): string {
  const roles = user?.roles ?? []

  if (roles.includes('admin')) return '/admin/registrations'
  if (roles.includes('donor')) return '/donor/Dashboard'
  if (roles.includes('blood_center')) return departmentHome(user)
  // The hospital portal is closed until it has a backend; `hospital-portal`
  // middleware turns this into the unavailable page.
  if (roles.includes('blood_bank')) return '/hospital/dashboard'

  return ROLE_SELECTION
}
