<template>
  <div class="dialog-backdrop" @click.self="requestClose">
    <div
      ref="dialogRef"
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-up-title"
      tabindex="-1"
      @keydown.esc="requestClose"
    >
      <h2 id="follow-up-title" class="dialog__title">
        <AssetIcon name="route" :size="18" />
        Source the rest from another facility
      </h2>

      <p class="dialog__body">
        {{ request.target_facility?.name || 'The blood center' }} could not supply all of
        <strong class="mono">{{ request.reference_number }}</strong>. A follow-up asks another blood service facility for
        what is left. The original request keeps what it asked for; the forwarded quantity is taken off what it still
        needs, so nothing is asked of two facilities at once.
      </p>

      <div v-if="loading" class="dialog__loading">Loading facilities and stock…</div>

      <template v-else>
        <fieldset class="lines">
          <legend class="field__label">What to ask for</legend>
          <div v-for="row in rows" :key="row.id" class="line">
            <span class="line__name">{{ row.component }}</span>
            <span class="line__left">{{ row.forwardable }} left to source</span>
            <label class="line__qty">
              <span class="sr-only">Units of {{ row.component }}</span>
              <input
                v-model.number="quantities[row.id]"
                type="number"
                min="0"
                :max="row.forwardable"
                class="field__input"
              >
            </label>
          </div>
        </fieldset>

        <label class="field">
          <span class="field__label">Facility to ask *</span>
          <select v-model.number="targetId" class="field__input">
            <option :value="null" disabled>Select a blood service facility</option>
            <option v-for="facility in facilities" :key="facility.id" :value="facility.id">
              {{ facility.name }}{{ stockSummary(facility.id) }}
            </option>
          </select>
          <span class="field__hint">
            Stock shown is what each facility held a moment ago. It is advisory — nothing is reserved until that
            facility approves the follow-up.
          </span>
        </label>

        <label class="field">
          <span class="field__label">Priority</span>
          <select v-model="urgency" class="field__input">
            <option value="routine">{{ PRIORITY_LABELS.routine }}</option>
            <option value="emergency">{{ PRIORITY_LABELS.emergency }}</option>
          </select>
        </label>
      </template>

      <p v-if="error" class="dialog__error" role="alert">{{ error }}</p>

      <div class="dialog__actions">
        <button type="button" class="btn btn--primary" :disabled="!canSubmit" @click="submit">
          {{ saving ? 'Sending…' : 'Send follow-up' }}
        </button>
        <button type="button" class="btn" :disabled="saving" @click="requestClose">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Ask another facility for what the original request could not get.
 *
 * Only the lines that can still be forwarded are offered, capped at what each
 * has left. Everything else — patient, blood type, components, indications — is
 * copied from the original by the API, because that is what the physician
 * certified.
 */

import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import { PRIORITY_LABELS } from '~/types/bloodRequest'
import { buildFollowUpPayload, forwardableRows } from '~/utils/requestFulfilment'

const props = defineProps({
  request: { type: Object, required: true },
})

const emit = defineEmits(['close', 'created'])

const dialogRef = ref(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')

const facilities = ref([])
/** Available units keyed by facility id, then by request line id. */
const stock = ref({})
const targetId = ref(null)
const urgency = ref(props.request.urgency_level || 'routine')

const rows = computed(() => forwardableRows(props.request))
const quantities = reactive(Object.fromEntries(rows.value.map((row) => [row.id, row.forwardable])))

const payload = computed(() => buildFollowUpPayload(Number(targetId.value), quantities, rows.value, urgency.value))
const canSubmit = computed(() => !saving.value && !loading.value && Boolean(targetId.value) && payload.value.items.length > 0)

onMounted(async () => {
  nextTick(() => dialogRef.value?.focus())

  try {
    const eligible = await hospitalService.eligibleFacilities()
    facilities.value = (eligible?.facilities ?? []).filter((facility) => facility.id !== props.request.target_facility?.id)

    const byFacility = {}

    await Promise.all(rows.value.map(async (row) => {
      const componentId = props.request.items.find((item) => item.id === row.id)?.component?.id
      if (!componentId || !props.request.blood_type?.id) return

      try {
        const result = await hospitalService.availability({
          blood_type_id: props.request.blood_type.id,
          component_id: componentId,
          quantity: row.forwardable,
        })

        for (const holding of result?.facilities ?? []) {
          byFacility[holding.facility.id] ??= {}
          byFacility[holding.facility.id][row.id] = holding.available
        }
      } catch {
        // Stock is a hint for choosing a facility, not a requirement for
        // asking one. A failed lookup leaves the list without figures.
      }
    }))

    stock.value = byFacility
  } catch (err) {
    error.value = err?.message || 'Could not load the facilities you can ask.'
  } finally {
    loading.value = false
  }
})

function stockSummary(facilityId) {
  const held = stock.value[facilityId]
  if (!held) return ''

  const parts = rows.value.map((row) => `${row.component} ${held[row.id] ?? 0}`)

  return ` — has ${parts.join(', ')}`
}

async function submit() {
  if (!canSubmit.value) return

  saving.value = true
  error.value = ''

  try {
    const response = await hospitalService.createFollowUp(props.request.id, payload.value)
    emit('created', response)
  } catch (err) {
    const errors = err?.data?.errors
    const first = errors && typeof errors === 'object' ? Object.values(errors).flat()[0] : null

    error.value = first || err?.message || 'The follow-up could not be sent.'
  } finally {
    saving.value = false
  }
}

function requestClose() {
  if (saving.value) return
  emit('close')
}
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 320;
  display: grid;
  place-items: center;
  padding: 16px;
  background: var(--rb-overlay);
}

.dialog {
  width: min(560px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 1.25rem 1.35rem;
  border-radius: 14px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  outline: none;
}

.dialog__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.05rem;
}

.dialog__body,
.dialog__loading {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.dialog__body strong {
  color: var(--rb-text-primary);
}

.lines {
  margin: 0;
  padding: 0;
  border: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.lines legend {
  margin-bottom: 0.35rem;
}

.line {
  display: grid;
  grid-template-columns: 1fr auto 90px;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
}

.line__name {
  font-weight: 600;
  font-size: 0.86rem;
}

.line__left {
  font-size: 0.78rem;
  color: var(--rb-text-secondary);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field__label {
  font-size: 0.8rem;
  font-weight: 600;
}

.field__hint {
  font-size: 0.76rem;
  line-height: 1.45;
  color: var(--rb-text-secondary);
}

.field__input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 0.86rem;
}

.dialog__error {
  margin: 0;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  background: rgba(var(--rb-accent-rgb), 0.12);
  color: var(--rb-accent-text);
  font-size: 0.82rem;
}

.dialog__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.5rem 0.95rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: transparent;
  color: var(--rb-text-primary);
  font: inherit;
  font-weight: 600;
  font-size: 0.84rem;
  cursor: pointer;
}

.btn--primary {
  border-color: transparent;
  background: var(--rb-primary);
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
