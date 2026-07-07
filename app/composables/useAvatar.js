export function useAvatar() {
  const uploading = ref(false)
  const error = ref(null)

  function validateFile(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    const maxSizeMB = 2

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Please upload a JPG, PNG, or WEBP image.')
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new Error(`Image must be smaller than ${maxSizeMB}MB.`)
    }
  }

  async function uploadAvatar(file) {
    error.value = null

    try {
      validateFile(file)
    } catch (err) {
      error.value = err.message
      throw err
    }

    uploading.value = true

    const formData = new FormData()
    formData.append('avatar', file)

    try {
      // Backend contract:
      // POST /api/profile/avatar
      // multipart/form-data, field name: "avatar"
      // Response: { avatar_url: string }
      const res = await $fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      })
      return res.avatar_url
    } catch (err) {
      error.value = err?.data?.message || 'Upload failed. Please try again.'
      throw err
    } finally {
      uploading.value = false
    }
  }

  return { uploadAvatar, uploading, error }
}