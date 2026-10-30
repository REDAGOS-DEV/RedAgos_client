<template>
  <div class="list-page">
    <div class="list-inner">
      <PageHeader title="Notifications" subtitle="Stay informed with updates about your blood requests, blood availability, billing, and system announcements." />

      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ loadError }}</p>
        <button type="button" class="btn-link" @click="loadNotifications(page)">Retry</button>
      </div>

      <section class="panel" aria-labelledby="inbox-title">
        <h2 id="inbox-title" class="sr-only">Your notifications</h2>

        <!-- The donors page's toolbar (project owner, 2026-10-30). Category and
             status are the server's, so they reach every page; the search reads
             the page shown. -->
        <div class="toolbar">
          <div class="toolbar__filters">
            <label class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                v-model="searchQuery"
                type="search"
                class="search__input"
                placeholder="Search this page"
                aria-label="Search the notifications on this page"
              >
            </label>

            <SelectField v-model="category" class="sel-filter" size="sm" aria-label="Filter by category"
              :options="[{ value: '', label: 'All categories' }, ...categoryOptions.map((option) => ({ value: option.key, label: option.label }))]"
              @change="loadNotifications()" />

            <SelectField v-model="readFilter" class="sel-filter" size="sm" aria-label="Filter by status"
              :options="[{ value: '', label: 'All statuses' }, { value: 'unread', label: 'Unread' }, { value: 'read', label: 'Read' }]"
              @change="loadNotifications()" />
          </div>

          <div class="toolbar__actions">
            <span v-if="updatedAt" class="updated" :title="`List loaded at ${updatedAtLabel}`">
              <AssetIcon name="clock" :size="13" />
              Updated {{ updatedAtLabel }}
            </span>

            <button
              type="button"
              class="btn-outline btn-outline--squeeze"
              :disabled="isLoading"
              aria-label="Refresh the list"
              :title="updatedAt ? `Refresh · updated ${updatedAtLabel}` : 'Refresh'"
              @click="loadNotifications(page)"
            >
              <AssetIcon name="refresh-cw" :size="14" :class="{ spin: isLoading }" />
              <span class="btn-text">Refresh</span>
            </button>

            <button type="button" class="btn-primary" :disabled="unreadCount === 0 || marking" @click="markAllAsRead">
              <AssetIcon name="check-check" :size="15" />
              Mark All as Read
            </button>
          </div>
        </div>

        <div class="table-wrap" :class="{ 'table-wrap--busy': isLoading && notifications.length }">
          <table class="list-table">
            <caption class="sr-only">Notifications, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Notification</th>
                <th scope="col">Category</th>
                <th scope="col">Received</th>
                <th scope="col">Status</th>
                <th scope="col" class="c-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="isLoading && !notifications.length">
              <tr v-for="n in 6" :key="'skr-' + n">
                <td colspan="5"><span class="skeleton skeleton--line" /></td>
              </tr>
            </tbody>

            <tbody v-else-if="!shown.length">
              <tr>
                <td colspan="5" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon :name="hasActiveFilters ? 'search-x' : 'bell'" :size="20" /></span>
                    <p class="empty-state__title">{{ hasActiveFilters ? 'No notifications match' : 'You\'re all caught up' }}</p>
                    <p class="empty-state__text">
                      {{ hasActiveFilters ? 'Try another search, or clear the filters.' : 'No notifications at the moment. Everything is up to date.' }}
                    </p>
                    <button v-if="hasActiveFilters" type="button" class="btn-outline" @click="resetFilters">Clear filters</button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="n in shown" :key="n.id" class="list-row" :class="{ 'row--unread': !n.read }">
                <td>
                  <div class="notice">
                    <span class="notice__icon" :style="{ background: categoryStyle(n.category).bg, color: categoryStyle(n.category).color }">
                      <AssetIcon :name="categoryStyle(n.category).icon" :size="15" />
                    </span>
                    <div class="cell">
                      <span class="cell__main">{{ n.title }}</span>
                      <span class="cell__sub">{{ n.description }}</span>
                    </div>
                  </div>
                </td>
                <td class="nowrap">{{ categoryLabel(n.category) }}</td>
                <td class="nowrap muted" :title="n.created_at">{{ formatTimestamp(n.created_at) }}</td>
                <td>
                  <span class="badge" :class="n.read ? 'badge--neutral' : 'badge--info'">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ n.read ? 'Read' : 'Unread' }}
                  </span>
                </td>
                <td class="c-actions">
                  <div class="row-actions">
                    <button
                      v-if="n.action_label && n.action_path"
                      type="button"
                      class="icon-btn"
                      :aria-label="`${n.action_label}: ${n.title}`"
                      :title="n.action_label"
                      @click="goToAction(n)"
                    >
                      <AssetIcon name="arrow-right" :size="15" />
                    </button>
                    <!-- The API can mark a notification read but not unread again. -->
                    <button
                      type="button"
                      class="icon-btn"
                      :disabled="n.read"
                      :aria-label="n.read ? `${n.title} is read` : `Mark ${n.title} as read`"
                      :title="n.read ? 'Read' : 'Mark as read'"
                      @click="markRead(n)"
                    >
                      <AssetIcon name="check" :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ListPager :page="page" :last-page="lastPage" :from="from" :to="to" :total="total" :busy="isLoading" @go="loadNotifications" />
      </section>
    </div>
  </div>
</template>


<script setup>
import PageHeader from '~/components/ui/PageHeader.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import ListPager from '~/components/common/ListPager.vue'
import SelectField from '~/components/common/SelectField.vue'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { hospitalService } from '~/api/hospital/HospitalService'
import { useHospitalUnreadCount } from '~/composables/useHospitalUnreadCount'
import { normalizeHospitalNotification } from '~/utils/hospitalNotifications'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

const router = useRouter()
// The bell in the layout reads the same count; what changes here is told to it.
const sharedUnread = useHospitalUnreadCount()
const isLoading = ref(true)
const loadError = ref('')
const marking = ref(false)
const updatedAt = ref(null)

// ======================= CATEGORIES =======================
// The server's category names, sent as its `category` filter.
const categoryOptions = [
  { key: 'request', label: 'Blood Requests' },
  { key: 'inventory', label: 'Stock Alerts' },
  { key: 'blood_availability', label: 'Blood Availability' },
  { key: 'billing', label: 'Billing' },
  { key: 'announcement', label: 'Announcements' },
  { key: 'system', label: 'System' },
]

// Colours from the shared tokens, so each category reads the same in dark mode.
const categoryStyleMap = {
  request: { color: 'var(--rb-primary-text)', bg: 'rgba(var(--rb-primary-rgb), 0.1)', icon: 'clipboard-list' },
  inventory: { color: 'var(--rb-accent-text)', bg: 'rgba(var(--rb-accent-rgb), 0.09)', icon: 'triangle-alert' },
  blood_availability: { color: 'var(--rb-warning-text)', bg: 'rgba(var(--rb-warning-rgb), 0.12)', icon: 'droplets' },
  pickup: { color: 'var(--rb-success-text)', bg: 'rgba(var(--rb-success-rgb), 0.1)', icon: 'package-check' },
  billing: { color: 'var(--rb-purple-text)', bg: 'rgba(var(--rb-purple-rgb), 0.1)', icon: 'receipt' },
  // 'megaphone' is not in the icon set, so announcements drew no icon.
  announcement: { color: 'var(--rb-primary-text)', bg: 'rgba(var(--rb-primary-rgb), 0.1)', icon: 'info' },
  system: { color: 'var(--rb-text-secondary)', bg: 'var(--rb-surface-alt)', icon: 'settings' },
}
function categoryStyle(key) {
  return categoryStyleMap[key] || categoryStyleMap.system
}
function categoryLabel(key) {
  return categoryOptions.find((option) => option.key === key)?.label ?? (key === 'pickup' ? 'Pick-up' : 'System')
}

// ======================= STATE =======================
const notifications = ref([]) // HospitalNotificationView: see ~/utils/hospitalNotifications
const meta = ref({ page: 1, per_page: 20, total: 0, last_page: 1 })
const unreadCount = ref(0)

const page = computed(() => meta.value.page)
const lastPage = computed(() => Math.max(1, meta.value.last_page))
const total = computed(() => meta.value.total)
const from = computed(() => (total.value ? (page.value - 1) * meta.value.per_page + 1 : 0))
const to = computed(() => Math.min(page.value * meta.value.per_page, total.value))

// ======================= SEARCH & FILTERS =======================
const searchQuery = ref('')
const category = ref('')
const readFilter = ref('')

const hasActiveFilters = computed(() => Boolean(category.value || readFilter.value || searchQuery.value.trim()))

function resetFilters() {
  searchQuery.value = ''
  category.value = ''
  readFilter.value = ''
  loadNotifications()
}

// The search reads the page shown, title and text.
const shown = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return notifications.value

  return notifications.value.filter((n) => `${n.title} ${n.description}`.toLowerCase().includes(q))
})

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

const updatedAtLabel = computed(() => (updatedAt.value
  ? updatedAt.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  : ''))

// ======================= ACTIONS =======================
function goToAction(n) {
  if (!n.read) markRead(n)
  router.push(n.action_path)
}

// The API can mark a notification read but has no way to mark it unread again,
// so the row offers only the one direction.
async function markRead(n) {
  if (n.read) return

  n.read = true
  unreadCount.value = Math.max(0, unreadCount.value - 1)
  try {
    await hospitalService.markNotificationRead(n.id)
    sharedUnread.refresh()
  } catch (err) {
    console.error('Failed to mark the notification as read:', err)
    n.read = false
    unreadCount.value += 1
  }
}

async function markAllAsRead() {
  marking.value = true
  const unread = notifications.value.filter((n) => !n.read)
  unread.forEach((n) => { n.read = true })
  try {
    await hospitalService.markAllNotificationsRead()
    sharedUnread.set(0)
    unreadCount.value = 0
  } catch (err) {
    console.error('Failed to mark all notifications as read:', err)
    unread.forEach((n) => { n.read = false })
  } finally {
    marking.value = false
  }
}

// ======================= FETCH =======================
// GET /hospital/notifications?page=N&category=&read= returns
// { notifications: [...], unread_count, meta: { page, per_page, total, last_page } }.
async function loadNotifications(target = 1) {
  isLoading.value = true
  loadError.value = ''
  try {
    const res = await hospitalService.listNotifications({
      page: target,
      per_page: 20,
      category: category.value || undefined,
      read: readFilter.value ? readFilter.value === 'read' : undefined,
    })
    notifications.value = (res?.notifications ?? []).map(normalizeHospitalNotification)
    meta.value = { page: 1, per_page: 20, total: 0, last_page: 1, ...(res?.meta ?? {}) }
    updatedAt.value = new Date()
    if (typeof res?.unread_count === 'number') {
      unreadCount.value = res.unread_count
      sharedUnread.set(res.unread_count)
    }
  } catch (err) {
    console.error('Failed to load notifications:', err)
    loadError.value = err?.message || 'Your notifications could not be loaded.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadNotifications()
})
</script>

<!-- The list: the blood centre's Donor Management structure (project owner, 2026-10-30). -->
<style scoped src="~/assets/css/list-ui.css"></style>

<style scoped>
/* A notification: its category's icon tile beside the title and text. */
.notice { display: flex; align-items: flex-start; gap: 10px; min-width: 260px; }
.notice__icon { display: grid; flex-shrink: 0; place-items: center; width: 30px; height: 30px; border-radius: 9px; }
.notice .cell__sub { margin-top: 2px; line-height: 1.45; }

/* Unread reads heavier; a read one steps back. */
.row--unread .cell__main { color: var(--rb-text-primary); }
.list-row:not(.row--unread) .cell__main { font-weight: 600; color: var(--rb-text-secondary); }
</style>
