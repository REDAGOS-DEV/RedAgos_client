<template>
  <div>
    <!--
      Mobile overlay. The trigger that opens the drawer lives in the layout
      header now, not floating over the page: a fixed button at top-4 left-4
      forced the header to carry a `pl-16` gutter at every breakpoint, which is
      what pushed the desktop breadcrumb out of alignment with the rail.
    -->
    <Transition name="scrim">
      <div v-if="mobileOpen" class="lg:hidden fixed inset-0 z-40 bg-slate-900/50" @click="closeMobile" />
    </Transition>

    <aside
      aria-label="Blood Center navigation"
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
        pixels adrift, which is what the old pt-3/pb-3 did.
      -->
      <div
        class="brand px-5 h-14 sm:h-16 flex items-center gap-3 border-b flex-shrink-0 transition-colors duration-150 cursor-pointer select-none"
        :class="railCollapsed && !isMobile ? 'lg:justify-center lg:px-0' : ''"
        :style="{ borderColor: SIDEBAR_BORDER }"
        role="link"
        tabindex="0"
        :aria-label="'RedAgos — go to ' + homeLabel"
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
            {{ portalLabel }}
          </p>
        </div>
      </div>

      <!-- Navigation -->
      <nav
        class="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-3 pb-4"
        :class="[isDark ? 'nav-dark' : '', railCollapsed && !isMobile ? 'nav-rail' : '']">
        <template v-for="(group, gIndex) in navGroups" :key="group.label || gIndex">
          <!--
            A collapsed rail has no room for a group heading, so the groups are
            separated by a rule instead. Group collapsing is therefore only
            honoured while the labels are readable — hiding icons behind a
            heading nobody can see would strand the pages under it.
          -->
          <div v-if="!showLabels" class="group-rule" :class="gIndex === 0 ? 'is-first' : ''"
            :style="{ background: SIDEBAR_BORDER }" />

          <button v-else-if="group.label" type="button"
            class="group-header w-full flex items-center justify-between gap-1.5 px-3 py-1 mb-1 rounded-md transition-colors"
            :class="gIndex === 0 ? 'mt-1' : 'mt-4'"
            :style="{ color: SIDEBAR_IDLE_TEXT }"
            :aria-expanded="!isGroupCollapsed(group.label)"
            @click="toggleGroup(group.label)">
            <span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
              <span class="w-3 h-[2px] rounded-full flex-shrink-0"
                :style="{ background: isDark ? '#475569' : '#CBD5E1' }" />
              {{ group.label }}
              <!-- Dot indicator when a collapsed group hides something pending -->
              <span v-if="isGroupCollapsed(group.label) && groupHasBadge(group)"
                class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background: #D32F2F" />
            </span>
            <AssetIcon name="chevron-down" :size="12" class="flex-shrink-0 transition-transform duration-200"
              :class="isGroupCollapsed(group.label) ? '-rotate-90' : ''" />
          </button>

          <div v-show="!showLabels || !isGroupCollapsed(group.label)">
            <NuxtLink v-for="item in group.items" :key="item.path" :to="item.path"
              class="nav-item flex items-center gap-3 px-3 py-2.5 mb-1 rounded-[10px] text-sm transition-colors duration-150"
              :class="railCollapsed && !isMobile ? 'lg:justify-center lg:px-0' : ''"
              :title="railCollapsed && !isMobile ? item.label : null"
              :aria-current="isActive(item.path) ? 'page' : null"
              :style="navStyle(item.path)"
              @click="closeMobile"
              @mouseenter="hoveredPath = item.path"
              @mouseleave="hoveredPath = null">
              <span
                class="relative flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 transition-colors duration-150"
                :style="{ background: isActive(item.path) ? '#1565C0' : 'transparent' }">
                <AssetIcon :name="item.icon" :size="14"
                  :style="{ color: isActive(item.path) ? '#ffffff' : 'currentColor' }" />
                <!-- A count pill does not fit the rail, so it becomes a dot -->
                <span v-if="!showLabels && item.badge && badgeCounts[item.badge]"
                  class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  :style="{
                    background: item.badge === 'urgent' ? '#D32F2F' : '#F57C00',
                    boxShadow: '0 0 0 2px ' + SIDEBAR_BG
                  }" />
              </span>

              <span v-if="showLabels" class="flex-1 min-w-0 truncate whitespace-nowrap">{{ item.label }}</span>

              <span v-if="showLabels && item.badge && badgeCounts[item.badge]"
                class="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
                :style="badgeStyle(item.badge)">
                {{ badgeCounts[item.badge] > 99 ? '99+' : badgeCounts[item.badge] }}
              </span>
            </NuxtLink>
          </div>
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
import { useSidebar } from '~/composables/useSidebar.js'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { departmentHome } from '~/composables/useBloodCenterNav'

const {
  hoverExpanded,
  railExpanded,
  expandOnHover,
  collapseOnHover,
  mobileOpen,
  closeMobile
} = useSidebar('blood-center')

const route = useRoute()
const router = useRouter()
const { user, ensureUser } = useUser()

// --- Dark mode awareness ---
const isDark = ref(false)
let themeObserver = null

// --- Viewport awareness ---
// Below lg the sidebar is a drawer, so hover must not apply there at all.
const isMobile = ref(false)
let mobileMql = null

const onViewportChange = (e) => {
  isMobile.value = e.matches
  // Dropping to drawer widths with a hover still latched would leave the rail
  // — and the content padding that tracks it — stuck open on the way back up.
  if (isMobile.value) collapseOnHover()
}

/** The rail's visual state: collapsed unless hovered, or unless it is a drawer. */
const railCollapsed = computed(() => !railExpanded.value)

/** Whether labels/text should render at all. */
const showLabels = computed(() => isMobile.value || railExpanded.value)

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
  if (mobileOpen.value) closeMobile()
  else if (hoverExpanded.value) collapseOnHover()
}

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  themeObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  mobileMql = window.matchMedia('(max-width: 1023px)')
  isMobile.value = mobileMql.matches
  mobileMql.addEventListener('change', onViewportChange)
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  clearTimeout(leaveTimer)
  themeObserver?.disconnect()
  mobileMql?.removeEventListener('change', onViewportChange)
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

// Light/dark theme tokens — the same palette the donor rail uses, so the two
// portals read as one product rather than two.
const SIDEBAR_BG = computed(() => (isDark.value ? '#0F172A' : '#F7F8FA'))
const SIDEBAR_BORDER = computed(() => (isDark.value ? '#334155' : '#E5EAF0'))
const SIDEBAR_ACTIVE_BG = computed(() => (isDark.value ? 'rgba(66,165,245,0.16)' : 'rgba(21,101,192,0.08)'))
const SIDEBAR_HOVER_BG = computed(() => (isDark.value ? 'rgba(148,163,184,0.12)' : 'rgba(21,101,192,0.06)'))
const SIDEBAR_ACTIVE_TEXT = computed(() => (isDark.value ? '#64B5F6' : '#1565C0'))
const SIDEBAR_IDLE_TEXT = computed(() => (isDark.value ? '#94A3B8' : '#64748B'))
const SIDEBAR_HEADING_TEXT = computed(() => (isDark.value ? '#F1F5F9' : '#1F2937'))
const sidebarShadow = computed(() =>
  isDark.value
    ? '1px 0 0 ' + SIDEBAR_BORDER.value + ', 4px 0 24px rgba(0,0,0,0.35)'
    : '1px 0 0 ' + SIDEBAR_BORDER.value + ', 4px 0 24px rgba(15,23,42,0.04)'
)

const portalLabel = computed(() => user.value?.facility?.facility_name || 'Blood Center')

// // Dev note: pending/urgent counts naka-fetch sa blood center dashboard summary endpoint
const badgeCounts = ref({ pending: 0, urgent: 0, notifications: 0 })

const badgeStyle = (badge) => {
  const urgent = badge === 'urgent'
  return {
    background: urgent
      ? (isDark.value ? 'rgba(239,83,80,0.18)' : 'rgba(211,47,47,0.10)')
      : (isDark.value ? '#334155' : '#F1F5F9'),
    color: urgent
      ? (isDark.value ? '#EF9A9A' : '#D32F2F')
      : SIDEBAR_IDLE_TEXT.value
  }
}

// Ang nav definition kay usa ra ka lugar na — tan-awa ang
// useBloodCenterNav(). Gi-filter na daan sumala sa department permissions sa
// naka-login, so ang sidebar dili na mo-decide og kinsa makakita og unsa.
const { navGroups } = useBloodCenterNav()

// --- Collapsible groups ---
// Naka-default open tanan group; i-toggle per label pag naay click sa header
const collapsedGroups = ref({})

const toggleGroup = (label) => {
  if (!label) return
  collapsedGroups.value[label] = !collapsedGroups.value[label]
}

const isGroupCollapsed = (label) => {
  if (!label) return false
  return !!collapsedGroups.value[label]
}

/** True when a group holds an item with a live count — drives the collapsed dot. */
const groupHasBadge = (group) => {
  return group.items.some((item) => item.badge && badgeCounts.value[item.badge] > 0)
}

const loadUser = async () => {
  try {
    // ensureUser() mo-reuse sa fetch nga gi-sugdan sa department middleware
    // imbes mo-fire og bag-o.
    await ensureUser()
    // // Dev note: i-connect ni sa /blood-center/dashboard-summary endpoint para sa pending/urgent/notifications badge count
    const summary = await bloodCenterService.dashboardSummary?.()
    if (summary) {
      badgeCounts.value.pending = summary.pending_requests || 0
      badgeCounts.value.urgent = summary.urgent_requests || 0
      badgeCounts.value.notifications = summary.unread_notifications || 0
    }
  } catch (err) {
    console.error(err)
  }
}

onMounted(loadUser)

const hoveredPath = ref(null)

// Lowercase na ang tanan page file, so exact comparison na. Kaniadto
// case-insensitive ni tungod sa Dashboard.vue → /blood-center/Dashboard.
const isActive = (path) => route.path.replace(/\/$/, '') === path.replace(/\/$/, '')

const navStyle = (path) => {
  const active = isActive(path)
  const hovered = hoveredPath.value === path

  let background = 'transparent'
  if (active) background = SIDEBAR_ACTIVE_BG.value
  else if (hovered) background = SIDEBAR_HOVER_BG.value

  return {
    background,
    color: active || hovered ? SIDEBAR_ACTIVE_TEXT.value : SIDEBAR_IDLE_TEXT.value,
    fontWeight: active ? '700' : '500'
  }
}

/*
 * The brand row goes to whatever this user's landing page actually is. It used
 * to be inert; sending everyone to the overview would bounce any staff member
 * who does not hold `reports.view_all`.
 */
const homePath = computed(() => departmentHome(user.value))
const homeLabel = computed(() => (homePath.value === '/blood-center/dashboard' ? 'the overview' : 'your dashboard'))
const navigatingHome = ref(false)

const goHome = async () => {
  if (route.path === homePath.value || navigatingHome.value) return
  navigatingHome.value = true
  closeMobile()
  try {
    await router.push(homePath.value)
  } finally {
    navigatingHome.value = false
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

/* Divider standing in for the group heading while the rail is collapsed. */
.group-rule {
  height: 1px;
  margin: 10px 12px;
  border-radius: 999px;
}

.group-rule.is-first {
  display: none;
}

.group-header:hover {
  background: rgba(100, 116, 139, 0.08);
}

/*
 * The focus ring reads its colour from the token rather than a second
 * :global(.dark) rule. This build's scoped-CSS transform drops the descendant
 * half of `:global(.dark) .x` and emits a bare `.dark { … }`, which puts the
 * declaration on <html> instead — the trap bloodrequests.vue already warns
 * about. The token flips on its own, so no second rule is needed.
 */
.brand:focus-visible,
.nav-item:focus-visible,
.group-header:focus-visible {
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
 * rail takes its 5px off the content box, so the centred icons rendered 2.5px
 * left of centre while the brand mark above them — which sits outside this
 * scroller — stayed on 40px. The nav still scrolls; it just does not reserve
 * the gutter at a width where losing it is visible.
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
  .scrim-leave-active {
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
