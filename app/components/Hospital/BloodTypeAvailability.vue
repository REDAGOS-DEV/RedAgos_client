<template>
  <!--
    The blood bank's shelf by blood type: a ring for how much of each type's
    critical level is on the shelf, a bar per component with a tick at its
    level. Each card opens Blood Bank Inventory on that type. Moved from the
    inventory page to the dashboard (project owner, 2026-10-28).
  -->
  <SectionCard
    class="bta"
    title="Blood Type Availability"
    subtitle="Bags free to tag against the critical level: the ring for the type, the tick on each bar for a component."
  >
    <template #actions>
      <ul class="legend" aria-label="Legend">
        <li class="tone--success"><span class="legend__dot" />Healthy</li>
        <li class="tone--warning"><span class="legend__dot" />Low Stock</li>
        <li class="tone--danger"><span class="legend__dot" />Critical</li>
        <li><span class="rare-chip">Rare</span>Rh-negative</li>
      </ul>
    </template>

    <p v-if="!anyMinimumSet" class="types-hint">
      <AssetIcon name="info" :size="14" />
      <span>No critical level is set yet, so no type is graded.</span>
      <NuxtLink to="/hospital/stock-thresholds" class="link-btn">Set levels</NuxtLink>
    </p>

    <div class="type-grid">
      <NuxtLink
        v-for="card in typeCards"
        :key="card.code"
        :to="`/hospital/inventory?blood_type_id=${card.id}`"
        class="type-card"
        :class="[`tone--${levelTone(card.level)}`, `type-card--${card.level}`]"
        :aria-label="typeCardLabel(card)"
      >
        <span class="type-card__head">
          <span class="type-card__code">{{ displayType(card.code) }}</span>
          <span v-if="card.rare" class="rare-chip">Rare</span>
        </span>

        <span class="type-card__body">
          <span class="type-card__summary">
            <span class="gauge" :title="ringTitle(card)">
              <svg viewBox="0 0 64 64" class="gauge__svg" aria-hidden="true">
                <circle class="gauge__track" cx="32" cy="32" r="26" />
                <circle
                  v-if="card.coverage"
                  class="gauge__fill"
                  cx="32"
                  cy="32"
                  r="26"
                  :stroke-dasharray="ringDash(card.coverage)"
                />
              </svg>
              <span class="gauge__value">{{ card.coverage === null ? '—' : `${card.coverage}%` }}</span>
            </span>
            <span class="type-card__units"><strong>{{ formatCount(card.total) }}</strong> unit{{ card.total === 1 ? '' : 's' }}</span>
            <span class="badge">
              <span class="badge__dot" aria-hidden="true" />
              {{ levelLabel(card.level) }}
            </span>
          </span>

          <span class="type-card__components">
            <span
              v-for="comp in card.components"
              :key="comp.id"
              class="comp"
              :class="{ 'comp--short': comp.status === 'low' || comp.status === 'critical', [`tone--${levelTone(comp.status)}`]: true }"
              :title="componentTitle(comp)"
            >
              <span class="comp__code">{{ comp.code }}</span>
              <!-- On the shelf against the most any type holds of it; the tick is the critical level. -->
              <span class="comp__meter" aria-hidden="true">
                <span class="comp__fill" :style="{ width: `${compWidth(comp, comp.available)}%` }" />
                <span v-if="comp.minimum" class="comp__min" :style="{ left: `${compWidth(comp, comp.minimum)}%` }" />
              </span>
              <span class="comp__count">{{ formatCount(comp.available) }}</span>
            </span>
          </span>
        </span>
      </NuxtLink>
    </div>
  </SectionCard>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import SectionCard from '~/components/ui/SectionCard.vue'
import { typeHealthByCode } from '~/utils/stockThreshold'
import { isRareBloodType, orderDashboardTypes, typeCoverage } from '~/utils/inventoryDashboard'

const props = defineProps({
  /** The blood bank's threshold status (`hospitalService.stockThresholds()`); null until it loads. */
  thresholds: { type: Object, default: null },
})

const cells = computed(() => props.thresholds?.cells ?? [])

const anyMinimumSet = computed(() => cells.value.some((cell) => cell.minimum_units !== null))

const typeCards = computed(() => {
  const types = orderDashboardTypes(props.thresholds?.blood_types ?? [])
  // Catalogue order, Whole Blood first, rather than the server's by-name order.
  const components = [...(props.thresholds?.components ?? [])].sort((a, b) => a.id - b.id)

  return types.map(({ id, code }) => {
    const own = cells.value.filter((cell) => cell.blood_type_id === id)

    return {
      id,
      code,
      rare: isRareBloodType(code),
      // "Low" is the blood bank's own judgement: a type is graded against the
      // minimums staff set on the Stock Thresholds page, and the worst
      // monitored component decides. A type with no minimum is not graded.
      level: typeHealthByCode(cells.value, code),
      coverage: typeCoverage(cells.value, id),
      total: own.reduce((sum, cell) => sum + cell.available, 0),
      components: components.map((component) => {
        const cell = own.find((c) => c.component_id === component.id)
        return {
          id: component.id,
          code: component.code,
          name: component.name,
          available: cell?.available ?? 0,
          minimum: cell?.minimum_units ?? null,
          status: cell?.status ?? 'unmonitored',
        }
      }),
    }
  })
})

// Each component's meter shares one scale across the types, so a short
// shelf reads short beside the others: the most any type holds, or its
// critical level if that is more.
const compScale = computed(() => {
  const scale = new Map()
  for (const cell of cells.value) {
    const top = Math.max(cell.available, cell.minimum_units ?? 0)
    scale.set(cell.component_id, Math.max(scale.get(cell.component_id) ?? 1, top))
  }
  return scale
})
const compWidth = (comp, n) => Math.min(100, ((n || 0) / (compScale.value.get(comp.id) ?? 1)) * 100)

const LEVELS = {
  ok: { label: 'Good Stock', tone: 'success' },
  low: { label: 'Low Stock', tone: 'warning' },
  critical: { label: 'Critical Low', tone: 'danger' },
  unmonitored: { label: 'No level set', tone: 'muted' },
}
const levelLabel = (level) => LEVELS[level]?.label ?? level
const levelTone = (level) => LEVELS[level]?.tone ?? 'muted'

const RING_CIRCUMFERENCE = 2 * Math.PI * 26
function ringDash(coverage) {
  const filled = (Math.min(100, Math.max(0, coverage)) / 100) * RING_CIRCUMFERENCE
  return `${filled.toFixed(2)} ${RING_CIRCUMFERENCE.toFixed(2)}`
}

function ringTitle(card) {
  return card.coverage === null
    ? `No critical level is set for ${card.code}.`
    : `${card.coverage}% of ${card.code}'s critical level is on the shelf.`
}

function componentTitle(comp) {
  return comp.minimum === null
    ? `${comp.name}: ${comp.available} free to tag, no critical level set`
    : `${comp.name}: ${comp.available} free to tag, critical level ${comp.minimum}`
}

function typeCardLabel(card) {
  const coverage = card.coverage === null ? 'no critical level set' : `${card.coverage}% of critical level on the shelf`
  return `${card.code}${card.rare ? ', rare' : ''}: ${card.total} unit${card.total === 1 ? '' : 's'} free to tag, ${levelLabel(card.level)}, ${coverage}. Open its bags in Blood Bank Inventory.`
}

function displayType(code) {
  // A true minus sign, which reads as "minus" aloud and lines up with the plus.
  return code ? String(code).replace('-', '−') : '—'
}

function formatCount(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return Number(value).toLocaleString('en-US')
}
</script>

<style scoped>
/* The centre's Blood Inventory cards: one surface, three greys of ink, and
   green, amber and red for state alone, on dots, rings, bars and text. The
   dark selector sits whole inside :global(), so the tokens never land on <html>. */
.bta {
  --bta-border: var(--rb-border-strong);
  --bta-border-soft: var(--rb-border);
  --bta-elevated: var(--rb-surface-alt);
  --bta-text: var(--rb-text-primary);
  --bta-muted: var(--rb-text-secondary);
  --bta-faint: var(--rb-text-muted);
  --bta-ok: #15803D;
  --bta-warn: #B45309;
  --bta-crit: #B91C1C;
  --bta-ok-fill: #1BAF7A;
  --bta-warn-fill: #EDA100;
  --bta-crit-fill: #DC2626;
  --tone: var(--bta-muted);
  --tone-fill: var(--bta-faint);
  container-type: inline-size;
  container-name: bta;
}
:global(.dark .bta) {
  --bta-border-soft: var(--ink-hover, #263345);
  --bta-ok: #4ADE80;
  --bta-warn: #FBBF24;
  --bta-crit: #F87171;
  --bta-ok-fill: #199E70;
  --bta-warn-fill: #C98500;
  --bta-crit-fill: #EF4444;
}
.tone--success { --tone: var(--bta-ok); --tone-fill: var(--bta-ok-fill); }
.tone--warning { --tone: var(--bta-warn); --tone-fill: var(--bta-warn-fill); }
.tone--danger { --tone: var(--bta-crit); --tone-fill: var(--bta-crit-fill); }
.tone--muted { --tone: var(--bta-faint); --tone-fill: var(--bta-faint); }

.legend { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 14px; margin: 0; padding: 0; list-style: none; }
.legend li { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--bta-muted); white-space: nowrap; }
.legend__dot { width: 7px; height: 7px; border-radius: 999px; background: var(--tone-fill); }

.types-hint {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 12px; padding: 9px 12px; border-radius: 8px;
  border: 1px dashed var(--bta-border); font-size: 12.5px; color: var(--bta-muted);
}
.link-btn { font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text); text-decoration: none; }
.link-btn:hover { text-decoration: underline; text-underline-offset: 3px; }

.rare-chip {
  font-size: 9.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; line-height: 1;
  padding: 3px 5px; border-radius: 4px; border: 1px solid var(--bta-border); color: var(--bta-muted);
}

.type-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.type-card {
  position: relative; overflow: hidden;
  display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 12px 14px 14px; border-radius: 10px;
  border: 1px solid var(--bta-border); background: var(--rb-surface);
  color: var(--bta-text); text-decoration: none;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.type-card:hover { border-color: rgba(var(--rb-primary-rgb), 0.45); background: var(--rb-surface-hover); }
.type-card:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
/* A short type is marked along its top edge: the exception, not the rule. */
.type-card--low::before, .type-card--critical::before { content: ''; position: absolute; inset: 0 0 auto; height: 3px; background: var(--tone-fill); }
.type-card__head { display: flex; align-items: center; gap: 8px; }
.type-card__code { font-size: 17px; font-weight: 700; color: var(--bta-text); }
.type-card__body { display: flex; gap: 12px; align-items: flex-start; }
.type-card__summary { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; flex-shrink: 0; }
.type-card__units { font-size: 12px; color: var(--bta-muted); white-space: nowrap; }
.type-card__units strong { font-size: 13px; font-weight: 600; color: var(--bta-text); font-variant-numeric: tabular-nums; }

/* The ring is a meter (named gauge: Tailwind's `ring` utility owns .ring).
   Its fill is the one coloured mark on the card, over a neutral track. */
.gauge { position: relative; width: 62px; height: 62px; display: inline-flex; }
.gauge__svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.gauge__track { fill: none; stroke: var(--bta-border); stroke-width: 6; }
.gauge__fill { fill: none; stroke: var(--tone-fill); stroke-width: 6; stroke-linecap: round; transition: stroke-dasharray 0.4s ease; }
.gauge__value {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 12.5px; font-weight: 600; color: var(--bta-text); font-variant-numeric: tabular-nums;
}

/* Badge: a tint of the state, the ungraded one left grey. */
.badge {
  display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  border: 1px solid color-mix(in srgb, var(--tone-fill) 30%, transparent); background: color-mix(in srgb, var(--tone-fill) 10%, transparent);
  font-size: 11.5px; font-weight: 500; line-height: 1.5; color: var(--bta-text);
}
.type-card.tone--muted .badge { border-color: var(--bta-border); background: var(--bta-elevated); }
.badge__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--tone-fill); flex-shrink: 0; }

.type-card__components { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; padding-top: 2px; }
.comp { display: grid; grid-template-columns: 34px minmax(0, 1fr) 22px; align-items: center; gap: 8px; font-size: 11.5px; line-height: 1.35; }
.comp__code { color: var(--bta-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* A meter: grey while ungraded, the state colour once graded. */
.comp__meter { position: relative; height: 6px; border-radius: 999px; background: var(--bta-elevated); box-shadow: inset 0 0 0 1px var(--bta-border-soft); }
.comp__fill { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: color-mix(in srgb, var(--bta-muted) 55%, transparent); transition: width 0.4s ease; }
.comp.tone--success .comp__fill { background: var(--bta-ok-fill); }
.comp--short .comp__fill { background: var(--tone-fill); }
.comp__min { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; border-radius: 1px; background: var(--bta-text); opacity: 0.55; }
.comp__count { color: var(--bta-text); font-variant-numeric: tabular-nums; text-align: right; }
.comp--short .comp__count { font-weight: 600; color: var(--tone); }

@media (prefers-reduced-motion: reduce) {
  .gauge__fill, .comp__fill, .type-card { transition: none; }
}

/* By the width the card actually has. */
@container bta (max-width: 880px) {
  .type-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container bta (max-width: 440px) {
  .type-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
