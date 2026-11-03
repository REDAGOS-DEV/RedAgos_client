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
            <li v-for="n in 3" :key="n"><HospitalNotificationRow skeleton compact /></li>
          </ul>

          <p v-else-if="error" class="bell__state">{{ error }}</p>

          <div v-else-if="!items.length" class="bell__empty">
            <span class="bell__empty-icon"><AssetIcon name="bell" :size="18" /></span>
            <p class="bell__empty-title">You're all caught up</p>
            <p class="bell__state">Request updates and stock alerts for your blood bank will appear here.</p>
          </div>

          <ul v-else class="bell__list">
            <li v-for="item in items" :key="item.id">
              <HospitalNotificationRow :item="item" compact @open="openItem" />
            </li>
          </ul>
        </div>

        <!-- The hospital keeps a full inbox, with its filters. -->
        <footer class="bell__foot">
          <NuxtLink to="/hospital/notifications" class="bell__link" @click="open = false">See all notifications</NuxtLink>
        </footer>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { useHospitalUnreadCount } from '~/composables/useHospitalUnreadCount'
import HospitalNotificationRow from '~/components/Hospital/NotificationRow.vue'
import { normalizeHospitalNotification, urgentFirst } from '~/utils/hospitalNotifications'

/**
 * The header bell for the hospital portal: the blood centre's dropdown
 * (project owner, 2026-10-28) over the hospital's notifications.
 *
 * The unread count is useHospitalUnreadCount's, which the layout polls and
 * the inbox page updates, so the badge, the panel and the inbox always agree.
 */

const PAGE_SIZE = 10

const { count: unread, set: setUnread } = useHospitalUnreadCount()

const open = ref(false)
const items = ref([])
const loading = ref(false)
const error = ref('')
const markingAll = ref(false)

async function loadItems() {
  loading.value = true
  error.value = ''
  try {
    const res = await hospitalService.listNotifications({ per_page: PAGE_SIZE })
    items.value = urgentFirst((res?.notifications ?? []).map(normalizeHospitalNotification))
    if (typeof res?.unread_count === 'number') setUnread(res.unread_count)
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
    setUnread(unread.value - 1)
    try {
      await hospitalService.markNotificationRead(item.id)
    } catch {
      // Shown as read already; the next load corrects it if the server disagrees.
    }
  }

  if (typeof item.action_path === 'string' && item.action_path.startsWith('/')) {
    open.value = false
    await navigateTo(item.action_path)
  }
}

async function markAll() {
  markingAll.value = true
  try {
    await hospitalService.markAllNotificationsRead()
    items.value = items.value.map((item) => ({ ...item, read: true }))
    setUnread(0)
  } catch {
    error.value = 'Could not mark them as read. Try again.'
  } finally {
    markingAll.value = false
  }
}
</script>

<style scoped>
/* The blood centre's bell (components/BloodCenter/NotificationBell.vue). */
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

/* On the bell's top-right corner only, so the count never covers the icon. */
.bell__badge {
  position: absolute;
  top: 3px;
  left: calc(50% + 3px);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
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
  max-width: calc(100vw - 24px);
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
  text-decoration: none;
  cursor: pointer;
}
.bell__link:hover { text-decoration: underline; text-underline-offset: 3px; }
.bell__link:disabled { opacity: 0.5; cursor: not-allowed; }
.bell__link:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; border-radius: 4px; }

.bell__body { max-height: 420px; overflow-y: auto; }
.bell__list { list-style: none; margin: 0; padding: 6px; }
.bell__foot { display: flex; justify-content: center; padding: 11px 16px; border-top: 1px solid var(--rb-border); }

.bell__empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 28px 20px; text-align: center; }
.bell__empty-icon { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.bell__empty-title { margin: 6px 0 0; font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); }
.bell__state { margin: 0; padding: 0 4px; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }
p.bell__state:only-child { padding: 20px 16px; }

.bell-pop-enter-active,
.bell-pop-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.bell-pop-enter-from,
.bell-pop-leave-to { opacity: 0; transform: translateY(6px) scale(0.98); }

@media (prefers-reduced-motion: reduce) {
  .bell-pop-enter-active, .bell-pop-leave-active { transition: none; }
}
</style>
