<template>
  <!--
    My activity: what this user did in RedAgos, and the sign-ins refused on
    their account, newest first and grouped by day. Theirs alone (the server
    returns no one else's), in the Audit Log's words.
  -->
  <section class="ma">
    <header class="ma__head">
      <div class="ma__titles">
        <h2 class="ma__title">Your activity</h2>
        <p class="ma__sub">What you did in RedAgos, and every sign-in on your account. Only you see this.</p>
      </div>
      <div class="ma__filters">
        <SelectField v-model="type" class="ma__type" size="sm" aria-label="Filter by kind of action"
          :options="[{ value: '', label: 'All actions' }, ...types]" @change="load()" />
        <DateRangeFilter v-model:from="fromDate" v-model:to="toDate" @change="load()" />
      </div>
    </header>

    <div v-if="error" class="ma__error" role="alert">
      <AssetIcon name="circle-alert" :size="15" />
      <span>{{ error }}</span>
      <button type="button" class="ma__link" @click="load(pager.page)">Retry</button>
    </div>

    <div v-if="loading && !rows.length" class="ma__body">
      <SkeletonList :rows="5" />
    </div>

    <div v-else-if="!rows.length && !error" class="ma__empty">
      <span class="ma__empty-icon"><AssetIcon name="history" :size="20" /></span>
      <p class="ma__empty-title">{{ filtered ? 'Nothing matches' : 'No activity yet' }}</p>
      <p class="ma__empty-text">
        {{ filtered ? 'Try another kind of action or other dates.' : 'Your sign-ins and the changes you make will show here.' }}
      </p>
      <button v-if="filtered" type="button" class="ui-btn ui-btn--sm" @click="clearFilters">Clear filters</button>
    </div>

    <div v-else class="ma__body" :class="{ 'ma__body--busy': loading }">
      <section v-for="day in days" :key="day.date" class="ma__day" :aria-label="day.label">
        <h3 class="ma__day-label">{{ day.label }}</h3>
        <ol class="ma__list">
          <li v-for="row in day.rows" :key="row.id" class="ma__item" :class="{ 'ma__item--open': openId === row.id }">
            <!-- The summary; it opens the row's full audit record below it. -->
            <button
              type="button"
              class="ma__row"
              :aria-expanded="openId === row.id"
              :aria-controls="`ma-rec-${row.id}`"
              @click="openId = openId === row.id ? null : row.id"
            >
              <span class="ma__icon" :class="`ma__icon--${auditTypeTone(row.type)}`" aria-hidden="true">
                <AssetIcon :name="iconFor(row.type)" :size="15" />
              </span>
              <span class="ma__text">
                <span class="ma__label">
                  {{ row.label || row.type_label }}
                  <span v-if="row.record" class="ma__record">{{ row.record }}</span>
                  <span v-if="row.audit?.outcome?.status === 'failure'" class="ma__outcome ma__outcome--fail">Failed</span>
                </span>
                <!-- A sign-in says where from; anything else says where in RedAgos. -->
                <span v-if="!(row.device || row.ip_address)" class="ma__meta">
                  <span>{{ row.module_label }}</span>
                  <template v-if="row.details"><span aria-hidden="true">·</span><span>{{ row.details }}</span></template>
                </span>
                <span v-else class="ma__meta ma__meta--device">
                  <AssetIcon name="monitor" :size="12" />
                  {{ [row.device, row.ip_address, row.details].filter(Boolean).join(' · ') }}
                </span>
                <span v-if="row.type === 'failed_sign_in'" class="ma__warn">
                  Someone could not sign in to your account. If this was not you, change your password in Security.
                </span>
              </span>
              <span class="ma__end">
                <time class="ma__time" :datetime="row.at">{{ timeLabel(row.time) }}</time>
                <AssetIcon name="chevron-down" :size="15" class="ma__chev" />
              </span>
            </button>

            <!-- The audit record: who, what, when, on what, from where, how it ended, how signed in, what changed. -->
            <dl v-if="openId === row.id && row.audit" :id="`ma-rec-${row.id}`" class="ma__rec">
              <div class="ma__f">
                <dt>Actor</dt>
                <dd>
                  <template v-if="row.audit.actor.kind === 'user'">
                    User #{{ row.audit.actor.id }}<template v-if="row.audit.actor.reference"> · {{ row.audit.actor.reference }}</template>
                    <span class="ma__sub">You</span>
                  </template>
                  <template v-else-if="row.audit.actor.kind === 'unauthenticated'">
                    Not signed in
                    <span class="ma__sub">Someone tried your account's sign-in</span>
                  </template>
                  <template v-else>System<span class="ma__sub">Ran automatically</span></template>
                </dd>
              </div>
              <div class="ma__f">
                <dt>Action</dt>
                <dd>{{ row.label || row.type_label }}<span class="ma__sub ma__mono">{{ row.audit.event }}</span></dd>
              </div>
              <div class="ma__f">
                <dt>Timestamp</dt>
                <dd>{{ dayLabel(row.date) }}, {{ timeLabel(row.time) }}<span class="ma__sub ma__mono">{{ row.audit.timestamp }}</span></dd>
              </div>
              <div class="ma__f">
                <dt>Target</dt>
                <dd>
                  <template v-if="row.audit.target">
                    {{ row.audit.target.type }} #{{ row.audit.target.id }}
                    <span v-if="row.audit.target.is_you" class="ma__sub">Your account</span>
                    <span v-else-if="row.record" class="ma__sub">{{ row.record }}</span>
                  </template>
                  <template v-else>{{ row.module_label }}<span class="ma__sub">No single record</span></template>
                </dd>
              </div>
              <div class="ma__f">
                <dt>Origin</dt>
                <dd>
                  {{ row.audit.origin.ip_address || 'Unknown IP' }}<template v-if="row.audit.origin.device"> · {{ row.audit.origin.device }}</template>
                  <span v-if="row.audit.origin.user_agent" class="ma__sub ma__mono ma__ua">{{ row.audit.origin.user_agent }}</span>
                </dd>
              </div>
              <div class="ma__f">
                <dt>Outcome</dt>
                <dd>
                  <span class="ma__outcome" :class="row.audit.outcome.status === 'failure' ? 'ma__outcome--fail' : 'ma__outcome--ok'">
                    {{ row.audit.outcome.status === 'failure' ? 'Failed' : 'Success' }}
                  </span>
                  <span v-if="row.audit.outcome.reason" class="ma__sub">{{ row.audit.outcome.reason }}<span class="ma__mono"> ({{ row.audit.outcome.code }})</span></span>
                </dd>
              </div>
              <div class="ma__f">
                <dt>Authentication</dt>
                <dd>
                  {{ authLabel(row.audit.auth.method) }}
                  <span v-if="row.audit.auth.portal" class="ma__sub">{{ portalLabel(row.audit.auth.portal) }}</span>
                </dd>
              </div>
              <div v-if="row.audit.changes.length" class="ma__f ma__f--full">
                <dt>Changes</dt>
                <dd>
                  <span v-for="(c, i) in row.audit.changes" :key="i" class="ma__change">
                    <span v-if="c.field !== 'value'" class="ma__change-field">{{ c.field }}</span>
                    <span class="ma__from">{{ c.from ?? 'none' }}</span>
                    <AssetIcon name="arrow-right" :size="12" />
                    <span class="ma__to">{{ c.to ?? 'none' }}</span>
                  </span>
                </dd>
              </div>
              <div v-if="row.audit.context.length" class="ma__f ma__f--full">
                <dt>Context</dt>
                <dd class="ma__ctx">
                  <span v-for="c in row.audit.context" :key="c.key"><span class="ma__ctx-key">{{ c.key }}</span> {{ c.value ?? '—' }}</span>
                </dd>
              </div>
            </dl>
          </li>
        </ol>
      </section>
    </div>

    <footer v-if="pager.total" class="ma__foot">
      <span class="ma__count">Showing {{ pageFrom }}–{{ pageTo }} of {{ pager.total }}</span>
      <div class="ma__pager">
        <button type="button" class="ui-btn ui-btn--sm" :disabled="pager.page <= 1 || loading" @click="load(pager.page - 1)">
          <AssetIcon name="chevron-left" :size="14" />
          Prev
        </button>
        <span class="ma__page">Page {{ pager.page }} / {{ pager.lastPage }}</span>
        <button type="button" class="ui-btn ui-btn--sm" :disabled="pager.page >= pager.lastPage || loading" @click="load(pager.page + 1)">
          Next
          <AssetIcon name="chevron-right" :size="14" />
        </button>
      </div>
    </footer>
  </section>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import SelectField from '~/components/common/SelectField.vue'
import DateRangeFilter from '~/components/common/DateRangeFilter.vue'
import SkeletonList from '~/components/ui/SkeletonList.vue'
import { authService } from '~/api/auth/AuthService'
import { auditTypeTone } from '~/utils/auditLog'

/**
 * API SHAPE
 *  GET /api/me/activity?type=&from=&to=&page=&per_page=   (any signed-in user)
 *   -> paginator; rows: { id, at, date, time, action, label, module_label,
 *      type, type_label, record, details, device, ip_address }, types: [{ value, label }]
 */

const PER_PAGE = 20

const rows = ref([])
const types = ref([])
const loading = ref(true)
const error = ref('')
const type = ref('')
const fromDate = ref('')
const toDate = ref('')
const pager = reactive({ page: 1, lastPage: 1, total: 0 })

// The row whose audit record is open: one at a time.
const openId = ref(null)

const filtered = computed(() => Boolean(type.value || fromDate.value || toDate.value))
const pageFrom = computed(() => (pager.total ? (pager.page - 1) * PER_PAGE + 1 : 0))
const pageTo = computed(() => Math.min(pager.page * PER_PAGE, pager.total))

async function load(page = 1) {
  loading.value = true
  error.value = ''
  try {
    const params = { page, per_page: PER_PAGE }
    if (type.value) params.type = type.value
    if (fromDate.value) params.from = fromDate.value
    if (toDate.value) params.to = toDate.value
    const res = await authService.myActivity(params)
    rows.value = res?.data ?? []
    openId.value = null
    if (Array.isArray(res?.types)) types.value = res.types
    Object.assign(pager, { page: res?.current_page ?? page, lastPage: Math.max(1, res?.last_page ?? 1), total: res?.total ?? rows.value.length })
  } catch (err) {
    error.value = err?.message || 'Could not load your activity.'
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  type.value = ''
  fromDate.value = ''
  toDate.value = ''
  load()
}

// The page's rows by day, newest first, headed Today, Yesterday or the date.
const days = computed(() => {
  const groups = []
  for (const row of rows.value) {
    const last = groups[groups.length - 1]
    if (last && last.date === row.date) last.rows.push(row)
    else groups.push({ date: row.date, label: dayLabel(row.date), rows: [row] })
  }
  return groups
})

function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayLabel(iso) {
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (iso === isoOf(today)) return 'Today'
  if (iso === isoOf(yesterday)) return 'Yesterday'
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// "13:05" -> "1:05 PM"
function timeLabel(value) {
  const [h, m] = String(value ?? '').split(':').map(Number)
  if (Number.isNaN(h)) return String(value ?? '')
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

const AUTH = { password: 'Password', google: 'Google sign-in', session: 'Signed-in session (token)' }

function authLabel(method) {
  return method ? (AUTH[method] ?? method) : 'None'
}

const PORTALS = { blood_center: 'Blood center portal', blood_bank: 'Hospital blood bank portal', donor: 'Donor portal', admin: 'Admin portal' }

function portalLabel(portal) {
  return PORTALS[portal] ?? portal
}

const ICONS = {
  sign_in: 'log-in',
  sign_out: 'log-out',
  failed_sign_in: 'shield',
  create: 'plus',
  edit: 'pencil',
  delete: 'trash-2',
  cancel: 'x',
  view: 'eye',
  export: 'download',
  print: 'printer',
  approve: 'check',
  reject: 'x',
  issue: 'send',
  send: 'send',
}

function iconFor(kind) {
  return ICONS[kind] ?? 'history'
}

onMounted(() => load())
</script>

<style scoped>
.ma {
  border: 1px solid var(--rb-border);
  border-radius: 22px;
  background: var(--rb-surface);
  box-shadow: var(--rb-shadow-sm);
  color: var(--rb-text-primary);
}

.ma__head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px 20px; padding: 22px 24px 16px; border-bottom: 1px solid var(--rb-border); }
.ma__titles { min-width: 0; }
.ma__title { margin: 0; font-size: var(--rb-fs-section, 15px); font-weight: 700; }
.ma__sub { margin: 4px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.ma__filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.ma__type { width: 170px; }

.ma__error { display: flex; align-items: center; gap: 8px; margin: 16px 24px 0; padding: 10px 12px; border-radius: 10px; background: rgba(var(--rb-accent-rgb), 0.06); color: var(--rb-accent-text); font-size: 13px; }
.ma__link { margin-left: auto; padding: 0; border: 0; background: none; font: inherit; font-weight: 700; color: inherit; cursor: pointer; text-decoration: underline; }

.ma__body { padding: 8px 24px 16px; transition: opacity 0.15s ease; }
.ma__body > .sk-list { padding-top: 12px; }
.ma__body--busy { opacity: 0.55; }

.ma__day + .ma__day { margin-top: 4px; }
.ma__day-label {
  position: sticky; top: 0; z-index: 1; margin: 0; padding: 12px 0 6px; background: var(--rb-surface);
  font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--rb-text-secondary);
}
.ma__list { margin: 0; padding: 0; list-style: none; }
.ma__item + .ma__item { border-top: 1px solid var(--rb-border); }
.ma__row {
  display: flex; align-items: flex-start; gap: 12px; width: 100%; margin: 0; padding: 10px 8px; border: 0; border-radius: 10px;
  background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; transition: background 0.12s ease;
}
.ma__row:hover { background: rgba(var(--rb-primary-rgb), 0.05); }
.ma__row:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.ma__item--open .ma__row { background: rgba(var(--rb-primary-rgb), 0.05); }
.ma__end { display: flex; flex-shrink: 0; align-items: center; gap: 8px; }
.ma__chev { color: var(--rb-text-muted); transition: transform 0.15s ease; }
.ma__item--open .ma__chev { transform: rotate(180deg); }

.ma__rec {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; margin: 2px 8px 12px 52px; padding: 14px 16px;
  border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface-alt);
}
.ma__f { min-width: 0; }
.ma__f--full { grid-column: 1 / -1; }
.ma__f dt { margin: 0 0 3px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--rb-text-secondary); }
.ma__f dd { margin: 0; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
.ma__sub { display: block; margin-top: 1px; font-size: 11.5px; font-weight: 500; color: var(--rb-text-secondary); }
.ma__mono { font-family: var(--rb-font-mono); font-size: 11.5px; }
.ma__ua { color: var(--rb-text-muted); }
.ma__outcome { display: inline-block; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 1.6; }
.ma__outcome--ok { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.ma__outcome--fail { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); }
.ma__change { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-right: 14px; }
.ma__change-field { color: var(--rb-text-secondary); font-weight: 500; }
.ma__from { text-decoration: line-through; color: var(--rb-text-secondary); font-weight: 500; }
.ma__ctx { display: flex; flex-wrap: wrap; gap: 4px 16px; font-weight: 500; }
.ma__ctx-key { color: var(--rb-text-secondary); }

.ma__icon { display: grid; flex-shrink: 0; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.ma__icon--info { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.ma__icon--ok { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.ma__icon--warn { background: rgba(var(--rb-warning-rgb), 0.12); color: var(--rb-warning-text); }
.ma__icon--crit { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); }

.ma__text { flex: 1; min-width: 0; }
.ma__text { display: block; }
.ma__label { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; margin: 0; font-size: 13.5px; font-weight: 700; }
.ma__record { font-family: var(--rb-font-mono); font-size: 11.5px; font-weight: 600; color: var(--rb-text-secondary); }
.ma__meta, .ma__warn { display: flex; }
.ma__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; margin: 2px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); overflow-wrap: anywhere; }
.ma__meta--device { gap: 5px; color: var(--rb-text-muted); }
.ma__warn { margin: 6px 0 0; padding: 6px 10px; border-radius: 8px; background: rgba(var(--rb-accent-rgb), 0.06); font-size: 12px; color: var(--rb-accent-text); }
.ma__time { padding-top: 0; font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; white-space: nowrap; }

.ma__empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 24px; text-align: center; }
.ma__empty-icon { display: grid; place-items: center; width: 48px; height: 48px; margin-bottom: 4px; border-radius: 14px; background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); }
.ma__empty-title { margin: 0; font-size: 14px; font-weight: 700; }
.ma__empty-text { margin: 0 0 6px; max-width: 360px; font-size: 12.5px; color: var(--rb-text-secondary); }

.ma__foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 24px; border-top: 1px solid var(--rb-border); font-size: 12.5px; color: var(--rb-text-secondary); }
.ma__pager { display: flex; align-items: center; gap: 8px; }
.ma__page { font-variant-numeric: tabular-nums; }

@media (max-width: 640px) {
  .ma__head, .ma__foot { padding-inline: 16px; }
  .ma__body { padding-inline: 16px; }
  .ma__error { margin-inline: 16px; }
  .ma__type { width: 100%; }
  .ma__filters { width: 100%; }
  .ma__rec { grid-template-columns: 1fr; margin-left: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .ma__body { transition: none; }
}
</style>
