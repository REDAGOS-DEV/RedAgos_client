export function useUser() {
  const user = useState('app-user', () => null)
  const loading = useState('app-user-loading', () => true)

  async function fetchUser() {
    loading.value = true
    try {
      // Backend contract:
      // GET /api/auth/me
      // Response: { id, full_name, email, avatar_url, ... }
      const res = await $fetch('/api/auth/me')

      user.value = {
        id: res.id,
        full_name: res.full_name,
        email: res.email,
        avatar: res.avatar_url,
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