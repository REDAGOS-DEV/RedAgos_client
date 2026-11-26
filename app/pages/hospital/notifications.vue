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

      <!--
        Laid out as the blood centre's Notifications page (project owner,
        2026-11-27): the kinds as one tab bar, "Unread only" as a switch, and
        every notification in one card, grouped by day.
      -->
      <div class="nt__bar">
        <div class="nt__tabs" role="tablist" aria-label="Show">
          <button
            v-for="option in TABS"
            :key="option.key"
            type="button"
            role="tab"
            class="nt__tab"
            :class="{ 'nt__tab--on': tab === option.key }"
            :aria-selected="tab === option.key"
            @click="chooseTab(option.key)"
          >
            <AssetIcon :name="option.icon" :size="14" />
            {{ option.label }}
          </button>
        </div>

        <div class="nt__tools">
          <!-- The search reads the page shown. -->
          <label class="search nt__search">
            <AssetIcon name="search" :size="15" class="search__icon" />
            <input
              v-model="searchQuery"
              type="search"
              class="search__input"
              placeholder="Search this page"
              aria-label="Search the notifications on this page"
            >
          </label>
          <label class="nt__unread">
            <input v-model="unreadOnly" type="checkbox" class="nt__switch" @change="loadNotifications()">
            Unread only
            <span v-if="unreadCount" class="nt__count-pill">{{ unreadCount }}</span>
          </label>
        </div>
      </div>

      <section class="nt__card" aria-labelledby="inbox-title">
        <h2 id="inbox-title" class="sr-only">Your notifications</h2>

        <!-- Loading: what this browser last saw here, rows or the empty message. -->
        <div v-if="isLoading && !notifications.length && skeletonRows" aria-busy="true">
          <p class="nt__group-label"><span class="sk sk--line" style="width: 64px" /></p>
          <NotificationRow v-for="n in skeletonRows" :key="n" skeleton />
        </div>
        <div v-else-if="isLoading && !notifications.length" class="nt__empty" aria-busy="true">
          <span class="sk nt__empty-icon" />
          <span class="sk sk--line" style="width: 150px" />
          <span class="sk sk--line" style="width: min(360px, 80%)" />
        </div>

        <div v-else-if="!shown.length" class="nt__empty">
          <span class="nt__empty-icon" aria-hidden="true"><AssetIcon :name="hasActiveFilters ? 'search-x' : 'check-check'" :size="24" /></span>
          <h3 class="nt__empty-title">{{ hasActiveFilters ? (unreadOnly && !searchQuery.trim() ? 'Nothing unread' : 'No notifications match') : 'You\'re all caught up' }}</h3>
          <p class="nt__empty-text">
            {{ hasActiveFilters ? 'Try another kind or search, or show read ones too.' : 'No notifications at the moment. Everything is up to date.' }}
          </p>
          <button v-if="hasActiveFilters" type="button" class="ui-btn" @click="resetFilters">Clear filters</button>
        </div>

        <template v-else>
          <div :class="{ 'nt--busy': isLoading }">
            <div v-for="group in groups" :key="group.key" class="nt__group">
              <p class="nt__group-label" :class="{ 'nt__group-label--urgent': group.key === 'action' }">{{ group.label }}</p>
              <ul class="nt__list">
                <li v-for="n in group.items" :key="n.id">
                  <NotificationRow :item="n" @open="openNotification" @read="markRead" />
                </li>
              </ul>
            </div>
          </div>

          <footer class="nt__foot">
            <ListPager :page="page" :last-page="lastPage" :from="from" :to="to" :total="total" :busy="isLoading" @go="loadNotifications" />
          </footer>
        </template>
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
import { onPageReturn } from '~/composables/useKeptAlive'

const { can } = useUser()

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', keepalive: true })

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
  { key: 'request', label: 'Blood Requests', icon: 'clipboard-list' },
  { key: 'inventory', label: 'Stock Alerts', icon: 'package' },
]
const TABS = [{ key: 'all', label: 'All', icon: 'bell' }, ...CATEGORY_TABS]

const tab = ref('all')
// Unread only: a switch beside the kinds, as on the blood centre's page (2026-11-27).
const unreadOnly = ref(false)

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

const hasActiveFilters = computed(() => Boolean(tab.value !== 'all' || unreadOnly.value || searchQuery.value.trim()))

function resetFilters() {
  searchQuery.value = ''
  tab.value = 'all'
  unreadOnly.value = false
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
  if (target === 1 && meta.value.page === 1 && tabLoaded !== filterKey()) notifications.value = []
  try {
    const res = await hospitalService.listNotifications({
      page: target,
      per_page: 20,
      category: CATEGORY_TABS.some((option) => option.key === tab.value) ? tab.value : undefined,
      read: unreadOnly.value ? false : undefined,
    })
    notifications.value = (res?.notifications ?? []).map(normalizeHospitalNotification)
    meta.value = { page: 1, per_page: 20, total: 0, last_page: 1, ...(res?.meta ?? {}) }
    updatedAt.value = new Date()
    tabLoaded = filterKey()
    if (tab.value === 'all' && !unreadOnly.value && target === 1) rememberShape()
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

// What the rows on screen were loaded for: the kind and the switch.
const filterKey = () => `${tab.value}:${unreadOnly.value}`
let tabLoaded = 'all:false'

onMounted(() => {
  readShape()
  loadNotifications()
})

// Kept alive: back here, the page on screen reloads in place.
onPageReturn(() => loadNotifications(meta.value.page))
</script>

<!-- The page's parts: the blood centre's Donor Management structure (project owner, 2026-10-30). -->
<style scoped src="~/assets/css/list-ui.css"></style>

<style scoped>
/* The blood centre's Notifications page, for the blood bank (2026-11-27). */
.nt__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.nt__tabs { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 4px; border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface); }
.nt__tab { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 0; border-radius: 9px; background: transparent; font: inherit; font-size: 13px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.nt__tab:hover:not(.nt__tab--on) { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.nt__tab--on { background: var(--rb-primary); color: #fff; }
.nt__tab:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.nt__tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
.nt__search { width: 260px; }
.nt__unread { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; white-space: nowrap; }
.nt__switch { position: relative; width: 34px; height: 20px; margin: 0; border-radius: 999px; background: var(--rb-border-strong); appearance: none; cursor: pointer; transition: background-color 0.15s ease; }
.nt__switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
.nt__switch:checked { background: var(--rb-primary); }
.nt__switch:checked::after { transform: translateX(14px); }
.nt__switch:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.nt__count-pill { min-width: 18px; padding: 0 5px; border-radius: 999px; background: var(--rb-primary); color: #fff; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; }

.nt__card { padding: 8px 10px; border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); }
.nt__group-label { margin: 12px 12px 6px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--rb-text-muted); }
.nt__group-label--urgent { color: var(--rb-accent-text); }
.nt__list { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.nt__foot { margin-top: 8px; padding-top: 4px; border-top: 1px solid var(--rb-border); }
.nt--busy { opacity: 0.6; transition: opacity 0.15s ease; }

.nt__empty { display: flex; flex-direction: column; align-items: center; gap: 10px; min-height: 231px; justify-content: center; padding: 48px 24px; text-align: center; }
.nt__empty-icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); box-shadow: 0 0 0 6px rgba(var(--rb-success-rgb), 0.05); }
.nt__empty-title { margin: 6px 0 0; font-size: 17px; font-weight: 800; }
.nt__empty-text { max-width: 460px; margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--rb-text-secondary); }

@media (prefers-reduced-motion: reduce) {
  .nt__switch, .nt__switch::after { transition: none; }
}

@media (max-width: 640px) {
  .nt__search { width: 100%; }
}
</style>
