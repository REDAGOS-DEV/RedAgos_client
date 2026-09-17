<template>
  <div class="qr-scanner">
    <div class="qr-scanner__stage">
      <video
        ref="videoRef"
        class="qr-scanner__video"
        :class="{ 'qr-scanner__video--live': active }"
        muted
        playsinline
      />

      <div v-if="active" class="qr-scanner__reticle" aria-hidden="true">
        <span class="qr-scanner__corner qr-scanner__corner--tl" />
        <span class="qr-scanner__corner qr-scanner__corner--tr" />
        <span class="qr-scanner__corner qr-scanner__corner--bl" />
        <span class="qr-scanner__corner qr-scanner__corner--br" />
      </div>

      <div v-if="!active" class="qr-scanner__placeholder">
        <AssetIcon name="qr-code" :size="34" />
        <p>{{ placeholderMessage }}</p>
      </div>
    </div>

    <p class="qr-scanner__status" :class="{ 'qr-scanner__status--error': Boolean(error) }" role="status">
      {{ error || statusMessage }}
    </p>

    <div class="qr-scanner__actions">
      <button
        v-if="!active"
        type="button"
        class="qr-btn qr-btn--primary"
        :disabled="starting || !supported"
        @click="start"
      >
        {{ starting ? 'Opening camera…' : 'Scan donor QR' }}
      </button>
      <button v-else type="button" class="qr-btn" @click="stop">Stop camera</button>

      <button type="button" class="qr-btn" @click="$emit('manual')">
        Look up by valid ID
      </button>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { createQrDecoder, isQrDecodingSupported, QR_UNSUPPORTED_MESSAGE } from '~/utils/qrDecoder'

/**
 * The counter's QR scanner.
 *
 * Its whole job is to turn a camera frame into one opaque token string and
 * hand it up. It does not verify anything — the server does that, because the
 * token means nothing without the facility the scanning staff member belongs
 * to. Deliberately the same shape as IdCameraCapture: the scanner's job ends
 * at producing a value.
 */

const emit = defineEmits(['scanned', 'manual'])

const props = defineProps({
  // Held open while the parent is mid-request, so one code is not submitted
  // twice by the frames that arrive before the response does.
  busy: { type: Boolean, default: false },
})

// How often to run a decode. Every animation frame is wasteful: a QR in view
// is readable for far longer than 16ms, and BarcodeDetector is not free.
const DECODE_INTERVAL_MS = 220

// A donor holding still produces the same token on many consecutive frames.
// Re-emitting it would re-POST the check-in, so the same value is ignored
// until the parent takes the scanner down or a different code appears.
const videoRef = ref(null)
const active = ref(false)
const starting = ref(false)
const error = ref(null)
const supported = ref(true)

let stream = null
let decoder = null
let timerId = null
let lastEmitted = null

const placeholderMessage = computed(() => {
  if (!supported.value) return 'QR scanning is unavailable in this browser.'

  return 'The camera preview will appear here.'
})

const statusMessage = computed(() => {
  if (!supported.value) return QR_UNSUPPORTED_MESSAGE
  if (props.busy) return 'Verifying…'
  if (active.value) return 'Hold the donor’s QR code inside the frame.'

  return 'Ready when the donor is.'
})

/**
 * Say what went wrong in terms of what the staff member can do about it.
 */
function describeCameraError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera access was blocked. Allow it in your browser settings, or look the donor up by their valid ID.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device. Look the donor up by their valid ID instead.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Another app is using the camera. Close it and try again.'
    case 'SecurityError':
      return 'The camera only opens over a secure (https) connection.'
    default:
      return err?.message || 'The camera could not be opened. Look the donor up by their valid ID instead.'
  }
}

function cameraAvailable() {
  return Boolean(
    import.meta.client
    && navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function',
  )
}

async function tick() {
  const video = videoRef.value

  if (!active.value || !decoder || !video?.videoWidth || props.busy) return

  const value = await decoder.decode(video)

  if (!value || value === lastEmitted) return

  lastEmitted = value
  emit('scanned', value)
}

async function start() {
  error.value = null

  if (!cameraAvailable()) {
    error.value = window.isSecureContext === false
      ? 'The camera only opens over a secure (https) connection.'
      : 'This browser cannot open the camera. Look the donor up by their valid ID instead.'
    return
  }

  // Set before building the decoder, not after: on a browser without
  // BarcodeDetector that step fetches the jsQR chunk over the network, and an
  // enabled button during that wait invites a second click and a second camera.
  starting.value = true

  try {
    decoder = await createQrDecoder()

    if (!decoder) {
      supported.value = false
      error.value = QR_UNSUPPORTED_MESSAGE
      return
    }

    stream = await navigator.mediaDevices.getUserMedia({
      // `ideal` rather than `exact`: a counter PC with only a front-facing
      // webcam should still get a working scanner.
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    })

    const video = videoRef.value

    if (!video) throw new Error('The camera preview is not ready.')

    video.srcObject = stream
    video.setAttribute('playsinline', 'true')
    await video.play()

    if (!video.videoWidth) {
      await new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }))
    }

    active.value = true
    lastEmitted = null
    timerId = window.setInterval(tick, DECODE_INTERVAL_MS)
  } catch (err) {
    error.value = describeCameraError(err)
    stop()
  } finally {
    starting.value = false
  }
}

function stop() {
  if (timerId !== null) {
    window.clearInterval(timerId)
    timerId = null
  }

  stream?.getTracks().forEach((track) => track.stop())
  stream = null

  decoder?.dispose()
  decoder = null

  if (videoRef.value) videoRef.value.srcObject = null

  active.value = false
  lastEmitted = null
}

/**
 * Let the parent re-arm after a refused scan, so the same donor can try again.
 */
function reset() {
  lastEmitted = null
  error.value = null
}

onMounted(async () => {
  supported.value = await isQrDecodingSupported()
})

// Leaving a camera running after the page is gone keeps the recording light
// on, which looks to anyone nearby like the centre is still filming them.
onBeforeUnmount(stop)

defineExpose({ stop, reset })
</script>

<style scoped>
.qr-scanner {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.qr-scanner__stage {
  position: relative;
  aspect-ratio: 4 / 3;
  max-width: 100%;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  display: grid;
  place-items: center;
}

.qr-scanner__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 160ms ease;
}

.qr-scanner__video--live { opacity: 1; }

.qr-scanner__placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.5rem;
  padding: 1rem;
  text-align: center;
  color: var(--rb-text-secondary);
  font-size: 0.85rem;
}

.qr-scanner__reticle {
  position: absolute;
  inset: 18%;
  pointer-events: none;
}

.qr-scanner__corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 3px solid var(--rb-primary);
}

.qr-scanner__corner--tl { top: 0; left: 0; border-right: 0; border-bottom: 0; border-top-left-radius: 8px; }
.qr-scanner__corner--tr { top: 0; right: 0; border-left: 0; border-bottom: 0; border-top-right-radius: 8px; }
.qr-scanner__corner--bl { bottom: 0; left: 0; border-right: 0; border-top: 0; border-bottom-left-radius: 8px; }
.qr-scanner__corner--br { bottom: 0; right: 0; border-left: 0; border-top: 0; border-bottom-right-radius: 8px; }

.qr-scanner__status {
  margin: 0;
  font-size: 0.85rem;
  color: var(--rb-text-secondary);
  min-height: 1.2em;
}

.qr-scanner__status--error { color: var(--rb-accent-text); }

.qr-scanner__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.qr-btn {
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  border-radius: 10px;
  padding: 0.5rem 0.95rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}

.qr-btn:hover:not(:disabled) {
  background: var(--rb-surface-hover);
  border-color: var(--rb-border-hover);
}

.qr-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.qr-btn--primary {
  background: var(--rb-primary);
  border-color: var(--rb-primary);
  color: #fff;
}

.qr-btn--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rb-primary) 88%, #000);
  border-color: color-mix(in srgb, var(--rb-primary) 88%, #000);
}
</style>
