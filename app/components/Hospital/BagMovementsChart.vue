<template>
  <!--
    Bag movements over the last 14 days (project owner, 2026-11-26: a
    dashboard is its charts). Three series, one line each: bags stocked in,
    transfused, and lost (discarded or expired). A legend with each series'
    total, direct labels at the line ends, a crosshair and tooltip on hover,
    and the same figures as a table on request.
  -->
  <div ref="root" class="bm">
    <div class="bm__bar">
      <ul class="bm__legend" aria-label="Series">
        <li v-for="s in SERIES" :key="s.key" class="bm__key">
          <span class="bm__swatch" :style="{ background: `var(--bm-${s.key})` }" aria-hidden="true" />
          {{ s.label }}
          <strong>{{ loading ? '–' : totals[s.key] }}</strong>
        </li>
      </ul>
      <button type="button" class="bm__toggle" :aria-pressed="asTable" @click="asTable = !asTable">
        <AssetIcon :name="asTable ? 'chart' : 'list'" :size="14" />
        {{ asTable ? 'View as chart' : 'View as table' }}
      </button>
    </div>

    <div v-if="loading" class="bm__state" aria-busy="true"><span class="bm__sk" /></div>
    <p v-else-if="error" class="bm__state bm__state--msg" role="alert">{{ error }}</p>
    <p v-else-if="!anyMovement" class="bm__state bm__state--msg">
      <AssetIcon name="activity" :size="18" />
      No bag moved in the last 14 days.
    </p>

    <!-- The table view: every day, every series. -->
    <div v-else-if="asTable" class="bm__table-wrap">
      <table class="bm__table">
        <caption class="sr-only">Bag movements per day, last 14 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th v-for="s in SERIES" :key="s.key" scope="col" class="num">{{ s.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="day in [...days].reverse()" :key="day.iso">
            <th scope="row">{{ day.long }}</th>
            <td v-for="s in SERIES" :key="s.key" class="num">{{ day[s.key] || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- The chart -->
    <div v-else ref="plot" class="bm__plot" @mousemove="onMove" @mouseleave="hover = null">
      <svg :width="width" :height="HEIGHT" role="img" :aria-label="summary">
        <!-- Recessive grid and y labels -->
        <g v-for="tick in yTicks" :key="tick">
          <line :x1="PAD.l" :x2="width - PAD.r" :y1="y(tick)" :y2="y(tick)" class="bm__grid" />
          <text :x="PAD.l - 8" :y="y(tick)" class="bm__ylab" text-anchor="end" dominant-baseline="middle">{{ tick }}</text>
        </g>
        <!-- X labels, every other day -->
        <text
          v-for="(day, i) in days"
          v-show="i % 2 === (days.length - 1) % 2"
          :key="day.iso"
          :x="x(i)"
          :y="HEIGHT - 6"
          class="bm__xlab"
          text-anchor="middle"
        >{{ day.short }}</text>

        <!-- Crosshair -->
        <line v-if="hover !== null" :x1="x(hover)" :x2="x(hover)" :y1="PAD.t" :y2="HEIGHT - PAD.b" class="bm__cross" />

        <!-- One line per series, drawn last to first so the first sits on top -->
        <g v-for="s in [...SERIES].reverse()" :key="s.key">
          <path :d="pathOf(s.key)" class="bm__line" :style="{ stroke: `var(--bm-${s.key})` }" />
          <!-- Direct label at the line's end -->
          <text :x="width - PAD.r + 8" :y="endLabelY(s.key)" class="bm__end" dominant-baseline="middle">{{ s.short }}</text>
          <circle v-if="hover !== null" :cx="x(hover)" :cy="y(days[hover][s.key])" r="4.5" class="bm__dot" :style="{ fill: `var(--bm-${s.key})` }" />
        </g>
      </svg>

      <!-- Tooltip -->
      <div v-if="hover !== null" class="bm__tip" :style="tipStyle" role="status">
        <p class="bm__tip-day">{{ days[hover].long }}</p>
        <p v-for="s in SERIES" :key="s.key" class="bm__tip-row">
          <span class="bm__swatch" :style="{ background: `var(--bm-${s.key})` }" aria-hidden="true" />
          {{ s.label }}
          <strong>{{ days[hover][s.key] }}</strong>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { hospitalService } from '~/api/hospital/HospitalService'

const DAYS = 14
const HEIGHT = 230
const PAD = { t: 14, r: 92, b: 26, l: 34 }
const MAX_PAGES = 10

// Fixed categorical order (dataviz reference slots 1–3, validated both modes).
const SERIES = [
  { key: 'in', label: 'Stocked in', short: 'Stocked in', kinds: ['stocked'] },
  { key: 'out', label: 'Transfused', short: 'Transfused', kinds: ['transfused'] },
  { key: 'lost', label: 'Discarded & expired', short: 'Lost', kinds: ['discarded', 'expired'] },
]

const loading = ref(true)
const error = ref('')
const asTable = ref(false)
const events = ref([])
const hover = ref(null)
const plot = ref(null)
const root = ref(null)
const width = ref(640)

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The last 14 days, oldest first, each with its count per series. */
const days = computed(() => {
  const out = []
  const today = new Date()
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    out.push({
      iso: isoDay(d),
      short: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      long: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      in: 0, out: 0, lost: 0,
    })
  }
  const byIso = new Map(out.map((day) => [day.iso, day]))
  for (const e of events.value) {
    const day = byIso.get(isoDay(new Date(e.at)))
    if (!day) continue
    const series = SERIES.find((s) => s.kinds.includes(e.kind))
    if (series) day[series.key] += 1
  }
  return out
})

const totals = computed(() => Object.fromEntries(SERIES.map((s) => [s.key, days.value.reduce((n, d) => n + d[s.key], 0)])))
const anyMovement = computed(() => SERIES.some((s) => totals.value[s.key] > 0))
const summary = computed(() => `Bag movements, last 14 days: ${SERIES.map((s) => `${totals.value[s.key]} ${s.label.toLowerCase()}`).join(', ')}.`)

// Scales: a rounded maximum and up to four whole-number ticks.
const yMax = computed(() => {
  const peak = Math.max(1, ...days.value.flatMap((d) => SERIES.map((s) => d[s.key])))
  const step = Math.max(1, Math.ceil(peak / 4))
  return step * 4
})
const yTicks = computed(() => [0, 1, 2, 3, 4].map((i) => (yMax.value / 4) * i))
const x = (i) => PAD.l + (i * (width.value - PAD.l - PAD.r)) / (DAYS - 1)
const y = (v) => HEIGHT - PAD.b - (v / yMax.value) * (HEIGHT - PAD.t - PAD.b)

function pathOf(key) {
  return days.value.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ')
}

/** End labels, nudged apart so they never sit on one another. */
const endLabels = computed(() => {
  const last = days.value[days.value.length - 1]
  const placed = SERIES.map((s) => ({ key: s.key, y: y(last[s.key]) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < placed.length; i++) {
    if (placed[i].y - placed[i - 1].y < 14) placed[i].y = placed[i - 1].y + 14
  }
  return Object.fromEntries(placed.map((p) => [p.key, p.y]))
})
const endLabelY = (key) => endLabels.value[key]

function onMove(event) {
  const rect = plot.value?.getBoundingClientRect()
  if (!rect) return
  const px = event.clientX - rect.left
  const step = (width.value - PAD.l - PAD.r) / (DAYS - 1)
  hover.value = Math.min(DAYS - 1, Math.max(0, Math.round((px - PAD.l) / step)))
}
const tipStyle = computed(() => {
  if (hover.value === null) return {}
  const left = x(hover.value)
  const flip = left > width.value * 0.6
  return { left: `${left}px`, transform: flip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }
})

let observer = null
// The plot is as wide as the card, less its side padding (18px each side).
function measure() {
  if (root.value) width.value = Math.max(320, root.value.clientWidth - 36)
}

/** Newest first, page by page, until a page reaches past the 14 days. */
async function load() {
  loading.value = true
  error.value = ''
  const since = new Date()
  since.setDate(since.getDate() - (DAYS - 1))
  since.setHours(0, 0, 0, 0)
  const out = []
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await hospitalService.inventoryActivity({ page, per_page: 50 })
      const rows = res?.data ?? []
      out.push(...rows)
      const oldest = rows[rows.length - 1]
      if (!rows.length || page >= (res?.last_page ?? page) || (oldest && new Date(oldest.at) < since)) break
    }
    events.value = out
  } catch (err) {
    error.value = err?.message || 'Bag movements could not be loaded.'
  } finally {
    loading.value = false
    await nextTick()
    measure()
  }
}

onMounted(() => {
  load()
  observer = new ResizeObserver(measure)
  if (root.value) observer.observe(root.value)
  measure()
})
onBeforeUnmount(() => observer?.disconnect())

defineExpose({ reload: load })
</script>

<style scoped>
/* Series colours: the dataviz reference slots 1–3, light then dark. */
.bm {
  --bm-in: #257de0;
  --bm-out: #f47230;
  --bm-lost: #00b894;
  display: flex; flex-direction: column; gap: 12px; padding: 4px 18px 18px;
}
:global(.dark) .bm {
  --bm-in: #338ced;
  --bm-out: #e76624;
  --bm-lost: #00a888;
}

.bm__bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
.bm__legend { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; padding: 0; list-style: none; }
.bm__key { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--rb-text-secondary); }
.bm__key strong { font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.bm__swatch { width: 12px; height: 3px; flex: none; border-radius: 2px; }
.bm__toggle {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid var(--rb-border); border-radius: 8px;
  background: var(--rb-surface); font: inherit; font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer;
}
.bm__toggle:hover { color: var(--rb-text-primary); border-color: var(--rb-border-strong); }
.bm__toggle:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.bm__state { display: grid; place-items: center; min-height: 230px; }
.bm__state--msg { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0; font-size: 13px; color: var(--rb-text-muted); }
.bm__sk { width: 100%; height: 200px; border-radius: 10px; background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%); background-size: 400% 100%; animation: bm-shimmer 1.4s ease infinite; }
@keyframes bm-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.bm__plot { position: relative; width: 100%; }
.bm__plot svg { display: block; overflow: visible; }
.bm__grid { stroke: var(--rb-border); stroke-width: 1; }
.bm__ylab, .bm__xlab { font-size: 11px; fill: var(--rb-text-muted); font-variant-numeric: tabular-nums; }
.bm__line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.bm__end { font-size: 11.5px; font-weight: 600; fill: var(--rb-text-secondary); }
.bm__cross { stroke: var(--rb-border-strong); stroke-width: 1; stroke-dasharray: 3 3; }
.bm__dot { stroke: var(--rb-surface); stroke-width: 2; }

.bm__tip {
  position: absolute; top: 8px; z-index: 2; min-width: 170px; padding: 10px 12px; pointer-events: none;
  border: 1px solid var(--rb-border); border-radius: 10px; background: var(--rb-surface);
  box-shadow: 0 10px 24px -12px rgba(15, 23, 42, 0.35);
}
.bm__tip-day { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: var(--rb-text-primary); }
.bm__tip-row { display: flex; align-items: center; gap: 7px; margin: 2px 0 0; font-size: 12px; color: var(--rb-text-secondary); }
.bm__tip-row strong { margin-left: auto; padding-left: 12px; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }

.bm__table-wrap { max-height: 300px; overflow: auto; border: 1px solid var(--rb-border); border-radius: 10px; }
.bm__table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.bm__table th, .bm__table td { padding: 7px 12px; border-bottom: 1px solid var(--rb-border); text-align: left; color: var(--rb-text-primary); }
.bm__table thead th { position: sticky; top: 0; background: var(--rb-surface-alt); font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--rb-text-secondary); }
.bm__table tbody th { font-weight: 600; }
.bm__table .num { text-align: right; font-variant-numeric: tabular-nums; }
.bm__table tbody tr:last-child th, .bm__table tbody tr:last-child td { border-bottom: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (prefers-reduced-motion: reduce) { .bm__sk { animation: none; } }
</style>
