<template>
  <div class="staff-shell">
    <!--
      The blood center's shell: the landing hero's glow behind everything, a
      frosted layer over it beside the rail and under the bar, and the glass
      sidebar and top bar on top, so all three read as one frame.
    -->
    <div class="staff-backdrop" aria-hidden="true" />
    <div class="staff-frost staff-glass" :class="railExpanded ? 'lg:left-64' : 'lg:left-[72px]'" aria-hidden="true" />
    <HospitalSidebar />

    <!-- At the very top of the document: once it is out of view, the page has scrolled. -->
    <div ref="scrollSentinel" class="absolute top-0 left-0 h-px w-px pointer-events-none" aria-hidden="true" />

    <!-- The content column follows the rail's width, so the widened rail sits beside the page. -->
    <div class="content-shift" :class="railExpanded ? 'lg:pl-64' : 'lg:pl-[72px]'">
      <header
        class="topbar staff-topbar staff-glass fixed top-0 left-0 right-0 z-30 h-14 sm:h-16 border-b"
        :class="[railExpanded ? 'lg:left-64' : 'lg:left-[72px]', { 'staff-topbar--scrolled': isScrolled }]"
        :style="{ boxShadow: isScrolled ? headerShadow : 'none' }">
        <div class="relative flex h-full w-full items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6">

          <!-- Left cluster: mobile menu toggle + titles -->
          <div v-show="!searchOpenMobile" class="flex items-center gap-2 min-w-0 lg:max-w-[calc(50%-13rem)] xl:max-w-[calc(50%-15rem)]">
            <button
              class="icon-btn flex lg:hidden"
              aria-label="Open menu"
              @click="openMobile">
              <AssetIcon name="menu" :size="20" />
            </button>

            <!-- Page title (mobile only) -->
            <span class="sm:hidden font-bold text-sm text-[color:var(--rb-text-primary)] truncate">
              {{ pageLabels[route.path] || 'Dashboard' }}
            </span>

            <!-- Breadcrumb + greeting (tablet & desktop) -->
            <div class="hidden sm:flex flex-col justify-center min-w-0 flex-shrink" :title="breadcrumb">
              <span class="hidden lg:block text-[11px] text-[color:var(--rb-text-muted)] leading-tight truncate">
                {{ breadcrumb }}
              </span>
              <span class="text-xs sm:text-sm font-semibold text-[color:var(--rb-text-primary)] leading-tight truncate">
                {{ greeting }}
              </span>
            </div>
          </div>

          <!-- Search bar -->
          <div
            v-show="searchOpenMobile || true"
            v-click-outside="closeSearchResults"
            class="search relative items-center gap-2 px-3 py-2"
            :class="[
              searchOpenMobile ? 'flex flex-1 z-40' : 'hidden sm:flex sm:flex-1',
              'lg:flex-none lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-sm xl:max-w-md lg:top-1/2 lg:-translate-y-1/2'
            ]">
            <AssetIcon name="search" :size="16" class="search__icon flex-shrink-0" />
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              placeholder="Search requests, pages..."
              class="search__input text-sm flex-1 min-w-0 bg-transparent outline-none"
              @focus="showSearchResults = true"
              @keydown.enter="goToTopResult"
              @keydown.esc="handleEscSearch"
              @keydown.down.prevent="moveHighlight(1)"
              @keydown.up.prevent="moveHighlight(-1)">
            <span v-if="!searchQuery" class="search__kbd hidden md:inline-block flex-shrink-0">{{ shortcutLabel }}</span>
            <button v-else class="search__clear flex-shrink-0" aria-label="Clear search" @click="clearSearch">
              <AssetIcon name="x" :size="14" />
            </button>

            <!-- Results dropdown -->
            <Transition name="popup">
              <div v-if="showSearchResults && searchQuery && filteredResults.length" class="search-panel">
                <NuxtLink
                  v-for="(item, i) in filteredResults"
                  :key="item.path"
                  :to="item.path"
                  class="search-panel__row"
                  :class="{ 'search-panel__row--on': i === highlightIndex }"
                  @click="closeSearchResults(); searchOpenMobile = false">
                  <AssetIcon :name="item.icon" :size="16" class="search-panel__icon" />
                  <span class="truncate">{{ item.label }}</span>
                </NuxtLink>
              </div>

              <div v-else-if="showSearchResults && searchQuery && !filteredResults.length" class="search-panel search-panel--empty">
                No matches for "{{ searchQuery }}"
              </div>
            </Transition>
          </div>

          <!-- Right cluster -->
          <div v-show="!searchOpenMobile" class="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-auto">
            <button class="icon-btn flex sm:hidden" aria-label="Open search" @click="openMobileSearch">
              <AssetIcon name="search" :size="18" />
            </button>

            <button
              class="icon-btn flex"
              :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
              @click="toggleTheme">
              <AssetIcon :name="isDark ? 'sun' : 'moon'" :size="18" />
            </button>

            <NuxtLink to="/hospital/notifications" class="icon-btn flex relative" aria-label="Notifications">
              <AssetIcon name="bell" :size="18" />
              <span v-if="unreadCount > 0" class="bell-badge">
                {{ unreadCount > 9 ? '9+' : unreadCount }}
              </span>
            </NuxtLink>

            <!-- Divider -->
            <div class="hidden sm:block w-px h-5 mx-0.5 bg-[color:var(--rb-border)]" />

            <!--
              Opens on hover with a mouse (closing after a short delay, so
              crossing the gap to the menu does not shut it), like the blood
              center. Click, tap and the keyboard still toggle it.
            -->
            <div class="relative" @mouseenter="openMenuOnHover" @mouseleave="closeMenuOnHover">
              <button
                class="flex items-center gap-1 pl-1 pr-1 sm:pr-2 py-1 rounded-full transition-colors hover:bg-[color:var(--rb-surface-hover)]"
                :aria-expanded="showUserMenu"
                aria-haspopup="menu"
                aria-label="Account menu"
                @click="showUserMenu = !showUserMenu">
                <div class="avatar avatar--sm">
                  <img v-if="user?.avatar" :src="user.avatar" alt="">
                  <span v-else>{{ initials }}</span>
                </div>
                <!-- Who is signed in, and in what role -->
                <span class="hidden xl:flex flex-col items-start min-w-0 max-w-[160px] pl-1.5 text-left leading-tight">
                  <span class="text-[13px] font-semibold text-[color:var(--rb-text-primary)] truncate max-w-full capitalize">
                    {{ displayName }}
                  </span>
                  <span class="text-[11px] text-[color:var(--rb-text-muted)] truncate max-w-full">
                    {{ roleLabel }}
                  </span>
                </span>
                <AssetIcon
                  name="chevron-down"
                  :size="14"
                  class="text-[color:var(--rb-text-muted)] hidden sm:block transition-transform duration-150"
                  :class="{ 'rotate-180': showUserMenu }" />
              </button>

              <Transition name="popup">
                <div v-if="showUserMenu" v-click-outside="closeUserMenu" class="acct" role="menu" aria-label="Account">
                  <div class="acct__head">
                    <div class="avatar avatar--lg">
                      <img v-if="user?.avatar" :src="user.avatar" alt="">
                      <span v-else>{{ initials }}</span>
                    </div>
                    <div class="acct__who">
                      <p class="acct__name">{{ user?.full_name || 'Hospital Staff' }}</p>
                      <p class="acct__email">{{ user?.facility?.facility_name || user?.email }}</p>
                      <p class="acct__role">{{ roleLabel }}</p>
                    </div>
                  </div>

                  <div class="acct__list">
                    <NuxtLink
                      v-for="item in userMenuItems"
                      :key="item.path"
                      :to="item.path"
                      role="menuitem"
                      class="acct__item"
                      @click="closeUserMenu">
                      <AssetIcon :name="item.icon" :size="16" class="acct__item-icon" />
                      <span>{{ item.label }}</span>
                    </NuxtLink>
                  </div>

                  <div class="acct__foot">
                    <button type="button" role="menuitem" class="acct__logout" @click="handleLogout">
                      <AssetIcon name="log-out" :size="15" />
                      <span>Log Out</span>
                    </button>
                  </div>

                  <p class="acct__version">v1.0.0 · Terms & Conditions</p>
                </div>
              </Transition>
            </div>
          </div>

          <!-- Mobile search close button -->
          <button v-if="searchOpenMobile" class="icon-btn flex sm:hidden ml-1" aria-label="Close search" @click="closeMobileSearch">
            <AssetIcon name="x" :size="18" />
          </button>
        </div>
      </header>

      <!-- Transparent: the glow shows through the glass bar and around each page. -->
      <main class="min-h-screen pt-14 sm:pt-16">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUser } from '@/composables/useUser'
import { useDarkMode } from '@/composables/useDarkMode'
import { useHospitalUnreadCount } from '~/composables/useHospitalUnreadCount'
import AssetIcon from '~/components/common/AssetIcon.vue'
import HospitalSidebar from '~/components/Hospital/Sidebar.vue'
import { useSidebar } from '~/composables/useSidebar.js'
import { useAccentTheme } from '~/composables/useAccentTheme'

const { railExpanded, openMobile } = useSidebar('hospital')
const router = useRouter()
const route = useRoute()
const { user, ensureUser, logout, can } = useUser()
const { isDark, toggleTheme } = useDarkMode()
// Bound, not a :global(.dark) rule: this build's scoped transform drops the
// descendant half of `:global(.dark) .x` (see the blood center layout).
const headerShadow = computed(() => (
  isDark.value
    ? '0 1px 3px rgba(0,0,0,0.30), 0 1px 2px -1px rgba(0,0,0,0.30)'
    : '0 1px 2px rgba(15,23,42,0.05)'
))

// The bell's count belongs to a signed-in hospital account, so polling starts
// only once the user is known, runs at once and then every minute, and stops
// with the layout.
const { count: unreadCount, start: startUnreadPolling, stop: stopUnreadPolling } = useHospitalUnreadCount()

onMounted(async () => {
  const signedIn = user.value ?? await ensureUser()
  if (signedIn) startUnreadPolling()
})
onUnmounted(stopUnreadPolling)

// The colour picked in Settings → Appearance (shared by the staff and donor
// portals on this device). Removed on the way out, like the blood center.
const accent = useAccentTheme()
onMounted(() => accent.init())
onUnmounted(() => accent.clear())

// --- Breadcrumb + greeting ---
const pageLabels = {
  '/hospital/dashboard': 'Dashboard',
  '/hospital/bloodrequests': 'Blood Requests',
  '/hospital/bloodrequests/newrequest' : 'Blood Requests / New Request',
  '/hospital/bloodrequests/newrequest/[id]' : 'Blood Requests / New Request / ',
  '/hospital/bloodrequests/edit' : 'Blood Requests / Edit / ',
  '/hospital/trackrequests': 'Track Requests',
  '/hospital/bloodavailability': 'Search Availability',
  '/hospital/inventory': 'Blood Bank Inventory',
  '/hospital/stock-thresholds': 'Stock Thresholds',
  '/hospital/receiving/weekly': 'Receiving / Weekly Request',
  '/hospital/receiving/weekly/new': 'Receiving / Weekly Request / New',
  '/hospital/receiving/direct-distribution': 'Receiving / Direct Distribution',
  '/hospital/notifications': 'Notifications',
  '/hospital/staff': 'Staff',
  '/hospital/settings': 'Settings',
}
// A detail page (/receiving/weekly/12) falls back to the deepest section it sits under.
const breadcrumb = computed(() => {
  const exact = pageLabels[route.path]
  if (exact) return `Hospital Portal / ${exact}`

  const parent = Object.keys(pageLabels)
    .filter((path) => route.path.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0]

  return `Hospital Portal / ${parent ? pageLabels[parent] : ''}`
})

const nameParts = computed(() => (user.value?.full_name || '').trim().split(/\s+/).filter(Boolean))
const displayName = computed(() => user.value?.full_name?.trim() || 'Hospital Staff')
const initials = computed(() => {
  const parts = nameParts.value
  if (!parts.length) return 'H'
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0]
  return letters.toUpperCase()
})
// The hospital role (Blood Bank Head, Inventory Staff, Requesting Staff).
const roleLabel = computed(() => user.value?.hospital_role_label || 'Hospital Staff')

const greeting = computed(() => {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const first = nameParts.value[0] || 'there'
  return `${time}, ${first}!`
})

// Set after mount so the server render and the first client render agree.
const shortcutLabel = ref('Ctrl F')
onMounted(() => {
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) shortcutLabel.value = '⌘F'
})

// --- Profile dropdown ---
const showUserMenu = ref(false)
const userMenuItems = [
  { label: 'Blood Requests', path: '/hospital/bloodrequests', icon: 'clipboard-list' },
  { label: 'Notification Settings', path: '/hospital/settings', icon: 'bell' }
]
const closeUserMenu = () => { showUserMenu.value = false }

// Hover only where hovering exists; on touch screens the tap toggles it.
let menuTimer = null
const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
function openMenuOnHover() {
  if (!canHover()) return
  clearTimeout(menuTimer)
  showUserMenu.value = true
}
function closeMenuOnHover() {
  if (!canHover()) return
  clearTimeout(menuTimer)
  menuTimer = setTimeout(closeUserMenu, 220)
}
onUnmounted(() => clearTimeout(menuTimer))

// --- Mobile search overlay ---
const searchOpenMobile = ref(false)

function openMobileSearch() {
  searchOpenMobile.value = true
  nextTick(() => searchInput.value?.focus())
}

function closeMobileSearch() {
  searchOpenMobile.value = false
  clearSearch()
}

function handleEscSearch() {
  if (searchOpenMobile.value) {
    closeMobileSearch()
  } else {
    clearSearch()
  }
}

// --- Global search ---
// Each page names the hospital ability it needs; a role without it is not offered the page.
const searchablePages = [
  { label: 'Dashboard', path: '/hospital/dashboard', icon: 'layout-dashboard', keywords: 'dashboard home overview' },
  { label: 'Blood Requests', path: '/hospital/bloodrequests', icon: 'clipboard-list', keywords: 'requests pending processing', requires: 'hospital.requests.view' },
  { label: 'New Request', path: '/hospital/bloodrequests/newrequest', icon: 'file-plus', keywords: 'new request create blood', requires: 'hospital.requests.manage' },
  { label: 'Search Availability', path: '/hospital/bloodavailability', icon: 'search', keywords: 'availability search blood units', requires: 'hospital.requests.view' },
  { label: 'Blood Bank Inventory', path: '/hospital/inventory', icon: 'package', keywords: 'inventory stock tag crossmatch transfusion patient bags stock in storage location receive', requires: 'hospital.inventory.view' },
  { label: 'Stock Thresholds', path: '/hospital/stock-thresholds', icon: 'sliders-horizontal', keywords: 'threshold minimum low stock alert shortage notification', requires: 'hospital.inventory.view' },
  { label: 'Weekly Request', path: '/hospital/receiving/weekly', icon: 'calendar-check', keywords: 'receiving weekly request schedule restock replenishment request days receive scan', requires: 'hospital.requests.view' },
  { label: 'Direct Distribution', path: '/hospital/receiving/direct-distribution', icon: 'truck', keywords: 'receiving direct distribution red cross prc delivery outside bags type bag number', requires: 'hospital.receiving.direct' },
  { label: 'Notifications', path: '/hospital/notifications', icon: 'bell', keywords: 'notifications alerts reminders' },
  { label: 'Staff', path: '/hospital/staff', icon: 'id-card', keywords: 'staff accounts roles head inventory requesting team users', requires: 'hospital.staff.manage' },
  { label: 'Settings', path: '/hospital/settings', icon: 'settings', keywords: 'settings preferences password' },
]

const searchQuery = ref('')
const showSearchResults = ref(false)
const highlightIndex = ref(0)
const searchInput = ref(null)

const filteredResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return searchablePages.filter(p =>
    (!p.requires || can(p.requires)) && (p.label.toLowerCase().includes(q) || p.keywords.includes(q))
  )
})

function closeSearchResults() {
  showSearchResults.value = false
  highlightIndex.value = 0
}

function clearSearch() {
  searchQuery.value = ''
  closeSearchResults()
  searchInput.value?.blur()
}

function moveHighlight(delta) {
  if (!filteredResults.value.length) return
  const max = filteredResults.value.length - 1
  highlightIndex.value = Math.min(max, Math.max(0, highlightIndex.value + delta))
}

function goToTopResult() {
  const target = filteredResults.value[highlightIndex.value] || filteredResults.value[0]
  if (!target) return
  router.push(target.path)
  clearSearch()
  searchOpenMobile.value = false
}

// ⌘F / Ctrl+F focuses the search box instead of opening browser find
function handleGlobalKeydown(e) {
  const isCmdF = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f'
  if (isCmdF) {
    e.preventDefault()
    if (window.innerWidth < 640) openMobileSearch()
    else searchInput.value?.focus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

// Has the page scrolled? An observer on the sentinel, not a scroll listener.
const scrollSentinel = ref(null)
const isScrolled = ref(false)
let sentinelObserver = null

onMounted(() => {
  if (!scrollSentinel.value || typeof IntersectionObserver === 'undefined') return
  sentinelObserver = new IntersectionObserver(([entry]) => {
    isScrolled.value = !entry.isIntersecting
  })
  sentinelObserver.observe(scrollSentinel.value)
})
onUnmounted(() => sentinelObserver?.disconnect())

// --- Click-outside directive ---
const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event)
      }
    }
    document.addEventListener('click', el._clickOutside, true)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside, true)
  }
}

const handleLogout = async () => {
  try {
    showUserMenu.value = false
    await logout('/auth/login')
  } catch (err) {
    console.error(err)
  }
}
</script>

<style scoped>
/*
 * The blood center's shell (2026-10-15), so the staff portals read as one
 * product: the same tokens, glow, glass and account menu.
 */
.content-shift { transition: padding-left 200ms ease-out; }

.topbar {
  transition: left 200ms ease-out, background-color 150ms ease, box-shadow 200ms ease;
  will-change: left;
}

main { background: transparent; }

/* ── Top bar controls ── */
.icon-btn {
  /* No display here: the template's flex / lg:hidden decide it. */
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  color: var(--rb-text-secondary);
  transition: background-color 150ms ease, color 150ms ease;
}
.icon-btn:hover { background: var(--rb-surface-hover, #F1F5F9); color: var(--rb-text-primary); }
.icon-btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; }

/* On the bell's top-right corner only, so the count never covers the icon. */
.bell-badge {
  position: absolute;
  top: 3px;
  left: calc(50% + 3px);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  border: 2px solid var(--rb-surface);
  background: var(--rb-accent, #D32F2F);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 12px;
  text-align: center;
  box-sizing: border-box;
  pointer-events: none;
}

.search {
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.search:hover { border-color: var(--rb-border-strong); }
.search:focus-within {
  border-color: rgba(var(--rb-primary-rgb), 0.4);
  box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.1);
}
.search__icon { color: var(--rb-text-muted); }
.search__input { color: var(--rb-text-primary); }
.search__input:focus { outline: none; }
.search__kbd {
  padding: 2px 6px;
  border: 1px solid var(--rb-border);
  border-radius: 6px;
  background: var(--rb-surface-alt, #F1F5F9);
  color: var(--rb-text-muted);
  font-family: var(--rb-font-mono, ui-monospace, monospace);
  font-size: 10px;
}
.search__clear { color: var(--rb-text-muted); }
.search__clear:hover { color: var(--rb-text-primary); }

.search-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  z-index: 40;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
  box-shadow: 0 16px 40px -16px rgba(15, 23, 42, 0.3);
  scrollbar-width: thin;
}
.search-panel--empty { padding: 12px 16px; font-size: 14px; color: var(--rb-text-secondary); }
.search-panel__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  font-size: 14px;
  color: var(--rb-text-primary);
  text-decoration: none;
  transition: background-color 150ms ease;
}
.search-panel__row:hover,
.search-panel__row--on { background: var(--rb-surface-hover, #F1F5F9); }
.search-panel__icon { flex-shrink: 0; color: var(--rb-text-muted); }

.avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--rb-primary);
  color: #fff;
  font-weight: 700;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar--sm { width: 32px; height: 32px; font-size: 11px; letter-spacing: 0.02em; box-shadow: 0 0 0 2px var(--rb-surface); }
.avatar--lg { width: 38px; height: 38px; font-size: 13px; }

/* ── Account menu: the blood center's ── */
.acct {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 40;
  width: 280px;
  overflow: hidden;
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  background: var(--rb-surface, #FFFFFF);
  box-shadow: 0 16px 40px -16px rgba(15, 23, 42, 0.3);
}
/* An invisible bridge over the 8px gap, so moving down to the menu does not count as leaving. */
.acct::before {
  content: '';
  position: absolute;
  top: -10px;
  left: 0;
  right: 0;
  height: 10px;
}
.acct__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--rb-border);
}
.acct__who { min-width: 0; }
.acct__name,
.acct__email,
.acct__role { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acct__name { font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.acct__email { font-size: 12px; color: var(--rb-text-secondary); }
.acct__role { margin-top: 2px; font-size: 11.5px; font-weight: 600; color: var(--rb-primary-text); }

.acct__list { display: flex; flex-direction: column; padding: 6px; }
.acct__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  border-radius: 10px;
  color: var(--rb-text-primary);
  font-size: 13.5px;
  text-decoration: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.acct__item-icon { flex-shrink: 0; color: var(--rb-text-secondary); transition: color 0.15s ease; }
.acct__item:hover,
.acct__item:focus-visible { background: var(--rb-surface-hover, #F1F5F9); color: var(--rb-primary-text); outline: none; }
.acct__item:hover .acct__item-icon,
.acct__item:focus-visible .acct__item-icon { color: var(--rb-primary-text); }

.acct__foot { padding: 6px; border-top: 1px solid var(--rb-border); }
.acct__logout {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13.5px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.acct__logout:hover,
.acct__logout:focus-visible { background: rgba(198, 40, 40, 0.08); color: #C62828; outline: none; }
.acct__version {
  margin: 0;
  padding: 8px 16px;
  border-top: 1px solid var(--rb-border);
  font-size: 11px;
  text-align: center;
  color: var(--rb-text-muted);
}

:global(.dark .staff-shell .acct),
:global(.dark .staff-shell .search-panel) { box-shadow: 0 16px 40px -16px rgba(0, 0, 0, 0.7); }
:global(.dark .staff-shell .acct__logout:hover),
:global(.dark .staff-shell .acct__logout:focus-visible) { background: rgba(239, 83, 80, 0.14); color: #EF9A9A; }

.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .content-shift, .topbar, .icon-btn, .acct__item, .acct__logout { transition: none; }
}

a, button { touch-action: manipulation; }
</style>
