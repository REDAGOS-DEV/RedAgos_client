export function useUser() {
  const user = useState('app-user', () => null)
  const loading = useState('app-user-loading', () => true)

  async function fetchUser() {
    loading.value = true
    try {
      const res = await $fetch('/user')

      user.value = {
        id: res.id,
        full_name: `${res.first_name} ${res.last_name}`.trim(),
        email: res.email,
        username: res.username,
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
