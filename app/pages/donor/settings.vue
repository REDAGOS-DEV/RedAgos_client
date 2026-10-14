<template>
    <div class="settings-page scope-donor-settings">
        <!-- Skeleton loading state -->
        <div v-if="loading" class="skeleton-wrap">
            <div class="skeleton skeleton--header" />
            <div class="skeleton skeleton--panel" style="height:72px" />
            <div class="skeleton skeleton--panel" style="height:200px" />
            <div class="skeleton-main-grid">
                <div class="skeleton skeleton--panel" style="height:320px" />
                <div class="skeleton skeleton--panel" style="height:320px" />
            </div>
        </div>

        <template v-else>
            <div class="header-row">
                <h1 class="page-title">Personalize your experience</h1>
                <p class="page-subtitle">How the donor portal looks, what it tells you, and how you sign in.</p>
            </div>

            <!-- Who is signed in; personal details are edited on the Profile page -->
            <NuxtLink to="/donor/profile" class="profile-strip">
                <span class="profile-strip__avatar">
                    <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="" class="profile-strip__img">
                    <span v-else>{{ initials }}</span>
                </span>
                <span class="profile-strip__text">
                    <span class="profile-strip__name">{{ niceName }}</span>
                    <span class="profile-strip__meta">Donor ID: {{ profile.donorId || '-' }} · {{ profile.email || '-' }}</span>
                </span>
                <span class="profile-strip__cta">
                    Edit personal info
                    <AssetIcon name="chevron-right" :size="15" />
                </span>
            </NuxtLink>

            <!--
              Appearance: the donor's colour theme. Applies to the whole donor
              portal at once and is saved on this device (see
              composables/useAccentTheme.ts). The preview uses the live theme
              variables, so it changes the moment a swatch is picked.
            -->
            <section class="panel appearance-panel" aria-labelledby="appearance-title">
                <div class="appearance-panel__pick">
                    <h2 id="appearance-title" class="panel-title">Appearance</h2>
                    <p class="appearance__lead">Choose a colour for your portal. It applies to every RedAgos portal on this device.</p>
                    <div class="swatches" role="radiogroup" aria-label="Colour theme">
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
                            <span
                                class="swatch__circle"
                                :style="{ background: `linear-gradient(135deg, ${t.gradFrom}, ${t.gradTo})`, '--ring': t.primary }"
                            >
                                <span class="swatch__dot" :style="{ background: t.primary }" />
                                <span v-if="accentKey === t.key" class="swatch__check" :style="{ background: t.primary }">
                                    <AssetIcon name="check" :size="12" />
                                </span>
                            </span>
                            <span class="swatch__name">{{ t.name }}</span>
                        </button>
                    </div>
                    <p class="appearance__note">
                        <AssetIcon name="info" :size="13" />
                        Saved on this device. Light, dark, or same as your browser: choose it in your account menu (top right).
                    </p>
                </div>

                <!-- A tiny dashboard in the picked theme -->
                <div class="theme-preview" aria-hidden="true">
                    <div class="theme-preview__hero">
                        <span class="theme-preview__line theme-preview__line--sm" />
                        <span class="theme-preview__line" />
                        <span class="theme-preview__btn">Book a donation</span>
                    </div>
                    <div class="theme-preview__row">
                        <span class="theme-preview__chip">Next</span>
                        <span class="theme-preview__toggle"><span /></span>
                        <span class="theme-preview__ring" />
                    </div>
                    <p class="theme-preview__label">Preview</p>
                </div>
            </section>

            <div class="main-grid">
                <!-- Notification preferences -->
                <section class="panel" aria-labelledby="notif-title">
                    <div class="panel-header panel-header--simple">
                        <h2 id="notif-title" class="panel-title">Notifications</h2>
                        <p class="panel-sub">Choose what RedAgos tells you about.</p>
                    </div>
                    <div class="toggle-list">
                        <div v-for="pref in notificationPrefs" :key="pref.key" class="toggle-row">
                            <div class="toggle-row__text">
                                <p :id="`pref-${pref.key}`" class="toggle-row__label">{{ pref.label }}</p>
                                <p class="toggle-row__desc">{{ pref.desc }}</p>
                            </div>
                            <button
                                type="button"
                                class="toggle-switch"
                                :class="{ 'toggle-switch--on': pref.enabled }"
                                role="switch"
                                :aria-checked="pref.enabled"
                                :aria-labelledby="`pref-${pref.key}`"
                                @click="pref.enabled = !pref.enabled"
                            >
                                <span class="toggle-switch__knob" />
                            </button>
                        </div>
                    </div>
                    <div class="panel-footer">
                        <p class="status-note" :class="{ 'status-note--error': notifsError, 'status-note--ok': notifsSaved && !notifsError }" aria-live="polite">
                            <template v-if="notifsError">{{ notifsError }}</template>
                            <template v-else-if="notifsSaved"><AssetIcon name="check" :size="14" /> Saved</template>
                        </p>
                        <button type="button" class="btn-outline" :disabled="savingNotifs" @click="saveNotifications">
                            {{ savingNotifs ? 'Saving...' : 'Save preferences' }}
                        </button>
                    </div>
                </section>

                <!-- Password & security -->
                <section class="panel" aria-labelledby="security-title">
                    <div class="panel-header panel-header--simple">
                        <h2 id="security-title" class="panel-title">Password &amp; security</h2>
                        <p class="panel-sub">Choose one you don't use on other sites.</p>
                    </div>
                    <div class="form-body">
                        <div class="form-stack">
                            <div class="form-field">
                                <label class="form-label" for="pw-current">Current password</label>
                                <div class="password-field">
                                    <input
                                        id="pw-current"
                                        v-model="security.currentPassword"
                                        :type="showCurrentPassword ? 'text' : 'password'"
                                        class="form-input"
                                        autocomplete="current-password"
                                        placeholder="**************"
                                    >
                                    <button
                                        type="button"
                                        class="password-toggle"
                                        :aria-label="showCurrentPassword ? 'Hide password' : 'Show password'"
                                        @click="showCurrentPassword = !showCurrentPassword"
                                    >
                                        <AssetIcon :name="showCurrentPassword ? 'eye' : 'eye-off'" :size="16" />
                                    </button>
                                </div>
                            </div>
                            <div class="form-field">
                                <label class="form-label" for="pw-new">New password</label>
                                <div class="password-field">
                                    <input
                                        id="pw-new"
                                        v-model="security.newPassword"
                                        :type="showNewPassword ? 'text' : 'password'"
                                        class="form-input"
                                        autocomplete="new-password"
                                        placeholder="**************"
                                    >
                                    <button
                                        type="button"
                                        class="password-toggle"
                                        :aria-label="showNewPassword ? 'Hide password' : 'Show password'"
                                        @click="showNewPassword = !showNewPassword"
                                    >
                                        <AssetIcon :name="showNewPassword ? 'eye' : 'eye-off'" :size="16" />
                                    </button>
                                </div>
                            </div>
                            <div class="form-field">
                                <label class="form-label" for="pw-confirm">Confirm new password</label>
                                <div class="password-field">
                                    <input
                                        id="pw-confirm"
                                        v-model="security.confirmPassword"
                                        :type="showConfirmPassword ? 'text' : 'password'"
                                        class="form-input"
                                        autocomplete="new-password"
                                        placeholder="**************"
                                    >
                                    <button
                                        type="button"
                                        class="password-toggle"
                                        :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
                                        @click="showConfirmPassword = !showConfirmPassword"
                                    >
                                        <AssetIcon :name="showConfirmPassword ? 'eye' : 'eye-off'" :size="16" />
                                    </button>
                                </div>
                            </div>
                            <p v-if="passwordMismatch" class="field-error">
                                <AssetIcon name="alert" :size="13" />
                                New password and confirmation don't match.
                            </p>
                        </div>

                        <div class="form-footer">
                            <p class="status-note" :class="{ 'status-note--error': passwordFailed, 'status-note--ok': passwordMessage && !passwordFailed }" aria-live="polite">
                                {{ passwordMessage }}
                            </p>
                            <button
                                type="button"
                                class="btn-primary"
                                :disabled="savingPassword || !canSubmitPassword"
                                @click="updatePassword"
                            >
                                {{ savingPassword ? 'Updating...' : 'Update password' }}
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <!-- Account -->
            <section class="panel account-panel" aria-labelledby="account-title">
                <div class="account-panel__text">
                    <h2 id="account-title" class="panel-title">Account</h2>
                    <p class="account-note">
                        Deleting your account permanently removes your donor profile, screening history, and QR code.
                    </p>
                </div>
                <div class="account-actions">
                    <button type="button" class="account-action" @click="handleLogout">
                        <AssetIcon name="log-out" :size="16" />
                        <span>Log out</span>
                    </button>
                    <button type="button" class="account-action account-action--danger" @click="confirmDeleteOpen = true">
                        <AssetIcon name="trash-2" :size="16" />
                        <span>Delete account</span>
                    </button>
                </div>
            </section>
        </template>

        <!-- Delete account confirmation -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div v-if="confirmDeleteOpen" class="modal-backdrop settings-modal" @click.self="confirmDeleteOpen = false">
                    <div class="modal-card" role="dialog" v-focus-trap aria-modal="true" aria-labelledby="delete-title">
                        <div class="modal-check modal-check--danger">
                            <AssetIcon name="alert" :size="24" />
                        </div>
                        <h2 id="delete-title" class="modal-title">Delete your account?</h2>
                        <p class="modal-subtitle">
                            This can't be undone. Your profile, screening history, and QR code will be permanently removed.
                        </p>
                        <div class="delete-confirm">
                            <label class="form-label" for="delete-password">Confirm your password</label>
                            <input id="delete-password" v-model="deletePassword" type="password"
                                class="form-input" autocomplete="current-password"
                                placeholder="Enter your password">
                            <p v-if="deleteError" class="delete-confirm__error">{{ deleteError }}</p>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn-outline" @click="confirmDeleteOpen = false">
                                Cancel
                            </button>
                            <button type="button" class="btn-danger" :disabled="deleting" @click="handleDeleteAccount">
                                {{ deleting ? 'Deleting...' : 'Delete account' }}
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth',
  layout: 'donordashboard',
  keepalive: true,
})

import { resolveApiAssetURL } from '~/api/BaseService'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { donorService } from '~/api/donor/DonorService'
import { useUser } from '~/composables/useUser'
import { useAccentTheme } from '~/composables/useAccentTheme'


const router = useRouter()
const { clearUser, logout } = useUser()

const loading = ref(true)

// Colour theme (Appearance card). The layout has already applied the saved one.
const { current: accentKey, themes: accentThemes, set: setAccent } = useAccentTheme()

const profile = reactive({
    fullName: '',
    email: '',
    phone: '',
    birthDate: '',
    bloodType: '',
    address: '',
    middle_name: '',
    occupation: '',
    nationality: '',
    donorId: '',
    avatarUrl: '',
})

const security = reactive({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
})

const notificationPrefs = reactive([
    { key: 'appointment_reminders', label: 'Appointment reminders', desc: 'Get notified before your scheduled donation.', enabled: true },
    { key: 'eligibility_renewal', label: 'Eligibility renewal', desc: 'Reminder when your screening is about to expire.', enabled: true },
    { key: 'nearby_drives', label: 'Nearby donation drives', desc: 'Alerts for mobile blood drives near you.', enabled: false },
    { key: 'email_updates', label: 'Email updates', desc: 'News and updates from the blood center.', enabled: false },
])
const deletePassword = ref('')
const deleteError = ref('')

const savingPassword = ref(false)
const passwordMessage = ref('')
const passwordFailed = ref(false)
const notifsError = ref('')
const savingNotifs = ref(false)
const deleting = ref(false)
const confirmDeleteOpen = ref(false)
const notifsSaved = ref(false)
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const initials = computed(() => {
    if (!profile.fullName) return '?'
    return profile.fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase())
        .join('')
})

// Names are stored as typed ("yana cruz"); show them capitalised.
const niceName = computed(() =>
    (profile.fullName || 'Your name').replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
)

const passwordMismatch = computed(() =>
    security.newPassword.length > 0 &&
    security.confirmPassword.length > 0 &&
    security.newPassword !== security.confirmPassword
)

const canSubmitPassword = computed(() =>
    security.currentPassword.length > 0 &&
    security.newPassword.length > 0 &&
    security.newPassword === security.confirmPassword
)

async function updatePassword() {
    if (!canSubmitPassword.value) return
    savingPassword.value = true
    passwordMessage.value = ''
    passwordFailed.value = false
    try {
        // Backend contract: POST /api/donor/change-password
        // Body: { current_password, new_password }
        await donorService.updatePassword({
            current_password: security.currentPassword,
            password: security.newPassword,
            password_confirmation: security.confirmPassword,
        })
        security.currentPassword = ''
        security.newPassword = ''
        security.confirmPassword = ''
        passwordMessage.value = 'Password updated.'
    } catch (err) {
        console.error('Failed to update password:', err)
        passwordFailed.value = true
        passwordMessage.value = err?.errors?.current_password?.[0]
            || err?.errors?.password?.[0]
            || err?.message
            || 'Could not update your password. Please try again.'
    } finally {
        savingPassword.value = false
    }
}

async function saveNotifications() {
    savingNotifs.value = true
    notifsSaved.value = false
    notifsError.value = ''
    try {
        // Backend contract: PATCH /api/donor/notification-preferences
        // Body: { appointment_reminders, eligibility_renewal, nearby_drives, email_updates }
        await donorService.updateNotificationPreferences(Object.fromEntries(notificationPrefs.map(p => [p.key, p.enabled])))
        notifsSaved.value = true
        formSnapshot = snapshotForm()
    } catch (err) {
        console.error('Failed to save notification preferences:', err)
        notifsError.value = err?.message || 'Could not save your preferences. Please try again.'
    } finally {
        savingNotifs.value = false
    }
}

async function handleLogout() {
    await logout('/auth/donor/login')
}


async function handleDeleteAccount() {
    if (!deletePassword.value) {
        deleteError.value = 'Please enter your password to confirm.'
        return
    }

    deleting.value = true
    deleteError.value = ''

    try {
        // DELETE /api/donors/account
        // Body: { password } — gipangayo sa server ang password isip
        // re-authentication sa dili pa i-close ang account.
        await donorService.deleteAccount({ password: deletePassword.value })

        localStorage.removeItem('_token')
        clearUser()
        confirmDeleteOpen.value = false
        router.push('/auth/donor/login')
    } catch (err) {
        console.error('Failed to delete account:', err)
        deleteError.value = err?.errors?.password?.[0]
            || err?.message
            || 'Could not delete your account. Please try again.'
    } finally {
        deleting.value = false
        deletePassword.value = ''
    }
}

// Gi-keepalive ni nga page, so mabuhi ang form ug ang toggles kung mo-navigate
// palayo ang donor. Explicit man ang pag-save ani (saveProfile /
// saveNotifications), so ang background refresh dili gyud angay mo-overwrite sa
// wala pa ma-save nga edits — gi-snapshot nato ug gi-skip kung dirty na.
let loadedOnce = false
let formSnapshot = ''

const snapshotForm = () => JSON.stringify({
    profile: { ...profile },
    prefs: notificationPrefs.map(pref => pref.enabled),
})

async function load({ silent = false } = {}) {
    if (!silent) loading.value = true
    try {
        // Backend contract: GET /api/donor/profile
        // Response: { full_name, email, phone, birth_date, blood_type, address,
        //   donor_id, avatar_url, notification_preferences }
        const data = await donorService.profile()

        if (silent && snapshotForm() !== formSnapshot) return

        applyProfile(data)

        if (data?.notification_preferences) {
            notificationPrefs.forEach(pref => {
                if (pref.key in data.notification_preferences) {
                    pref.enabled = !!data.notification_preferences[pref.key]
                }
            })
        }

        formSnapshot = snapshotForm()
    } catch (err) {
        console.error('Failed to load donor settings profile:', err)
    } finally {
        loading.value = false
        loadedOnce = true
    }
}

onMounted(() => load())
onActivated(() => {
    if (loadedOnce) load({ silent: true })
})

function applyProfile(data) {
    profile.fullName = data?.full_name ?? ''
    profile.email = data?.email ?? ''
    profile.phone = data?.phone ?? ''
    profile.birthDate = data?.birth_date ?? ''
    profile.bloodType = data?.blood_type ?? ''
    profile.address = data?.address ?? ''
    profile.middle_name = data?.middle_name ?? ''
    profile.occupation = data?.occupation ?? ''
    profile.nationality = data?.nationality ?? ''
    profile.donorId = data?.donor_id ?? ''
    profile.avatarUrl = resolveApiAssetURL(data?.avatar_url) ?? ''
}
</script>

<style scoped>
.settings-page {
    --primary: var(--rb-primary);
    --accent: #d32f2f;
    --success: #2e7d32;
    --warning: #f57c00;
    --text-primary: #1f2937;
    --text-secondary: #9ca3af;
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px 32px 40px;
    display: flex;
    background: var(--rb-page-bg);
    flex-direction: column;
    gap: 20px;
}

.header-row {
    display: flex;
    flex-direction: column;
}

.page-title {
    font-size: var(--rb-fs-title);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.page-subtitle {
    font-size: var(--rb-fs-small);
    color: var(--text-secondary);
    margin: 2px 0 0;
}

/* Skeleton loading */
.skeleton-wrap {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.skeleton {
    background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
    background-size: 400% 100%;
    border-radius: 14px;
    animation: shimmer 1.4s ease infinite;
}

.skeleton--header {
    height: 40px;
    max-width: 260px;
}

.skeleton-main-grid {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 20px;
    align-items: start;
}

.skeleton-col {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.skeleton--panel {
    border-radius: 14px;
}

@keyframes shimmer {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
    .skeleton { animation: none !important; }
}

@media (max-width: 900px) {
    .skeleton-main-grid {
        grid-template-columns: 1fr;
    }
}

.main-grid {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 20px;
    align-items: start;
}

.col-left,
.col-right {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.panel {
    background: white;
    border-radius: 14px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
    border: 1px solid #eef0f3;
    overflow: hidden;
}

.panel-header--simple {
    padding: 16px 20px;
    border-bottom: 1px solid #f3f4f6;
}

/* ── Appearance ── */
.appearance { padding: 16px 20px 18px; }
.appearance__lead {
    margin: 0 0 14px;
    font-size: var(--rb-fs-small);
    color: var(--text-secondary);
}
.swatches {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px 8px;
}
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
    width: 52px;
    height: 52px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
    transition: transform 150ms ease, box-shadow 150ms ease;
}
.swatch:hover .swatch__circle { transform: scale(1.06); }
.swatch--on .swatch__circle {
    box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--ring);
}
/* The button colour this theme uses, as a small dot. */
.swatch__dot {
    position: absolute;
    left: 50%;
    bottom: -3px;
    width: 14px;
    height: 14px;
    transform: translateX(-50%);
    border-radius: 50%;
    box-shadow: 0 0 0 2px #fff;
}
.swatch__check {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: #fff;
    box-shadow: 0 0 0 2px #fff;
}
.swatch__name {
    font-size: var(--rb-fs-caption);
    font-weight: 600;
    line-height: 1.25;
    text-align: center;
    color: var(--text-secondary);
}
.swatch--on .swatch__name { color: var(--text-primary); font-weight: 700; }
.swatch:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; border-radius: 12px; }
.appearance__note {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 16px 0 0;
    font-size: var(--rb-fs-caption);
    color: var(--text-secondary);
}
@media (prefers-reduced-motion: reduce) {
    .swatch__circle { transition: none; }
}

.panel-title {
    font-weight: 700;
    font-size: var(--rb-fs-body);
    color: var(--text-primary);
    margin: 0;
}

/* Profile form */
.form-body {
    padding: 20px;
}

.form-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.form-label {
    display: block;
    font-size: var(--rb-fs-caption);
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 6px;
}

.form-input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    font-size: var(--rb-fs-body);
    color: var(--text-primary);
    background: white;
    transition: border-color 0.15s ease;
}

.form-input:focus {
    outline: none;
    border-color: var(--primary);
}

.password-field {
    position: relative;
}

.password-field .form-input {
    padding-right: 40px;
}

.password-toggle {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
    transition: color 0.15s ease, background 0.15s ease;
}

.password-toggle:hover {
    color: var(--text-primary);
    background: #f3f4f6;
}

.input-icon-field {
    position: relative;
}

.input-icon-field__icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-secondary);
    pointer-events: none;
}

.form-input--with-icon {
    padding-left: 38px;
}

.select-wrap {
    position: relative;
}

.form-input--select {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 32px;
    cursor: pointer;
}

.select-wrap__icon {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
}

.field-error {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--rb-fs-caption);
    color: var(--accent);
    margin: -4px 0 0;
}

.form-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
}

.saved-note {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--rb-fs-small);
    font-weight: 600;
    color: var(--success);
}

/* Notification toggles */
.toggle-list {
    display: flex;
    flex-direction: column;
    padding: 8px 20px 4px;
}

.toggle-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #f3f4f6;
}

.toggle-row:last-child {
    border-bottom: none;
}

.toggle-row__label {
    font-size: var(--rb-fs-small);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.toggle-row__desc {
    font-size: var(--rb-fs-caption);
    color: var(--text-secondary);
    margin: 3px 0 0;
    line-height: 1.4;
}

.toggle-switch {
    flex-shrink: 0;
    width: 38px;
    height: 22px;
    border-radius: 999px;
    background: #d1d5db;
    border: none;
    padding: 2px;
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: background 0.15s ease;
    margin-top: 2px;
}

.toggle-switch--on {
    background: var(--primary);
    justify-content: flex-end;
}

.toggle-switch__knob {
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    transition: transform 0.15s ease;
}

.panel-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px 20px;
}

/* Account actions */
.account-actions {
    display: flex;
    flex-direction: column;
    padding: 8px 20px 4px;
}

.account-action {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    border: none;
    border-bottom: 1px solid #f3f4f6;
    background: none;
    font-size: var(--rb-fs-small);
    font-weight: 700;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
}

.account-action:last-child {
    border-bottom: none;
}

.account-action--danger {
    color: var(--accent);
}

.account-note {
    font-size: var(--rb-fs-caption);
    color: var(--text-secondary);
    line-height: 1.5;
    padding: 4px 20px 20px;
    margin: 0;
}

/* Buttons */
.btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: var(--rb-fs-small);
    font-weight: 700;
    color: white;
    background: var(--primary);
    border: none;
    cursor: pointer;
    transition: opacity 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
    opacity: 0.92;
}

.btn-primary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.btn-outline {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: var(--rb-fs-small);
    font-weight: 700;
    color: var(--text-primary);
    background: #f3f4f6;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
}

.btn-outline:hover:not(:disabled) {
    background: #e5e7eb;
}

.btn-danger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: var(--rb-fs-small);
    font-weight: 700;
    color: white;
    background: var(--accent);
    border: none;
    cursor: pointer;
    transition: opacity 0.15s ease;
}

.btn-danger:hover:not(:disabled) {
    opacity: 0.92;
}

.btn-danger:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.btn-block {
    width: 100%;
}

.delete-confirm {
    width: 100%;
    text-align: left;
    margin-bottom: 18px;
}

.delete-confirm__error {
    margin: 8px 0 0;
    font-size: var(--rb-fs-small);
    line-height: 1.5;
    color: var(--accent);
}
/* Delete confirmation modal */
.modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 1000;
}

.modal-card {
    /* Redeclared here because Teleport moves this DOM node out of .settings-page,
       so it no longer inherits the custom properties defined up there. */
    --primary: var(--rb-primary);
    --accent: #d32f2f;
    --success: #2e7d32;
    --text-primary: #1f2937;
    --text-secondary: #9ca3af;
    width: 100%;
    max-width: 360px;
    background: white;
    border-radius: 14px;
    padding: 28px 24px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    box-shadow: 0 8px 28px rgba(15, 23, 42, 0.16);
}

.modal-check {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: #e8f5e9;
    color: var(--success);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
}

.modal-check--danger {
    background: #fbeaea;
    color: var(--accent);
}

.modal-title {
    font-size: var(--rb-fs-section);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.modal-subtitle {
    font-size: var(--rb-fs-small);
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 6px 0 20px;
    max-width: 280px;
}

.modal-actions {
    display: flex;
    gap: 10px;
    width: 100%;
}

.modal-actions .btn-outline,
.modal-actions .btn-danger {
    flex: 1;
    width: auto;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
    transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
    opacity: 0;
}

.modal-fade-enter-active .modal-card,
.modal-fade-leave-active .modal-card {
    transition: transform 0.2s ease;
}

.modal-fade-enter-from .modal-card,
.modal-fade-leave-to .modal-card {
    transform: scale(0.96) translateY(8px);
}

@media (max-width: 900px) {
    .main-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 640px) {
    .settings-page {
        padding: 16px 16px 32px;
    }

    .form-row {
        grid-template-columns: 1fr;
    }
}


/* ── Redesign ── */
.panel { border-radius: 20px; }
.panel-header--simple { padding: 18px 20px 14px; }
.panel-sub { margin: 2px 0 0; font-size: var(--rb-fs-caption); color: #64748B; }
.main-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

/* Profile strip: who is signed in, linking to the Profile page */
.profile-strip {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    border: 1px solid #eef0f3;
    border-radius: 20px;
    background: white;
    text-decoration: none;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    transition: border-color 0.15s ease;
}

.profile-strip:hover { border-color: rgba(var(--rb-primary-rgb), 0.4); }
.profile-strip:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.profile-strip__avatar {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    overflow: hidden;
    border-radius: 50%;
    background: rgba(var(--rb-primary-rgb), 0.12);
    color: var(--rb-primary-text);
    font-weight: 800;
}

.profile-strip__img { width: 100%; height: 100%; object-fit: cover; }
.profile-strip__text { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.profile-strip__name { font-size: var(--rb-fs-body); font-weight: 700; color: var(--text-primary); }

.profile-strip__meta {
    overflow: hidden;
    font-size: var(--rb-fs-caption);
    color: #64748B;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.profile-strip__cta {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    font-size: var(--rb-fs-small);
    font-weight: 700;
    color: var(--rb-primary-text);
}

/* Appearance: the page's one showpiece, swatches beside a live preview */
.appearance-panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 24px;
    align-items: center;
    padding: 22px 24px;
}

.appearance-panel .appearance__lead { margin: 4px 0 18px; }
.appearance-panel .swatches { grid-template-columns: repeat(8, minmax(0, 1fr)); }

.theme-preview {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 1px solid #eef0f3;
    border-radius: 18px;
    background: #f8fafc;
}

.theme-preview__hero {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 7px;
    padding: 14px;
    border-radius: 14px;
    background: linear-gradient(135deg, var(--rb-grad-from, #E3F2FD), var(--rb-grad-to, #BBDEFB));
    transition: background 0.3s ease;
}

.theme-preview__line { width: 70%; height: 8px; border-radius: 999px; background: rgba(15, 23, 42, 0.55); }
.theme-preview__line--sm { width: 40%; height: 6px; background: rgba(15, 23, 42, 0.25); }

.theme-preview__btn {
    margin-top: 4px;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--rb-primary);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    transition: background-color 0.3s ease;
}

.theme-preview__row { display: flex; align-items: center; gap: 10px; }

.theme-preview__chip {
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(var(--rb-primary-rgb), 0.12);
    color: var(--rb-primary-text);
    font-size: 11px;
    font-weight: 700;
}

.theme-preview__toggle {
    display: flex;
    justify-content: flex-end;
    width: 34px;
    height: 20px;
    padding: 2px;
    border-radius: 999px;
    background: var(--rb-primary);
}

.theme-preview__toggle span { width: 16px; height: 16px; border-radius: 50%; background: #fff; }

.theme-preview__ring {
    width: 22px;
    height: 22px;
    margin-left: auto;
    border-radius: 50%;
    background: conic-gradient(var(--rb-primary) 65%, #e2e8f0 0);
    -webkit-mask: radial-gradient(circle, transparent 6px, #000 7px);
    mask: radial-gradient(circle, transparent 6px, #000 7px);
}

.theme-preview__label {
    position: absolute;
    top: -9px;
    right: 14px;
    margin: 0;
    padding: 1px 8px;
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 0 0 1px #eef0f3;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #64748B;
}

@media (prefers-reduced-motion: reduce) {
    .theme-preview__hero, .theme-preview__btn { transition: none; }
}

/* Save feedback, left of the buttons */
.panel-footer, .form-footer { justify-content: space-between; }
.status-note { display: flex; align-items: center; gap: 4px; margin: 0; font-size: var(--rb-fs-small); font-weight: 600; color: #64748B; }
.status-note--ok { color: var(--success); }
.status-note--error { color: #C62828; }

.panel-footer .btn-outline,
.form-footer .btn-primary { border-radius: 999px; padding-left: 20px; padding-right: 20px; }

/* Account: a slim row, danger kept quiet until clicked */
.account-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px 24px;
    flex-wrap: wrap;
    padding: 18px 20px;
}

.account-panel__text { flex: 1 1 320px; }
.account-panel .account-note { padding: 4px 0 0; }
.account-panel .account-actions { flex-direction: row; gap: 10px; padding: 0; }

.account-panel .account-action {
    padding: 10px 16px;
    border: 1px solid #e5e7eb;
    border-radius: 999px;
}

.account-panel .account-action:last-child { border-bottom: 1px solid #e5e7eb; }
.account-panel .account-action:hover { background: #f8fafc; }
.account-panel .account-action--danger { border-color: #F5C2C2; }
.account-panel .account-action--danger:last-child { border-bottom-color: #F5C2C2; }
.account-panel .account-action--danger:hover { background: #FEF3F2; }
.account-panel .account-action:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

@media (max-width: 1100px) {
    .main-grid { grid-template-columns: minmax(0, 1fr); }
    .appearance-panel { grid-template-columns: minmax(0, 1fr); }
    .theme-preview { max-width: 360px; }
}

@media (max-width: 760px) {
    .appearance-panel { padding: 18px 16px; }
    .appearance-panel .swatches { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .profile-strip { flex-wrap: wrap; }
    .profile-strip__cta { width: 100%; justify-content: flex-end; }
    .account-panel .account-actions { width: 100%; }
    .account-panel .account-action { flex: 1; justify-content: center; }
}

:global(.dark .scope-donor-settings .profile-strip) { background: #1E293B; border-color: #334155; }
:global(.dark .scope-donor-settings .profile-strip__avatar) { background: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); }
:global(.dark .scope-donor-settings .theme-preview) { background: #172033; border-color: #334155; }
:global(.dark .scope-donor-settings .theme-preview__hero) {
    background: linear-gradient(135deg, color-mix(in srgb, var(--rb-primary) 45%, #1E293B), color-mix(in srgb, var(--rb-primary) 18%, #1E293B));
}
:global(.dark .scope-donor-settings .theme-preview__line) { background: rgba(241, 245, 249, 0.7); }
:global(.dark .scope-donor-settings .theme-preview__line--sm) { background: rgba(241, 245, 249, 0.35); }
:global(.dark .scope-donor-settings .theme-preview__label) { background: #1E293B; box-shadow: 0 0 0 1px #334155; color: #94A3B8; }
:global(.dark .scope-donor-settings .theme-preview__chip) { background: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); }
:global(.dark .scope-donor-settings .account-panel .account-action) { border-color: #334155; }
:global(.dark .scope-donor-settings .account-panel .account-action:hover) { background: #263449; }
:global(.dark .scope-donor-settings .account-panel .account-action--danger) { border-color: rgba(239, 83, 80, 0.35); }
:global(.dark .scope-donor-settings .account-panel .account-action--danger:hover) { background: rgba(239, 83, 80, 0.12); }
:global(.dark .scope-donor-settings .panel-sub),
:global(.dark .scope-donor-settings .profile-strip__meta) { color: #94A3B8; }

/* ============ Dark mode ============ */
/*
 * Tanang dark rule naka-anchor sa .scope-donor-settings (ang .settings-page kay
 * gigamit pud sa blood-center ug hospital settings) ug sa .settings-modal (ang mga modal kay
 * gi-Teleport sa <body>, gawas sa page). `:global(…)` mogawas sa scope
 * system, so ang bare `:global(.dark .form-input)` kaniadto kay mo-match sa
 * .form-input sa TANANG page human ma-load ni nga stylesheet: mao ang
 * ngitngit nga inputs ug ang asul nga toggle sa profile.
 */

:global(.dark .scope-donor-settings) {
    --text-primary: #F1F5F9;
    --text-secondary: #94A3B8;
    background: #0F172A;
}

:global(.dark .scope-donor-settings .panel),
:global(.dark .settings-modal .panel) {
    background: #1E293B;
    border-color: #334155;
}

:global(.dark .scope-donor-settings .panel-header--simple),
:global(.dark .settings-modal .panel-header--simple) { border-color: #334155; }

:global(.dark .scope-donor-settings .avatar),
:global(.dark .settings-modal .avatar) { background: color-mix(in srgb, var(--rb-primary-text) 16%, transparent); }

:global(.dark .scope-donor-settings .form-input),
:global(.dark .settings-modal .form-input) {
    background: #0F172A;
    border-color: #334155;
    color: #F1F5F9;
}

:global(.dark .scope-donor-settings .password-toggle:hover),
:global(.dark .settings-modal .password-toggle:hover) { color: #F1F5F9; background: #263449; }

:global(.dark .scope-donor-settings .toggle-row),
:global(.dark .settings-modal .toggle-row) { border-color: #263449; }
:global(.dark .scope-donor-settings .toggle-switch) { background: #475569; }
:global(.dark .scope-donor-settings .toggle-switch--on) { background: var(--rb-primary); }

:global(.dark .scope-donor-settings .account-action),
:global(.dark .settings-modal .account-action) { border-color: #263449; }

:global(.dark .scope-donor-settings .btn-outline),
:global(.dark .settings-modal .btn-outline) {
    background: #263449;
    color: #E2E8F0;
}
:global(.dark .scope-donor-settings .btn-outline:hover:not(:disabled)),
:global(.dark .settings-modal .btn-outline:hover:not(:disabled)) { background: #334155; }

:global(.dark .scope-donor-settings .modal-card),
:global(.dark .settings-modal .modal-card) {
    background: #1E293B;
    --text-primary: #F1F5F9;
    --text-secondary: #94A3B8;
}
:global(.dark .scope-donor-settings .modal-check),
:global(.dark .settings-modal .modal-check) { background: rgba(102,187,106,0.16); }
:global(.dark .scope-donor-settings .modal-check--danger),
:global(.dark .settings-modal .modal-check--danger) { background: rgba(239,83,80,0.16); }

/* background-image, not the `background` shorthand: the shorthand resets
   background-size to `auto`, which collapses the 400%-wide gradient to the
   element width and leaves the shimmer keyframes with zero travel. */
:global(.dark .scope-donor-settings .skeleton),
:global(.dark .settings-modal .skeleton) {
    background-image: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.btn-danger:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 2px;
}

/* Appearance swatches on a dark card: the white rings become the card colour. */
:global(.dark .scope-donor-settings .swatch--on .swatch__circle) { box-shadow: 0 0 0 3px #1E293B, 0 0 0 5px var(--ring); }
:global(.dark .scope-donor-settings .swatch__dot),
:global(.dark .scope-donor-settings .swatch__check) { box-shadow: 0 0 0 2px #1E293B; }
</style>
