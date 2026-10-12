<template>
  <StockThresholdsPanel
    :fetch-status="() => hospitalService.stockThresholds()"
    :save-status="(payload) => hospitalService.saveStockThresholds(payload)"
    :editable="can('hospital.inventory.thresholds')"
    facility-noun="blood bank"
  />
</template>

<script setup lang="ts">
/**
 * A hospital blood bank's minimum stock per blood type and component.
 *
 * Counted against the blood bank's own shelf: bags in available custody — so
 * stocked in — not held for a patient and not past their date, refreshed every
 * minute. Every role watches it; inventory staff and the Head set the minimums
 * (hospital roles, project owner 2026-10-11).
 */
import { hospitalService } from '~/api/hospital/HospitalService'
import StockThresholdsPanel from '~/components/common/StockThresholdsPanel.vue'

const { can } = useUser()

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.inventory.view' })

useHead({ title: 'Stock Thresholds · RedAgos' })
</script>
