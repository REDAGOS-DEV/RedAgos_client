import { authService } from '~/api/auth/AuthService'
import type { AppUser } from '~/types/user'

/**
 * One sign-in flow for all four portals.
 *
 * The four login pages carried their own copy of this logic, and had already
 * drifted apart in ways that were bugs rather than differences:
 *
 *  - Only the donor page honoured `?redirect`. The `auth` middleware and the
 *    401 handler both append it, so on three of four portals being bounced to
 *    sign in silently lost the page you were trying to reach.
 *  - Hospital and admin had no `email_not_verified` branch, so an unverified
 *    user saw a bare error with no way to request a fresh link, while donor and
 *    blood-centre offered one.
 *  - The hospital page sent `role: 'blood-center'`, which the server normalises
 *    to a role hospital users do not hold — a guaranteed 403. That is exactly
 *    the class of drift a shared flow prevents, and why the portal key below is
 *    a union rather than a free string.
 *
 * Portal-specific behaviour stays in PORTALS. Everything else is shared.
 */

/** Wire aliases the API accepts. Normalised server-side by `RoleName::normalize()`. */
export type PortalKey = 'donor' | 'blood-center' | 'hospital' | 'admin'

interface PortalConfig {
  /** Sent as `role`. The server checks it against the roles the user holds. */
  role: string
  title: string
  forgotPasswordPath: string
  /** Blood centres and hospitals are asked for their licence at sign-in. */
  requiresLicense?: boolean
  /**
   * Where to land when there is no `?redirect`. Async so a portal can inspect
   * the login response or load the profile first.
   */
  resolveHome: (response: any) => string | Promise<string>
}

const PORTALS: Record<PortalKey, PortalConfig> = {
  'donor': {
    role: 'donor',
    title: 'Sign In · RedAgos',
    forgotPasswordPath: '/auth/donor/forgot-password',
    resolveHome: () => '/donor/dashboard',
  },
  'blood-center': {
    role: 'blood-center',
    title: 'Blood Center Sign In · RedAgos',
    forgotPasswordPath: '/auth/blood-center/forgot-password',
    requiresLicense: true,
    resolveHome: async (response) => {
      // A centre still awaiting approval, or rejected, holds no role yet — it
      // can only see its own status page.
      const status = response?.user?.facility?.status
      if (status === 'pending_approval' || status === 'rejected') {
        return '/auth/blood-center/registration-status'
      }

      // Landing page depends on the staffer's department, so the profile has
      // to be loaded before we know where to send them.
      const { ensureUser } = useUser()
      return departmentHome(await ensureUser())
    },
  },
  'hospital': {
    // 'hospital' is the server's alias for blood_bank. Sending 'blood-center'
    // here — as this page used to — resolves to a different role and 403s.
    role: 'hospital',
    title: 'Hospital Sign In · RedAgos',
    forgotPasswordPath: '/auth/hospital/forgot-password',
    requiresLicense: true,
    resolveHome: () => '/hospital/dashboard',
  },
  'admin': {
    role: 'admin',
    title: 'Administrator Sign In · RedAgos',
    forgotPasswordPath: '/auth/admin/forgot-password',
    resolveHome: () => '/admin/registrations',
  },
}

/**
 * Pull the token out of a login response.
 *
 * The four shapes below were all being checked at every call site. Kept as-is
 * rather than narrowed, because the server's envelope is not typed yet and
 * guessing wrong here logs everybody out.
 */
function extractToken(response: any): string | null {
  return response?.token
    ?? response?.access_token
    ?? response?.data?.token
    ?? response?.data?.access_token
    ?? null
}

export function useAuthLogin(portalKey: PortalKey) {
  const portal = PORTALS[portalKey]
  const route = useRoute()

  useHead({ title: portal.title })

  const email = ref('')
  const password = ref('')
  const licenseNumber = ref('')
  const showPassword = ref(false)
  const loading = ref(false)
  const errorMessage = ref('')

  // Drives the floating-label state in the templates.
  const typed = reactive({ email: false, password: false, licenseNumber: false })

  watch(email, (v) => { typed.email = v.trim().length > 0 })
  watch(password, (v) => { typed.password = v.trim().length > 0 })
  watch(licenseNumber, (v) => { typed.licenseNumber = v.trim().length > 0 })

  // Sign-in is refused until the address is verified, so offer the resend
  // rather than leaving the user with nothing to do. Previously donor and
  // blood-centre only.
  const needsVerification = ref(false)
  const resending = ref(false)
  const resendMessage = ref('')
  const resendFailed = ref(false)

  function goToForgotPassword() {
    return navigateTo(portal.forgotPasswordPath)
  }

  async function resendVerification() {
    if (resending.value) return

    resending.value = true
    resendMessage.value = ''
    resendFailed.value = false

    try {
      const response = await authService.resendVerificationEmailFor(email.value)
      resendMessage.value = response?.message || 'Sent. Check your inbox for a fresh link.'
    } catch (error: any) {
      resendFailed.value = true
      resendMessage.value = error?.status === 429
        ? 'Too many requests. Please wait a few minutes before trying again.'
        : (error?.message || 'Could not send the verification email. Please try again.')
    } finally {
      resending.value = false
    }
  }

  /**
   * Where to go after a successful sign-in.
   *
   * `?redirect` wins when present — the `auth` middleware and the 401 handler
   * both set it, and honouring it is what makes "you were signed out, sign in
   * again" return the user to the page they lost.
   *
   * Only same-origin paths are accepted. An absolute URL in a query parameter
   * is an open-redirect, and login pages are where that gets phished.
   */
  function safeRedirect(): string | null {
    const raw = route.query.redirect

    if (typeof raw !== 'string' || !raw) return null
    if (!raw.startsWith('/') || raw.startsWith('//')) return null

    return raw
  }

  async function login() {
    loading.value = true
    errorMessage.value = ''
    needsVerification.value = false
    resendMessage.value = ''

    try {
      const response = await authService.login({
        email: email.value,
        password: password.value,
        role: portal.role,
        ...(portal.requiresLicense ? { licenseNumber: licenseNumber.value } : {}),
      } as any)

      const token = extractToken(response)
      if (token) {
        localStorage.setItem('_token', token)
      }

      await navigateTo(safeRedirect() ?? await portal.resolveHome(response))
    } catch (error: any) {
      needsVerification.value = error?.data?.code === 'email_not_verified'

      errorMessage.value = error instanceof Error
        ? error.message
        : 'Unable to sign in. Please check your credentials.'
    } finally {
      loading.value = false
    }
  }

  return {
    email,
    password,
    licenseNumber,
    showPassword,
    loading,
    errorMessage,
    typed,
    needsVerification,
    resending,
    resendMessage,
    resendFailed,
    login,
    resendVerification,
    goToForgotPassword,
    requiresLicense: portal.requiresLicense ?? false,
  }
}
