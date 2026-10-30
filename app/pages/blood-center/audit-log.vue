<template>
  <div class="audit-page">
    <div v-if="initialLoading" class="audit-inner" aria-busy="true" aria-label="Loading the audit log">
      <div class="skeleton-head">
        <div class="skeleton skeleton--header" />
        <div class="skeleton skeleton--sub" />
      </div>
      <div class="skeleton skeleton--panel" />
    </div>

    <div v-else class="audit-inner">
      <header class="header-row">
        <div>
          <h1 class="page-title">Audit Log</h1>
        </div>
      </header>

      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ loadError }}</p>
        <button type="button" class="btn-link" @click="load(pager.page)">Retry</button>
      </div>

      <section class="panel">
        <div class="toolbar">
          <div class="toolbar__filters">
            <label class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                v-model="search"
                type="search"
                class="search__input"
                placeholder="Search user / action / record…"
                aria-label="Search by staff name or ID, action, or record"
                @input="onSearchInput"
              >
            </label>
            <SelectField v-model="moduleFilter" class="sel-filter" size="sm" aria-label="Filter by module"
              :options="[{ value: '', label: 'All modules' }, ...moduleOptions]" @change="load()" />
            <SelectField v-model="typeFilter" class="sel-filter" size="sm" aria-label="Filter by action"
              :options="[{ value: '', label: 'All actions' }, ...typeOptions]" @change="load()" />
            <DateRangeFilter v-model:from="fromDate" v-model:to="toDate" @change="load()" />
          </div>

          <div class="toolbar__actions">
            <span v-if="updatedAt" class="updated">
              <AssetIcon name="clock" :size="13" />
              Updated {{ updatedAtLabel }}
            </span>
            <button type="button" class="btn-outline" :disabled="loading" @click="load(pager.page)">
              <AssetIcon name="refresh-cw" :size="14" :class="{ spin: loading }" />
              Refresh
            </button>
          </div>
        </div>

        <div class="table-wrap" :class="{ 'table-wrap--busy': loading && rows.length }">
          <table class="audit-table">
            <caption class="sr-only">What this centre's staff did, newest first</caption>
            <thead>
              <tr>
                <th scope="col" class="c-when">When</th>
                <th scope="col" class="c-user">User</th>
                <th scope="col" class="c-action">Action</th>
                <th scope="col" class="c-module">Module</th>
                <th scope="col" class="c-record">Record</th>
                <th scope="col" class="c-details">Details</th>
              </tr>
            </thead>

            <tbody v-if="loading && !rows.length">
              <tr v-for="n in 8" :key="'sk-' + n">
                <td colspan="6"><span class="skeleton skeleton--line" /></td>
              </tr>
            </tbody>

            <tbody v-else-if="!rows.length">
              <tr>
                <td colspan="6" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon :name="hasFilters ? 'search-x' : 'history'" :size="20" /></span>
                    <p class="empty-state__title">{{ hasFilters ? 'Nothing matches' : 'No activity yet' }}</p>
                    <p class="empty-state__text">
                      {{ hasFilters
                        ? 'Try another name, action or record, or widen the dates.'
                        : 'Sign-ins and everything your staff record, change, view or export appear here.' }}
                    </p>
                    <button v-if="hasFilters" type="button" class="btn-outline" @click="clearFilters">Clear filters</button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="row in rows" :key="row.id" class="audit-row">
                <td class="c-when nowrap">{{ row.date }} {{ row.time }}</td>
                <td class="c-user">
                  <span class="user__name" :class="{ 'user__name--system': row.user?.system }">{{ row.user?.name ?? '—' }}</span>
                  <span v-if="row.user?.role" class="sub">{{ row.user.role }}</span>
                </td>
                <td class="c-action">
                  <span class="chip" :class="`chip--${auditTypeTone(row.type)}`">{{ row.type_label }}</span>
                </td>
                <td class="c-module">{{ row.module_label }}</td>
                <td class="c-record">
                  <span v-if="row.record" class="code" :title="row.record">{{ row.record }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="c-details">{{ row.details }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="pager">
          <span class="pager__info">{{ pager.total }} record(s)</span>
          <div class="pager__btns">
            <button type="button" class="btn-outline btn-outline--sm" :disabled="pager.page <= 1 || loading" @click="load(pager.page - 1)">
              <AssetIcon name="chevron-left" :size="14" />
              Prev
            </button>
            <span class="pager__page">Page {{ pager.page }} / {{ pager.lastPage }}</span>
            <button type="button" class="btn-outline btn-outline--sm" :disabled="pager.page >= pager.lastPage || loading" @click="load(pager.page + 1)">
              Next
              <AssetIcon name="chevron-right" :size="14" />
            </button>
          </div>
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup>
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import SelectField from '~/components/common/SelectField.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import DateRangeFilter from '~/components/common/DateRangeFilter.vue'
import { auditTypeTone } from '~/utils/auditLog'
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // The Blood Center Admin's alone (project owner, 2026-10-21).
  requires: 'audit.view',
})

/**
 * API SHAPE
 * -------------------------------------------------------------------------
 *  GET /audit-log?search=&module=&type=&from=&to=&page=
 *      -> paginator, newest first; rows: { id, at, date, time (the centre's
 *         own timezone), user: { name, role, system }, action, module,
 *         module_label, type, type_label, record (a reference, or null),
 *         details }
 *         plus modules and types: [{ value, label }] for the two filters.
 *  Read-only: the trail is never edited from here.
 * -------------------------------------------------------------------------
 */

const PER_PAGE = 25

const initialLoading = ref(true)
const loading = ref(false)
const loadError = ref('')
const updatedAt = ref(null)
const rows = ref([])
const pager = reactive({ page: 1, lastPage: 1, total: 0 })

const search = ref('')
const moduleFilter = ref('')
const typeFilter = ref('')
const fromDate = ref('')
const toDate = ref('')
const moduleOptions = ref([])
const typeOptions = ref([])

const hasFilters = computed(() => Boolean(search.value.trim() || moduleFilter.value || typeFilter.value || fromDate.value || toDate.value))
const updatedAtLabel = computed(() => updatedAt.value?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) ?? '')

function filterParams() {
  const params = {}
  if (search.value.trim()) params.search = search.value.trim()
  if (moduleFilter.value) params.module = moduleFilter.value
  if (typeFilter.value) params.type = typeFilter.value
  if (fromDate.value) params.from = fromDate.value
  if (toDate.value) params.to = toDate.value
  return params
}

function errorMessage(err, fallback) {
  return Object.values(err?.errors ?? err?.data?.errors ?? {}).flat()[0] || err?.message || fallback
}

async function load(page = 1) {
  loading.value = true
  loadError.value = ''
  try {
    const res = await bloodCenterService.auditLog({ ...filterParams(), page, per_page: PER_PAGE })
    rows.value = res?.data ?? []
    Object.assign(pager, { page: res?.current_page ?? page, lastPage: Math.max(1, res?.last_page ?? 1), total: res?.total ?? rows.value.length })
    if (Array.isArray(res?.modules)) moduleOptions.value = res.modules
    if (Array.isArray(res?.types)) typeOptions.value = res.types
    updatedAt.value = new Date()
  } catch (err) {
    loadError.value = errorMessage(err, 'Could not load the audit log.')
  } finally {
    loading.value = false
    initialLoading.value = false
  }
}

let searchTimer = null

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => load(), 300)
}

function clearFilters() {
  search.value = ''
  moduleFilter.value = ''
  typeFilter.value = ''
  fromDate.value = ''
  toDate.value = ''
  load()
}

onMounted(() => {
  load()
})

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
})
</script>

<style scoped>
.audit-page {
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

.audit-inner { display: flex; flex-direction: column; gap: 16px; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ---------- Skeletons ---------- */
.skeleton {
  display: block;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton-head { display: flex; flex-direction: column; gap: 8px; }
.skeleton--header { height: 28px; max-width: 200px; border-radius: 8px; }
.skeleton--sub { height: 14px; max-width: 320px; border-radius: 6px; }
.skeleton--panel { height: 480px; }
.skeleton--line { height: 16px; width: 100%; border-radius: 6px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* ---------- Header and buttons ---------- */
.header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0; }

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  flex-shrink: 0;
  color: var(--rb-text-primary);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong);
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline--sm { height: 30px; padding: 0 10px; font-size: 12px; border-radius: 8px; gap: 4px; }

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--rb-primary-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-link:hover { text-decoration: underline; }

.btn-outline:focus-visible,
.btn-link:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

.spin { animation: spin 0.9s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- Banner ---------- */
.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 13px;
}

.banner > :deep(.asset-icon) { flex-shrink: 0; }
.banner__text { flex: 1; margin: 0; line-height: 1.45; }
.banner--error > :deep(.asset-icon) { color: var(--rb-accent-text); }
.banner--error { border-color: rgba(var(--rb-accent-rgb), 0.35); }

/* ---------- Panel and toolbar ---------- */
.panel {
  container-type: inline-size;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  overflow: hidden;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--rb-border);
}

.toolbar__filters,
.toolbar__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar__filters { flex: 1 1 auto; min-width: 0; }
.toolbar__actions { justify-content: flex-end; margin-left: auto; }

.updated {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 4px;
  font-size: 12px;
  color: var(--rb-text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.search { position: relative; flex: 1 1 200px; min-width: 180px; max-width: 300px; }

.search__icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--rb-text-secondary);
  pointer-events: none;
}

.search__input,
.select {
  height: 36px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.search__input { width: 100%; padding: 0 12px 0 34px; }

/* As wide as the chosen option, not the longest one (where supported). */
.select {
  field-sizing: content;
  padding: 0 30px 0 12px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 10px 6px;
  appearance: none;
  cursor: pointer;
}

.search__input::placeholder { color: var(--rb-placeholder); }

.search__input:focus,
.select:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

/* ---------- Table ---------- */
.table-wrap { position: relative; overflow-x: auto; transition: opacity 0.15s ease; }
.table-wrap--busy { opacity: 0.55; }

.audit-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; }

.audit-table thead th {
  padding: 10px;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
  white-space: nowrap;
}

.audit-table tbody td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--rb-border);
  vertical-align: middle;
  overflow: hidden;
}

.audit-table th:first-child,
.audit-table td:first-child { padding-left: 16px; }

.audit-table th:last-child,
.audit-table td:last-child { padding-right: 16px; }

.audit-table tbody tr:last-child td { border-bottom: 0; }
.audit-row { transition: background 0.12s ease; }
.audit-row:hover { background: var(--rb-surface-hover); }

.c-when { width: 140px; font-variant-numeric: tabular-nums; color: var(--rb-text-secondary); }
.c-user { width: 190px; }
.c-action { width: 132px; }
.c-module { width: 120px; }
.c-record { width: 140px; }
.c-details { line-height: 1.45; overflow-wrap: anywhere; }

/* Narrow panels keep when, who, what and the details. */
@container (max-width: 900px) {
  .c-module { display: none; }
}

@container (max-width: 720px) {
  .c-record { display: none; }
}

.user__name { display: block; font-weight: 700; overflow-wrap: anywhere; }
.user__name--system { color: var(--rb-text-secondary); }
.sub { display: block; margin-top: 2px; font-size: 11.5px; color: var(--rb-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.muted { color: var(--rb-text-secondary); }
.nowrap { white-space: nowrap; }

.code {
  display: block;
  font-family: var(--rb-font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* The kind of action: a soft pill in its tone, as the mock-up draws it. */
.chip {
  --tone: var(--rb-text-muted);
  --tone-text: var(--rb-text-secondary);
  display: inline-block;
  max-width: 100%;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--tone) 28%, transparent);
  background: color-mix(in srgb, var(--tone) 12%, var(--rb-surface));
  color: var(--tone-text);
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip--info { --tone: var(--rb-primary); --tone-text: var(--rb-primary-text); }
.chip--ok { --tone: var(--rb-success); --tone-text: var(--rb-success-text); }
.chip--warn { --tone: var(--rb-warning); --tone-text: var(--rb-warning-text); }
.chip--crit { --tone: var(--rb-accent); --tone-text: var(--rb-accent-text); }

.empty-cell { padding: 0 !important; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 24px; text-align: center; }

.empty-state__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-bottom: 6px;
  border-radius: 12px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  color: var(--rb-text-secondary);
}

.empty-state__title { margin: 0; font-size: 14px; font-weight: 700; }
.empty-state__text { margin: 0 0 8px; max-width: 46ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* ---------- Pager ---------- */
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  padding: 12px 16px;
  border-top: 1px solid var(--rb-border);
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.pager__btns { display: flex; align-items: center; gap: 8px; }
.pager__page { font-variant-numeric: tabular-nums; }

@media (max-width: 760px) {
  .toolbar__filters { flex-basis: 100%; }
  .search { max-width: none; flex: 1 1 100%; }
  .toolbar__actions { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .spin { animation: none !important; }
}
</style>

<style scoped>
/* The system dropdown in a toolbar: a fixed width rather than the row's. */
.sel-filter { width: 180px; flex: none; }
</style>
