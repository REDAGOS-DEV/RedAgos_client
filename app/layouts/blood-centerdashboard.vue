<template>
  <div class="bc-shell">
    <!--
      As the donor portal: a plain canvas behind everything, under solid
      chrome (the top bar and the sidebar). Pages paint their own background.
    -->
    <div class="bc-backdrop" aria-hidden="true" />
    <BloodCenterSidebar />

    <!-- Sentinel sa pinakataas sa document: kung dili na makita, naka-scroll na -->
    <div ref="scrollSentinel" class="absolute top-0 left-0 h-px w-px pointer-events-none" aria-hidden="true" />

    <!--
      The content column tracks the rail's width instead of a fixed lg:pl-64.
      Padding — not a margin or a transform — because it is the one property
      that both reserves the space and reflows the children inside it, which is
      what keeps the widened sidebar beside the page rather than over it.
    -->
    <div class="content-shift" :class="railExpanded ? 'lg:pl-64' : 'lg:pl-[72px]'">
      <!--
        Desktop: the bar runs the full width above the sidebar, as in the donor
        portal: menu button and brand at its left edge on the rail's icon axis,
        the search in the middle, the account on the right.
      -->
      <header
        class="topbar fixed top-0 left-0 right-0 z-30 lg:z-[60] h-14 sm:h-16 border-b transition-[box-shadow,background-color] duration-200"
        :class="{ 'topbar--scrolled': isScrolled }"
        :style="{ boxShadow: isScrolled ? headerShadow : 'none' }">
        <!--
          Same as the donor portal: the bar shares the page and sidebar canvas
          (--rb-page-bg) so only the white cards stand out, and turns
          translucent with a hairline shadow once the page scrolls.
        -->

        <!--
          The bar spans the full width — it carries the background and the
          divider — but its contents sit in the same centred --rb-content-max column the
          pages use, with the same 16/32px gutters. Left full-width, the
          breadcrumb started ~46px inside of the page title directly beneath it
          and the avatar overhung the right edge of the content by about as
          much, so the chrome and the page it framed were on two different
          grids.
        -->
        <div class="topbar-inner relative mx-auto flex h-full w-full max-w-[var(--rb-content-max)] lg:max-w-none items-center gap-2 sm:gap-3 px-4 sm:px-6 lg:px-4">

        <!-- Left cluster: drawer toggle + titles -->
        <!--
          The search is absolutely centred on lg+, so this cluster does not
          know where it ends. Capping it at half the bar minus half the search
          (plus a 1rem gap) makes a long breadcrumb truncate before it slides
          under the search box.
        -->
        <div v-show="!searchOpenMobile" class="flex items-center gap-2 min-w-0 lg:max-w-[calc(50%-13rem)] xl:max-w-[calc(50%-15rem)]">
          <!--
            The menu button: on desktop it opens the rail, which closes again
            when the pointer leaves it (components/BloodCenter/Sidebar.vue);
            below 1024px it opens the drawer. On the rail's 36px icon axis.
          -->
          <button
            type="button"
            class="rail-toggle"
            data-rail-toggle
            :aria-expanded="railExpanded || mobileOpen"
            aria-controls="blood-center-sidebar"
            :aria-label="railExpanded ? 'Close menu' : 'Open menu'"
            @click="toggleMenu">
            <AssetIcon name="menu" :size="20" />
          </button>

          <NuxtLink :to="homePath" class="bc-logo" :aria-label="`RedAgos, go to ${pageHomeLabel}`">
            <img :src="logo" alt="" class="bc-logo__img">
          </NuxtLink>

          <!--
            The wordmark, and beneath it where this page sits: the centre, its
            department and the page on desktop; the centre alone below that.
          -->
          <div class="brand-word">
            <NuxtLink :to="homePath" class="brand-word__name" tabindex="-1" aria-hidden="true">
              Red<span class="brand-word__accent">Agos</span>
            </NuxtLink>
            <span class="brand-word__tag lg:hidden">{{ facilityName || 'Blood Center Portal' }}</span>
            <nav class="brand-crumb hidden lg:block" aria-label="Breadcrumb" :title="breadcrumb">
              <ol>
                <li v-for="(crumb, i) in crumbs" :key="i" :aria-current="i === crumbs.length - 1 ? 'page' : null">
                  {{ crumb }}
                </li>
              </ol>
            </nav>
          </div>
        </div>

        <div
          v-show="searchOpenMobile || true"
          v-click-outside="closeSearchResults"
          class="items-center gap-2 rounded-xl bg-white dark:bg-[color:var(--ink-surface,#1E293B)] border border-[#E2E8F0] dark:border-[color:var(--ink-border,#334155)] hover:border-[#CBD5E1] dark:hover:border-[color:var(--ink-border-hover,#475569)] focus-within:border-[color:rgba(var(--rb-primary-rgb),0.4)] focus-within:ring-2 focus-within:ring-[color:rgba(var(--rb-primary-rgb),0.1)] transition-colors px-3 py-2 relative"
          :class="[
            searchOpenMobile
              ? 'flex flex-1 z-40'
              : 'hidden sm:flex sm:flex-1',
            'lg:flex-none lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-sm xl:max-w-md lg:top-1/2 lg:-translate-y-1/2'
          ]"
        >
          <AssetIcon name="search" :size="16" class="text-[#94a3b8] dark:text-slate-500 flex-shrink-0" />
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            placeholder="Search pages, records..."
            class="text-sm flex-1 min-w-0 bg-transparent outline-none placeholder:text-[#64748b] dark:placeholder:text-[#94a3b8] text-gray-800 dark:text-slate-100"
            @focus="showSearchResults = true"
            @keydown.enter="goToTopResult"
            @keydown.esc="handleEscSearch"
            @keydown.down.prevent="moveHighlight(1)"
            @keydown.up.prevent="moveHighlight(-1)"
          >
          <span
            v-if="!searchQuery"
            class="text-[10px] px-1.5 py-0.5 rounded-md font-mono hidden md:inline-block bg-white dark:bg-[color:var(--ink-hover,#334155)] text-[#94a3b8] dark:text-[color:var(--ink-text-3,#CBD5E1)] border border-[#eef1f5] dark:border-[color:var(--ink-border-hover,#475569)] flex-shrink-0"
          >
            {{ shortcutLabel }}
          </span>
          <button
            v-else
            class="text-[#94a3b8] dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 flex-shrink-0"
            aria-label="Clear search"
            @click="clearSearch"
          >
            <AssetIcon name="x" :size="14" />
          </button>

          <Transition name="popup">
            <div
              v-if="showSearchResults && searchQuery && filteredResults.length"
              class="search-panel absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden bg-white dark:bg-[color:var(--ink-surface,#0F172A)] border dark:border-[color:var(--ink-border,#334155)] shadow-lg z-40"
              :style="{ borderColor: headerBorderColor }"
            >
              <NuxtLink
                v-for="(item, i) in filteredResults"
                :key="item.path"
                :to="item.path"
                class="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                :class="i === highlightIndex
                  ? 'bg-gray-50 dark:bg-[color:var(--ink-hover,#1E293B)] text-gray-900 dark:text-slate-100'
                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-[color:var(--ink-hover,#1E293B)]'"
                @click="closeSearchResults(); searchOpenMobile = false"
              >
                <AssetIcon :name="item.icon" :size="16" class="text-gray-400 dark:text-slate-500 flex-shrink-0" />
                <span class="truncate">{{ item.label }}</span>
                <span v-if="item.isHelp" class="search-help-tag">Help</span>
              </NuxtLink>
            </div>

            <div
              v-else-if="showSearchResults && searchQuery && !filteredResults.length"
              class="absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden bg-white dark:bg-[color:var(--ink-surface,#0F172A)] border dark:border-[color:var(--ink-border,#334155)] shadow-lg z-40 px-4 py-3 text-sm text-gray-500 dark:text-slate-400"
              :style="{ borderColor: headerBorderColor }"
            >
              No matches for "{{ searchQuery }}"
            </div>
          </Transition>
        </div>

        <div v-show="!searchOpenMobile" class="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-auto">
          <button
            class="sm:hidden w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
            aria-label="Open search"
            @click="openMobileSearch"
          >
            <AssetIcon name="search" :size="18" class="text-[#64748b] dark:text-slate-300" />
          </button>

          <!-- Theme lives in the account menu (Light / Dark / System); the header
               keeps only what staff reach for often. -->
          <!-- Back now that the facility notification endpoints exist. -->
          <BloodCenterNotificationBell />

          <!--
            `xs:` is not a breakpoint in this project — tailwind.config.js adds
            no screens, so `hidden xs:block` compiled to `hidden` and this
            divider never rendered at any width. sm is the real first step up.
          -->
          <div class="hidden sm:block w-px h-5 mx-0.5 bg-[#EEF1F5] dark:bg-[color:var(--ink-border,#334155)]" />

          <!--
            Opens on hover with a mouse (closing after a short delay, so
            crossing the gap to the menu does not shut it), like the donor
            portal. Click, tap and the keyboard still toggle it.
          -->
          <div class="relative" @mouseenter="openMenuOnHover" @mouseleave="closeMenuOnHover">
            <button
              ref="userMenuTrigger"
              class="flex items-center gap-1 pl-1 pr-1 sm:pr-2 py-1 rounded-full transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
              :aria-expanded="showUserMenu"
              aria-haspopup="menu"
              aria-label="Account menu"
              @click="toggleUserMenu"
            >
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] tracking-wide text-white overflow-hidden flex-shrink-0 ring-2 ring-white dark:ring-[color:var(--rb-chrome,#0F172A)]"
                style="background: var(--rb-primary)"
              >
                <img v-if="user?.avatar" :src="user.avatar" class="w-full h-full object-cover" alt="">
                <span v-else>{{ initials }}</span>
              </div>
              <!-- Who is signed in, and at what level: on a shared counter PC
                   this is the first thing to check before recording anything. -->
              <span class="hidden xl:flex flex-col items-start min-w-0 max-w-[160px] pl-1.5 text-left leading-tight">
                <span class="text-[13px] font-semibold text-gray-800 dark:text-slate-100 truncate max-w-full capitalize">
                  {{ displayName }}
                </span>
                <span v-if="roleLabel" class="text-[11px] text-[#64748b] dark:text-slate-400 truncate max-w-full">
                  {{ roleLabel }}
                </span>
              </span>
              <AssetIcon
                name="chevron-down"
                :size="14"
                class="text-[#94a3b8] dark:text-slate-500 hidden sm:block transition-transform duration-150"
                :class="{ 'rotate-180': showUserMenu }"
              />
            </button>

            <Transition name="popup">
              <div
                v-if="showUserMenu"
                ref="userMenuEl"
                v-click-outside="closeUserMenu"
                class="acct"
                role="menu"
                aria-label="Account"
                @keydown.esc.prevent="closeUserMenu(true)"
                @keydown.down.prevent="moveMenuFocus(1)"
                @keydown.up.prevent="moveMenuFocus(-1)"
              >
                <!-- Who is signed in, and at what level (a shared counter PC needs both) -->
                <div class="acct__head">
                  <div class="acct__avatar">
                    <img v-if="user?.avatar" :src="user.avatar" alt="">
                    <span v-else>{{ initials }}</span>
                  </div>
                  <div class="acct__who">
                    <p class="acct__name">{{ displayName }}</p>
                    <p class="acct__email">{{ user?.email }}</p>
                    <p v-if="roleLabel || workplaceLabel" class="acct__role">
                      {{ [roleLabel, workplaceLabel].filter(Boolean).join(' · ') }}
                    </p>
                  </div>
                </div>

                <div class="acct__list">
                  <NuxtLink
                    v-for="item in userMenuItems"
                    :key="item.path"
                    :to="item.path"
                    role="menuitem"
                    class="account-menu__item acct__item"
                    @click="closeUserMenu()"
                  >
                    <AssetIcon :name="item.icon" :size="16" class="acct__item-icon" />
                    <span class="acct__item-label">{{ item.path === '/blood-center/settings' ? 'Account settings' : item.label }}</span>
                  </NuxtLink>
                </div>

                <!-- Theme: Light / Dark / System (same as the browser) -->
                <div class="acct__theme">
                  <div class="acct__theme-row">
                    <span class="acct__theme-label">
                      <AssetIcon :name="isDark ? 'moon' : 'sun'" :size="15" />
                      Theme
                    </span>
                    <div class="acct__seg" role="group" aria-label="Theme">
                      <button
                        v-for="option in THEME_OPTIONS"
                        :key="option.value"
                        type="button"
                        role="menuitemradio"
                        :aria-checked="themeMode === option.value"
                        :aria-label="option.label"
                        :title="option.label"
                        class="account-menu__item acct__seg-btn"
                        :class="{ 'acct__seg-btn--on': themeMode === option.value }"
                        @click="setThemeMode(option.value)"
                      >
                        <AssetIcon :name="option.icon" :size="14" />
                      </button>
                    </div>
                  </div>
                  <p class="acct__theme-hint">{{ themeHint }}</p>
                </div>

                <div class="acct__foot">
                  <!-- Neutral: signing out is routine, not destructive. Red only on hover. -->
                  <button
                    type="button"
                    role="menuitem"
                    class="account-menu__item acct__logout"
                    @click="handleLogout"
                  >
                    <AssetIcon name="log-out" :size="15" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <button
          v-if="searchOpenMobile"
          class="sm:hidden w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ml-1 transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
          aria-label="Close search"
          @click="closeMobileSearch"
        >
          <AssetIcon name="x" :size="18" class="text-[#64748b] dark:text-slate-300" />
        </button>
        </div>
      </header>

      <!-- Every blood-centre page paints its own --rb-page-bg. -->
      <main class="min-h-screen transition-colors duration-150 pt-14 sm:pt-16">
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
import { useSidebar } from '~/composables/useSidebar.js'
import AssetIcon from '~/components/common/AssetIcon.vue'
import BloodCenterNotificationBell from '~/components/BloodCenter/NotificationBell.vue'
import { HELP_GUIDES, guideVisible, searchGuides } from '~/utils/bloodCenterHelp'
import { useAccentTheme } from '~/composables/useAccentTheme'
import { accentSurfaces, accentTheme } from '~/utils/accentThemes'
import { departmentHome } from '~/composables/useBloodCenterNav'
import logo from '~/assets/images/RedAgosLogo.png'

const router = useRouter()
const route = useRoute()
const { user, ensureUser, logout } = useUser()
// Ang nav kay usa ra ka source — parehas sa sidebar, sa ⌘F search ug sa
// profile dropdown, aron walay surface nga mo-offer og route nga i-refuse
// ra sa server.
const { searchablePages, userMenuItems, labelForPath, sectionForPath } = useBloodCenterNav()
const { isDark, themeMode, setThemeMode } = useDarkMode()

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System (same as your browser)', icon: 'monitor' },
]
const { railExpanded, mobileOpen, openMobile, expandOnHover, collapseOnHover } = useSidebar('blood-center')

// One button for both: the rail on desktop, the drawer below 1024px.
function toggleMenu() {
  if (window.matchMedia('(min-width: 1024px)').matches) {
    if (railExpanded.value) collapseOnHover()
    else expandOnHover()
  } else {
    openMobile()
  }
}

// The logo goes to this user's own landing page (as the sidebar's did).
const homePath = computed(() => departmentHome(user.value))
const pageHomeLabel = computed(() => (homePath.value === '/blood-center/dashboard' ? 'the overview' : 'your dashboard'))

// The donor portal's palette (main.css): the canvas, chrome and every
// surface take the colour theme's tint, light and dark.
onMounted(() => document.documentElement.classList.add('portal-bc'))
onUnmounted(() => document.documentElement.classList.remove('portal-bc'))

const headerBorderColor = computed(() => (isDark.value ? '#334155' : '#E5EAF0'))
/*
 * Bound rather than written as a `:global(.dark) .topbar` rule: this build's
 * scoped-CSS transform drops the descendant half of `:global(.dark) .x` and
 * emits a bare `.dark { … }`, which hung the header's shadow on <html>.
 */
const headerShadow = computed(() => (
  isDark.value
    ? '0 1px 3px rgba(0,0,0,0.30), 0 1px 2px -1px rgba(0,0,0,0.30)'
    : '0 1px 2px rgba(15,23,42,0.05)'
))

onMounted(() => {
  ensureUser()
})

// The colour theme picked in Settings → Appearance (shared by the donor and
// blood center portals on this device). Removed on the way out, so portals
// without the picker keep the standard blue.
const accent = useAccentTheme()
onMounted(() => accent.init())
onUnmounted(() => accent.clear())

// The browser's own bar (the tab strip on desktop when installed, the status
// and address bar on phones) takes the header's colour, as in the donor
// portal, so the browser and the portal read as one. Tinted by the colour
// theme, light and dark. Set on the one tag by hand: useHead left the
// server-rendered tag beside the client's, and browsers read the first.
let themeColorMeta = null
function applyThemeColor() {
  if (!themeColorMeta) {
    themeColorMeta = document.querySelector('meta[name="theme-color"]') ?? document.createElement('meta')
    themeColorMeta.setAttribute('name', 'theme-color')
    if (!themeColorMeta.isConnected) document.head.appendChild(themeColorMeta)
  }
  const { light, dark } = accentSurfaces(accentTheme(accent.current.value))
  themeColorMeta.setAttribute('content', isDark.value ? dark.chrome : light.chrome)
}
onMounted(applyThemeColor)
watch([isDark, accent.current], () => { if (themeColorMeta) applyThemeColor() })
onUnmounted(() => {
  themeColorMeta?.remove()
  themeColorMeta = null
})

// The path as the nav knows it, with the one query that picks a view.
const navPath = computed(() => (route.query.test ? `${route.path}?test=${route.query.test}` : route.path))

const facilityName = computed(() =>
  user.value?.facility?.facility_name || user.value?.facility?.name || ''
)

// The sidebar is grouped by department, so the breadcrumb says which one the
// page belongs to: "Davao Blood Center / Issuance / Blood Inventory".
const sectionLabel = computed(() => sectionForPath(route.path))

// Desktop: "Centre › Department › Page". When the bar runs short the
// centre's name gives way first (an ellipsis, the full name in the tooltip),
// so the department and the page always read in full.
const crumbs = computed(() =>
  [facilityName.value || 'Blood Center Portal', sectionLabel.value, labelForPath(navPath.value)].filter(Boolean)
)
const breadcrumb = computed(() => [facilityName.value, ...crumbs.value].filter(Boolean).join(' / '))

const nameParts = computed(() => {
  const parts = [user.value?.first_name, user.value?.last_name].map(v => (v || '').trim()).filter(Boolean)
  return parts.length ? parts : (user.value?.full_name || '').trim().split(/\s+/).filter(Boolean)
})

const displayName = computed(() => user.value?.full_name?.trim() || nameParts.value.join(' ') || 'Blood Center')

const initials = computed(() => {
  const parts = nameParts.value
  if (!parts.length) return 'B'
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0]
  return letters.toUpperCase()
})

// "Blood Center Admin", "Lab Supervisor", "Supervisor · Phlebotomist", or the
// department when nothing more specific is set.
const roleLabel = computed(() => {
  const u = user.value
  if (!u) return ''
  const role = u.staff_role_label || u.role_label || u.custom_role || ''
  const parts = [u.management_level_label || '', role].filter(Boolean)
  const unique = parts.filter((part, i) => parts.findIndex(p => p.toLowerCase() === part.toLowerCase()) === i)
  return unique.join(' · ') || u.department_label || ''
})

// Set after mount so the server render and the first client render agree.
const shortcutLabel = ref('Ctrl F')
onMounted(() => {
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
    shortcutLabel.value = '⌘F'
  }
})

// "Processing · Sub-National Blood Center": where this person works.
const workplaceLabel = computed(() =>
  [user.value?.management_level ? null : user.value?.department_label, facilityName.value]
    .filter(Boolean)
    .join(' · ')
)

const userMenuEl = ref(null)
const userMenuTrigger = ref(null)

/** Open, then put focus on the first item so the keyboard can carry on. */
async function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
  if (showUserMenu.value) {
    await nextTick()
    userMenuEl.value?.querySelector('.account-menu__item')?.focus()
  }
}

/** Arrow keys walk the menu's items, wrapping at either end. */
function moveMenuFocus(step) {
  const items = [...(userMenuEl.value?.querySelectorAll('.account-menu__item') ?? [])]
  if (!items.length) return
  const index = items.indexOf(document.activeElement)
  items[(index + step + items.length) % items.length]?.focus()
}

const showUserMenu = ref(false)
const closeUserMenu = (returnFocus = false) => {
  if (returnFocus === true) nextTick(() => userMenuTrigger.value?.focus())
  showUserMenu.value = false
}

// Hover only where hovering exists; on touch screens the tap toggles it.
// Opening on hover does not move focus (that stays a keyboard/click thing).
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
  menuTimer = setTimeout(() => closeUserMenu(), 220)
}
onUnmounted(() => clearTimeout(menuTimer))

const themeHint = computed(() => (
  themeMode.value === 'system'
    ? `Following your browser (${isDark.value ? 'dark' : 'light'})`
    : `Always ${themeMode.value}`
))

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

const searchQuery = ref('')
const showSearchResults = ref(false)
const highlightIndex = ref(0)
const searchInput = ref(null)

const filteredResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  // searchablePages kay gi-filter na daan sa permissions, so dili gyud
  // makasulod sa results ang page nga dili niya maabot.
  const pages = searchablePages.value.filter(p =>
    p.label.toLowerCase().includes(q) || (p.keywords ?? '').includes(q)
  )
  // Then the help guides that answer it, for pages this account can open, so
  // "void" or "quarantine" finds how-to as well as where to go.
  const allowed = new Set(searchablePages.value.map(p => p.path.split('?')[0]))
  const help = searchGuides(q, HELP_GUIDES.filter(g => guideVisible(g, allowed)))
    .slice(0, 4)
    .map(g => ({ label: g.title, path: `/blood-center/help?guide=${g.id}`, icon: 'life-buoy', isHelp: true }))
  return [...pages, ...help]
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

// Naka-scroll na ba ang page? IntersectionObserver sa sentinel, dili scroll
// listener, aron walay trabaho matag scroll frame. Same as the donor layout.
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

onUnmounted(() => {
  sentinelObserver?.disconnect()
})

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
  showUserMenu.value = false
  await logout('/auth/blood-center/login')
}
</script>

<style scoped>
/*
 * Both of these carry the sidebar's own 200ms/ease-out, so the rail, the
 * header's left edge and the content column arrive together. Mismatched
 * durations here are what make a reflowing sidebar look like it is tearing.
 */
.content-shift {
  transition: padding-left 200ms ease-out;
}

/* ── Account menu: plain and quiet ── */
.acct {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 40;
  width: 280px;
  overflow: hidden;
  border: 1px solid var(--rb-border, #E5EAF0);
  border-radius: 16px;
  background: var(--rb-surface, #FFFFFF);
  box-shadow: 0 16px 40px -16px rgba(15, 23, 42, 0.3);
}

/* An invisible bridge over the 8px gap, so moving the pointer from the
   avatar down to the menu does not count as leaving it. */
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
  border-bottom: 1px solid var(--rb-border, #E5EAF0);
}

.acct__avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--rb-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.acct__avatar img { width: 100%; height: 100%; object-fit: cover; }
.acct__who { min-width: 0; }

.acct__name,
.acct__email,
.acct__role { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.acct__name { font-size: 14px; font-weight: 700; color: var(--rb-text-primary, #1F2937); text-transform: capitalize; }
.acct__email { font-size: 12px; color: var(--rb-text-secondary, #64748B); }
.acct__role { margin-top: 2px; font-size: 11.5px; font-weight: 600; color: var(--rb-primary-text); }

.acct__list { display: flex; flex-direction: column; padding: 6px; }

.acct__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  border-radius: 10px;
  color: var(--rb-text-primary, #1F2937);
  font-size: 13.5px;
  text-decoration: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.acct__item-icon { flex-shrink: 0; color: var(--rb-text-secondary, #94A3B8); transition: color 0.15s ease; }
.acct__item-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.acct__item:hover,
.acct__item:focus-visible { background: var(--rb-surface-hover, #F1F5F9); color: var(--rb-primary-text); outline: none; }
.acct__item:hover .acct__item-icon,
.acct__item:focus-visible .acct__item-icon { color: var(--rb-primary-text); }

.acct__theme { padding: 8px 16px 10px; border-top: 1px solid var(--rb-border, #E5EAF0); }
.acct__theme-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

.acct__theme-label {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13.5px;
  color: var(--rb-text-primary, #1F2937);
}

.acct__theme-label :deep(svg) { color: var(--rb-text-secondary, #94A3B8); }

.acct__seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: 9px; background: var(--rb-surface-alt, #F1F5F9); }

.acct__seg-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--rb-text-secondary, #64748B);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.acct__seg-btn:hover:not(.acct__seg-btn--on) { color: var(--rb-text-primary, #1F2937); }
.acct__seg-btn--on { background: var(--rb-surface, #FFFFFF); color: var(--rb-primary-text); box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12); }
.acct__seg-btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; }

.acct__theme-hint { margin: 2px 0 0 28px; font-size: 11.5px; color: var(--rb-text-secondary, #94A3B8); }

.acct__foot { padding: 6px; border-top: 1px solid var(--rb-border, #E5EAF0); }

.acct__logout {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--rb-text-primary, #1F2937);
  font: inherit;
  font-size: 13.5px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.acct__logout:hover,
.acct__logout:focus-visible { background: rgba(198, 40, 40, 0.08); color: #C62828; outline: none; }

@media (prefers-reduced-motion: reduce) {
  .acct__item, .acct__item-icon, .acct__seg-btn, .acct__logout { transition: none; }
}

:global(.dark .bc-shell .acct) { box-shadow: 0 16px 40px -16px rgba(0, 0, 0, 0.7); }
:global(.dark .bc-shell .acct__logout:hover),
:global(.dark .bc-shell .acct__logout:focus-visible) { background: rgba(239, 83, 80, 0.14); color: #EF9A9A; }

/*
 * Every blood-centre page paints its root with --rb-page-bg. Inside this
 * portal that is see-through, so the pages sit on the same tinted backdrop as
 * the frosted top bar and sidebar instead of a flat grey that never matched
 * them. Cards keep --rb-surface. Teleported modals are outside .bc-shell and
 * keep the normal value.
 */
.bc-shell {
  --rb-page-bg: transparent;

  /*
   * Colour for work screens (2026-10-15). Hints and placeholders meet WCAG AA
   * (4.5:1) on white; secondary text is a step darker so the two still differ;
   * card edges stay visible on dim counter monitors.
   */
  --rb-text-secondary: #526075;
  --rb-text-muted: #64748B;
  --rb-placeholder: #64748B;
  --rb-border: #E4E9F0;
  --rb-border-strong: #D5DCE6;
}
/* Every field's placeholder in the readable grey, including fields whose page
   sets none (Tailwind's own default is too faint for a counter screen). */
:global(.bc-shell input::placeholder),
:global(.bc-shell textarea::placeholder) {
  color: var(--rb-placeholder);
  opacity: 1;
}

:global(.dark .bc-shell) {
  /* The donor portal's ink levels (main.css), so text keeps its contrast on
     the tinted surfaces. */
  --rb-text-secondary: var(--ink-text-2, #94A3B8);
  --rb-text-muted: var(--ink-muted, #8391A6);
  --rb-placeholder: var(--ink-text-2, #8391A6);
  --rb-border: var(--ink-border, #334155);
  --rb-border-strong: var(--ink-border, #3E4C63);
}

/* ── Backdrop: a plain canvas, as in the donor portal ── */
.bc-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  /* The donor canvas (main.css); --rb-page-bg itself is transparent inside
     .bc-shell, so the pages show this through. */
  background: var(--accent-canvas-light, #F5F6F8);
}
:global(.dark .bc-shell .bc-backdrop) { background: var(--ink-page, #0B1220); }

/* Solid chrome, shared with the sidebar: --rb-chrome (main.css, html.portal-bc). */
.topbar {
  /* The token, not a bound colour: a bound one keeps the server's light value after hydration. */
  border-color: var(--rb-border);
  background-color: var(--rb-chrome, #FFFFFF);
  transition: background-color 150ms ease, border-color 150ms ease, box-shadow 200ms ease;
}

main {
  background: transparent;
}

/* ── Brand: menu button, logo, wordmark and breadcrumb ── */
.rail-toggle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--rb-text-primary, #1E293B);
  cursor: pointer;
  transition: background-color 150ms ease;
}
.rail-toggle:hover { background: rgba(15, 23, 42, 0.06); }
:global(.dark .bc-shell .rail-toggle:hover) { background: rgba(255, 255, 255, 0.08); }
.rail-toggle:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.rail-toggle:active { transform: scale(0.95); }

/* The logo stands on its own, as in the donor portal: no tile to swallow its
   red and blue. */
.bc-logo { display: flex; flex-shrink: 0; width: 40px; height: 40px; border-radius: 10px; }
.bc-logo__img { width: 100%; height: 100%; object-fit: contain; }
.bc-logo:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
@media (min-width: 1024px) {
  .bc-logo { width: 48px; height: 48px; }
}

.brand-word { display: inline-flex; flex-direction: column; justify-content: center; min-width: 0; }
.brand-word__name {
  font-family: var(--rb-font-sans);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: var(--rb-text-primary);
  text-decoration: none;
}
.brand-word__accent { color: #D32F2F; }
.brand-word__tag {
  margin-top: 2px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.1;
  color: var(--rb-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Centre › Department › Page; the page keeps its room, the rest give way. */
.brand-crumb { margin-top: 2px; min-width: 0; }
.brand-crumb ol { display: flex; align-items: center; min-width: 0; margin: 0; padding: 0; list-style: none; font-size: 12px; line-height: 1.1; }
.brand-crumb li { flex-shrink: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--rb-text-secondary); font-weight: 500; }
.brand-crumb li + li::before { content: '\203A'; margin: 0 5px; opacity: 0.7; }
.brand-crumb li:first-child:not(:last-child) { flex-shrink: 1; }
.brand-crumb li[aria-current] { flex-shrink: 0; max-width: 100%; color: var(--rb-text-primary); font-weight: 600; }

.search-panel {
  max-height: 320px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--rb-border-hover) transparent;
}

.search-panel::-webkit-scrollbar {
  width: 5px;
}

.search-panel::-webkit-scrollbar-thumb {
  /* Token, not a paired :global(.dark) rule — see headerShadow. */
  background-color: var(--rb-border-hover);
  border-radius: 999px;
}

.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}

input:focus {
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  .content-shift,
  .topbar,
  .rail-toggle {
    transition: none;
  }
}

a, button {
  touch-action: manipulation;
}

/* A help guide among the search results. */
.search-help-tag {
  margin-left: auto;
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--rb-primary-text);
  background: rgba(var(--rb-primary-rgb), 0.1);
}

</style>
