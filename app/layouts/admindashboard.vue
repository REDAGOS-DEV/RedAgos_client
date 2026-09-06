<template>
  <div>
    <AdminSidebar />

    <div :class="collapsed ? 'lg:pl-20' : 'lg:pl-64'" class="transition-[padding-left] duration-200">
      <!-- Top bar -->
      <header
        class="fixed top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 h-14 sm:h-16 bg-white dark:bg-slate-900 border-b dark:border-slate-700 lg:pl-6 transition-colors duration-150"
        :class="collapsed ? 'lg:left-20' : 'lg:left-64'"
        :style="{ borderColor: headerBorderColor, boxShadow: '0 1px 2px rgba(15,23,42,0.05)' }">

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
            <span class="hidden lg:block text-[11px] text-[#94a3b8] dark:text-slate-500 leading-tight">
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
      </header>

      <main class="min-h-screen bg-[#F7F8FA] dark:bg-slate-900 transition-colors duration-150 pt-14 sm:pt-16">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
/*
 * Super Admin portal shell.
 *
 * Mirrors the donor layout's chrome — fixed 56/64px top bar, the same padding
 * that follows the rail's collapsed width, the same page background — minus the
 * pieces the admin console has no use for. There is no notification bell and no
 * global search because neither has an admin endpoint behind it, and no account
 * dropdown because the account block lives at the foot of the rail instead.
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

const { collapsed, openMobile } = useSidebar()
const { user } = useUser()
const { isDark, toggleTheme } = useDarkMode()
const route = useRoute()

const headerBorderColor = computed(() => (isDark.value ? '#334155' : '#E5EAF0'))

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
header {
  will-change: padding-left, left;
}

:global(.dark) header {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3) !important;
}

@media (max-width: 639px) {
  header {
    height: 3.75rem;
  }

  main {
    padding-top: 3.75rem;
  }
}
</style>
