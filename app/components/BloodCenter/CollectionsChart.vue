<template>
  <!--
    Money collected per day or per month: one series, so one hue and no legend
    (the card's title names it). Columns no wider than 24px with a rounded top,
    square on the baseline; hairline gridlines at three clean ticks. Each
    column's whole slot is its hover and focus target, which shows the value.
  -->
  <figure class="cc">
    <div class="cc__plot" @mouseleave="hovered = null">
      <div class="cc__grid" aria-hidden="true">
        <div v-for="tick in ticks" :key="tick" class="cc__tick" :style="{ bottom: `${(tick / top) * 100}%` }">
          <span class="cc__tick-label">{{ compact(tick) }}</span>
        </div>
      </div>

      <div class="cc__bars" :style="{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }">
        <button
          v-for="(point, i) in series"
          :key="point.key"
          type="button"
          class="cc__slot"
          :aria-label="`${longLabel(point.key)}: ${pesos(point.amount)}`"
          @mouseenter="hovered = i"
          @focus="hovered = i"
          @blur="hovered = null"
        >
          <span
            class="cc__bar"
            :class="{ 'cc__bar--on': hovered === i, 'cc__bar--zero': !(Number(point.amount) > 0) }"
            :style="{ height: `${(Number(point.amount) / top) * 100}%` }"
          />
        </button>
      </div>

      <div
        v-if="hovered !== null && series[hovered]"
        class="cc__tip"
        :class="{ 'cc__tip--left': hovered > series.length / 2 }"
        :style="{ left: `${((hovered + 0.5) / series.length) * 100}%` }"
        role="status"
      >
        <span class="cc__tip-label">{{ longLabel(series[hovered].key) }}</span>
        <strong>{{ pesos(series[hovered].amount) }}</strong>
      </div>
    </div>

    <div class="cc__axis" :style="{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }" aria-hidden="true">
      <span v-for="(point, i) in series" :key="point.key" class="cc__x">{{ i % every === 0 || i === series.length - 1 ? shortLabel(point.key) : '' }}</span>
    </div>

    <!-- Every value, for a screen reader and for anyone who wants the figures. -->
    <table class="sr-only">
      <caption>Collected per {{ granularity }}</caption>
      <thead><tr><th scope="col">{{ granularity === 'day' ? 'Day' : 'Month' }}</th><th scope="col">Collected</th></tr></thead>
      <tbody>
        <tr v-for="point in series" :key="point.key"><td>{{ longLabel(point.key) }}</td><td>{{ pesos(point.amount) }}</td></tr>
      </tbody>
    </table>
  </figure>
</template>

<script setup lang="ts">
import { pesos } from '~/utils/billing'

const props = defineProps<{
  series: { key: string; amount: string }[]
  granularity: 'day' | 'month'
}>()

const hovered = ref<number | null>(null)

const max = computed(() => Math.max(0, ...props.series.map((p) => Number(p.amount) || 0)))

// The axis tops out at the next clean number (1, 2, 2.5 or 5 times a power of ten).
const top = computed(() => {
  if (!(max.value > 0)) return 1
  const power = 10 ** Math.floor(Math.log10(max.value))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= max.value) ?? 10
  return step * power
})

const ticks = computed(() => [0, top.value / 2, top.value])

// Labels on the x-axis thin out so they never collide: about eight at most.
const every = computed(() => Math.max(1, Math.ceil(props.series.length / 8)))

function compact(value: number): string {
  if (value >= 1_000_000) return `₱${+(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `₱${+(value / 1_000).toFixed(1)}K`
  return `₱${value}`
}

function asDate(key: string): Date {
  return props.granularity === 'day' ? new Date(`${key}T00:00:00`) : new Date(`${key}-01T00:00:00`)
}

function shortLabel(key: string): string {
  return props.granularity === 'day'
    ? asDate(key).toLocaleDateString('en-PH', { day: 'numeric', month: 'short' })
    : asDate(key).toLocaleDateString('en-PH', { month: 'short' })
}

function longLabel(key: string): string {
  return props.granularity === 'day'
    ? asDate(key).toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : asDate(key).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
}
</script>

<style scoped>
.cc { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.cc__plot { position: relative; height: 200px; margin-left: 52px; }

.cc__grid { position: absolute; inset: 0; pointer-events: none; }
.cc__tick { position: absolute; left: 0; right: 0; border-top: 1px solid var(--rb-border); }
.cc__tick-label {
  position: absolute; right: calc(100% + 8px); top: 0; transform: translateY(-50%);
  font-size: 11px; color: var(--rb-text-muted); font-variant-numeric: tabular-nums; white-space: nowrap;
}

.cc__bars { position: absolute; inset: 0; display: grid; align-items: end; }
.cc__slot {
  height: 100%; display: flex; align-items: flex-end; justify-content: center; padding: 0 1px;
  border: 0; background: transparent; cursor: default;
}
.cc__slot:focus-visible { outline: none; box-shadow: inset 0 0 0 2px rgba(var(--rb-primary-rgb), .45); border-radius: 6px; }
.cc__bar {
  display: block; width: min(24px, 72%); min-height: 0; border-radius: 4px 4px 0 0;
  background: var(--rb-primary); opacity: .85;
  transition: opacity .12s var(--rb-ease-out);
}
.cc__bar--on { opacity: 1; }
.cc__bar--zero { height: 0 !important; }

/* The value of the column under the pointer, in text tokens, never the bar's colour. */
.cc__tip {
  position: absolute; top: 4px; transform: translateX(8px); z-index: 2; pointer-events: none;
  display: flex; flex-direction: column; gap: 1px; padding: 7px 10px; border-radius: 9px;
  background: var(--rb-surface); border: 1px solid var(--rb-border-strong);
  box-shadow: 0 6px 18px -6px rgba(var(--rb-shadow-rgb), .3); white-space: nowrap;
}
.cc__tip--left { transform: translateX(calc(-100% - 8px)); }
.cc__tip-label { font-size: 11px; color: var(--rb-text-secondary); }
.cc__tip strong { font-size: 13px; font-weight: 800; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

.cc__axis { display: grid; margin-left: 52px; }
.cc__x { overflow: visible; font-size: 11px; color: var(--rb-text-muted); text-align: center; white-space: nowrap; }
/* The end labels sit inside the plot's edges, never over what is beside it. */
.cc__x:first-child { text-align: left; }
.cc__x:last-child { display: flex; justify-content: flex-end; }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (prefers-reduced-motion: reduce) {
  .cc__bar { transition: none; }
}
</style>
