<template>
  <div>
    <!-- Mobile overlay -->
    <Transition name="scrim">
      <div v-if="mobileOpen" class="lg:hidden fixed inset-0 z-40 bg-slate-900/50" @click="closeMobile" />
    </Transition>

    <!--
      The blood center's rail: glass over the glow, every icon on one axis in
      both states, labels clipped (not removed) as the rail narrows. Only the
      width animates.
    -->
    <aside
      aria-label="Hospital navigation"
      class="sidebar fixed top-0 left-0 h-screen z-50 flex flex-col w-[272px] lg:translate-x-0"
      :class="[mobileOpen ? 'translate-x-0' : '-translate-x-full', railCollapsed ? 'lg:w-[72px]' : 'lg:w-64']"
      :style="{ background: SIDEBAR_BG, boxShadow: sidebarShadow, '--sb-hover': SIDEBAR_HOVER_SOFT }"
      @mouseenter="handleSidebarEnter"
      @mouseleave="handleSidebarLeave"
      @focusin="handleSidebarEnter"
      @focusout="handleSidebarLeave">
      <!-- Close button (mobile) -->
      <button
        class="lg:hidden absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Close menu"
        :style="{ color: SIDEBAR_IDLE_TEXT }"
        @click="closeMobile">
        <AssetIcon name="x" :size="18" />
      </button>

      <!-- Logo: height-matched to the top bar so the dividers line up -->
      <div class="px-4 h-14 sm:h-16 flex items-center gap-3 border-b flex-shrink-0 overflow-hidden" :style="{ borderColor: SIDEBAR_BORDER }">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden" style="background: var(--rb-primary)">
          <img :src="logo" alt="RedAgos Logo" class="logo-image">
        </div>

        <div class="label min-w-0 whitespace-nowrap" :class="{ 'label--hidden': !showLabels }">
          <h1 class="font-extrabold text-base leading-none" :style="{ color: SIDEBAR_HEADING_TEXT }">
            Red<span style="color:#D32F2F">Agos</span>
          </h1>
          <p class="text-[12px] mt-0.5" :style="{ color: SIDEBAR_IDLE_TEXT }">
            Hospital Portal
          </p>
        </div>
      </div>

      <!-- Navigation: nav px-3 + item px-3 + the icon box = one icon axis -->
      <nav class="flex-1 flex flex-col overflow-y-auto overflow-x-hidden px-3 pt-3 pb-4">
        <!-- Main: the dashboard, as a top-level row -->
        <NuxtLink
          v-for="item in topItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ 'is-current': isActive(item.path) }"
          :title="railCollapsed && !isMobile ? item.label : null"
          :aria-current="isActive(item.path) ? 'page' : null"
          :style="navStyle(item.path)"
          @click="closeMobile"
          @mouseenter="hoveredPath = item.path"
          @mouseleave="hoveredPath = null">
          <span class="icon-box">
            <AssetIcon :name="item.icon" :size="18" />
          </span>
          <span class="label flex-1 min-w-0 truncate" :class="{ 'label--hidden': !showLabels }">{{ item.label }}</span>
        </NuxtLink>

        <!--
          Sections as folders, like the blood center. Pages sit indented under
          their folder. The folder holding the current page gets a blue icon;
          on the slim rail, where its pages are hidden, it also gets the soft
          pill. A closed folder (or the slim rail) shows a dot when a page
          inside has something waiting.
        -->
        <div v-for="folder in folders" :key="folder.key" class="folder">
          <button
            type="button"
            class="folder-head"
            :class="{ 'has-current': folderHasActive(folder) }"
            :aria-expanded="isOpen(folder.key)"
            :aria-controls="`hfolder-${folder.key}`"
            :title="railCollapsed && !isMobile ? folder.label : null"
            :style="folderStyle(folder)"
            @click="toggleFolder(folder.key)">
            <span class="icon-box">
              <AssetIcon :name="folder.icon" :size="18" />
              <span v-if="(!showLabels || !isOpen(folder.key)) && folderBadge(folder)" class="status-dot" :style="dotStyle(folderBadge(folder))" />
            </span>
            <span class="label flex-1 min-w-0 truncate text-left" :class="{ 'label--hidden': !showLabels }">{{ folder.label }}</span>
            <AssetIcon
              name="chevron-down"
              :size="14"
              class="label folder-chevron"
              :class="{ 'label--hidden': !showLabels, 'folder-chevron--closed': !isOpen(folder.key) }" />
          </button>

          <div v-show="isOpen(folder.key) && showLabels" :id="`hfolder-${folder.key}`" class="folder-body">
            <NuxtLink
              v-for="item in folder.items"
              :key="item.path"
              :to="item.path"
              class="nav-item nav-item--child"
              :class="{ 'is-current': isActive(item.path) }"
              :aria-current="isActive(item.path) ? 'page' : null"
              :style="childStyle(item.path)"
              @click="closeMobile"
              @mouseenter="hoveredPath = item.path"
              @mouseleave="hoveredPath = null">
              <span class="icon-box">
                <AssetIcon :name="item.icon" :size="18" />
              </span>
              <span class="label flex-1 min-w-0 truncate">{{ item.label }}</span>
              <span v-if="item.badge && badgeCounts[item.badge]" class="count-pill" :style="badgeStyle(item.badge)">
                {{ badgeCounts[item.badge] }}
              </span>
            </NuxtLink>
          </div>
        </div>

        <!-- System (Staff, Settings): kept at the bottom, with room above it. -->
        <template v-if="bottomItems.length">
          <div class="account-spacer" aria-hidden="true" />
          <div class="account-group border-t pt-3" :style="{ borderColor: SIDEBAR_BORDER }">
            <NuxtLink
              v-for="item in bottomItems"
              :key="item.path"
              :to="item.path"
              class="nav-item"
              :class="{ 'is-current': isActive(item.path) }"
              :title="railCollapsed && !isMobile ? item.label : null"
              :aria-current="isActive(item.path) ? 'page' : null"
              :style="navStyle(item.path)"
              @click="closeMobile"
              @mouseenter="hoveredPath = item.path"
              @mouseleave="hoveredPath = null">
              <span class="icon-box">
                <AssetIcon :name="item.icon" :size="18" />
              </span>
              <span class="label flex-1 min-w-0 truncate" :class="{ 'label--hidden': !showLabels }">{{ item.label }}</span>
            </NuxtLink>
          </div>
        </template>
      </nav>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logo from '~/assets/images/RedAgosLogo.png'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { useUser } from '~/composables/useUser'
import { hospitalService } from '~/api/hospital/HospitalService'
import { useSidebar } from '~/composables/useSidebar.js'

const { hoverExpanded, railExpanded, expandOnHover, collapseOnHover, mobileOpen, closeMobile } = useSidebar('hospital')

// --- Dark mode awareness ---
const isDark = ref(false)
let themeObserver = null

// --- Mobile viewport awareness ---
const isMobile = ref(false)
let mobileMql = null
const updateIsMobile = (e) => {
  isMobile.value = e ? e.matches : !mobileMql.matches
  // Dropping to drawer widths with a hover still latched would leave the rail
  // stuck open when the viewport goes back up.
  if (isMobile.value) collapseOnHover()
}

/*
 * The rail's *visual* state. Below lg the sidebar is a full-width drawer, so
 * hover must not apply there; above it the rail is collapsed unless hovered.
 */
const railCollapsed = computed(() => !railExpanded.value)

// Whether labels/text should render at all
const showLabels = computed(() => isMobile.value || !railCollapsed.value)

/*
 * Leaving is deferred by a beat: the rail's edge moves out from under the
 * pointer as it widens, which could otherwise fire leave/enter and flicker.
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
  mobileMql.addEventListener('change', updateIsMobile)
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  clearTimeout(leaveTimer)
  themeObserver?.disconnect()
  mobileMql?.removeEventListener('change', updateIsMobile)
  window.removeEventListener('keydown', handleEscape)
  if (typeof document !== 'undefined') document.body.style.removeProperty('overflow')
})

// The drawer covers the page, so the page does not scroll under it.
watch(mobileOpen, (open) => {
  if (typeof document === 'undefined') return
  if (open) document.body.style.setProperty('overflow', 'hidden')
  else document.body.style.removeProperty('overflow')
})

// Light/dark theme tokens: the blood center rail's, so the portals read as one product.
const SIDEBAR_BG = computed(() => (isDark.value ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.55)'))
const SIDEBAR_BORDER = computed(() => (isDark.value ? '#334155' : '#E4E9F0'))
const SIDEBAR_ACTIVE_TEXT = computed(() => (isDark.value ? 'var(--rb-primary-text)' : 'var(--rb-primary)'))
const SIDEBAR_IDLE_TEXT = computed(() => (isDark.value ? '#94A3B8' : '#64748B'))
const SIDEBAR_ROW_TEXT = computed(() => (isDark.value ? '#E2E8F0' : '#334155'))
const SIDEBAR_HEADING_TEXT = computed(() => (isDark.value ? '#F1F5F9' : '#1F2937'))
const SIDEBAR_CURRENT_BG = computed(() => (isDark.value ? 'color-mix(in srgb, var(--rb-primary-text) 14%, transparent)' : 'color-mix(in srgb, var(--rb-primary) 10%, white)'))
const SIDEBAR_HOVER_SOFT = computed(() => (isDark.value ? 'rgba(148,163,184,0.10)' : '#EEF1F5'))
const sidebarShadow = computed(() =>
  isDark.value
    ? '1px 0 0 ' + SIDEBAR_BORDER.value + ', 4px 0 24px rgba(0,0,0,0.35)'
    : '1px 0 0 ' + SIDEBAR_BORDER.value + ', 4px 0 24px rgba(15,23,42,0.04)'
)

const badgeStyle = (badge) => {
  const urgent = badge === 'emergency'
  return {
    background: urgent
      ? (isDark.value ? 'rgba(239,83,80,0.18)' : 'rgba(211,47,47,0.10)')
      : (isDark.value ? '#334155' : '#F1F5F9'),
    color: urgent ? (isDark.value ? '#EF9A9A' : '#D32F2F') : SIDEBAR_IDLE_TEXT.value
  }
}

const dotStyle = badge => ({
  background: badge === 'emergency' ? '#D32F2F' : '#F57C00',
  boxShadow: '0 0 0 2px ' + (isDark.value ? '#0F172A' : '#FFFFFF'),
})

const route = useRoute()
const router = useRouter()
const { user, fetchUser, logout, can } = useUser()

const activePath = ref(route.path || '/')
watch(
  () => route.path,
  (newPath) => { activePath.value = newPath }
)

const facilityName = computed(() => user.value?.facility?.facility_name || '')
const userInitial = computed(() => facilityName.value?.charAt(0) || user.value?.full_name?.charAt(0) || 'H')
// The hospital role (Blood Bank Head, Inventory Staff, Requesting Staff).
const userRole = computed(() => user.value?.hospital_role_label || 'Hospital Staff')

// // Dev note: pending/emergency counts naka-fetch sa dashboard summary endpoint
const badgeCounts = ref({ pending: 0, emergency: 0 })

/*
 * Each item names the hospital ability its page needs (hospital roles,
 * project owner 2026-10-11), and a role without it does not see the item.
 * Presentation only: the server refuses the endpoints with `can:` either way.
 */
const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', path: '/hospital/dashboard', icon: 'layout-dashboard' }
    ]
  },
  {
    label: 'Requests',
    items: [
      { label: 'Blood Requests', path: '/hospital/bloodrequests', icon: 'clipboard-list', badge: 'pending', requires: 'hospital.requests.view' },
      { label: 'Blood Availability', path: '/hospital/bloodavailability', icon: 'droplets', requires: 'hospital.requests.view' },
      { label: 'Track Requests', path: '/hospital/trackrequests', icon: 'route', requires: 'hospital.requests.view' }
    ]
  },
  {
    label: 'Receiving',
    items: [
      { label: 'Weekly Request', path: '/hospital/receiving/weekly', icon: 'calendar-check', requires: 'hospital.requests.view' },
      { label: 'Direct Distribution', path: '/hospital/receiving/direct-distribution', icon: 'truck', requires: 'hospital.receiving.direct' }
    ]
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Blood Bank Inventory', path: '/hospital/inventory', icon: 'package', requires: 'hospital.inventory.view' },
      { label: 'Stock Thresholds', path: '/hospital/stock-thresholds', icon: 'sliders-horizontal', requires: 'hospital.inventory.view' }
    ]
  },
  // Ang Finance group (billing, transactions) ug ang Help & Support kay
  // gitangtang: walay page files para nila, so 404 ang tanan. Ibalik ni kung
  // naa nay backend + page — tan-awa ang Phase P sa audit plan.
  {
    label: 'System',
    items: [
      { label: 'Staff', path: '/hospital/staff', icon: 'id-card', requires: 'hospital.staff.manage' },
      { label: 'Settings', path: '/hospital/settings', icon: 'settings' }
    ]
  }
]

// The server knows no user (the token lives in the browser), so the server
// render and hydration show the whole menu, as they always have; the role's
// own menu follows once mounted. Filtering earlier would make the two renders
// disagree, and a production build keeps the server's link targets.
const hydrated = ref(false)
onMounted(() => { hydrated.value = true })

const navGroups = computed(() => NAV_GROUPS
  .map((group) => ({ ...group, items: group.items.filter((item) => !item.requires || !hydrated.value || can(item.requires)) }))
  .filter((group) => group.items.length > 0))

// Main rows at the top, the sections as folders, System at the bottom (like
// the blood center's Account group).
const FOLDER_ICONS = {
  Requests: 'file-text',
  Receiving: 'truck',
  Inventory: 'box',
}

const topItems = computed(() => navGroups.value.find((group) => group.label === 'Main')?.items ?? [])
const bottomItems = computed(() => navGroups.value.find((group) => group.label === 'System')?.items ?? [])
const folders = computed(() => navGroups.value
  .filter((group) => group.label !== 'Main' && group.label !== 'System')
  .map((group) => ({ key: group.label, label: group.label, icon: FOLDER_ICONS[group.label] || 'folder-open', items: group.items })))

// ── Folder open/closed state, remembered across reloads ──
const FOLDERS_KEY = 'redagos:hospital-sidebar-folders'
const openFolders = ref({})

function restoreFolders() {
  try {
    const stored = JSON.parse(localStorage.getItem(FOLDERS_KEY) || 'null')
    if (stored && typeof stored === 'object') openFolders.value = stored
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

// Folders start open; only an explicit close is remembered.
const isOpen = (key) => openFolders.value[key] !== false
const folderHasActive = (folder) => folder.items.some((item) => isActive(item.path))

function toggleFolder(key) {
  openFolders.value = { ...openFolders.value, [key]: !isOpen(key) }
  saveFolders()
}

// The current page must never be hidden inside a closed folder.
function openActiveFolder() {
  const folder = folders.value.find((f) => folderHasActive(f))
  if (folder && !isOpen(folder.key)) {
    openFolders.value = { ...openFolders.value, [folder.key]: true }
    saveFolders()
  }
}

onMounted(restoreFolders)
watch(() => route.fullPath, () => openActiveFolder())
watch(folders, () => openActiveFolder())

// The most pressing badge inside a folder: an emergency beats the rest.
const folderBadge = (folder) => {
  const live = folder.items.filter((item) => item.badge && badgeCounts.value[item.badge] > 0).map((item) => item.badge)
  if (!live.length) return null
  return live.includes('emergency') ? 'emergency' : live[0]
}

const loadUser = async () => {
  try {
    if (!user.value) {
      await fetchUser()
    }
    // // Dev note: i-connect ni sa /hospital/dashboard-summary endpoint para sa pending/emergency badge count
    const summary = await hospitalService.dashboardSummary?.()
    if (summary) {
      badgeCounts.value.pending = summary.pending_requests || 0
      badgeCounts.value.emergency = summary.emergency_requests || 0
    }
  } catch (err) {
    console.error(err)
  }
}

onMounted(() => {
  loadUser()
})

const handleLogout = async () => {
  await logout('/auth/login')
}


const hoveredPath = ref(null)

// A page under a nav item (a weekly request, a new delivery) keeps its parent lit.
const isActive = (path) => route.path === path || route.path.startsWith(`${path}/`)

// Current page: a soft pill, with the icon in a solid chip (see .is-current).
// Top-level rows and folder names in the darker grey; pages in a folder lighter.
const rowStyle = (path, level) => {
  if (isActive(path)) return { background: SIDEBAR_CURRENT_BG.value, color: SIDEBAR_ACTIVE_TEXT.value, fontWeight: '700' }
  const hovered = hoveredPath.value === path
  const primary = level === 'primary'
  return {
    background: hovered ? SIDEBAR_HOVER_SOFT.value : 'transparent',
    color: primary || hovered ? SIDEBAR_ROW_TEXT.value : SIDEBAR_IDLE_TEXT.value,
    fontWeight: primary ? '600' : '500'
  }
}
const navStyle = (path) => rowStyle(path, 'primary')
const childStyle = (path) => rowStyle(path, 'secondary')

// The folder holding the current page: a blue icon, and the soft pill on the slim rail.
const folderStyle = (folder) => ({
  background: folderHasActive(folder) && !showLabels.value ? SIDEBAR_CURRENT_BG.value : undefined,
  color: SIDEBAR_ROW_TEXT.value,
  fontWeight: '600'
})
</script>

<style scoped>
/* The blood center rail's styles; width and transform share the layout's 200ms. */
.sidebar {
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  backdrop-filter: blur(18px) saturate(140%);
  will-change: width, transform;
  transition: width 200ms ease-out, transform 200ms ease-out;
}

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
.is-current .icon-box {
  border-radius: 8px;
  background: var(--rb-primary);
  color: #FFFFFF;
  box-shadow: 0 4px 10px -4px rgba(var(--rb-primary-rgb), 0.7);
}
.label { transition: opacity 150ms ease; }
.label--hidden { opacity: 0; }

/* ── Folders ── */
.folder { margin-top: 6px; }
.folder-head { cursor: pointer; }
.folder-head:hover { background: var(--sb-hover, #EEF1F5); }
.has-current .icon-box { color: var(--rb-primary); }
.folder-chevron {
  flex-shrink: 0;
  transition: transform 180ms ease, opacity 150ms ease;
}
.folder-chevron--closed { transform: rotate(-90deg); }
/* A folder's pages sit indented under it. */
.folder-body {
  margin: 2px 0 6px;
  padding-left: 22px;
}
.nav-item--child {
  padding-top: 8px;
  padding-bottom: 8px;
}

.count-pill {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.status-dot {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 6px;
}

.nav-item:focus-visible,
.folder-head:focus-visible {
  outline: 2px solid var(--rb-primary-text);
  outline-offset: -2px;
}

/* No scrollbar gutter: a track would push the icons off their axis. */
nav { scrollbar-width: none; }
nav::-webkit-scrollbar { width: 0; height: 0; }

.scrim-enter-active,
.scrim-leave-active { transition: opacity 200ms ease; }
.scrim-enter-from,
.scrim-leave-to { opacity: 0; }

@media (hover: none) {
  .nav-item { transition: background 0.1s ease, color 0.1s ease; }
  .nav-item:active {
    background: rgba(var(--rb-primary-rgb), 0.10) !important;
    color: var(--rb-primary) !important;
  }
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .sidebar { background: var(--rb-surface, #FFFFFF) !important; }
}

@media (prefers-reduced-motion: reduce) {
  .label, .sidebar, .nav-item, .folder-chevron, .scrim-enter-active, .scrim-leave-active { transition: none; }
}

a, button { touch-action: manipulation; }

/* Pushes System to the bottom, with at least 20px above it. */
.account-spacer { flex: 1 0 20px; }
/* The nav is a column only for the spacer; its rows keep their size and it scrolls. */
.sidebar nav > * { flex-shrink: 0; }
.account-group { display: flex; flex-direction: column; gap: 4px; }
</style>
