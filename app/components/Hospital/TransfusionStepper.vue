<template>
  <!--
    The request's four steps with when each happened (2026-11-26). Dots and
    line as the History timeline draws them, in the list row's colours: green
    done, blue now, amber when this blood bank has to act, red when stopped.
  -->
  <ol class="stepper" :aria-label="`Progress: ${summary}`">
    <li
      v-for="(step, i) in TRANSFUSION_STEPS"
      :key="step"
      class="stepper__row"
      :class="`stepper__row--${stateOf(i)}`"
      :aria-current="stateOf(i) === 'current' || stateOf(i) === 'action' ? 'step' : undefined"
    >
      <span class="stepper__rail" aria-hidden="true">
        <span class="stepper__dot">
          <AssetIcon v-if="stateOf(i) === 'done'" name="check" :size="12" />
        </span>
        <span v-if="i < TRANSFUSION_STEPS.length - 1 || halted" class="stepper__line" />
      </span>
      <span class="stepper__body">
        <span class="stepper__label">
          {{ step }}
          <span v-if="stateOf(i) === 'action'" class="stepper__note">· your turn</span>
        </span>
        <time v-if="timeOf(i)" class="stepper__time" :datetime="timeOf(i)" :title="formatDateTime(timeOf(i))">
          {{ formatDateTime(timeOf(i)) }} · {{ sinceShort(timeOf(i), now) }}
        </time>
      </span>
    </li>

    <li v-if="halted" class="stepper__row stepper__row--halted">
      <span class="stepper__rail" aria-hidden="true">
        <span class="stepper__dot"><AssetIcon name="x" :size="12" /></span>
      </span>
      <span class="stepper__body">
        <span class="stepper__label">{{ request.status === 'cancelled' ? 'Cancelled' : 'Rejected' }}</span>
        <time v-if="haltedAt" class="stepper__time" :datetime="haltedAt">{{ formatDateTime(haltedAt) }} · {{ sinceShort(haltedAt, now) }}</time>
      </span>
    </li>
  </ol>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import {
  STEP_TIME_KEYS,
  TRANSFUSION_STEPS,
  awaitingReceipt,
  isHaltedStatus,
  sinceShort,
  transfusionStepIndex,
} from '~/utils/transfusionSteps'

const props = defineProps({
  // The request as the API sends it: status, is_open, totals, cancelled_at, closed_at.
  request: { type: Object, required: true },
  // { submitted, approved, released, received }, ISO strings or null.
  times: { type: Object, default: () => ({}) },
  // Passed in by a page whose clock already ticks, so every "ago" agrees.
  now: { type: Number, default: () => Date.now() },
})

const halted = computed(() => isHaltedStatus(props.request.status))
const index = computed(() => transfusionStepIndex(props.request))
const haltedAt = computed(() => props.request.cancelled_at ?? props.request.closed_at ?? null)

function stateOf(i) {
  if (halted.value) return i === 0 ? 'done' : 'todo'
  if (i < index.value) return 'done'
  if (i === index.value) return awaitingReceipt(props.request) > 0 ? 'action' : 'current'
  return 'todo'
}

/** A step's time, shown once it has happened (or, for the step now, when it began). */
function timeOf(i) {
  if (stateOf(i) === 'todo') return null
  // Waiting at Received dates from the release, which the row above shows.
  if (stateOf(i) === 'action') return null

  return props.times?.[STEP_TIME_KEYS[i]] ?? null
}

const summary = computed(() => {
  if (halted.value) return props.request.status === 'cancelled' ? 'Cancelled' : 'Rejected'
  if (index.value >= TRANSFUSION_STEPS.length) return 'Complete'

  return `Step ${index.value + 1} of ${TRANSFUSION_STEPS.length}, ${TRANSFUSION_STEPS[index.value]}`
})

function formatDateTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>

<style scoped>
.stepper { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.stepper__row { --tone: var(--rb-border-strong); --tone-bg: var(--rb-surface-alt); display: flex; gap: 12px; }
.stepper__row--done { --tone: var(--rb-success); --tone-bg: var(--rb-success); }
.stepper__row--current { --tone: var(--rb-primary); --tone-bg: rgba(var(--rb-primary-rgb), 0.14); }
.stepper__row--action { --tone: var(--rb-warning); --tone-bg: rgba(var(--rb-warning-rgb), 0.16); }
.stepper__row--halted { --tone: var(--rb-accent); --tone-bg: var(--rb-accent); }

.stepper__rail { display: flex; flex-direction: column; align-items: center; width: 24px; flex-shrink: 0; }
.stepper__dot {
  width: 24px; height: 24px; border-radius: 999px; flex-shrink: 0;
  display: grid; place-items: center;
  border: 2px solid var(--tone); background: var(--tone-bg); color: #FFFFFF;
}
.stepper__row--todo .stepper__dot { background: var(--rb-surface); border-color: var(--rb-border-strong); }
.stepper__line { flex: 1; width: 2px; min-height: 16px; margin: 2px 0; background: var(--rb-border); }
.stepper__row--done .stepper__line { background: var(--rb-success); }

.stepper__body { display: flex; flex-direction: column; gap: 2px; padding: 2px 0 16px; min-width: 0; }
.stepper__row:last-child .stepper__body { padding-bottom: 0; }
.stepper__label { font-size: 13.5px; font-weight: 600; color: var(--rb-text-primary); }
.stepper__row--todo .stepper__label { font-weight: 500; color: var(--rb-text-muted); }
.stepper__note { font-weight: 700; color: var(--rb-warning-text); }
.stepper__time { font-size: 11.5px; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }
</style>
