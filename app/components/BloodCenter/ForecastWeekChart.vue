<template>
  <!--
    Twelve weeks behind and the weeks ahead, as one line (2026-10-24): the
    history solid over a soft fill, the forecast dashed on from the last week,
    its likely range a band. Replaces the old hatched columns, which drew as
    empty boxes when nothing had been requested.
  -->
  <div class="wc" :class="[tone ? `wc--${tone}` : '', { 'wc--compact': compact }]">
    <div class="wc__y" aria-hidden="true">
      <span v-for="tick in [...scale.ticks].reverse()" :key="tick">{{ tick }}</span>
    </div>
    <div class="wc__plot">
      <div class="wc__grid" aria-hidden="true">
        <span v-for="tick in scale.ticks" :key="tick" />
      </div>
      <!-- The weeks ahead, set apart. -->
      <div class="wc__ahead" :style="{ left: `${(series.length / slots) * 100}%` }" aria-hidden="true">
        <span>Forecast</span>
      </div>
      <svg class="wc__svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img" :aria-label="ariaLabel">
        <defs>
          <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" class="wc__stop wc__stop--top" />
            <stop offset="100%" class="wc__stop wc__stop--bottom" />
          </linearGradient>
        </defs>
        <path v-if="band" :d="band" class="wc__band" />
        <path v-if="history.area" :d="history.area" :fill="`url(#${gradientId})`" />
        <path v-if="history.line" :d="history.line" class="wc__line" vector-effect="non-scaling-stroke" />
        <path v-if="ahead" :d="ahead" class="wc__line wc__line--ahead" vector-effect="non-scaling-stroke" />
      </svg>
      <!-- Points and hover tips, in HTML so they stay round at any width. -->
      <div class="wc__cols">
        <div v-for="(col, i) in columns" :key="i" class="wc__col" :class="{ 'wc__col--ahead': col.ahead }">
          <span class="wc__dot" :style="{ bottom: `${pos(col.value)}%` }" />
          <span class="wc__tip" :style="{ bottom: `calc(${pos(col.value)}% + 12px)` }">
            <strong>{{ col.title }}</strong>
            {{ col.text }}
          </span>
          <span class="wc__x">{{ col.label }}</span>
        </div>
      </div>
      <p v-if="empty" class="wc__empty">Nothing recorded in these 12 weeks yet, so there is no line to draw.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue'
import { niceScale } from '~/utils/collectionDashboard'
import { smoothPath } from '~/utils/smoothPath'

const props = defineProps({
  series: { type: Array, required: true },
  estimate: { type: Object, required: true },
  weeks: { type: Array, required: true },
  horizon: { type: Array, required: true },
  unit: { type: String, default: '' },
  tone: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})

const W = 1000
const H = 200
const gradientId = `wc-fill-${useId()}`

const slots = computed(() => props.series.length + props.horizon.length)
const scale = computed(() => niceScale(Math.max(0, ...props.series, props.estimate.high || 0, props.estimate.per_week || 0)))
const pos = v => Math.min(100, ((v || 0) / scale.value.max) * 100)
const x = i => ((i + 0.5) / slots.value) * W
const y = v => H - (pos(v) / 100) * H

const empty = computed(() => !props.series.some(Boolean) && !props.estimate.per_week)

const history = computed(() => {
  const points = props.series.map((v, i) => ({ x: x(i), y: y(v) }))
  if (points.length < 2) return { line: '', area: '' }
  const line = smoothPath(points)
  return { line, area: `${line} L${points[points.length - 1].x},${H} L${points[0].x},${H} Z` }
})

// From the last week recorded to each week ahead, at the forecast.
const ahead = computed(() => {
  const n = props.series.length
  if (!n || !props.horizon.length) return ''
  const start = `M${x(n - 1)},${y(props.series[n - 1])}`
  return props.horizon.reduce((d, _, i) => `${d} L${x(n + i)},${y(props.estimate.per_week)}`, start)
})

const band = computed(() => {
  const n = props.series.length
  const { low, high } = props.estimate
  if (!props.horizon.length || high === undefined || high === null || high === low) return ''
  const left = x(n) - (W / slots.value) / 2
  const right = W
  return `M${left},${y(high)} L${right},${y(high)} L${right},${y(low)} L${left},${y(low)} Z`
})

const label = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const columns = computed(() => [
  ...props.series.map((v, i) => ({
    value: v,
    ahead: false,
    title: `Week of ${label(props.weeks[i])}`,
    text: `${v} ${props.unit}`,
    label: i % 3 === 0 ? label(props.weeks[i]) : '',
  })),
  ...props.horizon.map((d, i) => ({
    value: props.estimate.per_week,
    ahead: true,
    title: `Week of ${label(d)}`,
    text: `About ${props.estimate.per_week} ${props.unit} (${props.estimate.low} to ${props.estimate.high})`,
    label: i === 0 ? label(d) : '',
  })),
])

const ariaLabel = computed(() => `${props.unit} a week over the last ${props.series.length} weeks: ${props.series.join(', ')}. Forecast about ${props.estimate.per_week} a week, ${props.estimate.low} to ${props.estimate.high}.`)
</script>

<style scoped>
.wc { --c: var(--rb-primary); --c-rgb: var(--rb-primary-rgb); display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 8px; }
.wc--alert { --c: var(--rb-accent); --c-rgb: var(--rb-accent-rgb); }
.wc__y { display: flex; flex-direction: column; justify-content: space-between; height: 190px; font-size: 11px; text-align: right; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
.wc--compact .wc__y { height: 120px; }
.wc__y span { transform: translateY(-50%); }
.wc__y span:last-child { transform: translateY(50%); }

.wc__plot { position: relative; }
.wc__grid, .wc__svg, .wc__ahead { position: absolute; inset: 0 0 auto; height: 190px; }
.wc--compact :is(.wc__grid, .wc__svg, .wc__ahead) { height: 120px; }
.wc__grid { display: flex; flex-direction: column-reverse; justify-content: space-between; pointer-events: none; }
.wc__grid span { height: 1px; background: var(--rb-border); }
.wc__ahead { left: auto; right: 0; border-left: 1px dashed rgba(var(--c-rgb), 0.35); border-radius: 0 10px 10px 0; background: rgba(var(--c-rgb), 0.045); pointer-events: none; }
.wc__ahead span { position: absolute; top: 6px; left: 8px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: rgba(var(--c-rgb), 0.85); }
.wc__svg { width: 100%; overflow: visible; pointer-events: none; }
.wc__stop--top { stop-color: var(--c); stop-opacity: 0.24; }
.wc__stop--bottom { stop-color: var(--c); stop-opacity: 0; }
.wc__line { fill: none; stroke: var(--c); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.wc__line--ahead { stroke-dasharray: 6 5; opacity: 0.9; }
.wc__band { fill: rgba(var(--c-rgb), 0.12); }

.wc__cols { position: relative; display: flex; height: 190px; padding-bottom: 24px; box-sizing: content-box; }
.wc--compact .wc__cols { height: 120px; }
.wc__col { position: relative; flex: 1; height: 100%; }
.wc__col::before { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; border-left: 1px dashed var(--rb-border-strong, var(--rb-border)); opacity: 0; transition: opacity 120ms ease; }
.wc__col:hover::before { opacity: 1; }
.wc__dot { position: absolute; left: 50%; width: 8px; height: 8px; border: 2px solid var(--rb-surface); border-radius: 50%; background: var(--c); transform: translate(-50%, 50%); }
.wc__col--ahead .wc__dot { background: var(--rb-surface); box-shadow: inset 0 0 0 2px var(--c); }
.wc__tip {
  position: absolute;
  left: 50%;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px 9px;
  border-radius: 8px;
  background: var(--rb-text-primary);
  font-size: 11.5px;
  white-space: nowrap;
  color: var(--rb-surface);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%);
  transition: opacity 120ms ease;
}
.wc__col:hover .wc__tip { opacity: 1; }
.wc__col:first-child .wc__tip { left: 0; transform: none; }
.wc__col:nth-last-child(-n + 2) .wc__tip { left: auto; right: 0; transform: none; }
.wc__x { position: absolute; top: calc(100% + 6px); left: 50%; font-size: 10.5px; white-space: nowrap; color: var(--rb-text-muted); transform: translateX(-50%); }

.wc__empty {
  position: absolute;
  top: 70px;
  left: 50%;
  margin: 0;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--rb-surface);
  box-shadow: 0 0 0 1px var(--rb-border);
  font-size: 12px;
  white-space: nowrap;
  color: var(--rb-text-secondary);
  transform: translateX(-50%);
}
/* A narrow card wraps the note inside it rather than past its edge. */
.wc--compact .wc__empty { top: 40px; width: max-content; max-width: calc(100% - 16px); white-space: normal; text-align: center; border-radius: 12px; }

@media (prefers-reduced-motion: reduce) {
  .wc__col::before, .wc__tip { transition: none; }
}
</style>
