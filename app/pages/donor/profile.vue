<template>
  <div class="profile-page">
    <div class="header-row">
      <div>
        <h1 class="page-title">Your donor profile</h1>
        <p class="page-subtitle">View and update your personal information, contact details, and donor profile.</p>
      </div>
    </div>

    <!-- Skeleton state -->
    <div v-if="loading" class="main-grid">
      <div class="col-left">
        <div class="panel profile-card">
          <div class="skeleton skeleton-avatar" />
          <div class="skeleton skeleton-line" style="width:140px;height:16px;margin-top:14px" />
          <div class="skeleton skeleton-line" style="width:100px;height:12px;margin-top:8px" />
        </div>

        <div class="panel">
          <div class="panel-header panel-header--simple">
            <div class="skeleton skeleton-line" style="width:70px;height:14px" />
          </div>
          <div class="status-list">
            <div v-for="n in 4" :key="n" class="status-row">
              <div class="skeleton skeleton-line" style="width:110px;height:12px" />
              <div class="skeleton skeleton-line" style="width:60px;height:12px" />
            </div>
          </div>
          <div class="status-actions">
            <div class="skeleton skeleton-btn" />
            <div class="skeleton skeleton-btn" />
          </div>
        </div>

        <div class="panel">
          <div class="panel-header panel-header--simple">
            <div class="skeleton skeleton-line" style="width:80px;height:14px" />
          </div>
          <div class="form-body">
            <div class="form-grid">
              <div class="form-field">
                <div class="skeleton skeleton-line" style="width:60px;height:11px;margin-bottom:8px" />
                <div class="skeleton skeleton-input" />
              </div>
              <div class="form-field">
                <div class="skeleton skeleton-line" style="width:70px;height:11px;margin-bottom:8px" />
                <div class="skeleton skeleton-input" />
              </div>
            </div>
            <div class="form-actions">
              <div class="skeleton skeleton-btn" style="width:100px" />
            </div>
          </div>
        </div>
      </div>

      <div class="col-right">
        <div class="panel">
          <div class="panel-header panel-header--simple">
            <div class="skeleton skeleton-line" style="width:150px;height:14px" />
          </div>
          <div class="form-body">
            <div class="form-grid">
              <div v-for="n in 6" :key="n" class="form-field">
                <div class="skeleton skeleton-line" style="width:80px;height:11px;margin-bottom:8px" />
                <div class="skeleton skeleton-input" />
              </div>
              <div class="form-field form-field--full">
                <div class="skeleton skeleton-line" style="width:70px;height:11px;margin-bottom:8px" />
                <div class="skeleton skeleton-input" />
              </div>
            </div>
            <div class="form-actions">
              <div class="skeleton skeleton-btn" style="width:130px" />
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header panel-header--simple">
            <div class="skeleton skeleton-line" style="width:180px;height:14px" />
          </div>
          <div class="toggle-list">
            <div v-for="n in 3" :key="n" class="toggle-row">
              <div style="flex:1">
                <div class="skeleton skeleton-line" style="width:160px;height:13px" />
                <div class="skeleton skeleton-line" style="width:220px;height:11px;margin-top:8px" />
              </div>
              <div class="skeleton" style="width:40px;height:22px;border-radius:999px" />
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header panel-header--simple">
            <div class="skeleton skeleton-line" style="width:160px;height:14px" />
          </div>
          <div class="form-body">
            <div class="form-grid">
              <div class="form-field form-field--full">
                <div class="skeleton skeleton-line" style="width:110px;height:11px;margin-bottom:8px" />
                <div class="skeleton skeleton-input" />
              </div>
              <div class="form-field">
                <div class="skeleton skeleton-line" style="width:90px;height:11px;margin-bottom:8px" />
                <div class="skeleton skeleton-input" />
              </div>
              <div class="form-field">
                <div class="skeleton skeleton-line" style="width:90px;height:11px;margin-bottom:8px" />
                <div class="skeleton skeleton-input" />
              </div>
            </div>
            <div class="form-actions">
              <div class="skeleton skeleton-btn" style="width:140px" />
              <div class="skeleton skeleton-btn" style="width:90px" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loaded state -->
    <div v-else class="main-grid">
      <!-- Left column -->
      <div class="col-left">
        <!-- Avatar + basic info card -->
        <div class="panel profile-card">
          <AvatarUpload
            :current-avatar="user?.avatar"
            :fallback-initial="initials"
            @updated="handleAvatarUpdated"
          />
          <h2 class="profile-card__name">{{ displayName }}</h2>
          <p class="profile-card__meta">{{ donorCode }} · {{ bloodType }}</p>
          <!-- Answered, not "eligible": the centre decides that at the counter. -->
          <p v-if="qrValid" class="profile-card__eligible">
            Screening complete
          </p>
        </div>

        <!-- Status card -->
        <div class="panel">
          <div class="panel-header panel-header--simple">
            <h2 class="panel-title">Status</h2>
          </div>
          <div class="status-list">
            <div class="status-row">
              <span class="status-row__label">Total donations</span>
              <span class="status-row__value">{{ totalDonations }}</span>
            </div>
            <div class="status-row">
              <span class="status-row__label">Last donation</span>
              <span class="status-row__value">{{ lastDonationDate }}</span>
            </div>
            <div class="status-row">
              <span class="status-row__label">Next eligible</span>
              <span class="status-row__value status-row__value--success">{{ nextEligibleLabel }}</span>
            </div>
            <div class="status-row">
              <span class="status-row__label">Valid ID</span>
              <span class="status-row__value" :class="`status-row__value--${identityStatusTone}`">
                {{ identityStatusLabel }}
              </span>
            </div>
            <div class="status-row">
              <span class="status-row__label">QR code</span>
              <span
                class="status-row__value"
                :class="qrValid ? 'status-row__value--success' : 'status-row__value--warning'"
              >
                {{ qrLabel }}
              </span>
            </div>
          </div>

          <div class="status-actions">
            <NuxtLink to="/donor/qrcode" class="btn-outline btn-block">View QR Code</NuxtLink>
            <NuxtLink to="/donor/eligibility" class="btn-primary btn-block">Retake Screening</NuxtLink>
          </div>
        </div>

        <!-- Valid ID card — bumped above Account & Security: verification is
             the more time-sensitive of the two (gates donating), password
             changes aren't. -->
        <div class="panel">
          <IdentityVerification :identity="identity" @submitted="handleIdentitySubmitted" />
        </div>
      </div>

      <!-- Right column -->
      <div class="col-right">
        <!-- Personal Information -->
        <div class="panel">
          <div class="panel-header panel-header--simple">
            <h2 class="panel-title">Personal Information</h2>
          </div>
          <div class="form-body">
            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">First name</label>
                <input v-model="profileForm.first_name" type="text" class="form-input">
              </div>
              <div class="form-field">
                <label class="form-label">Last name</label>
                <input v-model="profileForm.last_name" type="text" class="form-input">
              </div>
              <div class="form-field">
                <label class="form-label">Date of birth</label>
                <input v-model="profileForm.date_of_birth" type="date" class="form-input">
              </div>
              <div class="form-field">
                <label class="form-label">Blood type</label>
                <select v-model="profileForm.blood_type" class="form-input">
                  <option value="">Not known yet</option>
                  <option v-for="bt in bloodTypeOptions" :key="bt" :value="bt">{{ bt }}</option>
                </select>
              </div>
              <div class="form-field">
                <label class="form-label">Contact number</label>
                <input v-model="profileForm.contact_number" type="text" class="form-input">
              </div>
              <div class="form-field">
                <label class="form-label">Email address</label>
                <input v-model="profileForm.email" type="email" class="form-input">
              </div>
              <div class="form-field form-field--full">
                <label class="form-label">Home address</label>
                <input v-model="profileForm.address" type="text" class="form-input">
              </div>

              <!--
                Section I-A of the DOH questionnaire. All optional: donors who
                registered before these were collected cannot be back-filled,
                and the blood centre prints what is missing as "Not provided"
                rather than as a blank line on the form.
              -->
              <div class="form-field">
                <label class="form-label">Middle name</label>
                <input v-model="profileForm.middle_name" type="text" class="form-input">
              </div>
              <div class="form-field">
                <label class="form-label">Civil status</label>
                <select v-model="profileForm.civil_status" class="form-input">
                  <option value="">Select</option>
                  <option v-for="option in civilStatusOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>
              <div class="form-field">
                <label class="form-label">Occupation</label>
                <input v-model="profileForm.occupation" type="text" class="form-input">
              </div>
              <div class="form-field">
                <label class="form-label">Nationality</label>
                <input v-model="profileForm.nationality" type="text" class="form-input">
              </div>
              <div class="form-field">
                <label class="form-label">Religion <span class="form-optional">optional</span></label>
                <input v-model="profileForm.religion" type="text" class="form-input">
              </div>
              <div class="form-field">
                <label class="form-label">Telephone no.</label>
                <input v-model="profileForm.telephone_no" type="text" class="form-input">
              </div>
              <div class="form-field form-field--full">
                <label class="form-label">Office address</label>
                <input v-model="profileForm.office_address" type="text" class="form-input">
              </div>

              <div class="form-field form-field--full">
                <p class="form-section-label">Contact person (other relative/s)</p>
              </div>
              <div class="form-field">
                <label class="form-label">Name</label>
                <input v-model="profileForm.contact_person_name" type="text" class="form-input">
              </div>
              <div class="form-field">
                <label class="form-label">Contact number</label>
                <input v-model="profileForm.contact_person_number" type="text" class="form-input">
              </div>
              <div class="form-field form-field--full">
                <label class="form-label">Address</label>
                <input v-model="profileForm.contact_person_address" type="text" class="form-input">
              </div>
            </div>

            <div class="form-actions">
              <button class="btn-primary" :disabled="savingProfile" @click="handleProfileSave">
                {{ savingProfile ? 'Saving...' : 'Save changes' }}
              </button>
              <!--
                Kung mausab ang email, i-revoke sa server ang verification ug
                mo-send og bag-ong link. Kinahanglan makita ni sa donor, kay
                mo-undang ang QR ug booking hangtod dili pa siya ma-verify.
              -->
              <p
                v-if="profileMessage"
                class="form-status"
                :class="{ 'form-status--error': profileFailed }"
              >
                {{ profileMessage }}
              </p>
            </div>
          </div>
        </div>

        <!-- Notification Preferences -->
        <div class="panel">
          <div class="panel-header panel-header--simple">
            <h2 class="panel-title">Notification preferences</h2>
          </div>
          <div class="toggle-list">
            <div v-for="pref in notificationPrefs" :key="pref.key" class="toggle-row">
              <div>
                <p class="toggle-row__label">{{ pref.label }}</p>
                <p class="toggle-row__desc">{{ pref.description }}</p>
              </div>
              <button
                class="toggle-switch"
                :class="{ 'toggle-switch--on': pref.value }"
                @click="pref.value = !pref.value"
              >
                <span class="toggle-switch__knob" />
              </button>
            </div>
          </div>
        </div>

        <!-- Account & Security card -->
        <div class="panel">
          <div class="panel-header panel-header--simple">
            <h2 class="panel-title">Account &amp; Security</h2>
          </div>
          <div class="form-body">
            <div class="form-grid">
              <div class="form-field form-field--full">
                <label class="form-label">Current Password</label>
                <input v-model="passwordForm.currentPassword" type="password" class="form-input" placeholder="current password">
              </div>
              <div class="form-field">
                <label class="form-label">New Password</label>
                <input v-model="passwordForm.newPassword" type="password" class="form-input" placeholder="new password">
              </div>
              <div class="form-field">
                <label class="form-label">Confirm Password</label>
                <input v-model="passwordForm.confirmPassword" type="password" class="form-input" placeholder="confirm password">
              </div>
            </div>
            <div class="form-actions">
              <button class="btn-primary" :disabled="savingPassword" @click="handlePasswordUpdate">
                {{ savingPassword ? 'Updating...' : 'Update Password' }}
              </button>
              <button class="btn-outline" @click="handleLogout">Log out</button>
            </div>
          </div>
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

import AvatarUpload from '~/components/profile/AvatarUpload.vue'
import IdentityVerification from '~/components/profile/IdentityVerification.vue'
import { donorService } from '~/api/donor/DonorService'


const router = useRouter()
const { user, fetchUser, updateAvatar, logout } = useUser()

const profile = ref(null)
const loading = ref(true)
const savingProfile = ref(false)
const profileMessage = ref('')
const profileFailed = ref(false)
const savingPassword = ref(false)

const bloodTypeOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

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

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const notificationPrefs = reactive([
  { key: 'appointment_reminders', label: 'Appointment reminders', description: 'SMS reminder 1 day before your appointment', value: true },
  { key: 'donation_updates', label: 'Donation history updates', description: 'Notify when a donation record is added', value: true },
  { key: 'blood_drive_announcements', label: 'Blood drive announcements', description: 'Notify about nearby upcoming drives', value: true },
])

// Gi-keepalive ni nga page, so mabuhi ang gi-fill na nga form kung mo-navigate
// palayo ang donor. Busa ang background refresh dili gyud angay mo-overwrite sa
// wala pa ma-save nga edits: gi-snapshot nato ang form matag load, ug kung lahi
// na siya karon, ang read-only nga cards ra ang i-update.
let loadedOnce = false
let formSnapshot = ''

const snapshotForm = () => JSON.stringify({ ...profileForm })

async function load({ silent = false } = {}) {
  if (!silent) loading.value = true
  try {
    if (!user.value) await fetchUser()

    const res = await donorService.profile()
    profile.value = res

    if (silent && snapshotForm() !== formSnapshot) return

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
    formSnapshot = snapshotForm()
  } catch (err) {
    console.error('Failed to load profile:', err)
  } finally {
    loading.value = false
    loadedOnce = true
  }
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
    formSnapshot = snapshotForm()
    await fetchUser()
  } catch (err) {
    console.error('Failed to save profile:', err)
    profileFailed.value = true
    profileMessage.value = err?.message || 'Could not save your profile. Please try again.'
  } finally {
    savingProfile.value = false
  }
}

async function handlePasswordUpdate() {
  if (!passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword) {
    alert('Passwords do not match.')
    return
  }

  savingPassword.value = true
  try {
    // Backend contract: POST /api/profile/password
    // Body: { password: string }
    await donorService.updatePassword({
      current_password: passwordForm.currentPassword,
      password: passwordForm.newPassword,
      password_confirmation: passwordForm.confirmPassword,
    })
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (err) {
    console.error('Failed to update password:', err)
  } finally {
    savingPassword.value = false
  }
}

async function handleLogout() {
  await logout('/auth/donor/login')
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
  --primary: #1565C0;
  --primary-hover: #0D47A1;
  --primary-text: #1565C0;
  --primary-soft: #E3EEFA;
  --primary-border: #90CAF9;
  --focus-ring: #1565C0;

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
.profile-page .page-title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0; }
.profile-page .page-subtitle { font-size: 13px; color: var(--text-secondary); margin: 2px 0 0; }

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
.profile-page .panel-title { font-weight: 700; font-size: 14px; color: var(--text-primary); margin: 0; }

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
.profile-page .profile-card__name { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 12px 0 0; }
.profile-page .profile-card__meta { font-size: 12.5px; color: var(--text-secondary); margin: 2px 0 0; }
.profile-page .profile-card__eligible {
  font-size: 12.5px; font-weight: 700; color: var(--success-fg);
  margin: 8px 0 0;
}

/* Status list */
.profile-page .status-list { padding: 4px 20px 8px; }
.profile-page .status-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid var(--border-subtle);
  font-size: 13px;
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
  padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 700;
  color: #FFFFFF; background: var(--primary); border: none; cursor: pointer;
  text-decoration: none;
  transition: background-color 0.15s ease;
}
.profile-page .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
.profile-page .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.profile-page .btn-outline {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 700;
  color: var(--text-primary); background: var(--surface-muted); border: none; cursor: pointer;
  text-decoration: none; transition: background 0.15s ease;
}
.profile-page .btn-outline:hover { background: var(--surface-muted-hover); }

.profile-page .btn-block { width: 100%; }

/* Forms */
.profile-page .form-body { padding: 20px; }
.profile-page .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.profile-page .form-field--full { grid-column: 1 / -1; }
.profile-page .form-label { display: block; font-size: 12px; font-weight: 600; color: var(--text-body); margin-bottom: 6px; }
.profile-page .form-input {
  width: 100%; padding: 9px 12px; border-radius: 8px;
  border: 1px solid var(--border); font-size: 13px; color: var(--text-primary);
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
  font-size: 12px;
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
.profile-page .form-status { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--success-fg); }
.profile-page .form-status--error { color: var(--danger-fg); }

/* Toggle switches */
.profile-page .toggle-list { padding: 6px 20px 20px; display: flex; flex-direction: column; }
.profile-page .toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 0; border-bottom: 1px solid var(--border-subtle); gap: 16px;
}
.profile-page .toggle-row:last-child { border-bottom: none; }
.profile-page .toggle-row__label { font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 0; }
.profile-page .toggle-row__desc { font-size: 12px; color: var(--text-secondary); margin: 2px 0 0; }

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
  --page-bg: #0F172A;
  --surface: #1E293B;
  --surface-subtle: #172033;
  --surface-muted: #263449;
  --surface-muted-hover: #334155;

  --border: #334155;
  --border-subtle: #2A3850;
  --border-strong: #475569;

  --text-primary: #F1F5F9;
  /* slate-200: neutral; ang slate-300 kay daw init tan-awon tapad sa asul nga muted text */
  --text-body: #E2E8F0;
  --text-muted: #94A3B8;

  --primary: #1565C0;
  --primary-hover: #1976D2;
  --primary-text: #64B5F6;
  --primary-soft: rgba(100, 181, 246, 0.14);
  --primary-border: rgba(100, 181, 246, 0.45);
  --focus-ring: #64B5F6;

  --track: #475569;

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
  --skeleton-base: #1E293B;
  --skeleton-shine: #263449;
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
