<template>
  <div
    v-if="cells.length"
    class="low-banner"
    :class="{ 'low-banner--critical': hasCritical }"
    role="alert"
  >
    <span class="low-banner__icon" aria-hidden="true">
      <AssetIcon name="triangle-alert" :size="18" />
    </span>

    <div class="low-banner__body">
      <p class="low-banner__title">{{ title }}</p>
      <ul class="low-banner__chips" aria-label="Blood stocks below their minimum">
        <li
          v-for="cell in shown"
          :key="`${cell.blood_type_id}:${cell.component_id}`"
          class="low-banner__chip"
          :class="`low-banner__chip--${cell.status}`"
        >
          {{ chipLabel(cell) }}
        </li>
        <li v-if="extra > 0" class="low-banner__chip low-banner__chip--more">+{{ extra }} more</li>
      </ul>
    </div>

    <NuxtLink v-if="to" :to="to" class="low-banner__link">
      View thresholds
      <AssetIcon name="arrow-right" :size="14" />
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
/**
 * A red banner for blood stocks that have fallen below their minimum.
 *
 * Shows nothing when nothing is short, so a page can place it unconditionally.
 * The cells are the server's `low` list, already ordered with empty shelves
 * first; the banner only trims it to a few chips and says how many more.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import type { StockThresholdCell } from '~/types/stockThreshold'
import { chipLabel } from '~/utils/stockThreshold'

const props = withDefaults(defineProps<{
  cells: StockThresholdCell[]
  /** Where "View thresholds" goes; omitted when the page is the thresholds page. */
  to?: string
  /** How many chips to show before "+N more". */
  max?: number
}>(), {
  to: undefined,
  max: 4,
})

const shown = computed(() => props.cells.slice(0, props.max))
const extra = computed(() => Math.max(0, props.cells.length - props.max))
const hasCritical = computed(() => props.cells.some((cell) => cell.status === 'critical'))

const title = computed(() => {
  const count = props.cells.length
  const empty = props.cells.filter((cell) => cell.status === 'critical').length
  const base = count === 1 ? '1 blood stock is below its minimum' : `${count} blood stocks are below their minimum`

  return empty > 0 ? `${base} (${empty} out of stock)` : base
})
</script>

<style scoped>
.low-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid rgba(var(--rb-warning-rgb), 0.35);
  border-radius: 12px;
  background: rgba(var(--rb-warning-rgb), 0.09);
  color: var(--rb-text-primary);
}
.low-banner--critical {
  border-color: rgba(var(--rb-accent-rgb), 0.4);
  background: rgba(var(--rb-accent-rgb), 0.08);
}

.low-banner__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 999px;
  background: rgba(var(--rb-warning-rgb), 0.16);
  color: var(--rb-warning-text);
}
.low-banner--critical .low-banner__icon {
  background: rgba(var(--rb-accent-rgb), 0.14);
  color: var(--rb-accent-text);
}

.low-banner__body { min-width: 0; flex: 1; }
.low-banner__title { margin: 0; font-size: 13.5px; font-weight: 700; }

.low-banner__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}
.low-banner__chip {
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: rgba(var(--rb-warning-rgb), 0.16);
  color: var(--rb-warning-text);
}
.low-banner__chip--critical { background: rgba(var(--rb-accent-rgb), 0.14); color: var(--rb-accent-text); }
.low-banner__chip--more { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

.low-banner__link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--rb-primary-text);
  text-decoration: none;
  white-space: nowrap;
}
.low-banner__link:hover { text-decoration: underline; }
.low-banner__link:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; border-radius: 4px; }

@media (max-width: 640px) {
  .low-banner { flex-wrap: wrap; align-items: flex-start; }
  .low-banner__link { margin-left: 46px; }
}
</style>
