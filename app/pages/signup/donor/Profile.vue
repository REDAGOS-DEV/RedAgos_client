<template>
  <div class="profile-page">
    <div class="header-row fade-in" style="--delay: 0ms">
      <div>
        <h1 class="page-title">My Profile</h1>
        <p class="page-subtitle">Manage your personal and donation information.</p>
      </div>
    </div>

    <div class="main-grid">
      <!-- Left column -->
      <div class="col-left">
        <!-- Avatar + basic info card -->
        <div class="panel fade-in profile-card" style="--delay: 100ms">
          <AvatarUpload
            :current-avatar="user?.avatar"
            :fallback-initial="user?.full_name?.charAt(0) || 'D'"
            @updated="handleAvatarUpdated"
          />
          <h2 class="profile-card__name">{{ user?.full_name }}</h2>
          <p class="profile-card__meta">{{ donorCode }} · {{ bloodType }}</p>
          <p v-if="eligibilityStatus === 'eligible'" class="profile-card__eligible">
            Eligible to donate
          </p>
        </div>

        <!-- Status card -->
        <div class="panel fade-in" style="--delay: 150ms">
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
              <span class="status-row__value" style="color:#2E7D32">{{ nextEligibleLabel }}</span>
            </div>
            <div class="status-row">
              <span class="status-row__label">QR code</span>
              <span
                class="status-row__value"
                :style="{ color: eligibilityStatus === 'eligible' ? '#2E7D32' : '#F57C00' }"
              >
                {{ eligibilityStatus === 'eligible' ? 'Valid' : eligibilityStatus }}
              </span>
            </div>
          </div>

          <div class="status-actions">
            <NuxtLink to="/signup/donor/MyQRCode" class="btn-outline btn-block">View QR Code</NuxtLink>
            <NuxtLink to="/signup/donor/eligibility" class="btn-primary btn-block">Retake Screening</NuxtLink>
          </div>
        </div>

        <!-- Account & Security card -->
        <div class="panel fade-in" style="--delay: 200ms">
          <div class="panel-header panel-header--simple">
            <h2 class="panel-title">Account &amp; Security</h2>
          </div>
          <div class="form-body">
            <div class="form-grid">
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

      <!-- Right column -->
      <div class="col-right">
        <!-- Personal Information -->
        <div class="panel fade-in" style="--delay: 100ms">
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
                <label class="form-label">Address</label>
                <input v-model="profileForm.address" type="text" class="form-input">
              </div>
            </div>

            <div class="form-actions">
              <button class="btn-primary" :disabled="savingProfile" @click="handleProfileSave">
                {{ savingProfile ? 'Saving...' : 'Save changes' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Notification Preferences -->
        <div class="panel fade-in" style="--delay: 150ms">
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
      </div>
    </div>
  </div>
</template>

<script setup>
import AvatarUpload from '~/components/profile/AvatarUpload.vue'

definePageMeta({ 
    middleware: 'auth',
    layout: 'dashboard' })

const router = useRouter()
const { user, fetchUser, updateAvatar, clearUser } = useUser()

const profile = ref(null)
const savingProfile = ref(false)
const savingPassword = ref(false)

const bloodTypeOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const profileForm = reactive({
  first_name: '',
  last_name: '',
  date_of_birth: '',
  blood_type: 'O+',
  contact_number: '',
  email: '',
  address: '',
})

const passwordForm = reactive({
  newPassword: '',
  confirmPassword: '',
})

const notificationPrefs = reactive([
  { key: 'appointment_reminders', label: 'Appointment reminders', description: 'SMS reminder 1 day before your appointment', value: true },
  { key: 'donation_updates', label: 'Donation history updates', description: 'Notify when a donation record is added', value: true },
  { key: 'blood_drive_announcements', label: 'Blood drive announcements', description: 'Notify about nearby upcoming drives', value: true },
])

async function load() {
  if (!user.value) await fetchUser()

  try {
    // IMPORTANTE: kini nga endpoint dapat mo-return sa TINUOD nga
    // data nga gi-submit sa authenticated user pag-register — dili demo/mock.
    // Backend contract: GET /api/donor-profile/me
    // Response fields: donor_code, blood_type, total_donations,
    // last_donation_date, next_eligible_date, eligibility_status,
    // first_name, last_name, date_of_birth, contact_number, address
    const res = await $fetch('/api/donor-profile/me')
    profile.value = res

    // Ang matag field diri kay direkta gikan sa registration data sa user
    profileForm.first_name = res.first_name || ''
    profileForm.last_name = res.last_name || ''
    profileForm.date_of_birth = res.date_of_birth || ''
    profileForm.blood_type = res.blood_type || 'O+'
    profileForm.contact_number = res.contact_number || ''
    profileForm.email = user.value?.email || ''
    profileForm.address = res.address || ''
  } catch (err) {
    console.error('Failed to load profile:', err)
  }
}

onMounted(load)

const donorCode = computed(() => profile.value?.donor_code || '—')
const bloodType = computed(() => profile.value?.blood_type || '—')
const totalDonations = computed(() => profile.value?.total_donations ?? 0)
const eligibilityStatus = computed(() => profile.value?.eligibility_status || 'pending')

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const lastDonationDate = computed(() => formatDate(profile.value?.last_donation_date))
const nextEligibleLabel = computed(() => {
  if (!profile.value?.next_eligible_date) return '—'
  const next = new Date(profile.value.next_eligible_date)
  return next <= new Date() ? 'Now' : formatDate(profile.value.next_eligible_date)
})

function handleAvatarUpdated(newUrl) {
  updateAvatar(newUrl)
}

async function handleProfileSave() {
  savingProfile.value = true
  try {
    // Backend contract: PUT /api/donor-profile/me
    // Body: { first_name, last_name, date_of_birth, blood_type, contact_number, email, address }
    // Kini mag-UPDATE sa existing row sa user, dili mag-create og bag-o
    await $fetch('/api/donor-profile/me', {
      method: 'PUT',
      body: { ...profileForm },
    })
  } catch (err) {
    console.error('Failed to save profile:', err)
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
    await $fetch('/api/profile/password', {
      method: 'POST',
      body: { password: passwordForm.newPassword },
    })
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (err) {
    console.error('Failed to update password:', err)
  } finally {
    savingPassword.value = false
  }
}

async function handleLogout() {
  try {
    // await $fetch('/api/logout', { method: 'POST' })
    clearUser()
    router.push('/login')
  } catch (err) {
    console.error(err)
  }
}
</script>

<style scoped>
.profile-page {
  --primary: #1565c0;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --text-primary: #1f2937;
  --text-secondary: #9ca3af;
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  display: flex;
  background: #F5F7FA;
  flex-direction: column;
  gap: 20px;
}

.header-row { display: flex; align-items: flex-start; justify-content: space-between; }
.page-title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--text-secondary); margin: 2px 0 0; }

.fade-in {
  animation: fadeInUp 0.5s ease both;
  animation-delay: var(--delay, 0ms);
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.main-grid { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: start; }
.col-left, .col-right { display: flex; flex-direction: column; gap: 20px; }

.panel {
  background: white;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
  border: 1px solid #eef0f3;
  overflow: hidden;
}
.panel-header--simple { padding: 16px 20px; border-bottom: 1px solid #f3f4f6; }
.panel-title { font-weight: 700; font-size: 14px; color: var(--text-primary); margin: 0; }

/* Profile card */
.profile-card {
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2px;
}
.profile-card__name { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 12px 0 0; }
.profile-card__meta { font-size: 12.5px; color: var(--text-secondary); margin: 2px 0 0; }
.profile-card__eligible {
  font-size: 12.5px; font-weight: 700; color: var(--success);
  margin: 8px 0 0;
}

/* Status list */
.status-list { padding: 4px 20px 8px; }
.status-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid #f9fafb;
  font-size: 13px;
}
.status-row:last-child { border-bottom: none; }
.status-row__label { color: var(--text-secondary); }
.status-row__value { font-weight: 700; color: var(--text-primary); }

.status-actions { display: flex; flex-direction: column; gap: 10px; padding: 14px 20px 20px; }

/* Buttons */
.btn-primary {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 700;
  color: white; background: var(--primary); border: none; cursor: pointer;
  transition: opacity 0.15s ease;
}
.btn-primary:hover:not(:disabled) { opacity: 0.92; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-outline {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 700;
  color: var(--text-primary); background: #f3f4f6; border: none; cursor: pointer;
  text-decoration: none; transition: background 0.15s ease;
}
.btn-outline:hover { background: #e5e7eb; }

.btn-block { width: 100%; }

/* Forms */
.form-body { padding: 20px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-field--full { grid-column: 1 / -1; }
.form-label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }
.form-input {
  width: 100%; padding: 9px 12px; border-radius: 8px;
  border: 1px solid #e5e7eb; font-size: 13px; color: var(--text-primary);
  background: white; transition: border-color 0.15s ease;
}
.form-input:focus { outline: none; border-color: var(--primary); }
.form-actions { display: flex; gap: 10px; margin-top: 18px; }
.form-actions .btn-primary { padding: 10px 20px; }

/* Toggle switches */
.toggle-list { padding: 6px 20px 20px; display: flex; flex-direction: column; }
.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 0; border-bottom: 1px solid #f9fafb; gap: 16px;
}
.toggle-row:last-child { border-bottom: none; }
.toggle-row__label { font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 0; }
.toggle-row__desc { font-size: 12px; color: var(--text-secondary); margin: 2px 0 0; }

.toggle-switch {
  position: relative;
  width: 40px; height: 22px; border-radius: 999px;
  background: #e5e7eb; border: none; cursor: pointer; flex-shrink: 0;
  transition: background 0.2s ease;
}
.toggle-switch--on { background: var(--primary); }
.toggle-switch__knob {
  position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; border-radius: 999px; background: white;
  box-shadow: 0 1px 2px rgba(0,0,0,0.15);
  transition: transform 0.2s ease;
}
.toggle-switch--on .toggle-switch__knob { transform: translateX(18px); }

@media (max-width: 900px) {
  .main-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .profile-page { padding: 16px 16px 32px; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>