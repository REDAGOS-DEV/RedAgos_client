<template>
    <div class="notifications-page">
        <div class="header-row">
            <div>
                <h1 class="page-title">Notifications</h1>
                <p class="page-subtitle">Updates about your screening, bookings and donations.</p>
            </div>
            <button
                type="button"
                class="btn-outline"
                :disabled="totalUnread === 0"
                @click="markAllAsRead"
            >
                <AssetIcon name="check-check" :size="15" />
                Mark all as read
            </button>
        </div>

        <!-- Filters: pills, each with its unread count -->
        <div v-if="!loading" class="filters" role="tablist" aria-label="Filter notifications">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                type="button"
                role="tab"
                class="filter"
                :class="{ 'filter--active': activeTab === tab.key }"
                :aria-selected="activeTab === tab.key"
                @click="activeTab = tab.key"
            >
                {{ tab.label }}
                <span v-if="tab.unread > 0" class="filter__count">{{ tab.unread }}</span>
            </button>
        </div>
        <div v-else class="filters">
            <div v-for="n in 5" :key="n" class="skeleton skeleton-pill" />
        </div>

        <!-- Loading -->
        <div v-if="loading" class="panel notif-list" aria-busy="true">
            <div v-for="n in 4" :key="n" class="notif-row">
                <div class="skeleton skeleton-icon" />
                <div class="notif-row__body">
                    <div class="skeleton skeleton-line" style="width:45%;height:14px" />
                    <div class="skeleton skeleton-line" style="width:80%;height:12px;margin-top:8px" />
                    <div class="skeleton skeleton-line" style="width:25%;height:11px;margin-top:8px" />
                </div>
            </div>
        </div>

        <!-- Empty -->
        <div v-else-if="filteredNotifications.length === 0" class="panel state-wrap">
            <span class="state-icon"><AssetIcon name="bell" :size="26" /></span>
            <p class="state-title">You're all caught up</p>
            <p class="state-sub">{{ emptyStateMessage }}</p>
        </div>

        <!-- Grouped by day: Today, Yesterday, This week, Earlier -->
        <div v-else class="day-groups">
            <section v-for="group in groupedNotifications" :key="group.key" class="day-group"
                :aria-labelledby="`day-${group.key}`">
                <h2 :id="`day-${group.key}`" class="day-label">{{ group.label }}</h2>
                <div class="panel notif-list">
                    <article
                        v-for="notif in group.items"
                        :key="notif.id"
                        class="notif-row"
                        :class="{ 'notif-row--unread': !notif.read }"
                    >
                        <div class="notif-row__icon" :class="`notif-row__icon--${notif.tone}`">
                            <AssetIcon :name="notif.icon" :size="18" />
                        </div>

                        <div class="notif-row__body">
                            <p class="notif-row__title">
                                <span v-if="!notif.read" class="notif-row__dot" aria-label="Unread" />
                                {{ notif.title }}
                            </p>
                            <p class="notif-row__desc">{{ notif.desc }}</p>
                            <p class="notif-row__meta">
                                <span class="notif-tag" :class="`notif-tag--${notif.category}`">{{ categoryLabel(notif.category) }}</span>
                                <span>{{ notif.meta }}</span>
                            </p>
                        </div>

                        <div class="notif-row__side">
                            <NuxtLink :to="notif.actionRoute" class="notif-row__action">
                                {{ notif.actionLabel }}
                                <AssetIcon name="arrow-right" :size="13" />
                            </NuxtLink>
                            <button
                                v-if="!notif.read"
                                type="button"
                                class="notif-row__mark-read"
                                @click="markAsRead(notif)"
                            >
                                Mark as read
                            </button>
                            <span v-else class="notif-row__read-status">
                                <AssetIcon name="check" :size="12" /> Read
                            </span>
                        </div>
                    </article>
                </div>
            </section>
        </div>
    </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true,
})

import AssetIcon from '~/components/common/AssetIcon.vue'
import { donorService } from '~/api/donor/DonorService'


const loading = ref(true)
const activeTab = ref('all')

// Real state: empty until the backend returns actual notifications tied to
// this donor's records/interactions (screening submitted, appointment booked,
// QR generated, donation logged, etc.). Nothing is fabricated client-side.
const notifications = ref([])

const categoryLabels = {
    reminder: 'Reminder',
    donation: 'Donation',
    screening: 'Screening',
    system: 'System',
}

function categoryLabel(key) {
    return categoryLabels[key] ?? key
}

const tabDefs = [
    { key: 'all', label: 'All', category: null },
    { key: 'reminder', label: 'Reminders', category: 'reminder' },
    { key: 'donation', label: 'Donations', category: 'donation' },
    { key: 'screening', label: 'Screening', category: 'screening' },
    { key: 'system', label: 'System', category: 'system' },
]

const tabs = computed(() =>
    tabDefs.map(tab => ({
        ...tab,
        unread: tab.category === null
            ? notifications.value.filter(n => !n.read).length
            : notifications.value.filter(n => n.category === tab.category && !n.read).length,
    }))
)

const totalUnread = computed(() => notifications.value.filter(n => !n.read).length)

const filteredNotifications = computed(() => {
    if (activeTab.value === 'all') return notifications.value
    return notifications.value.filter(n => n.category === activeTab.value)
})

// Newest first (the server's order), under Today / Yesterday / This week /
// Earlier. A notification without a date goes under Earlier.
function dayKey(value) {
    const d = value ? new Date(value) : null
    if (!d || Number.isNaN(d.getTime())) return 'earlier'
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const day = new Date(d)
    day.setHours(0, 0, 0, 0)
    const diff = Math.round((today - day) / 86400000)
    if (diff <= 0) return 'today'
    if (diff === 1) return 'yesterday'
    if (diff < 7) return 'week'
    return 'earlier'
}

const DAY_LABELS = { today: 'Today', yesterday: 'Yesterday', week: 'This week', earlier: 'Earlier' }

const groupedNotifications = computed(() => {
    const groups = []
    for (const notif of filteredNotifications.value) {
        const key = dayKey(notif.createdAt)
        let group = groups.find(g => g.key === key)
        if (!group) {
            group = { key, label: DAY_LABELS[key], items: [] }
            groups.push(group)
        }
        group.items.push(notif)
    }
    return groups
})

const emptyStateMessage = computed(() => {
    if (activeTab.value === 'all') {
        return "You'll see updates here once you complete a screening, book an appointment, or make a donation."
    }
    return `No ${categoryLabel(activeTab.value).toLowerCase()} notifications yet.`
})

async function markAsRead(notif) {
    notif.read = true
    try {
        // PATCH /api/donors/notifications/{uuid}
        // Walay body ni: ang server mo-mark ra as read, dili siya mo-set og
        // arbitrary nga read value.
        await donorService.markNotificationAsRead(notif.id)
    } catch (err) {
        console.error('Failed to mark notification as read:', err)
        notif.read = false
    }
}

async function markAllAsRead() {
    const previouslyUnread = notifications.value.filter(n => !n.read).map(n => n.id)
    notifications.value.forEach(n => { n.read = true })
    try {
        // POST /api/donors/notifications/mark-all-read
        await donorService.markAllNotificationsAsRead()
    } catch (err) {
        console.error('Failed to mark all notifications as read:', err)
        // Roll back optimistic update on failure
        notifications.value.forEach(n => {
            if (previouslyUnread.includes(n.id)) n.read = false
        })
    }
}

// Gi-keepalive ni nga page. Tan-awa ang AppointmentsPage para sa detalye —
// ang onActivated mo-refresh sa background nga walay skeleton, ug gi-guard sa
// loadedOnce kay mo-fire sad siya human sa unang onMounted.
let loadedOnce = false

async function load({ silent = false } = {}) {
    if (!silent) loading.value = true
    try {
        // GET /api/donors/notifications
        // Response: { notifications: [{ id (uuid), category, title, desc, meta,
        //   icon, tone, read, action_label, action_route, created_at }],
        //   unread_count, meta: { page, per_page, total, last_page } }
        // Paginated (20 kada page); ang unang page ra ang gipakita karon.
        const data = await donorService.notifications()
        notifications.value = (data?.notifications ?? []).map(n => ({
            id: n.id,
            category: n.category,
            title: n.title,
            desc: n.desc,
            meta: n.meta,
            icon: n.icon,
            tone: n.tone,
            read: n.read,
            actionLabel: n.action_label,
            actionRoute: n.action_route,
            createdAt: n.created_at,
        }))
    } catch (err) {
        console.error('Failed to load notifications:', err)
        notifications.value = []
    } finally {
        loading.value = false
        loadedOnce = true
    }
}

onMounted(() => load())
onActivated(() => {
    if (loadedOnce) load({ silent: true })
})
</script>

<style scoped>
.notifications-page {
    --primary: var(--rb-primary);
    --accent: #C62828;
    --success: #2e7d32;
    --warning: #B45309;
    --text-primary: #1f2937;
    --text-secondary: #94A3B8;
    --border: #eef0f3;
    /* Full-width background, with the list kept to a readable 960px. */
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px max(32px, calc((100% - 960px) / 2)) 40px;
    display: flex;
    background: var(--rb-page-bg);
    flex-direction: column;
    gap: 18px;
}

.header-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.page-title { font-size: var(--rb-fs-title); font-weight: 700; color: var(--text-primary); margin: 0; }
.page-subtitle { font-size: var(--rb-fs-small); color: var(--text-secondary); margin: 2px 0 0; }

/* Filter pills. Five do not fit a phone: scroll sideways inside the row. */
.filters {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 2px;
    min-height: 40px;
}

.filter {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 999px;
    background: white;
    font-size: var(--rb-fs-small);
    font-weight: 600;
    color: #475569;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.filter:hover:not(.filter--active) { border-color: rgba(var(--rb-primary-rgb), 0.35); }

.filter--active {
    border-color: var(--rb-primary);
    background: var(--rb-primary);
    color: #fff;
}

.filter__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: rgba(var(--rb-primary-rgb), 0.12);
    color: var(--rb-primary-text);
    font-size: 11px;
    font-weight: 700;
}

.filter--active .filter__count { background: rgba(255, 255, 255, 0.25); color: #fff; }

/* Panels and empty state */
.panel {
    background: white;
    border-radius: 20px;
    border: 1px solid var(--border);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    overflow: hidden;
}

.state-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 56px 20px;
    text-align: center;
}

.state-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 20px;
    background: rgba(var(--rb-primary-rgb), 0.1);
    color: var(--rb-primary-text);
}

.state-title { margin: 10px 0 0; font-size: var(--rb-fs-section); font-weight: 700; color: var(--text-primary); }
.state-sub { max-width: 340px; margin: 0; font-size: var(--rb-fs-small); line-height: 1.5; color: #64748B; }

/* Day groups */
.day-groups { display: flex; flex-direction: column; gap: 20px; }
.day-group { display: flex; flex-direction: column; gap: 10px; }

.day-label {
    margin: 0;
    font-size: var(--rb-fs-caption);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #64748B;
}

/* Rows */
.notif-list { display: flex; flex-direction: column; }

.notif-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px 18px;
    border-bottom: 1px solid #f1f5f9;
}

.notif-row:last-child { border-bottom: none; }
.notif-row--unread { background: rgba(var(--rb-primary-rgb), 0.035); }

.notif-row__icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
}

.notif-row__icon--warning { background: #fff4e5; color: var(--warning); }
.notif-row__icon--success { background: #eaf6ea; color: var(--success); }
.notif-row__icon--primary,
.notif-row__icon--info { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.notif-row__icon--danger { background: #fdecec; color: var(--accent); }

.notif-row__body { flex: 1; min-width: 0; }

.notif-row__title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--rb-fs-body);
    font-weight: 700;
    color: var(--text-primary);
}

.notif-row__dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--rb-primary);
}

.notif-row__desc { margin: 4px 0 0; font-size: var(--rb-fs-small); line-height: 1.5; color: #475569; }

.notif-row__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    margin: 8px 0 0;
    font-size: var(--rb-fs-caption);
    color: var(--text-secondary);
}

.notif-tag { padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.notif-tag--reminder { background: #fff4e5; color: var(--warning); }
.notif-tag--donation { background: #eaf6ea; color: var(--success); }
.notif-tag--screening { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.notif-tag--system { background: #f1f5f9; color: #64748B; }

.notif-row__side {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    align-items: flex-end;
    gap: 8px;
}

.notif-row__action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 7px 14px;
    border: 1px solid rgba(var(--rb-primary-rgb), 0.35);
    border-radius: 999px;
    font-size: var(--rb-fs-small);
    font-weight: 700;
    color: var(--rb-primary-text);
    text-decoration: none;
    white-space: nowrap;
    transition: background-color 0.15s ease;
}

.notif-row__action:hover { background: rgba(var(--rb-primary-rgb), 0.07); }

.notif-row__mark-read {
    padding: 0;
    border: none;
    background: none;
    font-size: var(--rb-fs-caption);
    font-weight: 600;
    color: #64748B;
    cursor: pointer;
}

.notif-row__mark-read:hover { color: var(--text-primary); text-decoration: underline; }

.notif-row__read-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--rb-fs-caption);
    color: var(--text-secondary);
}

/* Buttons */
.btn-outline {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 16px;
    border: 1px solid #e5e7eb;
    border-radius: 999px;
    background: white;
    font-size: var(--rb-fs-small);
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
}

.btn-outline:hover:not(:disabled) { border-color: rgba(var(--rb-primary-rgb), 0.4); background: rgba(var(--rb-primary-rgb), 0.05); }
.btn-outline:disabled { opacity: 0.55; cursor: not-allowed; }

/* Skeleton */
.skeleton {
    background: linear-gradient(90deg, #eef0f3 25%, #e4e7ec 37%, #eef0f3 63%);
    background-size: 400% 100%;
    animation: skeleton-shimmer 1.4s ease infinite;
    border-radius: 6px;
}
@keyframes skeleton-shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}
.skeleton-line { border-radius: 4px; }
.skeleton-icon { width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0; }
.skeleton-pill { flex: none; width: 92px; height: 36px; border-radius: 999px; }

@media (prefers-reduced-motion: reduce) {
    .skeleton { animation: none; }
    .filter, .notif-row__action, .btn-outline { transition: none; }
}

@media (max-width: 640px) {
    .notifications-page { padding: 16px 16px 32px; }
    .header-row { flex-wrap: wrap; align-items: flex-start; }
    .notif-row { flex-wrap: wrap; padding: 14px; }
    .notif-row__side {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        width: 100%;
        margin-left: 54px;
        gap: 12px;
    }
}

/* ============ Dark mode ============ */
:global(.dark .notifications-page) {
    --text-primary: var(--ink-text, #F1F5F9);
    --text-secondary: var(--ink-text-2, #94A3B8);
    --border: var(--ink-border, #334155);
    background: var(--ink-page, #0F172A);
}

:global(.dark .notifications-page .panel),
:global(.dark .notifications-page .filter),
:global(.dark .notifications-page .btn-outline) { background: var(--ink-surface, #1E293B); border-color: var(--ink-border, #334155); }
:global(.dark .notifications-page .filter) { color: var(--ink-text-3, #CBD5E1); }
:global(.dark .notifications-page .filter--active) { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
:global(.dark .notifications-page .filter__count) { background: color-mix(in srgb, var(--rb-primary-text) 18%, transparent); }
:global(.dark .notifications-page .btn-outline) { color: var(--ink-text-4, #E2E8F0); }
:global(.dark .notifications-page .btn-outline:hover:not(:disabled)) { background: var(--ink-hover, #263449); }
:global(.dark .notifications-page .notif-row) { border-color: var(--ink-hover, #263449); }
:global(.dark .notifications-page .notif-row--unread) { background: color-mix(in srgb, var(--rb-primary-text) 6%, transparent); }
:global(.dark .notifications-page .notif-row__desc),
:global(.dark .notifications-page .state-sub) { color: var(--ink-text-3, #CBD5E1); }
:global(.dark .notifications-page .notif-row__icon--warning),
:global(.dark .notifications-page .notif-tag--reminder) { background: rgba(245, 124, 0, 0.16); color: #FFB74D; }
:global(.dark .notifications-page .notif-row__icon--success),
:global(.dark .notifications-page .notif-tag--donation) { background: rgba(102, 187, 106, 0.16); color: #81C784; }
:global(.dark .notifications-page .notif-row__icon--primary),
:global(.dark .notifications-page .notif-row__icon--info),
:global(.dark .notifications-page .notif-tag--screening),
:global(.dark .notifications-page .state-icon) { background: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); }
:global(.dark .notifications-page .notif-row__icon--danger) { background: rgba(239, 83, 80, 0.16); color: #EF9A9A; }
:global(.dark .notifications-page .notif-tag--system) { background: var(--ink-hover, #263449); color: var(--ink-text-2, #94A3B8); }
:global(.dark .notifications-page .notif-row__mark-read) { color: var(--ink-text-2, #94A3B8); }

/* background-image, not the shorthand: keeps the 400% size for the shimmer. */
:global(.dark .notifications-page .skeleton) {
    background-image: linear-gradient(90deg, var(--ink-hover, #263449) 25%, var(--ink-border, #334155) 37%, var(--ink-hover, #263449) 63%);
}

.btn-outline:focus-visible,
.filter:focus-visible,
.notif-row__action:focus-visible,
.notif-row__mark-read:focus-visible {
    outline: 2px solid var(--rb-primary);
    outline-offset: 2px;
}
</style>
