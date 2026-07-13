<template>
    <div class="notifications-page">
        <div class="header-row fade-in" style="--delay: 0ms">
            <div>
                <h1 class="page-title">Notifications</h1>
                <p class="page-subtitle">System alerts, appointment reminders, and donation updates.</p>
            </div>
            <button
                type="button"
                class="btn-outline"
                :disabled="totalUnread === 0"
                @click="markAllAsRead"
            >
                Mark all as read
            </button>
        </div>

        <!-- Tabs -->
        <div class="tabs-bar fade-in" style="--delay: 50ms">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                type="button"
                class="tab-btn"
                :class="{ 'tab-btn--active': activeTab === tab.key }"
                @click="activeTab = tab.key"
            >
                {{ tab.label }}
                <span v-if="tab.unread > 0" class="tab-badge" :class="`tab-badge--${tab.tone}`">{{ tab.unread }}</span>
            </button>
        </div>

        <!-- List -->
        <div class="panel fade-in" style="--delay: 100ms">
            <div v-if="loading" class="state-wrap">
                <div class="spinner" />
            </div>

            <div v-else-if="filteredNotifications.length === 0" class="state-wrap state-wrap--empty">
                <AssetIcon name="bell" :size="32" style="color:#e5e7eb" />
                <p class="state-title">You're all caught up</p>
                <p class="state-sub">
                    {{ emptyStateMessage }}
                </p>
            </div>

            <div v-else class="notif-list">
                <div
                    v-for="notif in filteredNotifications"
                    :key="notif.id"
                    class="notif-row"
                    :class="{ 'notif-row--unread': !notif.read }"
                >
                    <span class="notif-row__dot" :class="{ 'notif-row__dot--visible': !notif.read }" />

                    <div class="notif-row__icon" :class="`notif-row__icon--${notif.tone}`">
                        <AssetIcon :name="notif.icon" :size="18" />
                    </div>

                    <div class="notif-row__body">
                        <p class="notif-row__title">{{ notif.title }}</p>
                        <p class="notif-row__desc">{{ notif.desc }}</p>
                        <p class="notif-row__meta">{{ notif.meta }}</p>
                    </div>

                    <div class="notif-row__side">
                        <span class="notif-tag" :class="`notif-tag--${notif.category}`">{{ categoryLabel(notif.category) }}</span>
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
                        <span v-else class="notif-row__read-status">Read</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
})

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

const tabToneMap = {
    all: 'primary',
    reminder: 'warning',
    donation: 'success',
    screening: 'primary',
    system: 'neutral',
}

const tabs = computed(() =>
    tabDefs.map(tab => ({
        ...tab,
        tone: tabToneMap[tab.key],
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

const emptyStateMessage = computed(() => {
    if (activeTab.value === 'all') {
        return "You'll see updates here once you complete a screening, book an appointment, or make a donation."
    }
    return `No ${categoryLabel(activeTab.value).toLowerCase()} notifications yet.`
})

async function markAsRead(notif) {
    notif.read = true
    try {
        // Backend contract: PATCH /api/donor/notifications/:id
        // Body: { read: true }
        await $fetch(`/api/donor/notifications/${notif.id}`, {
            method: 'PATCH',
            body: { read: true },
        })
    } catch (err) {
        console.error('Failed to mark notification as read:', err)
    }
}

async function markAllAsRead() {
    const previouslyUnread = notifications.value.filter(n => !n.read).map(n => n.id)
    notifications.value.forEach(n => { n.read = true })
    try {
        // Backend contract: POST /api/donor/notifications/mark-all-read
        await $fetch('/api/donor/notifications/mark-all-read', { method: 'POST' })
    } catch (err) {
        console.error('Failed to mark all notifications as read:', err)
        // Roll back optimistic update on failure
        notifications.value.forEach(n => {
            if (previouslyUnread.includes(n.id)) n.read = false
        })
    }
}

onMounted(async () => {
    try {
        // Backend contract: GET /api/donor/notifications
        // Response: { notifications: [{ id, category: 'reminder'|'donation'|'screening'|'system',
        //   title, desc, meta, icon, tone, read, action_label, action_route }] }
        const data = await $fetch('/api/donor/notifications')
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
        }))
    } catch (err) {
        // NOTE: sa dev/UI stage pa lang, wala pay live nga /api/donor/notifications
        // endpoint, so mag-fail gyud ni nga call. Mag-fallback sa empty state
        // (walay laray) — ang page kay mag-populate ra gyud kung naa nay
        // actual notification record sa database para niini nga donor.
        console.error('Failed to load notifications (expected while backend is not yet wired up):', err)
        notifications.value = []
    } finally {
        loading.value = false
    }
})
</script>

<style scoped>
.notifications-page {
    --primary: #1565c0;
    --accent: #d32f2f;
    --success: #2e7d32;
    --warning: #f57c00;
    --text-primary: #1f2937;
    --text-secondary: #9ca3af;
    max-width: 1152px;
    margin: 0 auto;
    padding: 24px 32px 40px;
    display: flex;
    background: #F5F7FA;
    flex-direction: column;
    gap: 20px;
}

.fade-in {
    animation: fadeInUp 0.5s ease both;
    animation-delay: var(--delay, 0ms);
}

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
}

.header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
}

.page-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.page-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 2px 0 0;
}

/* Tabs */
.tabs-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    border-bottom: 1px solid #e5e7eb;
}

.tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border: none;
    background: none;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color 0.15s ease, border-color 0.15s ease;
}

.tab-btn:hover {
    color: var(--text-primary);
}

.tab-btn--active {
    color: var(--primary);
    border-bottom-color: var(--primary);
}

.tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    color: white;
}

.tab-badge--primary { background: var(--primary); }
.tab-badge--warning { background: var(--warning); }
.tab-badge--success { background: var(--success); }
.tab-badge--neutral { background: #9ca3af; }

/* Panel + states */
.panel {
    background: white;
    border-radius: 14px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
    border: 1px solid #eef0f3;
    overflow: hidden;
}

.state-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
}

.state-wrap--empty {
    flex-direction: column;
    gap: 6px;
    text-align: center;
}

.state-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 8px 0 0;
}

.state-sub {
    font-size: 12.5px;
    color: var(--text-secondary);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
}

.spinner {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 4px solid #e3ebf6;
    border-top-color: var(--primary);
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Notification rows */
.notif-list {
    display: flex;
    flex-direction: column;
}

.notif-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 18px 20px;
    border-bottom: 1px solid #f3f4f6;
}

.notif-row:last-child {
    border-bottom: none;
}

.notif-row--unread {
    background: #fafbfe;
}

.notif-row__dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    flex-shrink: 0;
    margin-top: 7px;
    background: transparent;
}

.notif-row__dot--visible {
    background: var(--primary);
}

.notif-row__icon {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.notif-row__icon--warning { background: #fff4e5; color: var(--warning); }
.notif-row__icon--success { background: #eaf6ea; color: var(--success); }
.notif-row__icon--primary { background: #eaf3fc; color: var(--primary); }
.notif-row__icon--danger { background: #fbeaea; color: var(--accent); }

.notif-row__body {
    flex: 1;
    min-width: 0;
}

.notif-row__title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.notif-row__desc {
    font-size: 12.5px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 4px 0 0;
}

.notif-row__meta {
    font-size: 11.5px;
    color: #b7bec9;
    margin: 6px 0 0;
}

.notif-row__side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex-shrink: 0;
    min-width: 130px;
}

.notif-tag {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
}

.notif-tag--reminder { background: #fff4e5; color: var(--warning); }
.notif-tag--donation { background: #eaf6ea; color: var(--success); }
.notif-tag--screening { background: #eaf3fc; color: var(--primary); }
.notif-tag--system { background: #f3f4f6; color: var(--text-secondary); }

.notif-row__action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--primary);
    text-decoration: none;
}

.notif-row__action:hover {
    text-decoration: underline;
}

.notif-row__mark-read {
    border: none;
    background: none;
    padding: 0;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
}

.notif-row__mark-read:hover {
    color: var(--text-primary);
    text-decoration: underline;
}

.notif-row__read-status {
    font-size: 11.5px;
    color: #c7ccd4;
}

/* Buttons */
.btn-outline {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    background: #f3f4f6;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
    white-space: nowrap;
}

.btn-outline:hover:not(:disabled) {
    background: #e5e7eb;
}

.btn-outline:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

@media (max-width: 640px) {
    .notifications-page {
        padding: 16px 16px 32px;
    }

    .header-row {
        flex-direction: column;
        align-items: stretch;
    }

    .notif-row {
        flex-wrap: wrap;
    }

    .notif-row__side {
        align-items: flex-start;
        min-width: 0;
        width: 100%;
        flex-direction: row;
        flex-wrap: wrap;
        margin-left: 50px;
    }
}
</style>