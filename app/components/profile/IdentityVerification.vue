<template>
  <div class="identity">
    <div class="identity__header">
      <h2 class="identity__title">Valid ID</h2>
      <span class="identity__badge" :class="`identity__badge--${status}`">{{ statusLabel }}</span>
    </div>

    <p class="identity__lead">{{ statusLead }}</p>

    <p v-if="status === 'rejected' && identity?.rejection_reason" class="identity__reason">
      {{ identity.rejection_reason }}
    </p>

    <!-- Verified is final: showing the form again would suggest a submission
         the server refuses. -->
    <div v-if="status === 'verified'" class="identity__summary">
      <div class="identity__row">
        <span class="identity__row-label">ID type</span>
        <span class="identity__row-value">{{ identity?.valid_id_type_label || '-' }}</span>
      </div>
      <div class="identity__row">
        <span class="identity__row-label">ID number</span>
        <span class="identity__row-value">{{ identity?.valid_id_number || '-' }}</span>
      </div>
      <div class="identity__row">
        <span class="identity__row-label">Verified on</span>
        <span class="identity__row-value">{{ formatDate(identity?.reviewed_at) }}</span>
      </div>
    </div>

    <div v-else class="identity__form">
      <div class="identity__field">
        <label class="identity__label" for="identity-type">ID type</label>
        <select id="identity-type" v-model="form.validIdType" class="identity__input" :disabled="submitting">
          <option value="" disabled>Select an ID</option>
          <option v-for="option in idTypeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="identity__field">
        <label class="identity__label" for="identity-number">ID number</label>
        <input
          id="identity-number"
          v-model="form.validIdNumber"
          type="text"
          class="identity__input"
          placeholder="As printed on the card"
          :disabled="submitting"
        >
      </div>

      <div class="identity__field identity__field--full">
        <label class="identity__label">Photo of your ID</label>

        <div class="identity__upload">
          <img v-if="previewUrl" :src="previewUrl" alt="Your ID" class="identity__preview">
          <div v-else class="identity__placeholder">
            <AssetIcon name="id-card" :size="20" />
            <span>No photo attached</span>
          </div>

          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            @change="handleFileChange"
          >
          <button
            type="button"
            class="identity__choose"
            :disabled="submitting"
            @click="fileInput.click()"
          >
            {{ selectedFile ? 'Choose a different photo' : 'Choose a photo' }}
          </button>
        </div>

        <p class="identity__hint">JPG, PNG or WEBP, up to 4MB. Make sure the number and your name are readable.</p>
      </div>

      <div class="identity__actions">
        <button class="identity__submit" :disabled="!canSubmit || submitting" @click="handleSubmit">
          {{ submitting ? 'Submitting...' : submitLabel }}
        </button>

        <p v-if="message" class="identity__status" :class="{ 'identity__status--error': failed }">
          {{ message }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

const props = defineProps({
  identity: { type: Object, default: null },
})
const emit = defineEmits(['submitted'])

const { submitIdentity, submitting, error, loadImage, imageUrl, releaseImage, idTypeOptions } = useIdentityDocument()

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
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.identity__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.identity__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #0F172A;
}

.identity__badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
}

.identity__badge--unsubmitted {
  background: #F1F5F9;
  color: #475569;
}

.identity__badge--pending {
  background: #FFF7ED;
  color: #C2410C;
}

.identity__badge--verified {
  background: #ECFDF5;
  color: #047857;
}

.identity__badge--rejected {
  background: #FEF2F2;
  color: #B91C1C;
}

.identity__lead {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #64748B;
}

.identity__reason {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #FEF2F2;
  border: 1px solid #FECACA;
  font-size: 12px;
  color: #B91C1C;
}

.identity__summary,
.identity__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.identity__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.identity__row-label {
  color: #64748B;
}

.identity__row-value {
  font-weight: 600;
  color: #0F172A;
}

.identity__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.identity__label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.identity__input {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid #CBD5E1;
  border-radius: 8px;
  font-size: 13px;
  color: #0F172A;
  background: #fff;
  outline: none;
}

.identity__input:focus {
  border-color: #1565C0;
  box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.12);
}

.identity__input:disabled {
  background: #F8FAFC;
  cursor: not-allowed;
}

.identity__upload {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.identity__preview {
  width: 100%;
  max-height: 180px;
  object-fit: contain;
  border-radius: 8px;
  border: 1px solid #E2E8F0;
  background: #F8FAFC;
  display: block;
}

.identity__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 96px;
  border: 1px dashed #CBD5E1;
  border-radius: 8px;
  background: #F8FAFC;
  color: #94A3B8;
  font-size: 12px;
}

.identity__choose {
  padding: 8px 12px;
  border: 1px solid #CBD5E1;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  color: #1565C0;
  cursor: pointer;
}

.identity__choose:hover:not(:disabled) {
  background: #E3F2FD;
}

.identity__choose:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.identity__hint {
  margin: 0;
  font-size: 11px;
  color: #94A3B8;
}

.identity__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.identity__submit {
  padding: 10px 14px;
  border: none;
  border-radius: 8px;
  background: #1565C0;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.identity__submit:hover:not(:disabled) {
  background: #0D47A1;
}

.identity__submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.identity__status {
  margin: 0;
  font-size: 12px;
  color: #047857;
}

.identity__status--error {
  color: #D32F2F;
}
</style>
