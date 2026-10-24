<template>
  <div class="settings-page scope-blood-center-settings">
    <div v-if="loading" class="settings-skeleton" aria-busy="true">
      <div class="skeleton skeleton--banner" />
      <div class="skeleton skeleton--tabs" />
      <div class="skeleton skeleton--panel" />
    </div>

    <div v-else class="settings-inner">
      <!-- Who this is: the page's anchor, above every tab -->
      <section class="id-banner" aria-label="Your account">
        <div class="id-banner__avatar-wrap">
          <div class="id-banner__avatar">
            <img v-if="profileForm.avatarUrl" :src="profileForm.avatarUrl" alt="Profile picture" />
            <span v-else>{{ initials(profileForm.fullName) }}</span>
          </div>
          <label v-if="editingProfile" class="id-banner__camera" title="Change photo">
            <AssetIcon name="camera" :size="14" />
            <span class="sr-only">Change photo</span>
            <input type="file" accept="image/*" class="avatar-upload-input" @change="onAvatarChange" />
          </label>
        </div>

        <div class="id-banner__who">
          <h1 class="id-banner__name">{{ niceName || 'Your account' }}</h1>
          <p class="id-banner__role">{{ roleText }}<template v-if="profileForm.bloodCenter"> · {{ profileForm.bloodCenter }}</template></p>
          <div class="id-banner__chips">
            <span v-if="profileForm.employeeId" class="chip"><AssetIcon name="id-card" :size="12" /> {{ profileForm.employeeId }}</span>
            <span v-if="accountInfo.status" class="chip" :class="`chip--${(accountInfo.status || '').toLowerCase().replace(/\s+/g, '-')}`">
              <span class="chip__dot" /> {{ accountInfo.status }}
            </span>
          </div>
        </div>

        <button v-if="activeTab === 'profile' && !editingProfile" type="button" class="ui-btn" @click="startEditProfile">
          <AssetIcon name="pencil" :size="14" /> Edit profile
        </button>
      </section>

      <!-- Sections as pill tabs -->
      <nav class="tabbar" aria-label="Settings sections">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="tab"
          :class="{ 'tab--active': activeTab === tab.id }"
          :aria-current="activeTab === tab.id ? 'page' : undefined"
          @click="activeTab = tab.id"
        >
          <AssetIcon :name="tab.icon" :size="15" />
          {{ tab.label }}
        </button>
      </nav>

      <!-- MY PROFILE -->
      <section v-if="activeTab === 'profile'" class="card">
        <header class="card__head">
          <div>
            <h2 class="card__title">Profile</h2>
            <p class="card__sub">Your details as they appear across RedAgos.</p>
          </div>
          <span v-if="editingProfile" class="editing-pill"><AssetIcon name="pencil" :size="12" /> Editing</span>
        </header>

        <div class="field-groups">
          <div class="field-group">
            <p class="field-group__title">Name</p>
            <div class="form-grid">
              <!-- First and last name are stored apart, so they are edited apart. -->
              <div class="form-group">
                <label class="form-label" for="bc-first-name">First name</label>
                <input id="bc-first-name" v-model="profileForm.firstName" type="text" class="form-input" :disabled="!editingProfile" />
              </div>
              <div class="form-group">
                <label class="form-label" for="bc-last-name">Last name</label>
                <input id="bc-last-name" v-model="profileForm.lastName" type="text" class="form-input" :disabled="!editingProfile" />
              </div>
            </div>
          </div>

          <div class="field-group">
            <p class="field-group__title">Work</p>
            <div class="form-grid">
              <!-- The role (and what it may do) is set by the Blood Center Admin in
                   Staff Accounts. The title is the person's own credentials, e.g.
                   RMT, printed after their name on everything they sign
                   (project owner, 2026-10-22). -->
              <div class="form-group">
                <label class="form-label" for="bc-title">Title <span class="form-optional">optional</span></label>
                <ComboInput
                  id="bc-title"
                  v-model="profileForm.credentials"
                  :options="CREDENTIAL_OPTIONS"
                  maxlength="40"
                  placeholder="e.g. RMT"
                  :disabled="!editingProfile"
                />
              </div>
              <div class="form-group">
                <label class="form-label" for="bc-phone">Contact number</label>
                <input id="bc-phone" v-model="profileForm.contactNumber" type="tel" class="form-input" placeholder="09XXXXXXXXX" :disabled="!editingProfile" />
              </div>
            </div>
          </div>

          <!-- Set by the centre or its Blood Center Admin: shown, not edited here -->
          <div class="field-group">
            <p class="field-group__title">Set by your Blood Center Admin</p>
            <dl class="readonly-grid">
              <div><dt><AssetIcon name="id-card" :size="13" /> Employee ID</dt><dd>{{ profileForm.employeeId || '-' }}</dd></div>
              <div><dt><AssetIcon name="briefcase" :size="13" /> Role</dt><dd>{{ roleText }}</dd></div>
              <div><dt><AssetIcon name="building-2" :size="13" /> Blood center</dt><dd>{{ profileForm.bloodCenter || '-' }}</dd></div>
              <div><dt><AssetIcon name="mail" :size="13" /> Sign-in email</dt><dd>{{ profileForm.email || '-' }}</dd></div>
            </dl>
            <p v-if="editingProfile" class="form-hint">Ask your Blood Center Admin to change your role or sign-in email.</p>
          </div>
        </div>

        <p v-if="profileError" class="note note--error"><AssetIcon name="circle-alert" :size="14" /> {{ profileError }}</p>
        <p v-if="profileSuccess" class="note note--ok"><AssetIcon name="check" :size="14" /> {{ profileSuccess }}</p>

        <footer v-if="editingProfile" class="card__foot">
          <button type="button" class="ui-btn ui-btn--ghost" @click="cancelEditProfile">Cancel</button>
          <button type="button" class="ui-btn ui-btn--primary" :disabled="savingProfile" @click="saveProfile">
            {{ savingProfile ? 'Saving...' : 'Save changes' }}
          </button>
        </footer>
      </section>

      <!-- SECURITY -->
      <section v-if="activeTab === 'security'" class="card card--split">
        <div class="card__aside">
          <span class="aside-icon"><AssetIcon name="lock" :size="20" /></span>
          <h2 class="card__title">Password</h2>
          <p class="card__sub">You'll stay signed in on this device after changing it.</p>
          <ul class="checklist" aria-label="Password requirements">
            <li :class="{ 'checklist--ok': passwordForm.new.length >= 8 }">
              <AssetIcon :name="passwordForm.new.length >= 8 ? 'check' : 'circle'" :size="13" /> At least 8 characters
            </li>
            <li :class="{ 'checklist--ok': passwordForm.new && passwordForm.new === passwordForm.confirm }">
              <AssetIcon :name="passwordForm.new && passwordForm.new === passwordForm.confirm ? 'check' : 'circle'" :size="13" /> New passwords match
            </li>
          </ul>
        </div>

        <div class="card__main">
          <div class="form-group">
            <label class="form-label" for="pw-current">Current password</label>
            <div class="password-input-wrap">
              <input id="pw-current" v-model="passwordForm.current" :type="showCurrent ? 'text' : 'password'" class="form-input"
                placeholder="Enter current password" autocomplete="current-password" />
              <button type="button" class="password-toggle" :aria-label="showCurrent ? 'Hide password' : 'Show password'" @click="showCurrent = !showCurrent">
                <AssetIcon :name="showCurrent ? 'eye-off' : 'eye'" :size="16" />
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="pw-new">New password</label>
            <div class="password-input-wrap">
              <input id="pw-new" v-model="passwordForm.new" :type="showNew ? 'text' : 'password'" class="form-input"
                placeholder="At least 8 characters" autocomplete="new-password" />
              <button type="button" class="password-toggle" :aria-label="showNew ? 'Hide password' : 'Show password'" @click="showNew = !showNew">
                <AssetIcon :name="showNew ? 'eye-off' : 'eye'" :size="16" />
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="pw-confirm">Confirm new password</label>
            <div class="password-input-wrap">
              <input id="pw-confirm" v-model="passwordForm.confirm" :type="showConfirm ? 'text' : 'password'" class="form-input"
                placeholder="Re-enter new password" autocomplete="new-password" />
              <button type="button" class="password-toggle" :aria-label="showConfirm ? 'Hide password' : 'Show password'" @click="showConfirm = !showConfirm">
                <AssetIcon :name="showConfirm ? 'eye-off' : 'eye'" :size="16" />
              </button>
            </div>
          </div>

          <p v-if="passwordError" class="note note--error"><AssetIcon name="circle-alert" :size="14" /> {{ passwordError }}</p>
          <p v-if="passwordSuccess" class="note note--ok"><AssetIcon name="check" :size="14" /> {{ passwordSuccess }}</p>

          <div class="card__foot card__foot--flat">
            <button type="button" class="ui-btn ui-btn--primary" :disabled="updatingPassword" @click="updatePassword">
              {{ updatingPassword ? 'Updating...' : 'Update password' }}
            </button>
          </div>
        </div>
      </section>

      <!-- APPEARANCE: the page's showpiece -->
      <template v-if="activeTab === 'appearance'">
        <section class="card card--split card--appearance">
          <div class="card__main">
            <h2 class="card__title">Appearance</h2>
            <p class="card__sub">Make RedAgos yours. Saved on this device and used in every RedAgos portal.</p>
            <!-- The donor portal's picker: mode, colour and custom colour. -->
            <AppearancePicker class="card__picker" />
          </div>

          <!-- A tiny Blood Center screen in the picked colour -->
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
                <span class="mini__btn">Release units</span>
              </div>
              <div class="mini__row">
                <span class="mini__card"><span class="mini__num">128</span><span class="mini__cap">Units</span></span>
                <span class="mini__card"><span class="mini__num">6</span><span class="mini__cap">Requests</span></span>
              </div>
              <div class="mini__row mini__row--end">
                <span class="mini__chip">Urgent</span>
                <span class="mini__toggle"><span /></span>
              </div>
            </div>
            <p class="mini__label">Preview</p>
          </div>

          <!-- Across the whole card: the note on the left, Reset in the bottom-right corner. -->
          <div class="appearance-foot">
            <p class="appearance-foot__note">
              <AssetIcon name="info" :size="13" />
              Buttons and links keep readable contrast with any colour you pick.
            </p>
            <button type="button" class="appearance-foot__reset" :disabled="isDefaultAppearance" @click="resetAppearance">
              Reset to default
            </button>
          </div>
        </section>

      </template>

      <!-- NOTIFICATIONS -->
      <section v-if="activeTab === 'notifications'" class="card">
        <header class="card__head">
          <div>
            <h2 class="card__title">Notifications</h2>
            <p class="card__sub">What RedAgos tells you about, from your role. Shown in the bell at the top.</p>
          </div>
        </header>
        <!--
          From the server (StaffNotificationTopics), so this is the list the
          senders use. A locked notice holds up a patient or a donor when
          missed, so it stays on.
        -->
        <div v-if="notifLoading" class="toggle-list" aria-busy="true">
          <div v-for="n in 2" :key="n" class="toggle-row"><span class="skeleton-line" /></div>
        </div>
        <div v-else-if="notificationPrefs.length" class="toggle-list">
          <label v-for="pref in notificationPrefs" :key="pref.key" class="toggle-row" :class="{ 'toggle-row--locked': pref.locked }">
            <span class="toggle-row__text">
              <span class="toggle-row__label">{{ pref.label }}</span>
              <span class="toggle-row__desc">{{ pref.description }}</span>
              <span class="toggle-row__reason"><AssetIcon name="user-check" :size="12" /> {{ pref.reason }}</span>
            </span>
            <!-- On and held there: a switch, so it reads as a preference, but one that cannot be turned off. -->
            <span v-if="pref.locked" class="always-on" title="Always on: missing one holds up a patient or a donor">
              <span class="always-on__text"><AssetIcon name="lock" :size="11" /> Required</span>
              <span class="toggle-switch toggle-switch--locked">
                <input type="checkbox" checked disabled :aria-label="`${pref.label}: always on`" />
                <span class="toggle-switch__track"></span>
              </span>
            </span>
            <span v-else class="toggle-switch">
              <input v-model="pref.enabled" type="checkbox" @change="saveNotificationPref(pref)" />
              <span class="toggle-switch__track"></span>
            </span>
          </label>
        </div>
        <p v-else class="notif-empty">
          Your role has no notices of its own. Messages for everyone at the centre still appear in the bell.
        </p>
        <p v-if="notifSaveError" class="note note--error"><AssetIcon name="circle-alert" :size="14" /> {{ notifSaveError }}</p>
      </section>

      <!-- ACCOUNT: sessions and account information -->
      <template v-if="activeTab === 'account'">
        <section class="card">
          <header class="card__head">
            <div>
              <h2 class="card__title">Signed-in devices</h2>
              <p class="card__sub">Where your account is open right now.</p>
            </div>
          </header>

          <div class="device">
            <span class="device__icon"><AssetIcon name="monitor" :size="18" /></span>
            <div class="device__body">
              <p class="device__title">This device</p>
              <p class="device__meta">{{ currentSession.os || 'Unknown system' }} · {{ currentSession.browser || 'Unknown browser' }}</p>
              <p v-if="currentSession.loggedInLabel" class="device__time">Logged in {{ currentSession.loggedInLabel }}</p>
            </div>
            <span class="chip chip--active"><span class="chip__dot" /> Active now</span>
          </div>

          <p v-if="sessionMessage" class="note note--ok"><AssetIcon name="check" :size="14" /> {{ sessionMessage }}</p>

          <footer class="card__foot card__foot--start">
            <button type="button" class="btn-danger-soft" @click="confirmLogoutOthers = true">
              <AssetIcon name="log-out" :size="14" /> Log out all devices
            </button>
          </footer>
        </section>

        <section class="card">
          <header class="card__head">
            <div>
              <h2 class="card__title">Account information</h2>
              <p class="card__sub">Read-only details about your account.</p>
            </div>
          </header>
          <dl class="info-grid">
            <div><dt>Username</dt><dd>{{ accountInfo.username }}</dd></div>
            <div><dt>Role</dt><dd>{{ accountInfo.role }}</dd></div>
            <div><dt>Blood center</dt><dd>{{ accountInfo.bloodCenter }}</dd></div>
            <div><dt>Created</dt><dd>{{ accountInfo.createdAt }}</dd></div>
            <div><dt>Last login</dt><dd>{{ accountInfo.lastLogin }}</dd></div>
            <div>
              <dt>Status</dt>
              <dd><span class="chip" :class="`chip--${(accountInfo.status || '').toLowerCase().replace(/\s+/g, '-')}`"><span class="chip__dot" /> {{ accountInfo.status }}</span></dd>
            </div>
          </dl>
        </section>
      </template>

      <!-- BLOOD CENTER: the centre's own settings, for the Blood Center Admin (center.configure). -->
      <section v-if="activeTab === 'center'" class="card">
        <header class="card__head">
          <div>
            <h2 class="card__title">Blood Center</h2>
            <p class="card__sub">Settings that belong to your centre, not to your account.</p>
          </div>
        </header>
        <BloodCenterFacilityLogoCard />
        <!-- The Daily Blood Stock Inventory's left-hand logo (project owner, 2026-10-22). -->
        <BloodCenterFacilityLogoCard kind="seal" />
        <BloodCenterDonorEmailTemplatesCard />
      </section>

      <!-- BOOKING: when donors can book a visit -->
      <section v-if="activeTab === 'booking'" class="card">
        <header class="card__head">
          <div>
            <h2 class="card__title">Booking</h2>
            <p class="card__sub">
              The days and times donors can book a visit to the centre in the Donor Portal, and how many each slot takes.
              Mobile drives keep their own hours and capacity.
            </p>
          </div>
        </header>
        <BloodCenterBookingScheduleCard embedded />
      </section>
    </div>

    <!-- confirm log out -->
    <Transition name="modal">
      <div v-if="confirmLogoutOthers" class="modal-overlay" @click.self="confirmLogoutOthers = false">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="logout-others-title">
          <div class="modal-card__header">
            <div class="modal-card__heading">
              <span class="modal-card__icon"><AssetIcon name="log-out" :size="16" /></span>
              <h2 id="logout-others-title" class="modal-card__title">Log out of all devices?</h2>
            </div>
            <button type="button" class="modal-card__close" aria-label="Close" @click="confirmLogoutOthers = false">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>
          <div class="modal-form">
            <p class="modal-subtitle">
              This signs you out everywhere, including this device. You'll need to sign in again on each one.
            </p>
            <div class="modal-actions">
              <button type="button" class="ui-btn ui-btn--ghost" @click="confirmLogoutOthers = false">Cancel</button>
              <button type="button" class="btn-danger-soft" :disabled="loggingOutOthers" @click="logoutOtherDevices">
                {{ loggingOutOthers ? 'Logging out...' : 'Yes, log out everywhere' }}
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
import AppearancePicker from '~/components/common/AppearancePicker.vue'
import { DEFAULT_ACCENT } from '~/utils/accentThemes'
import ComboInput from '~/components/common/ComboInput.vue'
import { authService } from '~/api/auth/AuthService'
import AssetIcon from '~/components/common/AssetIcon.vue'
import BloodCenterFacilityLogoCard from '~/components/BloodCenter/FacilityLogoCard.vue'
import BloodCenterDonorEmailTemplatesCard from '~/components/BloodCenter/DonorEmailTemplatesCard.vue'
import BloodCenterBookingScheduleCard from '~/components/BloodCenter/BookingScheduleCard.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { useAccentTheme } from '~/composables/useAccentTheme'
import { useDarkMode } from '~/composables/useDarkMode'

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
 *         profile: { avatarUrl, fullName, employeeId, bloodCenter, credentials, email, contactNumber },
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

  // The staff member's own notices (StaffNotificationTopics on the server).
  notificationPreferences: () => bloodCenterService.notificationPreferences(),
  updateNotificationPref: ({ key, enabled }) => bloodCenterService.updateNotificationPreferences({ [key]: enabled }),
}

const loading = ref(true)

const { can: canDo, user: sessionUser, fetchUser, logout } = useUser()

// The Blood Center tab holds the centre's logo, which only center.configure
// may change (the card checks the same ability), so only they see the tab.
// Signed-in devices and the read-only account details share the Account tab.
const tabs = computed(() => [
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'security', label: 'Security', icon: 'lock' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'account', label: 'Account', icon: 'monitor' },
  ...(canDo('center.configure') ? [{ id: 'center', label: 'Blood Center', icon: 'building-2' }] : []),
  // When donors can book: the Admin's and the Medical Receptionist's (project owner, 2026-10-24).
  ...(canDo('booking.configure') ? [{ id: 'booking', label: 'Booking', icon: 'calendar' }] : []),
])

// ?tab=center opens a tab directly, as the Donors page's email dialog links to
// the donor email templates. A tab the viewer cannot see falls back to profile.
const route = useRoute()
const activeTab = ref(tabs.value.some((tab) => tab.id === route.query.tab) ? String(route.query.tab) : 'profile')

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
  credentials: '',
  email: '',
  contactNumber: '',
})
const profileForm = reactive({ ...profile })

const editingProfile = ref(false)
const savingProfile = ref(false)
const profileError = ref('')
const profileSuccess = ref('')

// Suggested credentials, as on the Add Staff form; any other is typed.
const CREDENTIAL_OPTIONS = ['RMT', 'RN', 'MD']

// The person's role, as the Admin set it in Staff Accounts. Shown, not edited.
const roleText = computed(() => {
  const u = sessionUser.value
  if (!u) return ''
  const role = u.staff_role_label || u.role_label || u.custom_role || ''
  const parts = [u.management_level_label || '', role].filter(Boolean)
  return parts.join(' · ') || u.department_label || 'No role yet'
})

// Names are stored as typed ("teresa aquino"); show them capitalised.
const niceName = computed(() =>
  (profileForm.fullName || '').replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
)


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
      credentials: profileForm.credentials.trim() || null,
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
// Loaded from the server: [{ key, label, description, reason, locked, enabled }].
const notificationPrefs = ref([])
const notifLoading = ref(true)

async function loadNotificationPrefs() {
  notifLoading.value = true
  try {
    const data = await api.notificationPreferences()
    notificationPrefs.value = Array.isArray(data?.topics) ? data.topics : []
  } catch (err) {
    console.error('Failed to load notification preferences:', err)
    notifSaveError.value = 'Could not load your notifications. Please try again.'
  } finally {
    notifLoading.value = false
  }
}
onMounted(loadNotificationPrefs)

const notifSaveError = ref('')

async function saveNotificationPref(pref) {
  notifSaveError.value = ''
  try {
    await api.updateNotificationPref({ key: pref.key, enabled: pref.enabled })
  } catch (err) {
    console.error('Failed to save notification preference:', err)
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
    sessionMessage.value = 'Signed out everywhere. Taking you to the sign-in page...'
    confirmLogoutOthers.value = false
    // The server revoked this device's token too, so finish here.
    await logout('/auth/blood-center/login')
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
// Mode is the shared Light / Dark / System setting (same as the account menu).
const { themeMode, setThemeMode } = useDarkMode()

// Portal colour: one choice for every portal on this device. The picker
// itself is AppearancePicker; the page keeps the reset.
const { current: accentKey, set: setAccent } = useAccentTheme()

const isDefaultAppearance = computed(() => accentKey.value === DEFAULT_ACCENT && themeMode.value === 'system')

function resetAppearance() {
  setAccent(DEFAULT_ACCENT)
  setThemeMode('system')
}

/* ------------ LOAD --------------- */

// "Windows · Chrome" from the user agent, for the signed-in devices card.
function describeThisDevice() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''
  return { os, browser }
}

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
    credentials: p.credentials ?? '',
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
    // The server sends no device details; this browser can name itself.
    if (!currentSession.os || !currentSession.browser) Object.assign(currentSession, describeThisDevice(), { ...data?.currentSession })
  } catch (err) {
    console.error('Failed to load settings:', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
/*
 * Built on the system tokens (--rb-surface, --rb-border, --rb-text-*), which
 * flip in dark mode on their own, and on --rb-primary, which the portal colour
 * theme sets. So this page needs almost no dark rules of its own.
 */
.settings-page {
  --text-primary: var(--rb-text-primary);
  --text-secondary: var(--rb-text-secondary);
  --card-border: var(--rb-border);
  /* The shared content column every blood-centre page uses. */
  max-width: var(--rb-content-max);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  font-family: var(--rb-font-sans);
}

.settings-inner { display: flex; flex-direction: column; gap: 18px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* ── Skeleton ── */
.settings-skeleton { display: flex; flex-direction: column; gap: 18px; }
.skeleton {
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 20px;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--banner { height: 118px; border-radius: 24px; }
.skeleton--tabs { height: 44px; max-width: 620px; border-radius: 999px; }
.skeleton--panel { height: 380px; }
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

/* ── Identity banner ── */
.id-banner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 22px 24px;
  overflow: hidden;
  border: 1px solid var(--card-border);
  border-radius: 24px;
  background:
    radial-gradient(70% 140% at 100% 0%, rgba(var(--rb-primary-rgb), 0.14), transparent 60%),
    var(--rb-surface);
  box-shadow: var(--rb-shadow-sm);
}

.id-banner__avatar-wrap { position: relative; flex-shrink: 0; }

.id-banner__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  overflow: hidden;
  border-radius: 22px;
  /* The portal colour, like the avatar in the header. */
  background: var(--rb-primary);
  color: #fff;
  font-size: 24px;
  font-weight: 800;
  box-shadow: 0 0 0 4px var(--rb-surface), 0 10px 24px -12px rgba(var(--rb-shadow-rgb, 15, 23, 42), 0.5);
}

.id-banner__avatar img { width: 100%; height: 100%; object-fit: cover; }

.id-banner__camera {
  position: absolute;
  right: -6px;
  bottom: -6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 3px solid var(--rb-surface);
  border-radius: 50%;
  background: var(--rb-primary);
  color: #fff;
  cursor: pointer;
}

.avatar-upload-input { display: none; }

.id-banner__who { flex: 1; min-width: 0; }

.id-banner__name {
  margin: 0;
  font-size: var(--rb-fs-title, 20px);
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  text-transform: capitalize;
}

.id-banner__role { margin: 2px 0 0; font-size: var(--rb-fs-small, 13px); color: var(--text-secondary); }
.id-banner__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.chip__dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.chip--active { background: rgba(46, 125, 50, 0.1); color: var(--rb-success-text, #2E7D32); }
.chip--pending-verification { background: rgba(245, 124, 0, 0.12); color: var(--rb-warning-text, #B45309); }
.chip--suspended,
.chip--deactivated { background: rgba(198, 40, 40, 0.1); color: #C62828; }

/* ── Tab bar ── */
.tabbar {
  display: flex;
  gap: 4px;
  width: fit-content;
  max-width: 100%;
  padding: 4px;
  overflow-x: auto;
  border: 1px solid var(--card-border);
  border-radius: 999px;
  background: var(--rb-surface);
  scrollbar-width: none;
}

.tab {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.tab:hover:not(.tab--active) { background: var(--rb-surface-hover); color: var(--text-primary); }

.tab--active {
  background: var(--rb-primary);
  color: #fff;
  box-shadow: 0 6px 14px -8px rgba(var(--rb-primary-rgb), 0.8);
}

/* ── Cards ── */
.card {
  border: 1px solid var(--card-border);
  border-radius: 22px;
  background: var(--rb-surface);
  box-shadow: var(--rb-shadow-sm);
}

.card > .card__head,
.card > .field-groups,
.card > .toggle-list,
.card > .device,
.card > .info-grid,
.card > .mode-cards { margin-left: 24px; margin-right: 24px; }

.card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 0 16px;
}

.card__title { margin: 0; font-size: var(--rb-fs-section, 15px); font-weight: 700; color: var(--text-primary); }
.card__sub { margin: 3px 0 0; font-size: var(--rb-fs-small, 13px); line-height: 1.5; color: var(--text-secondary); }

.card__foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--card-border);
}

.card__foot--start { justify-content: flex-start; }
.card__foot--flat { margin-top: 4px; padding: 0; border-top: none; }

/* Split card: a short explainer on the left, the controls on the right */
.card--split { display: grid; grid-template-columns: 280px minmax(0, 1fr); }

.card__aside {
  padding: 24px;
  border-right: 1px solid var(--card-border);
  border-radius: 22px 0 0 22px;
  background: var(--rb-surface-alt);
}

.card__main { display: flex; flex-direction: column; gap: 16px; padding: 24px; min-width: 0; }

.aside-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-bottom: 14px;
  border-radius: 14px;
  background: rgba(var(--rb-primary-rgb), 0.12);
  color: var(--rb-primary-text);
}

.checklist { display: flex; flex-direction: column; gap: 8px; margin: 18px 0 0; padding: 0; list-style: none; }
.checklist li { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
.checklist li.checklist--ok { color: var(--rb-success-text, #2E7D32); font-weight: 600; }

.editing-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
  font-size: 12px;
  font-weight: 700;
}

/* ── Profile fields ── */
.field-groups { display: flex; flex-direction: column; gap: 22px; padding-bottom: 20px; }

.field-group__title {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--rb-primary-text);
}

.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.form-label { font-size: 12.5px; font-weight: 600; color: var(--text-secondary); }
.form-optional { font-weight: 400; color: var(--rb-placeholder, #94A3B8); }
.form-hint { margin: 8px 0 0; font-size: 12px; color: var(--text-secondary); }

/*
 * Anchored on the page root on purpose. Several other portals ship
 * `:global(.dark .form-input) { … }` — an unscoped rule at (0,2,0) that ties
 * with a plain scoped `.form-input[data-v-...]`, so which one won came down to
 * chunk load order. The page-root ancestor takes these to (0,3,0) and settles
 * it, without this page having to hardcode a dark palette of its own.
 */
.settings-page .form-input {
  width: 100%;
  height: var(--rb-control-height, 42px);
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 12px;
  background: var(--rb-surface);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.settings-page .form-input:focus {
  outline: none;
  border-color: var(--rb-primary);
  box-shadow: 0 0 0 4px rgba(var(--rb-primary-rgb), 0.14);
}

.settings-page .form-input:disabled { background: var(--rb-surface-alt); color: var(--text-primary); cursor: default; }

.readonly-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--card-border);
  border-radius: 14px;
  background: var(--card-border);
}

.readonly-grid > div { padding: 12px 14px; background: var(--rb-surface-alt); }
.readonly-grid dt { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: var(--text-secondary); }
.readonly-grid dd { margin: 4px 0 0; overflow: hidden; font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); }

/* Password field with a show/hide button inside */
.password-input-wrap { position: relative; }
.settings-page .password-input-wrap .form-input { padding-right: 44px; }

.password-toggle {
  position: absolute;
  top: 50%;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  transform: translateY(-50%);
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.password-toggle:hover { background: var(--rb-surface-hover); color: var(--text-primary); }

/* Messages */
.note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 24px 4px;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}

.card__main .note { margin: 0; }
.note--error { background: rgba(198, 40, 40, 0.08); color: #B42318; }
.note--ok { background: rgba(46, 125, 50, 0.1); color: var(--rb-success-text, #2E7D32); }

/* ── Appearance ── */
.card__picker { margin-top: 18px; }
.appearance-foot {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 26px 20px;
  border-top: 1px solid var(--rb-border);
}
.appearance-foot__note { display: flex; align-items: center; gap: 6px; margin: 0; font-size: var(--rb-fs-caption); color: var(--rb-text-secondary); }
.appearance-foot__reset {
  margin-left: auto;
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid var(--rb-border);
  border-radius: 999px;
  background: transparent;
  color: var(--rb-text-primary);
  font: inherit;
  font-size: var(--rb-fs-small);
  font-weight: 600;
  cursor: pointer;
}
.appearance-foot__reset:hover:not(:disabled) { background: var(--rb-surface-hover, #F1F5F9); }
.appearance-foot__reset:disabled { opacity: 0.5; cursor: default; }
.card--appearance { grid-template-columns: minmax(0, 1fr) 340px; align-items: center; }
.card--appearance .card__main { padding: 26px; }

.swatches { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px 10px; margin-top: 6px; }

.swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;
}

.swatch__circle {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.swatch:hover .swatch__circle { transform: scale(1.06); }
.swatch--on .swatch__circle { box-shadow: 0 0 0 3px var(--rb-surface), 0 0 0 5px var(--ring); }

.swatch__dot {
  position: absolute;
  left: 50%;
  bottom: -3px;
  width: 14px;
  height: 14px;
  transform: translateX(-50%);
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--rb-surface);
}

.swatch__check {
  position: absolute;
  top: -4px;
  right: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: #fff;
  box-shadow: 0 0 0 2px var(--rb-surface);
}

.swatch__name { font-size: 12px; font-weight: 600; text-align: center; color: var(--text-secondary); }
.swatch--on .swatch__name { color: var(--text-primary); font-weight: 700; }
.swatch:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; border-radius: 12px; }

/* Mini Blood Center screen in the picked colour */
.mini {
  position: relative;
  display: flex;
  gap: 8px;
  margin: 24px 24px 24px 0;
  padding: 12px;
  border: 1px solid var(--card-border);
  border-radius: 18px;
  background: var(--rb-surface-alt);
}

.mini__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  width: 34px;
  padding: 8px 0;
  border-radius: 12px;
  background: var(--rb-surface);
}

.mini__logo { width: 20px; height: 20px; border-radius: 6px; background: var(--rb-primary); }
.mini__icon { width: 14px; height: 14px; border-radius: 4px; background: var(--rb-border-strong); }
.mini__icon--on { width: 20px; height: 20px; border-radius: 6px; background: var(--rb-primary); box-shadow: 0 3px 8px -3px rgba(var(--rb-primary-rgb), 0.8); }

.mini__body { display: flex; flex: 1; flex-direction: column; gap: 8px; min-width: 0; }

.mini__hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--rb-grad-from, #E3F2FD), var(--rb-grad-to, #BBDEFB));
}

.mini__line { width: 72%; height: 7px; border-radius: 999px; background: rgba(15, 23, 42, 0.5); }
.mini__line--sm { width: 42%; height: 5px; background: rgba(15, 23, 42, 0.22); }

.mini__btn {
  margin-top: 3px;
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--rb-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.mini__row { display: flex; gap: 8px; }
.mini__row--end { align-items: center; justify-content: space-between; }

.mini__card {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--rb-surface);
}

.mini__num { font-size: 15px; font-weight: 800; color: var(--rb-primary-text); }
.mini__cap { font-size: 9.5px; font-weight: 600; color: var(--text-secondary); }

.mini__chip {
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.12);
  color: var(--rb-primary-text);
  font-size: 10px;
  font-weight: 700;
}

.mini__toggle {
  display: flex;
  justify-content: flex-end;
  width: 32px;
  height: 18px;
  padding: 2px;
  border-radius: 999px;
  background: var(--rb-primary);
}

.mini__toggle span { width: 14px; height: 14px; border-radius: 50%; background: #fff; }

.mini__label {
  position: absolute;
  top: -9px;
  right: 14px;
  margin: 0;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--rb-surface);
  box-shadow: 0 0 0 1px var(--card-border);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

/* Mode cards */
.mode-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; padding-bottom: 24px; }

.mode-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--card-border);
  border-radius: 16px;
  background: var(--rb-surface);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.mode-card:hover:not(.mode-card--on) { border-color: rgba(var(--rb-primary-rgb), 0.4); }
.mode-card--on { border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.15); }
.mode-card:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.mode-card__preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 78px;
  padding: 10px;
  border-radius: 10px;
}

.mode-card__preview--light { background: #F7F8FA; border: 1px solid #E5EAF0; }
.mode-card__preview--dark { background: #0F172A; border: 1px solid #1E293B; }
.mode-card__preview--system { background: linear-gradient(90deg, #F7F8FA 50%, #0F172A 50%); border: 1px solid #E5EAF0; }

.mode-card__bar { width: 46%; height: 8px; border-radius: 999px; background: var(--rb-primary); }
.mode-card__line { height: 6px; border-radius: 999px; background: rgba(148, 163, 184, 0.45); }
.mode-card__line--1 { width: 80%; }
.mode-card__line--2 { width: 60%; }

.mode-card__label { display: flex; align-items: center; gap: 6px; padding: 0 4px 2px; font-size: 13.5px; font-weight: 600; color: var(--text-primary); }

.mode-card__check {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--rb-primary);
  color: #fff;
}

/* ── Notifications ── */
.toggle-list { display: flex; flex-direction: column; padding-bottom: 12px; }

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-top: 1px solid var(--card-border);
  cursor: pointer;
}

.toggle-row__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.toggle-row__label { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.toggle-row__desc { font-size: 12.5px; color: var(--text-secondary); }
.toggle-row__reason { display: inline-flex; align-items: center; gap: 4px; margin-top: 3px; font-size: 12px; font-weight: 600; color: var(--rb-primary-text); }
.toggle-row--locked { cursor: default; }
.always-on { display: inline-flex; flex-shrink: 0; align-items: center; gap: 10px; }
.always-on__text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary);
}
/* On, but dimmed and still: it cannot be turned off. */
.toggle-switch--locked { opacity: 0.55; }
.toggle-switch--locked input { cursor: not-allowed; }
.notif-empty { margin: 0; padding: 0 24px 22px; font-size: 13px; color: var(--text-secondary); }
.skeleton-line { display: block; width: 60%; height: 14px; border-radius: 6px; background: var(--rb-skeleton-a, #EEF1F5); }

.toggle-switch { position: relative; flex-shrink: 0; width: 42px; height: 24px; }
.toggle-switch input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

.toggle-switch__track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--rb-border-strong);
  transition: background-color 0.2s ease;
  pointer-events: none;
}

.toggle-switch__track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.25);
  transition: transform 0.2s ease;
}

.toggle-switch input:checked + .toggle-switch__track { background: var(--rb-primary); }
.toggle-switch input:checked + .toggle-switch__track::after { transform: translateX(18px); }
.toggle-switch input:focus-visible + .toggle-switch__track { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

/* ── Account ── */
.device {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 8px;
  padding: 14px 16px;
  border: 1px solid var(--card-border);
  border-radius: 16px;
  background: var(--rb-surface-alt);
}

.device__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(var(--rb-primary-rgb), 0.12);
  color: var(--rb-primary-text);
}

.device__body { flex: 1; min-width: 0; }
.device__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--text-primary); }
.device__meta { margin: 2px 0 0; font-size: 12.5px; color: var(--text-secondary); }
.device__time { margin: 2px 0 0; font-size: 12px; color: var(--rb-placeholder, #94A3B8); }

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin-bottom: 24px;
  overflow: hidden;
  border: 1px solid var(--card-border);
  border-radius: 14px;
  background: var(--card-border);
}

.info-grid > div { padding: 14px 16px; background: var(--rb-surface); }
.info-grid dt { font-size: 11.5px; font-weight: 600; color: var(--text-secondary); }
.info-grid dd { margin: 4px 0 0; font-size: 14px; font-weight: 600; color: var(--text-primary); }

/* ── Buttons ── */
.btn-primary,
.btn-soft,
.btn-ghost,
.btn-danger-soft {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 40px;
  padding: 0 20px;
  border-radius: 999px;
  font: inherit;
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.btn-primary { border: none; background: var(--rb-primary); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--rb-primary-hover); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-soft {
  flex-shrink: 0;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.35);
  background: var(--rb-surface);
  color: var(--rb-primary-text);
}
.btn-soft:hover { background: rgba(var(--rb-primary-rgb), 0.07); }

.btn-ghost { border: 1px solid var(--rb-border-strong); background: transparent; color: var(--text-primary); }
.btn-ghost:hover { background: var(--rb-surface-hover); }

.btn-danger-soft { border: 1px solid rgba(198, 40, 40, 0.35); background: transparent; color: #C62828; }
.btn-danger-soft:hover:not(:disabled) { background: rgba(198, 40, 40, 0.07); }
.btn-danger-soft:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-primary:focus-visible,
.btn-soft:focus-visible,
.btn-ghost:focus-visible,
.btn-danger-soft:focus-visible,
.tab:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 2px;
}

/* ── Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--rb-overlay, rgba(15, 23, 42, 0.5));
}

.modal-card {
  width: 100%;
  max-width: 440px;
  padding: 22px;
  border: 1px solid var(--card-border);
  border-radius: 20px;
  background: var(--rb-surface);
  box-shadow: var(--rb-shadow-md);
}

.modal-card__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.modal-card__heading { display: flex; align-items: center; gap: 10px; }

.modal-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(198, 40, 40, 0.1);
  color: #C62828;
}

.modal-card__title { margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary); }

.modal-card__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.modal-card__close:hover { background: var(--rb-surface-hover); }
.modal-subtitle { margin: 14px 0 18px; font-size: 13.5px; line-height: 1.55; color: var(--text-secondary); }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; }

.modal-enter-active,
.modal-leave-active { transition: opacity 0.18s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
  .tab, .swatch__circle, .mode-card, .toggle-switch__track, .toggle-switch__track::after { transition: none; }
}

/* Blood center screens are desktop-first; narrow windows still stack cleanly. */
@media (max-width: 900px) {
  .card--split,
  .card--appearance { grid-template-columns: minmax(0, 1fr); }
  .card__aside { border-right: none; border-bottom: 1px solid var(--card-border); border-radius: 22px 22px 0 0; }
  .mini { margin: 0 24px 24px; }
  .info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .id-banner { flex-wrap: wrap; }
  .form-grid,
  .readonly-grid,
  .info-grid,
  .mode-cards { grid-template-columns: minmax(0, 1fr); }
}

/* Swatch rings sit on the card colour, which is dark in dark mode. */
:global(.dark .scope-blood-center-settings .mini__line) { background: rgba(241, 245, 249, 0.7); }
:global(.dark .scope-blood-center-settings .mini__line--sm) { background: rgba(241, 245, 249, 0.35); }
:global(.dark .scope-blood-center-settings .mini__hero) {
  background: linear-gradient(135deg, color-mix(in srgb, var(--rb-primary) 45%, #1E293B), color-mix(in srgb, var(--rb-primary) 18%, #1E293B));
}
:global(.dark .scope-blood-center-settings .id-banner) {
  background: radial-gradient(70% 140% at 100% 0%, color-mix(in srgb, var(--rb-primary-text) 14%, transparent), transparent 60%), var(--rb-surface);
}
</style>
