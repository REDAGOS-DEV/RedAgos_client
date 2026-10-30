<template>
  <div class="forecast-page">
    <PageHeader title="Demand Forecast">
      <template v-if="can(REPORTS_ABILITIES)" #actions>
        <!-- Looking back lives on its own page. -->
        <NuxtLink to="/blood-center/reports" class="aside-link">
          <AssetIcon name="bar-chart" :size="15" />
          Past reports
          <AssetIcon name="arrow-right" :size="13" />
        </NuxtLink>
      </template>
    </PageHeader>

    <ForecastPanel />
  </div>
</template>

<script setup>
/**
 * The weeks ahead, apart from the reports that look back (project owner,
 * 2026-10-24). What it shows depends on the viewer's department; the server
 * decides (DemandForecastService), and ForecastPanel draws each part.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import ForecastPanel from '~/components/BloodCenter/ForecastPanel.vue'
import { REPORTS_ABILITIES } from '~/composables/useBloodCenterNav'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // The same list as the sidebar's link (FORECAST_ABILITIES).
  requires: ['inventory.view', 'donations.view', 'lab.record_components', 'lab.record_serology', 'billing.record_payment'],
})

const { can } = useUser()
</script>

<style scoped>
.forecast-page { display: flex; flex-direction: column; gap: 20px; max-width: var(--rb-content-max, 1400px); margin: 0 auto; padding: 24px 32px 40px; }
.aside-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--rb-border-strong, var(--rb-border));
  border-radius: 8px;
  background: var(--rb-surface);
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-primary);
  text-decoration: none;
}
.aside-link:hover { border-color: rgba(var(--rb-primary-rgb), 0.45); }
.aside-link:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
</style>
