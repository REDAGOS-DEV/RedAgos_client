<template>
  <div class="fulfilment">
    <div class="fulfilment__scroll">
      <table class="fulfilment__table">
        <caption class="sr-only">Requested and fulfilled quantities per component</caption>
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col" class="num">Requested</th>
            <th scope="col" class="num">Reserved</th>
            <th scope="col" class="num">Fulfilled</th>
            <th scope="col" class="num">Received</th>
            <th v-if="totals.forwarded > 0" scope="col" class="num">Forwarded</th>
            <th scope="col" class="num">Remaining</th>
            <th scope="col">Status</th>
            <th v-if="closable" scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <th scope="row" class="fulfilment__component">{{ row.component }}</th>
            <td class="num">{{ row.requested }}</td>
            <td class="num">{{ row.reserved }}</td>
            <td class="num fulfilment__strong">{{ row.fulfilled }}</td>
            <td class="num">{{ row.received }}</td>
            <td v-if="totals.forwarded > 0" class="num">{{ row.forwarded }}</td>
            <td class="num" :class="{ 'fulfilment__strong': row.remaining > 0 }">{{ row.remaining }}</td>
            <td>
              <span class="fulfilment__chip" :class="`tone--${row.tone}`">{{ row.statusLabel }}</span>
              <span v-if="row.closed && row.closureLabel" class="fulfilment__closure">
                {{ row.closureLabel }}<template v-if="row.closureNote"> — {{ row.closureNote }}</template>
              </span>
            </td>
            <td v-if="closable" class="fulfilment__action">
              <button
                v-if="canCloseLine(row, requestOpen)"
                type="button"
                class="fulfilment__btn"
                :disabled="busyItemId === row.id"
                @click="$emit('close-line', row)"
              >
                {{ busyItemId === row.id ? 'Closing…' : closeLabel }}
              </button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td class="num">{{ totals.requested }}</td>
            <td class="num">{{ totals.reserved }}</td>
            <td class="num fulfilment__strong">{{ totals.fulfilled }}</td>
            <td class="num">{{ totals.received }}</td>
            <td v-if="totals.forwarded > 0" class="num">{{ totals.forwarded }}</td>
            <td class="num fulfilment__strong">{{ totals.remaining }}</td>
            <td colspan="2" />
          </tr>
        </tfoot>
      </table>
    </div>

    <p class="fulfilment__note">
      Requested is what the form asked for and never changes. Fulfilled counts units released by the blood center;
      received counts units the hospital has confirmed.
    </p>
  </div>
</template>

<script setup>
/**
 * What a request asked for, beside what was provided, one row per component.
 *
 * Shared by the blood centre's review drawer, its fulfilment page and the
 * hospital's request page, so the two portals cannot describe the same request
 * differently. The figures come from the API; nothing here recomputes the
 * requested quantity from what was supplied.
 */

import { computed } from 'vue'
import { canCloseLine, fulfilmentRows, fulfilmentTotals } from '~/utils/requestFulfilment'

const props = defineProps({
  request: { type: Object, required: true },
  /** Show a per-line action to close the remainder. */
  closable: { type: Boolean, default: false },
  closeLabel: { type: String, default: 'Close remaining' },
  busyItemId: { type: Number, default: null },
})

defineEmits(['close-line'])

const rows = computed(() => fulfilmentRows(props.request))
const totals = computed(() => fulfilmentTotals(rows.value))
const requestOpen = computed(() => props.request?.is_open !== false)
</script>

<style scoped>
.fulfilment {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.fulfilment__scroll {
  overflow-x: auto;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
}

.fulfilment__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
  color: var(--rb-text-primary);
}

.fulfilment__table th,
.fulfilment__table td {
  padding: 0.55rem 0.7rem;
  text-align: left;
  border-bottom: 1px solid var(--rb-border);
  white-space: nowrap;
}

.fulfilment__table thead th {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
  background: var(--rb-surface-alt);
}

.fulfilment__table tbody th {
  font-weight: 600;
}

.fulfilment__table tfoot th,
.fulfilment__table tfoot td {
  border-bottom: none;
  background: var(--rb-surface-alt);
  font-weight: 600;
}

.num {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}

.fulfilment__strong {
  font-weight: 700;
}

.fulfilment__chip {
  display: inline-block;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 600;
}

.fulfilment__closure {
  display: block;
  margin-top: 0.2rem;
  max-width: 18rem;
  white-space: normal;
  font-size: 0.74rem;
  color: var(--rb-text-secondary);
}

.fulfilment__action {
  text-align: right !important;
}

.fulfilment__btn {
  padding: 0.3rem 0.65rem;
  border: 1px solid var(--rb-border);
  border-radius: 7px;
  background: transparent;
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
}

.fulfilment__btn:hover:not(:disabled) {
  background: var(--rb-surface-hover);
}

.fulfilment__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.fulfilment__note {
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.45;
  color: var(--rb-text-secondary);
}

.tone--success { background: rgba(var(--rb-success-rgb), 0.14); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }
.tone--progress { background: rgba(var(--rb-purple-rgb), 0.12); color: var(--rb-purple-text); }
.tone--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

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
</style>
