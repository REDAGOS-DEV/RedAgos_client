<template>
  <!--
    The Blood Center Admin's dashboard: the centre's people and setup, which
    only the Admin can act on (AdminOverviewService on the server). Read from
    the summary useBloodCenterTasks already loaded for the "Needs you" strip.

    A summary band first (is the centre in order, at a glance), then the two
    things to act on: who fills each key post, and the team; with the setup
    and the latest changes beside them.
  -->
  <div class="admin">
    <div v-if="!overview" class="band band--skeleton" aria-busy="true" />

    <template v-else>
      <!-- ── At a glance ── -->
      <section class="band" aria-label="Centre at a glance">
        <div class="tiles">
          <NuxtLink to="/blood-center/staff" class="tile">
            <span class="tile__icon tile__icon--blue" aria-hidden="true"><AssetIcon name="users" :size="18" /></span>
            <span class="tile__body">
              <span class="tile__label">Staff accounts</span>
              <span class="tile__value">{{ overview.team.total }}</span>
              <span class="tile__note">
                {{ overview.team.active }} active<template v-if="overview.team.pending"> · {{ overview.team.pending }} not activated</template>
              </span>
            </span>
          </NuxtLink>

          <a href="#role-coverage" class="tile">
            <span class="tile__icon" :class="gaps ? 'tile__icon--red' : 'tile__icon--green'" aria-hidden="true">
              <AssetIcon :name="gaps ? 'user-x' : 'badge-check'" :size="18" />
            </span>
            <span class="tile__body">
              <span class="tile__label">Key roles filled</span>
              <span class="tile__value">{{ filledCount }}<span class="tile__of"> of {{ overview.coverage.length }}</span></span>
              <span class="meter" :class="{ 'meter--bad': gaps }"><span :style="{ width: `${pct(filledCount, overview.coverage.length)}%` }" /></span>
            </span>
          </a>

          <NuxtLink to="/blood-center/settings?tab=center" class="tile">
            <span class="tile__icon" :class="setupDone === setupTotal ? 'tile__icon--green' : 'tile__icon--amber'" aria-hidden="true">
              <AssetIcon name="settings" :size="18" />
            </span>
            <span class="tile__body">
              <span class="tile__label">Centre setup</span>
              <span class="tile__value">{{ setupDone }}<span class="tile__of"> of {{ setupTotal }} done</span></span>
              <span class="meter" :class="{ 'meter--warn': setupDone < setupTotal }"><span :style="{ width: `${pct(setupDone, setupTotal)}%` }" /></span>
            </span>
          </NuxtLink>

          <NuxtLink to="/blood-center/audit-log" class="tile">
            <span class="tile__icon tile__icon--violet" aria-hidden="true"><AssetIcon name="history" :size="18" /></span>
            <span class="tile__body">
              <span class="tile__label">Changes this week</span>
              <span class="tile__value">{{ overview.changes_this_week ?? 0 }}</span>
              <span class="tile__note">Staff and settings</span>
            </span>
          </NuxtLink>
        </div>

        <nav class="shortcuts" aria-label="Admin shortcuts">
          <span class="shortcuts__label">Shortcuts</span>
          <NuxtLink v-for="link in QUICK" :key="link.label" :to="link.to" class="shortcut">
            <AssetIcon :name="link.icon" :size="14" />
            {{ link.label }}
          </NuxtLink>
        </nav>
      </section>

      <div class="layout">
        <div class="side">
          <!-- ── Role coverage: the posts the work needs ── -->
          <section id="role-coverage" class="card" aria-labelledby="coverage-title">
            <header class="card__head">
              <div>
                <h2 id="coverage-title" class="card__title">Role coverage</h2>
                <p class="card__sub">The posts each department needs to keep its work moving.</p>
              </div>
              <span class="pill" :class="gaps ? 'pill--bad' : 'pill--ok'">
                <AssetIcon :name="gaps ? 'circle-alert' : 'check'" :size="12" />
                {{ gaps ? `${gaps} unfilled` : 'All filled' }}
              </span>
            </header>

            <!-- Unfilled first, with what stops without them. -->
            <ul v-if="gapPosts.length" class="gaps">
              <li v-for="post in gapPosts" :key="post.role" class="gap">
                <span class="gap__icon" aria-hidden="true"><AssetIcon name="user-x" :size="16" /></span>
                <span class="gap__body">
                  <span class="gap__name">{{ post.role_label }}</span>
                  <span class="gap__why">{{ post.department_label }} · {{ post.why }}</span>
                </span>
                <NuxtLink to="/blood-center/staff" class="gap__assign">Assign</NuxtLink>
              </li>
            </ul>

            <ul class="posts">
              <li v-for="post in filledPosts" :key="post.role" class="post" :title="post.why">
                <span class="post__avatar" aria-hidden="true">{{ post.count }}</span>
                <span class="post__body">
                  <span class="post__name">{{ post.role_label }}</span>
                  <span class="post__dept">{{ post.department_label }}</span>
                </span>
                <AssetIcon name="check" :size="14" class="post__ok" />
              </li>
            </ul>
          </section>

          <!-- ── Recent changes: the audit log's part the Admin watches ── -->
          <section class="card" aria-labelledby="activity-title">
            <header class="card__head">
              <h2 id="activity-title" class="card__title">Recent changes</h2>
              <NuxtLink to="/blood-center/audit-log" class="card__link">Audit Log <AssetIcon name="arrow-right" :size="13" /></NuxtLink>
            </header>
            <ol v-if="overview.activity.length" class="timeline">
              <li v-for="item in overview.activity" :key="item.id" class="timeline__item">
                <span class="timeline__label">{{ item.label }}</span>
                <span class="timeline__meta">{{ item.by }} · {{ ago(item.at) }}</span>
              </li>
            </ol>
            <p v-else class="empty">No staff or settings changes yet.</p>
          </section>
        </div>

        <div class="side">
          <!-- ── Team ── -->
          <section class="card" aria-labelledby="team-title">
            <header class="card__head">
              <h2 id="team-title" class="card__title">Team by department</h2>
              <NuxtLink to="/blood-center/staff" class="card__link">Staff Accounts <AssetIcon name="arrow-right" :size="13" /></NuxtLink>
            </header>
            <ul class="depts">
              <li v-for="dept in overview.team.by_department" :key="dept.department" class="dept">
                <span class="dept__label" :title="dept.label">{{ dept.label }}</span>
                <span class="dept__bar"><span :style="{ width: `${pct(dept.count, largest)}%` }" /></span>
                <span class="dept__count">{{ dept.count }}</span>
              </li>
            </ul>
            <div v-if="overview.team.suspended || overview.team.deactivated" class="states">
              <span v-if="overview.team.suspended" class="state state--warn">{{ overview.team.suspended }} suspended</span>
              <span v-if="overview.team.deactivated" class="state">{{ overview.team.deactivated }} deactivated</span>
            </div>
            <p v-if="overview.unassigned_staff.length" class="people people--warn">
              <AssetIcon name="users" :size="13" />
              <span><strong>No role yet:</strong> {{ names(overview.unassigned_staff, overview.needs.unassigned) }}</span>
            </p>
            <p v-if="overview.pending_staff.length" class="people">
              <AssetIcon name="clock" :size="13" />
              <span><strong>Not activated:</strong> {{ names(overview.pending_staff, overview.needs.pending_activation) }}</span>
            </p>
          </section>

          <!-- ── Setup ── -->
          <section class="card" aria-labelledby="setup-title">
            <header class="card__head">
              <div>
                <h2 id="setup-title" class="card__title">Centre setup</h2>
                <p class="card__sub">Printed on receipts, statements and the stock report.</p>
              </div>
            </header>
            <ul class="checks">
              <li v-for="item in setupItems" :key="item.key" class="check" :class="{ 'check--done': item.done }">
                <span class="check__mark" aria-hidden="true"><AssetIcon :name="item.done ? 'check' : 'plus'" :size="13" /></span>
                <span class="check__label">{{ item.label }}</span>
                <NuxtLink v-if="!item.done" to="/blood-center/settings?tab=center" class="check__action">Upload</NuxtLink>
                <span v-else class="check__done">Done</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { useBloodCenterTasks } from '~/composables/useBloodCenterTasks'

const { adminOverview: overview } = useBloodCenterTasks()

const QUICK = [
  { label: 'Add staff', to: '/blood-center/staff', icon: 'users' },
  { label: 'Centre settings', to: '/blood-center/settings?tab=center', icon: 'settings' },
  { label: 'Audit Log', to: '/blood-center/audit-log', icon: 'history' },
  { label: 'Reports', to: '/blood-center/reports', icon: 'bar-chart' },
]

const gaps = computed(() => overview.value?.needs?.coverage_gaps ?? 0)
const gapPosts = computed(() => (overview.value?.coverage ?? []).filter(p => !p.filled))
const filledPosts = computed(() => (overview.value?.coverage ?? []).filter(p => p.filled))
const filledCount = computed(() => filledPosts.value.length)

const setupItems = computed(() => [
  { key: 'logo', label: 'Centre logo', done: !!overview.value?.setup?.logo },
  { key: 'seal', label: 'Left report logo', done: !!overview.value?.setup?.seal },
])
const setupTotal = computed(() => setupItems.value.length)
const setupDone = computed(() => setupItems.value.filter(i => i.done).length)

const largest = computed(() => Math.max(1, ...(overview.value?.team?.by_department ?? []).map(d => d.count)))
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0)

// "Ana Cruz, Ben Reyes and 3 more".
function names(people, total) {
  const shown = people.map(p => p.name).filter(Boolean)
  const more = total - shown.length
  return more > 0 ? `${shown.join(', ')} and ${more} more` : shown.join(', ')
}

function ago(iso) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days < 7 ? `${days} d ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.admin { display: flex; flex-direction: column; gap: 16px; }

/* ── Summary band ── */
.band {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--rb-border);
  border-radius: 20px;
  background: var(--rb-surface);
}
.band--skeleton { min-height: 170px; border: 0; background: var(--rb-skeleton-a, #EEF1F5); }
.tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.tile {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: var(--rb-surface-hover, #F6F8FB);
  color: var(--rb-text-primary);
  text-decoration: none;
  transition: background-color 150ms ease, transform 150ms ease;
}
.tile:hover { background: color-mix(in srgb, var(--rb-primary) 7%, var(--rb-surface)); transform: translateY(-1px); }
.tile:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.tile__icon { display: flex; flex-shrink: 0; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 11px; }
.tile__icon--blue { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }
.tile__icon--green { background: rgba(46, 125, 50, 0.12); color: var(--rb-success-text, #2E7D32); }
.tile__icon--red { background: rgba(211, 47, 47, 0.12); color: #C62828; }
.tile__icon--amber { background: rgba(245, 124, 0, 0.14); color: #B45309; }
.tile__icon--violet { background: rgba(124, 58, 237, 0.12); color: #6D28D9; }
html.dark .tile__icon--red { color: #EF9A9A; }
html.dark .tile__icon--amber { color: #FFB74D; }
html.dark .tile__icon--violet { color: #C4B5FD; }
.tile__body { display: flex; flex: 1; flex-direction: column; gap: 3px; min-width: 0; }
.tile__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); }
.tile__value { font-size: 24px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
.tile__of { margin-left: 2px; font-size: 13px; font-weight: 600; color: var(--rb-text-secondary); }
.tile__note { font-size: 12px; color: var(--rb-text-secondary); }
.meter { display: block; height: 6px; margin-top: 4px; overflow: hidden; border-radius: 999px; background: var(--rb-border); }
.meter span { display: block; height: 100%; border-radius: inherit; background: var(--rb-success-text, #2E7D32); }
.meter--warn span { background: #F59E0B; }
.meter--bad span { background: #D32F2F; }

.shortcuts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding-top: 12px; border-top: 1px solid var(--rb-border); }
.shortcuts__label { margin-right: 4px; font-size: 12px; font-weight: 700; color: var(--rb-text-secondary); }
.shortcut {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-primary);
  text-decoration: none;
  transition: background-color 150ms ease, color 150ms ease;
}
.shortcut:hover { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.shortcut:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; }

/* ── Layout ── */
.layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.side { display: flex; flex-direction: column; gap: 16px; }

.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid var(--rb-border);
  border-radius: 18px;
  background: var(--rb-surface);
  scroll-margin-top: 84px;
}
.card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.card__title { margin: 0; font-size: var(--rb-fs-section, 16px); font-weight: 700; color: var(--rb-text-primary); }
.card__sub { margin: 2px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.card__link { display: inline-flex; flex-shrink: 0; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: var(--rb-primary-text); text-decoration: none; }
.card__link:hover { text-decoration: underline; }

.pill { display: inline-flex; flex-shrink: 0; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.pill--ok { background: rgba(46, 125, 50, 0.12); color: var(--rb-success-text, #2E7D32); }
.pill--bad { background: rgba(211, 47, 47, 0.1); color: #C62828; }
html.dark .pill--bad { background: rgba(239, 83, 80, 0.16); color: #EF9A9A; }

/* ── Role coverage ── */
.gaps { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.gap {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(211, 47, 47, 0.25);
  border-radius: 14px;
  background: rgba(211, 47, 47, 0.05);
}
html.dark .gap { border-color: rgba(239, 83, 80, 0.35); background: rgba(239, 83, 80, 0.08); }
.gap__icon { display: flex; flex-shrink: 0; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; background: rgba(211, 47, 47, 0.12); color: #C62828; }
html.dark .gap__icon { color: #EF9A9A; }
.gap__body { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.gap__name { font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.gap__why { font-size: 12.5px; line-height: 1.4; color: #B42318; }
html.dark .gap__why { color: #EF9A9A; }
.gap__assign {
  flex-shrink: 0;
  padding: 7px 14px;
  border-radius: 999px;
  background: var(--rb-primary);
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  text-decoration: none;
}
.gap__assign:hover { background: var(--rb-primary-hover, var(--rb-primary)); }

.posts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
.post {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
}
.post__avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(var(--rb-primary-rgb), 0.1);
  font-size: 13px;
  font-weight: 800;
  color: var(--rb-primary-text);
}
.post__body { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.post__name { overflow: hidden; font-size: 13.5px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; color: var(--rb-text-primary); }
.post__dept { font-size: 12px; color: var(--rb-text-secondary); }
.post__ok { flex-shrink: 0; color: var(--rb-success-text, #2E7D32); }

/* ── Team ── */
.depts { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.dept { display: grid; grid-template-columns: 128px minmax(0, 1fr) 24px; align-items: center; gap: 10px; font-size: 13px; }
.dept__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--rb-text-primary); }
.dept__bar { height: 8px; overflow: hidden; border-radius: 999px; background: var(--rb-surface-hover, #F1F5F9); }
.dept__bar span { display: block; height: 100%; border-radius: inherit; background: var(--rb-primary); }
.dept__count { font-weight: 700; text-align: right; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.states { display: flex; flex-wrap: wrap; gap: 6px; }
.state { padding: 3px 9px; border-radius: 999px; background: var(--rb-surface-hover, #F1F5F9); font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.state--warn { background: rgba(245, 124, 0, 0.12); color: #B45309; }
html.dark .state--warn { color: #FFB74D; }
.people { display: flex; align-items: flex-start; gap: 6px; margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--rb-text-secondary); }
.people :deep(svg) { flex-shrink: 0; margin-top: 2px; }
.people strong { color: var(--rb-text-primary); font-weight: 600; }
.people--warn :deep(svg) { color: #B45309; }

/* ── Setup ── */
.checks { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.check { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; background: var(--rb-surface-hover, #F6F8FB); }
.check__mark { display: flex; flex-shrink: 0; align-items: center; justify-content: center; width: 24px; height: 24px; border: 1.5px dashed var(--rb-border-hover, #CBD5E1); border-radius: 50%; color: var(--rb-text-secondary); }
.check--done .check__mark { border: 0; background: var(--rb-success-text, #2E7D32); color: #fff; }
.check__label { flex: 1; font-size: 13.5px; font-weight: 600; color: var(--rb-text-primary); }
.check__action { font-size: 13px; font-weight: 700; color: var(--rb-primary-text); text-decoration: none; }
.check__action:hover { text-decoration: underline; }
.check__done { font-size: 12.5px; color: var(--rb-success-text, #2E7D32); font-weight: 600; }

/* ── Recent changes ── */
.timeline { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.timeline__item { position: relative; display: flex; flex-direction: column; gap: 1px; padding: 0 0 12px 18px; }
.timeline__item::before { content: ''; position: absolute; top: 5px; left: 0; width: 8px; height: 8px; border-radius: 50%; background: var(--rb-primary); }
.timeline__item:not(:last-child)::after { content: ''; position: absolute; top: 16px; bottom: 0; left: 3.5px; width: 1px; background: var(--rb-border); }
.timeline__item:last-child { padding-bottom: 0; }
.timeline__label { font-size: 13.5px; font-weight: 600; color: var(--rb-text-primary); }
.timeline__meta { font-size: 12px; color: var(--rb-text-secondary); }
.empty { margin: 0; font-size: 13px; color: var(--rb-text-secondary); }

@media (max-width: 1200px) {
  .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 1100px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .tile, .shortcut { transition: none; }
}
</style>
