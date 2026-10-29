<template>
  <!--
    Money collected per day or per month, as one smooth curve over a soft
    fill (2026-10-27; was columns). One series, so one hue and no legend.
    Hairline gridlines at three clean ticks. Each day's whole slot is its
    hover and focus target, which marks the point and shows the value.
  -->
  <figure class="cc">
    <div class="cc__plot" @mouseleave="hovered = null">
      <div class="cc__grid" aria-hidden="true">
        <div v-for="tick in ticks" :key="tick" class="cc__tick" :style="{ bottom: `${(tick / top) * 100}%` }">
          <span class="cc__tick-label">{{ compact(tick) }}</span>
        </div>
      </div>

      <svg v-if="max > 0" class="cc__svg" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient :id="fillId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" class="cc__stop cc__stop--top" />
            <stop offset="100%" class="cc__stop cc__stop--bottom" />
          </linearGradient>
        </defs>
        <path v-if="curve.area" :d="curve.area" :fill="`url(#${fillId})`" />
        <path v-if="curve.line" :d="curve.line" class="cc__line" vector-effect="non-scaling-stroke" />
      </svg>

      <div class="cc__slots" :style="{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }">
        <button
          v-for="(point, i) in series"
          :key="point.key"
          type="button"
          class="cc__slot"
          :class="{ 'cc__slot--on': hovered === i }"
          :aria-label="`${longLabel(point.key)}: ${pesos(point.amount)}`"
          @mouseenter="hovered = i"
          @focus="hovered = i"
          @blur="hovered = null"
        >
          <span v-if="max > 0" class="cc__dot" :style="{ bottom: `${pos(point.amount)}%` }" />
        </button>
      </div>

      <div
        v-if="hovered !== null && hoveredPoint"
        class="cc__tip"
        :class="{ 'cc__tip--left': hovered > series.length / 2 }"
        :style="{ left: `${((hovered + 0.5) / series.length) * 100}%`, bottom: `calc(${pos(hoveredPoint.amount)}% + 12px)` }"
        role="status"
      >
        <span class="cc__tip-label">{{ longLabel(hoveredPoint.key) }}</span>
        <strong>{{ pesos(hoveredPoint.amount) }}</strong>
      </div>

      <div v-if="!(max > 0)" class="cc__empty">
        <span class="cc__empty-icon" aria-hidden="true"><AssetIcon name="activity" :size="20" /></span>
        <strong>Nothing collected in this period</strong>
        <span>Payments taken at the billing counter show here, day by day.</span>
      </div>
    </div>

    <div class="cc__axis" :style="{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }" aria-hidden="true">
      <span v-for="(point, i) in series" :key="point.key" class="cc__x">{{ labelled(i) ? shortLabel(point.key) : '' }}</span>
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
import AssetIcon from '~/components/common/AssetIcon.vue'
import { pesos } from '~/utils/billing'
import { smoothPath } from '~/utils/smoothPath'

const props = defineProps<{
  series: { key: string; amount: string }[]
  granularity: 'day' | 'month'
}>()

const hovered = ref<number | null>(null)
// The point under the pointer, or null: what the tooltip reads.
const hoveredPoint = computed(() => (hovered.value === null ? null : props.series[hovered.value] ?? null))

const max = computed(() => Math.max(0, ...props.series.map((p) => Number(p.amount) || 0)))

// The axis tops out at the next clean number (1, 2, 2.5 or 5 times a power of ten).
const top = computed(() => {
  if (!(max.value > 0)) return 1
  const power = 10 ** Math.floor(Math.log10(max.value))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= max.value) ?? 10
  return step * power
})

// Nothing collected: only the baseline, never a made-up ₱1 scale.
const ticks = computed(() => (max.value > 0 ? [0, top.value / 2, top.value] : [0]))

// Labels on the x-axis thin out so they never collide: about eight at most.
const every = computed(() => Math.max(1, Math.ceil(props.series.length / 8)))
/** Every `every`th label and the last; a regular one too near the last is left out. */
function labelled(i: number): boolean {
  const last = props.series.length - 1
  if (i === last) return true
  return i % every.value === 0 && last - i >= Math.ceil(every.value * 0.75)
}

// One gradient id per chart, so two charts on a page never share a fill.
const fillId = `cc-fill-${useId()}`

const pos = (amount: string) => Math.min(100, ((Number(amount) || 0) / top.value) * 100)
const curve = computed(() => {
  const n = props.series.length
  if (n < 2) return { line: '', area: '' }
  const points = props.series.map((p, i) => ({ x: ((i + 0.5) / n) * 1000, y: 200 - pos(p.amount) * 2 }))
  const line = smoothPath(points)
  return { line, area: `${line} L${points[n - 1]!.x},200 L${points[0]!.x},200 Z` }
})

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
.cc { margin: 0; display: flex; flex-direction: column; gap: 8px; }
.cc__plot { position: relative; height: 220px; margin-left: 52px; }

.cc__grid { position: absolute; inset: 0; pointer-events: none; }
.cc__tick { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--rb-border); }
.cc__tick:first-child { border-top-style: solid; }
.cc__tick-label {
  position: absolute; right: calc(100% + 8px); top: 0; transform: translateY(-50%);
  font-size: 11px; color: var(--rb-text-muted); font-variant-numeric: tabular-nums; white-space: nowrap;
}

.cc__svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.cc__stop--top { stop-color: var(--rb-primary); stop-opacity: .22; }
.cc__stop--bottom { stop-color: var(--rb-primary); stop-opacity: 0; }
.cc__line { fill: none; stroke: var(--rb-primary); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }

.cc__slots { position: absolute; inset: 0; display: grid; }
.cc__slot { position: relative; height: 100%; padding: 0; border: 0; border-radius: 6px; background: transparent; cursor: default; }
.cc__slot--on { background: linear-gradient(to top, rgba(var(--rb-primary-rgb), .07), transparent); }
.cc__slot:focus-visible { outline: none; box-shadow: inset 0 0 0 2px rgba(var(--rb-primary-rgb), .45); }
.cc__dot {
  position: absolute; left: 50%; width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--rb-surface); background: var(--rb-primary);
  box-shadow: 0 0 0 1px var(--rb-primary); opacity: 0;
  transform: translate(-50%, 50%); transition: opacity .12s var(--rb-ease-out);
}
.cc__slot--on .cc__dot { opacity: 1; }

/* The value of the day under the pointer, in text tokens, never the line's colour. */
.cc__tip {
  position: absolute; transform: translateX(-50%); z-index: 2; pointer-events: none;
  display: flex; flex-direction: column; gap: 1px; padding: 7px 10px; border-radius: 9px;
  background: var(--rb-surface); border: 1px solid var(--rb-border-strong);
  box-shadow: 0 6px 18px -6px rgba(var(--rb-shadow-rgb), .3); white-space: nowrap;
}
.cc__tip:not(.cc__tip--left) { transform: translateX(-12px); }
.cc__tip--left { transform: translateX(calc(-100% + 12px)); }
.cc__tip-label { font-size: 11px; color: var(--rb-text-secondary); }
.cc__tip strong { font-size: 13px; font-weight: 800; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.cc__empty { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; font-size: 13px; color: var(--rb-text-muted); pointer-events: none; }

.cc__axis { display: grid; margin-left: 52px; }
.cc__x { overflow: visible; font-size: 11px; color: var(--rb-text-muted); text-align: center; white-space: nowrap; }
/* The end labels sit inside the plot's edges, never over what is beside it. */
.cc__x:first-child { text-align: left; }
.cc__x:last-child { display: flex; justify-content: flex-end; }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (prefers-reduced-motion: reduce) {
  .cc__dot { transition: none; }
}

.cc__empty { inset: 8px 0 1px; border: 1px dashed rgba(var(--rb-primary-rgb), .3); border-radius: 12px; background: linear-gradient(180deg, rgba(var(--rb-primary-rgb), .07), rgba(var(--rb-primary-rgb), .01)); flex-direction: column; display: flex; align-items: center; justify-content: center; gap: 4px; text-align: center; font-size: 12.5px; }
.cc__empty strong { font-size: 13.5px; color: var(--rb-text-primary); }
.cc__empty-icon { display: grid; place-items: center; width: 42px; height: 42px; margin-bottom: 4px; border-radius: 12px; background: rgba(var(--rb-primary-rgb), .14); box-shadow: 0 0 0 6px rgba(var(--rb-primary-rgb), .06); color: var(--rb-primary-text); }
</style>
