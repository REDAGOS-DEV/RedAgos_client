<template>
  <div>
    <!--
      Mobile overlay. The trigger that opens the drawer lives in the layout
      header, not floating over the page, so the header needs no permanent
      left gutter to clear it at desktop widths.
    -->
    <Transition name="scrim">
      <div v-if="mobileOpen" class="lg:hidden fixed inset-0 z-40 bg-slate-900/50" @click="closeMobile" />
    </Transition>

    <aside
      aria-label="Donor navigation"
      class="sidebar fixed top-0 left-0 h-screen z-50 flex flex-col overflow-hidden w-[272px] lg:translate-x-0"
      :class="[
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        railCollapsed ? 'lg:w-20' : 'lg:w-64'
      ]"
      :style="{ background: SIDEBAR_BG, boxShadow: sidebarShadow }"
      @mouseenter="handleSidebarEnter"
      @mouseleave="handleSidebarLeave"
      @focusin="handleSidebarEnter"
      @focusout="handleSidebarLeave">

      <!-- Close button (mobile drawer only) -->
      <button
        class="lg:hidden absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Close menu"
        :style="{ color: SIDEBAR_IDLE_TEXT }"
        @click="closeMobile">
        <AssetIcon name="x" :size="18" />
      </button>

      <!--
        The brand row is height-matched to the topbar (h-14 / sm:h-16) so the
        sidebar's divider lines up with the header's instead of sitting a few
        pixels adrift.
      -->
      <div
        class="brand px-5 h-14 sm:h-16 flex items-center gap-3 border-b flex-shrink-0 transition-colors duration-150 cursor-pointer select-none"
        :class="railCollapsed && !isMobile ? 'lg:justify-center lg:px-0' : ''"
        :style="{ borderColor: SIDEBAR_BORDER }"
        role="link"
        tabindex="0"
        aria-label="RedAgos — go to the dashboard"
        @click="goToDashboard"
        @keydown.enter.prevent="goToDashboard"
        @keydown.space.prevent="goToDashboard">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative"
          style="background: #1565C0">
          <img v-if="!logoLoading" :src="logo" alt="RedAgos" class="logo-image">
          <span v-else class="logo-spinner" />
        </div>

        <div v-if="showLabels" class="min-w-0 whitespace-nowrap">
          <h1 class="font-extrabold text-base leading-none" :style="{ color: SIDEBAR_HEADING_TEXT }">
            Red<span style="color:#D32F2F">Agos</span>
          </h1>
          <p class="text-[11px] mt-0.5 truncate" :style="{ color: SIDEBAR_IDLE_TEXT }">
            Donor Portal
          </p>
        </div>
      </div>

      <!-- Navigation -->
      <nav
        class="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-3 pb-4"
        :class="[isDark ? 'nav-dark' : '', railCollapsed && !isMobile ? 'nav-rail' : '']">
        <template v-for="(group, gIndex) in navGroups" :key="group.label || gIndex">
          <!--
            A collapsed rail has no room for a group heading, so the groups are
            separated by a rule instead. The heading itself now shows wherever
            the labels are readable — it used to be `group.label && isMobile`,
            which left the hover-expanded desktop rail as the one place in the
            product where these clusters were unlabelled.
          -->
          <div v-if="!showLabels" class="group-rule" :class="gIndex === 0 ? 'is-first' : ''"
            :style="{ background: SIDEBAR_BORDER }" />

          <p v-else-if="group.label"
            class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 mb-1"
            :class="gIndex === 0 ? 'mt-1' : 'mt-4'"
            :style="{ color: SIDEBAR_IDLE_TEXT }">
            <span class="w-3 h-[2px] rounded-full flex-shrink-0"
              :style="{ background: isDark ? '#475569' : '#CBD5E1' }" />
            {{ group.label }}
          </p>

          <NuxtLink v-for="item in group.items" :key="item.path" :to="item.path"
            class="nav-item flex items-center gap-3 px-3 py-2.5 mb-1 rounded-[10px] text-sm transition-colors duration-150"
            :class="railCollapsed && !isMobile ? 'lg:justify-center lg:px-0' : ''"
            :title="railCollapsed && !isMobile ? item.label : null"
            :aria-current="isActive(item.path) ? 'page' : null"
            :style="navStyle(item.path)"
            @click="closeSidebar"
            @mouseenter="hoveredPath = item.path"
            @mouseleave="hoveredPath = null"
            @touchstart="() => { }">
            <span
              class="relative flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 transition-colors duration-150"
              :style="{ background: isActive(item.path) ? '#1565C0' : 'transparent' }">
              <AssetIcon :name="item.icon" :size="14"
                :style="{ color: isActive(item.path) ? '#ffffff' : 'currentColor' }" />
              <!-- A status pill does not fit the rail, so it becomes a dot -->
              <span v-if="!showLabels && item.badge && eligibilityStatus"
                class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                :style="{
                  background: eligibilityStatus === 'eligible' ? '#2E7D32' : '#F57C00',
                  boxShadow: '0 0 0 2px ' + SIDEBAR_BG
                }" />
            </span>

            <span v-if="showLabels" class="flex-1 min-w-0 truncate whitespace-nowrap">{{ item.label }}</span>

            <span v-if="showLabels && item.badge && eligibilityStatus"
              class="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
              :style="badgeStyle">
              {{ eligibilityStatus === 'eligible' ? 'Valid' : eligibilityStatus }}
            </span>
          </NuxtLink>
        </template>

        <!-- Settings / Help -->
        <div class="mt-4 border-t pt-3" :style="{ borderColor: SIDEBAR_BORDER }">
          <NuxtLink v-for="item in bottomItems" :key="item.path" :to="item.path"
            class="nav-item flex items-center gap-3 px-3 py-2.5 mb-1 rounded-[10px] text-sm transition-colors duration-150"
            :class="railCollapsed && !isMobile ? 'lg:justify-center lg:px-0' : ''"
            :title="railCollapsed && !isMobile ? item.label : null"
            :aria-current="isActive(item.path) ? 'page' : null"
            :style="navStyle(item.path)"
            @click="closeSidebar"
            @mouseenter="hoveredPath = item.path"
            @mouseleave="hoveredPath = null"
            @touchstart="() => { }">
            <span class="flex items-center justify-center w-6 h-6 flex-shrink-0">
              <AssetIcon :name="item.icon" :size="16" />
            </span>
            <span v-if="showLabels" class="flex-1 min-w-0 truncate whitespace-nowrap">{{ item.label }}</span>
          </NuxtLink>
        </div>
      </nav>
    </aside>
  </div>
</template>

<script setup>
/*
 * Donor rail.
 *
 * Behaviour matches the blood-centre rail: collapsed to 80px on desktop and
 * widened on hover, with the layout *reflowing* the content column beside it
 * rather than letting the widened rail float over the page, and a full drawer
 * below 1024px.
 *
 * `useSidebar()` keeps the unnamespaced 'donor' bucket it has always used.
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logo from '~/assets/images/RedAgosLogo.png'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { useUser } from '~/composables/useUser'
import { donorService } from '~/api/donor/DonorService'
import { useSidebar } from '~/composables/useSidebar.js'

const {
  hoverExpanded,
  railExpanded,
  expandOnHover,
  collapseOnHover,
  mobileOpen,
  closeMobile
} = useSidebar()

const route = useRoute()
const router = useRouter()
const { user, fetchUser } = useUser()

// --- Dark mode awareness ---
const isDark = ref(false)
let themeObserver = null

// --- Viewport awareness ---
// Below lg the sidebar is a drawer, so hover must not apply there at all.
const isMobile = ref(false)
let mobileMql = null

const onViewportChange = (e) => {
  // The no-event branch used to read `!mobileMql.matches`, which was inverted.
  // It never fired — onMounted assigns directly — but it was a trap for the
  // next caller.
  isMobile.value = e ? e.matches : mobileMql.matches
  // Dropping to drawer widths with a hover still latched would leave the rail
  // — and the content padding that tracks it — stuck open on the way back up.
  if (isMobile.value) collapseOnHover()
}

/** The rail's visual state: collapsed unless hovered, or unless it is a drawer. */
const railCollapsed = computed(() => !railExpanded.value)

/** Whether labels/text should render at all. */
const showLabels = computed(() => isMobile.value || railExpanded.value)

/*
 * Leaving is deferred by a beat. Without it a pointer crossing the rail's own
 * edge — which moves out from under the cursor as the sidebar widens and the
 * content reflows — can fire leave/enter in quick succession and flicker.
 */
let leaveTimer = null

const handleSidebarEnter = () => {
  if (isMobile.value) return
  clearTimeout(leaveTimer)
  expandOnHover()
}

const handleSidebarLeave = () => {
  if (isMobile.value) return
  clearTimeout(leaveTimer)
  leaveTimer = setTimeout(collapseOnHover, 120)
}

const handleEscape = (e) => {
  if (e.key !== 'Escape') return
  if (mobileOpen.value) closeMobile()
  else if (hoverExpanded.value) collapseOnHover()
}

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  themeObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  mobileMql = window.matchMedia('(max-width: 1023px)')
  isMobile.value = mobileMql.matches
  mobileMql.addEventListener('change', onViewportChange)
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  clearTimeout(leaveTimer)
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

// Light/dark theme tokens — the same palette the blood-centre and admin rails
// use, so the portals read as one product.
const SIDEBAR_BG = computed(() => (isDark.value ? '#0F172A' : '#F7F8FA'))
const SIDEBAR_BORDER = computed(() => (isDark.value ? '#334155' : '#E5EAF0'))
const SIDEBAR_ACTIVE_BG = computed(() => (isDark.value ? 'rgba(66,165,245,0.16)' : 'rgba(21,101,192,0.08)'))
const SIDEBAR_HOVER_BG = computed(() => (isDark.value ? 'rgba(148,163,184,0.12)' : 'rgba(21,101,192,0.06)'))
const SIDEBAR_ACTIVE_TEXT = computed(() => (isDark.value ? '#64B5F6' : '#1565C0'))
const SIDEBAR_IDLE_TEXT = computed(() => (isDark.value ? '#94A3B8' : '#64748B'))
const SIDEBAR_HEADING_TEXT = computed(() => (isDark.value ? '#F1F5F9' : '#1F2937'))
const sidebarShadow = computed(() =>
  isDark.value
    ? `1px 0 0 ${SIDEBAR_BORDER.value}, 4px 0 24px rgba(0,0,0,0.35)`
    : `1px 0 0 ${SIDEBAR_BORDER.value}, 4px 0 24px rgba(15,23,42,0.04)`
)

const eligibilityStatus = ref(null)

const badgeStyle = computed(() => {
  const eligible = eligibilityStatus.value === 'eligible'
  return {
    background: eligible
      ? (isDark.value ? 'rgba(76,175,80,0.18)' : 'rgba(46,125,50,0.10)')
      : (isDark.value ? '#334155' : '#F1F5F9'),
    color: eligible
      ? (isDark.value ? '#81C784' : '#2E7D32')
      : SIDEBAR_IDLE_TEXT.value
  }
})

const navGroups = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', path: '/donor/dashboard', icon: 'house' }
    ]
  },
  {
    label: 'Donors',
    items: [
      { label: 'Eligibility Screening', path: '/donor/eligibility', icon: 'clipboard-check' },
      { label: 'Book Appointment', path: '/donor/appointments', icon: 'calendar' }
    ]
  },
  {
    label: 'Records',
    items: [
      { label: 'Donation History', path: '/donor/history', icon: 'history' },
      { label: 'My QR Code', path: '/donor/qrcode', icon: 'qr-code', badge: true },
      { label: 'My Profile', path: '/donor/profile', icon: 'user-circle' }
    ]
  }
]

const bottomItems = [
  { label: 'Settings', path: '/donor/settings', icon: 'settings' },
  { label: 'Help', path: '/donor/help', icon: 'help-circle' }
]

const loadUser = async () => {
  try {
    if (!user.value) {
      await fetchUser()
    }

    const dashboard = await donorService.dashboard()
    eligibilityStatus.value = dashboard.eligibility_status || 'pending'
  } catch (err) {
    console.error(err)
  }
}

onMounted(loadUser)

const closeSidebar = () => {
  closeMobile()
}

const hoveredPath = ref(null)

// Exact Active Path Matcher (Ig-login, matic dynamic subay sa route)
const isActive = (path) => {
  const currentPath = route.path.replace(/\/$/, '')
  const targetPath = path.replace(/\/$/, '')

  if (targetPath === '/donor/dashboard') {
    return currentPath === '/donor/dashboard' || currentPath === '/donor'
  }

  return currentPath === targetPath
}

const navStyle = (path) => {
  const active = isActive(path)
  const hovered = hoveredPath.value === path

  let background = 'transparent'
  if (active) background = SIDEBAR_ACTIVE_BG.value
  else if (hovered) background = SIDEBAR_HOVER_BG.value

  return {
    background,
    color: active || hovered ? SIDEBAR_ACTIVE_TEXT.value : SIDEBAR_IDLE_TEXT.value,
    fontWeight: active ? '700' : '500'
  }
}

// Clickable logo
const logoLoading = ref(false)

const goToDashboard = async () => {
  if (route.path === '/donor/dashboard' || logoLoading.value) return
  logoLoading.value = true
  closeSidebar()
  try {
    await router.push('/donor/dashboard')
  } finally {
    logoLoading.value = false
  }
}
</script>

<style scoped>
/*
 * Width and transform are the only animated properties, and they share the
 * layout's 200ms/ease-out so the rail and the content padding that tracks it
 * move as one. Animating anything that repaints the whole nav during the same
 * window is what makes a hover rail read as flicker.
 */
.sidebar {
  will-change: width, transform;
  transition: width 200ms ease-out, transform 200ms ease-out;
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 6px;
}

.logo-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Divider standing in for the group heading while the rail is collapsed. */
.group-rule {
  height: 1px;
  margin: 10px 12px;
  border-radius: 999px;
}

.group-rule.is-first {
  display: none;
}

/*
 * The focus ring reads its colour from the token rather than a second
 * :global(.dark) rule. This build's scoped-CSS transform drops the descendant
 * half of `:global(.dark) .x` and emits a bare `.dark { … }`, which puts the
 * declaration on <html> instead. The token flips on its own, so no second rule
 * is needed.
 */
.brand:focus-visible,
.nav-item:focus-visible {
  outline: 2px solid var(--rb-primary-text);
  outline-offset: -2px;
}

/* Sidebar navigation scrollbar */
nav {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

/*
 * No scrollbar gutter while the rail is collapsed. A 5px track inside an 80px
 * rail takes its 5px off the content box, so the centred icons rendered 2.5px
 * left of centre while the brand mark above them — which sits outside this
 * scroller — stayed on 40px.
 */
.nav-rail {
  scrollbar-width: none;
}

.nav-rail::-webkit-scrollbar {
  width: 0;
  height: 0;
}

nav::-webkit-scrollbar {
  width: 5px;
}

nav::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 999px;
}

nav::-webkit-scrollbar-track {
  background: transparent;
}

.nav-dark::-webkit-scrollbar-thumb {
  background-color: #334155;
}

.nav-dark {
  scrollbar-color: #334155 transparent;
}

.scrim-enter-active,
.scrim-leave-active {
  transition: opacity 200ms ease;
}

.scrim-enter-from,
.scrim-leave-to {
  opacity: 0;
}

/* Touch devices get a pressed state instead of a hover that never ends. */
@media (hover: none) {
  .nav-item {
    transition: background 0.1s ease, color 0.1s ease;
  }

  .nav-item:active {
    background: rgba(21, 101, 192, 0.10) !important;
    color: #1565C0 !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .scrim-enter-active,
  .scrim-leave-active {
    transition: none;
  }

  .logo-spinner {
    animation: none;
  }
}

a, button {
  touch-action: manipulation;
}
</style>
