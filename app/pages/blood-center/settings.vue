<template>
  <div class="settings-page">
    <div v-if="loading" class="loading-wrap">
      <div class="spinner" />
    </div>

    <div v-else class="settings-inner">
      <!-- Header -->
      <div class="header-banner">
        <div class="header-banner__content">
          <h1 class="page-title">Account Settings</h1>
          <p class="page-subtitle">Manage your profile, security, and preferences</p>
        </div>
      </div>

      <div class="settings-layout">
        <!-- Nav -->
        <nav class="settings-nav">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="nav-item"
            :class="{ 'nav-item--active': activeTab === tab.id }"
          @click="activeTab = tab.id"
          >
            <span class="nav-item__icon" :class="`nav-item__icon--${tab.id}`">
              <AssetIcon :name="tab.icon" :size="16" />
            </span>
            <span>{{ tab.label }}</span>
            <span v-if="activeTab === tab.id" class="nav-item__drop" aria-hidden="true" />
          </button>
        </nav>

        <!-- Content -->
        <div class="settings-content">
          <!-- MY PROFILE -->
          <section v-if="activeTab === 'profile'" class="settings-panel">
            <div class="panel-header-row">
              <div class="panel-heading">
                <span class="panel-icon-badge panel-icon-badge--blue">
                  <AssetIcon name="user" :size="18" />
                </span>
                <div>
                  <h2 class="panel-title">My Profile</h2>
                  <p class="panel-subtitle">Your personal information as it appears across RedAgos.</p>
                </div>
              </div>
              <button v-if="!editingProfile" type="button" class="btn-outline-blue" @click="startEditProfile">
                <AssetIcon name="pencil" :size="14" /> Edit Profile
              </button>
            </div>

            <div class="avatar-row">
              <div class="avatar-ring">
                <div class="avatar-circle" :style="{ background: avatarColor }">
                  <img v-if="profileForm.avatarUrl" :src="profileForm.avatarUrl" alt="Profile picture" />
                  <span v-else>{{ initials(profileForm.fullName) }}</span>
                </div>
                <label v-if="editingProfile" class="avatar-camera-btn">
                  <AssetIcon name="camera" :size="14" />
                  <input type="file" accept="image/*" class="avatar-upload-input" @change="onAvatarChange" />
                </label>
              </div>
              <div v-if="editingProfile" class="avatar-actions">
                <p class="avatar-name">Profile photo</p>
                <p class="avatar-hint">JPG or PNG, max 2MB. Click the camera icon to change it.</p>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Full Name</label>
                <div class="input-icon-wrap">
                  <AssetIcon name="user" :size="15" class="input-icon" />
                  <input v-model="profileForm.fullName" type="text" class="form-input form-input--icon" :disabled="!editingProfile" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Employee ID</label>
                <div class="input-icon-wrap">
                  <AssetIcon name="id-card" :size="15" class="input-icon" />
                  <input :value="profileForm.employeeId" type="text" class="form-input form-input--icon" disabled />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Blood Center</label>
                <div class="input-icon-wrap">
                  <AssetIcon name="droplets" :size="15" class="input-icon" />
                  <input :value="profileForm.bloodCenter" type="text" class="form-input form-input--icon" disabled />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Position / Role</label>
                <div class="input-icon-wrap">
                  <AssetIcon name="briefcase" :size="15" class="input-icon" />
                  <select
                    v-model="profileForm.position"
                    class="form-input form-input--icon form-select"
                    :disabled="!editingProfile"
                  >
                    <option v-for="opt in positionOptions" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                  <AssetIcon name="chevron-down" :size="15" class="select-caret" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <div class="input-icon-wrap">
                  <AssetIcon name="mail" :size="15" class="input-icon" />
                  <input v-model="profileForm.email" type="email" class="form-input form-input--icon" :disabled="!editingProfile" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Contact Number</label>
                <div class="input-icon-wrap">
                  <AssetIcon name="phone" :size="15" class="input-icon" />
                  <input v-model="profileForm.contactNumber" type="tel" class="form-input form-input--icon" :disabled="!editingProfile" />
                </div>
              </div>
            </div>

            <p v-if="profileError" class="field-error"><AssetIcon name="x" :size="13" /> {{ profileError }}</p>
            <p v-if="profileSuccess" class="field-success"><AssetIcon name="check" :size="13" /> {{ profileSuccess }}</p>

            <div v-if="editingProfile" class="panel-actions">
              <button type="button" class="btn-cancel" @click="cancelEditProfile">Cancel</button>
              <button type="button" class="btn-primary" :disabled="savingProfile" @click="saveProfile">
                {{ savingProfile ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </section>

          <!-- SECURITY -->
          <section v-if="activeTab === 'security'" class="settings-panel">
            <div class="panel-heading">
              <span class="panel-icon-badge panel-icon-badge--red">
                <AssetIcon name="lock" :size="18" />
              </span>
              <div>
                <h2 class="panel-title">Security</h2>
                <p class="panel-subtitle">Update your password. You'll stay signed in on this device.</p>
              </div>
            </div>

            <div class="form-grid form-grid--single">
              <div class="form-group">
                <label class="form-label">Current Password</label>
                <div class="password-input-wrap">
                  <input
                    v-model="passwordForm.current"
                    :type="showCurrent ? 'text' : 'password'"
                    class="form-input"
                    placeholder="Enter current password"
                  />
                  <button type="button" class="password-toggle" @click="showCurrent = !showCurrent">
                    <AssetIcon :name="showCurrent ? 'eye-off' : 'eye'" :size="16" />
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">New Password</label>
                <div class="password-input-wrap">
                  <input
                    v-model="passwordForm.new"
                    :type="showNew ? 'text' : 'password'"
                    class="form-input"
                    placeholder="At least 8 characters"
                  />
                  <button type="button" class="password-toggle" @click="showNew = !showNew">
                    <AssetIcon :name="showNew ? 'eye-off' : 'eye'" :size="16" />
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Confirm Password</label>
                <div class="password-input-wrap">
                  <input
                    v-model="passwordForm.confirm"
                    :type="showConfirm ? 'text' : 'password'"
                    class="form-input"
                    placeholder="Re-enter new password"
                  />
                  <button type="button" class="password-toggle" @click="showConfirm = !showConfirm">
                    <AssetIcon :name="showConfirm ? 'eye-off' : 'eye'" :size="16" />
                  </button>
                </div>
              </div>
            </div>

            <p v-if="passwordError" class="field-error"><AssetIcon name="x" :size="13" /> {{ passwordError }}</p>
            <p v-if="passwordSuccess" class="field-success"><AssetIcon name="check" :size="13" /> {{ passwordSuccess }}</p>

            <div class="panel-actions">
              <button type="button" class="btn-primary" :disabled="updatingPassword" @click="updatePassword">
                {{ updatingPassword ? 'Updating...' : 'Update Password' }}
              </button>
            </div>
          </section>

          <!-- NOTIFICATION PREFERENCES -->
          <section v-if="activeTab === 'notifications'" class="settings-panel">
            <div class="panel-heading">
              <span class="panel-icon-badge panel-icon-badge--orange">
                <AssetIcon name="bell" :size="18" />
              </span>
              <div>
                <h2 class="panel-title">Notification Preferences</h2>
                <p class="panel-subtitle">Choose what you want to be notified about.</p>
              </div>
            </div>

            <div class="toggle-list">
              <div v-for="pref in notificationPrefs" :key="pref.key" class="toggle-row">
                <div>
                  <p class="toggle-row__label">{{ pref.label }}</p>
                  <p class="toggle-row__desc">{{ pref.description }}</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="pref.enabled" @change="saveNotificationPref(pref)" />
                  <span class="toggle-switch__track"></span>
                </label>
              </div>
            </div>

            <p v-if="notifSaveError" class="field-error"><AssetIcon name="x" :size="13" /> {{ notifSaveError }}</p>
          </section>

          <!-- SESSION MANAGEMENT -->
          <section v-if="activeTab === 'sessions'" class="settings-panel">
            <div class="panel-heading">
              <span class="panel-icon-badge panel-icon-badge--purple">
                <AssetIcon name="monitor" :size="18" />
              </span>
              <div>
                <h2 class="panel-title">Session Management</h2>
                <p class="panel-subtitle">Devices currently signed in to your account.</p>
              </div>
            </div>

            <div class="session-card session-card--current">
              <div class="session-card__icon">
                <AssetIcon name="monitor" :size="18" />
              </div>
              <div class="session-card__body">
                <p class="session-card__title">Current Device</p>
                <p class="session-card__meta">{{ currentSession.os }} &middot; {{ currentSession.browser }}</p>
                <p class="session-card__time">Logged in {{ currentSession.loggedInLabel }}</p>
              </div>
              <span class="session-badge"><AssetIcon name="check" :size="11" /> This device</span>
            </div>

            <div class="panel-actions panel-actions--start">
              <button type="button" class="btn-outline-red" @click="confirmLogoutOthers = true">
                <AssetIcon name="log-out" :size="14" /> Log Out Other Devices
              </button>
            </div>

            <p v-if="sessionMessage" class="field-success"><AssetIcon name="check" :size="13" /> {{ sessionMessage }}</p>
          </section>

          <!-- ACCOUNT INFORMATION -->
          <section v-if="activeTab === 'account'" class="settings-panel">
            <div class="panel-heading">
              <span class="panel-icon-badge panel-icon-badge--teal">
                <AssetIcon name="info" :size="18" />
              </span>
              <div>
                <h2 class="panel-title">Account Information</h2>
                <p class="panel-subtitle">Read-only details about your account.</p>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-row"><span>Username</span><strong>{{ accountInfo.username }}</strong></div>
              <div class="info-row"><span>Role</span><strong>{{ accountInfo.role }}</strong></div>
              <div class="info-row"><span>Blood Center</span><strong>{{ accountInfo.bloodCenter }}</strong></div>
              <div class="info-row"><span>Created At</span><strong>{{ accountInfo.createdAt }}</strong></div>
              <div class="info-row"><span>Last Login</span><strong>{{ accountInfo.lastLogin }}</strong></div>
              <div class="info-row">
                <span>Account Status</span>
                <span class="status-badge" :class="`status-badge--${(accountInfo.status || '').toLowerCase()}`">{{ accountInfo.status }}</span>
              </div>
            </div>
          </section>

          <!-- APPEARANCE -->
          <section v-if="activeTab === 'appearance'" class="settings-panel">
            <div class="panel-heading">
              <span class="panel-icon-badge panel-icon-badge--indigo">
                <AssetIcon name="palette" :size="18" />
              </span>
              <div>
                <h2 class="panel-title">Appearance</h2>
                <p class="panel-subtitle">Choose how RedAgos looks on this device.</p>
              </div>
            </div>

            <div class="theme-options">
              <button
                v-for="opt in themeOptions"
                :key="opt.value"
                type="button"
                class="theme-card"
                :class="{ 'theme-card--active': theme === opt.value }"
                @click="selectTheme(opt.value)"
              >
                <div class="theme-card__preview" :class="`theme-card__preview--${opt.value}`">
                  <span class="theme-card__bar" />
                  <span class="theme-card__line theme-card__line--1" />
                  <span class="theme-card__line theme-card__line--2" />
                  <AssetIcon :name="opt.icon" :size="16" />
                </div>
                <span class="theme-card__label">{{ opt.label }}</span>
                <span v-if="theme === opt.value" class="theme-card__check">
                  <AssetIcon name="check" :size="12" />
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- confirm log out -->
    <Transition name="modal">
      <div v-if="confirmLogoutOthers" class="modal-overlay" @click.self="confirmLogoutOthers = false">
        <div class="modal-card">
          <div class="modal-card__header">
            <div class="modal-card__heading">
              <span class="modal-card__icon"><AssetIcon name="log-out" :size="16" /></span>
              <h2 class="modal-card__title">Log Out Other Devices?</h2>
            </div>
            <button type="button" class="modal-card__close" @click="confirmLogoutOthers = false">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>
          <div class="modal-form">
            <p class="modal-subtitle">
              This will sign you out from all devices except this one. You'll need to log in again on those devices.
            </p>
            <div class="modal-actions">
              <button type="button" class="btn-cancel" @click="confirmLogoutOthers = false">Cancel</button>
              <button type="button" class="btn-outline-red" :disabled="loggingOutOthers" @click="logoutOtherDevices">
                {{ loggingOutOthers ? 'Logging out...' : 'Yes, Log Out Others' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { authService } from '~/api/auth/AuthService'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'

definePageMeta({
  middleware: 'auth',
  layout: 'blood-centerdashboard',
})

/**
 * NOTE ON API SHAPE
 * -------------------------------------------------------------------------
 * Mirrors the $fetch contract used in MobileDrives.vue / Appointments.vue / Requests.vue.
 * Adjust paths below to match your actual backend routes.
 *
 *  GET  /api/bloodcenter/settings
 *    -> {
 *         profile: { avatarUrl, fullName, employeeId, bloodCenter, position, email, contactNumber },
 *         accountInfo: { username, role, bloodCenter, createdAt, lastLogin, status },
 *         currentSession: { os, browser, loggedInLabel },
 *         notificationPrefs: [{ key, label, description, enabled }],
 *         theme: 'light' | 'dark' | 'system'
 *       }
 *
 *  PUT  /api/bloodcenter/settings/profile        { fullName, email, contactNumber, avatarUrl }
 *    -> updated profile object
 *
 *  PUT  /api/bloodcenter/settings/password        { current, new }
 *    -> { success: true }
 *
 *  PUT  /api/bloodcenter/settings/notifications   { key, enabled }
 *    -> { success: true }
 *
 *  POST /api/bloodcenter/settings/sessions/logout-others
 *    -> { success: true }
 *
 *  PUT  /api/bloodcenter/settings/appearance      { theme }
 *    -> { success: true }
 * -------------------------------------------------------------------------
 */

/**
 * Settings API.
 *
 * Walay `/blood-center/settings` nga route ang Laravel. Ang naa kay
 * `/blood-center/profile` ug `/blood-center/password` — mao nay gamiton dinhi,
 * agi sa service aron madala ang bearer token. (Ang daan nga raw `$fetch`
 * padulong sa `/api/...` kay nagsalig sa dev proxy nga wala sa gi-build nga app.)
 */
const api = {
  getSettings: () => bloodCenterService.profile(),
  updateProfile: (body) => bloodCenterService.updateProfile(body),
  updatePassword: (body) => bloodCenterService.updatePassword(body),

  // `/logout-all` mo-revoke sa TANAN nga token — apil ang gigamit karon — so
  // ma-sign-out pod ang device nga nag-klik. Mao nay tinuod nga buhat sa
  // endpoint; ang copy sa UI kinahanglan mo-ingon niini.
  logoutOtherDevices: () => authService.logoutFromAllDevices(),

  // Wala pay route ang blood center para ani. Ang notification preferences kay
  // para ra sa donor (`/donors/notification-preferences`), ug ang tema kay
  // lokal na pinaagi sa useDarkMode() — walay kalabotan ang server.
  updateNotificationPref: async () => ({ success: true, local: true }),
  updateTheme: async () => ({ success: true, local: true }),
}

const loading = ref(true)

const tabs = [
  { id: 'profile', label: 'My Profile', icon: 'user' },
  { id: 'security', label: 'Security', icon: 'lock' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'sessions', label: 'Sessions', icon: 'monitor' },
  { id: 'account', label: 'Account Info', icon: 'info' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
]
const activeTab = ref('profile')

const AVATAR_COLORS = ['#1565C0', '#2E7D32', '#F57C00', '#D32F2F', '#6D4C41', '#5E35B1']

function initials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

/* ---------------------------- 1. MY PROFILE ---------------------------- */

const profile = reactive({
  avatarUrl: '',
  fullName: '',
  employeeId: '',
  bloodCenter: '',
  position: '',
  email: '',
  contactNumber: '',
})
const profileForm = reactive({ ...profile })

const editingProfile = ref(false)
const savingProfile = ref(false)
const profileError = ref('')
const profileSuccess = ref('')

// this is temporary lang since di pa ems sure unsa ang mga role/position sa tao
const BASE_POSITION_OPTIONS = [
  'Administrator',
  'Medical Technologist',
  'Registered Nurse',
  'Mobile Drive Coordinator',
]

const positionOptions = computed(() => {
  const opts = [...BASE_POSITION_OPTIONS]
  if (profileForm.position && !opts.includes(profileForm.position)) opts.unshift(profileForm.position)
  return opts
})

const avatarColor = computed(() => {
  const name = profileForm.fullName || ''
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
})

function startEditProfile() {
  Object.assign(profileForm, profile)
  editingProfile.value = true
  profileError.value = ''
  profileSuccess.value = ''
}

function cancelEditProfile() {
  Object.assign(profileForm, profile)
  editingProfile.value = false
  profileError.value = ''
}

function onAvatarChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  profileForm.avatarUrl = URL.createObjectURL(file)
  // local preview ra ni; actual upload kay i-attach sa saveProfile() payload
  // once ang backend endpoint mo-accept ug multipart/form-data.
}

async function saveProfile() {
  savingProfile.value = true
  profileError.value = ''
  profileSuccess.value = ''
  try {
    const updated = await api.updateProfile({
      fullName: profileForm.fullName,
      email: profileForm.email,
      contactNumber: profileForm.contactNumber,
      avatarUrl: profileForm.avatarUrl,
    })
    Object.assign(profile, updated)
    Object.assign(profileForm, updated)
    editingProfile.value = false
    profileSuccess.value = 'Profile updated successfully.'
  } catch (err) {
    // kay wala pa may live nga endpoint karon, so mag-fail ni nga call sa dev/UI stage.
    console.error('Failed to save profile (expected while backend is not yet wired up):', err)
    profileError.value = 'Could not save changes. Please try again.'
  } finally {
    savingProfile.value = false
  }
}

/* ---- SECURITY ----- */
const passwordForm = reactive({ current: '', new: '', confirm: '' })
const showCurrent = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)
const updatingPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

async function updatePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''

  if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
    passwordError.value = 'Please fill out all password fields.'
    return
  }
  if (passwordForm.new.length < 8) {
    passwordError.value = 'New password must be at least 8 characters.'
    return
  }
  if (passwordForm.new !== passwordForm.confirm) {
    passwordError.value = 'New password and confirmation do not match.'
    return
  }

  updatingPassword.value = true
  try {
    await api.updatePassword({ current: passwordForm.current, new: passwordForm.new })
    passwordForm.current = ''
    passwordForm.new = ''
    passwordForm.confirm = ''
    passwordSuccess.value = 'Password updated successfully.'
  } catch (err) {
    console.error('Failed to update password (expected while backend is not yet wired up):', err)
    passwordError.value = 'Could not update password. Please check your current password and try again.'
  } finally {
    updatingPassword.value = false
  }
}

/* ------ NOTIFICATION PREFS ------- */
const notificationPrefs = ref([
  { key: 'urgent_requests', label: 'Urgent Request Alerts', description: 'Email me when a hospital submits an urgent blood request.', enabled: true },
  { key: 'low_stock', label: 'Low Stock Alerts', description: 'Notify me when any blood type falls below safe inventory levels.', enabled: true },
  { key: 'drive_reminders', label: 'Mobile Drive Reminders', description: 'Remind me a day before a scheduled mobile drive.', enabled: true },
  { key: 'donor_registrations', label: 'New Donor Registrations', description: 'Notify me when a new donor registers for an appointment.', enabled: false },
  { key: 'system_updates', label: 'System Updates', description: 'Receive occasional updates about RedAgos features.', enabled: false },
])
const notifSaveError = ref('')

async function saveNotificationPref(pref) {
  notifSaveError.value = ''
  try {
    await api.updateNotificationPref({ key: pref.key, enabled: pref.enabled })
  } catch (err) {
    console.error('Failed to save notification preference (expected while backend is not yet wired up):', err)
    notifSaveError.value = 'Could not save this preference. Please try again.'
    pref.enabled = !pref.enabled // revert the toggle on failure
  }
}

/* --------- SESSION MANAGEMENT --------- */
const currentSession = reactive({ os: '', browser: '', loggedInLabel: '' })
const confirmLogoutOthers = ref(false)
const loggingOutOthers = ref(false)
const sessionMessage = ref('')

async function logoutOtherDevices() {
  loggingOutOthers.value = true
  try {
    await api.logoutOtherDevices()
    sessionMessage.value = 'All other devices have been logged out.'
    confirmLogoutOthers.value = false
  } catch (err) {
    console.error('Failed to log out other devices (expected while backend is not yet wired up):', err)
  } finally {
    loggingOutOthers.value = false
  }
}

/* -------- ACCOUNT INFORMATION --------- */

const accountInfo = reactive({
  username: '',
  role: '',
  bloodCenter: '',
  createdAt: '',
  lastLogin: '',
  status: '',
})

/* ------------ APPEARANCE ---------- */
const theme = ref('system')
const themeOptions = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'monitor' },
]

async function selectTheme(value) {
  const previous = theme.value
  theme.value = value
  try {
    await api.updateTheme({ theme: value })
  } catch (err) {
    console.error('Failed to save theme preference (expected while backend is not yet wired up):', err)
    theme.value = previous
  }
}

/* ------------ LOAD --------------- */
onMounted(async () => {
  try {
    const data = await api.getSettings()
    if (data?.profile) {
      Object.assign(profile, data.profile)
      Object.assign(profileForm, data.profile)
    }
    if (data?.accountInfo) Object.assign(accountInfo, data.accountInfo)
    if (data?.currentSession) Object.assign(currentSession, data.currentSession)
    if (data?.notificationPrefs) notificationPrefs.value = data.notificationPrefs
    if (data?.theme) theme.value = data.theme
  } catch (err) {
    // sa dev/UI stage pa lang ni, wala pay live nga /api/bloodcenter/settings endpoint,
    // so mag-fail gyud ni nga call. Gi-ano ra sa default/empty values, para
    // mag-display ug blangko/placeholder nga fields imbes mag-crash o mag-display ug fake data.
    console.error('Failed to load settings (expected while backend is not yet wired up):', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.settings-page {
  --primary: #1565c0;
  --primary-dark: #0d47a1;
  --accent: #d32f2f;
  --success: #2e7d32;
  --warning: #f57c00;
  --purple: #5e35b1;
  --teal: #00796b;
  --indigo: #3949ab;
  --text-primary: #1f2937;
  --text-secondary: #9ca3af;
  max-width: 1200px;
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px 32px 40px;
  font-family: var(--rb-font-sans);
  color: var(--text-primary);
}

.ui-icon { display: block; }

/* Loading */
.loading-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60vh;
}

.spinner {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 4px solid #e3ebf6;
  border-top-color: var(--primary);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none !important; }
}

.settings-inner {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* Header banner */
.header-banner {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  background: var(--primary);
  padding: 26px 32px;
}

.header-banner__content {
  position: relative;
  z-index: 1;
}

.page-title {
  font-size: 21px;
  font-weight: 700;
  margin: 0;
  color: #fff;
}

.page-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  margin: 4px 0 0;
}

/* Layout */
.settings-layout {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

/* Nav */
.settings-nav {
  width: 218px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #eef0f3;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  padding: 10px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease;
}

.nav-item:hover {
  background: #f3f6fa;
  color: var(--text-primary);
}

.nav-item--active {
  background: #E3F2FD;
  color: var(--primary);
}

.nav-item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: #f3f4f6;
  color: #9ca3af;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.nav-item--active .nav-item__icon {
  background: #fff;
  color: var(--primary);
}

.nav-item__drop {
  position: absolute;
  left: -10px;
  top: 50%;
  width: 8px;
  height: 8px;
  transform: translateY(-50%) rotate(45deg);
  background: var(--primary);
  border-radius: 0 50% 50% 50%;
}

/* Content */
.settings-content {
  flex: 1;
  min-width: 0;
}

.settings-panel {
  position: relative;
  overflow: hidden;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #eef0f3;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  padding: 24px 26px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.panel-icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  flex-shrink: 0;
}

.panel-icon-badge--blue { background: #E3F2FD; color: var(--primary); }
.panel-icon-badge--red { background: #FDEAEA; color: var(--accent); }
.panel-icon-badge--orange { background: #FEF1E1; color: var(--warning); }
.panel-icon-badge--purple { background: #EDE7F6; color: var(--purple); }
.panel-icon-badge--teal { background: #E0F2F1; color: var(--teal); }
.panel-icon-badge--indigo { background: #E8EAF6; color: var(--indigo); }

.panel-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
}

.panel-subtitle {
  font-size: 12.5px;
  color: var(--text-secondary);
  margin: 4px 0 0;
}

/* Avatar */
.avatar-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-ring {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 999px;
  padding: 4px;
  background: var(--border-strong, #e2e8f0);
  flex-shrink: 0;
}

.avatar-circle {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  overflow: hidden;
  border: 3px solid #fff;
}

.avatar-circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-camera-btn {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 2.5px solid #fff;
}

.avatar-upload-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.avatar-name {
  font-size: 12.5px;
  font-weight: 700;
  margin: 0;
}

.avatar-hint {
  font-size: 11.5px;
  color: var(--text-secondary);
  margin: 0;
  max-width: 220px;
}

/* Forms */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-grid--single {
  grid-template-columns: 1fr;
  max-width: 380px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.form-input {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--text-primary);
  background: #fafbfc;
  font-family: inherit;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.12);
}

.form-input:disabled {
  background: #f3f4f6;
  color: #6b7280;
  cursor: not-allowed;
}

.input-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: var(--text-secondary);
  pointer-events: none;
}

.form-input--icon {
  padding-left: 36px;
}

.form-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 34px;
  cursor: pointer;
  background: #fafbfc;
}

.form-select:disabled {
  cursor: not-allowed;
}

.select-caret {
  position: absolute;
  right: 12px;
  color: var(--text-secondary);
  pointer-events: none;
}

.password-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrap .form-input {
  padding-right: 40px;
}

.password-toggle {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  padding: 2px;
  transition: color 0.15s ease;
}

.password-toggle:hover {
  color: var(--primary);
}

.field-error {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
  font-size: 12.5px;
  margin: 0;
}

.field-success {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--success);
  font-size: 12.5px;
  margin: 0;
}

.panel-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.panel-actions--start {
  justify-content: flex-start;
}

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: var(--primary);
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn-primary:hover {
  opacity: 0.92;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-cancel {
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  background: #F3F4F6;
  color: #374151;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-cancel:hover {
  background: #e5e7eb;
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 700;
  background: #f3f4f6;
  color: #374151;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-outline:hover {
  background: #e5e7eb;
}

.btn-outline-blue {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 700;
  background: #e3f2fd;
  color: var(--primary);
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-outline-blue:hover {
  background: #d3e6fa;
}

.btn-outline-red {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  background: #FDEAEA;
  color: var(--accent);
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-outline-red:hover {
  background: #f9d3d3;
}

.btn-outline-red:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Toggle list (notifications) */
.toggle-list {
  display: flex;
  flex-direction: column;
}

.toggle-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 0;
  border-bottom: 1px solid #f3f4f6;
}

.toggle-row:last-child {
  border-bottom: none;
}

.toggle-row__label {
  font-size: 13px;
  font-weight: 700;
  margin: 0;
}

.toggle-row__desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 3px 0 0;
  max-width: 420px;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch__track {
  position: absolute;
  inset: 0;
  background: #d1d5db;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.toggle-switch__track::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 3px;
  top: 3px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-switch input:checked + .toggle-switch__track {
  background: var(--primary);
}

.toggle-switch input:checked + .toggle-switch__track::before {
  transform: translateX(18px);
}

/* Session card */
.session-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid #eef0f3;
  border-radius: 14px;
  padding: 16px 18px;
  overflow: hidden;
}

.session-card--current {
  background: #F8FAFC;
}

.session-card--current::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--primary);
}

.session-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: #E3F2FD;
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.session-card__body {
  flex: 1;
  min-width: 0;
}

.session-card__title {
  font-size: 13.5px;
  font-weight: 700;
  margin: 0;
}

.session-card__meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.session-card__time {
  font-size: 11.5px;
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.session-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  background: #E8F5E9;
  color: var(--success);
  white-space: nowrap;
  flex-shrink: 0;
}

/* Account info */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 24px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
}

.info-row span {
  color: var(--text-secondary);
}

.info-row strong {
  color: var(--text-primary);
  font-weight: 700;
}

.status-badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
}

.status-badge--active { background: #E8F5E9; color: var(--success); }
.status-badge--inactive { background: #f3f4f6; color: #6b7280; }
.status-badge--suspended { background: #FDEAEA; color: var(--accent); }

/* Appearance */
.theme-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  max-width: 540px;
}

.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  border: 1.5px solid #e5e7eb;
  border-radius: 14px;
  padding: 14px 12px 16px;
  background: #fff;
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.theme-card:hover {
  border-color: #bcd7f2;
}

.theme-card--active {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}

.theme-card__preview {
  position: relative;
  width: 100%;
  height: 58px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.theme-card__bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 12px;
}

.theme-card__line {
  position: absolute;
  left: 10px;
  right: 10px;
  height: 5px;
  border-radius: 3px;
}

.theme-card__line--1 { top: 22px; width: 60%; }
.theme-card__line--2 { top: 33px; width: 40%; }

.theme-card__preview--light {
  background: #F1F6FB;
  color: var(--warning);
}
.theme-card__preview--light .theme-card__bar { background: #E1ECF7; }
.theme-card__preview--light .theme-card__line { background: #cfe0f2; }

.theme-card__preview--dark {
  background: #1f2937;
  color: #FBBF24;
}
.theme-card__preview--dark .theme-card__bar { background: #111827; }
.theme-card__preview--dark .theme-card__line { background: #374151; }

.theme-card__preview--system {
  background: linear-gradient(135deg, #F1F6FB 50%, #1f2937 50%);
  color: var(--primary);
}
.theme-card__preview--system .theme-card__bar { background: linear-gradient(90deg, #E1ECF7 50%, #111827 50%); }
.theme-card__preview--system .theme-card__line { background: linear-gradient(90deg, #cfe0f2 50%, #374151 50%); }

.theme-card__label {
  line-height: 1;
}

.theme-card__check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Modals */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal-card {
  background: #fff;
  border-radius: 14px;
  width: 100%;
  max-width: 440px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.18);
}

.modal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid #f3f4f6;
}

.modal-card__heading {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #FDEAEA;
  color: var(--accent);
  flex-shrink: 0;
}

.modal-card__title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
}

.modal-card__close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px;
  display: flex;
  transition: color 0.15s ease;
}

.modal-card__close:hover {
  color: var(--text-primary);
}

.modal-form {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 900px) {
  .settings-layout {
    flex-direction: column;
  }

  .settings-nav {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
  }

  .nav-item {
    flex-shrink: 0;
  }

  .nav-item__drop { display: none; }

  .form-grid,
  .info-grid,
  .theme-options {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .settings-page { padding: 16px 16px 32px; }
  .header-banner { padding: 20px 20px; }
  .settings-panel { padding: 18px; }
  .panel-header-row { flex-direction: column; align-items: stretch; }
  .avatar-row { flex-direction: column; align-items: flex-start; }
}

.btn-primary:focus-visible,
.btn-outline-blue:focus-visible,
.btn-outline-red:focus-visible,
.btn-cancel:focus-visible,
.avatar-camera-btn:focus-visible {
  outline: 2px solid var(--rb-primary, #1565C0);
  outline-offset: 2px;
}
</style>
