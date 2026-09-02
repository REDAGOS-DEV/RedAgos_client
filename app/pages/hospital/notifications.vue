<template>
  <div class="notif-page">
    <!-- ===================== LOADING SKELETON ===================== -->
    <div v-if="isLoading" class="page-inner">
      <div class="skeleton skeleton--title" />
      <div class="skeleton skeleton--search" />
      <div class="chip-skeleton-row">
        <div v-for="n in 7" :key="n" class="skeleton skeleton--chip" />
      </div>
      <div class="notif-list">
        <div v-for="n in 5" :key="n" class="notif-card skeleton-block">
          <div class="skeleton-line" style="width:40px;height:40px;border-radius:12px;flex-shrink:0;"></div>
          <div style="flex:1;min-width:0;">
            <div class="skeleton-line" style="width:60%;height:16px;margin-bottom:10px;"></div>
            <div class="skeleton-line" style="width:90%;height:13px;margin-bottom:8px;"></div>
            <div class="skeleton-line" style="width:30%;height:12px;"></div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="page-inner">
      <!-- ===================== PAGE HEADER ===================== -->
      <header class="notif-header fade-in" style="--delay:0ms">
        <div>
          <h1 class="notif-title">Notifications</h1>
          <p class="notif-subtitle">Stay informed with updates about your blood requests, blood availability, billing, and system announcements.</p>
        </div>
        <button type="button" class="btn-primary" :disabled="unreadCount === 0 || marking" @click="markAllAsRead">
          <AssetIcon name="check-check" :size="16" />
          Mark All as Read
        </button>
      </header>

      <!-- ===================== SEARCH ===================== -->
      <div class="notif-search-wrap fade-in" style="--delay:40ms">
        <AssetIcon name="search" :size="18" class="notif-search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          class="notif-search-input"
          placeholder="Search notifications..."
          aria-label="Search notifications"
        />
        <button v-if="searchQuery" type="button" class="notif-search-clear" @click="searchQuery = ''" aria-label="Clear search">
          <AssetIcon name="x" :size="14" />
        </button>
      </div>

      <!-- ===================== FILTER CHIPS ===================== -->
      <div class="notif-chip-row fade-in" style="--delay:70ms" role="tablist" aria-label="Notification filters">
        <button
          v-for="chip in chipOptions"
          :key="chip.key"
          type="button"
          role="tab"
          :aria-selected="activeChip === chip.key"
          class="notif-chip"
          :class="{ 'notif-chip--active': activeChip === chip.key }"
          @click="activeChip = chip.key"
        >
          {{ chip.label }}
          <span v-if="chip.key === 'unread' && rawCounts.unread > 0" class="notif-chip-count">{{ rawCounts.unread }}</span>
        </button>
      </div>

      <!-- ===================== NOTIFICATION FEED ===================== -->
      <template v-if="groupedNotifications.length">
        <section
          v-for="group in groupedNotifications"
          :key="group.key"
          class="notif-group fade-in"
          style="--delay:100ms"
        >
          <h2 class="notif-group-title">{{ group.label }}</h2>
          <div class="notif-list">
            <article
              v-for="n in group.items"
              :key="n.id"
              class="notif-card"
              :class="{ 'notif-card--unread': !n.read }"
              tabindex="0"
            >
              <div class="notif-card-icon" :style="{ background: categoryStyle(n.category).bg, color: categoryStyle(n.category).color }">
                <AssetIcon :name="categoryStyle(n.category).icon" :size="18" />
              </div>

              <div class="notif-card-body">
                <div class="notif-card-top">
                  <span v-if="!n.read" class="notif-unread-dot" aria-hidden="true"></span>
                  <h3 class="notif-card-title">{{ n.title }}</h3>
                  <span v-if="!n.read" class="notif-unread-badge">Unread</span>
                </div>

                <p class="notif-card-desc">{{ n.description }}</p>

                <div class="notif-card-bottom">
                  <span class="notif-timestamp">{{ formatTimestamp(n.created_at) }}</span>
                  <button
                    v-if="n.action_label && n.action_path"
                    type="button"
                    class="notif-action-link"
                    @click="goToAction(n)"
                  >
                    {{ n.action_label }}
                    <AssetIcon name="arrow-right" :size="14" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                class="notif-mark-btn"
                :aria-label="n.read ? 'Mark as unread' : 'Mark as read'"
                :title="n.read ? 'Mark as unread' : 'Mark as read'"
                @click="toggleRead(n)"
              >
                <AssetIcon :name="n.read ? 'mail' : 'mail-check'" :size="15" />
              </button>
            </article>
          </div>
        </section>

        <!-- LOAD MORE -->
        <div v-if="hasMore" class="notif-load-more fade-in" style="--delay:120ms">
          <button type="button" class="btn-ghost" :disabled="loadingMore" @click="loadOlderNotifications">
            <AssetIcon name="chevron-down" :size="16" />
            {{ loadingMore ? 'Loading…' : 'Load Older Notifications' }}
          </button>
        </div>
      </template>

      <!-- ===================== EMPTY STATE ===================== -->
      <div v-else class="notif-empty-state fade-in" style="--delay:100ms">
        <div class="notif-empty-illustration">
          <AssetIcon name="bell" :size="30" />
        </div>
        <h2 class="notif-empty-title">{{ hasActiveFilters ? 'No Matching Notifications' : "You're All Caught Up" }}</h2>
        <p class="notif-empty-desc">
          {{ hasActiveFilters
            ? 'No notifications match your search or filters. Try adjusting them.'
            : 'No new notifications at the moment. Everything is up to date.' }}
        </p>
        <button v-if="hasActiveFilters" type="button" class="btn-ghost" @click="resetFilters">Reset Filters</button>
        <NuxtLink v-else to="/hospital/dashboard" class="btn-primary">
          <AssetIcon name="home" :size="16" />
          Return to Dashboard
        </NuxtLink>
      </div>
    </div>
  </div>
</template>


<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { hospitalService } from '~/api/hospital/HospitalService'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

const router = useRouter()
const isLoading = ref(true)
const loadingMore = ref(false)
const marking = ref(false)

// ======================= CATEGORY STYLES =======================
const chipOptions = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'blood_request', label: 'Blood Requests' },
  { key: 'blood_availability', label: 'Blood Availability' },
  { key: 'billing', label: 'Billing' },
  { key: 'announcement', label: 'Announcements' },
  { key: 'system', label: 'System' },
]

const categoryStyleMap = {
  blood_request: { color: '#1565C0', bg: '#1565C014', icon: 'clipboard-list' },
  blood_availability: { color: '#F59E0B', bg: '#F59E0B14', icon: 'droplets' },
  pickup: { color: '#2E7D32', bg: '#2E7D3214', icon: 'package-check' },
  billing: { color: '#7C3AED', bg: '#7C3AED14', icon: 'receipt' },
  announcement: { color: '#0F766E', bg: '#0F766E14', icon: 'megaphone' },
  system: { color: '#64748B', bg: '#64748B14', icon: 'settings' },
}
function categoryStyle(key) {
  return categoryStyleMap[key] || categoryStyleMap.system
}

// ======================= STATE =======================
const notifications = ref([]) // { id, category, title, description, created_at, read, action_label, action_path }
const currentPage = ref(1)
const hasMore = ref(false)

// ======================= SEARCH & CHIP FILTER =======================
const searchQuery = ref('')
const activeChip = ref('all')

const hasActiveFilters = computed(() => activeChip.value !== 'all' || searchQuery.value.trim() !== '')

function resetFilters() {
  activeChip.value = 'all'
  searchQuery.value = ''
}

const filteredNotifications = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return notifications.value.filter((n) => {
    if (q) {
      const haystack = `${n.title} ${n.description}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (activeChip.value === 'unread') return !n.read
    if (activeChip.value !== 'all' && n.category !== activeChip.value) return false
    return true
  })
})

// ======================= GROUPED TIMELINE =======================
function dateBucket(dateStr) {
  const now = new Date()
  const d = new Date(dateStr)
  const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  const today = startOfDay(now)
  const dDay = startOfDay(d)
  const diffDays = Math.round((today - dDay) / 86400000)

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays > 1 && diffDays <= 7) return 'earlier_this_week'
  return 'earlier_this_month'
}

const bucketLabels = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier_this_week: 'Earlier This Week',
  earlier_this_month: 'Earlier This Month',
}
const bucketOrder = ['today', 'yesterday', 'earlier_this_week', 'earlier_this_month']

const groupedNotifications = computed(() => {
  const buckets = {}
  for (const n of filteredNotifications.value) {
    const key = dateBucket(n.created_at)
    if (!buckets[key]) buckets[key] = []
    buckets[key].push(n)
  }
  return bucketOrder
    .filter((key) => buckets[key]?.length)
    .map((key) => ({
      key,
      label: bucketLabels[key],
      items: buckets[key].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    }))
})

const rawCounts = computed(() => ({
  unread: notifications.value.filter((n) => !n.read).length,
}))
const unreadCount = computed(() => rawCounts.value.unread)

// ======================= FORMATTING =======================
function formatTimestamp(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ======================= ACTIONS =======================
function goToAction(n) {
  if (!n.read) toggleRead(n)
  router.push(n.action_path)
}

async function toggleRead(n) {
  const previous = n.read
  n.read = !previous
  try {
    if (n.read) {
      await hospitalService.markNotificationRead(n.id)
    } else {
      await hospitalService.markNotificationUnread(n.id)
    }
  } catch (err) {
    console.error('Failed to update notification read state:', err)
    n.read = previous
  }
}

async function markAllAsRead() {
  marking.value = true
  const unread = notifications.value.filter((n) => !n.read)
  unread.forEach((n) => { n.read = true })
  try {
    await hospitalService.markAllNotificationsRead()
  } catch (err) {
    console.error('Failed to mark all notifications as read:', err)
    unread.forEach((n) => { n.read = false })
  } finally {
    marking.value = false
  }
}

// ======================= FETCH =======================
async function loadNotifications() {
  isLoading.value = true
  currentPage.value = 1
  try {
    // Expects GET /hospital/notifications?page=1, returning either an array
    // or { data: [...], has_more: boolean }.
    const res = await hospitalService.listNotifications({ page: currentPage.value })
    const rows = Array.isArray(res) ? res : (res?.data ?? [])
    notifications.value = rows.map(normalizeNotification)
    hasMore.value = Array.isArray(res) ? false : !!res?.has_more
  } catch (err) {
    console.error('Failed to load notifications:', err)
    notifications.value = []
    hasMore.value = false
  } finally {
    isLoading.value = false
  }
}

async function loadOlderNotifications() {
  loadingMore.value = true
  try {
    const nextPage = currentPage.value + 1
    const res = await hospitalService.listNotifications({ page: nextPage })
    const rows = Array.isArray(res) ? res : (res?.data ?? [])
    notifications.value.push(...rows.map(normalizeNotification))
    currentPage.value = nextPage
    hasMore.value = Array.isArray(res) ? false : !!res?.has_more
  } catch (err) {
    console.error('Failed to load older notifications:', err)
  } finally {
    loadingMore.value = false
  }
}

function normalizeNotification(n) {
  return {
    id: n.id,
    category: n.category,
    title: n.title,
    description: n.description ?? n.message ?? '',
    created_at: n.created_at,
    read: !!n.read,
    action_label: n.action_label ?? null,
    action_path: n.action_path ?? null,
  }
}

onMounted(() => {
  loadNotifications()
})
</script>

<style scoped>
.notif-page {
  --np-primary: #1565C0;
  --np-primary-hover: #0D47A1;
  --np-bg: #F7F9FC;
  --np-card: #FFFFFF;
  --np-border: #E5EAF0;
  --np-text: #1E293B;
  --np-text-secondary: #64748B;
  --np-text-muted: #94A3B8;
  --np-success: #2E7D32;
  --np-warning: #F59E0B;
  --np-danger: #D32F2F;
  --np-purple: #7C3AED;
  --np-teal: #0F766E;
  --np-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
  --np-shadow-hover: 0 10px 28px rgba(15, 23, 42, 0.08);

  font-family: var(--rb-font-sans);
  color: var(--np-text);
  background: var(--np-bg);
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 32px 40px;
  box-sizing: border-box;
}

:global(.dark .notif-page) {
  --np-bg: #0F172A;
  --np-card: #1E293B;
  --np-border: #2A3447;
  --np-text: #F1F5F9;
  --np-text-secondary: #94A3B8;
  --np-text-muted: #64748B;
  --np-shadow: 0 4px 18px rgba(0, 0, 0, 0.25);
  --np-shadow-hover: 0 10px 28px rgba(0, 0, 0, 0.32);
}

.notif-page * { box-sizing: border-box; }

.page-inner {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ---------- MICRO-INTERACTIONS ---------- */
.fade-in { animation: np-fade-in-up 0.4s ease both; animation-delay: var(--delay, 0ms); }
@keyframes np-fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .fade-in, .skeleton-line, .notif-unread-dot { animation: none !important; transition: none !important; }
}

/* ---------- FOCUS ---------- */
.notif-page button:focus-visible,
.notif-page a:focus-visible,
.notif-page input:focus-visible,
.notif-card:focus-visible {
  outline: 2px solid var(--np-primary);
  outline-offset: 2px;
}

/* ---------- HEADER ---------- */
.notif-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.notif-title { font-size: 30px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
.notif-subtitle { font-size: 15px; font-weight: 400; color: var(--np-text-secondary); margin: 6px 0 0; max-width: 560px; }

.btn-primary {
  height: 46px; padding: 0 20px; background: var(--np-primary); color: #fff;
  border: none; border-radius: 14px; font-family: var(--rb-font-sans); font-size: 14.5px; font-weight: 600;
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer; text-decoration: none; flex-shrink: 0;
  transition: background 0.2s ease, transform 0.15s ease;
}
.btn-primary:hover { background: var(--np-primary-hover); transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.6; cursor: default; transform: none; }

.btn-ghost {
  height: 44px; padding: 0 18px; background: var(--np-card); border: 1px solid var(--np-border);
  border-radius: 12px; color: var(--np-text); font-weight: 600; font-size: 14px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 8px; transition: border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}
.btn-ghost:hover { color: var(--np-primary); border-color: var(--np-primary); transform: translateY(-1px); }
.btn-ghost:disabled { opacity: 0.6; cursor: default; transform: none; }

/* ---------- SEARCH ---------- */
.notif-search-wrap {
  position: relative;
  background: var(--np-card);
  border: 1px solid var(--np-border);
  border-radius: 14px;
  height: 46px;
  display: flex;
  align-items: center;
  box-shadow: var(--np-shadow);
}
.notif-search-icon { position: absolute; left: 16px; color: var(--np-text-secondary); pointer-events: none; }
.notif-search-input {
  width: 100%; height: 100%; padding: 0 40px 0 44px; border: none; background: transparent;
  outline: none; color: var(--np-text); font-size: 14px; font-family: var(--rb-font-sans); border-radius: 14px;
}
.notif-search-input::placeholder { color: var(--np-text-muted); }
.notif-search-clear {
  position: absolute; right: 14px; border: none; background: none; color: var(--np-text-muted);
  cursor: pointer; display: flex;
}
.notif-search-clear:hover { color: var(--np-text-secondary); }

/* ---------- FILTER CHIPS ---------- */
.notif-chip-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.notif-chip-row::-webkit-scrollbar { display: none; }
.notif-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--np-border);
  background: var(--np-card);
  color: var(--np-text-secondary);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.notif-chip:hover { background: color-mix(in srgb, var(--np-primary) 8%, var(--np-card)); color: var(--np-primary); }
.notif-chip--active {
  background: var(--np-primary);
  border-color: var(--np-primary);
  color: #fff;
}
.notif-chip--active:hover { background: var(--np-primary-hover); color: #fff; }
.notif-chip-count {
  min-width: 17px; height: 17px; padding: 0 4px; border-radius: 999px;
  background: rgba(255,255,255,0.25); font-size: 10.5px; display: inline-flex;
  align-items: center; justify-content: center;
}
.notif-chip:not(.notif-chip--active) .notif-chip-count {
  background: var(--np-danger); color: #fff;
}

/* ---------- GROUPS ---------- */
.notif-group-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--np-text);
  margin: 4px 0 12px;
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--np-bg);
  padding: 8px 0;
}
.notif-list { display: flex; flex-direction: column; gap: 12px; }

/* ---------- NOTIFICATION CARD ---------- */
.notif-card {
  background: var(--np-card);
  border: 1px solid var(--np-border);
  border-left: 4px solid transparent;
  border-radius: 18px;
  box-shadow: var(--np-shadow);
  padding: 22px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.notif-card:hover { transform: translateY(-2px); box-shadow: var(--np-shadow-hover); }
.notif-card--unread {
  border-left-color: var(--np-primary);
  background: color-mix(in srgb, var(--np-primary) 6%, var(--np-card));
}

.notif-card-icon {
  width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center;
  justify-content: center; flex-shrink: 0;
}

.notif-card-body { flex: 1; min-width: 0; }
.notif-card-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.notif-unread-dot {
  width: 8px; height: 8px; border-radius: 999px; background: var(--np-primary); flex-shrink: 0;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--np-primary) 20%, transparent);
  animation: np-pulse 2s ease-in-out infinite;
}
@keyframes np-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.notif-card-title { font-size: 16px; font-weight: 600; color: var(--np-text); margin: 0; }
.notif-unread-badge {
  font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
  background: #1565C014; color: var(--np-primary);
}
.notif-card-desc { font-size: 14px; color: var(--np-text-secondary); margin: 0 0 14px; line-height: 1.55; }
.notif-card-bottom { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.notif-timestamp { font-size: 13px; font-weight: 500; color: var(--np-text-muted); }
.notif-action-link {
  display: inline-flex; align-items: center; gap: 4px; border: none; background: none;
  color: var(--np-primary); font-size: 13.5px; font-weight: 600; padding: 0; cursor: pointer;
  transition: gap 0.15s ease;
}
.notif-action-link:hover { text-decoration: underline; }

.notif-mark-btn {
  width: 32px; height: 32px; border-radius: 9px; border: 1px solid transparent; background: none;
  color: var(--np-text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.notif-mark-btn:hover { background: var(--np-bg); border-color: var(--np-border); color: var(--np-primary); }

/* ---------- LOAD MORE ---------- */
.notif-load-more { display: flex; justify-content: center; padding-top: 4px; }

/* ---------- EMPTY STATE ---------- */
.notif-empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 44px 20px;
  background: var(--np-card); border: 1px solid var(--np-border); border-radius: 18px;
  box-shadow: var(--np-shadow);
}
.notif-empty-illustration {
  width: 64px; height: 64px; border-radius: 50%; background: var(--np-bg); display: flex;
  align-items: center; justify-content: center; color: var(--np-text-secondary); margin-bottom: 16px;
}
.notif-empty-title { font-size: 17px; font-weight: 700; margin: 0 0 6px; }
.notif-empty-desc { font-size: 13.5px; color: var(--np-text-secondary); margin: 0 0 18px; max-width: 380px; line-height: 1.55; }

/* ---------- SKELETON ---------- */
.skeleton-block { pointer-events: none; }
.skeleton-line {
  background: linear-gradient(90deg, var(--np-border) 25%, rgba(255,255,255,0.4) 37%, var(--np-border) 63%);
  background-size: 400% 100%; border-radius: 6px; animation: np-shimmer 1.4s ease infinite;
}
:global(.dark .skeleton-line) {
  background: linear-gradient(90deg, #2A3447 25%, #3A4763 37%, #2A3447 63%);
  background-size: 400% 100%;
}

.skeleton {
  background: linear-gradient(90deg, var(--np-border) 25%, rgba(255,255,255,0.4) 37%, var(--np-border) 63%);
  background-size: 400% 100%;
  border-radius: 18px;
  animation: np-shimmer 1.4s ease infinite;
}
:global(.dark .skeleton) {
  background: linear-gradient(90deg, #2A3447 25%, #3A4763 37%, #2A3447 63%);
  background-size: 400% 100%;
}
.skeleton--title { height: 56px; max-width: 380px; border-radius: 12px; margin-bottom: 4px; }
.skeleton--search { height: 46px; border-radius: 14px; }
.chip-skeleton-row { display: flex; gap: 8px; }
.skeleton--chip { height: 36px; width: 96px; border-radius: 999px; flex-shrink: 0; }

@keyframes np-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none !important; }
}

/* ---------- RESPONSIVE ---------- */
@media (max-width: 640px) {
  .notif-page { padding: 16px 16px 40px; }
  .notif-title { font-size: 22px; }
  .notif-header { flex-direction: column; align-items: stretch; }
  .btn-primary { justify-content: center; }
  .notif-card { flex-wrap: wrap; padding: 18px; }
  .notif-mark-btn { order: -1; margin-left: auto; }
}
</style>