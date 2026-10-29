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
      The blood center's rail (project owner, 2026-10-28). Desktop: 72px of
      icons under the full-width top bar, opened by the menu button in the bar
      or by hovering it, and closed when the pointer leaves it (or a click
      lands outside, or Escape). The layout moves the content column over
      with it, so nothing is covered. Opened, each folder shows its pages on a
      thin "agos" line that fills up to the current page. Below 1024px it is
      the drawer.
    -->
    <aside
      id="hospital-sidebar"
      ref="asideEl"
      aria-label="Hospital navigation"
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
        '--sb-text': SIDEBAR_FOLDER_TEXT,
        '--sb-muted': SIDEBAR_IDLE_TEXT,
        '--sb-border': SIDEBAR_BORDER
      }"
      @pointerenter="onRailEnter"
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
        to="/hospital/dashboard"
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
            {{ portalLabel }}
          </p>
        </div>
      </NuxtLink>

      <!--
        Desktop rail: icon rows whose labels show when it opens, and each
        section's pages beneath its folder. A folder still opens and closes
        on a click, as in the drawer.
      -->
      <nav v-if="!isMobile" class="rail flex-1 overflow-y-auto overflow-x-hidden" aria-label="Hospital pages">
        <NuxtLink
          v-for="item in topItems"
          :key="item.path"
          :to="item.path"
          class="rail-row"
          :class="{ 'is-current': isActive(item.path) }"
          :title="railOpen ? null : item.label"
          :aria-current="isActive(item.path) ? 'page' : null">
          <span class="icon-box">
            <AssetIcon :name="item.icon" :size="18" />
            <span v-if="!railOpen && badgeFor(item)" class="status-dot" :style="dotStyle(item.badge)" />
          </span>
          <span class="rail-row__label">{{ item.label }}</span>
          <span v-if="railOpen && badgeFor(item)" class="count-pill" :style="badgeStyle(item.badge)">{{ badgeFor(item) }}</span>
        </NuxtLink>

        <div v-if="topItems.length && folders.length" class="rail__divider" aria-hidden="true" />

        <div v-for="folder in folders" :key="folder.key" class="rail-folder">
          <button
            type="button"
            class="rail-row rail-row--folder"
            :class="{ 'has-current': folderHasActive(folder) }"
            :title="railOpen ? null : folder.label"
            :aria-expanded="railOpen ? isOpen(folder.key) : null"
            :aria-controls="`hrail-folder-${folder.key}`"
            @click="railOpen && toggleFolder(folder.key)">
            <span class="icon-box">
              <AssetIcon :name="folder.icon" :size="18" />
              <span v-if="(!railOpen || !isOpen(folder.key)) && folderBadge(folder)" class="status-dot"
                :style="dotStyle(folderBadge(folder))" />
            </span>
            <span class="rail-row__label">{{ folder.label }}</span>
            <AssetIcon name="chevron-down" :size="14" class="rail-row__chevron"
              :class="{ 'rail-row__chevron--closed': !isOpen(folder.key) }" />
          </button>

          <!--
            The agos line: one thread from the folder down through its pages,
            filled in the portal colour as far as the page open now.
          -->
          <div :id="`hrail-folder-${folder.key}`" class="agos" :class="{ 'agos--closed': !isOpen(folder.key) }">
            <ul class="agos__list">
              <li
                v-for="(item, i) in folder.items"
                :key="item.path"
                class="agos__item"
                :class="{ 'is-filled': i <= currentIndex(folder), 'is-current': isActive(item.path) }">
                <NuxtLink :to="item.path" class="agos__link" :aria-current="isActive(item.path) ? 'page' : null"
                  :tabindex="railOpen && isOpen(folder.key) ? null : -1">
                  <span class="agos__label">{{ item.label }}</span>
                  <span v-if="badgeFor(item)" class="count-pill" :style="badgeStyle(item.badge)">{{ badgeFor(item) }}</span>
                </NuxtLink>
              </li>
            </ul>
          </div>
        </div>

        <div v-if="bottomItems.length" class="rail__bottom">
          <NuxtLink
            v-for="item in bottomItems"
            :key="item.path"
            :to="item.path"
            class="rail-row"
            :class="{ 'is-current': isActive(item.path) }"
            :title="railOpen ? null : item.label"
            :aria-current="isActive(item.path) ? 'page' : null">
            <span class="icon-box"><AssetIcon :name="item.icon" :size="18" /></span>
            <span class="rail-row__label">{{ item.label }}</span>
          </NuxtLink>
        </div>
      </nav>

      <!-- Drawer (below 1024px): nav px-3 + item px-3 + a 24px icon box = 36px axis -->
      <nav v-else class="flex-1 flex flex-col overflow-y-auto overflow-x-hidden px-3 pt-3 pb-4" aria-label="Hospital pages">
        <NuxtLink v-for="item in topItems" :key="item.path" :to="item.path"
          class="nav-item"
          :class="{ 'is-current': isActive(item.path) }"
          :aria-current="isActive(item.path) ? 'page' : null"
          :style="navStyle(item.path)"
          @click="closeMobile"
          @mouseenter="hoveredPath = item.path"
          @mouseleave="hoveredPath = null">
          <span class="icon-box">
            <AssetIcon :name="item.icon" :size="18" />
          </span>
          <span class="label flex-1 min-w-0 truncate">{{ item.label }}</span>
          <span v-if="badgeFor(item)" class="count-pill" :style="badgeStyle(item.badge)">{{ badgeFor(item) }}</span>
        </NuxtLink>

        <!--
          Sections as folders. Pages sit indented under their folder; the
          folder holding the current page gets a blue icon. A closed folder
          shows a dot when a page inside has something waiting.
        -->
        <div v-for="folder in folders" :key="folder.key" class="folder">
          <button
            type="button"
            class="folder-head"
            :class="{ 'has-current': folderHasActive(folder) }"
            :aria-expanded="isOpen(folder.key)"
            :aria-controls="`hfolder-${folder.key}`"
            :style="folderStyle"
            @click="toggleFolder(folder.key)">
            <span class="icon-box">
              <AssetIcon :name="folder.icon" :size="18" />
              <span v-if="!isOpen(folder.key) && folderBadge(folder)" class="status-dot"
                :style="dotStyle(folderBadge(folder))" />
            </span>
            <span class="label flex-1 min-w-0 truncate text-left">{{ folder.label }}</span>
            <AssetIcon name="chevron-down" :size="14" class="folder-chevron"
              :class="{ 'folder-chevron--closed': !isOpen(folder.key) }" />
          </button>

          <div v-show="isOpen(folder.key)" :id="`hfolder-${folder.key}`" class="folder-body">
            <NuxtLink v-for="item in folder.items" :key="item.path" :to="item.path"
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
              <span v-if="badgeFor(item)" class="count-pill" :style="badgeStyle(item.badge)">{{ badgeFor(item) }}</span>
            </NuxtLink>
          </div>
        </div>

        <!-- System (Staff, Settings): kept at the bottom, with room above it. -->
        <div v-if="bottomItems.length" class="account-spacer" aria-hidden="true" />
        <div v-if="bottomItems.length" class="account-group border-t pt-3" :style="{ borderColor: SIDEBAR_BORDER }">
          <NuxtLink v-for="item in bottomItems" :key="item.path" :to="item.path"
            class="nav-item"
            :class="{ 'is-current': isActive(item.path) }"
            :aria-current="isActive(item.path) ? 'page' : null"
            :style="navStyle(item.path)"
            @click="closeMobile"
            @mouseenter="hoveredPath = item.path"
            @mouseleave="hoveredPath = null">
            <span class="icon-box">
              <AssetIcon :name="item.icon" :size="18" />
            </span>
            <span class="label flex-1 min-w-0 truncate">{{ item.label }}</span>
          </NuxtLink>
        </div>
      </nav>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import logo from '~/assets/images/RedAgosLogo.png'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { useUser } from '~/composables/useUser'
import { hospitalService } from '~/api/hospital/HospitalService'
import { useSidebar } from '~/composables/useSidebar.js'

const {
  collapsed,
  hoverExpanded,
  railExpanded,
  expandOnHover,
  collapseOnHover,
  mobileOpen,
  closeMobile
} = useSidebar('hospital')

const route = useRoute()
const { user, can } = useUser()

// --- Dark mode awareness ---
const isDark = ref(false)
let themeObserver = null

// --- Viewport awareness ---
// Below lg the sidebar is a drawer, so hover must not apply there at all.
const isMobile = ref(false)
let mobileMql = null

const onViewportChange = (e) => {
  isMobile.value = e.matches
  // Dropping to drawer widths with the rail open would leave it — and the
  // content padding that tracks it — stuck open on the way back up.
  if (isMobile.value) closeRail()
}

/*
 * Opened by the menu button in the top bar (the layout) or by hovering the
 * rail, closed when the pointer leaves the rail, a click lands outside it,
 * Escape, or the button again. The state lives in useSidebar, which the
 * layout reads to move its content column, so the two always agree.
 */
const railOpen = computed(() => !isMobile.value && railExpanded.value)

const asideEl = ref(null)
let railTimer = null
let openTimer = null

// Back on the rail before the close fires: keep it open.
function cancelClose() {
  clearTimeout(railTimer)
}

/*
 * Hovering the narrow rail opens it. A beat first, so a pointer crossing it
 * on the way elsewhere does not open it and shift the page. A mouse or pen
 * only: a tap would open it and follow the link in one go.
 */
function onRailEnter(e) {
  cancelClose()
  if (isMobile.value || e.pointerType === 'touch' || railOpen.value) return
  clearTimeout(openTimer)
  openTimer = setTimeout(expandOnHover, 120)
}

// A beat before closing, so brushing past the edge doesn't flicker it.
function closeRailSoon() {
  if (isMobile.value) return
  clearTimeout(openTimer)
  clearTimeout(railTimer)
  railTimer = setTimeout(closeRail, 160)
}

function closeRail() {
  clearTimeout(openTimer)
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
  // Narrow until the menu button (or a hover) opens it, as at the centre.
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
  document.addEventListener('pointerdown', onOutsidePointer)
})

onUnmounted(() => {
  clearTimeout(railTimer)
  clearTimeout(openTimer)
  document.removeEventListener('pointerdown', onOutsidePointer)
  themeObserver?.disconnect()
  mobileMql?.removeEventListener('change', onViewportChange)
  window.removeEventListener('keydown', handleEscape)
  if (typeof document !== 'undefined') document.body.style.removeProperty('overflow')
})

// The drawer covers the page, so the page does not scroll under it.
watch(mobileOpen, (open) => {
  if (typeof document === 'undefined') return
  if (open) document.body.style.setProperty('overflow', 'hidden')
  else document.body.style.removeProperty('overflow')
})

// Light/dark theme tokens: the blood center rail's, so the portals read as one
// product. Solid, in the chrome colour the top bar shares (main.css, html.portal-bc).
const SIDEBAR_BG = computed(() => (isDark.value ? 'var(--rb-chrome, #1E293B)' : 'var(--rb-chrome, #FFFFFF)'))
const SIDEBAR_BORDER = computed(() => (isDark.value ? 'var(--ink-border, #334155)' : '#E5EAF0'))
const SIDEBAR_ACTIVE_TEXT = computed(() => (isDark.value ? 'var(--rb-primary-text)' : 'var(--rb-primary)'))
// Two text levels. Primary: top-level rows and folder names. Secondary: pages
// inside a folder.
const SIDEBAR_IDLE_TEXT = computed(() => (isDark.value ? 'var(--ink-text-2, #94A3B8)' : '#64748B'))
const SIDEBAR_FOLDER_TEXT = computed(() => (isDark.value ? 'var(--ink-text-4, #E2E8F0)' : '#334155'))
const SIDEBAR_HEADING_TEXT = computed(() => (isDark.value ? 'var(--ink-text, #F1F5F9)' : '#1F2937'))
const SIDEBAR_CURRENT_BG = computed(() => (isDark.value ? 'color-mix(in srgb, var(--rb-primary-text) 14%, transparent)' : 'color-mix(in srgb, var(--rb-primary) 10%, white)'))
const SIDEBAR_HOVER_SOFT = computed(() => (isDark.value ? 'rgba(148,163,184,0.10)' : '#EEF1F5'))
const sidebarShadow = computed(() => '1px 0 0 ' + SIDEBAR_BORDER.value)

const portalLabel = computed(() => user.value?.facility?.facility_name || 'Hospital Portal')

// // Dev note: pending/emergency counts naka-fetch sa dashboard summary endpoint
const badgeCounts = ref({ pending: 0, emergency: 0 })

const badgeStyle = (badge) => {
  const urgent = badge === 'emergency'
  return {
    background: urgent
      ? (isDark.value ? 'rgba(239,83,80,0.18)' : 'rgba(211,47,47,0.10)')
      : (isDark.value ? 'var(--ink-border, #334155)' : '#F1F5F9'),
    color: urgent ? (isDark.value ? '#EF9A9A' : '#D32F2F') : SIDEBAR_IDLE_TEXT.value
  }
}

const dotStyle = badge => ({
  background: badge === 'emergency' ? '#D32F2F' : '#F57C00',
  boxShadow: '0 0 0 2px ' + (isDark.value ? 'var(--rb-chrome, #1E293B)' : 'var(--rb-chrome, #FFFFFF)'),
})

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
    label: 'Receiving',
    items: [
      // Blood Requests sits under Receiving; there is no "Requests" folder.
      // Blood Availability and Track Requests are off the menu; their pages
      // are still reached from the dashboard and the request list.
      { label: 'Blood Requests', path: '/hospital/bloodrequests', icon: 'clipboard-list', badge: 'pending', requires: 'hospital.requests.view' },
      { label: 'Weekly Request', path: '/hospital/receiving/weekly', icon: 'calendar-check', requires: 'hospital.requests.view' },
      { label: 'Direct Distribution', path: '/hospital/receiving/direct-distribution', icon: 'truck', requires: 'hospital.receiving.direct' }
    ]
  },
  {
    label: 'Stock and Supply',
    items: [
      { label: 'Blood Bank Inventory', path: '/hospital/inventory', icon: 'package', requires: 'hospital.inventory.view' },
      // Stock-in's own page, apart from the inventory (project owner, 2026-10-28).
      { label: 'Stock Intake', path: '/hospital/stock-intake', icon: 'package-check', requires: 'hospital.inventory.stock_in' },
      { label: 'Stock Thresholds', path: '/hospital/stock-thresholds', icon: 'sliders-horizontal', requires: 'hospital.inventory.view' }
    ]
  },
  {
    // The blood bank's own reports, starting with its paper inventory sheet
    // (project owner, 2026-10-28).
    label: 'Reports',
    items: [
      { label: 'Inventory Report', path: '/hospital/inventory-report', icon: 'clipboard-list', requires: 'hospital.inventory.view' }
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
// the blood center's Account group). One icon per section, so the narrow rail
// tells them apart.
const FOLDER_ICONS = {
  Receiving: 'truck',
  'Stock and Supply': 'warehouse',
  Reports: 'file-text',
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
// How far down a folder's agos line is filled: to the current page, or not at all.
const currentIndex = (folder) => folder.items.findIndex((item) => isActive(item.path))

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

watch(() => route.fullPath, () => openActiveFolder())
watch(folders, () => openActiveFolder())

// ── Badges ──
const badgeFor = (item) => {
  const n = item.badge ? badgeCounts.value[item.badge] : 0
  return n ? (n > 99 ? '99+' : n) : null
}

// The most pressing badge inside a folder: an emergency beats the rest.
const folderBadge = (folder) => {
  const live = folder.items.filter((item) => item.badge && badgeCounts.value[item.badge] > 0).map((item) => item.badge)
  if (!live.length) return null
  return live.includes('emergency') ? 'emergency' : live[0]
}

onMounted(async () => {
  try {
    // // Dev note: i-connect ni sa /hospital/dashboard-summary endpoint para sa pending/emergency badge count
    const summary = await hospitalService.dashboardSummary?.()
    if (summary) {
      badgeCounts.value.pending = summary.pending_requests || 0
      badgeCounts.value.emergency = summary.emergency_requests || 0
    }
  } catch (err) {
    console.error(err)
  }
})

const hoveredPath = ref(null)

// A page under a nav item (a weekly request, a new delivery) keeps its parent lit.
const isActive = (path) => route.path === path || route.path.startsWith(`${path}/`)

// Current page: soft pill with blue text (the icon chip carries the strong
// colour, see .is-current in the styles). Hover: a light grey.
const rowStyle = (path, level) => {
  if (isActive(path)) return { background: SIDEBAR_CURRENT_BG.value, color: SIDEBAR_ACTIVE_TEXT.value, fontWeight: '700' }
  const hovered = hoveredPath.value === path
  const primary = level === 'primary'
  return {
    background: hovered ? SIDEBAR_HOVER_SOFT.value : 'transparent',
    color: primary || hovered ? SIDEBAR_FOLDER_TEXT.value : SIDEBAR_IDLE_TEXT.value,
    fontWeight: primary ? '600' : '500'
  }
}
const navStyle = (path) => rowStyle(path, 'primary')
const childStyle = (path) => rowStyle(path, 'secondary')
const folderStyle = computed(() => ({ color: SIDEBAR_FOLDER_TEXT.value, fontWeight: '600' }))
</script>

<style scoped>
/*
 * The blood center rail's styles (components/BloodCenter/sidebar.vue). Width
 * and transform are the only animated properties, and they share the
 * layout's 200ms/ease-out so the rail and the content padding that tracks it
 * move as one.
 */
.sidebar {
  will-change: width, transform;
  transition: width 200ms ease-out, transform 200ms ease-out;
}

/* ── Drawer rows: icon on the fixed axis ── */
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

/* ── Folders ── */
.folder { margin-top: 6px; }
.folder-head { cursor: pointer; }
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
  transition: transform 180ms ease;
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
}

/* Badges: a count pill when there is room, a dot on the icon when there is not. */
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

/* ── Desktop rail ── */
.rail {
  display: flex;
  flex-direction: column;
  padding: 12px 12px 14px;
}
/* nav px-12 + row px-12 + the 24px icon box = the 36px icon axis */
.rail-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 9px 12px;
  margin-bottom: 2px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--sb-text);
  font: inherit;
  font-size: var(--rb-fs-body);
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-decoration: none;
  transition: background-color 150ms ease, color 150ms ease;
}
a.rail-row:hover,
.is-hover-open .rail-row--folder:hover { background: var(--sb-hover); }
.rail-row:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }
.rail-row__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0;
  transition: opacity 150ms ease;
}
.is-hover-open .rail-row__label { opacity: 1; }
.rail-row.is-current { background: var(--sb-current-bg); color: var(--sb-current-text); font-weight: 700; }
.rail-row--folder { cursor: default; }
.is-hover-open .rail-row--folder { cursor: pointer; }
.rail-row--folder.has-current { color: var(--sb-current-text); }
.sidebar:not(.is-hover-open) .rail-row--folder.has-current { background: var(--sb-current-bg); }
.rail-row__chevron { flex-shrink: 0; opacity: 0; transition: transform 180ms ease, opacity 150ms ease; }
.is-hover-open .rail-row__chevron { opacity: 0.7; }
.rail-row__chevron--closed { transform: rotate(-90deg); }
.rail-row .count-pill { opacity: 0; }
.is-hover-open .rail-row .count-pill { opacity: 1; }

/* ── The agos line ── */
/* Folded away while the rail is narrow or the folder closed; opens as it widens. */
.agos {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 200ms ease-out, opacity 150ms ease;
}
.is-hover-open .agos:not(.agos--closed) { grid-template-rows: 1fr; opacity: 1; padding-bottom: 6px; }
.agos__list {
  min-height: 0;
  overflow: hidden;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* The thread runs down the folder icon's axis: 12px row padding + half the
   24px icon box. The page names line up with the folder name. */
.agos__item {
  position: relative;
  padding-left: 36px;
}
.agos__item::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 23px;
  width: 2px;
  border-radius: 2px;
  background: var(--sb-border);
}
.agos__item.is-filled::before { background: var(--rb-primary); }
/* The current page: the thread ends in a drop of the portal colour. */
.agos__item.is-current::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 19px;
  width: 10px;
  height: 10px;
  margin-top: -5px;
  border: 2px solid var(--rb-chrome, #fff);
  border-radius: 999px;
  background: var(--rb-primary);
  box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.18);
}
.agos__item.is-current::before { bottom: 50%; }
.agos__link {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 1px 0;
  padding: 7px 12px;
  border-radius: 10px;
  color: var(--sb-muted);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 150ms ease, color 150ms ease;
}
.agos__link:hover { background: var(--sb-hover); color: var(--sb-text); }
.agos__link:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }
.agos__item.is-current .agos__link { color: var(--sb-current-text); font-weight: 700; }
.agos__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

.rail__divider { flex-shrink: 0; height: 1px; margin: 8px 4px; background: var(--sb-border); }
.rail-folder { flex-shrink: 0; }
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

.brand:focus-visible,
.nav-item:focus-visible,
.folder-head:focus-visible {
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
  .nav-item { transition: background 0.1s ease, color 0.1s ease; }
  .nav-item:active {
    background: rgba(var(--rb-primary-rgb), 0.10) !important;
    color: var(--rb-primary) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .folder-chevron,
  .rail-row,
  .rail-row__label,
  .rail-row__chevron,
  .agos,
  .agos__link,
  .sidebar,
  .scrim-enter-active,
  .scrim-leave-active {
    transition: none;
  }
}

a, button { touch-action: manipulation; }

/* Pushes System to the bottom, with at least 20px above it. */
.account-spacer { flex: 1 0 20px; }
/* The nav is a column only for the spacer; its rows keep their size and it scrolls. */
.sidebar nav > * { flex-shrink: 0; }
.account-group { flex-shrink: 0; display: flex; flex-direction: column; gap: 4px; }
</style>
