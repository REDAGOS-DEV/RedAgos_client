import type { MaybeRefOrGetter } from 'vue'
import { authService } from '~/api/auth/AuthService'
import type { AppUser } from '~/types/user'
import { portalHomeFor } from '~/utils/authRoutes'

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

/**
 * Wire aliases the API accepts. Normalised server-side by `RoleName::normalize()`.
 *
 * `user` is the one sign-in screen (project owner, 2026-10-24): it names no
 * role, and the server admits a donor, blood-center staff or a hospital blood
 * bank by the roles on the account (AuthService::guardUnifiedSignIn).
 */
export type PortalKey = 'user' | 'donor' | 'blood-center' | 'hospital' | 'admin'

interface PortalConfig {
  /** Sent as `role`. The server checks it against the roles the user holds. None for the one sign-in screen. */
  role: string | null
  title: string
  forgotPasswordPath: string
  /**
   * Where to land when there is no `?redirect`. Async so a portal can inspect
   * the login response or load the profile first.
   */
  resolveHome: (response: any) => string | Promise<string>
}

const PORTALS: Record<PortalKey, PortalConfig> = {
  'user': {
    role: null,
    title: 'RedAgos',
    // A reset is by address, whatever the portal: any forgot-password page will do.
    forgotPasswordPath: '/auth/donor/forgot-password',
    resolveHome: async (response) => {
      // Each to their own portal, by the roles the account holds. A blood
      // centre's landing page depends on the department, so its profile is
      // loaded first.
      const signedIn = response?.user ?? response?.data?.user
      if (signedIn?.roles?.includes('blood_center')) {
        const { ensureUser } = useUser()
        return departmentHome(await ensureUser())
      }
      return portalHomeFor(signedIn)
    },
  },
  'donor': {
    role: 'donor',
    title: 'RedAgos',
    forgotPasswordPath: '/auth/donor/forgot-password',
    resolveHome: () => '/donor/dashboard',
  },
  'blood-center': {
    role: 'blood-center',
    title: 'RedAgos',
    forgotPasswordPath: '/auth/blood-center/forgot-password',
    resolveHome: async () => {
      // No status branch here any more. A centre is created active by a Super
      // Admin, and the handful of legacy accounts whose facility never was are
      // refused at the API with `facility_not_activated` — they never reach
      // this point, so there is no unapproved state to route around.
      //
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
    title: 'RedAgos',
    forgotPasswordPath: '/auth/hospital/forgot-password',
    resolveHome: () => '/hospital/dashboard',
  },
  'admin': {
    role: 'admin',
    title: 'RedAgos',
    forgotPasswordPath: '/auth/admin/forgot-password',
    resolveHome: () => '/admin/facilities',
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

export function useAuthLogin(portalKey: MaybeRefOrGetter<PortalKey>) {
  // Follows the key, so one screen can switch between User and Admin.
  const config = computed(() => PORTALS[toValue(portalKey)])
  const route = useRoute()
  const workspace = useWorkspaceLaunch()

  useHead({ title: () => config.value.title })

  const email = ref('')
  const password = ref('')
  const showPassword = ref(false)
  const loading = ref(false)
  const errorMessage = ref('')

  // Drives the floating-label state in the templates.
  const typed = reactive({ email: false, password: false })

  watch(email, (v) => { typed.email = v.trim().length > 0 })
  watch(password, (v) => { typed.password = v.trim().length > 0 })

  // Sign-in is refused until the address is verified, so offer the resend
  // rather than leaving the user with nothing to do. Previously donor and
  // blood-centre only.
  const needsVerification = ref(false)
  const resending = ref(false)
  const resendMessage = ref('')
  const resendFailed = ref(false)
  // True once a fresh link has gone out, so the alert can switch from
  // "something is wrong" to "check your inbox".
  const resendSent = ref(false)
  // The address sign-in was refused for. Captured at failure time so the
  // alert names the right inbox even if the field is edited afterwards.
  const verificationEmail = ref('')
  // Seconds before the resend button unlocks again. The endpoint allows
  // three sends per ten minutes; without this a few clicks hit the 429.
  const resendCooldown = ref(0)
  let cooldownTimer: ReturnType<typeof setInterval> | null = null

  function startCooldown(seconds: number) {
    if (cooldownTimer) clearInterval(cooldownTimer)
    resendCooldown.value = seconds
    cooldownTimer = setInterval(() => {
      resendCooldown.value -= 1
      if (resendCooldown.value <= 0 && cooldownTimer) {
        clearInterval(cooldownTimer)
        cooldownTimer = null
      }
    }, 1000)
  }

  onScopeDispose(() => {
    if (cooldownTimer) clearInterval(cooldownTimer)
  })

  function goToForgotPassword() {
    return navigateTo(config.value.forgotPasswordPath)
  }

  /** Clears a refusal, e.g. when the screen switches between User and Admin. */
  function clearError() {
    errorMessage.value = ''
    needsVerification.value = false
    resendMessage.value = ''
    resendFailed.value = false
    resendSent.value = false
  }

  async function resendVerification() {
    if (resending.value || resendCooldown.value > 0) return

    resending.value = true
    resendMessage.value = ''
    resendFailed.value = false

    try {
      const response = await authService.resendVerificationEmailFor(verificationEmail.value || email.value)
      resendMessage.value = response?.message || 'Sent. Check your inbox for a fresh link.'
      resendSent.value = true
      startCooldown(60)
    } catch (error: any) {
      resendFailed.value = true
      resendMessage.value = error?.status === 429
        ? 'Too many requests. Please wait a few minutes before trying again.'
        : (error?.message || 'Could not send the verification email. Please try again.')
      if (error?.status === 429) startCooldown(120)
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
    // `login`, not `email`: the server matches an email address, a donor
    // code (from the blood center desk's sign-in) or a username.
    const portal = config.value
    await signIn(() => authService.login({
      login: email.value,
      password: password.value,
      ...(portal.role ? { role: portal.role } : {}),
    } as any))
  }

  /** Sign in with Google (2026-10-30): the credential Google's button handed over. */
  async function loginWithGoogle(credential: string) {
    await signIn(() => authService.loginWithGoogle(credential), { google: true })
  }

  /** One sign-in, by password or by Google: keep the token, then go home. */
  async function signIn(request: () => Promise<any>, { google = false } = {}) {
    const portal = config.value
    loading.value = true
    errorMessage.value = ''
    needsVerification.value = false
    resendMessage.value = ''
    resendFailed.value = false
    resendSent.value = false

    try {
      const response = await request()

      const token = extractToken(response)
      if (token) {
        localStorage.setItem('_token', token)
      }

      // The desk's temporary password: nothing opens until the donor sets
      // their own, so `?redirect` waits too.
      const signedIn = response?.user ?? response?.data?.user
      if (signedIn?.temporary_sign_in) {
        await navigateTo('/auth/set-password')
        return
      }

      // Signed in: "Launching Workspace" covers loading the profile, the
      // portal and its first data, and fades out once that is done.
      workspace.begin()
      await navigateTo(safeRedirect() ?? await portal.resolveHome(response))
      workspace.settle()
    } catch (error: any) {
      workspace.cancel()
      needsVerification.value = !google && error?.data?.code === 'email_not_verified'
      if (needsVerification.value) verificationEmail.value = email.value.trim()

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
    showPassword,
    loading,
    errorMessage,
    typed,
    needsVerification,
    resending,
    resendMessage,
    resendFailed,
    resendSent,
    resendCooldown,
    verificationEmail,
    login,
    loginWithGoogle,
    resendVerification,
    goToForgotPassword,
    clearError,
  }
}
