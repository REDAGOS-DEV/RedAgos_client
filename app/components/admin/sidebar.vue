<template>
  <div>
    <!--
      Mobile overlay. The trigger that opens the drawer lives in the layout
      header, not floating over the page.
    -->
    <Transition name="scrim">
      <div v-if="mobileOpen" class="lg:hidden fixed inset-0 z-40 bg-slate-900/50" @click="closeMobile" />
    </Transition>

    <!--
      The other portals' rail (project owner, 2026-11-01). Desktop: 72px of
      icons under the full-width top bar, opened by the menu button in the bar
      only, and closed when the pointer leaves it (or a click lands outside, or
      Escape). The layout moves the content column over with it, so nothing is
      covered. Below 1024px it is the drawer.
    -->
    <aside
      id="admin-sidebar"
      ref="asideEl"
      aria-label="Super Admin navigation"
      class="sidebar fixed top-0 left-0 h-screen lg:top-16 lg:h-[calc(100vh-4rem)] z-50 flex flex-col w-[272px] lg:translate-x-0"
      :class="[
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        railOpen ? 'lg:w-64 is-hover-open' : 'lg:w-[72px]'
      ]"
      :style="{
        background: SIDEBAR_BG,
        boxShadow: sidebarShadow,
        '--sb-hover': SIDEBAR_HOVER_SOFT,
        '--sb-current-bg': SIDEBAR_CURRENT_BG,
        '--sb-current-text': SIDEBAR_ACTIVE_TEXT,
        '--sb-text': SIDEBAR_TEXT,
        '--sb-border': SIDEBAR_BORDER
      }"
      @pointerenter="cancelClose"
      @mouseleave="closeRailSoon"
      @focusout="onFocusOut">

      <!-- Close button (mobile drawer only) -->
      <button
        class="lg:hidden absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Close menu"
        :style="{ color: SIDEBAR_IDLE_TEXT }"
        @click="closeMobile">
        <AssetIcon name="x" :size="18" />
      </button>

      <!-- The drawer's brand row, height-matched to the top bar so the dividers line up. -->
      <NuxtLink
        to="/admin/dashboard"
        class="brand px-4 h-14 sm:h-16 flex lg:hidden items-center gap-3 border-b flex-shrink-0 select-none overflow-hidden"
        :style="{ borderColor: SIDEBAR_BORDER }"
        aria-label="RedAgos, go to the dashboard"
        @click="closeMobile">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img :src="logo" alt="" class="logo-image">
        </div>
        <div class="min-w-0 whitespace-nowrap">
          <p class="font-extrabold text-base leading-none" :style="{ color: SIDEBAR_HEADING_TEXT }">
            Red<span style="color:#D32F2F">Agos</span>
          </p>
          <p class="text-[12px] mt-0.5 truncate max-w-[160px]" :style="{ color: SIDEBAR_IDLE_TEXT }">
            Super Admin
          </p>
        </div>
      </NuxtLink>

      <!--
        The same rows on the rail and in the drawer. Three pages have no use for
        the other portals' folders, so the groups are rows: Dashboard on top, the
        work beneath a divider, and the accounts at the bottom, where the others
        keep Staff.
      -->
      <nav class="rail flex-1 overflow-y-auto overflow-x-hidden" aria-label="Super Admin pages">
        <NuxtLink
          v-for="item in topItems"
          :key="item.path"
          :to="item.path"
          class="rail-row"
          :class="{ 'is-current': isActive(item.path) }"
          :title="railOpen || isMobile ? null : item.label"
          :aria-current="isActive(item.path) ? 'page' : null"
          @click="closeMobile">
          <span class="icon-box"><AssetIcon :name="item.icon" :size="18" /></span>
          <span class="rail-row__label">{{ item.label }}</span>
        </NuxtLink>

        <div v-if="topItems.length && workItems.length" class="rail__divider" aria-hidden="true" />

        <NuxtLink
          v-for="item in workItems"
          :key="item.path"
          :to="item.path"
          class="rail-row"
          :class="{ 'is-current': isActive(item.path) }"
          :title="railOpen || isMobile ? null : item.label"
          :aria-current="isActive(item.path) ? 'page' : null"
          @click="closeMobile">
          <span class="icon-box"><AssetIcon :name="item.icon" :size="18" /></span>
          <span class="rail-row__label">{{ item.label }}</span>
        </NuxtLink>

        <div v-if="bottomItems.length" class="rail__bottom">
          <NuxtLink
            v-for="item in bottomItems"
            :key="item.path"
            :to="item.path"
            class="rail-row"
            :class="{ 'is-current': isActive(item.path) }"
            :title="railOpen || isMobile ? null : item.label"
            :aria-current="isActive(item.path) ? 'page' : null"
            @click="closeMobile">
            <span class="icon-box"><AssetIcon :name="item.icon" :size="18" /></span>
            <span class="rail-row__label">{{ item.label }}</span>
          </NuxtLink>
        </div>
      </nav>
    </aside>
  </div>
</template>

<script setup>
/*
 * Super Admin rail.
 *
 * `useSidebar('admin')` takes its own namespace, so another portal's open rail
 * cannot move this layout's content column.
 *
 * Navigation is filtered by privilege. This is presentation only — every route
 * behind these links is re-checked by `can:` middleware on the server — but
 * without it a Verification Officer would see an Organizations link that 403s
 * the moment it loads.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import logo from '~/assets/images/RedAgosLogo.png'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { useUser } from '~/composables/useUser'
import { useSidebar } from '~/composables/useSidebar.js'

const {
  collapsed,
  hoverExpanded,
  railExpanded,
  collapseOnHover,
  mobileOpen,
  closeMobile
} = useSidebar('admin')

const { user } = useUser()

const route = useRoute()

// --- Dark mode awareness ---
const isDark = ref(false)
let themeObserver = null

// --- Viewport awareness ---
// Below lg the sidebar is a drawer, so the rail's states do not apply there.
const isMobile = ref(false)
let mobileMql = null

const onViewportChange = (e) => {
  isMobile.value = e.matches
  // Dropping to drawer widths with the rail open would leave it — and the
  // content padding that tracks it — stuck open on the way back up.
  if (isMobile.value) closeRail()
}

/*
 * Opened by the menu button in the top bar (the layout) only; closed when the
 * pointer leaves the rail, a click lands outside it, Escape, or the button
 * again. The state lives in useSidebar, which the layout reads to move its
 * content column, so the two always agree.
 */
const railOpen = computed(() => !isMobile.value && railExpanded.value)

const asideEl = ref(null)
let railTimer = null

// Back on the rail before the close fires: keep it open.
function cancelClose() {
  clearTimeout(railTimer)
}

// A beat before closing, so brushing past the edge doesn't flicker it.
function closeRailSoon() {
  if (isMobile.value) return
  clearTimeout(railTimer)
  railTimer = setTimeout(closeRail, 160)
}

function closeRail() {
  clearTimeout(railTimer)
  collapseOnHover()
}

// Keyboard: stay open while focus is anywhere in the rail.
function onFocusOut(e) {
  if (isMobile.value) return
  if (asideEl.value?.contains(e.relatedTarget) || asideEl.value?.matches(':hover')) return
  closeRailSoon()
}

function onOutsidePointer(e) {
  if (!hoverExpanded.value) return
  // The menu button toggles on its own click; closing here first would reopen it.
  if (asideEl.value?.contains(e.target) || e.target.closest?.('[data-rail-toggle]')) return
  closeRail()
}

// Arriving on a page closes the rail, unless the pointer is still on it.
watch(() => route.path, () => {
  if (!asideEl.value?.matches(':hover')) closeRail()
})

const handleEscape = (e) => {
  if (e.key !== 'Escape') return
  if (mobileOpen.value) closeMobile()
  else if (hoverExpanded.value) closeRail()
}

onMounted(() => {
  // Narrow until the menu button opens it, like the other portals.
  collapsed.value = true

  isDark.value = document.documentElement.classList.contains('dark')
  themeObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  mobileMql = window.matchMedia('(max-width: 1023px)')
  isMobile.value = mobileMql.matches
  mobileMql.addEventListener('change', onViewportChange)
  window.addEventListener('keydown', handleEscape)
  document.addEventListener('pointerdown', onOutsidePointer)
})

onUnmounted(() => {
  clearTimeout(railTimer)
  document.removeEventListener('pointerdown', onOutsidePointer)
  themeObserver?.disconnect()
  mobileMql?.removeEventListener('change', onViewportChange)
  window.removeEventListener('keydown', handleEscape)
  if (typeof document !== 'undefined') document.body.style.removeProperty('overflow')
})

// The drawer covers the page; letting the page scroll under it is what makes a
// mobile menu feel broken.
watch(mobileOpen, (open) => {
  if (typeof document === 'undefined') return
  if (open) document.body.style.setProperty('overflow', 'hidden')
  else document.body.style.removeProperty('overflow')
})

// Light/dark theme tokens: the other portals' rail, so they read as one product.
// Solid, in the chrome colour the top bar shares (main.css, html.portal-bc).
const SIDEBAR_BG = computed(() => (isDark.value ? 'var(--rb-chrome, #1E293B)' : 'var(--rb-chrome, #FFFFFF)'))
const SIDEBAR_BORDER = computed(() => (isDark.value ? 'var(--ink-border, #334155)' : '#E5EAF0'))
const SIDEBAR_ACTIVE_TEXT = computed(() => (isDark.value ? 'var(--rb-primary-text)' : 'var(--rb-primary)'))
const SIDEBAR_IDLE_TEXT = computed(() => (isDark.value ? 'var(--ink-text-2, #94A3B8)' : '#64748B'))
const SIDEBAR_TEXT = computed(() => (isDark.value ? 'var(--ink-text-4, #E2E8F0)' : '#334155'))
const SIDEBAR_HEADING_TEXT = computed(() => (isDark.value ? 'var(--ink-text, #F1F5F9)' : '#1F2937'))
const SIDEBAR_CURRENT_BG = computed(() => (isDark.value ? 'color-mix(in srgb, var(--rb-primary-text) 14%, transparent)' : 'color-mix(in srgb, var(--rb-primary) 10%, white)'))
const SIDEBAR_HOVER_SOFT = computed(() => (isDark.value ? 'rgba(148,163,184,0.10)' : '#EEF1F5'))
const sidebarShadow = computed(() => '1px 0 0 ' + SIDEBAR_BORDER.value)

/*
 * `requires` names the privilege the page's endpoints are guarded by. An item
 * with none is reachable by any admin — the dashboard degrades to whatever the
 * account can actually read rather than being gated wholesale.
 */
const NAV = {
  top: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: 'layout-dashboard' },
  ],
  work: [
    { label: 'Organizations', path: '/admin/facilities', icon: 'building-2', requires: 'admin.facility.manage' },
    { label: 'ID Verification', path: '/admin/donor-identities', icon: 'id-card', requires: 'admin.donor_identity.verify' },
  ],
  bottom: [
    { label: 'Administrators', path: '/admin/administrators', icon: 'shield-check', requires: 'admin.accounts.manage' },
  ],
}

const held = computed(() => user.value?.permissions ?? [])
const visible = items => items.filter(item => !item.requires || held.value.includes(item.requires))
const topItems = computed(() => visible(NAV.top))
const workItems = computed(() => visible(NAV.work))
const bottomItems = computed(() => visible(NAV.bottom))

const isActive = (path) => {
  const current = route.path.replace(/\/$/, '')
  const target = path.replace(/\/$/, '')

  if (target === '/admin/dashboard') {
    return current === '/admin/dashboard' || current === '/admin'
  }

  return current === target || current.startsWith(`${target}/`)
}
</script>

<style scoped>
/*
 * The other portals' rail styles (components/BloodCenter/sidebar.vue). Width and
 * transform are the only animated properties, and they share the layout's
 * 200ms/ease-out so the rail and the content padding that tracks it move as one.
 */
.sidebar {
  will-change: width, transform;
  transition: width 200ms ease-out, transform 200ms ease-out;
}

.rail {
  display: flex;
  flex-direction: column;
  padding: 12px 12px 14px;
}
/* nav px-12 + row px-12 + the 24px icon box = the 36px icon axis */
.rail-row {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 9px 12px;
  margin-bottom: 2px;
  border-radius: 999px;
  color: var(--sb-text);
  font-size: var(--rb-fs-body);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-decoration: none;
  transition: background-color 150ms ease, color 150ms ease;
}
.rail-row:hover { background: var(--sb-hover); }
.rail-row:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }
.rail-row__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 150ms ease;
}
/* Narrow rail only: the drawer always shows its labels. */
@media (min-width: 1024px) {
  .sidebar:not(.is-hover-open) .rail-row__label { opacity: 0; }
}
.rail-row.is-current { background: var(--sb-current-bg); color: var(--sb-current-text); font-weight: 700; }

.icon-box {
  position: relative;
  width: 28px;
  height: 28px;
  margin: -2px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  transition: background-color 150ms ease;
}
/* Current page: the icon sits in a solid blue rounded square. */
.is-current .icon-box {
  border-radius: 8px;
  background: var(--rb-primary);
  color: #FFFFFF;
  box-shadow: 0 4px 10px -4px rgba(var(--rb-primary-rgb), 0.7);
}

.rail__divider { flex-shrink: 0; height: 1px; margin: 8px 4px; background: var(--sb-border); }
.rail__bottom {
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--sb-border);
}

/* The logo stands on its own, with no tile: it carries its own red and blue. */
.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.brand:focus-visible {
  outline: 2px solid var(--rb-primary-text);
  outline-offset: -2px;
}

/* No scrollbar gutter: a track would take its width off the content box and
   nudge every icon off the shared axis. The nav still scrolls. */
nav { scrollbar-width: none; }
nav::-webkit-scrollbar { width: 0; height: 0; }

.scrim-enter-active,
.scrim-leave-active { transition: opacity 200ms ease; }
.scrim-enter-from,
.scrim-leave-to { opacity: 0; }

/* Touch devices get a pressed state instead of a hover that never ends. */
@media (hover: none) {
  .rail-row { transition: background 0.1s ease, color 0.1s ease; }
  .rail-row:active {
    background: rgba(var(--rb-primary-rgb), 0.10) !important;
    color: var(--rb-primary) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rail-row,
  .rail-row__label,
  .sidebar,
  .scrim-enter-active,
  .scrim-leave-active {
    transition: none;
  }
}

a, button { touch-action: manipulation; }
</style>
