<template>
  <!--
    "Launching Workspace": covers the step from a sign-in that went through to
    a portal page with its data (composables/useWorkspaceLaunch.ts). The same
    light wash, logo and spinning loader as the sign-in screen it follows, so
    the hand-over reads as one motion. Mounted once in app.vue, above every
    layout, so it survives the route change.
  -->
  <Transition name="ws-launch">
    <div
      v-if="launching"
      class="ws-launch"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="ws-launch__stack">
        <img :src="logo" alt="" class="ws-launch__logo" width="64" height="64">
        <p class="ws-launch__brand">Red<span>Agos</span></p>

        <p class="ws-launch__label">
          <AssetIcon name="loader" :size="18" class="ws-launch__spinner" />
          Launching Workspace
        </p>

        <div class="ws-launch__track" aria-hidden="true">
          <span class="ws-launch__bar" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import AssetIcon from '~/components/common/AssetIcon.vue'
import logo from '~/assets/images/RedAgosLogo.png'

const { launching } = useWorkspaceLaunch()
</script>

<style scoped>
/* The sign-in screen's tokens (AuthShell): always light, blue for activity,
   red for the brand only. */
.ws-launch {
  --ws-text: #0B1F3A;
  --ws-muted: #475569;
  --ws-accent: #1565C0;
  --ws-accent-soft: rgba(21, 101, 192, 0.14);
  --ws-brand: #C62828;
  --ws-ease: cubic-bezier(0.16, 1, 0.3, 1);

  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  color-scheme: light;
  font-family: var(--rb-font-sans);
  color: var(--ws-text);
  -webkit-font-smoothing: antialiased;
  background:
    radial-gradient(45% 55% at 100% 0%, rgba(21, 101, 192, 0.16), transparent 70%),
    radial-gradient(40% 50% at 0% 100%, rgba(198, 40, 40, 0.08), transparent 70%),
    linear-gradient(180deg, #EAF2FC 0%, #F5F8FC 100%);
}

.ws-launch__stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.ws-launch__logo {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.ws-launch__brand {
  margin: 12px 0 0;
  font-size: 22px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.01em;
}
.ws-launch__brand span { color: var(--ws-brand); }

.ws-launch__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 28px 0 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ws-muted);
}
.ws-launch__spinner { color: var(--ws-accent); }

/* An indeterminate bar: no promise of how long, only that it is moving. */
.ws-launch__track {
  position: relative;
  width: 200px;
  height: 4px;
  margin-top: 16px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ws-accent-soft);
}
.ws-launch__bar {
  position: absolute;
  inset: 0 auto 0 0;
  width: 40%;
  border-radius: inherit;
  background: var(--ws-accent);
}

@media (prefers-reduced-motion: no-preference) {
  .ws-launch__stack { animation: ws-rise 480ms var(--ws-ease) both; }
  .ws-launch__spinner { animation: ws-spin 900ms linear infinite; }
  .ws-launch__bar { animation: ws-slide 1.3s var(--ws-ease) infinite; }
}

/* Reduced motion: the bar holds still and only breathes. */
@media (prefers-reduced-motion: reduce) {
  .ws-launch__bar {
    width: 100%;
    animation: ws-pulse 1.6s ease-in-out infinite;
  }
}

@keyframes ws-rise {
  from { opacity: 0; transform: translateY(8px); }
}
@keyframes ws-spin {
  to { transform: rotate(360deg); }
}
@keyframes ws-slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(250%); }
}
@keyframes ws-pulse {
  50% { opacity: 0.45; }
}

/* In quickly over the sign-in form; out a little slower onto the portal. */
.ws-launch-enter-active { transition: opacity 160ms ease-out; }
.ws-launch-leave-active { transition: opacity 280ms ease-in; }
.ws-launch-enter-from,
.ws-launch-leave-to { opacity: 0; }
</style>
