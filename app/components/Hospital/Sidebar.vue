<template>
  <!-- Mobile Menu Button -->
  <div>
    <button @click="mobileOpen = true"
      class="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-slate-900 shadow-md border border-gray-200 dark:border-slate-700">
      <AssetIcon name="menu" :size="20" />
    </button>

    <!-- Mobile Overlay -->
    <div v-if="mobileOpen" class="lg:hidden fixed inset-0 z-40 bg-black/40" @click="mobileOpen = false" />

    <aside
      class="fixed top-0 left-0 h-screen w-64 z-50 flex flex-col transition-transform duration-200 lg:translate-x-0"
      :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
      :style="{ background: SIDEBAR_BG, boxShadow: sidebarShadow }">
      <!-- Close button -->
      <button class="lg:hidden absolute top-4 right-4 z-10" @click="mobileOpen = false"
        :style="{ color: SIDEBAR_IDLE_TEXT }">
        <AssetIcon name="x" :size="20" />
      </button>

      <!-- Logo -->
      <div
        class="h-16 px-4 flex items-center gap-3 border-b dark:border-slate-700 flex-shrink-0 transition-colors duration-150"
        style="border-color:#EEF1F5">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
          style="background: linear-gradient(135deg, #1565C0, #42A5F5); box-shadow: 0 4px 12px rgba(21,101,192,0.25)">
          <img :src="logo" alt="RedAgos Logo" class="logo-image">
        </div>

        <div>
          <h1 class="font-extrabold text-base leading-none" :style="{ color: SIDEBAR_HEADING_TEXT }">
            Red<span style="color:#D32F2F">Agos</span>
          </h1>
          <p class="text-[11px] mt-0.5" :style="{ color: SIDEBAR_IDLE_TEXT }">
            Hospital Portal
          </p>
        </div>
      </div>

      <!-- Facility badge -->
      <div v-if="facilityName" class="px-4 pt-3">
        <div class="flex items-center gap-2 rounded-[10px] px-3 py-2 text-xs font-semibold"
          :style="{ background: isDark ? '#1E293B' : '#F1F6FB', color: isDark ? '#94A3B8' : '#64748B' }">
          <AssetIcon name="building-2" :size="14" />
          <span class="truncate">{{ facilityName }}</span>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto px-3 pt-4" :class="isDark ? 'nav-dark' : ''">
        <template v-for="(group, gIndex) in navGroups" :key="gIndex">
          <p v-if="group.label"
            class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 mb-1 mt-5"
            :style="{ color: SIDEBAR_IDLE_TEXT }">
            <span class="w-3 h-[2px] rounded-full" :style="{ background: isDark ? '#475569' : '#CBD5E1' }" />
            {{ group.label }}
          </p>

          <NuxtLink v-for="item in group.items" :key="item.path" :to="item.path" @click="closeSidebar"
            @mouseenter="hoveredPath = item.path" @mouseleave="hoveredPath = null" @touchstart="() => { }"
            class="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-[10px] text-sm transition-all duration-150"
            :style="navStyle(item.path)">
            <span
              class="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 transition-colors duration-150"
              :style="{ background: isActive(item.path) ? '#1565C0' : 'transparent' }">
              <AssetIcon :name="item.icon" :size="14"
                :style="{ color: isActive(item.path) ? '#ffffff' : 'currentColor' }" />
            </span>
            <span class="flex-1 font-medium">{{ item.label }}</span>

            <span v-if="item.badge && badgeCounts[item.badge]" class="text-[10px] font-bold px-2 py-0.5 rounded-full"
              :style="{
                background: item.badge === 'emergency' ? '#D32F2F14' : (isDark ? '#334155' : '#F1F5F9'),
                color: item.badge === 'emergency' ? '#D32F2F' : SIDEBAR_IDLE_TEXT
              }">
              {{ badgeCounts[item.badge] }}
            </span>
          </NuxtLink>
        </template>

        <!-- Settings / Help -->
        <div class="mt-4 border-t pt-3" :style="{ borderColor: SIDEBAR_BORDER }">
          <NuxtLink v-for="item in bottomItems" :key="item.path" :to="item.path" @click="closeSidebar"
            @mouseenter="hoveredPath = item.path" @mouseleave="hoveredPath = null" @touchstart="() => { }"
            class="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-[10px] text-sm transition-all duration-150"
            :style="navStyle(item.path)">
            <AssetIcon :name="item.icon" :size="16" />
            <span class="flex-1 font-medium">{{ item.label }}</span>
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
import { useUser } from '~/composables/useUser.js'
import { hospitalService } from '~/api/hospital/HospitalService'

// --- Dark mode awareness ---
const isDark = ref(false)
let themeObserver = null

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  themeObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  themeObserver?.disconnect()
})

// Light/dark theme tokens — matched to the redesigned dashboard's palette
const SIDEBAR_BG = computed(() => (isDark.value ? '#0F172A' : '#FFFFFF'))
const SIDEBAR_BORDER = computed(() => (isDark.value ? '#334155' : '#EEF1F5'))
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
const mobileOpen = ref(false)
const { user, fetchUser, clearUser } = useUser()

const activePath = ref(route.path || '/')
watch(
  () => route.path,
  (newPath) => { activePath.value = newPath }
)

const facilityName = computed(() => user.value?.facility?.facility_name || '')

// // Dev note: pending/emergency counts naka-fetch sa dashboard summary endpoint
const badgeCounts = ref({ pending: 0, emergency: 0 })

const navGroups = [
  {
    label: null,
    items: [
      { label: 'Notifications', path: '/hospital/notifications', icon: 'bell' },
      { label: 'Dashboard', path: '/hospital/dashboard', icon: 'house' }
    ]
  },
  {
    label: 'Blood Requests',
    items: [
      { label: 'Blood Requests', path: '/hospital/bloodrequests', icon: 'clipboard-list', badge: 'pending' },
      { label: 'Search Availability', path: '/hospital/availability', icon: 'search' }
    ]
  },
  {
    label: 'Billing',
    items: [
      { label: 'Billing & Payments', path: '/hospital/billing', icon: 'receipt' },
      { label: 'Transaction History', path: '/hospital/transactions', icon: 'history' }
    ]
  }
]

const bottomItems = [
  { label: 'Settings', path: '/hospital/settings', icon: 'settings' },
  { label: 'Help', path: '/hospital/help', icon: 'help-circle' }
]

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

const closeSidebar = () => {
  mobileOpen.value = false
}

const logout = () => {
  clearUser()
  router.push('/auth/hospital/login')
}

const hoveredPath = ref(null)

const isActive = (path) => route.path === path

const navStyle = (path) => {
  const active = isActive(path)
  const hovered = hoveredPath.value === path

  return {
    background: active || hovered ? SIDEBAR_ACTIVE_BG.value : 'transparent',
    color: active || hovered ? SIDEBAR_ACTIVE_TEXT.value : SIDEBAR_IDLE_TEXT.value,
    fontWeight: active ? '700' : '500',
    boxShadow: active ? `inset 3px 0 0 ${SIDEBAR_ACTIVE_TEXT.value}` : 'none'
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

nav {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

nav::-webkit-scrollbar {
  width: 6px;
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

@media (hover: none) {
  nav a {
    transition: background 0.1s ease, color 0.1s ease;
  }

  nav a:active {
    background: #1565C014 !important;
    color: #1565C0 !important;
  }
}
</style>