<template>
  <div class="dash-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="brand">
          <span class="brand-red">Red</span><span class="brand-white">Agos</span>
        </div>
        <p class="brand-subtitle">Donor Portal</p>
      </div>

      <div class="search-box">
        <AssetIcon name="search" :size="16" />
        <span>Search...</span>
      </div>

      <nav class="nav-block">
        <NuxtLink
          v-for="item in mainNav"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ 'nav-item--active': isActive(item.to) }"
        >
          <AssetIcon :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <div class="nav-section">
        <div class="nav-section__header">
          <span>DONORS</span>
          <button class="add-btn" aria-label="Add donor record">
            <AssetIcon name="plus" :size="14" />
          </button>
        </div>
        <nav class="nav-block">
          <NuxtLink
            v-for="item in donorsNav"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :class="{ 'nav-item--active': isActive(item.to) }"
          >
            <AssetIcon :name="item.icon" :size="18" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </nav>
      </div>

      <div class="nav-section">
        <div class="nav-section__header">
          <span>RECORDS</span>
        </div>
        <nav class="nav-block">
          <NuxtLink
            v-for="item in recordsNav"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :class="{ 'nav-item--active': isActive(item.to) }"
          >
            <AssetIcon :name="item.icon" :size="18" />
            <span>{{ item.label }}</span>
            <span v-if="item.tag" class="nav-tag">{{ item.tag }}</span>
          </NuxtLink>
        </nav>
      </div>

      <nav class="nav-block nav-block--footer">
        <NuxtLink
          v-for="item in footerNav"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ 'nav-item--active': isActive(item.to) }"
        >
          <AssetIcon :name="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <NuxtLink to="/signup/donor/Profile" class="user-card">
        <img v-if="currentUser.avatar" :src="currentUser.avatar" class="user-avatar" alt="" />
        <div v-else class="user-avatar user-avatar--placeholder">
          {{ currentUser.name.charAt(0) }}
        </div>
        <div class="user-info">
          <p class="user-name">{{ currentUser.name }}</p>
          <p class="user-email">{{ currentUser.email }}</p>
        </div>
        <AssetIcon name="chevron-right" :size="16" />
      </NuxtLink>
    </aside>

    <!-- Main column -->
    <div class="main-column">
      <header class="topbar">
        <button class="topbar-back" aria-label="Go back" @click="$router.back()">
          <AssetIcon name="chevron-left" :size="20" />
        </button>

        <div class="topbar-brand">
          <div class="topbar-logo">
            <AssetIcon name="droplet" :size="20" />
          </div>
          <span class="topbar-title">
            <span class="brand-red">Red</span><span class="brand-white">Agos</span>
          </span>
        </div>

        <span class="topbar-section">Donor Portal</span>

        <div class="topbar-actions">
          <button class="icon-btn" aria-label="Notifications">
            <AssetIcon name="bell" :size="20" />
            <span v-if="notificationCount" class="icon-btn__badge">{{ notificationCount }}</span>
          </button>
          <NuxtLink to="/signup/donor/Profile" class="topbar-avatar">
            <img v-if="currentUser.avatar" :src="currentUser.avatar" alt="" />
            <span v-else>{{ currentUser.name.charAt(0) }}</span>
          </NuxtLink>
        </div>
      </header>

      <main class="content-area">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
// layouts/dashboard.vue
// Wraps every page under /signup/donor (and similar dashboard pages) with a sidebar + topbar.
// Usage in a page: definePageMeta({ layout: 'dashboard' })

const route = useRoute()

const mainNav = [
  { label: 'Dashboard', icon: 'home', to: '/signup/donor/Dashboard' },
  { label: 'Schedule', icon: 'calendar', to: '/signup/donor/Schedule' },
]

const donorsNav = [
  { label: 'Eligibility Screening', icon: 'clipboard-check', to: '/signup/donor/EligibilityScreening' },
  { label: 'Book Appointment', icon: 'calendar-plus', to: '/signup/donor/Appointments' },
]

const recordsNav = [
  { label: 'Donation History', icon: 'history', to: '/signup/donor/DonationHistory' },
  { label: 'My QR Code', icon: 'qr-code', to: '/signup/donor/MyQrCode', tag: 'Valid' },
  { label: 'My Profile', icon: 'user', to: '/signup/donor/Profile' },
]

const footerNav = [
  { label: 'Settings', icon: 'settings', to: '/signup/donor/Settings' },
  { label: 'Help', icon: 'help-circle', to: '/signup/donor/Help' },
]

const isActive = (to) => route.path === to

// Swap this out for the logged-in donor's real data (e.g. from a useAuth()/useDonor() composable)
const currentUser = reactive({
  name: 'Zhao Lusi',
  email: 'lusicutie@gmail.com',
  avatar: '',
})

const notificationCount = ref(3)
</script>

<style scoped>
.dash-shell {
  --primary: #1565c0;
  --secondary: #42a5f5;
  --bg: #f1f6fb;
  --surface: #ffffff;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --sidebar-bg: #1f2937;
  --sidebar-bg-active: #2c394a;

  display: flex;
  min-height: 100vh;
  background: var(--bg);
}

/* ===== Sidebar ===== */
.sidebar {
  width: 264px;
  flex-shrink: 0;
  background: var(--sidebar-bg);
  color: #d1d5db;
  display: flex;
  flex-direction: column;
  padding: 20px 16px;
}

.sidebar-header { padding: 4px 8px 16px; }
.brand { font-size: 20px; font-weight: 800; }
.brand-red { color: var(--accent); }
.brand-white { color: #ffffff; }
.brand-subtitle { margin: 2px 0 0; font-size: 12px; color: #9ca3af; }

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 16px;
}

.nav-block { display: flex; flex-direction: column; gap: 2px; }
.nav-block--footer { margin-top: auto; padding-top: 12px; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 8px;
  font-size: 14px;
  color: #d1d5db;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}
.nav-item:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
.nav-item--active {
  background: var(--primary);
  color: #ffffff;
  font-weight: 600;
}
.nav-item span:first-of-type { flex: 1; }
.nav-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--success) 30%, transparent);
  color: #a7f3d0;
}

.nav-section { margin-top: 18px; }
.nav-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #6b7280;
}
.add-btn {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.add-btn:hover { background: var(--primary); color: white; }

.user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  text-decoration: none;
  color: inherit;
}
.user-card:hover { background: rgba(255, 255, 255, 0.09); }
.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.user-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--secondary);
  color: white;
  font-weight: 700;
  font-size: 14px;
}
.user-info { flex: 1; min-width: 0; }
.user-name { margin: 0; font-size: 13px; font-weight: 600; color: #fff; }
.user-email {
  margin: 0;
  font-size: 11px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== Main column ===== */
.main-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 24px;
  background: linear-gradient(90deg, var(--primary), var(--secondary));
  color: white;
}
.topbar-back {
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 8px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
}
.topbar-back:hover { background: rgba(255, 255, 255, 0.25); }

.topbar-brand { display: flex; align-items: center; gap: 8px; }
.topbar-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}
.topbar-title { font-size: 16px; font-weight: 800; }
.topbar-title .brand-white { color: white; }
.topbar-title .brand-red { color: #ffd8d8; }

.topbar-section {
  font-size: 13px;
  opacity: 0.85;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.3);
}

.topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
}
.icon-btn {
  position: relative;
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
}
.icon-btn__badge {
  position: absolute;
  top: -6px;
  right: -8px;
  background: var(--accent);
  color: white;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
}
.topbar-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: white;
  text-decoration: none;
}
.topbar-avatar img { width: 100%; height: 100%; object-fit: cover; }

.content-area {
  flex: 1;
  overflow-y: auto;
}

/* ===== Responsive ===== */
@media (max-width: 1024px) {
  .sidebar { width: 220px; }
}
@media (max-width: 768px) {
  .sidebar { display: none; } /* swap for a slide-out drawer if you need mobile nav */
  .topbar-section { display: none; }
}
</style>