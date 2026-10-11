<template>
  <div class="lines">
    <div class="lines-scroll">
      <table class="lines-table">
        <caption class="sr-only">{{ caption }}</caption>
        <thead>
          <tr>
            <th scope="col" class="idx">#</th>
            <th scope="col">Component</th>
            <th v-if="showBloodType" scope="col">Blood type</th>
            <th scope="col" class="num">Qty</th>
            <th scope="col" class="num">Unit price</th>
            <th scope="col" class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(line, i) in lines" :key="i">
            <td class="idx">{{ i + 1 }}</td>
            <td class="name">{{ line.component_name }}</td>
            <td v-if="showBloodType"><span v-if="line.blood_type" class="type">{{ line.blood_type }}</span><span v-else class="muted">—</span></td>
            <td class="num">{{ line.quantity }}</td>
            <td class="num">{{ pesos(line.unit_price) }}</td>
            <td class="num strong">{{ pesos(line.line_total) }}</td>
          </tr>
          <tr v-if="!lines.length">
            <td :colspan="showBloodType ? 6 : 5" class="empty">{{ empty }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <dl v-if="totals.length" class="totals">
      <div v-for="row in totals" :key="row.label" class="total" :class="[row.emphasis && 'total--emphasis', row.tone && `total--${row.tone}`]">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
/**
 * A bill's lines and its totals block, as every billing page lays them out.
 *
 * The lines come from the units held for the request; nothing here adds or
 * prices one. Totals arrive already formatted, so each page decides what its
 * document adds up to (a statement's balance, a receipt's remaining balance).
 */
import type { StatementLine } from '~/types/bloodRequest'
import { pesos } from '~/utils/billing'

interface BillingTotalRow {
  label: string
  value: string
  /** The figure the reader came for: the balance, the amount due. */
  emphasis?: boolean
  tone?: 'success' | 'danger' | 'purple'
}

withDefaults(defineProps<{
  lines: StatementLine[]
  totals?: BillingTotalRow[]
  showBloodType?: boolean
  caption?: string
  empty?: string
}>(), {
  totals: () => [],
  showBloodType: true,
  caption: 'Blood components billed',
  empty: 'No units are held for this request yet.',
})
</script>

<style scoped>
.lines { display: flex; flex-direction: column; gap: 14px; }
.lines-scroll { overflow-x: auto; border: 1px solid var(--rb-border); border-radius: 12px; }
.lines-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.lines-table th {
  text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  color: var(--rb-text-secondary); background: var(--rb-surface-alt); padding: 9px 12px; border-bottom: 1px solid var(--rb-border);
}
.lines-table td { padding: 11px 12px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); vertical-align: middle; }
.lines-table tbody tr:last-child td { border-bottom: 0; }
.idx { width: 36px; color: var(--rb-text-muted) !important; }
.name { font-weight: 600; }
.num { text-align: right !important; white-space: nowrap; }
.strong { font-weight: 700; }
.muted { color: var(--rb-text-muted); }
.type {
  display: inline-block; min-width: 34px; text-align: center; padding: 2px 7px; border-radius: 6px;
  font-size: 11.5px; font-weight: 700; color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), .08);
}
.empty { text-align: center; color: var(--rb-text-muted) !important; padding: 22px 12px !important; }

.totals { margin: 0 0 0 auto; width: min(100%, 340px); display: flex; flex-direction: column; gap: 2px; }
.total { display: flex; justify-content: space-between; gap: 16px; padding: 6px 12px; font-size: 13px; font-variant-numeric: tabular-nums; }
.total dt { margin: 0; color: var(--rb-text-secondary); }
.total dd { margin: 0; font-weight: 600; color: var(--rb-text-primary); }
.total--success dd { color: var(--rb-success-text); }
.total--purple dd { color: var(--rb-purple-text); }
.total--emphasis { margin-top: 6px; padding: 11px 12px; border-radius: 10px; background: var(--rb-surface-alt); border: 1px solid var(--rb-border); }
.total--emphasis dt { color: var(--rb-text-primary); font-weight: 700; }
.total--emphasis dd { font-size: 17px; font-weight: 800; }
.total--emphasis.total--danger { background: rgba(var(--rb-accent-rgb), .06); border-color: rgba(var(--rb-accent-rgb), .22); }
.total--emphasis.total--danger dd, .total--emphasis.total--danger dt { color: var(--rb-accent-text); }
.total--emphasis.total--success { background: rgba(var(--rb-success-rgb), .07); border-color: rgba(var(--rb-success-rgb), .25); }
.total--emphasis.total--success dt { color: var(--rb-success-text); }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
</style>
