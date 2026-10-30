<template>
  <div class="results-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Serology Results</h1>
      </div>
      <NuxtLink to="/blood-center/testing?test=serology" class="btn-outline">
        <AssetIcon name="flask-conical" :size="14" />
        Testing queue
      </NuxtLink>
    </header>

    <!-- Keyed on the filter the link asked for, so the supervisor's notification
         lands on what waits even when this page is already open. -->
    <BloodCenterSerologyResults
      :key="`${initialOutcome}|${initialDonation}`"
      :markers="markers"
      :initial-outcome="initialOutcome"
      :initial-donation="initialDonation"
      @changed="badgeRefresh++"
    />
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import BloodCenterSerologyResults from '~/components/BloodCenter/SerologyResults.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { SEROLOGY_MARKERS } from '~/utils/serology'

/**
 * TTI Testing's results list on its own page (project owner, 2026-10-18; it
 * was a tab on the Testing page). Every recorded panel, marker by marker,
 * where a technologist files a correction and the Laboratory Supervisor
 * verifies or returns a reactive result.
 *
 * ?outcome=awaiting_verification opens it on what waits for the supervisor,
 * which is where their notification links. ?donation= opens that donation's panel:
 * a saved panel is viewed and corrected here, not on the testing queue, and
 * the Laboratory Supervisor approves the correction here too.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'lab.record_serology',
})

const route = useRoute()

// The sidebar counts what waits for verification; a change here recounts it.
const badgeRefresh = useState('blood-center-badge-refresh', () => 0)

const initialOutcome = computed(() => (typeof route.query.outcome === 'string' ? route.query.outcome : ''))
// ?donation= from the testing queue's "View or edit in Serology Results": opened straight away.
const initialDonation = computed(() => (typeof route.query.donation === 'string' ? route.query.donation : null))

const markers = ref(SEROLOGY_MARKERS)

onMounted(async () => {
  try {
    const res = await bloodCenterService.referenceData()
    if (res?.serology_markers?.length) markers.value = res.serology_markers
  } catch {
    // The built-in panel is the same five markers in the same order.
  }
})
</script>

<style scoped>
.results-page {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--rb-text-primary);
}

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }

.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  text-decoration: none;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.btn-outline:hover { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

@media (max-width: 640px) {
  .results-page { padding: 16px 16px 32px; }
  .page-header { flex-direction: column; }
}
</style>
