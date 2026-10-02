<template>
  <div class="dialog-backdrop" @click.self="!busy && $emit('close')">
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unit-reason-title"
      v-focus-trap
      @dialog-escape="!busy && $emit('close')"
    >
      <h2 id="unit-reason-title" class="dialog__title">
        <AssetIcon :name="icon" :size="17" />
        {{ title }}
      </h2>

      <p class="dialog__body">
        <slot />
      </p>

      <label class="field">
        <span class="field__label">{{ label }}</span>
        <textarea
          ref="inputRef"
          v-model="reason"
          class="field__input"
          rows="2"
          maxlength="255"
          required
          :aria-invalid="Boolean(error) || undefined"
        />
      </label>

      <p v-if="error" class="dialog__error" role="alert">{{ error }}</p>

      <div class="dialog__actions">
        <button
          type="button"
          class="btn"
          :class="danger ? 'btn--danger' : 'btn--primary'"
          :disabled="busy || !reason.trim()"
          @click="$emit('confirm', reason.trim())"
        >
          {{ busy ? 'Working…' : confirmLabel }}
        </button>
        <button type="button" class="btn" :disabled="busy" @click="$emit('close')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Ask for the reason behind a bag action that must be accounted for.
 *
 * Releasing a tag and discarding a bag both require one — the API refuses
 * either without it — so the confirm button stays disabled until there is
 * text. The wording around it is the caller's, passed in the default slot.
 */

import { nextTick, onMounted, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

defineProps({
  title: { type: String, required: true },
  label: { type: String, default: 'Reason' },
  confirmLabel: { type: String, required: true },
  icon: { type: String, default: 'circle-x' },
  danger: { type: Boolean, default: true },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

defineEmits(['confirm', 'close'])

const reason = ref('')
const inputRef = ref(null)

onMounted(() => nextTick(() => inputRef.value?.focus()))
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css; nothing is redeclared here. */
.dialog-backdrop {
  position: fixed; inset: 0; z-index: 320;
  display: grid; place-items: center; padding: 16px;
  background: var(--rb-overlay);
}
.dialog {
  width: min(460px, 100%);
  max-height: calc(100vh - 32px); overflow: auto;
  display: flex; flex-direction: column; gap: 12px;
  padding: 20px; border-radius: 14px;
  background: var(--rb-surface); border: 1px solid var(--rb-border);
  color: var(--rb-text-primary);
}
.dialog:focus { outline: none; }
.dialog__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; font-weight: 700; }
.dialog__body { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--rb-text-secondary); }
.dialog__error { margin: 0; font-size: 12.5px; color: var(--rb-accent-text); }
.dialog__actions { display: flex; gap: 10px; }

.field { display: flex; flex-direction: column; gap: 5px; }
.field__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.field__input {
  width: 100%; padding: 9px 11px; font: inherit; font-size: 13.5px; resize: vertical;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.field__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.12); }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 16px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 9px; cursor: pointer; white-space: nowrap;
  background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong);
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn--primary { background: var(--rb-primary); color: #fff; border-color: var(--rb-primary); }
.btn--primary:hover:not(:disabled) { background: #10509c; }
.btn--danger { background: var(--rb-accent); color: #fff; border-color: var(--rb-accent); }
.btn--danger:hover:not(:disabled) { opacity: .9; background: var(--rb-accent); }
.btn:disabled { opacity: .55; cursor: not-allowed; }

@media (max-width: 520px) {
  .dialog__actions { flex-direction: column-reverse; }
  .dialog__actions > * { width: 100%; }
}
</style>
