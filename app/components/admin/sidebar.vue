<template>
  <div>
    <!--
      Mobile overlay. The trigger that opens the drawer lives in the layout
      header, not floating over the page, so the header needs no permanent
      left gutter to clear it at desktop widths.
    -->
    <Transition name="scrim">
      <div v-if="mobileOpen" class="lg:hidden fixed inset-0 z-40 bg-slate-900/50" @click="closeMobile" />
    </Transition>

    <aside
      aria-label="Super Admin navigation"
      class="sidebar fixed top-0 left-0 h-screen z-50 flex flex-col overflow-hidden w-[272px] lg:translate-x-0"
      :class="[
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        railCollapsed ? 'lg:w-20' : 'lg:w-64'
      ]"
      :style="{ background: SIDEBAR_BG, boxShadow: sidebarShadow }"
      @mouseenter="handleSidebarEnter"
      @mouseleave="handleSidebarLeave"
      @focusin="handleSidebarEnter"
      @focusout="handleSidebarLeave">

      <!-- Close button (mobile drawer only) -->
      <button
        class="lg:hidden absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Close menu"
        :style="{ color: SIDEBAR_IDLE_TEXT }"
        @click="closeMobile">
        <AssetIcon name="x" :size="18" />
      </button>

      <!--
        The brand row is height-matched to the topbar (h-14 / sm:h-16) so the
        sidebar's divider lines up with the header's instead of sitting a few
        pixels adrift.
      -->
      <div
        class="brand px-5 h-14 sm:h-16 flex items-center gap-3 border-b flex-shrink-0 transition-colors duration-150 cursor-pointer select-none"
        :class="railCollapsed && !isMobile ? 'lg:justify-center lg:px-0' : ''"
        :style="{ borderColor: SIDEBAR_BORDER }"
        role="link"
        tabindex="0"
        aria-label="RedAgos — go to the dashboard"
        @click="goHome"
        @keydown.enter.prevent="goHome"
        @keydown.space.prevent="goHome">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative"
          style="background: #1565C0">
          <img v-if="!navigatingHome" :src="logo" alt="RedAgos" class="logo-image">
          <span v-else class="logo-spinner" />
        </div>

        <div v-if="showLabels" class="min-w-0 whitespace-nowrap">
          <h1 class="font-extrabold text-base leading-none" :style="{ color: SIDEBAR_HEADING_TEXT }">
            Red<span style="color:#D32F2F">Agos</span>
          </h1>
          <p class="text-[11px] mt-0.5 truncate" :style="{ color: SIDEBAR_IDLE_TEXT }">
            Super Admin
          </p>
        </div>
      </div>

      <!--
        Navigation. The clusters carry no headings, so they are separated by
        spacing while the labels are readable and by a rule once the rail is
        collapsed — at 80px the vertical gap alone is too weak to read as a
        break.
      -->
      <nav
        class="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-3 pb-4"
        :class="[isDark ? 'nav-dark' : '', railCollapsed && !isMobile ? 'nav-rail' : '']">
        <template v-for="(group, gIndex) in visibleGroups" :key="gIndex">
          <div v-if="!showLabels" class="group-rule" :class="gIndex === 0 ? 'is-first' : ''"
            :style="{ background: SIDEBAR_BORDER }" />

          <div :class="showLabels && gIndex > 0 ? 'mt-3.5' : ''">
            <NuxtLink v-for="item in group" :key="item.path" :to="item.path"
              class="nav-item flex items-center gap-3 px-3 py-2.5 mb-1 rounded-[10px] text-sm transition-colors duration-150"
              :class="railCollapsed && !isMobile ? 'lg:justify-center lg:px-0' : ''"
              :title="railCollapsed && !isMobile ? item.label : null"
              :aria-current="isActive(item.path) ? 'page' : null"
              :style="navStyle(item.path)"
              @click="closeMobile"
              @mouseenter="hoveredPath = item.path"
              @mouseleave="hoveredPath = null">
              <span
                class="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 transition-colors duration-150"
                :style="{ background: isActive(item.path) ? '#1565C0' : 'transparent' }">
                <AssetIcon :name="item.icon" :size="14"
                  :style="{ color: isActive(item.path) ? '#ffffff' : 'currentColor' }" />
              </span>

              <span v-if="showLabels" class="flex-1 min-w-0 truncate whitespace-nowrap">{{ item.label }}</span>
            </NuxtLink>
          </div>
        </template>
      </nav>

      <!--
        Account block.

        The donor and blood-centre portals put this in a top-bar dropdown. The
        admin console has no per-page chrome competing for that corner, so the
        same vocabulary — #1565C0 avatar, initial fallback, name over access
        level — sits at the foot of the rail instead. Collapses to the avatar
        alone at 80px, where a dropdown would have nothing to align against.
      -->
      <div ref="profileRoot" class="relative flex-shrink-0 px-3 pt-2.5 pb-3.5 border-t"
        :style="{ borderColor: SIDEBAR_BORDER }">
        <button type="button"
          class="account-btn flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl border border-transparent transition-colors"
          :class="railCollapsed && !isMobile ? 'lg:justify-center lg:px-0' : ''"
          :title="railCollapsed && !isMobile ? user?.full_name : null"
          :aria-expanded="menuOpen"
          aria-haspopup="menu"
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
            class="flex-shrink-0 transition-transform duration-150"
            :class="{ 'rotate-180': menuOpen }"
            :style="{ color: SIDEBAR_IDLE_TEXT }" />
        </button>

        <Transition name="popup">
          <!--
            Surface and border are bound rather than written as `dark:` classes
            beside a hard-coded inline colour: an inline `border-color` outranks
            the variant, which is what pinned this popup's border to the light
            #EEF1F5 in dark mode.
          -->
          <div v-if="menuOpen"
            class="absolute left-3 right-3 bottom-[calc(100%-4px)] rounded-xl overflow-hidden border shadow-lg z-20"
            :style="{ background: SIDEBAR_POPUP_BG, borderColor: SIDEBAR_BORDER }">
            <div class="flex items-start gap-3 px-4 py-3.5 border-b" :style="{ borderColor: SIDEBAR_BORDER }">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white overflow-hidden flex-shrink-0"
                style="background:#1565C0">
                {{ initial }}
              </div>

              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold truncate" :style="{ color: SIDEBAR_HEADING_TEXT }">
                  {{ user?.full_name || 'Administrator' }}
                </p>
                <p class="text-xs truncate" :style="{ color: SIDEBAR_IDLE_TEXT }">
                  {{ user?.email }}
                </p>
                <p class="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold"
                  :style="{ color: SIDEBAR_ACTIVE_TEXT }">
                  <AssetIcon name="shield-check" :size="14" />
                  {{ adminRoleLabel(user?.admin_role) }}
                </p>
              </div>
            </div>

            <div class="py-2">
              <button type="button"
                class="logout-btn flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-colors"
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
 * Behaviour matches the blood-centre rail: collapsed to 80px on desktop and
 * widened on hover, with the layout *reflowing* the content column beside it
 * rather than letting the widened rail float over the page, and a full drawer
 * below 1024px.
 *
 * `useSidebar('admin')` takes its own namespace. The admin build used to share
 * the donor bucket, so opening the donor drawer and coming back left this rail
 * holding a hover the admin user never made — and now that the layout tracks
 * the rail's width, that stale state would reflow the page with it.
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

const {
  hoverExpanded,
  railExpanded,
  expandOnHover,
  collapseOnHover,
  mobileOpen,
  closeMobile
} = useSidebar('admin')

const { user, logout } = useUser()

const route = useRoute()
const router = useRouter()

// --- Dark mode awareness ---
const isDark = ref(false)
let themeObserver = null

// --- Viewport awareness ---
// Below lg the sidebar is a drawer, so hover must not apply there at all.
const isMobile = ref(false)
let mobileMql = null

const menuOpen = ref(false)
const profileRoot = ref(null)
const loggingOut = ref(false)
const hoveredPath = ref(null)
const navigatingHome = ref(false)

/** The rail's visual state: collapsed unless hovered, or unless it is a drawer. */
const railCollapsed = computed(() => !railExpanded.value)

/** Whether labels/text should render at all. */
const showLabels = computed(() => isMobile.value || railExpanded.value)

const updateIsMobile = (event) => {
  isMobile.value = event ? event.matches : mobileMql.matches
  // Dropping to drawer widths with a hover still latched would leave the rail
  // — and the content padding that tracks it — stuck open on the way back up.
  if (isMobile.value) collapseOnHover()
}

/*
 * Leaving is deferred by a beat. Without it a pointer crossing the rail's own
 * edge — which moves out from under the cursor as the sidebar widens and the
 * content reflows — can fire leave/enter in quick succession and flicker.
 */
let leaveTimer = null

const handleSidebarEnter = () => {
  if (isMobile.value) return
  clearTimeout(leaveTimer)
  expandOnHover()
}

const handleSidebarLeave = () => {
  if (isMobile.value) return
  clearTimeout(leaveTimer)
  leaveTimer = setTimeout(collapseOnHover, 120)
}

const handleEscape = (e) => {
  if (e.key !== 'Escape') return
  if (menuOpen.value) menuOpen.value = false
  else if (mobileOpen.value) closeMobile()
  else if (hoverExpanded.value) collapseOnHover()
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
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  clearTimeout(leaveTimer)
  themeObserver?.disconnect()
  mobileMql?.removeEventListener('change', updateIsMobile)
  document.removeEventListener('click', onDocumentClick, true)
  window.removeEventListener('keydown', handleEscape)
  if (typeof document !== 'undefined') document.body.style.removeProperty('overflow')
})

// The drawer covers the page; letting the page scroll under it is what makes a
// mobile menu feel broken.
watch(mobileOpen, (open) => {
  if (typeof document === 'undefined') return
  if (open) document.body.style.setProperty('overflow', 'hidden')
  else document.body.style.removeProperty('overflow')
})

// A menu anchored to an 80px rail would have nothing to line up against.
watch(railCollapsed, (isRail) => {
  if (isRail && !isMobile.value) menuOpen.value = false
})

// Light/dark theme tokens — the same palette the donor and blood-centre rails
// use, so the three portals read as one product rather than three.
const SIDEBAR_BG = computed(() => (isDark.value ? '#0F172A' : '#F7F8FA'))
const SIDEBAR_BORDER = computed(() => (isDark.value ? '#334155' : '#E5EAF0'))
const SIDEBAR_ACTIVE_BG = computed(() => (isDark.value ? 'rgba(66,165,245,0.16)' : 'rgba(21,101,192,0.08)'))
const SIDEBAR_HOVER_BG = computed(() => (isDark.value ? 'rgba(148,163,184,0.12)' : 'rgba(21,101,192,0.06)'))
const SIDEBAR_ACTIVE_TEXT = computed(() => (isDark.value ? '#64B5F6' : '#1565C0'))
const SIDEBAR_IDLE_TEXT = computed(() => (isDark.value ? '#94A3B8' : '#64748B'))
const SIDEBAR_HEADING_TEXT = computed(() => (isDark.value ? '#F1F5F9' : '#1F2937'))
// --rb-surface, so the popup lifts off the #0F172A rail instead of blending
// into it the way a slate-900 panel did.
const SIDEBAR_POPUP_BG = computed(() => (isDark.value ? '#1E293B' : '#FFFFFF'))
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

  let background = 'transparent'
  if (active) background = SIDEBAR_ACTIVE_BG.value
  else if (hovered) background = SIDEBAR_HOVER_BG.value

  return {
    background,
    color: active || hovered ? SIDEBAR_ACTIVE_TEXT.value : SIDEBAR_IDLE_TEXT.value,
    fontWeight: active ? '700' : '500',
  }
}

const goHome = async () => {
  if (route.path === '/admin/dashboard' || navigatingHome.value) return
  navigatingHome.value = true
  closeMobile()
  try {
    await router.push('/admin/dashboard')
  } finally {
    navigatingHome.value = false
  }
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
/*
 * Width and transform are the only animated properties, and they share the
 * layout's 200ms/ease-out so the rail and the content padding that tracks it
 * move as one. Animating anything that repaints the whole nav during the same
 * window is what makes a hover rail read as flicker.
 */
.sidebar {
  will-change: width, transform;
  transition: width 200ms ease-out, transform 200ms ease-out;
}

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
  to { transform: rotate(360deg); }
}

/* Divider standing in for the cluster gap while the rail is collapsed. */
.group-rule {
  height: 1px;
  margin: 10px 12px;
  border-radius: 999px;
}

.group-rule.is-first {
  display: none;
}

.account-btn:hover {
  background: rgba(100, 116, 139, 0.10);
}

.logout-btn:hover {
  background: rgba(211, 47, 47, 0.08);
}

/*
 * The focus ring reads its colour from the token rather than a second
 * :global(.dark) rule. This build's scoped-CSS transform drops the descendant
 * half of `:global(.dark) .x` and emits a bare `.dark { … }`, which puts the
 * declaration on <html> instead. The token flips on its own, so no second rule
 * is needed.
 */
.brand:focus-visible,
.nav-item:focus-visible,
.account-btn:focus-visible,
.logout-btn:focus-visible {
  outline: 2px solid var(--rb-primary-text);
  outline-offset: -2px;
}

/* Sidebar navigation scrollbar */
nav {
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

/*
 * No scrollbar gutter while the rail is collapsed. A 5px track inside an 80px
 * rail takes its 5px off the content box, so the centred icons render 2.5px
 * left of centre while the brand mark above them — which sits outside this
 * scroller — stays on 40px.
 */
.nav-rail {
  scrollbar-width: none;
}

.nav-rail::-webkit-scrollbar {
  width: 0;
  height: 0;
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

.scrim-enter-active,
.scrim-leave-active {
  transition: opacity 200ms ease;
}

.scrim-enter-from,
.scrim-leave-to {
  opacity: 0;
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

/* Touch devices get a pressed state instead of a hover that never ends. */
@media (hover: none) {
  .nav-item {
    transition: background 0.1s ease, color 0.1s ease;
  }

  .nav-item:active {
    background: rgba(21, 101, 192, 0.10) !important;
    color: #1565C0 !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .scrim-enter-active,
  .scrim-leave-active,
  .popup-enter-active,
  .popup-leave-active {
    transition: none;
  }

  .logo-spinner {
    animation: none;
  }
}

a, button {
  touch-action: manipulation;
}
</style>
