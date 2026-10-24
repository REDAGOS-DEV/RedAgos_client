<template>
  <div class="donor-portal">
    <!--
      The portal's backdrop: a plain neutral canvas. Fixed and at z-index -1,
      so it sits behind everything without creating a stacking context that
      would trap the pages' modals. The sidebar, top bar and cards are solid
      surfaces on it.
    -->
    <div class="donor-backdrop" aria-hidden="true" />

    <!-- `:donor` was never declared as a prop on the sidebar, so it only landed
         on its root div as donor="[object Object]". The component reads the
         user from useUser() itself. -->
    <DonorSidebar />

    <!--
      The content column tracks the rail's width instead of a fixed lg:pl-20.
      Padding — not a margin or a transform — because it is the one property
      that both reserves the space and reflows the children inside it, which is
      what keeps the widened sidebar beside the page rather than over it.
    -->
    <!-- Sentinel sa pinakataas sa document: kung dili na makita, naka-scroll na -->
    <div ref="scrollSentinel" class="absolute top-0 left-0 h-px w-px pointer-events-none" aria-hidden="true" />

    <div class="content-shift" :class="railExpanded ? 'lg:pl-64' : 'lg:pl-[72px]'">
      <!-- Top bar -->
      <!--
        Same canvas as the sidebar and the page (--rb-page-bg), so the chrome
        reads as one frame and only the white cards stand out. Once the page
        has scrolled it turns translucent with a blur and a hairline shadow,
        so it still reads as sitting above the content.
      -->
      <!--
        Desktop: the bar runs the full width above the sidebar, with the brand
        at its left edge on the rail's icon axis, the search in the middle and
        the account on the right. The sidebar starts beneath it.
      -->
      <header
        class="topbar fixed top-0 left-0 right-0 z-30 lg:z-[60] h-14 sm:h-16 border-b transition-[box-shadow,background-color] duration-200"
        :class="{ 'topbar--scrolled': isScrolled }"
        :style="{ borderColor: headerBorderColor, boxShadow: isScrolled ? headerShadow : 'none' }">

        <!--
          The bar spans the full width — it carries the background and the
          divider — but its contents sit in the same centred 1152px column the
          donor pages use, with the same 16/32px gutters, so the breadcrumb
          lines up with the page title directly beneath it instead of drifting
          as the rail reflows the column. The donor pages are 1400px wide, so
          the bar is too: at 1152px the greeting sat far in from the title.
        -->
        <div class="topbar-inner relative mx-auto flex h-full w-full max-w-[1400px] lg:max-w-none items-center justify-between gap-2 sm:gap-3 px-4 sm:px-8 lg:px-4">

        <!-- Left Cluster: Logo (phones and tablets) + Titles -->
        <div class="flex items-center gap-2.5 min-w-0">
          <!--
            Below 1024px the bottom tabs carry the navigation, so the menu
            button gave way to the logo (2026-10-21), which goes Home like an
            app's. Settings, Help and Eligibility moved into the account menu.
          -->
          <!--
            Desktop: the menu button opens the rail; moving the pointer off
            the rail closes it again (components/donor/sidebar.vue). It sits
            on the rail's 36px icon axis, so the icons line up beneath it.
          -->
          <button
            type="button"
            class="rail-toggle"
            data-rail-toggle
            :aria-expanded="railExpanded"
            aria-controls="donor-sidebar"
            :aria-label="railExpanded ? 'Close menu' : 'Open menu'"
            @click="railExpanded ? collapseOnHover() : expandOnHover()">
            <AssetIcon name="menu" :size="20" />
          </button>

          <NuxtLink to="/donor/dashboard"
            class="mobile-logo"
            aria-label="RedAgos, go to Home">
            <img :src="logo" alt="" class="mobile-logo__img">
          </NuxtLink>

          <!--
            The wordmark beside the logo. Phones and tablets show the brand
            ("Donor Portal" beneath RedAgos); each page carries its own title.
            Desktop turns the second line into a breadcrumb to the page.
            Hidden on phones while the search takes the bar.
          -->
          <div class="brand-word" :class="{ 'max-sm:hidden': searchOpenMobile }">
            <NuxtLink to="/donor/dashboard" class="brand-word__name" aria-label="RedAgos, go to Home">
              Red<span class="brand-word__accent">Agos</span>
            </NuxtLink>
            <span class="brand-word__tag lg:hidden">Donor Portal</span>
            <nav class="brand-crumb hidden lg:block" aria-label="Breadcrumb">
              <ol>
                <li>
                  <NuxtLink v-if="route.path !== '/donor/dashboard'" to="/donor/dashboard">Donor Portal</NuxtLink>
                  <span v-else>Donor Portal</span>
                </li>
                <li aria-current="page">{{ pageLabels[route.path] || 'Dashboard' }}</li>
              </ol>
            </nav>
          </div>
        </div>

        <!-- Search Bar (Desktop) -->
        <div v-show="searchOpenMobile || true" v-click-outside="closeSearchResults"
          class="items-center gap-2 h-10 rounded-full bg-white dark:bg-[color:var(--ink-surface,#1E293B)] border border-[#E2E8F0] dark:border-[color:var(--ink-border,#334155)] hover:border-[#CBD5E1] dark:hover:border-[color:var(--ink-border-hover,#475569)] focus-within:border-[rgba(var(--rb-primary-rgb),0.4)] focus-within:ring-4 focus-within:ring-[rgba(var(--rb-primary-rgb),0.1)] transition-colors px-4 relative"
          :class="[
            searchOpenMobile
              ? 'flex flex-1 z-40'
              : 'hidden sm:flex sm:flex-1',
            'lg:flex-none lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-sm xl:max-w-md lg:top-1/2 lg:-translate-y-1/2'
          ]">
          <AssetIcon name="search" :size="16" class="text-[#94a3b8] dark:text-[color:var(--ink-muted,#64748B)] flex-shrink-0" />
          <input ref="searchInput" v-model="searchQuery" type="text" placeholder="Search pages, records..."
            class="text-sm flex-1 min-w-0 bg-transparent outline-none placeholder:text-[#94a3b8] dark:placeholder:text-[color:var(--ink-muted,#64748B)] text-gray-800 dark:text-[color:var(--ink-text,#F1F5F9)]"
            @focus="showSearchResults = true" @keydown.enter="goToTopResult" @keydown.esc="handleEscSearch"
            @keydown.down.prevent="moveHighlight(1)" @keydown.up.prevent="moveHighlight(-1)" />
          <span v-if="!searchQuery"
            class="text-[10px] px-1.5 py-0.5 rounded-md font-mono hidden md:inline-block bg-[#F1F5F9] dark:bg-[color:var(--ink-border,#334155)] text-[#64748b] dark:text-[color:var(--ink-text-3,#CBD5E1)] border border-[#E2E8F0] dark:border-[color:var(--ink-border-hover,#475569)] flex-shrink-0">
            {{ searchShortcutLabel }}
          </span>
          <button v-else @click="clearSearch"
            class="text-[#94a3b8] dark:text-[color:var(--ink-muted,#64748B)] hover:text-gray-600 dark:hover:text-[color:var(--ink-text-3,#CBD5E1)] flex-shrink-0"
            aria-label="Clear search">
            <AssetIcon name="x" :size="14" />
          </button>

          <!-- Results dropdown -->
          <Transition name="popup">
            <!--
              The borders here are bound, not a `dark:border-[color:var(--ink-border,#334155)]` class
              beside a hard-coded inline colour: an inline `border-color`
              outranks the variant, which is what pinned every one of this
              header's popups to the light #EEF1F5 in dark mode.
            -->
            <div v-if="showSearchResults && searchQuery && filteredResults.length"
              class="search-results-dropdown absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden bg-white dark:bg-[color:var(--ink-page,#0F172A)] border shadow-lg z-40"
              :style="{ borderColor: headerBorderColor }">
              <NuxtLink v-for="(item, i) in filteredResults" :key="item.path" :to="item.path"
                @click="closeSearchResults(); searchOpenMobile = false"
                class="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors" :class="i === highlightIndex
                  ? 'bg-gray-50 dark:bg-[color:var(--ink-surface,#1E293B)] text-gray-900 dark:text-[color:var(--ink-text,#F1F5F9)]'
                  : 'text-gray-700 dark:text-[color:var(--ink-text-3,#CBD5E1)] hover:bg-gray-50 dark:hover:bg-[color:var(--ink-surface,#1E293B)]'">
                <AssetIcon :name="item.icon" :size="16" class="text-gray-400 dark:text-[color:var(--ink-muted,#64748B)] flex-shrink-0" />
                <span class="truncate">{{ item.label }}</span>
              </NuxtLink>
            </div>

            <div v-else-if="showSearchResults && searchQuery && !filteredResults.length"
              class="absolute left-0 right-0 top-full mt-2 rounded-xl overflow-hidden bg-white dark:bg-[color:var(--ink-page,#0F172A)] border shadow-lg z-40 px-4 py-3 text-sm text-gray-500 dark:text-[color:var(--ink-text-2,#94A3B8)]"
              :style="{ borderColor: headerBorderColor }">
              No matches for "{{ searchQuery }}"
            </div>
          </Transition>
        </div>

        <!-- Right Cluster (Actions & Profile Avatar) -->
        <div v-show="!searchOpenMobile" class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <!-- Mobile Search Trigger -->
          <button @click="openMobileSearch"
            class="sm:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[#EEF1F5] dark:hover:bg-[color:var(--ink-surface,#1E293B)]"
            aria-label="Open search">
            <AssetIcon name="search" :size="18" class="text-[#475569] dark:text-[color:var(--ink-text-3,#CBD5E1)]" />
          </button>

          <!-- Notifications -->
          <NuxtLink to="/donor/notifications"
            :aria-label="unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'"
            class="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[#EEF1F5] dark:hover:bg-[color:var(--ink-surface,#1E293B)]">
            <AssetIcon name="bell" :size="18" class="text-[#475569] dark:text-[color:var(--ink-text-3,#CBD5E1)]" />
            <span v-if="unreadCount > 0"
              class="absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-[3px] rounded-full flex items-center justify-center text-[9px] font-semibold text-white ring-2 ring-[#F7F8FA] dark:ring-[color:var(--ink-page,#0F172A)]"
              style="background:#D32F2F">
              {{ unreadCount > 9 ? '9+' : unreadCount }}
            </span>
          </NuxtLink>

          <!--
            `xs:` is not a breakpoint in this project — tailwind.config.js adds
            no screens, so `hidden xs:block` compiled to `hidden` and this
            divider never rendered at any width. sm is the real first step up.
          -->
          <div class="hidden sm:block w-px h-5 mx-0.5 bg-[#E2E8F0] dark:bg-[color:var(--ink-border,#334155)]" />

          <!--
            Account menu. Opens on hover on devices with a mouse (closing after
            a short delay so crossing the gap to the panel does not shut it);
            click, tap and the keyboard still toggle it.
          -->
          <div class="relative" @mouseenter="openMenuOnHover" @mouseleave="closeMenuOnHover">
            <button @click="showUserMenu = !showUserMenu"
              :aria-expanded="showUserMenu ? 'true' : 'false'" aria-haspopup="menu" aria-label="Account menu"
              class="flex items-center gap-1 pl-1 pr-1 sm:pr-2 py-1 rounded-full transition-colors hover:bg-[#EEF1F5] dark:hover:bg-[color:var(--ink-surface,#1E293B)]">

              <!-- Outer Avatar Container -->
              <div class="relative flex-shrink-0">
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white overflow-hidden ring-2 ring-[#F7F8FA] dark:ring-[color:var(--ink-page,#0F172A)]"
                  style="background:var(--rb-primary);">
                  <img v-if="user?.avatar" :src="user.avatar" class="w-full h-full object-cover" alt="">
                  <span v-else>{{ userInitials }}</span>
                </div>

                <!--
                  Valid ID status badge on avatar — now the single consistent
                  indicator across desktop AND mobile (no more sm:hidden).
                  verified -> checkmark badge, pending -> neutral dot,
                  unsubmitted/rejected -> pulsing amber dot.
                -->
                <div v-if="identityStatus === 'verified'"
                  class="id-verified-badge absolute -top-1 -right-1 rounded-full p-0.5 z-10"
                  title="ID Verified">
                  <AssetIcon name="badge-check" :size="14" class="text-[#0052FF] dark:text-white" />
                </div>

                <!--
                  Bottom-right, the usual place for a status dot. Top-right is
                  where the bell's unread badge sits, so a dot there read as a
                  second notification.
                -->
                <span v-else-if="identityStatus === 'pending'"
                  class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-[#F7F8FA] dark:ring-[color:var(--ink-page,#0F172A)] z-10"
                  title="ID under review">
                  <span class="sr-only">ID under review</span>
                </span>

                <span v-else
                  class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-[#F7F8FA] dark:ring-[color:var(--ink-page,#0F172A)] z-10"
                  title="Valid ID needed">
                  <span class="sr-only">Valid ID needed</span>
                </span>
              </div>

              <AssetIcon name="chevron-down" :size="14"
                class="text-[#94a3b8] dark:text-[color:var(--ink-muted,#64748B)] hidden sm:block transition-transform duration-150"
                :class="{ 'rotate-180': showUserMenu }" />
            </button>

            <!-- Profile Dropdown Card -->
            <Transition name="popup">
              <div v-if="showUserMenu" v-click-outside="closeUserMenu"
                class="absolute right-0 top-full mt-2 w-64 rounded-xl overflow-hidden bg-white dark:bg-[color:var(--ink-page,#0F172A)] border z-40 shadow-lg"
                :style="{ borderColor: headerBorderColor }">
                <div class="flex items-center gap-3 px-4 py-4 border-b"
                  :style="{ borderColor: headerBorderColor }">
                  <div
                    class="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm text-white overflow-hidden flex-shrink-0"
                    style="background:var(--rb-primary)">
                    <img v-if="user?.avatar" :src="user.avatar" class="w-full h-full object-cover" alt="">
                    <span v-else>{{ userInitials }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold truncate capitalize text-gray-900 dark:text-[color:var(--ink-text,#F1F5F9)]">
                      {{ user?.full_name || 'Donor' }}
                    </p>
                    <p class="text-xs truncate text-gray-500 dark:text-[color:var(--ink-text-2,#94A3B8)]">{{ user?.email }}</p>

                    <!-- Valid ID Status inside Dropdown (full context + CTA lives here) -->
                    <div class="flex items-center gap-1.5 mt-1.5">
                      <template v-if="identityStatus === 'verified'">
                        <AssetIcon name="badge-check" :size="16" class="text-[#0052FF] dark:text-[#3B82F6]" />
                        <span class="text-xs font-bold text-gray-900 dark:text-[color:var(--ink-text,#F1F5F9)]">
                          ID Verified
                        </span>
                      </template>

                      <template v-else-if="identityStatus === 'pending'">
                        <AssetIcon name="clock" :size="14" class="text-slate-400" />
                        <span class="text-xs font-bold text-slate-500 dark:text-[color:var(--ink-text-2,#94A3B8)]">
                          ID Under Review
                        </span>
                      </template>

                      <NuxtLink
                        v-else
                        to="/donor/profile"
                        @click="closeUserMenu"
                        class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline">
                        <AssetIcon name="circle-alert" :size="14" class="text-amber-500" />
                        <span>Submit Valid ID</span>
                      </NuxtLink>
                    </div>
                  </div>
                </div>

                <div class="py-2">
                  <NuxtLink v-for="item in userMenuItems" :key="item.path" :to="item.path" @click="closeUserMenu"
                    class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-[color:var(--ink-text-3,#CBD5E1)] hover:bg-gray-50 dark:hover:bg-[color:var(--ink-surface,#1E293B)] transition-colors">
                    <AssetIcon :name="item.icon" :size="16" class="text-gray-400 dark:text-[color:var(--ink-muted,#64748B)]" />
                    <span>{{ item.label }}</span>
                  </NuxtLink>
                </div>

                <!--
                  Theme: Light / Dark / System, the same three choices as the
                  blood center portal. System (the default) follows the
                  browser or computer and switches with it.
                -->
                <div class="border-t py-2" :style="{ borderColor: headerBorderColor }">
                  <div class="flex items-center justify-between gap-3 px-4 py-1.5">
                    <span class="flex items-center gap-3 text-sm text-gray-700 dark:text-[color:var(--ink-text-3,#CBD5E1)]">
                      <AssetIcon :name="isDark ? 'moon' : 'sun'" :size="16" class="text-gray-400 dark:text-[color:var(--ink-muted,#64748B)]" />
                      Theme
                    </span>
                    <div class="theme-seg" role="radiogroup" aria-label="Theme">
                      <button
                        v-for="option in THEME_OPTIONS"
                        :key="option.value"
                        type="button"
                        role="radio"
                        class="theme-seg__btn"
                        :class="{ 'theme-seg__btn--on': themeMode === option.value }"
                        :aria-checked="themeMode === option.value"
                        :aria-label="option.label"
                        :title="option.label"
                        @click="setThemeMode(option.value)"
                      >
                        <AssetIcon :name="option.icon" :size="14" />
                      </button>
                    </div>
                  </div>
                  <p class="theme-seg__hint">{{ themeHint }}</p>
                </div>

                <div class="border-t py-2" :style="{ borderColor: headerBorderColor }">
                  <button @click="handleLogout"
                    class="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                    style="color:#D32F2F">
                    <AssetIcon name="log-out" :size="16" />
                    <span>Log Out</span>
                  </button>
                </div>

                <div class="px-4 py-2 border-t" :style="{ borderColor: headerBorderColor }">
                  <p class="text-[11px] text-center text-gray-400 dark:text-[color:var(--ink-muted,#64748B)]">v1.0.0 · Terms & Conditions</p>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Mobile search close button -->
        <button v-if="searchOpenMobile" @click="closeMobileSearch"
          class="sm:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ml-1 transition-colors hover:bg-[#EEF1F5] dark:hover:bg-[color:var(--ink-surface,#1E293B)]"
          aria-label="Close search">
          <AssetIcon name="x" :size="18" class="text-[#475569] dark:text-[color:var(--ink-text-3,#CBD5E1)]" />
        </button>
        </div>
      </header>

      <!--
        The page background is the token, not bg-white/dark:bg-[color:var(--ink-page,#0F172A)]. Every
        donor page paints itself inside a centred max-width, so the margins on
        either side are this element and have to be the page colour.
      -->
      <main class="min-h-screen transition-colors duration-150 pt-14 sm:pt-16">
        <slot />
      </main>

      <!-- Phones and tablets: the main tabs under the thumb (the sidebar is a drawer there). -->
      <DonorBottomNav />

      <!-- The portal's confirm dialog (useConfirmDialog), in place of window.confirm. -->
      <DonorConfirmDialog />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUser } from '@/composables/useUser'
import { useDarkMode } from '@/composables/useDarkMode'
import AssetIcon from '~/components/common/AssetIcon.vue'
import logo from '~/assets/images/RedAgosLogo.png'
import { donorService } from '~/api/donor/DonorService'
import { useSidebar } from '~/composables/useSidebar.js'
import { useIdentityStatus } from '~/composables/useIdentityStatus'
import { useAccentTheme } from '~/composables/useAccentTheme'
import { accentSurfaces, accentTheme } from '~/utils/accentThemes'

const { railExpanded, expandOnHover, collapseOnHover } = useSidebar()

// The donor's colour theme (Settings → Appearance). Applied while the donor
// portal is open and removed on the way out, so the other portals and the
// sign-in screens keep the standard RedAgos blue.
const accent = useAccentTheme()
onMounted(() => accent.init())
onUnmounted(() => accent.clear())
const router = useRouter()
const route = useRoute()
const { user, fetchUser, logout } = useUser()
const { isDark, themeMode, setThemeMode } = useDarkMode()

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System (same as your browser)', icon: 'monitor' },
]

const themeHint = computed(() => (
  themeMode.value === 'system'
    ? `Following your browser (${isDark.value ? 'dark' : 'light'})`
    : `Always ${themeMode.value}`
))

// The browser's own bar (status bar and address bar on phones) takes this
// colour, so it runs into the header instead of stopping at a white
// strip. The header's own solid surface colour (light, and the ink dark).
// Set on the one tag by hand: useHead left the server-rendered light tag in
// place beside the client's, and browsers read the first.
let themeColorMeta = null
function applyThemeColor() {
  if (!themeColorMeta) {
    themeColorMeta = document.querySelector('meta[name="theme-color"]') ?? document.createElement('meta')
    themeColorMeta.setAttribute('name', 'theme-color')
    if (!themeColorMeta.isConnected) document.head.appendChild(themeColorMeta)
  }
  // The header's own colour, tinted by the colour theme like the rest of the chrome.
  const { light, dark } = accentSurfaces(accentTheme(accent.current.value))
  themeColorMeta.setAttribute('content', isDark.value ? dark.chrome : light.chrome)
}
onMounted(applyThemeColor)
watch([isDark, accent.current], () => { if (themeColorMeta) applyThemeColor() })
onUnmounted(() => {
  themeColorMeta?.remove()
  themeColorMeta = null
})

// Turns on the donor "ink" dark palette (main.css), on <html> so it also
// reaches dialogs and dropdowns teleported to <body>.
onMounted(() => document.documentElement.classList.add('portal-donor'))
onUnmounted(() => document.documentElement.classList.remove('portal-donor'))

const headerBorderColor = computed(() => (isDark.value ? 'var(--ink-border, #334155)' : '#E5EAF0'))
/*
 * Bound rather than written as a `:global(.dark) header` rule. This build's
 * scoped-CSS transform drops the descendant half of `:global(.dark) .x` and
 * emits a bare `.dark { … }` — all four of this file's `:global(.dark) x`
 * rules collapsed into one `.dark{color:#f8fafc;background-color:#475569;
 * box-shadow:…}` on <html>, so the header lost its shadow and the document
 * root picked up a slate-600 background it was never meant to have.
 */
// Naka-scroll na ba ang page? IntersectionObserver sa sentinel, dili scroll
// listener, aron walay trabaho matag scroll frame.
const scrollSentinel = ref(null)
const isScrolled = ref(false)
let sentinelObserver = null

onMounted(() => {
  if (!scrollSentinel.value || typeof IntersectionObserver === 'undefined') return
  sentinelObserver = new IntersectionObserver(([entry]) => {
    isScrolled.value = !entry.isIntersecting
  })
  sentinelObserver.observe(scrollSentinel.value)
})

onUnmounted(() => {
  sentinelObserver?.disconnect()
})

const headerShadow = computed(() => (
  isDark.value
    ? '0 1px 3px rgba(0,0,0,0.30), 0 1px 2px -1px rgba(0,0,0,0.30)'
    : '0 1px 2px rgba(15,23,42,0.05)'
))

onMounted(() => {
  if (!user.value) fetchUser()
})

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

// --- Page title (top bar and mobile header) ---
const pageLabels = {
  '/donor/dashboard': 'Dashboard',
  '/donor/appointments': 'Book Appointment',
  '/donor/history': 'Donation History',
  '/donor/eligibility': 'Eligibility Screening',
  '/donor/qrcode': 'My QR Code',
  '/donor/notifications': 'Notifications',
  '/donor/profile': 'My Profile',
  '/donor/settings': 'Settings',
  '/donor/help': 'Help',
}


// --- Notifications ---
// Shared with the notifications page, which updates it as notices are read.
const unreadCount = useState('donor-unread-count', () => 0)

async function loadUnreadCount() {
  try {
    const data = await donorService.notificationsUnreadCount()
    unreadCount.value = data?.unread_count ?? 0
  } catch (err) {
    console.error('Failed to load unread notification count:', err)
    unreadCount.value = 0
  }
}

onMounted(loadUnreadCount)
// A new notice can land while the donor moves around (a booking writes one),
// so the badge is re-read on each page change.
watch(() => route.path, () => loadUnreadCount())

// --- Valid ID status ---
// Drives the avatar badge/dot (consistent across desktop + mobile) and the
// dropdown CTA: 'unsubmitted' | 'pending' | 'verified' | 'rejected'.
// Treated as "needs action" unless it's explicitly verified or under review.
// Shared (useState) with IdentityVerification.vue on /donor/profile, so
// submitting an ID there flips this badge immediately — no refetch needed.
const { identityStatus, fetchIdentityStatus } = useIdentityStatus()

onMounted(() => {
  if (identityStatus.value === null) fetchIdentityStatus()
})

// --- Profile dropdown ---
const showUserMenu = ref(false)
// On phones this is the only way to Eligibility and Help (no drawer there).
const userMenuItems = [
  { label: 'My Profile', path: '/donor/profile', icon: 'user-circle' },
  { label: 'Donation History', path: '/donor/history', icon: 'history' },
  { label: 'View My QR Code', path: '/donor/qrcode', icon: 'qr-code' },
  { label: 'Eligibility Screening', path: '/donor/eligibility', icon: 'clipboard-check' },
  { label: 'Notification Settings', path: '/donor/settings', icon: 'bell' },
  { label: 'Help', path: '/donor/help', icon: 'help-circle' }
]
const closeUserMenu = () => { showUserMenu.value = false }

// Hover only where hovering exists; on touch screens the tap toggles it.
let menuTimer = null
const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
const openMenuOnHover = () => {
  if (!canHover()) return
  clearTimeout(menuTimer)
  showUserMenu.value = true
}
const closeMenuOnHover = () => {
  if (!canHover()) return
  clearTimeout(menuTimer)
  menuTimer = setTimeout(closeUserMenu, 220)
}
onUnmounted(() => clearTimeout(menuTimer))

// "Yana Cruz" -> "YC"; one name -> its first letter; nothing -> "D" (donor).
const userInitials = computed(() => {
  const parts = (user.value?.full_name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'D'
  const first = parts[0].charAt(0)
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''
  return (first + last).toUpperCase()
})

// --- Mobile search overlay ---
const searchOpenMobile = ref(false)

function openMobileSearch() {
  searchOpenMobile.value = true
  nextTick(() => searchInput.value?.focus())
}

function closeMobileSearch() {
  searchOpenMobile.value = false
  clearSearch()
}

function handleEscSearch() {
  if (searchOpenMobile.value) {
    closeMobileSearch()
  } else {
    clearSearch()
  }
}

// --- Global search ---
const searchablePages = [
  { label: 'Dashboard', path: '/donor/dashboard', icon: 'home', keywords: 'dashboard home overview' },
  { label: 'Book Appointment', path: '/donor/appointments', icon: 'calendar', keywords: 'appointment book schedule slot' },
  { label: 'Donation History', path: '/donor/history', icon: 'history', keywords: 'history donations record' },
  { label: 'Eligibility Screening', path: '/donor/eligibility', icon: 'shield-check', keywords: 'eligibility screening questionnaire' },
  { label: 'My QR Code', path: '/donor/qrcode', icon: 'qr-code', keywords: 'qr code scan' },
  { label: 'Notifications', path: '/donor/notifications', icon: 'bell', keywords: 'notifications alerts reminders' },
  { label: 'My Profile', path: '/donor/profile', icon: 'user-circle', keywords: 'profile account personal info' },
  { label: 'Settings', path: '/donor/settings', icon: 'settings', keywords: 'settings preferences password' },
  { label: 'Help', path: '/donor/help', icon: 'help-circle', keywords: 'help faq support contact' },
]

const searchQuery = ref('')
const showSearchResults = ref(false)
const highlightIndex = ref(0)
const searchInput = ref(null)

const filteredResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return searchablePages.filter(p =>
    p.label.toLowerCase().includes(q) || p.keywords.includes(q)
  )
})

function closeSearchResults() {
  showSearchResults.value = false
  highlightIndex.value = 0
}

function clearSearch() {
  searchQuery.value = ''
  closeSearchResults()
  searchInput.value?.blur()
}

function moveHighlight(delta) {
  if (!filteredResults.value.length) return
  const max = filteredResults.value.length - 1
  highlightIndex.value = Math.min(max, Math.max(0, highlightIndex.value + delta))
}

function goToTopResult() {
  const target = filteredResults.value[highlightIndex.value] || filteredResults.value[0]
  if (!target) return
  router.push(target.path)
  clearSearch()
  searchOpenMobile.value = false
}

// ⌘ ra sa Mac; sa Windows/Linux kay Ctrl ang tinuod nga key. Gi-set sa
// onMounted kay walay navigator sa SSR.
const searchShortcutLabel = ref('Ctrl F')

function handleGlobalKeydown(e) {
  const isCmdF = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f'
  if (isCmdF) {
    e.preventDefault()
    if (window.innerWidth < 640) openMobileSearch()
    else searchInput.value?.focus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  const platform = navigator.userAgentData?.platform || navigator.platform || ''
  if (/mac|iphone|ipad/i.test(platform)) searchShortcutLabel.value = '⌘F'
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

// --- LOGOUT HANDLER ---
const handleLogout = async () => {
  showUserMenu.value = false
  try {
    if (typeof logout === 'function') {
      await logout('/auth/login')
    } else {
      router.push('/auth/login')
    }
  } catch (error) {
    console.error('Logout error:', error)
  }
}
</script>

<style scoped>
/* ── Backdrop (see the template) ── */
/*
 * A plain, neutral canvas. The portal's chrome (sidebar, top bar, bottom bar)
 * is solid and the page a quiet grey, the way the browser's own toolbar is,
 * so the two read as one in light and in dark. The brand rides on the logo,
 * the blue actions and the red of the blood type, not on a backdrop.
 */
.donor-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: var(--rb-page-bg, #F5F6F8);
}

/* Solid top bar, in the surface colour, with a hairline under it. */
.topbar { background-color: var(--rb-chrome, var(--rb-surface, #FFFFFF)); }

/*
 * badge-check is an outline glyph on a 24 viewBox. Rendered at 14px its
 * authored stroke-width of 2 scales down to ~1.2px, which reads as a hairline
 * on the avatar. A CSS stroke-width overrides the presentation attribute and
 * gives the mark enough weight to actually be seen at this size.
 */
.id-verified-badge :deep(svg) {
  stroke-width: 3;
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

/*
 * Both of these carry the sidebar's own 200ms/ease-out, so the rail, the
 * header's left edge and the content column arrive together. Mismatched
 * durations here are what make a reflowing sidebar look like it is tearing.
 */
.content-shift {
  transition: padding-left 200ms ease-out;
}

.topbar {
  transition: left 200ms ease-out, background-color 150ms ease, border-color 150ms ease;
  will-change: left;
}

/* Transparent: the canvas shows through between the cards. */
main {
  background: transparent;
}

/* The logo in place of the menu button, on phones and tablets: the same
   mark as the sidebar's, in the portal colour. */
.mobile-logo {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: 10px;
}
/* The logo stands on its own, with no tile: it carries its own red and blue,
   which a tile in the theme colour would swallow (a blue tile the wave, a red
   pick the drop), and it reads on every light and dark theme as it is. */
/* The rail's menu button, desktop only (phones use the bottom tabs). */
.rail-toggle { display: none; }
@media (min-width: 1024px) {
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
}
.rail-toggle:hover { background: rgba(15, 23, 42, 0.06); }
html.dark .rail-toggle { color: var(--ink-text, #EEF1F5); }
html.dark .rail-toggle:hover { background: rgba(255, 255, 255, 0.08); }
.rail-toggle:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.rail-toggle:active { transform: scale(0.95); }
.mobile-logo__img { width: 100%; height: 100%; object-fit: contain; }
.mobile-logo:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.mobile-logo:active { transform: scale(0.96); }
/* From 1024px the logo is the brand beside the menu button (which holds the
   rail's icon axis), so it can be larger: 48px in the 64px bar. */
@media (min-width: 1024px) {
  .mobile-logo { width: 48px; height: 48px; }
}

/* The wordmark beside the logo: the name, and beneath it "Donor Portal"
   (phones, tablets) or the breadcrumb to the page (desktop). */
.brand-word { display: inline-flex; flex-direction: column; justify-content: center; min-width: 0; }
.brand-word__name { text-decoration: none; }
.brand-word__name {
  font-family: var(--rb-font-sans);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: var(--rb-text-primary);
}
.brand-word__accent { color: #D32F2F; }
/* Desktop: Donor Portal › Page. Capped so a long page name ends in an
   ellipsis short of the centred search (narrower below 1280px). */
.brand-crumb { margin-top: 2px; max-width: 180px; }
@media (min-width: 1280px) {
  .brand-crumb { max-width: 280px; }
}
.brand-crumb ol { display: flex; align-items: center; min-width: 0; margin: 0; padding: 0; list-style: none; font-size: 12px; line-height: 1.1; }
.brand-crumb li { flex-shrink: 0; color: var(--rb-text-secondary); font-weight: 500; }
.brand-crumb li + li { flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.brand-crumb li + li::before { content: '\203A'; margin: 0 5px; color: var(--rb-text-secondary); opacity: 0.7; }
.brand-crumb li[aria-current] { color: var(--rb-text-primary); font-weight: 600; }
.brand-crumb a { color: inherit; text-decoration: none; border-radius: 4px; }
.brand-crumb a:hover { color: var(--rb-primary-text, var(--rb-primary)); text-decoration: underline; }
.brand-crumb a:focus-visible, .brand-word__name:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; border-radius: 4px; }
.brand-word__tag {
  margin-top: 2px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.1;
  color: var(--rb-text-secondary);
}

input:focus {
  outline: none;
}

/*
 * Tokens, not a paired `:global(.dark) input` rule — see headerShadow. The four
 * rules that used to live at the bottom of this block all collapsed onto <html>
 * and did nothing here.
 */
input::placeholder {
  color: var(--rb-placeholder);
  opacity: 1;
}

input {
  color: var(--rb-text-primary);
}

.search-results-dropdown {
  max-height: 320px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--rb-border-hover) transparent;
}

.search-results-dropdown::-webkit-scrollbar {
  width: 5px;
}

.search-results-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.search-results-dropdown::-webkit-scrollbar-thumb {
  background-color: var(--rb-border-hover);
  border-radius: 999px;
}

a, button {
  touch-action: manipulation;
}

/* Below the sidebar breakpoint the bottom tabs cover the foot of the page,
   so the page ends above them. */
@media (max-width: 1023px) {
  main {
    padding-bottom: calc(76px + env(safe-area-inset-bottom, 0px));
  }
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
  .topbar {
    transition: none;
  }
}

/* Theme choice in the account menu: three icon buttons, Light / Dark / System. */
.theme-seg {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 10px;
  background: #F1F5F9;
}
.theme-seg__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #64748B;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.theme-seg__btn:hover:not(.theme-seg__btn--on) { color: #1E293B; }
.theme-seg__btn--on {
  background: #fff;
  color: var(--rb-primary-text);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
}
.theme-seg__btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; }
.theme-seg__hint { margin: 2px 16px 4px 44px; font-size: 11.5px; color: #94A3B8; }
:global(.dark .theme-seg) { background: var(--ink-surface, #1E293B); }
:global(.dark .theme-seg__btn) { color: var(--ink-text-2, #94A3B8); }
:global(.dark .theme-seg__btn:hover:not(.theme-seg__btn--on)) { color: var(--ink-text, #F1F5F9); }
:global(.dark .theme-seg__btn--on) { background: var(--ink-border, #334155); color: var(--rb-primary-text); }
@media (prefers-reduced-motion: reduce) {
  .theme-seg__btn { transition: none; }
}
</style>

<!--
  Portal fonts, unscoped so they reach every donor page.
  Inter for body text, labels and numbers (clearer at small sizes, digits
  line up); Plus Jakarta Sans, the brand font, for headings so the portal
  still feels like the landing page and sign-in.
-->
<style>
.donor-portal {
  font-family: var(--rb-font-ui);
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}
.donor-portal :is(h1, h2, h3, .page-title, .panel-title, .hero__title, .step-label,
  .modal-title, .onboarding-card__title, .qr-panel__title, .steps-panel__title,
  .valid-gate__title, .logo-name) {
  font-family: var(--rb-font-sans);
}
</style>

