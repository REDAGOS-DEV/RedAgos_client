<template>
  <div class="settings-page">
    <!-- ===================== LOADING SKELETON ===================== -->
    <div v-if="loading" class="settings-inner" aria-busy="true">
      <div class="skeleton skeleton--banner" />
      <div class="skeleton skeleton--tabs" />
      <div class="skeleton skeleton--panel" />
    </div>

    <div v-else class="settings-inner">
      <!-- ===================== WHO THIS IS ===================== -->
      <section class="id-banner" aria-label="Your account">
        <div class="id-banner__avatar-wrap">
          <div class="id-banner__avatar">
            <img v-if="profile.photo_url" :src="profile.photo_url" alt="Profile photo" />
            <span v-else>{{ initials(bannerName) }}</span>
          </div>
          <button type="button" class="id-banner__camera" title="Change photo" aria-label="Change photo" @click="triggerPhotoUpload">
            <AssetIcon name="camera" :size="14" />
          </button>
        </div>

        <div class="id-banner__who">
          <h1 class="id-banner__name">{{ bannerName || 'Your account' }}</h1>
          <p class="id-banner__role">
            {{ roleLabel }}<template v-if="bannerFacility"> · {{ bannerFacility }}</template>
          </p>
          <div class="id-banner__chips">
            <span v-if="hospitalInfo.license_number" class="chip"><AssetIcon name="id-card" :size="12" /> {{ hospitalInfo.license_number }}</span>
            <span v-if="hospitalInfo.verified" class="chip chip--ok"><AssetIcon name="badge-check" :size="12" /> Verified facility</span>
            <span v-if="profile.employee_id" class="chip"><AssetIcon name="user-circle" :size="12" /> {{ profile.employee_id }}</span>
          </div>
        </div>
      </section>

      <!-- ===================== SECTIONS AS PILL TABS ===================== -->
      <nav class="tabbar" aria-label="Settings sections">
        <button
          v-for="item in navItems"
          :key="item.key"
          type="button"
          class="tab"
          :class="{ 'tab--active': activeSection === item.key }"
          :aria-current="activeSection === item.key ? 'page' : undefined"
          @click="switchSection(item.key)"
        >
          <AssetIcon :name="item.icon" :size="15" />
          {{ item.label }}
          <span v-if="dirtySections.has(item.key)" class="tab__dot" aria-label="Unsaved changes" />
        </button>
      </nav>

      <!-- ===================== PROFILE ===================== -->
      <section v-if="activeSection === 'profile'" class="card card--split">
        <aside class="card__aside">
          <span class="aside-icon"><AssetIcon name="user-circle" :size="22" /></span>
          <h2 class="card__title">Profile</h2>
          <p class="card__sub">Your personal account details. Blood centers see your name and position on the requests you send.</p>
          <div class="photo-row">
            <button type="button" class="ui-btn ui-btn--sm" @click="triggerPhotoUpload">
              <AssetIcon name="upload" :size="14" /> Upload Photo
            </button>
            <input ref="photoInput" type="file" accept="image/*" class="sr-only" @change="onPhotoSelected" />
            <p class="form-hint">JPG or PNG, up to 2MB.</p>
          </div>
        </aside>

        <div class="card__main">
          <div class="form-grid">
            <label class="form-group">
              <span class="form-label">Full Name</span>
              <input v-model="profile.full_name" type="text" class="form-input" />
            </label>
            <label class="form-group">
              <span class="form-label">Employee ID</span>
              <input v-model="profile.employee_id" type="text" class="form-input" />
            </label>
            <label class="form-group">
              <span class="form-label">Position</span>
              <input v-model="profile.position" type="text" class="form-input" />
            </label>
            <label class="form-group">
              <span class="form-label">Department</span>
              <input v-model="profile.department" type="text" class="form-input" />
            </label>
            <label class="form-group">
              <span class="form-label">Email Address</span>
              <input v-model="profile.email" type="email" class="form-input" />
            </label>
            <label class="form-group">
              <span class="form-label">Mobile Number</span>
              <input v-model="profile.mobile" type="tel" class="form-input" />
            </label>
          </div>

          <div class="card__foot card__foot--flat">
            <button type="button" class="ui-btn" :disabled="!isDirty('profile')" @click="discardSection('profile')">Cancel</button>
            <button type="button" class="ui-btn ui-btn--primary" :disabled="!isDirty('profile') || saving" @click="saveSection('profile')">Save Changes</button>
          </div>
        </div>
      </section>

      <!-- ===================== HOSPITAL INFORMATION ===================== -->
      <section v-else-if="activeSection === 'hospital'" class="card card--split">
        <aside class="card__aside">
          <span class="aside-icon"><AssetIcon name="building-2" :size="22" /></span>
          <h2 class="card__title">Hospital Information</h2>
          <p class="card__sub">Your facility and blood bank, as blood centers see them when you request blood.</p>
          <span v-if="hospitalInfo.verified" class="verified-badge">
            <AssetIcon name="badge-check" :size="14" /> Verified
          </span>
          <dl class="aside-facts">
            <div>
              <dt>License number</dt>
              <dd class="mono">{{ hospitalInfo.license_number || '—' }}</dd>
            </div>
          </dl>
        </aside>

        <div class="card__main">
          <div class="form-grid">
            <label class="form-group">
              <span class="form-label">Hospital Name</span>
              <input v-model="hospitalInfo.hospital_name" type="text" class="form-input" />
            </label>
            <label class="form-group">
              <span class="form-label">Blood Bank Name</span>
              <input v-model="hospitalInfo.blood_bank_name" type="text" class="form-input" />
            </label>
            <label class="form-group form-group--full">
              <span class="form-label">Hospital Address</span>
              <input v-model="hospitalInfo.address" type="text" class="form-input" />
            </label>
            <label class="form-group">
              <span class="form-label">Contact Number</span>
              <input v-model="hospitalInfo.contact_number" type="tel" class="form-input" />
            </label>
            <label class="form-group">
              <span class="form-label">Email Address</span>
              <input v-model="hospitalInfo.email" type="email" class="form-input" />
            </label>
            <label class="form-group">
              <span class="form-label">Operating Hours</span>
              <input v-model="hospitalInfo.operating_hours" type="text" class="form-input" placeholder="e.g. Mon–Sun, 24 Hours" />
            </label>
            <label class="form-group">
              <span class="form-label">Hospital License Number</span>
              <input :value="hospitalInfo.license_number" type="text" class="form-input" readonly />
            </label>
          </div>

          <div class="card__foot card__foot--flat">
            <button type="button" class="ui-btn" :disabled="!isDirty('hospital')" @click="discardSection('hospital')">Cancel</button>
            <button type="button" class="ui-btn ui-btn--primary" :disabled="!isDirty('hospital') || saving" @click="saveSection('hospital')">Save Changes</button>
          </div>
        </div>
      </section>

      <!-- ===================== NOTIFICATION PREFERENCES ===================== -->
      <template v-else-if="activeSection === 'notifications'">
        <section class="card">
          <header class="card__head">
            <div>
              <h2 class="card__title">What you hear about</h2>
              <p class="card__sub">The updates RedAgos sends you about your requests, stock and account.</p>
            </div>
          </header>
          <div class="toggle-list">
            <div v-for="opt in notificationTopics" :key="opt.key" class="toggle-row">
              <span class="toggle-icon"><AssetIcon :name="opt.icon" :size="16" /></span>
              <div class="toggle-text">
                <p class="toggle-title">{{ opt.label }}</p>
                <p class="toggle-desc">{{ opt.description }}</p>
              </div>
              <label class="toggle-switch">
                <input v-model="notificationPrefs[opt.key]" type="checkbox" :aria-label="opt.label" />
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
              </label>
            </div>
          </div>
        </section>

        <section class="card">
          <header class="card__head">
            <div>
              <h2 class="card__title">How you hear about it</h2>
              <p class="card__sub">Where those updates reach you.</p>
            </div>
          </header>
          <div class="channels">
            <label
              v-for="opt in notificationChannels"
              :key="opt.key"
              class="channel"
              :class="{ 'channel--on': notificationPrefs[opt.key] }"
            >
              <span class="channel__icon"><AssetIcon :name="opt.icon" :size="18" /></span>
              <span class="channel__text">
                <span class="channel__title">{{ opt.label }}</span>
                <span class="channel__desc">{{ opt.description }}</span>
              </span>
              <span class="toggle-switch">
                <input v-model="notificationPrefs[opt.key]" type="checkbox" :aria-label="opt.label" />
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
              </span>
            </label>
          </div>
        </section>
      </template>

      <!-- ===================== SECURITY ===================== -->
      <template v-else-if="activeSection === 'security'">
        <section class="card card--split">
          <aside class="card__aside">
            <span class="aside-icon"><AssetIcon name="lock" :size="22" /></span>
            <h2 class="card__title">Change Password</h2>
            <p class="card__sub">Use a password you do not use anywhere else. You stay signed in on this device.</p>
          </aside>
          <div class="card__main">
            <div class="form-grid">
              <label class="form-group form-group--full">
                <span class="form-label">Current Password</span>
                <input v-model="passwordForm.current" type="password" class="form-input" autocomplete="current-password" />
              </label>
              <label class="form-group">
                <span class="form-label">New Password</span>
                <input v-model="passwordForm.new" type="password" class="form-input" autocomplete="new-password" />
              </label>
              <label class="form-group">
                <span class="form-label">Confirm Password</span>
                <input v-model="passwordForm.confirm" type="password" class="form-input" autocomplete="new-password" />
              </label>
            </div>
            <p v-if="passwordError" class="note note--error" role="alert">
              <AssetIcon name="circle-alert" :size="14" /> {{ passwordError }}
            </p>
            <div class="card__foot card__foot--flat">
              <button type="button" class="ui-btn ui-btn--primary" :disabled="updatingPassword" @click="updatePassword">
                {{ updatingPassword ? 'Updating…' : 'Update Password' }}
              </button>
            </div>
          </div>
        </section>

        <section class="card">
          <header class="card__head">
            <div class="head-with-icon">
              <span class="head-icon"><AssetIcon name="shield-check" :size="18" /></span>
              <div>
                <h2 class="card__title">Two-Factor Authentication</h2>
                <p class="card__sub">Add an extra layer of security to your account by requiring a verification code at sign-in.</p>
                <!-- RedAgos has no two-factor sign-in yet (no server support), so the
                     button says so instead of doing nothing when pressed. -->
                <p class="coming-note"><AssetIcon name="info" :size="13" /> Not available yet. Two-factor sign-in is coming to RedAgos.</p>
              </div>
            </div>
            <div class="head-actions">
              <StatusBadge tone="neutral">Coming soon</StatusBadge>
              <button type="button" class="ui-btn ui-btn--sm" disabled title="Two-factor sign-in is not available yet" @click="manageTwoFactor">Manage</button>
            </div>
          </header>
        </section>

        <section class="card">
          <header class="card__head">
            <div class="head-with-icon">
              <span class="head-icon"><AssetIcon name="monitor" :size="18" /></span>
              <div>
                <h2 class="card__title">Active Sessions</h2>
                <p class="card__sub">Devices signed in to this account.</p>
              </div>
            </div>
            <button type="button" class="ui-btn ui-btn--sm" :disabled="loggingOutSessions" @click="logoutOtherSessions">
              <AssetIcon name="log-out" :size="14" /> Log Out Other Sessions
            </button>
          </header>
          <div v-if="security.sessions.length" class="session-list">
            <div v-for="s in security.sessions" :key="s.id" class="session-row">
              <div class="session-icon"><AssetIcon :name="s.device_type === 'mobile' ? 'smartphone' : 'monitor'" :size="18" /></div>
              <div class="session-body">
                <p class="session-device">{{ s.device }} · {{ s.browser }}</p>
                <p class="session-meta">{{ s.location }} · Last active {{ formatRelative(s.last_active) }}</p>
              </div>
              <StatusBadge v-if="s.is_current" tone="info">This device</StatusBadge>
            </div>
          </div>
          <EmptyState v-else icon="monitor" title="No active session data available." compact />
        </section>

        <section class="card">
          <header class="card__head">
            <div class="head-with-icon">
              <span class="head-icon"><AssetIcon name="history" :size="18" /></span>
              <div>
                <h2 class="card__title">Login Activity</h2>
                <p class="card__sub">Recent sign-ins to this account.</p>
              </div>
            </div>
          </header>
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
          <EmptyState v-else icon="history" title="No login activity recorded yet." compact />
        </section>
      </template>

      <!-- ===================== CONNECTED BLOOD CENTERS ===================== -->
      <section v-else-if="activeSection === 'centers'" class="card">
        <header class="card__head">
          <div>
            <h2 class="card__title">Connected Blood Centers</h2>
            <p class="card__sub">The blood centers your blood bank requests from and receives deliveries of.</p>
          </div>
        </header>

        <div v-if="connectedCenters.length" class="center-list">
          <div v-for="c in connectedCenters" :key="c.id" class="center-card">
            <div class="center-card-top">
              <span class="center-icon"><AssetIcon name="hospital" :size="18" /></span>
              <div class="center-who">
                <p class="center-name">{{ c.name }}</p>
                <p class="center-meta">Last sync {{ formatRelative(c.last_sync) }}</p>
              </div>
              <StatusBadge :tone="centerTone(c.status)">{{ centerStatusLabel(c.status) }}</StatusBadge>
            </div>
            <p class="center-contact">
              <AssetIcon name="phone" :size="13" /> {{ c.contact_number || '—' }}
            </p>
            <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm center-link" @click="viewCenterDetails(c)">
              View Details
              <AssetIcon name="arrow-right" :size="14" />
            </button>
          </div>
        </div>
        <EmptyState v-else icon="link" title="No connected blood centers yet." description="Blood centers appear here once your blood bank is linked to them." />
      </section>

      <!-- ===================== APPEARANCE ===================== -->
      <!-- The same portal colour as the blood center and donor Settings; it applies at once. -->
      <template v-else-if="activeSection === 'appearance'">
        <section class="card card--appearance">
          <div class="card__main">
            <h2 class="card__title">Portal colour</h2>
            <p class="card__sub">Pick a colour for your portal. It changes buttons, links, highlights and the sidebar in every RedAgos portal on this device.</p>
            <div class="swatches" role="radiogroup" aria-label="Portal colour">
              <button
                v-for="t in accentThemes"
                :key="t.key"
                type="button"
                role="radio"
                class="swatch"
                :class="{ 'swatch--on': accentKey === t.key }"
                :aria-checked="accentKey === t.key"
                @click="setAccent(t.key)"
              >
                <span class="swatch__circle" :style="{ background: `linear-gradient(135deg, ${t.gradFrom}, ${t.gradTo})`, '--ring': t.primary }">
                  <span class="swatch__dot" :style="{ background: t.primary }" />
                  <span v-if="accentKey === t.key" class="swatch__check" :style="{ background: t.primary }">
                    <AssetIcon name="check" :size="12" />
                  </span>
                </span>
                <span class="swatch__name">{{ t.name }}</span>
              </button>
            </div>
          </div>

          <!-- A tiny hospital screen in the picked colour -->
          <div class="mini" aria-hidden="true">
            <div class="mini__rail">
              <span class="mini__logo" />
              <span class="mini__icon mini__icon--on" />
              <span class="mini__icon" />
              <span class="mini__icon" />
              <span class="mini__icon" />
            </div>
            <div class="mini__body">
              <div class="mini__hero">
                <span class="mini__line mini__line--sm" />
                <span class="mini__line" />
                <span class="mini__btn">New request</span>
              </div>
              <div class="mini__row">
                <span class="mini__card"><span class="mini__num">42</span><span class="mini__cap">In stock</span></span>
                <span class="mini__card"><span class="mini__num">3</span><span class="mini__cap">Pending</span></span>
              </div>
              <div class="mini__row mini__row--end">
                <span class="mini__chip">STAT</span>
                <span class="mini__toggle"><span /></span>
              </div>
            </div>
            <p class="mini__label">Preview</p>
          </div>
        </section>

        <section class="card">
          <header class="card__head">
            <div>
              <h2 class="card__title">Mode</h2>
              <p class="card__sub">Light, dark, or the same as your browser. Applies at once on this device.</p>
            </div>
          </header>
          <div class="mode-cards" role="radiogroup" aria-label="Mode">
            <button
              v-for="opt in themeOptions"
              :key="opt.key"
              type="button"
              role="radio"
              class="mode-card"
              :class="{ 'mode-card--on': themeMode === opt.key }"
              :aria-checked="themeMode === opt.key"
              @click="selectTheme(opt.key)"
            >
              <span class="mode-card__preview" :class="`mode-card__preview--${opt.key}`">
                <span class="mode-card__bar" />
                <span class="mode-card__line mode-card__line--1" />
                <span class="mode-card__line mode-card__line--2" />
              </span>
              <span class="mode-card__label">
                <AssetIcon :name="opt.icon" :size="15" />
                {{ opt.label }}
              </span>
              <span v-if="themeMode === opt.key" class="mode-card__check"><AssetIcon name="check" :size="12" /></span>
            </button>
          </div>
        </section>
      </template>

      <!-- ===================== SYSTEM PREFERENCES ===================== -->
      <section v-else-if="activeSection === 'system'" class="card card--split">
        <aside class="card__aside">
          <span class="aside-icon"><AssetIcon name="settings" :size="22" /></span>
          <h2 class="card__title">Application Preferences</h2>
          <p class="card__sub">Language, time and how dates read across the portal. The light and dark mode now lives under Appearance.</p>
        </aside>
        <div class="card__main">
          <div class="form-grid">
            <label class="form-group">
              <span class="form-label">Language</span>
              <SelectField v-model="systemPrefs.language" :options="[{ value: 'en', label: 'English' }]" />
            </label>
            <label class="form-group">
              <span class="form-label">Timezone</span>
              <SelectField v-model="systemPrefs.timezone" :options="[{ value: 'Asia/Manila', label: 'Asia/Manila' }]" />
            </label>
            <label class="form-group">
              <span class="form-label">Date Format</span>
              <SelectField v-model="systemPrefs.date_format" :options="[{ value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' }, { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' }, { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }]" />
            </label>
            <label class="form-group">
              <span class="form-label">Time Format</span>
              <SelectField v-model="systemPrefs.time_format" :options="[{ value: '12h', label: '12-Hour' }, { value: '24h', label: '24-Hour' }]" />
            </label>
          </div>

          <div class="toggle-row toggle-row--boxed">
            <span class="toggle-icon"><AssetIcon name="list" :size="16" /></span>
            <div class="toggle-text">
              <p class="toggle-title">Compact Mode</p>
              <p class="toggle-desc">Reduce spacing and element sizes for a denser layout.</p>
            </div>
            <label class="toggle-switch">
              <input v-model="systemPrefs.compact_mode" type="checkbox" aria-label="Compact Mode" />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
          </div>

          <div class="card__foot card__foot--flat">
            <button type="button" class="ui-btn" :disabled="!isDirty('system')" @click="discardSection('system')">Cancel</button>
            <button type="button" class="ui-btn ui-btn--primary" :disabled="!isDirty('system') || saving" @click="saveSection('system')">Save Changes</button>
          </div>
        </div>
      </section>
    </div>

    <!-- ===================== STICKY SAVE BAR ===================== -->
    <Transition name="savebar">
      <div v-if="dirtySections.size > 0" class="save-bar" role="region" aria-label="Unsaved changes">
        <span class="save-bar-text">
          <AssetIcon name="circle-alert" :size="16" />
          You have unsaved changes
        </span>
        <div class="save-bar-actions">
          <button type="button" class="ui-btn ui-btn--sm" @click="discardAll">Discard Changes</button>
          <button type="button" class="ui-btn ui-btn--primary ui-btn--sm" :disabled="saving" @click="saveAll">
            {{ saving ? 'Saving…' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- ===================== SUCCESS TOAST ===================== -->
    <Transition name="toast">
      <div v-if="toastMessage" class="toast" role="status">
        <AssetIcon name="circle-check-big" :size="16" class="toast__icon" />
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { useAccentTheme } from '~/composables/useAccentTheme'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import SelectField from '~/components/common/SelectField.vue'
import StatusBadge from '~/components/ui/StatusBadge.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import { useUser } from '~/composables/useUser'
import { useDarkMode } from '~/composables/useDarkMode'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

const loading = ref(true)
const saving = ref(false)
const toastMessage = ref('')
let toastTimer = null

// ======================= NAVIGATION =======================
// Shown as pill tabs (2026-10-15), so the labels are short.
const navItems = [
  { key: 'profile', label: 'Profile', description: 'Your personal account details', icon: 'user-circle' },
  { key: 'hospital', label: 'Hospital', description: 'Facility and blood bank details', icon: 'building-2' },
  { key: 'notifications', label: 'Notifications', description: 'Choose what updates you receive', icon: 'bell' },
  { key: 'security', label: 'Security', description: 'Password, 2FA, and sessions', icon: 'shield-check' },
  { key: 'centers', label: 'Blood Centers', description: 'Manage linked institutions', icon: 'link' },
  { key: 'appearance', label: 'Appearance', description: 'Portal colour and mode', icon: 'palette' },
  { key: 'system', label: 'Preferences', description: 'Language and formats', icon: 'settings' },
]

// ======================= WHO THIS IS (the banner) =======================
// The form's values once loaded, else the signed-in account, so the banner
// always says who this is.
const { user } = useUser()
const bannerName = computed(() => profile.full_name || user.value?.full_name || '')
const bannerFacility = computed(() => hospitalInfo.hospital_name || user.value?.facility?.facility_name || user.value?.facility?.name || '')
const roleLabel = computed(() => profile.position || user.value?.hospital_role_label || 'Hospital Staff')

// The portal colour, shared with the blood center and donor portals on this device.
const { current: accentKey, themes: accentThemes, set: setAccent } = useAccentTheme()
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

// Topics, then channels: the two questions a person actually asks here.
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
const TOPIC_ICONS = {
  blood_request_updates: 'clipboard-list',
  blood_ready_pickup: 'package-check',
  blood_availability_alerts: 'droplets',
  billing_notifications: 'receipt',
  system_announcements: 'info',
}
const CHANNEL_LABELS = {
  email_notifications: { label: 'Email', icon: 'mail', description: 'To your account email' },
  inapp_notifications: { label: 'In-app', icon: 'bell', description: 'In the bell, top right' },
  sms_notifications: { label: 'SMS', icon: 'smartphone', description: 'Urgent alerts only' },
}
const notificationTopics = notificationOptions
  .filter((opt) => TOPIC_ICONS[opt.key])
  .map((opt) => ({ ...opt, icon: TOPIC_ICONS[opt.key] }))
const notificationChannels = notificationOptions
  .filter((opt) => CHANNEL_LABELS[opt.key])
  .map((opt) => ({ key: opt.key, ...CHANNEL_LABELS[opt.key] }))

const themeOptions = [
  { key: 'light', label: 'Light', icon: 'sun' },
  { key: 'dark', label: 'Dark', icon: 'moon' },
  { key: 'system', label: 'System', icon: 'monitor' },
]

// The mode used to be a preference that only took effect once saved; it now
// switches the portal at once, and stays in the saved preferences too.
const { themeMode, setThemeMode } = useDarkMode()
function selectTheme(value) {
  setThemeMode(value)
  systemPrefs.theme = value
  // The mode is already applied, so it is not an unsaved change; anything
  // else edited under Preferences still is.
  if (snapshots.system) {
    snapshots.system = JSON.stringify({ ...JSON.parse(snapshots.system), theme: value })
  }
}

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
function centerTone(status) {
  return { connected: 'success', disconnected: 'danger', pending: 'warning' }[status] || 'neutral'
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
  } catch (err) {
    console.error('Failed to load settings:', err)
  } finally {
    // Also after a failed load: otherwise every section read as changed and
    // the unsaved-changes bar showed before anything was touched.
    captureSnapshots()
    loading.value = false
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
/*
 * Hospital Settings (2026-10-15): the blood center's settings, on the shared
 * tokens, so dark mode and the portal colour follow on their own.
 */
.settings-page {
  max-width: var(--rb-content-max, 1600px);
  min-height: 100%;
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 96px;
  background: var(--rb-page-bg);
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}
.settings-inner { display: flex; flex-direction: column; gap: 18px; }
.sr-only {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}
.mono { font-family: var(--rb-font-mono, ui-monospace, monospace); }

/* ── Skeleton ── */
.skeleton {
  border-radius: 22px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--banner { height: 118px; }
.skeleton--tabs { width: 640px; max-width: 100%; height: 46px; border-radius: 999px; }
.skeleton--panel { height: 420px; }
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

/* ── Who this is ── */
.id-banner {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 22px 24px;
  overflow: hidden;
  border: 1px solid var(--rb-border);
  border-radius: 24px;
  background:
    radial-gradient(70% 140% at 100% 0%, rgba(var(--rb-primary-rgb), 0.14), transparent 60%),
    var(--rb-surface);
  box-shadow: var(--rb-shadow-sm);
}
.id-banner__avatar-wrap { position: relative; flex-shrink: 0; }
.id-banner__avatar {
  display: flex; align-items: center; justify-content: center;
  width: 72px; height: 72px; overflow: hidden; border-radius: 22px;
  background: var(--rb-primary); color: #fff; font-size: 24px; font-weight: 800;
  box-shadow: 0 0 0 4px var(--rb-surface), 0 10px 24px -12px rgba(15, 23, 42, 0.5);
}
.id-banner__avatar img { width: 100%; height: 100%; object-fit: cover; }
.id-banner__camera {
  position: absolute; right: -6px; bottom: -6px;
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border: 3px solid var(--rb-surface); border-radius: 50%;
  background: var(--rb-primary); color: #fff; cursor: pointer;
}
.id-banner__camera:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.id-banner__who { flex: 1; min-width: 0; }
.id-banner__name {
  margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.01em;
  color: var(--rb-text-primary); text-transform: capitalize;
}
.id-banner__role { margin: 2px 0 0; font-size: 13.5px; color: var(--rb-text-secondary); }
.id-banner__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px;
  background: var(--rb-surface-alt); color: var(--rb-text-secondary); font-size: 12px; font-weight: 600;
}
.chip--ok { background: rgba(var(--rb-success-rgb), 0.1); color: var(--rb-success-text); }

/* ── Tab bar ── */
.tabbar {
  display: flex; gap: 4px; width: fit-content; max-width: 100%; padding: 4px;
  overflow-x: auto; border: 1px solid var(--rb-border); border-radius: 999px;
  background: var(--rb-surface); box-shadow: var(--rb-shadow-sm); scrollbar-width: none;
}
.tab {
  position: relative; display: inline-flex; flex-shrink: 0; align-items: center; gap: 7px;
  padding: 8px 16px; border: none; border-radius: 999px; background: transparent;
  color: var(--rb-text-secondary); font: inherit; font-size: 13.5px; font-weight: 600;
  white-space: nowrap; cursor: pointer; transition: background-color 0.15s ease, color 0.15s ease;
}
.tab:hover:not(.tab--active) { background: var(--rb-surface-hover); color: var(--rb-text-primary); }
.tab--active { background: var(--rb-primary); color: #fff; box-shadow: 0 6px 14px -8px rgba(var(--rb-primary-rgb), 0.8); }
.tab:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
/* Unsaved changes in this section */
.tab__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--rb-warning); }
.tab--active .tab__dot { background: #fff; }

/* ── Cards ── */
.card {
  border: 1px solid var(--rb-border);
  border-radius: 22px;
  background: var(--rb-surface);
  box-shadow: var(--rb-shadow-sm);
}
.card__head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 22px 24px 16px;
}
.card__title { margin: 0; font-size: 15.5px; font-weight: 700; color: var(--rb-text-primary); }
.card__sub { margin: 3px 0 0; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); max-width: 64ch; }
.card__foot { display: flex; justify-content: flex-end; gap: 10px; }
.card__foot--flat { margin-top: 4px; }

.head-with-icon { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.head-icon {
  display: flex; flex-shrink: 0; align-items: center; justify-content: center;
  width: 38px; height: 38px; border-radius: 12px;
  background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text);
}
.head-actions { display: flex; flex-shrink: 0; align-items: center; gap: 10px; }
.coming-note { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); }

/* Split card: a short explainer on the left, the controls on the right */
.card--split { display: grid; grid-template-columns: 280px minmax(0, 1fr); }
.card__aside {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 24px; border-right: 1px solid var(--rb-border); border-radius: 22px 0 0 22px;
  background: var(--rb-surface-alt);
}
.card__main { display: flex; flex-direction: column; gap: 16px; min-width: 0; padding: 24px; }
.aside-icon {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; margin-bottom: 10px; border-radius: 14px;
  background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text);
}
.aside-facts { margin: 14px 0 0; }
.aside-facts dt { font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); }
.aside-facts dd { margin: 2px 0 0; font-size: 13.5px; font-weight: 600; color: var(--rb-text-primary); }
.photo-row { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin-top: 14px; }

.verified-badge {
  display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; padding: 3px 10px;
  border-radius: 999px; background: rgba(var(--rb-success-rgb), 0.1);
  color: var(--rb-success-text); font-size: 12px; font-weight: 700;
}

/* ── Forms ── */
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.form-group--full { grid-column: 1 / -1; }
.form-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); }
.form-hint { margin: 0; font-size: 12px; color: var(--rb-text-secondary); }
.form-input {
  width: 100%; height: 42px; padding: 0 12px; border: 1px solid var(--rb-border-strong);
  border-radius: 10px; background: var(--rb-surface); color: var(--rb-text-primary);
  font: inherit; font-size: 14px; transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.form-input:hover:not(:focus):not([readonly]) { border-color: var(--rb-text-muted); }
.form-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.12); }
.form-input[readonly] { background: var(--rb-surface-alt); color: var(--rb-text-secondary); cursor: default; }

.note { display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 10px; font-size: 13px; }
.note--error { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); }

/* ── Toggles ── */
.toggle-list { display: flex; flex-direction: column; padding: 0 24px 10px; }
.toggle-row {
  display: flex; align-items: center; gap: 14px; padding: 14px 0;
  border-top: 1px solid var(--rb-border);
}
.toggle-list .toggle-row:first-child { border-top: none; padding-top: 4px; }
.toggle-row--boxed { padding: 14px 16px; border: 1px solid var(--rb-border); border-radius: 14px; }
.toggle-icon {
  display: flex; flex-shrink: 0; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 10px;
  background: var(--rb-surface-alt); color: var(--rb-text-secondary);
}
.toggle-text { flex: 1; min-width: 0; }
.toggle-title { margin: 0; font-size: 14px; font-weight: 600; color: var(--rb-text-primary); }
.toggle-desc { margin: 2px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.toggle-switch { position: relative; display: inline-flex; flex-shrink: 0; cursor: pointer; }
.toggle-switch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.toggle-track {
  display: inline-flex; align-items: center; width: 42px; height: 24px; padding: 3px;
  border-radius: 999px; background: var(--rb-border-strong); transition: background 0.2s ease;
}
.toggle-thumb {
  width: 18px; height: 18px; border-radius: 999px; background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25); transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.toggle-switch input:checked + .toggle-track { background: var(--rb-primary); }
.toggle-switch input:checked + .toggle-track .toggle-thumb { transform: translateX(18px); }
.toggle-switch input:focus-visible + .toggle-track { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

/* Channels: one tile each, lit when on */
.channels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 0 24px 24px; }
.channel {
  display: flex; align-items: center; gap: 12px; padding: 14px;
  border: 1px solid var(--rb-border); border-radius: 16px; cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.channel:hover { border-color: rgba(var(--rb-primary-rgb), 0.4); }
.channel--on { border-color: rgba(var(--rb-primary-rgb), 0.45); background: rgba(var(--rb-primary-rgb), 0.05); }
.channel__icon {
  display: flex; flex-shrink: 0; align-items: center; justify-content: center;
  width: 38px; height: 38px; border-radius: 12px; background: var(--rb-surface-alt); color: var(--rb-text-secondary);
}
.channel--on .channel__icon { background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); }
.channel__text { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.channel__title { font-size: 14px; font-weight: 600; color: var(--rb-text-primary); }
.channel__desc { font-size: 12px; color: var(--rb-text-secondary); }

/* ── Sessions and activity ── */
.session-list { display: flex; flex-direction: column; padding: 0 24px 12px; }
.session-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--rb-border); }
.session-row:first-child { border-top: none; }
.session-icon {
  display: flex; flex-shrink: 0; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 10px; background: var(--rb-surface-alt); color: var(--rb-text-secondary);
}
.session-body { flex: 1; min-width: 0; }
.session-device { margin: 0; font-size: 14px; font-weight: 600; color: var(--rb-text-primary); }
.session-meta { margin: 2px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }

.activity-table-wrap { margin: 0 24px 24px; overflow-x: auto; border: 1px solid var(--rb-border); border-radius: 14px; }
.activity-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.activity-table th {
  padding: 10px 14px; background: var(--rb-surface-alt); text-align: left; white-space: nowrap;
  font-size: 12px; font-weight: 600; color: var(--rb-text-secondary);
}
.activity-table td { padding: 11px 14px; border-top: 1px solid var(--rb-border); color: var(--rb-text-primary); white-space: nowrap; }

/* ── Connected blood centers ── */
.center-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; padding: 0 24px 24px; }
.center-card { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--rb-border); border-radius: 16px; }
.center-card-top { display: flex; align-items: flex-start; gap: 12px; }
.center-icon {
  display: flex; flex-shrink: 0; align-items: center; justify-content: center;
  width: 38px; height: 38px; border-radius: 12px; background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text);
}
.center-who { flex: 1; min-width: 0; }
.center-name { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.center-meta { margin: 2px 0 0; font-size: 12px; color: var(--rb-text-secondary); }
.center-contact { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 13px; color: var(--rb-text-secondary); }
.center-link { align-self: flex-start; margin-left: -8px; }

/* ── Appearance ── */
.card--appearance { display: grid; grid-template-columns: minmax(0, 1fr) 340px; align-items: center; }
.card--appearance .card__main { gap: 6px; padding: 26px; }
.swatches { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px 10px; max-width: 520px; margin-top: 14px; }
.swatch {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 4px 0; border: 0; background: none; font: inherit; cursor: pointer;
}
.swatch__circle {
  position: relative; width: 56px; height: 56px; border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06); transition: transform 150ms ease, box-shadow 150ms ease;
}
.swatch:hover .swatch__circle { transform: scale(1.06); }
.swatch--on .swatch__circle { box-shadow: 0 0 0 3px var(--rb-surface), 0 0 0 5px var(--ring); }
.swatch__dot {
  position: absolute; left: 50%; bottom: -3px; width: 14px; height: 14px;
  transform: translateX(-50%); border-radius: 50%; box-shadow: 0 0 0 2px var(--rb-surface);
}
.swatch__check {
  position: absolute; top: -4px; right: -4px; display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%; color: #fff; box-shadow: 0 0 0 2px var(--rb-surface);
}
.swatch__name { font-size: 12px; font-weight: 600; text-align: center; color: var(--rb-text-secondary); }
.swatch--on .swatch__name { color: var(--rb-text-primary); font-weight: 700; }
.swatch:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; border-radius: 12px; }

/* A tiny hospital screen in the picked colour */
.mini {
  position: relative; display: flex; gap: 8px; margin: 24px 24px 24px 0; padding: 12px;
  border: 1px solid var(--rb-border); border-radius: 18px; background: var(--rb-surface-alt);
}
.mini__rail {
  display: flex; flex-direction: column; align-items: center; gap: 9px;
  width: 34px; padding: 8px 0; border-radius: 12px; background: var(--rb-surface);
}
.mini__logo { width: 20px; height: 20px; border-radius: 6px; background: var(--rb-primary); }
.mini__icon { width: 14px; height: 14px; border-radius: 4px; background: var(--rb-border-strong); }
.mini__icon--on { width: 20px; height: 20px; border-radius: 6px; background: var(--rb-primary); box-shadow: 0 3px 8px -3px rgba(var(--rb-primary-rgb), 0.8); }
.mini__body { display: flex; flex: 1; flex-direction: column; gap: 8px; min-width: 0; }
.mini__hero {
  display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 12px; border-radius: 12px;
  background: linear-gradient(135deg, var(--rb-grad-from, #E3F2FD), var(--rb-grad-to, #BBDEFB));
}
.mini__line { width: 72%; height: 7px; border-radius: 999px; background: rgba(15, 23, 42, 0.5); }
.mini__line--sm { width: 42%; height: 5px; background: rgba(15, 23, 42, 0.22); }
.mini__btn { margin-top: 3px; padding: 5px 10px; border-radius: 999px; background: var(--rb-primary); color: #fff; font-size: 10px; font-weight: 700; }
.mini__row { display: flex; gap: 8px; }
.mini__row--end { align-items: center; justify-content: space-between; }
.mini__card { display: flex; flex: 1; flex-direction: column; padding: 8px 10px; border-radius: 10px; background: var(--rb-surface); }
.mini__num { font-size: 15px; font-weight: 800; color: var(--rb-primary-text); }
.mini__cap { font-size: 9.5px; font-weight: 600; color: var(--rb-text-secondary); }
.mini__chip { padding: 3px 9px; border-radius: 999px; background: rgba(var(--rb-primary-rgb), 0.12); color: var(--rb-primary-text); font-size: 10px; font-weight: 700; }
.mini__toggle { display: flex; justify-content: flex-end; width: 32px; height: 18px; padding: 2px; border-radius: 999px; background: var(--rb-primary); }
.mini__toggle span { width: 14px; height: 14px; border-radius: 50%; background: #fff; }
.mini__label {
  position: absolute; top: -9px; right: 14px; margin: 0; padding: 1px 8px; border-radius: 999px;
  background: var(--rb-surface); box-shadow: 0 0 0 1px var(--rb-border);
  font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--rb-text-secondary);
}

/* Mode cards */
.mode-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; padding: 0 24px 24px; }
.mode-card {
  position: relative; display: flex; flex-direction: column; gap: 10px; padding: 10px;
  border: 1px solid var(--rb-border); border-radius: 16px; background: var(--rb-surface);
  font: inherit; text-align: left; cursor: pointer; transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.mode-card:hover:not(.mode-card--on) { border-color: rgba(var(--rb-primary-rgb), 0.4); }
.mode-card--on { border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.15); }
.mode-card:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.mode-card__preview { display: flex; flex-direction: column; gap: 6px; height: 78px; padding: 10px; border-radius: 10px; }
.mode-card__preview--light { background: #F7F8FA; border: 1px solid #E5EAF0; }
.mode-card__preview--dark { background: #0F172A; border: 1px solid #1E293B; }
.mode-card__preview--system { background: linear-gradient(90deg, #F7F8FA 50%, #0F172A 50%); border: 1px solid #E5EAF0; }
.mode-card__bar { width: 46%; height: 8px; border-radius: 999px; background: var(--rb-primary); }
.mode-card__line { height: 6px; border-radius: 999px; background: rgba(148, 163, 184, 0.45); }
.mode-card__line--1 { width: 80%; }
.mode-card__line--2 { width: 60%; }
.mode-card__label { display: flex; align-items: center; gap: 6px; padding: 0 4px 2px; font-size: 13.5px; font-weight: 600; color: var(--rb-text-primary); }
.mode-card__check {
  position: absolute; top: 16px; right: 16px; display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%; background: var(--rb-primary); color: #fff;
}

/* ── Save bar and toast ── */
.save-bar {
  position: fixed; left: 50%; bottom: 20px; z-index: 40;
  display: flex; align-items: center; gap: 18px; padding: 10px 10px 10px 18px;
  transform: translateX(-50%); border: 1px solid var(--rb-border); border-radius: 999px;
  background: var(--rb-surface); box-shadow: 0 18px 40px -16px rgba(15, 23, 42, 0.35);
}
.save-bar-text { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; color: var(--rb-warning-text); white-space: nowrap; }
.save-bar-actions { display: flex; gap: 8px; }
.savebar-enter-active, .savebar-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.savebar-enter-from, .savebar-leave-to { opacity: 0; transform: translate(-50%, 12px); }

.toast {
  position: fixed; right: 24px; bottom: 24px; z-index: 60;
  display: flex; align-items: center; gap: 8px; padding: 12px 16px;
  border: 1px solid var(--rb-border); border-radius: 14px; background: var(--rb-surface);
  box-shadow: 0 18px 40px -16px rgba(15, 23, 42, 0.35); font-size: 13.5px; font-weight: 600; color: var(--rb-text-primary);
}
.toast__icon { color: var(--rb-success-text); }
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .swatch__circle, .toggle-thumb, .toggle-track, .tab, .mode-card, .channel { transition: none; }
}

/* ── Smaller screens ── */
@media (max-width: 1100px) {
  .card--split, .card--appearance { grid-template-columns: minmax(0, 1fr); }
  .card__aside { border-right: none; border-bottom: 1px solid var(--rb-border); border-radius: 22px 22px 0 0; }
  .mini { margin: 0 24px 24px; }
  .channels { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .settings-page { padding: 16px 16px 96px; }
  .id-banner { flex-direction: column; align-items: flex-start; }
  .form-grid, .mode-cards { grid-template-columns: minmax(0, 1fr); }
  .swatches { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .card__head { flex-direction: column; }
  .save-bar { left: 16px; right: 16px; transform: none; border-radius: 16px; flex-wrap: wrap; }
}
</style>
