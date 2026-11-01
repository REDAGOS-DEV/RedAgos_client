<template>
  <!--
    Every portal's success and failure messages, at the top right under the top
    bar, clear of the tables and pagers below (project owner, 2026-11-01). The
    toast waits while the pointer is on it, so it can be read to the end.
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
          <AssetIcon :name="ICONS[toast.tone]" :size="15" />
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

const ICONS = { success: 'check', error: 'x', warning: 'triangle-alert', info: 'info' }

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
  top: 76px;
  right: 20px;
  z-index: 400;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(380px, calc(100vw - 24px));
  pointer-events: none;
}

.app-toast {
  --toast-rgb: var(--rb-success-rgb);
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 13px 12px 15px 14px;
  overflow: hidden;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
  box-shadow: 0 18px 44px -18px rgba(15, 23, 42, 0.4), 0 2px 6px rgba(15, 23, 42, 0.08);
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
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgb(var(--toast-rgb));
  color: #FFFFFF;
}
.app-toast__text { flex: 1; min-width: 0; padding-top: 2px; }
.app-toast__title { margin: 0; font-size: 13.5px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; color: var(--rb-text-primary); }
.app-toast__message { margin: 2px 0 0; font-size: 12.5px; line-height: 1.45; overflow-wrap: anywhere; color: var(--rb-text-secondary); }

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
.app-toast__close:hover { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.app-toast__close:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; }

/* How long is left: quiet, so the message is what is read. */
.app-toast__time {
  position: absolute;
  inset: auto 0 0;
  height: 2px;
  background: rgba(var(--toast-rgb), 0.55);
  transform-origin: left;
  animation: app-toast-time linear forwards;
}
.app-toast__time--held { animation-play-state: paused; }
@keyframes app-toast-time { from { transform: scaleX(1); } to { transform: scaleX(0); } }

.app-toast-enter-active { transition: opacity 0.2s ease, transform 0.26s cubic-bezier(0.16, 1, 0.3, 1); }
.app-toast-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.app-toast-move { transition: transform 0.2s ease; }
.app-toast-enter-from { opacity: 0; transform: translateX(18px); }
.app-toast-leave-to { opacity: 0; transform: translateX(10px); }

@media (prefers-reduced-motion: reduce) {
  .app-toast-enter-active, .app-toast-leave-active, .app-toast-move { transition: none; }
  .app-toast__time { display: none; }
}
@media (max-width: 640px) {
  .toaster { top: 68px; right: 12px; }
}
</style>
