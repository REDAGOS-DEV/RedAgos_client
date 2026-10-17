<template>
  <div class="collection">
    <header class="collection__header">
      <div>
        <h1 class="collection__title">Donation</h1>
        <p class="collection__subtitle">
          Scan a booked donor's QR, or find a walk-in by name, email or phone. The rest of the visit carries on
          from there.
        </p>
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

    <!--
      How the donor came in, and their questionnaire. A booked donor brings the
      booking and the DHQ they answered in the Donor Portal, which the desk
      prints to travel with them; a walk-in answers the DHQ here.
    -->
    <section v-if="donor" class="visit" aria-label="Booking and questionnaire">
      <div class="visit__panel">
        <p class="visit__label">
          <AssetIcon :name="arrival === 'qr' ? 'qr-code' : 'user'" :size="14" />
          {{ arrival !== 'qr' ? 'Walk-in donor' : appointment ? 'Booked in the Donor Portal' : 'Donor Portal QR' }}
        </p>

        <dl v-if="appointment" class="visit__facts">
          <div>
            <dt>Appointment</dt>
            <dd>{{ longDateTime(appointment.appointment_datetime) }}</dd>
          </div>
          <div v-if="appointment.booked_at">
            <dt>Booked on</dt>
            <dd>{{ longDate(appointment.booked_at) }}</dd>
          </div>
          <div v-if="appointment.event">
            <dt>Donation drive</dt>
            <dd>
              {{ appointment.event.name }}
              <span v-if="appointment.event.location" class="visit__muted">· {{ appointment.event.location }}</span>
            </dd>
          </div>
          <div>
            <dt>Booking status</dt>
            <dd><span class="pill" :class="appointmentPillClass">{{ appointment.status_label }}</span></dd>
          </div>
        </dl>

        <p v-else class="visit__text">
          <template v-if="arrival === 'qr'">No appointment is booked here today. The donation opens as a walk-in.</template>
          <template v-else>No booking. Open the donation, then the donor completes the health questionnaire onsite.</template>
        </p>
      </div>

      <div class="visit__panel" :class="{ 'visit__panel--todo': !dhqOnFile }">
        <p class="visit__label">
          <AssetIcon name="clipboard-list" :size="14" />
          Health questionnaire (DHQ)
        </p>

        <template v-if="dhqOnFile">
          <p class="visit__text">
            <AssetIcon name="circle-check-big" :size="14" class="visit__ok" />
            {{ dhqSourceLine }}
          </p>
          <p class="visit__muted">
            Valid until {{ longDate(questionnaireMeta.valid_until) }}
            · {{ questionnaireMeta.consent_captured ? 'Consent given' : 'No consent on file' }}
          </p>
        </template>

        <template v-else>
          <p class="visit__text">
            <template v-if="questionnaireMeta?.available">
              The questionnaire on file is past its validity date. The donor answers it again onsite.
            </template>
            <template v-else-if="arrival === 'walk_in'">
              Not completed in RedAgos. The donor can answer it onsite here, or on the paper form.
            </template>
            <template v-else>
              Not completed in the Donor Portal. The donor can answer it onsite here, or on the paper form.
            </template>
          </p>
          <p v-if="canRecordQuestionnaire && !donation" class="visit__muted">
            Open the donation first. The questionnaire is recorded against this visit.
          </p>
        </template>

        <div class="visit__actions">
          <button
            v-if="canRecordQuestionnaire && !dhqOnFile"
            type="button"
            class="btn btn--primary btn--small"
            :disabled="!donation || isClosed"
            @click="onsiteOpen = true"
          >
            <AssetIcon name="clipboard-plus" :size="13" />
            Start DHQ onsite
          </button>

          <button
            v-if="canPrintQuestionnaire && questionnaireMeta?.available"
            type="button"
            class="btn btn--small"
            :class="{ 'btn--primary': dhqOnFile && arrival === 'qr' && !canReadQuestionnaire }"
            @click="printQuestionnaire"
          >
            <AssetIcon name="printer" :size="13" />
            Print DHQ
          </button>

          <button
            v-if="canRecordQuestionnaire && dhqOnFile && donation && !isClosed"
            type="button"
            class="btn btn--small btn--ghost"
            @click="onsiteOpen = true"
          >
            Answer again onsite
          </button>
        </div>
      </div>
    </section>

    <BloodCenterOnsiteQuestionnaire
      v-if="onsiteOpen && donor"
      :donor-uuid="donor.uuid"
      :donor-name="donor.full_name"
      @close="onsiteOpen = false"
      @recorded="onQuestionnaireRecorded"
    />

    <!--
      The donor's declared health answers are the physician's to read. The
      receptionist and the chair see that the visit exists, not what the donor
      declared.
    -->
    <BloodCenterDonorQuestionnaireSummary
      v-if="donor && canReadQuestionnaire"
      :meta="questionnaireMeta"
      :flagged-count="flaggedCount"
      :loading="questionnaireLoading"
      @open="openQuestionnaire"
      @refresh="refreshQuestionnaire"
    />

    <p v-if="questionnaireError" class="alert alert--error" role="alert">{{ questionnaireErrorText }}</p>

    <BloodCenterDonorQuestionnaire
      v-if="canReadQuestionnaire && questionnaireOpen && questionnaire"
      :data="questionnaire"
      :intake="intakeForm"
      :can-edit-intake="Boolean(donation)"
      @close="questionnaireOpen = false"
      @print="printQuestionnaire"
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

    <!--
      STAGE 1: who is at the counter. A donor who booked in the Donor Portal is
      scanned; a walk-in is found by name, email or phone.
    -->
    <div v-if="stage === 'scan'" class="checkin">
      <section class="card checkin__panel">
        <div class="checkin__head">
          <span class="checkin__icon" aria-hidden="true"><AssetIcon name="qr-code" :size="18" /></span>
          <div>
            <p class="checkin__eyebrow">Booked donor</p>
            <h2 class="card__title">Scan the Donor Portal QR</h2>
            <p class="card__hint">
              For donors who booked through the Donor Portal. The scan checks them in and brings up their booking
              and the health questionnaire they completed, ready to print.
            </p>
          </div>
        </div>

        <BloodCenterQrScanner
          ref="scannerRef"
          :busy="busy"
          :show-manual="false"
          @scanned="onScanned"
          @manual="focusLookup"
        />
      </section>

      <section class="card checkin__panel">
        <div class="checkin__head">
          <span class="checkin__icon" aria-hidden="true"><AssetIcon name="search" :size="18" /></span>
          <div>
            <p class="checkin__eyebrow">Walk-in donor</p>
            <h2 class="card__title">Find the donor</h2>
            <p class="card__hint">
              Search by name, email or phone number. Walk-in donors answer the health questionnaire here or on
              the paper form, before screening.
            </p>
          </div>
        </div>

        <form class="lookup" role="search" @submit.prevent="searchDonors">
          <label class="field">
            <span class="field__label">Name, email or phone number</span>
            <input
              ref="lookupInput"
              v-model="lookupValue"
              type="search"
              class="field__input"
              autocomplete="off"
              spellcheck="false"
              placeholder="e.g. Ana Cruz, ana@email.com or 0917 123 4567"
            >
          </label>

          <!-- Results come as you type; Enter searches at once. -->
          <p class="lookup__status" aria-live="polite">
            <template v-if="searching">Searching…</template>
            <template v-else-if="lookupValue.trim().length === 1">Keep typing: two letters or more.</template>
          </p>
        </form>

        <p v-if="lookupError" class="alert alert--error" role="alert">{{ lookupError }}</p>

        <div v-if="searchResults" class="results" aria-live="polite">
          <ul v-if="searchResults.length" class="results__list">
            <li v-for="result in searchResults" :key="result.uuid">
              <button type="button" class="result" :disabled="busy" @click="chooseDonor(result)">
                <span class="result__avatar" aria-hidden="true">{{ initialsOf(result.full_name) }}</span>
                <span class="result__body">
                  <span class="result__name">
                    {{ result.full_name }}
                    <span v-if="result.scope === 'cross_facility'" class="result__tag">New to this centre</span>
                  </span>
                  <span class="result__meta">{{ resultMeta(result) }}</span>
                  <span v-if="result.phone_hint || result.email_hint" class="result__meta">
                    {{ [result.phone_hint, result.email_hint].filter(Boolean).join(' · ') }}
                  </span>
                </span>
                <AssetIcon name="chevron-right" :size="16" class="result__go" />
              </button>
            </li>
          </ul>

          <p v-if="searchTruncated" class="results__note">
            Showing the first {{ searchResults.length }} matches. Type more of the name to narrow it down.
          </p>

          <div v-if="!searchResults.length" class="results__empty">
            <p>No donor matches “{{ searchedFor }}”.</p>
            <p class="results__note">
              A donor from another centre is found by their exact email or phone number.
              <template v-if="canRegisterDonor">
                Someone new to RedAgos is registered on the
                <NuxtLink to="/blood-center/donors" class="results__link">Donors page</NuxtLink> first.
              </template>
            </p>
          </div>
        </div>

        <div v-else class="checkin__checks">
          <p class="checkin__checks-title">For a walk-in, the counter then</p>
          <ol>
            <li><span class="checkin__n">1</span> Opens the donation</li>
            <li><span class="checkin__n">2</span> Hands the donor the device to complete the DHQ onsite</li>
            <li><span class="checkin__n">3</span> Sends them to the physician for screening</li>
          </ol>
        </div>
      </section>
    </div>

    <!-- STAGE 2 — check in and open the transaction -->
    <section v-if="stage === 'verified'" class="card">
      <h2 class="card__title">Start the donation</h2>
      <p class="card__hint">
        <template v-if="appointment?.status === 'confirmed'">
          The donor is checked in. Open their donation record to continue.
        </template>
        <template v-else-if="appointment">
          Mark the donor as arrived, then open their donation record.
        </template>
        <template v-else>
          This donor has no appointment booked here today. Opening a donation records them as a walk-in; then hand
          them the device to complete the health questionnaire onsite.
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

        <button v-if="canRegister" type="button" class="btn btn--primary" :disabled="busy" @click="openDonation">
          {{ busy ? 'Working…' : 'Open donation' }}
        </button>

        <button v-if="appointment" type="button" class="btn" :disabled="busy" @click="markNoShow">
          Mark no-show
        </button>
      </div>

      <p v-if="!canRegister" class="handoff" role="status">
        <AssetIcon name="clock" :size="14" />
        The donation is opened at the reception desk. Send the donor there first.
      </p>
    </section>

    <!-- STAGE 3, for anyone but the physician — waiting to be screened. -->
    <section v-else-if="stage === 'screening' && !canScreen" class="card">
      <h2 class="card__title">Awaiting screening</h2>
      <p class="handoff" role="status">
        <AssetIcon name="clock" :size="14" />
        The donation is open. The screening physician examines the donor and accepts or defers them before
        anything else can be recorded.
      </p>
      <div class="actions">
        <button type="button" class="btn" @click="finishVisit">Next donor</button>
      </div>
    </section>

    <!-- STAGE 3 — screening and pre-donation assessment -->
    <section v-else-if="stage === 'screening' || correcting === 'screening'" class="card">
      <h2 class="card__title">
        {{ correcting === 'screening' ? 'Correct the screening' : 'Screening & pre-donation assessment' }}
      </h2>
      <p v-if="correcting === 'screening'" class="handoff" role="status">
        <AssetIcon name="pencil" :size="14" />
        This screening is already saved. Change what was entered wrongly; the corrected record goes to the Center
        Admin to approve.
      </p>
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

      <!--
        The onsite DHQ is optional (project owner, 2026-10-17): the donor may
        answer the printed form instead. With none on file, accepting needs the
        physician to say the paper one was answered, and the screening records
        it. Deferring never waits on it -- a donor can be turned away on what
        the examination found.
      -->
      <label v-if="!deferring && needsQuestionnaire" class="handoff handoff--warn paper-dhq">
        <input v-model="dhqOnPaper" type="checkbox" class="paper-dhq__check">
        <span>
          <strong>The donor answered the paper DHQ.</strong>
          No questionnaire is on file in RedAgos. Tick this if they filled in the printed form, or have them
          answer it under <strong>Start DHQ onsite</strong> above instead.
        </span>
      </label>

      <div class="actions">
        <button
          v-if="!deferring"
          type="button"
          class="btn btn--primary"
          :disabled="busy || (needsQuestionnaire && !dhqOnPaper)"
          @click="submitScreening('accepted')"
        >
          {{ busy ? 'Saving…' : correcting === 'screening' ? 'Request correction — accepted' : 'Accepted — continue' }}
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

        <button v-if="correcting === 'screening'" type="button" class="btn" :disabled="busy" @click="correcting = null">
          Cancel correction
        </button>
      </div>
    </section>

    <!-- STAGE 4, for anyone but the chair — accepted and waiting to be bled. -->
    <section v-else-if="stage === 'collection' && !canCollect" class="card">
      <h2 class="card__title">Accepted — awaiting collection</h2>
      <p class="handoff" role="status">
        <AssetIcon name="clock" :size="14" />
        The donor has been accepted. The phlebotomist records the bag, barcode and times at the chair.
      </p>
      <div class="actions">
        <button type="button" class="btn" @click="finishVisit">Next donor</button>
        <button v-if="canScreen && donation?.screening" type="button" class="btn" @click="startScreeningCorrection">
          <AssetIcon name="pencil" :size="13" />
          Correct the screening
        </button>
      </div>
    </section>

    <!-- STAGE 4 — the collection: Section II, "For Phlebotomist Use Only" -->
    <section v-else-if="stage === 'collection' || correcting === 'collection'" class="card">
      <h2 class="card__title">{{ correcting === 'collection' ? 'Correct the collection record' : 'Record the collection' }}</h2>
      <p v-if="correcting === 'collection'" class="handoff" role="status">
        <AssetIcon name="pencil" :size="14" />
        This record is already saved. Change what was entered wrongly; the corrected record goes to the Donor
        Screening Physician to approve.
      </p>
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
          <span class="field__label">Donation barcode (sticker)</span>
          <!--
            The pre-printed sticker that goes on the form, every bag and tube,
            and the CUE slip. A barcode scanner types the number and presses
            Enter; Enter moves on to the next field rather than submitting half
            a record.
          -->
          <input
            ref="barcodeInput"
            v-model="collectionForm.donation_barcode"
            type="text"
            class="field__input field__input--mono"
            autocomplete="off"
            spellcheck="false"
            autocapitalize="characters"
            maxlength="30"
            placeholder="Scan the sticker"
            @keydown.enter.prevent="startedInput?.focus()"
          >
          <span class="field__optional">From the donor's barcode sticker sheet.</span>
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
          {{ busy ? 'Saving…' : correcting === 'collection' ? 'Request correction' : 'Complete donation' }}
        </button>

        <button v-if="canClose && correcting !== 'collection'" type="button" class="btn btn--danger" :disabled="busy" @click="abandonCollection">
          Collection unsuccessful
        </button>

        <button v-if="correcting === 'collection'" type="button" class="btn" :disabled="busy" @click="correcting = null">
          Cancel correction
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
            <!-- The reason is only served to the physician. -->
            <template v-if="isDeferred">
              {{ donation?.rejection_reason || 'The donor was not able to donate today.' }}
            </template>
            <template v-else>
              {{ donation?.volume_ml }} mL recorded. The donation is now with the Testing department, and the
              donor's history and last donation date are updated.
            </template>
          </p>
          <p v-if="!isDeferred && donation?.collection?.donation_barcode" class="done-facts">
            <span>Barcode <strong class="mono">{{ donation.collection.donation_barcode }}</strong></span>
            <span v-if="donation.collection.blood_bag_type_label">
              {{ donation.collection.blood_bag_type_label }} bag
            </span>
          </p>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn btn--primary" @click="finishVisit">Next donor</button>
        <NuxtLink to="/blood-center/appointments" class="btn">Back to the queue</NuxtLink>
        <button
          v-if="canCollect && !isDeferred && donation?.collection"
          type="button"
          class="btn"
          @click="startCollectionCorrection"
        >
          <AssetIcon name="pencil" :size="13" />
          Request a correction
        </button>
      </div>
    </section>

    <!-- A saved record is never saved over: the corrected values go for approval. -->
    <BloodCenterCorrectionRequestDialog
      v-if="correction && donation"
      :donation-id="donation.id"
      :subject="correction.subject"
      :changes="correction.changes"
      :previous="correction.previous"
      @close="correction = null"
      @submitted="onCorrectionSent"
    />
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import BloodCenterQrScanner from '~/components/BloodCenter/QrScanner.vue'
import BloodCenterDonorQuestionnaire from '~/components/BloodCenter/DonorQuestionnaire.vue'
import BloodCenterDonorQuestionnaireSummary from '~/components/BloodCenter/DonorQuestionnaireSummary.vue'
import BloodCenterPriorDeferralNotice from '~/components/BloodCenter/PriorDeferralNotice.vue'
import BloodCenterBloodTypePicker from '~/components/BloodCenter/BloodTypePicker.vue'
import BloodCenterCorrectionRequestDialog from '~/components/BloodCenter/CorrectionRequestDialog.vue'
import BloodCenterOnsiteQuestionnaire from '~/components/BloodCenter/OnsiteQuestionnaire.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { questionnaireOnFile } from '~/composables/useDonationTransaction'
import { atTimeOn, normalizeBarcode, phlebotomyProblems, timeNow } from '~/utils/phlebotomy'

/**
 * The Donation page: the counter's one continuous donation transaction.
 *
 * A donor is identified once, at the top: a booked donor by the QR from the
 * Donor Portal, a walk-in by name, email or phone. Every stage below reads that
 * donor. Nothing re-scans, and nothing asks the donor who they are twice.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // Any one of COLLECTION_ABILITIES in useBloodCenterNav — spelled out because
  // the page meta is extracted before imports resolve.
  requires: ['donations.register', 'donations.screen', 'donations.collect'],
})

const { user, can } = useUser()

// One page, three roles. Each stage renders its form only for the role that
// performs it, and a hand-off card for everyone else; the server refuses the
// write regardless.
const canRegister = computed(() => can('donations.register'))
const canScreen = computed(() => can('donations.screen'))
const canCollect = computed(() => can('donations.collect'))
const canClose = computed(() => can('donations.close'))
const canReadQuestionnaire = computed(() => can('donors.view_questionnaire'))
// The desk prints the completed DHQ and hands a walk-in the device to answer
// it; neither is the physician's review read above.
const canPrintQuestionnaire = computed(() => can('donors.print_questionnaire'))
const canRecordQuestionnaire = computed(() => can('donors.record_questionnaire'))
const canRegisterDonor = computed(() => can('donors.manage'))

const service = bloodCenterService

const {
  donor, arrival, appointment, donation, stage, busy, error, notice, isDeferred,
  priorDeferral, intakeForm,
  questionnaireMeta, questionnaire, questionnaireOpen, questionnaireError, questionnaireLoading,
  loadQuestionnaire, adoptQuestionnaireReference,
  verifyQr, adoptDonor, checkIn, markNoShow, openDonation, recordScreening, recordCollection, reset,
} = useDonationTransaction()

const dhqOnFile = computed(() => questionnaireOnFile(questionnaireMeta.value))

// No questionnaire on file, outside a correction to a screening already saved.
// The onsite one is optional: accepting then needs the physician to confirm
// the donor answered the paper DHQ (dhqOnPaper), which the screening records.
const needsQuestionnaire = computed(() => !dhqOnFile.value && correcting.value !== 'screening')
const dhqOnPaper = ref(false)

// A different donor, or one whose questionnaire has since arrived, starts unticked.
watch([() => donor.value?.uuid, dhqOnFile], () => { dhqOnPaper.value = false })

const isClosed = computed(() => stage.value === 'done')

const dhqSourceLine = computed(() => {
  const on = longDate(questionnaireMeta.value?.screened_on)

  return questionnaireMeta.value?.completed_via === 'counter'
    ? `Completed onsite on ${on}.`
    : `Completed in the Donor Portal on ${on}.`
})

const onsiteOpen = ref(false)

function onQuestionnaireRecorded(reference) {
  onsiteOpen.value = false
  adoptQuestionnaireReference(reference)
  notice.value = 'Health questionnaire recorded. The screening physician can review it now.'
}

/**
 * The completed DHQ on its own A4 page, in a new tab that prints itself.
 *
 * The scan's pin goes with it, so the sheet is the questionnaire the scan
 * verified rather than whichever the server would pick.
 */
function printQuestionnaire() {
  if (!donor.value) return

  const query = new URLSearchParams({ auto: '1' })
  if (questionnaireMeta.value?.screening_id) query.set('screening_id', String(questionnaireMeta.value.screening_id))

  window.open(`/blood-center/dhq-print/${donor.value.uuid}?${query}`, '_blank')
}

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
const lookupInput = ref(null)
const manualOpen = ref(false)

function focusLookup() {
  lookupInput.value?.focus()
}

/**
 * Display only. A server that cannot decrypt the stored answers says
 * "The MAC is invalid", which means nothing at the counter.
 */
const questionnaireErrorText = computed(() => {
  const message = questionnaireError.value || ''

  return /MAC is invalid|payload is invalid/i.test(message)
    ? "The donor's questionnaire answers can't be read right now. Ask your administrator to check the server's encryption key."
    : message
})
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
  return { blood_bag_type: '', donation_barcode: '', started_time: '', ended_time: '', volume_ml: 450 }
}

const collectionForm = reactive(blankCollection())
const collectionAttempted = ref(false)
const collectionProblems = computed(() => phlebotomyProblems(collectionForm, new Date()))

const barcodeInput = ref(null)
const startedInput = ref(null)

// Ready for the scanner the moment the collection stage opens.
watch(stage, (now) => {
  if (now === 'collection') nextTick(() => barcodeInput.value?.focus())
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

/*
 * The questionnaire is a step of its own between opening the visit and the
 * screening, done whenever one is on file. While it is missing at the
 * screening stage it is the current step, not the screening.
 */
const steps = computed(() => {
  const order = ['verified', 'screening', 'collection', 'done']
  const labels = ['Verified', 'Screening', 'Collection', 'Complete']
  const current = order.indexOf(stage.value)
  const waitingOnDhq = stage.value === 'screening' && !dhqOnFile.value

  const flow = labels.map((label, i) => ({
    key: label,
    label,
    state: i < current ? 'step--done'
      : i === current && !waitingOnDhq ? 'step--current'
        : 'step--todo',
  }))

  flow.splice(1, 0, {
    key: 'dhq',
    label: 'Questionnaire',
    state: dhqOnFile.value ? 'step--done' : waitingOnDhq ? 'step--current' : 'step--todo',
  })

  return flow.map((step, i) => ({ ...step, index: i + 1 }))
})

async function onScanned(token) {
  const ok = await verifyQr(token)

  // A refused code leaves the camera running so the donor can simply try
  // again, but the scanner must forget it or the same frame re-submits.
  if (!ok) scannerRef.value?.reset()
  else scannerRef.value?.stop()
}

// --- walk-ins: find the donor -----------------------------------------------
//
// Names reach only this centre's own donors; another centre's donor is found
// by their exact email or phone (CounterDonorSearchService on the server).

const searching = ref(false)
const searchResults = ref(null)
const searchTruncated = ref(false)
const searchedFor = ref('')

// Search as the staff member types (project owner, 2026-10-17): a short pause
// after the last key, from two characters. Only the newest search may write
// its results, so a slow answer to "an" never lands over the one for "ana cruz".
const SEARCH_DELAY_MS = 300
let searchTimer = null
let searchSeq = 0

async function searchDonors() {
  clearTimeout(searchTimer)
  const q = lookupValue.value.trim()

  if (busy.value || q.length < 2 || q === searchedFor.value) return

  const mine = ++searchSeq
  lookupError.value = null
  searching.value = true

  try {
    const result = await service.searchCounterDonors(q)
    if (mine !== searchSeq) return

    searchResults.value = result?.data ?? []
    searchTruncated.value = Boolean(result?.truncated)
    searchedFor.value = q
  } catch (err) {
    if (mine !== searchSeq) return

    searchResults.value = null
    lookupError.value = err?.status === 429
      ? 'Too many searches just now. Wait a moment and try again.'
      : err?.message || 'The search failed. Try again.'
  } finally {
    if (mine === searchSeq) searching.value = false
  }
}

/**
 * Adopt the donor the staff member picked.
 *
 * Through the exact lookup by donor code rather than straight from the search
 * row: it is what carries the standing-deferral notice and whether a
 * questionnaire is on file, and it records which donor was chosen.
 */
async function chooseDonor(result) {
  lookupError.value = null
  busy.value = true

  try {
    const found = await service.lookupDonor({ type: 'donor_code', value: result.donor_code })

    adoptDonor({
      uuid: found.uuid,
      donor_code: found.donor_code,
      full_name: found.full_name,
      blood_type: found.blood_type ?? null,
      phone: found.phone ?? null,
    }, null, found.prior_deferral ?? null, found.health_questionnaire ?? null)

    manualOpen.value = false
    clearSearch()
  } catch (err) {
    lookupError.value = err?.status === 404
      ? 'That donor could not be found any more. Search again.'
      : err?.message || 'The donor could not be opened. Try again.'
  } finally {
    busy.value = false
  }
}

function clearSearch() {
  clearTimeout(searchTimer)
  searchSeq++
  searching.value = false
  lookupValue.value = ''
  searchResults.value = null
  searchTruncated.value = false
  searchedFor.value = ''
}

// Every change to the box searches again after a short pause. The previous
// results stay until the new ones arrive, rather than blinking out per key;
// under two characters there is nothing to search, so they are cleared.
watch(lookupValue, (value) => {
  clearTimeout(searchTimer)

  if (value.trim().length < 2) {
    searchSeq++
    searching.value = false
    searchResults.value = null
    searchedFor.value = ''
    return
  }

  searchTimer = setTimeout(searchDonors, SEARCH_DELAY_MS)
})

onBeforeUnmount(() => clearTimeout(searchTimer))

function initialsOf(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/** DONOR-000012 · 30 y · O+ — enough to tell two people of one name apart. */
function resultMeta(result) {
  const parts = [result.donor_code]
  const age = ageFrom(result.birth_date)

  if (age !== null) parts.push(`${age} y`)
  if (result.blood_type) parts.push(result.blood_type)

  return parts.join(' · ')
}

function ageFrom(birthDate) {
  if (!birthDate) return null

  const born = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(born.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - born.getFullYear()
  if (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) age -= 1

  return age
}

function longDate(value) {
  if (!value) return '—'

  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)

  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

function longDateTime(value) {
  if (!value) return '—'

  const d = new Date(value)

  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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

  // The donor answered the printed DHQ: recorded on the screening.
  if (needsQuestionnaire.value && dhqOnPaper.value) payload.dhq_on_paper = true

  if (correcting.value === 'screening') {
    correction.value = { subject: 'screening', changes: payload, previous: donation.value?.screening ?? null }
    deferring.value = false
    return
  }

  await recordScreening(payload)
  deferring.value = false
}

async function submitCollection() {
  collectionAttempted.value = true

  if (collectionProblems.value.length) return

  // The draw happens during the visit, so the two times are on today's date —
  // or, for a correction, on the day it was drawn.
  const saved = donation.value?.collection
  const day = correcting.value === 'collection' && saved?.started_at ? new Date(saved.started_at) : new Date()

  const payload = {
    volume_ml: Number(collectionForm.volume_ml),
    blood_bag_type: collectionForm.blood_bag_type,
    donation_barcode: normalizeBarcode(collectionForm.donation_barcode),
    started_at: atTimeOn(day, collectionForm.started_time),
    ended_at: atTimeOn(day, collectionForm.ended_time),
  }

  if (correcting.value === 'collection') {
    correction.value = {
      subject: 'collection',
      changes: payload,
      previous: saved ? {
        volume_ml: donation.value.volume_ml,
        blood_bag_type: saved.blood_bag_type,
        donation_barcode: saved.donation_barcode,
        started_at: saved.started_at,
        ended_at: saved.ended_at,
      } : null,
    }
    return
  }

  await recordCollection(payload)
}

// --- corrections ----------------------------------------------------------------
//
// Once saved, the screening and the collection box are never saved over. The
// same form reopens, and what it would have saved goes as a correction request.

const correcting = ref(null)
const correction = ref(null)

function hhmm(iso) {
  if (!iso) return ''

  const date = new Date(iso)

  return Number.isNaN(date.getTime())
    ? ''
    : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function startScreeningCorrection() {
  const saved = donation.value?.screening ?? {}

  for (const key of Object.keys(screeningForm)) {
    if (key in saved && saved[key] !== undefined) screeningForm[key] = saved[key] ?? (typeof screeningForm[key] === 'string' ? '' : null)
  }

  deferring.value = false
  correcting.value = 'screening'
}

function startCollectionCorrection() {
  const saved = donation.value?.collection ?? {}

  Object.assign(collectionForm, {
    blood_bag_type: saved.blood_bag_type ?? '',
    donation_barcode: saved.donation_barcode ?? '',
    started_time: hhmm(saved.started_at),
    ended_time: hhmm(saved.ended_at),
    volume_ml: donation.value?.volume_ml ?? 450,
  })

  collectionAttempted.value = false
  correcting.value = 'collection'
}

function onCorrectionSent(response) {
  correction.value = null
  correcting.value = null
  notice.value = response?.message ?? 'Correction requested.'
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
  correcting.value = null
  correction.value = null
  manualOpen.value = false
  deferring.value = false
  onsiteOpen.value = false
  clearSearch()
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
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.handoff {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0.5rem 0 0;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
  font-size: 13.5px;
  line-height: 1.45;
}

.collection__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
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
  font-size: 13px;
  font-weight: 700;
}

.donor-bar__name {
  margin: 0;
  font-weight: 700;
  font-size: 15px;
  color: var(--rb-text-primary);
}

.donor-bar__meta {
  margin: 0.1rem 0 0;
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.donor-bar__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 1.1rem;
}

.fact { display: flex; flex-direction: column; gap: 0.25rem; }

.fact__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.fact__value { font-size: 13.5px; color: var(--rb-text-primary); }

.pill {
  display: inline-block;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 12px;
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

.step { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 13px; }

.step__dot {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 11px;
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

.card__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }

.card__hint {
  margin: 0;
  max-width: 68ch;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

/* --- stage 1: check-in --- */
.checkin {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}

.checkin__panel { gap: 16px; }

.checkin__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.checkin__head .card__hint { margin-top: 2px; }

.checkin__icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--rb-primary) 12%, transparent);
  color: var(--rb-primary-text);
}

.lookup {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

/* Holds its line even when empty, so results do not jump as it fills. */
.lookup__status {
  min-height: 18px;
  margin: -4px 0 0;
  font-size: 12px;
  color: var(--rb-text-secondary);
}

.checkin__checks {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--rb-border);
}

.checkin__checks-title {
  margin: 0 0 8px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.checkin__checks ol {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.checkin__checks li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.checkin__n {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: none;
  border-radius: 50%;
  border: 1px solid var(--rb-border-strong);
  font-size: 11px;
  font-weight: 700;
  color: var(--rb-text-secondary);
}

.checkin__eyebrow {
  margin: 0 0 2px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-primary-text);
}

/* --- walk-in search results --- */
.results { display: flex; flex-direction: column; gap: 8px; }

.results__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  overflow: hidden;
}

.results__list li + li { border-top: 1px solid var(--rb-border); }

.result {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 140ms ease;
}

.result:hover:not(:disabled) { background: var(--rb-surface-hover); }
.result:disabled { opacity: 0.55; cursor: not-allowed; }
.result:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: -2px; }

.result__avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 50%;
  background: rgba(var(--rb-primary-rgb), 0.12);
  color: var(--rb-primary-text);
  font-size: 12px;
  font-weight: 700;
}

.result__body { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }

.result__name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
}

.result__tag {
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(var(--rb-warning-rgb), 0.14);
  color: var(--rb-warning-text);
  font-size: 11px;
  font-weight: 600;
}

.result__meta { font-size: 12px; color: var(--rb-text-secondary); }
.result__go { color: var(--rb-text-secondary); flex: none; }

.results__note { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }

.results__empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px dashed var(--rb-border-strong);
  border-radius: 10px;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.results__empty p { margin: 0; }

.results__link { color: var(--rb-primary-text); font-weight: 600; }

/* --- booking and questionnaire --- */
.visit {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.visit__panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0.9rem 1rem;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
}

.visit__panel--todo {
  border-color: rgba(var(--rb-warning-rgb), 0.45);
  background: rgba(var(--rb-warning-rgb), 0.06);
}

.visit__label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.visit__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 8px 16px;
  margin: 0;
}

.visit__facts dt { font-size: 11.5px; color: var(--rb-text-secondary); }
.visit__facts dd { margin: 2px 0 0; font-size: 13.5px; color: var(--rb-text-primary); }

.visit__text {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--rb-text-primary);
}

.visit__ok { color: var(--rb-success); flex: none; margin-top: 2px; }
.visit__muted { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.visit__actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; padding-top: 2px; }
.visit__actions .btn { gap: 6px; }

/* --- forms --- */
.vitals {
  display: grid;
  gap: 0.7rem;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
}

.field { display: flex; flex-direction: column; gap: 0.3rem; width: 100%; }
.field--narrow { max-width: 14rem; }

.field__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-primary);
}

.field__optional { font-weight: 400; color: var(--rb-text-secondary); font-size: 11.5px; }

.field__input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13.5px;
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
  font-size: 13.5px;
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
  font-size: 13.5px;
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
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.exam__hint {
  margin: 0;
  max-width: 68ch;
  font-size: 12.5px;
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
  font-size: 13.5px;
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
  font-size: 12.5px;
  font-weight: 700;
  color: var(--rb-text-secondary);
}

.bag--on .bag__code {
  background: var(--rb-primary);
  border-color: var(--rb-primary);
  color: #fff;
}

.bag__label { font-size: 13.5px; font-weight: 600; color: var(--rb-text-primary); }

.time-row { display: flex; gap: 0.4rem; align-items: stretch; }
.time-row .field__input { min-width: 0; }

.btn--small { padding: 0.35rem 0.6rem; font-size: 12.5px; border-radius: 8px; }

.btn--ghost { border-color: transparent; background: transparent; color: var(--rb-primary-text); }
.btn--ghost:hover:not(:disabled) { background: rgba(var(--rb-primary-rgb), 0.08); border-color: transparent; }

.handoff--warn {
  border-color: rgba(var(--rb-warning-rgb), 0.4);
  background: rgba(var(--rb-warning-rgb), 0.08);
  color: var(--rb-warning-text);
}

/* The paper-DHQ confirmation: the whole notice is the tick's label. */
.paper-dhq { cursor: pointer; line-height: 1.45; }
.paper-dhq strong { color: var(--rb-text-primary); }
.paper-dhq__check { flex-shrink: 0; width: 16px; height: 16px; margin-top: 2px; accent-color: var(--rb-primary); cursor: pointer; }
.paper-dhq:focus-within { box-shadow: var(--rb-focus-ring); }

.field__input--mono,
.mono {
  font-family: var(--rb-font-mono);
  letter-spacing: 0.02em;
}

.problems {
  margin: 0;
  padding: 0.6rem 0.85rem 0.6rem 1.9rem;
  border-radius: 10px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  border: 1px solid rgba(var(--rb-accent-rgb), 0.3);
  color: var(--rb-accent-text);
  font-size: 13px;
  line-height: 1.55;
}

.done-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin: 0.45rem 0 0;
  font-size: 13px;
  color: var(--rb-text-secondary);
}

.done-facts strong { color: var(--rb-text-primary); }

@media (max-width: 900px) {
  .checkin,
  .visit { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 480px) {
  .bags { grid-template-columns: minmax(0, 1fr); }
}

</style>
