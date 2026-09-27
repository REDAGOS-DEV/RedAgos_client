<template>
  <div class="walk-in">
    <p class="walk-in__lead">
      <AssetIcon name="phone" :size="14" />
      <span>
        Recorded at <strong>{{ centreName || 'the blood center' }}</strong>
        <template v-if="recorderName"> by {{ recorderName }}</template>
        after the hospital blood bank confirmed it by phone.
      </span>
    </p>

    <div class="walk-in__grid">
      <section class="walk-in__block">
        <h4 class="walk-in__heading">Hospital confirmation</h4>
        <dl>
          <div><dt>Confirmed by</dt><dd>{{ walkIn.verification.verifier_name }}</dd></div>
          <div><dt>Position</dt><dd>{{ walkIn.verification.verifier_position }}</dd></div>
          <div><dt>Number called</dt><dd>{{ walkIn.verification.verifier_contact }}</dd></div>
          <div><dt>Confirmed at</dt><dd>{{ formatDateTime(walkIn.verification.verified_at) }}</dd></div>
          <div v-if="walkIn.verification.recorded_by"><dt>Call taken by</dt><dd>{{ walkIn.verification.recorded_by }}</dd></div>
          <div v-if="walkIn.verification.notes" class="walk-in__wide"><dt>Notes</dt><dd>{{ walkIn.verification.notes }}</dd></div>
        </dl>
      </section>

      <section class="walk-in__block">
        <h4 class="walk-in__heading">Presented by</h4>
        <p class="walk-in__hint">The watcher who brought the request — not the requester.</p>
        <dl>
          <div><dt>Name</dt><dd>{{ walkIn.representative.name }}</dd></div>
          <div><dt>Relationship</dt><dd>{{ walkIn.representative.relationship }}</dd></div>
          <div><dt>Contact</dt><dd>{{ walkIn.representative.contact }}</dd></div>
          <div v-if="walkIn.representative.id_type_label">
            <dt>ID presented</dt>
            <dd>{{ walkIn.representative.id_type_label }} · {{ walkIn.representative.id_number || '—' }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="hasHospitalDetails" class="walk-in__block walk-in__wide">
        <h4 class="walk-in__heading">From the hospital's paperwork</h4>
        <dl>
          <div v-if="walkIn.presented_reference"><dt>Reference presented</dt><dd class="mono">{{ walkIn.presented_reference }}</dd></div>
          <div v-if="walkIn.attending_physician"><dt>Attending physician</dt><dd>{{ walkIn.attending_physician }}</dd></div>
          <div v-if="walkIn.patient_ward"><dt>Ward</dt><dd>{{ walkIn.patient_ward }}</dd></div>
          <div v-if="walkIn.patient_record_number"><dt>Patient record no.</dt><dd class="mono">{{ walkIn.patient_record_number }}</dd></div>
        </dl>
      </section>
    </div>

    <p v-if="walkIn.duplicate_acknowledgement" class="walk-in__ack">
      <AssetIcon name="triangle-alert" :size="14" />
      <span>Recorded despite another open request for this patient: {{ walkIn.duplicate_acknowledgement }}</span>
    </p>
  </div>
</template>

<script setup>
/**
 * The part of a walk-in request that a portal request never has.
 *
 * The watcher is shown as who presented the request, never as the requester:
 * the hospital blood bank remains the institutional party, and the verifier is
 * the hospital staff member who vouched for it on the phone.
 */

import { computed } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

const props = defineProps({
  walkIn: { type: Object, required: true },
  centreName: { type: String, default: '' },
  recorderName: { type: String, default: '' },
})

const hasHospitalDetails = computed(() => Boolean(
  props.walkIn.presented_reference
  || props.walkIn.attending_physician
  || props.walkIn.patient_ward
  || props.walkIn.patient_record_number,
))

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.walk-in {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  color: var(--rb-text-primary);
}

.walk-in__lead,
.walk-in__ack {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0;
  padding: 0.55rem 0.7rem;
  border-radius: 8px;
  font-size: 0.82rem;
  line-height: 1.45;
}

.walk-in__lead {
  background: rgba(var(--rb-purple-rgb), 0.1);
  color: var(--rb-purple-text);
}

.walk-in__lead strong {
  color: inherit;
}

.walk-in__ack {
  background: rgba(var(--rb-warning-rgb), 0.14);
  color: var(--rb-warning-text);
}

.walk-in__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

.walk-in__block {
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
}

.walk-in__wide {
  grid-column: 1 / -1;
}

.walk-in__heading {
  margin: 0 0 0.35rem;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
}

.walk-in__hint {
  margin: -0.15rem 0 0.4rem;
  font-size: 0.74rem;
  color: var(--rb-text-secondary);
}

dl {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.45rem 0.9rem;
}

dt {
  font-size: 0.72rem;
  color: var(--rb-text-secondary);
}

dd {
  margin: 0.1rem 0 0;
  font-size: 0.84rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
