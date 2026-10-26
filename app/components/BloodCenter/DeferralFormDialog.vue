<template>
  <Transition name="dfd" appear>
    <div class="modal-overlay deferral-form" @click.self="close">
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="deferral-form-title">
        <div class="modal-card__header">
          <h2 id="deferral-form-title" class="modal-card__title">
            <AssetIcon name="ban" :size="17" />
            {{ title }}
          </h2>
          <button type="button" class="modal-card__close" aria-label="Close" @click="close">
            <AssetIcon name="x" :size="18" />
          </button>
        </div>

        <form id="deferral-form" class="modal-card__body" novalidate @submit.prevent="submit">
          <p v-if="error || searchError" class="form-error" role="alert">{{ error || searchError }}</p>

          <!-- Donor -->
          <div class="form-group">
            <label class="form-label" for="d-donor">Donor <span class="req">*</span></label>
            <div v-if="form.donor" class="picked">
              <div class="picked__text">
                <span class="picked__name">{{ form.donor.name }}</span>
                <span class="picked__meta">
                  {{ form.donor.code }}<template v-if="form.donor.bloodType"> · {{ form.donor.bloodType }}</template><template v-if="form.donor.phone"> · {{ form.donor.phone }}</template>
                </span>
                <span v-if="form.donor.standing" class="badge" :class="`badge--${form.donor.standing.tone}`" :title="form.donor.standing.hint">
                  <span class="badge__dot" aria-hidden="true" />
                  {{ form.donor.standing.key === 'deferred' ? form.donor.standing.hint : form.donor.standing.label }}
                </span>
              </div>
              <!-- A donor handed in (the counter's) is the one being deferred. -->
              <button v-if="!donor" type="button" class="btn-link" @click="form.donor = null">Change</button>
            </div>
            <div v-else class="combo">
              <input
                id="d-donor"
                v-model="donorSearch.term"
                type="search"
                class="form-input"
                placeholder="Search donor…"
                autocomplete="off"
                @input="onDonorInput"
              >
              <ul v-if="donorSearch.term.trim().length >= 2" class="combo__list" role="listbox" aria-label="Matching donors">
                <li v-if="donorSearch.loading" class="combo__note">Searching…</li>
                <template v-else-if="donorSearch.results.length">
                  <li v-for="d in donorSearch.results" :key="d.uuid">
                    <button type="button" class="combo__option" role="option" @click="pickDonor(d)">
                      <span class="combo__main">{{ d.name }}<span v-if="d.bloodType" class="blood">{{ d.bloodType }}</span></span>
                      <span class="combo__sub">{{ d.code }}<template v-if="d.phone"> · {{ d.phone }}</template><template v-if="d.standing"> · {{ d.standing.label }}</template></span>
                    </button>
                  </li>
                </template>
                <li v-else class="combo__note">No donor on your centre's list matches. Try their name, donor ID or mobile number.</li>
              </ul>
            </div>
            <p v-if="fieldError('donor_uuid')" class="field-error">{{ fieldError('donor_uuid') }}</p>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="d-type">Type <span class="req">*</span></label>
              <SelectField id="d-type" v-model="form.outcome" :options="DEFERRAL_TYPES" />
              <p v-if="fieldError('outcome')" class="field-error">{{ fieldError('outcome') }}</p>
            </div>
            <div class="form-group">
              <label class="form-label" for="d-reason">Deferral code <span class="req">*</span></label>
              <SelectField id="d-reason" v-model="form.code" :placeholder="codes.loading ? 'Loading…' : 'Select…'"
                :options="codeOptions" />
              <p v-if="fieldError('deferral_code') && form.code !== OTHER_DEFERRAL" class="field-error">{{ fieldError('deferral_code') }}</p>
              <p v-else-if="codes.error" class="field-error">{{ codes.error }}</p>
              <p v-else class="form-hint">
                The record shows the code only.
                <NuxtLink v-if="can('deferrals.configure')" to="/blood-center/deferral-codes" class="btn-link">Manage codes</NuxtLink>
              </p>
            </div>
          </div>

          <!-- Other: no code; the reason typed, which the donor is never told. -->
          <div v-if="form.code === OTHER_DEFERRAL" class="form-group">
            <label class="form-label" for="d-other">Describe the reason <span class="req">*</span></label>
            <textarea id="d-other" v-model="form.otherReason" class="form-input form-textarea" rows="2" maxlength="255" />
            <p v-if="fieldError('other_reason') || fieldError('deferral_code')" class="field-error">{{ fieldError('other_reason') || fieldError('deferral_code') }}</p>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="d-from">From Date</label>
              <DatePicker id="d-from" v-model="form.from" :max="todayIso" :disabled="fixedFrom" @update:model-value="onFromChange" />
              <p v-if="fieldError('deferred_on')" class="field-error">{{ fieldError('deferred_on') }}</p>
              <p v-else-if="fixedFrom" class="form-hint">Today: the day of this visit.</p>
            </div>
            <div class="form-group">
              <label class="form-label" for="d-until">Until Date <span v-if="isTemporary" class="req">*</span></label>
              <DatePicker id="d-until" v-model="form.until" :min="untilMin" :disabled="!isTemporary" />
              <p v-if="fieldError('ends_on') || fieldError('deferred_until')" class="field-error">{{ fieldError('ends_on') || fieldError('deferred_until') }}</p>
              <p v-else class="form-hint">Ignored for permanent and indefinite deferrals.</p>
            </div>
          </div>

          <!-- What the page using the form adds: the counter's readings and what the donor will be told. -->
          <slot :outcome="form.outcome" :code="form.code" />
        </form>

        <div class="modal-card__footer">
          <button type="button" class="btn-outline" :disabled="saving" @click="close">Cancel</button>
          <button type="submit" form="deferral-form" class="btn-primary" :disabled="!canSave || saving">
            <AssetIcon name="check" :size="15" />
            {{ saving ? 'Saving…' : submitLabel }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
/**
 * The deferral form: who, which kind, under which code (or Other), from and
 * until when. One form for the Deferrals page's New Deferral and the Donation
 * counter's Defer donor (project owner, 2026-10-24).
 *
 * The page using it decides what saving means and passes back the server's
 * answer: the Deferrals page records a deferral outside a visit, the counter
 * records the screening's deferral. A donor handed in is fixed; without one
 * the form searches the centre's Donors list.
 *
 * Emits `submit` with { donor, outcome, code, otherReason, from, until }, and
 * `close`.
 */

import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import { isoDaysFromToday } from '~/utils/appointments'
import { OTHER_DEFERRAL, deferralChoiceComplete, deferralCodeOptions } from '~/utils/deferralCodes'
import { DEFAULT_TEMPORARY_DAYS, DEFERRAL_TYPES, TEMPORARY, addDaysIso } from '~/utils/deferrals'
import { eligibilityBadge, formatPhone } from '~/utils/donorRecords'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

const props = defineProps({
  /** A fixed donor: { uuid?, name, code, bloodType, phone, standing? }. Null to search. */
  donor: { type: Object, default: null },
  /** Codes left out of the picker (the counter's vital-sign codes no reading suggests). */
  hiddenCodes: { type: Array, default: () => [] },
  /** A code to pre-select once the centre's codes have loaded, if offered. */
  suggestedCode: { type: String, default: null },
  /** From is the day of the visit and cannot be moved. */
  fixedFrom: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  error: { type: String, default: '' },
  /** The server's field errors, { field: [message] }. */
  errors: { type: Object, default: () => ({}) },
  title: { type: String, default: 'New Deferral' },
  submitLabel: { type: String, default: 'Save Deferral' },
})

const emit = defineEmits(['close', 'submit'])

const { can } = useUser()

const todayIso = isoDaysFromToday(0)

const form = reactive({
  donor: props.donor,
  outcome: TEMPORARY,
  code: '',
  otherReason: '',
  from: todayIso,
  until: addDaysIso(todayIso, DEFAULT_TEMPORARY_DAYS),
})

const isTemporary = computed(() => form.outcome === TEMPORARY)
const untilMin = computed(() => (form.from > todayIso ? form.from : todayIso))
const canSave = computed(() => Boolean(
  form.donor
  && form.outcome
  && deferralChoiceComplete(form.code, form.otherReason)
  && (!isTemporary.value || form.until),
))

function fieldError(field) {
  return props.errors?.[field]?.[0] ?? ''
}

function close() {
  if (!props.saving) emit('close')
}

function submit() {
  if (!canSave.value || props.saving) return
  emit('submit', {
    donor: form.donor,
    outcome: form.outcome,
    code: form.code,
    otherReason: form.otherReason,
    from: form.from,
    until: form.until,
  })
}

/** Keep the default length when the start moves, unless Until was already later. */
function onFromChange() {
  if (form.from && (!form.until || form.until < form.from)) {
    form.until = addDaysIso(form.from, DEFAULT_TEMPORARY_DAYS)
  }
}

/* ---------- the centre's codes ---------- */

const codes = reactive({ list: [], loading: false, error: '' })

const hidden = computed(() => new Set(props.hiddenCodes.map((code) => String(code).toLowerCase())))
const codeOptions = computed(() => deferralCodeOptions(codes.list.filter((c) => !hidden.value.has(c.code.toLowerCase()))))

async function loadCodes() {
  codes.loading = true
  codes.error = ''
  try {
    const res = await bloodCenterService.deferralCodes()
    codes.list = res?.data ?? []

    const suggested = props.suggestedCode?.toLowerCase()
    const match = suggested ? codeOptions.value.find((o) => o.value.toLowerCase() === suggested) : null
    if (match && !form.code) form.code = match.value
  } catch (err) {
    codes.error = err?.message || 'Could not load the deferral codes.'
  } finally {
    codes.loading = false
  }
}

/* ---------- donor search: the centre's own Donors list ---------- */

const donorSearch = reactive({ term: '', results: [], loading: false })
const searchError = ref('')

function mapCandidate(row) {
  return {
    uuid: row.uuid,
    name: row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' '),
    code: row.donor_code,
    bloodType: row.blood_type || '',
    phone: formatPhone(row.phone),
    standing: row.eligibility ? eligibilityBadge(row) : null,
  }
}

let donorTimer = null

function onDonorInput() {
  clearTimeout(donorTimer)
  const term = donorSearch.term.trim()
  if (term.length < 2) {
    donorSearch.results = []
    return
  }
  donorSearch.loading = true
  donorTimer = setTimeout(() => findDonors(term), 300)
}

/** Only a donor the centre has dealt with may be deferred here. */
async function findDonors(term) {
  try {
    const res = await bloodCenterService.donors({ search: term, per_page: 8 })
    if (donorSearch.term.trim() === term) donorSearch.results = (res?.data ?? []).map(mapCandidate)
  } catch (err) {
    donorSearch.results = []
    searchError.value = err?.message || 'Could not search donors.'
  } finally {
    donorSearch.loading = false
  }
}

function pickDonor(donor) {
  form.donor = donor
  donorSearch.term = ''
  donorSearch.results = []
  searchError.value = ''
}

/* ---------- keyboard and lifecycle ---------- */

function onKeydown(event) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  loadCodes()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(donorTimer)
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--rb-overlay);
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

.modal-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 600px;
  max-height: calc(100vh - 40px);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
}

.modal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.modal-card__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15.5px; font-weight: 700; }
.modal-card__title :deep(.asset-icon) { color: var(--rb-text-secondary); }

.modal-card__close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: none;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.modal-card__close:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }
.modal-card__body { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; overflow-y: auto; min-height: 0; }

.modal-card__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.btn-primary,
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.btn-primary { color: #fff; background: var(--rb-primary); border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

.btn-outline { color: var(--rb-text-primary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--rb-primary-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-link:hover { text-decoration: underline; }

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.btn-link:focus-visible,
.combo__option:focus-visible,
.modal-card__close:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.form-label { font-size: 12.5px; font-weight: 600; }
.req { color: var(--rb-accent-text); }
.form-hint { margin: 0; font-size: 12px; line-height: 1.45; color: var(--rb-text-secondary); }
.field-error { margin: 0; font-size: 12px; color: var(--rb-accent-text); }

.form-error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-accent-text);
  font-size: 13px;
  line-height: 1.45;
}

/* Anchored on the form root: other portals ship unscoped dark .form-input rules. */
.deferral-form .form-input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
  color-scheme: light dark;
}

.deferral-form .form-input::placeholder { color: var(--rb-placeholder); }
.deferral-form .form-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.deferral-form .form-textarea { height: auto; min-height: 64px; padding: 10px 12px; line-height: 1.5; resize: vertical; }

/* Search-and-pick for the donor. */
.combo { position: relative; }

.combo__list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 5;
  max-height: 260px;
  overflow-y: auto;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  box-shadow: 0 10px 24px rgba(var(--rb-shadow-rgb), 0.18);
}

.combo__option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  text-align: left;
  font-family: inherit;
  color: var(--rb-text-primary);
  cursor: pointer;
}

.combo__option:hover { background: var(--rb-surface-hover); }
.combo__main { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; text-transform: capitalize; }
.combo__sub { font-size: 11.5px; color: var(--rb-text-secondary); }
.combo__note { padding: 10px; font-size: 12.5px; line-height: 1.45; color: var(--rb-text-secondary); }

.picked {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface-alt);
}

.picked__text { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; }
.picked__name { font-size: 13.5px; font-weight: 700; text-transform: capitalize; }
.picked__meta { font-size: 12px; color: var(--rb-text-secondary); overflow-wrap: anywhere; }

.blood {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface-alt);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

/* The colour lives on the dot, never on the badge's fill. */
.badge {
  --tone: var(--rb-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}

.badge__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--tone); flex-shrink: 0; }
.badge--info { --tone: var(--rb-primary); }
.badge--ok { --tone: var(--rb-success); }
.badge--warn { --tone: var(--rb-warning); }
.badge--crit { --tone: var(--rb-accent); }
.badge--neutral { --tone: var(--rb-text-muted); color: var(--rb-text-secondary); }

.dfd-enter-active { transition: opacity 0.18s ease; }
.dfd-enter-from { opacity: 0; }

@media (max-width: 760px) {
  .form-row { grid-template-columns: 1fr; }
  .modal-overlay { padding: 10px; align-items: flex-end; }
}

@media (prefers-reduced-motion: reduce) {
  .dfd-enter-active { transition: none; }
}
</style>
