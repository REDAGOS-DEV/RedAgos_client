<template>
  <!--
    The top of Blood Bank Inventory as three chart cards (project owner,
    2026-11-27, option A): the shelf by blood type, where the bags stand, and
    what expires this week. Each one filters the list below, as the figures
    and type cards it replaces did.
  -->
  <div class="ov">
    <!-- ON THE SHELF BY BLOOD TYPE -->
    <section class="ov-card ov-card--shelf" aria-labelledby="ov-shelf">
      <header class="ov-card__head">
        <h2 id="ov-shelf" class="ov-card__title">On the shelf by blood type</h2>
        <NuxtLink to="/hospital/stock-thresholds" class="ov-link">{{ anyLevelSet ? 'Stock levels' : 'Set levels' }} <AssetIcon name="chevron-right" :size="14" /></NuxtLink>
      </header>

      <div class="ov-total">
        <span class="ov-total__value">{{ loading ? '–' : shelfTotal }}</span>
        <span class="ov-total__label">unit{{ shelfTotal === 1 ? '' : 's' }} available</span>
        <span v-if="selectedType" class="ov-filter">
          Showing {{ selectedType.code }}
          <button type="button" class="ov-filter__clear" :aria-label="`Stop filtering by ${selectedType.code}`" @click="$emit('select-type', selectedType)">
            <AssetIcon name="x" :size="12" />
          </button>
        </span>
      </div>

      <div ref="barsBox" class="ov-bars-box">
        <svg v-if="typeBars.length" :width="barsWidth" :height="BARS_H" class="ov-bars" role="group" aria-label="Available units by blood type. Choose a type to filter the list.">
          <line x1="0" :x2="barsWidth" :y1="BASE" :y2="BASE" class="ov-bars__base" />
          <g
            v-for="(bar, i) in typeBars"
            :key="bar.id"
            class="ov-bars__col"
            :class="{ 'ov-bars__col--on': selectedTypeId === bar.id, 'ov-bars__col--dim': selectedTypeId && selectedTypeId !== bar.id }"
            role="button"
            tabindex="0"
            :aria-pressed="selectedTypeId === bar.id"
            :aria-label="`${bar.code}: ${bar.value} unit${bar.value === 1 ? '' : 's'}${bar.level === 'critical' ? ', out of stock, under its critical level' : bar.level === 'low' ? ', below its critical level' : ''}. Filter the list by ${bar.code}`"
            @click="$emit('select-type', bar)"
            @keydown.enter.prevent="$emit('select-type', bar)"
            @keydown.space.prevent="$emit('select-type', bar)"
            @mousemove="showTip($event, `${bar.code}: ${bar.value} unit${bar.value === 1 ? '' : 's'}${bar.level === 'critical' ? ' · out of stock, under critical' : bar.level === 'low' ? ' · below critical' : ''}`)"
            @mouseleave="hideTip"
          >
            <rect :x="i * slot + 2" y="0" :width="slot - 4" :height="BARS_H" rx="8" class="ov-bars__hit" />
            <rect v-if="bar.value" :x="barX(i)" :y="barTop(bar.value)" :width="barW" :height="BASE - barTop(bar.value)" rx="4" class="ov-bars__bar" :class="`ov-bars__bar--${bar.level}`" />
            <rect v-else :x="barX(i)" :y="BASE - 2" :width="barW" height="2" rx="1" class="ov-bars__empty" />
            <text :x="barX(i) + barW / 2" :y="barTop(bar.value) - 6" text-anchor="middle" class="ov-bars__value" :class="{ 'ov-bars__value--zero': !bar.value }">{{ bar.value }}</text>
            <text :x="barX(i) + barW / 2" :y="BARS_H - 5" text-anchor="middle" class="ov-bars__type">{{ bar.code }}</text>
          </g>
        </svg>
        <p v-else class="ov-empty">{{ loading ? 'Reading your shelf…' : 'Your shelf could not be read.' }}</p>
      </div>

    </section>

    <!-- WHERE THE BAGS STAND -->
    <section class="ov-card" aria-labelledby="ov-status">
      <header class="ov-card__head">
        <h2 id="ov-status" class="ov-card__title">Where bags stand</h2>
      </header>
      <div class="ov-status">
        <svg class="ov-donut" viewBox="0 0 100 100" role="img" :aria-label="donutLabel">
          <circle cx="50" cy="50" :r="R" class="ov-donut__track" stroke-width="12" />
          <template v-if="!loading">
            <circle
              v-for="arc in arcs"
              :key="arc.value"
              cx="50"
              cy="50"
              :r="R"
              fill="none"
              :stroke="arc.color"
              stroke-width="12"
              :stroke-dasharray="`${arc.len} ${CIRC}`"
              :stroke-dashoffset="-arc.offset"
              transform="rotate(-90 50 50)"
              @mousemove="showTip($event, `${arc.label}: ${arc.count}`)"
              @mouseleave="hideTip"
            />
          </template>
          <text x="50" y="49" text-anchor="middle" class="ov-donut__total">{{ loading ? '–' : statusTotal }}</text>
          <text x="50" y="62" text-anchor="middle" class="ov-donut__sub">bag{{ statusTotal === 1 ? '' : 's' }}</text>
        </svg>
        <ul class="ov-legend">
          <li v-for="item in statusItems" :key="item.value">
            <button
              type="button"
              class="ov-legend__row"
              :class="{ 'ov-legend__row--on': selectedStatus === item.value, 'ov-legend__row--zero': !loading && !item.count }"
              :aria-pressed="selectedStatus === item.value"
              @click="$emit('select-status', item.value)"
            >
              <span class="ov-legend__sw" :style="{ background: item.color }" aria-hidden="true" />
              {{ item.label }}
              <strong class="ov-legend__count">{{ loading ? '–' : item.count }}</strong>
            </button>
          </li>
        </ul>
      </div>
    </section>

    <!-- EXPIRING THIS WEEK -->
    <section class="ov-card" aria-labelledby="ov-expiring">
      <header class="ov-card__head">
        <h2 id="ov-expiring" class="ov-card__title">Expiring this week</h2>
        <button type="button" class="ov-link" @click="$emit('show-expiring')">View all <AssetIcon name="chevron-right" :size="14" /></button>
      </header>
      <HospitalExpiringSoonChart ref="expiring" compact />
    </section>

    <div v-if="tip.text" class="ov-tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }" role="status">{{ tip.text }}</div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import HospitalExpiringSoonChart from '~/components/Hospital/ExpiringSoonChart.vue'

const props = defineProps({
  loading: { type: Boolean, default: false },
  // The stock thresholds payload: blood types, and each cell's available units and level.
  thresholds: { type: Object, default: null },
  // The inventory summary's counts per status.
  totals: { type: Object, default: () => ({}) },
  selectedTypeId: { type: [Number, String], default: '' },
  selectedStatus: { type: String, default: '' },
})
defineEmits(['select-type', 'select-status', 'show-expiring'])

// ── Shelf by blood type ──
const BARS_H = 92
const BASE = BARS_H - 22
const barsBox = ref(null)
const barsWidth = ref(420)

/**
 * Each type's available units, and its worst level among its components:
 * critical is a component out of stock under its critical level (red), low is
 * one below its critical level with some left (amber).
 */
const typeBars = computed(() => {
  const cells = props.thresholds?.cells ?? []
  return (props.thresholds?.blood_types ?? []).map((type) => {
    const own = cells.filter((cell) => cell.blood_type_id === type.id)
    const level = own.some((c) => c.status === 'critical') ? 'critical' : own.some((c) => c.status === 'low') ? 'low' : 'ok'
    return { id: type.id, code: type.code, value: own.reduce((n, c) => n + (c.available || 0), 0), level }
  })
})
const shelfTotal = computed(() => typeBars.value.reduce((n, b) => n + b.value, 0))
const anyLevelSet = computed(() => (props.thresholds?.cells ?? []).some((cell) => cell.minimum_units !== null))
const selectedType = computed(() => typeBars.value.find((b) => b.id === props.selectedTypeId) ?? null)

const topValue = computed(() => Math.max(1, ...typeBars.value.map((b) => b.value)))
const slot = computed(() => barsWidth.value / Math.max(1, typeBars.value.length))
const barW = computed(() => Math.min(30, slot.value * 0.55))
const barX = (i) => i * slot.value + (slot.value - barW.value) / 2
const barTop = (value) => BASE - (value / topValue.value) * (BASE - 20)

// ── Where the bags stand ──
const R = 40
const CIRC = 2 * Math.PI * R
const statusItems = computed(() => {
  const n = (key) => Number(props.totals?.[key]) || 0
  return [
    { value: 'available', label: 'Available', count: n('available'), color: 'var(--rb-success)' },
    { value: 'tagged', label: 'Tagged', count: n('tag_assigned') + n('tag_crossmatched'), color: 'var(--rb-primary)' },
    { value: 'pending_return', label: 'Pending return', count: n('pending_return'), color: 'var(--rb-warning)' },
    { value: 'received', label: 'To stock in', count: n('received'), color: 'var(--rb-purple, #7C3AED)' },
  ]
})
const statusTotal = computed(() => statusItems.value.reduce((n, i) => n + i.count, 0))
const arcs = computed(() => {
  const total = statusTotal.value
  if (!total) return []
  const shown = statusItems.value.filter((i) => i.count > 0)
  let offset = 0
  return shown.map((i) => {
    const full = (i.count / total) * CIRC
    const arc = { ...i, len: shown.length > 1 ? Math.max(0, full - 2) : full, offset }
    offset += full
    return arc
  })
})
const donutLabel = computed(() => `Bags by status: ${statusItems.value.map((i) => `${i.count} ${i.label.toLowerCase()}`).join(', ')}`)

// ── Tooltip and width ──
const tip = reactive({ text: '', x: 0, y: 0 })
function showTip(event, text) { tip.text = text; tip.x = event.clientX + 12; tip.y = event.clientY + 12 }
function hideTip() { tip.text = '' }

let observer = null
function measure() { if (barsBox.value) barsWidth.value = Math.max(240, barsBox.value.clientWidth) }
onMounted(() => {
  observer = new ResizeObserver(measure)
  if (barsBox.value) observer.observe(barsBox.value)
  measure()
})
onBeforeUnmount(() => observer?.disconnect())

const expiring = ref(null)
defineExpose({ reload: () => expiring.value?.reload() })
</script>

<style scoped>
/* The three cards as the chosen preview draws them (2026-11-27): 1.6 : 1 : 1. */
.ov { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
.ov-card {
  display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 14px 16px 12px;
  border: 1px solid var(--rb-border); border-radius: 14px;
  background: var(--rb-surface); box-shadow: var(--rb-shadow-sm);
}
.ov-card__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ov-card__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.ov-link {
  display: inline-flex; align-items: center; gap: 2px; flex: none; padding: 0; border: 0; background: none; cursor: pointer;
  font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text); text-decoration: none;
}
.ov-link:hover { text-decoration: underline; }
.ov-link:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 4px; }

/* Shelf */
.ov-total { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
.ov-total__value { font-size: 24px; font-weight: 800; line-height: 1.1; letter-spacing: -.03em; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.ov-total__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); }
.ov-filter {
  display: inline-flex; align-items: center; gap: 4px; margin-left: auto; padding: 2px 4px 2px 10px; border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); font-size: 12px; font-weight: 700;
}
.ov-filter__clear { display: grid; place-items: center; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 999px; background: none; color: inherit; cursor: pointer; }
.ov-filter__clear:hover { background: rgba(var(--rb-primary-rgb), .16); }

.ov-bars-box { width: 100%; min-width: 0; }
.ov-bars { display: block; overflow: visible; }
.ov-bars__base { stroke: var(--rb-border); }
.ov-bars__col { cursor: pointer; outline: none; }
.ov-bars__hit { fill: transparent; }
.ov-bars__col:hover .ov-bars__hit { fill: var(--rb-surface-alt); }
.ov-bars__col:focus-visible .ov-bars__hit { fill: var(--rb-surface-alt); stroke: var(--rb-primary); stroke-width: 1.5; }
.ov-bars__col--on .ov-bars__hit { fill: rgba(var(--rb-primary-rgb), .08); }
.ov-bars__col--dim .ov-bars__bar { opacity: .35; }
.ov-bars__bar { fill: var(--rb-primary); transition: opacity .15s ease; }
.ov-bars__bar--low { fill: var(--rb-warning); }
.ov-bars__bar--critical { fill: var(--rb-accent); }
.ov-bars__empty { fill: var(--rb-border); }
.ov-bars__value { font-size: 11.5px; font-weight: 700; fill: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.ov-bars__value--zero { fill: var(--rb-text-muted); }
.ov-bars__type { font-size: 11.5px; font-weight: 600; fill: var(--rb-text-secondary); }
.ov-empty { display: grid; place-items: center; min-height: 92px; margin: 0; font-size: 13px; color: var(--rb-text-muted); }


/* Status donut */
.ov-status { display: flex; align-items: center; gap: 16px; flex: 1; }
.ov-donut { flex: none; width: 88px; height: 88px; }
.ov-donut__track { fill: none; stroke: var(--rb-surface-alt); }
.ov-donut__total { font-size: 18px; font-weight: 800; fill: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.ov-donut__sub { font-size: 8px; font-weight: 600; fill: var(--rb-text-secondary); }
.ov-legend { display: flex; flex: 1; flex-direction: column; gap: 3px; min-width: 0; margin: 0; padding: 0; list-style: none; }
.ov-legend__row {
  display: inline-flex; align-items: center; gap: 8px; max-width: 100%;
  padding: 2px 6px; margin-left: -6px; border: 1px solid transparent; border-radius: 6px; background: none;
  font: inherit; font-size: 12.5px; font-weight: 500; text-align: left; color: var(--rb-text-primary); cursor: pointer;
  transition: background-color .15s ease;
}
.ov-legend__row:hover { background: var(--rb-surface-alt); }
.ov-legend__row:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.ov-legend__row--on { border-color: rgba(var(--rb-primary-rgb), .4); background: rgba(var(--rb-primary-rgb), .07); }
.ov-legend__sw { width: 9px; height: 9px; flex: none; border-radius: 3px; }
.ov-legend__count { font-size: 12.5px; font-weight: 800; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.ov-legend__row--zero .ov-legend__count { color: var(--rb-text-muted); }
.ov-legend__row--zero .ov-legend__sw { opacity: .4; }

.ov-tip {
  position: fixed; z-index: 50; pointer-events: none; padding: 7px 10px; border-radius: 8px;
  background: var(--rb-text-primary); color: var(--rb-surface); font-size: 12px; font-weight: 600;
  box-shadow: 0 8px 20px rgba(0, 0, 0, .18);
}

/* The preview's row of three holds down to 900px; then two, then one. */
@container inv (max-width: 900px) {
  .ov { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ov-card--shelf { grid-column: 1 / -1; }
}
@container inv (max-width: 640px) {
  .ov { grid-template-columns: minmax(0, 1fr); }
  .ov-status { flex-direction: column; align-items: stretch; }
  .ov-donut { align-self: center; }
}
</style>
