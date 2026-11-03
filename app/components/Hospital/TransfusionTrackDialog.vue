<template>
  <!--
    Where a patient's request has got to (project owner, 2026-11-01): how far it
    is, what each facility is doing, and what happened when. Managing it is in
    Full Details.
  -->
  <CenterModal :title="reference" eyebrow="Track request" size="md" @close="$emit('close')">
    <template v-if="request" #meta>
      <span>{{ request.patient?.full_name || 'Patient not recorded' }}</span>
      <span class="status-chip" :class="`tone--${tone}`">{{ transfusionProgressLabel(request) }}</span>
    </template>

    <SkeletonList v-if="loading" :rows="5" />

    <div v-else-if="error" class="track-error" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="ui-btn" @click="load">Try again</button>
    </div>

    <div v-else-if="request" class="track">
      <ol class="steps" :class="{ 'steps--halted': halted }">
        <li v-for="step in steps" :key="step.key" class="step" :class="`step--${step.state}`">
          <span class="step__mark">
            <AssetIcon v-if="step.state === 'done'" name="check" :size="13" />
          </span>
          <span class="step__label">{{ step.label }}</span>
          <span class="step__note">{{ step.note }}</span>
        </li>
      </ol>

      <section>
        <h3 class="track__title">Facilities asked</h3>
        <ul v-if="request.allocations?.length" class="shares">
          <li v-for="share in request.allocations" :key="share.id" class="share">
            <div class="share__who">
              <span class="share__name">{{ share.target_facility?.name || 'Blood center' }}</span>
              <NuxtLink :to="`/hospital/bloodrequests/${share.id}`" class="share__ref">{{ share.reference_number }}</NuxtLink>
            </div>
            <span class="share__status">{{ share.allocation_status_label }}</span>
          </li>
        </ul>
        <p v-else class="track__empty">No facility has been asked yet.</p>
      </section>

      <section>
        <h3 class="track__title">History</h3>
        <RequestHistoryTimeline
          :events="events"
          :loading="historyLoading"
          :error="historyError"
          show-allocation
          allocation-link-base="/hospital/bloodrequests/"
        />
      </section>
    </div>

    <template #actions>
      <button type="button" class="ui-btn" @click="$emit('close')">Close</button>
      <button type="button" class="ui-btn ui-btn--primary" @click="$emit('details')">
        <AssetIcon name="file-text" :size="15" />
        Full Details
      </button>
    </template>
  </CenterModal>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import RequestHistoryTimeline from '~/components/common/RequestHistoryTimeline.vue'
import CenterModal from '~/components/ui/CenterModal.vue'
import SkeletonList from '~/components/ui/SkeletonList.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { REQUEST_STATUS_TONES } from '~/types/bloodRequest'
import { transfusionProgressLabel } from '~/utils/transfusionSourcing'

const props = defineProps({
  requestId: { type: [Number, String], required: true },
  reference: { type: String, required: true },
})

defineEmits(['close', 'details'])

const request = ref(null)
const loading = ref(true)
const error = ref('')
const events = ref([])
const historyLoading = ref(true)
const historyError = ref('')

const tone = computed(() => REQUEST_STATUS_TONES[request.value?.status] ?? 'muted')
const halted = computed(() => ['rejected', 'cancelled'].includes(request.value?.status))

// Each step from the request's own figures; the first not reached is where it stands.
const steps = computed(() => {
  const r = request.value
  if (!r) return []
  const t = r.totals ?? {}
  const of = n => `${n ?? 0} of ${t.required ?? 0}`
  const raw = [
    { key: 'submitted', label: 'Submitted', note: r.is_walk_in ? 'Walk-in' : (r.source_label ?? ''), reached: true },
    { key: 'asked', label: 'Facilities asked', note: `${r.allocation_count ?? r.allocations?.length ?? 0} asked`, reached: (r.allocation_count ?? r.allocations?.length ?? 0) > 0 },
    { key: 'reserved', label: 'Stock reserved', note: of(t.approved), reached: (t.approved ?? 0) > 0 },
    { key: 'released', label: 'Units released', note: of(t.fulfilled), reached: (t.fulfilled ?? 0) > 0 },
    { key: 'received', label: 'Received', note: of(t.received), reached: (t.received ?? 0) > 0 && t.received >= t.required },
  ]
  const current = raw.findIndex(step => !step.reached)
  return raw.map((step, i) => ({
    ...step,
    state: step.reached ? 'done' : (i === current && !halted.value ? 'current' : 'todo'),
  }))
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await hospitalService.showTransfusionRequest(props.requestId)
    request.value = response.request
  } catch (err) {
    error.value = err?.message || 'Could not load this request. Please try again.'
  } finally {
    loading.value = false
  }

  historyLoading.value = true
  historyError.value = ''
  try {
    const response = await hospitalService.transfusionHistory(props.requestId)
    events.value = response.events ?? []
  } catch (err) {
    historyError.value = err?.message || 'Could not load the history.'
  } finally {
    historyLoading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.track { display: flex; flex-direction: column; gap: 22px; }
.track__title { margin: 0 0 10px; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.track__empty { margin: 0; font-size: 13px; color: var(--rb-text-secondary); }
.track-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13.5px; color: var(--rb-accent-text); }
.track-error p { margin: 0; }

.status-chip { padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.tone--success { background: rgba(var(--rb-success-rgb), 0.14); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }
.tone--progress { background: rgba(var(--rb-purple-rgb), 0.12); color: var(--rb-purple-text); }
.tone--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

.steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; }
.step { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
.step:not(:last-child)::after { content: ''; position: absolute; top: 11px; left: calc(50% + 15px); right: calc(-50% + 15px); height: 2px; border-radius: 2px; background: var(--rb-border); }
.step--done:not(:last-child)::after { background: var(--rb-success); }
.step__mark { display: grid; place-items: center; width: 24px; height: 24px; border: 2px solid var(--rb-border); border-radius: 50%; background: var(--rb-surface); color: #FFFFFF; }
.step--done .step__mark { border-color: var(--rb-success); background: var(--rb-success); }
.step--current .step__mark { border-color: var(--rb-primary); box-shadow: inset 0 0 0 4px var(--rb-surface), inset 0 0 0 12px var(--rb-primary); }
.step__label { margin-top: 2px; font-size: 12.5px; font-weight: 700; color: var(--rb-text-primary); }
.step--todo .step__label { color: var(--rb-text-muted); font-weight: 600; }
.step__note { font-size: 12px; color: var(--rb-text-secondary); }

.shares { display: flex; flex-direction: column; margin: 0; padding: 0; border: 1px solid var(--rb-border); border-radius: 12px; list-style: none; }
.share { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 14px; font-size: 13px; }
.share + .share { border-top: 1px solid var(--rb-border); }
.share__who { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.share__name { font-weight: 700; color: var(--rb-text-primary); }
.share__ref { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--rb-primary-text); text-decoration: none; }
.share__ref:hover { text-decoration: underline; }
.share__status { flex-shrink: 0; font-size: 12.5px; color: var(--rb-text-secondary); }

@media (max-width: 640px) {
  .steps { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .step { flex-direction: row; flex-wrap: wrap; text-align: left; }
  .step::after { display: none; }
}
</style>
