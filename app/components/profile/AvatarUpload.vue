<template>
  <div class="avatar-upload">
    <!--
      __frame is the positioning context and does NOT clip. Only __preview
      clips, so the circular crop still applies to the photo while the camera
      badge can sit on the circle's edge without being cut off by the
      overflow:hidden that the crop requires.
    -->
    <div class="avatar-upload__frame">
      <div class="avatar-upload__preview">
        <img v-if="previewUrl" :src="previewUrl" alt="Profile photo" class="avatar-upload__img">
        <span v-else class="avatar-upload__initial">{{ fallbackInitial }}</span>

        <div v-if="uploading" class="avatar-upload__overlay">
          <div class="avatar-upload__spinner" />
        </div>
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
        class="avatar-upload__badge"
        :disabled="uploading"
        aria-label="Change photo"
        @click="fileInput.click()"
      >
        <AssetIcon name="camera" :size="14" />
      </button>
    </div>

    <p v-if="error" class="avatar-upload__error">{{ error }}</p>
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.avatar-upload__frame {
  position: relative;
  width: 96px;
  height: 96px;
  flex-shrink: 0;
}

.avatar-upload__preview {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 999px;
  overflow: hidden;
  background: #1565C0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}

.avatar-upload__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-upload__initial {
  color: white;
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
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

/* Separate floating control on the circle's lower-right edge. Anchored to
   __frame (not __preview) so the crop cannot clip it. */
.avatar-upload__badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: white;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
  color: #1565C0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease;
}

.avatar-upload__badge:hover:not(:disabled) {
  background: #E3F2FD;
}

.avatar-upload__badge:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.avatar-upload__badge :deep(svg) {
  display: block;
  flex-shrink: 0;
}

.avatar-upload__error {
  font-size: 12px;
  color: #D32F2F;
  margin: 0;
}
</style>
