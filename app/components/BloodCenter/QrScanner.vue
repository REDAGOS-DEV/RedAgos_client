<template>
  <div class="qr-scanner">
    <div class="qr-scanner__stage" :class="{ 'qr-scanner__stage--live': active }">
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
        <span class="qr-scanner__beam" />
      </div>

      <span v-if="active" class="qr-scanner__live">
        <span class="qr-scanner__live-dot" aria-hidden="true" />
        Camera on
      </span>

      <!-- Idle: what to ask the donor for, and the one button that starts it. -->
      <div v-if="!active" class="qr-scanner__placeholder">
        <span class="qr-scanner__glyph" aria-hidden="true">
          <AssetIcon name="qr-code" :size="26" />
        </span>
        <p class="qr-scanner__lead">{{ placeholderTitle }}</p>
        <p class="qr-scanner__sub">{{ placeholderMessage }}</p>
        <button
          type="button"
          class="qr-btn qr-btn--primary"
          :disabled="starting || !supported"
          @click="start"
        >
          <AssetIcon :name="starting ? 'loader' : 'camera'" :size="15" :class="{ 'qr-spin': starting }" />
          {{ starting ? 'Opening camera…' : 'Start camera' }}
        </button>
      </div>

      <button v-else type="button" class="qr-btn qr-btn--overlay" @click="stop">
        <AssetIcon name="x" :size="14" />
        Stop camera
      </button>

      <div v-if="active && busy" class="qr-scanner__verifying">
        <AssetIcon name="loader" :size="18" class="qr-spin" />
        Verifying…
      </div>
    </div>

    <p
      v-show="error || active || busy || !supported"
      class="qr-scanner__status"
      :class="{ 'qr-scanner__status--error': Boolean(error) }"
      role="status"
    >
      <AssetIcon v-if="error" name="circle-alert" :size="15" class="qr-scanner__status-icon" />
      <span v-else class="qr-scanner__status-dot" :class="{ 'qr-scanner__status-dot--live': active }" aria-hidden="true" />
      <span>{{ error || statusMessage }}</span>
    </p>

    <div v-if="showManual" class="qr-scanner__actions">
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
  // Off when the page already shows the ID lookup beside the scanner.
  showManual: { type: Boolean, default: true },
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

const placeholderTitle = computed(() =>
  supported.value ? 'Ask the donor for their QR code' : 'QR scanning is unavailable')

const placeholderMessage = computed(() => {
  if (!supported.value) return 'This browser cannot read QR codes. Look the donor up by their valid ID instead.'

  return 'Start the camera, then have them hold the code from their donor portal inside the frame.'
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
  gap: 12px;
}

/* A recessed, dotted well so it reads as a viewfinder rather than an empty box. */
.qr-scanner__stage {
  position: relative;
  aspect-ratio: 16 / 10;
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  border: 1px dashed var(--rb-border-strong);
  background-color: var(--rb-surface-alt);
  background-image: radial-gradient(color-mix(in srgb, var(--rb-text-secondary) 18%, transparent) 1px, transparent 1px);
  background-size: 16px 16px;
  display: grid;
  place-items: center;
  transition: border-color 160ms ease;
}

.qr-scanner__stage--live {
  border-style: solid;
  border-color: var(--rb-primary);
  background: #0b1220;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px;
  text-align: center;
}

.qr-scanner__glyph {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 6px;
  border-radius: 16px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  color: var(--rb-primary-text);
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.06);
}

.qr-scanner__lead {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.qr-scanner__sub {
  margin: 0 0 10px;
  max-width: 38ch;
  font-size: 13px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

/* Live overlay: a dimmed surround, corner brackets, a slow beam, a "camera on" tag. */
.qr-scanner__reticle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(58%, 260px);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  pointer-events: none;
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgb(2 6 23 / 0.45);
}

.qr-scanner__corner {
  position: absolute;
  width: 28px;
  height: 28px;
  border: 3px solid #fff;
}

.qr-scanner__corner--tl { top: 0; left: 0; border-right: 0; border-bottom: 0; border-top-left-radius: 12px; }
.qr-scanner__corner--tr { top: 0; right: 0; border-left: 0; border-bottom: 0; border-top-right-radius: 12px; }
.qr-scanner__corner--bl { bottom: 0; left: 0; border-right: 0; border-top: 0; border-bottom-left-radius: 12px; }
.qr-scanner__corner--br { bottom: 0; right: 0; border-left: 0; border-top: 0; border-bottom-right-radius: 12px; }

.qr-scanner__beam {
  position: absolute;
  left: 8%;
  right: 8%;
  top: 10%;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, #60a5fa, transparent);
  box-shadow: 0 0 12px #60a5fa;
  animation: qr-beam 2.2s ease-in-out infinite alternate;
}

@keyframes qr-beam {
  to { top: 90%; }
}

.qr-scanner__live {
  position: absolute;
  top: 12px;
  left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgb(2 6 23 / 0.6);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.qr-scanner__live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ef4444;
  animation: qr-pulse 1.4s ease-in-out infinite;
}

@keyframes qr-pulse {
  50% { opacity: 0.35; }
}

.qr-scanner__verifying {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgb(2 6 23 / 0.6);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

/* Under the stage, only when there is something to say. */
.qr-scanner__status {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--rb-text-secondary);
}

.qr-scanner__status--error {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--rb-accent) 30%, transparent);
  background: color-mix(in srgb, var(--rb-accent) 8%, transparent);
  color: var(--rb-accent-text);
}

.qr-scanner__status-icon { flex-shrink: 0; margin-top: 1px; }

.qr-scanner__status-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--rb-text-secondary);
}

.qr-scanner__status-dot--live { background: var(--rb-success); }

.qr-scanner__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.qr-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}

.qr-btn:hover:not(:disabled) {
  background: var(--rb-surface-hover);
  border-color: var(--rb-border-hover);
}

.qr-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

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

.qr-btn--overlay {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 6px 12px;
  font-size: 12.5px;
  border-color: rgb(255 255 255 / 0.25);
  background: rgb(2 6 23 / 0.6);
  color: #fff;
}

.qr-btn--overlay:hover:not(:disabled) {
  background: rgb(2 6 23 / 0.8);
  border-color: rgb(255 255 255 / 0.4);
}

.qr-spin { animation: qr-spin 0.9s linear infinite; }

@keyframes qr-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .qr-scanner__beam,
  .qr-scanner__live-dot,
  .qr-spin { animation: none; }
}
</style>
