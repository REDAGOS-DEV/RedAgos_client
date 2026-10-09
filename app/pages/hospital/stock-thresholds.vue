<template>
  <StockThresholdsPanel
    :fetch-status="() => hospitalService.stockThresholds()"
    :save-status="(payload) => hospitalService.saveStockThresholds(payload)"
    editable
    facility-noun="blood bank"
  />
</template>

<script setup lang="ts">
/**
 * A hospital blood bank's minimum stock per blood type and component.
 *
 * Counted against the blood bank's own shelf: bags in available custody, not
 * held for a patient and not past their date. A blood bank has no departments,
 * so every one of its accounts may set a minimum.
 */
import { hospitalService } from '~/api/hospital/HospitalService'
import StockThresholdsPanel from '~/components/common/StockThresholdsPanel.vue'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

useHead({ title: 'Stock Thresholds · RedAgos' })
</script>
