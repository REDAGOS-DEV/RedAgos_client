<template>
  <!-- Mobile Overlay -->
  <div>
    <div v-if="mobileOpen" class="lg:hidden fixed inset-0 z-40 bg-black/40" @click="closeMobile" />

    <aside class="fixed top-0 left-0 h-screen z-50 flex flex-col transition-all duration-200 lg:translate-x-0"
      :class="[mobileOpen ? 'translate-x-0' : '-translate-x-full', collapsed ? 'lg:w-20' : 'lg:w-64', 'w-64']"
      :style="{ background: SIDEBAR_BG, boxShadow: sidebarShadow }">
      <!-- Close button (mobile) -->
      <button class="lg:hidden absolute top-4 right-4 z-10" @click="closeMobile"
        :style="{ color: SIDEBAR_IDLE_TEXT }">
        <AssetIcon name="x" :size="20" />
      </button>

      <!-- Collapse toggle (desktop, right edge) -->
      <button @click="toggleCollapsed"
        class="hidden lg:flex items-center justify-center absolute top-6 -right-3 w-6 h-6 rounded-full border z-10 transition-transform duration-200"
        :style="{
          background: SIDEBAR_BG,
          borderColor: SIDEBAR_BORDER,
          color: SIDEBAR_IDLE_TEXT,
          boxShadow: '0 2px 6px rgba(15,23,42,0.15)'
        }">
        <AssetIcon name="chevron-left" :size="12"
          :style="{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }" />
      </button>

      <!-- Logo -->
      <div
        class="px-5 pt-3 pb-3 flex items-center gap-3 border-b dark:border-slate-700 flex-shrink-0 transition-colors duration-150 cursor-pointer select-none"
        :class="collapsed ? 'lg:justify-center lg:px-0' : ''" :style="{ borderColor: SIDEBAR_BORDER }"
        @click="goToDashboard">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative"
          style="background: #1565C0">
          <img v-if="!logoLoading" :src="logo" alt="RedAgos Logo" class="logo-image">
          <span v-else class="logo-spinner" />
        </div>

        <div v-if="showLabels" class="lg:block">
          <h1 class="font-extrabold text-base leading-none" :style="{ color: SIDEBAR_HEADING_TEXT }">
            Red<span style="color:#D32F2F">Agos</span>
          </h1>
          <p class="text-[11px] mt-0.5" :style="{ color: SIDEBAR_IDLE_TEXT }">
            Donor Portal
          </p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto px-3 pt-4" :class="isDark ? 'nav-dark' : ''">
        <template v-for="(group, gIndex) in navGroups" :key="gIndex">
          <p v-if="group.label && showLabels"
            class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 mb-1 mt-5"
            :style="{ color: SIDEBAR_IDLE_TEXT }">
            <span class="w-3 h-[2px] rounded-full" :style="{ background: isDark ? '#475569' : '#CBD5E1' }" />
            {{ group.label }}
          </p>

          <NuxtLink v-for="item in group.items" :key="item.path" :to="item.path" @click="closeSidebar"
            @mouseenter="hoveredPath = item.path" @mouseleave="hoveredPath = null" @touchstart="() => { }"
            class="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-[10px] text-sm transition-all duration-150"
            :class="collapsed && !isMobile ? 'lg:justify-center' : ''" :title="collapsed && !isMobile ? item.label : null"
            :style="navStyle(item.path)">
            <span
              class="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 transition-colors duration-150"
              :style="{ background: isActive(item.path) ? '#1565C0' : 'transparent' }">
              <AssetIcon :name="item.icon" :size="14"
                :style="{ color: isActive(item.path) ? '#ffffff' : 'currentColor' }" />
            </span>
            <span v-if="showLabels" class="flex-1 font-medium">{{ item.label }}</span>

            <span v-if="item.badge && eligibilityStatus && showLabels"
              class="text-[10px] font-bold px-2 py-0.5 rounded-full" :style="{
                background: eligibilityStatus === 'eligible' ? '#2E7D3214' : (isDark ? '#334155' : '#F1F5F9'),
                color: eligibilityStatus === 'eligible' ? '#2E7D32' : SIDEBAR_IDLE_TEXT
              }">
              {{ eligibilityStatus === 'eligible' ? 'Valid' : eligibilityStatus }}
            </span>
          </NuxtLink>
        </template>

        <!-- Settings / Help -->
        <div class="mt-4 border-t pt-3" :style="{ borderColor: SIDEBAR_BORDER }">
          <NuxtLink v-for="item in bottomItems" :key="item.path" :to="item.path" @click="closeSidebar"
            @mouseenter="hoveredPath = item.path" @mouseleave="hoveredPath = null" @touchstart="() => { }"
            class="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-[10px] text-sm transition-all duration-150"
            :class="collapsed && !isMobile ? 'lg:justify-center' : ''" :title="collapsed && !isMobile ? item.label : null"
            :style="navStyle(item.path)">
            <AssetIcon :name="item.icon" :size="16" />
            <span v-if="showLabels" class="flex-1 font-medium">{{ item.label }}</span>
          </NuxtLink>
        </div>
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
import { donorService } from '~/api/donor/DonorService'
import { useSidebar } from '~/composables/useSidebar.js'

const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useSidebar()

// --- Dark mode awareness ---
const isDark = ref(false)
let themeObserver = null

// --- Mobile viewport awareness ---
const isMobile = ref(false)
let mobileMql = null
const updateIsMobile = (e) => {
  isMobile.value = e ? e.matches : !mobileMql.matches
}

// Whether labels/text should render at all
const showLabels = computed(() => isMobile.value || !collapsed.value)

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  themeObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  mobileMql = window.matchMedia('(max-width: 1023px)')
  isMobile.value = mobileMql.matches
  mobileMql.addEventListener('change', updateIsMobile)
})

onUnmounted(() => {
  themeObserver?.disconnect()
  mobileMql?.removeEventListener('change', updateIsMobile)
})

// Light/dark theme tokens
const SIDEBAR_BG = computed(() => (isDark.value ? '#0F172A' : '#F7F8FA'))
const SIDEBAR_BORDER = computed(() => (isDark.value ? '#334155' : '#E5EAF0'))
const SIDEBAR_ACTIVE_BG = computed(() => (isDark.value ? '#42A5F529' : '#1565C014'))
const SIDEBAR_ACTIVE_TEXT = computed(() => (isDark.value ? '#64B5F6' : '#1565C0'))
const SIDEBAR_IDLE_TEXT = computed(() => (isDark.value ? '#94A3B8' : '#64748B'))
const SIDEBAR_HEADING_TEXT = computed(() => (isDark.value ? '#F1F5F9' : '#1f2937'))
const sidebarShadow = computed(() =>
  isDark.value
    ? '1px 0 0 #1E293B, 4px 0 24px rgba(0,0,0,0.35)'
    : '1px 0 0 #EEF1F5, 4px 0 24px rgba(15,23,42,0.04)'
)

const route = useRoute()
const router = useRouter()
const eligibilityStatus = ref(null)
const { user, fetchUser } = useUser()

const navGroups = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', path: '/donor/dashboard', icon: 'house' }
    ]
  },
  {
    label: 'Donors',
    items: [
      { label: 'Eligibility Screening', path: '/donor/eligibility', icon: 'clipboard-check' },
      { label: 'Book Appointment', path: '/donor/appointments', icon: 'calendar' }
    ]
  },
  {
    label: 'Records',
    items: [
      { label: 'Donation History', path: '/donor/history', icon: 'history' },
      { label: 'My QR Code', path: '/donor/qrcode', icon: 'qr-code', badge: true },
      { label: 'My Profile', path: '/donor/profile', icon: 'user-circle' }
    ]
  }
]

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
    eligibilityStatus.value = dashboard.eligibility_status || 'pending'
  } catch (err) {
    console.error(err)
  }
}

onMounted(() => {
  loadUser()
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

const navStyle = (path) => {
  const active = isActive(path)
  const hovered = hoveredPath.value === path

  return {
    background: active || hovered ? SIDEBAR_ACTIVE_BG.value : 'transparent',
    color: active || hovered ? SIDEBAR_ACTIVE_TEXT.value : SIDEBAR_IDLE_TEXT.value,
    fontWeight: active ? '700' : '500'
  }
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

/* Sidebar Navigation Scrollbar */
nav {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

nav::-webkit-scrollbar {
  width: 5px;
}

nav::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 999px;
}

nav::-webkit-scrollbar-track {
  background: transparent;
}

.nav-dark::-webkit-scrollbar-thumb {
  background-color: #334155;
}

.nav-dark {
  scrollbar-color: #334155 transparent;
}

/* Fix for Sidebar Collapse Toggle Positioning & Alignment */
aside {
  position: fixed;
  will-change: width, transform;
}

aside > button.hidden.lg\:flex {
  top: 18px;
  right: -12px;
  width: 24px;
  height: 24px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
  transition: box-shadow 0.15s ease;
  z-index: 30;
}

aside > button.hidden.lg\:flex:hover {
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.22);
}

aside > button.hidden.lg\:flex:focus-visible {
  outline: 2px solid #1565C0;
  outline-offset: 2px;
}

/* Popups and Dropdowns Animation */
.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* Touch & Mobile Active States */
@media (hover: none) {
  nav a {
    transition: background 0.1s ease, color 0.1s ease;
  }

  nav a:active {
    background: rgba(21, 101, 192, 0.08) !important;
    color: #1565c0 !important;
  }
}

:global(.dark) aside > button.hidden.lg\:flex {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
</style>