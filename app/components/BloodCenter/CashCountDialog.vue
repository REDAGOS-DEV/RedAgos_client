<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="count-title">
        <h2 id="count-title" class="modal-title">Close Shift {{ shift.session_number }}</h2>
        <p class="modal-sub">
          Count the drawer note by note. What it should hold is worked out from this shift's own payments.
        </p>

        <div class="count-grid">
          <label v-for="d in CASH_DENOMINATIONS" :key="d" class="count-row">
            <span class="count-denomination">{{ pesos(d) }}</span>
            <span class="count-times" aria-hidden="true">×</span>
            <input
              v-model.number="counts[d]"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              class="input count-input"
              :aria-label="`How many ${pesos(d)}`"
            >
            <span class="count-amount">{{ pesos(Number(d) * (Number(counts[d]) || 0)) }}</span>
          </label>
        </div>

        <dl class="count-facts">
          <div><dt>Expected in drawer</dt><dd>{{ pesos(expected) }}</dd></div>
          <div><dt>Counted</dt><dd class="strong">{{ pesos(counted) }}</dd></div>
          <div :class="`variance variance--${variance.tone}`"><dt>Difference</dt><dd>{{ variance.label }}</dd></div>
        </dl>

        <div class="field">
          <label for="close-note" class="field-label">
            Note <span v-if="needsNote" class="req">* the drawer does not balance</span><span v-else class="optional">(optional)</span>
          </label>
          <input id="close-note" v-model.trim="note" type="text" class="input" maxlength="500" placeholder="Say why it is over or short">
        </div>

        <p v-if="error" class="field-error">{{ error }}</p>

        <div class="modal-actions">
          <button class="btn btn-outline" :disabled="busy" @click="$emit('close')">Cancel</button>
          <button class="btn btn-primary" :disabled="busy || (needsNote && !note)" @click="confirm">
            {{ busy ? 'Closing…' : 'Close shift' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/*
 * Closing a cash shift: the drawer counted note by note, against what the
 * shift's own payments say it should hold. A difference must be explained
 * before the shift closes; the server checks the count adds up and freezes
 * it beside the expected figure.
 */
import type { CashShift } from '~/types/bloodRequest'
import { CASH_DENOMINATIONS, cashCountTotal, pesos, shiftVariance } from '~/utils/billing'

const props = defineProps<{
  shift: CashShift
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [payload: { counted_cash: number; count_breakdown: Record<string, number>; closing_note: string | null }]
}>()

const counts = reactive<Record<string, number | string>>(Object.fromEntries(CASH_DENOMINATIONS.map((d) => [d, 0])))
const note = ref('')

const expected = computed(() => Number(props.shift.figures?.expected_cash ?? props.shift.opening_float ?? 0))
const counted = computed(() => cashCountTotal(counts))
const variance = computed(() => shiftVariance(Math.round((counted.value - expected.value) * 100) / 100))
const needsNote = computed(() => variance.value.tone !== 'success')

function confirm() {
  const breakdown: Record<string, number> = {}

  for (const d of CASH_DENOMINATIONS) {
    const pieces = Math.max(0, Math.floor(Number(counts[d]) || 0))
    if (pieces > 0) breakdown[d] = pieces
  }

  emit('confirm', { counted_cash: counted.value, count_breakdown: breakdown, closing_note: note.value || null })
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css. */
.modal-overlay {
  position: fixed; inset: 0; z-index: 90; background: var(--rb-overlay);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  width: 100%; max-width: 480px; background: var(--rb-surface);
  border-radius: 15px; padding: 22px; font-family: var(--rb-font-sans);
  max-height: 92vh; overflow-y: auto;
}
.modal-title { font-size: 17px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 3px; }
.modal-sub { font-size: 12.5px; color: var(--rb-text-secondary); margin: 0 0 14px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 16px; }

.count-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; margin-bottom: 14px; }
.count-row { display: grid; grid-template-columns: 62px 10px 1fr; align-items: center; gap: 6px; font-size: 13px; }
.count-denomination { font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.count-times { color: var(--rb-text-muted); }
.count-input { padding: 6px 8px; text-align: right; font-variant-numeric: tabular-nums; }
.count-amount { grid-column: 1 / -1; font-size: 11px; color: var(--rb-text-muted); text-align: right; margin-top: -4px; }

.count-facts { margin: 0 0 14px; border: 1px solid var(--rb-border); border-radius: 10px; padding: 10px 14px; }
.count-facts > div { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
.count-facts dt { color: var(--rb-text-secondary); margin: 0; }
.count-facts dd { margin: 0; font-weight: 600; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.count-facts .strong { font-weight: 800; }
.variance--success dd { color: var(--rb-success-text); }
.variance--warning dd { color: var(--rb-warning-text); }
.variance--danger dd { color: var(--rb-accent-text); }

.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.req { color: var(--rb-accent-text); font-weight: 600; }
.optional { color: var(--rb-text-muted); font-weight: 400; }
.input {
  width: 100%; padding: 9px 11px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
}
.input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), .12); }
.field-error { font-size: 12px; color: var(--rb-accent-text); margin: 10px 0 0; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 15px; font-size: 13px; font-weight: 600; font-family: inherit;
  border-radius: 8px; cursor: pointer; white-space: nowrap;
}
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: #10509c; }
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); }
.btn:disabled { opacity: .55; cursor: not-allowed; }

@media (max-width: 480px) {
  .count-grid { grid-template-columns: 1fr; }
}
</style>
