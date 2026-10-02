<template>
    <div class="eligibility-page">
        <!-- Skeleton loading state -->
        <div v-if="loading" class="skeleton-wrap">
            <div class="skeleton skeleton--header" />
            <div class="skeleton skeleton--banner" />
            <div class="skeleton-main-grid">
                <div class="skeleton-col">
                    <div class="skeleton skeleton--panel" style="height:280px" />
                    <div class="skeleton skeleton--panel" style="height:280px" />
                </div>
                <div class="skeleton-col">
                    <div class="skeleton skeleton--panel" style="height:240px" />
                    <div class="skeleton skeleton--panel" style="height:140px" />
                    <div class="skeleton skeleton--button" />
                </div>
            </div>
        </div>

        <template v-else>
            <div class="header-row">
                <div class="header-row__titles">
                    <h1 class="page-title">Blood Donor's Health Questionnaire</h1>
                    <p class="page-subtitle">Answer honestly. A "Yes" does not by itself mean you cannot donate.</p>
                </div>

                <!-- Gamay nga chip imbes dakong block; ang tibuok pasabot kay naa sa duol sa Submit -->
                <div
                    v-if="hasValidScreening && answeringAgain && !windowClosed"
                    class="again-chip"
                    role="status"
                    :title="`Submitting will replace your current screening, valid until ${formatDate(eligibility.screening_valid_until)}.`"
                >
                    <AssetIcon name="triangle-alert" :size="14" />
                    <span>Answering again</span>
                    <button type="button" class="again-chip__cancel" @click="answeringAgain = false">
                        Cancel
                    </button>
                </div>
            </div>

            <!-- Current eligibility state -->
            <div v-if="statusBanner && !hasValidScreening" class="status-banner" :class="`status-banner--${statusBanner.tone}`">
                <span class="status-banner__icon">
                    <AssetIcon :name="statusBanner.icon" :size="16" />
                </span>
                <div class="status-banner__body">
                    <p class="status-banner__title">{{ statusBanner.title }}</p>
                    <p v-if="statusBanner.detail" class="status-banner__detail">{{ statusBanner.detail }}</p>
                    <ul v-if="statusBanner.reasons.length" class="status-banner__reasons">
                        <li v-for="reason in statusBanner.reasons" :key="reason.code">{{ reason.message }}</li>
                    </ul>
                </div>
            </div>


            <!--
                The most likely new state a donor meets: booked, but too early.
                It has to read as a schedule, not as an error, and it must never
                render an empty form behind it.
            -->
            <div v-if="windowClosed" class="panel window-closed">
                <div class="panel-header panel-header--simple">
                    <h2 class="panel-title">Your questionnaire opens on {{ formatDate(windowOpensOn) }}</h2>
                </div>
                <div class="form-body">
                    <p class="window-closed__text">
                        You answer this the day before your appointment, so that what the blood centre reads is current.
                        Come back on {{ formatDate(windowOpensOn) }} — we will email you a reminder.
                    </p>
                    <NuxtLink to="/donor/appointments" class="btn-outline window-closed__link">
                        View my appointment
                    </NuxtLink>
                </div>
            </div>

            <!--
                Duha ka hugna: (1) ang mga pangutana ra, (2) human matubag
                tanan, ang vitals, consent ug submit. Display state ra ang
                `stage`; ang submit ug validation kay wala nausab.
            -->
            <!--
                Naa nay valid nga screening: ipakita dayon sa pag-abli sa page
                imbes nga mahibal-an ra sa donor human matubag ang 30 ka
                pangutana ug ma-reject ang submit (409 screening_already_valid).
            -->
            <div v-else-if="hasValidScreening && !answeringAgain" class="panel valid-gate">
                <span class="valid-gate__icon">
                    <AssetIcon name="circle-check-big" :size="22" />
                </span>
                <div class="valid-gate__body">
                    <h2 class="valid-gate__title">
                        Your screening is valid until {{ formatDate(eligibility.screening_valid_until) }}
                    </h2>
                    <p class="valid-gate__text">
                        You answered it on {{ formatDate(eligibility.screening_date) }}. You only need to answer
                        again if your health has changed since then, for example a new illness, medication,
                        tattoo or travel.
                    </p>
                </div>
                <div class="valid-gate__actions">
                    <button type="button" class="btn-primary" @click="router.push('/donor/qrcode')">
                        <AssetIcon name="qr-code" :size="16" />
                        View my QR code
                    </button>
                    <button type="button" class="btn-outline" @click="startAnsweringAgain">
                        Answer again
                    </button>
                </div>
            </div>

            <div v-else class="main-grid">
                <div v-if="sections.length" ref="wizardTop" class="wizard-progress">
                    <!-- Ang category title kay naa na sa panel header, so screen reader ra ni -->
                    <p class="visually-hidden" aria-live="polite">
                        Step {{ stage === 'details' ? pages.length + 1 : activePage + 1 }} of {{ pages.length + 1 }}:
                        {{ stage === 'details' ? 'Your details and consent' : currentPageTitle }}
                    </p>
                    <div class="wizard-progress__track">
                        <button
                            v-for="(page, i) in pages"
                            :key="page.key"
                            type="button"
                            class="wizard-seg"
                            :class="{
                                'wizard-seg--done': pageComplete(page),
                                'wizard-seg--current': stage === 'questions' && i === activePage,
                            }"
                            :style="{ '--fill': pageFill(page) }"
                            :aria-label="`Step ${i + 1}: ${page.groups.map(g => g.title).join(' & ')}, ${sectionProgress(page)} answered`"
                            :aria-current="stage === 'questions' && i === activePage ? 'step' : undefined"
                            @click="goToPage(i)"
                        />
                        <!-- Ang katapusang lakang: vitals ug consent. Maablihan ra kung natubag na tanan. -->
                        <button
                            type="button"
                            class="wizard-seg wizard-seg--details"
                            :class="{ 'wizard-seg--current': stage === 'details' }"
                            :style="{ '--fill': stage === 'details' ? 1 : 0 }"
                            :disabled="!allAnswered"
                            :aria-label="`Step ${pages.length + 1}: Your details and consent`"
                            :aria-current="stage === 'details' ? 'step' : undefined"
                            @click="goToDetails"
                        />
                    </div>
                    <p class="wizard-progress__count">
                        {{ answeredCount }} of {{ allQuestions.length }} answered
                    </p>
                </div>

                <div v-show="stage === 'questions'" class="col-left">
                    <div v-if="loadError" class="panel">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Questionnaire unavailable</h2>
                        </div>
                        <div class="form-body">
                            <p class="load-error__text">{{ loadError }}</p>
                            <button type="button" class="btn-primary btn-block load-error__retry" @click="load">
                                Try again
                            </button>
                        </div>
                    </div>

                    <!--
                        Max 5 ka pangutana matag page para dili na mag-scroll og
                        taas ang donor sa 30 ka pangutana. Ang dagkong DOH
                        section kay gibahin (Part 1 of 2), ug ang gagmay kay
                        gi-usa sa usa ka page nga naa gihapon ilang heading. Pwede gihapon
                        mo-Next bisan naa pay wala natubag: ang progress bar ug
                        ang review step ang mopakita kung unsa pa ang kulang.
                    -->
                    <template v-if="sections.length">
                        <Transition name="section-swap" mode="out-in">
                            <div v-if="currentPage" ref="wizardPanel" :key="currentPage.key" class="panel wizard-panel">
                                <section
                                    v-for="(group, gi) in currentPage.groups"
                                    :key="group.key"
                                    class="wizard-group"
                                >
                                    <div class="panel-header panel-header--simple" :class="{ 'wizard-group__head--next': gi > 0 }">
                                        <div class="wizard-group__titles">
                                            <h2 class="panel-title" :tabindex="gi === 0 ? -1 : undefined">
                                                {{ group.title }}
                                            </h2>
                                            <p v-if="group.parts > 1" class="wizard-group__part">
                                                Part {{ group.part }} of {{ group.parts }}
                                            </p>
                                        </div>
                                        <span class="panel-count">{{ sectionProgress(group) }}</span>
                                    </div>
                                    <div class="question-list">
                                        <div v-for="q in group.questions" :key="q.code" class="question-card"
                                            :id="`q-${q.code}`"
                                            :class="{ 'question-card--missing': missingHighlight === q.code }">
                                            <p class="question-card__text">{{ displayNumber[q.code] }}. {{ q.text }}</p>
                                            <div class="answer-toggle">
                                                <button type="button" class="answer-btn answer-btn--yes"
                                                    :class="{ 'answer-btn--active': answers[q.code] === true }"
                                                    @click="answers[q.code] = true">
                                                    {{ q.kind === 'acknowledgement' ? 'Yes, I understand' : 'Yes' }}
                                                </button>
                                                <button type="button" class="answer-btn answer-btn--no"
                                                    :class="{ 'answer-btn--active': answers[q.code] === false }"
                                                    @click="answers[q.code] = false">No</button>
                                                <!--
                                                    Only where the server says the question is not required of
                                                    this donor. It omits the code from the payload rather than
                                                    sending a boolean, because "not pregnant" from someone the
                                                    question was never meant for is a falsehood in the record.
                                                -->
                                                <button v-if="q.required === false" type="button"
                                                    class="answer-btn answer-btn--na"
                                                    :class="{ 'answer-btn--active': answers[q.code] === null }"
                                                    @click="answers[q.code] = null">Not applicable to me</button>
                                            </div>

                                            <div v-if="q.code === lastMenstrualCode && answers[q.code] !== null" class="lmp-field">
                                                <label class="form-label" :for="`lmp-${q.code}`">Last menstrual period</label>
                                                <input :id="`lmp-${q.code}`" v-model="vitals.lastMenstrualPeriod" type="date"
                                                    class="form-input">
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <p v-if="isLastPage && continueBlocked && !allAnswered" class="wizard-blocked" role="status">
                                    {{ unansweredCount }} question{{ unansweredCount === 1 ? '' : 's' }} still to answer.
                                    We took you to the first one.
                                </p>
                                <div class="wizard-nav">
                                    <p class="wizard-nav__count" aria-live="polite">
                                        {{ pageEndNumber }} of {{ allQuestions.length }}
                                    </p>
                                    <button
                                        type="button"
                                        class="wizard-nav__back"
                                        aria-label="Previous step"
                                        :disabled="activePage === 0"
                                        @click="goToPage(activePage - 1)"
                                    >
                                        <AssetIcon name="chevron-left" :size="18" />
                                    </button>
                                    <button
                                        type="button"
                                        class="btn-primary wizard-nav__next"
                                        @click="isLastPage ? continueToDetails() : goToPage(activePage + 1)"
                                    >
                                        {{ isLastPage ? 'Continue' : 'Next' }}
                                        <AssetIcon name="chevron-right" :size="18" />
                                    </button>
                                </div>
                            </div>
                        </Transition>
                    </template>
                </div>

                <!-- Hugna 2: vitals, consent, review ug submit -->
                <div v-show="stage === 'details'" ref="finishColumn" class="col-right">
                    <button type="button" class="details-back" @click="backToQuestions">
                        <AssetIcon name="chevron-left" :size="16" />
                        Back to questions
                    </button>

                    <div class="panel details-vitals" :class="{ 'details-vitals--full': !consentStatements.length }">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title" tabindex="-1">Vital Information</h2>
                        </div>
                        <div class="form-body">
                            <div class="form-stack">
                                <div class="form-field">
                                    <label class="form-label">Age</label>
                                    <input v-model.number="vitals.age" type="number" min="0" class="form-input"
                                        :class="{ 'form-input--locked': prefilled.age }" :readonly="prefilled.age"
                                        placeholder="29">
                                    <p v-if="prefilled.age" class="form-hint">
                                        From your profile, computed from your birth date.
                                    </p>
                                </div>

                                <div class="form-field">
                                    <label class="form-label">Weight (kg)</label>
                                    <input v-model.number="vitals.weight" type="number" min="0" class="form-input"
                                        placeholder="72">
                                </div>
                                <div class="form-field">
                                    <label class="form-label">Blood type (if known)</label>
                                    <div class="select-wrap">
                                        <select v-model="vitals.bloodType" class="form-input form-input--select"
                                            :class="{ 'form-input--locked': prefilled.bloodType }"
                                            :disabled="prefilled.bloodType">
                                            <option value="">Select</option>
                                            <option v-for="bt in bloodTypeOptions" :key="bt" :value="bt">{{ bt }}</option>
                                        </select>
                                        <AssetIcon name="chevron-down" :size="16" class="select-wrap__icon" />
                                    </div>
                                    <p v-if="prefilled.bloodType" class="form-hint">
                                        From your profile. Change it in Profile settings.
                                    </p>
                                </div>

                                <div class="form-field">
                                    <label class="form-label">Last blood donation date</label>
                                    <input v-model="vitals.lastDonationDate" type="date" class="form-input">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!--
                        Section I-C. Every statement has to be ticked before the
                        questionnaire can be submitted.

                        Taas ang mga statement, so 2 ka linya ra ang ipakita
                        una ug naay "Show more". Ang "agree to all" sa ubos kay
                        shortcut ra: ang matag statement kay naa gihapon iyang
                        kaugalingong checkbox ug mao gihapon ang gi-check.
                    -->
                    <div v-if="consentStatements.length" class="panel details-consent">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Donor's informed consent</h2>
                        </div>
                        <div class="form-body">
                            <div v-for="(statement, i) in consentStatements" :key="i" class="consent-item">
                                <input
                                    :id="`consent-${i}`"
                                    v-model="consentTicked[i]"
                                    type="checkbox"
                                    class="consent-item__box"
                                >
                                <div class="consent-item__content">
                                    <label
                                        :id="`consent-text-${i}`"
                                        :ref="el => setConsentTextEl(el, i)"
                                        :for="`consent-${i}`"
                                        class="consent-item__text"
                                        :class="{ 'is-clamped': !consentExpanded[i] }"
                                    >{{ statement }}</label>
                                    <button
                                        v-if="consentOverflows[i] || consentExpanded[i]"
                                        type="button"
                                        class="consent-item__more"
                                        :aria-expanded="consentExpanded[i] ? 'true' : 'false'"
                                        :aria-controls="`consent-text-${i}`"
                                        @click="consentExpanded[i] = !consentExpanded[i]"
                                    >
                                        {{ consentExpanded[i] ? 'Show less' : 'Show more' }}
                                    </button>
                                </div>
                            </div>

                            <label class="consent-all">
                                <input
                                    type="checkbox"
                                    class="consent-item__box"
                                    :checked="allConsentTicked"
                                    :indeterminate.prop="someConsentTicked && !allConsentTicked"
                                    @change="setAllConsent($event.target.checked)"
                                >
                                <span>I have read and agree to all of the above</span>
                            </label>
                        </div>
                    </div>

                    <!--
                        The review step. With no result preview, this is the only
                        feedback the form gives before submitting, so it is not
                        optional polish: it is where a donor catches a mis-tap
                        across thirty questions.
                    -->
                    <div class="panel">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Review and submit</h2>
                        </div>
                        <div class="form-body">
                            <p v-if="!allAnswered" class="review-missing">
                                {{ unansweredCount }} question{{ unansweredCount === 1 ? '' : 's' }} still to answer.
                                <button type="button" class="review-missing__link" @click="goToFirstUnanswered">
                                    Go to the first one
                                </button>
                            </p>
                            <p v-else-if="!allConsentTicked" class="review-missing">
                                Please read and accept every consent statement above.
                            </p>
                            <p v-else class="review-ready">
                                All {{ answeredCount }} questions answered and consent accepted.
                                Check your answers, then submit.
                            </p>

                            <button type="button" class="btn-outline btn-block" :disabled="!allAnswered"
                                @click="showReview = true">
                                Review my answers
                            </button>
                        </div>
                    </div>

                    <!-- Mahitungod sa submit mismo, so diri, dili sa ibabaw sa page -->
                    <p v-if="hasValidScreening && answeringAgain" class="submit-hint submit-hint--warning">
                        <AssetIcon name="triangle-alert" :size="15" />
                        <span>
                            Submitting will replace your current screening, which is valid until
                            {{ formatDate(eligibility.screening_valid_until) }}.
                        </span>
                    </p>
                    <p v-else class="submit-hint">
                        <AssetIcon name="info" :size="15" />
                        <span>
                            Your QR code is generated as soon as you submit. Present it at the donation centre,
                            where staff will go through your answers with you.
                        </span>
                    </p>

                    <button type="button" class="btn-primary btn-block btn-submit"
                        :disabled="submitting || !canSubmit" @click="handleSubmit(answeringAgain)">
                        <span>{{ submitting ? 'Submitting...' : 'Submit questionnaire' }}</span>
                        <AssetIcon name="arrow-right" :size="16" class="btn-submit__icon" />
                    </button>

                    <!--
                        "Already answered" (canForceResubmit) kay dili error pero
                        wala na-save ang submit ug naay desisyonan, so amber.
                        Fallback ra ni: kasagaran ang valid-gate na ang mosalo
                        sa pag-abli sa page. Ang uban nga failure kay pula.
                    -->
                    <div
                        v-if="submitError"
                        class="submit-error"
                        :class="{ 'submit-error--warning': canForceResubmit }"
                        :role="canForceResubmit ? 'status' : 'alert'"
                    >
                        <div class="submit-error__body">
                            <AssetIcon
                                :name="canForceResubmit ? 'triangle-alert' : 'circle-alert'"
                                :size="16"
                                class="submit-error__icon"
                            />
                            <p class="submit-error__text">{{ submitError }}</p>
                        </div>
                        <button v-if="canForceResubmit" type="button" class="btn-outline submit-error__action"
                            :disabled="submitting" @click="handleSubmit(true)">
                            Answer it again anyway
                        </button>
                    </div>

                </div>
            </div>
        </template>

        <!-- The review step: everything about to be sent, read-only. -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div v-if="showReview" class="modal-backdrop eligibility-modal" @click.self="showReview = false">
                    <div class="modal-card modal-card--review" role="dialog" v-focus-trap aria-modal="true"
                        aria-labelledby="rev-title">
                        <div class="review-head">
                            <h2 id="rev-title" class="modal-title">Review your answers</h2>
                            <p class="modal-subtitle">
                                This is exactly what will be sent. Close this to change anything.
                            </p>
                        </div>

                        <div class="review-list">
                            <section v-for="section in displayGroups" :key="section.key" class="review-section">
                                <h3 class="review-section__title">{{ section.title }}</h3>
                                <ol class="review-answers">
                                    <li v-for="q in section.questions" :key="q.code" class="review-answer">
                                        <span class="review-answer__text">{{ displayNumber[q.code] }}. {{ q.text }}</span>
                                        <span class="review-answer__value">{{ answerLabel(q) }}</span>
                                    </li>
                                </ol>
                            </section>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn-outline" @click="showReview = false">
                                Change something
                            </button>
                            <button type="button" class="btn-primary" :disabled="submitting || !canSubmit"
                                @click="showReview = false; handleSubmit(answeringAgain)">
                                {{ submitting ? 'Submitting...' : 'Submit questionnaire' }}
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!--
            Gipakita ni pagkahuman sa submit. Walay verdict diri -- walay
            "passed" ug walay "deferred" -- kay ang blood center na ang mo-basa
            sa mga tubag ug mo-desisyon didto sa counter.
        -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div v-if="showPassedModal" class="modal-backdrop eligibility-modal" @click.self="showPassedModal = false">
                    <div class="modal-card" role="dialog" v-focus-trap aria-modal="true" aria-labelledby="epm-title">
                        <div class="modal-check">
                            <AssetIcon name="check" :size="26" />
                        </div>

                        <h2 id="epm-title" class="modal-title">Questionnaire submitted</h2>
                        <p class="modal-subtitle">
                            {{ qrCodeDataUrl
                                ? 'Bring this QR code with you. The blood centre will review your answers when you arrive.'
                                : 'Verify your email address to receive your check-in QR code.' }}
                        </p>

                        <div v-if="qrCodeDataUrl" class="modal-qr-wrap">
                            <img
                                :src="qrCodeDataUrl"
                                alt="Donor eligibility QR code"
                                class="modal-qr-image"
                            >
                        </div>

                        <p v-if="qrCodeDataUrl" class="modal-validity">
                            Valid for {{ qrValidityDays }} days · Expires {{ formattedQrExpiry }}
                        </p>

                        <div class="modal-actions">
                            <button type="button" class="btn-outline" @click="goToFullQr">
                                View full QR
                            </button>
                            <button type="button" class="btn-primary" @click="goToBookAppointment">
                                Book Appointment
                                <AssetIcon name="arrow-right" :size="16" />
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true,
})

import AssetIcon from '~/components/common/AssetIcon.vue'
import { donorService } from '~/api/donor/DonorService'
import QRCode from 'qrcode'


const router = useRouter()
const submitting = ref(false)
const loading = ref(true)
const loadError = ref('')

// Modal + QR state shown after a submitted questionnaire
const showPassedModal = ref(false)
const showReview = ref(false)
const missingHighlight = ref('')
const qrCodeDataUrl = ref('')
const qrExpiresOn = ref(null)
const qrValidityDays = ref(14)

// Questionnaire served by the backend. Ang wording ug ang scoring flags kay
// naa na sa server, so ang client dili na mag-hardcode og questions.
const sections = ref([])
// Display categories gikan sa server ({ key, title }, in order). Walay sulod
// para sa v1, so ang DOH sections ang gamiton.
const categories = ref([])
const questionVersion = ref(null)
const answers = reactive({})

const bloodTypeOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const vitals = reactive({
    age: null,
    weight: null,
    bloodType: '',
    lastDonationDate: '',
    lastDonationVenue: '',
    // The form's free field inside the female-donors section.
    lastMenstrualPeriod: '',
})

// Section I-C, served alongside the questions so the version echoed back is
// provably the one that was rendered.
const consentVersion = ref(null)
const consentStatements = ref([])
const consentTicked = reactive({})
// Show more / less per statement, ug kung asa ang tinuod nga mo-lapas og 2
// ka linya. Gisukod gamit ResizeObserver kay nagdepende sa lapad sa screen,
// ug para masukod pud bisan nakatago pa ang panel inig load.
const consentExpanded = reactive({})
const consentOverflows = reactive({})
const consentTextEls = new Map()
let consentResizeObserver = null

function measureConsentText(el) {
    const i = Number(el.dataset.consentIndex)
    if (consentExpanded[i]) return
    consentOverflows[i] = el.scrollHeight > el.clientHeight + 1
}

function setConsentTextEl(el, i) {
    const previous = consentTextEls.get(i)
    if (previous === el) return
    if (previous) consentResizeObserver?.unobserve(previous)
    if (!el) {
        consentTextEls.delete(i)
        return
    }
    el.dataset.consentIndex = String(i)
    consentTextEls.set(i, el)
    consentResizeObserver?.observe(el)
}

onMounted(() => {
    if (typeof ResizeObserver === 'undefined') return
    consentResizeObserver = new ResizeObserver(entries => {
        entries.forEach(entry => measureConsentText(entry.target))
    })
    consentTextEls.forEach(el => consentResizeObserver.observe(el))
})

onBeforeUnmount(() => {
    consentResizeObserver?.disconnect()
    consentResizeObserver = null
})

function setAllConsent(checked) {
    consentStatements.value.forEach((_, i) => { consentTicked[i] = checked })
}

// Set when the donor holds an appointment whose window has not opened yet.
const windowClosed = ref(false)
const windowOpensOn = ref(null)

// The DOH form puts "Last menstrual period" under question 5.
const lastMenstrualCode = computed(() =>
    sections.value.find(s => s.key === 'female_donors')?.questions?.[0]?.code ?? ''
)

// Gi-track kung asa nga fields gikan sa profile, kay kato ra ang i-lock. Kung
// wala nag-return og value ang server, editable gihapon para sa donor.
const prefilled = reactive({
    age: false,
    bloodType: false,
})

// current eligibility state sa donor gikan sa server.
const eligibility = ref(null)

const submitError = ref('')
const canForceResubmit = ref(false)



/**
 * Ang mga grupo nga makita sa donor, sa order nga ilang tubagon.
 *
 * Kung naay category ang tanang pangutana (v2), i-group by category kay ang
 * DOH sections kay by time window ("in the past 12 months") ug nagsagol ang
 * sex, surgery ug travel. Display ra ni: ang answers kay keyed by code, so
 * pareho ra gihapon ang ipadala sa server.
 */
const displayGroups = computed(() => {
    const questions = sections.value.flatMap(section => section.questions)
    const categorised = categories.value.length > 0 && questions.length > 0
        && questions.every(q => q.category)

    if (!categorised) return sections.value

    return categories.value
        .map(category => ({
            key: category.key,
            title: category.title,
            questions: questions.filter(q => q.category === category.key),
        }))
        .filter(group => group.questions.length > 0)
})

const allQuestions = computed(() => displayGroups.value.flatMap(group => group.questions))

// Sunod-sunod nga numero sa display order, kay ang DOH number (q.number) kay
// dili na sunod-sunod inig group by category.
const displayNumber = computed(() =>
    Object.fromEntries(allQuestions.value.map((q, i) => [q.code, i + 1]))
)

// `null` is a real answer here -- "not applicable to me" -- so only `undefined`
// counts as unanswered.
const unanswered = computed(() =>
    allQuestions.value.filter(q => answers[q.code] === undefined)
)

const unansweredCount = computed(() => unanswered.value.length)
const answeredCount = computed(() => allQuestions.value.length - unansweredCount.value)

const allAnswered = computed(() =>
    allQuestions.value.length > 0 && unansweredCount.value === 0
)

const allConsentTicked = computed(() =>
    consentStatements.value.length > 0
    && consentStatements.value.every((_, i) => consentTicked[i] === true)
)

const someConsentTicked = computed(() =>
    consentStatements.value.some((_, i) => consentTicked[i] === true)
)

const canSubmit = computed(() => allAnswered.value && allConsentTicked.value)

// Max nga pangutana matag page sa wizard.
const QUESTIONS_PER_PAGE = 5

/**
 * Ang mga page sa wizard, gikan sa displayGroups (category o DOH section).
 *
 * 1. Ang grupo nga lapas og 5 kay gibahin og managsama nga parts
 *    (13 -> 5, 4, 4) imbes 5, 5, 3, para dili usa ra ka pangutana ang
 *    mabilin sa katapusan.
 * 2. Ang sunod-sunod nga gagmay nga section kay gi-usa sa usa ka page
 *    basta dili molapas og 5. Ang parts sa gibahin nga section kay dili
 *    i-usa sa uban para klaro ang "Part 1 of 2".
 */
const pages = computed(() => {
    const groups = []

    displayGroups.value.forEach(section => {
        const qs = section.questions
        if (!qs.length) return

        const parts = Math.ceil(qs.length / QUESTIONS_PER_PAGE)
        const base = Math.floor(qs.length / parts)
        const extra = qs.length % parts
        let offset = 0

        for (let part = 0; part < parts; part++) {
            const size = base + (part < extra ? 1 : 0)
            groups.push({
                key: `${section.key}-${part}`,
                title: section.title,
                part: part + 1,
                parts,
                questions: qs.slice(offset, offset + size),
            })
            offset += size
        }
    })

    const result = []

    groups.forEach(group => {
        const last = result[result.length - 1]
        const canMerge = last
            && group.parts === 1
            && last.groups.every(g => g.parts === 1)
            && last.questions.length + group.questions.length <= QUESTIONS_PER_PAGE

        if (canMerge) {
            last.groups.push(group)
            last.questions = last.questions.concat(group.questions)
        } else {
            result.push({ groups: [group], questions: [...group.questions] })
        }
    })

    return result.map(page => ({ ...page, key: page.groups.map(g => g.key).join('+') }))
})

// Ang page nga gipakita karon sa wizard.
const activePage = ref(0)
const wizardTop = ref(null)
const wizardPanel = ref(null)
const finishColumn = ref(null)

const currentPage = computed(() => pages.value[Math.min(activePage.value, pages.value.length - 1)] ?? null)
const isLastPage = computed(() => activePage.value >= pages.value.length - 1)

// Ang ngalan sa page sa progress bar, e.g. "Sexual history" o
// "Medical history & Before you donate" kung duha ka grupo.
const currentPageTitle = computed(() =>
    currentPage.value?.groups.map(group => group.title).join(' & ') ?? ''
)

// Ang numero sa katapusang pangutana sa page, para sa "23 of 30" sa ubos.
const pageEndNumber = computed(() => {
    const last = currentPage.value?.questions.at(-1)
    if (!last) return 0

    return allQuestions.value.findIndex(q => q.code === last.code) + 1
})

// Pila ka bahin sa page ang natubag (0 hangtod 1), para sa partial fill sa bar.
function pageFill(page) {
    if (!page.questions.length) return 0

    return page.questions.filter(q => answers[q.code] !== undefined).length / page.questions.length
}

function pageComplete(page) {
    return page.questions.every(q => answers[q.code] !== undefined)
}

function scrollBehavior() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

/**
 * Lihok sa laing page. I-scroll balik sa taas kung naka-scroll na ang
 * donor lapas sa progress bar, ug i-focus ang title para sa screen readers.
 */
async function goToPage(index) {
    if (index < 0 || index >= pages.value.length) return

    stage.value = 'questions'
    activePage.value = index
    await nextTick()

    if (!import.meta.client) return

    scrollToProgress()
    // Hulaton ang out-in transition una i-focus ang bag-ong title
    setTimeout(() => wizardPanel.value?.querySelector('h2')?.focus({ preventScroll: true }), 220)
}

// 'questions' | 'details'. Display ra: kung asa nga hugna ang makita.
const stage = ref('questions')
// Gi-set kung gi-press ang Continue nga naa pay wala natubag.
const continueBlocked = ref(false)

function scrollToProgress() {
    if (!import.meta.client) return

    const top = wizardTop.value
    if (top && top.getBoundingClientRect().top < 0) {
        top.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    }
}

async function goToDetails() {
    if (!allAnswered.value) return

    stage.value = 'details'
    continueBlocked.value = false
    await nextTick()
    scrollToProgress()
    finishColumn.value?.querySelector('h2')?.focus({ preventScroll: true })
}

function continueToDetails() {
    if (allAnswered.value) {
        goToDetails()
        return
    }

    continueBlocked.value = true
    goToFirstUnanswered()
}

async function backToQuestions() {
    stage.value = 'questions'
    await goToPage(pages.value.length - 1)
}

function sectionProgress(section) {
    const done = section.questions.filter(q => answers[q.code] !== undefined).length

    return `${done}/${section.questions.length}`
}

function answerLabel(q) {
    const value = answers[q.code]

    if (value === undefined) return 'Not answered'
    if (value === null) return 'Not applicable'

    return value ? 'Yes' : 'No'
}

/**
 * Take the donor to the first question they have not answered.
 *
 * At eight questions a disabled submit button was survivable. At thirty it is a
 * dead end, and with the result preview gone there is nothing else telling them
 * what is left.
 */
async function goToFirstUnanswered() {
    const first = unanswered.value[0]
    if (!first) return

    stage.value = 'questions'
    const index = pages.value.findIndex(page => page.questions.some(q => q.code === first.code))
    if (index !== -1 && index !== activePage.value) {
        activePage.value = index
        // Hulaton ang out-in transition aron naa na ang card sa DOM
        await nextTick()
        await new Promise(resolve => setTimeout(resolve, 400))
    }

    missingHighlight.value = first.code

    if (import.meta.client) {
        document.getElementById(`q-${first.code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    setTimeout(() => { missingHighlight.value = '' }, 2000)
}

function formatDate(value) {
    if (!value) return '-'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formattedQrExpiry = computed(() => formatDate(qrExpiresOn.value))

// Ang tanan nga branching kay diri ra, dili sa template. Ang `null` return it
// means nga walay banner nga i-render.
const statusBanner = computed(() => {
    const current = eligibility.value
    if (!current) return null

    switch (current.questionnaire_status) {
        case 'answered':
            // Ang bag-ong version kay lahi nga porma, dili balik-balik nga
            // tubag, so gi-agda ang donor nga mo-tubag pag-usab -- dili siya
            // gi-pugngan.
            if (current.re_screen_recommended) {
                return {
                    tone: 'warning',
                    icon: 'clock',
                    title: 'The questionnaire has been updated since you last answered it.',
                    detail: 'Please answer the current version so the blood centre has your full history.',
                    reasons: [],
                }
            }

            return {
                tone: 'success',
                icon: 'circle-check-big',
                title: `You answered this on ${formatDate(current.screening_date)}, good until ${formatDate(current.screening_valid_until)}.`,
                detail: 'Answer it again only if your health details have changed since then.',
                reasons: [],
            }
        case 'expired':
            return {
                tone: 'warning',
                icon: 'clock',
                title: `Your previous answers expired on ${formatDate(current.screening_valid_until)}.`,
                detail: 'Complete the questionnaire again to restore your check-in code.',
                reasons: [],
            }
        default:
            // 'not_answered' — igo na ang static info banner.
            return null
    }
})


// Naa nay valid nga screening ug dili gikinahanglan ang bag-ong version
// (re_screen_recommended): ang server mo-409 sa submit gawas kung force.
const hasValidScreening = computed(() =>
    eligibility.value?.questionnaire_status === 'answered'
    && !eligibility.value?.re_screen_recommended
)

// Gipili sa donor nga motubag pag-usab gikan sa valid-gate. Ang submit kay
// mo-force dayon, parehas sa "Answer it again anyway" kaniadto.
const answeringAgain = ref(false)

function startAnsweringAgain() {
    answeringAgain.value = true
}

function goToFullQr() {
    showPassedModal.value = false
    router.push('/donor/qrcode')
}

function goToBookAppointment() {
    showPassedModal.value = false
    router.push('/donor/appointments')
}


function handleSubmitError(err) {
    const code = err?.data?.code

    // Parehas 409 ang duha, so ang `code` ra ang balo kung unsa.
    if (code === 'screening_already_valid') {
        const until = formatDate(err?.data?.screening_valid_until)
        submitError.value = `${err.message} Your current screening is valid until ${until}.`
        canForceResubmit.value = true
        return
    }

    if (code === 'questionnaire_version_stale' || code === 'consent_version_stale') {
        submitError.value = err.message
        // Kuhaon ang bag-ong version aron mo-trabaho ang sunod nga submit.
        load()
        return
    }

    // Ang tulo ka objective threshold -- edad, timbang, ug ang 56 ka adlaw nga
    // interval. Gi-ingon ni sila nga plain nga kamatuoran, dili isip verdict sa
    // panglawas sa donor.
    if (code === 'threshold_not_met') {
        submitError.value = (err?.data?.reasons || [])
            .map(reason => reason.message)
            .join(' ') || err.message
        return
    }

    if (code === 'screening_window_not_open') {
        windowClosed.value = true
        windowOpensOn.value = err?.data?.window_opens_on ?? null
        submitError.value = err.message
        return
    }

    if (err?.status === 429) {
        submitError.value = 'Too many screening attempts. Please wait a while before trying again.'
        return
    }

    submitError.value = err?.message || 'Failed to submit your screening. Please try again.'
    console.error('Failed to submit screening:', err)
}

async function handleSubmit(force = false) {
    submitting.value = true
    submitError.value = ''
    canForceResubmit.value = false

    try {
        const payload = {
            question_version: questionVersion.value,
            // Ang `null` nga tubag ("not applicable to me") kay gi-laktawan, dili
            // gi-send isip boolean: ang server na ang mo-hibalo nga wala kadto
            // gipangutana ani nga donor.
            answers: allQuestions.value
                .filter(q => answers[q.code] !== undefined && answers[q.code] !== null)
                .map(q => ({ code: q.code, answer: answers[q.code] })),
            consent: {
                version: consentVersion.value,
                accepted: true,
            },
        }

        // `vitals.weight` kay required_with:vitals, so kung walay weight, i-omit
        // gyud ang tibuok `vitals` object imbes mo-send og null — 422 na kadto.
        if (vitals.weight !== null && vitals.weight !== '') {
            payload.vitals = { weight: Number(vitals.weight) }

            if (vitals.lastDonationDate) {
                payload.vitals.last_donation_date = vitals.lastDonationDate
            }

            if (vitals.lastDonationVenue) {
                payload.vitals.last_donation_venue = vitals.lastDonationVenue
            }

            if (vitals.lastMenstrualPeriod) {
                payload.vitals.last_menstrual_period = vitals.lastMenstrualPeriod
            }
        }

        if (force) {
            payload.force = true
        }

        const data = await donorService.submitEligibilityScreening(payload)

        // I-refresh ang status banner aron mo-reflect na sa bag-ong tubag.
        await loadStatus()

        // Walay `result` nga i-check. Ang matag kompleto nga questionnaire kay
        // makakuha og QR code -- ang blood center na ang mo-desisyon didto sa
        // counter kung makahatag ba og dugo ang donor.
        qrExpiresOn.value = data?.qr_valid_until ?? null
        qrValidityDays.value = data?.qr_valid_days ?? qrValidityDays.value
        qrCodeDataUrl.value = ''

        // Walay qr_token kung wala pa ma-verify ang email sa donor.
        if (data?.qr_token) {
            qrCodeDataUrl.value = await QRCode.toDataURL(data.qr_token, {
                width: 220,
                margin: 1,
                color: { dark: '#1f2937', light: '#ffffff' },
            })
        }

        answeringAgain.value = false
        showPassedModal.value = true
    } catch (err) {
        handleSubmitError(err)
    } finally {
        submitting.value = false
    }
}


async function load() {
    loading.value = true
    loadError.value = ''
    try {
        // GET /api/donors/eligibility/questions
        // Response: { version, sections: [{ key, number, title, questions:
        //   [{ code, number, text, kind, category, required }] }],
        //   categories: [{ key, title }], consent: { version, statements } }
        const data = await donorService.eligibilityQuestions()

        windowClosed.value = false
        questionVersion.value = data?.version ?? null
        sections.value = (data?.sections || []).map(section => ({
            key: section.key,
            title: section.title,
            questions: section.questions || [],
        }))
        categories.value = data?.categories || []

        consentVersion.value = data?.consent?.version ?? null
        consentStatements.value = data?.consent?.statements || []

        // Limpyohan ang answers aron walay stale nga code nga mabilin after reload
        Object.keys(answers).forEach(code => delete answers[code])
        Object.keys(consentTicked).forEach(i => delete consentTicked[i])
        Object.keys(consentExpanded).forEach(i => delete consentExpanded[i])
        activePage.value = 0
        stage.value = 'questions'
        continueBlocked.value = false
    } catch (err) {
        // Naa pa'y appointment ang donor pero sayo pa siya. Dili ni error --
        // schedule ni -- so ang petsa ang i-pakita, dili blangko nga porma.
        if (err?.data?.code === 'screening_window_not_open') {
            windowClosed.value = true
            windowOpensOn.value = err?.data?.window_opens_on ?? null
            return
        }

        console.error('Failed to load eligibility questions:', err)
        loadError.value = err?.message || 'Unable to load the health questionnaire.'
    } finally {
        loading.value = false
    }
}

async function loadPrefill() {
    try {
        // GET /api/donors/eligibility/prefill
        // Response: { blood_type, age, last_donation_date } — tanan pwede null
        const data = await donorService.eligibilityPrefill()

        if (data?.age != null && vitals.age === null) {
            vitals.age = data.age
            prefilled.age = true
        }

        if (data?.blood_type && !vitals.bloodType) {
            vitals.bloodType = data.blood_type
            prefilled.bloodType = true
        }

        // Editable ni gihapon: ang gi-submit kay declared_last_donation_date,
        // lahi sa record sa server, so pwede i-correct sa donor.
        if (data?.last_donation_date && !vitals.lastDonationDate) {
            vitals.lastDonationDate = data.last_donation_date
        }
    } catch (err) {
        // Convenience ra ni. Kung mapakyas, manual gihapon ma-fill sa donor,
        // so dili ni angay mo-block sa screening.
        console.error('Failed to load eligibility prefill:', err)
    }
}


async function loadStatus() {
    try {
        // GET /api/donors/eligibility
        // Response: { questionnaire_status, screening_date, screening_valid_until,
        //             consented_on, last_donation_date, next_eligible_date,
        //             questionnaire_version, screening_question_version,
        //             re_screen_recommended, appointment }
        eligibility.value = await donorService.eligibilityStatus()
    } catch (err) {
        // Informational ra ang banner, so dili ni angay mo-block sa form.
        console.error('Failed to load eligibility status:', err)
    }
}

// Gi-keepalive ni nga page, so mabuhi ang mga tubag sa donor sa questionnaire
// kung mo-navigate siya palayo. Ang load() mo-wipe sa `answers` ug ang
// loadPrefill() mo-touch sa vitals, so ang status banner ra ang i-refresh matag
// balik — dili nato guboon ang wala pa ma-submit nga screening.
let loadedOnce = false

onMounted(async () => {
    await Promise.all([load(), loadPrefill(), loadStatus()])
    loadedOnce = true
})

onActivated(() => {
    if (loadedOnce) loadStatus()
})
</script>

<style scoped>
/*
  Ang mga modal kay gi-Teleport sa <body>, gawas sa .eligibility-page, so
  kinahanglan pud nila ang mga variable. Kung wala, ang var(--primary) kay
  walay value ug transparent ang Submit button sa review modal.
*/
.eligibility-page,
.modal-backdrop {
    --primary: #1565c0;
    --accent: #d32f2f;
    --success: #2e7d32;
    --warning: #f57c00;
    --text-primary: #1f2937;
    --text-secondary: #9ca3af;
    --text-muted: #6b7280;
}

.eligibility-page {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px 32px 40px;
    display: flex;
    background: var(--rb-page-bg);
    flex-direction: column;
    gap: 20px;
    transition: background-color 0.2s ease;
}

.header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px 20px;
    flex-wrap: wrap;
}

.header-row__titles {
    min-width: 0;
}

.again-chip {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 6px;
    padding: 4px 4px 4px 12px;
    border: 1px solid #FEDF89;
    border-radius: 999px;
    background: #FFFAEB;
    color: #B54708;
    font-size: 12.5px;
    font-weight: 600;
}

.again-chip__cancel {
    padding: 4px 10px;
    border: none;
    border-left: 1px solid #FEDF89;
    border-radius: 0 999px 999px 0;
    background: none;
    color: #B54708;
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
}

.again-chip__cancel:hover {
    background: rgba(181, 71, 8, 0.08);
}

.again-chip__cancel:focus-visible {
    outline: 2px solid #B54708;
    outline-offset: 2px;
}

.submit-hint {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0;
    font-size: 12.5px;
    line-height: 1.55;
    color: #4b5563;
}

.submit-hint svg {
    flex: none;
    margin-top: 2px;
    color: var(--primary);
}

.submit-hint--warning {
    color: #7A2E0E;
}

.submit-hint--warning svg {
    color: #B54708;
}

.page-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.page-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 2px 0 0;
}

/* Skeleton loading */
.skeleton-wrap {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.skeleton {
    background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
    background-size: 400% 100%;
    border-radius: 14px;
    animation: shimmer 1.4s ease infinite;
}

.skeleton--header {
    height: 40px;
    max-width: 300px;
}

.skeleton--banner {
    height: 52px;
    border-radius: 10px;
}

.skeleton-main-grid {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 20px;
    align-items: start;
}

.skeleton-col {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.skeleton--panel {
    border-radius: 14px;
}

.skeleton--button {
    height: 46px;
    border-radius: 10px;
}

@keyframes shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
    .skeleton { animation: none !important; }
}

@media (max-width: 900px) {
    .skeleton-main-grid {
        grid-template-columns: 1fr;
    }
}

/* Current eligibility state */
.status-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    border-radius: 10px;
    padding: 12px 16px;
    border: 1px solid transparent;
}

.status-banner__icon {
    flex-shrink: 0;
    margin-top: 1px;
}

.status-banner__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.status-banner__title {
    font-size: 13px;
    font-weight: 600;
    margin: 0;
    line-height: 1.45;
}

.status-banner__detail {
    font-size: 12.5px;
    font-weight: 400;
    margin: 0;
    line-height: 1.55;
    color: #475569;
}

.status-banner__reasons {
    margin: 2px 0 0;
    padding-left: 18px;
    font-size: 12.5px;
    line-height: 1.6;
    color: #475569;
}

.status-banner--success {
    background: #F1F7F1;
    border-color: #CFE3D0;
    color: var(--success);
}

.status-banner--warning {
    background: #FDF6EC;
    border-color: #F3DDBB;
    color: #B45309;
}

.status-banner--danger {
    background: #FDF1F1;
    border-color: #F2D2D2;
    color: #C62828;
}

/* Usa ra ka column: questions una, unya details. Full width sa container. */
.main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
}

/*
  Desktop: gamiton ang lapad.
  - Questions: ang pangutana sa wala, ang Yes/No sa tuo, usa ka linya matag card.
  - Details: vitals ug consent magtapad; review ug submit sa ubos.
*/
@media (min-width: 1024px) {
    .question-list .question-card {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        column-gap: 32px;
        row-gap: 12px;
        padding: 16px 20px;
    }

    .question-card .question-card__text {
        max-width: 75ch;
        line-height: 1.5;
    }

    .question-card .answer-toggle {
        justify-content: flex-end;
    }

    .question-card .lmp-field {
        grid-column: 1 / -1;
        max-width: 280px;
        margin-top: 0;
    }

    .main-grid > .col-right {
        display: grid;
        grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
        align-items: start;
        gap: 20px;
    }

    .main-grid > .col-right > * {
        grid-column: 1 / -1;
    }

    .main-grid > .col-right > .details-vitals {
        grid-column: 1;
    }

    .main-grid > .col-right > .details-consent {
        grid-column: 2;
    }

    .main-grid > .col-right > .details-vitals--full {
        grid-column: 1 / -1;
    }

    .main-grid > .col-right > .details-back {
        justify-self: start;
    }

    /* Ang submit kay sa tuo, dili mo-stretch sa tibuok 1400px */
    .main-grid > .col-right > .btn-submit {
        justify-self: end;
        width: auto;
        min-width: 300px;
    }
}

.details-back {
    display: inline-flex;
    align-self: flex-start;
    align-items: center;
    gap: 4px;
    margin: -4px 0 -6px -8px;
    padding: 6px 12px 6px 8px;
    border: none;
    border-radius: 999px;
    background: none;
    color: var(--text-secondary, #6b7280);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease;
}

.details-back:hover {
    background: rgba(21, 101, 192, 0.06);
    color: var(--text-primary);
}

.details-back:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
}

.col-right .panel-title:focus {
    outline: none;
}

.wizard-blocked {
    margin: 0;
    padding: 10px 20px;
    border-top: 1px solid #fde68a;
    background: #fffbeb;
    color: #92400e;
    font-size: 12.5px;
    line-height: 1.5;
}

/* Ang details segment kay dili ma-click hangtod matubag tanan */
.wizard-seg--details:disabled {
    cursor: not-allowed;
}

.col-left,
.col-right {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.panel {
    background: white;
    border-radius: 14px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
    border: 1px solid #eef0f3;
    overflow: hidden;
}

.panel-header--simple {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid #f3f4f6;
}

/* Per-section progress. At thirty questions a donor needs to see where they
   are without counting the cards themselves. */
.panel-count {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #6b7280);
    font-variant-numeric: tabular-nums;
    flex: none;
}

.panel-title {
    font-weight: 700;
    font-size: 14px;
    color: var(--text-primary);
    margin: 0;
}

/* --- Section wizard --- */
/* Nipis nga strip, walay card: bar sa wala, count sa tuo */
.wizard-progress {
    display: flex;
    align-items: center;
    gap: 16px;
    scroll-margin-top: 16px;
}

.wizard-progress .wizard-progress__track {
    flex: 1;
    min-width: 0;
}

.wizard-progress .wizard-progress__count {
    flex: none;
}

.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
}

.wizard-progress__count {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    font-variant-numeric: tabular-nums;
}

.wizard-progress__track {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 6px;
}

/*
  Ang button mismo kay 20px ang taas para dali i-tap. ::before ang track,
  ::after ang asul nga fill nga mopuno base sa --fill (0-1) samtang
  nagtubag ang donor.
*/
.wizard-seg {
    position: relative;
    height: 20px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
}

.wizard-seg::before,
.wizard-seg::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 7px;
    height: 6px;
    border-radius: 999px;
}

.wizard-seg::before {
    background: #e5e7eb;
    transition: background-color 200ms ease;
}

.wizard-seg::after {
    background: var(--primary);
    transform: scaleX(var(--fill, 0));
    transform-origin: left center;
    transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.wizard-seg:hover::before {
    background: #d1d5db;
}

/* Ang page nga gipakita karon: light blue ang track imbes gray */
.wizard-seg--current::before,
.wizard-seg--current:hover::before {
    background: #cfe0f5;
}

@media (prefers-reduced-motion: reduce) {
    .wizard-seg::after {
        transition: none;
    }
}

.wizard-seg:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
    border-radius: 6px;
}

.wizard-panel .panel-title:focus {
    outline: none;
}

.wizard-group__titles {
    min-width: 0;
}

.wizard-group__part {
    margin: 2px 0 0;
    font-size: 11.5px;
    font-weight: 600;
    color: #6b7280;
}

/* Ikaduhang section sa usa ka page: gibulag sa linya sa ibabaw */
.wizard-group__head--next {
    border-top: 1px solid #f3f4f6;
}

.wizard-nav {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid #f3f4f6;
}

.wizard-nav__count {
    margin: 0 6px 0 0;
    font-size: 12.5px;
    font-weight: 500;
    color: #6b7280;
    font-variant-numeric: tabular-nums;
}

.wizard-nav__back {
    display: inline-flex;
    width: 42px;
    height: 42px;
    flex: none;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 10px;
    background: #f3f4f6;
    color: var(--text-primary);
    cursor: pointer;
    transition: background-color 150ms ease;
}

.wizard-nav__back:hover:not(:disabled) {
    background: #e5e7eb;
}

.wizard-nav__back:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.wizard-nav__back:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
}

.wizard-nav__next {
    height: 42px;
    min-width: 108px;
    padding: 0 16px 0 20px;
    gap: 4px;
}

.section-swap-enter-active,
.section-swap-leave-active {
    transition: opacity 180ms ease, transform 180ms ease;
}

.section-swap-enter-from {
    opacity: 0;
    transform: translateX(12px);
}

.section-swap-leave-to {
    opacity: 0;
    transform: translateX(-12px);
}

@media (prefers-reduced-motion: reduce) {
    .section-swap-enter-active,
    .section-swap-leave-active {
        transition: none;
    }
}

@media (max-width: 640px) {
    .wizard-nav {
        padding: 12px 16px;
    }
}

/* Questions */
.question-list {
    padding: 16px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.question-card {
    background: #f5f6f8;
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.question-card__text {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
}

.answer-toggle {
    display: flex;
    gap: 12px;
}

.answer-btn {
    min-width: 84px;
    padding: 8px 18px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    background: white;
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
}

.answer-btn--yes.answer-btn--active {
    background: #eaf6ea;
    border-color: var(--success);
    color: var(--success);
}

.answer-btn--no.answer-btn--active {
    background: #fbeaea;
    border-color: var(--accent);
    color: var(--accent);
}

.answer-btn:hover:not(.answer-btn--active) {
    background: #f3f4f6;
}

/* Forms */
.form-body {
    padding: 20px;
}

.load-error__text {
    font-size: 12.5px;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
}

.load-error__retry {
    margin-top: 16px;
}

.form-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.form-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 6px;
}

.form-input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    font-size: 13.5px;
    color: var(--text-primary);
    background: white;
    transition: border-color 0.15s ease;
}

.form-input:focus {
    outline: none;
    border-color: var(--primary);
}

.form-input--locked {
    background: #f3f4f6;
    color: var(--text-secondary);
    cursor: not-allowed;
}

.form-hint {
    font-size: 11.5px;
    color: var(--text-secondary);
    margin: 6px 0 0;
    line-height: 1.5;
}

.select-wrap {
    position: relative;
}

.form-input--select {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 32px;
    cursor: pointer;
}

.select-wrap__icon {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
}

/* Result preview */
.result-body {
    padding: 4px 20px 20px;
}

.result-box {
    border-radius: 10px;
    padding: 16px 12px;
    text-align: center;
    margin-bottom: 14px;
}

.result-box--pending {
    background: #f9fafb;
}

.result-box--success {
    background: #eaf6ea;
}

.result-box--danger {
    background: #fbeaea;
}

.result-box__label {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-secondary);
    margin: 0 0 4px;
}

.result-box__value {
    font-size: 19px;
    font-weight: 700;
    margin: 0;
}

.result-box__value--pending {
    color: var(--text-secondary);
}

.result-box__value--success {
    color: var(--success);
}

.result-box__value--danger {
    color: var(--accent);
}

.result-body__note {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
    text-align: center;
}

/* Buttons */
.btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 700;
    color: white;
    background: var(--primary);
    border: none;
    cursor: pointer;
    transition: opacity 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
    opacity: 0.92;
}

.btn-primary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.btn-block {
    width: 100%;
}

.btn-submit__icon {
    flex-shrink: 0;
}

.submit-error {
    --notice-fg: #B42318;
    --notice-text: #7A271A;
    --notice-bg: #FEF3F2;
    --notice-border: #FECDCA;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--notice-bg);
    border: 1px solid var(--notice-border);
    border-radius: 12px;
    padding: 14px 16px;
}

.submit-error--warning {
    --notice-fg: #B54708;
    --notice-text: #7A2E0E;
    --notice-bg: #FFFAEB;
    --notice-border: #FEDF89;
}

/* --- Valid screening gate --- */
.valid-gate {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 22px 24px;
}

.valid-gate__icon {
    display: flex;
    flex: none;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: #E8F5E9;
    color: var(--success);
}

.valid-gate__body {
    flex: 1;
    min-width: 0;
}

.valid-gate__title {
    margin: 2px 0 0;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
    color: var(--text-primary);
}

.valid-gate__text {
    margin: 6px 0 0;
    max-width: 65ch;
    font-size: 13px;
    line-height: 1.6;
    color: #4b5563;
}

.valid-gate__actions {
    display: flex;
    flex: none;
    gap: 10px;
    align-self: center;
}

.valid-gate__actions .btn-primary,
.valid-gate__actions .btn-outline {
    white-space: nowrap;
}

@media (max-width: 767px) {
    .valid-gate {
        flex-wrap: wrap;
        padding: 18px;
    }

    .valid-gate__actions {
        width: 100%;
        flex-direction: column;
    }

    .valid-gate__actions .btn-primary,
    .valid-gate__actions .btn-outline {
        width: 100%;
    }
}


.submit-error__body {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
}

.submit-error__icon {
    flex: none;
    margin-top: 1px;
    color: var(--notice-fg);
}

.submit-error__text {
    font-size: 13px;
    color: var(--notice-text);
    margin: 0;
    line-height: 1.55;
}

.submit-error .submit-error__action {
    background: #ffffff;
    border: 1px solid var(--notice-border);
    color: var(--notice-fg);
    white-space: nowrap;
}

.submit-error .submit-error__action:hover:not(:disabled) {
    border-color: var(--notice-fg);
}

/* Desktop: mensahe sa wala, button sa tuo */
@media (min-width: 768px) {
    .submit-error {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 14px 18px;
    }

    .submit-error .submit-error__action {
        flex: none;
    }
}

@media (max-width: 640px) {
    .eligibility-page {
        padding: 16px 16px 32px;
    }
}

/* Eligibility passed modal */
.modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 1000;
}

.modal-card {
    width: 100%;
    max-width: 380px;
    background: white;
    border-radius: 14px;
    padding: 28px 24px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    box-shadow: 0 8px 28px rgba(15, 23, 42, 0.16);
}

.modal-check {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: #e8f5e9;
    color: var(--success);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
}

.modal-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.modal-subtitle {
    font-size: 12.5px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 6px 0 20px;
    max-width: 300px;
}

.modal-qr-wrap {
    padding: 10px;
    border-radius: 12px;
    border: 1px solid #eef0f3;
    margin-bottom: 14px;
}

.modal-qr-image {
    width: 180px;
    height: 180px;
    display: block;
}

.modal-qr-image--placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f9fafb;
}

.modal-spinner {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    border: 3px solid #e3ebf6;
    border-top-color: var(--primary);
    animation: modal-spin 0.8s linear infinite;
}

@keyframes modal-spin {
    to { transform: rotate(360deg); }
}

.modal-validity {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 20px;
}

.modal-actions {
    display: flex;
    gap: 10px;
    width: 100%;
}

.modal-actions .btn-primary,
.modal-actions .btn-outline {
    flex: 1;
    width: auto;
}

.btn-outline {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 11px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    background: #f3f4f6;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
}

.btn-outline:hover {
    background: #e5e7eb;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
    transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
    opacity: 0;
}

.modal-fade-enter-active .modal-card,
.modal-fade-leave-active .modal-card {
    transition: transform 0.2s ease;
}

.modal-fade-enter-from .modal-card,
.modal-fade-leave-to .modal-card {
    transform: scale(0.96) translateY(8px);
}

/* ============ Dark mode ============ */
/*
 * Tanang dark rule naka-anchor sa .eligibility-page ug sa .eligibility-modal (ang mga modal kay
 * gi-Teleport sa <body>, gawas sa page). `:global(…)` mogawas sa scope
 * system, so ang bare `:global(.dark .form-input)` kaniadto kay mo-match sa
 * .form-input sa TANANG page human ma-load ni nga stylesheet: mao ang
 * ngitngit nga inputs ug ang asul nga toggle sa profile.
 */

:global(.dark .eligibility-page) {
    --text-primary: #F1F5F9;
    --text-secondary: #94A3B8;
    background: #0F172A;
}

:global(.dark .eligibility-modal) {
    --text-primary: #F1F5F9;
    --text-secondary: #94A3B8;
    --text-muted: #94A3B8;
}

:global(.dark .eligibility-page .panel),
:global(.dark .eligibility-modal .panel),
:global(.dark .eligibility-page .modal-card),
:global(.dark .eligibility-modal .modal-card),
:global(.dark .eligibility-page .modal-qr-wrap),
:global(.dark .eligibility-modal .modal-qr-wrap) {
    background: #1E293B;
    border-color: #334155;
}
:global(.dark .eligibility-page .modal-title),
:global(.dark .eligibility-modal .modal-title) {
    color: #F1F5F9;
}
:global(.dark .eligibility-page .wizard-progress__count) {
    color: #94A3B8;
}
:global(.dark .eligibility-page .wizard-seg::before) {
    background: #334155;
}
:global(.dark .eligibility-page .wizard-seg::after) {
    background: #64B5F6;
}
:global(.dark .eligibility-page .wizard-seg--current::before) {
    background: rgba(100, 181, 246, 0.28);
}
:global(.dark .eligibility-page .wizard-blocked) {
    background: rgba(245, 158, 11, 0.10);
    border-top-color: rgba(245, 158, 11, 0.30);
    color: #FCD34D;
}
:global(.dark .eligibility-page .details-back:hover) {
    background: rgba(255, 255, 255, 0.06);
}
:global(.dark .eligibility-page .wizard-nav),
:global(.dark .eligibility-page .wizard-group__head--next) {
    border-top-color: #334155;
}
:global(.dark .eligibility-page .wizard-nav__back) {
    background: #334155;
    color: #F1F5F9;
}
:global(.dark .eligibility-page .wizard-nav__back:hover:not(:disabled)) {
    background: #475569;
}
:global(.dark .eligibility-page .wizard-nav__count),
:global(.dark .eligibility-page .wizard-group__part) {
    color: #94A3B8;
}
:global(.dark .eligibility-page .consent-item) {
    border-bottom-color: #334155;
}
:global(.dark .eligibility-page .consent-all) {
    background: #0F172A;
    border-color: #334155;
}
:global(.dark .eligibility-page .consent-item__more),
:global(.dark .eligibility-page .review-missing__link) {
    color: #64B5F6;
}

:global(.dark .eligibility-page .modal-subtitle),
:global(.dark .eligibility-modal .modal-subtitle) {
    color: #94A3B8;
}

:global(.dark .eligibility-page .modal-validity),
:global(.dark .eligibility-modal .modal-validity) {
    color: #F1F5F9;
}

:global(.dark .eligibility-page .modal-check),
:global(.dark .eligibility-modal .modal-check) {
    background: rgba(102, 187, 106, 0.16);
    color: #66BB6A;
}

:global(.dark .eligibility-page .modal-actions .btn-primary),
:global(.dark .eligibility-modal .modal-actions .btn-primary) {
    background: #1565C0;
}

:global(.dark .eligibility-page .modal-card--review .review-head),
:global(.dark .eligibility-modal .modal-card--review .review-head),
:global(.dark .eligibility-page .modal-card--review .modal-actions),
:global(.dark .eligibility-modal .modal-card--review .modal-actions) {
    border-color: #334155;
}

:global(.dark .eligibility-page .modal-card--review .modal-actions),
:global(.dark .eligibility-modal .modal-card--review .modal-actions) {
    background: #172033;
}

:global(.dark .eligibility-page .modal-card--review .review-answer),
:global(.dark .eligibility-modal .modal-card--review .review-answer) {
    border-bottom-color: #334155;
}

:global(.dark .eligibility-page .submit-error),
:global(.dark .eligibility-modal .submit-error) {
    --notice-fg: #F97066;
    --notice-text: #FECDCA;
    --notice-bg: rgba(240, 68, 56, 0.10);
    --notice-border: rgba(240, 68, 56, 0.28);
}

:global(.dark .eligibility-page .submit-error--warning),
:global(.dark .eligibility-modal .submit-error--warning) {
    --notice-fg: #FDB022;
    --notice-text: #FEF0C7;
    --notice-bg: rgba(247, 144, 9, 0.10);
    --notice-border: rgba(247, 144, 9, 0.30);
}

:global(.dark .eligibility-page .valid-gate__icon) {
    background: rgba(102, 187, 106, 0.16);
    color: #66BB6A;
}

:global(.dark .eligibility-page .valid-gate__text) {
    color: #94A3B8;
}

:global(.dark .eligibility-page .again-chip) {
    background: rgba(247, 144, 9, 0.10);
    border-color: rgba(247, 144, 9, 0.30);
    color: #FDB022;
}

:global(.dark .eligibility-page .again-chip__cancel) {
    border-left-color: rgba(247, 144, 9, 0.30);
    color: #FDB022;
}

:global(.dark .eligibility-page .submit-hint) {
    color: #94A3B8;
}

:global(.dark .eligibility-page .submit-hint svg) {
    color: #64B5F6;
}

:global(.dark .eligibility-page .submit-hint--warning) {
    color: #FEF0C7;
}

:global(.dark .eligibility-page .submit-hint--warning svg) {
    color: #FDB022;
}

:global(.dark .eligibility-page .submit-error .submit-error__action),
:global(.dark .eligibility-modal .submit-error .submit-error__action) {
    background: rgba(15, 23, 42, 0.6);
}

:global(.dark .eligibility-page .status-banner--success),
:global(.dark .eligibility-modal .status-banner--success) {
    background: rgba(102, 187, 106, 0.10);
    border-color: rgba(102, 187, 106, 0.24);
    color: #A5D6A7;
}

:global(.dark .eligibility-page .status-banner--warning),
:global(.dark .eligibility-modal .status-banner--warning) {
    background: rgba(245, 124, 0, 0.10);
    border-color: rgba(245, 124, 0, 0.24);
    color: #FFCC80;
}

:global(.dark .eligibility-page .status-banner--danger),
:global(.dark .eligibility-modal .status-banner--danger) {
    background: rgba(239, 83, 80, 0.10);
    border-color: rgba(239, 83, 80, 0.24);
    color: #EF9A9A;
}

:global(.dark .eligibility-page .status-banner__detail),
:global(.dark .eligibility-modal .status-banner__detail),
:global(.dark .eligibility-page .status-banner__reasons),
:global(.dark .eligibility-modal .status-banner__reasons) {
    color: #CBD5E1;
}

:global(.dark .eligibility-page .panel-header--simple),
:global(.dark .eligibility-modal .panel-header--simple) { border-color: #334155; }


:global(.dark .eligibility-page .question-card),
:global(.dark .eligibility-modal .question-card) { background: #172033; }

:global(.dark .eligibility-page .answer-btn),
:global(.dark .eligibility-modal .answer-btn) {
    background: #1E293B;
    border-color: #334155;
    color: #F1F5F9;
}
:global(.dark .eligibility-page .answer-btn:hover:not(.answer-btn--active)),
:global(.dark .eligibility-modal .answer-btn:hover:not(.answer-btn--active)) { background: #263449; }
:global(.dark .eligibility-page .answer-btn--yes.answer-btn--active),
:global(.dark .eligibility-modal .answer-btn--yes.answer-btn--active) { background: rgba(102,187,106,0.16); }
:global(.dark .eligibility-page .answer-btn--no.answer-btn--active),
:global(.dark .eligibility-modal .answer-btn--no.answer-btn--active) { background: rgba(239,83,80,0.16); }

:global(.dark .eligibility-page .form-input),
:global(.dark .eligibility-modal .form-input) {
    background: #0F172A;
    border-color: #334155;
    color: #F1F5F9;
}

:global(.dark .eligibility-page .form-input--locked),
:global(.dark .eligibility-modal .form-input--locked) {
    background: #172033;
    color: #94A3B8;
}

:global(.dark .eligibility-page .result-box--pending),
:global(.dark .eligibility-modal .result-box--pending) { background: #263449; }
:global(.dark .eligibility-page .result-box--success),
:global(.dark .eligibility-modal .result-box--success) { background: rgba(102,187,106,0.16); }
:global(.dark .eligibility-page .result-box--danger),
:global(.dark .eligibility-modal .result-box--danger) { background: rgba(239,83,80,0.16); }

:global(.dark .eligibility-page .btn-outline),
:global(.dark .eligibility-modal .btn-outline) {
    background: #263449;
    color: #E2E8F0;
}
:global(.dark .eligibility-page .btn-outline:hover),
:global(.dark .eligibility-modal .btn-outline:hover) { background: #334155; }

:global(.dark .eligibility-page .modal-qr-image--placeholder),
:global(.dark .eligibility-modal .modal-qr-image--placeholder) { background: #172033; }

/* background-image, not the `background` shorthand: the shorthand resets
   background-size to `auto`, which collapses the 400%-wide gradient to the
   element width and leaves the shimmer keyframes with zero travel. */
:global(.dark .eligibility-page .skeleton),
:global(.dark .eligibility-modal .skeleton) {
    background-image: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.answer-btn:focus-visible {
  outline: 2px solid var(--rb-primary, #1565C0);
  outline-offset: 2px;
}

/* --- Section I-C consent, the review step, and the closed window --- */

.consent-item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 0;
    border-bottom: 1px solid #f3f4f6;
}

.consent-item:last-of-type { border-bottom: none; }

.consent-item__box {
    margin-top: 3px;
    width: 16px;
    height: 16px;
    flex: none;
    accent-color: var(--rb-primary, #1565C0);
    cursor: pointer;
}

.consent-item__content {
    flex: 1;
    min-width: 0;
}

.consent-item__text {
    display: block;
    font-size: 12.5px;
    line-height: 1.55;
    color: var(--text-primary);
    cursor: pointer;
}

.consent-item__text.is-clamped {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
}

.consent-item__more {
    margin-top: 2px;
    padding: 2px 0;
    border: none;
    background: none;
    color: var(--rb-primary, #1565C0);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}

.consent-item__more:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
}

.consent-item__more:focus-visible {
    outline: 2px solid var(--rb-primary, #1565C0);
    outline-offset: 2px;
    border-radius: 4px;
}

.consent-all {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-top: 6px;
    padding: 12px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: #f9fafb;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    cursor: pointer;
}

.consent-all .consent-item__box {
    margin-top: 0;
}

.review-missing,
.review-ready {
    margin: 0 0 12px;
    font-size: 12.5px;
    line-height: 1.5;
}

.review-missing { color: #92400e; }
.review-ready { color: #166534; }

.review-missing__link {
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    font-weight: 600;
    color: var(--rb-primary, #1565C0);
    text-decoration: underline;
    cursor: pointer;
}

/* A question the donor was sent back to. Fades out on its own so it marks the
   place without leaving a permanent error state on an untouched field. */
.question-card--missing {
    outline: 2px solid #f59e0b;
    outline-offset: 2px;
}

.answer-btn--na.answer-btn--active {
    background: #e5e7eb;
    border-color: #9ca3af;
    color: #374151;
}

.lmp-field {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.window-closed { max-width: 640px; }

.window-closed__text {
    margin: 0 0 14px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary, #6b7280);
}

.window-closed__link { display: inline-flex; width: auto; }

/* --- Review modal --- */

/*
  Review modal: header ug actions kay fixed, ang lista ra ang mo-scroll.
  Walay padding ang card mismo para ang scroll area mo-abot sa ngilit.
*/
.modal-card--review {
    max-width: 680px;
    width: 100%;
    max-height: min(85vh, 760px);
    max-height: min(85dvh, 760px);
    padding: 0;
    align-items: stretch;
    text-align: left;
    overflow: hidden;
}

.review-head {
    padding: 22px 24px 16px;
    border-bottom: 1px solid #eef0f3;
}

.review-head .modal-subtitle {
    max-width: none;
    margin: 4px 0 0;
    color: var(--text-muted);
}

.review-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px 24px 4px;
    overscroll-behavior: contain;
}

.modal-card--review .modal-actions {
    padding: 14px 24px;
    border-top: 1px solid #eef0f3;
    background: #fafbfc;
}

.review-section { margin-bottom: 18px; }

.review-section__title {
    margin: 0 0 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.review-answers { margin: 0; padding: 0; list-style: none; }

.review-answer:last-child { border-bottom: none; }

.review-answer {
    display: flex;
    gap: 16px;
    align-items: baseline;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid #f3f4f6;
}

.review-answer__text {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--text-primary);
}

.review-answer__value {
    flex: none;
    min-width: 32px;
    text-align: right;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
}

</style>
