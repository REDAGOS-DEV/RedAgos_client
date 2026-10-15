<template>
  <div class="staff-shell">
    <!-- The blood center's shell: the landing hero's glow, with glass over it. -->
    <div class="staff-backdrop" aria-hidden="true" />
    <div class="staff-frost staff-glass" :class="railExpanded ? 'lg:left-64' : 'lg:left-[72px]'" aria-hidden="true" />
    <AdminSidebar />

    <!-- At the very top of the document: once it is out of view, the page has scrolled. -->
    <div ref="scrollSentinel" class="absolute top-0 left-0 h-px w-px pointer-events-none" aria-hidden="true" />

    <!--
      The content column tracks the rail's width instead of a fixed lg:pl-20.
      Padding — not a margin or a transform — because it is the one property
      that both reserves the space and reflows the children inside it, which is
      what keeps the widened sidebar beside the page rather than over it.
    -->
    <div class="content-shift" :class="railExpanded ? 'lg:pl-64' : 'lg:pl-[72px]'">
      <!-- Top bar -->
      <header
        class="topbar staff-topbar staff-glass fixed top-0 left-0 right-0 z-30 h-14 sm:h-16 border-b"
        :class="[railExpanded ? 'lg:left-64' : 'lg:left-[72px]', { 'staff-topbar--scrolled': isScrolled }]"
        :style="{ boxShadow: isScrolled ? headerShadow : 'none' }">

        <!--
          The bar spans the full width — it carries the background and the
          divider — but its contents sit in the same centred 1280px column the
          admin pages use, with the same 16/32px gutters, so the breadcrumb
          lines up with the page title directly beneath it.
        -->
        <div class="relative mx-auto flex h-full w-full max-w-[1280px] items-center gap-2 sm:gap-3 px-4 sm:px-8">
          <!-- Left cluster -->
          <div v-show="!searchOpenMobile" class="flex items-center gap-2 min-w-0 lg:max-w-[calc(50%-13rem)] xl:max-w-[calc(50%-15rem)]">
            <button class="icon-btn flex lg:hidden" aria-label="Open menu" @click="openMobile">
              <AssetIcon name="menu" :size="20" />
            </button>

            <span class="sm:hidden font-bold text-sm text-[color:var(--rb-text-primary)] truncate">
              {{ pageTitle }}
            </span>

            <div class="hidden sm:flex flex-col justify-center min-w-0 flex-shrink">
              <span class="hidden lg:block text-[11px] text-[color:var(--rb-text-muted)] leading-tight truncate">
                {{ breadcrumb }}
              </span>
              <span class="text-xs sm:text-sm font-semibold text-[color:var(--rb-text-primary)] truncate leading-tight">
                {{ greeting }}
              </span>
            </div>
          </div>

          <!-- Search: the pages this account can open -->
          <div
            v-show="searchOpenMobile || true"
            v-click-outside="closeSearchResults"
            class="search relative items-center gap-2 px-3 py-2"
            :class="[
              searchOpenMobile ? 'flex flex-1 z-40' : 'hidden sm:flex sm:flex-1',
              'lg:flex-none lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-sm xl:max-w-md lg:top-1/2 lg:-translate-y-1/2'
            ]">
            <AssetIcon name="search" :size="16" class="search__icon flex-shrink-0" />
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              placeholder="Search pages..."
              class="search__input text-sm flex-1 min-w-0 bg-transparent outline-none"
              @focus="showSearchResults = true"
              @keydown.enter="goToTopResult"
              @keydown.esc="handleEscSearch"
              @keydown.down.prevent="moveHighlight(1)"
              @keydown.up.prevent="moveHighlight(-1)">
            <span v-if="!searchQuery" class="search__kbd hidden md:inline-block flex-shrink-0">{{ shortcutLabel }}</span>
            <button v-else class="search__clear flex-shrink-0" aria-label="Clear search" @click="clearSearch">
              <AssetIcon name="x" :size="14" />
            </button>

            <Transition name="popup">
              <div v-if="showSearchResults && searchQuery && filteredResults.length" class="search-panel">
                <NuxtLink
                  v-for="(item, i) in filteredResults"
                  :key="item.path"
                  :to="item.path"
                  class="search-panel__row"
                  :class="{ 'search-panel__row--on': i === highlightIndex }"
                  @click="closeSearchResults(); searchOpenMobile = false">
                  <AssetIcon :name="item.icon" :size="16" class="search-panel__icon" />
                  <span class="truncate">{{ item.label }}</span>
                </NuxtLink>
              </div>

              <div v-else-if="showSearchResults && searchQuery && !filteredResults.length" class="search-panel search-panel--empty">
                No matches for "{{ searchQuery }}"
              </div>
            </Transition>
          </div>

          <!-- Right cluster -->
          <div v-show="!searchOpenMobile" class="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-auto">
            <button class="icon-btn flex sm:hidden" aria-label="Open search" @click="openMobileSearch">
              <AssetIcon name="search" :size="18" />
            </button>
            <button
              class="icon-btn flex"
              :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">
              <AssetIcon :name="isDark ? 'sun' : 'moon'" :size="18" />
            </button>
          </div>

          <button v-if="searchOpenMobile" class="icon-btn flex sm:hidden ml-1" aria-label="Close search" @click="closeMobileSearch">
            <AssetIcon name="x" :size="18" />
          </button>
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
 * Mirrors the blood-centre layout's chrome — fixed 56/64px top bar, a content
 * column that *reflows* to follow the rail's width, the same page background —
 * minus the pieces the admin console has no use for. There is no notification
 * bell because there is no admin endpoint behind it, and no account dropdown
 * because the account block lives at the foot of the rail instead. The search
 * finds pages only (2026-10-15), filtered by the account's privileges.
 *
 * Before this existed the two admin pages carried their own header, their own
 * theme toggle and their own log-out button, which is why those are removed
 * from them as part of adopting this layout.
 */
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminSidebar from '~/components/admin/sidebar.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { useUser } from '~/composables/useUser'
import { useDarkMode } from '~/composables/useDarkMode'
import { useSidebar } from '~/composables/useSidebar.js'

// 'admin' namespace, not the donor default: this layout now reflows on the
// rail's state, so inheriting a hover the donor drawer latched would move the
// page.
const { railExpanded, openMobile } = useSidebar('admin')
const { user } = useUser()
const { isDark, toggleTheme } = useDarkMode()
const route = useRoute()
const router = useRouter()

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
const breadcrumb = computed(() => `Super Admin / ${pageTitle.value}`)

const greeting = computed(() => {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const first = user.value?.full_name?.split(' ')[0] || 'Admin'

  return `${part}, ${first}!`
})

// --- Search: the admin pages, each behind the privilege its endpoints need ---
const searchablePages = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: 'layout-dashboard', keywords: 'dashboard home overview platform' },
  { label: 'Organizations', path: '/admin/facilities', icon: 'building-2', keywords: 'organizations facilities blood center hospital blood bank create', requires: 'admin.facility.manage' },
  { label: 'ID Verification', path: '/admin/donor-identities', icon: 'id-card', keywords: 'id verification donor identity approve reject', requires: 'admin.donor_identity.verify' },
  { label: 'Administrators', path: '/admin/administrators', icon: 'shield-check', keywords: 'administrators admin accounts roles', requires: 'admin.accounts.manage' },
]

const searchQuery = ref('')
const showSearchResults = ref(false)
const highlightIndex = ref(0)
const searchInput = ref(null)
const searchOpenMobile = ref(false)

const filteredResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  const held = user.value?.permissions ?? []
  return searchablePages.filter(p =>
    (!p.requires || held.includes(p.requires)) && (p.label.toLowerCase().includes(q) || p.keywords.includes(q))
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

function openMobileSearch() {
  searchOpenMobile.value = true
  nextTick(() => searchInput.value?.focus())
}

function closeMobileSearch() {
  searchOpenMobile.value = false
  clearSearch()
}

function handleEscSearch() {
  if (searchOpenMobile.value) closeMobileSearch()
  else clearSearch()
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

// ⌘F / Ctrl+F focuses the search box instead of opening browser find.
function handleGlobalKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    if (window.innerWidth < 640) openMobileSearch()
    else searchInput.value?.focus()
  }
}

// Set after mount so the server render and the first client render agree.
const shortcutLabel = ref('Ctrl F')

// Has the page scrolled? An observer on the sentinel, not a scroll listener.
const scrollSentinel = ref(null)
const isScrolled = ref(false)
let sentinelObserver = null

onMounted(() => {
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) shortcutLabel.value = '⌘F'
  window.addEventListener('keydown', handleGlobalKeydown)
  if (!scrollSentinel.value || typeof IntersectionObserver === 'undefined') return
  sentinelObserver = new IntersectionObserver(([entry]) => {
    isScrolled.value = !entry.isIntersecting
  })
  sentinelObserver.observe(scrollSentinel.value)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  sentinelObserver?.disconnect()
})

const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (event) => {
      if (!(el === event.target || el.contains(event.target))) binding.value(event)
    }
    document.addEventListener('click', el._clickOutside, true)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside, true)
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

.topbar {
  transition: left 200ms ease-out, background-color 150ms ease, box-shadow 200ms ease;
  will-change: left;
}

/* Transparent: the glow shows through the glass bar and around each page. */
main {
  background: transparent;
}

.icon-btn {
  /* No display here: the template's flex / lg:hidden decide it. */
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  color: var(--rb-text-secondary);
  transition: background-color 150ms ease, color 150ms ease;
}
.icon-btn:hover { background: var(--rb-surface-hover, #F1F5F9); color: var(--rb-text-primary); }
.icon-btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; }

.search {
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.search:hover { border-color: var(--rb-border-strong); }
.search:focus-within {
  border-color: rgba(var(--rb-primary-rgb), 0.4);
  box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.1);
}
.search__icon { color: var(--rb-text-muted); }
.search__input { color: var(--rb-text-primary); }
.search__input:focus { outline: none; }
.search__kbd {
  padding: 2px 6px;
  border: 1px solid var(--rb-border);
  border-radius: 6px;
  background: var(--rb-surface-alt, #F1F5F9);
  color: var(--rb-text-muted);
  font-family: var(--rb-font-mono, ui-monospace, monospace);
  font-size: 10px;
}
.search__clear { color: var(--rb-text-muted); }
.search__clear:hover { color: var(--rb-text-primary); }

.search-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  z-index: 40;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
  box-shadow: 0 16px 40px -16px rgba(15, 23, 42, 0.3);
}
.search-panel--empty { padding: 12px 16px; font-size: 14px; color: var(--rb-text-secondary); }
.search-panel__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  font-size: 14px;
  color: var(--rb-text-primary);
  text-decoration: none;
  transition: background-color 150ms ease;
}
.search-panel__row:hover,
.search-panel__row--on { background: var(--rb-surface-hover, #F1F5F9); }
.search-panel__icon { flex-shrink: 0; color: var(--rb-text-muted); }

.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}


@media (prefers-reduced-motion: reduce) {
  .content-shift,
  .topbar,
  .icon-btn {
    transition: none;
  }
}
</style>
