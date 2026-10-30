<template>
  <section v-if="canConfigure" class="logo-card" :aria-labelledby="titleId">
    <div class="logo-card__head">
      <div>
        <h2 :id="titleId" class="logo-card__title">{{ copy.title }}</h2>
        <p class="logo-card__hint">PNG or JPG, 2 MB or smaller.</p>
      </div>
    </div>

    <div class="logo-card__body">
      <div class="logo-card__preview" :class="{ 'logo-card__preview--empty': !shownUrl }">
        <img v-if="shownUrl" :src="shownUrl" :alt="previewUrl ? copy.alt : 'Department of Health seal'" @error="onPreviewError" >
        <span v-else>No logo</span>
      </div>

      <div class="logo-card__actions">
        <!-- With none uploaded, the left logo prints the DOH seal: say so beside it. -->
        <p v-if="isSeal && !previewUrl" class="logo-card__default">Default: Department of Health seal</p>

        <div class="logo-card__buttons">
          <label class="logo-btn logo-btn--primary" :class="{ 'logo-btn--busy': busy }">
            <input
              ref="fileInput"
              type="file"
              accept="image/png,image/jpeg"
              class="logo-card__file"
              :disabled="busy"
              @change="onFileChosen"
            >
            {{ busy ? 'Uploading…' : previewUrl ? 'Replace logo' : 'Upload logo' }}
          </label>

          <button v-if="previewUrl" type="button" class="logo-btn" :disabled="busy" @click="removeLogo">
            {{ isSeal ? 'Use the DOH seal' : 'Remove' }}
          </button>
        </div>
      </div>
    </div>

    <p v-if="error" class="logo-card__error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="logo-card__notice" role="status">{{ notice }}</p>
  </section>
</template>

<script setup>
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { logoProblem } from '~/utils/stockReport'

/**
 * The Blood Center Admin's upload of their own facility's logos.
 *
 * Two slots, by `kind`:
 * - `logo`: the facility logo, on the right of its reports and on its billing
 *   documents.
 * - `seal`: the left-hand logo of the Daily Blood Stock Inventory (project
 *   owner, 2026-10-22). Without one the report prints the Department of Health
 *   seal, which the preview shows.
 *
 * Self-gating on `center.configure`, an ability only the Admin level holds.
 * The facility is never chosen here: the server takes it from the signed-in
 * account.
 */

const props = defineProps({
  kind: { type: String, default: 'logo', validator: (value) => ['logo', 'seal'].includes(value) },
})

// The same default the stock report prints (pages/blood-center/stock-report.vue).
const DOH_SEAL_SRC = '/images/doh-seal.png'

const SLOTS = {
  logo: {
    title: 'Facility logo',
    alt: 'Current facility logo',
    field: 'logo_url',
    upload: (form) => bloodCenterService.uploadFacilityLogo(form),
    remove: () => bloodCenterService.removeFacilityLogo(),
    updated: 'Facility logo updated.',
    removed: 'Facility logo removed.',
  },
  seal: {
    title: 'Left logo',
    alt: 'Current left logo',
    field: 'seal_url',
    upload: (form) => bloodCenterService.uploadFacilitySeal(form),
    remove: () => bloodCenterService.removeFacilitySeal(),
    updated: 'Left logo updated.',
    removed: 'Left logo removed. The report prints the Department of Health seal.',
  },
}

const isSeal = computed(() => props.kind === 'seal')
const copy = computed(() => SLOTS[props.kind] ?? SLOTS.logo)
const titleId = computed(() => `facility-${props.kind}-title`)

const { can } = useUser()
const canConfigure = computed(() => can('center.configure'))

// The uploaded file's link, null when there is none.
const previewUrl = ref(null)
const defaultSealVisible = ref(true)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const fileInput = ref(null)

// What the preview shows: the upload, else (left logo only) the DOH seal.
const shownUrl = computed(() => previewUrl.value || (isSeal.value && defaultSealVisible.value ? DOH_SEAL_SRC : null))

function onPreviewError() {
  if (previewUrl.value) previewUrl.value = null
  else defaultSealVisible.value = false
}

async function loadCurrent() {
  try {
    const res = await bloodCenterService.profile()

    previewUrl.value = res?.facility?.[copy.value.field] ?? null
  } catch {
    // The card still offers an upload; only the preview is missing.
  }
}

async function onFileChosen(event) {
  const file = event.target.files?.[0]

  error.value = ''
  notice.value = ''

  if (!file) return

  // Checked here so a wrong file is refused before it is sent; the server
  // checks the same things again.
  const problem = logoProblem(file)

  if (problem) {
    error.value = problem
    resetInput()
    return
  }

  const form = new FormData()
  form.append('logo', file)

  busy.value = true

  try {
    const res = await copy.value.upload(form)

    previewUrl.value = res?.[copy.value.field] ?? null
    notice.value = res?.message ?? copy.value.updated
  } catch (err) {
    error.value = err?.data?.errors?.logo?.[0] || err?.data?.message || 'The logo could not be uploaded.'
  } finally {
    busy.value = false
    resetInput()
  }
}

async function removeLogo() {
  error.value = ''
  notice.value = ''
  busy.value = true

  try {
    const res = await copy.value.remove()

    previewUrl.value = null
    notice.value = res?.message ?? copy.value.removed
  } catch (err) {
    error.value = err?.data?.message || 'The logo could not be removed.'
  } finally {
    busy.value = false
  }
}

function resetInput() {
  if (fileInput.value) fileInput.value.value = ''
}

onMounted(() => {
  if (canConfigure.value) loadCurrent()
})
</script>

<style scoped>
.logo-card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  margin-top: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
}

.logo-card__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }

.logo-card__hint {
  margin: 0.25rem 0 0;
  max-width: 62ch;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.logo-card__body { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; }

.logo-card__preview {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  padding: 8px;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: #fff;
}

.logo-card__preview img { max-width: 100%; max-height: 100%; object-fit: contain; }

.logo-card__preview--empty {
  border-style: dashed;
  background: var(--rb-surface-alt);
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.logo-card__actions { display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; }
.logo-card__buttons { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.logo-card__default { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.logo-card__file { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }

.logo-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.95rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.logo-btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.logo-btn:disabled,
.logo-btn--busy { opacity: 0.6; cursor: not-allowed; }

.logo-btn:has(.logo-card__file:focus-visible) { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.logo-btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.logo-btn--primary:hover:not(.logo-btn--busy) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }

.logo-card__error,
.logo-card__notice { margin: 0; font-size: 13.5px; }
.logo-card__error { color: var(--rb-accent-text); }
.logo-card__notice { color: var(--rb-success-text); }
</style>
