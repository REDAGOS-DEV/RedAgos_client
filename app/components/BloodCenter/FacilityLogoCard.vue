<template>
  <section v-if="canConfigure" class="logo-card" aria-labelledby="facility-logo-title">
    <div class="logo-card__head">
      <div>
        <h2 id="facility-logo-title" class="logo-card__title">Facility logo</h2>
        <p class="logo-card__hint">
          Printed on the right of this centre's reports, such as the Daily Blood Stock Inventory. PNG or JPG, 2 MB or
          smaller. A square image prints best.
        </p>
      </div>
    </div>

    <div class="logo-card__body">
      <div class="logo-card__preview" :class="{ 'logo-card__preview--empty': !previewUrl }">
        <img v-if="previewUrl" :src="previewUrl" alt="Current facility logo" @error="previewUrl = null" >
        <span v-else>No logo</span>
      </div>

      <div class="logo-card__actions">
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
          Remove
        </button>
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
 * A supervisor's upload of their own facility's logo.
 *
 * Self-gating on `center.configure`, the same supervisor-only ability that
 * sets shelf life and price. The facility is never chosen here: the server
 * takes it from the signed-in account.
 */

const { can } = useUser()
const canConfigure = computed(() => can('center.configure'))

const previewUrl = ref(null)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const fileInput = ref(null)

async function loadCurrent() {
  try {
    const res = await bloodCenterService.profile()

    previewUrl.value = res?.facility?.logo_url ?? null
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
    const res = await bloodCenterService.uploadFacilityLogo(form)

    previewUrl.value = res?.logo_url ?? null
    notice.value = res?.message ?? 'Facility logo updated.'
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
    const res = await bloodCenterService.removeFacilityLogo()

    previewUrl.value = null
    notice.value = res?.message ?? 'Facility logo removed.'
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

.logo-card__title { margin: 0; font-size: 1rem; font-weight: 700; color: var(--rb-text-primary); }

.logo-card__hint {
  margin: 0.25rem 0 0;
  max-width: 62ch;
  font-size: 0.83rem;
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
  font-size: 0.75rem;
  color: var(--rb-text-secondary);
}

.logo-card__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }

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
  font-size: 0.85rem;
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
.logo-card__notice { margin: 0; font-size: 0.83rem; }
.logo-card__error { color: var(--rb-accent-text); }
.logo-card__notice { color: var(--rb-success-text); }
</style>
