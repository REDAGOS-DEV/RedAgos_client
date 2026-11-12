<template>
  <div class="referrals-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Counselling Referrals</h1>
      </div>
    </header>

    <p v-if="error" class="alert alert--error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="alert alert--notice" role="status">{{ notice }}</p>

    <section class="card">
      <div class="confidential" role="note">
        <span class="confidential__icon" aria-hidden="true"><AssetIcon name="lock" :size="15" /></span>
        <p>
          Confidential. This list says which infection each unit was reactive for, by barcode: Testing never sees who
          the donor is. Per the donor's consent, no result is issued to them. Ask them to get in touch with the mail
          icon (the message names no result), refer them to a doctor, and record what happened.
        </p>
      </div>

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

      <ul v-if="loadingReferrals" class="referrals" aria-busy="true">
        <li v-for="n in 3" :key="n" class="referral referral--skeleton">
          <div class="referral__head">
            <div class="sk-stack">
              <span class="sk sk--line" style="width: 180px; height: 14px" />
              <span class="sk sk--line" style="width: 240px" />
            </div>
            <span class="sk sk--line" style="width: 96px; height: 24px; border-radius: 999px" />
          </div>
          <div class="sk-row">
            <span class="sk sk--line" style="width: 64px; height: 22px; border-radius: 7px" />
            <span class="sk sk--line" style="width: 72px; height: 22px; border-radius: 7px" />
          </div>
          <span class="sk sk--line" style="width: 380px; max-width: 100%; height: 22px" />
        </li>
      </ul>

      <div v-else-if="!referrals.length" class="empty">
        <span class="empty__icon" aria-hidden="true"><AssetIcon :name="referralFilter === 'open' ? 'check-check' : 'life-buoy'" :size="22" /></span>
        <p class="empty__title">{{ referralFilter === 'open' ? 'No one to follow up' : 'Nothing here' }}</p>
        <p class="empty__text">{{ referralFilter === 'open' ? 'No donors are waiting to be followed up.' : 'No referrals match this filter.' }}</p>
      </div>

      <ul v-else class="referrals">
        <li v-for="referral in referrals" :key="referral.id" class="referral" :class="`referral--${referral.status}`">
          <div class="referral__head">
            <div class="referral__who">
              <span class="referral__icon" aria-hidden="true"><AssetIcon name="droplets" :size="17" /></span>
              <div>
              <p class="referral__name">{{ referralTitle(referral) }}</p>
              <p class="referral__meta">
                Donation #{{ referral.donation?.id }} · {{ formatDate(referral.donation?.donation_date) }}
                <template v-if="referral.donor?.blood_type"> · {{ referral.donor.blood_type }}</template>
              </p>
              </div>
            </div>
            <div class="referral__side">
              <span class="pill" :class="`pill--ref-${referral.status}`">{{ referral.status_label }}</span>
              <button
                v-if="referral.is_open"
                type="button"
                class="icon-btn"
                :aria-label="`Send the donor of ${referralTitle(referral)} a contact request`"
                title="Send contact request"
                @click="openContact(referral)"
              >
                <AssetIcon name="mail" :size="15" />
                <span v-if="!referral.contact_requested_at" class="icon-btn__text">Ask to get in touch</span>
              </button>
            </div>
          </div>

          <!-- What it was reactive for: the reason the referral exists. -->
          <div class="referral__markers">
            <span class="referral__label">Reactive for</span>
            <span v-for="marker in referral.reactive_markers" :key="marker.value" class="chip chip--alarm">
              <AssetIcon name="circle-alert" :size="12" />
              {{ marker.label }}
            </span>
          </div>



          <div class="referral__track">
          <!-- Where the referral stands: forward only, from pending to closed. -->
          <ol class="steps" :aria-label="`Referral ${referral.status_label}`">
            <li
              v-for="(step, i) in STATUS_ORDER"
              :key="step"
              class="steps__item"
              :class="{
                'steps__item--done': i < STATUS_ORDER.indexOf(referral.status),
                'steps__item--now': i === STATUS_ORDER.indexOf(referral.status),
              }"
            >
              <span class="steps__dot" aria-hidden="true">
                <AssetIcon v-if="i < STATUS_ORDER.indexOf(referral.status) || (step === 'closed' && referral.status === 'closed')" name="check" :size="11" />
              </span>
              {{ statusLabel(step) }}
            </li>
          </ol>
          <p class="referral__meta referral__contact" :class="{ 'referral__meta--todo': !referral.contact_requested_at && referral.is_open, 'referral__meta--done': referral.contact_requested_at }">
            <AssetIcon name="mail" :size="12" />
            <template v-if="referral.contact_requested_at">
              Contact request sent {{ formatDate(referral.contact_requested_at) }}<template v-if="referral.contact_requested_by"> by {{ referral.contact_requested_by }}</template><template v-else> (automatically)</template>
            </template>
            <template v-else>No contact request sent yet</template>
          </p>
          </div>
          <p class="referral__meta referral__screened">
            Screened by {{ referral.screened_by || '—' }} · {{ formatDate(referral.screened_at) }}
            <template v-if="referral.verified_by && referral.verified_by !== referral.screened_by">
              · Verified by {{ referral.verified_by }}
            </template>
          </p>

          <p v-if="referral.note" class="referral__note">
            {{ referral.note }}
            <span v-if="referral.updated_by" class="referral__meta">— {{ referral.updated_by }}</span>
          </p>

          <!-- Moving it on. Forward only; closing needs a note. -->
          <div v-if="referral.is_open" class="referral__actions">
            <template v-if="editing?.id === referral.id">
              <label class="field">
                <span class="field__label">
                  Note
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
                  {{ busy ? 'Saving…' : `Mark ${statusLabel(editing.status).toLowerCase()}` }}
                </button>
                <button type="button" class="btn" :disabled="busy" @click="editing = null">Cancel</button>
              </div>
            </template>

            <div v-else class="actions">
              <!-- The next step forward is the one in blue; closing stays quiet. -->
              <button
                v-for="(next, i) in nextStatuses(referral.status)"
                :key="next"
                type="button"
                class="btn"
                :class="{ 'btn--primary': i === 0 && next !== 'closed', 'btn--ghost': next === 'closed' }"
                :disabled="busy"
                @click="startReferralUpdate(referral, next)"
              >
                {{ next === 'closed' ? 'Close…' : `Mark ${statusLabel(next).toLowerCase()}` }}
              </button>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <!-- The mail icon on a referral: ask the donor to get in touch, naming no result. -->
    <CenterModal v-if="contact" title="Send contact request" eyebrow="Counselling referral" size="sm" @close="closeContact">
      <div class="dialog__body">
        <p>
          To the donor of <strong>{{ referralTitle(contact.referral) }}</strong>,
          <template v-if="contact.referral.contact_by_email">by email and in the RedAgos portal.</template>
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
        <p v-if="contact.referral.contact_requested_at" class="dialog__hint">
          Last sent {{ formatDate(contact.referral.contact_requested_at) }}<template v-if="contact.referral.contact_requested_by"> by {{ contact.referral.contact_requested_by }}</template>.
        </p>
        <p v-if="contact.error" class="alert alert--error" role="alert">{{ contact.error }}</p>
      </div>
      <template #actions>
        <button type="button" class="btn" :disabled="contact.busy" @click="closeContact">Cancel</button>
        <button type="button" class="btn btn--primary" :disabled="contact.busy" @click="sendContact">
          <AssetIcon name="send" :size="14" />
          {{ contact.busy ? 'Sending…' : (contact.referral.contact_requested_at ? 'Send again' : 'Send') }}
        </button>
      </template>
    </CenterModal>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import CenterModal from '~/components/ui/CenterModal.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { donorTitle } from '~/utils/donorLabel'
import { onPageReturn } from '~/composables/useKeptAlive'

/**
 * Counselling referrals: the follow-up the donor consented to in Section I-C,
 * for every donor whose serology was reactive and verified (project owner,
 * 2026-10-18, moved off the Testing page onto its own sidebar link).
 *
 * The one list that names which infection a donor carries, so it has its own
 * ability (lab.referrals, the Laboratory Supervisor's) and the server audits
 * every read. A referral moves forward only: pending, referred to a doctor,
 * closed (project owner, 2026-10-26); closing needs a note. The donor is
 * asked to get in touch by hand, with the mail icon, in words that name no
 * result.
 *
 * Testing works blind, its head included (project owner, 2026-10-25): a
 * referral is named by its bag. The server sends no name or contact details,
 * only whether the contact request will go by email; it reaches the donor
 * itself.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'lab.referrals',
  keepalive: true,
})

const { user } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || '')
const service = bloodCenterService

// The sidebar counts what waits; a change here recounts it.
const badgeRefresh = useState('blood-center-badge-refresh', () => 0)

const busy = ref(false)
const error = ref(null)
const notice = ref(null)
useNoticeToast(notice)

const referrals = ref([])
const pendingReferrals = ref(0)
const loadingReferrals = ref(true)
const referralFilter = ref('open')
const editing = ref(null)

const referralFilters = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'referred', label: 'Referred to doctor' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
]

const STATUS_ORDER = ['pending', 'referred', 'closed']
const STATUS_LABELS = { pending: 'Pending', referred: 'Referred to doctor', closed: 'Closed' }

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status
}

/** A referral's name on this page: its bag's barcode, never the donor's. */
function referralTitle(referral) {
  return donorTitle({ blinded: true }, referral?.donation?.donation_barcode, referral?.donation?.id)
}

/** Forward only, and a step may be skipped. Matches ReferralStatus::canMoveTo. */
function nextStatuses(status) {
  return STATUS_ORDER.slice(STATUS_ORDER.indexOf(status) + 1)
}

// `quiet`, on return to this kept-alive page: no skeleton over the list on screen.
async function loadReferrals(options = {}) {
  // Read, not destructured: an event or watch handing its own value in may hand in null.
  const quiet = options?.quiet === true
  if (!quiet) loadingReferrals.value = true

  try {
    const res = await service.counsellingReferrals({ status: referralFilter.value })

    referrals.value = res?.data ?? []
    pendingReferrals.value = res?.pending_count ?? 0
  } catch (err) {
    error.value = messageFor(err)
  } finally {
    loadingReferrals.value = false
  }
}

function setReferralFilter(value) {
  referralFilter.value = value
  editing.value = null
  loadReferrals()
}

function startReferralUpdate(referral, status) {
  editing.value = { id: referral.id, status, note: referral.note ?? '' }
}

async function submitReferral() {
  const { id, status, note } = editing.value

  const res = await run(() => service.updateCounsellingReferral(id, {
    status,
    note: note.trim() || null,
  }))

  if (!res) return

  editing.value = null
  notice.value = res.message ?? null
  badgeRefresh.value++
  await loadReferrals()
}

// --- contact requests (the mail icon) ----------------------------------------------

const contact = ref(null)

function openContact(referral) {
  contact.value = { referral, busy: false, error: '' }
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
      return err?.data?.message || 'A referral can only move forward.'
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
onPageReturn(() => loadReferrals({ quiet: true }))
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

@media (max-width: 640px) {
  .referrals-page { padding: 16px 16px 32px; }
  .referral__head { flex-direction: column; }
}

/* ===== Refresh (project owner, 2026-10-24) ===== */
.confidential { padding: 0.55rem 0.8rem; font-size: 12.5px; }
.filter--on { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }

/* A referral: its state down its edge. */
/* Status is the pill and the steps; no edge line. */
.referral { position: relative; border-radius: 14px; }

/* The mail button names its job until a request has gone. */
.icon-btn:has(.icon-btn__text) { display: inline-flex; align-items: center; width: auto; height: 32px; gap: 6px; padding: 0 12px; border-color: rgba(var(--rb-primary-rgb), 0.45); color: var(--rb-primary-text); font-size: 12.5px; font-weight: 700; }

/* Pending, referred to doctor, closed. */
.steps { display: flex; align-items: center; gap: 0; margin: 0.15rem 0 0; padding: 0; list-style: none; }
.steps__item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--rb-text-muted); }
.steps__item + .steps__item::before { content: ''; width: 36px; height: 2px; margin: 0 8px; border-radius: 1px; background: var(--rb-border-strong); }
.steps__item--done + .steps__item::before { background: var(--rb-success); }
.steps__dot { display: grid; place-items: center; width: 18px; height: 18px; border: 2px solid var(--rb-border-strong); border-radius: 50%; background: var(--rb-surface); color: #fff; }
.steps__item--done { color: var(--rb-text-secondary); }
.steps__item--done .steps__dot { border-color: var(--rb-success); background: var(--rb-success); }
.steps__item--now { color: var(--rb-text-primary); }
.steps__item--now .steps__dot { border-color: var(--rb-primary); box-shadow: inset 0 0 0 3px var(--rb-surface); background: var(--rb-primary); }
.referral--closed .steps__item--now .steps__dot { border-color: var(--rb-success); background: var(--rb-success); box-shadow: none; }

.btn--ghost { border-color: transparent; background: transparent; color: var(--rb-text-secondary); }
.btn--ghost:hover:not(:disabled) { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.referral--skeleton { display: flex; flex-direction: column; gap: 10px; }

/* ---------- Calmer, clearer (2026-11-11) ---------- */
.confidential {
  display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px !important; border: 1px solid var(--rb-border) !important;
  border-radius: 12px; background: var(--rb-surface-alt) !important; color: var(--rb-text-secondary) !important; font-size: 12.5px; line-height: 1.55;
}
.confidential__icon { display: grid; flex-shrink: 0; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); }

.referral { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px !important; transition: border-color 0.12s ease, box-shadow 0.12s ease; }
.referral:hover { border-color: var(--rb-border-hover); }
.referral__who { display: flex; align-items: center; gap: 12px; min-width: 0; }
.referral__icon { display: grid; flex-shrink: 0; place-items: center; width: 38px; height: 38px; border-radius: 11px; background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent-text); }
.referral--closed .referral__icon { background: var(--rb-surface-alt); color: var(--rb-text-muted); }
.referral__markers { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.referral__label { margin-right: 2px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--rb-text-muted); }
.referral__markers .chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 7px; font-size: 12px; font-weight: 700; }
.referral--closed .chip--alarm { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

/* The track: steps, then the contact and who screened, on one band. */
.referral__track {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; padding: 10px 12px;
  border-radius: 10px; background: var(--rb-surface-alt);
}
.referral__track .steps { margin: 0; }
.referral__track .referral__contact { margin: 0; }
.referral__screened { margin: -4px 0 0 !important; font-size: 12px; color: var(--rb-text-muted); }
.referral__meta--done { color: var(--rb-success-text); }

.referral--skeleton { gap: 14px; }
.sk-stack { display: flex; flex-direction: column; gap: 8px; }
.sk-row { display: flex; gap: 6px; }

.empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 16px; text-align: center; }
.empty__icon { display: grid; place-items: center; width: 52px; height: 52px; margin-bottom: 4px; border-radius: 16px; background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); box-shadow: 0 0 0 6px rgba(var(--rb-primary-rgb), 0.04); }
.empty__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.empty__text { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
</style>
