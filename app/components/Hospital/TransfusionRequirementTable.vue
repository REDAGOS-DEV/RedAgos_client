<template>
  <div class="requirement">
    <div class="requirement__scroll">
      <table class="requirement__table">
        <caption class="sr-only">What the patient needs per component, and what came of asking for it</caption>
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col" class="num">Required</th>
            <th scope="col" class="num">Awaiting</th>
            <th scope="col" class="num">Approved</th>
            <th scope="col" class="num">Released</th>
            <th scope="col" class="num">Received</th>
            <th scope="col" class="num">Remaining</th>
            <th scope="col" class="num">Unallocated</th>
            <th scope="col">Status</th>
            <th v-if="closable" scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in lines" :key="line.id">
            <th scope="row" class="requirement__component">
              {{ line.component?.name || '—' }}
              <span v-if="line.indication_text || line.indication_label" class="requirement__indication">
                {{ line.indication_label }}<template v-if="line.indication_text && line.indication_text !== line.indication_label"> — {{ line.indication_text }}</template>
              </span>
            </th>
            <td class="num requirement__strong">{{ line.quantity }}</td>
            <td class="num">{{ line.awaiting }}</td>
            <td class="num">{{ line.approved }}</td>
            <td class="num">{{ line.fulfilled }}</td>
            <td class="num">{{ line.received }}</td>
            <td class="num" :class="{ 'requirement__strong': line.remaining > 0 }">{{ line.remaining }}</td>
            <td class="num" :class="{ 'requirement__alert': line.unallocated > 0 }">{{ line.unallocated }}</td>
            <td>
              <span class="requirement__chip" :class="`tone--${toneFor(line)}`">{{ labelFor(line) }}</span>
              <span v-if="line.closed_at" class="requirement__closure">
                Closed — no longer needed<template v-if="line.closure_note">: {{ line.closure_note }}</template>
              </span>
            </td>
            <td v-if="closable" class="requirement__action">
              <button
                v-if="canCloseRequirementLine(line, requestOpen)"
                type="button"
                class="requirement__btn"
                :disabled="busyItemId === line.id"
                @click="$emit('close-line', line)"
              >
                {{ busyItemId === line.id ? 'Closing…' : 'Close remaining' }}
              </button>
            </td>
          </tr>
        </tbody>
        <tfoot v-if="totals">
          <tr>
            <th scope="row">Total</th>
            <td class="num requirement__strong">{{ totals.required }}</td>
            <td class="num">{{ totals.awaiting }}</td>
            <td class="num">{{ totals.approved }}</td>
            <td class="num">{{ totals.fulfilled }}</td>
            <td class="num">{{ totals.received }}</td>
            <td class="num requirement__strong">{{ totals.remaining }}</td>
            <td class="num" :class="{ 'requirement__alert': totals.unallocated > 0 }">{{ totals.unallocated }}</td>
            <td :colspan="closable ? 2 : 1" />
          </tr>
        </tfoot>
      </table>
    </div>

    <p class="requirement__note">
      Required is what the patient needs and never changes. Awaiting is still with a facility to review; approved units
      are reserved or already released for this patient; unallocated units have not been asked of any facility.
    </p>
  </div>
</template>

<script setup>
/**
 * A Patient Transfusion Request's requirement, one row per component.
 *
 * The figures come from the API, added up across every facility asked. Only
 * the required quantity is the hospital's own; everything beside it is what
 * came of asking.
 */

import { computed } from 'vue'
import { TRANSFUSION_LINE_STATUS_LABELS, TRANSFUSION_LINE_STATUS_TONES } from '~/types/bloodRequest'
import { canCloseRequirementLine } from '~/utils/transfusionSourcing'

const props = defineProps({
  lines: { type: Array, default: () => [] },
  totals: { type: Object, default: null },
  isOpen: { type: Boolean, default: true },
  /** Show a per-line action to close what the patient no longer needs. */
  closable: { type: Boolean, default: false },
  busyItemId: { type: Number, default: null },
})

defineEmits(['close-line'])

const requestOpen = computed(() => props.isOpen)

function labelFor(line) {
  return line.line_status_label || TRANSFUSION_LINE_STATUS_LABELS[line.line_status] || '—'
}

function toneFor(line) {
  return TRANSFUSION_LINE_STATUS_TONES[line.line_status] ?? 'muted'
}
</script>

<style scoped>
.requirement {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.requirement__scroll {
  overflow-x: auto;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
}

.requirement__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
  color: var(--rb-text-primary);
}

.requirement__table th,
.requirement__table td {
  padding: 0.55rem 0.7rem;
  text-align: left;
  border-bottom: 1px solid var(--rb-border);
  white-space: nowrap;
}

.requirement__table thead th {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
  background: var(--rb-surface-alt);
}

.requirement__table tbody th {
  font-weight: 600;
}

.requirement__table tfoot th,
.requirement__table tfoot td {
  border-bottom: none;
  background: var(--rb-surface-alt);
  font-weight: 600;
}

.requirement__indication {
  display: block;
  max-width: 16rem;
  white-space: normal;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--rb-text-secondary);
}

.num {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}

.requirement__strong {
  font-weight: 700;
}

.requirement__alert {
  font-weight: 700;
  color: var(--rb-accent-text);
}

.requirement__chip {
  display: inline-block;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 600;
}

.requirement__closure {
  display: block;
  margin-top: 0.2rem;
  max-width: 18rem;
  white-space: normal;
  font-size: 0.74rem;
  color: var(--rb-text-secondary);
}

.requirement__action {
  text-align: right !important;
}

.requirement__btn {
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

.requirement__btn:hover:not(:disabled) {
  background: var(--rb-surface-hover);
}

.requirement__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.requirement__note {
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
