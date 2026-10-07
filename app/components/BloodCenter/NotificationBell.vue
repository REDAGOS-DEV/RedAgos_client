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
          <button
            v-if="unread"
            type="button"
            class="bell__link"
            :disabled="markingAll"
            @click="markAll"
          >
            Mark all as read
          </button>
        </header>

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
            <span class="bell__empty-icon"><AssetIcon name="bell" :size="18" /></span>
            <p class="bell__empty-title">You're all caught up</p>
            <p class="bell__state">New requests and updates for your centre will appear here.</p>
          </div>

          <ul v-else class="bell__list">
            <li v-for="item in items" :key="item.id">
              <button
                type="button"
                class="bell__item"
                :class="{ 'bell__item--unread': !item.read }"
                @click="openItem(item)"
              >
                <span class="bell__icon" :class="`bell__icon--${item.tone || 'neutral'}`">
                  <AssetIcon :name="item.icon || 'bell'" :size="15" />
                </span>
                <span class="bell__text">
                  <span class="bell__item-title">{{ item.title || 'Notification' }}</span>
                  <span v-if="item.desc" class="bell__desc">{{ item.desc }}</span>
                  <span class="bell__time">
                    {{ timeAgo(item.created_at) }}
                    <template v-if="item.action_label"> · {{ item.action_label }}</template>
                  </span>
                </span>
                <span v-if="!item.read" class="bell__dot" aria-label="Unread" />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

/**
 * The header bell for the blood centre portal.
 *
 * It was taken out when it pointed at a page that did not exist and showed a
 * hard-coded zero. The facility notification endpoints now exist
 * (GET /blood-center/notifications, …/unread-count, PATCH …/{id},
 * POST …/mark-all-read), so it is back as a dropdown over that real data.
 * The count refreshes every minute and whenever the panel opens.
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

async function refreshCount() {
  try {
    const res = await bloodCenterService.notificationsUnreadCount()
    unread.value = Number(res?.unread_count ?? 0)
  } catch {
    // A missed poll is not worth an error on every page; the next one retries.
  }
}

async function loadItems() {
  loading.value = true
  error.value = ''
  try {
    const res = await bloodCenterService.listNotifications({ per_page: PAGE_SIZE })
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

  if (typeof item.action_route === 'string' && item.action_route.startsWith('/')) {
    open.value = false
    await navigateTo(item.action_route)
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

function timeAgo(iso) {
  const at = iso ? new Date(iso).getTime() : NaN
  if (Number.isNaN(at)) return ''
  const minutes = Math.round((Date.now() - at) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

onMounted(() => {
  refreshCount()
  timer = setInterval(refreshCount, POLL_MS)
})

onBeforeUnmount(() => clearInterval(timer))
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

.bell__badge {
  position: absolute;
  top: 3px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  border: 2px solid var(--rb-page-bg);
  background: var(--rb-accent);
  color: #fff;
  font-size: 9.5px;
  font-weight: 700;
  line-height: 12px;
  text-align: center;
  box-sizing: content-box;
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
</style>
