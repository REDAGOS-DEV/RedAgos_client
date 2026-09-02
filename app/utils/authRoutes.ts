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
