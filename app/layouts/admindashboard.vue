<template>
  <div>
    <AdminSidebar />

    <!--
      The content column tracks the rail's width instead of a fixed lg:pl-20.
      Padding — not a margin or a transform — because it is the one property
      that both reserves the space and reflows the children inside it, which is
      what keeps the widened sidebar beside the page rather than over it.
    -->
    <div class="content-shift" :class="railExpanded ? 'lg:pl-64' : 'lg:pl-20'">
      <!-- Top bar -->
      <header
        class="topbar fixed top-0 left-0 right-0 z-30 h-14 sm:h-16 bg-white dark:bg-slate-900 border-b"
        :class="railExpanded ? 'lg:left-64' : 'lg:left-20'"
        :style="{ borderColor: headerBorderColor, boxShadow: headerShadow }">

        <!--
          The bar spans the full width — it carries the background and the
          divider — but its contents sit in the same centred 1280px column the
          admin pages use, with the same 16/32px gutters, so the breadcrumb
          lines up with the page title directly beneath it.
        -->
        <div class="mx-auto flex h-full w-full max-w-[1280px] items-center justify-between gap-2 sm:gap-3 px-4 sm:px-8">
          <!-- Left cluster -->
          <div class="flex items-center gap-2 min-w-0">
            <button
              class="lg:hidden w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
              aria-label="Open menu" @click="openMobile">
              <AssetIcon name="menu" :size="20" class="text-[#64748b] dark:text-slate-300" />
            </button>

            <span class="sm:hidden font-bold text-sm text-gray-800 dark:text-slate-100 truncate">
              {{ pageTitle }}
            </span>

            <div class="hidden sm:flex flex-col justify-center min-w-0 flex-shrink">
              <span class="hidden lg:block text-[11px] text-[#94a3b8] dark:text-slate-500 leading-tight truncate">
                {{ breadcrumb }}
              </span>
              <span class="text-xs sm:text-sm font-semibold text-gray-800 dark:text-slate-100 truncate leading-tight">
                {{ greeting }}
              </span>
            </div>
          </div>

          <!-- Right cluster -->
          <div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              class="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#F1F5F9] dark:hover:bg-slate-800"
              :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">
              <AssetIcon :name="isDark ? 'sun' : 'moon'" :size="18" class="text-[#64748b] dark:text-slate-300" />
            </button>
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
 * Mirrors the blood-centre layout's chrome — fixed 56/64px top bar, a content
 * column that *reflows* to follow the rail's width, the same page background —
 * minus the pieces the admin console has no use for. There is no notification
 * bell and no global search because neither has an admin endpoint behind it,
 * and no account dropdown because the account block lives at the foot of the
 * rail instead.
 *
 * Before this existed the two admin pages carried their own header, their own
 * theme toggle and their own log-out button, which is why those are removed
 * from them as part of adopting this layout.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
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

const headerBorderColor = computed(() => (isDark.value ? '#334155' : '#E5EAF0'))
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
  transition: left 200ms ease-out, background-color 150ms ease, border-color 150ms ease;
  will-change: left;
}

main {
  background: var(--rb-page-bg);
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
</style>
