<template>
  <div class="sourcing">
    <div v-if="loading" class="sourcing__loading" aria-busy="true">
      <div v-for="n in 3" :key="n" class="sourcing__skeleton" />
    </div>

    <div v-else-if="error" class="sourcing__error" role="alert">
      <span>{{ error }}</span>
      <button type="button" class="sourcing__btn" @click="$emit('retry')">Try again</button>
    </div>

    <template v-else-if="plan">
      <p class="sourcing__advisory">
        <AssetIcon name="shield-check" :size="14" />
        <span>
          Stock as of {{ formatTime(plan.as_of) }}, earliest expiry first. Nothing is reserved until each facility
          approves its own allocation.
        </span>
      </p>

      <section v-for="line in plan.lines" :key="line.component.id" class="sourcing__line">
        <header class="sourcing__line-head">
          <h3 class="sourcing__component">
            {{ line.component.name }}
            <span class="sourcing__type">{{ plan.blood_type?.code }}</span>
          </h3>
          <button type="button" class="sourcing__link" @click="useSuggestion(line)">Use suggestion</button>
        </header>

        <div class="sourcing__totals" :class="{ 'sourcing__totals--over': totalsFor(line).over > 0 }">
          <span><strong>{{ totalsFor(line).required }}</strong> {{ mode === 'remaining' ? 'unallocated' : 'required' }}</span>
          <span><strong>{{ totalsFor(line).allocated }}</strong> allocated</span>
          <span class="sourcing__remaining">
            <strong>{{ totalsFor(line).over > 0 ? `+${totalsFor(line).over}` : totalsFor(line).remaining }}</strong>
            {{ totalsFor(line).over > 0 ? 'over' : 'remaining' }}
          </span>
          <span class="sourcing__meter" aria-hidden="true">
            <span class="sourcing__meter-fill" :style="{ width: `${meterWidth(line)}%` }" />
          </span>
        </div>

        <div class="sourcing__scroll">
          <table class="sourcing__table">
            <caption class="sr-only">Facilities to ask for {{ line.component.name }}</caption>
            <thead>
              <tr>
                <th scope="col">Facility</th>
                <th scope="col" class="num">Available</th>
                <th scope="col">Earliest expiry</th>
                <th scope="col" class="num">Suggested</th>
                <th scope="col" class="num">Request</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rowsFor(line)" :key="row.facility.id">
                <th scope="row">
                  <span class="sourcing__facility">{{ row.facility.name }}</span>
                  <span v-if="row.facility.address" class="sourcing__address">{{ row.facility.address }}</span>
                </th>
                <td class="num">{{ row.available ?? '—' }}</td>
                <td>{{ row.earliest_expiry ? formatDate(row.earliest_expiry) : '—' }}</td>
                <td class="num">{{ row.suggested ?? 0 }}</td>
                <td class="num">
                  <input
                    :id="`share-${line.component.id}-${row.facility.id}`"
                    type="number"
                    min="0"
                    max="100"
                    inputmode="numeric"
                    class="sourcing__input"
                    :aria-label="`Units of ${line.component.name} to ask ${row.facility.name} for`"
                    :value="modelValue[line.component.id]?.[row.facility.id] ?? 0"
                    @input="update(line.component.id, row.facility.id, $event.target.value)"
                  >
                </td>
              </tr>
              <tr v-if="!rowsFor(line).length">
                <td colspan="5" class="sourcing__empty">
                  No participating facility holds matching {{ line.component.name }} today. You can still ask one below;
                  it reviews the request when stock arrives.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <label v-if="addableFor(line).length" class="sourcing__add">
          <span class="sr-only">Ask another facility for {{ line.component.name }}</span>
          <select class="sourcing__select" :value="''" @change="addFacility(line, $event)">
            <option value="">Ask a facility with none listed…</option>
            <option v-for="facility in addableFor(line)" :key="facility.id" :value="facility.id">
              {{ facility.name }}
            </option>
          </select>
        </label>
      </section>

      <ul v-if="problems.length" class="sourcing__messages sourcing__messages--problem" role="alert">
        <li v-for="message in problems" :key="message">{{ message }}</li>
      </ul>
      <ul v-if="warnings.length" class="sourcing__messages" role="status">
        <li v-for="message in warnings" :key="message">{{ message }}</li>
      </ul>
    </template>
  </div>
</template>

<script setup>
/**
 * Splitting a patient's need across the blood centres that can supply it.
 *
 * The API lists centres with matching stock earliest expiry first and
 * suggests how much to ask each; staff change any quantity, and may ask a
 * centre holding none. Required / Allocated / Remaining is kept beside every
 * component, and asking for more than is required is flagged here as it is
 * refused by the server. Used for a new request and for "allocate remaining".
 */

import { computed, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import {
  allocationProblems,
  allocationTotals,
  allocationWarnings,
  fefoFill,
  setShare,
  units,
} from '~/utils/transfusionSourcing'

const props = defineProps({
  plan: { type: Object, default: null },
  /** component id → facility id → units */
  modelValue: { type: Object, default: () => ({}) },
  /** 'new' plans the whole need; 'remaining' plans only what is still unallocated. */
  mode: { type: String, default: 'new', validator: (value) => ['new', 'remaining'].includes(value) },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'retry'])

/** Centres holding none that staff chose to ask anyway, per component. */
const added = ref({})

const totals = computed(() => allocationTotals(props.plan, props.modelValue))
const problems = computed(() => allocationProblems(props.plan, props.modelValue))
const warnings = computed(() => allocationWarnings(props.plan, props.modelValue))

function totalsFor(line) {
  return totals.value.find((total) => total.componentId === line.component.id)
    ?? { required: line.quantity, allocated: 0, remaining: line.quantity, over: 0 }
}

function meterWidth(line) {
  const { required, allocated } = totalsFor(line)

  return required > 0 ? Math.min(100, Math.round((allocated / required) * 100)) : 0
}

/** Stocked centres first, in the API's order; then any centre holding none that is being asked. */
function rowsFor(line) {
  const shares = props.modelValue[line.component.id] ?? {}
  const chosen = new Set([...(added.value[line.component.id] ?? []), ...Object.keys(shares).map(Number)])

  const extra = line.other_facilities
    .filter((facility) => chosen.has(facility.id))
    .map((facility) => ({ facility, available: 0, earliest_expiry: null, suggested: 0 }))

  return [...line.facilities, ...extra]
}

function addableFor(line) {
  const shown = new Set(rowsFor(line).map((row) => row.facility.id))

  return line.other_facilities.filter((facility) => !shown.has(facility.id))
}

function addFacility(line, event) {
  const id = Number(event.target.value)

  if (!id) return

  added.value = { ...added.value, [line.component.id]: [...(added.value[line.component.id] ?? []), id] }
  event.target.value = ''
}

function update(componentId, facilityId, value) {
  emit('update:modelValue', setShare(props.modelValue, componentId, facilityId, units(value)))
}

function useSuggestion(line) {
  emit('update:modelValue', { ...props.modelValue, [line.component.id]: fefoFill(line.facilities, line.quantity) })
}

function formatDate(value) {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(value) {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? 'now' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.sourcing {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sourcing__advisory {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--rb-text-secondary);
}

.sourcing__line {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface-alt);
}

.sourcing__line-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.sourcing__component {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.sourcing__type {
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-secondary);
}

.sourcing__link {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-primary-text);
  cursor: pointer;
}

.sourcing__totals {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  font-size: 12.5px;
  color: var(--rb-text-secondary);
  font-variant-numeric: tabular-nums;
}

.sourcing__totals strong {
  font-size: 14px;
  color: var(--rb-text-primary);
}

.sourcing__totals--over .sourcing__remaining,
.sourcing__totals--over .sourcing__remaining strong {
  color: var(--rb-accent-text);
}

.sourcing__meter {
  flex: 1 1 120px;
  height: 6px;
  border-radius: 999px;
  background: var(--rb-border);
  overflow: hidden;
}

.sourcing__meter-fill {
  display: block;
  height: 100%;
  background: var(--rb-primary);
  transition: width 0.2s ease;
}

.sourcing__totals--over .sourcing__meter-fill {
  background: var(--rb-accent);
}

.sourcing__scroll {
  overflow-x: auto;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface);
}

.sourcing__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
  color: var(--rb-text-primary);
}

.sourcing__table th,
.sourcing__table td {
  padding: 0.5rem 0.7rem;
  text-align: left;
  border-bottom: 1px solid var(--rb-border);
  white-space: nowrap;
}

.sourcing__table tbody tr:last-child th,
.sourcing__table tbody tr:last-child td {
  border-bottom: none;
}

.sourcing__table thead th {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
  background: var(--rb-surface-alt);
}

.sourcing__facility {
  display: block;
  font-weight: 600;
}

.sourcing__address {
  display: block;
  max-width: 18rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--rb-text-secondary);
}

.num {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}

.sourcing__input {
  width: 4.5rem;
  padding: 6px 8px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  text-align: right;
}

.sourcing__input:focus {
  outline: none;
  border-color: var(--rb-primary);
  box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.12);
}

.sourcing__empty {
  white-space: normal !important;
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.sourcing__add {
  align-self: flex-start;
}

.sourcing__select {
  padding: 7px 10px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 12.5px;
}

.sourcing__messages {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 10px 12px 10px 28px;
  border-radius: 10px;
  background: rgba(var(--rb-warning-rgb), 0.12);
  color: var(--rb-warning-text);
  font-size: 12.5px;
  line-height: 1.45;
}

.sourcing__messages--problem {
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
}

.sourcing__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
  font-size: 13px;
}

.sourcing__btn {
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.sourcing__loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sourcing__skeleton {
  height: 56px;
  border-radius: 12px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

@media (prefers-reduced-motion: reduce) {
  .sourcing__skeleton { animation: none; }
  .sourcing__meter-fill { transition: none; }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
