<template>
  <article class="allocation" :class="{ 'allocation--ended': ended }">
    <header class="allocation__head">
      <div class="allocation__who">
        <span class="allocation__facility">{{ allocation.target_facility?.name || 'Blood center' }}</span>
        <NuxtLink :to="`/hospital/bloodrequests/${allocation.id}`" class="allocation__ref">{{ allocation.reference_number }}</NuxtLink>
        <span v-if="allocation.is_walk_in" class="allocation__tag">Walk-in at this center</span>
      </div>
      <span class="allocation__chip" :class="`tone--${tone}`">{{ allocation.allocation_status_label || allocation.status_label }}</span>
    </header>

    <ul class="allocation__lines">
      <li v-for="item in allocation.items" :key="item.id" class="allocation__line">
        <span class="allocation__component">{{ item.component?.name || '—' }}</span>
        <span class="allocation__figures">
          Asked {{ item.quantity }}
          <template v-if="(item.reserved_quantity ?? 0) > 0"> · {{ item.reserved_quantity }} reserved</template>
          <template v-if="(item.fulfilled_quantity ?? 0) > 0"> · {{ item.fulfilled_quantity }} released</template>
          <template v-if="(item.received_quantity ?? 0) > 0"> · {{ item.received_quantity }} received</template>
        </span>
        <span v-if="item.closed_at" class="allocation__closure">
          {{ item.closure_reason_label || 'Closed' }}<template v-if="item.closure_note"> — {{ item.closure_note }}</template>
        </span>
      </li>
    </ul>

    <p v-if="allocation.status === 'rejected' && allocation.rejection_reason" class="allocation__reason">
      <AssetIcon name="circle-x" :size="13" />
      {{ allocation.rejection_reason }}
    </p>

    <p v-if="awaitingReceipt > 0" class="allocation__receipt">
      <AssetIcon name="package" :size="13" />
      {{ awaitingReceipt }} released unit{{ awaitingReceipt === 1 ? '' : 's' }} awaiting your receipt.
    </p>

    <footer class="allocation__actions">
      <NuxtLink :to="`/hospital/bloodrequests/${allocation.id}`" class="allocation__btn">
        {{ awaitingReceipt > 0 ? 'Confirm receipt' : 'Open allocation' }}
      </NuxtLink>
      <button
        v-if="canWithdrawAllocation(allocation, requestOpen)"
        type="button"
        class="allocation__btn allocation__btn--quiet"
        :disabled="busy"
        @click="$emit('withdraw', allocation)"
      >
        {{ busy ? 'Withdrawing…' : 'Withdraw' }}
      </button>
    </footer>
  </article>
</template>

<script setup>
/**
 * One facility's share of a Patient Transfusion Request, as the hospital sees it.
 *
 * Each share is reviewed by its centre on its own — approved (units
 * reserved), refused with a reason, released — so each gets its own card. The
 * allocation's page, linked from here, is where its receipt is confirmed and
 * its DOH form printed.
 */

import { computed } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { REQUEST_STATUS_TONES } from '~/types/bloodRequest'
import { canWithdrawAllocation } from '~/utils/transfusionSourcing'

const props = defineProps({
  allocation: { type: Object, required: true },
  requestOpen: { type: Boolean, default: true },
  busy: { type: Boolean, default: false },
})

defineEmits(['withdraw'])

const tone = computed(() => REQUEST_STATUS_TONES[props.allocation.status] ?? 'muted')
const ended = computed(() => ['rejected', 'cancelled'].includes(props.allocation.status))
const awaitingReceipt = computed(() =>
  Math.max(0, (props.allocation.fulfilled_quantity ?? 0) - (props.allocation.received_count ?? 0)),
)
</script>

<style scoped>
.allocation {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
}

.allocation--ended {
  background: var(--rb-surface-alt);
}

.allocation__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.allocation__who {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.allocation__facility {
  font-size: 14px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.allocation__ref {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--rb-primary-text);
  text-decoration: none;
}

.allocation__ref:hover {
  text-decoration: underline;
}

.allocation__tag {
  font-size: 11.5px;
  color: var(--rb-text-secondary);
}

.allocation__chip {
  flex-shrink: 0;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 600;
  white-space: nowrap;
}

.allocation__lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.allocation__line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  font-size: 13px;
}

.allocation__component {
  font-weight: 600;
  color: var(--rb-text-primary);
}

.allocation__figures {
  color: var(--rb-text-secondary);
  font-variant-numeric: tabular-nums;
}

.allocation__closure {
  flex-basis: 100%;
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.allocation__reason,
.allocation__receipt {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12.5px;
  line-height: 1.45;
}

.allocation__reason {
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
}

.allocation__receipt {
  background: rgba(var(--rb-warning-rgb), 0.12);
  color: var(--rb-warning-text);
}

.allocation__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.allocation__btn {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.allocation__btn:hover:not(:disabled) {
  background: var(--rb-surface-hover);
}

.allocation__btn--quiet {
  color: var(--rb-accent-text);
}

.allocation__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.tone--success { background: rgba(var(--rb-success-rgb), 0.14); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }
.tone--progress { background: rgba(var(--rb-purple-rgb), 0.12); color: var(--rb-purple-text); }
.tone--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
</style>
