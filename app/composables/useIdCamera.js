import {
  analyseScene,
  assessCapture,
  createStabilityTracker,
  evaluateScan,
  GUIDANCE_MESSAGES,
  laplacianVariance,
  toGray,
} from '~/utils/idDocumentScanner'

/**
 * Ang guided camera para sa Valid ID.
 *
 * Kini ra ang nag-atiman sa camera: pag-abli sa stream, pag-analisa sa matag
 * frame, ug paghimo sa final nga litrato. Ang pagpadala sa server kay naa gihapon
 * sa useIdentityDocument — walay bag-ong upload path dinhi.
 *
 * The decisions this file makes, and why:
 *
 *  - Analysis runs on a crop around the guide rather than the whole frame, so
 *    the card occupies most of the pixels we spend time on.
 *  - Sharpness is measured on a 1:1 crop, never the downscale, because
 *    downscaling is a low-pass filter and would make every frame look sharp.
 *  - Auto-capture needs the frame to stay good for a beat rather than firing on
 *    the first passing frame: one good frame in a shaky hand is luck, not focus.
 */

/** ~12 fps. Fast enough to feel live, slow enough not to cook a phone battery. */
const ANALYSIS_INTERVAL_MS = 80

/** How long every condition has to hold before the shutter fires. */
const READY_HOLD_MS = 1100

/** Frames a new complaint must persist before it replaces the one on screen. */
const MESSAGE_STICKINESS = 3

/** After this long without a capture, offer the manual shutter more loudly. */
const STRUGGLE_AFTER_MS = 12000

/** Long edge of the stored photo. Enough to read an ID number, small enough to send. */
const MAX_OUTPUT_EDGE = 1600

/**
 * Kept under the 4 MB the server accepts, with room for the multipart envelope.
 * Matches StoreDonorIdentityRequest's max:4096.
 */
const MAX_OUTPUT_BYTES = 3.4 * 1024 * 1024

/** A detection older than this is not trusted to frame the crop. */
const BOX_FRESHNESS_MS = 400

/**
 * Only touch width/height when they actually change.
 *
 * Assigning either one re-allocates the backing store even when the value is
 * identical, and this runs a dozen times a second for the life of the scanner.
 */
function resize(canvas, width, height) {
  if (canvas.width === width && canvas.height === height) return

  canvas.width = width
  canvas.height = height
}

function padRect(rect, fraction, bounds) {
  const dx = rect.width * fraction
  const dy = rect.height * fraction

  const left = Math.max(0, rect.left - dx)
  const top = Math.max(0, rect.top - dy)
  const right = Math.min(bounds.width, rect.left + rect.width + dx)
  const bottom = Math.min(bounds.height, rect.top + rect.height + dy)

  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
}

/**
 * Say what went wrong in terms of what the donor can do about it.
 *
 * getUserMedia's own errors name internal constraint objects, which is useless
 * to somebody holding a phone. Every branch here ends with an action, and the
 * caller always leaves Attach File reachable behind the message.
 */
function describeCameraError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera access was blocked. Allow the camera in your browser settings, or attach a file instead.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device. You can attach a photo of your ID instead.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Another app is using the camera. Close it and try again, or attach a file instead.'
    case 'SecurityError':
      return 'Your browser will only open the camera over a secure (https) connection.'
    default:
      return err?.message || 'The camera could not be opened. You can attach a photo of your ID instead.'
  }
}

export function useIdCamera({ videoRef, guideRef, onAutoCapture } = {}) {
  const active = ref(false)
  const starting = ref(false)
  const error = ref(null)

  const guidance = ref({ code: 'no_document', message: GUIDANCE_MESSAGES.no_document, ready: false })
  const holdProgress = ref(0)
  const autoCapture = ref(true)
  const struggling = ref(false)

  // Review holds the stream open but stops the analysis: tearing the camera
  // down and back up between sides costs a visible black flash and a second of
  // autofocus on every retake, which reads as the app breaking.
  const suspended = ref(false)

  let stream = null
  let rafId = null
  let lastAnalysisAt = 0
  let readySince = null
  let openedAt = 0

  let pendingCode = null
  let pendingCount = 0

  // Last detection, in *video* pixels, so a capture can crop to the card the
  // donor was actually shown rather than re-detecting on a different image.
  let lastBox = null
  let lastBoxAt = 0

  const tracker = createStabilityTracker()

  let sceneCanvas = null
  let sceneCtx = null
  let detailCanvas = null
  let detailCtx = null

  function canvasPair() {
    if (!sceneCanvas) {
      sceneCanvas = document.createElement('canvas')
      // willReadFrequently: every frame is read back with getImageData, which
      // is the one case where the GPU-backed default is the slow path.
      sceneCtx = sceneCanvas.getContext('2d', { willReadFrequently: true })
      detailCanvas = document.createElement('canvas')
      detailCtx = detailCanvas.getContext('2d', { willReadFrequently: true })
    }

    return { sceneCtx, detailCtx }
  }

  function isSupported() {
    return Boolean(
      import.meta.client
      && navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === 'function'
    )
  }

  /**
   * Where the on-screen guide falls in the camera's own pixels.
   *
   * The preview is `object-fit: cover`, so what the donor sees is a centre crop
   * of the frame we analyse. Measuring the guide element against the video
   * element and undoing that crop is what keeps the rectangle we test and the
   * rectangle they aim at the same rectangle.
   */
  function guideInVideoCoords() {
    const video = videoRef?.value
    const guideEl = guideRef?.value

    if (!video || !guideEl || !video.videoWidth || !video.videoHeight) return null

    const videoRect = video.getBoundingClientRect()
    const guideRect = guideEl.getBoundingClientRect()

    if (!videoRect.width || !videoRect.height) return null

    const scale = Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight)
    const offsetX = (videoRect.width - video.videoWidth * scale) / 2
    const offsetY = (videoRect.height - video.videoHeight * scale) / 2

    return {
      left: (guideRect.left - videoRect.left - offsetX) / scale,
      top: (guideRect.top - videoRect.top - offsetY) / scale,
      width: guideRect.width / scale,
      height: guideRect.height / scale,
    }
  }

  function measureSharpness(video, guide) {
    const { detailCtx: ctx } = canvasPair()

    const width = Math.max(32, Math.min(400, Math.round(guide.width * 0.6)))
    const height = Math.max(32, Math.min(260, Math.round(guide.height * 0.6)))
    const sx = Math.max(0, Math.min(video.videoWidth - width, guide.left + (guide.width - width) / 2))
    const sy = Math.max(0, Math.min(video.videoHeight - height, guide.top + (guide.height - height) / 2))

    resize(detailCanvas, width, height)
    ctx.drawImage(video, sx, sy, width, height, 0, 0, width, height)

    return laplacianVariance(toGray(ctx.getImageData(0, 0, width, height)))
  }

  /**
   * Hold a complaint on screen for a few frames before swapping it.
   *
   * Detection flickers at the margins, and a caption that changes five times a
   * second is noise rather than guidance. Leaving "ready" is the exception:
   * that one has to be instant, because the ring next to it is filling towards
   * a shutter that has already stopped being justified.
   */
  function applyGuidance(next) {
    if (next.code === guidance.value.code) {
      pendingCode = null
      pendingCount = 0
      return
    }

    if (guidance.value.code === 'ready' && !next.ready) {
      guidance.value = next
      pendingCode = null
      pendingCount = 0
      return
    }

    if (next.code === pendingCode) {
      pendingCount += 1
    } else {
      pendingCode = next.code
      pendingCount = 1
    }

    if (pendingCount >= MESSAGE_STICKINESS || next.ready) {
      guidance.value = next
      pendingCode = null
      pendingCount = 0
    }
  }

  function analyse(now) {
    const video = videoRef?.value

    if (!video || video.readyState < 2 || !video.videoWidth) return

    const guide = guideInVideoCoords()

    if (!guide || guide.width < 40 || guide.height < 24) return

    const bounds = { width: video.videoWidth, height: video.videoHeight }
    const search = padRect(guide, 0.2, bounds)
    const { sceneCtx: ctx } = canvasPair()

    const width = 288
    const height = Math.max(32, Math.round(width * (search.height / search.width)))

    resize(sceneCanvas, width, height)
    ctx.drawImage(video, search.left, search.top, search.width, search.height, 0, 0, width, height)

    const frame = toGray(ctx.getImageData(0, 0, width, height))
    const k = width / search.width

    const scene = analyseScene(frame, {
      left: (guide.left - search.left) * k,
      top: (guide.top - search.top) * k,
      width: guide.width * k,
      height: guide.height * k,
    })

    if (scene.box) {
      lastBox = {
        left: search.left + scene.box.left / k,
        top: search.top + scene.box.top / k,
        width: scene.box.width / k,
        height: scene.box.height / k,
      }
      lastBoxAt = now
    }

    tracker.push(scene.box)

    const sample = {
      ...scene,
      sharpness: measureSharpness(video, guide),
      motion: tracker.motion(),
    }

    const next = evaluateScan(sample)
    applyGuidance(next)

    if (next.ready) {
      if (readySince === null) readySince = now
      holdProgress.value = Math.min(1, (now - readySince) / READY_HOLD_MS)

      if (holdProgress.value >= 1 && autoCapture.value) {
        readySince = null
        holdProgress.value = 0
        onAutoCapture?.()
      }
    } else {
      readySince = null
      holdProgress.value = 0
    }

    if (!struggling.value && now - openedAt > STRUGGLE_AFTER_MS) {
      struggling.value = true
    }
  }

  function suspend() {
    suspended.value = true
    holdProgress.value = 0
    readySince = null
  }

  function resume() {
    suspended.value = false
    resetGuidance()
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop)

    if (suspended.value) return
    if (now - lastAnalysisAt < ANALYSIS_INTERVAL_MS) return

    lastAnalysisAt = now

    try {
      analyse(now)
    } catch {
      // A single unreadable frame (a resize mid-draw, a track that just ended)
      // must not kill the loop; the next frame is 80ms away.
    }
  }

  async function start() {
    error.value = null

    if (!isSupported()) {
      error.value = window.isSecureContext === false
        ? 'Your browser will only open the camera over a secure (https) connection. You can attach a photo of your ID instead.'
        : 'This browser cannot open the camera. You can attach a photo of your ID instead.'
      return false
    }

    starting.value = true

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // `ideal` rather than `exact`: a laptop with only a front camera should
        // still get a working scanner rather than an OverconstrainedError.
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      const video = videoRef?.value

      if (!video) throw new Error('The camera preview is not ready.')

      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      await video.play()

      if (!video.videoWidth) {
        await new Promise((resolve) => {
          video.addEventListener('loadedmetadata', resolve, { once: true })
        })
      }

      active.value = true
      openedAt = performance.now()
      struggling.value = false
      resetGuidance()
      rafId = requestAnimationFrame(loop)

      return true
    } catch (err) {
      error.value = describeCameraError(err)
      stop()

      return false
    } finally {
      starting.value = false
    }
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
    }

    const video = videoRef?.value

    if (video) video.srcObject = null

    active.value = false
    holdProgress.value = 0
    readySince = null
  }

  function resetGuidance() {
    tracker.reset()
    lastBox = null
    lastBoxAt = 0
    readySince = null
    holdProgress.value = 0
    pendingCode = null
    pendingCount = 0
    guidance.value = { code: 'no_document', message: GUIDANCE_MESSAGES.no_document, ready: false }
  }

  /**
   * Freeze the current frame and judge it.
   *
   * Cropping to the detected card is what makes a captured ID look scanned
   * rather than photographed. When nothing was detected — which is the manual
   * shutter's whole reason for existing — the full frame is kept instead:
   * guessing a crop is the one failure here that destroys information the
   * donor cannot get back without retaking the photo.
   */
  async function capture() {
    const video = videoRef?.value

    if (!video || !video.videoWidth) throw new Error('The camera is not ready yet.')

    const bounds = { width: video.videoWidth, height: video.videoHeight }
    const fresh = lastBox && performance.now() - lastBoxAt < BOX_FRESHNESS_MS
    const detected = Boolean(fresh)
    const source = fresh ? padRect(lastBox, 0.06, bounds) : { left: 0, top: 0, ...bounds }

    const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(source.width, source.height))
    const width = Math.max(1, Math.round(source.width * scale))
    const height = Math.max(1, Math.round(source.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, source.left, source.top, source.width, source.height, 0, 0, width, height)

    const verdict = assessCapture({ ...measureCapture(canvas), detected })
    const blob = await encodeUnderLimit(canvas)

    return { blob, verdict, width, height, url: URL.createObjectURL(blob) }
  }

  return {
    active,
    starting,
    error,
    guidance,
    holdProgress,
    autoCapture,
    struggling,
    suspended,
    isSupported,
    start,
    stop,
    suspend,
    resume,
    capture,
    resetGuidance,
  }
}

/**
 * Re-measure brightness, glare and focus on the still that was actually taken.
 *
 * Brightness and glare come off a downscale because they are averages and a
 * downscale preserves averages. Focus comes off a native-resolution centre
 * crop for exactly the opposite reason.
 */
function measureCapture(canvas) {
  const sampleWidth = Math.min(400, canvas.width)
  const sampleHeight = Math.max(1, Math.round(canvas.height * (sampleWidth / canvas.width)))

  const small = document.createElement('canvas')
  small.width = sampleWidth
  small.height = sampleHeight

  const smallCtx = small.getContext('2d', { willReadFrequently: true })
  smallCtx.drawImage(canvas, 0, 0, sampleWidth, sampleHeight)

  const grayscale = toGray(smallCtx.getImageData(0, 0, sampleWidth, sampleHeight))

  let sum = 0
  let clipped = 0

  for (let i = 0; i < grayscale.data.length; i++) {
    sum += grayscale.data[i]
    if (grayscale.data[i] >= 247) clipped++
  }

  const detailWidth = Math.min(400, canvas.width)
  const detailHeight = Math.min(260, canvas.height)

  const detail = document.createElement('canvas')
  detail.width = detailWidth
  detail.height = detailHeight

  const detailCtx = detail.getContext('2d', { willReadFrequently: true })
  detailCtx.drawImage(
    canvas,
    Math.round((canvas.width - detailWidth) / 2),
    Math.round((canvas.height - detailHeight) / 2),
    detailWidth,
    detailHeight,
    0,
    0,
    detailWidth,
    detailHeight
  )

  return {
    brightness: sum / grayscale.data.length,
    glare: clipped / grayscale.data.length,
    sharpness: laplacianVariance(toGray(detailCtx.getImageData(0, 0, detailWidth, detailHeight))),
  }
}

function encode(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Encode to JPEG, stepping quality down until it fits what the server accepts.
 *
 * A capture the donor cannot upload is worse than a slightly softer one, and
 * the size the server rejects is fixed while the quality is not.
 */
async function encodeUnderLimit(canvas) {
  let last = null

  for (const quality of [0.92, 0.85, 0.78, 0.7]) {
    const blob = await encode(canvas, quality)

    if (!blob) continue
    if (blob.size <= MAX_OUTPUT_BYTES) return blob

    last = blob
  }

  if (last) return last

  throw new Error('The photo could not be saved. Please try again.')
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The captured photo could not be read.'))
    image.src = url
  })
}

/**
 * Package the captured sides into the single image the existing flow uploads.
 *
 * `donor_profiles.valid_id_image_path` is one column, and the review queue, the
 * streaming endpoint and its audit trail are all built around one document per
 * submission. Stacking front over back keeps every one of those untouched and
 * still gives the reviewer both faces; a second column would have meant a
 * migration, a second upload, a second authorisation path and a second thing to
 * get wrong about storing government IDs.
 *
 * A one-sided ID is returned as-is — no canvas, no re-encode, no quality lost
 * to a composite that would only ever hold one image.
 */
export async function buildIdImageFile(sides, { fileName = 'valid-id.jpg' } = {}) {
  if (sides.length === 0) throw new Error('No photo was captured.')

  if (sides.length === 1) {
    return new File([sides[0].blob], fileName, { type: 'image/jpeg' })
  }

  const images = await Promise.all(sides.map((side) => loadImage(side.url)))

  const gutter = 14
  const caption = 30
  const width = Math.min(MAX_OUTPUT_EDGE, Math.max(...images.map((image) => image.width)))

  const scaled = images.map((image) => ({
    image,
    height: Math.round(image.height * (width / image.width)),
  }))

  const canvas = document.createElement('canvas')
  canvas.width = width + gutter * 2
  canvas.height = gutter + scaled.reduce((total, entry) => total + caption + entry.height + gutter, 0)

  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  let y = gutter

  scaled.forEach((entry, index) => {
    // The label sits in the margin, never over the document: a reviewer has to
    // be able to tell our annotation from the card itself at a glance.
    ctx.fillStyle = '#475569'
    ctx.font = '600 17px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText((sides[index].label || `Side ${index + 1}`).toUpperCase(), gutter, y + caption / 2)

    y += caption
    ctx.drawImage(entry.image, gutter, y, width, entry.height)
    y += entry.height + gutter
  })

  const blob = await encodeUnderLimit(canvas)

  return new File([blob], fileName, { type: 'image/jpeg' })
}
