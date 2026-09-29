<template>
  <div class="dialog-backdrop" @click.self="!busy && $emit('close')">
    <div
      ref="dialogRef"
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-line-title"
      tabindex="-1"
      @keydown.esc="!busy && $emit('close')"
    >
      <h2 id="close-line-title" class="dialog__title">
        <AssetIcon name="circle-x" :size="17" />
        Close the remaining {{ row.component }}?
      </h2>

      <p class="dialog__body">
        <template v-if="side === 'centre'">
          The remaining <strong>{{ row.allocatable }} unit{{ row.allocatable === 1 ? '' : 's' }}</strong> will be recorded as
          unavailable at this blood center. The request keeps what was asked for, and the hospital can still ask another
          facility for the rest.
        </template>
        <template v-else-if="side === 'requirement'">
          The remaining <strong>{{ row.allocatable }} unit{{ row.allocatable === 1 ? '' : 's' }}</strong> will be recorded as
          no longer needed. Every facility still asked for them stops being asked; units already approved stay the
          patient's.
        </template>
        <template v-else>
          The remaining <strong>{{ row.allocatable }} unit{{ row.allocatable === 1 ? '' : 's' }}</strong> will be recorded as
          no longer needed. The request keeps what was asked for, but the rest can no longer be sourced from any facility.
        </template>
      </p>

      <p v-if="row.reserved > 0" class="dialog__hint">
        {{ row.reserved }} reserved unit{{ row.reserved === 1 ? ' stays' : 's stay' }} reserved and can still be released.
      </p>

      <label class="field">
        <span class="field__label">{{ side === 'centre' ? 'Why it cannot be supplied' : 'Note' }} (optional)</span>
        <textarea v-model="note" class="field__input" rows="2" maxlength="255" />
      </label>

      <p v-if="error" class="dialog__error" role="alert">{{ error }}</p>

      <div class="dialog__actions">
        <button type="button" class="btn btn--danger" :disabled="busy" @click="$emit('confirm', note.trim() || null)">
          {{ busy ? 'Closing…' : 'Close remaining' }}
        </button>
        <button type="button" class="btn" :disabled="busy" @click="$emit('close')">Keep it open</button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Confirm closing the rest of one request line.
 *
 * Worded per side because the consequence differs: what a centre could not
 * supply may still come from another facility; what a hospital no longer needs
 * may not; and closing it on a Patient Transfusion Request ("requirement")
 * stops every facility still asked for it at once.
 */

import { nextTick, onMounted, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

defineProps({
  row: { type: Object, required: true },
  side: { type: String, required: true, validator: (value) => ['centre', 'hospital', 'requirement'].includes(value) },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

defineEmits(['confirm', 'close'])

const note = ref('')
const dialogRef = ref(null)

onMounted(() => nextTick(() => dialogRef.value?.focus()))
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 320;
  display: grid;
  place-items: center;
  padding: 16px;
  background: var(--rb-overlay);
}

.dialog {
  width: min(480px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 1.25rem 1.35rem;
  border-radius: 14px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  outline: none;
}

.dialog__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.05rem;
}

.dialog__body,
.dialog__hint {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.dialog__body strong {
  color: var(--rb-text-primary);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field__label {
  font-size: 0.8rem;
  font-weight: 600;
}

.field__input {
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
}

.dialog__error {
  margin: 0;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  background: rgba(var(--rb-accent-rgb), 0.12);
  color: var(--rb-accent-text);
  font-size: 0.82rem;
}

.dialog__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.5rem 0.95rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: transparent;
  color: var(--rb-text-primary);
  font-weight: 600;
  font-size: 0.84rem;
  cursor: pointer;
}

.btn--danger {
  border-color: transparent;
  background: var(--rb-accent);
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
