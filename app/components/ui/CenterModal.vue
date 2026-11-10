<template>
  <!--
    A dialog in the middle of the screen (project owner, 2026-11-01): the header
    stays, the body scrolls, the footer holds the actions. On the body, above the
    portal's top bar. Back inside its page while that page is kept but not shown.
  -->
  <Teleport to="body" :disabled="pageHidden">
    <Transition name="center-modal" appear>
      <div v-if="open" class="cm" @mousedown.self="$emit('close')">
        <div
          v-focus-trap
          class="cm__panel"
          :class="`cm__panel--${size}`"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          @dialog-escape="$emit('close')"
        >
          <header class="cm__head">
            <div class="cm__titles">
              <p v-if="eyebrow" class="cm__eyebrow">{{ eyebrow }}</p>
              <h2 :id="titleId" class="cm__title">{{ title }}</h2>
              <div v-if="$slots.meta" class="cm__meta"><slot name="meta" /></div>
            </div>
            <button type="button" class="ui-btn ui-btn--icon" aria-label="Close" @click="$emit('close')">
              <AssetIcon name="x" :size="18" />
            </button>
          </header>

          <div class="cm__body"><slot /></div>

          <footer v-if="$slots.actions" class="cm__foot"><slot name="actions" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { usePageHidden } from '~/composables/useKeptAlive'

const props = defineProps({
  open: { type: Boolean, default: true },
  title: { type: String, required: true },
  eyebrow: { type: String, default: '' },
  // sm a question, md a summary, lg a whole record.
  size: { type: String, default: 'md' },
})

defineEmits(['close'])

const titleId = useId()

const pageHidden = usePageHidden()

// The page behind does not scroll under the dialog. Released while its page is
// kept but not shown, or the next page could not scroll.
watch(() => props.open && !pageHidden.value, (lock) => {
  if (typeof document !== 'undefined') document.body.style.overflow = lock ? 'hidden' : ''
}, { immediate: true })
onBeforeUnmount(() => { document.body.style.overflow = '' })
</script>

<style scoped>
.cm {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.5);
}
.cm__panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: calc(100dvh - 48px);
  border: 1px solid var(--rb-border);
  border-radius: 18px;
  background: var(--rb-surface);
  box-shadow: 0 28px 70px -24px rgba(15, 23, 42, 0.55);
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}
.cm__panel:focus { outline: none; }
.cm__panel--sm { max-width: 460px; }
.cm__panel--md { max-width: 760px; }
.cm__panel--lg { max-width: 1120px; }

.cm__head {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--rb-border);
}
.cm__titles { min-width: 0; }
.cm__eyebrow { margin: 0 0 2px; font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.cm__title { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; color: var(--rb-text-primary); }
.cm__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; color: var(--rb-text-secondary); }

.cm__body { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 24px 24px; }
.cm__foot {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 24px;
  border-top: 1px solid var(--rb-border);
}

.center-modal-enter-active, .center-modal-leave-active { transition: opacity 0.18s ease; }
.center-modal-enter-active .cm__panel, .center-modal-leave-active .cm__panel { transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.center-modal-enter-from, .center-modal-leave-to { opacity: 0; }
.center-modal-enter-from .cm__panel, .center-modal-leave-to .cm__panel { transform: translateY(8px) scale(0.98); }

@media (prefers-reduced-motion: reduce) {
  .center-modal-enter-active, .center-modal-leave-active,
  .center-modal-enter-active .cm__panel, .center-modal-leave-active .cm__panel { transition: none; }
}
@media (max-width: 640px) {
  .cm { padding: 12px; }
  .cm__panel { max-height: calc(100dvh - 24px); }
  .cm__head, .cm__body, .cm__foot { padding-inline: 16px; }
}
</style>
