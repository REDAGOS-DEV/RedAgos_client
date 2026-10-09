<template>
  <div class="panel">
    <header class="panel__header">
      <div>
        <h1 class="panel__title">Stock Thresholds</h1>
        <p class="panel__subtitle">
          The fewest units of each blood type and component the {{ facilityNoun }} should keep on its shelf. When stock
          falls below a minimum, a red banner shows on the inventory pages and the staff who watch the shelf are notified.
        </p>
      </div>

      <button type="button" class="btn btn--ghost" :disabled="busy || saving" @click="loadStatus(false)">
        <AssetIcon name="refresh-cw" :size="14" :class="{ spin: busy }" />
        {{ busy ? 'Loading…' : 'Refresh' }}
      </button>
    </header>

    <div v-if="status" class="scope">
      <span class="scope__item">
        <AssetIcon name="building-2" :size="14" />
        Minimums for <strong>{{ status.facility.name }}</strong> only.
      </span>
      <span v-if="!editable" class="scope__item scope__item--note">
        <AssetIcon name="info" :size="14" />
        {{ readOnlyNote }}
      </span>
    </div>

    <div v-if="banner" class="alert" :class="`alert--${bannerKind}`" :role="bannerKind === 'error' ? 'alert' : 'status'">
      <AssetIcon :name="bannerKind === 'success' ? 'circle-check-big' : 'circle-alert'" :size="16" />
      <span>{{ banner }}</span>
    </div>

    <template v-if="status">
      <!-- The headline numbers -->
      <dl class="kpis">
        <div class="kpi">
          <dt>Monitored</dt>
          <dd>{{ status.totals.monitored }}</dd>
        </div>
        <div class="kpi kpi--ok">
          <dt>Healthy</dt>
          <dd>{{ status.totals.ok }}</dd>
        </div>
        <div class="kpi kpi--low">
          <dt>Below minimum</dt>
          <dd>{{ status.totals.low }}</dd>
        </div>
        <div class="kpi kpi--critical">
          <dt>Out of stock</dt>
          <dd>{{ status.totals.critical }}</dd>
        </div>
      </dl>

      <LowStockBanner :cells="status.low" />

      <p v-if="!status.totals.monitored" class="callout">
        <AssetIcon name="info" :size="15" />
        <span>
          No minimums are set yet, so nothing is being watched.
          {{ editable ? 'Type a minimum into any cell below, then save.' : 'Until one is set, stock is shown without a target.' }}
        </span>
      </p>

      <p v-if="!status.components.length" class="empty">No blood components are defined.</p>

      <StockThresholdGrid
        v-else
        :status="status"
        :editable="editable"
        :saving="saving"
        @save="save"
        @dirty="dirty = $event"
      />

      <p class="footnote">
        <AssetIcon name="info" :size="14" />
        <span>
          Counts are issuable units only: available and not past their date. The bell switches notifications off for one
          stock; the colours and the banner still show its true level. Updated {{ asOf }}.
        </span>
      </p>
    </template>

    <!-- First load -->
    <div v-else-if="busy" class="skeleton-grid" aria-hidden="true">
      <span v-for="n in 4" :key="n" class="skeleton" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The stock-threshold screen, for either portal.
 *
 * A blood centre and a hospital blood bank show the same thing — every blood
 * type against every component, the stock now and the minimum — so both pages
 * are a thin wrapper that supplies how to fetch, how to save, and whether the
 * signed-in account may edit. The server decides every level.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import LowStockBanner from '~/components/common/LowStockBanner.vue'
import StockThresholdGrid from '~/components/common/StockThresholdGrid.vue'
import type { SaveStockThresholdsPayload, StockThresholdStatus } from '~/types/stockThreshold'

const POLL_MS = 60_000

const props = withDefaults(defineProps<{
  /** How to read the status. Named apart from `loadStatus` below so the two cannot be confused. */
  fetchStatus: () => Promise<StockThresholdStatus>
  /** How to save, answering with the fresh status. */
  saveStatus: (_payload: SaveStockThresholdsPayload) => Promise<StockThresholdStatus>
  editable?: boolean
  /** "centre" or "blood bank", for the sentence that says whose shelf this is. */
  facilityNoun?: string
  readOnlyNote?: string
}>(), {
  editable: false,
  facilityNoun: 'facility',
  readOnlyNote: 'You can see how stock stands against each minimum, but not change one.',
})

const status = ref<StockThresholdStatus | null>(null)
const busy = ref(false)
const saving = ref(false)
const dirty = ref(false)
const banner = ref('')
const bannerKind = ref<'success' | 'error'>('success')

const asOf = computed(() => {
  const at = status.value ? new Date(status.value.as_of) : null

  return at && !Number.isNaN(at.getTime())
    ? at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : ''
})

function failure(err: any, fallback: string): string {
  return err?.data?.message || (Object.values(err?.data?.errors ?? {}).flat() as string[])[0] || fallback
}

/**
 * Load the status.
 *
 * A quiet refresh keeps what is on screen and swallows a failure: a missed
 * poll is not worth an error banner, and the next one retries.
 */
async function loadStatus(quiet: boolean): Promise<void> {
  busy.value = !quiet
  if (!quiet) banner.value = ''

  try {
    status.value = await props.fetchStatus()
  } catch (err) {
    if (!quiet) {
      bannerKind.value = 'error'
      banner.value = failure(err, 'The stock thresholds could not be loaded.')
    }
  } finally {
    busy.value = false
  }
}

async function save(payload: SaveStockThresholdsPayload): Promise<void> {
  saving.value = true
  banner.value = ''

  try {
    status.value = await props.saveStatus(payload)

    const count = payload.thresholds.length
    bannerKind.value = 'success'
    banner.value = `Saved ${count} change${count === 1 ? '' : 's'}.`
  } catch (err) {
    bannerKind.value = 'error'
    banner.value = failure(err, 'The thresholds could not be saved.')
  } finally {
    saving.value = false
  }
}

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  void loadStatus(false)

  // Keep the counts current, but never while there are unsaved edits or a save
  // in flight: the grid would be re-seeded underneath the person typing.
  timer = setInterval(() => {
    if (!dirty.value && !saving.value && !busy.value) void loadStatus(true)
  }, POLL_MS)
})

onBeforeUnmount(() => {
  if (timer !== null) clearInterval(timer)
})
</script>

<style scoped>
.panel {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--rb-text-primary);
}

.panel__header { display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; }
.panel__title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
.panel__subtitle { margin: 4px 0 0; max-width: 76ch; font-size: 13px; line-height: 1.55; color: var(--rb-text-secondary); }

.scope { display: flex; align-items: center; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; }
.scope__item { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--rb-text-secondary); }
.scope__item strong { color: var(--rb-text-primary); }
.scope__item--note { padding: 3px 11px; border-radius: 999px; background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); font-weight: 600; }

.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}
.alert :deep(svg) { flex-shrink: 0; }
.alert--success { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success-text); border: 1px solid rgba(var(--rb-success-rgb), 0.25); }
.alert--error { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), 0.25); }

.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0; }
.kpi {
  padding: 12px 16px;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
}
.kpi dt { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--rb-text-secondary); }
.kpi dd { margin: 2px 0 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.kpi--ok dd { color: var(--rb-success-text); }
.kpi--low dd { color: var(--rb-warning-text); }
.kpi--critical dd { color: var(--rb-accent-text); }

.callout {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 11px 14px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.25);
  border-radius: 10px;
  background: rgba(var(--rb-primary-rgb), 0.07);
  color: var(--rb-primary-text);
  font-size: 13px;
  line-height: 1.5;
}
.callout :deep(svg) { flex-shrink: 0; margin-top: 2px; }

.empty { margin: 0; padding: 32px 16px; text-align: center; color: var(--rb-text-secondary); }

.footnote {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0;
  max-width: 90ch;
  font-size: 12px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}
.footnote :deep(svg) { flex-shrink: 0; margin-top: 2px; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.btn--ghost { border-color: transparent; background: transparent; color: var(--rb-text-secondary); }
.btn--ghost:hover:not(:disabled) { color: var(--rb-text-primary); }

.skeleton-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.skeleton {
  display: block;
  height: 64px;
  border-radius: 12px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: panel-shimmer 1.4s ease infinite;
}
@keyframes panel-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.spin { animation: panel-spin 0.9s linear infinite; }
@keyframes panel-spin { to { transform: rotate(360deg); } }

@media (max-width: 760px) {
  .panel__header { flex-direction: column; }
  .kpis, .skeleton-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin { animation: none; }
  .btn { transition: none; }
}
</style>
