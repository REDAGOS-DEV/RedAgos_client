<template>
  <div class="settings-page scope-hospital-settings">
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
            <input type="file" accept="image/jpeg,image/png,image/webp" class="avatar-upload-input" @change="onAvatarChange" />
          </label>
        </div>

        <div class="id-banner__who">
          <h1 class="id-banner__name">{{ niceName || 'Your account' }}</h1>
          <p class="id-banner__role">{{ roleText }}<template v-if="facility.name"> · {{ facility.name }}</template></p>
          <div class="id-banner__chips">
            <span v-if="profileForm.employeeId" class="chip"><AssetIcon name="id-card" :size="12" /> {{ profileForm.employeeId }}</span>
            <span v-if="accountInfo.status" class="chip" :class="`chip--${statusClass(accountInfo.status)}`">
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
          v-for="tab in TABS"
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

      <!-- PROFILE -->
      <section v-if="activeTab === 'profile'" class="card">
        <header class="card__head">
          <div>
            <h2 class="card__title">Profile</h2>
            <p class="card__sub">Your details as blood centers see them on the requests you send.</p>
          </div>
          <span v-if="editingProfile" class="editing-pill"><AssetIcon name="pencil" :size="12" /> Editing</span>
        </header>

        <div class="field-groups">
          <div class="field-group">
            <p class="field-group__title">Name</p>
            <div class="form-grid">
              <!-- First and last name are stored apart, so they are edited apart. -->
              <div class="form-group">
                <label class="form-label" for="hs-first-name">First name</label>
                <input id="hs-first-name" v-model="profileForm.firstName" type="text" class="form-input" :disabled="!editingProfile" />
              </div>
              <div class="form-group">
                <label class="form-label" for="hs-last-name">Last name</label>
                <input id="hs-last-name" v-model="profileForm.lastName" type="text" class="form-input" :disabled="!editingProfile" />
              </div>
            </div>
          </div>

          <div class="field-group">
            <p class="field-group__title">Work</p>
            <div class="form-grid">
              <!-- The person's own credentials, e.g. RMT, printed after their name on what they sign. -->
              <div class="form-group">
                <label class="form-label" for="hs-title">Title <span class="form-optional">optional</span></label>
                <ComboInput
                  id="hs-title"
                  v-model="profileForm.credentials"
                  :options="CREDENTIAL_OPTIONS"
                  maxlength="40"
                  placeholder="e.g. RMT"
                  :disabled="!editingProfile"
                />
              </div>
              <div class="form-group">
                <label class="form-label" for="hs-phone">Contact number</label>
                <input id="hs-phone" v-model="profileForm.contactNumber" type="tel" class="form-input" placeholder="09XXXXXXXXX" :disabled="!editingProfile" />
              </div>
            </div>
          </div>

          <!-- Set by the blood bank's Head: shown, not edited here -->
          <div class="field-group">
            <p class="field-group__title">Set by your Blood Bank Head</p>
            <dl class="readonly-grid">
              <div><dt><AssetIcon name="briefcase" :size="13" /> Role</dt><dd>{{ roleText }}</dd></div>
              <div><dt><AssetIcon name="building-2" :size="13" /> Hospital</dt><dd>{{ facility.name || '-' }}</dd></div>
              <div><dt><AssetIcon name="mail" :size="13" /> Sign-in email</dt><dd>{{ profileForm.email || '-' }}</dd></div>
              <div><dt><AssetIcon name="id-card" :size="13" /> Employee ID</dt><dd>{{ profileForm.employeeId || '-' }}</dd></div>
            </dl>
            <p v-if="editingProfile" class="form-hint">Ask your Blood Bank Head to change your role or sign-in email.</p>
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
          <p class="card__sub">Changing it signs you out everywhere, this device included; sign in again with the new one.</p>
          <ul class="checklist" aria-label="Password requirements">
            <li v-for="rule in passwordRules" :key="rule.label" :class="{ 'checklist--ok': rule.met }">
              <AssetIcon :name="rule.met ? 'check' : 'circle'" :size="13" /> {{ rule.label }}
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

      <!-- APPEARANCE -->
      <section v-if="activeTab === 'appearance'" class="card card--split card--appearance">
        <div class="card__main">
          <h2 class="card__title">Appearance</h2>
          <p class="card__sub">Make RedAgos yours. Saved on this device and used in every RedAgos portal.</p>
          <!-- The shared picker: mode, colour and custom colour. -->
          <AppearancePicker class="card__picker" />
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
              <span class="mini__btn">Tag to patient</span>
            </div>
            <div class="mini__row">
              <span class="mini__card"><span class="mini__num">42</span><span class="mini__cap">Units</span></span>
              <span class="mini__card"><span class="mini__num">3</span><span class="mini__cap">Tagged</span></span>
            </div>
            <div class="mini__row mini__row--end">
              <span class="mini__chip">Crossmatched</span>
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
              <p class="device__meta">{{ thisDevice.os || 'Unknown system' }} · {{ thisDevice.browser || 'Unknown browser' }}</p>
            </div>
            <span class="chip chip--active"><span class="chip__dot" /> Active now</span>
          </div>

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
            <div><dt>Role</dt><dd>{{ roleText }}</dd></div>
            <div><dt>Hospital</dt><dd>{{ facility.name || 'Not linked' }}</dd></div>
            <div><dt>Created</dt><dd>{{ accountInfo.createdAt }}</dd></div>
            <div><dt>Email</dt><dd>{{ accountInfo.emailVerified ? 'Verified' : 'Not verified' }}</dd></div>
            <div>
              <dt>Status</dt>
              <dd><span class="chip" :class="`chip--${statusClass(accountInfo.status)}`"><span class="chip__dot" /> {{ accountInfo.status }}</span></dd>
            </div>
          </dl>
        </section>
      </template>

      <!-- HOSPITAL: the blood bank's own record, as blood centers see it -->
      <section v-if="activeTab === 'hospital'" class="card">
        <header class="card__head">
          <div>
            <h2 class="card__title">Hospital</h2>
            <p class="card__sub">Your blood bank as blood centers see it when you request blood. Kept by the RedAgos administrators; ask them to change it.</p>
          </div>
        </header>
        <dl class="info-grid info-grid--two">
          <div><dt>Name</dt><dd>{{ facility.name || '-' }}</dd></div>
          <div><dt>DOH license number</dt><dd>{{ facility.license || '-' }}</dd></div>
          <div class="info-grid__wide"><dt>Address</dt><dd>{{ facility.address || '-' }}</dd></div>
          <div><dt>Operating hours</dt><dd>{{ facility.hours || '-' }}</dd></div>
          <div>
            <dt>Status</dt>
            <dd><span class="chip" :class="`chip--${statusClass(facility.status)}`"><span class="chip__dot" /> {{ facility.status || '-' }}</span></dd>
          </div>
        </dl>
      </section>
    </div>

    <!-- confirm log out everywhere -->
    <Transition name="modal">
      <div v-if="confirmLogoutOthers" class="modal-overlay" @click.self="confirmLogoutOthers = false">
        <div
          v-focus-trap
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-others-title"
          @dialog-escape="confirmLogoutOthers = false"
        >
          <div class="modal-card__header">
            <div class="modal-card__heading">
              <span class="modal-card__icon"><AssetIcon name="log-out" :size="16" /></span>
              <h2 id="logout-others-title" class="modal-card__title">Log out of all devices?</h2>
            </div>
            <button type="button" class="modal-card__close" aria-label="Close" @click="confirmLogoutOthers = false">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>
          <p class="modal-subtitle">
            This signs you out everywhere, including this device. You'll need to sign in again on each one.
          </p>
          <p v-if="sessionError" class="note note--error note--flat"><AssetIcon name="circle-alert" :size="14" /> {{ sessionError }}</p>
          <div class="modal-actions">
            <button type="button" class="ui-btn ui-btn--ghost" @click="confirmLogoutOthers = false">Cancel</button>
            <button type="button" class="btn-danger-soft" :disabled="loggingOutOthers" @click="logoutOtherDevices">
              {{ loggingOutOthers ? 'Logging out...' : 'Yes, log out everywhere' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
/**
 * The hospital staff member's own Settings, laid out as the blood center's
 * (project owner, 2026-10-28): who this is, then pill tabs — Profile,
 * Security, Appearance, Account and Hospital.
 *
 * Everything here is real: the profile, photo and password go through
 * /hospital/profile and /hospital/password (the same staff profile the
 * centre's staff use), signing out everywhere through /logout-all, and the
 * appearance is this device's own. The hospital's record is shown, not
 * edited: the RedAgos administrators keep it.
 */

import AppearancePicker from '~/components/common/AppearancePicker.vue'
import ComboInput from '~/components/common/ComboInput.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { authService } from '~/api/auth/AuthService'
import { hospitalService } from '~/api/hospital/HospitalService'
import { resolveApiAssetURL } from '~/api/BaseService'
import { DEFAULT_ACCENT } from '~/utils/accentThemes'
import { useAccentTheme } from '~/composables/useAccentTheme'
import { useDarkMode } from '~/composables/useDarkMode'
import { useUser } from '~/composables/useUser'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard' })

const TABS = [
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'security', label: 'Security', icon: 'lock' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'account', label: 'Account', icon: 'monitor' },
  { id: 'hospital', label: 'Hospital', icon: 'building-2' },
]

// Suggested credentials; any other is typed.
const CREDENTIAL_OPTIONS = ['RMT', 'RN', 'MD']

const route = useRoute()
const activeTab = ref(TABS.some((tab) => tab.id === route.query.tab) ? String(route.query.tab) : 'profile')

const loading = ref(true)
const { user: sessionUser, fetchUser, updateAvatar, logout } = useUser()

function initials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

// The person's hospital role, as the Head set it in Staff. Shown, not edited.
const roleText = computed(() => sessionUser.value?.hospital_role_label || 'Hospital Staff')

/* ---------------------------- PROFILE ---------------------------- */

const profile = reactive({
  avatarUrl: '',
  fullName: '',
  firstName: '',
  lastName: '',
  employeeId: '',
  credentials: '',
  email: '',
  contactNumber: '',
})
const profileForm = reactive({ ...profile })

const facility = reactive({ name: '', address: '', license: '', hours: '', status: '' })

const editingProfile = ref(false)
const savingProfile = ref(false)
const profileError = ref('')
const profileSuccess = ref('')

// Names are stored as typed ("ana reyes"); show them capitalised.
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
  dropPendingAvatar()
  Object.assign(profileForm, profile)
  editingProfile.value = false
  profileError.value = ''
}

// The photo picked while editing, shown as a preview and uploaded on Save;
// Cancel drops it. The server checks the same type and size again.
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const pendingAvatar = ref(null)

function dropPendingAvatar() {
  if (pendingAvatar.value && profileForm.avatarUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(profileForm.avatarUrl)
  }
  pendingAvatar.value = null
}

function onAvatarChange(e) {
  const file = e.target.files?.[0]
  // Cleared so picking the same file again still fires a change.
  e.target.value = ''
  if (!file) return

  profileError.value = ''
  if (!AVATAR_TYPES.includes(file.type)) {
    profileError.value = 'Profile photos must be a JPEG, PNG or WebP image.'
    return
  }
  if (file.size > AVATAR_MAX_BYTES) {
    profileError.value = 'Profile photos must be 2 MB or smaller.'
    return
  }

  dropPendingAvatar()
  pendingAvatar.value = file
  profileForm.avatarUrl = URL.createObjectURL(file)
}

function firstError(err, fallback) {
  return Object.values(err?.data?.errors ?? err?.errors ?? {}).flat()[0]
    || err?.data?.message
    || fallback
}

async function saveProfile() {
  savingProfile.value = true
  profileError.value = ''
  profileSuccess.value = ''
  try {
    if (pendingAvatar.value) {
      const form = new FormData()
      form.append('avatar', pendingAvatar.value)
      const res = await hospitalService.uploadAvatar(form)
      const uploaded = resolveApiAssetURL(res?.avatar_url)
      dropPendingAvatar()
      profile.avatarUrl = uploaded ?? ''
      profileForm.avatarUrl = profile.avatarUrl
      // The header reads the session's photo; swap it in now.
      updateAvatar(uploaded)
    }

    // The fields PATCH /hospital/profile accepts, in its names. Email and
    // role are not changed from here.
    const updated = await hospitalService.updateProfile({
      first_name: profileForm.firstName.trim(),
      last_name: profileForm.lastName.trim(),
      phone: profileForm.contactNumber.trim() || undefined,
      credentials: profileForm.credentials.trim() || null,
    })
    applyServerData(updated)
    // The header shows the name from the session; refresh it so it matches.
    fetchUser()
    editingProfile.value = false
    profileSuccess.value = 'Profile updated.'
  } catch (err) {
    profileError.value = firstError(err, 'Could not save changes. Please try again.')
  } finally {
    savingProfile.value = false
  }
}

/* ---------------------------- SECURITY ---------------------------- */
const passwordForm = reactive({ current: '', new: '', confirm: '' })
const showCurrent = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)
const updatingPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

// What the server requires of a new password (Password::min(8)->mixedCase()->numbers()).
const passwordRules = computed(() => [
  { label: 'At least 8 characters', met: passwordForm.new.length >= 8 },
  { label: 'Upper and lower case letters', met: /[a-z]/.test(passwordForm.new) && /[A-Z]/.test(passwordForm.new) },
  { label: 'At least one number', met: /\d/.test(passwordForm.new) },
  { label: 'New passwords match', met: Boolean(passwordForm.new) && passwordForm.new === passwordForm.confirm },
])

async function updatePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''

  if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
    passwordError.value = 'Please fill out all password fields.'
    return
  }
  if (!passwordRules.value.every((rule) => rule.met)) {
    passwordError.value = 'The new password does not meet every requirement yet.'
    return
  }

  updatingPassword.value = true
  try {
    await hospitalService.updatePassword({
      current_password: passwordForm.current,
      password: passwordForm.new,
      password_confirmation: passwordForm.confirm,
    })
    passwordForm.current = ''
    passwordForm.new = ''
    passwordForm.confirm = ''
    passwordSuccess.value = 'Password updated. Taking you to the sign-in page...'
    // The server ended every session, this one included.
    await logout('/auth/login')
  } catch (err) {
    passwordError.value = firstError(err, 'Could not update the password. Check your current password and try again.')
  } finally {
    updatingPassword.value = false
  }
}

/* ---------------------------- ACCOUNT ---------------------------- */
const confirmLogoutOthers = ref(false)
const loggingOutOthers = ref(false)
const sessionError = ref('')

async function logoutOtherDevices() {
  loggingOutOthers.value = true
  sessionError.value = ''
  try {
    await authService.logoutFromAllDevices()
    confirmLogoutOthers.value = false
    // The server revoked this device's token too, so finish here.
    await logout('/auth/login')
  } catch {
    sessionError.value = 'Could not sign out everywhere. Please try again.'
  } finally {
    loggingOutOthers.value = false
  }
}

const accountInfo = reactive({ username: '', createdAt: '', emailVerified: false, status: '' })

// "Windows · Chrome" from the user agent, for the signed-in devices card.
function describeThisDevice() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''
  return { os, browser }
}
const thisDevice = reactive({ os: '', browser: '' })

const STATUS_LABELS = {
  active: 'Active',
  approved: 'Approved',
  pending: 'Pending',
  pending_verification: 'Pending verification',
  suspended: 'Suspended',
  deactivated: 'Deactivated',
  rejected: 'Rejected',
}
const statusLabel = (value) => STATUS_LABELS[value] || value || ''
const statusClass = (label) => (label || '').toLowerCase().replace(/\s+/g, '-')

function formatDateTime(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/* ---------------------------- APPEARANCE ---------------------------- */
// Mode is the shared Light / Dark / System setting (same as the account menu);
// the colour is one choice for every portal on this device.
const { themeMode, setThemeMode } = useDarkMode()
const { current: accentKey, set: setAccent } = useAccentTheme()

const isDefaultAppearance = computed(() => accentKey.value === DEFAULT_ACCENT && themeMode.value === 'system')

function resetAppearance() {
  setAccent(DEFAULT_ACCENT)
  setThemeMode('system')
}

/* ---------------------------- LOAD ---------------------------- */

/**
 * GET/PATCH /hospital/profile answer { profile, facility, account } in the
 * server's names (first_name, phone, …). The form uses its own, so map here.
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
    avatarUrl: resolveApiAssetURL(p.avatar_url) ?? sessionUser.value?.avatar ?? '',
  }
  Object.assign(profile, mapped)
  Object.assign(profileForm, mapped)

  const f = data?.facility ?? {}
  Object.assign(facility, {
    name: f.name ?? '',
    address: f.address ?? '',
    license: f.doh_license_number ?? '',
    hours: typeof f.operating_hours === 'string' ? f.operating_hours : '',
    status: statusLabel(f.status),
  })

  const account = data?.account ?? {}
  Object.assign(accountInfo, {
    username: account.username || 'Not set',
    createdAt: formatDateTime(account.created_at),
    emailVerified: Boolean(account.email_verified),
    status: statusLabel(account.account_status) || 'Unknown',
  })
}

onMounted(async () => {
  Object.assign(thisDevice, describeThisDevice())
  try {
    applyServerData(await hospitalService.profile())
  } catch {
    // Fall back to the signed-in account, so the page still says who this is.
    const u = sessionUser.value
    Object.assign(profile, {
      fullName: u?.full_name ?? '',
      firstName: u?.first_name ?? '',
      lastName: u?.last_name ?? '',
      email: u?.email ?? '',
      avatarUrl: u?.avatar ?? '',
    })
    Object.assign(profileForm, profile)
    profileError.value = 'Your profile could not be loaded. Refresh to try again.'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
/*
 * The blood center's Settings (pages/blood-center/settings.vue), on the
 * system tokens, which flip in dark mode on their own, and on --rb-primary,
 * which the portal colour sets. So this page needs almost no dark rules.
 */
.settings-page {
  --text-primary: var(--rb-text-primary);
  --text-secondary: var(--rb-text-secondary);
  --card-border: var(--rb-border);
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
.skeleton--tabs { height: 44px; max-width: 560px; border-radius: 999px; }
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
.chip--active,
.chip--approved { background: rgba(46, 125, 50, 0.1); color: var(--rb-success-text, #2E7D32); }
.chip--pending,
.chip--pending-verification { background: rgba(245, 124, 0, 0.12); color: var(--rb-warning-text, #B45309); }
.chip--suspended,
.chip--deactivated,
.chip--rejected { background: rgba(198, 40, 40, 0.1); color: #C62828; }

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
.card > .device,
.card > .info-grid { margin-left: 24px; margin-right: 24px; }
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

/* Anchored on the page root, so a portal's unscoped `.dark .form-input` rule cannot outrank it. */
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
.card__main .note,
.note--flat { margin: 0 0 14px; }
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

/* A tiny hospital screen in the picked colour */
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
.info-grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.info-grid__wide { grid-column: 1 / -1; }
.info-grid > div { padding: 14px 16px; background: var(--rb-surface); }
.info-grid dt { font-size: 11.5px; font-weight: 600; color: var(--text-secondary); }
.info-grid dd { margin: 4px 0 0; font-size: 14px; font-weight: 600; color: var(--text-primary); }

/* ── Buttons ── */
.btn-danger-soft {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 40px;
  padding: 0 20px;
  border-radius: 999px;
  border: 1px solid rgba(198, 40, 40, 0.35);
  background: transparent;
  color: #C62828;
  font: inherit;
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.btn-danger-soft:hover:not(:disabled) { background: rgba(198, 40, 40, 0.07); }
.btn-danger-soft:disabled { opacity: 0.6; cursor: not-allowed; }
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
.modal-card:focus { outline: none; }
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
  .tab { transition: none; }
}

@media (max-width: 900px) {
  .card--split,
  .card--appearance { grid-template-columns: minmax(0, 1fr); }
  .card__aside { border-right: none; border-bottom: 1px solid var(--card-border); border-radius: 22px 22px 0 0; }
  .mini { margin: 0 24px 24px; }
  .info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .settings-page { padding: 16px 16px 32px; }
  .id-banner { flex-wrap: wrap; }
  .form-grid,
  .readonly-grid,
  .info-grid,
  .info-grid--two { grid-template-columns: minmax(0, 1fr); }
}

:global(.dark .scope-hospital-settings .mini__line) { background: rgba(241, 245, 249, 0.7); }
:global(.dark .scope-hospital-settings .mini__line--sm) { background: rgba(241, 245, 249, 0.35); }
:global(.dark .scope-hospital-settings .mini__hero) {
  background: linear-gradient(135deg, color-mix(in srgb, var(--rb-primary) 45%, #1E293B), color-mix(in srgb, var(--rb-primary) 18%, #1E293B));
}
:global(.dark .scope-hospital-settings .id-banner) {
  background: radial-gradient(70% 140% at 100% 0%, color-mix(in srgb, var(--rb-primary-text) 14%, transparent), transparent 60%), var(--rb-surface);
}
</style>
