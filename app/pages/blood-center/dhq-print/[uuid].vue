<template>
  <div class="print-page">
    <div class="print-toolbar no-print">
      <button type="button" class="btn btn-outline" @click="closeTab">Close</button>
      <button type="button" class="btn btn-primary" :disabled="!sheet" @click="print">Print</button>
    </div>

    <p v-if="error" class="print-error no-print" role="alert">{{ error }}</p>
    <p v-else-if="!sheet" class="print-loading no-print">Loading the questionnaire…</p>

    <div v-else class="print-paper">
      <BloodCenterDonorQuestionnaireSheet :data="sheet" />
    </div>
  </div>
</template>

<script setup>
/**
 * A donor's completed health questionnaire on its own page, sized for A4.
 *
 * Opened from the Donation counter in a new tab; with ?auto=1 it prints itself
 * once the questionnaire has loaded. ?screening_id pins the questionnaire the
 * scan verified, exactly as the physician's read does.
 */
import BloodCenterDonorQuestionnaireSheet from '~/components/BloodCenter/DonorQuestionnaireSheet.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: false,
  requires: 'donors.print_questionnaire',
})

const route = useRoute()
const sheet = ref(null)
const error = ref('')

useHead({ title: 'Health questionnaire' })

function print() {
  window.print()
}

// Opened by the counter with window.open, so the tab may close itself.
function closeTab() {
  window.close()
}

const NOT_FOUND = {
  questionnaire_not_found: 'This donor has not completed the health questionnaire yet.',
  donor_not_presented: 'This donor has not presented at your centre today. Open their donation at the counter first.',
}

onMounted(async () => {
  const params = route.query.screening_id ? { screening_id: route.query.screening_id } : {}

  try {
    sheet.value = (await bloodCenterService.printableQuestionnaire(route.params.uuid, params))?.data ?? null

    const name = [sheet.value?.personal_data?.first_name, sheet.value?.personal_data?.last_name].filter(Boolean).join(' ')
    useHead({ title: name ? `DHQ · ${name}` : 'Health questionnaire' })

    if (route.query.auto && sheet.value) {
      // One frame, so the sheet is laid out before the print dialog takes it.
      await nextTick()
      requestAnimationFrame(() => window.print())
    }
  } catch (err) {
    error.value = NOT_FOUND[err?.data?.code] || err?.message || 'The questionnaire could not be loaded.'
  }
})
</script>

<style>
/* Unscoped on purpose: the page size applies to the whole printed document. */
@page { size: A4; margin: 12mm; }

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

/* On screen the sheet sits on a page of paper; in print the paper is the page. */
.print-paper {
  width: 210mm;
  max-width: 100%;
  margin: 0 auto;
  padding: 12mm;
  background: #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, .12);
  overflow-x: auto;
}

@media print {
  .print-page { padding: 0; background: #fff; min-height: 0; }
  .print-paper { width: auto; padding: 0; box-shadow: none; overflow: visible; }
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  padding: 0.5rem 0.95rem;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-outline { border: 1px solid var(--rb-border-strong); background: var(--rb-surface); color: var(--rb-text-primary); }
.btn-outline:hover { background: var(--rb-surface-hover); }
.btn-primary { border: 1px solid var(--rb-primary); background: var(--rb-primary); color: #fff; }
.btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
</style>
