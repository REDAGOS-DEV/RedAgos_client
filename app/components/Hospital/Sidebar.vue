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
      class="fixed top-0 left-0 h-screen w-[270px] z-50 flex flex-col transition-transform duration-200 lg:translate-x-0"
      :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'"
      :style="{ background: SIDEBAR_BG, boxShadow: sidebarShadow }">
      <!-- Close button -->
      <button class="lg:hidden absolute top-4 right-4 z-10" @click="mobileOpen = false"
        :style="{ color: SIDEBAR_IDLE_TEXT }">
        <AssetIcon name="x" :size="20" />
      </button>

      <!-- Logo -->
      <div
        class="px-5 pt-3 pb-3 flex items-center gap-3 border-b dark:border-slate-700 flex-shrink-0 transition-colors duration-150"
        :style="{ borderColor: SIDEBAR_BORDER }">
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

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto px-3.5 pt-4" :class="isDark ? 'nav-dark' : ''">
        <template v-for="(group, gIndex) in navGroups" :key="gIndex">
          <p v-if="group.label"
            class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 mb-1.5 mt-5"
            :style="{ color: SIDEBAR_IDLE_TEXT }">
            <span class="w-3 h-[2px] rounded-full" :style="{ background: isDark ? '#475569' : '#CBD5E1' }" />
            {{ group.label }}
          </p>

          <NuxtLink v-for="item in group.items" :key="item.path" :to="item.path" @click="closeSidebar"
            @mouseenter="hoveredPath = item.path" @mouseleave="hoveredPath = null" @touchstart="() => { }"
            class="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-[10px] text-sm transition-all"
            style="transition-duration: 0.25s" :style="navStyle(item.path)">
            <span class="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 transition-transform"
              :style="{
                background: isActive(item.path) ? '#1565C0' : 'transparent',
                transform: (hoveredPath === item.path && !isActive(item.path)) ? 'translateX(2px)' : 'translateX(0)',
                transitionDuration: '0.25s'
              }">
              <AssetIcon :name="item.icon" :size="14"
                :style="{ color: isActive(item.path) ? '#ffffff' : 'currentColor' }" />
            </span>
            <span class="flex-1" :style="{ fontWeight: isActive(item.path) ? '700' : '500' }">{{ item.label }}</span>

            <span v-if="item.badge && badgeCounts[item.badge]" class="text-[10px] font-bold px-2 py-0.5 rounded-full"
              :style="{
                background: item.badge === 'emergency' ? '#D32F2F14' : (isDark ? '#334155' : '#F1F5F9'),
                color: item.badge === 'emergency' ? '#D32F2F' : SIDEBAR_IDLE_TEXT
              }">
              {{ badgeCounts[item.badge] }}
            </span>
          </NuxtLink>
        </template>
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
const SIDEBAR_ACTIVE_BG = computed(() => (isDark.value ? '#42A5F529' : '#EFF6FF'))
const SIDEBAR_HOVER_BG = computed(() => (isDark.value ? '#1E293B' : '#EFF6FF'))
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
const { user, fetchUser, logout } = useUser()

const activePath = ref(route.path || '/')
watch(
  () => route.path,
  (newPath) => { activePath.value = newPath }
)

const facilityName = computed(() => user.value?.facility?.facility_name || '')
const userInitial = computed(() => facilityName.value?.charAt(0) || user.value?.full_name?.charAt(0) || 'H')
// // Dev note: role wala pay field sa users table karon — TODO ni sa backend teammate.
const userRole = computed(() => user.value?.role || 'Hospital Staff')

// // Dev note: pending/emergency counts naka-fetch sa dashboard summary endpoint
const badgeCounts = ref({ pending: 0, emergency: 0 })

const navGroups = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', path: '/hospital/dashboard', icon: 'layout-dashboard' },
      { label: 'Notifications', path: '/hospital/notifications', icon: 'bell' }
    ]
  },
  {
    label: 'Requests',
    items: [
      { label: 'Blood Requests', path: '/hospital/bloodrequests', icon: 'clipboard-list', badge: 'pending' },
      { label: 'Blood Availability', path: '/hospital/bloodavailability', icon: 'droplets' },
      { label: 'Track Requests', path: '/hospital/trackrequests', icon: 'route' }
    ]
  },
  // Ang Finance group (billing, transactions) ug ang Help & Support kay
  // gitangtang: walay page files para nila, so 404 ang tanan. Ibalik ni kung
  // naa nay backend + page — tan-awa ang Phase P sa audit plan.
  {
    label: 'System',
    items: [
      { label: 'Settings', path: '/hospital/settings', icon: 'settings' }
    ]
  }
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

const handleLogout = async () => {
  await logout('/auth/hospital/login')
}


const hoveredPath = ref(null)

const isActive = (path) => route.path === path

const navStyle = (path) => {
  const active = isActive(path)
  const hovered = hoveredPath.value === path

  let background = 'transparent'
  if (active) background = SIDEBAR_ACTIVE_BG.value
  else if (hovered) background = SIDEBAR_HOVER_BG.value

  return {
    background,
    color: active ? SIDEBAR_ACTIVE_TEXT.value : SIDEBAR_IDLE_TEXT.value,
    boxShadow: active ? `inset 4px 0 0 ${SIDEBAR_ACTIVE_TEXT.value}` : 'none'
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
    transition: background 0.25s ease, color 0.25s ease;
  }

  nav a:active {
    background: #EFF6FF !important;
    color: #1565C0 !important;
  }
}
</style>
