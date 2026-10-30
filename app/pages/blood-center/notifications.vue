<template>
  <!--
    Every notification this person has had (2026-10-31): by kind, grouped by
    day with an unread emergency first, older ones a "Load more" away. The bell
    shows the newest; this is where the rest are.
  -->
  <div class="nt">
    <PageHeader title="Notifications" subtitle="What needs you, and what happened at your centre.">
      <template #actions>
        <button v-if="unread" type="button" class="ui-btn" :disabled="markingAll" @click="markAll">
          <AssetIcon name="check-check" :size="15" />
          {{ markingAll ? 'Marking…' : 'Mark all as read' }}
        </button>
        <NuxtLink to="/blood-center/settings?tab=notifications" class="ui-btn">
          <AssetIcon name="settings" :size="15" />
          Settings
        </NuxtLink>
      </template>
    </PageHeader>

    <div class="nt__bar">
      <div class="nt__tabs" role="tablist" aria-label="Show">
        <button
          v-for="t in NOTIFICATION_TABS"
          :key="t.key"
          type="button"
          role="tab"
          class="nt__tab"
          :class="{ 'nt__tab--on': category === t.key }"
          :aria-selected="category === t.key"
          @click="setCategory(t.key)"
        >
          <AssetIcon :name="t.icon" :size="14" />
          {{ t.label }}
        </button>
      </div>
      <label class="nt__unread">
        <input v-model="unreadOnly" type="checkbox" class="nt__switch" @change="load()">
        Unread only
      </label>
    </div>

    <p v-if="error" class="nt__error" role="alert">
      {{ error }} <button type="button" class="nt__link" @click="load()">Try again</button>
    </p>

    <section class="nt__card" aria-label="Notifications">
      <div v-if="loading && !items.length" class="nt__skeletons" aria-busy="true">
        <span v-for="n in 5" :key="n" class="nt__skeleton" />
      </div>

      <div v-else-if="!items.length" class="nt__empty">
        <span class="nt__empty-icon" aria-hidden="true"><AssetIcon name="check-check" :size="24" /></span>
        <h2 class="nt__empty-title">{{ unreadOnly ? 'Nothing unread' : "You're all caught up" }}</h2>
        <p class="nt__empty-text">{{ category || unreadOnly ? 'Nothing here. Try another kind, or show read ones too.' : emptyText }}</p>
      </div>

      <template v-else>
        <div v-for="group in groups" :key="group.label" class="nt__group">
          <p class="nt__group-label" :class="{ 'nt__group-label--urgent': group.label === 'Needs attention' }">{{ group.label }}</p>
          <ul class="nt__list">
            <li v-for="item in group.items" :key="item.id">
              <NotificationItem :item="item" roomy @open="openItem" />
            </li>
          </ul>
        </div>

        <footer class="nt__foot">
          <span class="nt__count">{{ items.length }} of {{ total }}</span>
          <button v-if="page < lastPage" type="button" class="ui-btn" :disabled="loading" @click="load(page + 1)">
            {{ loading ? 'Loading…' : 'Load more' }}
          </button>
        </footer>
      </template>
    </section>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import NotificationItem from '~/components/BloodCenter/NotificationItem.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { EMPTY_BY_DEPARTMENT, NOTIFICATION_TABS, groupByDay, safeRoute } from '~/utils/staffNotifications'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
})

const PER_PAGE = 20

const items = ref([])
const category = ref('')
const unreadOnly = ref(false)
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)
const unread = ref(0)
const loading = ref(false)
const markingAll = ref(false)
const error = ref('')

const groups = computed(() => groupByDay(items.value))
const { user } = useUser()
const emptyText = computed(() => EMPTY_BY_DEPARTMENT[user.value?.department] ?? 'New requests and updates for your centre appear here.')

/** The first page, or the next one added below what is shown. */
async function load(next = 1) {
  loading.value = true
  error.value = ''
  try {
    const res = await bloodCenterService.listNotifications({
      per_page: PER_PAGE,
      page: next,
      ...(category.value ? { category: category.value } : {}),
      ...(unreadOnly.value ? { read: false } : {}),
    })
    const list = res?.notifications ?? []
    items.value = next === 1 ? list : [...items.value, ...list]
    page.value = res?.meta?.page ?? next
    lastPage.value = res?.meta?.last_page ?? 1
    total.value = res?.meta?.total ?? items.value.length
    if (typeof res?.unread_count === 'number') unread.value = res.unread_count
  } catch {
    error.value = 'Notifications could not be loaded.'
  } finally {
    loading.value = false
  }
}

function setCategory(key) {
  if (category.value === key) return
  category.value = key
  load()
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
  if (route) await navigateTo(route)
}

async function markAll() {
  markingAll.value = true
  try {
    await bloodCenterService.markAllNotificationsRead()
    items.value = items.value.map(item => ({ ...item, read: true }))
    unread.value = 0
  } catch {
    error.value = 'Could not mark them as read. Try again.'
  } finally {
    markingAll.value = false
  }
}

onMounted(() => load())
</script>

<style scoped>
.nt { max-width: var(--rb-content-max, 1600px); margin: 0 auto; padding: 24px var(--rb-gutter, 24px) 40px; display: flex; flex-direction: column; gap: 16px; color: var(--rb-text-primary); }
.nt .ui-btn { text-decoration: none; }

.nt__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.nt__tabs { display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 4px; border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface); }
.nt__tab { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 0; border-radius: 9px; background: transparent; font: inherit; font-size: 13px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.nt__tab:hover:not(.nt__tab--on) { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.nt__tab--on { background: var(--rb-primary); color: #fff; }
.nt__tab:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.nt__unread { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.nt__switch { position: relative; width: 34px; height: 20px; margin: 0; border-radius: 999px; background: var(--rb-border-strong); appearance: none; cursor: pointer; transition: background-color 0.15s ease; }
.nt__switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
.nt__switch:checked { background: var(--rb-primary); }
.nt__switch:checked::after { transform: translateX(14px); }
.nt__switch:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.nt__error { margin: 0; padding: 10px 14px; border-radius: 10px; background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); font-size: 13px; }
.nt__link { border: 0; background: none; font: inherit; font-weight: 600; color: inherit; text-decoration: underline; cursor: pointer; }

.nt__card { padding: 8px 10px; border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); }
.nt__group-label { margin: 12px 12px 6px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--rb-text-muted); }
.nt__group-label--urgent { color: var(--rb-accent-text); }
.nt__list { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.nt__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; padding: 12px 8px 6px; border-top: 1px solid var(--rb-border); }
.nt__count { font-size: 12.5px; color: var(--rb-text-secondary); }

.nt__skeletons { display: flex; flex-direction: column; gap: 10px; padding: 10px; }
.nt__skeleton { height: 64px; border-radius: 12px; background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%); background-size: 400% 100%; animation: nt-shimmer 1.4s ease infinite; }
@keyframes nt-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.nt__empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 24px; text-align: center; }
.nt__empty-icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); box-shadow: 0 0 0 6px rgba(var(--rb-success-rgb), 0.05); }
.nt__empty-title { margin: 6px 0 0; font-size: 17px; font-weight: 800; }
.nt__empty-text { max-width: 460px; margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--rb-text-secondary); }

@media (prefers-reduced-motion: reduce) {
  .nt__skeleton { animation: none; }
  .nt__switch, .nt__switch::after { transition: none; }
}
</style>
