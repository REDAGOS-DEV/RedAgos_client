<template>
  <div class="home scope-donor-dashboard">
    <!-- Skeleton, shaped like the page below -->
    <div v-if="loading" class="home__inner" aria-busy="true">
      <div class="skeleton skeleton--greet" />
      <div class="home__grid">
        <div class="home__main">
          <div class="skeleton" style="height:300px" />
          <div class="skeleton" style="height:120px" />
          <div class="skeleton" style="height:220px" />
        </div>
        <div class="home__side">
          <div class="skeleton" style="height:340px" />
        </div>
      </div>
    </div>

    <div v-else class="home__inner">
      <!-- Greeting: who, and the two facts a donor is asked for most -->
      <header class="greet">
        <p class="greet__date">{{ todayLabel }}</p>
        <h1 class="greet__title">{{ greeting }}</h1>
        <p class="greet__chips">
          <span class="chip chip--blood">
            <AssetIcon name="blood-drop" :size="13" />
            {{ bloodType === '-' ? 'Blood type not set' : `Blood type ${bloodType}` }}
          </span>
          <span v-if="profile?.donor_code" class="chip">{{ profile.donor_code }}</span>
          <span v-if="totalDonations > 0" class="chip">
            {{ totalDonations }} donation{{ totalDonations === 1 ? '' : 's' }}
          </span>
        </p>
      </header>

      <div class="home__grid">
        <div class="home__main">
          <!--
            Where the donor is in the donation cycle. It repeats for every
            donation: Screen, Book, Check in, Donate, Rest, then Screen again.
            One card, one status, one main button.
          -->
          <section class="cycle" :class="`cycle--${stage}`" aria-labelledby="cycle-title">
            <div class="cycle__top">
              <span class="cycle__count">Step {{ stageIndex + 1 }} of {{ CYCLE.length }}</span>
              <span class="cycle__round">{{ roundLabel }}</span>
            </div>

            <div class="cycle__body">
              <!-- Rest: how far through the waiting period -->
              <div v-if="stage === 'rest'" class="cycle__visual cycle__visual--ring" role="img"
                :aria-label="`${daysUntilEligible} days until you can donate again`">
                <svg viewBox="0 0 36 36" class="gauge">
                  <circle class="gauge__track" cx="18" cy="18" r="15.9155" />
                  <circle class="gauge__fill" cx="18" cy="18" r="15.9155"
                    :style="{ strokeDasharray: `${restPercent} 100` }" />
                </svg>
                <span class="gauge__label">
                  <strong>{{ daysUntilEligible }}</strong>
                  <small>day{{ daysUntilEligible === 1 ? '' : 's' }}</small>
                </span>
              </div>

              <!-- Check in / Donate: the appointment date -->
              <div v-else-if="currentAppointment && ['screen', 'checkin', 'donate'].includes(stage)"
                class="cycle__visual cycle__visual--date">
                <span class="date__month">{{ formatDate(currentAppointment.appointment_datetime, 'MMM') }}</span>
                <span class="date__day">{{ formatDate(currentAppointment.appointment_datetime, 'D') }}</span>
                <span class="date__time">{{ formatDate(currentAppointment.appointment_datetime, 'h:mm A') }}</span>
              </div>

              <div v-else class="cycle__visual cycle__visual--icon">
                <AssetIcon :name="nextStep.icon" :size="28" />
              </div>

              <div class="cycle__text">
                <h2 id="cycle-title" class="cycle__title">{{ nextStep.title }}</h2>
                <p class="cycle__status">{{ nextStep.status }}</p>
              </div>
            </div>

            <ol class="steps" aria-label="Donation steps">
              <li v-for="(step, i) in CYCLE" :key="step.key" class="steps__item"
                :class="`steps__item--${stepState(i)}`" :aria-current="i === stageIndex ? 'step' : undefined">
                <span class="steps__dot">
                  <AssetIcon v-if="stepState(i) === 'done'" name="check" :size="13" />
                  <AssetIcon v-else-if="stepState(i) === 'stop'" name="circle-alert" :size="14" />
                  <span v-else>{{ i + 1 }}</span>
                </span>
                <span class="steps__label">{{ step.label }}</span>
              </li>
            </ol>

            <div class="cycle__actions">
              <NuxtLink :to="nextStep.to" class="btn btn--primary">
                <AssetIcon :name="nextStep.icon" :size="16" />
                {{ nextStep.label }}
              </NuxtLink>
              <a v-if="directionsUrl && ['screen', 'checkin', 'donate'].includes(stage)" :href="directionsUrl"
                target="_blank" rel="noopener" class="btn btn--ghost">
                <AssetIcon name="map-pin" :size="16" />
                Directions
              </a>
              <NuxtLink to="/donor/appointments" class="cycle__link">
                {{ currentAppointment ? 'Manage appointment' : 'View appointments' }}
                <AssetIcon name="chevron-right" :size="14" />
              </NuxtLink>
            </div>
          </section>

          <!-- Setup reminders: only what is still missing, gone once done -->
          <section v-if="setupItems.length || emailPrompt" class="setup" aria-label="Finish setting up">
            <!--
              A donor the blood center desk registered has no confirmed email:
              the desk typed it (no link is mailed then), or there is none.
              Booking, the check-in QR and a forgotten-password link all need one.
            -->
            <NuxtLink v-if="emailPrompt === 'add'" to="/donor/profile" class="setup__item setup__item--warning">
              <span class="setup__icon"><AssetIcon name="mail" :size="18" /></span>
              <span class="setup__text">
                <strong>Add your email address</strong>
                <span>You need it to book online, get your check-in QR code and reset a forgotten password.</span>
              </span>
              <AssetIcon name="chevron-right" :size="16" class="setup__chev" />
            </NuxtLink>
            <div v-else-if="emailPrompt" class="setup__item" :class="verifySent ? 'setup__item--muted' : 'setup__item--warning'"
              role="status">
              <span class="setup__icon"><AssetIcon name="mail" :size="18" /></span>
              <span class="setup__text">
                <strong>{{ verifySent ? 'Check your inbox' : 'Confirm your email' }}</strong>
                <span v-if="verifySent">Open the link we sent to {{ user?.email }} to confirm it.</span>
                <span v-else>Confirm {{ user?.email }} to book online, get your check-in QR code and reset a forgotten password.</span>
                <span v-if="verifyError" class="setup__error">{{ verifyError }}</span>
              </span>
              <button v-if="!verifySent" type="button" class="setup__action" :disabled="verifySending"
                @click="sendVerification">
                {{ verifySending ? 'Sending…' : 'Send link' }}
              </button>
            </div>

            <NuxtLink v-for="item in setupItems" :key="item.key" to="/donor/profile" class="setup__item"
              :class="`setup__item--${item.tone}`">
              <span class="setup__icon"><AssetIcon :name="item.icon" :size="18" /></span>
              <span class="setup__text">
                <strong>{{ item.title }}</strong>
                <span>{{ item.text }}</span>
              </span>
              <AssetIcon name="chevron-right" :size="16" class="setup__chev" />
            </NuxtLink>
          </section>

          <!--
            For you: what helps at this step, and the blood drives coming up.
            It changes with the donor's step instead of scrolling forever.
          -->
          <section class="foryou" aria-labelledby="foryou-title">
            <div class="section-head">
              <h2 id="foryou-title" class="section-title">For you</h2>
              <!-- Straight to the drives on the booking page; not while a booking stands. -->
              <NuxtLink v-if="bloodDrives.length && !currentAppointment" to="/donor/appointments?type=mobile" class="section-link">
                All drives
                <AssetIcon name="chevron-right" :size="14" />
              </NuxtLink>
            </div>

            <div class="foryou__grid">
              <article class="tip">
                <span class="tip__icon"><AssetIcon :name="tip.icon" :size="18" /></span>
                <h3 class="tip__title">{{ tip.title }}</h3>
                <p class="tip__text">{{ tip.text }}</p>
              </article>

              <article v-for="drive in bloodDrives.slice(0, 2)" :key="drive.id" class="drive"
                :class="{ 'drive--today': driveWhen(drive).today }">
                <span class="drive__date">
                  <span>{{ formatDate(drive.date, 'MMM') }}</span>
                  <strong>{{ formatDate(drive.date, 'D') }}</strong>
                </span>
                <span class="drive__body">
                  <span class="drive__kicker">
                    Blood drive
                    <!-- When it is: today, on now, over, or tomorrow. -->
                    <span v-if="driveWhen(drive).badge" class="drive__badge"
                      :class="`drive__badge--${driveWhen(drive).tone}`">{{ driveWhen(drive).badge }}</span>
                  </span>
                  <strong class="drive__name">{{ drive.name }}</strong>
                  <span class="drive__meta">
                    <AssetIcon name="map-pin" :size="12" />
                    <span>{{ drive.location }}</span>
                  </span>
                  <span v-if="driveHours(drive)" class="drive__meta">
                    <AssetIcon name="clock" :size="12" />
                    <span>{{ driveHours(drive) }}</span>
                  </span>
                  <span class="drive__foot" :class="{ 'drive__foot--muted': driveNote(drive).muted }">
                    {{ driveNote(drive).text }}
                  </span>
                  <span class="drive__actions">
                    <!-- Kept, but not a way in when there is no slot to take. -->
                    <span v-if="driveBlocked(drive)" class="drive__btn drive__btn--primary drive__btn--off"
                      aria-disabled="true" :title="driveBlocked(drive)">Book</span>
                    <NuxtLink v-else :to="`/donor/appointments?type=mobile&drive=${drive.id}`"
                      class="drive__btn drive__btn--primary">Book</NuxtLink>
                    <a :href="mapsUrl(drive.location)" target="_blank" rel="noopener" class="drive__btn"
                      :aria-label="`Directions to ${drive.location} (opens Google Maps)`">
                      <AssetIcon name="map-pin" :size="13" />
                      Directions
                    </a>
                  </span>
                </span>
              </article>

              <div v-if="!bloodDrives.length" class="drive drive--empty">
                <span class="drive__date drive__date--empty"><AssetIcon name="calendar" :size="18" /></span>
                <span class="drive__body">
                  <span class="drive__kicker">Blood drives</span>
                  <span class="drive__meta">No blood drives are scheduled right now. You can still book at a blood center.</span>
                </span>
              </div>
            </div>
          </section>

          <!-- Impact -->
          <section class="impact" aria-labelledby="impact-title">
            <h2 id="impact-title" class="section-title">Your impact</h2>
            <div class="impact__grid">
              <div class="impact__tile">
                <span class="impact__value">{{ totalDonations }}</span>
                <span class="impact__label">Donation{{ totalDonations === 1 ? '' : 's' }}</span>
              </div>
              <div class="impact__tile">
                <span class="impact__value">{{ litresGiven }}<small> L</small></span>
                <span class="impact__label">Blood given</span>
              </div>
              <div class="impact__tile">
                <span class="impact__value">{{ totalDonations * 3 }}</span>
                <span class="impact__label">Lives helped</span>
              </div>
              <div class="impact__tile impact__tile--goal">
                <span class="impact__goal-head">
                  <AssetIcon name="star-fill" :size="14" />
                  {{ milestone.name }}
                </span>
                <span class="meter" role="progressbar" :aria-valuenow="totalDonations" aria-valuemin="0"
                  :aria-valuemax="milestone.target" :aria-label="`${milestone.name} progress`">
                  <span class="meter__fill" :style="{ width: `${milestone.percent}%` }" />
                </span>
                <span class="impact__label">{{ milestone.text }}</span>
              </div>
            </div>
            <p class="impact__note">Estimates: about 450 mL per donation, and each one can help up to 3 patients.</p>
          </section>

          <!-- Recent activity -->
          <section class="activity" aria-labelledby="activity-title">
            <div class="section-head">
              <h2 id="activity-title" class="section-title">Recent visits</h2>
              <NuxtLink to="/donor/history" class="section-link">
                See all
                <AssetIcon name="chevron-right" :size="14" />
              </NuxtLink>
            </div>

            <ul v-if="recentDonations.length" class="activity__list">
              <li v-for="d in recentDonations.slice(0, 3)" :key="d.id" class="activity__item">
                <span class="activity__icon" :class="`activity__icon--${donationTone(d)}`">
                  <AssetIcon name="blood-drop" :size="16" />
                </span>
                <span class="activity__main">
                  <strong>{{ d.facility_name }}</strong>
                  <span>{{ d.blood_type }}, {{ d.donation_type === 'walk_in' ? 'walk-in' : 'booked' }}</span>
                </span>
                <span class="activity__side">
                  <span class="activity__date">{{ formatDate(d.donation_date, 'MMM D, YYYY') }}</span>
                  <span class="pill" :class="`pill--${donationTone(d)}`">{{ donationLabel(d) }}</span>
                </span>
              </li>
            </ul>
            <div v-else class="activity__empty">
              <AssetIcon name="history" :size="22" />
              <p>No visits yet. Your first donation will show here.</p>
            </div>
          </section>
        </div>

        <!-- Side: the Pass and screening, what the counter asks for -->
        <aside class="home__side">
          <section class="pass" aria-labelledby="pass-title">
            <div class="pass__top">
              <div>
                <p id="pass-title" class="pass__label">Donor Pass</p>
                <p class="pass__code">{{ profile?.donor_code || 'RedAgos donor' }}</p>
              </div>
              <span class="pass__blood">{{ bloodType }}</span>
            </div>

            <NuxtLink to="/donor/qrcode" class="pass__qr" aria-label="Open my Pass">
              <AssetIcon name="qr-code" :size="64" />
              <span>Open it at the counter</span>
            </NuxtLink>

            <dl class="pass__facts">
              <!--
                The health questions, not the QR itself: the code can lapse or
                be revoked (a cancelled booking) while the answers still stand,
                and only the Pass page asks the server about the code.
              -->
              <div>
                <dt>Health questions</dt>
                <dd :class="`tone--${screeningTone}`">{{ QUESTIONNAIRE_LABELS[questionnaireStatus] ?? 'Not yet answered' }}</dd>
              </div>
              <div v-if="profile?.screening_date">
                <dt>Answered on</dt>
                <dd>{{ formatDate(profile.screening_date, 'MMM D, YYYY') }}</dd>
              </div>
              <div>
                <dt>QR code</dt>
                <dd :class="qrActive ? 'tone--success' : ''">
                  {{ qrActive ? `Valid until ${formatDate(qrValidUntil, 'MMM D, YYYY')}` : 'Not issued yet' }}
                </dd>
              </div>
              <div v-if="screeningDone && profile?.screening_valid_until">
                <dt>Answers good until</dt>
                <dd>{{ formatDate(profile.screening_valid_until, 'MMM D, YYYY') }}</dd>
              </div>
            </dl>

            <div class="pass__actions">
              <NuxtLink to="/donor/qrcode" class="btn btn--light">
                <AssetIcon name="qr-code" :size="16" />
                Open Pass
              </NuxtLink>
              <NuxtLink to="/donor/eligibility" class="btn btn--glass">
                <AssetIcon name="clipboard-check" :size="16" />
                {{ screeningDone ? 'Retake screening' : 'Take screening' }}
              </NuxtLink>
            </div>
          </section>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true,
})

import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { donorService } from '~/api/donor/DonorService'
import { authService } from '~/api/auth/AuthService'
import { bookingCatalogService } from '~/api/booking-catalog/BookingCatalogService'
import { useUser } from '~/composables/useUser'

const route = useRoute()

const loading = ref(true)

// ── Greeting ──
const { user } = useUser()

// ── Email prompt ──
// 'add' with no address, 'confirm' with an unconfirmed one, null otherwise.
// A self-registered donor never sees it: they confirmed before signing in.
const emailPrompt = computed(() => {
  if (!user.value) return null
  if (!user.value.email) return 'add'
  return user.value.email_verified ? null : 'confirm'
})
const verifySending = ref(false)
const verifySent = ref(false)
const verifyError = ref('')

async function sendVerification() {
  if (verifySending.value) return
  verifySending.value = true
  verifyError.value = ''
  try {
    await authService.resendVerificationEmail()
    verifySent.value = true
  } catch (err) {
    verifyError.value = err?.status === 429
      ? 'Too many requests. Please wait a few minutes and try again.'
      : (err?.message || 'Could not send the link. Please try again.')
  } finally {
    verifySending.value = false
  }
}

const greeting = computed(() => {
  const h = new Date().getHours()
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const first = user.value?.full_name?.split(' ')[0]
  const name = first ? first.charAt(0).toUpperCase() + first.slice(1) : ''
  return name ? `${part}, ${name}!` : `${part}!`
})

const todayLabel = computed(() =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }))

// Core donor data
const profile = ref(null)
const eligibilityStatus = ref('pending')

// Whether the questionnaire is answered and still stands. Every submission is
// recorded `pending` until the centre decides, so eligibility_status never
// reports it done — this is what the cycle and the Pass read instead.
const questionnaireStatus = ref('not_answered')
const screeningDone = computed(() => questionnaireStatus.value === 'answered')

const QUESTIONNAIRE_LABELS = {
  not_answered: 'Not yet answered',
  answered: 'Answered',
  expired: 'Needs answering again',
}
const screeningTone = computed(() => {
  if (screeningDone.value) return 'success'
  return questionnaireStatus.value === 'expired' ? 'warning' : 'muted'
})

// From the dashboard payload: whether a check-in code is live, and until when.
const qrActive = ref(false)
const qrValidUntil = ref(null)

const bloodType = ref('-')
const totalDonations = ref(0)
const upcomingAppointment = ref(null)
const recentDonations = ref([])

// From GET /api/donors/profile: the ID check and the last donation date,
// which the dashboard payload doesn't carry.
const identityStatus = ref(null)
const lastDonationDate = ref(null)

// When the donor may give again (GET /api/donors/eligibility), for the rest
// countdown. Informational only: the server refuses an early booking anyway.
const nextEligibleDate = ref(null)

const DAY_MS = 86_400_000

function startOfDay(value) {
  const d = parseDate(value)
  if (!d) return null
  d.setHours(0, 0, 0, 0)
  return d
}

function daysFromToday(value) {
  const day = startOfDay(value)
  if (!day) return null
  return Math.round((day - startOfDay(new Date())) / DAY_MS)
}

const daysUntilEligible = computed(() => Math.max(0, daysFromToday(nextEligibleDate.value) ?? 0))

// How far through the rest period, for the ring. Falls back to an empty ring
// when the last donation date is unknown.
const restPercent = computed(() => {
  const last = startOfDay(lastDonationDate.value)
  const next = startOfDay(nextEligibleDate.value)
  if (!last || !next || next <= last) return 0
  const done = (startOfDay(new Date()) - last) / (next - last)
  return Math.round(Math.min(1, Math.max(0, done)) * 100)
})

// ── The donation cycle ──
const CYCLE = [
  { key: 'book', label: 'Book' },
  { key: 'screen', label: 'Screen' },
  { key: 'checkin', label: 'Check in' },
  { key: 'donate', label: 'Donate' },
  { key: 'rest', label: 'Rest' },
]

/*
 * The dashboard payload's upcoming_appointment only lists bookings whose time
 * is still ahead, so on the day itself it drops the booking the moment its
 * slot passes, even with the donor in the queue. The full list
 * (GET /donors/appointments) fills that in, and shows a booking that came and
 * went without a visit. Missed bookings are never closed automatically: they
 * stay `scheduled` until the centre marks them `no_show`, and neither holds
 * up a new booking.
 */
const myAppointments = ref([])
const ACTIVE = ['scheduled', 'confirmed']

function localDay(value) {
  const d = parseDate(value)
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Today's booking, still standing, its slot already past.
const todaysAppointment = computed(() => {
  const today = localDay(new Date())
  return myAppointments.value
    .filter(a => ACTIVE.includes(a.status) && localDay(a.appointment_datetime) === today)
    .sort((a, b) => parseDate(b.appointment_datetime) - parseDate(a.appointment_datetime))[0] ?? null
})

// The booking the step card is about: the next one, or today's if its time passed.
const currentAppointment = computed(() => upcomingAppointment.value ?? todaysAppointment.value)

/*
 * The last booking that passed without a visit: never checked in (`scheduled`)
 * or marked `no_show` by the centre, within the past month, and after the last
 * donation (an older miss no longer matters).
 */
const missedAppointment = computed(() => {
  const today = localDay(new Date())
  const monthAgo = localDay(new Date(Date.now() - 30 * DAY_MS))
  const lastGiven = localDay(lastDonationDate.value)
  return myAppointments.value
    .filter((a) => {
      const day = localDay(a.appointment_datetime)
      return ['scheduled', 'no_show'].includes(a.status)
        && day < today && day >= monthAgo && (!lastGiven || day > lastGiven)
    })
    .sort((a, b) => parseDate(b.appointment_datetime) - parseDate(a.appointment_datetime))[0] ?? null
})

const daysUntilAppt = computed(() =>
  currentAppointment.value ? daysFromToday(currentAppointment.value.appointment_datetime) : null)

/*
 * The health questions for a booked visit open the day before it and close at
 * the end of its day (AppointmentScreeningWindow on the server), so what the
 * counter reads describes the donor as they are then. GET /donors/eligibility
 * reports the window for the donor's active booking; for any other booking the
 * same rule is worked out here.
 */
const bookingWindow = ref(null)

/*
 * GET /donors/deferral: whether a deferral stands on the donor's record, read
 * the way the blood centre's own Donors list reads it. It blocks nothing (a
 * deferred donor can still book); the portal just stops inviting them. The
 * old screening result counts too, for records from before that endpoint.
 */
const deferral = ref(null)
const isDeferred = computed(() => !!deferral.value?.deferred || eligibilityStatus.value === 'deferred')
const screeningWindowOpen = computed(() => {
  const appt = currentAppointment.value
  if (!appt) return false
  if (bookingWindow.value && bookingWindow.value.id === appt.id) return !!bookingWindow.value.screening_window_open
  return daysUntilAppt.value !== null && daysUntilAppt.value <= 1
})
const screeningOpensOn = computed(() => {
  const appt = currentAppointment.value
  if (!appt) return null
  if (bookingWindow.value && bookingWindow.value.id === appt.id && bookingWindow.value.screening_window_opens_on) {
    return bookingWindow.value.screening_window_opens_on
  }
  const d = startOfDay(appt.appointment_datetime)
  if (!d) return null
  d.setDate(d.getDate() - 1)
  return localDay(d)
})

// Today's slot has passed and the counter hasn't scanned the donor yet.
const runningLate = computed(() => {
  const appt = currentAppointment.value
  if (!appt || appt.status === 'confirmed' || daysUntilAppt.value !== 0) return false
  return parseDate(appt.appointment_datetime) < new Date()
})

/*
 * Which step the donor is on, in the server's own order: book a visit, answer
 * the health questions the day before it, check in, donate, rest. Booking
 * needs no answers first, and answers given early can't be for a visit that
 * isn't booked yet.
 *
 * Resting comes first: recording a collection uses the answers up, so they
 * read `expired` right after a donation, but nothing can be done until the
 * waiting period ends. `confirmed` is what the counter writes when it scans
 * the donor's QR, so a checked-in donor is on Donate whatever else is true.
 * `deferred` only comes from screenings recorded before RedAgos stopped ruling
 * on answers; new ones are always `pending`.
 */
const stage = computed(() => {
  const appt = currentAppointment.value
  if (isDeferred.value) return 'deferred'
  if (!appt) return daysUntilEligible.value > 0 ? 'rest' : 'book'
  if (appt.status === 'confirmed') return 'donate'
  if (!screeningDone.value) return 'screen'
  return daysUntilAppt.value !== null && daysUntilAppt.value <= 0 ? 'donate' : 'checkin'
})

const stageIndex = computed(() => {
  const i = CYCLE.findIndex(s => s.key === stage.value)
  return i === -1 ? 0 : i
})

function stepState(i) {
  if (i < stageIndex.value) return 'done'
  if (i === stageIndex.value) return stage.value === 'deferred' ? 'stop' : 'current'
  return 'todo'
}

// Rest belongs to the donation just given; every other step to the next one.
const roundLabel = computed(() => {
  const n = stage.value === 'rest' ? totalDonations.value : totalDonations.value + 1
  return n === 1 ? 'Your first donation' : `Donation #${n}`
})

const nextStep = computed(() => {
  const appt = currentAppointment.value
  switch (stage.value) {
    case 'deferred': {
      // The same lines the DonorDeferred email uses: a temporary deferral is
      // usual and ends; anything else is for the centre to explain in person.
      const d = deferral.value
      if (d?.temporary && d.until) {
        return {
          title: `Deferred until ${formatDate(d.until, 'MMM D, YYYY')}`,
          status: 'A deferral is common and is usually temporary. You can book again after that date, and the blood center can tell you more if you have questions.',
          label: 'Get help',
          icon: 'help-circle',
          to: '/donor/help',
        }
      }
      if (d?.temporary) {
        return {
          title: 'Your last visit was deferred',
          status: 'A deferral is common and is usually temporary. Please check with the blood center when it would be right to try again before you book.',
          label: 'Get help',
          icon: 'help-circle',
          to: '/donor/help',
        }
      }
      return {
        title: 'Please talk to the blood center',
        status: 'Something on your record means you should speak to the blood center before donating again. They can explain what was recorded and what it means for you.',
        label: 'Get help',
        icon: 'help-circle',
        to: '/donor/help',
      }
    }
    case 'rest': {
      const days = daysUntilEligible.value
      return {
        title: `${days} day${days === 1 ? '' : 's'} to go`,
        status: `Thank you for donating! You can give again on ${formatDate(nextEligibleDate.value, 'MMM D, YYYY')}. Rest and eat well until then.`,
        label: 'See my donations',
        icon: 'history',
        to: '/donor/history',
      }
    }
    case 'screen': {
      const when = daysUntilAppt.value <= 0
        ? 'today'
        : daysUntilAppt.value === 1 ? 'tomorrow' : `on ${formatDate(appt.appointment_datetime, 'MMM D')}`
      if (screeningWindowOpen.value) {
        return {
          title: 'Answer your health questions',
          status: `Your donation is ${when} at ${appt.facility_name}, ${formatDate(appt.appointment_datetime, 'h:mm A')}. Answer now so your Pass is ready at the counter. It takes about 5 minutes.`,
          label: 'Answer health questions',
          icon: 'clipboard-check',
          to: '/donor/eligibility',
        }
      }
      return {
        title: `Health questions open on ${formatDate(screeningOpensOn.value, 'MMM D')}`,
        status: `You are booked at ${appt.facility_name} on ${formatDate(appt.appointment_datetime, 'MMM D')} at ${formatDate(appt.appointment_datetime, 'h:mm A')}. Answer the health questions the day before or on the day, so they describe you as you are then.`,
        label: 'View my booking',
        icon: 'calendar',
        to: '/donor/appointments',
      }
    }
    case 'checkin': {
      const days = daysUntilAppt.value
      return {
        title: days === 1 ? 'Your donation is tomorrow' : `Your donation is in ${days} days`,
        status: `Booked at ${appt.facility_name} on ${formatDate(appt.appointment_datetime, 'MMM D')} at ${formatDate(appt.appointment_datetime, 'h:mm A')}. Show your Pass at the counter.`,
        label: 'Show my Pass',
        icon: 'qr-code',
        to: '/donor/qrcode',
      }
    }
    case 'donate':
      if (appt.status === 'confirmed') {
        return {
          title: 'You are checked in',
          status: `You are checked in at ${appt.facility_name}. Thank you for giving today.`,
          label: 'Show my Pass',
          icon: 'qr-code',
          to: '/donor/qrcode',
        }
      }
      if (runningLate.value) {
        return {
          title: 'Running late?',
          status: `Your appointment at ${appt.facility_name} was at ${formatDate(appt.appointment_datetime, 'h:mm A')}. If you are on your way, show your Pass at the counter. If you can't make it today, book a new time.`,
          label: 'Show my Pass',
          icon: 'qr-code',
          to: '/donor/qrcode',
        }
      }
      return {
        title: 'Today is donation day',
        status: `See you at ${appt.facility_name} at ${formatDate(appt.appointment_datetime, 'h:mm A')}. Eat a good meal and drink water before you go.`,
        label: 'Show my Pass',
        icon: 'qr-code',
        to: '/donor/qrcode',
      }
    default: {
      const missed = missedAppointment.value
      if (missed) {
        return {
          title: 'You missed your appointment',
          status: `Your appointment at ${missed.facility_name} on ${formatDate(missed.appointment_datetime, 'MMM D')} has passed. No problem: book a new time when you are ready.`,
          label: 'Book a new time',
          icon: 'calendar',
          to: '/donor/appointments',
        }
      }
      return {
        title: 'You can donate',
        status: 'You are eligible to donate. Pick a blood center and a time that suits you.',
        label: 'Book a donation',
        icon: 'calendar',
        to: '/donor/appointments',
      }
    }
  }
})

// Google Maps, searched by the place as written. Opens the app on phones.
function mapsUrl(place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
}

// Directions by facility name: the appointment carries no address.
const directionsUrl = computed(() => {
  const name = currentAppointment.value?.facility_name
  return name ? mapsUrl(name) : null
})

// ── Setup reminders ──
const setupItems = computed(() => {
  const items = []
  const id = identityStatus.value
  if (id && id !== 'verified') {
    items.push({
      key: 'identity',
      icon: 'id-card',
      tone: id === 'rejected' ? 'danger' : id === 'pending' ? 'muted' : 'warning',
      title: id === 'pending' ? 'Your ID is under review' : id === 'rejected' ? 'Upload your ID again' : 'Verify your ID',
      text: id === 'pending'
        ? 'We will let you know once the blood center checks it.'
        : id === 'rejected'
          ? 'Your last upload was not approved. See why and try again.'
          : 'Upload a valid ID so the blood center can confirm who you are.',
    })
  }
  if (profile.value && !(profile.value.blood_type && profile.value.contact_number)) {
    items.push({
      key: 'profile',
      icon: 'user-circle',
      tone: 'warning',
      title: 'Complete your profile',
      text: 'Add your blood type and contact number.',
    })
  }
  return items
})

// ── For you ──
// General donor guidance for the step they are on. Plain advice, nothing that
// replaces what the blood center tells them at the counter.
const TIPS = {
  screen: { icon: 'clipboard-list', title: 'Before you screen', text: 'Have your recent medicines, illnesses and travel in mind. The questions ask about them.' },
  book: { icon: 'calendar', title: 'Pick an easy time', text: 'Giving is easier after a full meal and a good night of sleep, so choose a slot that fits that.' },
  checkin: { icon: 'id-card', title: 'Before your donation', text: 'Eat a proper meal, drink extra water, and bring a valid ID along with your Pass.' },
  donate: { icon: 'heart', title: 'After you give', text: 'Rest for a few minutes, drink plenty of fluids, and skip heavy lifting for the rest of the day.' },
  rest: { icon: 'heart', title: 'While you rest', text: 'Eat iron-rich food like leafy greens, beans, eggs and fish to help your body rebuild.' },
  deferred: { icon: 'info', title: 'About deferrals', text: 'A deferral keeps you and the patient safe. Many are temporary, and the blood center can tell you what happens next.' },
}
const tip = computed(() => TIPS[stage.value] ?? TIPS.book)

// GET /api/blood-drives: upcoming mobile drives, soonest first.
const bloodDrives = ref([])

// The clock the drive badges read, moved on each minute so "On now" turns
// to "Ended" without a reload.
const nowTick = ref(Date.now())
let nowTimer = null
onMounted(() => { nowTimer = setInterval(() => { nowTick.value = Date.now() }, 60_000) })
onBeforeUnmount(() => clearInterval(nowTimer))

const minutesOf = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
const clockLabel = (hhmm) => {
  const mins = minutesOf(hhmm)
  if (mins === null) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** "8:00 AM to 4:00 PM", or from the start alone; empty without hours. */
function driveHours(drive) {
  const start = clockLabel(drive.start_time)
  const end = clockLabel(drive.end_time)
  if (start && end) return `${start} to ${end}`
  return start ? `From ${start}` : ''
}

/** Where a drive stands against the donor's clock, and the badge it gets. */
function driveWhen(drive) {
  const date = String(drive.date ?? '').slice(0, 10)
  const today = localDay(new Date(nowTick.value))
  if (date === localDay(new Date(nowTick.value + DAY_MS))) return { badge: 'Tomorrow', tone: 'soon' }
  if (date !== today) return {}

  const now = new Date(nowTick.value)
  const mins = now.getHours() * 60 + now.getMinutes()
  const start = minutesOf(drive.start_time)
  const end = minutesOf(drive.end_time)
  if (end !== null && mins >= end) return { today: true, ended: true, badge: 'Ended', tone: 'muted' }
  if (start !== null && mins >= start) return { today: true, badge: 'On now', tone: 'live' }
  return { today: true, badge: 'Today', tone: 'today' }
}

const driveFull = (drive) => drive.total_slots != null && (drive.registered ?? 0) >= drive.total_slots
// Why Book is off, or '' when it isn't. One booking at a time, so not while
// one stands either.
function driveBlocked(drive) {
  if (currentAppointment.value) return 'You already have a booking'
  if (driveWhen(drive).ended) return 'This drive has ended'
  if (driveFull(drive)) return 'This drive is full'
  return ''
}

function driveNote(drive) {
  const left = Math.max((drive.total_slots ?? 0) - (drive.registered ?? 0), 0)
  const date = String(drive.date ?? '').slice(0, 10)
  if (driveWhen(drive).ended) return { text: 'This drive has ended', muted: true }
  if (nextEligibleDate.value && date < String(nextEligibleDate.value).slice(0, 10)) {
    return { text: 'Before your next eligible date', muted: true }
  }
  if (!left) return { text: 'Full', muted: true }
  return { text: `${left} slot${left === 1 ? '' : 's'} left`, muted: false }
}

// ── Impact ──
const litresGiven = computed(() => {
  const l = totalDonations.value * 0.45
  return Number.isInteger(l) ? String(l) : l.toFixed(1)
})

const MILESTONES = [1, 3, 5, 10, 25, 50, 100]
const milestone = computed(() => {
  const n = totalDonations.value
  const target = MILESTONES.find(m => m > n) ?? Math.ceil((n + 1) / 50) * 50
  const left = target - n
  return {
    target,
    name: target === 1 ? 'First donation' : `${target}-time donor`,
    percent: Math.round((n / target) * 100),
    text: `${left} more donation${left === 1 ? '' : 's'} to go`,
  }
})

// The server's visit statuses, labelled as the History page labels them:
// registered → screening → collected → tested → completed, or rejected.
const VISIT_LABELS = {
  registered: 'Registered',
  screening: 'Screening',
  collected: 'Collected',
  tested: 'Tested',
  completed: 'Completed',
  rejected: 'Rejected',
}

// Registered and Screening happen on the visit itself; one still there from an
// earlier day ended without a collection (as on the History page).
function visitEnded(d) {
  return ['registered', 'screening'].includes(d.status) && localDay(d.donation_date) < localDay(new Date())
}

// Green when done, red when turned away, grey when it ended early, amber
// while still moving through.
function donationTone(d) {
  if (d.status === 'completed') return 'success'
  if (d.status === 'rejected') return 'danger'
  return visitEnded(d) ? 'muted' : 'warning'
}

function donationLabel(d) {
  return visitEnded(d) ? 'Not completed' : (VISIT_LABELS[d.status] ?? d.status)
}

// "2026-10-25 09:00:00" from the API: the space form isn't parsed everywhere.
function parseDate(value) {
  if (!value) return null
  const d = value instanceof Date ? new Date(value) : new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function formatDate(value, fmt) {
  if (!value) return '-'
  const d = parseDate(value)
  if (!d) return '-'

  const day = d.getDate()
  const monthShort = d.toLocaleDateString('en-US', { month: 'short' })
  const year = d.getFullYear()
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12

  switch (fmt) {
    case 'D':
      return String(day)
    case 'MMM':
      return monthShort
    case 'MMM D':
      return `${monthShort} ${day}`
    case 'MMM D, YYYY':
      return `${monthShort} ${day}, ${year}`
    case 'h:mm A':
      return `${hours}:${minutes} ${ampm}`
    default:
      return d.toLocaleDateString()
  }
}

let loadedOnce = false

// Route returns and tab returns can overlap, so only the newest response is
// applied: a slower, older one must not roll the progress back.
let latestRequest = 0

async function load({ silent = false } = {}) {
  const request = ++latestRequest
  if (!silent) loading.value = true
  loadExtras()
  try {
    const data = await donorService.dashboard()
    if (request !== latestRequest) return
    profile.value = data.profile ?? null
    eligibilityStatus.value = data.eligibility_status ?? 'pending'
    questionnaireStatus.value = data.questionnaire_status ?? 'not_answered'
    qrActive.value = !!data.qr_active
    qrValidUntil.value = data.qr_valid_until ?? null
    bloodType.value = data.blood_type ?? '-'
    totalDonations.value = data.total_donations ?? 0
    upcomingAppointment.value = data.upcoming_appointment ?? null
    recentDonations.value = data.recent_donations ?? []
  } catch (err) {
    console.error('Failed to load donor dashboard data:', err)
  } finally {
    if (request === latestRequest) {
      loading.value = false
      loadedOnce = true
    }
  }
}

// Best effort: the page still works without these, it just shows less.
async function loadExtras() {
  const [eligibility, details, drives, appointments, deferralStatus] = await Promise.allSettled([
    donorService.eligibilityStatus(),
    donorService.profile(),
    bookingCatalogService.bloodDrives(),
    donorService.appointments(),
    donorService.deferralStatus(),
  ])
  if (eligibility.status === 'fulfilled') {
    nextEligibleDate.value = eligibility.value?.next_eligible_date ?? null
    bookingWindow.value = eligibility.value?.appointment ?? null
  } else {
    console.error('Failed to load eligibility status:', eligibility.reason)
  }
  if (details.status === 'fulfilled') {
    identityStatus.value = details.value?.identity?.status ?? 'unsubmitted'
    lastDonationDate.value = details.value?.last_donation_date ?? null
  } else {
    console.error('Failed to load donor profile:', details.reason)
  }
  if (deferralStatus.status === 'fulfilled') {
    deferral.value = deferralStatus.value ?? null
  } else {
    console.error('Failed to load deferral status:', deferralStatus.reason)
  }
  if (appointments.status === 'fulfilled') {
    myAppointments.value = Array.isArray(appointments.value) ? appointments.value : []
  } else {
    console.error('Failed to load appointments:', appointments.reason)
  }
  if (drives.status === 'fulfilled') {
    bloodDrives.value = Array.isArray(drives.value) ? drives.value : []
  } else {
    console.error('Failed to load blood drives:', drives.reason)
  }
}

function isOnDashboard() {
  return route.path === '/donor/dashboard'
}

/*
 * The same silent refresh when the donor comes back to the tab — say,
 * unlocking their phone after giving blood with the dashboard still open.
 * Navigating back is covered by the route watcher below.
 */
function onVisibilityChange() {
  if (!document.hidden && isOnDashboard() && loadedOnce) load({ silent: true })
}

onMounted(() => {
  load()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

/*
 * `route` is the app-wide reactive current route, so this watcher keeps
 * firing even while this page sits deactivated inside <KeepAlive> — unlike
 * `onActivated`, it doesn't depend on Vue matching this component back into
 * the keep-alive cache to notice the return trip. Any step completed on
 * another page (screening, booking, profile edits) shows up here the moment
 * the donor navigates back, without a full reload.
 */
watch(() => route.path, () => {
  if (isOnDashboard() && loadedOnce) load({ silent: true })
})
</script>

<style scoped>
.home {
  --card-radius: 20px;
  --danger: var(--rb-accent, #D32F2F);
  --danger-text: var(--rb-accent-text, #D32F2F);

  max-width: 1400px; /* the same column as the top bar and the other donor pages */
  margin: 0 auto;
  padding: 24px 32px 48px;
  color: var(--rb-text-primary);
}
.home__inner { display: flex; flex-direction: column; gap: 24px; }

.home__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
  align-items: start;
}
.home__main { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.home__side { display: flex; flex-direction: column; gap: 20px; position: sticky; top: 88px; }

/* ── Skeleton ── */
.skeleton {
  border-radius: var(--card-radius);
  background: linear-gradient(90deg, var(--rb-skeleton-a, #EEF1F5) 25%, var(--rb-skeleton-b, #F6F8FA) 37%, var(--rb-skeleton-a, #EEF1F5) 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--greet { height: 76px; max-width: 360px; border-radius: 14px; }
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

/* ── Greeting ── */
.greet__date { margin: 0; font-size: 13px; font-weight: 600; color: var(--rb-text-secondary); }
.greet__title {
  margin: 4px 0 0;
  font-size: clamp(24px, 3vw, 30px);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
}
.greet__chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 0; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid var(--rb-border);
  border-radius: 999px;
  background: var(--rb-surface);
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-text-secondary);
}
.chip--blood { color: var(--danger-text); border-color: rgba(var(--rb-accent-rgb, 211, 47, 47), 0.25); }

/* ── Shared card look ── */
.cycle,
.setup__item,
.foryou,
.impact,
.activity {
  border: 1px solid var(--rb-border);
  border-radius: var(--card-radius);
  background: var(--rb-surface);
  box-shadow: var(--rb-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.04));
}

.section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-title { margin: 0; font-size: 16px; font-weight: 700; }
.section-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-primary-text);
  text-decoration: none;
}
.section-link:hover { text-decoration: underline; }

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 150ms ease, border-color 150ms ease, transform 100ms ease;
}
.btn:active { transform: scale(0.98); }
.btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.btn--primary { background: var(--rb-primary); color: #fff; }
.btn--primary:hover { background: var(--rb-primary-hover); }
.btn--ghost { border-color: var(--rb-border-strong, #CBD5E1); color: var(--rb-text-primary); background: transparent; }
.btn--ghost:hover { background: var(--rb-surface-hover, #F1F5F9); }
.btn--light { background: #fff; color: var(--rb-primary); }
.btn--light:hover { background: #F1F5F9; }
.btn--glass { border-color: rgba(255, 255, 255, 0.35); color: #fff; background: rgba(255, 255, 255, 0.1); }
.btn--glass:hover { background: rgba(255, 255, 255, 0.18); }

/* ── Cycle card ── */
/* A faint wash of the portal colour marks this as the card to read first. */
.cycle {
  padding: 24px;
  background:
    linear-gradient(180deg, rgba(var(--rb-primary-rgb), 0.07), rgba(var(--rb-primary-rgb), 0) 160px),
    var(--rb-surface);
}
.cycle--deferred {
  background:
    linear-gradient(180deg, rgba(var(--rb-accent-rgb, 211, 47, 47), 0.07), rgba(var(--rb-accent-rgb, 211, 47, 47), 0) 160px),
    var(--rb-surface);
}
.cycle__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.cycle__count {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
  font-size: 12px;
  font-weight: 700;
}
.cycle--deferred .cycle__count { background: rgba(var(--rb-accent-rgb, 211, 47, 47), 0.1); color: var(--danger-text); }
.cycle__round { font-size: 12px; font-weight: 600; color: var(--rb-text-muted); }

.cycle__body { display: flex; align-items: center; gap: 20px; margin-top: 18px; }
.cycle__visual {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  border-radius: 24px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
}
.cycle--deferred .cycle__visual { background: rgba(var(--rb-accent-rgb, 211, 47, 47), 0.1); color: var(--danger-text); }

.cycle__visual--date { flex-direction: column; gap: 0; line-height: 1.05; }
.date__month { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.date__day { font-size: 30px; font-weight: 800; color: var(--rb-text-primary); }
.date__time { font-size: 11px; font-weight: 600; color: var(--rb-text-secondary); }

.cycle__visual--ring { position: relative; background: transparent; border-radius: 50%; }
.gauge { width: 88px; height: 88px; transform: rotate(-90deg); }
.gauge__track { fill: none; stroke: rgba(var(--rb-primary-rgb), 0.14); stroke-width: 3.2; }
.gauge__fill {
  fill: none;
  stroke: var(--rb-primary);
  stroke-width: 3.2;
  stroke-linecap: round;
  transition: stroke-dasharray 600ms var(--rb-ease-out, ease);
}
.gauge__label {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.gauge__label strong { font-size: 24px; font-weight: 800; color: var(--rb-text-primary); }
.gauge__label small { margin-top: 2px; font-size: 11px; font-weight: 600; color: var(--rb-text-secondary); }

.cycle__text { min-width: 0; }
.cycle__title { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.25; }
.cycle__status { margin: 6px 0 0; font-size: 14px; line-height: 1.55; color: var(--rb-text-secondary); max-width: 60ch; }

/* Stepper */
.steps {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin: 24px 0 0;
  padding: 0;
  list-style: none;
}
.steps__item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}
/* The line joining each step to the one before it */
.steps__item + .steps__item::before {
  content: '';
  position: absolute;
  top: 14px;
  right: calc(50% + 18px);
  left: calc(-50% + 18px);
  height: 2px;
  border-radius: 2px;
  background: var(--rb-border);
}
.steps__item--done + .steps__item::before { background: var(--rb-primary); }
.steps__dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 2px solid var(--rb-border);
  border-radius: 50%;
  background: var(--rb-surface);
  font-size: 12px;
  font-weight: 700;
  color: var(--rb-text-muted);
}
.steps__label { font-size: 12px; font-weight: 600; color: var(--rb-text-muted); }

.steps__item--done .steps__dot { border-color: var(--rb-primary); background: var(--rb-primary); color: #fff; }
.steps__item--done .steps__label { color: var(--rb-text-secondary); }
.steps__item--current .steps__dot {
  border-color: var(--rb-primary);
  color: var(--rb-primary-text);
  box-shadow: 0 0 0 4px rgba(var(--rb-primary-rgb), 0.16);
}
.steps__item--current .steps__label { color: var(--rb-text-primary); font-weight: 700; }
.steps__item--stop .steps__dot {
  border-color: var(--danger);
  background: var(--danger);
  color: #fff;
  box-shadow: 0 0 0 4px rgba(var(--rb-accent-rgb, 211, 47, 47), 0.16);
}
.steps__item--stop .steps__label { color: var(--danger-text); font-weight: 700; }

.cycle__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--rb-border);
}
.cycle__link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  text-decoration: none;
}
.cycle__link:hover { color: var(--rb-primary-text); }

/* ── Setup reminders ── */
.setup { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.setup__item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  color: inherit;
  text-decoration: none;
  transition: border-color 150ms ease;
}
.setup__item:hover { border-color: var(--rb-border-hover, #CBD5E1); }
.setup__icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
}
.setup__item--warning .setup__icon { background: rgba(var(--rb-warning-rgb, 245, 124, 0), 0.12); color: var(--rb-warning-text, #B45309); }
.setup__item--danger .setup__icon { background: rgba(var(--rb-accent-rgb, 211, 47, 47), 0.1); color: var(--danger-text); }
.setup__item--muted .setup__icon { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.setup__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.setup__text strong { font-size: 14px; font-weight: 700; }
.setup__text span { font-size: 13px; line-height: 1.4; color: var(--rb-text-secondary); }
.setup__chev { margin-left: auto; flex: none; color: var(--rb-text-muted); }
.setup__error { font-weight: 600; color: var(--danger-text) !important; }
.setup__action {
  flex: none;
  margin-left: auto;
  min-height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}
.setup__action:hover:not(:disabled) { background: rgba(var(--rb-primary-rgb), 0.16); }
.setup__action:disabled { opacity: 0.6; cursor: default; }
.setup__action:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

/* ── For you ── */
.foryou { padding: 20px 24px 24px; }
.foryou__grid {
  display: grid;
  /* Two drives at most, side by side; one card spans the row. */
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}
/* The tip runs the full width as a short banner, so the drive cards beside
   each other have room for their two buttons. */
.tip {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 12px;
  row-gap: 2px;
  align-items: start;
  padding: 16px;
  border-radius: 14px;
  background: rgba(var(--rb-primary-rgb), 0.07);
}
.tip__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-primary-text);
}
.tip__icon { grid-row: span 2; }
.tip__title { margin: 0; font-size: 14px; font-weight: 700; }
.tip__text { grid-column: 2; margin: 0; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

.drive {
  display: flex;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  color: inherit;
  text-decoration: none;
  transition: border-color 150ms ease;
}
.drive__date {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 52px;
  border-radius: 12px;
  background: var(--rb-surface-alt);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--rb-primary-text);
  line-height: 1.1;
}
.drive__date strong { font-size: 20px; color: var(--rb-text-primary); }
.drive--empty { grid-column: 1 / -1; }
.drive__date--empty { color: var(--rb-text-muted); }
.drive__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.drive__kicker { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--rb-text-muted); }
.drive__badge {
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.5;
}
.drive__badge--today { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }
.drive__badge--live { background: #E8F5E9; color: #1B5E20; }
.drive__badge--soon { background: #FFF4E5; color: #8A4B00; }
.drive__badge--muted { background: var(--rb-surface-hover, #F1F5F9); color: var(--rb-text-secondary); }
html.dark .drive__badge--live { background: rgba(102, 187, 106, 0.16); color: var(--rb-success-text, #81C784); }
html.dark .drive__badge--soon { background: rgba(245, 124, 0, 0.16); color: #FFB74D; }
/* Today's drive: the date tile takes the portal colour. */
.drive--today .drive__date { background: rgba(var(--rb-primary-rgb), 0.1); }
.drive--today .drive__date span,
.drive--today .drive__date strong { color: var(--rb-primary-text); }
.drive__btn--off { opacity: 0.5; cursor: not-allowed; }
.drive__btn--off:hover { background: rgba(var(--rb-primary-rgb), 0.1); }
.drive__actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.drive__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong, #CBD5E1);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: var(--rb-text-primary);
  text-decoration: none;
}
.drive__btn:hover { background: var(--rb-surface-hover, #F1F5F9); }
.drive__btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
/* Tinted, not solid: the step card's button stays the one solid action. */
.drive__btn--primary { border-color: transparent; background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }
.drive__btn--primary:hover { background: rgba(var(--rb-primary-rgb), 0.16); }
.drive__name { font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.drive__meta { display: flex; align-items: flex-start; gap: 4px; font-size: 12px; line-height: 1.4; color: var(--rb-text-secondary); }
.drive__meta :deep(.asset-icon) { flex: none; margin-top: 2px; }
.drive__foot { margin-top: 4px; font-size: 12px; font-weight: 700; color: var(--rb-success-text, #2E7D32); }
.drive__foot--muted { color: var(--rb-text-muted); }

/* ── Impact ── */
.impact { padding: 20px 24px 24px; }
.impact__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 1.4fr);
  gap: 12px;
  margin-top: 14px;
}
.impact__tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--rb-surface-alt);
}
.impact__value { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; font-variant-numeric: tabular-nums; }
.impact__value small { font-size: 14px; font-weight: 700; color: var(--rb-text-secondary); }
.impact__label { font-size: 12px; line-height: 1.35; color: var(--rb-text-secondary); }
.impact__tile--goal { justify-content: center; gap: 8px; }
.impact__note { margin: 12px 0 0; font-size: 12px; color: var(--rb-text-muted); }
.impact__goal-head { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; }
.impact__goal-head :deep(.asset-icon) { color: #F59E0B; }
.meter { display: block; height: 8px; border-radius: 999px; background: var(--rb-border); overflow: hidden; }
.meter__fill { display: block; height: 100%; border-radius: inherit; background: var(--rb-primary); transition: width 600ms var(--rb-ease-out, ease); }

/* ── Recent visits ── */
.activity { padding: 20px 24px; }
.activity__list { margin: 10px 0 0; padding: 0; list-style: none; }
.activity__item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-top: 1px solid var(--rb-border);
}
.activity__item:first-child { border-top: none; }
.activity__icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
}
.activity__icon--success { background: rgba(var(--rb-success-rgb, 46, 125, 50), 0.12); color: var(--rb-success-text, #2E7D32); }
.activity__icon--warning { background: rgba(var(--rb-warning-rgb, 245, 124, 0), 0.12); color: var(--rb-warning-text, #B45309); }
.activity__icon--danger { background: rgba(var(--rb-accent-rgb, 211, 47, 47), 0.1); color: var(--danger-text); }
.activity__main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.activity__main strong { font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.activity__main span { font-size: 12px; color: var(--rb-text-secondary); }
.activity__side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: none; }
.activity__date { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.pill { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.pill--success { background: rgba(var(--rb-success-rgb, 46, 125, 50), 0.12); color: var(--rb-success-text, #2E7D32); }
.pill--warning { background: rgba(var(--rb-warning-rgb, 245, 124, 0), 0.12); color: var(--rb-warning-text, #B45309); }
.pill--muted { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.activity__icon--muted { background: var(--rb-surface-alt); color: var(--rb-text-muted); }
.pill--danger { background: rgba(var(--rb-accent-rgb, 211, 47, 47), 0.1); color: var(--danger-text); }
.activity__empty {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 16px;
  border: 1px dashed var(--rb-border);
  border-radius: 14px;
  color: var(--rb-text-muted);
}
.activity__empty p { margin: 0; font-size: 13px; color: var(--rb-text-secondary); }

/* ── Pass ── */
.pass {
  position: relative;
  overflow: hidden;
  padding: 22px;
  border-radius: var(--card-radius);
  /* Dark ink like a wallet card, so the step card's button stays the one
     saturated thing on the page; the portal colour shows only as a glow. */
  border: 1px solid rgba(255, 255, 255, 0.06);
  background:
    radial-gradient(90% 70% at 100% 0%, rgba(var(--rb-primary-rgb), 0.55), transparent 65%),
    radial-gradient(70% 60% at 0% 100%, rgba(var(--rb-primary-rgb), 0.22), transparent 70%),
    #0F172A;
  color: #F8FAFC;
  box-shadow: 0 20px 40px -24px rgba(15, 23, 42, 0.7);
}
.pass__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.pass__label { margin: 0; font-size: 12px; font-weight: 700; opacity: 0.85; }
.pass__code { margin: 2px 0 0; font-size: 15px; font-weight: 700; font-family: var(--rb-font-mono, ui-monospace, monospace); }
.pass__blood {
  padding: 4px 12px;
  border-radius: 12px;
  background: #C62828;
  color: #fff;
  font-size: 20px;
  font-weight: 800;
}
.pass__qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
  padding: 18px;
  border-radius: 16px;
  background: #fff;
  color: #0F172A;
  text-decoration: none;
  transition: transform 150ms ease;
}
.pass__qr:hover { transform: translateY(-1px); }
.pass__qr span { font-size: 12px; font-weight: 600; color: #475569; }
.pass__facts { margin: 16px 0 0; display: flex; flex-direction: column; gap: 8px; }
.pass__facts > div { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
.pass__facts dt { opacity: 0.8; }
.pass__facts dd { margin: 0; font-weight: 700; text-align: right; }
.pass__facts dd.tone--danger { color: #FECACA; }
.pass__facts dd.tone--warning { color: #FDE68A; }
.pass__facts dd.tone--success { color: #A5D6A7; }
.pass__actions { display: flex; flex-direction: column; gap: 8px; margin-top: 18px; }
.pass__actions .btn { width: 100%; }

/* ── Dark ── */
html.dark .pass { border-color: rgba(255, 255, 255, 0.1); background-color: var(--ink-base, #070D1A); box-shadow: 0 18px 40px -24px rgba(0, 0, 0, 0.8); }
html.dark .tip { background: rgba(var(--rb-primary-rgb), 0.14); }
html.dark .drive__date { background: rgba(var(--ink-page-rgb, 15, 23, 42), 0.5); }
html.dark .btn--light { background: var(--ink-text, #F1F5F9); }
html.dark .impact__tile { background: rgba(var(--ink-page-rgb, 15, 23, 42), 0.5); }

/* ── Tablet and phone: one column, Pass after the cycle ── */
@media (max-width: 1023px) {
  .home { padding: 20px 32px 32px; }
  .home__grid { grid-template-columns: minmax(0, 1fr); }
  .home__main { display: contents; }
  .home__side { position: static; }
  .cycle { order: 1; }
  .setup { order: 2; }
  .home__side { order: 3; }
  .foryou { order: 4; }
  .impact { order: 5; }
  .activity { order: 6; }
  .impact__grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .impact__tile--goal { grid-column: 1 / -1; }
}

@media (max-width: 640px) {
  .home { padding: 16px 16px 24px; }
  .home__inner { gap: 18px; }
  .cycle { padding: 18px; }
  .cycle__body { gap: 14px; margin-top: 14px; align-items: flex-start; }
  .cycle__visual { width: 64px; height: 64px; border-radius: 18px; }
  .cycle__visual--ring, .gauge { width: 72px; height: 72px; }
  .gauge__label strong { font-size: 20px; }
  .date__day { font-size: 22px; }
  .date__month, .date__time { font-size: 10px; }
  .cycle__title { font-size: 18px; }
  .steps__label { font-size: 11px; }
  .cycle__actions { flex-direction: column; align-items: stretch; }
  .cycle__actions .btn { width: 100%; }
  .cycle__link { margin: 4px auto 0; }
  .foryou, .impact, .activity { padding: 16px 18px; }
  .foryou__grid { grid-template-columns: minmax(0, 1fr); }
  .impact__grid { gap: 8px; }
  .impact__tile { padding: 12px; }
  .impact__value { font-size: 22px; }
  .pass__qr { flex-direction: row; justify-content: center; padding: 14px; }
  .pass__qr :deep(.asset-icon) { width: 44px !important; height: 44px !important; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .gauge__fill, .meter__fill, .btn, .pass__qr { transition: none; }
  .btn:active, .pass__qr:hover { transform: none; }
}
</style>
