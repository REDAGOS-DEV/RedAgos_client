<template>
  <div class="referrals-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Medical Referrals</h1>
        <p class="page-subtitle">
          Donors whose reactive serology Testing verified. Contact them, record their consent and where they are
          referred, and record the confirmatory result: the centre's SOP then decides whether they may donate again.
        </p>
      </div>
      <NuxtLink v-if="canKeepSop" to="/blood-center/confirmatory-sop" class="btn">
        <AssetIcon name="shield-check" :size="14" />
        Confirmatory SOP
      </NuxtLink>
    </header>

    <p v-if="error" class="alert alert--error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="alert alert--notice" role="status">{{ notice }}</p>

    <section class="card">
      <div class="confidential" role="note">
        <AssetIcon name="shield-check" :size="16" />
        <p>
          Confidential, for the Donor Counselling Physician only. A reactive screen is not a diagnosis: each donor is deferred
          pending confirmatory testing until you record the documented result. Per the donor's consent, no result is
          issued to them; the contact request names none.
        </p>
      </div>

      <p v-if="!sop" class="sop-missing" role="note">
        <AssetIcon name="triangle-alert" :size="14" />
        The centre has no approved confirmatory SOP yet, so no decision can be recorded.
        <NuxtLink v-if="canKeepSop" to="/blood-center/confirmatory-sop">Set it up</NuxtLink>
      </p>

      <div class="filters" role="group" aria-label="Filter referrals">
        <button
          v-for="option in referralFilters"
          :key="option.value"
          type="button"
          class="filter"
          :class="{ 'filter--on': referralFilter === option.value }"
          @click="setReferralFilter(option.value)"
        >
          {{ option.label }}
          <span v-if="option.value === 'pending' && pendingReferrals" class="filter__count">{{ pendingReferrals }}</span>
        </button>
      </div>

      <p v-if="loadingReferrals" class="card__hint">Loading referrals…</p>

      <div v-else-if="!referrals.length" class="empty">
        <AssetIcon name="life-buoy" :size="28" />
        <p>{{ referralFilter === 'open' ? 'No donors are waiting to be followed up.' : 'No referrals match this filter.' }}</p>
      </div>

      <ul v-else class="referrals">
        <li v-for="referral in referrals" :key="referral.id" class="referral">
          <div class="referral__head">
            <div>
              <p class="referral__name">{{ referral.donor?.full_name || 'Unknown donor' }}</p>
              <p class="referral__meta">
                {{ referral.donor?.donor_code || '—' }}
                <template v-if="referral.donor?.phone"> · {{ referral.donor.phone }}</template>
                <template v-if="referral.donor?.email"> · {{ referral.donor.email }}</template>
              </p>
              <p v-if="referral.donor?.contact_person" class="referral__meta">
                Contact person: {{ referral.donor.contact_person }}
                <template v-if="referral.donor.contact_person_number"> · {{ referral.donor.contact_person_number }}</template>
              </p>
            </div>
            <div class="referral__side">
              <span v-if="referral.case" class="pill" :class="`pill--case-${confirmationTone(referral.case.status)}`" title="The donor's eligibility">
                {{ referral.case.status_label }}
              </span>
              <span class="pill" :class="`pill--ref-${referral.status}`" title="The referral">{{ referral.status_label }}</span>
              <button
                v-if="referral.is_open"
                type="button"
                class="icon-btn"
                :aria-label="`Send ${referral.donor?.full_name || 'the donor'} a contact request`"
                title="Send contact request"
                @click="openContact(referral)"
              >
                <AssetIcon name="mail" :size="15" />
              </button>
            </div>
          </div>

          <div class="referral__facts">
            <span v-for="marker in referral.reactive_markers" :key="marker.value" class="chip chip--alarm">
              {{ marker.label }}
            </span>
            <span class="referral__meta">
              Donation #{{ referral.donation?.id }} · {{ formatDate(referral.donation?.donation_date) }}
              <template v-if="referral.donation?.donation_barcode"> · Barcode <span class="mono">{{ referral.donation.donation_barcode }}</span></template>
            </span>
            <span class="referral__meta">
              Screened by {{ referral.screened_by || '—' }} · {{ formatDate(referral.screened_at) }}
              <template v-if="referral.verified_by && referral.verified_by !== referral.screened_by">
                · Verified by {{ referral.verified_by }}
              </template>
            </span>
          </div>

          <!-- The donor's eligibility: confirmatory results read through the SOP. -->
          <section v-if="referral.case" class="block" :aria-label="`Confirmatory testing for ${referral.donor?.full_name || 'the donor'}`">
            <h3 class="block__title">Confirmatory testing</h3>
            <p class="block__line">{{ caseSentence(referral.case) }}</p>

            <table v-if="referral.case.tests.length" class="tests">
              <thead>
                <tr>
                  <th scope="col">Marker</th>
                  <th scope="col">Result</th>
                  <th scope="col">Test · laboratory</th>
                  <th scope="col">Reported</th>
                  <th scope="col">Reference</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="test in referral.case.tests" :key="test.id">
                  <td>{{ test.marker_label }}</td>
                  <td>{{ test.outcome_label }}</td>
                  <td>{{ test.method }} · {{ test.laboratory }}</td>
                  <td>{{ formatShort(test.reported_on) }}</td>
                  <td class="mono">{{ test.report_reference }}</td>
                </tr>
              </tbody>
            </table>

            <p class="block__hint">The reactive unit stays rejected whatever the donor's outcome.</p>

            <div v-if="referral.case.awaits_result" class="actions">
              <button type="button" class="btn btn--primary" :disabled="busy || !sop" @click="openConfirm(referral)">
                Record confirmatory result
              </button>
            </div>
          </section>

          <!-- The referral: consent, route and provider. Never the deferral. -->
          <section class="block" :aria-label="`Referral for ${referral.donor?.full_name || 'the donor'}`">
            <h3 class="block__title">Referral</h3>
            <p class="block__line">
              <template v-if="referral.consent">
                {{ referral.consent_label }}<template v-if="referral.consent_recorded_by"> · recorded by {{ referral.consent_recorded_by }}</template>
                · {{ formatDate(referral.consent_recorded_at) }}
              </template>
              <template v-else>Consent not recorded yet.</template>
            </p>
            <p class="block__line">
              <template v-if="referral.route_label">{{ referral.route_label }}<template v-if="referral.provider"> · {{ referral.provider }}</template></template>
              <template v-else>No route or provider chosen yet.</template>
            </p>

            <template v-if="referral.is_open">
              <form v-if="details?.id === referral.id" class="details" @submit.prevent="saveDetails">
                <fieldset class="field">
                  <legend class="field__label">Donor's consent to this referral</legend>
                  <div class="choice">
                    <label v-for="option in CONSENTS" :key="option.value" class="choice__item">
                      <input v-model="details.consent" type="radio" :value="option.value" :name="`consent-${referral.id}`">
                      {{ option.label }}
                    </label>
                  </div>
                </fieldset>
                <fieldset class="field">
                  <legend class="field__label">Route</legend>
                  <div class="choice">
                    <label v-for="option in COUNSELLING_ROUTES" :key="option.value" class="choice__item">
                      <input v-model="details.route" type="radio" :value="option.value" :name="`route-${referral.id}`">
                      {{ option.label }}
                    </label>
                  </div>
                </fieldset>
                <label class="field">
                  <span class="field__label">Provider</span>
                  <input v-model="details.provider" class="field__input" maxlength="160" placeholder="Clinic, hospital or doctor the donor is referred to">
                </label>
                <div class="actions">
                  <button type="submit" class="btn btn--primary" :disabled="busy">{{ busy ? 'Saving…' : 'Save' }}</button>
                  <button type="button" class="btn" :disabled="busy" @click="details = null">Cancel</button>
                </div>
              </form>
              <div v-else class="actions">
                <button type="button" class="btn" :disabled="busy" @click="startDetails(referral)">Consent, route and provider…</button>
              </div>
            </template>
          </section>

          <p class="referral__meta referral__contact" :class="{ 'referral__meta--todo': !referral.contact_requested_at && referral.is_open }">
            <AssetIcon name="mail" :size="12" />
            <template v-if="referral.contact_requested_at">
              Contact request sent {{ formatDate(referral.contact_requested_at) }}<template v-if="referral.contact_requested_by"> by {{ referral.contact_requested_by }}</template><template v-else> (automatically)</template>
            </template>
            <template v-else>No contact request sent yet</template>
          </p>

          <p v-if="referral.note" class="referral__note">
            {{ referral.note }}
            <span v-if="referral.updated_by" class="referral__meta">— {{ referral.updated_by }}</span>
          </p>

          <!-- Moving it on. Forward only; referred needs consent, a route and a provider; closing needs a note. -->
          <div v-if="referral.is_open" class="referral__actions">
            <template v-if="editing?.id === referral.id">
              <label class="field">
                <span class="field__label">
                  Counselling and follow-up note
                  <span class="field__optional">{{ editing.status === 'closed' ? 'required to close' : 'optional' }}</span>
                </span>
                <textarea v-model="editing.note" class="field__input" rows="2" maxlength="500" />
              </label>
              <div class="actions">
                <button
                  type="button"
                  class="btn btn--primary"
                  :disabled="busy || (editing.status === 'closed' && !editing.note.trim())"
                  @click="submitReferral"
                >
                  {{ busy ? 'Saving…' : editing.status ? `Mark ${statusLabel(editing.status).toLowerCase()}` : 'Save note' }}
                </button>
                <button type="button" class="btn" :disabled="busy" @click="editing = null">Cancel</button>
              </div>
            </template>

            <div v-else class="actions">
              <button
                v-for="next in nextStatuses(referral.status)"
                :key="next"
                type="button"
                class="btn"
                :disabled="busy || (next === 'referred' && !readyToRefer(referral))"
                :title="next === 'referred' && !readyToRefer(referral) ? 'Record consent given, a route and a provider first' : undefined"
                @click="startReferralUpdate(referral, next)"
              >
                {{ next === 'closed' ? 'Close…' : `Mark ${statusLabel(next).toLowerCase()}` }}
              </button>
              <button type="button" class="btn" :disabled="busy" @click="startReferralUpdate(referral, null)">Note…</button>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <!-- The confirmatory result: documented per marker; the SOP decides, the physician confirms. -->
    <div v-if="confirming" class="dialog-backdrop" @click.self="closeConfirm">
      <div
        ref="confirmRef"
        class="dialog dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        tabindex="-1"
        @keydown.esc="closeConfirm"
      >
        <h2 id="confirm-title" class="dialog__title">
          <AssetIcon name="flask-conical" :size="18" />
          Record confirmatory result
        </h2>
        <div class="dialog__body">
          <p>
            <strong>{{ confirming.referral.donor?.full_name || 'The donor' }}</strong>
            · Donation #{{ confirming.referral.donation?.id }}
            <template v-if="confirming.referral.donation?.donation_barcode"> · <span class="mono">{{ confirming.referral.donation.donation_barcode }}</span></template>
          </p>
          <p class="dialog__hint">
            Enter each result as the reference laboratory's report states it. Leave a marker on "Not yet" if its report
            has not come back.
          </p>

          <fieldset v-for="row in confirming.rows" :key="row.marker" class="marker-row">
            <legend class="marker-row__title">
              {{ row.label }}
              <span v-if="row.last" class="field__optional">Last: {{ row.last.outcome_label }}, reported {{ formatShort(row.last.reported_on) }}</span>
            </legend>
            <div class="marker-row__grid">
              <label class="field">
                <span class="field__label">Result</span>
                <select v-model="row.outcome" class="field__input">
                  <option value="">Not yet</option>
                  <option v-for="option in CONFIRMATORY_OUTCOMES" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
              <template v-if="row.outcome">
                <label class="field">
                  <span class="field__label">Test</span>
                  <input v-model="row.method" class="field__input" maxlength="120" placeholder="e.g. Western blot">
                </label>
                <label class="field">
                  <span class="field__label">Laboratory</span>
                  <input v-model="row.laboratory" class="field__input" maxlength="160">
                </label>
                <label class="field">
                  <span class="field__label">Report date</span>
                  <input v-model="row.reported_on" type="date" class="field__input" :max="today">
                </label>
                <label class="field">
                  <span class="field__label">Report reference</span>
                  <input v-model="row.report_reference" class="field__input" maxlength="120">
                </label>
              </template>
            </div>
          </fieldset>

          <div class="decision" :class="decision ? `decision--${confirmationTone(decision.status)}` : ''" role="status">
            <template v-if="!draftResults.length">Choose at least one result.</template>
            <template v-else-if="!decision">The SOP has no rule for these results. Check the SOP.</template>
            <template v-else>
              Under SOP version {{ sop?.version }}: <strong>{{ CONFIRMATION_LABELS[decision.status] }}</strong>
              <template v-if="decision.deferred_until"> until {{ formatShort(decision.deferred_until) }}</template>
              <template v-if="decision.retest_due_on">, retest due {{ formatShort(decision.retest_due_on) }}</template>.
            </template>
          </div>
          <p class="dialog__hint">The reactive unit stays rejected whatever this decides.</p>
          <p v-if="confirming.error" class="alert alert--error" role="alert">{{ confirming.error }}</p>
        </div>
        <div class="actions">
          <button type="button" class="btn btn--primary" :disabled="confirming.busy || !canConfirm" @click="sendConfirm">
            {{ confirming.busy ? 'Recording…' : decision ? `Confirm: ${CONFIRMATION_LABELS[decision.status]}` : 'Confirm' }}
          </button>
          <button type="button" class="btn" :disabled="confirming.busy" @click="closeConfirm">Cancel</button>
        </div>
      </div>
    </div>

    <!-- The mail icon on a referral: ask the donor to get in touch, naming no result. -->
    <div v-if="contact" class="dialog-backdrop" @click.self="closeContact">
      <div
        ref="contactRef"
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-title"
        tabindex="-1"
        @keydown.esc="closeContact"
      >
        <h2 id="contact-title" class="dialog__title">
          <AssetIcon name="mail" :size="18" />
          Send contact request
        </h2>
        <div class="dialog__body">
          <p>
            To <strong>{{ contact.referral.donor?.full_name || 'the donor' }}</strong>,
            <template v-if="contact.referral.donor?.email">
              by email to <strong>{{ contact.referral.donor.email }}</strong> and in the RedAgos portal.
            </template>
            <template v-else>in the RedAgos portal only: there is no email address on record.</template>
          </p>
          <blockquote class="contact-preview">
            <p class="contact-preview__subject">Please contact {{ facilityLabel || 'your blood centre' }}</p>
            <p>
              Thank you for donating blood at {{ facilityLabel || 'our centre' }}<template v-if="contact.referral.donation?.donation_date"> on {{ formatDay(contact.referral.donation.donation_date) }}</template>.
              Our staff would like to speak with you about your donation. Please call us or reply to this email at
              your earliest convenience.
            </p>
          </blockquote>
          <p class="dialog__hint">
            It names no test, result or infection, as the donor's consent requires. It is sent in your centre's name,
            and replies go to your centre's email address.
          </p>
          <p v-if="contact.referral.contact_requested_at" class="dialog__hint">
            Last sent {{ formatDate(contact.referral.contact_requested_at) }}<template v-if="contact.referral.contact_requested_by"> by {{ contact.referral.contact_requested_by }}</template>.
          </p>
          <p v-if="contact.error" class="alert alert--error" role="alert">{{ contact.error }}</p>
        </div>
        <div class="actions">
          <button type="button" class="btn btn--primary" :disabled="contact.busy" @click="sendContact">
            <AssetIcon name="send" :size="14" />
            {{ contact.busy ? 'Sending…' : (contact.referral.contact_requested_at ? 'Send again' : 'Send') }}
          </button>
          <button type="button" class="btn" :disabled="contact.busy" @click="closeContact">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import {
  CONFIRMATION_LABELS,
  CONFIRMATORY_OUTCOMES,
  COUNSELLING_ROUTES,
  confirmationDecision,
  confirmationTone,
  latestResults,
} from '~/utils/confirmation'

/**
 * Medical Referrals: the Donor Counselling Physician's follow-up of donors whose
 * reactive serology Testing verified (project owner, 2026-10-25; it was
 * Testing's Counselling Referrals page, and keeps its address).
 *
 * A doctor's alone (referrals.manage). Testing opens each referral on
 * verifying a result and does nothing more with it. Here the physician sees
 * who the donor is, contacts them, records their consent, the free public or
 * private route and the provider, keeps the notes, and records the
 * confirmatory result. The centre's approved SOP then decides the donor's
 * eligibility; the physician confirms that decision and cannot pick another
 * (the server refuses one that differs). The donor starts deferred pending
 * confirmatory testing, never permanently on the screen alone, and the
 * reactive unit stays rejected whatever happens here.
 *
 * The referral's own status (pending → contacted → referred → closed) is the
 * follow-up, not the deferral: closing it lifts nothing.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'referrals.manage',
})

const { user, can } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || '')
const canKeepSop = computed(() => can('confirmatory_sop.configure'))
const service = bloodCenterService

// The sidebar counts what waits; a change here recounts it.
const badgeRefresh = useState('blood-center-badge-refresh', () => 0)

const CONSENTS = [
  { value: 'given', label: 'Consent given' },
  { value: 'declined', label: 'Declined' },
]

const busy = ref(false)
const error = ref(null)
const notice = ref(null)

const referrals = ref([])
const pendingReferrals = ref(0)
const sop = ref(null)
const loadingReferrals = ref(false)
const referralFilter = ref('open')
const editing = ref(null)
const details = ref(null)

const referralFilters = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'referred', label: 'Referred' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
]

const STATUS_ORDER = ['pending', 'contacted', 'referred', 'closed']
const STATUS_LABELS = { pending: 'Pending', contacted: 'Contacted', referred: 'Referred', closed: 'Closed' }

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status
}

/** Forward only, and a step may be skipped. Matches ReferralStatus::canMoveTo. */
function nextStatuses(status) {
  return STATUS_ORDER.slice(STATUS_ORDER.indexOf(status) + 1)
}

/** Referred needs the donor's consent, a route and a provider (the server checks too). */
function readyToRefer(referral) {
  return referral.consent === 'given' && Boolean(referral.route) && Boolean(referral.provider)
}

/** Where the donor stands, in one line. */
function caseSentence(item) {
  const by = item.decided_by ? ` Decided by ${item.decided_by}${item.sop_version ? ` under SOP version ${item.sop_version}` : ''}.` : ''

  switch (item.status) {
    case 'pending_confirmatory_testing':
      return `Deferred pending confirmatory testing since ${formatShort(item.opened_at)}.${by}`
    case 'indeterminate':
      return `Indeterminate: deferred until a retest${item.retest_due_on ? `, due ${formatShort(item.retest_due_on)}` : ''}.${by}`
    case 'temporarily_deferred':
      return `Temporarily deferred until ${formatShort(item.deferred_until)}.${by}`
    case 'permanently_deferred':
      return `Permanently deferred.${by}`
    case 'cleared':
      return `Cleared for re-entry.${by}`
    default:
      return item.status_label
  }
}

async function loadReferrals() {
  loadingReferrals.value = true

  try {
    const res = await service.counsellingReferrals({ status: referralFilter.value })

    referrals.value = res?.data ?? []
    pendingReferrals.value = res?.pending_count ?? 0
    sop.value = res?.sop ?? null
  } catch (err) {
    error.value = messageFor(err)
  } finally {
    loadingReferrals.value = false
  }
}

function setReferralFilter(value) {
  referralFilter.value = value
  editing.value = null
  details.value = null
  loadReferrals()
}

function startReferralUpdate(referral, status) {
  details.value = null
  editing.value = { id: referral.id, status, note: referral.note ?? '' }
}

async function submitReferral() {
  const { id, status, note } = editing.value

  const res = await run(() => service.updateCounsellingReferral(id, {
    ...(status ? { status } : {}),
    note: note.trim() || null,
  }))

  if (!res) return

  editing.value = null
  notice.value = res.message ?? null
  badgeRefresh.value++
  await loadReferrals()
}

function startDetails(referral) {
  editing.value = null
  details.value = {
    id: referral.id,
    consent: referral.consent ?? '',
    route: referral.route ?? '',
    provider: referral.provider ?? '',
  }
}

async function saveDetails() {
  const { id, consent, route, provider } = details.value

  const res = await run(() => service.updateCounsellingReferral(id, {
    ...(consent ? { consent } : {}),
    route: route || null,
    provider: provider.trim() || null,
  }))

  if (!res) return

  details.value = null
  notice.value = res.message ?? null
  await loadReferrals()
}

// --- the confirmatory result ----------------------------------------------------------

const confirming = ref(null)
const confirmRef = ref(null)
const today = new Date().toISOString().slice(0, 10)

function openConfirm(referral) {
  const saved = latestResults(referral.case?.tests ?? [])

  confirming.value = {
    referral,
    busy: false,
    error: '',
    rows: referral.reactive_markers.map((marker) => ({
      marker: marker.value,
      label: marker.label,
      last: saved[marker.value] ?? null,
      outcome: '',
      method: saved[marker.value]?.method ?? '',
      laboratory: saved[marker.value]?.laboratory ?? '',
      reported_on: '',
      report_reference: '',
    })),
  }
  nextTick(() => confirmRef.value?.focus())
}

function closeConfirm() {
  if (confirming.value?.busy) return
  confirming.value = null
}

const draftResults = computed(() => (confirming.value?.rows ?? []).filter((row) => row.outcome))

const decision = computed(() => {
  if (!confirming.value || !draftResults.value.length || !sop.value) return null

  const reactive = confirming.value.referral.reactive_markers.map((marker) => marker.value)
  const latest = latestResults(confirming.value.referral.case?.tests ?? [], draftResults.value)

  return confirmationDecision(reactive, latest, sop.value.rules ?? [])
})

const canConfirm = computed(() => Boolean(decision.value) && draftResults.value.every(
  (row) => row.method.trim() && row.laboratory.trim() && row.reported_on && row.report_reference.trim(),
))

async function sendConfirm() {
  confirming.value.busy = true
  confirming.value.error = ''

  try {
    const res = await service.recordConfirmation(confirming.value.referral.id, {
      results: draftResults.value.map((row) => ({
        marker: row.marker,
        outcome: row.outcome,
        method: row.method.trim(),
        laboratory: row.laboratory.trim(),
        reported_on: row.reported_on,
        report_reference: row.report_reference.trim(),
      })),
      decision: decision.value.status,
    })

    confirming.value = null
    notice.value = res?.message ?? 'Confirmatory result recorded.'
    await loadReferrals()
  } catch (err) {
    confirming.value.busy = false
    confirming.value.error = messageFor(err)
  }
}

// --- contact requests (the mail icon) ----------------------------------------------

const contact = ref(null)
const contactRef = ref(null)

function openContact(referral) {
  contact.value = { referral, busy: false, error: '' }
  nextTick(() => contactRef.value?.focus())
}

function closeContact() {
  if (contact.value?.busy) return
  contact.value = null
}

async function sendContact() {
  contact.value.busy = true
  contact.value.error = ''

  try {
    const res = await service.requestReferralContact(contact.value.referral.id)
    contact.value = null
    notice.value = res?.message ?? 'Contact request sent.'
    await loadReferrals()
  } catch (err) {
    contact.value.busy = false
    contact.value.error = messageFor(err)
  }
}

// --- shared ------------------------------------------------------------------------

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatShort(value) {
  if (!value) return '—'

  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)

  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function formatDay(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

function messageFor(err) {
  const errors = err?.data?.errors

  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).flat()[0]
    if (first) return first
  }

  switch (err?.data?.code) {
    case 'referral_transition_invalid':
    case 'referral_incomplete':
    case 'decision_mismatch':
    case 'case_decided':
    case 'marker_not_reactive':
    case 'sop_missing':
      return err?.data?.message || 'This cannot be recorded.'
    case 'referral_closed':
      return 'This referral is closed and can no longer be changed.'
    case 'referral_not_found':
      return 'That referral was not found at your facility.'
    case 'email_not_sent':
      return 'The email could not be sent. Please try again in a moment.'
    case 'facility_missing':
      return 'This account is not linked to a facility.'
    default:
      return err?.message || 'Something went wrong. Try again.'
  }
}

async function run(work) {
  busy.value = true
  error.value = null

  try {
    return await work()
  } catch (err) {
    error.value = messageFor(err)
    return null
  } finally {
    busy.value = false
  }
}

onMounted(loadReferrals)
</script>

<style scoped>
.referrals-page {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--rb-text-primary);
}

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
.page-subtitle { margin: 3px 0 0; max-width: 72ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

.card {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.1rem;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  background: var(--rb-surface);
  min-width: 0;
}

.card__hint { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--rb-text-secondary); }

.confidential {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.7rem 0.85rem;
  border-radius: 10px;
  border: 1px solid rgba(var(--rb-warning-rgb), 0.35);
  background: rgba(var(--rb-warning-rgb), 0.08);
  color: var(--rb-warning-text);
  font-size: 13px;
  line-height: 1.5;
}

.confidential p { margin: 0; }

.filters { display: flex; flex-wrap: wrap; gap: 0.35rem; }

.filter {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.filter:hover { color: var(--rb-text-primary); }
.filter--on { background: var(--rb-text-primary); border-color: var(--rb-text-primary); color: var(--rb-surface); }
.filter:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; }

.filter__count {
  min-width: 1.1rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: var(--rb-accent);
  color: #fff;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.6rem 1rem;
  text-align: center;
  color: var(--rb-text-secondary);
  font-size: 13.5px;
}

.empty p { margin: 0; }

.referrals { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.75rem; }

.referral {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface);
}

.referral__head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
.referral__side { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.referral__name { margin: 0; font-weight: 700; font-size: 15px; color: var(--rb-text-primary); }
.referral__meta { margin: 0.1rem 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.referral__meta--todo { color: var(--rb-warning-text); font-weight: 600; }
.referral__contact { display: flex; align-items: center; gap: 0.35rem; }
.referral__facts { display: flex; flex-wrap: wrap; gap: 0.4rem 0.9rem; align-items: center; }

.referral__note {
  margin: 0;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  background: var(--rb-surface-alt);
  font-size: 13px;
  color: var(--rb-text-primary);
}

.referral__actions { display: flex; flex-direction: column; gap: 0.5rem; }

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
}

.chip--alarm { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); }

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

.pill--ref-closed { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); border-color: transparent; }
.pill--ref-contacted,
.pill--ref-referred { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); border-color: transparent; }
.pill--ref-pending { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); border-color: transparent; }

.icon-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.icon-btn:hover { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); background: var(--rb-surface-hover); }
.icon-btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.field { display: flex; flex-direction: column; gap: 0.3rem; width: 100%; }
.field__label { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); }
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

.field__input:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 1px; border-color: var(--rb-primary); }

.mono { font-family: var(--rb-font-mono); letter-spacing: 0.02em; }

.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  border-radius: 10px;
  padding: 0.5rem 0.95rem;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}

.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rb-primary) 88%, #000);
  border-color: color-mix(in srgb, var(--rb-primary) 88%, #000);
}

.alert { margin: 0; padding: 0.65rem 0.85rem; border-radius: 10px; font-size: 13.5px; }

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

.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 16px;
  background: var(--rb-overlay);
}

.dialog {
  width: min(30rem, 100%);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1.2rem;
  border-radius: 14px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}

.dialog:focus-visible { outline: 2px solid rgba(var(--rb-primary-rgb), 0.4); outline-offset: 2px; }

.dialog__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.dialog__body { font-size: 14px; line-height: 1.55; color: var(--rb-text-primary); }
.dialog__body p { margin: 0 0 0.4rem; }
.dialog__hint { margin: 0 0 0.4rem; font-size: 12.5px; color: var(--rb-text-secondary); }

.contact-preview {
  margin: 0.2rem 0 0.6rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: var(--rb-surface-alt);
  font-size: 13px;
  color: var(--rb-text-secondary);
}

.contact-preview p { margin: 0; }
.contact-preview__subject { margin-bottom: 0.35rem !important; font-weight: 700; color: var(--rb-text-primary); }

.page-header .btn { flex-shrink: 0; }

.sop-missing {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 13px;
  color: var(--rb-warning-text);
}

.sop-missing a { color: var(--rb-primary-text); font-weight: 600; }

.block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--rb-border);
}

.block__title { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--rb-text-secondary); }
.block__line { margin: 0; font-size: 13.5px; color: var(--rb-text-primary); }
.block__hint { margin: 0; font-size: 12px; color: var(--rb-text-secondary); }

.tests { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.tests th { padding: 0.3rem 0.5rem; text-align: left; font-weight: 600; color: var(--rb-text-secondary); border-bottom: 1px solid var(--rb-border); }
.tests td { padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); }

.details { display: flex; flex-direction: column; gap: 0.6rem; }
.choice { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; }
.choice__item { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 13.5px; }
fieldset.field { margin: 0; padding: 0; border: 0; }

.pill--case-crit { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); border-color: transparent; }
.pill--case-warn { background: rgba(var(--rb-warning-rgb), 0.14); color: var(--rb-warning-text); border-color: transparent; }
.pill--case-ok { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); border-color: transparent; }

.dialog--wide { width: min(44rem, 100%); max-height: calc(100vh - 32px); overflow-y: auto; }

.marker-row { margin: 0 0 0.6rem; padding: 0.6rem 0.7rem; border: 1px solid var(--rb-border); border-radius: 10px; }
.marker-row__title { padding: 0 0.3rem; font-size: 13px; font-weight: 700; }
.marker-row__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr)); gap: 0.5rem; }

.decision {
  margin: 0.4rem 0;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  font-size: 13.5px;
}

.decision--crit { border-color: rgba(var(--rb-accent-rgb), 0.35); background: rgba(var(--rb-accent-rgb), 0.08); }
.decision--warn { border-color: rgba(var(--rb-warning-rgb), 0.35); background: rgba(var(--rb-warning-rgb), 0.08); }
.decision--ok { border-color: rgba(var(--rb-success-rgb), 0.35); background: rgba(var(--rb-success-rgb), 0.08); }

@media (max-width: 640px) {
  .referrals-page { padding: 16px 16px 32px; }
  .referral__head { flex-direction: column; }
}
</style>
