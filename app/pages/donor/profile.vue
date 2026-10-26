<template>
  <div class="profile-page">
    <div class="header-row">
      <div>
        <h1 class="page-title">Your donor profile</h1>
        <p class="page-subtitle">Your details as the blood center sees them. Keep them up to date before each visit.</p>
      </div>
    </div>

    <!-- Skeleton state -->
    <div v-if="loading" class="profile-layout" aria-busy="true">
      <div class="skeleton skeleton--identity" />
      <div class="main-grid">
        <div class="skeleton skeleton--form" />
        <div class="col-side">
          <div class="skeleton skeleton--side" />
          <div class="skeleton skeleton--link" />
        </div>
      </div>
    </div>

    <!-- Loaded state -->
    <div v-else class="profile-layout">
      <!-- Who you are, at a glance: photo, name, status and the two shortcuts -->
      <section class="identity-card" aria-label="Your donor summary">
        <div class="identity-card__who">
          <AvatarUpload
            :current-avatar="user?.avatar"
            :fallback-initial="initials"
            @updated="handleAvatarUpdated"
          />
          <div class="identity-card__text">
            <h2 class="identity-card__name">{{ niceName }}</h2>
            <p class="identity-card__chips">
              <span class="chip">{{ donorCode }}</span>
              <span class="chip chip--blood">{{ bloodType }}</span>
              <!-- Answered, not "eligible": the centre decides that at the counter. -->
              <span v-if="qrValid" class="chip chip--ok">
                <AssetIcon name="check" :size="12" />
                Screening complete
              </span>
            </p>
          </div>
        </div>

        <dl class="identity-card__stats">
          <div>
            <dt>Total donations</dt>
            <dd>{{ totalDonations }}</dd>
          </div>
          <div>
            <dt>Last donation</dt>
            <dd>{{ lastDonationDate }}</dd>
          </div>
          <div>
            <dt>Next eligible</dt>
            <dd class="tone--success">{{ nextEligibleLabel }}</dd>
          </div>
          <div>
            <dt>Valid ID</dt>
            <dd :class="`tone--${identityStatusTone}`">{{ identityStatusLabel }}</dd>
          </div>
          <div>
            <dt>QR code</dt>
            <dd :class="qrValid ? 'tone--success' : 'tone--warning'">{{ qrLabel }}</dd>
          </div>
        </dl>

        <div class="identity-card__actions">
          <NuxtLink to="/donor/qrcode" class="btn-outline">
            <AssetIcon name="qr-code" :size="15" />
            View QR Code
          </NuxtLink>
          <NuxtLink to="/donor/eligibility" class="btn-primary">
            <AssetIcon name="clipboard-check" :size="15" />
            Retake Screening
          </NuxtLink>
        </div>
      </section>

      <!--
        The valid ID gates booking, so until it is verified it sits up here,
        where it can't be missed. Once verified it moves to the side column.
      -->
      <div v-if="!idVerified" class="panel id-panel">
        <IdentityVerification :identity="identity" @submitted="handleIdentitySubmitted" />
      </div>

      <div class="main-grid">
        <div class="col-main">
          <!--
            What the blood center prints on its donor form and still has as
            "Not provided". A nudge, never a block: every one of these is
            optional to the server.
          -->
          <!-- Out of the way while a section is open: one thing at a time. -->
          <section v-if="missingFields.length && !editing" class="complete-card complete-card--inline" aria-label="Missing details">
            <div class="complete-card__top">
              <p class="complete-card__title">
                {{ missingFields.length }} detail{{ missingFields.length === 1 ? '' : 's' }} missing
              </p>
              <span class="complete-card__count">{{ COMPLETE_FIELDS.length - missingFields.length }} of {{ COMPLETE_FIELDS.length }}</span>
            </div>
            <span class="complete-card__meter" role="progressbar" :aria-valuenow="COMPLETE_FIELDS.length - missingFields.length"
              aria-valuemin="0" :aria-valuemax="COMPLETE_FIELDS.length" aria-label="Profile details filled in">
              <span class="complete-card__fill" :style="{ width: `${completePercent}%` }" />
            </span>
            <p class="complete-card__sub">The blood center prints these on your donor form. Add them so nothing shows as "Not provided".</p>
            <!-- Desktop: one pill per missing field, wrapping. -->
            <div class="complete-card__chips complete-card__chips--wide">
              <button v-for="f in missingFields" :key="f.key" type="button" class="complete-card__pill"
                @click="startEdit(f.section, f.key)">
                <AssetIcon name="plus" :size="13" />
                {{ f.label }}
              </button>
            </div>

            <!-- Phones: a 2 x 2 grid of equal chips. -->
            <div class="complete-card__chips complete-card__chips--grid">
              <button v-for="c in visibleChips" :key="c.key" type="button" class="complete-card__chip"
                :title="c.label" @click="startEdit(c.section, c.focus)">
                <AssetIcon name="plus" :size="13" />
                <span class="complete-card__chip-text">{{ c.label }}</span>
              </button>
              <button v-if="hiddenChipCount" type="button" class="complete-card__chip complete-card__chip--more"
                @click="showAllChips = true">
                +{{ hiddenChipCount }} more
              </button>
            </div>
          </section>

          <p v-if="profileMessage && !editing" class="profile-status" :class="{ 'profile-status--error': profileFailed }" role="status">
            {{ profileMessage }}
          </p>

          <!--
            Read first, edit one section at a time. The save still sends the
            whole profile (one PUT), but only the open section can differ from
            what was loaded, so nothing else changes behind the donor's back.
          -->
          <section v-for="section in SECTIONS" :key="section.key" class="panel info-card"
            :class="{ 'info-card--editing': editing === section.key }" :aria-labelledby="`sec-${section.key}`">
            <div class="info-card__head">
              <div>
                <h2 :id="`sec-${section.key}`" class="panel-title">{{ section.title }}</h2>
                <p v-if="section.sub" class="panel-sub">{{ section.sub }}</p>
              </div>
              <button v-if="editing !== section.key" type="button" class="info-card__edit"
                :aria-label="`Edit ${section.title}`" @click="startEdit(section.key)">
                <AssetIcon name="pencil" :size="14" />
                Edit
              </button>
            </div>

            <dl v-if="editing !== section.key" class="info-card__list" :class="`info-card__list--${section.key}`">
              <div v-for="f in section.fields" :key="f.key" :class="{ 'is-wide': f.wide }">
                <dt>{{ f.label }}</dt>
                <dd :class="{ 'is-empty': !shownValue(f), 'is-missing': !shownValue(f) && NEEDED_KEYS.has(f.key) }">
                  {{ shownValue(f) || (f.optional ? 'Not given' : 'Not provided') }}
                  <span v-if="f.key === 'email' && shownValue(f)" class="email-tag"
                    :class="user?.email_verified ? 'email-tag--ok' : 'email-tag--warn'">
                    {{ user?.email_verified ? 'Verified' : 'Not verified' }}
                  </span>
                </dd>
              </div>
            </dl>

            <div v-else class="form-body">
              <div v-if="section.key === 'name'" class="form-grid form-grid--3">
                <div class="form-field">
                  <label class="form-label" for="pf-first">First name</label>
                  <input id="pf-first" v-model="profileForm.first_name" type="text" class="form-input" autocomplete="given-name">
                </div>
                <div class="form-field">
                  <label class="form-label" for="pf-middle">Middle name</label>
                  <input id="pf-middle" v-model="profileForm.middle_name" type="text" class="form-input" autocomplete="additional-name">
                </div>
                <div class="form-field">
                  <label class="form-label" for="pf-last">Last name</label>
                  <input id="pf-last" v-model="profileForm.last_name" type="text" class="form-input" autocomplete="family-name">
                </div>
              </div>

              <div v-else-if="section.key === 'about'" class="form-grid form-grid--3">
                <div class="form-field">
                  <label class="form-label" for="pf-dob">Date of birth</label>
                  <DatePicker id="pf-dob" v-model="profileForm.date_of_birth" :max="todayIso" placeholder="Select your birth date" />
                </div>
                <div class="form-field">
                  <label class="form-label" for="pf-blood">Blood type</label>
                  <SelectField id="pf-blood" v-model="profileForm.blood_type" :options="bloodSelectOptions" icon="blood-drop" />
                </div>
                <div class="form-field">
                  <label class="form-label" for="pf-civil">Civil status</label>
                  <SelectField id="pf-civil" v-model="profileForm.civil_status" :options="civilStatusOptions" placeholder="Select" />
                </div>
                <div class="form-field">
                  <label class="form-label" for="pf-occupation">Occupation</label>
                  <input id="pf-occupation" v-model="profileForm.occupation" type="text" class="form-input">
                </div>
                <div class="form-field">
                  <label class="form-label" for="pf-nationality">Nationality</label>
                  <input id="pf-nationality" v-model="profileForm.nationality" type="text" class="form-input">
                </div>
                <div class="form-field">
                  <label class="form-label" for="pf-religion">Religion <span class="form-optional">optional</span></label>
                  <input id="pf-religion" v-model="profileForm.religion" type="text" class="form-input">
                </div>
              </div>

              <!--
                Section I-A of the DOH questionnaire (middle name, civil status,
                occupation, nationality, religion, telephone, office address and
                the contact person). All optional: donors who registered before
                these were collected cannot be back-filled, and the blood centre
                prints what is missing as "Not provided" rather than as a blank
                line on the form.
              -->
              <div v-else-if="section.key === 'contact'" class="form-grid form-grid--3">
                <div class="form-field">
                  <label class="form-label" for="pf-mobile">Contact number</label>
                  <input id="pf-mobile" v-model="profileForm.contact_number" type="text" class="form-input" autocomplete="tel">
                </div>
                <div class="form-field">
                  <label class="form-label" for="pf-tel">Telephone no.</label>
                  <input id="pf-tel" v-model="profileForm.telephone_no" type="text" class="form-input">
                </div>
                <div class="form-field">
                  <label class="form-label" for="pf-email">Email address</label>
                  <input id="pf-email" v-model="profileForm.email" type="email" class="form-input" autocomplete="email">
                </div>
                <div class="form-field form-field--full">
                  <label class="form-label" for="pf-home">Home address</label>
                  <input id="pf-home" v-model="profileForm.address" type="text" class="form-input" autocomplete="street-address">
                </div>
                <div class="form-field form-field--full">
                  <label class="form-label" for="pf-office">Office address</label>
                  <input id="pf-office" v-model="profileForm.office_address" type="text" class="form-input">
                </div>
                <!--
                  Kung mausab ang email, i-revoke sa server ang verification ug
                  mo-send og bag-ong link. Kinahanglan makita ni sa donor, kay
                  mo-undang ang QR ug booking hangtod dili pa siya ma-verify.
                -->
                <p v-if="profileForm.email !== savedValue('email')" class="form-field--full info-card__note">
                  Changing your email sends a new confirmation link. Booking and your QR code pause until you confirm it.
                </p>
              </div>

              <div v-else-if="section.key === 'emergency'" class="form-grid">
                <div class="form-field">
                  <label class="form-label" for="pf-cp-name">Name</label>
                  <input id="pf-cp-name" v-model="profileForm.contact_person_name" type="text" class="form-input">
                </div>
                <div class="form-field">
                  <label class="form-label" for="pf-cp-number">Contact number</label>
                  <input id="pf-cp-number" v-model="profileForm.contact_person_number" type="text" class="form-input">
                </div>
                <div class="form-field form-field--full">
                  <label class="form-label" for="pf-cp-address">Address</label>
                  <input id="pf-cp-address" v-model="profileForm.contact_person_address" type="text" class="form-input">
                </div>
              </div>

              <p v-if="profileMessage && profileFailed" class="profile-status profile-status--error" role="alert">{{ profileMessage }}</p>

              <div class="info-card__actions">
                <button type="button" class="btn-outline" :disabled="savingProfile" @click="cancelEdit">
                  Cancel
                </button>
                <button type="button" class="btn-primary" :disabled="savingProfile || !isDirty" @click="saveSection">
                  {{ savingProfile ? 'Saving...' : 'Save changes' }}
                </button>
              </div>
            </div>
          </section>
        </div>

        <div class="col-side" :class="{ 'col-side--sticky': !idVerified }">
          <!-- Verified: the ID card settles here, out of the way -->
          <div v-if="idVerified" class="panel">
            <IdentityVerification :identity="identity" @submitted="handleIdentitySubmitted" />
          </div>

          <!-- Desktop: the missing details ride in this column instead, beside the cards they open. -->
          <section v-if="missingFields.length && !editing" class="complete-card complete-card--side" aria-label="Missing details">
            <div class="complete-card__top">
              <p class="complete-card__title">
                {{ missingFields.length }} detail{{ missingFields.length === 1 ? '' : 's' }} missing
              </p>
              <span class="complete-card__count">{{ COMPLETE_FIELDS.length - missingFields.length }} of {{ COMPLETE_FIELDS.length }}</span>
            </div>
            <span class="complete-card__meter" role="progressbar" :aria-valuenow="COMPLETE_FIELDS.length - missingFields.length"
              aria-valuemin="0" :aria-valuemax="COMPLETE_FIELDS.length" aria-label="Profile details filled in">
              <span class="complete-card__fill" :style="{ width: `${completePercent}%` }" />
            </span>
            <p class="complete-card__sub">The blood center prints these on your donor form. Add them so nothing shows as "Not provided".</p>
            <div class="complete-card__chips complete-card__chips--wide">
              <button v-for="f in missingFields" :key="f.key" type="button" class="complete-card__pill"
                @click="startEdit(f.section, f.key)">
                <AssetIcon name="plus" :size="13" />
                {{ f.label }}
              </button>
            </div>
          </section>

          <!-- The places a donor goes from here -->
          <nav class="panel shortcuts" aria-label="Shortcuts">
            <p class="shortcuts__title">Shortcuts</p>
            <NuxtLink to="/donor/qrcode" class="shortcuts__link">
              <span class="shortcuts__icon"><AssetIcon name="qr-code" :size="16" /></span>
              My Pass
              <AssetIcon name="chevron-right" :size="15" class="shortcuts__chev" />
            </NuxtLink>
            <NuxtLink to="/donor/history" class="shortcuts__link">
              <span class="shortcuts__icon"><AssetIcon name="history" :size="16" /></span>
              Donation history
              <AssetIcon name="chevron-right" :size="15" class="shortcuts__chev" />
            </NuxtLink>
            <NuxtLink to="/donor/help" class="shortcuts__link">
              <span class="shortcuts__icon"><AssetIcon name="help-circle" :size="16" /></span>
              Help
              <AssetIcon name="chevron-right" :size="15" class="shortcuts__chev" />
            </NuxtLink>
          </nav>

          <!-- Notifications, password and log out live in Settings now -->
          <NuxtLink to="/donor/settings" class="settings-link">
            <span class="settings-link__icon"><AssetIcon name="settings" :size="18" /></span>
            <span class="settings-link__text">
              <span class="settings-link__title">Notifications and password</span>
              <span class="settings-link__sub">Change them in Settings</span>
            </span>
            <AssetIcon name="chevron-right" :size="16" class="settings-link__chevron" />
          </NuxtLink>
        </div>
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
import AvatarUpload from '~/components/profile/AvatarUpload.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import IdentityVerification from '~/components/profile/IdentityVerification.vue'
import { donorService } from '~/api/donor/DonorService'


const { user, fetchUser, updateAvatar } = useUser()

const profile = ref(null)
const loading = ref(true)
const savingProfile = ref(false)
const profileMessage = ref('')
const profileFailed = ref(false)

const bloodTypeOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
// '' stays a real choice: a donor can say they don't know their type yet.
const bloodSelectOptions = [
  { value: '', label: 'Not known yet' },
  ...bloodTypeOptions.map(bt => ({ value: bt, label: bt })),
]

// Birth dates can't be in the future. Local date, not UTC.
const todayIso = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()

/**
 * Section I-A fields, listed once so the hydrate and the save cannot drift.
 *
 * All optional. Donors who registered before these existed have them empty and
 * cannot be back-filled, so nothing may treat a blank as an error.
 */
const PERSONAL_FIELDS = [
  'middle_name',
  'civil_status',
  'occupation',
  'nationality',
  'religion',
  'office_address',
  'telephone_no',
  'contact_person_name',
  'contact_person_address',
  'contact_person_number',
]

const civilStatusOptions = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'separated', label: 'Separated' },
  { value: 'annulled', label: 'Annulled' },
]

const profileForm = reactive({
  first_name: '',
  last_name: '',
  date_of_birth: '',
  blood_type: '',
  contact_number: '',
  email: '',
  address: '',
  middle_name: '',
  civil_status: '',
  occupation: '',
  nationality: '',
  religion: '',
  office_address: '',
  telephone_no: '',
  contact_person_name: '',
  contact_person_address: '',
  contact_person_number: '',
})

// Notifications and password moved to Settings (one place each). The
// notification toggles that used to be here were never saved anywhere.

// Gi-keepalive ni nga page, so mabuhi ang gi-fill na nga form kung mo-navigate
// palayo ang donor. Busa ang background refresh dili gyud angay mo-overwrite sa
// wala pa ma-save nga edits: gi-snapshot nato ang form matag load, ug kung lahi
// na siya karon, ang read-only nga cards ra ang i-update.
let loadedOnce = false
const formSnapshot = ref('')

const snapshotForm = () => JSON.stringify({ ...profileForm })

async function load({ silent = false } = {}) {
  if (!silent) loading.value = true
  try {
    if (!user.value) await fetchUser()

    const res = await donorService.profile()
    profile.value = res

    if (silent && snapshotForm() !== formSnapshot.value) return

    // Ang matag field diri kay direkta gikan sa registration data sa user
    profileForm.first_name = res.first_name || ''
    profileForm.last_name = res.last_name || ''
    profileForm.date_of_birth = res.date_of_birth || ''
    // Never fall back to a real blood type. A donor who has none on file would
    // otherwise see one pre-selected and save it by editing something else
    // entirely, recording a type nobody tested.
    profileForm.blood_type = res.blood_type || ''
    profileForm.contact_number = res.contact_number || ''
    profileForm.email = user.value?.email || ''
    profileForm.address = res.address || ''
    for (const field of PERSONAL_FIELDS) {
      profileForm[field] = res[field] || ''
    }
    formSnapshot.value = snapshotForm()
  } catch (err) {
    console.error('Failed to load profile:', err)
  } finally {
    loading.value = false
    loadedOnce = true
  }
}

// Edits not saved yet, for the open section's Save button.
const isDirty = computed(() => !!formSnapshot.value && snapshotForm() !== formSnapshot.value)

// Put every field back to what was last loaded or saved.
function discardChanges() {
  if (!formSnapshot.value) return
  Object.assign(profileForm, JSON.parse(formSnapshot.value))
  profileMessage.value = ''
  profileFailed.value = false
}

onMounted(() => load())
onActivated(() => {
  if (loadedOnce) load({ silent: true })
})

// Ang user.full_name usahay blangko, so fallback sa donor profile. Ang
// initials kay first + last name (pananglitan "Juan Dela Cruz" -> "JD").
const nameParts = computed(() => {
  const first = (user.value?.first_name || profile.value?.first_name || '').trim()
  const last = (user.value?.last_name || profile.value?.last_name || '').trim()
  if (first || last) return [first, last].filter(Boolean)

  return (user.value?.full_name || '').trim().split(/\s+/).filter(Boolean)
})

const displayName = computed(() => user.value?.full_name?.trim() || nameParts.value.join(' '))

// Names are stored as typed ("yana cruz"); show them capitalised.
const niceName = computed(() =>
  (displayName.value || 'Donor').replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
)

const initials = computed(() => {
  const parts = nameParts.value
  if (!parts.length) return '?'
  const letters = parts.length > 1
    ? parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    : parts[0].charAt(0)

  return letters.toUpperCase()
})

const donorCode = computed(() => profile.value?.donor_code || '-')
const bloodType = computed(() => profile.value?.blood_type || '-')
const totalDonations = computed(() => profile.value?.total_donations ?? 0)
// The questionnaire, not eligibility_status: every screening is recorded
// `pending` until the centre decides, so that one never reads as valid.
const questionnaireStatus = computed(() => profile.value?.questionnaire_status || 'not_answered')
const qrValid = computed(() => questionnaireStatus.value === 'answered')
const qrLabel = computed(() => (qrValid.value ? 'Valid' : questionnaireStatus.value === 'expired' ? 'Expired' : 'Pending'))

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const lastDonationDate = computed(() => formatDate(profile.value?.last_donation_date))
const nextEligibleLabel = computed(() => {
  if (!profile.value?.next_eligible_date) return '-'
  const next = new Date(profile.value.next_eligible_date)
  return next <= new Date() ? 'Now' : formatDate(profile.value.next_eligible_date)
})

const identity = computed(() => profile.value?.identity || null)

const identityStatusLabel = computed(() => ({
  unsubmitted: 'Not submitted',
  pending: 'Under review',
  verified: 'Verified',
  rejected: 'Not approved',
}[identity.value?.status] || 'Not submitted'))

// Tone name, dili hex, para ang kolor kay gikan sa CSS tokens (light ug dark).
const identityStatusTone = computed(() => ({
  unsubmitted: 'muted',
  pending: 'warning',
  verified: 'success',
  rejected: 'danger',
}[identity.value?.status] || 'muted'))

function handleAvatarUpdated(newUrl) {
  updateAvatar(newUrl)
}

// Ang submit response kay ang buo nga profile payload na, so dili na kinahanglan
// og laing fetch para ma-update ang badge ug ang status row.
function handleIdentitySubmitted(updatedProfile) {
  if (updatedProfile) profile.value = updatedProfile
}

// ── Read first, edit one section at a time ──
const civilStatusLabel = Object.fromEntries(civilStatusOptions.map(o => [o.value, o.label]))

// Names are stored as typed ("yana cruz"); show them capitalised, as the card above does.
const titleCase = v => String(v).replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())

const SECTIONS = [
  {
    key: 'name',
    title: 'Name',
    fields: [
      { key: 'first_name', label: 'First name', format: titleCase },
      { key: 'middle_name', label: 'Middle name', optional: true, format: titleCase },
      { key: 'last_name', label: 'Last name', format: titleCase },
    ],
  },
  {
    key: 'about',
    title: 'About you',
    fields: [
      { key: 'date_of_birth', label: 'Date of birth', format: v => formatDate(v) },
      { key: 'blood_type', label: 'Blood type', format: v => v || 'Not known yet' },
      { key: 'civil_status', label: 'Civil status', format: v => civilStatusLabel[v] || v },
      { key: 'occupation', label: 'Occupation' },
      { key: 'nationality', label: 'Nationality' },
      { key: 'religion', label: 'Religion', optional: true },
    ],
  },
  {
    key: 'contact',
    title: 'Contact',
    fields: [
      { key: 'contact_number', label: 'Contact number' },
      { key: 'telephone_no', label: 'Telephone no.', optional: true },
      { key: 'email', label: 'Email address' },
      { key: 'address', label: 'Home address', wide: true },
      { key: 'office_address', label: 'Office address', optional: true, wide: true },
    ],
  },
  {
    key: 'emergency',
    title: 'Emergency contact',
    sub: 'A relative the blood center can reach if they need to.',
    fields: [
      { key: 'contact_person_name', label: 'Name', format: titleCase },
      { key: 'contact_person_number', label: 'Contact number' },
      { key: 'contact_person_address', label: 'Address', wide: true },
    ],
  },
]

// The value as last loaded or saved, not as being typed.
function savedValue(key) {
  if (!formSnapshot.value) return profileForm[key]
  return JSON.parse(formSnapshot.value)[key]
}

function shownValue(field) {
  const raw = savedValue(field.key)
  if (field.key === 'blood_type') return field.format(raw)
  if (!raw) return ''
  return field.format ? field.format(raw) : raw
}

// What the blood center's donor form asks for, beyond what registration took.
const COMPLETE_FIELDS = [
  { key: 'first_name', label: 'First name', section: 'name' },
  { key: 'last_name', label: 'Last name', section: 'name' },
  { key: 'date_of_birth', label: 'Date of birth', section: 'about' },
  { key: 'civil_status', label: 'Civil status', section: 'about' },
  { key: 'occupation', label: 'Occupation', section: 'about' },
  { key: 'nationality', label: 'Nationality', section: 'about' },
  { key: 'contact_number', label: 'Contact number', section: 'contact' },
  { key: 'address', label: 'Home address', section: 'contact' },
  { key: 'contact_person_name', label: 'Emergency contact name', section: 'emergency' },
  { key: 'contact_person_number', label: 'Emergency contact number', section: 'emergency' },
]
// The fields the "missing" card counts: empty ones read amber in the cards too.
const NEEDED_KEYS = new Set(COMPLETE_FIELDS.map(f => f.key))

const missingFields = computed(() => {
  void formSnapshot.value
  return COMPLETE_FIELDS.filter(f => !savedValue(f.key))
})
/*
 * The chips: one per thing to add, the two emergency-contact fields as one
 * ("Emergency contact" opens that section at whichever is missing). A 2 x 2
 * grid: with more than four, three show and the fourth says how many more.
 */
const missingChips = computed(() => {
  const chips = []
  for (const f of missingFields.value) {
    if (f.section === 'emergency') {
      if (!chips.some(c => c.key === 'emergency')) {
        chips.push({ key: 'emergency', label: 'Emergency contact', section: 'emergency', focus: f.key })
      }
      continue
    }
    chips.push({ key: f.key, label: f.label, section: f.section, focus: f.key })
  }
  return chips
})
const showAllChips = ref(false)
const visibleChips = computed(() =>
  showAllChips.value || missingChips.value.length <= 4 ? missingChips.value : missingChips.value.slice(0, 3))
const hiddenChipCount = computed(() => missingChips.value.length - visibleChips.value.length)

const completePercent = computed(() =>
  Math.round(((COMPLETE_FIELDS.length - missingFields.value.length) / COMPLETE_FIELDS.length) * 100))

const FIELD_IDS = {
  first_name: 'pf-first', middle_name: 'pf-middle', last_name: 'pf-last',
  date_of_birth: 'pf-dob', blood_type: 'pf-blood', civil_status: 'pf-civil',
  occupation: 'pf-occupation', nationality: 'pf-nationality', religion: 'pf-religion',
  contact_number: 'pf-mobile', telephone_no: 'pf-tel', email: 'pf-email',
  address: 'pf-home', office_address: 'pf-office',
  contact_person_name: 'pf-cp-name', contact_person_number: 'pf-cp-number', contact_person_address: 'pf-cp-address',
}

const editing = ref(null)

/*
 * Opening another section closes the one open now. Unsaved changes there are
 * only dropped after the donor says so; with none, it just switches.
 */
const { confirm: confirmDialog } = useConfirmDialog()

async function startEdit(sectionKey, fieldKey = null) {
  if (editing.value && editing.value !== sectionKey) {
    if (isDirty.value) {
      const open = SECTIONS.find(x => x.key === editing.value)?.title ?? 'this section'
      const discard = await confirmDialog({
        title: 'Discard your changes?',
        message: `You have unsaved changes in ${open}. They will be lost if you edit another section.`,
        cancelLabel: 'Keep editing',
        confirmLabel: 'Discard changes',
        tone: 'danger',
      })
      if (!discard) return
    }
    discardChanges()
  }
  profileMessage.value = ''
  profileFailed.value = false
  editing.value = sectionKey
  nextTick(() => {
    const id = fieldKey ? FIELD_IDS[fieldKey] : FIELD_IDS[SECTIONS.find(x => x.key === sectionKey)?.fields[0]?.key]
    const el = id ? document.getElementById(id) : null
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el?.focus?.({ preventScroll: true })
  })
}

function cancelEdit() {
  discardChanges()
  editing.value = null
}

async function saveSection() {
  await handleProfileSave()
  if (!profileFailed.value) editing.value = null
}

// The valid ID card sits up top until it is verified.
const idVerified = computed(() => identity.value?.status === 'verified')

async function handleProfileSave() {
  savingProfile.value = true
  try {
    // Backend contract: PUT /api/donor-profile/me
    // Body: { first_name, last_name, date_of_birth, blood_type, contact_number,
    //   email, address } plus the Section I-A fields in PERSONAL_FIELDS.
    // Kini mag-UPDATE sa existing row sa user, dili mag-create og bag-o
    const response = await donorService.updateProfile({
      first_name: profileForm.first_name,
      last_name: profileForm.last_name,
      birth_date: profileForm.date_of_birth,
      blood_type: profileForm.blood_type,
      phone: profileForm.contact_number,
      email: profileForm.email,
      address: profileForm.address,
      // Sent as given, including the blanks: an emptied field is the donor
      // clearing it, and the server treats '' as absent.
      ...Object.fromEntries(PERSONAL_FIELDS.map(field => [field, profileForm[field]])),
    })
    profile.value = response?.data || profile.value
    profileFailed.value = false
    profileMessage.value = response?.message || 'Profile updated.'
    // Ang bag-o nga na-save nga values na ang baseline — kung dili, mag-tuo ang
    // refresh nga dirty pa gihapon ang form ug dili na siya mo-update.
    formSnapshot.value = snapshotForm()
    await fetchUser()
  } catch (err) {
    console.error('Failed to save profile:', err)
    profileFailed.value = true
    profileMessage.value = err?.message || 'Could not save your profile. Please try again.'
  } finally {
    savingProfile.value = false
  }
}

</script>

<style scoped>
/*
  Kolor tokens para sa light ug dark, parehas sa eligibility page. Ang
  IdentityVerification ug AvatarUpload kay naa sa sulod sa .profile-page, so
  ma-inherit nila ni. Ang dark mode kay token override ra (ubos).
*/
.profile-page {
  /* Surfaces */
  --page-bg: var(--rb-page-bg, #F7F8FA);
  --surface: #FFFFFF;
  --surface-subtle: #F8FAFC;
  --surface-muted: #F1F5F9;
  --surface-muted-hover: #E2E8F0;

  /* Lines */
  --border: #E2E8F0;
  --border-subtle: #EEF2F6;
  --border-strong: #CBD5E1;

  /* Text */
  --text-primary: #1E293B;
  --text-body: #475569;
  --text-muted: #64748B;
  --text-secondary: var(--text-muted);

  /* Brand: --primary kay fill (puti nga text), --primary-text kay text/icon */
  --primary: var(--rb-primary);
  --primary-hover: var(--rb-primary-hover);
  --primary-text: var(--rb-primary);
  --primary-soft: color-mix(in srgb, var(--rb-primary) 10%, white);
  --primary-border: color-mix(in srgb, var(--rb-primary) 40%, white);
  --focus-ring: var(--rb-primary);

  /* Toggle off / tracks */
  --track: #CBD5E1;

  /* Status */
  --success-fg: #2E7D32;
  --success-bg: #F0F7F0;
  --success-border: #CFE3D0;

  --warning-fg: #B54708;
  --warning-bg: #FFFAEB;
  --warning-border: #FEDF89;

  --danger-fg: #B42318;
  --danger-text: #7A271A;
  --danger-bg: #FEF3F2;
  --danger-border: #FECDCA;

  /* Depth */
  --shadow-panel: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
  --skeleton-base: #EEF2F6;
  --skeleton-shine: #F8FAFC;

  /* Legacy names nga gigamit pa sa child components */
  --success: var(--success-fg);
  --warning: var(--warning-fg);
  --accent: var(--danger-fg);

  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  display: flex;
  background: var(--page-bg);
  flex-direction: column;
  gap: 20px;
}

.profile-page .header-row { display: flex; align-items: flex-start; justify-content: space-between; }
.profile-page .page-title { font-size: var(--rb-fs-title); font-weight: 700; color: var(--text-primary); margin: 0; }
.profile-page .page-subtitle { font-size: var(--rb-fs-small); color: var(--text-secondary); margin: 2px 0 0; }

.profile-page .main-grid { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: start; }
.profile-page .col-left, .profile-page .col-right { display: flex; flex-direction: column; gap: 20px; }

.profile-page .panel {
  background: var(--surface);
  border-radius: 14px;
  box-shadow: var(--shadow-panel);
  border: 1px solid var(--border);
  overflow: hidden;
}
.profile-page .panel-header--simple { padding: 16px 20px; border-bottom: 1px solid var(--border-subtle); }
.profile-page .panel-title { font-weight: 700; font-size: var(--rb-fs-body); color: var(--text-primary); margin: 0; }

/* Profile card */
.profile-page .profile-card {
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2px;
}
.profile-page .profile-card :deep(.avatar-upload) {
  width: 100%;
  justify-content: center;
}
.profile-page .profile-card__name { font-size: var(--rb-fs-section); font-weight: 700; color: var(--text-primary); margin: 12px 0 0; }
.profile-page .profile-card__meta { font-size: var(--rb-fs-small); color: var(--text-secondary); margin: 2px 0 0; }
.profile-page .profile-card__eligible {
  font-size: var(--rb-fs-small); font-weight: 700; color: var(--success-fg);
  margin: 8px 0 0;
}

/* Status list */
.profile-page .status-list { padding: 4px 20px 8px; }
.profile-page .status-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid var(--border-subtle);
  font-size: var(--rb-fs-small);
}
.profile-page .status-row:last-child { border-bottom: none; }
.profile-page .status-row__label { color: var(--text-secondary); }
.profile-page .status-row__value { font-weight: 700; color: var(--text-primary); }
.profile-page .status-row__value--success { color: var(--success-fg); }
.profile-page .status-row__value--warning { color: var(--warning-fg); }
.profile-page .status-row__value--danger { color: var(--danger-fg); }
.profile-page .status-row__value--muted { color: var(--text-muted); }

.profile-page .status-actions { display: flex; flex-direction: column; gap: 10px; padding: 14px 20px 20px; }

/* Buttons */
.profile-page .btn-primary {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 16px; border-radius: 8px; font-size: var(--rb-fs-small); font-weight: 700;
  color: #FFFFFF; background: var(--primary); border: none; cursor: pointer;
  text-decoration: none;
  transition: background-color 0.15s ease;
}
.profile-page .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
.profile-page .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.profile-page .btn-outline {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 16px; border-radius: 8px; font-size: var(--rb-fs-small); font-weight: 700;
  color: var(--text-primary); background: var(--surface-muted); border: none; cursor: pointer;
  text-decoration: none; transition: background 0.15s ease;
}
.profile-page .btn-outline:hover { background: var(--surface-muted-hover); }

.profile-page .btn-block { width: 100%; }

/* Forms */
.profile-page .form-body { padding: 20px; }
.profile-page .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.profile-page .form-field--full { grid-column: 1 / -1; }
.profile-page .form-label { display: block; font-size: var(--rb-fs-caption); font-weight: 600; color: var(--text-body); margin-bottom: 6px; }
.profile-page .form-input {
  width: 100%; padding: 9px 12px; border-radius: 8px;
  border: 1px solid var(--border); font-size: var(--rb-fs-small); color: var(--text-primary);
  background: var(--surface); transition: border-color 0.15s ease, box-shadow 0.15s ease;
  color-scheme: light;
}
.profile-page .form-input:focus { outline: none; border-color: var(--focus-ring); box-shadow: 0 0 0 3px var(--primary-soft); }

/* Section I-A additions. `optional` sits inline in the label; the section
   label breaks the contact-person block out of the run of plain fields. */
.profile-page .form-optional { font-weight: 400; text-transform: none; color: var(--text-muted); }

.profile-page .form-section-label {
  margin: 8px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
  font-size: var(--rb-fs-caption);
  font-weight: 700;
  color: var(--text-primary);
}
.profile-page select.form-input {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2364748b' stroke-width='1.5'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 34px;
}
.profile-page .form-actions { display: flex; gap: 10px; margin-top: 18px; align-items: center; flex-wrap: wrap; }
.profile-page .form-actions .btn-primary { padding: 10px 20px; }
.profile-page .form-status { margin: 0; font-size: var(--rb-fs-small); line-height: 1.5; color: var(--success-fg); }
.profile-page .form-status--error { color: var(--danger-fg); }

/* Toggle switches */
.profile-page .toggle-list { padding: 6px 20px 20px; display: flex; flex-direction: column; }
.profile-page .toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 0; border-bottom: 1px solid var(--border-subtle); gap: 16px;
}
.profile-page .toggle-row:last-child { border-bottom: none; }
.profile-page .toggle-row__label { font-size: var(--rb-fs-small); font-weight: 600; color: var(--text-primary); margin: 0; }
.profile-page .toggle-row__desc { font-size: var(--rb-fs-caption); color: var(--text-secondary); margin: 2px 0 0; }

.profile-page .toggle-switch {
  position: relative;
  width: 40px; height: 22px; border-radius: 999px;
  background: var(--track); border: none; cursor: pointer; flex-shrink: 0;
  transition: background 0.2s ease;
}
.profile-page .toggle-switch--on { background: var(--primary); }
.profile-page .toggle-switch__knob {
  position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; border-radius: 999px; background: #FFFFFF;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.2);
  transition: transform 0.2s ease;
}
.profile-page .toggle-switch--on .toggle-switch__knob { transform: translateX(18px); }
.profile-page .toggle-switch:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

/* Skeleton */
.profile-page .skeleton {
  background: linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-shine) 37%, var(--skeleton-base) 63%);
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
  border-radius: 6px;
}
@keyframes skeleton-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
@media (prefers-reduced-motion: reduce) {
  .profile-page .skeleton { animation: none; }
}
.profile-page .skeleton-avatar { width: 80px; height: 80px; border-radius: 999px; }
.profile-page .skeleton-line { border-radius: 4px; }
.profile-page .skeleton-input { width: 100%; height: 36px; border-radius: 8px; }
.profile-page .skeleton-btn { height: 38px; border-radius: 8px; flex: 1; }

@media (max-width: 900px) {
  .profile-page .main-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .profile-page { padding: 16px 16px 32px; }
  .profile-page .form-grid { grid-template-columns: 1fr; }
}

.profile-page .btn-primary:focus-visible,
.profile-page .btn-outline:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}


/* ── Redesign: identity card + sectioned form ── */
.profile-page .profile-layout { display: flex; flex-direction: column; gap: 20px; }

.profile-page .identity-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px 28px;
  padding: 22px 24px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: var(--surface);
  box-shadow: var(--shadow-panel);
}

.profile-page .identity-card__who { display: flex; align-items: center; gap: 16px; min-width: 0; }
.profile-page .identity-card :deep(.avatar-upload) { width: auto; }
.profile-page .identity-card__text { min-width: 0; }

.profile-page .identity-card__name {
  margin: 0;
  font-family: var(--rb-font-sans);
  font-size: var(--rb-fs-title);
  font-weight: 800;
  color: var(--text-primary);
}

.profile-page .identity-card__chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; }

.profile-page .chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-body);
  font-size: var(--rb-fs-caption);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.profile-page .chip--blood { background: #fdecec; color: #B71C1C; }
.profile-page .chip--ok { background: var(--success-bg); color: var(--success-fg); }

/* Five facts on their own row under the name, equal columns divided by
   hairlines, so they never have to squeeze between the name and the buttons. */
.profile-page .identity-card__stats {
  grid-column: 1 / -1;
  grid-row: 2;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin: 0;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
}

.profile-page .identity-card__stats > div { min-width: 0; padding: 2px 16px; border-left: 1px solid var(--border-subtle); }
.profile-page .identity-card__stats > div:first-child { padding-left: 0; border-left: none; }

.profile-page .identity-card__stats dt {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.profile-page .identity-card__stats dd {
  margin: 4px 0 0;
  font-size: var(--rb-fs-body);
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.profile-page .tone--success { color: var(--success-fg) !important; }
.profile-page .tone--warning { color: var(--warning-fg) !important; }
.profile-page .tone--danger { color: var(--danger-fg) !important; }
.profile-page .tone--muted { color: var(--text-muted) !important; }

.profile-page .identity-card__actions { display: flex; gap: 8px; }
.profile-page .identity-card__actions .btn-primary,
.profile-page .identity-card__actions .btn-outline { gap: 6px; border-radius: 999px; padding: 10px 18px; white-space: nowrap; }

/* Main grid: form | side */
.profile-page .main-grid { grid-template-columns: minmax(0, 1fr) 360px; }
.profile-page .col-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

/* ── Read-first section cards ── */
.profile-page .info-card { overflow: hidden; }
.profile-page .info-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}
.profile-page .info-card__edit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--primary-text);
  font: inherit;
  font-size: var(--rb-fs-small);
  font-weight: 700;
  cursor: pointer;
}
.profile-page .info-card__edit:hover:not(:disabled) { background: var(--surface-muted); }
.profile-page .info-card__edit:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
.profile-page .info-card--editing { border-color: var(--primary-border); box-shadow: 0 0 0 3px color-mix(in srgb, var(--rb-primary) 12%, transparent); }
.profile-page .info-card__list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px 20px;
  margin: 0;
  padding: 16px 20px 18px;
}
.profile-page .info-card__list .is-wide { grid-column: span 2; }
.profile-page .info-card__list dt { font-size: var(--rb-fs-caption); font-weight: 600; color: var(--text-muted); }
.profile-page .info-card__list dd { margin: 2px 0 0; font-size: var(--rb-fs-body); font-weight: 600; color: var(--text-primary); overflow-wrap: anywhere; }
/* Anything still empty reads amber: "Not provided" (on the missing list) and
   "Not given" (optional) alike, so every gap stands out in the cards. */
.profile-page .info-card__list dd.is-empty { font-weight: 600; font-style: italic; color: var(--warning-fg); }
.profile-page .info-card__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.profile-page .info-card__actions .btn-primary,
.profile-page .info-card__actions .btn-outline { border-radius: 999px; padding: 10px 20px; }
.profile-page .info-card__actions .btn-outline { border: 1px solid var(--border); background: transparent; }
.profile-page .info-card__note { margin: 0; font-size: var(--rb-fs-caption); color: var(--warning-fg); }
.profile-page .email-tag { margin-left: 6px; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; font-style: normal; }
.profile-page .email-tag--ok { background: var(--success-bg); color: var(--success-fg); }
.profile-page .email-tag--warn { background: var(--warning-bg); color: var(--warning-fg); }
.profile-page .profile-status { margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--success-bg); color: var(--success-fg); font-size: var(--rb-fs-small); font-weight: 600; }
.profile-page .profile-status--error { background: var(--danger-bg); color: var(--danger-fg); }
.profile-page .info-card .profile-status { margin-top: 14px; }

/* ── Missing details ── */
.profile-page .complete-card {
  padding: 16px 20px;
  border: 1px solid var(--warning-border);
  border-radius: 20px;
  background: var(--warning-bg);
}
.profile-page .complete-card__top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.profile-page .complete-card__title { margin: 0; font-weight: 700; color: var(--text-primary); }
.profile-page .complete-card__count { font-size: var(--rb-fs-caption); font-weight: 700; color: var(--warning-fg); }
.profile-page .complete-card__meter { display: block; height: 6px; margin-top: 10px; border-radius: 999px; background: color-mix(in srgb, var(--warning-fg) 18%, transparent); overflow: hidden; }
.profile-page .complete-card__fill { display: block; height: 100%; border-radius: inherit; background: var(--warning-fg); }
.profile-page .complete-card__sub { margin: 10px 0 0; font-size: var(--rb-fs-small); color: var(--text-body); }
/* Desktop: pills that wrap. */
.profile-page .complete-card__chips--wide { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.profile-page .complete-card__chips--grid { display: none; }
.profile-page .complete-card__pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--warning-border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--rb-fs-caption);
  font-weight: 600;
  cursor: pointer;
}
.profile-page .complete-card__pill:hover { border-color: var(--warning-fg); }
.profile-page .complete-card__pill:focus-visible { outline: 2px solid var(--warning-fg); outline-offset: 2px; }
.profile-page .complete-card__pill :deep(.asset-icon) { color: var(--warning-fg); }

/* Phones: a 2 x 2 grid of equal chips, one line each, a long label ends in "…". */
@media (max-width: 760px) {
  .profile-page .complete-card__chips--wide { display: none; }
  .profile-page .complete-card__chips--grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
}
.profile-page .complete-card__chip {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-width: 0;
  height: 40px;
  padding: 0 12px;
  overflow: hidden;
  border: 1px solid var(--warning-border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--rb-fs-caption);
  font-weight: 600;
  cursor: pointer;
}
.profile-page .complete-card__chip:hover { border-color: var(--warning-fg); }
.profile-page .complete-card__chip :deep(.asset-icon) { flex: none; }
.profile-page .complete-card__chip-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-page .complete-card__chip--more { justify-content: center; color: var(--warning-fg); }
.profile-page .complete-card__chip:focus-visible { outline: 2px solid var(--warning-fg); outline-offset: 2px; }
.profile-page .complete-card__chip :deep(.asset-icon) { color: var(--warning-fg); }

/* Dark: an amber tint on the ink, chips quiet until hovered. */
html.dark .profile-page .complete-card { background: var(--ink-surface, #1E293B); border-color: rgba(247, 144, 9, 0.35); box-shadow: inset 3px 0 0 #F5A524; }
html.dark .profile-page .complete-card__meter { background: rgba(247, 144, 9, 0.16); }
html.dark .profile-page .complete-card__fill { background: #F5A524; }
html.dark .profile-page .complete-card__sub { color: var(--ink-text-2, #B4BCC9); }
html.dark .profile-page .complete-card__pill,
html.dark .profile-page .complete-card__chip {
  background: rgba(var(--ink-page-rgb, 15, 23, 42), 0.55);
  border-color: rgba(247, 144, 9, 0.3);
  color: var(--ink-text, #EEF1F5);
}
html.dark .profile-page .complete-card__pill:hover,
html.dark .profile-page .complete-card__chip:hover { background: rgba(247, 144, 9, 0.12); border-color: rgba(247, 144, 9, 0.55); }

/* The unverified ID card, up top: full width. */
.profile-page .id-panel { width: 100%; }
.profile-page .col-side { display: flex; flex-direction: column; gap: 20px; }
.profile-page .panel { border-radius: 20px; }
.profile-page .panel-sub { margin: 2px 0 0; font-size: var(--rb-fs-caption); color: var(--text-muted); }
.profile-page .panel-header--simple { display: block; }

/* Form sections */
.profile-page .form-body { display: flex; flex-direction: column; gap: 22px; padding: 20px 22px 8px; }
.profile-page .form-section { min-width: 0; margin: 0; padding: 0; border: none; }

.profile-page .form-section__title {
  margin-bottom: 12px;
  padding: 0;
  font-size: var(--rb-fs-caption);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--primary-text);
}

.profile-page .form-section__title .form-optional { letter-spacing: 0; text-transform: none; }

.profile-page .form-grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.profile-page .form-input { min-height: 40px; border-radius: 10px; }


/* Link to Settings */
.profile-page .settings-link {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
  text-decoration: none;
  box-shadow: var(--shadow-panel);
  transition: border-color 0.15s ease;
}

.profile-page .settings-link:hover { border-color: var(--primary-border); }
.profile-page .settings-link:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

.profile-page .settings-link__icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--primary-soft);
  color: var(--primary-text);
}

.profile-page .settings-link__text { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.profile-page .settings-link__title { font-size: var(--rb-fs-small); font-weight: 700; color: var(--text-primary); }
.profile-page .settings-link__sub { font-size: var(--rb-fs-caption); color: var(--text-muted); }
.profile-page .settings-link__chevron { color: var(--text-muted); }

/* Skeletons for the new layout */
.profile-page .skeleton--identity { height: 140px; border-radius: 22px; }
.profile-page .skeleton--form { height: 640px; border-radius: 20px; }
.profile-page .skeleton--side { height: 420px; border-radius: 20px; }
.profile-page .skeleton--link { height: 72px; border-radius: 20px; }

/* Two columns: the missing details sit in the side column, sticky. */
.profile-page .complete-card--side { display: none; }
@media (min-width: 1101px) {
  .profile-page .complete-card--inline { display: none; }
  .profile-page .complete-card--side { display: block; }
  /* Sticky only while short: with the verified ID card in it, it can outgrow the screen. */
  .profile-page .col-side--sticky { position: sticky; top: 88px; }
}

@media (max-width: 1100px) {
  .profile-page .main-grid { grid-template-columns: minmax(0, 1fr); }
}

/* ── Shortcuts ── */
.profile-page .shortcuts { padding: 8px; }
.profile-page .shortcuts__title { margin: 6px 10px 6px; font-size: var(--rb-fs-caption); font-weight: 700; color: var(--text-muted); }
.profile-page .shortcuts__link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 12px;
  color: var(--text-primary);
  font-size: var(--rb-fs-small);
  font-weight: 600;
  text-decoration: none;
}
.profile-page .shortcuts__link:hover { background: var(--surface-muted); }
.profile-page .shortcuts__link:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
.profile-page .shortcuts__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--primary-soft);
  color: var(--primary-text);
}
.profile-page .shortcuts__chev { margin-left: auto; color: var(--text-muted); }

@media (max-width: 760px) {
  .profile-page .identity-card { grid-template-columns: minmax(0, 1fr); padding: 18px; }
  .profile-page .identity-card__stats {
    grid-row: auto;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .profile-page .identity-card__actions { grid-row: auto; }
  .profile-page .info-card__list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .profile-page .complete-card__chip :deep(.asset-icon) { flex: none; }
  .profile-page .info-card__list .is-wide { grid-column: 1 / -1; }
  .profile-page .identity-card__stats > div { padding: 0; border-left: none; }
  .profile-page .identity-card__stats dd { white-space: normal; }
  .profile-page .identity-card__actions { flex-direction: row; }
  .profile-page .identity-card__actions > * { flex: 1; }
  .profile-page .form-grid--3 { grid-template-columns: minmax(0, 1fr); }
  .profile-page .form-body { padding: 18px 16px 4px; }
  .profile-page .form-body { padding-bottom: 18px; }
  .profile-page .info-card__actions > * { flex: 1; }
}

:global(.dark .profile-page .chip--blood) { background: rgba(239, 83, 80, 0.16); color: #EF9A9A; }

/* ============ Dark mode ============ */
/*
 * Every rule below is anchored on .profile-page, and that is load-bearing.
 * `:global(…)` takes the selector out of the scope system entirely, so
 * `:global(.dark .form-input)` matched .form-input on EVERY page in the app
 * once this route's stylesheet had been fetched — and .form-input, .panel,
 * .btn-outline, .skeleton and .toggle-row are all names the blood-centre
 * pages use too.
 *
 * The descendant form `:global(.dark) .x` is not the fix — this toolchain
 * drops the descendant and emits a bare `.dark { … }`.
 *
 * Kolor: token override ra. Ang nahibilin kay ang dili ma-token: ang
 * color-scheme sa native date picker ug ang chevron sa select (data URI).
 */
:global(.dark .profile-page) {
  --page-bg: var(--ink-page, #0F172A);
  --surface: var(--ink-surface, #1E293B);
  --surface-subtle: var(--ink-inset, #172033);
  --surface-muted: var(--ink-hover, #263449);
  --surface-muted-hover: var(--ink-border, #334155);

  --border: var(--ink-border, #334155);
  --border-subtle: var(--ink-field-border, #2A3850);
  --border-strong: var(--ink-border-hover, #475569);

  --text-primary: var(--ink-text, #F1F5F9);
  /* slate-200: neutral; ang slate-300 kay daw init tan-awon tapad sa asul nga muted text */
  --text-body: var(--ink-text-4, #E2E8F0);
  --text-muted: var(--ink-text-2, #94A3B8);

  --primary: var(--rb-primary);
  --primary-hover: #1976D2;
  --primary-text: var(--rb-primary-text);
  --primary-soft: color-mix(in srgb, var(--rb-primary-text) 14%, transparent);
  --primary-border: color-mix(in srgb, var(--rb-primary-text) 45%, transparent);
  --focus-ring: var(--rb-primary-text);

  --track: var(--ink-border-hover, #475569);

  --success-fg: #66BB6A;
  --success-bg: rgba(102, 187, 106, 0.10);
  --success-border: rgba(102, 187, 106, 0.24);

  --warning-fg: #FDB022;
  --warning-bg: rgba(247, 144, 9, 0.10);
  --warning-border: rgba(247, 144, 9, 0.30);

  --danger-fg: #F97066;
  --danger-text: #FECDCA;
  --danger-bg: rgba(240, 68, 56, 0.10);
  --danger-border: rgba(240, 68, 56, 0.28);

  --shadow-panel: 0 1px 2px rgba(0, 0, 0, 0.3);
  --skeleton-base: var(--ink-surface, #1E293B);
  --skeleton-shine: var(--ink-hover, #263449);
}

:global(.dark .profile-page .form-input) {
  color-scheme: dark;
}

:global(.dark .profile-page select.form-input) {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
}
</style>
