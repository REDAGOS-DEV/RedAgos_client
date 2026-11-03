<template>
  <div class="bell" @focusout="onFocusOut">
    <button
      type="button"
      class="bell__trigger"
      :aria-label="unread ? `Notifications, ${unread} unread` : 'Notifications'"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="toggle"
    >
      <AssetIcon name="bell" :size="18" />
      <span v-if="unread" class="bell__badge">{{ unread > 99 ? '99+' : unread }}</span>
    </button>

    <Transition name="bell-pop">
      <div v-if="open" class="bell__panel" role="dialog" aria-label="Notifications">
        <header class="bell__head">
          <p class="bell__title">
            Notifications
            <span v-if="unread" class="bell__count">{{ unread }} new</span>
          </p>
          <div class="bell__tools">
            <button
              v-if="unread"
              type="button"
              class="bell__link"
              :disabled="markingAll"
              @click="markAll"
            >
              Mark all as read
            </button>
            <!-- What this person is told about: their notification settings. -->
            <NuxtLink to="/blood-center/settings?tab=notifications" class="bell__gear" aria-label="Notification settings" title="Notification settings" @click="open = false">
              <AssetIcon name="settings" :size="15" />
            </NuxtLink>
          </div>
        </header>

        <!-- Unread first, as the bell is for what is new; All a click away (2026-10-31). -->
        <div class="bell__tabs" role="tablist" aria-label="Show">
          <button
            v-for="t in BELL_TABS"
            :key="t.key"
            type="button"
            role="tab"
            class="bell__tab"
            :class="{ 'bell__tab--on': bellTab === t.key }"
            :aria-selected="bellTab === t.key"
            @click="setBellTab(t.key)"
          >
            {{ t.label }}
            <span v-if="t.key === 'unread' && unread" class="bell__tab-count">{{ unread }}</span>
          </button>
        </div>

        <div class="bell__body">
          <ul v-if="loading && !items.length" class="bell__list" aria-busy="true">
            <li v-for="n in 3" :key="n" class="bell__item bell__item--skeleton">
              <span class="skeleton skeleton--icon" />
              <span class="bell__text">
                <span class="skeleton skeleton--line" />
                <span class="skeleton skeleton--short" />
              </span>
            </li>
          </ul>

          <p v-else-if="error" class="bell__state">{{ error }}</p>

          <div v-else-if="!items.length" class="bell__empty">
            <span class="bell__empty-icon"><AssetIcon name="check-check" :size="18" /></span>
            <p class="bell__empty-title">{{ bellTab === 'unread' ? 'Nothing new' : "You're all caught up" }}</p>
            <p class="bell__state">{{ emptyText }}</p>
          </div>

          <div v-else class="bell__groups">
            <section v-for="group in groups" :key="group.label" class="bell__group">
              <p class="bell__group-label" :class="{ 'bell__group-label--urgent': group.label === 'Needs attention' }">{{ group.label }}</p>
              <ul class="bell__list">
                <li v-for="item in group.items" :key="item.id">
                  <NotificationItem :item="item" @open="openItem" />
                </li>
              </ul>
            </section>
          </div>
        </div>

        <footer class="bell__foot">
          <NuxtLink to="/blood-center/notifications" class="bell__all" @click="open = false">
            View all notifications
            <AssetIcon name="arrow-right" :size="13" />
          </NuxtLink>
        </footer>
      </div>
    </Transition>

    <!-- A new emergency, said even with the bell closed (2026-10-31). -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toast" class="bell-toast" role="alert">
          <span class="bell-toast__icon" aria-hidden="true"><AssetIcon name="triangle-alert" :size="18" /></span>
          <div class="bell-toast__text">
            <p class="bell-toast__title">{{ toast.title || 'Emergency' }}</p>
            <p v-if="toast.desc" class="bell-toast__desc">{{ toast.desc }}</p>
          </div>
          <div class="bell-toast__actions">
            <button v-if="safeRoute(toast.action_route)" type="button" class="bell-toast__go" @click="openToast">
              {{ toast.action_label || 'Open' }}
            </button>
            <button type="button" class="bell-toast__close" aria-label="Dismiss" @click="toast = null">
              <AssetIcon name="x" :size="15" />
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import NotificationItem from '~/components/BloodCenter/NotificationItem.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { EMPTY_BY_DEPARTMENT, groupByDay, safeRoute } from '~/utils/staffNotifications'

/**
 * The header bell for the blood centre portal.
 *
 * It was taken out when it pointed at a page that did not exist and showed a
 * hard-coded zero. The facility notification endpoints now exist
 * (GET /blood-center/notifications, …/unread-count, PATCH …/{id},
 * POST …/mark-all-read), so it is back as a dropdown over that real data.
 * The count refreshes every minute and whenever the panel opens.
 *
 * Since 2026-10-31: Unread | All tabs, the list grouped by day with an unread
 * emergency first, each item's action as a button, a link to the full
 * Notifications page and to the notification settings, and a toast when a new
 * emergency arrives while the bell is closed.
 */

const POLL_MS = 60_000
const PAGE_SIZE = 10

const open = ref(false)
const unread = ref(0)
const items = ref([])
const loading = ref(false)
const error = ref('')
const markingAll = ref(false)
let timer = null

const BELL_TABS = [
  { key: 'unread', label: 'Unread' },
  { key: 'all', label: 'All' },
]
const bellTab = ref('unread')
const groups = computed(() => groupByDay(items.value))

const { user } = useUser()
const emptyText = computed(() => EMPTY_BY_DEPARTMENT[user.value?.department] ?? 'New requests and updates for your centre will appear here.')

function setBellTab(key) {
  if (bellTab.value === key) return
  bellTab.value = key
  loadItems()
}

// ── A new emergency, said even with the bell closed ──
const toast = ref(null)
const seenUrgent = new Set()
let toastTimer = null

async function checkUrgent() {
  try {
    const res = await bloodCenterService.listNotifications({ per_page: 5, read: false })
    const fresh = (res?.notifications ?? []).find((n) => n.urgent && !n.read && !seenUrgent.has(n.id))
    for (const n of res?.notifications ?? []) if (n.urgent) seenUrgent.add(n.id)
    if (fresh && !open.value) {
      toast.value = fresh
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => { toast.value = null }, 15000)
    }
  } catch {
    // The bell's count still shows it; a toast is a courtesy.
  }
}

async function openToast() {
  const item = toast.value
  toast.value = null
  if (item) await openItem(item)
}

let firstCount = true
async function refreshCount() {
  try {
    const res = await bloodCenterService.notificationsUnreadCount()
    const next = Number(res?.unread_count ?? 0)
    // More unread than before: see whether an emergency is among them. The
    // first count only learns what is already there, so a page load is quiet.
    if (firstCount) {
      firstCount = false
      if (next) await checkUrgent().then(() => { toast.value = null })
    } else if (next > unread.value) {
      await checkUrgent()
    }
    unread.value = next
  } catch {
    // A missed poll is not worth an error on every page; the next one retries.
  }
}

async function loadItems() {
  loading.value = true
  error.value = ''
  try {
    const res = await bloodCenterService.listNotifications({ per_page: PAGE_SIZE, ...(bellTab.value === 'unread' ? { read: false } : {}) })
    items.value = res?.notifications ?? []
    if (typeof res?.unread_count === 'number') unread.value = res.unread_count
  } catch {
    error.value = 'Notifications could not be loaded. Try again in a moment.'
  } finally {
    loading.value = false
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) loadItems()
}

function onFocusOut(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) open.value = false
}

async function openItem(item) {
  if (!item.read) {
    item.read = true
    unread.value = Math.max(0, unread.value - 1)
    try {
      await bloodCenterService.markNotificationRead(item.id)
    } catch {
      // Shown as read already; the next load corrects it if the server disagrees.
    }
  }

  const route = safeRoute(item.action_route)
  if (route) {
    open.value = false
    await navigateTo(route)
  }
}

async function markAll() {
  markingAll.value = true
  try {
    await bloodCenterService.markAllNotificationsRead()
    items.value = items.value.map((item) => ({ ...item, read: true }))
    unread.value = 0
  } catch {
    error.value = 'Could not mark them as read. Try again.'
  } finally {
    markingAll.value = false
  }
}

onMounted(() => {
  refreshCount()
  timer = setInterval(refreshCount, POLL_MS)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  clearTimeout(toastTimer)
})
</script>

<style scoped>
.bell { position: relative; }

.bell__trigger {
  position: relative;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--rb-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.bell__trigger:hover { background: var(--rb-surface-hover); }
.bell__trigger:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

/* On the bell's top-right corner only: 16px with its ring, so one digit is a
   small dot, and longer counts grow to the right, away from the icon. */
.bell__badge {
  position: absolute;
  top: 3px;
  left: calc(50% + 3px);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  /* Ring in the bar's own colour, so the badge stands off the bell. */
  border: 2px solid var(--rb-surface);
  background: var(--rb-accent);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 12px;
  text-align: center;
  box-sizing: border-box;
  pointer-events: none;
}

.bell__panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 40;
  width: 380px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 14px;
  background: var(--rb-surface);
  box-shadow: 0 16px 40px -12px rgba(var(--rb-shadow-rgb), 0.35);
  overflow: hidden;
}

.bell__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--rb-border);
}
.bell__title { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.bell__count { padding: 1px 8px; border-radius: 999px; background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); font-size: 11px; font-weight: 700; }
.bell__link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--rb-primary-text);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.bell__link:hover { text-decoration: underline; text-underline-offset: 3px; }
.bell__link:disabled { opacity: 0.5; cursor: not-allowed; }

.bell__body { max-height: 420px; overflow-y: auto; }
.bell__list { list-style: none; margin: 0; padding: 6px; }

.bell__item {
  position: relative;
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.bell__item:hover { background: var(--rb-surface-hover); }
.bell__item:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: -2px; }
.bell__item--unread { background: rgba(var(--rb-primary-rgb), 0.05); }
.bell__item--skeleton { cursor: default; }

.bell__icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
}
.bell__icon--primary, .bell__icon--info { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.bell__icon--success { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.bell__icon--warning { background: rgba(var(--rb-warning-rgb), 0.12); color: var(--rb-warning-text); }
.bell__icon--danger, .bell__icon--accent { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); }

.bell__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.bell__item-title { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.bell__item--unread .bell__item-title { font-weight: 700; }
.bell__desc {
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--rb-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bell__time { font-size: 11.5px; color: var(--rb-text-secondary); }
.bell__dot { width: 8px; height: 8px; margin-top: 6px; border-radius: 999px; background: var(--rb-primary); flex-shrink: 0; }

.bell__empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 28px 20px; text-align: center; }
.bell__empty-icon { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.bell__empty-title { margin: 6px 0 0; font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); }
.bell__state { margin: 0; padding: 0 4px; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }
p.bell__state:only-child { padding: 20px 16px; }

.skeleton {
  display: block;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: bell-shimmer 1.4s ease infinite;
}
.skeleton--icon { width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0; }
.skeleton--line { height: 12px; width: 80%; }
.skeleton--short { height: 10px; width: 45%; margin-top: 4px; }
@keyframes bell-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.bell-pop-enter-active,
.bell-pop-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.bell-pop-enter-from,
.bell-pop-leave-to { opacity: 0; transform: translateY(6px) scale(0.98); }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .bell-pop-enter-active, .bell-pop-leave-active { transition: none; }
}

/* ===== Refresh (2026-10-31) ===== */
.bell__panel { width: 400px; }
.bell__tools { display: inline-flex; align-items: center; gap: 10px; }
.bell__gear { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; color: var(--rb-text-secondary); }
.bell__gear:hover { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.bell__tabs { display: flex; gap: 4px; padding: 8px 12px 0; }
.bell__tab { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border: 0; border-radius: 8px; background: transparent; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.bell__tab:hover { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.bell__tab--on, .bell__tab--on:hover { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.bell__tab-count { min-width: 18px; padding: 0 6px; border-radius: 999px; background: var(--rb-accent); color: #fff; font-size: 10.5px; font-weight: 800; text-align: center; }
.bell__groups { padding: 4px 6px 6px; }
.bell__group-label { margin: 8px 10px 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--rb-text-muted); }
.bell__group-label--urgent { color: var(--rb-accent-text); }
.bell__groups .bell__list { padding: 0; }
.bell__foot { border-top: 1px solid var(--rb-border); }
.bell__all { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; font-size: 13px; font-weight: 600; color: var(--rb-primary-text); text-decoration: none; }
.bell__all:hover { background: var(--rb-surface-hover); }

.bell-toast { position: fixed; right: 20px; bottom: 20px; z-index: 400; display: flex; align-items: flex-start; gap: 12px; width: min(400px, calc(100vw - 32px)); padding: 14px 14px 14px 16px; border: 1px solid rgba(var(--rb-accent-rgb), 0.35); border-radius: 14px; background: var(--rb-surface); box-shadow: 0 18px 40px -12px rgba(var(--rb-shadow-rgb), 0.45); color: var(--rb-text-primary); }
.bell-toast__icon { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 10px; background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }
.bell-toast__text { flex: 1; min-width: 0; }
.bell-toast__title { margin: 2px 0 0; font-size: 13.5px; font-weight: 800; }
.bell-toast__desc { margin: 3px 0 0; font-size: 12.5px; line-height: 1.45; color: var(--rb-text-secondary); }
.bell-toast__actions { display: flex; align-items: center; gap: 4px; }
.bell-toast__go { height: 30px; padding: 0 12px; border: 0; border-radius: 8px; background: var(--rb-accent); color: #fff; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.bell-toast__close { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--rb-text-secondary); cursor: pointer; }
.bell-toast__close:hover { background: var(--rb-surface-hover); }
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(10px); }
@media (prefers-reduced-motion: reduce) { .toast-enter-active, .toast-leave-active { transition: none; } }
</style>
