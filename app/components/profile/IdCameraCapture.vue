<template>
  <div class="scanner" role="dialog" aria-modal="true" aria-label="Take a photo of your ID">
    <!--
      The preview stays mounted for the whole session, including while a capture
      is being reviewed. Unmounting it would drop the stream and make every
      retake pay for a fresh camera open.
    -->
    <video
      ref="videoEl"
      class="scanner__video"
      playsinline
      muted
      autoplay
    />

    <div class="scanner__top">
      <button type="button" class="scanner__icon-btn" aria-label="Close the camera" @click="handleClose">
        <AssetIcon name="x" :size="18" />
      </button>

      <div class="scanner__title">
        <span class="scanner__title-main">{{ idTypeLabel || 'Valid ID' }}</span>
        <span v-if="sides.length > 1" class="scanner__title-sub">
          {{ currentSide.label }} side &middot; {{ sideIndex + 1 }} of {{ sides.length }}
        </span>
        <span v-else class="scanner__title-sub">Fit your ID inside the frame</span>
      </div>

      <div class="scanner__steps" aria-hidden="true">
        <span
          v-for="(side, index) in sides"
          :key="side.key"
          class="scanner__step"
          :class="{
            'scanner__step--done': index < sideIndex,
            'scanner__step--active': index === sideIndex,
          }"
        />
      </div>
    </div>

    <!--
      __guide is both the thing the donor aims at and the thing the analysis
      measures against: useIdCamera reads this element's box and maps it back
      through the object-fit:cover crop, so the two can never disagree.
    -->
    <div class="scanner__stage">
      <div
        ref="guideEl"
        class="scanner__guide"
        :class="{
          'scanner__guide--ready': guidance.ready,
          'scanner__guide--idle': !camera.active.value,
        }"
      >
        <span class="scanner__corner scanner__corner--tl" />
        <span class="scanner__corner scanner__corner--tr" />
        <span class="scanner__corner scanner__corner--bl" />
        <span class="scanner__corner scanner__corner--br" />
      </div>

      <p
        v-if="camera.active.value && !error"
        class="scanner__guidance"
        :class="{ 'scanner__guidance--ready': guidance.ready }"
        role="status"
        aria-live="polite"
      >
        {{ guidance.message }}
      </p>
    </div>

    <div class="scanner__bottom">
      <p v-if="hint" class="scanner__hint">{{ hint }}</p>

      <div class="scanner__controls">
        <button
          type="button"
          class="scanner__toggle"
          :aria-pressed="camera.autoCapture.value"
          @click="camera.autoCapture.value = !camera.autoCapture.value"
        >
          Auto {{ camera.autoCapture.value ? 'on' : 'off' }}
        </button>

        <button
          type="button"
          class="scanner__shutter"
          :style="{ '--hold': camera.holdProgress.value }"
          :disabled="!camera.active.value || capturing"
          aria-label="Take the photo now"
          @click="takePhoto"
        >
          <span class="scanner__shutter-ring" />
          <span class="scanner__shutter-core">
            <AssetIcon name="camera" :size="20" />
          </span>
        </button>

        <button type="button" class="scanner__toggle" @click="emit('fallback')">
          Use a file
        </button>
      </div>
    </div>

    <!-- ── Starting / failed ───────────────────────────────────────────── -->
    <div v-if="camera.starting.value" class="scanner__veil">
      <span class="scanner__spinner" />
      <p class="scanner__veil-text">Opening the camera...</p>
    </div>

    <div v-else-if="error" class="scanner__veil scanner__veil--solid">
      <AssetIcon name="triangle-alert" :size="28" />
      <p class="scanner__veil-text">{{ error }}</p>
      <div class="scanner__veil-actions">
        <button type="button" class="scanner__btn scanner__btn--ghost" @click="retryCamera">Try again</button>
        <button type="button" class="scanner__btn scanner__btn--primary" @click="emit('fallback')">
          Attach a file instead
        </button>
      </div>
    </div>

    <!-- ── Review the capture ──────────────────────────────────────────── -->
    <div v-if="pending" class="scanner__review">
      <div class="scanner__review-head">
        <span class="scanner__review-title">
          {{ sides.length > 1 ? `${currentSide.label} side` : 'Your ID' }}
        </span>
        <button type="button" class="scanner__icon-btn" aria-label="Close the camera" @click="handleClose">
          <AssetIcon name="x" :size="18" />
        </button>
      </div>

      <div class="scanner__review-body">
        <img :src="pending.url" alt="The photo you just took" class="scanner__shot">

        <p class="scanner__verdict" :class="`scanner__verdict--${pending.verdict.level}`">
          <AssetIcon
            :name="pending.verdict.level === 'ok' ? 'circle-check-big' : 'triangle-alert'"
            :size="15"
          />
          <span>{{ pending.verdict.message }}</span>
        </p>

        <p v-if="buildError" class="scanner__verdict scanner__verdict--error">
          <AssetIcon name="triangle-alert" :size="15" />
          <span>{{ buildError }}</span>
        </p>
      </div>

      <div class="scanner__review-actions">
        <button type="button" class="scanner__btn scanner__btn--ghost" :disabled="building" @click="retake">
          <AssetIcon name="refresh-cw" :size="14" />
          Retake
        </button>

        <button
          type="button"
          class="scanner__btn scanner__btn--primary"
          :disabled="pending.verdict.level === 'error' || building"
          @click="confirm"
        >
          <AssetIcon name="check" :size="14" />
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { buildIdImageFile, useIdCamera } from '~/composables/useIdCamera'
import { idSidesFor } from '~/composables/useIdentityDocument'

const props = defineProps({
  validIdType: { type: String, default: '' },
  idTypeLabel: { type: String, default: '' },
})

/**
 * `captured` hands back a plain File, which is exactly what the file picker
 * hands the existing flow. The parent cannot tell the two apart, and neither
 * can the upload behind it.
 */
const emit = defineEmits(['captured', 'close', 'fallback'])

const videoEl = ref(null)
const guideEl = ref(null)

const sides = computed(() => idSidesFor(props.validIdType))
const sideIndex = ref(0)
const currentSide = computed(() => sides.value[sideIndex.value] || { key: 'front', label: 'Front' })

// Confirmed sides, oldest first. Held as blobs until the last side is done,
// because a two-sided ID is one upload and one stored document.
const confirmed = ref([])
const pending = ref(null)

const capturing = ref(false)
const building = ref(false)
const buildError = ref('')

const camera = useIdCamera({
  videoRef: videoEl,
  guideRef: guideEl,
  onAutoCapture: () => takePhoto(),
})

const guidance = computed(() => camera.guidance.value)
const error = computed(() => camera.error.value)

const confirmLabel = computed(() => {
  if (building.value) return 'Preparing...'
  if (sideIndex.value < sides.value.length - 1) return `Next: ${sides.value[sideIndex.value + 1].label}`

  return 'Use this photo'
})

const hint = computed(() => {
  if (!camera.active.value || pending.value) return ''
  if (!camera.autoCapture.value) return 'Tap the button when your ID is inside the frame.'
  if (camera.struggling.value) return 'Taking a while? Tap the button to capture it yourself.'

  return ''
})

async function takePhoto() {
  if (capturing.value || pending.value || !camera.active.value) return

  capturing.value = true

  try {
    const shot = await camera.capture()
    camera.suspend()
    pending.value = shot
  } catch (err) {
    camera.error.value = err?.message || 'The photo could not be taken. Please try again.'
  } finally {
    capturing.value = false
  }
}

function discardPending() {
  if (pending.value) URL.revokeObjectURL(pending.value.url)
  pending.value = null
  buildError.value = ''
}

function retake() {
  discardPending()
  camera.resume()
}

async function confirm() {
  if (!pending.value) return

  const shot = pending.value
  const collected = [...confirmed.value, { ...currentSide.value, blob: shot.blob, url: shot.url }]

  // Not the last side: keep the blob, advance, and put the camera back.
  if (sideIndex.value < sides.value.length - 1) {
    confirmed.value = collected
    pending.value = null
    sideIndex.value += 1
    camera.resume()

    return
  }

  building.value = true
  buildError.value = ''

  try {
    const file = await buildIdImageFile(collected, {
      fileName: `valid-id-${props.validIdType || 'document'}.jpg`,
    })

    emit('captured', file)
  } catch (err) {
    buildError.value = err?.message || 'The photo could not be prepared. Please try again.'
    building.value = false
  }
}

function handleClose() {
  emit('close')
}

async function retryCamera() {
  camera.error.value = null
  await camera.start()
}

onMounted(async () => {
  // Locked because the scanner is fixed to the viewport: a page scrolling
  // underneath moves the guide out from under the rectangle being analysed.
  document.body.style.overflow = 'hidden'
  await nextTick()
  await camera.start()
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  camera.stop()
  discardPending()
  confirmed.value.forEach((side) => URL.revokeObjectURL(side.url))
})
</script>

<style scoped>
.scanner {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: #020617;
  color: #f8fafc;
  overscroll-behavior: contain;
}

.scanner__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #020617;
}

/* ── Top bar ── */
/*
 * Above the stage, not merely level with it: the guide's scrim is a box-shadow
 * spreading 100vmax in every direction, and at an equal z-index the bar loses
 * to it on DOM order and ends up behind the darkening.
 */
.scanner__top {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: max(14px, env(safe-area-inset-top)) 14px 14px;
  background: linear-gradient(to bottom, rgba(2, 6, 23, 0.75), rgba(2, 6, 23, 0));
}

.scanner__title { flex: 1; min-width: 0; text-align: center; }
.scanner__title-main { display: block; font-size: 13.5px; font-weight: 700; }
.scanner__title-sub { display: block; margin-top: 2px; font-size: 11.5px; color: #cbd5e1; }

.scanner__steps { display: flex; gap: 5px; width: 34px; justify-content: flex-end; }
.scanner__step {
  width: 7px; height: 7px; border-radius: 999px;
  background: rgba(248, 250, 252, 0.3);
}
.scanner__step--active { background: #f8fafc; }
.scanner__step--done { background: #34d399; }

.scanner__icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; flex-shrink: 0;
  border: none; border-radius: 999px; cursor: pointer;
  background: rgba(15, 23, 42, 0.55); color: #f8fafc;
  backdrop-filter: blur(3px);
}
.scanner__icon-btn:hover { background: rgba(15, 23, 42, 0.8); }

/* ── Guide ── */
.scanner__stage {
  position: relative;
  z-index: 2;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 0 16px;
  min-height: 0;
}

/*
 * The scrim is the guide's own box-shadow rather than four panels around it:
 * one element, one radius, and the darkened area can never drift out of
 * register with the cut-out it surrounds.
 */
.scanner__guide {
  position: relative;
  width: min(88vw, 520px);
  aspect-ratio: 1.585;   /* ID-1, the size almost every card here is */
  max-height: 52vh;
  border-radius: 14px;
  box-shadow: 0 0 0 100vmax rgba(2, 6, 23, 0.66);
  outline: 2px solid rgba(248, 250, 252, 0.85);
  outline-offset: -1px;
  transition: outline-color 180ms ease;
}
.scanner__guide--idle { outline-color: rgba(248, 250, 252, 0.35); }
.scanner__guide--ready { outline-color: #34d399; }

.scanner__corner {
  position: absolute;
  width: 26px; height: 26px;
  border: 3px solid #f8fafc;
  transition: border-color 180ms ease;
}
.scanner__guide--ready .scanner__corner { border-color: #34d399; }

.scanner__corner--tl { top: -3px; left: -3px; border-right: none; border-bottom: none; border-radius: 14px 0 0 0; }
.scanner__corner--tr { top: -3px; right: -3px; border-left: none; border-bottom: none; border-radius: 0 14px 0 0; }
.scanner__corner--bl { bottom: -3px; left: -3px; border-right: none; border-top: none; border-radius: 0 0 0 14px; }
.scanner__corner--br { bottom: -3px; right: -3px; border-left: none; border-top: none; border-radius: 0 0 14px 0; }

.scanner__guidance {
  margin: 0;
  padding: 9px 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  background: rgba(2, 6, 23, 0.72);
  backdrop-filter: blur(3px);
}
.scanner__guidance--ready { background: rgba(4, 120, 87, 0.9); }

/* ── Bottom bar ── */
.scanner__bottom {
  position: relative;
  z-index: 2;
  padding: 14px 16px max(18px, env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(2, 6, 23, 0.8), rgba(2, 6, 23, 0));
}

.scanner__hint {
  margin: 0 0 12px;
  font-size: 11.5px;
  text-align: center;
  color: #cbd5e1;
}

.scanner__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.scanner__toggle {
  min-width: 74px;
  padding: 7px 12px;
  border: 1px solid rgba(248, 250, 252, 0.28);
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  color: #f8fafc;
  background: rgba(15, 23, 42, 0.5);
  cursor: pointer;
}
.scanner__toggle:hover { background: rgba(15, 23, 42, 0.78); }

/*
 * The ring doubles as the auto-capture countdown, so the shutter is never a
 * surprise: the donor watches the same control fill that they can also press.
 */
.scanner__shutter {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 66px; height: 66px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}
.scanner__shutter:disabled { opacity: 0.5; cursor: not-allowed; }

.scanner__shutter-ring {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: conic-gradient(#34d399 calc(var(--hold, 0) * 360deg), rgba(248, 250, 252, 0.45) 0);
  transition: background 90ms linear;
}

.scanner__shutter-core {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px; height: 54px;
  border-radius: 999px;
  background: #f8fafc;
  color: #0f172a;
}

/* ── Veils (starting, failed) ── */
.scanner__veil {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 28px;
  text-align: center;
  background: rgba(2, 6, 23, 0.72);
  color: #f8fafc;
}
.scanner__veil--solid { background: #020617; }
.scanner__veil-text { margin: 0; max-width: 320px; font-size: 13px; line-height: 1.6; }
.scanner__veil-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }

.scanner__spinner {
  width: 26px; height: 26px;
  border: 2.5px solid rgba(248, 250, 252, 0.25);
  border-top-color: #f8fafc;
  border-radius: 999px;
  animation: scanner-spin 0.8s linear infinite;
}
@keyframes scanner-spin { to { transform: rotate(360deg); } }

/* ── Review ── */
.scanner__review {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  background: #020617;
}

.scanner__review-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: max(14px, env(safe-area-inset-top)) 14px 12px;
}
.scanner__review-title { font-size: 13.5px; font-weight: 700; }

.scanner__review-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 4px 16px;
  min-height: 0;
}

.scanner__shot {
  max-width: 100%;
  max-height: 54vh;
  border-radius: 10px;
  object-fit: contain;
  background: #0f172a;
}

.scanner__verdict {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  max-width: 460px;
  padding: 10px 13px;
  border-radius: 9px;
  font-size: 12.5px;
  line-height: 1.5;
  text-align: left;
}
.scanner__verdict svg { flex-shrink: 0; margin-top: 1px; }
.scanner__verdict--ok { background: rgba(4, 120, 87, 0.22); color: #6ee7b7; }
.scanner__verdict--warning { background: rgba(194, 65, 12, 0.22); color: #fdba74; }
.scanner__verdict--error { background: rgba(185, 28, 28, 0.22); color: #fca5a5; }

.scanner__review-actions {
  display: flex;
  gap: 10px;
  padding: 14px 16px max(18px, env(safe-area-inset-bottom));
}

.scanner__btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 12px 16px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
}
.scanner__btn:disabled { opacity: 0.55; cursor: not-allowed; }
.scanner__btn--ghost { background: transparent; border-color: rgba(248, 250, 252, 0.3); color: #f8fafc; }
.scanner__btn--ghost:hover:not(:disabled) { background: rgba(248, 250, 252, 0.1); }
.scanner__btn--primary { background: #1565c0; color: #ffffff; }
.scanner__btn--primary:hover:not(:disabled) { opacity: 0.92; }

@media (max-width: 380px) {
  .scanner__toggle { min-width: 0; padding: 7px 9px; }
}
</style>
