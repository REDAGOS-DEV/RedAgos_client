<template>
  <div>
    <div class="drawer-backdrop" @click="$emit('close')" />
    <aside
      class="drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unit-history-title"
      v-focus-trap
      @dialog-escape="$emit('close')"
    >
      <header class="drawer__header">
        <div>
          <p class="drawer__eyebrow">Bag history</p>
          <h2 id="unit-history-title" class="drawer__title mono">{{ unitId }}</h2>
          <p v-if="unit" class="drawer__meta">
            {{ unit.blood_type?.code || '—' }} · {{ unit.component?.name || '—' }}
            · expires {{ formatDate(unit.expiry_date) }}
          </p>
        </div>
        <button type="button" class="icon-btn" aria-label="Close bag history" @click="$emit('close')">
          <AssetIcon name="x" :size="18" />
        </button>
      </header>

      <div class="drawer__body">
        <div v-if="loading" aria-busy="true">
          <div class="skeleton" style="width:60%" />
          <div class="skeleton" style="width:85%" />
          <div class="skeleton" style="width:45%" />
        </div>

        <p v-else-if="error" class="drawer__error" role="alert">{{ error }}</p>

        <template v-else-if="unit">
          <dl class="facts">
            <div>
              <dt>Status</dt>
              <dd><span class="pill" :class="`tone--${HOSPITAL_UNIT_STATUS_TONES[unit.status]}`">{{ unit.status_label }}</span></dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>{{ formatDateTime(unit.stocked_at) }}</dd>
            </div>
            <div>
              <dt>From request</dt>
              <dd class="mono">{{ unit.source?.reference_number || '—' }}</dd>
            </div>
            <div v-if="unit.source?.transfusion_reference">
              <dt>Received for</dt>
              <dd class="mono">{{ unit.source.transfusion_reference }}</dd>
            </div>
            <div v-if="unit.discard_reason" class="facts__wide">
              <dt>Discarded</dt>
              <dd>{{ formatDateTime(unit.discarded_at) }} — {{ unit.discard_reason }}</dd>
            </div>
          </dl>

          <section>
            <h3 class="section-title">Tags</h3>
            <p v-if="!tags.length" class="empty">This bag has never been tagged to a patient.</p>

            <ol v-else class="tags">
              <li v-for="tag in tags" :key="tag.id" class="tag">
                <div class="tag__head">
                  <span class="pill" :class="`tone--${UNIT_TAG_STATUS_TONES[tag.status]}`">{{ tag.status_label }}</span>
                  <span class="tag__patient">{{ tag.patient.full_name }}</span>
                </div>
                <p class="tag__sub">
                  {{ tag.patient.age }} · {{ tag.patient.sex === 'female' ? 'F' : 'M' }}
                  <template v-if="tag.patient.record_number"> · {{ tag.patient.record_number }}</template>
                  <template v-if="tag.patient.ward"> · {{ tag.patient.ward }}</template>
                  <template v-if="tag.transfusion_request?.reference_number"> · {{ tag.transfusion_request.reference_number }}</template>
                </p>

                <ul class="steps">
                  <li>
                    <span class="steps__label">Tagged</span>
                    {{ formatDateTime(tag.tagged_at) }}<template v-if="tag.actors?.tagged_by"> · {{ tag.actors.tagged_by }}</template>
                  </li>
                  <li v-if="tag.crossmatched_at">
                    <span class="steps__label">Crossmatched</span>
                    {{ formatDateTime(tag.crossmatched_at) }}<template v-if="tag.actors?.crossmatched_by"> · {{ tag.actors.crossmatched_by }}</template>
                  </li>
                  <li v-if="tag.transfused_at">
                    <span class="steps__label">Transfused</span>
                    {{ formatDateTime(tag.transfused_at) }}<template v-if="tag.actors?.transfused_by"> · {{ tag.actors.transfused_by }}</template>
                  </li>
                  <li v-if="tag.untagged_at">
                    <span class="steps__label">Untagged</span>
                    {{ formatDateTime(tag.untagged_at) }}
                    · {{ tag.untagged_by_system ? 'automatically' : (tag.actors?.untagged_by || 'staff') }}
                    <span class="steps__reason">
                      {{ tag.untag_reason_label }}<template v-if="tag.untag_note">: “{{ tag.untag_note }}”</template>
                    </span>
                  </li>
                  <li v-if="tag.returned_at">
                    <span class="steps__label">Back in storage</span>
                    {{ formatDateTime(tag.returned_at) }}<template v-if="tag.actors?.returned_by"> · {{ tag.actors.returned_by }}</template>
                  </li>
                  <li v-if="tag.deadline_at">
                    <span class="steps__label">Deadline</span>
                    {{ formatDateTime(tag.deadline_at) }}
                  </li>
                </ul>
              </li>
            </ol>
          </section>
        </template>
      </div>
    </aside>
  </div>
</template>

<script setup>
/**
 * One bag's story at the hospital: where it came from and every tag placed on it.
 *
 * Ended tags are history, never removed, so a bag released from one patient
 * and tagged to another shows both — newest first, with who acted and when.
 */

import { onMounted, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { HOSPITAL_UNIT_STATUS_TONES, UNIT_TAG_STATUS_TONES } from '~/types/hospitalInventory'

const props = defineProps({
  unitId: { type: String, required: true },
})

defineEmits(['close'])

const unit = ref(null)
const tags = ref([])
const loading = ref(true)
const error = ref('')

onMounted(load)

async function load() {
  loading.value = true
  error.value = ''

  try {
    const response = await hospitalService.inventoryUnit(props.unitId)
    unit.value = response.unit
    tags.value = response.tags ?? []
  } catch (err) {
    error.value = err?.status === 404 ? 'This bag is not in your blood bank.' : (err?.message || 'Could not load the history.')
  } finally {
    loading.value = false
  }
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css; nothing is redeclared here. */
.drawer-backdrop { position: fixed; inset: 0; background: var(--rb-overlay); z-index: 300; }
.drawer {
  position: fixed; top: 0; right: 0; z-index: 301;
  height: 100vh; width: 460px; max-width: 100vw;
  display: flex; flex-direction: column;
  background: var(--rb-surface); border-left: 1px solid var(--rb-border);
  box-shadow: -12px 0 40px rgba(var(--rb-shadow-rgb), 0.18);
}
.drawer:focus { outline: none; }
.drawer__header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 20px 22px; border-bottom: 1px solid var(--rb-border);
}
.drawer__eyebrow { margin: 0 0 4px; font-size: 11px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: var(--rb-text-secondary); }
.drawer__title { margin: 0; font-size: 18px; font-weight: 700; color: var(--rb-text-primary); }
.drawer__meta { margin: 4px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.drawer__body { flex: 1; overflow-y: auto; padding: 20px 22px; display: flex; flex-direction: column; gap: 22px; }
.drawer__error { margin: 0; font-size: 13px; color: var(--rb-accent-text); }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.icon-btn {
  width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent;
  display: grid; place-items: center; color: var(--rb-text-secondary); cursor: pointer;
}
.icon-btn:hover { background: var(--rb-surface-alt); color: var(--rb-text-primary); }

.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 0; }
.facts__wide { grid-column: 1 / -1; }
.facts dt { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; color: var(--rb-text-secondary); }
.facts dd { margin: 3px 0 0; font-size: 13.5px; color: var(--rb-text-primary); }

.section-title { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--rb-text-primary); }
.empty { margin: 0; font-size: 13px; color: var(--rb-text-secondary); }

.tags { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.tag { padding: 12px 14px; border: 1px solid var(--rb-border); border-radius: 12px; }
.tag__head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tag__patient { font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); }
.tag__sub { margin: 4px 0 8px; font-size: 12px; color: var(--rb-text-secondary); }

.steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; color: var(--rb-text-primary); }
.steps__label { display: inline-block; min-width: 108px; font-weight: 600; color: var(--rb-text-secondary); }
.steps__reason { display: block; margin: 2px 0 0 108px; color: var(--rb-text-secondary); }

.pill { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.tone--success { background: rgba(var(--rb-success-rgb), 0.14); color: var(--rb-success-text); }
.tone--warning { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); }
.tone--danger { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }
.tone--info { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }
.tone--progress { background: rgba(var(--rb-purple-rgb), 0.12); color: var(--rb-purple-text); }
.tone--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

.skeleton {
  height: 13px; border-radius: 6px; margin-bottom: 10px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 50%, var(--rb-skeleton-a) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}

@media (max-width: 520px) {
  .facts { grid-template-columns: 1fr; }
  .steps__label { min-width: 0; display: block; }
  .steps__reason { margin-left: 0; }
}
</style>
