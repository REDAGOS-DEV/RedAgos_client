import { donorService } from '~/api/donor/DonorService'

/**
 * Ang mga ID nga naay kinahanglanon sa luyo nga bahin.
 *
 * Only the IDs whose back face carries something a reviewer needs: the PhilSys
 * QR and address, the UMID's signature panel, and the restriction codes on a
 * driver's licence. The rest are readable from one side, and asking for a
 * second photo of a blank back is a step people abandon the flow at.
 */
const TWO_SIDED_ID_TYPES = ['philsys', 'umid', 'drivers_license']

/**
 * Which faces of a given ID type need photographing.
 *
 * Drives the camera flow only. The upload itself is unchanged: one image per
 * submission, whichever route produced it.
 */
export function idSidesFor(validIdType) {
  if (TWO_SIDED_ID_TYPES.includes(validIdType)) {
    return [
      { key: 'front', label: 'Front' },
      { key: 'back', label: 'Back' },
    ]
  }

  return [{ key: 'front', label: 'Front' }]
}

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

  /**
   * Gi-export na pud ni para magamit sa camera nga dalan.
   *
   * The camera produces a File the same way the file picker does, so it has to
   * clear the same bar before it is offered for submission. Two copies of these
   * rules would drift, and the copy that drifts is the one that lets an upload
   * through that the server then rejects.
   */
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
    validateFile,
    idSidesFor,
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
