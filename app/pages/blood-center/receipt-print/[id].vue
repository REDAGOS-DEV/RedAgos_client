<template>
  <div class="print-page">
    <div class="print-toolbar no-print">
      <NuxtLink to="/blood-center/pos" class="btn btn-outline">Back to the counter</NuxtLink>
      <button class="btn btn-primary" :disabled="!receipt" @click="print">Print</button>
    </div>

    <p v-if="error" class="print-error no-print">{{ error }}</p>
    <p v-else-if="!receipt" class="print-loading no-print">Loading the receipt…</p>

    <BloodCenterThermalReceipt v-else :receipt="receipt" @ready="onReady" />
  </div>
</template>

<script setup>
/**
 * One receipt on its own page, sized for the counter's 80mm thermal printer.
 *
 * Opened from the counter in a new tab; with ?auto=1 it prints itself as soon
 * as the receipt — and the centre's logo on it — has loaded. The A4 PDF stays
 * available from the counter and the statements page.
 */
import BloodCenterThermalReceipt from '~/components/BloodCenter/ThermalReceipt.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: false,
  requires: 'billing.record_payment',
})

const route = useRoute()
const receipt = ref(null)
const error = ref('')
let printed = false

useHead({ title: 'Receipt' })

function print() {
  window.print()
}

function onReady() {
  if (route.query.auto && !printed) {
    printed = true
    // One frame, so the receipt is laid out before the print dialog takes it.
    requestAnimationFrame(() => window.print())
  }
}

onMounted(async () => {
  try {
    receipt.value = (await bloodCenterService.receipt(route.params.id))?.receipt ?? null
    useHead({ title: receipt.value?.receipt_number ?? 'Receipt' })
  } catch (err) {
    error.value = err?.message || 'The receipt could not be loaded.'
  }
})
</script>

<style>
/* Unscoped on purpose: the page size applies to the whole printed document. */
@page { size: 80mm auto; margin: 0; }

@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; }
}
</style>

<style scoped>
.print-page { min-height: 100vh; background: var(--rb-page-bg, #f4f5f7); padding: 18px 12px; font-family: var(--rb-font-sans); }
.print-toolbar { display: flex; justify-content: center; gap: 8px; margin-bottom: 16px; }
.print-error { text-align: center; color: var(--rb-accent-text); font-size: 13px; }
.print-loading { text-align: center; color: var(--rb-text-secondary); font-size: 13px; }
.print-page :deep(.thermal) { box-shadow: 0 1px 6px rgba(0, 0, 0, .12); padding: 4mm; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none;
  padding: 8px 15px; font-size: 13px; font-weight: 600; font-family: inherit; border-radius: 8px; cursor: pointer;
}
.btn-primary { background: var(--rb-primary); color: #fff; border: 1px solid var(--rb-primary); }
.btn-outline { background: var(--rb-surface); color: var(--rb-text-primary); border: 1px solid var(--rb-border-strong); }
.btn:disabled { opacity: .55; cursor: not-allowed; }

@media print {
  .print-page { padding: 0; background: #fff; min-height: 0; }
  .print-page :deep(.thermal) { box-shadow: none; padding: 3mm 0; }
}
</style>
