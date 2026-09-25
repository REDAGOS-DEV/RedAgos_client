<template>
  <div class="collection">
    <header class="collection__header">
      <div>
        <p class="collection__eyebrow">Donor / Collection</p>
        <h1 class="collection__title">Donation Counter</h1>
        <p class="collection__subtitle">
          Scan the donor once on arrival, then work through the visit without asking them to identify themselves again.
        </p>
      </div>

      <div v-if="facilityLabel" class="collection__facility">
        <AssetIcon name="building-2" :size="14" />
        {{ facilityLabel }}
      </div>
    </header>

    <!-- The verified context, held for the whole visit. -->
    <section v-if="donor" class="donor-bar" aria-label="Verified donor">
      <div class="donor-bar__identity">
        <span class="donor-bar__avatar">{{ initials }}</span>
        <div>
          <p class="donor-bar__name">{{ donor.full_name }}</p>
          <p class="donor-bar__meta">
            {{ donor.donor_code }}
            <template v-if="donor.blood_type"> · {{ donor.blood_type }}</template>
            <template v-if="donor.phone"> · {{ donor.phone }}</template>
          </p>
        </div>
      </div>

      <div class="donor-bar__facts">
        <div class="fact">
          <span class="fact__label">Appointment</span>
          <span class="fact__value">{{ appointmentLabel }}</span>
        </div>
        <div class="fact">
          <span class="fact__label">Status</span>
          <span class="pill" :class="appointmentPillClass">{{ appointment?.status_label || 'Walk-in' }}</span>
        </div>
        <div class="fact">
          <span class="fact__label">Donation</span>
          <span class="pill" :class="donationPillClass">{{ donation?.status_label || 'Not opened' }}</span>
        </div>
      </div>

      <button type="button" class="btn" :disabled="busy" @click="finishVisit">
        {{ stage === 'done' ? 'Next donor' : 'Cancel visit' }}
      </button>
    </section>

    <BloodCenterDonorQuestionnaireSummary
      v-if="donor"
      :meta="questionnaireMeta"
      :flagged-count="flaggedCount"
      :loading="questionnaireLoading"
      @open="openQuestionnaire"
      @refresh="refreshQuestionnaire"
    />

    <p v-if="questionnaireError" class="alert alert--error" role="alert">{{ questionnaireError }}</p>

    <BloodCenterDonorQuestionnaire
      v-if="questionnaireOpen && questionnaire"
      :data="questionnaire"
      @close="questionnaireOpen = false"
    />

    <!-- Progress through the one continuous transaction. -->
    <ol v-if="donor" class="steps" aria-label="Visit progress">
      <li v-for="step in steps" :key="step.key" class="step" :class="step.state">
        <span class="step__dot">
          <AssetIcon v-if="step.state === 'step--done'" name="check" :size="12" />
          <template v-else>{{ step.index }}</template>
        </span>
        <span class="step__label">{{ step.label }}</span>
      </li>
    </ol>

    <p v-if="error" class="alert alert--error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="alert alert--notice" role="status">{{ notice }}</p>

    <!-- STAGE 1 — the single scan -->
    <section v-if="stage === 'scan'" class="card">
      <h2 class="card__title">Verify the donor</h2>
      <p class="card__hint">
        One scan confirms who they are, which appointment they hold, and that it belongs to this facility.
      </p>

      <div class="scan-grid">
        <BloodCenterQrScanner
          ref="scannerRef"
          :busy="busy"
          @scanned="onScanned"
          @manual="manualOpen = true"
        />

        <div v-if="manualOpen" class="lookup">
          <h3 class="lookup__title">Look up by valid ID</h3>
          <p class="card__hint">Use this when the donor has no QR code, or the camera is unavailable.</p>

          <label class="field">
            <span class="field__label">Valid ID number</span>
            <input v-model="lookupValue" type="text" class="field__input" placeholder="e.g. PH-DL-12345" >
          </label>

          <button type="button" class="btn btn--primary" :disabled="busy || !lookupValue.trim()" @click="lookupDonor">
            {{ busy ? 'Searching…' : 'Find donor' }}
          </button>
          <p v-if="lookupError" class="alert alert--error">{{ lookupError }}</p>
        </div>
      </div>
    </section>

    <!-- STAGE 2 — check in and open the transaction -->
    <section v-else-if="stage === 'verified'" class="card">
      <h2 class="card__title">Start the donation</h2>
      <p class="card__hint">
        <template v-if="appointment">
          Mark the donor as arrived, then open their donation record.
        </template>
        <template v-else>
          This donor has no appointment booked here today. Opening a donation records them as a walk-in.
        </template>
      </p>

      <div class="actions">
        <button
          v-if="appointment && appointment.status === 'scheduled'"
          type="button"
          class="btn btn--primary"
          :disabled="busy"
          @click="checkIn"
        >
          Check in
        </button>

        <button type="button" class="btn btn--primary" :disabled="busy" @click="openDonation">
          {{ busy ? 'Working…' : 'Open donation' }}
        </button>

        <button v-if="appointment" type="button" class="btn" :disabled="busy" @click="markNoShow">
          Mark no-show
        </button>
      </div>
    </section>

    <!-- STAGE 3 — screening and pre-donation assessment -->
    <section v-else-if="stage === 'screening'" class="card">
      <h2 class="card__title">Screening &amp; pre-donation assessment</h2>
      <p class="card__hint">
        Record what the attending professional found. RedAgos stores this assessment — it does not perform or
        judge it, and no value here decides the outcome.
      </p>
      <p class="card__hint">
        This is your assessment. What the donor declared is under
        <strong>Review questionnaire</strong> above.
      </p>

      <div class="vitals">
        <label class="field">
          <span class="field__label">Systolic BP</span>
          <input v-model.number="screeningForm.systolic_bp" type="number" class="field__input" placeholder="mmHg" >
        </label>
        <label class="field">
          <span class="field__label">Diastolic BP</span>
          <input v-model.number="screeningForm.diastolic_bp" type="number" class="field__input" placeholder="mmHg" >
        </label>
        <label class="field">
          <span class="field__label">Pulse</span>
          <input v-model.number="screeningForm.pulse_bpm" type="number" class="field__input" placeholder="bpm" >
        </label>
        <label class="field">
          <span class="field__label">Temperature</span>
          <input v-model.number="screeningForm.temperature_c" type="number" step="0.1" class="field__input" placeholder="°C" >
        </label>
        <label class="field">
          <span class="field__label">Weight</span>
          <input v-model.number="screeningForm.weight_kg" type="number" class="field__input" placeholder="kg" >
        </label>
        <label class="field">
          <span class="field__label">Haemoglobin</span>
          <input v-model.number="screeningForm.haemoglobin_g_dl" type="number" step="0.1" class="field__input" placeholder="g/dL" >
        </label>
      </div>

      <label class="field">
        <span class="field__label">Notes <span class="field__optional">optional</span></span>
        <textarea v-model="screeningForm.notes" class="field__input" rows="2" maxlength="500" />
      </label>

      <div v-if="deferring" class="defer">
        <label class="field">
          <span class="field__label">Reason for deferral</span>
          <input
            v-model="screeningForm.deferral_reason"
            type="text"
            class="field__input"
            maxlength="255"
            placeholder="What the donor should be told"
          >
        </label>
        <p class="card__hint">The donor's visit ends here and their appointment closes.</p>
      </div>

      <div class="actions">
        <button
          v-if="!deferring"
          type="button"
          class="btn btn--primary"
          :disabled="busy"
          @click="submitScreening('qualified')"
        >
          {{ busy ? 'Saving…' : 'Qualified — continue' }}
        </button>

        <button v-if="!deferring" type="button" class="btn btn--danger" :disabled="busy" @click="deferring = true">
          Defer donor
        </button>

        <template v-else>
          <button
            type="button"
            class="btn btn--danger"
            :disabled="busy || !screeningForm.deferral_reason.trim()"
            @click="submitScreening('deferred')"
          >
            {{ busy ? 'Saving…' : 'Confirm deferral' }}
          </button>
          <button type="button" class="btn" :disabled="busy" @click="deferring = false">Back</button>
        </template>
      </div>
    </section>

    <!-- STAGE 4 — the collection -->
    <section v-else-if="stage === 'collection'" class="card">
      <h2 class="card__title">Record the collection</h2>
      <p class="card__hint">
        Recording the collection finishes the donor's visit. Clearing the blood for issue is a separate
        laboratory decision made later.
      </p>

      <label class="field field--narrow">
        <span class="field__label">Volume collected</span>
        <input v-model.number="collectionForm.volume_ml" type="number" class="field__input" placeholder="mL" >
        <span class="field__optional">A whole-blood bag is nominally 450 mL.</span>
      </label>

      <div class="actions">
        <button type="button" class="btn btn--primary" :disabled="busy || !validVolume" @click="submitCollection">
          {{ busy ? 'Saving…' : 'Complete donation' }}
        </button>

        <button type="button" class="btn btn--danger" :disabled="busy" @click="abandonCollection">
          Collection unsuccessful
        </button>
      </div>
    </section>

    <!-- STAGE 5 — done -->
    <section v-else-if="stage === 'done'" class="card">
      <div class="outcome" :class="isDeferred ? 'outcome--deferred' : 'outcome--success'">
        <AssetIcon :name="isDeferred ? 'circle-alert' : 'circle-check-big'" :size="26" />
        <div>
          <h2 class="card__title">{{ isDeferred ? 'Donor deferred' : 'Donation recorded' }}</h2>
          <p class="card__hint">
            <template v-if="isDeferred">
              {{ donation?.rejection_reason || 'The donor was not able to donate today.' }}
            </template>
            <template v-else>
              {{ donation?.volume_ml }} mL recorded. The donation is now with the laboratory, and the donor's
              history and last donation date are updated.
            </template>
          </p>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn btn--primary" @click="finishVisit">Next donor</button>
        <NuxtLink to="/blood-center/appointments" class="btn">Back to the queue</NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import BloodCenterQrScanner from '~/components/BloodCenter/QrScanner.vue'
import BloodCenterDonorQuestionnaire from '~/components/BloodCenter/DonorQuestionnaire.vue'
import BloodCenterDonorQuestionnaireSummary from '~/components/BloodCenter/DonorQuestionnaireSummary.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

/**
 * The counter's one continuous donation transaction.
 *
 * Every stage below reads the donor verified by the single scan at the top.
 * Nothing re-scans, and nothing asks the donor who they are twice — that was
 * the whole point of verifying the appointment, facility and identity together
 * in one call.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'donations.record',
})

const { user } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || '')

const service = bloodCenterService

const {
  donor, appointment, donation, stage, busy, error, notice, isDeferred,
  questionnaireMeta, questionnaire, questionnaireOpen, questionnaireError, questionnaireLoading,
  loadQuestionnaire,
  verifyQr, adoptDonor, checkIn, markNoShow, openDonation, recordScreening, recordCollection, reset,
} = useDonationTransaction()

const flaggedCount = computed(() => questionnaire.value?.flagged_codes?.length ?? 0)

/**
 * Fetch on first open and keep it for the visit.
 *
 * Nothing is requested until a staff member asks for it, which is why the scan
 * carries only metadata: the answers are fetched once, from an endpoint that
 * records who read them.
 */
async function openQuestionnaire() {
  const ok = await loadQuestionnaire()

  if (ok) questionnaireOpen.value = true
}

/**
 * Re-fetch for the donor who is filling it in on their phone at the counter.
 *
 * Without this, a donor who arrives having never answered would have to be
 * re-scanned before staff could see what they just submitted.
 */
async function refreshQuestionnaire() {
  const ok = await loadQuestionnaire(true)

  if (ok) questionnaireOpen.value = true
}

const scannerRef = ref(null)
const manualOpen = ref(false)
const lookupValue = ref('')
const lookupError = ref(null)
const deferring = ref(false)

const screeningForm = reactive({
  systolic_bp: null,
  diastolic_bp: null,
  pulse_bpm: null,
  temperature_c: null,
  weight_kg: null,
  haemoglobin_g_dl: null,
  notes: '',
  deferral_reason: '',
})

const collectionForm = reactive({ volume_ml: 450 })

const validVolume = computed(() => {
  const v = Number(collectionForm.volume_ml)

  return Number.isFinite(v) && v >= 100 && v <= 1000
})

const initials = computed(() => (donor.value?.full_name || '?')
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0].toUpperCase())
  .join(''))

const appointmentLabel = computed(() => {
  if (!appointment.value) return 'Walk-in'

  const when = new Date(appointment.value.appointment_datetime)

  return when.toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
})

const appointmentPillClass = computed(() => `pill--${appointment.value?.status || 'walkin'}`)
const donationPillClass = computed(() => `pill--${donation.value?.status || 'none'}`)

const steps = computed(() => {
  const order = ['verified', 'screening', 'collection', 'done']
  const labels = ['Verified', 'Screening', 'Collection', 'Complete']
  const current = order.indexOf(stage.value)

  return labels.map((label, i) => ({
    key: label,
    label,
    index: i + 1,
    state: i < current ? 'step--done' : i === current ? 'step--current' : 'step--todo',
  }))
})

async function onScanned(token) {
  const ok = await verifyQr(token)

  // A refused code leaves the camera running so the donor can simply try
  // again, but the scanner must forget it or the same frame re-submits.
  if (!ok) scannerRef.value?.reset()
  else scannerRef.value?.stop()
}

async function lookupDonor() {
  lookupError.value = null
  busy.value = true

  try {
    const found = await service.lookupDonor({ type: 'valid_id_number', value: lookupValue.value.trim() })

    adoptDonor({
      uuid: found.uuid,
      donor_code: found.donor_code,
      full_name: found.full_name,
      blood_type: found.blood_type ?? null,
      phone: found.phone ?? null,
    })

    manualOpen.value = false
    lookupValue.value = ''
  } catch (err) {
    lookupError.value = err?.status === 404
      ? 'No donor matches that ID. Register them as a new donor first.'
      : err?.message || 'The lookup failed. Try again.'
  } finally {
    busy.value = false
  }
}

async function submitScreening(outcome) {
  const payload = { outcome }

  // Only send what was actually measured: an empty field is missing data, not
  // a zero, and the column is nullable precisely so a partial record is honest.
  for (const key of ['systolic_bp', 'diastolic_bp', 'pulse_bpm', 'temperature_c', 'weight_kg', 'haemoglobin_g_dl']) {
    if (screeningForm[key] !== null && screeningForm[key] !== '') payload[key] = screeningForm[key]
  }

  if (screeningForm.notes.trim()) payload.notes = screeningForm.notes.trim()
  if (outcome === 'deferred') payload.deferral_reason = screeningForm.deferral_reason.trim()

  await recordScreening(payload)
  deferring.value = false
}

async function submitCollection() {
  await recordCollection({ volume_ml: Number(collectionForm.volume_ml) })
}

async function abandonCollection() {
  const reason = window.prompt('Why was the collection unsuccessful?')

  if (!reason?.trim()) return

  const result = await service.updateDonationStatus(donation.value.id, {
    status: 'rejected',
    rejection_reason: reason.trim(),
  }).catch((err) => {
    error.value = err?.message || 'The donation could not be closed.'
    return null
  })

  if (result) donation.value = result.data
}

function finishVisit() {
  reset()
  manualOpen.value = false
  deferring.value = false
  lookupValue.value = ''
  lookupError.value = null
  Object.assign(screeningForm, {
    systolic_bp: null, diastolic_bp: null, pulse_bpm: null,
    temperature_c: null, weight_kg: null, haemoglobin_g_dl: null,
    notes: '', deferral_reason: '',
  })
  collectionForm.volume_ml = 450
}
</script>

<style scoped>
.collection {
  /*
   * This page carried no page shell at all — only a 0.25rem block padding — so
   * its content ran flush into the layout's edges while every other
   * blood-centre page sat in a centred 1152px column with 32px gutters.
   */
  font-family: var(--rb-font-sans);
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.collection__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.collection__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rb-primary-text);
}

.collection__title {
  margin: 0.15rem 0 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--rb-text-primary);
}

.collection__subtitle {
  margin: 0.3rem 0 0;
  max-width: 62ch;
  font-size: 13px;
  color: var(--rb-text-secondary);
}

.collection__facility {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--rb-border);
  border-radius: 999px;
  background: var(--rb-surface);
  font-size: 0.78rem;
  color: var(--rb-text-secondary);
}

/* --- verified donor bar --- */
/*
 * Reads as pinned context rather than another content card: it sits on the
 * recessed surface the page background uses, so the white stage cards below
 * come forward without this needing an accent stripe to shout with.
 */
.donor-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 12px;
  background: var(--rb-surface-alt);
}

.donor-bar__identity {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
  flex: 1 1 14rem;
}

.donor-bar__avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 50%;
  background: rgba(var(--rb-primary-rgb), 0.12);
  color: var(--rb-primary-text);
  font-size: 0.8rem;
  font-weight: 700;
}

.donor-bar__name {
  margin: 0;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--rb-text-primary);
}

.donor-bar__meta {
  margin: 0.1rem 0 0;
  font-size: 0.78rem;
  color: var(--rb-text-secondary);
}

.donor-bar__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 1.1rem;
}

.fact { display: flex; flex-direction: column; gap: 0.25rem; }

.fact__label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.fact__value { font-size: 0.85rem; color: var(--rb-text-primary); }

.pill {
  display: inline-block;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 600;
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
  border: 1px solid var(--rb-border);
}

.pill--scheduled { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); border-color: transparent; }
.pill--confirmed,
.pill--screening { background: rgba(var(--rb-warning-rgb), 0.12); color: var(--rb-warning-text); border-color: transparent; }
.pill--completed,
.pill--collected { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); border-color: transparent; }
.pill--rejected { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); border-color: transparent; }

/* --- progress --- */
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; }

.step__dot {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 700;
  border: 1px solid var(--rb-border-strong);
  color: var(--rb-text-secondary);
}

.step--done .step__dot { background: var(--rb-success); border-color: var(--rb-success); color: #fff; }
.step--current .step__dot { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.step--done .step__label,
.step--current .step__label { color: var(--rb-text-primary); font-weight: 600; }
.step__label { color: var(--rb-text-secondary); }

/* --- cards --- */
.card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.1rem;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
}

.card__title { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--rb-text-primary); }

.card__hint {
  margin: 0;
  max-width: 68ch;
  font-size: 0.83rem;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.scan-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
}

@media (min-width: 820px) {
  .scan-grid { grid-template-columns: minmax(0, 22rem) minmax(0, 1fr); align-items: start; }
}

@media (max-width: 640px) {
  .collection {
    padding: 16px 16px 32px;
  }
}

.lookup {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  align-items: flex-start;
  padding: 0.9rem;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
}

.lookup__title { margin: 0; font-size: 0.92rem; font-weight: 700; color: var(--rb-text-primary); }

/* --- forms --- */
.vitals {
  display: grid;
  gap: 0.7rem;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
}

.field { display: flex; flex-direction: column; gap: 0.3rem; width: 100%; }
.field--narrow { max-width: 14rem; }

.field__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--rb-text-primary);
}

.field__optional { font-weight: 400; color: var(--rb-text-secondary); font-size: 0.72rem; }

.field__input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 0.85rem;
}

.field__input:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 1px;
  border-color: var(--rb-primary);
}

.defer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.8rem;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 10px;
  background: rgba(var(--rb-accent-rgb), 0.05);
}

/* --- actions --- */
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  border-radius: 10px;
  padding: 0.5rem 0.95rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}

.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }

.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rb-primary) 88%, #000);
  border-color: color-mix(in srgb, var(--rb-primary) 88%, #000);
}

.btn--danger { background: var(--rb-accent); border-color: var(--rb-accent); color: #fff; }
.btn--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rb-accent) 88%, #000);
  border-color: color-mix(in srgb, var(--rb-accent) 88%, #000);
}

/* --- feedback --- */
.alert {
  margin: 0;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  font-size: 0.84rem;
}

.alert--error {
  background: rgba(var(--rb-accent-rgb), 0.1);
  color: var(--rb-accent-text);
  border: 1px solid rgba(var(--rb-accent-rgb), 0.3);
}

.alert--notice {
  background: rgba(var(--rb-primary-rgb), 0.08);
  color: var(--rb-primary-text);
  border: 1px solid rgba(var(--rb-primary-rgb), 0.25);
}

.outcome { display: flex; align-items: flex-start; gap: 0.75rem; }
.outcome--success { color: var(--rb-success-text); }
.outcome--deferred { color: var(--rb-warning-text); }
.outcome .card__title { color: var(--rb-text-primary); }
</style>
