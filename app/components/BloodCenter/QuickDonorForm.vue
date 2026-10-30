<template>
  <form class="qd" aria-labelledby="qd-title" @submit.prevent="submit">
    <div class="qd__head">
      <h3 id="qd-title" class="qd__title">Register a donor from the paper</h3>
    </div>

    <div class="qd__grid">
      <label class="qd__field">
        <span class="qd__label">First name</span>
        <input ref="firstInput" v-model="form.first_name" type="text" class="qd__input" maxlength="100" autocomplete="off">
        <span v-if="fieldError('first_name')" class="qd__error">{{ fieldError('first_name') }}</span>
      </label>
      <label class="qd__field">
        <span class="qd__label">Last name</span>
        <input v-model="form.last_name" type="text" class="qd__input" maxlength="100" autocomplete="off">
        <span v-if="fieldError('last_name')" class="qd__error">{{ fieldError('last_name') }}</span>
      </label>
      <label class="qd__field">
        <span class="qd__label">Birth date</span>
        <DatePicker v-model="form.birth_date" :max="maxBirthDate" aria-label="Birth date" />
        <span v-if="fieldError('birth_date')" class="qd__error">{{ fieldError('birth_date') }}</span>
      </label>
      <label class="qd__field">
        <span class="qd__label">Valid ID number</span>
        <input v-model="form.valid_id_number" type="text" class="qd__input qd__input--mono" maxlength="60" autocomplete="off">
        <span v-if="fieldError('valid_id_number')" class="qd__error">{{ fieldError('valid_id_number') }}</span>
      </label>
      <label class="qd__field">
        <span class="qd__label">Sex <span class="qd__optional">optional</span></span>
        <SelectField v-model="form.gender" aria-label="Sex" :options="[{ value: '', label: 'Not given' }, ...GENDER_OPTIONS]" />
      </label>
      <label class="qd__field">
        <span class="qd__label">Blood group <span class="qd__optional">optional</span></span>
        <SelectField v-model="form.blood_type_id" aria-label="Blood type"
          :options="[{ value: '', label: 'Not typed' }, ...bloodTypes.map(bt => ({ value: String(bt.id), label: bt.code ?? bt.label }))]" />
      </label>
      <label class="qd__field">
        <span class="qd__label">Mobile number <span class="qd__optional">optional</span></span>
        <input v-model="form.phone" type="tel" class="qd__input" maxlength="20" placeholder="09XX XXX XXXX" autocomplete="off">
        <span v-if="fieldError('phone')" class="qd__error">{{ fieldError('phone') }}</span>
      </label>
      <label class="qd__field">
        <span class="qd__label">Email <span class="qd__optional">optional</span></span>
        <input v-model="form.email" type="email" class="qd__input" maxlength="255" autocomplete="off">
        <span v-if="fieldError('email')" class="qd__error">{{ fieldError('email') }}</span>
      </label>
      <label class="qd__field qd__field--wide">
        <span class="qd__label">Address <span class="qd__optional">optional</span></span>
        <input v-model="form.address" type="text" class="qd__input" maxlength="255" autocomplete="off">
      </label>
    </div>

    <p v-if="error" class="qd__alert" role="alert">{{ error }}</p>

    <div class="qd__actions">
      <button type="button" class="qd__btn" :disabled="busy" @click="emit('cancel')">Back to search</button>
      <button type="submit" class="qd__btn qd__btn--primary" :disabled="busy || !ready">
        {{ busy ? 'Registering…' : 'Register and use' }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import type { BloodTypeOption } from '~/utils/bloodType'
import { GENDER_OPTIONS, blankDonorForm, registerPayload } from '~/utils/donorRecords'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'

/**
 * A donor named on a drive's paper who is not in RedAgos yet.
 *
 * The counter's own walk-in registration (the same server rules, the same
 * payload helpers as Donor Management's Register Donor), reached through the
 * paper records' route so whoever types the sheet can add them. Only the
 * fields a paper form carries; the rest is completed on the Donors page.
 */

const props = defineProps<{
  bloodTypes: BloodTypeOption[]
  /** What was typed in the search, split into first and last name to start from. */
  initialName?: string
}>()

const emit = defineEmits<{
  registered: [donor: Record<string, any>]
  cancel: []
}>()

const form = reactive(blankDonorForm())
const busy = ref(false)
const error = ref('')
const errors = ref<Record<string, string[]>>({})
const firstInput = ref<HTMLInputElement | null>(null)

// A donor is at least 16 on the day; the server holds the real minimum.
const maxBirthDate = computed(() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 16)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const ready = computed(() => Boolean(
  form.first_name.trim() && form.last_name.trim() && form.birth_date && form.valid_id_number.trim(),
))

function fieldError(key: string): string {
  return errors.value?.[key]?.[0] ?? ''
}

async function submit() {
  if (!ready.value || busy.value) return

  busy.value = true
  error.value = ''
  errors.value = {}

  try {
    const res: any = await bloodCenterService.registerPaperDonor(registerPayload(form))
    emit('registered', res?.data ?? res)
  } catch (err: any) {
    errors.value = err?.errors ?? {}
    error.value = Object.keys(errors.value).length ? '' : err?.message || 'The donor could not be registered.'
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  const parts = (props.initialName ?? '').trim().split(/\s+/).filter(Boolean)

  // A name, not an email or a number, is worth carrying over.
  if (parts.length && !/[@\d]/.test(props.initialName ?? '')) {
    form.first_name = parts.length > 1 ? parts.slice(0, -1).join(' ') : (parts[0] ?? '')
    form.last_name = parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''
  }

  nextTick(() => firstInput.value?.focus())
})
</script>

<style scoped>
.qd {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface-alt);
}

.qd__head { display: flex; flex-direction: column; gap: 3px; }
.qd__title { margin: 0; font-size: 14px; font-weight: 700; }

.qd__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.qd__field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.qd__field--wide { grid-column: span 2; }
.qd__label { font-size: 12px; font-weight: 600; }
.qd__optional { margin-left: 3px; font-weight: 500; color: var(--rb-text-secondary); }
.qd__error { font-size: 11.5px; color: var(--rb-accent-text); }

.qd__input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 9px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
  color-scheme: light dark;
}

.qd__input--mono { font-family: var(--rb-font-mono); }
.qd__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.qd__select {
  padding-right: 28px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 10px 6px;
  appearance: none;
}

.qd__alert {
  margin: 0;
  padding: 9px 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-accent-text);
  font-size: 13px;
}

.qd__actions { display: flex; justify-content: flex-end; gap: 8px; }

.qd__btn {
  height: 34px;
  padding: 0 13px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 9px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.qd__btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.qd__btn:disabled { opacity: 0.55; cursor: not-allowed; }
.qd__btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.qd__btn--primary { color: #fff; background: var(--rb-primary); border-color: var(--rb-primary); }
.qd__btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }

@media (max-width: 900px) {
  .qd__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 520px) {
  .qd__grid { grid-template-columns: minmax(0, 1fr); }
  .qd__field--wide { grid-column: auto; }
}
</style>
