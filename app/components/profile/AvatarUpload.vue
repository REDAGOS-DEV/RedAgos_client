<template>
  <div class="avatar-upload">
    <div class="avatar-upload__preview">
      <img v-if="previewUrl" :src="previewUrl" alt="Profile photo" class="avatar-upload__img">
      <span v-else class="avatar-upload__initial">{{ fallbackInitial }}</span>

      <div v-if="uploading" class="avatar-upload__overlay">
        <div class="avatar-upload__spinner" />
      </div>
    </div>

    <div class="avatar-upload__actions">
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        @change="handleFileChange"
      >
      <button class="avatar-upload__btn" :disabled="uploading" @click="fileInput.click()">
        <AssetIcon name="camera" :size="14" />
        {{ uploading ? 'Uploading...' : 'Change Photo' }}
      </button>
      <p v-if="error" class="avatar-upload__error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

const props = defineProps({
  currentAvatar: { type: String, default: null },
  fallbackInitial: { type: String, default: 'D' },
})
const emit = defineEmits(['updated'])

const { uploadAvatar, uploading, error } = useAvatar()
const fileInput = ref(null)
const previewUrl = ref(props.currentAvatar)

// Keep preview in sync if parent passes a new avatar later (e.g. after page reload)
watch(() => props.currentAvatar, (val) => {
  previewUrl.value = val
})

async function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return

  // Instant local preview while uploading
  const localPreview = URL.createObjectURL(file)
  previewUrl.value = localPreview

  try {
    const uploadedUrl = await uploadAvatar(file)
    previewUrl.value = uploadedUrl
    emit('updated', uploadedUrl)
  } catch (err) {
    // Revert to old avatar on failure
    previewUrl.value = props.currentAvatar
  } finally {
    URL.revokeObjectURL(localPreview)
    e.target.value = '' // allow re-selecting the same file
  }
}
</script>

<style scoped>
.avatar-upload {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-upload__preview {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 999px;
  overflow: hidden;
  background: #1565C0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-upload__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-upload__initial {
  color: white;
  font-size: 24px;
  font-weight: 700;
}

.avatar-upload__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-upload__spinner {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.avatar-upload__actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.avatar-upload__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #1565C0;
  background: #E3F2FD;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
  width: fit-content;
}

.avatar-upload__btn:hover:not(:disabled) {
  background: #d3e9fb;
}

.avatar-upload__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.avatar-upload__error {
  font-size: 12px;
  color: #D32F2F;
  margin: 0;
}
</style>