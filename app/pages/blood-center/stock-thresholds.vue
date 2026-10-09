<template>
  <StockThresholdsPanel
    :fetch-status="() => bloodCenterService.stockThresholds()"
    :save-status="(payload) => bloodCenterService.saveStockThresholds(payload)"
    :editable="can('inventory.thresholds')"
    facility-noun="centre"
    read-only-note="You can see how stock stands against each minimum. The Inventory Control Officer and the Center Admin set them."
  />
</template>

<script setup lang="ts">
/**
 * A blood centre's minimum stock per blood type and component.
 *
 * Anyone who can see the inventory reads how it stands against its minimums.
 * Setting them takes `inventory.thresholds`, held by the Inventory Control
 * Officer and the Center Admin; the server re-checks it on every save.
 */
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import StockThresholdsPanel from '~/components/common/StockThresholdsPanel.vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'inventory.view',
})

useHead({ title: 'Stock Thresholds · RedAgos' })

const { can } = useUser()
</script>
