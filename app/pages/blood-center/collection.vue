<template>
  <div class="collection">
    <header class="collection__header">
      <div>
        <p class="collection__eyebrow">Collection</p>
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

    <BloodCenterPriorDeferralNotice v-if="priorDeferral" :deferral="priorDeferral" />

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
      :intake="intakeForm"
      :can-edit-intake="Boolean(donation)"
      @close="questionnaireOpen = false"
      @update-intake="(key, value) => { intakeForm[key] = value }"
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

      <!--
        Sleep, Meal, Meds and Allergies are not here. They are printed in the
        top margin of the donor's questionnaire sheet, so that is where staff
        fill them in — inside the drawer under Review questionnaire, which is
        the only part of that document the counter writes. They still travel to
        the server with this form, because they describe the visit it records.
      -->
      <p class="card__hint">
        Sleep, meal, meds and allergies are at the top of
        <strong>Review questionnaire</strong> above, where the form prints them.
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

      <!--
        Section II's small Hemoglobin / Blood Type table: both are fingerprick
        readings taken here, before the donor is bled. The blood type is
        preliminary — the Testing department's typing is the one that counts,
        and this never pre-fills it or reaches the donor's record.
      -->
      <fieldset class="exam">
        <legend class="exam__legend">Fingerprick blood type <span class="field__optional">optional</span></legend>
        <BloodCenterBloodTypePicker
          v-model="screeningForm.fingerprick_blood_type_id"
          :blood-types="bloodTypes"
          optional
        />
        <p class="exam__hint">
          Preliminary. The Testing department confirms the typing; this does not change the donor's blood type on record.
        </p>
      </fieldset>

      <!-- Observed, in the order the form prints them. -->
      <fieldset class="exam">
        <legend class="exam__legend">On examination</legend>
        <div class="vitals">
          <label class="field">
            <span class="field__label">General appearance</span>
            <input v-model="screeningForm.general_appearance" type="text" class="field__input" maxlength="255" >
          </label>
          <label class="field">
            <span class="field__label">Skin</span>
            <input v-model="screeningForm.skin" type="text" class="field__input" maxlength="255" >
          </label>
          <label class="field">
            <span class="field__label">HEENT</span>
            <input v-model="screeningForm.heent" type="text" class="field__input" maxlength="255" >
          </label>
          <label class="field">
            <span class="field__label">Heart and lungs</span>
            <input v-model="screeningForm.heart_and_lungs" type="text" class="field__input" maxlength="255" >
          </label>
        </div>
      </fieldset>

      <label class="field">
        <span class="field__label">Notes <span class="field__optional">optional</span></span>
        <textarea v-model="screeningForm.notes" class="field__input" rows="2" maxlength="500" />
      </label>

      <div v-if="deferring" class="defer">
        <!--
          Which of the form's three deferral boxes. They behave identically in
          the workflow; what differs is what the donor is told afterwards, so
          the choice has to be explicit rather than inferred.
        -->
        <fieldset class="defer__options">
          <legend class="field__label">Deferral</legend>
          <label v-for="option in deferralOptions" :key="option.value" class="defer__option">
            <input v-model="screeningForm.outcome" type="radio" :value="option.value" >
            <span>{{ option.label }}</span>
          </label>
        </fieldset>

        <label class="field">
          <span class="field__label">Reason</span>
          <input
            v-model="screeningForm.deferral_reason"
            type="text"
            class="field__input"
            maxlength="255"
            placeholder="What the donor should be told"
          >
        </label>

        <p class="card__hint">The donor's visit ends here and their appointment closes.</p>
        <p v-if="isBlockingChoice" class="card__hint card__hint--warn">
          The donor will not be invited to book again, and the next counter to scan
          them will see this deferral.
        </p>
      </div>

      <div class="actions">
        <button
          v-if="!deferring"
          type="button"
          class="btn btn--primary"
          :disabled="busy"
          @click="submitScreening('accepted')"
        >
          {{ busy ? 'Saving…' : 'Accepted — continue' }}
        </button>

        <button v-if="!deferring" type="button" class="btn btn--danger" :disabled="busy" @click="deferring = true">
          Defer donor
        </button>

        <template v-else>
          <button
            type="button"
            class="btn btn--danger"
            :disabled="busy || !screeningForm.deferral_reason.trim()"
            @click="submitScreening(screeningForm.outcome)"
          >
            {{ busy ? 'Saving…' : `Confirm — ${selectedDeferralLabel}` }}
          </button>
          <button type="button" class="btn" :disabled="busy" @click="deferring = false">Back</button>
        </template>
      </div>
    </section>

    <!-- STAGE 4 — the collection: Section II, "For Phlebotomist Use Only" -->
    <section v-else-if="stage === 'collection'" class="card">
      <h2 class="card__title">Record the collection</h2>
      <p class="card__hint">
        The phlebotomist's box on the form. Recording it finishes the donor's visit and hands the donation to the
        Testing department.
      </p>

      <fieldset class="exam">
        <legend class="exam__legend">Blood bag</legend>
        <div class="bags" role="radiogroup" aria-label="Blood bag">
          <label
            v-for="bag in bagTypes"
            :key="bag.value"
            class="bag"
            :class="{ 'bag--on': collectionForm.blood_bag_type === bag.value }"
          >
            <input v-model="collectionForm.blood_bag_type" type="radio" name="blood_bag_type" :value="bag.value" class="bag__radio" >
            <span class="bag__code" aria-hidden="true">{{ bag.code }}</span>
            <span class="bag__label">{{ bag.label }}</span>
          </label>
        </div>
      </fieldset>

      <div class="vitals">
        <label class="field">
          <span class="field__label">Segment number</span>
          <!--
            A barcode scanner types the number and presses Enter. Enter moves on
            to the next field rather than submitting half a record.
          -->
          <input
            ref="segmentInput"
            v-model="collectionForm.segment_number"
            type="text"
            class="field__input field__input--mono"
            autocomplete="off"
            spellcheck="false"
            autocapitalize="characters"
            maxlength="60"
            placeholder="Scan or type"
            @keydown.enter.prevent="startedInput?.focus()"
          >
        </label>

        <label class="field">
          <span class="field__label">Time started</span>
          <span class="time-row">
            <input ref="startedInput" v-model="collectionForm.started_time" type="time" class="field__input" >
            <button type="button" class="btn btn--small" @click="collectionForm.started_time = timeNow()">Now</button>
          </span>
        </label>

        <label class="field">
          <span class="field__label">Time ended</span>
          <span class="time-row">
            <input v-model="collectionForm.ended_time" type="time" class="field__input" >
            <button type="button" class="btn btn--small" @click="collectionForm.ended_time = timeNow()">Now</button>
          </span>
        </label>

        <label class="field">
          <span class="field__label">Volume collected</span>
          <input v-model.number="collectionForm.volume_ml" type="number" class="field__input" placeholder="mL" >
          <span class="field__optional">A whole-blood bag is nominally 450 mL.</span>
        </label>
      </div>

      <p class="card__hint">
        Phlebotomist: <strong>{{ phlebotomistName }}</strong> — recorded from your sign-in.
      </p>

      <ul v-if="collectionAttempted && collectionProblems.length" class="problems" role="alert">
        <li v-for="problem in collectionProblems" :key="problem">{{ problem }}</li>
      </ul>

      <div class="actions">
        <button type="button" class="btn btn--primary" :disabled="busy" @click="submitCollection">
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
              {{ donation?.volume_ml }} mL recorded. The donation is now with the Testing department, and the
              donor's history and last donation date are updated.
            </template>
          </p>
          <p v-if="!isDeferred && donation?.collection?.segment_number" class="done-facts">
            <span>Segment <strong class="mono">{{ donation.collection.segment_number }}</strong></span>
            <span v-if="donation.collection.blood_bag_type_label">
              {{ donation.collection.blood_bag_type_label }} bag
            </span>
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
import BloodCenterPriorDeferralNotice from '~/components/BloodCenter/PriorDeferralNotice.vue'
import BloodCenterBloodTypePicker from '~/components/BloodCenter/BloodTypePicker.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { atTimeOn, normalizeSegmentNumber, phlebotomyProblems, timeNow } from '~/utils/phlebotomy'

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
  priorDeferral, intakeForm,
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

/**
 * The form's three deferral boxes. Accepted is the primary action rather than
 * an option here, because it is the outcome that does not end the visit.
 */
const deferralOptions = [
  { value: 'temporarily_deferred', label: 'Temporarily Deferred' },
  { value: 'permanently_deferred', label: 'Permanently Deferred' },
  { value: 'indefinite_deferral', label: 'Indefinite Deferral' },
]

const BLOCKING_OUTCOMES = ['permanently_deferred', 'indefinite_deferral']

const isBlockingChoice = computed(() => BLOCKING_OUTCOMES.includes(screeningForm.outcome))

const selectedDeferralLabel = computed(() =>
  deferralOptions.find((o) => o.value === screeningForm.outcome)?.label ?? 'deferral')

const screeningForm = reactive({
  // Section I-D. The outcome lives on the form rather than being a bare
  // argument, now that there are four of them and three end the visit.
  outcome: 'temporarily_deferred',
  general_appearance: '',
  skin: '',
  heent: '',
  heart_and_lungs: '',
  systolic_bp: null,
  diastolic_bp: null,
  pulse_bpm: null,
  temperature_c: null,
  weight_kg: null,
  haemoglobin_g_dl: null,
  // Section II's fingerprick table. Preliminary; never adopted onto the donor.
  fingerprick_blood_type_id: null,
  notes: '',
  deferral_reason: '',
})

/**
 * Section II, "For Phlebotomist Use Only".
 *
 * No bag is pre-selected: single, double and triple decide what the bag can be
 * separated into, so it has to be a deliberate choice. The phlebotomist is not
 * a field at all — it is whoever is signed in.
 */
function blankCollection() {
  return { blood_bag_type: '', segment_number: '', started_time: '', ended_time: '', volume_ml: 450 }
}

const collectionForm = reactive(blankCollection())
const collectionAttempted = ref(false)
const collectionProblems = computed(() => phlebotomyProblems(collectionForm, new Date()))

const segmentInput = ref(null)
const startedInput = ref(null)

// Ready for the scanner the moment the collection stage opens.
watch(stage, (now) => {
  if (now === 'collection') nextTick(() => segmentInput.value?.focus())
})

const phlebotomistName = computed(() => user.value?.full_name
  || [user.value?.first_name, user.value?.last_name].filter(Boolean).join(' ')
  || 'You')

// From the reference data, with the form's three boxes as the fallback so the
// counter still works if that request fails.
const bloodTypes = ref([])
const bagTypes = ref([
  { value: 'single', label: 'Single', code: 'S' },
  { value: 'double', label: 'Double', code: 'D' },
  { value: 'triple', label: 'Triple', code: 'T' },
])

onMounted(async () => {
  try {
    const reference = await service.referenceData()

    bloodTypes.value = reference?.blood_types ?? []
    if (reference?.blood_bag_types?.length) bagTypes.value = reference.blood_bag_types
  } catch {
    // The fingerprick picker stays empty and optional; nothing else depends on it.
  }
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
    }, null, found.prior_deferral ?? null)

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

  // Section I-D free text: send only what was actually written, so a field the
  // officer tabbed past stays absent rather than becoming an empty string.
  for (const key of ['general_appearance', 'skin', 'heent', 'heart_and_lungs']) {
    if (screeningForm[key].trim()) payload[key] = screeningForm[key].trim()
  }

  // Filled in the questionnaire drawer, where the form prints them, and
  // carried here because they belong to the screening this call records.
  for (const key of ['sleep', 'meal', 'meds', 'allergies']) {
    if (intakeForm[key].trim()) payload[key] = intakeForm[key].trim()
  }

  if (screeningForm.notes.trim()) payload.notes = screeningForm.notes.trim()

  if (screeningForm.fingerprick_blood_type_id) {
    payload.fingerprick_blood_type_id = screeningForm.fingerprick_blood_type_id
  }

  // Any of the three deferrals carries a reason; only Accepted has none.
  if (outcome !== 'accepted') payload.deferral_reason = screeningForm.deferral_reason.trim()

  await recordScreening(payload)
  deferring.value = false
}

async function submitCollection() {
  collectionAttempted.value = true

  if (collectionProblems.value.length) return

  // The draw happens during the visit, so the two times are on today's date.
  const today = new Date()

  await recordCollection({
    volume_ml: Number(collectionForm.volume_ml),
    blood_bag_type: collectionForm.blood_bag_type,
    segment_number: normalizeSegmentNumber(collectionForm.segment_number),
    started_at: atTimeOn(today, collectionForm.started_time),
    ended_at: atTimeOn(today, collectionForm.ended_time),
  })
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
    outcome: 'temporarily_deferred',
    general_appearance: '', skin: '', heent: '', heart_and_lungs: '',
    systolic_bp: null, diastolic_bp: null, pulse_bpm: null,
    temperature_c: null, weight_kg: null, haemoglobin_g_dl: null,
    fingerprick_blood_type_id: null,
    notes: '', deferral_reason: '',
  })
  Object.assign(collectionForm, blankCollection())
  collectionAttempted.value = false
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

/* --- Section I-D groupings --- */
/*
 * Grouped rather than run together, so an officer working from the paper finds
 * the spoken answers, the readings and the findings where the form puts them.
 */
.exam {
  margin: 0;
  padding: 0.85rem 0.9rem 0.9rem;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.exam__legend {
  padding: 0 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.exam__hint {
  margin: 0;
  max-width: 68ch;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.defer__options {
  margin: 0;
  padding: 0;
  border: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
}

.defer__option {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--rb-text-primary);
  cursor: pointer;
}

.card__hint--warn {
  color: var(--rb-accent-text);
  font-weight: 600;
}

/* --- Section II, phlebotomist's box --- */
/*
 * The bag is a three-way choice printed on the form as (S) (D) (T), so it is
 * shown as three large targets carrying those letters rather than a dropdown.
 */
.bags {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.bag {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;
}

.bag:hover { border-color: var(--rb-border-hover); }

.bag--on {
  border-color: var(--rb-primary);
  background: rgba(var(--rb-primary-rgb), 0.06);
}

/* Visually hidden but still the focusable control, so keyboard users get the ring below. */
.bag__radio {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.bag:has(.bag__radio:focus-visible) {
  outline: 2px solid var(--rb-primary);
  outline-offset: 1px;
}

.bag__code {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 7px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--rb-text-secondary);
}

.bag--on .bag__code {
  background: var(--rb-primary);
  border-color: var(--rb-primary);
  color: #fff;
}

.bag__label { font-size: 0.85rem; font-weight: 600; color: var(--rb-text-primary); }

.time-row { display: flex; gap: 0.4rem; align-items: stretch; }
.time-row .field__input { min-width: 0; }

.btn--small { padding: 0.35rem 0.6rem; font-size: 0.78rem; border-radius: 8px; }

.field__input--mono,
.mono {
  font-family: var(--rb-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  letter-spacing: 0.02em;
}

.problems {
  margin: 0;
  padding: 0.6rem 0.85rem 0.6rem 1.9rem;
  border-radius: 10px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  border: 1px solid rgba(var(--rb-accent-rgb), 0.3);
  color: var(--rb-accent-text);
  font-size: 0.82rem;
  line-height: 1.55;
}

.done-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin: 0.45rem 0 0;
  font-size: 0.82rem;
  color: var(--rb-text-secondary);
}

.done-facts strong { color: var(--rb-text-primary); }

@media (max-width: 480px) {
  .bags { grid-template-columns: minmax(0, 1fr); }
}

</style>
