<template>
  <div class="identity">
    <div class="panel-header--simple identity__header">
      <h2 class="panel-title">Valid ID</h2>
      <span class="identity__badge" :class="`identity__badge--${status}`">
        <AssetIcon
          :name="status === 'verified' ? 'check-circle' : status === 'pending' ? 'clock' : status === 'rejected' ? 'alert-circle' : 'circle-dashed'"
          :size="11"
        />
        {{ statusLabel }}
      </span>
    </div>

    <div class="form-body">
      <p class="identity__lead">{{ statusLead }}</p>

      <p v-if="status === 'rejected' && identity?.rejection_reason" class="identity__reason">
        <AssetIcon name="alert-triangle" :size="14" />
        <span>{{ identity.rejection_reason }}</span>
      </p>

      <!-- Verified is final: showing the form again would suggest a submission
           the server refuses. -->
      <div v-if="status === 'verified'" class="status-list identity__summary">
        <div class="status-row">
          <span class="status-row__label">ID type</span>
          <span class="status-row__value">{{ identity?.valid_id_type_label || '-' }}</span>
        </div>
        <div class="status-row">
          <span class="status-row__label">ID number</span>
          <span class="status-row__value">{{ identity?.valid_id_number || '-' }}</span>
        </div>
        <div class="status-row">
          <span class="status-row__label">Verified on</span>
          <span class="status-row__value">{{ formatDate(identity?.reviewed_at) }}</span>
        </div>
      </div>

      <div v-else class="identity__form">
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label" for="identity-type">ID type</label>
            <select id="identity-type" v-model="form.validIdType" class="form-input" :disabled="submitting">
              <option value="" disabled>Select an ID</option>
              <option v-for="option in idTypeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>

          <div class="form-field">
            <label class="form-label" for="identity-number">ID number</label>
            <input
              id="identity-number"
              v-model="form.validIdNumber"
              type="text"
              class="form-input"
              placeholder="As printed on the card"
              :disabled="submitting"
            >
          </div>

          <div class="form-field form-field--full">
            <label class="form-label">Photo of your ID</label>

            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              @change="handleFileChange"
            >

            <!-- Photo already chosen: show it with a small overlay control to swap it. -->
            <div v-if="previewUrl" class="identity__preview-wrap">
              <img :src="previewUrl" alt="Your ID" class="identity__preview">
              <button
                type="button"
                class="btn-outline identity__change"
                :disabled="submitting"
                @click="fileInput.click()"
              >
                <AssetIcon name="refresh-cw" :size="12" />
                Change photo
              </button>
            </div>

            <!-- No photo yet: the whole zone is the trigger. -->
            <button
              v-else
              type="button"
              class="identity__dropzone"
              :disabled="submitting"
              @click="fileInput.click()"
            >
              <span class="identity__dropzone-icon">
                <AssetIcon name="upload" :size="18" />
              </span>
              <span class="identity__dropzone-text">Choose a photo</span>
              <span class="identity__dropzone-sub">Tap to browse your files</span>
            </button>

            <p class="identity__hint">JPG, PNG or WEBP, up to 4MB. Make sure the number and your name are readable.</p>
          </div>
        </div>

        <div class="form-actions identity__actions">
          <button class="btn-primary btn-block" :disabled="!canSubmit || submitting" @click="handleSubmit">
            {{ submitting ? 'Submitting...' : submitLabel }}
          </button>

          <p
            v-if="message"
            class="form-status"
            :class="{ 'form-status--error': failed }"
          >
            {{ message }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { useIdentityStatus } from '~/composables/useIdentityStatus'

const props = defineProps({
  identity: { type: Object, default: null },
})
const emit = defineEmits(['submitted'])

const { submitIdentity, submitting, error, loadImage, imageUrl, releaseImage, idTypeOptions } = useIdentityDocument()
const { setIdentityStatus } = useIdentityStatus()

const fileInput = ref(null)
const selectedFile = ref(null)
const localPreview = ref(null)
const message = ref('')
const failed = ref(false)

const form = reactive({
  validIdType: '',
  validIdNumber: '',
})

const status = computed(() => props.identity?.status || 'unsubmitted')

const statusLabel = computed(() => ({
  unsubmitted: 'Not submitted',
  pending: 'Under review',
  verified: 'Verified',
  rejected: 'Not approved',
}[status.value] || 'Not submitted'))

const statusLead = computed(() => ({
  unsubmitted: 'Add a government-issued ID so staff can confirm who you are at the donation counter.',
  pending: 'Your ID is with our team. You can still book and donate while it is being reviewed.',
  verified: 'Your ID has been verified.',
  rejected: 'Your ID could not be verified. You can submit another photo.',
}[status.value] || ''))

const submitLabel = computed(() => (status.value === 'unsubmitted' ? 'Submit ID' : 'Replace ID'))

// The photo is required on every submission: the server takes type, number and
// image together rather than patching one at a time.
const canSubmit = computed(() =>
  Boolean(form.validIdType && form.validIdNumber.trim() && selectedFile.value)
)

// Prefill from whatever the donor already gave, including a type and number
// entered at signup with no photo yet.
watch(() => props.identity, (identity) => {
  if (!identity) return

  form.validIdType = identity.valid_id_type || form.validIdType
  form.validIdNumber = identity.valid_id_number || form.validIdNumber

  // Keeps the header badge (shared state) in step with whatever this panel
  // just learned — on first load AND right after a submission, since a
  // successful submit updates profile.identity in the parent, which flows
  // back down through this same prop.
  setIdentityStatus(identity.status)

  // Authenticated route, so this cannot be an <img src>: fetch it with the
  // token and render the blob.
  if (identity.image_url && identity.status !== 'unsubmitted') {
    const uuid = identity.image_url.split('/')[2]
    loadImage(uuid)
  }
}, { immediate: true })

// The locally chosen file wins while it exists, so the donor sees what they are
// about to send rather than what is already on file.
const previewUrl = computed(() => localPreview.value || imageUrl.value)

function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return

  selectedFile.value = file
  localPreview.value = URL.createObjectURL(file)
  message.value = ''
}

async function handleSubmit() {
  message.value = ''
  failed.value = false

  try {
    const response = await submitIdentity({
      validIdType: form.validIdType,
      validIdNumber: form.validIdNumber.trim(),
      file: selectedFile.value,
    })

    message.value = response?.message || 'Your ID has been submitted for review.'
    selectedFile.value = null

    // The freshly stored document is what the server now serves, so the local
    // preview is dropped and the panel reloads from the response.
    if (localPreview.value) {
      URL.revokeObjectURL(localPreview.value)
      localPreview.value = null
    }
    releaseImage()

    emit('submitted', response?.data)
  } catch (err) {
    failed.value = true
    message.value = error.value || err?.message || 'Could not submit your ID. Please try again.'
  }
}

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onUnmounted(() => {
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
})
</script>

<style scoped>
.identity {
  --primary: var(--primary, #1565c0);
  --accent: var(--accent, #d32f2f);
  --success: var(--success, #2e7d32);
  --warning: var(--warning, #f57c00);
  --text-primary: var(--text-primary, #1f2937);
  --text-secondary: var(--text-secondary, #9ca3af);
}

/* ── Header (matches .panel-header--simple / .panel-title in Profile.vue) ── */
.identity__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #f3f4f6;
}
.panel-title {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
  margin: 0;
}

.identity__badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px 4px 8px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}
.identity__badge--unsubmitted { background: #f1f5f9; color: var(--text-secondary); }
.identity__badge--pending { background: #fff7ed; color: var(--warning); }
.identity__badge--verified { background: #ecfdf5; color: var(--success); }
.identity__badge--rejected { background: #fef2f2; color: var(--accent); }

/* ── Body (matches .form-body / .form-grid / .form-field / .form-label / .form-input) ── */
.form-body { padding: 20px; }
.identity__lead {
  margin: 0 0 16px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.identity__reason {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  font-size: 12px;
  line-height: 1.5;
  color: var(--accent);
}
.identity__reason svg { flex-shrink: 0; margin-top: 1px; }

/* Verified summary reuses Profile.vue's status-list / status-row pattern */
.identity__summary { padding: 0; }
.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f9fafb;
  font-size: 13px;
}
.status-row:last-child { border-bottom: none; }
.status-row__label { color: var(--text-secondary); }
.status-row__value { font-weight: 700; color: var(--text-primary); }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field--full { grid-column: 1 / -1; }
.form-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.form-input {
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: white;
  color: var(--text-primary);
  font-size: 13px;
  transition: border-color 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
}

select.form-input {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2364748b' stroke-width='1.5'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 34px;
}

.form-actions { display: flex; gap: 10px; margin-top: 18px; align-items: center; flex-wrap: wrap; }
.form-status { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--success); }
.form-status--error { color: var(--accent); }

.identity__actions { flex-direction: column; align-items: stretch; }
.btn-block { width: 100%; }

.btn-primary {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700;
  color: white; background: var(--primary); border: none; cursor: pointer;
  transition: opacity 0.15s ease;
}
.btn-primary:hover:not(:disabled) { opacity: 0.92; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-outline {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 6px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
  color: white; background: rgba(15, 23, 42, 0.72); border: none; cursor: pointer;
  backdrop-filter: blur(2px);
  transition: background 0.15s ease;
}
.btn-outline:hover:not(:disabled) { background: rgba(15, 23, 42, 0.88); }
.btn-outline:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Dropzone / preview ── */
.identity__dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 24px 16px;
  margin-top: 6px;
  border: 1.5px dashed #93c5fd;
  border-radius: 8px;
  background: #f8fafc;
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease;
}
.identity__dropzone:hover:not(:disabled) { border-color: var(--primary); background: #eff6ff; }
.identity__dropzone:disabled { opacity: 0.6; cursor: not-allowed; }

.identity__dropzone-icon {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 999px;
  background: #e3f2fd; color: var(--primary);
}
.identity__dropzone-text { font-size: 13px; font-weight: 700; color: var(--primary); }
.identity__dropzone-sub { font-size: 11px; color: var(--text-secondary); }

.identity__preview-wrap {
  position: relative;
  margin-top: 6px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
}
.identity__preview { width: 100%; max-height: 180px; object-fit: contain; display: block; background: #f8fafc; }
.identity__change { position: absolute; right: 8px; bottom: 8px; }

.identity__hint { margin: 8px 0 0; font-size: 11px; color: var(--text-secondary); }

@media (max-width: 420px) {
  .form-grid { grid-template-columns: 1fr; }
}

/* ============ Dark mode ============ */
:global(.dark .identity__header) { border-color: #334155; }
:global(.dark .identity__badge--unsubmitted) { background: #334155; color: #cbd5e1; }
:global(.dark .identity__badge--pending) { background: rgba(194, 65, 12, 0.2); color: #fdba74; }
:global(.dark .identity__badge--verified) { background: rgba(4, 120, 87, 0.2); color: #6ee7b7; }
:global(.dark .identity__badge--rejected) { background: rgba(185, 28, 28, 0.2); color: #fca5a5; }
:global(.dark .identity__reason) { background: rgba(185, 28, 28, 0.12); border-color: rgba(185, 28, 28, 0.35); }
:global(.dark .status-row) { border-color: #263449; }
:global(.dark .form-input) { background: #0f172a; border-color: #334155; color-scheme: dark; }
:global(.dark .form-input:disabled) { background: #1e293b; }
:global(.dark select.form-input) {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}
:global(.dark .identity__dropzone) { border-color: #334155; background: #0f172a; }
:global(.dark .identity__dropzone:hover:not(:disabled)) { border-color: #3b82f6; background: rgba(59, 130, 246, 0.08); }
:global(.dark .identity__dropzone-icon) { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
:global(.dark .identity__dropzone-text) { color: #60a5fa; }
:global(.dark .identity__preview-wrap) { border-color: #334155; background: #0f172a; }
</style>