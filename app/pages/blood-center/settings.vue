<template>
  <div class="settings-page scope-blood-center-settings">
    <div v-if="loading" class="settings-skeleton" aria-busy="true">
      <div class="skeleton skeleton--title" />
      <div class="settings-skeleton__layout">
        <div class="skeleton skeleton--nav" />
        <div class="skeleton skeleton--panel" />
      </div>
    </div>

    <div v-else class="settings-inner">
      <!-- Header -->
      <header class="header-row">
        <h1 class="page-title">Account Settings</h1>
        <p class="page-subtitle">Manage your profile, security and preferences.</p>
      </header>

      <div class="settings-layout">
        <!-- Nav -->
        <nav class="settings-nav">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="nav-item"
            :class="{ 'nav-item--active': activeTab === tab.id }"
            :aria-current="activeTab === tab.id ? 'page' : undefined"
            @click="activeTab = tab.id"
          >
            <span class="nav-item__icon" :class="`nav-item__icon--${tab.id}`">
              <AssetIcon :name="tab.icon" :size="16" />
            </span>
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <!-- Content -->
        <div class="settings-content">
          <!-- MY PROFILE -->
          <section v-if="activeTab === 'profile'" class="settings-panel">
            <div class="panel-header-row">
              <div class="panel-heading">
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
              <!-- First and last name are stored apart, so they are edited apart. -->
              <div class="form-group">
                <label class="form-label" for="bc-first-name">First Name</label>
                <div class="input-icon-wrap">
                  <AssetIcon name="user" :size="15" class="input-icon" />
                  <input id="bc-first-name" v-model="profileForm.firstName" type="text" class="form-input form-input--icon" :disabled="!editingProfile" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="bc-last-name">Last Name</label>
                <div class="input-icon-wrap">
                  <AssetIcon name="user" :size="15" class="input-icon" />
                  <input id="bc-last-name" v-model="profileForm.lastName" type="text" class="form-input form-input--icon" :disabled="!editingProfile" />
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
              <!-- The role (and what it may do) is set by a supervisor in Staff
                   Accounts; the title is the person's own label, e.g. RMT. -->
              <div class="form-group">
                <label class="form-label">Role</label>
                <div class="input-icon-wrap">
                  <AssetIcon name="briefcase" :size="15" class="input-icon" />
                  <input :value="roleText" type="text" class="form-input form-input--icon" disabled />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="bc-title">Title <span class="form-optional">optional</span></label>
                <ComboInput
                  id="bc-title"
                  v-model="profileForm.position"
                  :options="TITLE_OPTIONS"
                  maxlength="100"
                  placeholder="e.g. RMT"
                  :disabled="!editingProfile"
                />
              </div>
              <!-- Read-only: the sign-in address is changed by a supervisor, not here. -->
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <div class="input-icon-wrap">
                  <AssetIcon name="mail" :size="15" class="input-icon" />
                  <input :value="profileForm.email" type="email" class="form-input form-input--icon" disabled />
                </div>
                <p v-if="editingProfile" class="form-hint">Ask your supervisor to change your sign-in email.</p>
              </div>
              <div class="form-group">
                <label class="form-label">Contact Number</label>
                <div class="input-icon-wrap">
                  <AssetIcon name="phone" :size="15" class="input-icon" />
                  <input v-model="profileForm.contactNumber" type="tel" class="form-input form-input--icon" placeholder="09XXXXXXXXX" :disabled="!editingProfile" />
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

          <!-- BLOOD CENTER: the centre's own settings, for supervisors (center.configure). -->
          <section v-if="activeTab === 'center'" class="settings-panel">
            <div class="panel-heading">
              <div>
                <h2 class="panel-title">Blood Center</h2>
                <p class="panel-subtitle">Settings that belong to your centre, not to your account.</p>
              </div>
            </div>
            <BloodCenterFacilityLogoCard />
          </section>

          <!-- SECURITY -->
          <section v-if="activeTab === 'security'" class="settings-panel">
            <div class="panel-heading">
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
import ComboInput from '~/components/common/ComboInput.vue'
import { authService } from '~/api/auth/AuthService'
import AssetIcon from '~/components/common/AssetIcon.vue'
import BloodCenterFacilityLogoCard from '~/components/BloodCenter/FacilityLogoCard.vue'
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

const { can: canDo, user: sessionUser, fetchUser } = useUser()

// The Blood Center tab holds the centre's logo, which only center.configure
// may change (the card checks the same ability), so only they see the tab.
const tabs = computed(() => [
  { id: 'profile', label: 'My Profile', icon: 'user' },
  { id: 'security', label: 'Security', icon: 'lock' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'sessions', label: 'Sessions', icon: 'monitor' },
  { id: 'account', label: 'Account Info', icon: 'info' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  ...(canDo('center.configure') ? [{ id: 'center', label: 'Blood Center', icon: 'building-2' }] : []),
])
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
  firstName: '',
  lastName: '',
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

// Suggestions for the title, as on the Add Staff form; any other is typed.
const TITLE_OPTIONS = ['RMT', 'RN']

// The person's role, as a supervisor set it in Staff Accounts. Shown, not edited.
const roleText = computed(() => {
  const u = sessionUser.value
  if (!u) return ''
  const role = u.staff_role_label || u.role_label || u.custom_role || ''
  const parts = [u.is_supervisor ? 'Supervisor' : '', role].filter(Boolean)
  return parts.join(' · ') || u.department_label || 'No role yet'
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
    // The fields PATCH /blood-center/profile accepts, in its names. Email and
    // employee ID are not changed from here.
    const updated = await api.updateProfile({
      first_name: profileForm.firstName.trim(),
      last_name: profileForm.lastName.trim(),
      phone: profileForm.contactNumber.trim() || undefined,
      position: profileForm.position.trim() || null,
    })
    applyServerData(updated)
    // The header shows the name from the session; refresh it so it matches.
    fetchUser()
    editingProfile.value = false
    profileSuccess.value = 'Profile updated successfully.'
  } catch (err) {
    // kay wala pa may live nga endpoint karon, so mag-fail ni nga call sa dev/UI stage.
    console.error('Failed to save profile:', err)
    profileError.value = Object.values(err?.data?.errors ?? {}).flat()[0]
      || err?.data?.message
      || 'Could not save changes. Please try again.'
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

const ACCOUNT_STATUS = { active: 'Active', pending_verification: 'Pending verification', suspended: 'Suspended', deactivated: 'Deactivated' }

function formatDateTime(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * GET/PATCH /blood-center/profile answer { profile, facility, account } in the
 * server's names (full_name, phone, …). The form uses its own, so map here;
 * assigning the response as-is left every field blank.
 */
function applyServerData(data) {
  const p = data?.profile ?? {}
  const mapped = {
    firstName: p.first_name ?? '',
    lastName: p.last_name ?? '',
    fullName: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' '),
    employeeId: p.employee_id ?? '',
    position: p.position ?? '',
    email: p.email ?? '',
    contactNumber: p.phone ?? '',
    bloodCenter: data?.facility?.name ?? '',
    avatarUrl: sessionUser.value?.avatar ?? profile.avatarUrl ?? '',
  }
  Object.assign(profile, mapped)
  Object.assign(profileForm, mapped)

  const account = data?.account ?? {}
  Object.assign(accountInfo, {
    username: account.username || 'Not set',
    role: roleText.value,
    bloodCenter: data?.facility?.name || 'Not linked',
    createdAt: formatDateTime(account.created_at),
    lastLogin: accountInfo.lastLogin || 'Not recorded',
    status: ACCOUNT_STATUS[account.account_status] || account.account_status || 'Unknown',
  })
}

onMounted(async () => {
  try {
    const data = await api.getSettings()
    applyServerData(data)
    if (data?.currentSession) Object.assign(currentSession, data.currentSession)
    if (data?.notificationPrefs) notificationPrefs.value = data.notificationPrefs
    if (data?.theme) theme.value = data.theme
  } catch (err) {
    console.error('Failed to load settings:', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.settings-page {
  /*
   * Fills keep the dark base (white text sits on them); everything painted AS
   * text or an icon reads the -text variant, which lifts in dark mode. The
   * page-local names stay so the rest of the sheet did not have to change.
   */
  --primary: var(--rb-primary);
  --primary-text: var(--rb-primary-text);
  --primary-dark: #0d47a1;
  --accent: var(--rb-accent-text);
  --success: var(--rb-success-text);
  --warning: var(--rb-warning-text);
  --purple: var(--rb-purple-text);
  --teal: var(--rb-teal-text);
  --indigo: var(--rb-primary-text);
  --text-primary: var(--rb-text-primary);
  --text-secondary: var(--rb-text-secondary);
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
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
  border: 4px solid var(--rb-border-strong);
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
.header-row { display: flex; flex-direction: column; }

.page-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--rb-text-primary);
}

.page-subtitle {
  font-size: 13px;
  color: var(--rb-text-secondary);
  margin: 4px 0 0;
}

/* Loading */
.settings-skeleton { display: flex; flex-direction: column; gap: 20px; }
.settings-skeleton__layout { display: flex; gap: 20px; align-items: flex-start; }
.skeleton {
  border-radius: 14px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: settings-shimmer 1.4s ease infinite;
}
.skeleton--title { height: 44px; max-width: 320px; }
.skeleton--nav { width: 218px; height: 300px; flex-shrink: 0; }
.skeleton--panel { flex: 1; height: 420px; }
@keyframes settings-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
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
  background: var(--rb-surface);
  border-radius: 14px;
  border: 1px solid var(--rb-border);
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.04);
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
  background: var(--rb-surface-hover);
  color: var(--text-primary);
}

.nav-item--active {
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--primary-text);
  box-shadow: inset 3px 0 0 var(--rb-primary);
}
.nav-item:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }

.nav-item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--rb-surface-hover);
  color: var(--rb-text-muted);
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.nav-item--active .nav-item__icon {
  background: var(--rb-surface);
  color: var(--primary-text);
}

.nav-item__drop {
  position: absolute;
  left: -10px;
  top: 50%;
  width: 8px;
  height: 8px;
  transform: translateY(-50%) rotate(45deg);
  background: var(--primary-text);
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
  background: var(--rb-surface);
  border-radius: 14px;
  border: 1px solid var(--rb-border);
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.04);
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

.panel-icon-badge--blue { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--primary-text); }
.panel-icon-badge--red { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--accent); }
.panel-icon-badge--orange { background: rgba(var(--rb-warning-rgb), 0.14); color: var(--warning); }
.panel-icon-badge--purple { background: rgba(var(--rb-purple-rgb), 0.12); color: var(--purple); }
.panel-icon-badge--teal { background: rgba(var(--rb-teal-rgb), 0.14); color: var(--teal); }
.panel-icon-badge--indigo { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--indigo); }

.panel-title {
  font-size: 14px;
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
  background: var(--rb-border-strong);
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
  border: 3px solid var(--rb-surface);
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
  border: 2.5px solid var(--rb-surface);
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

/*
 * Anchored on the page root on purpose. Several other portals ship
 * `:global(.dark .form-input) { … }` — an unscoped rule at (0,2,0) that ties
 * with a plain scoped `.form-input[data-v-...]`, so which one won came down to
 * chunk load order. The page-root ancestor takes these to (0,3,0) and settles
 * it, without this page having to hardcode a dark palette of its own.
 */
.settings-page .form-input {
  width: 100%;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--rb-surface-alt);
  font-family: inherit;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.settings-page .form-input:focus {
  outline: none;
  border-color: var(--primary-text);
  background: var(--rb-surface);
  box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.16);
}

.settings-page .form-input::placeholder {
  color: var(--rb-placeholder);
}

.settings-page .form-input:disabled {
  background: var(--rb-surface-hover);
  color: var(--rb-text-muted);
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

.settings-page .form-input--icon {
  padding-left: 36px;
}

.settings-page .form-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 34px;
  cursor: pointer;
  background: var(--rb-surface-alt);
}

.settings-page .form-select:disabled {
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
  color: var(--primary-text);
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
  background: var(--primary-dark);
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
  background: var(--rb-surface-hover);
  color: var(--text-primary);
  border: 1px solid var(--rb-border-strong);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.btn-cancel:hover {
  background: var(--rb-surface-alt);
  border-color: var(--rb-border-hover);
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  background: var(--rb-surface-hover);
  color: var(--text-primary);
  border: 1px solid var(--rb-border-strong);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.btn-outline:hover {
  background: var(--rb-surface-alt);
  border-color: var(--rb-border-hover);
}

.btn-outline-blue {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 700;
  background: rgba(var(--rb-primary-rgb), 0.10);
  color: var(--primary-text);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-outline-blue:hover {
  background: rgba(var(--rb-primary-rgb), 0.18);
}

.btn-outline-red {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  background: rgba(var(--rb-accent-rgb), 0.10);
  color: var(--accent);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-outline-red:hover {
  background: rgba(var(--rb-accent-rgb), 0.18);
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
  border-bottom: 1px solid var(--rb-border);
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
  background: var(--rb-border-hover);
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
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
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
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  padding: 16px 18px;
  overflow: hidden;
}

/* Marked by a tinted outline and the "This device" badge, rather than a
   coloured bar down one side. */
.session-card--current {
  background: var(--rb-surface-hover);
  border-color: rgba(var(--rb-primary-rgb), 0.35);
}

.session-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: rgba(var(--rb-primary-rgb), 0.12);
  color: var(--primary-text);
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
  background: rgba(var(--rb-success-rgb), 0.14);
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
  border-bottom: 1px solid var(--rb-border);
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

.status-badge--active { background: rgba(var(--rb-success-rgb), 0.14); color: var(--success); }
.status-badge--inactive { background: var(--rb-surface-hover); color: var(--text-secondary); }
.status-badge--suspended { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--accent); }

/* Appearance */
/* auto-fit, not a fixed count: the content column now changes width
   when the rail expands, so the grid has to answer to its container
   rather than to a viewport breakpoint that no longer describes it. */
.theme-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 14px;
  max-width: 540px;
}

.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  border: 1.5px solid var(--rb-border-strong);
  border-radius: 14px;
  padding: 14px 12px 16px;
  background: var(--rb-surface);
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.theme-card:hover {
  border-color: var(--rb-border-hover);
}

.theme-card--active {
  border-color: var(--primary-text);
  box-shadow: 0 0 0 1px var(--primary-text);
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
  background: var(--rb-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal-card {
  background: var(--rb-surface);
  border-radius: 14px;
  width: 100%;
  max-width: 440px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 28px rgba(var(--rb-shadow-rgb), 0.28);
}

.modal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--rb-border);
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
  background: rgba(var(--rb-accent-rgb), 0.12);
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
    scrollbar-width: thin;
    scrollbar-color: var(--rb-border-hover) transparent;
    -webkit-overflow-scrolling: touch;
  }

  .settings-nav::-webkit-scrollbar { height: 4px; }
  .settings-nav::-webkit-scrollbar-thumb {
    background: var(--rb-border-hover);
    border-radius: 999px;
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

.form-optional { margin-left: 4px; font-weight: 500; color: var(--rb-text-secondary); }
.form-hint { margin: 4px 0 0; font-size: 12px; color: var(--rb-text-secondary); }
</style>
