<template>
  <div>
    <BloodCenterSidebar />

    <!--
      The content column tracks the rail's width instead of a fixed lg:pl-64.
      Padding — not a margin or a transform — because it is the one property
      that both reserves the space and reflows the children inside it, which is
      what keeps the widened sidebar beside the page rather than over it.
    -->
    <div class="content-shift" :class="railExpanded ? 'lg:pl-64' : 'lg:pl-20'">
      <header
        class="topbar fixed top-0 left-0 right-0 z-30 h-14 sm:h-16 bg-white dark:bg-slate-900 border-b transition-colors duration-150"
        :class="railExpanded ? 'lg:left-64' : 'lg:left-20'"
        :style="{ borderColor: headerBorderColor, boxShadow: headerShadow }">

        <!--
          The bar spans the full width — it carries the background and the
          divider — but its contents sit in the same centred 1152px column the
          pages use, with the same 16/32px gutters. Left full-width, the
          breadcrumb started ~46px inside of the page title directly beneath it
          and the avatar overhung the right edge of the content by about as
          much, so the chrome and the page it framed were on two different
          grids.
        -->
        <div class="topbar-inner relative mx-auto flex h-full w-full max-w-[1152px] items-center gap-2 sm:gap-3 px-4 sm:px-8">

        <!-- Left cluster: drawer toggle + titles -->
        <div v-show="!searchOpenMobile" class="flex items-center gap-2 min-w-0">
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

          <div class="hidden sm:flex flex-col justify-center min-w-0 lg:min-w-[180px] flex-shrink">
            <span class="hidden lg:block text-[11px] text-[#94a3b8] dark:text-slate-500 leading-tight truncate">
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
          class="items-center gap-2 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-transparent focus-within:border-[#1565C0]/30 focus-within:bg-white dark:focus-within:bg-slate-800 transition-colors px-3 py-2 relative"
          :class="[
            searchOpenMobile
              ? 'flex flex-1 z-40'
              : 'hidden sm:flex sm:flex-1',
            'lg:flex-none lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-md lg:top-1/2 lg:-translate-y-1/2'
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
            ⌘F
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

          <button
            class="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleTheme"
          >
            <AssetIcon :name="isDark ? 'sun' : 'moon'" :size="18" class="text-[#64748b] dark:text-slate-300" />
          </button>

          <!--
            The notification bell used to sit here pointing at
            /blood-center/notifications, which has no page — it 404'd, and its
            count was hard-coded to 0 so the badge never appeared either. Same
            call as Help & Support in useBloodCenterNav: restore it together
            with the page, not before.
          -->

          <!--
            `xs:` is not a breakpoint in this project — tailwind.config.js adds
            no screens, so `hidden xs:block` compiled to `hidden` and this
            divider never rendered at any width. sm is the real first step up.
          -->
          <div class="hidden sm:block w-px h-5 mx-0.5 bg-[#EEF1F5] dark:bg-slate-700" />

          <div class="relative">
            <button
              class="flex items-center gap-1 pl-1 pr-1 sm:pr-2 py-1 rounded-full transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
              :aria-expanded="showUserMenu"
              aria-haspopup="menu"
              aria-label="Account menu"
              @click="showUserMenu = !showUserMenu"
            >
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white overflow-hidden flex-shrink-0 ring-2 ring-white dark:ring-slate-900"
                style="background:#1565C0"
              >
                <img v-if="user?.avatar" :src="user.avatar" class="w-full h-full object-cover" alt="">
                <span v-else>{{ user?.full_name?.charAt(0) || 'B' }}</span>
              </div>
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
                v-click-outside="closeUserMenu"
                class="absolute right-0 top-full mt-2 w-64 rounded-xl overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-700 z-40 shadow-lg"
                :style="{ borderColor: headerBorderColor }"
              >
                <div class="flex items-center gap-3 px-4 py-4 border-b dark:border-slate-700" :style="{ borderColor: headerBorderColor }">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white overflow-hidden flex-shrink-0"
                    style="background:#1565C0"
                  >
                    <img v-if="user?.avatar" :src="user.avatar" class="w-full h-full object-cover" alt="">
                    <span v-else>{{ user?.full_name?.charAt(0) || 'B' }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold truncate text-gray-900 dark:text-slate-100">{{ user?.full_name || 'Blood Center' }}</p>
                    <p class="text-xs truncate text-gray-500 dark:text-slate-400">{{ user?.email }}</p>
                  </div>
                </div>

                <div class="py-2">
                  <NuxtLink
                    v-for="item in userMenuItems"
                    :key="item.path"
                    :to="item.path"
                    class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    @click="closeUserMenu"
                  >
                    <AssetIcon :name="item.icon" :size="16" class="text-gray-400 dark:text-slate-500" />
                    <span class="truncate">{{ item.label }}</span>
                  </NuxtLink>
                </div>

                <div class="border-t dark:border-slate-700 py-2" :style="{ borderColor: headerBorderColor }">
                  <button
                    class="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                    style="color:#D32F2F"
                    @click="handleLogout"
                  >
                    <AssetIcon name="log-out" :size="16" />
                    <span>Log Out</span>
                  </button>
                </div>

                <div class="px-4 py-2 border-t dark:border-slate-700" :style="{ borderColor: headerBorderColor }">
                  <p class="text-[11px] text-center text-gray-400 dark:text-slate-500">v1.0.0 · Terms &amp; Conditions</p>
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

const router = useRouter()
const route = useRoute()
const { user, ensureUser, logout } = useUser()
// Ang nav kay usa ra ka source — parehas sa sidebar, sa ⌘F search ug sa
// profile dropdown, aron walay surface nga mo-offer og route nga i-refuse
// ra sa server.
const { searchablePages, userMenuItems, labelForPath } = useBloodCenterNav()
const { isDark, toggleTheme } = useDarkMode()
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

const pageLabel = computed(() => labelForPath(route.path) || 'Blood Center')
const breadcrumb = computed(() => `Blood Center Portal / ${labelForPath(route.path)}`)

const greeting = computed(() => {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const first = user.value?.full_name?.split(' ')[0] || 'Blood Center'
  return `${time}, ${first}`
})

const showUserMenu = ref(false)
const closeUserMenu = () => {
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
  transition: left 200ms ease-out, background-color 150ms ease, border-color 150ms ease;
  will-change: left;
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
