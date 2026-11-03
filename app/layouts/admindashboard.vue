<template>
  <div>
    <AdminSidebar />

    <!--
      The content column tracks the rail's width instead of a fixed lg:pl-20.
      Padding — not a margin or a transform — because it is the one property
      that both reserves the space and reflows the children inside it, which is
      what keeps the widened sidebar beside the page rather than over it.
    -->
    <div class="content-shift" :class="railExpanded ? 'lg:pl-64' : 'lg:pl-[72px]'">
      <!--
        The other portals' bar (project owner, 2026-11-01). Desktop: it runs the
        full width above the sidebar, with the menu button and brand at its left
        edge on the rail's icon axis and the account on the right.
      -->
      <header
        class="topbar fixed top-0 left-0 right-0 z-30 lg:z-[60] h-14 sm:h-16 border-b"
        :style="{ boxShadow: headerShadow }">
        <div class="flex h-full w-full items-center justify-between gap-2 sm:gap-3 px-4 sm:px-6 lg:px-4">
          <!-- Left cluster: menu toggle, logo, wordmark and where this page sits -->
          <div class="flex items-center gap-2 min-w-0">
            <!--
              On desktop it opens the rail, which closes again when the pointer
              leaves it; below 1024px it opens the drawer. On the 36px icon axis.
            -->
            <button
              type="button"
              class="rail-toggle"
              data-rail-toggle
              :aria-expanded="railExpanded || mobileOpen"
              aria-controls="admin-sidebar"
              :aria-label="railExpanded ? 'Close menu' : 'Open menu'"
              @click="toggleMenu">
              <AssetIcon name="menu" :size="20" />
            </button>

            <NuxtLink to="/admin/dashboard" class="bc-logo" aria-label="RedAgos, go to the dashboard">
              <img :src="logo" alt="" class="bc-logo__img">
            </NuxtLink>

            <div class="brand-word">
              <NuxtLink to="/admin/dashboard" class="brand-word__name" tabindex="-1" aria-hidden="true">
                Red<span class="brand-word__accent">Agos</span>
              </NuxtLink>
              <span class="brand-word__tag lg:hidden">Super Admin</span>
              <nav class="brand-crumb hidden lg:block" aria-label="Breadcrumb" :title="`Super Admin / ${pageTitle}`">
                <ol>
                  <li>Super Admin</li>
                  <li aria-current="page">{{ pageTitle }}</li>
                </ol>
              </nav>
            </div>
          </div>

          <!-- Right cluster -->
          <div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              class="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#F1F5F9] dark:hover:bg-[color:var(--ink-hover,#334155)]"
              :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">
              <AssetIcon :name="isDark ? 'sun' : 'moon'" :size="18" class="text-[#64748b] dark:text-slate-300" />
            </button>

            <div class="hidden sm:block w-px h-5 mx-0.5 bg-[#EEF1F5] dark:bg-[color:var(--ink-border,#334155)]" />

            <!--
              The account menu, in the top bar like the other portals. Opens on
              hover with a mouse (closing after a short delay, so crossing the
              gap does not shut it); click, tap and the keyboard toggle it.
            -->
            <div ref="profileRoot" class="relative" @mouseenter="openMenuOnHover" @mouseleave="closeMenuOnHover">
              <button
                type="button"
                class="flex items-center gap-1.5 pl-1 pr-1 sm:pr-2 py-1 rounded-full transition-colors hover:bg-[#F1F5F9] dark:hover:bg-[color:var(--ink-hover,#334155)]"
                :aria-expanded="menuOpen"
                aria-haspopup="menu"
                aria-label="Account menu"
                @click="menuOpen = !menuOpen">
                <span class="relative flex-shrink-0">
                  <span
                    class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] text-white overflow-hidden"
                    style="background:#1565C0">
                    {{ initial }}
                  </span>
                  <span v-if="user?.is_super_admin"
                    class="absolute -top-0.5 -right-0.5 rounded-full p-0.5 flex bg-white dark:bg-[color:var(--ink-chrome,#1E293B)]"
                    title="Unrestricted administrator">
                    <AssetIcon name="badge-check" :size="11" class="text-[#0052FF]" />
                  </span>
                </span>

                <span class="hidden xl:flex flex-col items-start min-w-0 max-w-[170px] pl-1 text-left leading-tight">
                  <span class="text-[13px] font-semibold text-gray-800 dark:text-slate-100 truncate max-w-full">
                    {{ user?.full_name || 'Administrator' }}
                  </span>
                  <span class="text-[11px] text-[#64748b] dark:text-slate-400 truncate max-w-full">
                    {{ adminRoleLabel(user?.admin_role) }}
                  </span>
                </span>

                <AssetIcon name="chevron-down" :size="14"
                  class="hidden sm:block text-[#94a3b8] dark:text-slate-500 transition-transform duration-150"
                  :class="{ 'rotate-180': menuOpen }" />
              </button>

              <Transition name="popup">
                <div v-if="menuOpen" class="admin-acct" role="menu" aria-label="Account">
                  <div class="flex items-start gap-3 px-4 py-3.5 border-b border-[#E5EAF0] dark:border-[color:var(--ink-border,#334155)]">
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white overflow-hidden flex-shrink-0"
                      style="background:#1565C0">
                      {{ initial }}
                    </div>

                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold truncate text-gray-800 dark:text-slate-100">
                        {{ user?.full_name || 'Administrator' }}
                      </p>
                      <p class="text-xs truncate text-[#64748b] dark:text-slate-400">
                        {{ user?.email }}
                      </p>
                      <p class="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold text-[#1565C0] dark:text-[#64B5F6]">
                        <AssetIcon name="shield-check" :size="14" />
                        {{ adminRoleLabel(user?.admin_role) }}
                      </p>
                    </div>
                  </div>

                  <div class="py-2">
                    <button type="button" role="menuitem"
                      class="logout-btn flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-colors"
                      style="color:#D32F2F" :disabled="loggingOut" @click="handleLogout">
                      <AssetIcon name="log-out" :size="16" />
                      <span>{{ loggingOut ? 'Logging out…' : 'Log Out' }}</span>
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </header>

      <!--
        The page background is the token, not bg-white/dark:bg-slate-900. Every
        admin page paints itself inside a centred max-width, so the margins on
        either side are this element and have to be the page colour.
      -->
      <main class="min-h-screen transition-colors duration-150 pt-14 sm:pt-16">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
/*
 * Super Admin portal shell.
 *
 * The other portals' chrome: a full-width 56/64px top bar above the rail, a
 * content column that *reflows* to follow the rail's width, the same palette —
 * minus the pieces the admin console has no use for. There is no notification
 * bell and no global search because neither has an admin endpoint behind it.
 * The account menu sits in the top bar, as in the other portals (2026-10-15);
 * it used to be a block at the foot of the rail.
 *
 * Before this existed the two admin pages carried their own header, their own
 * theme toggle and their own log-out button, which is why those are removed
 * from them as part of adopting this layout.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AdminSidebar from '~/components/admin/sidebar.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import logo from '~/assets/images/RedAgosLogo.png'
import { useUser } from '~/composables/useUser'
import { useDarkMode } from '~/composables/useDarkMode'
import { useSidebar } from '~/composables/useSidebar.js'

// 'admin' namespace, not the donor default: this layout now reflows on the
// rail's state, so inheriting a hover the donor drawer latched would move the
// page.
const { railExpanded, mobileOpen, openMobile, expandOnHover, collapseOnHover } = useSidebar('admin')

// One button for both: the rail on desktop, the drawer below 1024px.
function toggleMenu() {
  if (window.matchMedia('(min-width: 1024px)').matches) {
    if (railExpanded.value) collapseOnHover()
    else expandOnHover()
  } else {
    openMobile()
  }
}

// The other portals' palette (main.css): the canvas, the chrome and, in dark,
// Chrome's greys.
onMounted(() => document.documentElement.classList.add('portal-bc'))
onUnmounted(() => document.documentElement.classList.remove('portal-bc'))

const { user, logout } = useUser()
const { isDark, toggleTheme } = useDarkMode()
const route = useRoute()

/*
 * Bound rather than written as a `:global(.dark) header` rule: this build's
 * scoped-CSS transform drops the descendant half of `:global(.dark) .x` and
 * emits a bare `.dark { … }`, which hung this shadow on <html> instead of on
 * the header.
 */
const headerShadow = computed(() => (
  isDark.value
    ? '0 1px 3px rgba(0,0,0,0.30), 0 1px 2px -1px rgba(0,0,0,0.30)'
    : '0 1px 2px rgba(15,23,42,0.05)'
))

const PAGE_TITLES = {
  '/admin/dashboard': 'Dashboard',
  '/admin/facilities': 'Organizations',
  '/admin/donor-identities': 'ID Verification',
  '/admin/administrators': 'Administrators',
}

const pageTitle = computed(() => PAGE_TITLES[route.path] || 'Admin')

// --- Account menu ---
const menuOpen = ref(false)
const profileRoot = ref(null)
const loggingOut = ref(false)
const initial = computed(() => user.value?.full_name?.charAt(0) || 'A')

// Hover only where hovering exists; on touch screens the tap toggles it.
let menuTimer = null
const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
function openMenuOnHover() {
  if (!canHover()) return
  clearTimeout(menuTimer)
  menuOpen.value = true
}
function closeMenuOnHover() {
  if (!canHover()) return
  clearTimeout(menuTimer)
  menuTimer = setTimeout(() => { menuOpen.value = false }, 220)
}

function onDocumentClick(event) {
  if (menuOpen.value && !profileRoot.value?.contains(event.target)) menuOpen.value = false
}
function onKeydown(event) {
  if (event.key === 'Escape') menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick, true)
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  clearTimeout(menuTimer)
  document.removeEventListener('click', onDocumentClick, true)
  window.removeEventListener('keydown', onKeydown)
})

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
 * Both of these carry the sidebar's own 200ms/ease-out, so the rail, the
 * header's left edge and the content column arrive together. Mismatched
 * durations here are what make a reflowing sidebar look like it is tearing.
 */
.content-shift {
  transition: padding-left 200ms ease-out;
}

/* Solid chrome, shared with the sidebar: --rb-chrome (main.css, html.portal-bc). */
.topbar {
  border-color: var(--rb-border);
  background-color: var(--rb-chrome, #FFFFFF);
  transition: background-color 150ms ease, border-color 150ms ease;
}

/* ── Brand: menu button, logo, wordmark and breadcrumb, as in the other portals ── */
.rail-toggle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--rb-text-primary, #1E293B);
  cursor: pointer;
  transition: background-color 150ms ease;
}
.rail-toggle:hover { background: rgba(15, 23, 42, 0.06); }
:global(.dark .rail-toggle:hover) { background: rgba(255, 255, 255, 0.08); }
.rail-toggle:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.rail-toggle:active { transform: scale(0.95); }

/* The logo stands on its own: no tile to swallow its red and blue. */
.bc-logo { display: flex; flex-shrink: 0; width: 40px; height: 40px; border-radius: 10px; }
.bc-logo__img { width: 100%; height: 100%; object-fit: contain; }
.bc-logo:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
@media (min-width: 1024px) {
  .bc-logo { width: 48px; height: 48px; }
}

.brand-word { display: inline-flex; flex-direction: column; justify-content: center; min-width: 0; }
.brand-word__name {
  font-family: var(--rb-font-sans);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: var(--rb-text-primary);
  text-decoration: none;
}
.brand-word__accent { color: #D32F2F; }
.brand-word__tag {
  margin-top: 2px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.1;
  color: var(--rb-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.brand-crumb { margin-top: 2px; min-width: 0; }
.brand-crumb ol { display: flex; align-items: center; min-width: 0; margin: 0; padding: 0; list-style: none; font-size: 12px; line-height: 1.1; }
.brand-crumb li { flex-shrink: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--rb-text-secondary); font-weight: 500; }
.brand-crumb li + li::before { content: '\203A'; margin: 0 5px; opacity: 0.7; }
.brand-crumb li[aria-current] { color: var(--rb-text-primary); font-weight: 600; }

main {
  background: var(--rb-page-bg);
}

/* Account menu */
.admin-acct {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 40;
  width: 270px;
  overflow: hidden;
  border: 1px solid #E5EAF0;
  border-radius: 14px;
  background: #FFFFFF;
  box-shadow: 0 16px 40px -16px rgba(15, 23, 42, 0.3);
}
/* An invisible bridge over the gap, so moving down to the menu does not count as leaving. */
.admin-acct::before {
  content: '';
  position: absolute;
  top: -10px;
  left: 0;
  right: 0;
  height: 10px;
}
:global(.dark .admin-acct) { border-color: var(--ink-border, #334155); background: var(--ink-surface, #1E293B); box-shadow: 0 16px 40px -16px rgba(0, 0, 0, 0.7); }
.logout-btn:hover:not(:disabled) { background: rgba(211, 47, 47, 0.08); }
.logout-btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }

.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}

@media (max-width: 639px) {
  header {
    height: 3.75rem;
  }

  main {
    padding-top: 3.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .content-shift,
  .topbar,
  .rail-toggle {
    transition: none;
  }
}
</style>
