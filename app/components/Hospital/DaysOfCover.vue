<template>
  <!--
    Days of cover (project owner, 2026-11-27): how long each blood type lasts
    at this blood bank's own rate of use over the last four weeks. A plain
    projection from its history; the capstone rules out predictive models.
  -->
  <section class="cover" aria-labelledby="cover-title">
    <header class="cover__head">
      <div class="cover__heading">
        <span class="cover__icon" aria-hidden="true"><AssetIcon name="calendar" :size="16" /></span>
        <div>
          <h2 id="cover-title" class="cover__title">Days of cover</h2>
          <p class="cover__sub">How long each type lasts at your rate of use over the last {{ weeks }} weeks.</p>
        </div>
      </div>

      <div v-if="components.length > 1" class="cover__tabs" role="group" aria-label="Component">
        <button
          v-for="c in components"
          :key="c.id"
          type="button"
          class="cover__tab"
          :class="{ 'cover__tab--on': c.id === componentId }"
          :aria-pressed="c.id === componentId"
          :title="c.name || ''"
          @click="componentId = c.id"
        >
          {{ c.code || c.name }}
        </button>
      </div>
    </header>

    <p v-if="error" class="cover__error" role="alert">
      {{ error }}
      <button type="button" class="cover__retry" @click="load">Try again</button>
    </p>

    <div v-else-if="loading && !rows.length" class="cover__list" aria-hidden="true">
      <div v-for="n in 4" :key="n" class="cover__row"><span class="sk sk--line" style="width: 100%" /></div>
    </div>

    <p v-else-if="!rows.length" class="cover__empty">
      Nothing on the shelf and nothing used in the last {{ weeks }} weeks, so there is nothing to project yet.
    </p>

    <table v-else class="cover__table">
      <caption class="sr-only">Days of cover for {{ currentComponentName }}, shortest first</caption>
      <thead class="sr-only">
        <tr><th scope="col">Blood type</th><th scope="col">Days of cover</th><th scope="col">On the shelf and use</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in visible" :key="row.blood_type.id" class="cover__row" :class="`cover__row--${toneOf(row)}`">
          <th scope="row"><span class="cover__type">{{ row.blood_type.code }}</span></th>
          <td class="cover__bar-cell">
            <span class="cover__bar">
              <span class="cover__track" aria-hidden="true">
                <span v-if="row.days_left !== null" class="cover__fill" :style="{ width: `${barWidth(row)}%` }" />
              </span>
              <span class="cover__days">
                <AssetIcon v-if="toneOf(row) === 'short' || toneOf(row) === 'watch'" :name="toneOf(row) === 'short' ? 'circle-alert' : 'clock'" :size="13" />
                {{ daysLabel(row) }}
              </span>
            </span>
          </td>
          <td class="cover__meta">
            <strong>{{ row.available }}</strong> on the shelf
            <template v-if="row.used"> · {{ perDayLabel(row) }}</template>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="rows.length" class="cover__key">
      <span class="cover__key-item cover__key-item--short"><AssetIcon name="circle-alert" :size="12" /> {{ SHORT_DAYS }} days or less</span>
      <span class="cover__key-item cover__key-item--watch"><AssetIcon name="clock" :size="12" /> {{ WATCH_DAYS }} days or less</span>
      <span class="cover__key-item">Bars stop at {{ CAP_DAYS }} days</span>
    </p>
  </section>
</template>

<script setup lang="ts">
import AssetIcon from '~/components/common/AssetIcon.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { onPageReturn } from '~/composables/useKeptAlive'
import { CAP_DAYS, SHORT_DAYS, WATCH_DAYS, coverBarWidth, coverDaysLabel, coverTone, coverUseLabel, type CoverRow } from '~/utils/daysOfCover'

const rows = ref<CoverRow[]>([])
const windowDays = ref(28)
const loading = ref(true)
const error = ref('')
const componentId = ref<number | null>(null)

const weeks = computed(() => Math.round(windowDays.value / 7))

// The components that have anything, the one with the shortest cover first.
const components = computed(() => {
  const seen = new Map<number, CoverRow['component']>()
  for (const row of rows.value) if (!seen.has(row.component.id)) seen.set(row.component.id, row.component)
  return [...seen.values()]
})

const currentComponentName = computed(() => components.value.find((c) => c.id === componentId.value)?.name ?? '')

// The server sends shortest cover first; kept here within the component.
const visible = computed(() => rows.value.filter((row) => row.component.id === componentId.value))

const toneOf = coverTone
const barWidth = coverBarWidth
const daysLabel = (row: CoverRow) => coverDaysLabel(row, weeks.value)
const perDayLabel = coverUseLabel

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await hospitalService.daysOfCover()
    rows.value = res.rows ?? []
    windowDays.value = res.window_days ?? 28
    if (!components.value.some((c) => c.id === componentId.value)) componentId.value = components.value[0]?.id ?? null
  } catch (err) {
    error.value = (err as { message?: string })?.message || 'Days of cover could not be loaded.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
onPageReturn(load)
</script>

<style scoped>
.cover {
  display: flex; flex-direction: column; gap: 14px; padding: 18px 20px;
  border: 1px solid var(--rb-border); border-radius: var(--rb-radius-lg, 16px); background: var(--rb-surface); box-shadow: var(--rb-shadow-sm);
}
.cover__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cover__heading { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
.cover__icon { display: grid; flex: none; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: rgba(var(--rb-primary-rgb), .1); color: var(--rb-primary-text); }
.cover__title { margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.cover__sub { margin: 2px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.cover__tabs { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 3px; border-radius: 10px; background: var(--rb-surface-alt); }
.cover__tab { height: 28px; padding: 0 12px; border: 0; border-radius: 8px; background: transparent; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; }
.cover__tab:hover { color: var(--rb-text-primary); }
.cover__tab--on { background: var(--rb-surface); color: var(--rb-text-primary); box-shadow: 0 1px 2px rgba(15, 23, 42, .12); }
.cover__tab:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.cover__table { width: 100%; border-collapse: collapse; }
.cover__row th, .cover__row td { padding: 8px 0; border-bottom: 1px solid var(--rb-border); vertical-align: middle; text-align: left; }
.cover__row:last-child th, .cover__row:last-child td { border-bottom: 0; }
.cover__row th { width: 64px; }
.cover__type {
  display: inline-grid; place-items: center; min-width: 44px; padding: 2px 8px; border-radius: 999px;
  border: 1px solid rgba(var(--rb-accent-rgb), .35); background: rgba(var(--rb-accent-rgb), .07); color: var(--rb-accent-text); font-size: 12px; font-weight: 700;
}
.cover__bar-cell { padding-right: 16px !important; }
.cover__bar { display: flex; align-items: center; gap: 12px; }
.cover__track { flex: 1; height: 8px; overflow: hidden; border-radius: 999px; background: var(--rb-surface-alt); }
.cover__fill { display: block; height: 100%; border-radius: inherit; background: var(--rb-primary); }
.cover__days { display: inline-flex; align-items: center; gap: 5px; min-width: 128px; font-size: 13px; font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; white-space: nowrap; }
.cover__meta { width: 1%; font-size: 12.5px; color: var(--rb-text-secondary); white-space: nowrap; text-align: right !important; }
.cover__meta strong { color: var(--rb-text-primary); }

/* Status: colour on the bar and the figure, with an icon so it is never colour alone. */
.cover__row--short .cover__fill { background: var(--rb-accent); }
.cover__row--short .cover__days { color: var(--rb-accent-text); }
.cover__row--watch .cover__fill { background: var(--rb-warning); }
.cover__row--watch .cover__days { color: var(--rb-warning-text); }
.cover__row--idle .cover__days { font-weight: 500; color: var(--rb-text-muted); }

.cover__key { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0; font-size: 12px; color: var(--rb-text-muted); }
.cover__key-item { display: inline-flex; align-items: center; gap: 4px; }
.cover__key-item--short { color: var(--rb-accent-text); }
.cover__key-item--watch { color: var(--rb-warning-text); }

.cover__empty { margin: 0; padding: 18px; border-radius: 12px; background: var(--rb-surface-alt); font-size: 13px; color: var(--rb-text-secondary); text-align: center; }
.cover__error { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 13px; color: var(--rb-accent-text); }
.cover__retry { padding: 0; border: 0; background: none; font: inherit; font-weight: 700; color: var(--rb-primary-text); cursor: pointer; }
.cover__list { display: flex; flex-direction: column; gap: 12px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
