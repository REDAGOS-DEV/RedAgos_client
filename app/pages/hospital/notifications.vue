<template>
  <div class="list-page">
    <div class="list-inner">
      <PageHeader title="Notifications" :subtitle="hospitalPageSubtitle('notifications', can)">
        <template #actions>
          <button
            type="button"
            class="ui-btn"
            :disabled="isLoading"
            aria-label="Refresh the list"
            :title="updatedAt ? `Refresh · updated ${updatedAtLabel}` : 'Refresh'"
            @click="loadNotifications(page)"
          >
            <AssetIcon name="refresh-cw" :size="15" :class="{ spin: isLoading }" />
            Refresh
          </button>
          <button type="button" class="ui-btn ui-btn--primary" :disabled="unreadCount === 0 || marking" @click="markAllAsRead">
            <AssetIcon name="check-check" :size="15" />
            Mark All as Read
          </button>
        </template>
      </PageHeader>

      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ loadError }}</p>
        <button type="button" class="btn-link" @click="loadNotifications(page)">Retry</button>
      </div>

      <section class="panel" aria-labelledby="inbox-title">
        <h2 id="inbox-title" class="sr-only">Your notifications</h2>

        <!-- The tabs are the server's filters, so they reach every page; the search reads the page shown. -->
        <div class="inbox-bar">
          <div class="inbox-tabs" role="group" aria-label="Show">
            <button
              v-for="option in TABS"
              :key="option.key"
              type="button"
              class="inbox-tab"
              :class="{ 'inbox-tab--on': tab === option.key }"
              :aria-pressed="tab === option.key"
              @click="chooseTab(option.key)"
            >
              {{ option.label }}
              <span v-if="option.key === 'unread' && unreadCount" class="inbox-tab__count">{{ unreadCount }}</span>
            </button>
          </div>

          <label class="search inbox-search">
            <AssetIcon name="search" :size="15" class="search__icon" />
            <input
              v-model="searchQuery"
              type="search"
              class="search__input"
              placeholder="Search this page"
              aria-label="Search the notifications on this page"
            >
          </label>
        </div>

        <!-- Loading: what this browser last saw here, rows or the empty message. -->
        <div v-if="isLoading && !notifications.length && skeletonRows" aria-busy="true">
          <p class="inbox-group__head"><span class="sk sk--line" style="width: 64px" /></p>
          <NotificationRow v-for="n in skeletonRows" :key="n" skeleton />
        </div>
        <div v-else-if="isLoading && !notifications.length" class="empty-state inbox-empty-sk" aria-busy="true">
          <span class="sk empty-state__icon" />
          <span class="sk sk--line" style="width: 150px" />
          <span class="sk sk--line" style="width: min(360px, 80%)" />
        </div>

        <div v-else-if="!shown.length" class="empty-state">
          <span class="empty-state__icon"><AssetIcon :name="hasActiveFilters ? 'search-x' : 'bell'" :size="20" /></span>
          <p class="empty-state__title">{{ hasActiveFilters ? 'No notifications match' : 'You\'re all caught up' }}</p>
          <p class="empty-state__text">
            {{ hasActiveFilters ? 'Try another search, or clear the filters.' : 'No notifications at the moment. Everything is up to date.' }}
          </p>
          <button v-if="hasActiveFilters" type="button" class="btn-outline" @click="resetFilters">Clear filters</button>
        </div>

        <div v-else :class="{ 'inbox--busy': isLoading }">
          <section v-for="group in groups" :key="group.key" class="inbox-group" :aria-label="group.label">
            <h3 class="inbox-group__head" :class="{ 'inbox-group__head--action': group.key === 'action' }">{{ group.label }}</h3>
            <NotificationRow v-for="n in group.items" :key="n.id" :item="n" @open="openNotification" @read="markRead" />
          </section>
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
import NotificationRow from '~/components/Hospital/NotificationRow.vue'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { hospitalService } from '~/api/hospital/HospitalService'
import { useHospitalUnreadCount } from '~/composables/useHospitalUnreadCount'
import { groupNotifications, normalizeHospitalNotification } from '~/utils/hospitalNotifications'
import { hospitalPageSubtitle } from '~/utils/hospitalPageSubtitles'

const { can } = useUser()

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

const router = useRouter()
const toast = useToast()
// The bell in the layout reads the same count; what changes here is told to it.
const sharedUnread = useHospitalUnreadCount()
const isLoading = ref(true)
const loadError = ref('')
const marking = ref(false)
const updatedAt = ref(null)

// ======================= TABS =======================
// The server's category names, sent as its `category` filter. Only what is
// sent to a hospital account has a tab (project owner, 2026-11-02).
const CATEGORY_TABS = [
  { key: 'request', label: 'Blood Requests' },
  { key: 'inventory', label: 'Stock Alerts' },
]
const TABS = [{ key: 'all', label: 'All' }, { key: 'unread', label: 'Unread' }, ...CATEGORY_TABS]

const tab = ref('all')

function chooseTab(key) {
  tab.value = key
  loadNotifications()
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

// ======================= SEARCH =======================
const searchQuery = ref('')

const hasActiveFilters = computed(() => Boolean(tab.value !== 'all' || searchQuery.value.trim()))

function resetFilters() {
  searchQuery.value = ''
  tab.value = 'all'
  loadNotifications()
}

// The search reads the page shown, title and text.
const shown = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return notifications.value

  return notifications.value.filter((n) => `${n.title} ${n.description}`.toLowerCase().includes(q))
})

const groups = computed(() => groupNotifications(shown.value))

// ======================= LOADING SHAPE =======================
// How many rows the inbox last opened on in this browser; a first visit has no
// record and draws a few. Zero draws the shape of the empty message.
const SHAPE_KEY = 'hospital_notifications_rows'
const skeletonRows = ref(4)

function readShape() {
  try {
    const saved = localStorage.getItem(SHAPE_KEY)
    if (saved !== null) skeletonRows.value = Math.min(10, Math.max(0, Number(saved) || 0))
  } catch {
    // Blocked storage: the first-visit rows stand.
  }
}

function rememberShape() {
  try {
    localStorage.setItem(SHAPE_KEY, String(notifications.value.length))
  } catch {
    // Blocked storage: the next load draws the first-visit rows.
  }
}

const updatedAtLabel = computed(() => (updatedAt.value
  ? updatedAt.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  : ''))

// ======================= ACTIONS =======================
// A click reads it and goes to the work it is about.
function openNotification(n) {
  if (!n.read) markRead(n)
  if (typeof n.action_path === 'string' && n.action_path.startsWith('/')) router.push(n.action_path)
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
    toast.error('Could not mark it as read. Try again.')
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
    toast.error('Could not mark them as read. Try again.')
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
  // A new tab's rows are not this one's: back to the skeleton, not the old list.
  if (target === 1 && meta.value.page === 1 && tabLoaded !== tab.value) notifications.value = []
  try {
    const res = await hospitalService.listNotifications({
      page: target,
      per_page: 20,
      category: CATEGORY_TABS.some((option) => option.key === tab.value) ? tab.value : undefined,
      read: tab.value === 'unread' ? false : undefined,
    })
    notifications.value = (res?.notifications ?? []).map(normalizeHospitalNotification)
    meta.value = { page: 1, per_page: 20, total: 0, last_page: 1, ...(res?.meta ?? {}) }
    updatedAt.value = new Date()
    tabLoaded = tab.value
    if (tab.value === 'all' && target === 1) rememberShape()
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

let tabLoaded = 'all'

onMounted(() => {
  readShape()
  loadNotifications()
})
</script>

<!-- The page's parts: the blood centre's Donor Management structure (project owner, 2026-10-30). -->
<style scoped src="~/assets/css/list-ui.css"></style>

<style scoped>
.inbox-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; padding: 12px 18px; }
.inbox-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.inbox-tab {
  display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 13px;
  border: 1px solid var(--rb-border-strong); border-radius: 999px; background: var(--rb-surface); cursor: pointer;
  color: var(--rb-text-secondary); font: inherit; font-size: 13px; font-weight: 600; white-space: nowrap;
}
.inbox-tab:hover { border-color: rgba(var(--rb-primary-rgb), 0.45); color: var(--rb-text-primary); }
.inbox-tab--on { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.inbox-tab:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.inbox-tab__count { min-width: 18px; padding: 0 5px; border-radius: 999px; background: var(--rb-primary); color: #fff; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; }
.inbox-search { flex: 0 1 300px; }

.inbox--busy { opacity: 0.6; transition: opacity 0.15s ease; }
.inbox-group__head {
  display: flex; align-items: center; min-height: 34px; margin: 0; padding: 0 18px; border-top: 1px solid var(--rb-border);
  background: var(--rb-surface-alt); font-size: 12px; font-weight: 700; color: var(--rb-text-secondary);
}
.inbox-group__head--action { color: var(--rb-accent-text); }
.inbox-empty-sk { gap: 10px; min-height: 231px; }

@media (max-width: 640px) {
  .inbox-search { flex: 1 1 100%; }
}
</style>
