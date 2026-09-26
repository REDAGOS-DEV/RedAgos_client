<template>
  <div class="stock">
    <header class="stock__header">
      <div>
        <p class="stock__eyebrow">Blood Center Portal / Issuance</p>
        <h1 class="stock__title">Daily Stock Report</h1>
        <p class="stock__subtitle">
          Issuable stock right now, laid out as the Daily Blood Stock Inventory sheet. Download it to print or send.
        </p>
      </div>

      <div class="stock__actions">
        <button type="button" class="btn" :disabled="loading" @click="load">
          <AssetIcon name="refresh-cw" :size="14" />
          {{ loading ? 'Loading…' : 'Refresh' }}
        </button>
        <button type="button" class="btn btn--primary" :disabled="downloading || !report" @click="download">
          <AssetIcon name="file-down" :size="14" />
          {{ downloading ? 'Preparing…' : 'Download PDF' }}
        </button>
      </div>
    </header>

    <p v-if="error" class="alert alert--error" role="alert">{{ error }}</p>

    <p v-if="loading && !report" class="stock__loading">Loading the report…</p>

    <template v-if="report">
      <!-- Needs attention first: what expires before tomorrow ends, and what cannot be dated. -->
      <div v-if="report.near_expiry.today || report.near_expiry.tomorrow" class="callout callout--warn" role="status">
        <AssetIcon name="triangle-alert" :size="16" />
        <p>
          <strong>{{ report.near_expiry.today }}</strong> unit(s) expire today and
          <strong>{{ report.near_expiry.tomorrow }}</strong> tomorrow. They are boxed in red below.
        </p>
      </div>

      <div v-if="report.unconfigured.length" class="callout">
        <AssetIcon name="circle-alert" :size="16" />
        <p>
          Shelf life not configured for {{ report.unconfigured.join(', ') }}, so their stock is shown as totals only.
          <NuxtLink v-if="canConfigure" to="/blood-center/blood-components" class="callout__link">Set shelf life</NuxtLink>
        </p>
      </div>

      <article class="sheet" aria-label="Daily Blood Stock Inventory">
        <div class="sheet__head">
          <div class="sheet__logo">
            <img v-if="sealVisible" :src="SEAL_SRC" alt="Department of Health" @error="sealVisible = false" >
          </div>
          <div class="sheet__lines">
            <p v-for="line in report.header" :key="line">{{ line }}</p>
            <p class="sheet__facility">{{ report.facility.name }}</p>
          </div>
          <div class="sheet__logo">
            <img v-if="report.facility.logo_url" :src="report.facility.logo_url" :alt="report.facility.name" >
          </div>
        </div>

        <h2 class="sheet__title">
          Daily Blood Stock Inventory as of {{ report.as_of_date }} at {{ report.as_of_time }}
        </h2>
        <p class="sheet__legend">
          Issuable units only (available, not past expiry). Components with a shelf life of
          {{ report.reference.shelf_life_days }} days or less are listed by expiry date<template
            v-if="report.reference.is_fallback"> — {{ report.reference.component }} has no shelf life set, so this is
            the default</template>.
        </p>

        <div v-for="table in report.tables" :key="table.key" class="grid-wrap">
          <table class="grid">
            <caption class="grid__title" :class="`grid__title--${table.rh}`">{{ table.title }}</caption>
            <thead>
              <tr>
                <th scope="col" :rowspan="hasDatedColumns(table) ? 2 : 1" class="grid__corner">Type</th>
                <template v-for="column in table.columns" :key="column.id">
                  <th v-if="column.dated" scope="colgroup" :colspan="columnWidth(column)">{{ column.name }}</th>
                  <th v-else scope="col" :rowspan="hasDatedColumns(table) ? 2 : 1">
                    {{ column.name }}
                    <span v-if="!column.shelf_life_configured" class="grid__flag">Shelf life not configured</span>
                  </th>
                </template>
              </tr>
              <tr v-if="hasDatedColumns(table)">
                <template v-for="column in table.columns" :key="`sub-${column.id}`">
                  <template v-if="column.dated">
                    <th scope="col" :colspan="column.date_slots" class="grid__sub">By expiry date</th>
                    <th scope="col" class="grid__sub">Total</th>
                  </template>
                </template>
              </tr>
            </thead>

            <tbody v-for="row in table.rows" :key="row.blood_type" :class="bandClass(row.abo)">
              <template v-if="hasDatedColumns(table)">
                <tr>
                  <th scope="row" rowspan="2" class="grid__type">{{ row.blood_type }}</th>
                  <template v-for="column in table.columns" :key="`d-${column.id}`">
                    <template v-if="column.dated">
                      <td
                        v-for="(entry, i) in slotEntries(row.cells[column.id], column.date_slots)"
                        :key="`d-${column.id}-${i}`"
                        class="grid__date"
                      >{{ entry ? formatExpiry(entry.date) : '' }}</td>
                      <td rowspan="2" class="grid__total" :class="{ 'grid__zero': !row.cells[column.id].total }">
                        {{ row.cells[column.id].total }}
                      </td>
                    </template>
                    <td
                      v-else
                      rowspan="2"
                      class="grid__num"
                      :class="{ 'grid__zero': !row.cells[column.id].total, 'grid__soon': row.cells[column.id].expiring_soon }"
                    >{{ row.cells[column.id].total }}</td>
                  </template>
                </tr>
                <tr>
                  <template v-for="column in table.columns" :key="`c-${column.id}`">
                    <template v-if="column.dated">
                      <td
                        v-for="(entry, i) in slotEntries(row.cells[column.id], column.date_slots)"
                        :key="`c-${column.id}-${i}`"
                        class="grid__num"
                        :class="{ 'grid__soon': isSoon(entry) }"
                        :title="isSoon(entry) ? (entry.expires_today ? 'Expires today' : 'Expires tomorrow') : undefined"
                      >{{ entry ? entry.units : '' }}</td>
                    </template>
                  </template>
                </tr>
              </template>

              <tr v-else>
                <th scope="row" class="grid__type">{{ row.blood_type }}</th>
                <td
                  v-for="column in table.columns"
                  :key="column.id"
                  class="grid__num"
                  :class="{ 'grid__zero': !row.cells[column.id].total, 'grid__soon': row.cells[column.id].expiring_soon }"
                >{{ row.cells[column.id].total }}</td>
              </tr>
            </tbody>

            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <template v-for="column in table.columns" :key="`t-${column.id}`">
                  <td v-if="column.dated" :colspan="column.date_slots" />
                  <td class="grid__total">{{ column.total }}</td>
                </template>
              </tr>
            </tfoot>
          </table>
        </div>

        <p class="sheet__by">BY: <strong>{{ report.prepared_by }}</strong></p>
      </article>
    </template>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import {
  bandClass,
  columnWidth,
  formatExpiry,
  hasDatedColumns,
  isSoon,
  slotEntries,
  stockReportFilename,
} from '~/utils/stockReport'

/**
 * The Daily Blood Stock Inventory: Issuance's live view and printable sheet.
 *
 * The numbers are the server's, already grouped into the sheet's tables; this
 * page only draws them. The PDF is rendered by the server from the same data,
 * so what is on screen and what is printed can never disagree.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'inventory.create',
})

const { can } = useUser()
const canConfigure = computed(() => can('center.configure'))

const report = ref(null)
const loading = ref(false)
const downloading = ref(false)
const error = ref('')

// The DOH seal is a file supplied with the deployment, at public/images.
// Bound rather than written as a static src so the build does not require it
// to exist; until it is supplied, the header simply goes without it.
const SEAL_SRC = '/images/doh-seal.png'
const sealVisible = ref(true)

async function load() {
  loading.value = true
  error.value = ''

  try {
    report.value = await bloodCenterService.stockReport()
  } catch (err) {
    error.value = err?.status === 403
      ? 'Only Issuance staff and supervisors can prepare the stock report.'
      : err?.data?.message || 'The stock report could not be loaded. Try again.'
  } finally {
    loading.value = false
  }
}

async function download() {
  downloading.value = true
  error.value = ''

  try {
    const blob = await bloodCenterService.downloadStockReport()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = stockReportFilename()
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    error.value = err?.message || 'The PDF could not be downloaded. Try again.'
  } finally {
    downloading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.stock {
  font-family: var(--rb-font-sans);
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.stock__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
  justify-content: space-between;
}

.stock__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rb-primary-text);
}

.stock__title {
  margin: 0.15rem 0 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--rb-text-primary);
}

.stock__subtitle { margin: 0.3rem 0 0; max-width: 62ch; font-size: 13px; color: var(--rb-text-secondary); }

.stock__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }

.stock__loading { margin: 0; font-size: 0.85rem; color: var(--rb-text-secondary); }

/* --- callouts --- */
.callout {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface);
  font-size: 0.84rem;
  color: var(--rb-text-primary);
}

.callout p { margin: 0; line-height: 1.5; }
.callout--warn { border-color: rgba(var(--rb-accent-rgb), 0.35); background: rgba(var(--rb-accent-rgb), 0.06); color: var(--rb-accent-text); }
.callout__link { margin-left: 0.35rem; font-weight: 600; color: var(--rb-primary-text); }

/* --- the sheet --- */
.sheet {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.25rem;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
}

.sheet__head {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 72px;
  align-items: center;
  gap: 0.75rem;
}

.sheet__logo { display: grid; place-items: center; height: 64px; }
.sheet__logo img { max-width: 64px; max-height: 64px; object-fit: contain; }

.sheet__lines { text-align: center; }
.sheet__lines p { margin: 0; font-size: 0.8rem; line-height: 1.45; color: var(--rb-text-primary); }
.sheet__lines .sheet__facility { font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }

.sheet__title {
  margin: 0;
  text-align: center;
  font-size: 0.98rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--rb-text-primary);
}

.sheet__legend { margin: -0.4rem 0 0; text-align: center; font-size: 0.75rem; color: var(--rb-text-secondary); }

.sheet__by { margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--rb-text-primary); }
.sheet__by strong { text-decoration: underline; text-underline-offset: 3px; }

/* --- tables --- */
/* Wide tables scroll inside their own box, never the page. */
.grid-wrap { overflow-x: auto; }

.grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.grid th,
.grid td {
  border: 1px solid var(--rb-border-strong);
  padding: 0.25rem 0.4rem;
  text-align: center;
  color: var(--rb-text-primary);
}

.grid__title {
  padding: 0.35rem;
  border: 1px solid var(--rb-border-strong);
  border-bottom: none;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--rb-text-primary);
}

.grid__title--positive { background: rgba(250, 204, 21, 0.2); }
.grid__title--negative { background: rgba(244, 114, 182, 0.2); }
.grid__title--all { background: var(--rb-surface-alt); }

.grid thead th { background: var(--rb-surface-alt); font-size: 0.74rem; font-weight: 700; }
.grid .grid__corner { width: 3.5rem; }
.grid .grid__sub { font-weight: 500; font-size: 0.68rem; color: var(--rb-text-secondary); }
.grid__flag { display: block; font-weight: 500; font-size: 0.66rem; color: var(--rb-accent-text); }

.grid .grid__type { font-weight: 700; white-space: nowrap; }
.grid .grid__date { font-size: 0.68rem; color: var(--rb-text-secondary); white-space: nowrap; }
.grid .grid__total { font-weight: 700; }
.grid .grid__zero { color: var(--rb-text-secondary); font-weight: 400; }

/* Expiring today or tomorrow: the counts a medical technologist acts on first. */
.grid .grid__soon {
  outline: 2px solid var(--rb-accent);
  outline-offset: -2px;
  font-weight: 700;
  color: var(--rb-accent-text);
}

.grid tfoot th,
.grid tfoot td { background: var(--rb-surface-alt); font-weight: 700; }

/* ABO bands, as the paper sheet colours its rows. Tinted rather than solid so
   they read in dark mode too. */
.band-a :is(th, td) { background: rgba(56, 189, 248, 0.16); }
.band-b :is(th, td) { background: rgba(250, 204, 21, 0.2); }
.band-o :is(th, td) { background: rgba(148, 163, 184, 0.2); }
.band-ab :is(th, td) { background: rgba(244, 114, 182, 0.18); }

/* --- buttons and alerts --- */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.95rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }

.alert { margin: 0; padding: 0.65rem 0.85rem; border-radius: 10px; font-size: 0.84rem; }

.alert--error {
  background: rgba(var(--rb-accent-rgb), 0.1);
  color: var(--rb-accent-text);
  border: 1px solid rgba(var(--rb-accent-rgb), 0.3);
}

@media (max-width: 640px) {
  .stock { padding: 16px 16px 32px; }
  .sheet { padding: 0.9rem; }
  .sheet__head { grid-template-columns: 48px minmax(0, 1fr) 48px; }
  .sheet__logo img { max-width: 44px; max-height: 44px; }
}
</style>
