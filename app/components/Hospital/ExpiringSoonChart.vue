<template>
  <!--
    Expiring soon (2026-11-26): available bags by the day they expire over the
    next 7 days, as bars, then the bags to use first. The same bags Blood
    Bank Inventory's Expiring Soon lists (available, first-expiring first).
  -->
  <div class="xs" :class="{ 'xs--compact': compact }">
    <div v-if="loading" class="xs__state" aria-busy="true"><span class="xs__sk" /></div>
    <p v-else-if="error" class="xs__state xs__state--msg" role="alert">{{ error }}</p>
    <div v-else-if="!units.length" class="xs__empty">
      <span class="xs__empty-icon" aria-hidden="true"><AssetIcon name="circle-check-big" :size="20" /></span>
      <div>
        <p class="xs__empty-title">Nothing expires in the next 7 days</p>
        <p class="xs__empty-text">No bag on your shelf runs out of date this week.</p>
      </div>
    </div>

    <template v-else>
      <!-- By day: today first -->
      <ol class="xs-days" :aria-label="`Bags expiring by day, ${units.length} in the next 7 days`">
        <li
          v-for="day in days"
          :key="day.offset"
          class="xs-day"
          :class="{ 'xs-day--zero': !day.count, 'xs-day--soon': day.offset <= 1 && day.count }"
          :title="`${day.long}: ${day.count} bag${day.count === 1 ? '' : 's'}`"
        >
          <span class="xs-day__count">{{ day.count || '' }}</span>
          <span class="xs-day__track"><span class="xs-day__bar" :style="{ height: `${day.count ? Math.max(10, (day.count / top) * 100) : 0}%` }" /></span>
          <span class="xs-day__label">{{ day.short }}</span>
        </li>
      </ol>

      <!-- The bags to use first (left out when compact: the page lists them beside) -->
      <div v-if="!compact" class="xs-first">
        <p class="xs-first__title">Use first</p>
        <ul class="xs-list">
          <li v-for="unit in units.slice(0, 4)" :key="unit.unit_id" class="xs-row">
            <span class="xs-row__type">{{ unit.blood_type?.code || '—' }}</span>
            <span class="xs-row__main">
              <span class="xs-row__name">{{ unit.component?.name || 'Component' }}</span>
              <span class="xs-row__bag">{{ unit.bag_number || unit.unit_id }}</span>
            </span>
            <span class="xs-row__when" :class="{ 'xs-row__when--soon': (unit.days_remaining ?? 9) <= 1 }">
              {{ whenOf(unit.days_remaining) }}
            </span>
          </li>
        </ul>
        <p v-if="units.length > 4" class="xs-more">and {{ units.length - 4 }} more</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { hospitalService } from '~/api/hospital/HospitalService'

defineProps({
  // Only the days, without the bags to use first (Blood Bank Inventory lists those itself).
  compact: { type: Boolean, default: false },
})

const loading = ref(true)
const error = ref('')
const units = ref([])

/** The next 7 days, today first, with how many bags expire on each. */
const days = computed(() => {
  const out = []
  const today = new Date()
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(today)
    d.setDate(today.getDate() + offset)
    out.push({
      offset,
      short: offset === 0 ? 'Today' : offset === 1 ? 'Tmrw' : d.toLocaleDateString('en-US', { weekday: 'short' }),
      long: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      count: units.value.filter((u) => (u.days_remaining ?? -1) === offset).length,
    })
  }
  return out
})
const top = computed(() => Math.max(1, ...days.value.map((d) => d.count)))

function whenOf(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return '—'
  if (daysLeft <= 0) return 'Today'
  if (daysLeft === 1) return 'Tomorrow'
  return `${daysLeft} days`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await hospitalService.inventory({ expiring_within_days: 7, sort: 'fefo', per_page: 100 })
    units.value = res?.data ?? []
  } catch (err) {
    error.value = err?.message || 'Expiring bags could not be loaded.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
defineExpose({ reload: load })
</script>

<style scoped>
.xs { display: flex; flex-direction: column; gap: 16px; padding: 4px 18px 18px; }
.xs--compact { padding: 0; }
/* Compact: the bars alone, as Blood Bank Inventory's layout draws them; each count is in its tooltip. */
.xs--compact .xs-days { align-items: end; }
.xs--compact .xs-day__count { display: none; }
.xs--compact .xs-day__track { height: 64px; max-width: 22px; background: transparent; }
.xs--compact .xs-day__bar { border-radius: 4px; }
.xs--compact .xs__state { min-height: 84px; }
.xs--compact .xs__sk { height: 80px; }
.xs__state { display: grid; place-items: center; min-height: 160px; }
.xs__state--msg { margin: 0; font-size: 13px; color: var(--rb-text-muted); }
.xs__sk { width: 100%; height: 140px; border-radius: 10px; background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%); background-size: 400% 100%; animation: xs-shimmer 1.4s ease infinite; }
@keyframes xs-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.xs__empty { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; background: rgba(var(--rb-success-rgb), .07); }
.xs__empty-icon { display: grid; flex: none; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: rgba(var(--rb-success-rgb), .14); color: var(--rb-success-text); }
.xs__empty-title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.xs__empty-text { margin: 2px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

/* By day: one amber column per day, today first; tomorrow and today stronger. */
.xs-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
.xs-day { display: flex; flex-direction: column; align-items: center; gap: 5px; min-width: 0; }
.xs-day__count { min-height: 16px; font-size: 12px; font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.xs-day__track { position: relative; display: block; width: 100%; max-width: 34px; height: 72px; border-radius: 6px; background: var(--rb-surface-alt); }
.xs-day__bar { position: absolute; inset: auto 0 0; border-radius: 6px 6px 4px 4px; background: rgba(var(--rb-warning-rgb), .55); }
.xs-day--soon .xs-day__bar { background: var(--rb-warning); }
.xs-day__label { font-size: 11.5px; font-weight: 600; color: var(--rb-text-secondary); white-space: nowrap; }
.xs-day--zero .xs-day__label { color: var(--rb-text-muted); }

.xs-first { display: flex; flex-direction: column; gap: 8px; }
.xs-first__title { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--rb-text-muted); }
.xs-list { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.xs-row { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 10px; background: var(--rb-surface-alt); }
.xs-row__type {
  display: inline-flex; justify-content: center; padding: 2px 0; border-radius: 999px;
  border: 1px solid rgba(var(--rb-accent-rgb), .35); background: rgba(var(--rb-accent-rgb), .07);
  font-size: 12px; font-weight: 700; color: var(--rb-accent-text);
}
.xs-row__main { display: flex; flex-direction: column; min-width: 0; }
.xs-row__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; color: var(--rb-text-primary); }
.xs-row__bag { font-family: var(--rb-font-mono, ui-monospace, monospace); font-size: 11.5px; color: var(--rb-text-muted); }
.xs-row__when { padding: 2px 9px; border-radius: 999px; background: rgba(var(--rb-warning-rgb), .14); color: var(--rb-warning-text); font-size: 12px; font-weight: 700; white-space: nowrap; }
.xs-row__when--soon { background: rgba(var(--rb-accent-rgb), .12); color: var(--rb-accent-text); }
.xs-more { margin: 0; font-size: 12px; color: var(--rb-text-muted); }

@media (prefers-reduced-motion: reduce) { .xs__sk { animation: none; } }
</style>
