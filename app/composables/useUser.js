import { authService } from '~/api/auth/AuthService'

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
        // avatar: payload.avatar_url, // i-uncomment rani if naa nay 'avatar_url' column sa backend
      }

    } catch (err) {
      console.error('Failed to load user:', err)
      user.value = null
    } finally {
      loading.value = false
    }
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
        clearUser()
        window.location.replace(redirectTo)
      }
    }
  }

  return { user, loading, fetchUser, updateAvatar, clearUser, logout }
  
}
