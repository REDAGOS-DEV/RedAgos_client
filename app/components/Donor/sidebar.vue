<template>
  <!-- Mobile Menu Button -->
  <button
    @click="mobileOpen = true" class="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md border border-gray-200">
    <AssetIcon name="menu" :size="20" />
  </button>

  <!-- Mobile Sidebar -->
  <div
    v-if="mobileOpen" class="lg:hidden fixed inset-0 z-40 flex">
    <!-- Overlay -->
    <div
      class="fixed inset-0 bg-black/50" @click="mobileOpen = false"/>

    <!-- Sidebar -->
    <div
      class="relative w-64 h-full shadow-2xl z-50" :style="{ background: NAVY }">
      <button
        class="absolute top-4 right-4 z-10" @click="mobileOpen = false" style="color: rgba(255,255,255,.7)">
        <AssetIcon name="x" :size="20"/>
      </button>

      <div
        class="flex flex-col h-full" :style="{ background: NAVY }">

        <!-- Logo -->
        <div
            class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
             <img :src="logo" alt="RedAgos Logo" class="logo-image">
        </div>

            <h1
              class="font-extrabold text-base leading-none"
              style="color:#fff"
            >
              Red
              <span style="color:#EF5350">
                Agos
              </span>
            </h1>

            <p
              class="text-[11px] mt-0.5"
              style="color:rgba(255,255,255,.4)"
            >
              Donor Portal
            </p>
          </div>

        <!-- Search -->
        <div class="px-4 mb-2">

          <div
            class="flex items-center gap-2 px-3 py-2 rounded-lg" :style="{ background: NAVY_LIGHT }">
            <AssetIcon name="search" :size="14" style="color:rgba(255,255,255,.35)"/>
            <span
              class="text-sm flex-1" style="color:rgba(255,255,255,.35)">
              Search...
            </span>

            <span
              class="text-[10px] px-1.5 py-0.5 rounded font-mono" style="background:rgba(255,255,255,.08);color:rgba(255,255,255,.3)">
              ⌘F
            </span>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="px-3 flex-1 overflow-y-auto">

          <!-- Notifications -->
          <NuxtLink
            to="/notifications" @click="closeSidebar"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :style="navStyle('/notifications')">
            <AssetIcon name="bell" :size="16"/>

            <span class="flex-1 font-medium">
              Notifications
            </span>
          </NuxtLink>

          <!-- Dashboard -->
          <NuxtLink
            to="/"
            @click="closeSidebar"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :style="navStyle('/')">
            <AssetIcon name="house" :size="16"/>

            <span class="flex-1 font-medium">
              Dashboard
            </span>
          </NuxtLink>

          <!-- DONORS -->
          <p
            class="text-[10px] font-bold uppercase tracking-widest px-3 mb-1 mt-4"
            style="color:rgba(255,255,255,.3)">
            Donors
          </p>

          <!-- Eligibility -->
          <NuxtLink
            to="/eligibility"
            @click="closeSidebar"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :style="navStyle('/eligibility')">
            <AssetIcon name="clipboard-check" :size="16"/>
            <span class="flex-1 font-medium">
              Eligibility Screening
            </span>
          </NuxtLink>

          <!-- Book Appointment -->
          <NuxtLink
            to="/book-appointment"
            @click="closeSidebar"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :style="navStyle('/book-appointment')">
            <AssetIcon name="calendar" :size="16"/>
            <span class="flex-1 font-medium">
              Book Appointment
            </span>
          </NuxtLink>
                    <!-- RECORDS -->
          <p
            class="text-[10px] font-bold uppercase tracking-widest px-3 mb-1 mt-4"
            style="color:rgba(255,255,255,.3)"
          >
            Records
          </p>

          <!-- Donation History -->
          <NuxtLink
            to="/donation-history"
            @click="closeSidebar"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :style="navStyle('/donation-history')">
            <AssetIcon name="history":size="16"/>
            <span class="flex-1 font-medium">
              Donation History
            </span>
          </NuxtLink>

          <!-- QR Code -->
          <NuxtLink
            to="/eligibility"
            @click="closeSidebar"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :style="navStyle('/eligibility')">
            <AssetIcon name="qr-code":size="16"/>
            <span class="flex-1 font-medium">
              My QR Code
            </span>

            <span
              v-if="eligibilityStatus"
              class="text-[10px] font-bold px-2 py-0.5 rounded-full"
              :style="{
                background:
                  eligibilityStatus === 'eligible'
                    ? '#1B5E20'
                    : 'rgba(255,255,255,.12)',

                color:
                  eligibilityStatus === 'eligible'
                    ? '#69F0AE'
                    : 'rgba(255,255,255,.4)'
              }"
            >
              {{ eligibilityStatus === 'eligible'
                  ? 'Valid'
                  : eligibilityStatus }}
            </span>
          </NuxtLink>

          <!-- Profile -->
          <NuxtLink
            to="/profile"
            @click="closeSidebar"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :style="navStyle('/profile')">
            <AssetIcon name="user-circle" :size="16"/>
            <span class="flex-1 font-medium">
              My Profile
            </span>
          </NuxtLink>

          <!-- Divider -->
          <div
            class="mt-4 border-t pt-3" style="border-color:rgba(255,255,255,.08)"
          >

            <!-- Settings -->
            <NuxtLink
              to="/settings"
              @click="closeSidebar"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
              :style="navStyle('/settings')">
              <AssetIcon name="settings" :size="16"/>

              <span class="flex-1 font-medium">
                Settings
              </span>
            </NuxtLink>

            <!-- Help -->
            <NuxtLink
              to="/help"
              @click="closeSidebar"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
              :style="navStyle('/help')">
              <AssetIcon name="help-circle" :size="16"/>

              <span class="flex-1 font-medium">
                Help
              </span>
            </NuxtLink>
          </div>
        </nav>

        <!-- Footer -->
        <div
          class="px-3 pb-4 pt-2 border-t"
          style="border-color:rgba(255,255,255,.08)"
        >
          <button
            @click="handleLogout"
            class="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all hover:bg-white/10"
          >

            <div
              class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white"
              style="background:#1565C0"
            >
              {{ user?.full_name?.charAt(0) || 'D' }}
            </div>

            <div class="flex-1 text-left min-w-0">

              <p class="text-sm font-semibold truncate text-white">
                {{ user?.full_name || 'Donor' }}
              </p>

              <p
                class="text-[11px] truncate"
                style="color:rgba(255,255,255,.4)"
              >
                {{ user?.email }}
              </p>

            </div>
            <AssetIcon name="chevron-right" :size="16" style="color:rgba(255,255,255,.3)"
            />

          </button>
        </div>
      </div>
    </div>
  <!-- Desktop Sidebar -->
<aside
  class="hidden lg:flex fixed left-0 top-0 w-64 h-screen shadow-2xl" :style="{ background: NAVY }">
    <div
        class="relative w-64 h-screen shadow-2xl z-50 flex flex-col" :style="{ background: NAVY }">
      <button
        class="absolute top-4 right-4 z-10" @click="mobileOpen = false" style="color: rgba(255,255,255,.7)">
        <AssetIcon name="x" :size="20"/>
      </button>

      <div
        class="flex flex-col flex-1 overflow-hidden">

        <!-- Logo -->
        <div class="px-4 pt-5 pb-4 flex items-center gap-3">
        <div
            class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
             <img :src="logo" alt="RedAgos Logo" class="logo-image">

            <h1
              class="font-extrabold text-base leading-none"
              style="color:#ffffff"
            >
              Red
              <span style="color:#EF5350">
                Agos
              </span>
            </h1>

            <p
              class="text-[11px] mt-0.5"
              style="color:rgba(255,255,255,.4)"
            >
              Donor Portal
            </p>
          </div>
        </div>
        <!-- Search -->
        <div class="px-4 mb-2">

          <div
            class="flex items-center gap-2 px-3 py-2 rounded-lg" :style="{ background: NAVY_LIGHT }">
            <AssetIcon name="search" :size="14" style="color:rgba(255,255,255,.35)"/>
            <span
              class="text-sm flex-1" style="color:rgba(255,255,255,.35)">
              Search...
            </span>

            <span
              class="text-[10px] px-1.5 py-0.5 rounded font-mono" style="background:rgba(255,255,255,.08);color:rgba(255,255,255,.3)">
              ⌘F
            </span>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 overflow-y-auto px-3">

          <!-- Notifications -->
          <NuxtLink
            to="/notifications" @click="closeSidebar"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :style="navStyle('/notifications')">
            <AssetIcon name="bell" :size="16"/>

            <span class="flex-1 font-medium">
              Notifications
            </span>
          </NuxtLink>

          <!-- Dashboard -->
          <NuxtLink
            to="/" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150" :style="{
            background: isActive('/') ? NAVY_HOVER : 'transparent',
            color: isActive('/') ? '#FFFFFF' : 'rgba(255,255,255,.6)'}">
            <AssetIcon name="house" :size="16" />
            
            <span class="flex-1 font-medium">
              Dashboard
            </span>
           </NuxtLink>

          <!-- DONORS -->
          <p
            class="text-[10px] font-bold uppercase tracking-widest px-3 mb-1 mt-4"
            style="color:rgba(255,255,255,.3)">
            Donors
          </p>

          <!-- Eligibility -->
          <NuxtLink
            to="/eligibility"
            @click="closeSidebar"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :style="navStyle('/eligibility')">
            <AssetIcon name="clipboard-check" :size="16"/>
            <span class="flex-1 font-medium">
              Eligibility Screening
            </span>
          </NuxtLink>

          <!-- Book Appointment -->
          <NuxtLink
            to="/book-appointment"
            @click="closeSidebar"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :style="navStyle('/book-appointment')">
            <AssetIcon name="calendar" :size="16"/>
            <span class="flex-1 font-medium">
              Book Appointment
            </span>
          </NuxtLink>
                    <!-- RECORDS -->
          <p
            class="text-[10px] font-bold uppercase tracking-widest px-3 mb-1 mt-4"
            style="color:rgba(255,255,255,.3)"
          >
            Records
          </p>

          <!-- Donation History -->
          <NuxtLink
            to="/donation-history"
            @click="closeSidebar"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :style="navStyle('/donation-history')">
            <AssetIcon name="history":size="16"/>
            <span class="flex-1 font-medium">
              Donation History
            </span>
          </NuxtLink>

          <!-- QR Code -->
          <NuxtLink
            to="/eligibility"
            @click="closeSidebar"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :style="navStyle('/eligibility')">
            <AssetIcon name="qr-code":size="16"/>
            <span class="flex-1 font-medium">
              My QR Code
            </span>

            <span
              v-if="eligibilityStatus"
              class="text-[10px] font-bold px-2 py-0.5 rounded-full"
              :style="{
                background:
                  eligibilityStatus === 'eligible'
                    ? '#1B5E20'
                    : 'rgba(255,255,255,.12)',

                color:
                  eligibilityStatus === 'eligible'
                    ? '#69F0AE'
                    : 'rgba(255,255,255,.4)'
              }"
            >
              {{ eligibilityStatus === 'eligible'
                  ? 'Valid'
                  : eligibilityStatus }}
            </span>
          </NuxtLink>

          <!-- Profile -->
          <NuxtLink
            to="/profile"
            @click="closeSidebar"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
            :style="navStyle('/profile')">
            <AssetIcon name="user-circle" :size="16"/>
            <span class="flex-1 font-medium">
              My Profile
            </span>
          </NuxtLink>

          <!-- Divider -->
          <div
            class="mt-4 border-t pt-3" style="border-color:rgba(255,255,255,.08)"
          >

            <!-- Settings -->
            <NuxtLink
              to="/settings"
              @click="closeSidebar"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
              :style="navStyle('/settings')">
              <AssetIcon name="settings" :size="16"/>

              <span class="flex-1 font-medium">
                Settings
              </span>
            </NuxtLink>

            <!-- Help -->
            <NuxtLink
              to="/help"
              @click="closeSidebar"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
              :style="navStyle('/help')">
              <AssetIcon name="help-circle" :size="16"/>

              <span class="flex-1 font-medium">
                Help
              </span>
            </NuxtLink>
          </div>
        </nav>

        <!-- Footer -->
        <div
          class="px-3 pb-4 pt-2 border-t"
          style="border-color:rgba(255,255,255,.08)"
        >
          <button
            @click="handleLogout"
            class="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all hover:bg-white/10"
          >

            <div
              class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white"
              style="background:#1565C0"
            >
              {{ user?.full_name?.charAt(0) || 'D' }}
            </div>

            <div class="flex-1 text-left min-w-0">

              <p class="text-sm font-semibold truncate text-white">
                {{ user?.full_name || 'Donor' }}
              </p>

              <p
                class="text-[11px] truncate"
                style="color:rgba(255,255,255,.4)"
              >
                {{ user?.email }}
              </p>

            </div>
            <AssetIcon name="chevron-right" :size="16" style="color:rgba(255,255,255,.3)"
            />

          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logo from '~/assets/images/RedAgosLogo.png' 
import AssetIcon from '~/components/common/AssetIcon.vue'

const NAVY = '#0F2044'
const NAVY_LIGHT = '#162B58'
const NAVY_HOVER = '#1A3468'
const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)
const user = ref(null)
const eligibilityStatus = ref(null)
const loadUser = async () => {
  try {
    /*
    Example:

    const me = await $fetch('/api/auth/me')

    user.value = me

    const profile = await $fetch(
      `/api/donor-profile/${me.id}`
    )

    eligibilityStatus.value =
      profile.eligibility_status
    */

    // Temporary demo values

    user.value = {
      id: 1,
      full_name: 'Juan Dela Cruz',
      email: 'juan@example.com'
    }

    eligibilityStatus.value = 'eligible'

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

const isActive = (path) => {
  return route.path === path
}

const navStyle = (path) => {
  return {
    background:
      isActive(path)
        ? NAVY_HOVER
        : 'transparent',

    color:
      isActive(path)
        ? '#FFFFFF'
        : 'rgba(255,255,255,.6)'
  }
}

const handleLogout = async () => {
  try {

    /*
    await $fetch('/api/logout', {
      method: 'POST'
    })
    */

    router.push('/login')

  } catch (err) {
    console.error(err)
  }
}

const menuItems = [
  {
    label: 'Notifications',
    path: '/notifications',
    icon: 'bell'
  },
  {
    label: 'Dashboard',
    path: '/',
    icon: 'house'
  },
  {
    label: 'Eligibility Screening',
    path: '/eligibility',
    icon: 'clipboard-check'
  },
  {
    label: 'Book Appointment',
    path: '/book-appointment',
    icon: 'calendar'
  },
  {
    label: 'Donation History',
    path: '/donation-history',
    icon: 'history'
  },
  {
    label: 'My QR Code',
    path: '/eligibility',
    icon: 'qr-code'
  },
  {
    label: 'My Profile',
    path: '/profile',
    icon: 'user-circle'
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: 'settings'
  },
  {
    label: 'Help',
    path: '/help',
    icon: 'help-circle'
  }
]
</script>
<style scoped>

.flex.flex-col.h-full {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
}

.flex.flex-col.h-full::-webkit-scrollbar {
  width: 6px;
}

.flex.flex-col.h-full::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.25);
  border-radius: 999px;
}

.flex.flex-col.h-full::-webkit-scrollbar-track {
  background: transparent;
}

/* smooth open/close for the mobile drawer overlay */
.fixed.inset-0.bg-black\/40 {
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>