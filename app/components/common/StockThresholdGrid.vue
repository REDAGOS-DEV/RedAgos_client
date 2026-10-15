<template>
  <section class="grid-card" aria-labelledby="st-stock-heading">
    <header class="grid-card__head">
      <span class="grid-card__icon" aria-hidden="true">
        <AssetIcon name="activity" :size="20" />
      </span>

      <div class="grid-card__titles">
        <h2 id="st-stock-heading" class="grid-card__title">Current Stock</h2>
        <p class="grid-card__desc">
          Issuable units on the shelf now, against each level. Refreshed every minute{{ asOf ? `, last at ${asOf}` : '' }}.
        </p>
      </div>

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
          <dt>Below critical</dt>
          <dd>{{ status.totals.low }}</dd>
        </div>
        <div class="kpi kpi--critical">
          <dt>Out of stock</dt>
          <dd>{{ status.totals.critical }}</dd>
        </div>
        <div class="kpi kpi--par">
          <dt>Below PAR</dt>
          <dd>{{ status.totals.below_par }}</dd>
        </div>
      </dl>
    </header>

    <div class="grid-scroll" tabindex="0" role="region" aria-label="Current stock against each level, by blood type and component">
      <table class="stock-table" :style="{ minWidth: `${96 + components.length * 132}px` }">
        <caption class="sr-only">
          Issuable units now, against the critical and PAR levels set for each blood type and component.
        </caption>
        <colgroup>
          <col class="stock-table__type-col">
          <col v-for="component in components" :key="component.id">
        </colgroup>
        <thead>
          <tr>
            <th scope="col" class="stock-table__corner">Blood Type</th>
            <th v-for="component in components" :key="component.id" scope="col" class="stock-table__component">
              {{ component.name }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in matrix" :key="row.type.id">
            <th scope="row" class="stock-table__type">{{ row.type.code }}</th>
            <td
              v-for="item in row.items"
              :key="item.component.id"
              class="cell"
              :class="`cell--${item.cell.status}`"
            >
              <div class="cell__stock">
                <span class="cell__available">{{ item.cell.available }}</span>
                <span v-if="item.cell.status !== 'unmonitored'" class="cell__badge" :title="shortTitle(item.cell)">
                  <AssetIcon :name="item.cell.status === 'ok' ? 'check' : 'triangle-alert'" :size="11" />
                  {{ stockStatusLabel(item.cell.status) }}
                </span>
              </div>

              <div class="cell__levels">
                <span>
                  Critical {{ item.cell.minimum_units ?? '—' }}
                  <span v-if="item.cell.minimum_units !== null && !item.cell.alerts_enabled" class="cell__muted" title="Notifications are off for this stock">
                    muted
                  </span>
                </span>
                <span aria-hidden="true">·</span>
                <span>PAR {{ item.cell.par_units ?? '—' }}</span>
              </div>
              <div v-if="item.cell.to_par > 0" class="cell__to-par">{{ item.cell.to_par }} to PAR</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ul class="legend" aria-label="Legend">
      <li class="legend__item"><span class="legend__swatch legend__swatch--ok" />Healthy</li>
      <li class="legend__item"><span class="legend__swatch legend__swatch--low" />Below critical level</li>
      <li class="legend__item"><span class="legend__swatch legend__swatch--critical" />Out of stock</li>
      <li class="legend__item"><span class="legend__swatch legend__swatch--unmonitored" />No critical level set</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
/**
 * Every blood type against every component: the stock now, against both levels.
 *
 * Read-only. The levels are edited in the PAR and critical tables above it.
 * The server judges every status and how far each stock is from PAR, so
 * nothing here compares a count to a level.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import type { StockThresholdCell, StockThresholdStatus } from '~/types/stockThreshold'
import { cellKey, orderBloodTypes, orderComponents, stockStatusLabel } from '~/utils/stockThreshold'

const props = defineProps<{
  status: StockThresholdStatus
}>()

const components = computed(() => orderComponents(props.status.components))

const byKey = computed(() => new Map(
  props.status.cells.map((cell) => [cellKey(cell.blood_type_id, cell.component_id), cell] as const),
))

/** One row per blood type, one item per component. */
const matrix = computed(() =>
  orderBloodTypes(props.status.blood_types).map((type) => ({
    type,
    items: components.value.flatMap((component) => {
      const cell = byKey.value.get(cellKey(type.id, component.id))

      return cell ? [{ component, cell }] : []
    }),
  })),
)

const asOf = computed(() => {
  const at = new Date(props.status.as_of)

  return Number.isNaN(at.getTime()) ? '' : at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
})

function shortTitle(cell: StockThresholdCell): string {
  return cell.shortfall > 0 ? `Short by ${cell.shortfall} unit${cell.shortfall === 1 ? '' : 's'}` : stockStatusLabel(cell.status)
}
</script>

<style scoped>
.grid-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px 16px;
  border: 1px solid var(--rb-border-strong);
  border-radius: var(--rb-radius-md);
  background: var(--rb-surface);
  box-shadow: var(--rb-shadow-sm);
  min-width: 0;
}

/* header */
.grid-card__head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.grid-card__icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: rgba(var(--rb-teal-rgb), 0.12);
  color: var(--rb-teal-text);
}
.grid-card__titles { flex: 1 1 260px; min-width: 0; }
.grid-card__title { margin: 0; font-size: var(--rb-text-lg); font-weight: 700; letter-spacing: -0.01em; line-height: 1.25; color: var(--rb-text-primary); }
.grid-card__desc { margin: 2px 0 0; font-size: var(--rb-text-sm); line-height: 1.5; color: var(--rb-text-secondary); }

.kpis { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 0 auto; }
.kpi {
  min-width: 92px;
  padding: 6px 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface-alt);
}
.kpi dt { font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--rb-text-secondary); white-space: nowrap; }
.kpi dd { margin: 0; font-size: 18px; font-weight: 800; line-height: 1.3; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.kpi--ok dd { color: var(--rb-success-text); }
.kpi--low dd { color: var(--rb-warning-text); }
.kpi--critical dd { color: var(--rb-accent-text); }
.kpi--par dd { color: var(--rb-primary-text); }

/* table */
.grid-scroll { overflow-x: auto; border: 1px solid var(--rb-border-strong); border-radius: 10px; }
.grid-scroll:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

.stock-table { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.stock-table__type-col { width: 132px; }

.stock-table th {
  padding: 10px 8px;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border-strong);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--rb-text-primary);
  text-align: center;
}
.stock-table__corner,
.stock-table__type {
  position: sticky;
  left: 0;
  z-index: 1;
  padding-left: 16px !important;
  text-align: left !important;
}
.stock-table__corner { font-size: 13px !important; }
.stock-table__type {
  background: var(--rb-surface) !important;
  border-bottom-color: var(--rb-border) !important;
  font-size: 13px !important;
  font-weight: 800 !important;
}

.cell {
  padding: 10px 8px;
  border-bottom: 1px solid var(--rb-border);
  text-align: center;
  vertical-align: middle;
}
tbody tr:last-child .cell,
tbody tr:last-child .stock-table__type { border-bottom: 0; }

/* A shortage is tinted; the badge, icon and number say the same in words, so
   the state never rests on colour alone. */
.cell--low { background: rgba(var(--rb-warning-rgb), 0.08); }
.cell--critical { background: rgba(var(--rb-accent-rgb), 0.08); }

.cell__stock { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
.cell__available { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; color: var(--rb-text-primary); }
.cell--critical .cell__available { color: var(--rb-accent-text); }
.cell--low .cell__available { color: var(--rb-warning-text); }

.cell__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
}
.cell--ok .cell__badge { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.cell--low .cell__badge { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); }
.cell--critical .cell__badge { background: rgba(var(--rb-accent-rgb), 0.14); color: var(--rb-accent-text); }

.cell__levels {
  display: flex;
  justify-content: center;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--rb-text-secondary);
  font-variant-numeric: tabular-nums;
}
.cell__muted {
  margin-left: 2px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  font-size: 10px;
  font-weight: 700;
}
.cell__to-par { margin-top: 2px; font-size: 11.5px; font-weight: 700; color: var(--rb-primary-text); font-variant-numeric: tabular-nums; }

/* legend */
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; list-style: none; }
.legend__item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--rb-text-secondary); }
.legend__swatch { width: 10px; height: 10px; border-radius: 3px; background: var(--rb-border-strong); }
.legend__swatch--ok { background: var(--rb-success); }
.legend__swatch--low { background: var(--rb-warning); }
.legend__swatch--critical { background: var(--rb-accent); }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 1100px) {
  .stock-table__type-col { width: 100px; }
}

@media (max-width: 760px) {
  .grid-card { padding: 14px 14px 14px; gap: 12px; }
  .kpis { margin-left: 0; width: 100%; }
  .kpi { flex: 1 1 calc(33% - 8px); min-width: 0; }
  .stock-table__type-col { width: 72px; }
  .stock-table__corner,
  .stock-table__type { padding-left: 12px !important; }
}
</style>
