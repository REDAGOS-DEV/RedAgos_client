<template>
  <!--
    The top of the hospital dashboard as two chart cards (project owner,
    2026-11-26, option A): where the patient requests stand, as a donut, and
    what the shelf holds, as bars by blood type with its exceptions under it.
    Every figure still opens the page that owns it.
  -->
  <div class="sum">
    <!-- PATIENT REQUESTS -->
    <section v-if="showRequests" class="sum-card" aria-labelledby="sum-requests">
      <header class="sum-card__head">
        <h2 id="sum-requests" class="sum-card__title">
          <span class="sum-card__icon" aria-hidden="true"><AssetIcon name="clipboard-list" :size="15" /></span>
          Patient requests
        </h2>
        <NuxtLink to="/hospital/bloodrequests" class="sum-link">Open requests <AssetIcon name="chevron-right" :size="14" /></NuxtLink>
      </header>

      <div class="sum-req">
        <svg class="donut" viewBox="0 0 150 150" role="img" :aria-label="donutLabel">
          <circle cx="75" cy="75" :r="R" class="donut__track" :stroke-width="W" />
          <template v-if="!loading">
            <circle
              v-for="arc in arcs"
              :key="arc.key"
              cx="75"
              cy="75"
              :r="R"
              fill="none"
              :stroke="arc.color"
              :stroke-width="W"
              :stroke-dasharray="`${arc.len} ${CIRC}`"
              :stroke-dashoffset="-arc.offset"
              transform="rotate(-90 75 75)"
              class="donut__arc"
              @mousemove="showTip($event, `${arc.label}: ${arc.value}`)"
              @mouseleave="hideTip"
            />
          </template>
          <text x="75" y="73" text-anchor="middle" class="donut__total">{{ loading ? '–' : requestTotal }}</text>
          <text x="75" y="93" text-anchor="middle" class="donut__sub">{{ requestTotal === 1 ? 'request' : 'requests' }}</text>
        </svg>

        <ul class="legend">
          <li v-for="item in requestItems" :key="item.key">
            <NuxtLink :to="item.to" class="legend__row" :class="{ 'legend__row--zero': !loading && !item.value }">
              <span class="legend__swatch" :style="{ background: item.color }" aria-hidden="true" />
              <span class="legend__text">
                <span class="legend__label">{{ item.label }}</span>
                <span class="legend__hint">{{ item.hint }}</span>
              </span>
              <strong class="legend__value">{{ loading ? '–' : item.value }}</strong>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>

    <!-- BLOOD BANK -->
    <section v-if="showStock" class="sum-card" aria-labelledby="sum-stock">
      <header class="sum-card__head">
        <h2 id="sum-stock" class="sum-card__title">
          <span class="sum-card__icon" aria-hidden="true"><AssetIcon name="droplets" :size="15" /></span>
          Blood bank
        </h2>
        <NuxtLink to="/hospital/inventory" class="sum-link">Open inventory <AssetIcon name="chevron-right" :size="14" /></NuxtLink>
      </header>

      <NuxtLink to="/hospital/inventory?status=available" class="shelf-total" :class="{ 'shelf-total--zero': !loading && !unitsAvailable }">
        <span class="shelf-total__value">{{ loading ? '–' : unitsAvailable }}</span>
        <span class="shelf-total__label">unit{{ unitsAvailable === 1 ? '' : 's' }} on your shelf, ready to tag</span>
      </NuxtLink>

      <!-- An empty shelf says so once, with where stock comes from (2026-11-26). -->
      <div v-if="!loading && thresholds && !shelfTotal" class="shelf-empty">
        <span class="shelf-empty__icon" aria-hidden="true"><AssetIcon name="package" :size="20" /></span>
        <div class="shelf-empty__text">
          <p class="shelf-empty__title">Your shelf is empty</p>
          <p class="shelf-empty__hint">Restock it with a weekly request, or put arrived bags on the shelf.</p>
          <div class="shelf-empty__actions">
            <NuxtLink to="/hospital/receiving/weekly" class="sum-link">Weekly Request <AssetIcon name="chevron-right" :size="14" /></NuxtLink>
            <NuxtLink to="/hospital/stock-intake" class="sum-link">Stock Intake <AssetIcon name="chevron-right" :size="14" /></NuxtLink>
          </div>
        </div>
      </div>

      <!-- Available units by blood type: one hue, values above, types below. -->
      <div v-show="loading || !thresholds || shelfTotal" ref="barsBox" class="bars-box">
        <svg v-if="typeBars.length" class="bars" :width="barsWidth" :height="BARS_H" role="img" :aria-label="barsLabel">
          <line :x1="0" :x2="barsWidth" :y1="BARS_H - 22" :y2="BARS_H - 22" class="bars__base" />
          <!-- Each type opens Blood Bank Inventory on that type, as the type cards did. -->
          <g
            v-for="(bar, i) in typeBars"
            :key="bar.code"
            class="bars__col"
            role="link"
            tabindex="0"
            :aria-label="`${bar.code}: ${bar.value} unit${bar.value === 1 ? '' : 's'}. Open in Blood Bank Inventory`"
            @click="openType(bar)"
            @keydown.enter="openType(bar)"
            @mousemove="showTip($event, `${bar.code}: ${bar.value} unit${bar.value === 1 ? '' : 's'}`)"
            @mouseleave="hideTip"
          >
            <!-- The whole column is the target, not only the bar. -->
            <rect :x="i * slot + 2" y="0" :width="slot - 4" :height="BARS_H" rx="8" class="bars__hit" />
            <path
              v-if="bar.value"
              :d="barPath(i, bar.value)"
              class="bars__bar"
            />
            <rect v-else :x="barX(i)" :y="BARS_H - 24" :width="barW" height="2" rx="1" class="bars__empty" />
            <text :x="barX(i) + barW / 2" :y="barTop(bar.value) - 6" text-anchor="middle" class="bars__value" :class="{ 'bars__value--zero': !bar.value }">{{ bar.value }}</text>
            <text :x="barX(i) + barW / 2" :y="BARS_H - 5" text-anchor="middle" class="bars__type">{{ bar.code }}</text>
          </g>
        </svg>
        <p v-else class="bars-empty">{{ loading ? 'Reading your shelf…' : 'Stock by blood type shows here once your shelf can be read.' }}</p>
      </div>

      <!-- What needs someone: the bags untagged by a deadline. -->
      <div class="flags">
        <NuxtLink
          v-for="flag in flags"
          :key="flag.key"
          :to="flag.to"
          class="flag"
          :class="flag.value ? 'flag--warn' : 'flag--ok'"
          :title="flag.hint"
        >
          <AssetIcon :name="flag.value ? 'triangle-alert' : 'check'" :size="13" />
          <template v-if="flag.value">{{ flag.value }} {{ flag.label }}</template>
          <template v-else>None {{ flag.label }}</template>
        </NuxtLink>
        <!-- The levels the shelf is graded against, from the type cards' "Set levels". -->
        <NuxtLink to="/hospital/stock-thresholds" class="sum-link levels-link">
          <AssetIcon name="sliders-horizontal" :size="13" />
          {{ anyLevelSet ? 'Stock levels' : 'Set levels' }}
        </NuxtLink>
      </div>
    </section>

    <div v-if="tip.text" class="sum-tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }" role="status">{{ tip.text }}</div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, nextTick } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

const props = defineProps({
  loading: { type: Boolean, default: false },
  showRequests: { type: Boolean, default: true },
  showStock: { type: Boolean, default: true },
  pending: { type: Number, default: 0 },
  inProgress: { type: Number, default: 0 },
  fulfilledToday: { type: Number, default: 0 },
  unitsAvailable: { type: Number, default: 0 },
  untaggedAfter: { type: Number, default: 0 },
  untaggedBefore: { type: Number, default: 0 },
  // The stock thresholds payload: blood types and each cell's available units.
  thresholds: { type: Object, default: null },
})

// ── Requests donut ──
const R = 58
const W = 16
const CIRC = 2 * Math.PI * R
const GAP = 3

const requestItems = computed(() => [
  { key: 'pending', label: 'Awaiting review', hint: 'Not yet approved by a blood center', value: props.pending, color: 'var(--sum-amber)', to: '/hospital/bloodrequests' },
  { key: 'progress', label: 'In progress', hint: 'Units tagged or partly released', value: props.inProgress, color: 'var(--sum-blue)', to: '/hospital/bloodrequests' },
  { key: 'fulfilled', label: 'Fulfilled today', hint: 'Every requested unit released', value: props.fulfilledToday, color: 'var(--sum-green)', to: '/hospital/trackrequests' },
])
const requestTotal = computed(() => requestItems.value.reduce((n, i) => n + (i.value || 0), 0))
const arcs = computed(() => {
  const total = requestTotal.value
  if (!total) return []
  const shown = requestItems.value.filter((i) => i.value > 0)
  let offset = 0
  return shown.map((i) => {
    const full = (i.value / total) * CIRC
    // A 2–3px surface gap between segments; a lone segment closes the ring.
    const len = shown.length > 1 ? Math.max(0, full - GAP) : full
    const arc = { ...i, len, offset }
    offset += full
    return arc
  })
})
const donutLabel = computed(() => `Patient requests: ${requestItems.value.map((i) => `${i.value} ${i.label.toLowerCase()}`).join(', ')}`)

// ── Shelf by blood type ──
const BARS_H = 128
const barsBox = ref(null)
const barsWidth = ref(480)

const typeBars = computed(() => {
  const types = props.thresholds?.blood_types ?? []
  const cells = props.thresholds?.cells ?? []
  return types.map((type) => ({
    id: type.id,
    code: type.code,
    value: cells.filter((cell) => cell.blood_type_id === type.id).reduce((n, cell) => n + (cell.available || 0), 0),
  }))
})
const shelfTotal = computed(() => typeBars.value.reduce((n, bar) => n + bar.value, 0))
const anyLevelSet = computed(() => (props.thresholds?.cells ?? []).some((cell) => cell.minimum_units !== null))

function openType(bar) {
  hideTip()
  navigateTo(`/hospital/inventory?blood_type_id=${bar.id}`)
}
const barTopValue = computed(() => Math.max(1, ...typeBars.value.map((b) => b.value)))
const slot = computed(() => barsWidth.value / Math.max(1, typeBars.value.length))
const barW = computed(() => Math.min(34, slot.value * 0.56))
const barX = (i) => i * slot.value + (slot.value - barW.value) / 2
const barTop = (value) => BARS_H - 22 - (value / barTopValue.value) * (BARS_H - 22 - 20)
function barPath(i, value) {
  const x = barX(i)
  const w = barW.value
  const base = BARS_H - 22
  const y = barTop(value)
  const r = Math.min(4, (base - y) / 2, w / 2)
  return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`
}
const barsLabel = computed(() => `Available units by blood type: ${typeBars.value.map((b) => `${b.code} ${b.value}`).join(', ')}`)

const flags = computed(() => [
  {
    key: 'after', value: props.untaggedAfter, label: 'untagged after crossmatch', hint: 'Not transfused within 24 hours',
    to: '/hospital/inventory?tag_status=untagged_crossmatched&untag_reason=transfusion_deadline_expired',
  },
  {
    key: 'before', value: props.untaggedBefore, label: 'untagged before crossmatch', hint: 'Not crossmatched within 24 hours',
    to: '/hospital/inventory?tag_status=untagged_assigned&untag_reason=crossmatch_deadline_expired',
  },
])

// ── Tooltip ──
const tip = reactive({ text: '', x: 0, y: 0 })
function showTip(event, text) {
  tip.text = text
  tip.x = event.clientX + 12
  tip.y = event.clientY + 12
}
function hideTip() {
  tip.text = ''
}

// ── Width ──
let observer = null
function measure() {
  if (barsBox.value) barsWidth.value = Math.max(240, barsBox.value.clientWidth)
}
onMounted(() => {
  observer = new ResizeObserver(measure)
  if (barsBox.value) observer.observe(barsBox.value)
  measure()
})
watch(() => props.showStock, () => nextTick(() => {
  if (barsBox.value) { observer?.observe(barsBox.value); measure() }
}))
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
/* Status hues for the requests (each with its label), one hue for the shelf. */
.sum {
  --sum-amber: var(--rb-warning);
  --sum-blue: var(--rb-primary);
  --sum-green: var(--rb-success);
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;
}
.sum > :only-child { grid-column: 1 / -1; }

.sum-card {
  display: flex; flex-direction: column; gap: 16px; min-width: 0; padding: 18px 20px 20px;
  border: 1px solid var(--rb-border); border-radius: var(--rb-radius-lg);
  background: var(--rb-surface); box-shadow: var(--rb-shadow-sm);
}
.sum-card__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.sum-card__title { display: flex; align-items: center; gap: 9px; margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.sum-card__icon { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.sum-link { display: inline-flex; align-items: center; gap: 2px; flex: none; font-size: 13px; font-weight: 600; color: var(--rb-primary-text); text-decoration: none; }
.sum-link:hover { text-decoration: underline; }
.sum-link:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 4px; }

/* Requests: the donut beside its legend */
.sum-req { display: flex; align-items: center; gap: 24px; }
.donut { flex: none; width: 150px; height: 150px; }
.donut__track { fill: none; stroke: var(--rb-surface-alt); }
.donut__arc { transition: stroke-dasharray .6s cubic-bezier(.2,.8,.2,1); cursor: default; }
.donut__total { font-size: 32px; font-weight: 800; fill: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.donut__sub { font-size: 11.5px; font-weight: 600; fill: var(--rb-text-secondary); }

.legend { display: flex; flex: 1; flex-direction: column; gap: 6px; min-width: 0; margin: 0; padding: 0; list-style: none; }
.legend__row {
  display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; align-items: center; gap: 12px;
  padding: 8px 10px; border-radius: 10px; color: inherit; text-decoration: none;
  transition: background-color .15s ease;
}
.legend__row:hover { background: var(--rb-surface-alt); }
.legend__row:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.legend__swatch { width: 10px; height: 10px; border-radius: 3px; }
.legend__text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.legend__label { font-size: 13.5px; font-weight: 600; color: var(--rb-text-primary); }
.legend__hint { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--rb-text-muted); }
.legend__value { font-size: 20px; font-weight: 800; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.legend__row--zero .legend__value { color: var(--rb-text-muted); }
.legend__row--zero .legend__swatch { opacity: .4; }

/* Shelf: the big total, the bars, the exceptions */
.shelf-total { display: flex; align-items: baseline; gap: 8px; align-self: flex-start; color: inherit; text-decoration: none; border-radius: 6px; }
.shelf-total:hover .shelf-total__label { color: var(--rb-primary-text); }
.shelf-total:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.shelf-total__value { font-size: 34px; font-weight: 800; line-height: 1; letter-spacing: -.03em; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.shelf-total--zero .shelf-total__value { color: var(--rb-text-muted); }
.shelf-total__label { font-size: 13px; font-weight: 600; color: var(--rb-text-secondary); }

.bars-box { width: 100%; min-width: 0; }
.bars { display: block; overflow: visible; }
.bars__base { stroke: var(--rb-border); }
.bars__col { cursor: pointer; outline: none; }
.bars__hit { fill: transparent; }
.bars__col:hover .bars__hit, .bars__col:focus-visible .bars__hit { fill: var(--rb-surface-alt); }
.bars__col:focus-visible .bars__hit { stroke: var(--rb-primary); stroke-width: 1.5; }
.bars__bar { fill: var(--rb-primary); transition: opacity .15s ease; }
.bars__col:hover .bars__bar { opacity: .82; }
.levels-link { margin-left: auto; gap: 5px; font-size: 12.5px; }
.bars__empty { fill: var(--rb-border); }
.bars__value { font-size: 11.5px; font-weight: 700; fill: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.bars__value--zero { fill: var(--rb-text-muted); }
.bars__type { font-size: 11.5px; font-weight: 600; fill: var(--rb-text-secondary); }
.bars-empty { display: grid; place-items: center; min-height: 128px; margin: 0; font-size: 13px; color: var(--rb-text-muted); }

.shelf-empty {
  display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 12px;
  border: 1px dashed var(--rb-border-strong); background: var(--rb-surface-alt);
}
.shelf-empty__icon { display: grid; flex: none; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.shelf-empty__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.shelf-empty__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.shelf-empty__hint { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.shelf-empty__actions { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 6px; }

.flags { display: flex; flex-wrap: wrap; gap: 8px; }
.flag {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 999px;
  font-size: 12.5px; font-weight: 700; text-decoration: none; transition: filter .15s ease;
}
.flag:hover { filter: brightness(.96); }
.flag:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.flag--warn { background: rgba(var(--rb-warning-rgb), .16); color: var(--rb-warning-text); }
.flag--ok { background: rgba(var(--rb-success-rgb), .12); color: var(--rb-success-text); }

.sum-tip {
  position: fixed; z-index: 50; pointer-events: none; padding: 7px 10px; border-radius: 8px;
  background: var(--rb-text-primary); color: var(--rb-surface); font-size: 12px; font-weight: 600;
  box-shadow: 0 8px 20px rgba(0, 0, 0, .18);
}

@media (max-width: 1100px) {
  .sum { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 560px) {
  .sum-req { flex-direction: column; align-items: stretch; }
  .donut { align-self: center; }
}
@media (prefers-reduced-motion: reduce) {
  .donut__arc { transition: none; }
}
</style>
