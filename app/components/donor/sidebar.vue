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
      Collapse rule: the left edge never moves. Every icon (logo, folders,
      pages, settings) sits on the same 36px axis in both states, and the
      labels are not removed when collapsing: the rail's right edge slides
      over them. Only the width animates.
    -->
    <aside
      aria-label="Donor navigation"
      class="sidebar fixed top-0 left-0 h-screen z-50 flex flex-col w-[272px] lg:translate-x-0"
      :class="[
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        railCollapsed ? 'lg:w-[72px]' : 'lg:w-64'
      ]"
      :style="{ background: SIDEBAR_BG, boxShadow: sidebarShadow, '--sb-hover': SIDEBAR_HOVER_SOFT }"
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
        Height-matched to the topbar (h-14 / sm:h-16) so the dividers line up.
        px-4 + a 40px mark puts the logo's centre on the 36px axis.
      -->
      <div
        class="brand px-4 h-14 sm:h-16 flex items-center gap-3 border-b flex-shrink-0 cursor-pointer select-none overflow-hidden"
        :style="{ borderColor: SIDEBAR_BORDER }"
        role="link"
        tabindex="0"
        aria-label="RedAgos, go to the dashboard"
        @click="goToDashboard"
        @keydown.enter.prevent="goToDashboard"
        @keydown.space.prevent="goToDashboard">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative"
          style="background: var(--rb-primary)">
          <img v-if="!logoLoading" :src="logo" alt="RedAgos" class="logo-image">
          <span v-else class="logo-spinner" />
        </div>

        <div class="label min-w-0 whitespace-nowrap" :class="{ 'label--hidden': !showLabels }">
          <p class="logo-name font-extrabold text-base leading-none" :style="{ color: SIDEBAR_HEADING_TEXT }">
            Red<span style="color:#D32F2F">Agos</span>
          </p>
          <p class="text-[12px] mt-0.5 truncate" :style="{ color: SIDEBAR_IDLE_TEXT }">
            Donor Portal
          </p>
        </div>
      </div>

      <!-- Navigation: nav px-3 + item px-3 + a 24px icon box = 36px axis -->
      <nav class="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-3 pb-4" :class="isDark ? 'nav-dark' : ''">
        <!-- Top-level pages. Active = filled blue pill. -->
        <NuxtLink v-for="item in topItems" :key="item.path" :to="item.path"
          class="nav-item"
          :class="{ 'is-current': isActive(item.path) }"
          :title="railCollapsed && !isMobile ? item.label : null"
          :aria-current="isActive(item.path) ? 'page' : null"
          :style="navStyle(item.path)"
          @click="closeSidebar"
          @mouseenter="hoveredPath = item.path"
          @mouseleave="hoveredPath = null">
          <span class="icon-box">
            <AssetIcon :name="item.icon" :size="18" />
          </span>
          <span class="label flex-1 min-w-0 truncate" :class="{ 'label--hidden': !showLabels }">{{ item.label }}</span>
        </NuxtLink>

        <!--
          Folders. Pages sit indented under their folder. The folder holding
          the current page gets a blue folder icon; on the slim rail, where its
          pages are hidden, it also gets the soft pill so the donor can still
          see where they are.
        -->
        <div v-for="folder in folders" :key="folder.key" class="folder">
          <button
            type="button"
            class="folder-head"
            :class="{ 'has-current': folderHasActive(folder) }"
            :aria-expanded="isOpen(folder.key)"
            :aria-controls="`folder-${folder.key}`"
            :title="railCollapsed && !isMobile ? folder.label : null"
            :style="folderStyle(folder)"
            @click="onFolderClick(folder.key)">
            <span class="icon-box">
              <AssetIcon :name="folder.icon" :size="18" />
            </span>
            <span class="label flex-1 min-w-0 truncate text-left" :class="{ 'label--hidden': !showLabels }">{{ folder.label }}</span>
            <AssetIcon name="chevron-down" :size="14" class="label folder-chevron" :class="{ 'label--hidden': !showLabels, 'folder-chevron--closed': !isOpen(folder.key) }" />
          </button>

          <div
            v-show="isOpen(folder.key) && showLabels"
            :id="`folder-${folder.key}`"
            class="folder-body">
            <NuxtLink v-for="item in folder.items" :key="item.path" :to="item.path"
              class="nav-item nav-item--child"
              :class="{ 'is-current': isActive(item.path) }"
              :aria-current="isActive(item.path) ? 'page' : null"
              :style="childStyle(item.path)"
              @click="closeSidebar"
              @mouseenter="hoveredPath = item.path"
              @mouseleave="hoveredPath = null">
              <span class="icon-box">
                <AssetIcon :name="item.icon" :size="18" />
              </span>
              <span class="label flex-1 min-w-0 truncate">{{ item.label }}</span>
              <span v-if="item.badge && questionnaireStatus"
                class="text-[12px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                :style="badgeStyle">
                {{ qrLabel }}
              </span>
            </NuxtLink>
          </div>
        </div>

        <!-- Settings / Help -->
        <div class="mt-3 border-t pt-3" :style="{ borderColor: SIDEBAR_BORDER }">
          <NuxtLink v-for="item in bottomItems" :key="item.path" :to="item.path"
            class="nav-item"
            :class="{ 'is-current': isActive(item.path) }"
            :title="railCollapsed && !isMobile ? item.label : null"
            :aria-current="isActive(item.path) ? 'page' : null"
            :style="navStyle(item.path)"
            @click="closeSidebar"
            @mouseenter="hoveredPath = item.path"
            @mouseleave="hoveredPath = null">
            <span class="icon-box">
              <AssetIcon :name="item.icon" :size="18" />
            </span>
            <span class="label flex-1 min-w-0 truncate" :class="{ 'label--hidden': !showLabels }">{{ item.label }}</span>
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
 * Desktop: a 72px rail that widens to 256px on hover (or keyboard focus).
 * Only the right edge moves: every icon stays on the same 36px axis, and
 * the labels are clipped by the edge rather than removed. The layout reflows the content column
 * beside it. Below 1024px it is a full drawer.
 *
 * Pages are grouped into folders that open and close; the folder holding the
 * current page opens on its own.
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
  collapsed,
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
  // (and the content padding that tracks it) stuck open on the way back up.
  if (isMobile.value) collapseOnHover()
}

/*
 * Leaving is deferred by a beat. Without it a pointer crossing the rail's own
 * edge, which moves as the sidebar widens, can fire leave/enter in quick
 * succession and flicker.
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

/** The rail's visual state on desktop. The drawer is always full width. */
const railCollapsed = computed(() => !railExpanded.value)

/** Whether labels/text should render at all. */
const showLabels = computed(() => isMobile.value || railExpanded.value)

const handleEscape = (e) => {
  if (e.key !== 'Escape') return
  if (mobileOpen.value) closeMobile()
  else if (hoverExpanded.value) collapseOnHover()
}

onMounted(() => {
  // Hover rail: always starts collapsed. (A click-to-pin choice from an
  // earlier build may still be stored; it no longer applies.)
  collapsed.value = true
  restoreFolders()

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
// Frosted glass over the layout's themed backdrop (blur in the styles).
const SIDEBAR_BG = computed(() => (isDark.value ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.55)'))
const SIDEBAR_BORDER = computed(() => (isDark.value ? '#334155' : '#E5EAF0'))
const SIDEBAR_ACTIVE_TEXT = computed(() => (isDark.value ? 'var(--rb-primary-text)' : 'var(--rb-primary)'))
// Two text levels. Primary: top-level rows and folder names (Dashboard,
// Donate, My Records, Settings, Help). Secondary: pages inside a folder.
const SIDEBAR_IDLE_TEXT = computed(() => (isDark.value ? '#94A3B8' : '#64748B'))
const SIDEBAR_FOLDER_TEXT = computed(() => (isDark.value ? '#E2E8F0' : '#334155'))
const SIDEBAR_HEADING_TEXT = computed(() => (isDark.value ? '#F1F5F9' : '#1F2937'))
const SIDEBAR_CURRENT_BG = computed(() => (isDark.value ? 'color-mix(in srgb, var(--rb-primary-text) 14%, transparent)' : 'color-mix(in srgb, var(--rb-primary) 10%, white)'))
const SIDEBAR_HOVER_SOFT = computed(() => (isDark.value ? 'rgba(148,163,184,0.10)' : '#EEF1F5'))
const sidebarShadow = computed(() =>
  isDark.value
    ? `1px 0 0 ${SIDEBAR_BORDER.value}, 4px 0 24px rgba(0,0,0,0.35)`
    : `1px 0 0 ${SIDEBAR_BORDER.value}, 4px 0 24px rgba(15,23,42,0.04)`
)

// The questionnaire, not eligibility_status: every screening is recorded
// `pending` until the centre decides, so that one never reads as valid.
const questionnaireStatus = ref(null)
const qrValid = computed(() => questionnaireStatus.value === 'answered')
const qrLabel = computed(() => (qrValid.value ? 'Valid' : questionnaireStatus.value === 'expired' ? 'Expired' : 'Pending'))

const badgeStyle = computed(() => {
  const eligible = qrValid.value
  return {
    background: eligible
      ? (isDark.value ? 'rgba(76,175,80,0.18)' : 'rgba(46,125,50,0.10)')
      : (isDark.value ? '#334155' : '#F1F5F9'),
    color: eligible
      ? (isDark.value ? '#81C784' : '#2E7D32')
      : SIDEBAR_IDLE_TEXT.value
  }
})

const topItems = [
  { label: 'Dashboard', path: '/donor/dashboard', icon: 'house' }
]

const folders = [
  {
    key: 'donate',
    label: 'Donate',
    icon: 'blood-drop',
    items: [
      { label: 'Eligibility Screening', path: '/donor/eligibility', icon: 'clipboard-check' },
      { label: 'Book Appointment', path: '/donor/appointments', icon: 'calendar' }
    ]
  },
  {
    key: 'records',
    label: 'My Records',
    icon: 'file-text',
    items: [
      { label: 'Donation History', path: '/donor/history', icon: 'history' },
      { label: 'My QR Code', path: '/donor/qrcode', icon: 'qr-code', badge: true },
      { label: 'My Profile', path: '/donor/profile', icon: 'user-circle' }
    ]
  }
]

// ── Folder open/closed state, remembered across reloads ──
const FOLDERS_KEY = 'redagos:donor-sidebar-folders'
const openFolders = ref(Object.fromEntries(folders.map(f => [f.key, true])))

function restoreFolders() {
  try {
    const stored = JSON.parse(localStorage.getItem(FOLDERS_KEY) || 'null')
    if (stored && typeof stored === 'object') openFolders.value = { ...openFolders.value, ...stored }
  } catch {
    // Unreadable or blocked: every folder starts open.
  }
  openActiveFolder()
}

function saveFolders() {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(openFolders.value))
  } catch {
    // Storage blocked: the folders still work for this visit.
  }
}

const isOpen = key => openFolders.value[key] !== false
const folderHasActive = folder => folder.items.some(item => isActive(item.path))

function toggleFolder(key) {
  openFolders.value = { ...openFolders.value, [key]: !isOpen(key) }
  saveFolders()
}

// The current page must never be hidden inside a closed folder.
function openActiveFolder() {
  const folder = folders.find(f => folderHasActive(f))
  if (folder && !isOpen(folder.key)) {
    openFolders.value = { ...openFolders.value, [folder.key]: true }
    saveFolders()
  }
}

watch(() => route.path, () => openActiveFolder())

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
    questionnaireStatus.value = dashboard.questionnaire_status || 'not_answered'
  } catch (err) {
    console.error(err)
  }
}

onMounted(loadUser)

// The rail outlives every page, so a questionnaire answered just now would
// leave the badge on "Pending" until a reload. Re-read it on the way out.
watch(() => route.path, (to, from) => {
  if (from === '/donor/eligibility' && to !== from) loadUser()
})

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

// Current page: soft blue pill with blue text (the icon chip carries the
// strong colour, see .is-current in the styles). Hover: a light grey.
const rowStyle = (active, hovered, level) => {
  if (active) return { background: SIDEBAR_CURRENT_BG.value, color: SIDEBAR_ACTIVE_TEXT.value, fontWeight: '700' }
  const primary = level === 'primary'
  return {
    background: hovered ? SIDEBAR_HOVER_SOFT.value : 'transparent',
    color: primary || hovered ? SIDEBAR_FOLDER_TEXT.value : SIDEBAR_IDLE_TEXT.value,
    fontWeight: primary ? '600' : '500'
  }
}

const navStyle = path => rowStyle(isActive(path), hoveredPath.value === path, 'primary')
const childStyle = path => rowStyle(isActive(path), hoveredPath.value === path, 'secondary')

// The folder holding the current page: dark bold text and a blue icon. On the
// slim rail its pages are hidden, so it takes the soft pill there instead.
const folderStyle = (folder) => {
  const holds = folderHasActive(folder)
  return {
    background: holds && !showLabels.value ? SIDEBAR_CURRENT_BG.value : undefined,
    color: SIDEBAR_FOLDER_TEXT.value,
    fontWeight: '600'
  }
}

// Hovering already widens the rail, so a folder click just opens or closes it.
function onFolderClick(key) {
  toggleFolder(key)
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
  -webkit-backdrop-filter: saturate(170%) blur(18px);
  backdrop-filter: saturate(170%) blur(18px);
  will-change: width, transform;
  transition: width 200ms ease-out, transform 200ms ease-out;
}

/* ── Rows: icon on the fixed axis, label clipped by the rail's edge ── */
.nav-item,
.folder-head {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 9px 12px;
  margin-bottom: 2px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font: inherit;
  font-size: var(--rb-fs-body);
  white-space: nowrap;
  overflow: hidden;
  text-decoration: none;
  transition: background-color 150ms ease, color 150ms ease;
}
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
.label { transition: opacity 150ms ease; }
.label--hidden { opacity: 0; }

/* ── Folders ── */
.folder { margin-top: 6px; }
/* Same size and weight as the top-level rows: both are primary text. */
.folder-head {
  cursor: pointer;
}
.folder-head:hover { background: var(--sb-hover, #EEF1F5); }

/* Current page: the icon sits in a solid blue rounded square. */
.is-current .icon-box {
  border-radius: 8px;
  background: var(--rb-primary);
  color: #FFFFFF;
  box-shadow: 0 4px 10px -4px rgba(var(--rb-primary-rgb), 0.7);
}
.has-current .icon-box { color: var(--rb-primary); }
.folder-chevron {
  flex-shrink: 0;
  transition: transform 180ms ease, opacity 150ms ease;
}
.folder-chevron--closed { transform: rotate(-90deg); }
/* A folder's pages sit indented under it (no guide line). */
.folder-body {
  margin: 2px 0 6px;
  padding-left: 22px;
}
.nav-item--child {
  padding-top: 8px;
  padding-bottom: 8px;
  font-size: var(--rb-fs-body);
}
.status-dot {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
}
.folder-head:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }

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

/*
 * No scrollbar gutter, open or collapsed: a track would take its width off
 * the content box and nudge every icon off the shared axis.
 */
nav {
  scrollbar-width: none;
}

nav::-webkit-scrollbar {
  width: 0;
  height: 0;
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
    background: rgba(var(--rb-primary-rgb), 0.10) !important;
    color: var(--rb-primary) !important;
  }
}

/* No blur available: a solid rail. (Reduced transparency keeps the glass: the
   rail sits over a still gradient, not over content.) */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .sidebar { background: var(--rb-page-bg, #F7F8FA) !important; }
}

@media (prefers-reduced-motion: reduce) {
  .folder-chevron,
  .label,
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
