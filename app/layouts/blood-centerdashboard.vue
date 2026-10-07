<template>
  <div>
    <BloodCenterSidebar />

    <!-- Sentinel sa pinakataas sa document: kung dili na makita, naka-scroll na -->
    <div ref="scrollSentinel" class="absolute top-0 left-0 h-px w-px pointer-events-none" aria-hidden="true" />

    <!--
      The content column tracks the rail's width instead of a fixed lg:pl-64.
      Padding — not a margin or a transform — because it is the one property
      that both reserves the space and reflows the children inside it, which is
      what keeps the widened sidebar beside the page rather than over it.
    -->
    <div class="content-shift" :class="railExpanded ? 'lg:pl-64' : 'lg:pl-20'">
      <header
        class="topbar fixed top-0 left-0 right-0 z-30 h-14 sm:h-16 border-b transition-[box-shadow,background-color] duration-200"
        :class="[railExpanded ? 'lg:left-64' : 'lg:left-20', { 'topbar--scrolled': isScrolled }]"
        :style="{ borderColor: headerBorderColor, boxShadow: isScrolled ? headerShadow : 'none' }">
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
        <div class="topbar-inner relative mx-auto flex h-full w-full max-w-[var(--rb-content-max)] items-center gap-2 sm:gap-3 px-4 sm:px-6">

        <!-- Left cluster: drawer toggle + titles -->
        <!--
          The search is absolutely centred on lg+, so this cluster does not
          know where it ends. Capping it at half the bar minus half the search
          (plus a 1rem gap) makes a long breadcrumb truncate before it slides
          under the search box.
        -->
        <div v-show="!searchOpenMobile" class="flex items-center gap-2 min-w-0 lg:max-w-[calc(50%-13rem)] xl:max-w-[calc(50%-15rem)]">
          <button
            class="lg:hidden w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
            aria-label="Open menu"
            @click="openMobile">
            <AssetIcon name="menu" :size="20" class="text-[#64748b] dark:text-slate-300" />
          </button>

          <!-- Page title (small screens, where the breadcrumb does not fit) -->
          <span class="sm:hidden font-bold text-sm text-gray-800 dark:text-slate-100 truncate">
            {{ pageLabel }}
          </span>

          <div class="hidden sm:flex flex-col justify-center min-w-0 flex-shrink" :title="breadcrumb">
            <span class="hidden lg:block text-[11px] text-[#64748b] dark:text-slate-400 leading-tight truncate">
              {{ breadcrumb }}
            </span>
            <span class="text-xs sm:text-sm font-semibold text-gray-800 dark:text-slate-100 leading-tight truncate">
              {{ greeting }}
            </span>
          </div>
        </div>

        <div
          v-show="searchOpenMobile || true"
          v-click-outside="closeSearchResults"
          class="items-center gap-2 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] hover:border-[#CBD5E1] dark:hover:border-[#475569] focus-within:border-[#1565C0]/40 focus-within:ring-2 focus-within:ring-[#1565C0]/10 transition-colors px-3 py-2 relative"
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
            class="text-[10px] px-1.5 py-0.5 rounded-md font-mono hidden md:inline-block bg-white dark:bg-slate-700 text-[#94a3b8] dark:text-slate-300 border border-[#eef1f5] dark:border-slate-600 flex-shrink-0"
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
              class="search-panel absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-700 shadow-lg z-40"
              :style="{ borderColor: headerBorderColor }"
            >
              <NuxtLink
                v-for="(item, i) in filteredResults"
                :key="item.path"
                :to="item.path"
                class="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                :class="i === highlightIndex
                  ? 'bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100'
                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'"
                @click="closeSearchResults(); searchOpenMobile = false"
              >
                <AssetIcon :name="item.icon" :size="16" class="text-gray-400 dark:text-slate-500 flex-shrink-0" />
                <span class="truncate">{{ item.label }}</span>
              </NuxtLink>
            </div>

            <div
              v-else-if="showSearchResults && searchQuery && !filteredResults.length"
              class="absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-700 shadow-lg z-40 px-4 py-3 text-sm text-gray-500 dark:text-slate-400"
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
          <div class="hidden sm:block w-px h-5 mx-0.5 bg-[#EEF1F5] dark:bg-slate-700" />

          <div class="relative">
            <button
              ref="userMenuTrigger"
              class="flex items-center gap-1 pl-1 pr-1 sm:pr-2 py-1 rounded-full transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
              :aria-expanded="showUserMenu"
              aria-haspopup="menu"
              aria-label="Account menu"
              @click="toggleUserMenu"
            >
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] tracking-wide text-white overflow-hidden flex-shrink-0 ring-2 ring-white dark:ring-slate-900"
                style="background:#1565C0"
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
                class="account-menu absolute right-0 top-full mt-2 w-[296px] rounded-xl overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-700 z-40 shadow-lg"
                :style="{ borderColor: headerBorderColor }"
                role="menu"
                aria-label="Account"
                @keydown.esc.prevent="closeUserMenu(true)"
                @keydown.down.prevent="moveMenuFocus(1)"
                @keydown.up.prevent="moveMenuFocus(-1)"
              >
                <!-- Who is signed in: name, email, then role and where they work as plain text -->
                <div class="px-4 pt-4 pb-3 border-b dark:border-slate-700" :style="{ borderColor: headerBorderColor }">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white overflow-hidden flex-shrink-0"
                      style="background:#1565C0"
                    >
                      <img v-if="user?.avatar" :src="user.avatar" class="w-full h-full object-cover" alt="">
                      <span v-else>{{ initials }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold truncate text-gray-900 dark:text-slate-100 capitalize">{{ displayName }}</p>
                      <p class="text-xs truncate text-gray-500 dark:text-slate-400">{{ user?.email }}</p>
                    </div>
                  </div>
                  <div v-if="roleLabel || workplaceLabel" class="mt-3 rounded-lg px-3 py-2 bg-[#F7F8FA] dark:bg-slate-800/60">
                    <p v-if="roleLabel" class="text-[12.5px] font-semibold leading-snug text-gray-800 dark:text-slate-100">{{ roleLabel }}</p>
                    <p v-if="workplaceLabel" class="text-[11.5px] leading-snug text-gray-500 dark:text-slate-400 mt-0.5">{{ workplaceLabel }}</p>
                  </div>
                </div>

                <div class="py-1.5">
                  <NuxtLink
                    v-for="item in userMenuItems"
                    :key="item.path"
                    :to="item.path"
                    role="menuitem"
                    class="account-menu__item flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    @click="closeUserMenu()"
                  >
                    <AssetIcon :name="item.icon" :size="16" class="text-gray-400 dark:text-slate-500" />
                    <span class="truncate">{{ item.path === '/blood-center/settings' ? 'Account settings' : item.label }}</span>
                  </NuxtLink>

                  <!-- Theme: three choices, Light / Dark / System (follows the computer) -->
                  <div class="flex items-center justify-between gap-3 px-4 py-2">
                    <span class="flex items-center gap-3 text-sm text-gray-700 dark:text-slate-300">
                      <AssetIcon name="palette" :size="16" class="text-gray-400 dark:text-slate-500" />
                      Theme
                    </span>
                    <div class="inline-flex p-0.5 gap-0.5 rounded-lg bg-[#F1F5F9] dark:bg-slate-800" role="group" aria-label="Theme">
                      <button
                        v-for="option in THEME_OPTIONS"
                        :key="option.value"
                        type="button"
                        role="menuitemradio"
                        :aria-checked="themeMode === option.value"
                        :aria-label="option.label"
                        :title="option.label"
                        class="account-menu__item w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                        :class="themeMode === option.value
                          ? 'bg-white dark:bg-slate-600 text-[#1565C0] dark:text-sky-300 shadow-sm'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-100'"
                        @click="setThemeMode(option.value)"
                      >
                        <AssetIcon :name="option.icon" :size="14" />
                      </button>
                    </div>
                  </div>
                </div>

                <div class="border-t dark:border-slate-700 py-1.5" :style="{ borderColor: headerBorderColor }">
                  <!-- Neutral: signing out is routine, not destructive. Red only on hover. -->
                  <button
                    type="button"
                    role="menuitem"
                    class="account-menu__item flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 transition-colors hover:bg-red-50 hover:text-[#D32F2F] dark:hover:bg-red-950/30 dark:hover:text-red-300"
                    @click="handleLogout"
                  >
                    <AssetIcon name="log-out" :size="16" />
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

      <!--
        The page background is the token, not bg-white. Every blood-centre page
        paints itself with --rb-page-bg inside a centred max-width, so a white
        main left a pale band down both margins in light mode and a near-black
        one in dark.
      -->
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
  { value: 'system', label: 'System (follows your computer)', icon: 'monitor' },
]
const { railExpanded, openMobile } = useSidebar('blood-center')

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

// The path as the nav knows it, with the one query that picks a view.
const navPath = computed(() => (route.query.test ? `${route.path}?test=${route.query.test}` : route.path))

const pageLabel = computed(() => labelForPath(navPath.value) || 'Blood Center')

const facilityName = computed(() =>
  user.value?.facility?.facility_name || user.value?.facility?.name || ''
)

// The sidebar is grouped by department, so the breadcrumb says which one the
// page belongs to: "Davao Blood Center / Issuance / Blood Inventory".
const sectionLabel = computed(() => sectionForPath(route.path))

const breadcrumb = computed(() =>
  [facilityName.value || 'Blood Center Portal', sectionLabel.value, labelForPath(navPath.value)]
    .filter(Boolean)
    .join(' / ')
)

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

// "Supervisor", "Lab Supervisor", "Supervisor · Phlebotomist", or the
// department when nothing more specific is set.
const roleLabel = computed(() => {
  const u = user.value
  if (!u) return ''
  const role = u.staff_role_label || u.role_label || u.custom_role || ''
  const parts = [u.is_supervisor ? 'Supervisor' : '', role].filter(Boolean)
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

const greeting = computed(() => {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  // Names are stored as typed ("maria"), so capitalise for the greeting.
  const raw = nameParts.value[0] || ''
  const first = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Blood Center'
  return `${time}, ${first}`
})

// "Processing · Sub-National Blood Center": where this person works.
const workplaceLabel = computed(() =>
  [user.value?.is_supervisor ? null : user.value?.department_label, facilityName.value]
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
  return searchablePages.value.filter(p =>
    p.label.toLowerCase().includes(q) || (p.keywords ?? '').includes(q)
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

.topbar {
  background-color: var(--rb-page-bg, #F7F8FA);
  transition: left 200ms ease-out, background-color 150ms ease, border-color 150ms ease, box-shadow 200ms ease;
  will-change: left;
}

.topbar--scrolled {
  background-color: rgba(247, 248, 250, 0.82);
  -webkit-backdrop-filter: saturate(180%) blur(10px);
  backdrop-filter: saturate(180%) blur(10px);
}

:global(.dark .topbar--scrolled) {
  background-color: rgba(15, 23, 42, 0.82);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .topbar--scrolled { background-color: var(--rb-page-bg, #F7F8FA); }
}

main {
  background: var(--rb-page-bg);
}

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
  .topbar {
    transition: none;
  }
}

a, button {
  touch-action: manipulation;
}
</style>
