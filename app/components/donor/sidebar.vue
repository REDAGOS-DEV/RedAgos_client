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
      Desktop: a 72px icon rail that widens to 256px while the pointer (or
      keyboard focus) is on it, showing each label. The layout moves the
      content column over with it, so nothing is ever covered. Once wide, each
      folder shows its pages beneath it on a thin "agos" line that fills up to
      the current page. There is no expand or collapse control. Below 1024px
      it is the drawer.
    -->
    <aside
      id="donor-sidebar"
      ref="asideEl"
      aria-label="Donor navigation"
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
      @mouseenter="cancelClose"
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

      <!--
        Height-matched to the topbar (h-14 / sm:h-16) so the dividers line up.
        px-4 + a 40px mark puts the logo's centre on the 36px axis.
      -->
      <div
        class="brand px-4 h-14 sm:h-16 flex lg:hidden items-center gap-3 border-b flex-shrink-0 cursor-pointer select-none overflow-hidden"
        :style="{ borderColor: SIDEBAR_BORDER }"
        role="link"
        tabindex="0"
        aria-label="RedAgos, go to the dashboard"
        @click="goToDashboard"
        @keydown.enter.prevent="goToDashboard"
        @keydown.space.prevent="goToDashboard">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative">
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

      <!--
        Desktop rail: icon rows whose labels show when the rail widens, and
        each folder's pages beneath it. The same structure as the drawer.
      -->
      <nav v-if="!isMobile" class="rail flex-1 overflow-y-auto overflow-x-hidden" aria-label="Donor pages">
        <NuxtLink
          v-for="item in topItems"
          :key="item.path"
          :to="item.path"
          class="rail-row"
          :class="{ 'is-current': isActive(item.path) }"
          :aria-current="isActive(item.path) ? 'page' : null">
          <span class="icon-box"><AssetIcon :name="item.icon" :size="18" /></span>
          <span class="rail-row__label">{{ item.label }}</span>
        </NuxtLink>

        <div class="rail__divider" aria-hidden="true" />

        <div v-for="folder in folders" :key="folder.key" class="rail-folder" role="group" :aria-labelledby="`rail-folder-${folder.key}`">
          <div class="rail-row rail-row--folder" :class="{ 'has-current': folderHasActive(folder) }">
            <span class="icon-box">
              <AssetIcon :name="folder.icon" :size="18" />
              <span v-if="folder.key === 'records' && passNeedsScreening" class="rail-row__dot" />
            </span>
            <span :id="`rail-folder-${folder.key}`" class="rail-row__label">{{ folder.label }}</span>
          </div>

          <!--
            The agos line: one thread from the folder down through its pages,
            filled in the portal colour as far as the page the donor is on.
          -->
          <div class="agos">
            <ul class="agos__list">
              <li
                v-for="(item, i) in folder.items"
                :key="item.path"
                class="agos__item"
                :class="{ 'is-filled': i <= currentIndex(folder), 'is-current': isActive(item.path) }">
                <NuxtLink :to="item.path" class="agos__link" :aria-current="isActive(item.path) ? 'page' : null">
                  <span class="agos__label">{{ item.label }}</span>
                  <span v-if="item.badge && qrLabel" class="agos__badge" :style="badgeStyle">{{ qrLabel }}</span>
                </NuxtLink>
              </li>
            </ul>
          </div>
        </div>

        <div class="rail__bottom">
          <NuxtLink
            v-for="item in bottomItems"
            :key="item.path"
            :to="item.path"
            class="rail-row"
            :class="{ 'is-current': isActive(item.path) }"
            :aria-current="isActive(item.path) ? 'page' : null">
            <span class="icon-box"><AssetIcon :name="item.icon" :size="18" /></span>
            <span class="rail-row__label">{{ item.label }}</span>
          </NuxtLink>
        </div>
      </nav>

      <!-- Navigation: nav px-3 + item px-3 + a 24px icon box = 36px axis -->
      <nav v-else class="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-3 pb-4" :class="isDark ? 'nav-dark' : ''">
        <!-- Top-level pages. Active = filled blue pill. -->
        <NuxtLink v-for="item in topItems" :key="item.path" :to="item.path"
          class="nav-item"
          :class="{ 'is-current': isActive(item.path) }"
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
              <span v-if="item.badge && qrLabel"
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
 * Desktop: a 72px icon rail. Hover (or keyboard focus) widens it to 256px to
 * show the labels, with each folder's pages beneath it on an "agos" line that
 * fills up to the current page. The layout reads the shared `railExpanded`
 * and widens its content padding to match, so the rail never covers the
 * page. There is no expand or collapse control.
 *
 * Below 1024px it is the full drawer, where folders open and close in place
 * and the folder holding the current page opens on its own.
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
  if (isMobile.value) closeRail()
}

/*
 * Opened by the menu button in the header (the layout), closed when the
 * pointer leaves the rail, a click lands outside it, Escape, or the button
 * again. The state lives in useSidebar: the layout reads the same
 * `railExpanded` to move its content column, so the two always agree.
 */
const railOpen = computed(() => !isMobile.value && railExpanded.value)
let railTimer = null

// Back on the rail before the close fires: keep it open.
function cancelClose() {
  clearTimeout(railTimer)
}

// A beat before closing, so brushing past the edge doesn't flicker it.
function closeRailSoon() {
  clearTimeout(railTimer)
  railTimer = setTimeout(closeRail, 160)
}

function closeRail() {
  clearTimeout(railTimer)
  collapseOnHover()
}

// Keyboard: stay open while focus is anywhere in the rail.
function onFocusOut(e) {
  // Focus leaving for the page (a link just navigated) while the pointer is
  // still here is not a reason to close: the hover still holds it open.
  if (asideEl.value?.contains(e.relatedTarget) || asideEl.value?.matches(':hover')) return
  closeRailSoon()
}

/** Whether labels/text should render at all. */
const showLabels = computed(() => isMobile.value || railOpen.value)

const handleEscape = (e) => {
  if (e.key !== 'Escape') return
  if (hoverExpanded.value) closeRail()
  else if (mobileOpen.value) closeMobile()
}

onMounted(() => {
  // Narrow until hovered. (A pinned-open choice stored by an earlier build no
  // longer applies.)
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

// Light/dark theme tokens — the same palette the blood-centre and admin rails
// use, so the portals read as one product.
// Frosted glass over the layout's themed backdrop (blur in the styles).
// Solid, like the top bar: the page behind is a plain canvas, not glass.
const SIDEBAR_BG = computed(() => (isDark.value ? 'var(--rb-chrome, #1E293B)' : 'var(--rb-chrome, #FFFFFF)'))
const SIDEBAR_BORDER = computed(() => (isDark.value ? 'var(--ink-border, #334155)' : '#E5EAF0'))
const SIDEBAR_ACTIVE_TEXT = computed(() => (isDark.value ? 'var(--rb-primary-text)' : 'var(--rb-primary)'))
// Two text levels. Primary: top-level rows and folder names (Dashboard,
// Donate, My Records, Settings, Help). Secondary: pages inside a folder.
const SIDEBAR_IDLE_TEXT = computed(() => (isDark.value ? 'var(--ink-text-2, #94A3B8)' : '#64748B'))
const SIDEBAR_FOLDER_TEXT = computed(() => (isDark.value ? 'var(--ink-text-4, #E2E8F0)' : '#334155'))
const SIDEBAR_HEADING_TEXT = computed(() => (isDark.value ? 'var(--ink-text, #F1F5F9)' : '#1F2937'))
const SIDEBAR_CURRENT_BG = computed(() => (isDark.value ? 'color-mix(in srgb, var(--rb-primary-text) 14%, transparent)' : 'color-mix(in srgb, var(--rb-primary) 10%, white)'))
const SIDEBAR_HOVER_SOFT = computed(() => (isDark.value ? 'rgba(148,163,184,0.10)' : '#EEF1F5'))
const sidebarShadow = computed(() =>
  isDark.value
    ? `1px 0 0 ${SIDEBAR_BORDER.value}`
    : `1px 0 0 ${SIDEBAR_BORDER.value}`
)

// The questionnaire, not eligibility_status: every screening is recorded
// `pending` until the centre decides, so that one never reads as valid.
const questionnaireStatus = ref(null)
const qrValid = computed(() => questionnaireStatus.value === 'answered')
// Whether a check-in code is live, from the dashboard payload (`qr_active`,
// read on the server without the audit entry GET /qr-code makes).
const qrActive = ref(false)

// Beside My QR Code: "Valid" with a live code; "Not ready" with no current
// answers (nothing can be issued yet); nothing in between, when answers are
// in but no code was made, which the Pass page itself sorts out.
const qrLabel = computed(() => {
  if (qrActive.value) return 'Valid'
  if (questionnaireStatus.value && !qrValid.value) return 'Not ready'
  return ''
})

const badgeStyle = computed(() => {
  const eligible = qrActive.value
  return {
    background: eligible
      ? (isDark.value ? 'rgba(76,175,80,0.18)' : 'rgba(46,125,50,0.10)')
      : (isDark.value ? 'var(--ink-border, #334155)' : '#F1F5F9'),
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
    short: 'Donate',
    icon: 'blood-drop',
    items: [
      { label: 'Eligibility Screening', path: '/donor/eligibility', icon: 'clipboard-check' },
      { label: 'Book Appointment', path: '/donor/appointments', icon: 'calendar' }
    ]
  },
  {
    key: 'records',
    label: 'My Records',
    short: 'Records',
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

// The QR code inside My Records needs a fresh screening before it works at
// the counter: the rail marks the folder with a dot.
const passNeedsScreening = computed(() => !!questionnaireStatus.value && !qrValid.value)

const asideEl = ref(null)

// How far down a folder's agos line is filled: to the current page, or not at all.
const currentIndex = folder => folder.items.findIndex(item => isActive(item.path))

function onOutsidePointer(e) {
  if (!hoverExpanded.value) return
  // The menu button toggles on its own click; closing here first would reopen it.
  if (asideEl.value?.contains(e.target) || e.target.closest?.('[data-rail-toggle]')) return
  closeRail()
}

// Arriving on a page closes the rail, so it doesn't sit over the new page,
// unless the pointer is still on it (then it stays, as the hover says).
watch(() => route.path, () => {
  if (!asideEl.value?.matches(':hover')) closeRail()
})

const loadUser = async () => {
  try {
    if (!user.value) {
      await fetchUser()
    }

    const dashboard = await donorService.dashboard()
    questionnaireStatus.value = dashboard.questionnaire_status || 'not_answered'
    qrActive.value = !!dashboard.qr_active
  } catch (err) {
    console.error(err)
  }
}

onMounted(loadUser)

// The rail outlives every page, so a questionnaire answered just now would
// leave the badge on "Pending" until a reload. Re-read it on the way out.
// The QR page can mint a code too, so leaving it re-reads the badge as well.
watch(() => route.path, (to, from) => {
  if ((from === '/donor/eligibility' || from === '/donor/qrcode') && to !== from) loadUser()
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

// The full sidebar shows every folder's pages, so a click just opens or closes it.
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

/* ── Desktop rail: icon rows, labels show as it widens ── */
.rail {
  display: flex;
  flex-direction: column;
  padding: 12px 12px 14px;
}
/* nav px-12 + row px-12 + the 24px icon box = the logo's 36px axis */
.rail-row {
  display: flex;
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
a.rail-row:hover { background: var(--sb-hover); }
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
/* Current page: the icon in a solid square, as in the drawer. */
.rail-row.is-current { background: var(--sb-current-bg); color: var(--sb-current-text); font-weight: 700; }
/* A folder is a heading, not a link. Narrow, it takes the soft pill when it
   holds the current page; wide, the agos line shows the page instead. */
.rail-row--folder { cursor: default; }
.rail-row--folder.has-current { color: var(--sb-current-text); }
.sidebar:not(.is-hover-open) .rail-row--folder.has-current { background: var(--sb-current-bg); }
.rail-row__dot {
  position: absolute;
  top: 1px;
  right: 0;
  width: 8px;
  height: 8px;
  border: 2px solid var(--rb-surface, #fff);
  border-radius: 999px;
  background: #F59E0B;
}

/* ── The agos line ── */
/* Folded away while the rail is narrow; opens as it widens. */
.agos {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 200ms ease-out, opacity 150ms ease;
}
.is-hover-open .agos { grid-template-rows: 1fr; opacity: 1; padding-bottom: 6px; }
.agos__list {
  min-height: 0;
  overflow: hidden;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* The thread runs down the folder icon's axis: 12px row padding + half the
   24px icon box. The page names line up with the folder name (36 + 12 = 48). */
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
  border: 2px solid var(--rb-surface, #fff);
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
.agos__badge { padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }

.rail__divider { height: 1px; margin: 8px 4px; background: var(--sb-border); }
.rail__bottom {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--sb-border);
}

/* The logo stands on its own, with no tile: it carries its own red and blue,
   which a tile in the theme colour would swallow (a blue tile the wave, a red
   pick the drop), and it reads on every light and dark theme as it is. */
.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.logo-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(var(--rb-primary-rgb), 0.25);
  border-top-color: var(--rb-primary);
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


@media (prefers-reduced-motion: reduce) {
  .folder-chevron,
  .rail-row,
  .rail-row__label,
  .agos,
  .agos__link,
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
