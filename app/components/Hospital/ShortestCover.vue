<template>
  <!--
    The dashboard's view of days of cover (project owner, 2026-11-27): the few
    blood types and components that would run out first at the recent rate of
    use. The whole list is on Stock Thresholds.
  -->
  <SectionCard title="Shortest cover" :subtitle="`At your use over the last ${weeks} weeks`" flush>
    <template #actions>
      <NuxtLink to="/hospital/stock-thresholds" class="panel-link">
        See all
        <AssetIcon name="chevron-right" :size="14" />
      </NuxtLink>
    </template>

    <SkeletonList v-if="loading" class="sc-skeleton" :rows="3" />
    <p v-else-if="error" class="sc-note sc-note--error" role="alert">{{ error }}</p>
    <ul v-else-if="top.length" class="sc-list">
      <li v-for="row in top" :key="`${row.blood_type.id}:${row.component.id}`" class="sc-row" :class="`sc-row--${coverTone(row)}`">
        <span class="sc-type">{{ row.blood_type.code }}</span>
        <span class="sc-main">
          <span class="sc-line">
            <span class="sc-comp" :title="row.component.name || ''">{{ row.component.code || row.component.name }}</span>
            <span class="sc-days">
              <AssetIcon v-if="coverTone(row) !== 'ok'" :name="coverTone(row) === 'short' ? 'circle-alert' : 'clock'" :size="12" />
              {{ coverDaysLabel(row, weeks) }}
            </span>
          </span>
          <span class="sc-track" aria-hidden="true"><span class="sc-fill" :style="{ width: `${coverBarWidth(row)}%` }" /></span>
          <span class="sc-meta">{{ row.available }} on the shelf · {{ coverUseLabel(row) }}</span>
        </span>
      </li>
    </ul>
    <p v-else class="sc-note">No bags were used in the last {{ weeks }} weeks, so there is nothing to project yet.</p>
  </SectionCard>
</template>

<script setup lang="ts">
import AssetIcon from '~/components/common/AssetIcon.vue'
import SectionCard from '~/components/ui/SectionCard.vue'
import SkeletonList from '~/components/ui/SkeletonList.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { onPageReturn } from '~/composables/useKeptAlive'
import { coverBarWidth, coverDaysLabel, coverTone, coverUseLabel, type CoverRow } from '~/utils/daysOfCover'

const SHOWN = 3

const rows = ref<CoverRow[]>([])
const windowDays = ref(28)
const loading = ref(true)
const error = ref('')

const weeks = computed(() => Math.round(windowDays.value / 7))
// The server sends shortest first; only those with a rate can be ranked.
const top = computed(() => rows.value.filter((row) => row.days_left !== null).slice(0, SHOWN))

async function load() {
  error.value = ''
  try {
    const res = await hospitalService.daysOfCover()
    rows.value = res.rows ?? []
    windowDays.value = res.window_days ?? 28
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
.sc-skeleton { padding: 4px 18px 16px; }
.sc-list { display: flex; flex-direction: column; margin: 0; padding: 4px 18px 16px; list-style: none; }
.sc-row { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; }
.sc-row + .sc-row { border-top: 1px solid var(--rb-border); }
.sc-type {
  display: grid; flex: none; place-items: center; min-width: 42px; height: 26px; padding: 0 8px; border-radius: 999px;
  border: 1px solid rgba(var(--rb-accent-rgb), .35); background: rgba(var(--rb-accent-rgb), .07); color: var(--rb-accent-text); font-size: 12px; font-weight: 700;
}
.sc-main { display: flex; flex: 1; flex-direction: column; gap: 5px; min-width: 0; }
.sc-line { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.sc-comp { overflow: hidden; font-size: 13px; font-weight: 600; color: var(--rb-text-primary); text-overflow: ellipsis; white-space: nowrap; }
.sc-days { display: inline-flex; flex: none; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: var(--rb-text-primary); font-variant-numeric: tabular-nums; }
.sc-track { height: 6px; overflow: hidden; border-radius: 999px; background: var(--rb-surface-alt); }
.sc-fill { display: block; height: 100%; border-radius: inherit; background: var(--rb-primary); }
.sc-meta { font-size: 12px; color: var(--rb-text-muted); }
.sc-row--short .sc-fill { background: var(--rb-accent); }
.sc-row--short .sc-days { color: var(--rb-accent-text); }
.sc-row--watch .sc-fill { background: var(--rb-warning); }
.sc-row--watch .sc-days { color: var(--rb-warning-text); }
.sc-note { margin: 0; padding: 6px 18px 18px; font-size: 13px; color: var(--rb-text-secondary); }
.sc-note--error { color: var(--rb-accent-text); }
.panel-link { display: inline-flex; align-items: center; gap: 2px; font-size: 13px; font-weight: 600; color: var(--rb-primary-text); text-decoration: none; }
.panel-link:hover { text-decoration: underline; }
</style>
