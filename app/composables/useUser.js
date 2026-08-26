import { authService } from '~/api/auth/AuthService'

// Client-only, kay ang ensureUser() mo-bail dayon sa server. Gi-butang sa gawas
// sa composable aron usa ra ka request bisan pila ka caller ang mo-dungan.
let inFlight = null

export function useUser() {
  const user = useState('app-user', () => null)
  const loading = useState('app-user-loading', () => true)

  async function fetchUser() {
    loading.value = true
    try {
      const runtimeConfig = useRuntimeConfig()
      const token = import.meta.client ? localStorage.getItem('_token') : null
      const res = await $fetch('/user', {
        baseURL: runtimeConfig.public.apiBaseURL,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      // Ang /user kay mo-return og UserResource, ug gi-wrap sa Laravel ang
      // JsonResource sulod sa "data" key. Ang `?? res` kay safety net lang kung
      // mo-withoutWrapping ta puhon.
      const payload = res?.data ?? res

      user.value = {
        uuid: payload.uuid,
        // Naa nay full_name ang resource. Ang fallback kay gi-filter aron dili
        // mo-produce og "undefined undefined" kung wala ang name parts.
        full_name: payload.full_name || [payload.first_name, payload.last_name].filter(Boolean).join(' '),
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        phone: payload.phone,
        username: payload.username,
        blood_type: payload.blood_type ?? null,
        account_status: payload.account_status,
        roles: Array.isArray(payload.roles) ? payload.roles.map((role) => role?.name ?? role) : [],
        // Ang facility kay gi-eager-load na sa /user, so ang portal header
        // makakuha na sa ngalan sa center.
        facility: payload.facility ?? null,
        // Blood center department + permissions. Ang server gihapon ang tinuod
        // nga gate — presentation ra ni.
        department: payload.department ?? null,
        department_label: payload.department_label ?? null,
        is_supervisor: Boolean(payload.is_supervisor),
        permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
        // avatar: payload.avatar_url, // i-uncomment rani if naa nay 'avatar_url' column sa backend
      }

    } catch (err) {
      console.error('Failed to load user:', err)
      user.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Kuhaon ang user kung wala pa, kung naa na i-reuse. Gamiton ni sa route
   * middleware nga kinahanglan sa permissions sa dili pa mo-render ang page.
   *
   * Ang in-flight promise gi-share aron ang duha ka middleware nga mo-dungan
   * dili mo-fire og duha ka request.
   */
  async function ensureUser() {
    if (user.value) return user.value
    if (!import.meta.client) return null

    if (!inFlight) {
      inFlight = fetchUser().finally(() => { inFlight = null })
    }

    await inFlight

    return user.value
  }

  /**
   * Naa bay ability ang user karon.
   *
   * Fail-closed: kung wala pa ma-load ang user o walay permissions, `false`
   * ang balik. Ang mga item nga walay gikinahanglan nga ability kay dayag ra.
   */
  function can(ability) {
    if (!ability) return true

    return user.value?.permissions?.includes(ability) ?? false
  }

  function updateAvatar(newUrl) {
    if (user.value) {
      user.value = { ...user.value, avatar: newUrl }
    }
  }

  function clearUser() {
    user.value = null
  }

    /**
   * Usa ra ka lugar ang logout para sa tanan nga role. Tulo ka lakang, ug
   * kinahanglan matuman ang duha nga lokal bisan mapakyas ang server call.
   */
  async function logout(redirectTo = '/auth/role-selection') {
    try {
      // POST /api/logout — i-revoke ang Sanctum token sa server. Kung
      // localStorage ra ang i-clear, buhi gihapon ang token hangtod ma-expire.
      await authService.logout()
    } catch (err) {
      // Bisan mapakyas ang revoke, i-clear gihapon ang local session.
      console.error('Failed to revoke session on the server:', err)
    } finally {
      if (import.meta.client) {
        localStorage.removeItem('_token')
        inFlight = null
        clearUser()
        window.location.replace(redirectTo)
      }
    }
  }

  return { user, loading, fetchUser, ensureUser, updateAvatar, clearUser, logout, can }

}
