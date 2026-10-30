<template>
  <Transition name="dqs" appear>
    <div class="modal-overlay" @click.self="close">
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="qr-scan-title">
        <div class="modal-card__header">
          <h2 id="qr-scan-title" class="modal-card__title">
            <AssetIcon name="qr-code" :size="17" />
            Scan the Donor Portal QR
          </h2>
          <button type="button" class="modal-card__close" aria-label="Close" @click="close">
            <AssetIcon name="x" :size="18" />
          </button>
        </div>

        <div class="modal-card__body">
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>

          <BloodCenterQrScanner ref="scannerRef" :busy="busy" :show-manual="false" @scanned="onScanned" />

          <p class="form-hint">
            A walk-in, or a donor without their QR, is started from
            <NuxtLink to="/blood-center/donors" class="text-link">Donor Management</NuxtLink>.
          </p>
        </div>

        <div class="modal-card__footer">
          <button type="button" class="btn-outline" :disabled="busy" @click="close">Cancel</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
/**
 * The Donor Portal QR scan, opened from the Donations page (project owner,
 * 2026-10-24: it moved there from the Donation Counter).
 *
 * The code is verified here, so a refused one is answered while the camera is
 * still on; a good one is handed to the counter in memory (useCounterHandoff)
 * and the counter opens with the donor, their booking and any visit already
 * under way. The token never goes into the address.
 */

import AssetIcon from '~/components/common/AssetIcon.vue'
import BloodCenterQrScanner from '~/components/BloodCenter/QrScanner.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { useCounterHandoff } from '~/composables/useDonationTransaction'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits(['close'])

const handoff = useCounterHandoff()
const scannerRef = ref(null)
const busy = ref(false)
const error = ref('')

function close() {
  if (busy.value) return
  scannerRef.value?.stop()
  emit('close')
}

function messageFor(err) {
  if (err?.status === 429) return 'Too many scans just now. Wait a moment and try again.'
  if (err?.data?.code === 'qr_invalid') return 'That QR code is not valid. Start the donor from Donor Management instead.'
  if (err?.data?.code === 'donor_not_found') return 'That QR code is not linked to a donor.'
  return err?.message || 'The QR code could not be checked. Try again.'
}

async function onScanned(token) {
  busy.value = true
  error.value = ''

  try {
    const result = await bloodCenterService.verifyDonorQr(token)
    scannerRef.value?.stop()
    handoff.value = { data: result?.data ?? null }
    busy.value = false
    await navigateTo('/blood-center/donation')
    emit('close')
  } catch (err) {
    error.value = messageFor(err)
    // The camera stays on so the donor can simply try again; the scanner
    // forgets the refused code or the same frame re-submits.
    scannerRef.value?.reset()
    busy.value = false
  }
}

function onKeydown(event) {
  if (event.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--rb-overlay);
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

.modal-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 40px);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
}

.modal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.modal-card__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15.5px; font-weight: 700; }
.modal-card__title :deep(.asset-icon) { color: var(--rb-text-secondary); }

.modal-card__close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: none;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.modal-card__close:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }
.modal-card__body { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; overflow-y: auto; min-height: 0; }

.modal-card__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.form-hint { margin: 0; font-size: 12px; line-height: 1.45; color: var(--rb-text-secondary); }
.text-link { color: var(--rb-primary-text); font-weight: 600; text-decoration: none; }
.text-link:hover { text-decoration: underline; }

.form-error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-accent-text);
  font-size: 13px;
  line-height: 1.45;
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-outline:focus-visible,
.modal-card__close:focus-visible,
.text-link:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

.dqs-enter-active { transition: opacity 0.18s ease; }
.dqs-enter-from { opacity: 0; }

@media (max-width: 760px) {
  .modal-overlay { padding: 10px; align-items: flex-end; }
}

@media (prefers-reduced-motion: reduce) {
  .dqs-enter-active { transition: none; }
}
</style>
