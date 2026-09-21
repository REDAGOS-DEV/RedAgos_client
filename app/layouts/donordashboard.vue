<template>
  <div>
    <!-- `:donor` was never declared as a prop on the sidebar, so it only landed
         on its root div as donor="[object Object]". The component reads the
         user from useUser() itself. -->
    <DonorSidebar />

    <!--
      The content column tracks the rail's width instead of a fixed lg:pl-20.
      Padding — not a margin or a transform — because it is the one property
      that both reserves the space and reflows the children inside it, which is
      what keeps the widened sidebar beside the page rather than over it.
    -->
    <div class="content-shift" :class="railExpanded ? 'lg:pl-64' : 'lg:pl-20'">
      <!-- Top bar -->
      <header
        class="topbar fixed top-0 left-0 right-0 z-30 h-14 sm:h-16 bg-white dark:bg-slate-900 border-b"
        :class="railExpanded ? 'lg:left-64' : 'lg:left-20'"
        :style="{ borderColor: headerBorderColor, boxShadow: headerShadow }">

        <!--
          The bar spans the full width — it carries the background and the
          divider — but its contents sit in the same centred 1152px column the
          donor pages use, with the same 16/32px gutters, so the breadcrumb
          lines up with the page title directly beneath it instead of drifting
          as the rail reflows the column.
        -->
        <div class="topbar-inner relative mx-auto flex h-full w-full max-w-[1152px] items-center justify-between gap-2 sm:gap-3 px-4 sm:px-8">

        <!-- Left Cluster: Mobile Menu Toggle + Titles -->
        <div class="flex items-center gap-2 min-w-0">
          <!-- Mobile menu toggle -->
          <button @click="openMobile"
            class="lg:hidden w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
            aria-label="Open menu">
            <AssetIcon name="menu" :size="20" class="text-[#64748b] dark:text-slate-300" />
          </button>

          <!-- Dynamic Page Title (Mobile view) -->
          <span class="sm:hidden font-bold text-sm text-gray-800 dark:text-slate-100 truncate">
            {{ pageLabels[route.path] || 'Dashboard' }}
          </span>

          <!-- Breadcrumb + Greeting (Desktop & Tablet view) -->
          <div class="hidden sm:flex flex-col justify-center min-w-0 flex-shrink">
            <span class="hidden lg:block text-[11px] text-[#94a3b8] dark:text-slate-500 leading-tight">
              {{ breadcrumb }}
            </span>

            <div class="flex items-center gap-2 leading-tight truncate">
              <span class="text-xs sm:text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">
                {{ greeting }}
              </span>
              <!--
                Valid ID status pill intentionally removed from here.
                Status is now surfaced consistently via the small badge/dot
                on the avatar (both desktop and mobile) and via the full
                CTA inside the profile dropdown, avoiding duplicate/competing
                signals next to the greeting text.
              -->
            </div>
          </div>
        </div>

        <!-- Search Bar (Desktop) -->
        <div v-show="searchOpenMobile || true" v-click-outside="closeSearchResults"
          class="items-center gap-2 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-transparent focus-within:border-[#1565C0]/30 focus-within:bg-white transition-colors px-3 py-2 relative"
          :class="[
            searchOpenMobile
              ? 'flex flex-1 z-40'
              : 'hidden sm:flex sm:flex-1',
            'lg:flex-none lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-md lg:top-1/2 lg:-translate-y-1/2'
          ]">
          <AssetIcon name="search" :size="16" class="text-[#94a3b8] dark:text-slate-500 flex-shrink-0" />
          <input ref="searchInput" v-model="searchQuery" type="text" placeholder="Search pages, records..."
            class="text-sm flex-1 min-w-0 bg-transparent outline-none placeholder:text-[#94a3b8] dark:placeholder:text-slate-500 text-gray-800 dark:text-slate-100"
            @focus="showSearchResults = true" @keydown.enter="goToTopResult" @keydown.esc="handleEscSearch"
            @keydown.down.prevent="moveHighlight(1)" @keydown.up.prevent="moveHighlight(-1)" />
          <span v-if="!searchQuery"
            class="text-[10px] px-1.5 py-0.5 rounded-md font-mono hidden md:inline-block bg-white dark:bg-slate-700 text-[#94a3b8] dark:text-slate-300 border border-[#eef1f5] dark:border-slate-600 flex-shrink-0">
            ⌘F
          </span>
          <button v-else @click="clearSearch"
            class="text-[#94a3b8] dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 flex-shrink-0"
            aria-label="Clear search">
            <AssetIcon name="x" :size="14" />
          </button>

          <!-- Results dropdown -->
          <Transition name="popup">
            <!--
              The borders here are bound, not a `dark:border-slate-700` class
              beside a hard-coded inline colour: an inline `border-color`
              outranks the variant, which is what pinned every one of this
              header's popups to the light #EEF1F5 in dark mode.
            -->
            <div v-if="showSearchResults && searchQuery && filteredResults.length"
              class="search-results-dropdown absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden bg-white dark:bg-slate-900 border shadow-lg z-40"
              :style="{ borderColor: headerBorderColor }">
              <NuxtLink v-for="(item, i) in filteredResults" :key="item.path" :to="item.path"
                @click="closeSearchResults(); searchOpenMobile = false"
                class="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors" :class="i === highlightIndex
                  ? 'bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100'
                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'">
                <AssetIcon :name="item.icon" :size="16" class="text-gray-400 dark:text-slate-500 flex-shrink-0" />
                <span class="truncate">{{ item.label }}</span>
              </NuxtLink>
            </div>

            <div v-else-if="showSearchResults && searchQuery && !filteredResults.length"
              class="absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden bg-white dark:bg-slate-900 border shadow-lg z-40 px-4 py-3 text-sm text-gray-500 dark:text-slate-400"
              :style="{ borderColor: headerBorderColor }">
              No matches for "{{ searchQuery }}"
            </div>
          </Transition>
        </div>

        <!-- Right Cluster (Actions & Profile Avatar) -->
        <div v-show="!searchOpenMobile" class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <!-- Mobile Search Trigger -->
          <button @click="openMobileSearch"
            class="sm:hidden w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
            aria-label="Open search">
            <AssetIcon name="search" :size="18" class="text-[#64748b] dark:text-slate-300" />
          </button>

          <!-- Dark/Light Theme Switcher -->
          <button @click="toggleTheme"
            class="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
            <AssetIcon :name="isDark ? 'sun' : 'moon'" :size="18" class="text-[#64748b] dark:text-slate-300" />
          </button>

          <!-- Notifications -->
          <NuxtLink to="/donor/notifications"
            class="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800">
            <AssetIcon name="bell" :size="18" class="text-[#64748b] dark:text-slate-300" />
            <span v-if="unreadCount > 0"
              class="absolute top-1 right-1 min-w-[15px] h-[15px] px-[3px] rounded-full flex items-center justify-center text-[9px] font-semibold text-white ring-2 ring-white dark:ring-slate-900"
              style="background:#D32F2F">
              {{ unreadCount > 9 ? '9+' : unreadCount }}
            </span>
          </NuxtLink>

          <!--
            `xs:` is not a breakpoint in this project — tailwind.config.js adds
            no screens, so `hidden xs:block` compiled to `hidden` and this
            divider never rendered at any width. sm is the real first step up.
          -->
          <div class="hidden sm:block w-px h-5 mx-0.5 bg-[#EEF1F5] dark:bg-slate-700" />

          <!-- Profile Menu Dropdown -->
          <div class="relative">
            <button @click="showUserMenu = !showUserMenu"
              class="flex items-center gap-1 pl-1 pr-1 sm:pr-2 py-1 rounded-full transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800">

              <!-- Outer Avatar Container -->
              <div class="relative flex-shrink-0">
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white overflow-hidden ring-2 ring-white dark:ring-slate-900"
                  style="background:#1565C0;">
                  <img v-if="user?.avatar" :src="user.avatar" class="w-full h-full object-cover" alt="">
                  <span v-else>{{ user?.full_name?.charAt(0) || 'D' }}</span>
                </div>

                <!--
                  Valid ID status badge on avatar — now the single consistent
                  indicator across desktop AND mobile (no more sm:hidden).
                  verified -> checkmark badge, pending -> neutral dot,
                  unsubmitted/rejected -> pulsing amber dot.
                -->
                <div v-if="identityStatus === 'verified'"
                  class="id-verified-badge absolute -top-1 -right-1 rounded-full p-0.5 z-10"
                  title="ID Verified">
                  <AssetIcon name="badge-check" :size="14" class="text-[#0052FF] dark:text-white" />
                </div>

                <span v-else-if="identityStatus === 'pending'"
                  class="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-white dark:ring-slate-900 z-10"
                  title="ID under review">
                </span>

                <span v-else
                  class="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900 z-10"
                  title="Valid ID needed">
                </span>
              </div>

              <AssetIcon name="chevron-down" :size="14"
                class="text-[#94a3b8] dark:text-slate-500 hidden sm:block transition-transform duration-150"
                :class="{ 'rotate-180': showUserMenu }" />
            </button>

            <!-- Profile Dropdown Card -->
            <Transition name="popup">
              <div v-if="showUserMenu" v-click-outside="closeUserMenu"
                class="absolute right-0 top-full mt-2 w-64 rounded-xl overflow-hidden bg-white dark:bg-slate-900 border z-40 shadow-lg"
                :style="{ borderColor: headerBorderColor }">
                <div class="flex items-center gap-3 px-4 py-4 border-b"
                  :style="{ borderColor: headerBorderColor }">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white overflow-hidden flex-shrink-0"
                    style="background:#1565C0">
                    <img v-if="user?.avatar" :src="user.avatar" class="w-full h-full object-cover" alt="">
                    <span v-else>{{ user?.full_name?.charAt(0) || 'D' }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold truncate text-gray-900 dark:text-slate-100">
                      {{ user?.full_name || 'Donor' }}
                    </p>
                    <p class="text-xs truncate text-gray-500 dark:text-slate-400">{{ user?.email }}</p>

                    <!-- Valid ID Status inside Dropdown (full context + CTA lives here) -->
                    <div class="flex items-center gap-1.5 mt-1.5">
                      <template v-if="identityStatus === 'verified'">
                        <AssetIcon name="badge-check" :size="16" class="text-[#0052FF] dark:text-[#3B82F6]" />
                        <span class="text-xs font-bold text-gray-900 dark:text-slate-100">
                          ID Verified
                        </span>
                      </template>

                      <template v-else-if="identityStatus === 'pending'">
                        <AssetIcon name="clock" :size="14" class="text-slate-400" />
                        <span class="text-xs font-bold text-slate-500 dark:text-slate-400">
                          ID Under Review
                        </span>
                      </template>

                      <NuxtLink
                        v-else
                        to="/donor/profile"
                        @click="closeUserMenu"
                        class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline">
                        <AssetIcon name="circle-alert" :size="14" class="text-amber-500" />
                        <span>Submit Valid ID</span>
                      </NuxtLink>
                    </div>
                  </div>
                </div>

                <div class="py-2">
                  <NuxtLink v-for="item in userMenuItems" :key="item.path" :to="item.path" @click="closeUserMenu"
                    class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <AssetIcon :name="item.icon" :size="16" class="text-gray-400 dark:text-slate-500" />
                    <span>{{ item.label }}</span>
                  </NuxtLink>
                </div>

                <div class="border-t py-2" :style="{ borderColor: headerBorderColor }">
                  <button @click="handleLogout"
                    class="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                    style="color:#D32F2F">
                    <AssetIcon name="log-out" :size="16" />
                    <span>Log Out</span>
                  </button>
                </div>

                <div class="px-4 py-2 border-t" :style="{ borderColor: headerBorderColor }">
                  <p class="text-[11px] text-center text-gray-400 dark:text-slate-500">v1.0.0 · Terms & Conditions</p>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Mobile search close button -->
        <button v-if="searchOpenMobile" @click="closeMobileSearch"
          class="sm:hidden w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ml-1 transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
          aria-label="Close search">
          <AssetIcon name="x" :size="18" class="text-[#64748b] dark:text-slate-300" />
        </button>
        </div>
      </header>

      <!--
        The page background is the token, not bg-white/dark:bg-slate-900. Every
        donor page paints itself inside a centred max-width, so the margins on
        either side are this element and have to be the page colour.
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
import AssetIcon from '~/components/common/AssetIcon.vue'
import { donorService } from '~/api/donor/DonorService'
import { useSidebar } from '~/composables/useSidebar.js'
import { useIdentityStatus } from '~/composables/useIdentityStatus'

const { railExpanded, openMobile } = useSidebar()
const router = useRouter()
const route = useRoute()
const { user, fetchUser, logout } = useUser()
const { isDark, toggleTheme } = useDarkMode()

const headerBorderColor = computed(() => (isDark.value ? '#334155' : '#E5EAF0'))
/*
 * Bound rather than written as a `:global(.dark) header` rule. This build's
 * scoped-CSS transform drops the descendant half of `:global(.dark) .x` and
 * emits a bare `.dark { … }` — all four of this file's `:global(.dark) x`
 * rules collapsed into one `.dark{color:#f8fafc;background-color:#475569;
 * box-shadow:…}` on <html>, so the header lost its shadow and the document
 * root picked up a slate-600 background it was never meant to have.
 */
const headerShadow = computed(() => (
  isDark.value
    ? '0 1px 3px rgba(0,0,0,0.30), 0 1px 2px -1px rgba(0,0,0,0.30)'
    : '0 1px 2px rgba(15,23,42,0.05)'
))

onMounted(() => {
  if (!user.value) fetchUser()
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

// --- Breadcrumb + greeting ---
const pageLabels = {
  '/donor/dashboard': 'Dashboard',
  '/donor/appointments': 'Book Appointment',
  '/donor/history': 'Donation History',
  '/donor/eligibility': 'Eligibility Screening',
  '/donor/qrcode': 'My QR Code',
  '/donor/notifications': 'Notifications',
  '/donor/profile': 'My Profile',
  '/donor/settings': 'Settings',
}
const breadcrumb = computed(() => `Donor Portal / ${pageLabels[route.path] || ''}`)

const greeting = computed(() => {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const first = user.value?.full_name?.split(' ')[0] || 'Donor'
  return `${time}, ${first}!`
})

// --- Notifications ---
const unreadCount = ref(0)

async function loadUnreadCount() {
  try {
    const data = await donorService.notificationsUnreadCount()
    unreadCount.value = data?.unread_count ?? 0
  } catch (err) {
    console.error('Failed to load unread notification count:', err)
    unreadCount.value = 0
  }
}

onMounted(loadUnreadCount)

// --- Valid ID status ---
// Drives the avatar badge/dot (consistent across desktop + mobile) and the
// dropdown CTA: 'unsubmitted' | 'pending' | 'verified' | 'rejected'.
// Treated as "needs action" unless it's explicitly verified or under review.
// Shared (useState) with IdentityVerification.vue on /donor/profile, so
// submitting an ID there flips this badge immediately — no refetch needed.
const { identityStatus, fetchIdentityStatus } = useIdentityStatus()

onMounted(() => {
  if (identityStatus.value === null) fetchIdentityStatus()
})

// --- Profile dropdown ---
const showUserMenu = ref(false)
const userMenuItems = [
  { label: 'My Profile', path: '/donor/profile', icon: 'user-circle' },
  { label: 'Donation History', path: '/donor/history', icon: 'history' },
  { label: 'View My QR Code', path: '/donor/qrcode', icon: 'qr-code' },
  { label: 'Notification Settings', path: '/donor/settings', icon: 'bell' }
]
const closeUserMenu = () => { showUserMenu.value = false }

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
const searchablePages = [
  { label: 'Dashboard', path: '/donor/dashboard', icon: 'home', keywords: 'dashboard home overview' },
  { label: 'Book Appointment', path: '/donor/appointments', icon: 'calendar', keywords: 'appointment book schedule slot' },
  { label: 'Donation History', path: '/donor/history', icon: 'history', keywords: 'history donations record' },
  { label: 'Eligibility Screening', path: '/donor/eligibility', icon: 'shield-check', keywords: 'eligibility screening questionnaire' },
  { label: 'My QR Code', path: '/donor/qrcode', icon: 'qr-code', keywords: 'qr code scan' },
  { label: 'Notifications', path: '/donor/notifications', icon: 'bell', keywords: 'notifications alerts reminders' },
  { label: 'My Profile', path: '/donor/profile', icon: 'user-circle', keywords: 'profile account personal info' },
  { label: 'Settings', path: '/donor/settings', icon: 'settings', keywords: 'settings preferences password' },
]

const searchQuery = ref('')
const showSearchResults = ref(false)
const highlightIndex = ref(0)
const searchInput = ref(null)

const filteredResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return searchablePages.filter(p =>
    p.label.toLowerCase().includes(q) || p.keywords.includes(q)
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

// --- LOGOUT HANDLER ---
const handleLogout = async () => {
  showUserMenu.value = false
  try {
    if (typeof logout === 'function') {
      await logout('/auth/donor/login')
    } else {
      router.push('/auth/donor/login')
    }
  } catch (error) {
    console.error('Logout error:', error)
  }
}
</script>

<style scoped>
/*
 * badge-check is an outline glyph on a 24 viewBox. Rendered at 14px its
 * authored stroke-width of 2 scales down to ~1.2px, which reads as a hairline
 * on the avatar. A CSS stroke-width overrides the presentation attribute and
 * gives the mark enough weight to actually be seen at this size.
 */
.id-verified-badge :deep(svg) {
  stroke-width: 3;
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

input:focus {
  outline: none;
}

/*
 * Tokens, not a paired `:global(.dark) input` rule — see headerShadow. The four
 * rules that used to live at the bottom of this block all collapsed onto <html>
 * and did nothing here.
 */
input::placeholder {
  color: var(--rb-placeholder);
  opacity: 1;
}

input {
  color: var(--rb-text-primary);
}

.search-results-dropdown {
  max-height: 320px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--rb-border-hover) transparent;
}

.search-results-dropdown::-webkit-scrollbar {
  width: 5px;
}

.search-results-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.search-results-dropdown::-webkit-scrollbar-thumb {
  background-color: var(--rb-border-hover);
  border-radius: 999px;
}

a, button {
  touch-action: manipulation;
}

@media (max-width: 639px) {
  header {
    height: 3.75rem;
  }

  main {
    padding-top: 3.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .content-shift,
  .topbar {
    transition: none;
  }
}
</style>