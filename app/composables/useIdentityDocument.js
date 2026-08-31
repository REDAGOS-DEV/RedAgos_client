import { donorService } from '~/api/donor/DonorService'

/**
 * Ang valid ID kay dili sama sa avatar: authenticated ang route nga nag-serve
 * niya, so dili siya mahimong <img src="...">. Kinahanglan i-fetch nato siya
 * dala ang token, unya himoon nga object URL.
 */
export function useIdentityDocument() {
  const submitting = ref(false)
  const error = ref(null)

  const loadingImage = ref(false)
  const imageUrl = ref(null)

  // Gi-track para ma-revoke: ang object URL kay magpabilin sa memory hangtod
  // dili siya i-revoke, ug litrato ni sa government ID.
  let objectUrl = null

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const MAX_SIZE_MB = 4

  function validateFile(file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Please upload a JPG, PNG, or WEBP image.')
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      throw new Error(`Your ID photo must be smaller than ${MAX_SIZE_MB}MB.`)
    }
  }

  function releaseImage() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = null
    }
    imageUrl.value = null
  }

  /**
   * Submit the ID type, number and photo together.
   */
  async function submitIdentity({ validIdType, validIdNumber, file }) {
    error.value = null

    try {
      validateFile(file)
    } catch (err) {
      error.value = err.message
      throw err
    }

    submitting.value = true

    const formData = new FormData()
    formData.append('valid_id_type', validIdType)
    formData.append('valid_id_number', validIdNumber)
    formData.append('valid_id_image', file)

    try {
      // POST /api/donors/identity — multipart. Ang response kay ang bag-o nga
      // profile payload, apil na ang identity block.
      return await donorService.submitIdentity(formData)
    } catch (err) {
      error.value = err?.errors
        ? Object.values(err.errors)[0]?.[0] || err.message
        : (err?.message || 'Could not submit your ID. Please try again.')
      throw err
    } finally {
      submitting.value = false
    }
  }

  /**
   * Load the stored document for a donor uuid into a renderable object URL.
   */
  async function loadImage(uuid) {
    if (!uuid) return null

    releaseImage()
    loadingImage.value = true

    try {
      const blob = await donorService.identityImage(uuid)
      objectUrl = URL.createObjectURL(blob)
      imageUrl.value = objectUrl
      return objectUrl
    } catch (err) {
      error.value = err?.message || 'Could not load the ID photo.'
      return null
    } finally {
      loadingImage.value = false
    }
  }

  onUnmounted(releaseImage)

  return {
    submitIdentity,
    submitting,
    error,
    loadImage,
    loadingImage,
    imageUrl,
    releaseImage,
    idTypeOptions: [
      { value: 'philsys', label: 'PhilSys (National ID)' },
      { value: 'umid', label: 'UMID' },
      { value: 'drivers_license', label: "Driver's License" },
      { value: 'passport', label: 'Passport' },
      { value: 'postal_id', label: 'Postal ID' },
      { value: 'prc_id', label: 'PRC ID' },
      { value: 'voters_id', label: "Voter's ID" },
      { value: 'sss_id', label: 'SSS ID' },
    ],
  }
}
