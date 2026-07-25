Exit code: 0
Wall time: 6 seconds
Output:
<template>
    <div class="settings-page">
        <!-- Skeleton loading state -->
        <div v-if="loading" class="skeleton-wrap">
            <div class="skeleton skeleton--header" />
            <div class="skeleton-main-grid">
                <div class="skeleton-col">
                    <div class="skeleton skeleton--panel" style="height:360px" />
                    <div class="skeleton skeleton--panel" style="height:220px" />
                </div>
                <div class="skeleton-col">
                    <div class="skeleton skeleton--panel" style="height:260px" />
                    <div class="skeleton skeleton--panel" style="height:180px" />
                </div>
            </div>
        </div>

        <template v-else>
            <div class="header-row fade-in" style="--delay: 0ms">
                <h1 class="page-title">Personalize your experience</h1>
                <p class="page-subtitle">Manage your account preferences, notification settings, and privacy options.</p>
            </div>

            <div class="main-grid">
                <!-- Left column: profile + security -->
                <div class="col-left">
                    <!-- Profile information -->
                    <div class="panel fade-in" style="--delay: 50ms">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Profile Information</h2>
                        </div>
                        <div class="form-body">
                            <div class="avatar-row">
                                <div class="avatar">
                                    <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="Profile photo" class="avatar__img">
                                    <span v-else class="avatar__initials">{{ initials }}</span>
                                    <button type="button" class="avatar__edit" @click="triggerAvatarPick" aria-label="Change photo">
                                        <AssetIcon name="camera" :size="14" />
                                    </button>
                                </div>
                                <input ref="avatarInput" type="file" accept="image/*" class="avatar-input-hidden" @change="onAvatarChange">
                                <div>
                                    <p class="avatar-row__name">{{ profile.fullName || 'Your name' }}</p>
                                    <p class="avatar-row__meta">Donor ID: {{ profile.donorId || 'â€”' }}</p>
                                </div>
                            </div>

                            <div class="form-stack">
                                <div class="form-field">
                                    <label class="form-label">Full name</label>
                                    <input v-model="profile.fullName" type="text" class="form-input" placeholder="Juan Dela Cruz">
                                </div>

                                <div class="form-row">
                                    <div class="form-field">
                                        <label class="form-label">Email address</label>
                                        <div class="input-icon-field">
                                            <AssetIcon name="mail" :size="16" class="input-icon-field__icon" />
                                            <input v-model="profile.email" type="email" class="form-input form-input--with-icon" placeholder="juan@email.com">
                                        </div>
                                    </div>
                                    <div class="form-field">
                                        <label class="form-label">Phone number</label>
                                        <div class="input-icon-field">
                                            <AssetIcon name="phone" :size="16" class="input-icon-field__icon" />
                                            <input v-model="profile.phone" type="tel" class="form-input form-input--with-icon" placeholder="09XX XXX XXXX">
                                        </div>
                                    </div>
                                </div>

                                <div class="form-row">
                                    <div class="form-field">
                                        <label class="form-label">Date of birth</label>
                                        <input v-model="profile.birthDate" type="date" class="form-input">
                                    </div>
                                    <div class="form-field">
                                        <label class="form-label">Blood type</label>
                                        <div class="select-wrap">
                                            <select v-model="profile.bloodType" class="form-input form-input--select">
                                                <option value="">Unknown</option>
                                                <option v-for="bt in bloodTypeOptions" :key="bt" :value="bt">{{ bt }}</option>
                                            </select>
                                            <AssetIcon name="chevron-down" :size="16" class="select-wrap__icon" />
                                        </div>
                                    </div>
                                </div>

                                <div class="form-field">
                                    <label class="form-label">Address</label>
                                    <input v-model="profile.address" type="text" class="form-input" placeholder="Street, Barangay, City">
                                </div>
                            </div>

                            <div class="form-footer">
                                <span v-if="profileSaved" class="saved-note">
                                    <AssetIcon name="check" :size="14" />
                                    Saved
                                </span>
                                <button type="button" class="btn-primary" :disabled="savingProfile" @click="saveProfile">
                                    {{ savingProfile ? 'Saving...' : 'Save changes' }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Password & security -->
                    <div class="panel fade-in" style="--delay: 100ms">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Password &amp; Security</h2>
                        </div>
                        <div class="form-body">
                            <div class="form-stack">
                                <div class="form-field">
                                    <label class="form-label">Current password</label>
                                    <div class="password-field">
                                        <input
                                            v-model="security.currentPassword"
                                            :type="showCurrentPassword ? 'text' : 'password'"
                                            class="form-input"
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
                                <div class="form-row">
                                    <div class="form-field">
                                        <label class="form-label">New password</label>
                                        <div class="password-field">
                                            <input
                                                v-model="security.newPassword"
                                                :type="showNewPassword ? 'text' : 'password'"
                                                class="form-input"
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
                                        <label class="form-label">Confirm new password</label>
                                        <div class="password-field">
                                            <input
                                                v-model="security.confirmPassword"
                                                :type="showConfirmPassword ? 'text' : 'password'"
                                                class="form-input"
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
                                </div>
                                <p v-if="passwordMismatch" class="field-error">
                                    <AssetIcon name="alert" :size="13" />
                                    New password and confirmation don't match.
                                </p>
                            </div>

                            <div class="form-footer">
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
                    </div>
                </div>

                <!-- Right column: notifications + account -->
                <div class="col-right">
                    <!-- Notification preferences -->
                    <div class="panel fade-in" style="--delay: 50ms">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Notification Preferences</h2>
                        </div>
                        <div class="toggle-list">
                            <div v-for="pref in notificationPrefs" :key="pref.key" class="toggle-row">
                                <div class="toggle-row__text">
                                    <p class="toggle-row__label">{{ pref.label }}</p>
                                    <p class="toggle-row__desc">{{ pref.desc }}</p>
                                </div>
                                <button
                                    type="button"
                                    class="toggle-switch"
                                    :class="{ 'toggle-switch--on': pref.enabled }"
                                    role="switch"
                                    :aria-checked="pref.enabled"
                                    @click="pref.enabled = !pref.enabled"
                                >
                                    <span class="toggle-switch__knob" />
                                </button>
                            </div>
                        </div>
                        <div class="panel-footer">
                            <span v-if="notifsSaved" class="saved-note">
                                <AssetIcon name="check" :size="14" />
                                Saved
                            </span>
                            <button type="button" class="btn-outline btn-block" :disabled="savingNotifs" @click="saveNotifications">
                                {{ savingNotifs ? 'Saving...' : 'Save preferences' }}
                            </button>
                        </div>
                    </div>

                    <!-- Account -->
                    <div class="panel fade-in" style="--delay: 100ms">
                        <div class="panel-header panel-header--simple">
                            <h2 class="panel-title">Account</h2>
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
                        <p class="account-note">
                            Deleting your account permanently removes your donor profile, screening history, and QR code.
                        </p>
                    </div>
                </div>
            </div>
        </template>

        <!-- Delete account confirmation -->
        <Teleport to="body">
            <Transition name="modal-fade">
                <div v-if="confirmDeleteOpen" class="modal-backdrop" @click.self="confirmDeleteOpen = false">
                    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-title">
                        <div class="modal-check modal-check--danger">
                            <AssetIcon name="alert" :size="24" />
                        </div>
                        <h2 id="delete-title" class="modal-title">Delete your account?</h2>
                        <p class="modal-subtitle">
                            This can't be undone. Your profile, screening history, and QR code will be permanently removed.
                        </p>
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
import AssetIcon from '~/components/common/AssetIcon.vue'
import { donorService } from '~/api/donor/DonorService'
import { useUser } from '~/composables/useUser'


const router = useRouter()
const { fetchUser, clearUser } = useUser()
const loading = ref(true)

const bloodTypeOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const profile = reactive({
    fullName: '',
    email: '',
    phone: '',
    birthDate: '',
    bloodType: '',
    address: '',
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

const avatarInput = ref(null)
const savingProfile = ref(false)
const savingPassword = ref(false)
const savingNotifs = ref(false)
const deleting = ref(false)
const confirmDeleteOpen = ref(false)
const profileSaved = ref(false)
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

function triggerAvatarPick() {
    avatarInput.value?.click()
}

function onAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    // Preview locally; actual upload happens on saveProfile()
    profile.avatarUrl = URL.createObjectURL(file)
}

async function saveProfile() {
    savingProfile.value = true
    profileSaved.value = false
    try {
        // Backend contract: PATCH /api/donor/profile
        // Body: { full_name, email, phone, birth_date, blood_type, address }
        // Avatar upload would go through a separate multipart endpoint in practice.
        const name = splitFullName(profile.fullName)
        const response = await donorService.updateProfile({
            first_name: name.firstName,
            last_name: name.lastName,
            email: profile.email,
            phone: profile.phone,
            birth_date: profile.birthDate,
            blood_type: profile.bloodType,
            address: profile.address,
        })
        applyProfile(response?.data || {})
        await fetchUser()
        profileSaved.value = true
    } catch (err) {
        console.error('Failed to save profile:', err)
    } finally {
        savingProfile.value = false
    }
}

async function updatePassword() {
    if (!canSubmitPassword.value) return
    savingPassword.value = true
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
    } catch (err) {
        console.error('Failed to update password:', err)
    } finally {
        savingPassword.value = false
    }
}

async function saveNotifications() {
    savingNotifs.value = true
    notifsSaved.value = false
    try {
        // Backend contract: PATCH /api/donor/notification-preferences
        // Body: { appointment_reminders, eligibility_renewal, nearby_drives, email_updates }
        await donorService.updateNotificationPreferences(Object.fromEntries(notificationPrefs.map(p => [p.key, p.enabled])))
        notifsSaved.value = true
    } catch (err) {
        console.error('Failed to save notification preferences:', err)
    } finally {
        savingNotifs.value = false
    }
}

async function handleLogout() {
    try {
        localStorage.removeItem('_token')
        clearUser()
    } catch (err) {
        console.error('Failed to log out cleanly:', err)
    } finally {
        router.push('/login')
    }
}

async function handleDeleteAccount() {
    deleting.value = true
    try {
        localStorage.removeItem('_token')
        clearUser()
        router.push('/login')
    } catch (err) {
        console.error('Failed to delete account:', err)
    } finally {
        deleting.value = false
        confirmDeleteOpen.value = false
    }
}

onMounted(async () => {
    try {
        // Backend contract: GET /api/donor/profile
        // Response: { full_name, email, phone, birth_date, blood_type, address,
        //   donor_id, avatar_url, notification_preferences }
        const data = await donorService.profile()
        applyProfile(data)

        if (data?.notification_preferences) {
            notificationPrefs.forEach(pref => {
                if (pref.key in data.notification_preferences) {
                    pref.enabled = !!data.notification_preferences[pref.key]
                }
            })
        }
    } catch (err) {
        console.error('Failed to load donor settings profile:', err)
    } finally {
        loading.value = false
    }
})

function applyProfile(data) {
    profile.fullName = data?.full_name ?? ''
    profile.email = data?.email ?? ''
    profile.phone = data?.phone ?? ''
    profile.birthDate = data?.birth_date ?? ''
    profile.bloodType = data?.blood_type ?? ''
    profile.address = data?.address ?? ''
    profile.donorId = data?.donor_id ?? ''
    profile.avatarUrl = data?.avatar_url ?? ''
}

function splitFullName(fullName) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean)
    return {
        firstName: parts.shift() || '',
        lastName: parts.join(' ') || '',
    }
}
</script>

<style scoped>
.settings-page {
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

.header-row {
    display: flex;
    flex-direction: column;
}

.page-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.page-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 2px 0 0;
}

.fade-in {
    animation: fadeInUp 0.5s ease both;
    animation-delay: var(--delay, 0ms);
}

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
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
    .skeleton, .fade-in { animation: none !important; }
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

.panel-title {
    font-weight: 700;
    font-size: 14px;
    color: var(--text-primary);
    margin: 0;
}

/* Profile form */
.form-body {
    padding: 20px;
}

.avatar-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 24px;
}

.avatar {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 999px;
    background: #eaf3fc;
    color: var(--primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
}

.avatar__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.avatar__initials {
    font-size: 18px;
    font-weight: 700;
}

.avatar__edit {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: var(--primary);
    color: white;
    border: 2px solid white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.avatar-input-hidden {
    display: none;
}

.avatar-row__name {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.avatar-row__meta {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 2px 0 0;
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
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 6px;
}

.form-input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    font-size: 13.5px;
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
    font-size: 12px;
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
    font-size: 12.5px;
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
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.toggle-row__desc {
    font-size: 11.5px;
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
    font-size: 13px;
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
    font-size: 11.5px;
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
    font-size: 13px;
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
    font-size: 13px;
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
    font-size: 13px;
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
    --primary: #1565c0;
    --accent: #d32f2f;
    --success: #2e7d32;
    --text-primary: #1f2937;
    --text-secondary: #9ca3af;
    width: 100%;
    max-width: 360px;
    background: white;
    border-radius: 16px;
    padding: 28px 24px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.18);
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
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.modal-subtitle {
    font-size: 12.5px;
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

/* ============ Dark mode ============ */
:global(.dark .settings-page) {
    --text-primary: #F1F5F9;
    --text-secondary: #94A3B8;
    background: #0F172A;
}

:global(.dark .panel) {
    background: #1E293B;
    border-color: #334155;
}

:global(.dark .panel-header--simple) { border-color: #334155; }

:global(.dark .avatar) { background: rgba(66,165,245,0.16); }

:global(.dark .form-input) {
    background: #0F172A;
    border-color: #334155;
    color: #F1F5F9;
}

:global(.dark .password-toggle:hover) { color: #F1F5F9; background: #263449; }

:global(.dark .toggle-row) { border-color: #263449; }
:global(.dark .toggle-switch) { background: #1565c0; }

:global(.dark .account-action) { border-color: #263449; }

:global(.dark .btn-outline) {
    background: #263449;
    color: #E2E8F0;
}
:global(.dark .btn-outline:hover:not(:disabled)) { background: #334155; }

:global(.dark .modal-card) {
    background: #1E293B;
    --text-primary: #F1F5F9;
    --text-secondary: #94A3B8;
}
:global(.dark .modal-check) { background: rgba(102,187,106,0.16); }
:global(.dark .modal-check--danger) { background: rgba(239,83,80,0.16); }

:global(.dark .skeleton) {
    background: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
}
</style>

