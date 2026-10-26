<template>
  <!--
    The dialog useConfirmDialog() opens. A card in the middle of the screen;
    on phones a sheet from the bottom with full-width buttons. The safe button
    comes first, so it is the one focused and the one Enter presses.
  -->
  <Transition name="confirm">
    <div v-if="dialog" class="confirm-backdrop" @click.self="settle(false)">
      <div
        class="confirm-card"
        :class="`confirm-card--${dialog.tone}`"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        :aria-describedby="dialog.message ? 'confirm-dialog-message' : undefined"
        v-focus-trap
        @dialog-escape="settle(false)"
      >
        <div class="confirm-card__head">
          <span class="confirm-card__icon" aria-hidden="true">
            <AssetIcon :name="dialog.icon || TONE_ICONS[dialog.tone]" :size="20" />
          </span>
          <h2 id="confirm-dialog-title" class="confirm-card__title">{{ dialog.title }}</h2>
        </div>
        <p v-if="dialog.message" id="confirm-dialog-message" class="confirm-card__message">{{ dialog.message }}</p>
        <div class="confirm-card__actions">
          <button type="button" class="confirm-btn confirm-btn--safe" @click="settle(false)">
            {{ dialog.cancelLabel }}
          </button>
          <button type="button" class="confirm-btn confirm-btn--go" @click="settle(true)">
            {{ dialog.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { useConfirmDialog } from '~/composables/useConfirmDialog'

const { dialog, settle } = useConfirmDialog()

const TONE_ICONS = {
  info: 'info',
  warning: 'triangle-alert',
  danger: 'circle-alert',
}

// Leaving the page with the dialog open counts as "no".
const route = useRoute()
watch(() => route.path, () => {
  if (dialog.value) settle(false)
})
</script>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
}

.confirm-card {
  --tone-bg: rgba(var(--rb-primary-rgb), 0.1);
  --tone-fg: var(--rb-primary-text, var(--rb-primary));
  --go-bg: var(--rb-primary);
  --go-hover: var(--rb-primary-hover, var(--rb-primary));
  width: 100%;
  max-width: 420px;
  padding: 22px;
  border-radius: 18px;
  background: var(--rb-surface, #FFFFFF);
  box-shadow: 0 20px 48px -12px rgba(15, 23, 42, 0.35);
}
.confirm-card--warning { --tone-bg: #FFF4E5; --tone-fg: #B45309; }
.confirm-card--danger {
  --tone-bg: #FDECEC;
  --tone-fg: #C62828;
  --go-bg: #C62828;
  --go-hover: #B71C1C;
}

.confirm-card__head { display: flex; align-items: center; gap: 12px; }
.confirm-card__icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--tone-bg);
  color: var(--tone-fg);
}
.confirm-card__title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--rb-text-primary, #1F2937);
}
.confirm-card__message {
  margin: 12px 0 0;
  font-size: var(--rb-fs-small, 14px);
  line-height: 1.55;
  color: var(--rb-text-secondary, #64748B);
}

.confirm-card__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.confirm-btn {
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  font: inherit;
  font-size: var(--rb-fs-small, 14px);
  font-weight: 700;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}
.confirm-btn:active { transform: translateY(1px); }
.confirm-btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.confirm-btn--safe {
  border: 1px solid var(--rb-border, #E2E8F0);
  background: transparent;
  color: var(--rb-text-primary, #1F2937);
}
.confirm-btn--safe:hover { background: var(--rb-surface-hover, #F1F5F9); }
.confirm-btn--go { border: 0; background: var(--go-bg); color: #FFFFFF; }
.confirm-btn--go:hover { background: var(--go-hover); }

/* Dark: the card is the portal's surface; the tone tints soften. */
html.dark .confirm-card { background: var(--ink-surface, #1E293B); box-shadow: 0 20px 48px -12px rgba(0, 0, 0, 0.6); }
html.dark .confirm-card--warning { --tone-bg: rgba(245, 124, 0, 0.16); --tone-fg: #FFB74D; }
html.dark .confirm-card--danger { --tone-bg: rgba(239, 83, 80, 0.16); --tone-fg: #EF9A9A; }
html.dark .confirm-card--info { --tone-bg: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); }
html.dark .confirm-btn--safe { border-color: var(--ink-border, #334155); }
html.dark .confirm-btn--safe:hover { background: var(--ink-hover, #263449); }

/* Phones: a sheet from the bottom, the go button on top, both full width. */
@media (max-width: 639px) {
  .confirm-backdrop { align-items: flex-end; padding: 0; }
  .confirm-card {
    max-width: none;
    padding: 20px 16px calc(16px + env(safe-area-inset-bottom));
    border-radius: 20px 20px 0 0;
  }
  .confirm-card__actions { flex-direction: column-reverse; }
  .confirm-btn { min-height: 46px; }
}

.confirm-enter-active,
.confirm-leave-active { transition: opacity 160ms ease; }
.confirm-enter-active .confirm-card,
.confirm-leave-active .confirm-card { transition: transform 180ms ease; }
.confirm-enter-from,
.confirm-leave-to { opacity: 0; }
.confirm-enter-from .confirm-card,
.confirm-leave-to .confirm-card { transform: translateY(8px) scale(0.98); }
@media (max-width: 639px) {
  .confirm-enter-from .confirm-card,
  .confirm-leave-to .confirm-card { transform: translateY(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .confirm-enter-active,
  .confirm-leave-active,
  .confirm-enter-active .confirm-card,
  .confirm-leave-active .confirm-card { transition: none; }
}
</style>
