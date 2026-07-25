Exit code: 0
Wall time: 4.3 seconds
Output:
<template>
    <div class="history-page">
        <!-- Skeleton loading state -->
        <div v-if="loading" class="skeleton-wrap">
            <div class="skeleton skeleton--header" />
            <div class="skeleton-stats-grid">
                <div class="skeleton skeleton--stat" v-for="n in 3" :key="n" />
            </div>
            <div class="skeleton skeleton--panel" style="height:320px" />
        </div>

        <template v-else>
            <div class="header-row fade-in" style="--delay: 0ms">
                <h1 class="page-title">Youre donation journey</h1>
                <p class="page-subtitle">Review your complete record of past blood donations.</p>
            </div>

            <!-- Summary stats -->
            <div v-if="donations.length > 0" class="stats-grid fade-in" style="--delay: 50ms">
                <div class="stat-card">
                    <div class="stat-card__icon stat-card__icon--primary">
                        <AssetIcon name="droplet" :size="18" />
                    </div>
                    <div>
                        <p class="stat-card__value">{{ stats.totalDonations }}</p>
                        <p class="stat-card__label">Total donations</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-card__icon stat-card__icon--success">
                        <AssetIcon name="calendar" :size="18" />
                    </div>
                    <div>
                        <p class="stat-card__value">{{ formattedLastDonation }}</p>
                        <p class="stat-card__label">Last donation</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-card__icon stat-card__icon--warning">
                        <AssetIcon name="heart" :size="18" />
                    </div>
                    <div>
                        <p class="stat-card__value">{{ stats.livesImpacted ?? 'â€”' }}</p>
                        <p class="stat-card__label">Lives potentially helped</p>
                    </div>
                </div>
            </div>

            <!-- List -->
            <div class="panel fade-in" style="--delay: 100ms">
                <div v-if="donations.length === 0" class="state-wrap state-wrap--empty">
                    <AssetIcon name="droplets" :size="32" style="color:#e5e7eb" />
                    <p class="state-title">No donations recorded yet</p>
                    <p class="state-sub">
                        Once a blood center staff logs a completed donation for you, it will show up here automatically.
                    </p>
                    <NuxtLink to="/donor/appointments" class="btn-primary">
                        Book an Appointment
                    </NuxtLink>
                </div>

                <div v-else class="history-list">
                    <div v-for="record in donations" :key="record.id" class="history-row">
                        <div class="history-row__icon">
                            <AssetIcon name="droplets" :size="18" />
                        </div>

                        <div class="history-row__body">
                            <p class="history-row__title">{{ record.centerName }}</p>
                            <p class="history-row__meta">{{ record.address }}</p>
                            <p class="history-row__date">{{ formatDate(record.donatedOn) }} Â· {{ record.time }}</p>
                        </div>

                        <div class="history-row__side">
                            <span class="history-tag">{{ record.bloodType }}</span>
                            <p class="history-row__volume">{{ record.volumeMl }} mL</p>
                            <span class="history-status" :class="`history-status--${record.status}`">
                                {{ statusLabel(record.status) }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'


const loading = ref(true)

// Real state: stays empty unless the backend has an actual stored donation
// record for this donor (i.e. blood center staff logged a completed
// donation). Nothing here is fabricated on the client.
const donations = ref([])
const stats = reactive({
    totalDonations: 0,
    livesImpacted: null,
})

const statusLabels = {
    completed: 'Completed',
    deferred: 'Deferred',
}

function statusLabel(status) {
    return statusLabels[status] ?? status
}

function formatDate(value) {
    if (!value) return 'â€”'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return 'â€”'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formattedLastDonation = computed(() => {
    if (donations.value.length === 0) return 'â€”'
    return formatDate(donations.value[0]?.donatedOn)
})

onMounted(async () => {
    try {
        // Backend contract: GET /api/donor/donations
        // Response: { donations: [{ id, center_name, address, donated_on, time,
        //   blood_type, volume_ml, status: 'completed' | 'deferred' }],
        //   stats: { total_donations, lives_impacted } }
        // Ordered most-recent-first by the backend.
        const data = await $fetch('/api/donor/donations')
        donations.value = (data?.donations ?? []).map(d => ({
            id: d.id,
            centerName: d.center_name,
            address: d.address,
            donatedOn: d.donated_on,
            time: d.time,
            bloodType: d.blood_type,
            volumeMl: d.volume_ml,
            status: d.status,
        }))
        stats.totalDonations = data?.stats?.total_donations ?? donations.value.length
        stats.livesImpacted = data?.stats?.lives_impacted ?? null
    } catch (err) {
        // NOTE: sa dev/UI stage pa lang, wala pay live nga /api/donor/donations
        // endpoint, so mag-fail gyud ni nga call. Mag-fallback sa empty state
        // (walay laray) â€” dili ni sample/dummy data, kay ang tinuod nga page
        // kay mag-populate ra gyud kung naa nay actual record sa database.
        console.error('Failed to load donation history (expected while backend is not yet wired up):', err)
        donations.value = []
        stats.totalDonations = 0
        stats.livesImpacted = null
    } finally {
        loading.value = false
    }
})
</script>

<style scoped>
.history-page {
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
    from {
        opacity: 0;
        transform: translateY(12px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Skeleton loading */
.skeleton-wrap {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.skeleton {
    background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
    background-size: 400% 100%;
    border-radius: 14px;
    animation: shimmer 1.4s ease infinite;
}

.skeleton--header {
    height: 40px;
    max-width: 280px;
}

.skeleton-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
}

.skeleton--stat {
    height: 72px;
}

.skeleton--panel {
    border-radius: 14px;
}

@keyframes shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
    .skeleton, .fade-in { animation: none !important; }
}

@media (max-width: 900px) {
    .skeleton-stats-grid { grid-template-columns: 1fr; }
}

.header-row {
    display: flex;
    flex-direction: column;
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

/* Stats */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
}

.stat-card {
    background: white;
    border-radius: 14px;
    border: 1px solid #eef0f3;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
    padding: 16px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.stat-card__icon {
    width: 40px;
    height: 40px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.stat-card__icon--primary {
    background: #eaf3fc;
    color: var(--primary);
}

.stat-card__icon--success {
    background: #eaf6ea;
    color: var(--success);
}

.stat-card__icon--warning {
    background: #fff4e5;
    color: var(--warning);
}

.stat-card__value {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.stat-card__label {
    font-size: 11.5px;
    color: var(--text-secondary);
    margin: 2px 0 0;
}

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
    padding: 48px 20px;
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
    margin: 0 0 16px;
    max-width: 300px;
    line-height: 1.5;
}

/* History rows */
.history-list {
    display: flex;
    flex-direction: column;
}

.history-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    border-bottom: 1px solid #f3f4f6;
}

.history-row:last-child {
    border-bottom: none;
}

.history-row__icon {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    background: #fbeaea;
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.history-row__body {
    flex: 1;
    min-width: 0;
}

.history-row__title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.history-row__meta {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 3px 0 0;
}

.history-row__date {
    font-size: 11.5px;
    color: #b7bec9;
    margin: 5px 0 0;
}

.history-row__side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex-shrink: 0;
    min-width: 90px;
}

.history-tag {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
    background: #eaf3fc;
    color: var(--primary);
}

.history-row__volume {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.history-status {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 9px;
    border-radius: 999px;
}

.history-status--completed {
    background: #eaf6ea;
    color: var(--success);
}

.history-status--deferred {
    background: #fbeaea;
    color: var(--accent);
}

/* Buttons */
.btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 11px 20px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    color: white;
    background: var(--primary);
    border: none;
    cursor: pointer;
    text-decoration: none;
    transition: opacity 0.15s ease;
}

.btn-primary:hover {
    opacity: 0.92;
}

@media (max-width: 900px) {
    .stats-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 640px) {
    .history-page {
        padding: 16px 16px 32px;
    }

    .history-row {
        flex-wrap: wrap;
    }

    .history-row__side {
        flex-direction: row;
        align-items: center;
        width: 100%;
        margin-left: 50px;
        min-width: 0;
    }
}

/* ============ Dark mode ============ */
:global(.dark .history-page) {
    --text-primary: #F1F5F9;
    --text-secondary: #94A3B8;
    background: #0F172A;
}

:global(.dark .stat-card),
:global(.dark .panel) {
    background: #1E293B;
    border-color: #334155;
}

:global(.dark .stat-card__icon--primary) {
    background: rgba(66, 165, 245, 0.16);
}

:global(.dark .stat-card__icon--success) {
    background: rgba(102, 187, 106, 0.16);
}

:global(.dark .stat-card__icon--warning) {
    background: rgba(255, 167, 38, 0.16);
}

:global(.dark .history-row) {
    border-color: #263449;
}

:global(.dark .history-row__icon) {
    background: rgba(239, 83, 80, 0.16);
}

:global(.dark .history-row__meta) {
    color: #94A3B8;
}

:global(.dark .history-row__date) {
    color: #64748B;
}

:global(.dark .history-tag) {
    background: rgba(66, 165, 245, 0.16);
    color: #90CAF9;
}

:global(.dark .history-status--completed) {
    background: rgba(102, 187, 106, 0.16);
}

:global(.dark .history-status--deferred) {
    background: rgba(239, 83, 80, 0.16);
}

:global(.dark .state-title) {
    color: #F1F5F9;
}

:global(.dark .skeleton) {
    background: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}
</style>

