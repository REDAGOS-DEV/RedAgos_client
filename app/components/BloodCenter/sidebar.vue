<template>
  <!-- Mobile Menu Button -->
  <div>
  <button @click="mobileOpen = true"
    class="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md border border-gray-200">
    <AssetIcon name="menu" :size="20" />
  </button>

  <!-- Mobile Overlay -->
  <div v-if="mobileOpen" class="lg:hidden fixed inset-0 z-40 bg-black/50" @click="mobileOpen = false" />

  <aside
    class="fixed top-0 left-0 h-screen w-64 z-50 flex flex-col shadow-2xl transition-transform duration-200 lg:translate-x-0"
    :class="mobileOpen ? 'translate-x-0' : '-translate-x-full'" :style="{ background: NAVY }">
    <!-- Close button -->
    <button class="lg:hidden absolute top-4 right-4 z-10" @click="mobileOpen = false"
      style="color: rgba(255,255,255,.7)">
      <AssetIcon name="x" :size="20" />
    </button>

    <!-- Logo -->
    <div class="px-4 pt-5 pb-4 flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
        style="background: #A3B8DA">
        <img :src="logo" alt="RedAgos Logo" class="logo-image">
      </div>

      <div>
        <h1 class="font-extrabold text-base leading-none" style="color:#fff">
          Red<span style="color:#EF5350">Agos</span>
        </h1>
        <p class="text-[11px] mt-0.5" style="color:rgba(255,255,255,.4)">
          Blood Center
        </p>
      </div>
    </div>

    <!-- Search -->
    <div class="px-4 mb-2">
      <div class="flex items-center gap-2 px-3 py-2 rounded-lg" :style="{ background: NAVY_LIGHT }">
        <AssetIcon name="search" :size="14" style="color:rgba(255,255,255,.35)" />
        <span class="text-sm flex-1" style="color:rgba(255,255,255,.35)">Search...</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded font-mono"
          style="background:rgba(255,255,255,.08);color:rgba(255,255,255,.3)">
          ⌘F
        </span>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-3">
      <template v-for="(group, gIndex) in navGroups" :key="gIndex">
        <p v-if="group.label" class="text-[10px] font-bold uppercase tracking-widest px-3 mb-1 mt-4"
          style="color:rgba(255,255,255,.3)">
          {{ group.label }}
        </p>

        <NuxtLink v-for="item in group.items" :key="item.path" :to="item.path" @click="closeSidebar"
          @mouseenter="hoveredPath = item.path" @mouseleave="hoveredPath = null"
          @touchstart="() => {}"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
          :style="navStyle(item.path)">
          <AssetIcon :name="item.icon" :size="16" />
          <span class="flex-1 font-medium">{{ item.label }}</span>

          <span v-if="item.countKey && counts[item.countKey]" class="text-[10px] font-bold px-2 py-0.5 rounded-full" :style="{
            background: item.urgent && counts[item.countKey] > 0 ? '#B71C1C' : 'rgba(255,255,255,.12)',
            color: item.urgent && counts[item.countKey] > 0 ? '#FFCDD2' : 'rgba(255,255,255,.6)'
          }">
            {{ counts[item.countKey] }}
          </span>
        </NuxtLink>
      </template>

      <!-- Settings -->
      <div class="mt-4 border-t pt-3" style="border-color:rgba(255,255,255,.08)">
        <NuxtLink v-for="item in bottomItems" :key="item.path" :to="item.path" @click="closeSidebar"
          @mouseenter="hoveredPath = item.path" @mouseleave="hoveredPath = null"
          @touchstart="() => {}"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
          :style="navStyle(item.path)">
          <AssetIcon :name="item.icon" :size="16" />
          <span class="flex-1 font-medium">{{ item.label }}</span>
        </NuxtLink>
      </div>
    </nav>

    <!-- Footer -->
    <div class="relative px-3 pb-4 pt-2 border-t" style="border-color:rgba(255,255,255,.08)">
      <button @click="showUserMenu = !showUserMenu"
        class="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all hover:bg-white/10">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white overflow-hidden flex-shrink-0"
          style="background:#1565C0">
          <img v-if="user?.avatar" :src="user.avatar" class="w-full h-full object-cover" alt="">
          <span v-else>{{ user?.full_name?.charAt(0) || 'B' }}</span>
        </div>

        <div class="flex-1 text-left min-w-0">
          <p class="text-sm font-semibold truncate text-white">{{ user?.full_name || 'Staff' }}</p>
          <p class="text-[11px] truncate" style="color:rgba(255,255,255,.4)">{{ user?.facility_name || user?.email }}</p>
        </div>

        <AssetIcon name="chevron-right" :size="16" style="color:rgba(255,255,255,.3)"
          class="transition-transform duration-150" :class="showUserMenu ? '-rotate-90' : ''" />
      </button>

      <!-- User Menu Popup -->
      <Transition name="popup">
        <div v-if="showUserMenu" v-click-outside="closeUserMenu"
          class="absolute left-3 right-3 bottom-full mb-2 rounded-xl shadow-2xl overflow-hidden bg-white">
          <!-- User info header -->
          <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white overflow-hidden flex-shrink-0"
              style="background:#1565C0">
              <img v-if="user?.avatar" :src="user.avatar" class="w-full h-full object-cover" alt="">
              <span v-else>{{ user?.full_name?.charAt(0) || 'B' }}</span>
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold truncate text-gray-900">{{ user?.full_name || 'Staff' }}</p>
              <p class="text-xs truncate text-gray-500">{{ user?.role_label || 'Blood Center Staff' }}</p>
            </div>
          </div>

          <!-- Menu items -->
          <div class="py-2">
            <NuxtLink v-for="item in userMenuItems" :key="item.path" :to="item.path" @click="closeUserMenu"
              class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <AssetIcon :name="item.icon" :size="16" class="text-gray-400" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </div>

          <div class="border-t border-gray-100 py-2">
            <button @click="handleLogout"
              class="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-colors hover:bg-red-50"
              style="color:#D32F2F">
              <AssetIcon name="log-out" :size="16" />
              <span>Log Out</span>
            </button>
          </div>

          <div class="px-4 py-2 border-t border-gray-100">
            <p class="text-[11px] text-center text-gray-400">v1.0.0 · Terms & Conditions</p>
          </div>
        </div>
      </Transition>
    </div>
  </aside>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logo from '~/assets/images/RedAgosLogo.png'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { useUser } from '~/composables/useUser.js'

const NAVY = '#0F2044'
const NAVY_LIGHT = '#162B58'
const NAVY_HOVER = '#1A3468'

const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)
const user = ref(null)

// Live counts for badges (pending requests, urgent appointments, etc.)
const counts = ref({
  pendingRequests: 0,
  todayAppointments: 0,
})

const activePath = ref(route.path || '/')

watch(
  () => route.path,
  (newPath) => {
    activePath.value = newPath
  }
)

const navGroups = [
  {
    label: null,
    items: [
      { label: 'Notifications', path: '/blood-center/Notifications', icon: 'bell' },
      { label: 'Dashboard', path: '/blood-center/Dashboard', icon: 'house' }
    ]
  },
  {
    label: 'Requests & Supply',
    items: [
      { label: 'Blood Requests', path: '/blood-center/Requests', icon: 'clipboard-check', countKey: 'pendingRequests', urgent: true },
      { label: 'Inventory', path: '/blood-center/Inventory', icon: 'archive' }
    ]
  },
  {
    label: 'Donors',
    items: [
      { label: 'Donors', path: '/blood-center/Donors', icon: 'users' },
      { label: 'Appointments', path: '/blood-center/Appointments', icon: 'calendar', countKey: 'todayAppointments' },
      { label: 'Mobile Drives', path: '/blood-center/MobileDrives', icon: 'truck' }
    ]
  },
  {
    label: 'Finance',
    items: [
      { label: 'Billing', path: '/blood-center/Billing', icon: 'credit-card' }
    ]
  },
  {
    label: 'Insights',
    items: [
      { label: 'Demand Forecasting', path: '/blood-center/Reports', icon: 'bar-chart' }
    ]
  }
]

const bottomItems = [
  { label: 'Settings', path: '/blood-center/Settings', icon: 'settings' },
  { label: 'Help', path: '/blood-center/Help', icon: 'help-circle' }
]

const showUserMenu = ref(false)

const userMenuItems = [
  { label: 'My Profile', path: '/blood-center/Profile', icon: 'user-circle' },
  { label: 'Blood Requests', path: '/blood-center/Requests', icon: 'clipboard-check' },
  { label: 'Billing', path: '/blood-center/Billing', icon: 'credit-card' }
]

const closeUserMenu = () => {
  showUserMenu.value = false
}

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

const loadUser = async () => {
  try {
    // const me = await $fetch('/api/auth/me')
    // user.value = me
    // const stats = await $fetch(`/api/bloodcenter/${me.facility_id}/summary`)
    // counts.value.pendingRequests = stats.pending_requests
    // counts.value.todayAppointments = stats.today_appointments

    user.value = { id: 1, full_name: 'Yang Yang', role_label: 'Blood Center Staff', facility_name: 'Sub-National Blood Center' }
    counts.value = { pendingRequests: 0, todayAppointments: 0 }
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

const hoveredPath = ref(null)

const isActive = (path) => route.path === path

const navStyle = (path) => {
  const active = isActive(path)
  const hovered = hoveredPath.value === path

  return {
    background: active || hovered ? NAVY_HOVER : 'transparent',
    color: active || hovered ? '#FFFFFF' : 'rgba(255,255,255,.6)'
  }
}

const { clearUser } = useUser()
const handleLogout = async () => {
  try {
    showUserMenu.value = false
    // await $fetch('/api/logout', { method: 'POST' })
    clearUser()
    router.push('/auth/blood-center/login')
  } catch (err) {
    console.error(err)
  }
}
</script>

<style scoped>
nav {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
}

nav::-webkit-scrollbar {
  width: 6px;
}

nav::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.25);
  border-radius: 999px;
}

nav::-webkit-scrollbar-track {
  background: transparent;
}

.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (hover: none) {
  nav a {
    transition: background 0.1s ease, color 0.1s ease;
  }
  nav a:active {
    background: #1A3468 !important;
    color: #FFFFFF !important;
  }
}
</style>