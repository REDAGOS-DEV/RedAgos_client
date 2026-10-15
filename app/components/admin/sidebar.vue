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
        railCollapsed ? 'lg:w-[72px]' : 'lg:w-64'
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
        class="brand px-4 h-14 sm:h-16 flex items-center gap-3 border-b flex-shrink-0 overflow-hidden transition-colors duration-150 cursor-pointer select-none"
        :style="{ borderColor: SIDEBAR_BORDER }"
        role="link"
        tabindex="0"
        aria-label="RedAgos — go to the dashboard"
        @click="goHome"
        @keydown.enter.prevent="goHome"
        @keydown.space.prevent="goHome">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative"
          style="background: var(--rb-primary)">
          <img v-if="!navigatingHome" :src="logo" alt="RedAgos" class="logo-image">
          <span v-else class="logo-spinner" />
        </div>

        <div class="label min-w-0 whitespace-nowrap" :class="{ 'label--hidden': !showLabels }">
          <h1 class="font-extrabold text-base leading-none" :style="{ color: SIDEBAR_HEADING_TEXT }">
            Red<span style="color:#D32F2F">Agos</span>
          </h1>
          <p class="text-[12px] mt-0.5 truncate" :style="{ color: SIDEBAR_IDLE_TEXT }">
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
        class="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-3 pb-4">
        <template v-for="(group, gIndex) in visibleGroups" :key="gIndex">
          <div v-if="!showLabels" class="group-rule" :class="gIndex === 0 ? 'is-first' : ''"
            :style="{ background: SIDEBAR_BORDER }" />

          <div :class="showLabels && gIndex > 0 ? 'mt-3.5' : ''">
            <NuxtLink v-for="item in group" :key="item.path" :to="item.path"
              class="nav-item"
              :class="{ 'is-current': isActive(item.path) }"
              :title="railCollapsed && !isMobile ? item.label : null"
              :aria-current="isActive(item.path) ? 'page' : null"
              :style="navStyle(item.path)"
              @click="closeMobile"
              @mouseenter="hoveredPath = item.path"
              @mouseleave="hoveredPath = null">
              <span class="icon-box">
                <AssetIcon :name="item.icon" :size="18" />
              </span>

              <span class="label flex-1 min-w-0 truncate" :class="{ 'label--hidden': !showLabels }">{{ item.label }}</span>
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
          class="account-btn flex items-center gap-2.5 w-full px-1.5 py-2 rounded-xl border border-transparent transition-colors overflow-hidden"
          :title="railCollapsed && !isMobile ? user?.full_name : null"
          :aria-expanded="menuOpen"
          aria-haspopup="menu"
          @click="menuOpen = !menuOpen">
          <span class="relative flex-shrink-0">
            <span
              class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] text-white overflow-hidden"
              style="background: var(--rb-primary)">
              {{ initial }}
            </span>

            <span v-if="user?.is_super_admin"
              class="absolute -top-0.5 -right-0.5 rounded-full p-0.5 flex" :style="{ background: SIDEBAR_BG }"
              title="Unrestricted administrator">
              <AssetIcon name="badge-check" :size="12" class="text-[#0052FF]" />
            </span>
          </span>

          <span class="label flex-1 min-w-0 flex flex-col gap-0.5 text-left" :class="{ 'label--hidden': !showLabels }">
            <span class="text-[13px] font-bold truncate" :style="{ color: SIDEBAR_HEADING_TEXT }">
              {{ user?.full_name || 'Administrator' }}
            </span>
            <span class="text-[11px] truncate" :style="{ color: SIDEBAR_IDLE_TEXT }">
              {{ adminRoleLabel(user?.admin_role) }}
            </span>
          </span>

          <AssetIcon name="chevron-down" :size="14"
            class="label flex-shrink-0 transition-transform duration-150"
            :class="{ 'rotate-180': menuOpen, 'label--hidden': !showLabels }"
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
                style="background: var(--rb-primary)">
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

// Light/dark theme tokens: the blood center rail's, so the portals read as one product.
const SIDEBAR_BG = computed(() => (isDark.value ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.55)'))
const SIDEBAR_BORDER = computed(() => (isDark.value ? '#334155' : '#E4E9F0'))
const SIDEBAR_CURRENT_BG = computed(() => (isDark.value ? 'color-mix(in srgb, var(--rb-primary-text) 14%, transparent)' : 'color-mix(in srgb, var(--rb-primary) 10%, white)'))
const SIDEBAR_HOVER_BG = computed(() => (isDark.value ? 'rgba(148,163,184,0.10)' : '#EEF1F5'))
const SIDEBAR_ACTIVE_TEXT = computed(() => (isDark.value ? 'var(--rb-primary-text)' : 'var(--rb-primary)'))
const SIDEBAR_IDLE_TEXT = computed(() => (isDark.value ? '#94A3B8' : '#64748B'))
const SIDEBAR_ROW_TEXT = computed(() => (isDark.value ? '#E2E8F0' : '#334155'))
const SIDEBAR_HEADING_TEXT = computed(() => (isDark.value ? '#F1F5F9' : '#1F2937'))
// --rb-surface, so the popup lifts off the glass rail.
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

// Current page: a soft pill, with the icon in a solid chip (see .is-current).
const navStyle = (path) => {
  if (isActive(path)) return { background: SIDEBAR_CURRENT_BG.value, color: SIDEBAR_ACTIVE_TEXT.value, fontWeight: '700' }
  return {
    background: hoveredPath.value === path ? SIDEBAR_HOVER_BG.value : 'transparent',
    color: SIDEBAR_ROW_TEXT.value,
    fontWeight: '600',
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
  /* Glass, like the blood center rail: the glow behind shows through. */
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  backdrop-filter: blur(18px) saturate(140%);
  will-change: width, transform;
  transition: width 200ms ease-out, transform 200ms ease-out;
}

/* ── Rows: the blood center rail's, icon on one axis, label clipped by the edge ── */
.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 9px 12px;
  margin-bottom: 2px;
  border-radius: 999px;
  font-size: var(--rb-fs-body);
  white-space: nowrap;
  overflow: hidden;
  text-decoration: none;
  transition: background-color 150ms ease, color 150ms ease;
}
.icon-box {
  position: relative;
  width: 28px;
  height: 28px;
  margin: -2px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
}
.is-current .icon-box {
  border-radius: 8px;
  background: var(--rb-primary);
  color: #FFFFFF;
  box-shadow: 0 4px 10px -4px rgba(var(--rb-primary-rgb), 0.7);
}
.label { transition: opacity 150ms ease; }
.label--hidden { opacity: 0; }

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

/* No scrollbar gutter: a track would push the icons off their axis. */
nav { scrollbar-width: none; }
nav::-webkit-scrollbar { width: 0; height: 0; }

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
    background: rgba(var(--rb-primary-rgb), 0.10) !important;
    color: var(--rb-primary) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .label,
  .nav-item,
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

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .sidebar { background: var(--rb-surface, #FFFFFF) !important; }
}
</style>
