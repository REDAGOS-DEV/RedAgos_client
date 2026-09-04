<template>
  <div class="settings-page">
    <!-- ===================== LOADING SKELETON ===================== -->
    <div v-if="loading" class="page-inner">
      <div class="skeleton skeleton--title" />
      <div class="settings-layout">
        <div class="skeleton skeleton--nav" />
        <div class="skeleton skeleton--panel" style="height:520px" />
      </div>
    </div>

    <div v-else class="page-inner">
      <!-- ===================== PAGE HEADER ===================== -->
      <header class="page-header fade-in" style="--delay:0ms">
        <div>
          <h1 class="page-title">Settings</h1>
          <p class="page-subtitle">Manage your account, organization, security, notifications, and application preferences.</p>
        </div>
      </header>

      <div class="settings-layout fade-in" style="--delay:40ms">
        <!-- ===================== LEFT NAVIGATION ===================== -->
        <nav class="settings-nav" aria-label="Settings sections">
          <div class="settings-nav-scroll">
            <button
              v-for="item in navItems"
              :key="item.key"
              type="button"
              class="nav-item"
              :class="{ 'nav-item--active': activeSection === item.key }"
              @click="switchSection(item.key)"
            >
              <span class="nav-item-icon">
                <AssetIcon :name="item.icon" :size="18" />
              </span>
              <span class="nav-item-text">
                <span class="nav-item-title">{{ item.label }}</span>
                <span class="nav-item-desc">{{ item.description }}</span>
              </span>
              <span v-if="dirtySections.has(item.key)" class="nav-item-dot" aria-label="Unsaved changes"></span>
            </button>
          </div>
        </nav>

        <!-- ===================== CONTENT ===================== -->
        <div class="settings-content">
          <!-- ===================== PROFILE ===================== -->
          <section v-if="activeSection === 'profile'" class="settings-card">
            <h2 class="card-title">Profile Information</h2>

            <div class="profile-photo-row">
              <div class="profile-photo">
                <img v-if="profile.photo_url" :src="profile.photo_url" alt="Profile photo" />
                <span v-else>{{ initials(profile.full_name) }}</span>
              </div>
              <div>
                <button type="button" class="btn-ghost btn-ghost--sm" @click="triggerPhotoUpload">
                  <AssetIcon name="upload" :size="14" /> Upload Photo
                </button>
                <input ref="photoInput" type="file" accept="image/*" class="sr-only" @change="onPhotoSelected" />
                <p class="field-hint">JPG or PNG, up to 2MB.</p>
              </div>
            </div>

            <div class="field-grid">
              <label class="field">
                <span class="field-label">Full Name</span>
                <input v-model="profile.full_name" type="text" class="field-input" />
              </label>
              <label class="field">
                <span class="field-label">Employee ID</span>
                <input v-model="profile.employee_id" type="text" class="field-input" />
              </label>
              <label class="field">
                <span class="field-label">Position</span>
                <input v-model="profile.position" type="text" class="field-input" />
              </label>
              <label class="field">
                <span class="field-label">Department</span>
                <input v-model="profile.department" type="text" class="field-input" />
              </label>
              <label class="field">
                <span class="field-label">Email Address</span>
                <input v-model="profile.email" type="email" class="field-input" />
              </label>
              <label class="field">
                <span class="field-label">Mobile Number</span>
                <input v-model="profile.mobile" type="tel" class="field-input" />
              </label>
            </div>

            <div class="card-actions">
              <button type="button" class="btn-ghost" :disabled="!isDirty('profile')" @click="discardSection('profile')">Cancel</button>
              <button type="button" class="btn-primary" :disabled="!isDirty('profile') || saving" @click="saveSection('profile')">Save Changes</button>
            </div>
          </section>

          <!-- ===================== HOSPITAL INFORMATION ===================== -->
          <section v-else-if="activeSection === 'hospital'" class="settings-card">
            <div class="card-title-row">
              <h2 class="card-title">Hospital Information</h2>
              <span v-if="hospitalInfo.verified" class="verified-badge">
                <AssetIcon name="badge-check" :size="14" /> Verified
              </span>
            </div>

            <div class="field-grid">
              <label class="field">
                <span class="field-label">Hospital Name</span>
                <input v-model="hospitalInfo.hospital_name" type="text" class="field-input" />
              </label>
              <label class="field">
                <span class="field-label">Blood Bank Name</span>
                <input v-model="hospitalInfo.blood_bank_name" type="text" class="field-input" />
              </label>
              <label class="field field--full">
                <span class="field-label">Hospital Address</span>
                <input v-model="hospitalInfo.address" type="text" class="field-input" />
              </label>
              <label class="field">
                <span class="field-label">Contact Number</span>
                <input v-model="hospitalInfo.contact_number" type="tel" class="field-input" />
              </label>
              <label class="field">
                <span class="field-label">Email Address</span>
                <input v-model="hospitalInfo.email" type="email" class="field-input" />
              </label>
              <label class="field">
                <span class="field-label">Operating Hours</span>
                <input v-model="hospitalInfo.operating_hours" type="text" class="field-input" placeholder="e.g. Mon–Sun, 24 Hours" />
              </label>
              <label class="field">
                <span class="field-label">Hospital License Number</span>
                <input :value="hospitalInfo.license_number" type="text" class="field-input" readonly />
              </label>
            </div>

            <div class="card-actions">
              <button type="button" class="btn-ghost" :disabled="!isDirty('hospital')" @click="discardSection('hospital')">Cancel</button>
              <button type="button" class="btn-primary" :disabled="!isDirty('hospital') || saving" @click="saveSection('hospital')">Save Changes</button>
            </div>
          </section>

          <!-- ===================== NOTIFICATION PREFERENCES ===================== -->
          <section v-else-if="activeSection === 'notifications'" class="settings-card">
            <h2 class="card-title">Notification Preferences</h2>

            <div class="toggle-list">
              <div v-for="opt in notificationOptions" :key="opt.key" class="toggle-row">
                <div class="toggle-text">
                  <p class="toggle-title">{{ opt.label }}</p>
                  <p class="toggle-desc">{{ opt.description }}</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="notificationPrefs[opt.key]" />
                  <span class="toggle-track"><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
          </section>

          <!-- ===================== SECURITY ===================== -->
          <section v-else-if="activeSection === 'security'" class="settings-stack">
            <div class="settings-card">
              <h2 class="card-title">Change Password</h2>
              <div class="field-grid">
                <label class="field field--full">
                  <span class="field-label">Current Password</span>
                  <input v-model="passwordForm.current" type="password" class="field-input" autocomplete="current-password" />
                </label>
                <label class="field">
                  <span class="field-label">New Password</span>
                  <input v-model="passwordForm.new" type="password" class="field-input" autocomplete="new-password" />
                </label>
                <label class="field">
                  <span class="field-label">Confirm Password</span>
                  <input v-model="passwordForm.confirm" type="password" class="field-input" autocomplete="new-password" />
                </label>
              </div>
              <p v-if="passwordError" class="field-error">{{ passwordError }}</p>
              <div class="card-actions">
                <button type="button" class="btn-primary" :disabled="updatingPassword" @click="updatePassword">
                  {{ updatingPassword ? 'Updating…' : 'Update Password' }}
                </button>
              </div>
            </div>

            <div class="settings-card">
              <div class="card-title-row">
                <h2 class="card-title">Two-Factor Authentication</h2>
                <span class="status-badge" :class="security.twoFactorEnabled ? 'status-badge--success' : 'status-badge--muted'">
                  {{ security.twoFactorEnabled ? 'Enabled' : 'Disabled' }}
                </span>
              </div>
              <p class="section-hint">Add an extra layer of security to your account by requiring a verification code at sign-in.</p>
              <div class="card-actions card-actions--start">
                <button type="button" class="btn-ghost" @click="manageTwoFactor">Manage</button>
              </div>
            </div>

            <div class="settings-card">
              <div class="card-title-row">
                <h2 class="card-title">Active Sessions</h2>
                <button type="button" class="btn-ghost btn-ghost--sm" :disabled="loggingOutSessions" @click="logoutOtherSessions">
                  <AssetIcon name="log-out" :size="14" /> Log Out Other Sessions
                </button>
              </div>
              <div v-if="security.sessions.length" class="session-list">
                <div v-for="s in security.sessions" :key="s.id" class="session-row">
                  <div class="session-icon"><AssetIcon :name="s.device_type === 'mobile' ? 'smartphone' : 'monitor'" :size="18" /></div>
                  <div class="session-body">
                    <p class="session-device">{{ s.device }} · {{ s.browser }}</p>
                    <p class="session-meta">{{ s.location }} · Last active {{ formatRelative(s.last_active) }}</p>
                  </div>
                  <span v-if="s.is_current" class="status-badge status-badge--primary">This device</span>
                </div>
              </div>
              <p v-else class="empty-hint">No active session data available.</p>
            </div>

            <div class="settings-card">
              <h2 class="card-title">Login Activity</h2>
              <div v-if="security.loginActivity.length" class="activity-table-wrap">
                <table class="activity-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Time</th>
                      <th scope="col">Browser</th>
                      <th scope="col">OS</th>
                      <th scope="col">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(a, i) in security.loginActivity" :key="i">
                      <td>{{ a.date }}</td>
                      <td>{{ a.time }}</td>
                      <td>{{ a.browser }}</td>
                      <td>{{ a.os }}</td>
                      <td>{{ a.location }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="empty-hint">No login activity recorded yet.</p>
            </div>
          </section>

          <!-- ===================== CONNECTED BLOOD CENTERS ===================== -->
          <section v-else-if="activeSection === 'centers'" class="settings-card">
            <h2 class="card-title">Connected Blood Centers</h2>

            <div v-if="connectedCenters.length" class="center-list">
              <div v-for="c in connectedCenters" :key="c.id" class="center-card">
                <div class="center-card-top">
                  <div>
                    <p class="center-name">{{ c.name }}</p>
                    <p class="center-meta">Last sync {{ formatRelative(c.last_sync) }}</p>
                  </div>
                  <span class="status-badge" :class="centerStatusClass(c.status)">{{ centerStatusLabel(c.status) }}</span>
                </div>
                <p class="center-contact">
                  <AssetIcon name="phone" :size="13" /> {{ c.contact_number || '—' }}
                </p>
                <button type="button" class="notif-action-link" @click="viewCenterDetails(c)">
                  View Details
                  <AssetIcon name="arrow-right" :size="14" />
                </button>
              </div>
            </div>
            <p v-else class="empty-hint">No connected blood centers yet.</p>
          </section>

          <!-- ===================== SYSTEM PREFERENCES ===================== -->
          <section v-else-if="activeSection === 'system'" class="settings-card">
            <h2 class="card-title">Application Preferences</h2>

            <div class="field-grid">
              <div class="field">
                <span class="field-label">Theme</span>
                <div class="segmented">
                  <button
                    v-for="opt in themeOptions"
                    :key="opt.key"
                    type="button"
                    class="segmented-btn"
                    :class="{ active: systemPrefs.theme === opt.key }"
                    @click="systemPrefs.theme = opt.key"
                  >{{ opt.label }}</button>
                </div>
              </div>

              <label class="field">
                <span class="field-label">Language</span>
                <select v-model="systemPrefs.language" class="field-input">
                  <option value="en">English</option>
                </select>
              </label>

              <label class="field">
                <span class="field-label">Timezone</span>
                <select v-model="systemPrefs.timezone" class="field-input">
                  <option value="Asia/Manila">Asia/Manila</option>
                </select>
              </label>

              <label class="field">
                <span class="field-label">Date Format</span>
                <select v-model="systemPrefs.date_format" class="field-input">
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </label>

              <label class="field">
                <span class="field-label">Time Format</span>
                <select v-model="systemPrefs.time_format" class="field-input">
                  <option value="12h">12-Hour</option>
                  <option value="24h">24-Hour</option>
                </select>
              </label>
            </div>

            <div class="toggle-list">
              <div class="toggle-row">
                <div class="toggle-text">
                  <p class="toggle-title">Compact Mode</p>
                  <p class="toggle-desc">Reduce spacing and element sizes for a denser layout.</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="systemPrefs.compact_mode" />
                  <span class="toggle-track"><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>

            <div class="card-actions">
              <button type="button" class="btn-ghost" :disabled="!isDirty('system')" @click="discardSection('system')">Cancel</button>
              <button type="button" class="btn-primary" :disabled="!isDirty('system') || saving" @click="saveSection('system')">Save Changes</button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- ===================== STICKY SAVE BAR ===================== -->
    <Transition name="savebar">
      <div v-if="dirtySections.size > 0" class="save-bar" role="region" aria-label="Unsaved changes">
        <div class="save-bar-inner">
          <span class="save-bar-text">
            <AssetIcon name="circle-alert" :size="16" />
            You have unsaved changes
          </span>
          <div class="save-bar-actions">
            <button type="button" class="btn-ghost btn-ghost--sm" @click="discardAll">Discard Changes</button>
            <button type="button" class="btn-primary btn-primary--sm" :disabled="saving" @click="saveAll">
              {{ saving ? 'Saving…' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ===================== SUCCESS TOAST ===================== -->
    <Transition name="toast">
      <div v-if="toastMessage" class="toast" role="status">
        <AssetIcon name="circle-check-big" :size="16" style="color:#2E7D32" />
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { hospitalService } from '~/api/hospital/HospitalService'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

const loading = ref(true)
const saving = ref(false)
const toastMessage = ref('')
let toastTimer = null

// ======================= NAVIGATION =======================
const navItems = [
  { key: 'profile', label: 'Profile', description: 'Your personal account details', icon: 'user-circle' },
  { key: 'hospital', label: 'Hospital Information', description: 'Facility and blood bank details', icon: 'building-2' },
  { key: 'notifications', label: 'Notification Preferences', description: 'Choose what updates you receive', icon: 'bell' },
  { key: 'security', label: 'Security', description: 'Password, 2FA, and sessions', icon: 'shield-check' },
  { key: 'centers', label: 'Connected Blood Centers', description: 'Manage linked institutions', icon: 'link' },
  { key: 'system', label: 'System Preferences', description: 'Theme, language, and formats', icon: 'settings' },
]
const activeSection = ref('profile')

function switchSection(key) {
  activeSection.value = key
}

// ======================= STATE (per section, with snapshots for dirty tracking) =======================
const profile = reactive({ photo_url: '', full_name: '', employee_id: '', position: '', department: '', email: '', mobile: '' })
const hospitalInfo = reactive({ hospital_name: '', blood_bank_name: '', address: '', contact_number: '', email: '', operating_hours: '', license_number: '', verified: false })
const notificationPrefs = reactive({
  blood_request_updates: true,
  blood_ready_pickup: true,
  blood_availability_alerts: true,
  billing_notifications: true,
  system_announcements: true,
  email_notifications: true,
  inapp_notifications: true,
  sms_notifications: false,
})
const systemPrefs = reactive({ theme: 'system', language: 'en', timezone: 'Asia/Manila', date_format: 'MM/DD/YYYY', time_format: '12h', compact_mode: false })

const security = reactive({ twoFactorEnabled: false, sessions: [], loginActivity: [] })
const connectedCenters = ref([])

const passwordForm = reactive({ current: '', new: '', confirm: '' })
const passwordError = ref('')
const updatingPassword = ref(false)
const loggingOutSessions = ref(false)

const notificationOptions = [
  { key: 'blood_request_updates', label: 'Blood Request Updates', description: 'Status changes on your submitted requests.' },
  { key: 'blood_ready_pickup', label: 'Blood Ready for Pickup', description: 'When units are prepared and awaiting collection.' },
  { key: 'blood_availability_alerts', label: 'Blood Availability Alerts', description: 'Inventory changes and critical shortages.' },
  { key: 'billing_notifications', label: 'Billing Notifications', description: 'Invoices, payments, and billing reminders.' },
  { key: 'system_announcements', label: 'System Announcements', description: 'Maintenance notices and platform updates.' },
  { key: 'email_notifications', label: 'Email Notifications', description: 'Receive notifications via email.' },
  { key: 'inapp_notifications', label: 'In-App Notifications', description: 'Receive notifications inside RedAgos.' },
  { key: 'sms_notifications', label: 'SMS Notifications', description: 'Receive urgent alerts via text message.' },
]

const themeOptions = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
]

// ======================= SNAPSHOTS FOR DIRTY TRACKING =======================
const snapshots = reactive({ profile: '', hospital: '', notifications: '', system: '' })

function snapshotOf(key) {
  if (key === 'profile') return JSON.stringify(profile)
  if (key === 'hospital') return JSON.stringify(hospitalInfo)
  if (key === 'notifications') return JSON.stringify(notificationPrefs)
  if (key === 'system') return JSON.stringify(systemPrefs)
  return ''
}

function captureSnapshots() {
  snapshots.profile = snapshotOf('profile')
  snapshots.hospital = snapshotOf('hospital')
  snapshots.notifications = snapshotOf('notifications')
  snapshots.system = snapshotOf('system')
}

function isDirty(key) {
  return snapshotOf(key) !== snapshots[key]
}

const dirtySections = computed(() => {
  const set = new Set()
  for (const key of ['profile', 'hospital', 'notifications', 'system']) {
    if (isDirty(key)) set.add(key)
  }
  return set
})

function applySnapshot(key, data) {
  const target = { profile, hospital: hospitalInfo, notifications: notificationPrefs, system: systemPrefs }[key]
  if (!target) return
  Object.assign(target, data)
}

function discardSection(key) {
  const original = { profile, hospital: hospitalInfo, notifications: notificationPrefs, system: systemPrefs }[key]
  Object.assign(original, JSON.parse(snapshots[key]))
}

function discardAll() {
  for (const key of ['profile', 'hospital', 'notifications', 'system']) discardSection(key)
}

// ======================= SAVE HANDLERS =======================
const sectionSaveFns = {
  profile: () => hospitalService.updateProfile({ ...profile }),
  hospital: () => hospitalService.updateHospitalInfo({ ...hospitalInfo }),
  notifications: () => hospitalService.updateNotificationPreferences({ ...notificationPrefs }),
  system: () => hospitalService.updateSystemPreferences({ ...systemPrefs }),
}

async function saveSection(key) {
  saving.value = true
  try {
    await sectionSaveFns[key]()
    snapshots[key] = snapshotOf(key)
    showToast('Changes saved successfully.')
  } catch (err) {
    console.error(`Failed to save ${key} settings:`, err)
  } finally {
    saving.value = false
  }
}

async function saveAll() {
  saving.value = true
  try {
    const keys = [...dirtySections.value]
    for (const key of keys) {
      await sectionSaveFns[key]()
      snapshots[key] = snapshotOf(key)
    }
    showToast('All changes saved successfully.')
  } catch (err) {
    console.error('Failed to save settings:', err)
  } finally {
    saving.value = false
  }
}

function showToast(msg) {
  toastMessage.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMessage.value = '' }, 3000)
}

// ======================= PROFILE PHOTO =======================
const photoInput = ref(null)
function triggerPhotoUpload() {
  photoInput.value?.click()
}
async function onPhotoSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const result = await hospitalService.uploadProfilePhoto(file)
    profile.photo_url = result?.photo_url ?? profile.photo_url
    snapshots.profile = snapshotOf('profile')
    showToast('Profile photo updated.')
  } catch (err) {
    console.error('Failed to upload profile photo:', err)
  }
}
function initials(name) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('')
}

// ======================= SECURITY ACTIONS =======================
async function updatePassword() {
  passwordError.value = ''
  if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
    passwordError.value = 'Please fill in all password fields.'
    return
  }
  if (passwordForm.new !== passwordForm.confirm) {
    passwordError.value = 'New password and confirmation do not match.'
    return
  }
  updatingPassword.value = true
  try {
    await hospitalService.updatePassword({
      current_password: passwordForm.current,
      new_password: passwordForm.new,
    })
    passwordForm.current = ''
    passwordForm.new = ''
    passwordForm.confirm = ''
    showToast('Password updated successfully.')
  } catch (err) {
    console.error('Failed to update password:', err)
    passwordError.value = 'Failed to update password. Please check your current password and try again.'
  } finally {
    updatingPassword.value = false
  }
}

function manageTwoFactor() {
  // Route to a dedicated 2FA setup/management flow if one exists.
  hospitalService.manageTwoFactor?.()
}

async function logoutOtherSessions() {
  loggingOutSessions.value = true
  try {
    await hospitalService.logoutOtherSessions()
    security.sessions = security.sessions.filter((s) => s.is_current)
    showToast('Other sessions have been logged out.')
  } catch (err) {
    console.error('Failed to log out other sessions:', err)
  } finally {
    loggingOutSessions.value = false
  }
}

function formatRelative(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

// ======================= CONNECTED CENTERS =======================
function centerStatusClass(status) {
  return {
    connected: 'status-badge--success',
    disconnected: 'status-badge--danger',
    pending: 'status-badge--warning',
  }[status] || 'status-badge--muted'
}
function centerStatusLabel(status) {
  return { connected: 'Connected', disconnected: 'Disconnected', pending: 'Pending' }[status] || status
}
function viewCenterDetails(center) {
  hospitalService.viewBloodCenterDetails?.(center.id)
}

// ======================= FETCH =======================
async function loadSettings() {
  loading.value = true
  try {
    // Expects GET /hospital/settings returning:
    // { profile, hospital_info, notification_preferences, system_preferences,
    //   security: { two_factor_enabled, sessions, login_activity },
    //   connected_centers: [...] }
    const res = await hospitalService.getSettings()

    Object.assign(profile, res?.profile ?? {})
    Object.assign(hospitalInfo, res?.hospital_info ?? {})
    Object.assign(notificationPrefs, res?.notification_preferences ?? {})
    Object.assign(systemPrefs, res?.system_preferences ?? {})

    security.twoFactorEnabled = !!res?.security?.two_factor_enabled
    security.sessions = res?.security?.sessions ?? []
    security.loginActivity = res?.security?.login_activity ?? []

    connectedCenters.value = res?.connected_centers ?? []

    captureSnapshots()
  } catch (err) {
    console.error('Failed to load settings:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings-page {
  --sp-primary: #1565C0;
  --sp-primary-hover: #0D47A1;
  --sp-bg: #F7F9FC;
  --sp-card: #FFFFFF;
  --sp-border: #E5EAF0;
  --sp-text: #1E293B;
  --sp-text-secondary: #64748B;
  --sp-text-muted: #94A3B8;
  --sp-success: #2E7D32;
  --sp-warning: #F59E0B;
  --sp-danger: #D32F2F;
  --sp-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
  --sp-shadow-hover: 0 10px 28px rgba(15, 23, 42, 0.08);

  font-family: var(--rb-font-sans);
  color: var(--sp-text);
  background: var(--sp-bg);
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 32px 96px;
  box-sizing: border-box;
  position: relative;
}

:global(.dark .settings-page) {
  --sp-bg: #0F172A;
  --sp-card: #1E293B;
  --sp-border: #2A3447;
  --sp-text: #F1F5F9;
  --sp-text-secondary: #94A3B8;
  --sp-text-muted: #64748B;
  --sp-shadow: 0 4px 18px rgba(0, 0, 0, 0.25);
  --sp-shadow-hover: 0 10px 28px rgba(0, 0, 0, 0.32);
}

.settings-page * { box-sizing: border-box; }

.sr-only {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}

.page-inner { display: flex; flex-direction: column; gap: 20px; }

/* ---------- MICRO-INTERACTIONS ---------- */
.fade-in { animation: sp-fade-in-up 0.4s ease both; animation-delay: var(--delay, 0ms); }
@keyframes sp-fade-in-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .fade-in, .skeleton { animation: none !important; transition: none !important; } }

.settings-page button:focus-visible,
.settings-page a:focus-visible,
.settings-page input:focus-visible,
.settings-page select:focus-visible {
  outline: 2px solid var(--sp-primary);
  outline-offset: 2px;
}

/* ---------- HEADER ---------- */
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-title { font-size: 30px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
.page-subtitle { font-size: 15px; font-weight: 400; color: var(--sp-text-secondary); margin: 6px 0 0; max-width: 620px; }

/* ---------- BUTTONS ---------- */
.btn-primary {
  height: 44px; padding: 0 20px; background: var(--sp-primary); color: #fff;
  border: none; border-radius: 12px; font-family: var(--rb-font-sans); font-size: 14px; font-weight: 600;
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}
.btn-primary:hover:not(:disabled) { background: var(--sp-primary-hover); transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: default; transform: none; }
.btn-primary--sm { height: 38px; padding: 0 16px; font-size: 13.5px; border-radius: 10px; }

.btn-ghost {
  height: 44px; padding: 0 18px; background: var(--sp-card); border: 1px solid var(--sp-border);
  border-radius: 12px; color: var(--sp-text); font-weight: 600; font-size: 14px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 8px; transition: border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}
.btn-ghost:hover:not(:disabled) { color: var(--sp-primary); border-color: var(--sp-primary); transform: translateY(-1px); }
.btn-ghost:disabled { opacity: 0.5; cursor: default; transform: none; }
.btn-ghost--sm { height: 36px; padding: 0 14px; font-size: 12.5px; border-radius: 10px; }

/* ---------- LAYOUT ---------- */
.settings-layout { display: grid; grid-template-columns: 280px 1fr; gap: 20px; align-items: start; }

/* ---------- LEFT NAV ---------- */
.settings-nav { position: sticky; top: 20px; }
.settings-nav-scroll { display: flex; flex-direction: column; gap: 4px; }
.nav-item {
  display: flex; align-items: flex-start; gap: 12px; width: 100%; text-align: left;
  padding: 12px 14px; border-radius: 12px; border: none; border-left: 3px solid transparent;
  background: transparent; cursor: pointer; position: relative;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.nav-item:hover { background: var(--sp-card); }
.nav-item--active {
  background: color-mix(in srgb, var(--sp-primary) 8%, var(--sp-card));
  border-left-color: var(--sp-primary);
}
.nav-item-icon {
  width: 34px; height: 34px; border-radius: 10px; background: var(--sp-card); border: 1px solid var(--sp-border);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--sp-text-secondary);
}
.nav-item--active .nav-item-icon { color: var(--sp-primary); border-color: var(--sp-primary); background: var(--sp-card); }
.nav-item-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.nav-item-title { font-size: 14px; font-weight: 600; color: var(--sp-text); }
.nav-item--active .nav-item-title { color: var(--sp-primary); }
.nav-item-desc { font-size: 12px; color: var(--sp-text-muted); line-height: 1.3; }
.nav-item-dot {
  position: absolute; top: 12px; right: 12px; width: 7px; height: 7px; border-radius: 999px;
  background: var(--sp-warning);
}

/* ---------- CONTENT / CARDS ---------- */
.settings-content { min-width: 0; }
.settings-stack { display: flex; flex-direction: column; gap: 20px; }
.settings-card {
  background: var(--sp-card); border: 1px solid var(--sp-border); border-radius: 18px;
  box-shadow: var(--sp-shadow); padding: 24px;
}
.card-title { font-size: 20px; font-weight: 700; margin: 0 0 18px; }
.card-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.card-title-row .card-title { margin-bottom: 0; }
.section-hint { font-size: 13.5px; color: var(--sp-text-secondary); margin: 0 0 16px; line-height: 1.55; }

.verified-badge {
  display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600;
  padding: 4px 10px; border-radius: 999px; background: #2E7D3214; color: var(--sp-success);
}

/* ---------- PROFILE PHOTO ---------- */
.profile-photo-row { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.profile-photo {
  width: 64px; height: 64px; border-radius: 999px; background: var(--sp-bg); border: 1px solid var(--sp-border);
  display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;
  font-size: 20px; font-weight: 700; color: var(--sp-primary);
}
.profile-photo img { width: 100%; height: 100%; object-fit: cover; }
.field-hint { font-size: 12px; color: var(--sp-text-muted); margin: 6px 0 0; }

/* ---------- FIELDS ---------- */
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field--full { grid-column: 1 / -1; }
.field-label { font-size: 14px; font-weight: 600; color: var(--sp-text); }
.field-input {
  height: 44px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--sp-border);
  background: var(--sp-bg); color: var(--sp-text); font-size: 14px; font-family: var(--rb-font-sans);
  outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.field-input:focus { border-color: var(--sp-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sp-primary) 15%, transparent); }
.field-input[readonly] { color: var(--sp-text-muted); cursor: not-allowed; }
.field-error { font-size: 13px; color: var(--sp-danger); margin: -6px 0 12px; }

.card-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--sp-border); }
.card-actions--start { justify-content: flex-start; border-top: none; padding-top: 0; margin-top: 0; }

/* ---------- TOGGLES ---------- */
.toggle-list { display: flex; flex-direction: column; }
.toggle-row {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 16px 0; border-bottom: 1px solid var(--sp-border);
}
.toggle-row:last-child { border-bottom: none; }
.toggle-text { min-width: 0; }
.toggle-title { font-size: 14px; font-weight: 600; color: var(--sp-text); margin: 0 0 2px; }
.toggle-desc { font-size: 13px; color: var(--sp-text-secondary); margin: 0; line-height: 1.4; }

.toggle-switch { position: relative; display: inline-flex; flex-shrink: 0; cursor: pointer; }
.toggle-switch input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
.toggle-track {
  width: 42px; height: 24px; border-radius: 999px; background: var(--sp-border);
  display: inline-flex; align-items: center; padding: 3px; transition: background 0.2s ease;
}
.toggle-thumb {
  width: 18px; height: 18px; border-radius: 999px; background: #fff; box-shadow: 0 1px 3px rgba(15,23,42,0.25);
  transition: transform 0.2s cubic-bezier(0.22,1,0.36,1);
}
.toggle-switch input:checked + .toggle-track { background: var(--sp-primary); }
.toggle-switch input:checked + .toggle-track .toggle-thumb { transform: translateX(18px); }
.toggle-switch input:focus-visible + .toggle-track { outline: 2px solid var(--sp-primary); outline-offset: 2px; }

/* ---------- SEGMENTED (THEME) ---------- */
.segmented { display: inline-flex; background: var(--sp-bg); border: 1px solid var(--sp-border); border-radius: 10px; padding: 3px; width: fit-content; }
.segmented-btn {
  border: none; background: transparent; color: var(--sp-text-secondary); font-size: 13px; font-weight: 600;
  padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: background 0.15s ease, color 0.15s ease;
}
.segmented-btn.active { background: var(--sp-card); color: var(--sp-primary); box-shadow: 0 1px 2px rgba(15,23,42,0.08); }

/* ---------- STATUS BADGES ---------- */
.status-badge { font-size: 12px; font-weight: 600; padding: 4px 11px; border-radius: 999px; white-space: nowrap; }
.status-badge--success { background: #2E7D3214; color: var(--sp-success); }
.status-badge--warning { background: #F59E0B14; color: var(--sp-warning); }
.status-badge--danger { background: #D32F2F14; color: var(--sp-danger); }
.status-badge--primary { background: #1565C014; color: var(--sp-primary); }
.status-badge--muted { background: #64748B14; color: var(--sp-text-secondary); }

/* ---------- SESSIONS ---------- */
.session-list { display: flex; flex-direction: column; gap: 4px; }
.session-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--sp-border); }
.session-row:last-child { border-bottom: none; }
.session-icon {
  width: 36px; height: 36px; border-radius: 10px; background: var(--sp-bg); display: flex;
  align-items: center; justify-content: center; color: var(--sp-text-secondary); flex-shrink: 0;
}
.session-body { flex: 1; min-width: 0; }
.session-device { font-size: 14px; font-weight: 600; color: var(--sp-text); margin: 0; }
.session-meta { font-size: 12.5px; color: var(--sp-text-muted); margin: 2px 0 0; }

/* ---------- ACTIVITY TABLE ---------- */
.activity-table-wrap { overflow-x: auto; border: 1px solid var(--sp-border); border-radius: 12px; }
.activity-table { width: 100%; border-collapse: collapse; min-width: 520px; }
.activity-table th {
  text-align: left; font-size: 12.5px; font-weight: 600; color: var(--sp-text-secondary);
  padding: 12px 16px; border-bottom: 1px solid var(--sp-border); background: var(--sp-bg);
}
.activity-table td { font-size: 13.5px; padding: 12px 16px; border-bottom: 1px solid var(--sp-border); color: var(--sp-text); }
.activity-table tr:last-child td { border-bottom: none; }

.empty-hint { font-size: 13.5px; color: var(--sp-text-muted); padding: 8px 0; }

/* ---------- CONNECTED CENTERS ---------- */
.center-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.center-card { border: 1px solid var(--sp-border); border-radius: 14px; padding: 16px; }
.center-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.center-name { font-size: 14.5px; font-weight: 700; color: var(--sp-text); margin: 0; }
.center-meta { font-size: 12px; color: var(--sp-text-muted); margin: 3px 0 0; }
.center-contact {
  display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--sp-text-secondary); margin: 0 0 12px;
}
.notif-action-link {
  display: inline-flex; align-items: center; gap: 4px; border: none; background: none;
  color: var(--sp-primary); font-size: 13px; font-weight: 600; padding: 0; cursor: pointer;
}
.notif-action-link:hover { text-decoration: underline; }

/* ---------- STICKY SAVE BAR ---------- */
.save-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
  background: var(--sp-card); border-top: 1px solid var(--sp-border); box-shadow: 0 -8px 24px rgba(15,23,42,0.08);
}
.save-bar-inner {
  max-width: 1400px; margin: 0 auto; padding: 14px 32px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
}
.save-bar-text { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; color: var(--sp-warning); }
.save-bar-actions { display: flex; gap: 10px; }

.savebar-enter-active, .savebar-leave-active { transition: transform 0.25s ease, opacity 0.25s ease; }
.savebar-enter-from, .savebar-leave-to { transform: translateY(100%); opacity: 0; }

/* ---------- TOAST ---------- */
.toast {
  position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); z-index: 50;
  display: inline-flex; align-items: center; gap: 8px; background: var(--sp-card); border: 1px solid var(--sp-border);
  border-radius: 12px; padding: 12px 18px; box-shadow: var(--sp-shadow-hover); font-size: 13.5px; font-weight: 600; color: var(--sp-text);
}
.toast-enter-active, .toast-leave-active { transition: transform 0.25s ease, opacity 0.25s ease; }
.toast-enter-from, .toast-leave-to { transform: translate(-50%, 8px); opacity: 0; }

/* ---------- SKELETON ---------- */
.skeleton {
  background: linear-gradient(90deg, var(--sp-border) 25%, rgba(255,255,255,0.4) 37%, var(--sp-border) 63%);
  background-size: 400% 100%; border-radius: 18px; animation: sp-shimmer 1.4s ease infinite;
}
:global(.dark .skeleton) {
  background: linear-gradient(90deg, #2A3447 25%, #3A4763 37%, #2A3447 63%);
  background-size: 400% 100%;
}
.skeleton--title { height: 56px; max-width: 380px; }
.skeleton--nav { height: 480px; }
.skeleton--panel { border-radius: 18px; }
@keyframes sp-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

/* ---------- RESPONSIVE ---------- */
@media (max-width: 1024px) {
  .settings-layout { grid-template-columns: 1fr; }
  .settings-nav { position: static; }
  .settings-nav-scroll {
    flex-direction: row; overflow-x: auto; gap: 8px; padding-bottom: 4px; scrollbar-width: none;
  }
  .settings-nav-scroll::-webkit-scrollbar { display: none; }
  .nav-item {
    flex-shrink: 0; width: auto; flex-direction: row; align-items: center; border-left: none;
    border-bottom: 3px solid transparent; border-radius: 10px 10px 0 0; padding: 10px 14px;
  }
  .nav-item--active { border-bottom-color: var(--sp-primary); }
  .nav-item-desc { display: none; }
  .skeleton--nav { height: 56px; }
}
@media (max-width: 640px) {
  .settings-page { padding: 20px 16px 100px; }
  .page-title { font-size: 24px; }
  .field-grid { grid-template-columns: 1fr; }
  .center-list { grid-template-columns: 1fr; }
  .card-actions { flex-direction: column-reverse; align-items: stretch; }
  .card-actions .btn-primary, .card-actions .btn-ghost { width: 100%; justify-content: center; }
  .save-bar-inner { padding: 12px 16px; flex-direction: column; align-items: stretch; }
  .save-bar-actions { width: 100%; }
  .save-bar-actions .btn-ghost, .save-bar-actions .btn-primary { flex: 1; justify-content: center; }
}
</style>