<template>
  <div>
    <!-- Mobile Overlay -->
    <div v-if="mobileOpen" class="lg:hidden fixed inset-0 z-40 bg-black/40" @click="closeMobile" />

    <aside
      class="fixed top-0 left-0 h-screen z-50 flex flex-col overflow-hidden transition-[width,transform] duration-200 lg:translate-x-0"
      :class="[mobileOpen ? 'translate-x-0' : '-translate-x-full', railCollapsed ? 'lg:w-20' : 'lg:w-64', 'w-64']"
      :style="{ background: SIDEBAR_BG, boxShadow: sidebarShadow }"
      @mouseenter="handleSidebarEnter"
      @mouseleave="handleSidebarLeave"
      @focusin="handleSidebarEnter"
      @focusout="handleSidebarLeave">
      <!-- Close button (mobile) -->
      <button class="lg:hidden absolute top-4 right-4 z-10" :style="{ color: SIDEBAR_IDLE_TEXT }" @click="closeMobile">
        <AssetIcon name="x" :size="20" />
      </button>

      <!-- Logo -->
      <div
        class="px-5 h-14 sm:h-16 flex items-center gap-3 border-b dark:border-slate-700 flex-shrink-0 transition-colors duration-150 cursor-pointer select-none"
        :class="railCollapsed ? 'lg:justify-center lg:px-0' : ''" :style="{ borderColor: SIDEBAR_BORDER }"
        @click="goToDashboard">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
          style="background: #1565C0">
          <img :src="logo" alt="RedAgos Logo" class="logo-image">
        </div>

        <div v-if="showLabels" class="lg:block whitespace-nowrap">
          <h1 class="font-extrabold text-base leading-none" :style="{ color: SIDEBAR_HEADING_TEXT }">
            Red<span style="color:#D32F2F">Agos</span>
          </h1>
          <p class="text-[11px] mt-0.5" :style="{ color: SIDEBAR_IDLE_TEXT }">
            Super Admin
          </p>
        </div>
      </div>

      <!-- Navigation. No group headings: the clusters are separated by spacing. -->
      <nav class="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-4" :class="isDark ? 'nav-dark' : ''">
        <div v-for="(group, gIndex) in visibleGroups" :key="gIndex" :class="gIndex > 0 ? 'mt-3.5' : ''">
          <NuxtLink v-for="item in group" :key="item.path" :to="item.path"
            class="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-[10px] text-sm transition-colors duration-150"
            :class="railCollapsed && !isMobile ? 'lg:justify-center' : ''"
            :title="railCollapsed && !isMobile ? item.label : null" :style="navStyle(item.path)"
            @click="closeSidebar" @mouseenter="hoveredPath = item.path" @mouseleave="hoveredPath = null">
            <span
              class="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 transition-colors duration-150"
              :style="{ background: isActive(item.path) ? '#1565C0' : 'transparent' }">
              <AssetIcon :name="item.icon" :size="14"
                :style="{ color: isActive(item.path) ? '#ffffff' : 'currentColor' }" />
            </span>
            <span v-if="showLabels" class="flex-1 font-medium whitespace-nowrap">{{ item.label }}</span>
          </NuxtLink>
        </div>
      </nav>

      <!--
        Account block.

        The donor portal puts this in a top-bar dropdown. The admin console has
        no per-page chrome competing for that corner, so the same vocabulary —
        #1565C0 avatar, initial fallback, name over access level — sits at the
        foot of the rail instead. Collapses to the avatar alone at 80px, where a
        dropdown would have nothing to align against.
      -->
      <div ref="profileRoot" class="relative flex-shrink-0 px-3 pt-2.5 pb-3.5 border-t dark:border-slate-700"
        :style="{ borderColor: SIDEBAR_BORDER }">
        <button type="button"
          class="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl border border-transparent transition-colors hover:bg-white dark:hover:bg-slate-800"
          :class="railCollapsed && !isMobile ? 'lg:justify-center lg:px-0' : ''"
          :title="railCollapsed && !isMobile ? user?.full_name : null" :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen">
          <span class="relative flex-shrink-0">
            <span
              class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] text-white overflow-hidden"
              style="background:#1565C0">
              {{ initial }}
            </span>

            <span v-if="user?.is_super_admin"
              class="absolute -top-0.5 -right-0.5 rounded-full p-0.5 flex" :style="{ background: SIDEBAR_BG }"
              title="Unrestricted administrator">
              <AssetIcon name="badge-check" :size="12" class="text-[#0052FF]" />
            </span>
          </span>

          <span v-if="showLabels" class="flex-1 min-w-0 flex flex-col gap-0.5 text-left">
            <span class="text-[13px] font-bold truncate" :style="{ color: SIDEBAR_HEADING_TEXT }">
              {{ user?.full_name || 'Administrator' }}
            </span>
            <span class="text-[11px] truncate" :style="{ color: SIDEBAR_IDLE_TEXT }">
              {{ adminRoleLabel(user?.admin_role) }}
            </span>
          </span>

          <AssetIcon v-if="showLabels" name="chevron-down" :size="14"
            class="text-[#94a3b8] flex-shrink-0 transition-transform duration-150"
            :class="{ 'rotate-180': menuOpen }" />
        </button>

        <Transition name="popup">
          <div v-if="menuOpen"
            class="absolute left-3 right-3 bottom-[calc(100%-4px)] rounded-xl overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-700 shadow-lg z-20"
            style="border-color:#eef1f5">
            <div class="flex items-start gap-3 px-4 py-3.5 border-b dark:border-slate-700" style="border-color:#eef1f5">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white overflow-hidden flex-shrink-0"
                style="background:#1565C0">
                {{ initial }}
              </div>

              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold truncate text-gray-900 dark:text-slate-100">
                  {{ user?.full_name || 'Administrator' }}
                </p>
                <p class="text-xs truncate text-gray-500 dark:text-slate-400">{{ user?.email }}</p>
                <p class="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold text-[#1565C0] dark:text-[#64B5F6]">
                  <AssetIcon name="shield-check" :size="14" />
                  {{ adminRoleLabel(user?.admin_role) }}
                </p>
              </div>
            </div>

            <div class="border-t dark:border-slate-700 py-2" style="border-color:#eef1f5">
              <button type="button"
                class="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                style="color:#D32F2F" :disabled="loggingOut" @click="handleLogout">
                <AssetIcon name="log-out" :size="16" />
                <span>{{ loggingOut ? 'Logging out…' : 'Log Out' }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </aside>
  </div>
</template>

<script setup>
/*
 * Super Admin rail.
 *
 * Behaviour is deliberately identical to the donor sidebar — collapsed to 80px
 * on desktop and widened on hover, with the layout still reserving the narrow
 * width so the expanded rail floats over the page instead of reflowing it, and
 * a full drawer below 1024px. `useSidebar()` is shared with the donor build on
 * purpose: it is generic rail state, not donor-facing UI.
 *
 * Navigation is filtered by privilege. This is presentation only — every route
 * behind these links is re-checked by `can:` middleware on the server — but
 * without it a Verification Officer would see an Organizations link that 403s
 * the moment it loads.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logo from '~/assets/images/RedAgosLogo.png'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { useUser } from '~/composables/useUser'
import { useSidebar } from '~/composables/useSidebar.js'

const { collapsed, hoverExpanded, expandOnHover, collapseOnHover, mobileOpen, closeMobile } = useSidebar()
const { user, logout } = useUser()

const route = useRoute()
const router = useRouter()

const isDark = ref(false)
let themeObserver = null

const isMobile = ref(false)
let mobileMql = null

const menuOpen = ref(false)
const profileRoot = ref(null)
const loggingOut = ref(false)
const hoveredPath = ref(null)

const updateIsMobile = (event) => {
  isMobile.value = event ? event.matches : mobileMql.matches
  // Dropping to drawer widths with a hover still latched would leave the rail
  // stuck open when the viewport goes back up.
  if (isMobile.value) collapseOnHover()
}

function onDocumentClick(event) {
  if (!menuOpen.value) return
  if (profileRoot.value?.contains(event.target)) return
  menuOpen.value = false
}

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  themeObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  mobileMql = window.matchMedia('(max-width: 1023px)')
  isMobile.value = mobileMql.matches
  mobileMql.addEventListener('change', updateIsMobile)

  document.addEventListener('click', onDocumentClick, true)
})

onUnmounted(() => {
  themeObserver?.disconnect()
  mobileMql?.removeEventListener('change', updateIsMobile)
  document.removeEventListener('click', onDocumentClick, true)
})

const railCollapsed = computed(() => collapsed.value && !hoverExpanded.value)
const showLabels = computed(() => isMobile.value || !railCollapsed.value)

// A menu anchored to an 80px rail would have nothing to line up against.
watch(railCollapsed, (isRail) => {
  if (isRail && !isMobile.value) menuOpen.value = false
})

const handleSidebarEnter = () => {
  if (!isMobile.value) expandOnHover()
}

const handleSidebarLeave = () => {
  if (!isMobile.value) collapseOnHover()
}

// Light/dark theme tokens — same values as the donor rail.
const SIDEBAR_BG = computed(() => (isDark.value ? '#0F172A' : '#F7F8FA'))
const SIDEBAR_BORDER = computed(() => (isDark.value ? '#334155' : '#E5EAF0'))
const SIDEBAR_ACTIVE_BG = computed(() => (isDark.value ? '#42A5F529' : '#1565C014'))
const SIDEBAR_ACTIVE_TEXT = computed(() => (isDark.value ? '#64B5F6' : '#1565C0'))
const SIDEBAR_IDLE_TEXT = computed(() => (isDark.value ? '#94A3B8' : '#64748B'))
const SIDEBAR_HEADING_TEXT = computed(() => (isDark.value ? '#F1F5F9' : '#1f2937'))
const sidebarShadow = computed(() =>
  isDark.value
    ? `1px 0 0 ${SIDEBAR_BORDER.value}, 4px 0 24px rgba(0,0,0,0.35)`
    : `1px 0 0 ${SIDEBAR_BORDER.value}, 4px 0 24px rgba(15,23,42,0.04)`
)

const initial = computed(() => user.value?.full_name?.charAt(0) || 'A')

/*
 * `requires` names the privilege the page's endpoints are guarded by. An item
 * with none is reachable by any admin — the dashboard degrades to whatever the
 * account can actually read rather than being gated wholesale.
 */
const navGroups = [
  [
    { label: 'Dashboard', path: '/admin/dashboard', icon: 'layout-dashboard' },
  ],
  [
    { label: 'Organizations', path: '/admin/facilities', icon: 'building-2', requires: 'admin.facility.manage' },
    { label: 'ID Verification', path: '/admin/donor-identities', icon: 'id-card', requires: 'admin.donor_identity.verify' },
  ],
  [
    { label: 'Administrators', path: '/admin/administrators', icon: 'shield-check', requires: 'admin.accounts.manage' },
  ],
]

const visibleGroups = computed(() => {
  const held = user.value?.permissions ?? []

  return navGroups
    .map((group) => group.filter((item) => !item.requires || held.includes(item.requires)))
    .filter((group) => group.length > 0)
})

const isActive = (path) => {
  const current = route.path.replace(/\/$/, '')
  const target = path.replace(/\/$/, '')

  if (target === '/admin/dashboard') {
    return current === '/admin/dashboard' || current === '/admin'
  }

  return current === target || current.startsWith(`${target}/`)
}

const navStyle = (path) => {
  const active = isActive(path)
  const hovered = hoveredPath.value === path

  return {
    background: active || hovered ? SIDEBAR_ACTIVE_BG.value : 'transparent',
    color: active || hovered ? SIDEBAR_ACTIVE_TEXT.value : SIDEBAR_IDLE_TEXT.value,
    fontWeight: active ? '700' : '500',
  }
}

const closeSidebar = () => {
  closeMobile()
}

const goToDashboard = async () => {
  if (route.path === '/admin/dashboard') return
  closeSidebar()
  await router.push('/admin/dashboard')
}

const handleLogout = async () => {
  if (loggingOut.value) return
  loggingOut.value = true
  menuOpen.value = false

  try {
    await logout('/auth/admin/login')
  } catch (error) {
    console.error('Logout error:', error)
    loggingOut.value = false
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

aside {
  position: fixed;
  will-change: width, transform;
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

@media (hover: none) {
  nav a:active {
    background: rgba(21, 101, 192, 0.08) !important;
    color: #1565c0 !important;
  }
}
</style>
