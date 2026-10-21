<template>
    <div class="history-page">
        <!-- Skeleton loading state -->
        <div v-if="loading" class="skeleton-wrap" aria-busy="true">
            <div class="skeleton skeleton--header" />
            <div class="skeleton-stats-grid">
                <div class="skeleton skeleton--stat" v-for="n in 3" :key="n" />
            </div>
            <div class="skeleton skeleton--panel" v-for="n in 2" :key="`r${n}`" />
        </div>

        <template v-else>
            <div class="header-row">
                <h1 class="page-title">Your donation journey</h1>
                <p class="page-subtitle">Every visit a blood center has recorded for you, newest first.</p>
            </div>

            <!-- Summary stats -->
            <div v-if="donations.length > 0" class="stats-grid">
                <div class="stat-card">
                    <div class="stat-card__top">
                        <p class="stat-card__label">Donations</p>
                        <span class="stat-card__badge stat-card__badge--primary"><AssetIcon name="droplets" :size="14" /></span>
                    </div>
                    <p class="stat-card__value">{{ stats.totalDonations }}</p>
                    <p class="stat-card__hint">Completed and recorded</p>
                </div>
                <div class="stat-card">
                    <div class="stat-card__top">
                        <p class="stat-card__label">Last donation</p>
                        <span class="stat-card__badge stat-card__badge--success"><AssetIcon name="calendar" :size="14" /></span>
                    </div>
                    <p class="stat-card__value stat-card__value--date">{{ formattedLastDonation }}</p>
                    <p class="stat-card__hint">{{ lastDonation ? lastDonation.centerName : 'No blood collected yet' }}</p>
                </div>
                <div class="stat-card">
                    <div class="stat-card__top">
                        <p class="stat-card__label">Lives potentially helped</p>
                        <span class="stat-card__badge stat-card__badge--accent"><AssetIcon name="heart" :size="14" /></span>
                    </div>
                    <p class="stat-card__value">{{ stats.livesImpacted ?? '-' }}</p>
                    <p class="stat-card__hint">Up to 3 per donation</p>
                </div>
            </div>

            <!-- Empty -->
            <div v-if="donations.length === 0" class="panel state-wrap">
                <span class="state-icon"><AssetIcon name="droplets" :size="26" /></span>
                <p class="state-title">No donations recorded yet</p>
                <p class="state-sub">
                    Once blood center staff record a visit for you, it will show up here automatically.
                </p>
                <NuxtLink to="/donor/appointments" class="btn-primary">
                    <AssetIcon name="calendar" :size="16" />
                    Book a donation
                </NuxtLink>
            </div>

            <!-- Records, grouped by year -->
            <div v-else class="timeline">
                <section v-for="group in donationsByYear" :key="group.year" class="year-group"
                    :aria-labelledby="`year-${group.year}`">
                    <h2 :id="`year-${group.year}`" class="year-label">
                        {{ group.year }}
                        <span class="year-label__count">{{ group.records.length }} visit{{ group.records.length === 1 ? '' : 's' }}</span>
                    </h2>

                    <article v-for="record in group.records" :key="record.id" class="record">
                        <div class="record__date" aria-hidden="true">
                            <span class="record__month">{{ dateParts(record.donatedOn).month }}</span>
                            <span class="record__day">{{ dateParts(record.donatedOn).day }}</span>
                        </div>

                        <div class="record__body">
                            <div class="record__top">
                                <div class="record__titles">
                                    <h3 class="record__title">{{ record.centerName }}</h3>
                                    <p class="record__meta">
                                        <span><AssetIcon name="map-pin" :size="12" /> {{ record.address || '-' }}</span>
                                        <span><AssetIcon name="clock" :size="12" /> {{ formatDate(record.donatedOn) }}, {{ formatTime(record.time) }}</span>
                                    </p>
                                </div>
                                <span class="history-status" :class="`history-status--${record.status}`">
                                    {{ statusLabel(record.status) }}
                                </span>
                            </div>

                            <div class="record__chips">
                                <span v-if="record.bloodType" class="record__chip record__chip--blood">{{ record.bloodType }}</span>
                                <span v-if="record.volumeMl" class="record__chip">{{ record.volumeMl }} mL</span>
                            </div>

                            <!--
                                A visit still moving through the blood center:
                                where it is, in the server's own order.
                            -->
                            <ol v-if="isInProgress(record.status)" class="record__track"
                                :aria-label="`Progress: ${statusLabel(record.status)}`">
                                <li v-for="(step, i) in PROGRESS_STEPS" :key="step"
                                    class="record__step"
                                    :class="{
                                        'record__step--done': i < progressIndex(record.status),
                                        'record__step--current': i === progressIndex(record.status),
                                    }"
                                    :aria-current="i === progressIndex(record.status) ? 'step' : undefined">
                                    <span class="record__step-dot" />
                                    <span class="record__step-label">{{ statusLabel(step) }}</span>
                                </li>
                            </ol>
                        </div>
                    </article>
                </section>
            </div>
        </template>
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

// Real state: stays empty unless the backend has an actual stored donation
// record for this donor (i.e. blood center staff logged a completed
// donation). Nothing here is fabricated on the client.
const donations = ref([])
const stats = reactive({
    totalDonations: 0,
    livesImpacted: null,
})

// Ang tinuod nga enum sa server: registered|screening|collected|tested|
// completed|rejected. Ang 'deferred' kay wala gyud gi-return sa backend.
const statusLabels = {
    registered: 'Registered',
    screening: 'Screening',
    collected: 'Collected',
    tested: 'Tested',
    completed: 'Completed',
    rejected: 'Rejected',
}

function statusLabel(status) {
    return statusLabels[status] ?? status
}

function formatDate(value) {
    if (!value) return '-'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// A visit only counts as a donation once blood was actually taken. A
// "registered" or "rejected" visit is not one, so it can't be the last donation.
const DONATED_STATUSES = ['collected', 'tested', 'completed']
const lastDonation = computed(() => donations.value.find(d => DONATED_STATUSES.includes(d.status)) ?? null)

const formattedLastDonation = computed(() => (lastDonation.value ? formatDate(lastDonation.value.donatedOn) : '-'))

// The server's own order for a visit moving through the blood center.
const PROGRESS_STEPS = ['registered', 'screening', 'collected', 'tested', 'completed']

function isInProgress(status) {
    return ['registered', 'screening', 'collected', 'tested'].includes(status)
}

function progressIndex(status) {
    return PROGRESS_STEPS.indexOf(status)
}

// "20:17" (H:i from the server) -> "8:17 PM".
function formatTime(value) {
    if (!value) return '-'
    const [h, m] = String(value).split(':').map(Number)
    if (Number.isNaN(h)) return value
    const suffix = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 === 0 ? 12 : h % 12
    return `${hour}:${String(m || 0).padStart(2, '0')} ${suffix}`
}

// "2026-10-07" -> { month: 'Oct', day: 7 } for the date tile. Local time.
function dateParts(value) {
    const [y, m, d] = String(value ?? '').slice(0, 10).split('-').map(Number)
    if (!y || !m || !d) return { month: '-', day: '' }
    return { month: new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short' }), day: d }
}

// Newest first, as the server sends them, grouped under their year.
const donationsByYear = computed(() => {
    const groups = []
    for (const record of donations.value) {
        const year = String(record.donatedOn ?? '').slice(0, 4) || 'Undated'
        let group = groups.find(g => g.year === year)
        if (!group) {
            group = { year, records: [] }
            groups.push(group)
        }
        group.records.push(record)
    }
    return groups
})

// Gi-keepalive ni nga page. Tan-awa ang AppointmentsPage para sa detalye —
// ang onActivated mo-refresh sa background nga walay skeleton, ug gi-guard sa
// loadedOnce kay mo-fire sad siya human sa unang onMounted.
let loadedOnce = false

async function load({ silent = false } = {}) {
    if (!silent) loading.value = true
    try {
        // GET /api/donors/donations
        // Response: { donations: [{ id, center_name, address, donated_on, time,
        //   blood_type, volume_ml, status }], stats: { total_donations,
        //   lives_impacted }, meta: { page, per_page, total, last_page } }
        // Paginated (15 kada page). Ang unang page ra ang gipakita — walay
        // pagination UI ang page karon.
        const data = await donorService.donations()
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
        // Mag-fallback ra sa empty state — dili ni sample o dummy data.
        console.error('Failed to load donation history:', err)
        donations.value = []
        stats.totalDonations = 0
        stats.livesImpacted = null
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
.history-page {
    --primary: var(--rb-primary);
    --success: #2e7d32;
    --text-primary: #1f2937;
    --text-secondary: #94A3B8;
    --border: #eef0f3;
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px 32px 40px;
    display: flex;
    background: var(--rb-page-bg);
    flex-direction: column;
    gap: 20px;
}

/* Skeleton loading */
.skeleton-wrap { display: flex; flex-direction: column; gap: 16px; }

.skeleton {
    background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
    background-size: 400% 100%;
    border-radius: 18px;
    animation: shimmer 1.4s ease infinite;
}

.skeleton--header { height: 40px; max-width: 280px; }
.skeleton-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.skeleton--stat { height: 112px; }
.skeleton--panel { height: 120px; }

@keyframes shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
    .skeleton { animation: none !important; }
}

.header-row { display: flex; flex-direction: column; }

.page-title { font-size: var(--rb-fs-title); font-weight: 700; color: var(--text-primary); margin: 0; }
.page-subtitle { font-size: var(--rb-fs-small); color: var(--text-secondary); margin: 2px 0 0; }

/* Stats, the same card as the dashboard */
.stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }

.stat-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px 18px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: white;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.stat-card__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

.stat-card__label {
    margin: 0;
    font-size: var(--rb-fs-caption);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #64748B;
}

.stat-card__badge {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 10px;
}

.stat-card__badge--primary { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.stat-card__badge--success { background: #eaf6ea; color: var(--success); }
.stat-card__badge--accent { background: #fdecec; color: #C62828; }

.stat-card__value {
    margin: 0;
    font-family: var(--rb-font-sans);
    font-size: 26px;
    font-weight: 800;
    line-height: 1.15;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
}

.stat-card__value--date { font-size: var(--rb-fs-title); }

.stat-card__hint {
    margin: 0;
    overflow: hidden;
    font-size: var(--rb-fs-caption);
    color: var(--text-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Empty state */
.panel {
    border: 1px solid var(--border);
    border-radius: 22px;
    background: white;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.state-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 48px 20px;
    text-align: center;
}

.state-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 20px;
    background: #fdecec;
    color: #C62828;
}

.state-title { margin: 10px 0 0; font-size: var(--rb-fs-section); font-weight: 700; color: var(--text-primary); }
.state-sub { max-width: 320px; margin: 0 0 16px; font-size: var(--rb-fs-small); line-height: 1.5; color: #64748B; }

/* Timeline */
.timeline { display: flex; flex-direction: column; gap: 22px; }
.year-group { display: flex; flex-direction: column; gap: 12px; }

.year-label {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin: 0;
    font-size: var(--rb-fs-section);
    font-weight: 800;
    color: var(--text-primary);
}

.year-label__count { font-size: var(--rb-fs-caption); font-weight: 600; color: var(--text-secondary); }

.record {
    display: flex;
    gap: 16px;
    padding: 16px 18px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: white;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

/* Calendar-page tile, the same as the booking drive tiles */
.record__date {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    align-self: flex-start;
    width: 54px;
    padding: 7px 0 8px;
    border-radius: 14px;
    background: rgba(var(--rb-primary-rgb), 0.1);
    color: var(--rb-primary-text);
}

.record__month { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.record__day { font-family: var(--rb-font-sans); font-size: 22px; font-weight: 800; line-height: 1.1; }

.record__body { display: flex; flex: 1; flex-direction: column; gap: 10px; min-width: 0; }
.record__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.record__titles { min-width: 0; }

.record__title { margin: 0; font-size: var(--rb-fs-body); font-weight: 700; color: var(--text-primary); }

.record__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 4px 0 0;
    font-size: var(--rb-fs-caption);
    color: #64748B;
}

.record__meta > span { display: inline-flex; align-items: center; gap: 5px; }

.record__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.record__chips:empty { display: none; }

.record__chip {
    padding: 3px 10px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #334155;
    font-size: var(--rb-fs-caption);
    font-weight: 700;
}

.record__chip--blood { background: #fdecec; color: #B71C1C; }

/* Progress through the blood center: five labelled stops */
.record__track {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    margin: 2px 0 0;
    padding: 12px 14px 10px;
    border-radius: 14px;
    background: #f8fafc;
    list-style: none;
}

.record__step { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }

/* Connector from the previous stop */
.record__step + .record__step::before {
    content: '';
    position: absolute;
    top: 5px;
    right: 50%;
    width: 100%;
    height: 2px;
    background: #e2e8f0;
}

.record__step--done::before,
.record__step--current::before { background: var(--rb-primary) !important; }

.record__step-dot {
    position: relative;
    z-index: 1;
    width: 12px;
    height: 12px;
    border: 2px solid #cbd5e1;
    border-radius: 50%;
    background: #fff;
}

.record__step--done .record__step-dot { border-color: var(--rb-primary); background: var(--rb-primary); }
.record__step--current .record__step-dot { border-color: var(--rb-primary); box-shadow: 0 0 0 4px rgba(var(--rb-primary-rgb), 0.16); }

.record__step-label { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
.record__step--done .record__step-label { color: #475569; }
.record__step--current .record__step-label { color: var(--rb-primary-text); font-weight: 700; }

/* Status pill */
.history-status {
    flex: none;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: var(--rb-fs-caption);
    font-weight: 700;
}

.history-status--completed { background: #eaf6ea; color: var(--success); }
.history-status--rejected { background: #fdecec; color: #C62828; }

/* Ang registered/screening/collected/tested kay in-progress pa: usa ra ka
   style para sa upat, dili tag-usa ka kolor. */
.history-status--registered,
.history-status--screening,
.history-status--collected,
.history-status--tested { background: #fff4e5; color: #a65b00; }

/* Buttons */
.btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 11px 22px;
    border-radius: 999px;
    font-size: var(--rb-fs-small);
    font-weight: 700;
    color: white;
    background: var(--primary);
    border: none;
    cursor: pointer;
    text-decoration: none;
    transition: background-color 0.15s ease;
}

.btn-primary:hover { background: var(--rb-primary-hover); }
.btn-primary:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

@media (min-width: 641px) and (max-width: 900px) {
    .stats-grid, .skeleton-stats-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
    .history-page { padding: 16px 16px 32px; }
    .record { gap: 12px; padding: 14px; }
    .record__date { width: 46px; }
    .record__top { flex-direction: column; gap: 8px; }
    .record__track { padding: 10px 6px 8px; }
    /* Five labels don't fit side by side; name only the current stop. */
    .record__step-label { display: none; font-size: 11px; white-space: nowrap; }
    .record__step--current .record__step-label { display: block; }

    /* Three compact tiles in a row instead of three full-width cards. */
    .stats-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .stat-card { justify-content: space-between; gap: 4px; padding: 12px; border-radius: 16px; }
    .stat-card__badge, .stat-card__hint { display: none; }
    .stat-card__label { font-size: 10px; letter-spacing: 0.04em; }
    .stat-card__value { font-size: 20px; }
    .stat-card__value--date { font-size: var(--rb-fs-small); }
}

/* ============ Dark mode ============ */
:global(.dark .history-page) {
    --text-primary: var(--ink-text, #F1F5F9);
    --text-secondary: var(--ink-text-2, #94A3B8);
    --border: var(--ink-border, #334155);
    background: var(--ink-page, #0F172A);
}

:global(.dark .history-page .stat-card),
:global(.dark .history-page .panel),
:global(.dark .history-page .record) { background: var(--ink-surface, #1E293B); border-color: var(--ink-border, #334155); }

:global(.dark .history-page .stat-card__label),
:global(.dark .history-page .record__meta),
:global(.dark .history-page .state-sub) { color: var(--ink-text-2, #94A3B8); }
:global(.dark .history-page .stat-card__badge--primary),
:global(.dark .history-page .record__date) { background: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); }
:global(.dark .history-page .stat-card__badge--success) { background: rgba(102, 187, 106, 0.16); }
:global(.dark .history-page .stat-card__badge--accent),
:global(.dark .history-page .state-icon),
:global(.dark .history-page .record__chip--blood) { background: rgba(239, 83, 80, 0.16); color: #EF9A9A; }
:global(.dark .history-page .record__chip) { background: var(--ink-hover, #263449); color: var(--ink-text-3, #CBD5E1); }
:global(.dark .history-page .record__track) { background: var(--ink-inset, #172033); }
:global(.dark .history-page .record__step + .record__step::before) { background: var(--ink-border, #334155); }
:global(.dark .history-page .record__step-dot) { background: var(--ink-surface, #1E293B); border-color: var(--ink-border-hover, #475569); }
:global(.dark .history-page .record__step--done .record__step-dot) { background: var(--rb-primary); border-color: var(--rb-primary); }
:global(.dark .history-page .record__step--current .record__step-dot) { border-color: var(--rb-primary-text); }
:global(.dark .history-page .record__step--done .record__step-label) { color: var(--ink-text-3, #CBD5E1); }
:global(.dark .history-page .record__step--current .record__step-label) { color: var(--rb-primary-text); }

:global(.dark .history-page .history-status--completed) { background: rgba(102, 187, 106, 0.16); }
:global(.dark .history-page .history-status--rejected) { background: rgba(239, 83, 80, 0.16); color: #EF9A9A; }
:global(.dark .history-page .history-status--registered),
:global(.dark .history-page .history-status--screening),
:global(.dark .history-page .history-status--collected),
:global(.dark .history-page .history-status--tested) {
    background: rgba(245, 124, 0, 0.16);
    color: #FFCC80;
}

/* background-image, not the `background` shorthand: the shorthand resets
   background-size to `auto`, which collapses the 400%-wide gradient to the
   element width and leaves the shimmer keyframes with zero travel. */
:global(.dark .history-page .skeleton) {
    background-image: linear-gradient(90deg, var(--ink-surface, #1E293B) 25%, var(--ink-hover, #263449) 37%, var(--ink-surface, #1E293B) 63%);
}
</style>
