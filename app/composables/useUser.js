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
      const donorProfile = res.donor_profile || res.donorProfile
      const bloodType = donorProfile?.blood_type?.code || donorProfile?.bloodType?.code

      user.value = {
        id: res.id,
        full_name: `${res.first_name} ${res.last_name}`.trim(),
        first_name: res.first_name,
        last_name: res.last_name,
        email: res.email,
        phone: res.phone,
        username: res.username,
        blood_type: bloodType,
        account_status: res.account_status,
        roles: Array.isArray(res.roles) ? res.roles.map((role) => role.name || role) : [],
        // avatar: res.avatar_url, // i-uncomment rani if naa nay 'avatar_url' column sa backend
        // role: res.role, //i-uncomment rani if naa nay 'role' column sa backend
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

  return { user, loading, fetchUser, updateAvatar, clearUser }
}
