<template>
  <div class="nr-page">
    <div class="nr-inner">
      <!-- The title on the left, how far along on the right (2026-11-01). -->
      <div class="nr-head">
        <PageHeader title="New Blood Request" :subtitle="hospitalPageSubtitle('newRequest', can)">
          <template #back><BackButton to="/hospital/bloodrequests" label="Patient Request" /></template>
        </PageHeader>
        <ol v-if="!submitted" class="steps" aria-label="Request steps">
          <li
            v-for="(label, key, index) in STEPS"
            :key="key"
            class="steps__item"
            :class="{ 'steps__item--on': step === key, 'steps__item--done': stepIndex > index }"
            :aria-current="step === key ? 'step' : undefined"
          >
            <button v-if="stepIndex > index" type="button" class="steps__back" :title="`Back to ${label}`" @click="step = key">
              <span class="steps__no"><AssetIcon name="check" :size="13" /></span>
              {{ label }}
            </button>
            <template v-else>
              <span class="steps__no">{{ index + 1 }}</span>
              {{ label }}
            </template>
          </li>
        </ol>
      </div>

      <!-- LOADING: the same two columns as the form -->
      <div v-if="loadingReference" class="nr-layout">
        <PageSkeleton :sections="[['form'], ['form']]" />
        <div class="sk-card nr-side-skeleton" aria-hidden="true">
          <span class="sk sk--line" style="width: 50%" />
          <span class="sk sk--line" style="width: 84%" />
          <span class="sk sk--line" style="width: 66%" />
          <span class="sk sk--line" style="width: 76%" />
        </div>
      </div>

      <!-- SUCCESS: PATIENT TRANSFUSION -->
      <section v-else-if="submitted" class="panel panel--success fade-in">
        <div class="success-icon"><AssetIcon name="check" :size="26" /></div>
        <h2 class="success-title">Blood Request sent</h2>
        <p class="success-text">
          Reference <strong class="mono">{{ submitted.request.reference_number }}</strong>. Each facility below reviews its
          own share and approves or rejects it.
        </p>
        <ul class="success-list">
          <li v-for="allocation in submitted.request.allocations ?? []" :key="allocation.id" class="success-row">
            <span class="success-row__who">
              <strong>{{ allocation.target_facility?.name }}</strong>
              <span class="mono">{{ allocation.reference_number }}</span>
            </span>
            <span class="success-row__units">{{ allocation.quantity }} unit{{ allocation.quantity === 1 ? '' : 's' }}</span>
          </li>
        </ul>
        <p v-if="submitted.request.totals.unallocated > 0" class="success-note">
          {{ submitted.request.totals.unallocated }} unit{{ submitted.request.totals.unallocated === 1 ? ' is' : 's are' }}
          still unallocated. You can ask another facility from the request's page.
        </p>
        <div class="success-actions">
          <button type="button" class="ui-btn" @click="startAnother">Raise another</button>
          <NuxtLink :to="`/hospital/transfusion-requests/${submitted.request.id}`" class="ui-btn ui-btn--primary">
            View request
          </NuxtLink>
        </div>
      </section>

      <form v-else class="nr-form" @submit.prevent="onSubmit">
        <div v-if="submitError" class="banner banner--error" role="alert">
          <AssetIcon name="triangle-alert" :size="16" />
          <span>{{ submitError }}</span>
        </div>

        <div v-if="draftRestored" class="banner banner--info" role="status">
          <AssetIcon name="info" :size="16" />
          <span>Your unsent request was brought back.</span>
          <button type="button" class="btn-link banner__action" @click="startOver">Start over</button>
        </div>

        <div class="nr-layout">
          <div class="nr-main">
            <!--
              STEP 1, STOCK CHECK (project owner, 2026-11-26): what the patient
              needs, against this blood bank's own shelf, line by line, before
              anything else is asked. The confirmation opens the next step.
            -->
            <template v-if="step === 'stock'">
              <section
                class="panel stock-step fade-in"
                :class="{ 'stock-step--ok': form.stock_confirmed, 'stock-step--error': errors.stock_confirmed && !form.stock_confirmed }"
                aria-labelledby="stock-step-title"
              >
                <header class="stock-step__head">
                  <div>
                    <h2 id="stock-step-title" class="stock-step__title">What does the patient need?</h2>
                    <p class="stock-step__lede">Choose the blood type and components. Your own shelf is checked as you go, and a blood center is asked only for what it cannot cover.</p>
                  </div>
                  <button type="button" class="ui-btn ui-btn--sm" @click="openStock">
                    <AssetIcon name="package" :size="14" />
                    View my stock
                  </button>
                </header>

                <div class="stock-step__type">
                  <label for="btype" class="field-label">Blood type <span class="req">*</span></label>
                  <SelectField
                    id="btype"
                    v-model="form.blood_type_id"
                    :options="bloodTypes.map((t) => ({ value: t.id, label: t.label }))"
                    placeholder="Select…"
                    :invalid="Boolean(errors.blood_type_id)"
                  />
                  <p v-if="errors.blood_type_id" class="field-error">{{ errors.blood_type_id }}</p>
                </div>

                <p v-if="errors.items" class="field-error field-error--block">{{ errors.items }}</p>

                <!-- One row per component: what is asked, and what the shelf holds of it. -->
                <div class="need-rows" aria-live="polite">
                  <div class="need-row need-row--head" aria-hidden="true">
                    <span>Component</span>
                    <span>Units</span>
                    <span>On your shelf</span>
                    <span />
                  </div>
                  <div v-for="(line, index) in form.items" :key="index" class="need-row" :class="`need-row--${shelfState(line)}`">
                    <div class="need-row__field">
                      <label :for="`c-${index}`" class="sr-only">Blood component {{ index + 1 }}</label>
                      <SelectField
                        :id="`c-${index}`"
                        v-model="line.component_id"
                        :options="components.map((c) => ({ value: c.id, label: c.name, disabled: isComponentTaken(c.id, index) }))"
                        placeholder="Select a component…"
                        :invalid="Boolean(lineErrors[index]?.component_id)"
                        @change="onComponentChange(line)"
                      />
                      <p v-if="lineErrors[index]?.component_id" class="field-error">{{ lineErrors[index].component_id }}</p>
                    </div>
                    <div class="need-row__field">
                      <label :for="`q-${index}`" class="sr-only">Units of component {{ index + 1 }}</label>
                      <input
                        :id="`q-${index}`"
                        v-model.number="line.quantity"
                        type="number"
                        min="1"
                        max="100"
                        class="input"
                        :class="{ 'input--error': lineErrors[index]?.quantity }"
                      >
                      <p v-if="lineErrors[index]?.quantity" class="field-error">{{ lineErrors[index].quantity }}</p>
                    </div>
                    <div class="need-row__shelf">
                      <template v-if="shelfState(line) === 'pending'">
                        <span class="need-row__muted">{{ stockLoading && !stock ? 'Reading…' : 'Choose a blood type and component' }}</span>
                      </template>
                      <template v-else-if="shelfState(line) === 'unknown'">
                        <span class="need-row__muted">Could not be read</span>
                      </template>
                      <template v-else>
                        <strong class="need-row__count">{{ shelfOf(line) }}</strong>
                        <span class="need-row__verdict">
                          <AssetIcon :name="shelfState(line) === 'enough' ? 'check' : 'x'" :size="13" />
                          {{ shelfState(line) === 'enough' ? 'Enough on your shelf' : shelfOf(line) ? `${line.quantity - shelfOf(line)} short` : 'None on your shelf' }}
                        </span>
                      </template>
                    </div>
                    <button
                      v-if="form.items.length > 1"
                      type="button"
                      class="need-row__remove"
                      :aria-label="`Remove component ${index + 1}`"
                      title="Remove"
                      @click="removeLine(index)"
                    >
                      <AssetIcon name="x" :size="15" />
                    </button>
                    <span v-else />
                  </div>
                  <button type="button" class="need-rows__add" :disabled="!canAddLine" @click="addLine">
                    <AssetIcon name="plus" :size="14" />
                    Add component
                  </button>
                </div>

                <!-- The shelf can cover some of it: say so before anything is confirmed. -->
                <div v-if="shelfCovers" class="stock-step__covers" role="status">
                  <AssetIcon name="triangle-alert" :size="16" />
                  <p>
                    Your shelf already holds enough <strong>{{ shelfCovers }}</strong>. Tag those bags to this patient from
                    <NuxtLink to="/hospital/inventory?status=available" target="_blank">Blood Bank Inventory</NuxtLink>
                    if they can be used, and ask a blood center only for the rest.
                  </p>
                </div>

                <!-- The confirmation: still the checkbox, given room and a state. -->
                <label class="confirm-tile" :class="{ 'confirm-tile--on': form.stock_confirmed }">
                  <input v-model="form.stock_confirmed" type="checkbox" class="confirm-tile__box" :aria-invalid="Boolean(errors.stock_confirmed && !form.stock_confirmed)">
                  <span class="confirm-tile__text">
                    <strong>We checked our own inventory and it cannot cover this patient's need.</strong>
                    <span class="confirm-tile__hint">Required before you continue to the patient's details.</span>
                  </span>
                </label>
                <p v-if="errors.stock_confirmed && !form.stock_confirmed" class="field-error" role="alert">{{ errors.stock_confirmed }}</p>
              </section>
            </template>

            <!-- STEP 2, PATIENT: who it is for, how urgent, and why each component. -->
            <template v-else-if="step === 'details'">
              <!-- PATIENT -->
              <section class="panel fade-in" style="--delay:40ms">
                <h2 class="panel-title panel-title--icon"><AssetIcon name="user" :size="17" /> Patient</h2>

                <div class="field-grid">
                  <div class="field field--third">
                    <label for="p-surname" class="field-label">Surname <span class="req">*</span></label>
                    <input
                      id="p-surname"
                      v-model.trim="form.patient_surname"
                      type="text"
                      class="input"
                      :class="{ 'input--error': errors.patient_surname }"
                      maxlength="100"
                      autocomplete="off"
                    >
                    <p v-if="errors.patient_surname" class="field-error">{{ errors.patient_surname }}</p>
                  </div>

                  <div class="field field--third">
                    <label for="p-first" class="field-label">First name <span class="req">*</span></label>
                    <input
                      id="p-first"
                      v-model.trim="form.patient_first_name"
                      type="text"
                      class="input"
                      :class="{ 'input--error': errors.patient_first_name }"
                      maxlength="100"
                      autocomplete="off"
                    >
                    <p v-if="errors.patient_first_name" class="field-error">{{ errors.patient_first_name }}</p>
                  </div>

                  <div class="field field--third">
                    <label for="p-middle" class="field-label">Middle name</label>
                    <input id="p-middle" v-model.trim="form.patient_middle_name" type="text" class="input" maxlength="100" autocomplete="off">
                  </div>

                  <div class="field">
                    <label for="p-age" class="field-label">Age <span class="req">*</span></label>
                    <input
                      id="p-age"
                      v-model.number="form.patient_age"
                      type="number"
                      min="0"
                      max="130"
                      class="input"
                      :class="{ 'input--error': errors.patient_age }"
                    >
                    <p v-if="errors.patient_age" class="field-error">{{ errors.patient_age }}</p>
                  </div>

                  <div class="field">
                    <label for="p-sex" class="field-label">Sex <span class="req">*</span></label>
                    <SelectField
                      id="p-sex"
                      v-model="form.patient_sex"
                      :options="[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]"
                      placeholder="Select…"
                      :invalid="Boolean(errors.patient_sex)"
                    />
                    <p v-if="errors.patient_sex" class="field-error">{{ errors.patient_sex }}</p>
                  </div>

                  <div class="field field--half">
                    <span class="field-label">Priority <span class="req">*</span></span>
                    <div class="priority-row">
                      <label
                        v-for="p in priorities"
                        :key="p.value"
                        class="pill"
                        :class="{
                          'pill--on': form.urgency_level === p.value,
                          'pill--stat': p.value === 'emergency',
                        }"
                      >
                        <input v-model="form.urgency_level" type="radio" name="priority" :value="p.value" class="sr-only">
                        {{ p.label }}
                      </label>
                    </div>
                  </div>
                </div>

                <div class="field-grid needed-by">
                  <div class="field field--half">
                    <label for="needed-by" class="field-label">Needed by <span class="field-optional">optional</span></label>
                    <DateTimeField id="needed-by" v-model="form.needed_by" :min="neededByMin" :invalid="Boolean(errors.needed_by)" />
                    <p v-if="errors.needed_by" class="field-error">{{ errors.needed_by }}</p>
                  </div>
                </div>

                <!--
                  A watcher may already have taken this patient's request straight to
                  a blood center, which then recorded it here after you confirmed it
                  by phone. Recording another would ask twice for the same need.
                -->
                <div v-if="patientMatches.length" class="dup-warning" role="status">
                  <AssetIcon name="triangle-alert" :size="16" />
                  <div>
                    <p class="dup-warning__title">This patient already has an active request</p>
                    <ul class="dup-warning__list">
                      <li v-for="match in patientMatches" :key="match.id">
                        <NuxtLink :to="`/hospital/transfusion-requests/${match.id}`" class="dup-warning__ref">{{ match.reference_number }}</NuxtLink>
                        · {{ match.facilities?.length ? match.facilities.join(', ') : 'No facility yet' }}
                        · {{ match.source_label }} · {{ match.status_label }}
                        <template v-if="match.totals?.unallocated"> · {{ match.totals.unallocated }} unallocated</template>
                      </li>
                    </ul>
                    <p class="dup-warning__hint">
                      Open it instead if it covers the same need. If some units are still unallocated, ask another facility
                      for them from that request's page.
                    </p>
                  </div>
                </div>
              </section>

              <!-- WHY EACH COMPONENT: chosen on the stock check, justified here. -->
              <section class="panel fade-in" style="--delay:80ms">
                <h2 class="panel-title panel-title--icon"><AssetIcon name="droplets" :size="17" /> Indication for each component</h2>

                <div v-for="(line, index) in form.items" :key="index" class="line">
                  <span class="line-no" aria-hidden="true">{{ index + 1 }}</span>

                  <div class="line-fields">
                    <p class="line-head">
                      <strong>{{ componentName(line.component_id) || 'Component' }}</strong>
                      <span>{{ line.quantity }} unit{{ line.quantity === 1 ? '' : 's' }}<template v-if="bloodTypeLabel !== '—'"> · {{ bloodTypeLabel }}</template></span>
                      <button type="button" class="btn-link line-head__edit" @click="step = 'stock'">Change</button>
                    </p>
                    <div class="field-grid">
                      <div class="field field--full">
                        <label :for="`i-${index}`" class="field-label">
                          Indication for transfusion
                          <span v-if="codesFor(line.component_id).length" class="req">*</span>
                        </label>
                        <SelectField
                          :id="`i-${index}`"
                          v-model="line.indication_code"
                          :options="codesFor(line.component_id).map((code) => ({ value: code.code, label: `${code.label} — ${code.description}` }))"
                          :placeholder="line.component_id ? 'Select an indication…' : 'Choose a component first'"
                          :invalid="Boolean(lineErrors[index]?.indication_code)"
                          :disabled="!line.component_id || !codesFor(line.component_id).length"
                        />
                        <p v-if="lineErrors[index]?.indication_code" class="field-error">
                          {{ lineErrors[index].indication_code }}
                        </p>
                      </div>

                      <div v-if="needsExplanation(line)" class="field field--full">
                        <label :for="`o-${index}`" class="field-label">
                          Please specify <span class="req">*</span>
                        </label>
                        <input
                          :id="`o-${index}`"
                          v-model.trim="line.indication_other"
                          type="text"
                          class="input"
                          :class="{ 'input--error': lineErrors[index]?.indication_other }"
                          maxlength="255"
                          placeholder="State the clinical indication"
                        >
                        <p v-if="lineErrors[index]?.indication_other" class="field-error">
                          {{ lineErrors[index].indication_other }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </template>

            <!-- SOURCING -->
            <section v-else-if="step === 'sourcing'" class="panel fade-in">
              <h2 class="panel-title panel-title--icon"><AssetIcon name="building-2" :size="17" /> Choose facilities</h2>
              <SourcingPanel
                v-model="split"
                :plan="plan"
                mode="new"
                :loading="planLoading"
                :error="planError"
                @retry="loadPlan"
              />
            </section>

            <!-- REVIEW -->
            <template v-else>
              <section class="panel fade-in">
                <h2 class="panel-title panel-title--icon"><AssetIcon name="droplets" :size="17" /> Required, allocated and remaining</h2>
                <div class="review-table">
                  <div class="review-table__row review-table__row--head">
                    <span>Component</span><span class="num">Required</span><span class="num">Allocated</span><span class="num">Remaining</span>
                  </div>
                  <div v-for="total in splitTotals" :key="total.componentId" class="review-table__row">
                    <strong>{{ total.component }}</strong>
                    <span class="num">{{ total.required }}</span>
                    <span class="num">{{ total.allocated }}</span>
                    <span class="num" :class="{ review__open: total.remaining > 0 }">{{ total.remaining }}</span>
                  </div>
                </div>
                <p v-if="totalRemaining > 0" class="review__open review__note">
                  {{ totalRemaining }} unit{{ totalRemaining === 1 ? '' : 's' }} left unallocated. You can ask another facility from the request's page.
                </p>
              </section>

              <section class="panel fade-in" style="--delay:40ms">
                <h2 class="panel-title panel-title--icon"><AssetIcon name="building-2" :size="17" /> Facilities asked</h2>
                <ul class="review-shares">
                  <li v-for="share in shares" :key="share.facility_id" class="review-share">
                    <strong>{{ facilityName(share.facility_id) }}</strong>
                    <span>{{ share.lines.map((line) => `${componentName(line.component_id)} ${line.quantity}`).join(', ') }}</span>
                  </li>
                </ul>
              </section>
            </template>
          </div>

          <!-- THE REQUEST SO FAR, AND THE WAY ON -->
          <aside class="nr-side" aria-label="Request summary">
            <div class="panel summary">
              <h2 class="summary__title">This request</h2>

              <dl class="summary__facts">
                <div>
                  <dt>Patient</dt>
                  <dd :class="{ 'summary__empty': !summaryPatient }">
                    {{ summaryPatient || 'Not entered yet' }}
                    <span v-if="summaryPatientMeta" class="summary__sub">{{ summaryPatientMeta }}</span>
                  </dd>
                </div>
                <div class="summary__pair">
                  <div>
                    <dt>Blood type</dt>
                    <dd :class="{ 'summary__empty': !form.blood_type_id }">{{ form.blood_type_id ? bloodTypeLabel : '—' }}</dd>
                  </div>
                  <div>
                    <dt>Priority</dt>
                    <dd :class="{ 'summary__stat': form.urgency_level === 'emergency' }">{{ priorityLabel }}</dd>
                  </div>
                </div>
                <div v-if="form.needed_by">
                  <dt>Needed by</dt>
                  <dd>{{ neededByLabel }}</dd>
                </div>
              </dl>

              <ul class="summary__lines">
                <li v-for="row in summaryLines" :key="row.key">
                  <span class="summary__line-name" :class="{ 'summary__empty': !row.named }">{{ row.name }}</span>
                  <span class="summary__line-units">{{ row.units }}</span>
                </li>
              </ul>

              <div class="summary__total">
                <span>Total units required</span>
                <strong>{{ totalUnits }}</strong>
              </div>

              <div class="summary__actions">
                <template v-if="step === 'stock'">
                  <button type="button" class="ui-btn ui-btn--primary" @click="continueToDetails">
                    Continue to patient
                    <AssetIcon name="arrow-right" :size="16" />
                  </button>
                  <NuxtLink to="/hospital/bloodrequests" class="ui-btn" @click="clearDraft">Cancel</NuxtLink>
                </template>
                <template v-else-if="step === 'details'">
                  <button type="button" class="ui-btn ui-btn--primary" :disabled="planLoading" @click="findFacilities">
                    <AssetIcon name="search" :size="16" />
                    {{ planLoading ? 'Searching…' : 'Find facilities' }}
                  </button>
                  <button type="button" class="ui-btn" @click="step = 'stock'">Back</button>
                  <NuxtLink to="/hospital/bloodrequests" class="ui-btn ui-btn--ghost" @click="clearDraft">Cancel</NuxtLink>
                </template>
                <template v-else-if="step === 'sourcing'">
                  <button type="button" class="ui-btn ui-btn--primary" :disabled="!plan || splitProblems.length > 0" @click="step = 'review'">
                    Review request
                  </button>
                  <button type="button" class="ui-btn" @click="step = 'details'">Back</button>
                  <!-- Leaving from any step, as from the first (2026-11-26). -->
                  <NuxtLink to="/hospital/bloodrequests" class="ui-btn ui-btn--ghost" @click="clearDraft">Cancel</NuxtLink>
                </template>
                <template v-else>
                  <button type="submit" class="ui-btn ui-btn--primary" :disabled="submitting">
                    <AssetIcon name="send" :size="16" />
                    {{ submitting ? 'Sending…' : 'Send request' }}
                  </button>
                  <button type="button" class="ui-btn" :disabled="submitting" @click="step = 'sourcing'">Back</button>
                  <NuxtLink v-if="!submitting" to="/hospital/bloodrequests" class="ui-btn ui-btn--ghost" @click="clearDraft">Cancel</NuxtLink>
                </template>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </div>

    <!-- The shelf, right here: leaving the page would lose what has been typed (2026-11-01). -->
    <!--
      The shelf, whole (2026-11-26): what it holds at a glance, this patient's
      type first, each cell coloured by its stock level, and the confirmation
      one click away once it is clear the shelf cannot cover the patient.
    -->
    <CenterModal v-if="stockOpen" title="Your blood bank's stock" eyebrow="Available units" size="lg" @close="stockOpen = false">
      <div class="sv">
        <p v-if="stockError && !stock" class="stock-note stock-note--error" role="alert">
          <AssetIcon name="circle-alert" :size="15" />
          {{ stockError }}
          <button type="button" class="btn-link" @click="loadStock">Try again</button>
        </p>

        <template v-else>
          <!-- This patient's blood type first: one card per component (project owner, 2026-11-26). -->
          <section v-if="patientTypeCode" class="sv-patient" aria-labelledby="sv-patient-title">
            <header class="sv-patient__head">
              <h3 id="sv-patient-title" class="sv-patient__title">
                <span class="sv-patient__type">{{ patientTypeCode }}</span>
                This patient's blood type
              </h3>
              <span class="sv-patient__meta">
                <template v-if="stockAsOf">As of {{ stockAsOf }} · </template>
                <button type="button" class="btn-link" :disabled="stockLoading" @click="loadStock">Refresh</button>
              </span>
            </header>

            <p v-if="stockLoading && !stock" class="stock-note"><AssetIcon name="loader" :size="14" class="shelf__spin" /> Reading your shelf…</p>
            <ul v-else class="sv-cards">
              <li v-for="card in patientCards" :key="card.id" class="sv-card" :class="`sv-card--${card.state}`">
                <span class="sv-card__name">{{ card.name }}</span>
                <span class="sv-card__count">{{ card.available }}</span>
                <span class="sv-card__foot">
                  <template v-if="card.state === 'enough'"><AssetIcon name="check" :size="13" /> Covers the {{ card.needed }} needed</template>
                  <template v-else-if="card.state === 'short'"><AssetIcon name="x" :size="13" /> {{ card.needed - card.available }} short of {{ card.needed }} needed</template>
                  <template v-else>Not asked for</template>
                </span>
              </li>
            </ul>
          </section>
          <p v-else class="stock-note"><AssetIcon name="info" :size="14" /> Choose the patient's blood type on the form, and their shelf shows here first.</p>

          <!-- Every blood type, on request. -->
          <button type="button" class="sv-toggle" :aria-expanded="showAllTypes || !patientTypeCode" @click="showAllTypes = !showAllTypes">
            <AssetIcon :name="showAllTypes || !patientTypeCode ? 'chevron-down' : 'chevron-right'" :size="15" />
            {{ showAllTypes || !patientTypeCode ? 'All blood types' : 'Show all blood types' }}
            <span class="sv-toggle__count">{{ shelfTotal }} unit{{ shelfTotal === 1 ? '' : 's' }} on the shelf</span>
          </button>

          <div v-if="showAllTypes || !patientTypeCode" class="sv-table-wrap">
            <table class="stock-table">
              <caption class="sr-only">Available units by blood type and component</caption>
              <thead v-if="stock">
                <tr>
                  <th scope="col" class="stock-table__corner">Blood type</th>
                  <th
                    v-for="component in stock.components"
                    :key="component.id"
                    scope="col"
                    class="num"
                    :class="{ 'stock-table__on': isNeededComponent(component.id) }"
                  >
                    {{ component.name }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <SkeletonRows v-if="stockLoading && !stock" :columns="5" :rows="8" />
                <template v-else-if="stock">
                  <tr v-for="type in stockTypesOrdered" :key="type.id" :class="{ 'stock-table__row--on': type.id === form.blood_type_id }">
                    <th scope="row">
                      <span class="stock-type">{{ type.code }}</span>
                      <span v-if="type.id === form.blood_type_id" class="stock-table__this">This patient</span>
                    </th>
                    <td v-for="component in stock.components" :key="component.id" class="num">
                      <strong v-if="stockCount(type.id, component.id)">{{ stockCount(type.id, component.id) }}</strong>
                      <span v-else class="stock-table__none" aria-label="None">—</span>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </template>
      </div>

      <template #actions>
        <!-- The confirmation, from where the shelf was checked. -->
        <button
          v-if="step === 'stock' && !form.stock_confirmed && stock"
          type="button"
          class="ui-btn"
          :title="shelfCovers ? `Your shelf shows enough of ${shelfCovers}` : undefined"
          @click="confirmStockFromDialog"
        >
          <AssetIcon name="check" :size="15" />
          Confirm stock can't cover
        </button>
        <button type="button" class="ui-btn ui-btn--primary" @click="stockOpen = false">Done</button>
      </template>
    </CenterModal>
  </div>
</template>

<script setup>
import PageHeader from '~/components/ui/PageHeader.vue'
import BackButton from '~/components/ui/BackButton.vue'
import PageSkeleton from '~/components/ui/PageSkeleton.vue'
import CenterModal from '~/components/ui/CenterModal.vue'
import SkeletonRows from '~/components/ui/SkeletonRows.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import SourcingPanel from '~/components/Hospital/SourcingPanel.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import {
  allocationProblems,
  allocationTotals,
  buildAllocationShares,
  buildTransfusionPayload,
  suggestedSplit,
} from '~/utils/transfusionSourcing'
import SelectField from '~/components/common/SelectField.vue'
import DateTimeField from '~/components/common/DateTimeField.vue'
import { hospitalPageSubtitle } from '~/utils/hospitalPageSubtitles'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.requests.manage' })

/*
 * A patient's need is a Patient Transfusion Request: staff
 * confirm their own stock cannot cover the patient, record the need, split it
 * across the centres that hold matching stock (earliest expiry first, every
 * quantity editable), review, and send — one facility allocation per centre.
 */

// The stock check comes first (project owner, 2026-11-26): nothing else is asked until the shelf is seen.
const STEPS = { stock: 'Stock check', details: 'Patient', sourcing: 'Facilities', review: 'Review' }

const loadingReference = ref(true)
const submitting = ref(false)
const submitError = ref('')
/** { kind: 'transfusion', request } once sent. */
const submitted = ref(null)

const bloodTypes = ref([])
const components = ref([])
const priorities = ref([])
const facilities = ref([])

const step = ref('stock')
const stepIndex = computed(() => Object.keys(STEPS).indexOf(step.value))

const plan = ref(null)
const planLoading = ref(false)
const planError = ref('')
const split = ref({})

const { can, user } = useUser()

const form = reactive(blankForm())

const errors = reactive({})
const lineErrors = ref([])

function blankForm() {
  return {
    stock_confirmed: false,
    patient_surname: '',
    patient_first_name: '',
    patient_middle_name: '',
    patient_age: null,
    patient_sex: '',
    blood_type_id: null,
    urgency_level: 'routine',
    needed_by: '',
    items: [emptyLine()],
  }
}

function emptyLine() {
  return { component_id: null, quantity: 1, indication_code: null, indication_other: '' }
}


/*
 * Active requirements this blood bank already has for the patient being typed
 * — including one a blood center recorded here after a walk-in. A warning
 * only: a second request can be legitimate, and the decision is the
 * requester's.
 */
const patientMatches = ref([])
let matchTimer = null

watch(
  () => [form.patient_surname, form.patient_first_name, form.blood_type_id],
  () => {
    clearTimeout(matchTimer)

    if (!form.patient_surname || !form.patient_first_name) {
      patientMatches.value = []
      return
    }

    matchTimer = setTimeout(async () => {
      try {
        const response = await hospitalService.patientMatches({
          patient_surname: form.patient_surname,
          patient_first_name: form.patient_first_name,
          blood_type_id: form.blood_type_id || null,
        })
        patientMatches.value = response?.matches ?? []
      } catch {
        // The check is advisory; a failed lookup must not block the form.
        patientMatches.value = []
      }
    }, 500)
  },
)

onUnmounted(() => clearTimeout(matchTimer))
const canAddLine = computed(() => form.items.length < components.value.length && form.items.length < 6)
const totalUnits = computed(() =>
  form.items.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0),
)

const splitTotals = computed(() => allocationTotals(plan.value, split.value))
const splitProblems = computed(() => allocationProblems(plan.value, split.value))
const shares = computed(() => buildAllocationShares(plan.value, split.value))

const patientName = computed(() => [form.patient_surname.toUpperCase() + ',', form.patient_first_name, form.patient_middle_name].filter(Boolean).join(' '))
// The shelf, for the own-stock check. Read fresh each time it is opened.
const stockOpen = ref(false)
const stockLoading = ref(false)
const stockError = ref('')
const stock = ref(null)

async function loadStock() {
  stockLoading.value = true
  stockError.value = ''
  try {
    stock.value = await hospitalService.stockThresholds()
  } catch (err) {
    stock.value = null
    stockError.value = err?.message || 'Could not load your stock. Please try again.'
  } finally {
    stockLoading.value = false
  }
}

function openStock() {
  stockOpen.value = true
  showAllTypes.value = false
  loadStock()
}

// The stock dialog's figures (2026-11-26).
const shelfTotal = computed(() => (stock.value?.cells ?? []).reduce((sum, cell) => sum + (cell.available || 0), 0))
const patientTypeCode = computed(() => stock.value?.blood_types?.find(type => type.id === form.blood_type_id)?.code ?? '')
// This patient's type first; the rest as the shelf lists them.
const stockTypesOrdered = computed(() => {
  const types = stock.value?.blood_types ?? []
  return [...types.filter(type => type.id === form.blood_type_id), ...types.filter(type => type.id !== form.blood_type_id)]
})
const stockAsOf = computed(() => (stock.value?.as_of
  ? new Date(stock.value.as_of).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  : ''))
// The full table waits behind a toggle once the patient's type is known.
const showAllTypes = ref(false)
/**
 * One card per component in this patient's blood type: the components asked
 * for first, each saying whether the shelf covers it.
 */
const patientCards = computed(() => {
  const needed = new Map(form.items.filter(line => line.component_id).map(line => [line.component_id, Number(line.quantity) || 0]))
  return (stock.value?.components ?? [])
    .map((component) => {
      const available = stockCount(form.blood_type_id, component.id)
      const want = needed.get(component.id) ?? 0
      return {
        id: component.id,
        name: component.name,
        available,
        needed: want,
        state: want > 0 ? (available >= want ? 'enough' : 'short') : 'other',
      }
    })
    .sort((a, b) => Number(b.needed > 0) - Number(a.needed > 0))
})
/** Give the own-stock confirmation from the dialog, once the shelf was seen. */
function confirmStockFromDialog() {
  form.stock_confirmed = true
  stockOpen.value = false
}

// Each component asked for, against this blood bank's own shelf.
const ownStockLines = computed(() => {
  if (!stock.value || !form.blood_type_id) return []
  const code = stock.value.blood_types?.find(type => type.id === form.blood_type_id)?.code ?? bloodTypeLabel.value
  return form.items.filter(line => line.component_id).map(line => {
    const available = stockCount(form.blood_type_id, line.component_id)
    const needed = Number(line.quantity) || 0
    const enough = needed > 0 && available >= needed
    return {
      key: line.component_id, code, name: componentName(line.component_id), available, needed, enough,
      // enough: use yours first; some: short of it; none: nothing on the shelf.
      state: enough ? 'enough' : available > 0 ? 'some' : 'none',
    }
  })
})

/** What the shelf holds of one line's component, in the patient's blood type. */
function shelfOf(line) {
  return stockCount(form.blood_type_id, line.component_id)
}
/** pending: nothing to check yet; unknown: the shelf could not be read; enough or short. */
function shelfState(line) {
  if (!form.blood_type_id || !line.component_id) return 'pending'
  if (!stock.value) return stockLoading.value ? 'pending' : 'unknown'
  const needed = Number(line.quantity) || 0
  return needed > 0 && shelfOf(line) >= needed ? 'enough' : 'short'
}

/*
 * The confirmation holds for the need it was given against: change the blood
 * type, a component or its units and it has to be given again (2026-11-26).
 * Registered in this order so a restored draft, which sets both at once,
 * keeps its confirmation.
 */
const needSignature = computed(() => JSON.stringify([
  form.blood_type_id,
  form.items.map(line => [line.component_id, Number(line.quantity) || 0]),
]))
let confirmedFor = ''
watch(() => form.stock_confirmed, (on) => { confirmedFor = on ? needSignature.value : '' }, { immediate: true })
watch(needSignature, (signature) => {
  if (form.stock_confirmed && confirmedFor && signature !== confirmedFor) form.stock_confirmed = false
})

/** The components the shelf alone could cover, named, for the warning on the confirmation. */
const shelfCovers = computed(() => ownStockLines.value.filter((row) => row.enough).map((row) => row.name).join(', '))

const neededByMin = computed(() => {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
})
const neededByLabel = computed(() => (form.needed_by
  ? new Date(form.needed_by).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  : ''))

const stockCount = (typeId, componentId) => stock.value?.cells
  ?.find(cell => cell.blood_type_id === typeId && cell.component_id === componentId)?.available ?? 0
const isNeededComponent = id => form.items.some(line => line.component_id === id)

// The summary beside the form: what has been entered so far.
const summaryPatient = computed(() => (form.patient_surname || form.patient_first_name ? patientName.value.replace(/^,\s*/, '') : ''))
const summaryPatientMeta = computed(() => [
  form.patient_age === null || form.patient_age === '' ? '' : `${form.patient_age} yrs`,
  form.patient_sex ? (form.patient_sex === 'male' ? 'Male' : 'Female') : '',
].filter(Boolean).join(' · '))
const totalRemaining = computed(() => splitTotals.value.reduce((sum, total) => sum + (total.remaining > 0 ? total.remaining : 0), 0))
const summaryLines = computed(() => {
  // From the facility step on, each line says how much of it is allocated.
  if ((step.value === 'sourcing' || step.value === 'review') && splitTotals.value.length) {
    return splitTotals.value.map(total => ({
      key: total.componentId,
      name: total.component,
      named: true,
      units: `${total.allocated} of ${total.required} allocated`,
    }))
  }
  return form.items.map((line, index) => ({
    key: index,
    name: line.component_id ? componentName(line.component_id) : `Component ${index + 1}`,
    named: Boolean(line.component_id),
    units: `${Number(line.quantity) || 0} unit${Number(line.quantity) === 1 ? '' : 's'}`,
  }))
})
const bloodTypeLabel = computed(() => bloodTypes.value.find((t) => t.id === form.blood_type_id)?.label ?? '—')
const priorityLabel = computed(() => priorities.value.find((p) => p.value === form.urgency_level)?.label ?? form.urgency_level)

onMounted(async () => {
  // The shelf is read at once, so the own-stock check shows it as the form
  // is filled; it never holds the form up (2026-11-26).
  loadStock()
  try {
    const [reference, eligible] = await Promise.all([
      hospitalService.referenceData(),
      hospitalService.eligibleFacilities(),
    ])

    bloodTypes.value = reference?.blood_types ?? []
    components.value = reference?.components ?? []
    priorities.value = reference?.priorities ?? []
    facilities.value = eligible?.facilities ?? []
    restoreDraft()
    if (!draftRestored.value) applySearchedFor()
    // Advisory, like the duplicate check: a failed read must not block the form.
    hospitalService.stockThresholds().then((status) => { stock.value = status }).catch(() => {})
  } catch (err) {
    submitError.value = err?.message || 'Could not load the request form. Please reload the page.'
  } finally {
    loadingReference.value = false
  }
})

/** The indication codes the chosen component allows, straight from the API. */
function codesFor(componentId) {
  if (!componentId) return []
  return components.value.find((c) => c.id === componentId)?.indication_codes ?? []
}

/** Whether the chosen code is an "Others" one, which must be written out. */
function needsExplanation(line) {
  return Boolean(
    codesFor(line.component_id).find((c) => c.code === line.indication_code)?.requires_explanation,
  )
}

/** A component may be ticked once per form, so hide the ones already taken. */
function isComponentTaken(componentId, exceptIndex) {
  return form.items.some((line, i) => i !== exceptIndex && line.component_id === componentId)
}

/** Clear the indication when the component changes — the codes differ per component. */
function onComponentChange(line) {
  line.indication_code = null
  line.indication_other = ''
}

function addLine() {
  form.items.push(emptyLine())
}

function removeLine(index) {
  form.items.splice(index, 1)
  lineErrors.value.splice(index, 1)
}

function componentName(id) {
  return components.value.find((c) => c.id === id)?.name ?? 'Component'
}

/** A centre's name, from wherever the plan listed it. */
function facilityName(id) {
  for (const line of plan.value?.lines ?? []) {
    const found = line.facilities.find((h) => h.facility.id === id)?.facility
      ?? line.other_facilities.find((f) => f.id === id)

    if (found) return found.name
  }

  return facilities.value.find((f) => f.id === id)?.name ?? 'Facility'
}

/**
 * Check the first step before it moves on.
 *
 * Deliberately a mirror of the server's form requests rather than the only
 * guard: the server refuses the same things, and anything it rejects is shown
 * through applyServerErrors().
 */
/** The server's error keys that belong to the stock check (step 1). */
const STOCK_STEP_KEYS = /^(blood_type_id|internal_stock_confirmed|stock_confirmed|items|lines)(\.\d+\.(component_id|quantity))?$/

function resetErrors() {
  Object.keys(errors).forEach((key) => delete errors[key])
  lineErrors.value = form.items.map(() => ({}))
}

const isValid = () => Object.keys(errors).length === 0
  && lineErrors.value.every((lineError) => Object.keys(lineError).length === 0)

/** Step 1: the blood type, the components and units, and the own-stock confirmation. */
function checkStock() {
  if (!form.blood_type_id) errors.blood_type_id = 'Select the blood type required.'
  if (form.items.length === 0) errors.items = 'Add at least one blood component to this request.'
  form.items.forEach((line, index) => {
    const lineError = lineErrors.value[index]
    if (!line.component_id) lineError.component_id = 'Select the blood component required.'
    if (!line.quantity || line.quantity < 1) lineError.quantity = 'Request at least one unit.'
    if (line.quantity > 100) lineError.quantity = 'A single component cannot exceed 100 units.'
  })
  if (!form.stock_confirmed) errors.stock_confirmed = "Confirm your own stock cannot cover this patient before asking other facilities."
}

/** From the stock check to the patient's details. */
function continueToDetails() {
  submitError.value = ''
  resetErrors()
  checkStock()
  if (isValid()) step.value = 'details'
}

function validate() {
  resetErrors()
  checkStock()

  if (!form.patient_surname) errors.patient_surname = 'Enter the patient surname.'
  if (!form.patient_first_name) errors.patient_first_name = 'Enter the patient first name.'
  if (form.patient_age === null || form.patient_age === '') errors.patient_age = 'Enter the patient age.'
  if (!form.patient_sex) errors.patient_sex = 'Select the patient sex.'

  if (form.needed_by && new Date(form.needed_by) <= new Date()) errors.needed_by = 'The time needed must be in the future.'

  form.items.forEach((line, index) => {
    const lineError = lineErrors.value[index]

    if (line.component_id && codesFor(line.component_id).length && !line.indication_code) {
      lineError.indication_code = 'Select the indication for this component.'
    }

    if (needsExplanation(line) && !line.indication_other) {
      lineError.indication_other = 'This code requires you to specify the reason.'
    }
  })

  return (
    Object.keys(errors).length === 0 &&
    lineErrors.value.every((lineError) => Object.keys(lineError).length === 0)
  )
}

/** Surface Laravel's validation bag against the fields it names. */
function applyServerErrors(bag) {
  Object.entries(bag ?? {}).forEach(([key, messages]) => {
    const message = Array.isArray(messages) ? messages[0] : messages
    const line = key.match(/^(?:items|lines)\.(\d+)\.(\w+)$/)

    if (line) {
      const index = Number(line[1])
      lineErrors.value[index] = { ...(lineErrors.value[index] ?? {}), [line[2]]: message }
      return
    }

    errors[key === 'internal_stock_confirmed' ? 'stock_confirmed' : key] = message
  })
}

function requirementLines() {
  return form.items.map((line) => ({
    component_id: line.component_id,
    quantity: Number(line.quantity),
    indication_code: line.indication_code,
    ...(line.indication_other ? { indication_other: line.indication_other } : {}),
  }))
}

/** Plan the need across the network, then move to the facility step. */
async function findFacilities() {
  submitError.value = ''

  if (!validate()) {
    submitError.value = 'Please correct the highlighted fields.'
    // A problem on the stock check sends staff back to it.
    const stockProblem = ['blood_type_id', 'items', 'stock_confirmed'].some((key) => errors[key])
      || lineErrors.value.some((lineError) => lineError.component_id || lineError.quantity)
    if (stockProblem) step.value = 'stock'
    return
  }

  step.value = 'sourcing'
  await loadPlan()
}

async function loadPlan() {
  planLoading.value = true
  planError.value = ''

  try {
    plan.value = await hospitalService.draftSourcing({
      blood_type_id: form.blood_type_id,
      lines: form.items.map((line) => ({ component_id: line.component_id, quantity: Number(line.quantity) })),
    })
    split.value = suggestedSplit(plan.value)
  } catch (err) {
    planError.value = err?.message || 'Could not search the network. Please try again.'
  } finally {
    planLoading.value = false
  }
}

async function onSubmit() {
  if (step.value === 'review') await sendTransfusion()
}

async function sendTransfusion() {
  submitError.value = ''

  if (splitProblems.value.length) {
    step.value = 'sourcing'
    return
  }

  submitting.value = true

  try {
    const draft = {
      bloodTypeId: form.blood_type_id,
      urgency: form.urgency_level,
      neededBy: form.needed_by,
      patient: {
        surname: form.patient_surname,
        firstName: form.patient_first_name,
        middleName: form.patient_middle_name ?? '',
        age: form.patient_age,
        sex: form.patient_sex,
      },
      lines: requirementLines(),
    }

    const response = await hospitalService.createTransfusionRequest(buildTransfusionPayload(draft, plan.value, split.value))
    submitted.value = { kind: 'transfusion', request: response.request }
    clearDraft()
  } catch (err) {
    const bag = err?.errors ?? {}
    applyServerErrors(bag)
    submitError.value = err?.message || 'Could not send the request. Please try again.'

    // Send staff back to wherever the server found the problem.
    const keys = Object.keys(bag)
    if (keys.some((key) => key.startsWith('allocations'))) step.value = 'sourcing'
    else if (keys.some((key) => STOCK_STEP_KEYS.test(key))) step.value = 'stock'
    else if (keys.length) step.value = 'details'
  } finally {
    submitting.value = false
  }
}

/* The unsent request, kept for this tab only: it holds a patient's name, so it
   goes when the tab closes, and is never left on a shared computer's disk. */
const draftKey = computed(() => `redagos:new-request:${user.value?.uuid ?? 'staff'}`)
const draftRestored = ref(false)
let draftReady = false

function clearDraft() {
  try {
    sessionStorage.removeItem(draftKey.value)
  } catch {
    // Storage blocked: nothing was kept.
  }
  draftRestored.value = false
}

function restoreDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(draftKey.value) || 'null')
    // A form nobody has filled in is not a draft.
    if (saved && (saved.patient_surname || saved.patient_first_name || saved.blood_type_id || saved.items?.some(line => line.component_id))) {
      Object.assign(form, { ...blankForm(), ...saved })
      draftRestored.value = true
    }
  } catch {
    // Unreadable or blocked: start from an empty form.
  }
  draftReady = true
}

watch(form, () => {
  if (!draftReady || submitted.value) return
  try {
    sessionStorage.setItem(draftKey.value, JSON.stringify(form))
  } catch {
    // Storage blocked: the form still works for this visit.
  }
}, { deep: true })

/** Coming from Blood Availability: what was searched for is already chosen. */
function applySearchedFor() {
  const route = useRoute()
  const type = Number(route.query.blood_type_id)
  const component = Number(route.query.component_id)
  const quantity = Number(route.query.quantity)
  if (bloodTypes.value.some((t) => t.id === type)) form.blood_type_id = type
  if (components.value.some((c) => c.id === component)) {
    form.items[0].component_id = component
    if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 100) form.items[0].quantity = quantity
  }
}

function startOver() {
  clearDraft()
  startAnother()
}

function startAnother() {
  submitted.value = null
  submitError.value = ''
  step.value = 'stock'
  plan.value = null
  split.value = {}
  Object.keys(errors).forEach((key) => delete errors[key])
  lineErrors.value = []

  Object.assign(form, blankForm())
}
</script>

<style scoped>
/* Tokens come from app/assets/css/main.css; nothing is redeclared here. */
.nr-page {
  min-height: 100%;
  background: var(--rb-page-bg);
  font-family: var(--rb-font-sans);
  padding: 24px var(--rb-gutter, 24px) 40px;
}
/* The full content width, like every staff page (2026-10-15). */
.nr-inner { max-width: var(--rb-content-max, 1600px); margin: 0 auto; }

.nr-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px; margin-bottom: 18px; }

/* The form beside what it adds up to; the summary stays in view. */
.nr-form { display: flex; flex-direction: column; gap: 14px; }
.nr-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
.nr-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.nr-side { position: sticky; top: 80px; display: flex; flex-direction: column; gap: 12px; }
.nr-side-skeleton { min-height: 280px; }

.panel {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: var(--rb-radius-lg);
  box-shadow: var(--rb-shadow-sm);
  padding: 20px;
}
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.panel-title { font-size: 15px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 4px; }
.panel-title--icon { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.panel-title--icon :deep(svg) { color: var(--rb-primary-text); }
.panel-head .panel-title--icon { margin-bottom: 4px; }
/* The shared .bc-shell heading rule sets its own margin; the gap sits on what follows. */
.panel-title--icon + .field-grid, .panel-title--icon + .review-table, .panel-title--icon + .review-shares { margin-top: 14px; }

.banner {
  display: flex; align-items: center; gap: 8px;
  padding: 11px 14px; border-radius: 10px; font-size: 13px;
}
.banner--error {
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
  border: 1px solid rgba(var(--rb-accent-rgb), 0.25);
}

/* Own stock: a gate, so it reads differently from the fields after it. */
/* ── Step 1, the stock check (2026-11-26) ──
   An amber edge until the shelf is confirmed, green once it is, red when it
   was missed. Each component sits on one row with what the shelf holds of it. */
.stock-step {
  --gate: var(--rb-warning);
  position: relative; display: flex; flex-direction: column; gap: 18px; overflow: hidden;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.stock-step::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--gate); }
.stock-step--ok { --gate: var(--rb-success); }
.stock-step--error { --gate: var(--rb-accent); border-color: var(--rb-accent); }
.stock-step__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.stock-step__title { margin: 0; font-size: 17px; font-weight: 700; color: var(--rb-text-primary); }
.stock-step__lede { margin: 4px 0 0; max-width: 64ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }
.stock-step__type { display: flex; flex-direction: column; gap: 5px; max-width: 240px; }

.need-rows { display: flex; flex-direction: column; border: 1px solid var(--rb-border); border-radius: 12px; overflow: hidden; }
.need-row {
  --state: var(--rb-border);
  display: grid; grid-template-columns: minmax(0, 1fr) 96px 190px 32px; align-items: start; gap: 12px;
  padding: 12px 14px; border-top: 1px solid var(--rb-border); background: var(--rb-surface);
}
.need-row--head {
  align-items: center; padding: 8px 14px; border-top: 0; background: var(--rb-surface-alt);
  font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--rb-text-muted);
}
.need-row--enough { --state: var(--rb-success); }
.need-row--short { --state: var(--rb-accent); }
.need-row__field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.need-row__shelf {
  display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 0 12px;
  border-radius: 10px; border: 1px solid var(--rb-border);
  background: color-mix(in srgb, var(--state) 7%, var(--rb-surface));
}
.need-row--enough .need-row__shelf, .need-row--short .need-row__shelf { border-color: color-mix(in srgb, var(--state) 35%, transparent); }
.need-row__count { font-size: 20px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.need-row__verdict { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: var(--state); }
.need-row--short .need-row__verdict { color: var(--rb-accent-text); }
.need-row--enough .need-row__verdict { color: var(--rb-success-text); }
.need-row__muted { font-size: 12px; color: var(--rb-text-muted); }
.need-row__remove {
  display: grid; place-items: center; width: 32px; height: 42px; padding: 0; border: 0; border-radius: 8px;
  background: none; color: var(--rb-text-muted); cursor: pointer;
}
.need-row__remove:hover { background: rgba(var(--rb-accent-rgb), .08); color: var(--rb-accent-text); }
.need-row__remove:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.need-rows__add {
  display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border: 0; border-top: 1px dashed var(--rb-border-strong);
  background: var(--rb-surface); font: inherit; font-size: 13px; font-weight: 600; color: var(--rb-primary-text); cursor: pointer;
}
.need-rows__add:hover:not(:disabled) { background: rgba(var(--rb-primary-rgb), .05); }
.need-rows__add:disabled { color: var(--rb-text-muted); cursor: not-allowed; }
.need-rows__add:focus-visible { outline: none; box-shadow: inset var(--rb-focus-ring); }

.stock-step__covers {
  display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 10px;
  border: 1px solid rgba(var(--rb-warning-rgb), .4); background: rgba(var(--rb-warning-rgb), .1); color: var(--rb-warning-text);
}
.stock-step__covers p { margin: 0; font-size: 13px; line-height: 1.5; }
.stock-step__covers :deep(svg) { flex: none; margin-top: 2px; }
.stock-step__covers a { color: inherit; font-weight: 700; }

.shelf__spin { animation: shelf-spin 0.9s linear infinite; }
@keyframes shelf-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .shelf__spin { animation: none; } }

/* Step 2: each component, named, above its indication. */
.line-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; margin: 0 0 10px; font-size: 13px; color: var(--rb-text-secondary); }
.line-head strong { font-size: 14px; color: var(--rb-text-primary); }
.line-head__edit { margin-left: auto; font-size: 12.5px; }


/* The confirmation tile: the checkbox, given room and a state. */
.confirm-tile {
  display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; cursor: pointer;
  border: 1.5px solid var(--rb-border-strong); border-radius: 12px; background: var(--rb-surface);
  transition: border-color .15s ease, background-color .15s ease;
}
.confirm-tile:hover { border-color: rgba(var(--rb-primary-rgb), .5); }
.confirm-tile:focus-within { box-shadow: var(--rb-focus-ring); }
.confirm-tile--on { border-color: rgba(var(--rb-success-rgb), .6); background: rgba(var(--rb-success-rgb), .07); }
.stock-step--error .confirm-tile { border-color: var(--rb-accent); }
.confirm-tile__box { flex: none; width: 18px; height: 18px; margin-top: 1px; accent-color: var(--rb-success); cursor: pointer; }
.confirm-tile__text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.confirm-tile__text strong { font-size: 13.5px; font-weight: 600; color: var(--rb-text-primary); }
.confirm-tile__hint { font-size: 12px; color: var(--rb-text-muted); }
.confirm-tile__warn { display: flex; align-items: flex-start; gap: 5px; font-size: 12px; font-weight: 600; color: var(--rb-warning-text); }
.confirm-tile__warn :deep(svg) { flex: none; margin-top: 1px; }
.stock-step .field-error { margin: -10px 0 0; }

/* Fields */
.field-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; grid-column: span 3; min-width: 0; }
.field--third { grid-column: span 4; }
.field--half { grid-column: span 6; }
.field--three-quarter { grid-column: span 9; }
.field--full { grid-column: 1 / -1; }
.field-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.req { color: var(--rb-accent-text); }
.input {
  width: 100%; height: 42px; padding: 9px 11px; font-size: 13.5px; font-family: inherit;
  color: var(--rb-text-primary); background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 9px;
  transition: border-color .15s, box-shadow .15s;
}
.input:focus {
  outline: none; border-color: var(--rb-primary);
  box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.12);
}
.input:disabled { background: var(--rb-surface-alt); color: var(--rb-text-muted); cursor: not-allowed; }
.input--error { border-color: var(--rb-accent); }
.input::placeholder { color: var(--rb-placeholder); }
.field-error { font-size: 11.5px; color: var(--rb-accent-text); margin: 0; }
.field-error--block { margin-bottom: 10px; }

.dup-warning {
  display: flex; gap: 10px; align-items: flex-start;
  margin-top: 14px; padding: 12px 14px; border-radius: 10px;
  background: rgba(var(--rb-warning-rgb), .12);
  color: var(--rb-warning-text); font-size: 13px; line-height: 1.5;
}
.dup-warning__title { margin: 0; font-weight: 700; }
.dup-warning__list { margin: 4px 0; padding-left: 18px; color: var(--rb-text-primary); }
.dup-warning__ref { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; color: var(--rb-primary-text); }
.dup-warning__hint { margin: 0; color: var(--rb-text-secondary); }

/* Priority: one control in two halves, the height of the fields beside it. */
.priority-row { display: flex; gap: 4px; height: 42px; padding: 3px; border: 1px solid var(--rb-border-strong); border-radius: 9px; }
.pill {
  display: grid; flex: 1; place-items: center; border-radius: 6px; cursor: pointer;
  font-size: 13px; font-weight: 600; color: var(--rb-text-secondary);
  transition: background .15s, color .15s;
}
.pill:hover { background: var(--rb-surface-hover); }
.pill:focus-within { outline: 2px solid var(--rb-primary); outline-offset: 1px; }
.pill--on, .pill--on:hover { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.pill--stat.pill--on, .pill--stat.pill--on:hover { background: var(--rb-accent); color: #FFFFFF; }

/* Component lines: numbered, one rule between them. */
.line { display: flex; align-items: flex-start; gap: 12px; padding: 16px 0; border-top: 1px solid var(--rb-border); }
.line:first-of-type { margin-top: 2px; }
.line:last-child { padding-bottom: 0; }
.line-no {
  display: grid; flex: none; place-items: center; width: 26px; height: 26px; margin-top: 22px; border-radius: 50%;
  background: rgba(var(--rb-primary-rgb), 0.1); font-size: 12px; font-weight: 700; color: var(--rb-primary-text);
}
.line-fields { flex: 1; min-width: 0; }
.line-remove { flex: none; margin-top: 30px; }

.btn-link {
  background: none; border: none; padding: 0; cursor: pointer;
  font-size: 12.5px; font-weight: 600; font-family: inherit; color: var(--rb-text-secondary);
}
.btn-link--danger { color: var(--rb-accent-text); }

/* Summary */
.summary { display: flex; flex-direction: column; gap: 14px; padding: 18px; }
.summary__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.summary__facts { display: flex; flex-direction: column; gap: 12px; margin: 0; }
.summary__pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.summary dt { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.summary dd { margin: 2px 0 0; font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); overflow-wrap: anywhere; }
.summary__sub { display: block; font-size: 12.5px; font-weight: 500; color: var(--rb-text-secondary); }
.summary dd.summary__empty, .summary__empty { font-weight: 500; color: var(--rb-text-muted); }
.summary dd.summary__stat { color: var(--rb-accent-text); }
.summary__lines { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 12px 0 0; border-top: 1px solid var(--rb-border); list-style: none; }
.summary__lines li { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; color: var(--rb-text-primary); }
.summary__line-name { min-width: 0; overflow-wrap: anywhere; }
.summary__line-units { flex: none; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--rb-text-secondary); }
.summary__total { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding-top: 12px; border-top: 1px solid var(--rb-border); font-size: 13px; color: var(--rb-text-secondary); }
.summary__total strong { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.summary__actions { display: flex; flex-direction: column; gap: 8px; }
.summary__actions > * { justify-content: center; width: 100%; text-decoration: none; }

/* Review */
.review-table { border: 1px solid var(--rb-border); border-radius: 10px; font-size: 13.5px; color: var(--rb-text-primary); }
.review-table__row { display: grid; grid-template-columns: minmax(0, 1fr) repeat(3, 90px); gap: 12px; align-items: center; padding: 10px 14px; }
.review-table__row + .review-table__row { border-top: 1px solid var(--rb-border); }
.review-table__row--head { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.review__open { font-weight: 700; color: var(--rb-warning-text); }
.review__note { margin: 10px 0 0; font-size: 13px; font-weight: 600; }
.review-shares { display: flex; flex-direction: column; margin: 0; padding: 0; border: 1px solid var(--rb-border); border-radius: 10px; list-style: none; }
.review-share { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 16px; padding: 10px 14px; font-size: 13.5px; color: var(--rb-text-primary); }
.review-share + .review-share { border-top: 1px solid var(--rb-border); }
.review-share span { color: var(--rb-text-secondary); }

/* Success */
.panel--success { max-width: 620px; margin: 8px auto 0; padding: 34px 28px; text-align: center; }
.success-icon {
  width: 54px; height: 54px; margin: 0 auto 14px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%; color: #fff; background: var(--rb-success);
}
.success-title { font-size: 19px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 6px; }
.success-text { font-size: 13.5px; color: var(--rb-text-secondary); margin: 0 auto 18px; max-width: 52ch; }
.success-list { margin: 0 0 14px; padding: 0; border: 1px solid var(--rb-border); border-radius: 10px; list-style: none; text-align: left; }
.success-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; font-size: 13.5px; color: var(--rb-text-primary); }
.success-row + .success-row { border-top: 1px solid var(--rb-border); }
.success-row__who { display: flex; flex-direction: column; min-width: 0; }
.success-row__who .mono { font-size: 12px; color: var(--rb-primary-text); }
.success-row__units { flex: none; color: var(--rb-text-secondary); }
.success-note { font-size: 13px; color: var(--rb-warning-text); margin: 0 auto 16px; max-width: 52ch; }
.success-actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
.success-actions .ui-btn { text-decoration: none; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

/* Steps: one line that fills as the request moves on. */
.steps { display: flex; align-items: center; gap: 8px; margin: 0; padding: 0; list-style: none; flex-wrap: wrap; }
.steps__item { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--rb-text-muted); }
.steps__item + .steps__item::before { content: ''; width: 28px; height: 2px; border-radius: 2px; background: var(--rb-border); }
.steps__item--on + .steps__item::before { background: var(--rb-border); }
.steps__item--done + .steps__item::before { background: var(--rb-success); }
.steps__no {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 50%;
  font-size: 12px; font-weight: 700; background: var(--rb-surface-alt); border: 1px solid var(--rb-border); color: var(--rb-text-secondary);
}
.steps__item--on { color: var(--rb-primary-text); }
.steps__item--on .steps__no { border-color: var(--rb-primary); background: var(--rb-primary); color: #fff; }
.steps__item--done { color: var(--rb-text-primary); }
.steps__item--done .steps__no { border-color: var(--rb-success); background: var(--rb-success); color: #fff; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

.fade-in { animation: fade-in .32s ease both; animation-delay: var(--delay, 0ms); }
@keyframes fade-in { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: none } }

@media (prefers-reduced-motion: reduce) {
  .fade-in { animation: none; }
}

@media (max-width: 1080px) {
  .nr-layout { grid-template-columns: minmax(0, 1fr); }
  .nr-side { position: static; }
}
@media (max-width: 720px) {
  .nr-page { padding: 14px; }
  .field, .field--third, .field--three-quarter { grid-column: span 6; }
  .field--half { grid-column: 1 / -1; }
  .field--third, .field--full { grid-column: 1 / -1; }
  .stock-step__head { flex-wrap: wrap; }
  .need-row { grid-template-columns: minmax(0, 1fr) 80px 32px; }
  .need-row--head { display: none; }
  .need-row__shelf { grid-column: 1 / -1; grid-row: 2; }
  .line { flex-wrap: wrap; }
  .line-no { margin-top: 0; }
  .line-fields { flex-basis: 100%; order: 3; }
  .line-remove { margin: 4px 0 0 auto; }
  .review-table__row { grid-template-columns: minmax(0, 1fr) repeat(3, 60px); gap: 8px; }
}

/* Restored draft */
.banner--info { background: rgba(var(--rb-primary-rgb), 0.07); color: var(--rb-primary-text); border: 1px solid rgba(var(--rb-primary-rgb), 0.22); }
.banner__action { margin-left: auto; color: var(--rb-primary-text); text-decoration: underline; }

.needed-by { margin-top: 14px; }
.field-optional { font-weight: 500; color: var(--rb-text-secondary); }

/* A finished step can be gone back to. */
.steps__back { display: inline-flex; align-items: center; gap: 8px; padding: 0; border: 0; border-radius: 6px; background: none; font: inherit; color: inherit; cursor: pointer; }
.steps__back:hover { color: var(--rb-primary-text); }
.steps__back:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

/* The shelf in the dialog; what this patient needs stands out. */
/* ── The stock dialog (2026-11-26) ── */
.sv { display: flex; flex-direction: column; gap: 16px; }
/* This patient's type: one card per component. */
.sv-patient { display: flex; flex-direction: column; gap: 12px; }
.sv-patient__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.sv-patient__title { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 15px; font-weight: 700; color: var(--rb-text-primary); }
.sv-patient__type {
  display: inline-grid; place-items: center; min-width: 44px; height: 30px; padding: 0 8px; border-radius: 8px;
  background: rgba(var(--rb-accent-rgb), .1); color: var(--rb-accent-text); font-size: 14px; font-weight: 800;
}
.sv-patient__meta { font-size: 12.5px; color: var(--rb-text-muted); }

.sv-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.sv-card {
  --tone: var(--rb-border);
  display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; min-width: 0;
  border: 1px solid var(--rb-border); border-top: 3px solid var(--tone); border-radius: 12px; background: var(--rb-surface);
}
.sv-card--enough { --tone: var(--rb-success); }
.sv-card--short { --tone: var(--rb-accent); }
.sv-card__name { font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sv-card__count { font-size: 28px; font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.sv-card--other .sv-card__count { color: var(--rb-text-muted); }
.sv-card__foot { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--rb-text-muted); }
.sv-card--enough .sv-card__foot { color: var(--rb-success-text); }
.sv-card--short .sv-card__foot { color: var(--rb-accent-text); }
.sv-card--other .sv-card__foot { font-weight: 500; }

/* The rest of the shelf, on request. */
.sv-toggle {
  display: flex; align-items: center; gap: 6px; padding: 0; border: 0; background: none; cursor: pointer;
  font: inherit; font-size: 13px; font-weight: 600; color: var(--rb-primary-text);
}
.sv-toggle:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 4px; }
.sv-toggle__count { margin-left: 4px; font-weight: 500; color: var(--rb-text-muted); }

.sv-table-wrap { overflow-x: auto; border: 1px solid var(--rb-border); border-radius: 12px; }
.stock-table { width: 100%; border-collapse: collapse; font-size: 13.5px; color: var(--rb-text-primary); }
.stock-table th, .stock-table td { padding: 9px 12px; border-bottom: 1px solid var(--rb-border); text-align: left; }
.stock-table thead th {
  position: sticky; top: 0; z-index: 1; background: var(--rb-surface-alt);
  font-size: 11px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: var(--rb-text-secondary);
  vertical-align: bottom; white-space: normal; line-height: 1.3;
}
.stock-table tbody th { white-space: nowrap; }
.stock-table tbody tr:last-child th, .stock-table tbody tr:last-child td { border-bottom: 0; }
.stock-table .num { text-align: center; font-variant-numeric: tabular-nums; }
.stock-table thead .stock-table__on { color: var(--rb-primary-text); box-shadow: inset 0 -2px 0 var(--rb-primary); }
.stock-table__row--on { background: rgba(var(--rb-primary-rgb), 0.05); }
.stock-table__row--on th { box-shadow: inset 3px 0 0 var(--rb-primary); }
.stock-table__this {
  margin-left: 8px; padding: 1px 7px; border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), .12); color: var(--rb-primary-text);
  font-size: 10.5px; font-weight: 700; letter-spacing: 0; text-transform: none;
}
.stock-table__none { color: var(--rb-text-muted); }
.stock-table__hit { background: rgba(var(--rb-primary-rgb), 0.08); }

.stock-type { font-weight: 700; }
.stock-note { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13.5px; color: var(--rb-text-secondary); }
.stock-note--error { color: var(--rb-accent-text); }
</style>
