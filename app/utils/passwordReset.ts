/**
 * Password reset, shared by the four portals.
 *
 * The flow is the server's: POST /forgot-password emails a link to
 * `/auth/reset-password?token=…&email=…` (ResetPasswordNotification), and
 * POST /reset-password sets the new password. There is no OTP step on the
 * server, so every portal, administrators included, uses this one link flow.
 *
 * The emailed link does not say which portal the person came from, so the
 * forgot-password screen remembers it here. The reset screen reads it back to
 * send them to the right sign-in afterwards, falling back to the Get started
 * page when the link is opened in another browser.
 */

import type { PortalKey } from '~/composables/useAuthLogin'

// One sign-in screen for all but the administrators (2026-10-24).
export const PORTAL_LOGIN: Record<PortalKey, string> = {
  'user': '/auth/login',
  'donor': '/auth/login',
  'hospital': '/auth/login',
  'blood-center': '/auth/login',
  'admin': '/auth/admin/login',
}

export const PORTAL_FORGOT: Record<PortalKey, string> = {
  'user': '/auth/donor/forgot-password',
  'donor': '/auth/donor/forgot-password',
  'hospital': '/auth/hospital/forgot-password',
  'blood-center': '/auth/blood-center/forgot-password',
  'admin': '/auth/admin/forgot-password',
}

const STORAGE_KEY = 'redagos:reset-portal'

export function rememberResetPortal(portal: PortalKey): void {
  try {
    localStorage.setItem(STORAGE_KEY, portal)
  } catch {
    // Private mode or storage blocked: the reset still works, it just ends
    // on the Get started page instead of this portal's sign-in.
  }
}

export function recallResetPortal(): PortalKey | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value && value in PORTAL_LOGIN ? (value as PortalKey) : null
  } catch {
    return null
  }
}

export function forgetResetPortal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up.
  }
}

/** The server's rule (ResetPasswordRequest): 8+, mixed case, a number. */
export function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    mixedCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  }
}
