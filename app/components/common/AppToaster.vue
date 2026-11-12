<template>
  <!--
    Every portal's success and failure messages, at the bottom right, the newest
    nearest the corner (project owner, 2026-11-11; they were at the top right).
    The toast waits while the pointer is on it, so it can be read to the end.
  -->
  <div class="toaster" aria-live="polite">
    <TransitionGroup name="app-toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="app-toast"
        :class="`app-toast--${toast.tone}`"
        :role="toast.tone === 'error' ? 'alert' : 'status'"
        @mouseenter="hold(toast)"
        @mouseleave="release(toast)"
      >
        <span class="app-toast__icon" aria-hidden="true">
          <AssetIcon :name="ICONS[toast.tone]" :size="18" />
        </span>
        <div class="app-toast__text">
          <p class="app-toast__title">{{ toast.title }}</p>
          <p v-if="toast.message" class="app-toast__message">{{ toast.message }}</p>
        </div>
        <button type="button" class="app-toast__close" aria-label="Dismiss" @click="close(toast)">
          <AssetIcon name="x" :size="14" />
        </button>
        <span
          class="app-toast__time"
          :class="{ 'app-toast__time--held': held === toast.id }"
          :style="{ animationDuration: `${toast.duration}ms` }"
          aria-hidden="true"
        />
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { useToast } from '~/composables/useToast'

const ICONS = { success: 'check-circle', error: 'triangle-alert', warning: 'circle-alert', info: 'info' }

const { toasts, dismiss } = useToast()

// Each toast's own clock, which stops while the pointer rests on it.
const clocks = new Map()
const held = ref(null)

function start(toast, ms) {
  clocks.set(toast.id, { left: ms, startedAt: Date.now(), timer: setTimeout(() => close(toast), ms) })
}

watch(toasts, (list) => {
  for (const toast of list) {
    if (!clocks.has(toast.id)) start(toast, toast.duration)
  }
  for (const [id, clock] of clocks) {
    if (!list.some((toast) => toast.id === id)) {
      clearTimeout(clock.timer)
      clocks.delete(id)
    }
  }
})

function hold(toast) {
  const clock = clocks.get(toast.id)
  if (!clock) return
  clearTimeout(clock.timer)
  clock.left -= Date.now() - clock.startedAt
  held.value = toast.id
}

function release(toast) {
  const clock = clocks.get(toast.id)
  if (!clock) return
  held.value = null
  start(toast, Math.max(1000, clock.left))
}

function close(toast) {
  if (held.value === toast.id) held.value = null
  dismiss(toast.id)
}

onUnmounted(() => clocks.forEach((clock) => clearTimeout(clock.timer)))
</script>

<style scoped>
.toaster {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 400;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(372px, calc(100vw - 24px));
  pointer-events: none;
}

.app-toast {
  --toast-rgb: var(--rb-success-rgb);
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 14px 16px 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(var(--toast-rgb), 0.13) 0%, rgba(var(--toast-rgb), 0.04) 60%, rgba(var(--toast-rgb), 0.02) 100%),
    var(--rb-surface);
  box-shadow:
    0 18px 40px -16px rgba(var(--toast-rgb), 0.35),
    0 8px 24px -12px rgba(15, 23, 42, 0.18),
    inset 0 0 0 1px rgba(var(--toast-rgb), 0.08);
  font-family: var(--rb-font-sans);
  pointer-events: auto;
}
.app-toast--error { --toast-rgb: var(--rb-accent-rgb); }
.app-toast--warning { --toast-rgb: var(--rb-warning-rgb); }
.app-toast--info { --toast-rgb: var(--rb-primary-rgb); }

.app-toast__icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--rb-surface);
  color: rgb(var(--toast-rgb));
  box-shadow: 0 4px 12px -4px rgba(var(--toast-rgb), 0.45), 0 0 0 1px rgba(var(--toast-rgb), 0.08);
}
.app-toast__text { flex: 1; min-width: 0; padding-top: 2px; }
.app-toast__title { margin: 0; font-size: 14px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; color: var(--rb-text-primary); }
.app-toast__message { margin: 3px 0 0; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; color: var(--rb-text-secondary); }

.app-toast__close {
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--rb-text-secondary);
  cursor: pointer;
}
.app-toast__close:hover { background: rgba(var(--toast-rgb), 0.1); color: var(--rb-text-primary); }
.app-toast__close:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; }

/* How long is left: drawn invisibly, the card itself kept clean. */
.app-toast__time {
  position: absolute;
  inset: auto 0 0;
  height: 2px;
  background: transparent;
  transform-origin: left;
  animation: app-toast-time linear forwards;
}
.app-toast__time--held { animation-play-state: paused; }
@keyframes app-toast-time { from { transform: scaleX(1); } to { transform: scaleX(0); } }

.app-toast-enter-active { transition: opacity 0.2s ease, transform 0.26s cubic-bezier(0.16, 1, 0.3, 1); }
.app-toast-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.app-toast-move { transition: transform 0.2s ease; }
.app-toast-enter-from { opacity: 0; transform: translateY(14px) scale(0.98); }
.app-toast-leave-to { opacity: 0; transform: translateX(16px); }

html.dark .app-toast {
  border-color: rgba(255, 255, 255, 0.07);
  background:
    linear-gradient(180deg, rgba(var(--toast-rgb), 0.15) 0%, rgba(var(--toast-rgb), 0.05) 65%, rgba(var(--toast-rgb), 0.03) 100%),
    var(--rb-surface);
  box-shadow: 0 18px 40px -14px rgba(0, 0, 0, 0.65), inset 0 0 0 1px rgba(var(--toast-rgb), 0.12);
}
html.dark .app-toast__icon { background: var(--rb-surface-alt); box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(var(--toast-rgb), 0.18); }

@media (prefers-reduced-motion: reduce) {
  .app-toast-enter-active, .app-toast-leave-active, .app-toast-move { transition: none; }
  .app-toast__time { display: none; }
}
@media (max-width: 640px) {
  .toaster { bottom: 12px; right: 12px; }
}
</style>

<style>
/* While a dialog is open, the toasts rise clear of its footer buttons. */
html:has([aria-modal="true"]) .toaster { bottom: 96px; }
</style>
