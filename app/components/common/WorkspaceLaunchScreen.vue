<template>
  <!--
    "Launching Workspace": covers the step from a sign-in that went through to
    a portal page with its data (composables/useWorkspaceLaunch.ts). The logo is
    the loader (project owner, 2026-11-01): colour flows up the drop, over and
    over, for as long as the wait lasts, never claiming how far along it is.
    Mounted once in app.vue, above every layout, so it survives the route change.
  -->
  <Transition name="ws-launch">
    <div
      v-if="launching"
      class="ws-launch"
      :class="{ 'ws-launch--dark': dark }"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="ws-launch__stack">
        <div class="ws-launch__drop" :style="{ '--ws-logo': `url(${logo})` }" aria-hidden="true">
          <img :src="logo" alt="" class="ws-launch__logo ws-launch__logo--empty" width="96" height="96">
          <img :src="logo" alt="" class="ws-launch__logo ws-launch__logo--filled" width="96" height="96">
        </div>
        <p class="ws-launch__brand">Red<span>Agos</span></p>
        <p class="ws-launch__label">Preparing your workspace</p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import logo from '~/assets/images/RedAgosLogo.png'

const { launching } = useWorkspaceLaunch()

/*
 * The theme the portal is about to open in. Sign-in stays light and <html> only
 * turns dark when a portal layout mounts, partway through this screen, so
 * following html.dark would flash light, then dark. Same rule as useDarkMode.
 */
const dark = ref(false)
watch(launching, (on) => {
  if (!on) return
  const stored = localStorage.getItem('theme')
  dark.value = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
})
</script>

<style scoped>
/* Frosted glass in the portals' canvas colour: whatever is behind shows through, blurred. */
.ws-launch {
  --ws-canvas: rgba(245, 246, 248, 0.62);
  --ws-text: #0B1F3A;
  --ws-muted: #475569;
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
  background: var(--ws-canvas);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  backdrop-filter: blur(22px) saturate(1.5);
}
.ws-launch--dark {
  --ws-canvas: rgba(32, 33, 36, 0.84);
  --ws-text: #E8EAED;
  --ws-muted: #BDC1C6;
  --ws-brand: #FF8A8A;
  color-scheme: dark;
}

/* No frosting to read through in this browser: the canvas, solid. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .ws-launch { --ws-canvas: #F5F6F8; }
  .ws-launch--dark { --ws-canvas: #202124; }
}

.ws-launch__stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.ws-launch__drop {
  position: relative;
  width: 96px;
  height: 96px;
}
.ws-launch__logo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
/* Only there to be filled: without motion the full logo stands alone. */
.ws-launch__logo--empty { display: none; }

.ws-launch__brand {
  margin: 14px 0 0;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.01em;
}
.ws-launch__brand span { color: var(--ws-brand); }

.ws-launch__label {
  margin: 8px 0 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--ws-muted);
}

@media (prefers-reduced-motion: no-preference) {
  .ws-launch__stack { animation: ws-rise 480ms var(--ws-ease) both; }

  /* Before the colour arrives the drop is tinted glass in its own colours, not grey. */
  .ws-launch__logo--empty {
    display: block;
    filter: saturate(1.15) drop-shadow(0 6px 14px rgba(21, 101, 192, 0.22));
    opacity: 0.34;
  }
  .ws-launch--dark .ws-launch__logo--empty {
    filter: saturate(1.15) drop-shadow(0 6px 14px rgba(0, 0, 0, 0.45));
    opacity: 0.42;
  }

  /* The glass's shine, in the logo's exact shape, over the tint and the colour alike. */
  .ws-launch__drop::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.22) 38%, rgba(255, 255, 255, 0) 62%);
    -webkit-mask: var(--ws-logo) center / contain no-repeat;
    mask: var(--ws-logo) center / contain no-repeat;
    pointer-events: none;
  }
  .ws-launch--dark .ws-launch__drop::after {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.38) 0%, rgba(255, 255, 255, 0.12) 38%, rgba(255, 255, 255, 0) 62%);
  }

  /*
   * A wave one drop wide, solid beneath its crest. Sliding it sideways is the
   * ripple; sliding it up is the rising colour.
   */
  .ws-launch__logo--filled {
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='200'%3E%3Cpath d='M0 8Q24 0 48 8T96 8V200H0Z'/%3E%3C/svg%3E") 0 96px / 96px 200px repeat-x;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='200'%3E%3Cpath d='M0 8Q24 0 48 8T96 8V200H0Z'/%3E%3C/svg%3E") 0 96px / 96px 200px repeat-x;
    animation: ws-fill 2.4s linear infinite;
  }
}

@keyframes ws-rise {
  from { opacity: 0; transform: translateY(8px); }
}
/* Up the drop, a moment full, then it fades and flows again: never a 100% that waits. */
@keyframes ws-fill {
  0% { -webkit-mask-position: 0 96px; mask-position: 0 96px; opacity: 1; }
  78% { -webkit-mask-position: -288px -18px; mask-position: -288px -18px; opacity: 1; }
  90% { -webkit-mask-position: -288px -18px; mask-position: -288px -18px; opacity: 1; }
  100% { -webkit-mask-position: -288px -18px; mask-position: -288px -18px; opacity: 0; }
}

/* In quickly over the sign-in form; out a little slower onto the portal. */
.ws-launch-enter-active { transition: opacity 160ms ease-out; }
.ws-launch-leave-active { transition: opacity 280ms ease-in; }
.ws-launch-enter-from,
.ws-launch-leave-to { opacity: 0; }
</style>
