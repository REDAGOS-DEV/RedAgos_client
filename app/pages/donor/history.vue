<template>
  <div class="history scope-donor-history">
    <!-- Skeleton, shaped like the page below -->
    <div v-if="loading" class="history__inner" aria-busy="true">
      <div class="skeleton skeleton--title" />
      <div class="summary">
        <div v-for="n in 4" :key="n" class="skeleton skeleton--tile" />
      </div>
      <div v-for="n in 3" :key="`r${n}`" class="skeleton skeleton--row" />
    </div>

    <div v-else class="history__inner">
      <header class="head">
        <h1 class="head__title">Your donations</h1>
        <p class="head__sub">Every visit and booking, newest first.</p>
      </header>

      <!--
        Desktop: the timeline on the left, the summary and filters in a
        sticky column on the right. Phone: one column (summary, anything in
        progress, filters, then the timeline).
      -->
      <div class="layout">
        <aside class="side">
      <!-- Summary: what the donor has given, and when they can give next -->
      <section class="summary" aria-label="Summary">
        <div class="tile">
          <span class="tile__value">{{ stats.totalDonations }}</span>
          <span class="tile__label">Donation{{ stats.totalDonations === 1 ? '' : 's' }}</span>
        </div>
        <div class="tile">
          <span class="tile__value">{{ litresGiven }}<small> L</small></span>
          <span class="tile__label">Blood given</span>
        </div>
        <div class="tile">
          <span class="tile__value">{{ stats.livesImpacted ?? stats.totalDonations * 3 }}</span>
          <span class="tile__label">Lives potentially helped</span>
        </div>
        <div class="tile tile--next">
          <span class="tile__value tile__value--text">{{ nextLabel.value }}</span>
          <span class="tile__label">{{ nextLabel.hint }}</span>
        </div>
      </section>

      <!-- Filters, with counts. The missed count lives here, not up top. -->
      <div v-if="entries.length" class="filters" role="tablist" aria-label="Filter">
        <button
          v-for="f in visibleFilters"
          :key="f.key"
          type="button"
          role="tab"
          class="filter"
          :class="{ 'is-on': filter === f.key }"
          :aria-selected="filter === f.key"
          @click="filter = f.key">
          <span class="filter__label">{{ f.label }}</span>
          <span class="filter__count">{{ f.count }}</span>
        </button>
      </div>
        </aside>

        <div class="main">

      <!-- A visit still moving through the blood center, up front -->
      <section v-for="v in inProgress" :key="`live-${v.id}`" class="live" aria-label="In progress">
        <div class="live__top">
          <span class="live__icon"><AssetIcon :name="v.status === 'collected' || v.status === 'tested' ? 'flask-conical' : 'clipboard-check'" :size="18" /></span>
          <div class="live__text">
            <p class="live__title">{{ liveTitle(v) }}</p>
            <p class="live__meta">{{ v.centerName }}, {{ formatDate(v.date) }}</p>
          </div>
          <span class="chip chip--live">In progress</span>
        </div>
        <ol class="track" :aria-label="`Progress: ${STEP_LABELS[v.status]}`">
          <li v-for="(step, i) in STEPS" :key="step" class="track__step"
            :class="{ 'is-done': i < stepIndex(v.status), 'is-current': i === stepIndex(v.status) }"
            :aria-current="i === stepIndex(v.status) ? 'step' : undefined">
            <span class="track__dot" />
            <span class="track__label">{{ STEP_LABELS[step] }}</span>
          </li>
        </ol>
      </section>

      <!-- Nothing in progress: the same spot says where the donor stands -->
      <section v-if="!inProgress.length" class="live live--idle" aria-label="Status">
        <div class="live__top">
          <span class="live__icon"><AssetIcon :name="resting ? 'clock' : 'blood-drop'" :size="18" /></span>
          <div class="live__text">
            <p class="live__title">{{ resting ? 'Resting after your last donation' : 'No visit in progress' }}</p>
            <p class="live__meta">
              {{ resting ? `You can give again on ${formatDate(nextEligibleDate)}, ${nextLabel.hint.replace('Next donation, ', '')}.` : 'You can donate now. Pick a blood center and a time that suits you.' }}
            </p>
          </div>
          <NuxtLink v-if="!resting" to="/donor/appointments" class="btn btn--primary btn--sm">
            <AssetIcon name="calendar" :size="15" />
            Book a donation
          </NuxtLink>
        </div>
      </section>

      <!-- Empty -->
      <div v-if="entries.length === 0" class="empty">
        <span class="empty__icon"><AssetIcon name="droplets" :size="26" /></span>
        <p class="empty__title">No donations recorded yet</p>
        <p class="empty__sub">Once a blood center records a visit for you, it will show up here automatically.</p>
        <NuxtLink to="/donor/appointments" class="btn btn--primary">
          <AssetIcon name="calendar" :size="16" />
          Book a donation
        </NuxtLink>
      </div>

      <template v-else>
        <p v-if="filtered.length === 0" class="none">Nothing here yet.</p>

        <!-- The timeline: one agos line through every year -->
        <section v-for="group in byYear" :key="group.year" class="year" :aria-labelledby="`year-${group.year}`">
          <h2 :id="`year-${group.year}`" class="year__label">{{ group.year }}</h2>
          <ol class="timeline">
            <li v-for="e in group.items" :key="e.key" class="entry" :class="`entry--${e.kind}`">
              <span class="entry__dot" aria-hidden="true">
                <AssetIcon v-if="e.kind === 'ended' || e.kind === 'rejected'" name="x" :size="9" />
              </span>

              <button
                v-if="e.expandable"
                type="button"
                class="entry__row"
                :aria-expanded="openKey === e.key"
                :aria-controls="`detail-${e.key}`"
                @click="toggle(e.key)">
                <span class="entry__date">{{ formatDate(e.date, 'short') }}</span>
                <span class="entry__main">
                  <span class="entry__title">{{ e.title }}</span>
                  <span class="entry__sub">{{ e.sub }}</span>
                </span>
                <span class="chip" :class="`chip--${e.kind}`">{{ e.chip }}</span>
                <AssetIcon name="chevron-down" :size="16" class="entry__chev" :class="{ 'is-open': openKey === e.key }" />
              </button>
              <div v-else class="entry__row entry__row--static">
                <span class="entry__date">{{ formatDate(e.date, 'short') }}</span>
                <span class="entry__main">
                  <span class="entry__title">{{ e.title }}</span>
                  <span class="entry__sub">{{ e.sub }}</span>
                </span>
                <span class="chip" :class="`chip--${e.kind}`">{{ e.chip }}</span>
                <span class="entry__chev-space" />
              </div>

              <p v-if="e.milestone" class="entry__milestone">
                <AssetIcon name="star-fill" :size="13" />
                {{ e.milestone }}
              </p>

              <!-- Details: the visit's own record -->
              <div v-if="e.expandable && openKey === e.key" :id="`detail-${e.key}`" class="detail">
                <dl class="detail__facts">
                  <div><dt>When</dt><dd>{{ formatDate(e.date) }}{{ e.time ? `, ${formatTime(e.time)}` : '' }}</dd></div>
                  <div v-if="e.address"><dt>Where</dt><dd>{{ e.address }}</dd></div>
                  <div v-if="e.bloodType"><dt>Blood type</dt><dd>{{ e.bloodType }}</dd></div>
                  <div v-if="e.volumeMl"><dt>Collected</dt><dd>{{ e.volumeMl }} mL</dd></div>
                  <div><dt>Status</dt><dd>{{ STEP_LABELS[e.status] ?? e.status }}</dd></div>
                </dl>
                <ol v-if="e.kind !== 'rejected'" class="track track--small"
                  :class="{ 'track--ended': e.kind === 'ended' }"
                  :aria-label="e.kind === 'ended' ? `Stopped at ${STEP_LABELS[e.status]}` : `Progress: ${STEP_LABELS[e.status]}`">
                  <li v-for="(step, i) in STEPS" :key="step" class="track__step"
                    :class="{
                      'is-done': i < stepIndex(e.status) || (e.status === 'completed' && i === stepIndex(e.status)),
                      'is-current': e.kind === 'live' && i === stepIndex(e.status),
                      'is-stopped': e.kind === 'ended' && i === stepIndex(e.status),
                      'is-skipped': e.kind === 'ended' && i > stepIndex(e.status),
                    }">
                    <span class="track__dot">
                      <AssetIcon v-if="e.kind === 'ended' && i === stepIndex(e.status)" name="x" :size="8" />
                    </span>
                    <span class="track__label">{{ STEP_LABELS[step] }}</span>
                  </li>
                </ol>
                <p v-if="e.kind === 'ended'" class="detail__note">
                  This visit stopped at {{ STEP_LABELS[e.status] }}, before any blood was taken.
                  <NuxtLink to="/donor/appointments" class="detail__link">Book a new time</NuxtLink>
                </p>
                <p v-else-if="e.kind === 'rejected'" class="detail__note">
                  The blood center could not accept this donation. They can tell you why and when you may try again.
                  <NuxtLink to="/donor/help" class="detail__link">Get help</NuxtLink>
                </p>
              </div>
            </li>
          </ol>
        </section>
      </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true,
})

import { ref, reactive, computed, onMounted, onActivated } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { donorService } from '~/api/donor/DonorService'

const loading = ref(true)

// Real state only: visits the blood center recorded, and the donor's own
// bookings. Nothing here is fabricated on the client.
const donations = ref([])
const appointments = ref([])
const nextEligibleDate = ref(null)
const stats = reactive({ totalDonations: 0, livesImpacted: null })

// The server's visit statuses, in the order a visit moves through them.
const STEPS = ['registered', 'screening', 'collected', 'tested', 'completed']
const STEP_LABELS = {
  registered: 'Registered',
  screening: 'Screening',
  collected: 'Collected',
  tested: 'Tested',
  completed: 'Completed',
  rejected: 'Rejected',
}
const stepIndex = status => STEPS.indexOf(status)

// Blood was taken from Collected on.
const DONATED = ['collected', 'tested', 'completed']

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localDay(value) {
  const d = parseDate(value)
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/*
 * What a visit amounts to:
 *  - live: still moving. Registration and screening happen on the day, so
 *    only today's; after collection the lab can take days, so any day.
 *  - ended: still at Registered or Screening from an earlier day. It stopped
 *    there (the donor left, or the desk never moved it on) and won't move.
 *  - donated: blood taken and processing finished.
 *  - rejected: the centre turned the donation away.
 */
function visitKind(v) {
  if (v.status === 'completed') return 'donated'
  if (v.status === 'rejected') return 'rejected'
  if (v.status === 'collected' || v.status === 'tested') return 'live'
  return String(v.date ?? '').slice(0, 10) < todayIso() ? 'ended' : 'live'
}

const inProgress = computed(() => donations.value.filter(v => visitKind(v) === 'live'))

function liveTitle(v) {
  return {
    registered: 'You are registered. Screening is next.',
    screening: 'Screening is under way.',
    collected: 'Your blood was collected. It goes to the lab next.',
    tested: 'Testing is done. The blood center is finishing up.',
  }[v.status] ?? 'In progress'
}

/*
 * A booking that came and went without a visit: never checked in, or marked
 * no-show by the centre. Cancelled ones were the donor's own choice and stay
 * out. A booking with a visit recorded the same day is not a miss.
 */
const missed = computed(() => {
  const today = todayIso()
  const visitDays = new Set(donations.value.map(v => String(v.date ?? '').slice(0, 10)))
  return appointments.value.filter((a) => {
    const day = localDay(a.appointment_datetime)
    return (a.status === 'no_show' || a.status === 'scheduled') && day < today && !visitDays.has(day)
  })
})

// Milestones counted oldest first, over visits where blood was taken.
const MILESTONES = [1, 3, 5, 10, 25, 50, 75, 100]
const milestoneById = computed(() => {
  const given = donations.value
    .filter(v => DONATED.includes(v.status))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const out = {}
  given.forEach((v, i) => {
    const n = i + 1
    if (MILESTONES.includes(n)) out[v.id] = n === 1 ? 'Your first donation' : `Your ${ordinal(n)} donation`
  })
  return out
})

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const CHIP = { donated: 'Donated', live: 'In progress', ended: 'Not completed', rejected: 'Rejected', missed: 'Missed' }

// Visits and missed bookings, one list, newest first.
const entries = computed(() => {
  const visits = donations.value.map((v) => {
    const kind = visitKind(v)
    return {
      key: `v-${v.id}`,
      kind,
      date: v.date,
      time: v.time,
      sort: `${String(v.date).slice(0, 10)}T${v.time ?? '00:00'}`,
      title: v.centerName,
      sub: kind === 'ended'
        ? `Stopped at ${STEP_LABELS[v.status]}`
        : [v.bloodType, v.volumeMl ? `${v.volumeMl} mL` : null].filter(Boolean).join(', ') || (v.address ?? ''),
      chip: CHIP[kind],
      status: v.status,
      address: v.address,
      bloodType: v.bloodType,
      volumeMl: v.volumeMl,
      milestone: milestoneById.value[v.id] ?? null,
      expandable: true,
    }
  })
  const misses = missed.value.map((a) => {
    // `time` is H:i; fall back to the datetime's own clock if it is absent.
    const d = parseDate(a.appointment_datetime)
    const time = a.time || (d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '')
    return {
    key: `a-${a.id}`,
    kind: 'missed',
    date: localDay(a.appointment_datetime),
    sort: `${localDay(a.appointment_datetime)}T${time || '00:00'}`,
    title: a.drive_name || a.facility_name,
    sub: time ? `Missed appointment, ${formatTime(time)}` : 'Missed appointment',
    chip: CHIP.missed,
    expandable: false,
    }
  })
  return [...visits, ...misses].sort((a, b) => b.sort.localeCompare(a.sort))
})

// ── Filters ──
const filter = ref('all')
const FILTERS = [
  { key: 'all', label: 'All', kinds: null },
  { key: 'donated', label: 'Donated', kinds: ['donated'] },
  { key: 'live', label: 'In progress', kinds: ['live'] },
  { key: 'ended', label: 'Not completed', kinds: ['ended', 'rejected'] },
  { key: 'missed', label: 'Missed', kinds: ['missed'] },
]
const visibleFilters = computed(() => FILTERS
  .map(f => ({ ...f, count: f.kinds ? entries.value.filter(e => f.kinds.includes(e.kind)).length : entries.value.length }))
  .filter(f => f.key === 'all' || f.count > 0))

const filtered = computed(() => {
  const f = FILTERS.find(x => x.key === filter.value)
  return f?.kinds ? entries.value.filter(e => f.kinds.includes(e.kind)) : entries.value
})

const byYear = computed(() => {
  const groups = []
  for (const e of filtered.value) {
    const year = String(e.date ?? '').slice(0, 4) || 'Undated'
    let g = groups.find(x => x.year === year)
    if (!g) groups.push(g = { year, items: [] })
    g.items.push(e)
  }
  return groups
})

const openKey = ref(null)
function toggle(key) {
  openKey.value = openKey.value === key ? null : key
}

// ── Summary ──
const litresGiven = computed(() => {
  const ml = donations.value
    .filter(v => DONATED.includes(v.status))
    .reduce((sum, v) => sum + (Number(v.volumeMl) || 450), 0)
  const l = ml / 1000
  return l === 0 ? '0' : l.toFixed(1)
})

// Still inside the waiting period after the last donation.
const resting = computed(() => !!nextEligibleDate.value && String(nextEligibleDate.value).slice(0, 10) > todayIso())

const nextLabel = computed(() => {
  const next = nextEligibleDate.value
  if (!next || String(next).slice(0, 10) <= todayIso()) return { value: 'Now', hint: 'You can donate' }
  const days = Math.round((parseDate(String(next).slice(0, 10)) - parseDate(todayIso())) / 86_400_000)
  return { value: formatDate(next, 'short'), hint: `Next donation, in ${days} day${days === 1 ? '' : 's'}` }
})

// ── Formatting ──
function parseDate(value) {
  if (!value) return null
  const s = String(value)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDate(value, style) {
  const d = parseDate(value)
  if (!d) return '-'
  return style === 'short'
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// "20:17" (H:i from the server) → "8:17 PM".
function formatTime(value) {
  if (!value) return '-'
  const [h, m] = String(value).split(':').map(Number)
  if (Number.isNaN(h)) return value
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m || 0).padStart(2, '0')} ${suffix}`
}

// The page is kept alive: onActivated refreshes in the background with no
// skeleton, guarded by loadedOnce because it also fires after the first mount.
let loadedOnce = false

async function load({ silent = false } = {}) {
  if (!silent) loading.value = true
  // GET /api/donors/donations: { donations: [{ id, center_name, address,
  //   donated_on, time, blood_type, volume_ml, status }], stats: {
  //   total_donations, lives_impacted }, meta }. Paginated (15 a page); the
  //   first page is shown, as before.
  const [visits, bookings, eligibility] = await Promise.allSettled([
    donorService.donations(),
    donorService.appointments(),
    donorService.eligibilityStatus(),
  ])

  if (visits.status === 'fulfilled') {
    const data = visits.value
    donations.value = (Array.isArray(data?.donations) ? data.donations : []).map(d => ({
      id: d.id,
      centerName: d.center_name,
      address: d.address,
      date: d.donated_on,
      time: d.time,
      bloodType: d.blood_type,
      volumeMl: d.volume_ml,
      status: d.status,
    }))
    stats.totalDonations = data?.stats?.total_donations ?? donations.value.filter(v => DONATED.includes(v.status)).length
    stats.livesImpacted = data?.stats?.lives_impacted ?? null
  } else {
    console.error('Failed to load donation history:', visits.reason)
    donations.value = []
    stats.totalDonations = 0
    stats.livesImpacted = null
  }

  if (bookings.status === 'fulfilled') {
    appointments.value = Array.isArray(bookings.value) ? bookings.value : []
  } else {
    console.error('Failed to load appointments:', bookings.reason)
  }

  if (eligibility.status === 'fulfilled') {
    nextEligibleDate.value = eligibility.value?.next_eligible_date ?? null
  }

  loading.value = false
  loadedOnce = true
}

onMounted(() => load())
onActivated(() => {
  if (loadedOnce) load({ silent: true })
})
</script>

<style scoped>
.history {
  --danger: var(--rb-accent, #D32F2F);
  --danger-text: var(--rb-accent-text, #D32F2F);

  max-width: 1400px; /* the same column as the top bar and the other donor pages */
  margin: 0 auto;
  padding: 24px 32px 48px;
  color: var(--rb-text-primary);
}
.history__inner { display: flex; flex-direction: column; gap: 20px; }

/* ── Two columns on desktop ── */
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  grid-template-areas: 'main side';
  gap: 24px;
  align-items: start;
}
.side {
  grid-area: side;
  position: sticky;
  top: 88px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.main { grid-area: main; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
/* Narrow column: when they can give next on top, the three counts beneath. */
.side .summary { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.side .tile { padding: 12px; }
.side .tile__value { font-size: 22px; }
.side .tile--next { grid-column: 1 / -1; order: -1; padding: 16px; }
.side .tile--next .tile__value { font-size: 22px; }
/* Filters as a list in the side column */
.side .filters { flex-direction: column; gap: 4px; padding: 6px; border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface); }
.side .filter { justify-content: space-between; width: 100%; border-color: transparent; border-radius: 10px; background: transparent; }
.side .filter:hover { background: var(--rb-surface-hover, #F1F5F9); }
.side .filter.is-on { background: var(--rb-primary); }

/* ── Skeleton ── */
.skeleton {
  border-radius: 16px;
  background: linear-gradient(90deg, var(--rb-skeleton-a, #EEF1F5) 25%, var(--rb-skeleton-b, #F6F8FA) 37%, var(--rb-skeleton-a, #EEF1F5) 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--title { height: 56px; max-width: 280px; }
.skeleton--tile { height: 84px; }
.skeleton--row { height: 64px; }
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

/* ── Header ── */
.head__title { margin: 0; font-size: clamp(22px, 2.6vw, 28px); font-weight: 800; letter-spacing: -0.02em; }
.head__sub { margin: 4px 0 0; font-size: 14px; color: var(--rb-text-secondary); }

/* ── Summary ── */
.summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  background: var(--rb-surface);
}
.tile__value { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; font-variant-numeric: tabular-nums; }
.tile__value small { font-size: 14px; color: var(--rb-text-secondary); }
.tile__value--text { font-size: 22px; }
.tile__label { font-size: 12px; line-height: 1.35; color: var(--rb-text-secondary); }
.tile--next { background: rgba(var(--rb-primary-rgb), 0.07); border-color: rgba(var(--rb-primary-rgb), 0.18); }
.tile--next .tile__value { color: var(--rb-primary-text); }

/* ── In progress ── */
.live {
  padding: 18px 20px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.25);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(var(--rb-primary-rgb), 0.07), rgba(var(--rb-primary-rgb), 0) 120px),
    var(--rb-surface);
}
.live__top { display: flex; align-items: center; gap: 12px; }
/* The idle version: quieter, no tracker. */
.live--idle { border-color: var(--rb-border); background: var(--rb-surface); }
.live--idle .live__icon { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.live__icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(var(--rb-primary-rgb), 0.12);
  color: var(--rb-primary-text);
}
.live__text { flex: 1; min-width: 0; }
.live__title { margin: 0; font-size: 15px; font-weight: 700; }
.live__meta { margin: 2px 0 0; font-size: 12px; color: var(--rb-text-secondary); }

/* ── Step track (in-progress card and expanded rows) ── */
.track {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}
.track__step { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.track__step + .track__step::before {
  content: '';
  position: absolute;
  top: 5px;
  right: 50%;
  width: 100%;
  height: 2px;
  background: var(--rb-border);
}
.track__step.is-done::before,
.track__step.is-current::before { background: var(--rb-primary); }
.track__dot {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border: 2px solid var(--rb-border-hover, #CBD5E1);
  border-radius: 50%;
  background: var(--rb-surface);
}
.track__step.is-done .track__dot { border-color: var(--rb-primary); background: var(--rb-primary); }
.track__step.is-current .track__dot { border-color: var(--rb-primary); box-shadow: 0 0 0 4px rgba(var(--rb-primary-rgb), 0.16); }
.track__label { font-size: 11px; font-weight: 600; color: var(--rb-text-muted); }
.track__step.is-done .track__label { color: var(--rb-text-secondary); }
.track__step.is-current .track__label { color: var(--rb-primary-text); font-weight: 700; }
/* Ended early: grey, a cross where it stopped, the rest faded. */
.track--ended .track__step.is-done::before,
.track--ended .track__step.is-stopped::before { background: var(--rb-text-muted); }
.track--ended .track__step.is-done .track__dot { border-color: var(--rb-text-muted); background: var(--rb-text-muted); }
.track__step.is-stopped .track__dot { width: 16px; height: 16px; margin-top: -2px; border-color: var(--rb-text-muted); color: var(--rb-text-secondary); }
.track__step.is-stopped .track__label { color: var(--rb-text-secondary); font-weight: 700; }
.track__step.is-skipped { opacity: 0.45; }
.track--small { margin-top: 14px; }

/* ── Chips ── */
.chip {
  flex: none;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.chip--donated { background: rgba(var(--rb-success-rgb, 46, 125, 50), 0.12); color: var(--rb-success-text, #2E7D32); }
.chip--live { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }
.chip--ended,
.chip--missed { background: var(--rb-surface-alt); color: var(--rb-text-secondary); border: 1px solid var(--rb-border); }
.chip--rejected { background: rgba(var(--rb-accent-rgb, 211, 47, 47), 0.1); color: var(--danger-text); }

/* ── Filters ── */
.filters { display: flex; flex-wrap: wrap; gap: 8px; }
.filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--rb-border);
  border-radius: 999px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.filter:hover { border-color: var(--rb-border-hover, #CBD5E1); color: var(--rb-text-primary); }
.filter.is-on { border-color: transparent; background: var(--rb-primary); color: #fff; }
.filter:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.filter__count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  color: var(--rb-text-secondary);
}
.filter.is-on .filter__count { background: rgba(255, 255, 255, 0.22); color: #fff; }
.none { margin: 0; font-size: 14px; color: var(--rb-text-secondary); }

/* ── Timeline: the agos line ── */
.year__label { margin: 4px 0 8px; font-size: 13px; font-weight: 800; color: var(--rb-text-secondary); letter-spacing: 0.02em; }
.timeline { margin: 0; padding: 0; list-style: none; }
.entry { position: relative; padding-left: 32px; }
/* The thread, from one entry's dot to the next */
.entry::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 9px;
  width: 2px;
  background: var(--rb-border);
}
.entry:first-child::before { top: 26px; }
.entry:last-child::before { bottom: calc(100% - 26px); }
.entry:only-child::before { display: none; }
.entry--missed::before { background: repeating-linear-gradient(180deg, var(--rb-border) 0 4px, transparent 4px 8px); }
.entry__dot {
  position: absolute;
  top: 19px;
  left: 3px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 2px solid var(--rb-border-hover, #CBD5E1);
  border-radius: 50%;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
}
.entry--donated .entry__dot { border-color: var(--danger); background: var(--danger); box-shadow: 0 0 0 3px rgba(var(--rb-accent-rgb, 211, 47, 47), 0.15); }
.entry--live .entry__dot { border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.18); }
.entry--rejected .entry__dot { border-color: var(--danger); color: var(--danger-text); }
.entry--missed .entry__dot { border-style: dashed; border-color: var(--rb-text-muted); }
.entry--ended .entry__dot { border-color: var(--rb-text-muted); }

.entry__row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  margin: 4px 0;
  padding: 12px 14px;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 150ms ease;
}
.entry__row:hover { border-color: var(--rb-border-hover, #CBD5E1); }
.entry__row:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.entry__row--static { cursor: default; background: transparent; border-style: dashed; }
.entry__row--static:hover { border-color: var(--rb-border); }
.entry__date { flex: none; width: 52px; font-size: 13px; font-weight: 700; color: var(--rb-text-secondary); }
.entry__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.entry__title { font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.entry--missed .entry__title { color: var(--rb-text-secondary); font-weight: 600; }
.entry__sub { font-size: 12px; color: var(--rb-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.entry__chev { flex: none; color: var(--rb-text-muted); transition: transform 150ms ease; }
.entry__chev.is-open { transform: rotate(180deg); }
.entry__chev-space { flex: none; width: 16px; }
.entry__milestone {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px 14px;
  font-size: 12px;
  font-weight: 700;
  color: var(--rb-text-secondary);
}
.entry__milestone :deep(.asset-icon) { color: #F59E0B; }

/* ── Details ── */
.detail {
  margin: 0 0 10px;
  padding: 14px 16px 16px;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface-alt);
}
.detail__facts { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px 16px; }
.detail__facts dt { font-size: 11px; font-weight: 700; color: var(--rb-text-muted); }
.detail__facts dd { margin: 2px 0 0; font-size: 13px; font-weight: 600; }
.detail__note { margin: 12px 0 0; font-size: 12px; line-height: 1.5; color: var(--rb-text-secondary); }
.detail__link { margin-left: 4px; font-weight: 700; color: var(--rb-primary-text); text-decoration: none; }
.detail__link:hover { text-decoration: underline; }

/* ── Empty ── */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 20px;
  border: 1px dashed var(--rb-border);
  border-radius: 18px;
  text-align: center;
}
.empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: rgba(var(--rb-accent-rgb, 211, 47, 47), 0.1);
  color: var(--danger-text);
}
.empty__title { margin: 6px 0 0; font-size: 16px; font-weight: 700; }
.empty__sub { margin: 0 0 8px; max-width: 42ch; font-size: 14px; color: var(--rb-text-secondary); }
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}
.btn--primary { background: var(--rb-primary); color: #fff; }
.btn--primary:hover { background: var(--rb-primary-hover); }
.btn--sm { flex: none; min-height: 38px; padding: 0 14px; font-size: 13px; }
.btn:active { transform: scale(0.98); }

/* ── Phone ── */
@media (max-width: 1023px) {
  .history { padding: 20px 32px 32px; }
  /* One column: the two wrappers step aside so their pieces can be ordered. */
  .layout { display: flex; flex-direction: column; align-items: stretch; gap: 16px; }
  .side, .main { display: contents; }
  .side .summary { grid-template-columns: repeat(4, minmax(0, 1fr)); order: 1; }
  .side .tile--next { grid-column: auto; order: 0; }
  .live { order: 2; }
  .side .filters { order: 3; flex-direction: row; flex-wrap: wrap; gap: 8px; padding: 0; border: 0; background: transparent; }
  .side .filter { width: auto; justify-content: flex-start; border-color: var(--rb-border); border-radius: 999px; background: var(--rb-surface); }
  .main > :not(.live) { order: 4; }
}
@media (max-width: 640px) {
  .history { padding: 16px 16px 24px; }
  .side .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .tile { padding: 12px; }
  .tile__value { font-size: 22px; }
  .tile__value--text { font-size: 18px; }
  .live { padding: 14px; }
  .live--idle .live__top { flex-wrap: wrap; }
  .live--idle .btn--sm { width: 100%; justify-content: center; }
  .track__label { display: none; }
  .track__step.is-current .track__label,
  .track__step.is-stopped .track__label { display: block; white-space: nowrap; }
  .entry { padding-left: 26px; }
  .entry::before { left: 6px; }
  .entry__dot { left: 0; }
  .entry__row { gap: 10px; padding: 10px 12px; }
  .entry__date { width: 44px; font-size: 12px; }
  .chip { font-size: 11px; padding: 2px 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .entry__chev, .entry__row { transition: none; }
  .btn:active { transform: none; }
}
</style>
