<template>
  <div>
    <HospitalSidebar />

    <div class="lg:pl-64">
      <!-- Top bar -->
      <header
        class="fixed top-0 left-0 right-0 lg:left-64 z-30 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-4 h-16 bg-white dark:bg-slate-900 border-b dark:border-slate-700 pl-16 lg:pl-6 transition-colors duration-150"
        :style="{ borderColor: headerBorderColor, boxShadow: '0 1px 2px rgba(15,23,42,0.05)' }">

        <!-- Breadcrumb + greeting (desktop only) -->
        <div class="hidden lg:flex flex-col justify-center min-w-[160px] flex-shrink-0">
          <span class="text-[11px] text-[#94a3b8] dark:text-slate-500 leading-tight">{{ breadcrumb }}</span>
          <span class="text-sm font-semibold text-gray-800 dark:text-slate-100 leading-tight">{{ greeting }}</span>
        </div>

        <!-- Mobile -->
        <button v-if="!searchOpenMobile" @click="openMobileSearch"
          class="sm:hidden w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
          aria-label="Open search">
          <AssetIcon name="search" :size="17" class="text-[#64748b] dark:text-slate-300" />
        </button>

        <!-- Search bar -->
        <div v-show="searchOpenMobile || true" v-click-outside="closeSearchResults"
          class="relative items-center gap-2 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-transparent focus-within:border-[#1565C0]/30 focus-within:bg-white transition-colors px-4 py-2.5"
          :class="[
            searchOpenMobile
              ? 'flex absolute left-3 right-3 top-1/2 -translate-y-1/2 z-20 sm:static sm:translate-y-0 sm:flex-1 sm:left-auto sm:right-auto'
              : 'hidden sm:flex sm:flex-1',
            'lg:flex-none lg:absolute lg:left-[48%] lg:-translate-x-1/2 lg:w-full lg:max-w-md lg:top-1/2 lg:-translate-y-1/2'
          ]">
          <AssetIcon name="search" :size="15" class="text-[#94a3b8] dark:text-slate-500 flex-shrink-0" />
          <input ref="searchInput" v-model="searchQuery" type="text" placeholder="Search requests, pages..."
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
            <div v-if="showSearchResults && searchQuery && filteredResults.length"
              class="absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-700 shadow-lg z-40"
              style="border-color:#eef1f5">
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
              class="absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-700 shadow-lg z-40 px-4 py-3 text-sm text-gray-500 dark:text-slate-400"
              style="border-color:#eef1f5">
              No matches for "{{ searchQuery }}"
            </div>
          </Transition>
        </div>

        <!-- Right cluster -->
        <div v-show="!searchOpenMobile" class="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 ml-auto">
          <button @click="toggleTheme"
            class="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
            <AssetIcon :name="isDark ? 'sun' : 'moon'" :size="16" class="text-[#64748b] dark:text-slate-300" />
          </button>

          <NuxtLink to="/hospital/notifications"
            class="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800">
            <AssetIcon name="bell" :size="16" class="text-[#64748b] dark:text-slate-300" />
            <span v-if="unreadCount > 0"
              class="absolute top-1 right-1 min-w-[15px] h-[15px] px-[3px] rounded-full flex items-center justify-center text-[9px] font-semibold text-white ring-2 ring-white dark:ring-slate-900"
              style="background:#D32F2F">
              {{ unreadCount > 9 ? '9+' : unreadCount }}
            </span>
          </NuxtLink>

          <!-- Divider -->
          <div class="hidden xs:block w-px h-6 mx-1 bg-[#EEF1F5] dark:bg-slate-700" />

          <div class="relative">
            <button @click="showUserMenu = !showUserMenu"
              class="flex items-center gap-1.5 pl-1 pr-1.5 sm:pr-2 py-1 rounded-full transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white overflow-hidden flex-shrink-0 ring-2 ring-white dark:ring-slate-900"
                style="background:#1565C0">
                <img v-if="user?.avatar" :src="user.avatar" class="w-full h-full object-cover" alt="">
                <span v-else>{{ user?.full_name?.charAt(0) || 'H' }}</span>
              </div>
              <AssetIcon name="chevron-down" :size="14"
                class="text-[#94a3b8] dark:text-slate-500 hidden sm:block transition-transform duration-150"
                :class="{ 'rotate-180': showUserMenu }" />
            </button>

            <Transition name="popup">
              <div v-if="showUserMenu" v-click-outside="closeUserMenu"
                class="absolute right-0 top-full mt-2 w-64 rounded-xl overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-700 z-40 shadow-lg"
                style="border-color:#eef1f5">
                <div class="flex items-center gap-3 px-4 py-4 border-b dark:border-slate-700"
                  style="border-color:#eef1f5">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white overflow-hidden flex-shrink-0"
                    style="background:#1565C0">
                    <img v-if="user?.avatar" :src="user.avatar" class="w-full h-full object-cover" alt="">
                    <span v-else>{{ user?.full_name?.charAt(0) || 'H' }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold truncate text-gray-900 dark:text-slate-100">{{ user?.full_name ||
                      'Hospital Staff' }}</p>
                    <p class="text-xs truncate text-gray-500 dark:text-slate-400">{{ user?.facility?.facility_name ||
                      user?.email }}</p>
                  </div>
                </div>

                <div class="py-2">
                  <NuxtLink v-for="item in userMenuItems" :key="item.path" :to="item.path" @click="closeUserMenu"
                    class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <AssetIcon :name="item.icon" :size="16" class="text-gray-400 dark:text-slate-500" />
                    <span>{{ item.label }}</span>
                  </NuxtLink>
                </div>

                <div class="border-t dark:border-slate-700 py-2" style="border-color:#eef1f5">
                  <button @click="handleLogout"
                    class="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                    style="color:#D32F2F">
                    <AssetIcon name="log-out" :size="16" />
                    <span>Log Out</span>
                  </button>
                </div>

                <div class="px-4 py-2 border-t dark:border-slate-700" style="border-color:#eef1f5">
                  <p class="text-[11px] text-center text-gray-400 dark:text-slate-500">v1.0.0 · Terms & Conditions</p>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Mobile search close button -->
        <button v-if="searchOpenMobile" @click="closeMobileSearch"
          class="sm:hidden w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ml-auto transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
          aria-label="Close search">
          <AssetIcon name="x" :size="17" class="text-[#64748b] dark:text-slate-300" />
        </button>
      </header>

      <main class="min-h-screen bg-[#F7F9FC] dark:bg-slate-900 transition-colors duration-150 pt-16">
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
import HospitalSidebar from '~/components/Hospital/Sidebar.vue'

const router = useRouter()
const route = useRoute()
const { user, fetchUser, clearUser } = useUser()
const { isDark, toggleTheme } = useDarkMode()
const headerBorderColor = computed(() => (isDark.value ? '#334155' : '#E5EAF0'))

onMounted(() => {
  if (!user.value) fetchUser()
})

// --- Breadcrumb + greeting ---
const pageLabels = {
  '/hospital/dashboard': 'Dashboard',
  '/hospital/bloodrequests': 'Blood Requests',
  '/hospital/bloodrequests/newrequest' : 'Blood Requests / New Request',
  '/hospital/bloodrequests/newrequest/[id]' : 'Blood Requests / New Request / ',
  '/hospital/bloodrequests/edit' : 'Blood Requests / Edit / ',
  '/hospital/trackrequests': 'Track Requests',
  '/hospital/bloodavailability': 'Search Availability',
  '/hospital/billing': 'Billing & Payments',
  '/hospital/transactions': 'Transaction History',
  '/hospital/notifications': 'Notifications',
  '/hospital/settings': 'Settings',
}
const breadcrumb = computed(() => `Hospital Portal / ${pageLabels[route.path] || ''}`)

const greeting = computed(() => {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const first = user.value?.full_name?.split(' ')[0] || 'there'
  return `${time}, ${first}!`
})

// --- Notifications ---
// i-connect ni sa notifications unread-count endpoint
const unreadCount = ref(0)

// --- Profile dropdown ---
const showUserMenu = ref(false)
const userMenuItems = [
  { label: 'Blood Requests', path: '/hospital/bloodrequests', icon: 'clipboard-list' },
  { label: 'Billing & Payments', path: '/hospital/billing', icon: 'receipt' },
  { label: 'Notification Settings', path: '/hospital/settings', icon: 'bell' }
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
  { label: 'Dashboard', path: '/hospital/dashboard', icon: 'home', keywords: 'dashboard home overview' },
  { label: 'Blood Requests', path: '/hospital/bloodrequests', icon: 'clipboard-list', keywords: 'requests pending processing' },
  { label: 'New Request', path: '/hospital/bloodrequests/newrequest', icon: 'file-plus', keywords: 'new request create blood' },
  { label: 'Search Availability', path: '/hospital/bloodavailability', icon: 'search', keywords: 'availability search blood units' },
  { label: 'Billing & Payments', path: '/hospital/billing', icon: 'receipt', keywords: 'billing payment gcash cash' },
  { label: 'Transaction History', path: '/hospital/transactions', icon: 'history', keywords: 'transaction history records' },
  { label: 'Notifications', path: '/hospital/notifications', icon: 'bell', keywords: 'notifications alerts reminders' },
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
    clearUser()
    router.push('/auth/hospital/login')
  } catch (err) {
    console.error(err)
  }
}
</script>

<style scoped>

.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
