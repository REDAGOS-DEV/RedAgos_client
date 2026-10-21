<template>
  <!--
    Mobile and tablet only (below 1024px, where the sidebar becomes a drawer):
    the five things a donor reaches for, under the thumb. The Pass (QR code)
    sits raised in the middle, since it is what they open at the counter.
    The drawer still holds everything else (Settings, Help, Notifications).
  -->
  <nav class="bnav" aria-label="Donor quick navigation">
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.path"
      :to="tab.path"
      class="bnav__tab"
      :class="{ 'bnav__tab--on': isActive(tab), 'bnav__tab--pass': tab.pass }"
      :aria-current="isActive(tab) ? 'page' : undefined"
    >
      <span class="bnav__icon">
        <AssetIcon :name="tab.icon" :size="tab.pass ? 22 : 20" />
      </span>
      <span class="bnav__label">{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'
import AssetIcon from '~/components/common/AssetIcon.vue'

const route = useRoute()

// `also` lists the pages that belong to a tab, so it stays lit on them.
const TABS = [
  { label: 'Home', path: '/donor/dashboard', icon: 'house' },
  { label: 'Donate', path: '/donor/appointments', icon: 'calendar', also: ['/donor/eligibility'] },
  { label: 'Pass', path: '/donor/qrcode', icon: 'qr-code', pass: true },
  { label: 'History', path: '/donor/history', icon: 'history' },
  { label: 'Me', path: '/donor/profile', icon: 'user-circle', also: ['/donor/settings', '/donor/help', '/donor/notifications'] },
]

function isActive(tab) {
  const path = route.path.replace(/\/$/, '')
  return path === tab.path || (tab.also ?? []).includes(path)
}
</script>

<style scoped>
.bnav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 35;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: end;
  padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--rb-border, #E5EAF0);
  background-color: rgba(255, 255, 255, 0.86);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  backdrop-filter: blur(18px) saturate(140%);
  box-shadow: 0 -8px 24px -18px rgba(15, 23, 42, 0.35);
}
:global(.dark .bnav) {
  background-color: rgba(var(--ink-page-rgb, 15, 23, 42), 0.86);
  box-shadow: 0 -8px 24px -18px rgba(0, 0, 0, 0.7);
}
/* The sidebar takes over from 1024px (in CSS, not a lg:hidden class, which
   the display above would outrank). */
@media (min-width: 1024px) {
  .bnav { display: none; }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .bnav { background-color: var(--rb-surface, #FFFFFF); }
}

.bnav__tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-height: 52px;
  padding: 6px 2px 4px;
  border-radius: 14px;
  color: var(--rb-text-secondary, #64748B);
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.bnav__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 28px;
  border-radius: 999px;
  transition: background-color 150ms ease, color 150ms ease;
}
.bnav__label { font-size: 11px; font-weight: 600; line-height: 1.1; }

/* The current tab: a soft pill behind the icon, in the portal colour. */
.bnav__tab--on { color: var(--rb-primary-text, #1565C0); }
.bnav__tab--on .bnav__icon { background: rgba(var(--rb-primary-rgb, 21, 101, 192), 0.12); }
.bnav__tab--on .bnav__label { font-weight: 700; }

/* The Pass: raised above the bar, a solid circle in the portal colour. */
.bnav__tab--pass .bnav__icon {
  width: 52px;
  height: 52px;
  margin-top: -22px;
  border: 4px solid var(--rb-surface, #FFFFFF);
  background: var(--rb-primary, #1565C0);
  color: #fff;
  box-shadow: 0 8px 18px -8px rgba(var(--rb-primary-rgb, 21, 101, 192), 0.8);
}
.bnav__tab--pass.bnav__tab--on .bnav__icon { background: var(--rb-primary, #1565C0); }
:global(.dark .bnav__tab--pass .bnav__icon) { border-color: var(--ink-page, #0F172A); }

.bnav__tab:focus-visible { outline: 2px solid var(--rb-primary, #1565C0); outline-offset: -2px; }
.bnav__tab:active .bnav__icon { transform: scale(0.94); }

@media (prefers-reduced-motion: reduce) {
  .bnav__icon { transition: none; }
  .bnav__tab:active .bnav__icon { transform: none; }
}
</style>
