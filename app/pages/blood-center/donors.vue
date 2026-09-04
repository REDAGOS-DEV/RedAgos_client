<template>
    <div class="donors-page">
        <div v-if="initialLoading" class="loading-wrap">
            <div class="spinner" />
        </div>

        <!-- ============ LIST VIEW ============ -->
        <div v-else-if="!selectedDonorId" class="donors-inner">
            <div class="header-row">
                <div>
                    <h1 class="page-title">Donors</h1>
                    <p class="page-subtitle">View and manage all registered donors</p>
                </div>
                <button type="button" class="btn-primary" @click="openAddDonor">
                    <AssetIcon name="plus" :size="16" />
                    Add Donor
                </button>
            </div>

            <div v-if="loadError" class="error-banner">
                {{ loadError }}
                <button type="button" class="btn-link" @click="loadAll">Retry</button>
            </div>

            <div class="stats-row">
                <div class="stat-card">
                    <p class="stat-card__label">Total Donors</p>
                    <p class="stat-card__value" :class="{ skeleton: loadingStats }">{{ loadingStats ? '' :
                        stats.total }}</p>
                </div>
                <div class="stat-card">
                    <p class="stat-card__label">Eligible Now</p>
                    <p class="stat-card__value stat-card__value--success" :class="{ skeleton: loadingStats }">{{
                        loadingStats ? '' : stats.eligible }}</p>
                </div>
                <div class="stat-card">
                    <p class="stat-card__label">Deferred / Flagged</p>
                    <p class="stat-card__value stat-card__value--accent" :class="{ skeleton: loadingStats }">{{
                        loadingStats ? '' : stats.deferred }}</p>
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">
                    <p class="section-label">Donor Records</p>
                    <div class="panel-header__filters">
                        <select v-model="typeFilter" class="form-input filter-select" @change="onFilterChange">
                            <option value="all">All Types</option>
                            <option v-for="bt in bloodTypes" :key="bt" :value="bt">{{ bt }}</option>
                        </select>
                        <select v-model="statusFilter" class="form-input filter-select" @change="onFilterChange">
                            <option value="all">All Status</option>
                            <option value="eligible">Eligible</option>
                            <option value="deferred">Deferred</option>
                            <option value="flagged">Flagged</option>
                        </select>
                    </div>
                </div>

                <div class="donor-table">
                    <div class="donor-row donor-row--head">
                        <span>Donor</span>
                        <span>Blood Type</span>
                        <span>Contact</span>
                        <span>Last Donation</span>
                        <span>Status</span>
                        <span>Action</span>
                    </div>

                    <div v-if="loadingDonors" v-for="n in 4" :key="'skd-' + n" class="donor-row skeleton-block" />

                    <p v-else-if="donors.length === 0" class="empty-state">No donors match the current filters.</p>

                    <div v-else v-for="(donor, i) in donors" :key="donor.id" class="donor-row">
                        <span class="donor-cell">
                            <span class="avatar" :style="{ background: avatarColor(i) }">{{ initials(donor.name)
                                }}</span>
                            <span class="donor-cell__text">
                                <span class="donor-cell__name">{{ donor.name }}</span>
                                <span class="donor-cell__id">{{ donor.donorCode }}</span>
                            </span>
                        </span>
                        <span><span class="pill" :class="bloodTypeClass(donor.bloodType)">{{ donor.bloodType
                                }}</span></span>
                        <span>{{ donor.contact }}</span>
                        <span>{{ donor.lastDonation || '—' }}</span>
                        <span><span class="pill" :class="'pill--' + donor.status.toLowerCase()">{{ donor.status
                                }}</span></span>
                        <span><button type="button" class="view-link" @click="viewDonor(donor)">View
                                <AssetIcon name="arrow-right" :size="12" />
                            </button></span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Detail View -->
        <div v-else class="donors-inner">
            <div class="breadcrumb">
                <button type="button" class="breadcrumb__link" @click="backToList">Donors</button>
                <span class="breadcrumb__sep">/</span>
                <span class="breadcrumb__current">{{ selectedDonor?.name || '...' }}</span>
            </div>

            <div v-if="loadingDetail" class="detail-header-card skeleton-block" />
            <div v-else class="detail-header-card">
                <div class="detail-header-card__left">
                    <span class="avatar avatar--lg" :style="{ background: avatarColor(0) }">{{
                        initials(selectedDonor.name) }}</span>
                    <div>
                        <div class="detail-header-card__name-row">
                            <span class="detail-header-card__name">{{ selectedDonor.name }}</span>
                            <span class="pill" :class="'pill--' + selectedDonor.status.toLowerCase()">{{
                                selectedDonor.status }}</span>
                        </div>
                        <p class="detail-header-card__meta">
                            {{ selectedDonor.donorCode }} &middot; {{ selectedDonor.bloodType }} &middot; {{
                                selectedDonor.facilityName }}
                        </p>
                    </div>
                </div>
                <div class="detail-header-card__actions">
                    <button type="button" class="btn-outline" @click="openEditInfo">Edit Info</button>
                    <button type="button" class="btn-primary" @click="openAddFlag">
                        <AssetIcon name="flag" :size="14" />
                        Add Flag
                    </button>
                </div>
            </div>

            <div class="panel">
                <div class="tabs">
                    <button type="button" class="tab" :class="{ 'tab--active': activeDetailTab === 'info' }"
                        @click="activeDetailTab = 'info'">
                        Donor info
                    </button>
                    <button type="button" class="tab" :class="{ 'tab--active': activeDetailTab === 'history' }"
                        @click="activeDetailTab = 'history'">
                        Donation History
                    </button>
                </div>

                <!-- Donor info tab -->
                <section v-if="activeDetailTab === 'info'" class="tab-content">
                    <div v-if="loadingDetail" class="info-list">
                        <div v-for="n in 8" :key="'ski-' + n" class="info-row skeleton-block" />
                    </div>
                    <div v-else class="info-list">
                        <div class="info-row">
                            <span class="info-row__label">Full name</span>
                            <span class="info-row__value">{{ selectedDonor.name }}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-row__label">Donor ID</span>
                            <span class="info-row__value">{{ selectedDonor.donorCode }}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-row__label">Blood type</span>
                            <span class="info-row__value">{{ selectedDonor.bloodType }}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-row__label">Contact number</span>
                            <span class="info-row__value">{{ selectedDonor.contact }}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-row__label">Last donation</span>
                            <span class="info-row__value">{{ selectedDonor.lastDonation || '—' }}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-row__label">Eligibility status</span>
                            <span class="info-row__value"><span class="pill"
                                    :class="'pill--' + selectedDonor.status.toLowerCase()">{{ selectedDonor.status
                                    }}</span></span>
                        </div>
                        <div class="info-row">
                            <span class="info-row__label">Total donations</span>
                            <span class="info-row__value">{{ selectedDonor.totalDonations }} completed</span>
                        </div>
                        <div class="info-row">
                            <span class="info-row__label">Registered via</span>
                            <span class="info-row__value">{{ selectedDonor.registeredVia }}</span>
                        </div>

                        <template v-if="selectedDonor.flags && selectedDonor.flags.length">
                            <p class="section-label section-label--tight">Active Flags</p>
                            <div v-for="flag in selectedDonor.flags" :key="flag.id" class="flag-card">
                                <AssetIcon name="flag" :size="14" class="flag-card__icon" />
                                <div class="flag-card__body">
                                    <p class="flag-card__reason">{{ flag.reason }}</p>
                                    <p class="flag-card__meta">Flagged by {{ flag.flaggedBy }} on {{ flag.flaggedDate
                                        }}
                                        <span v-if="flag.notified">&middot; Donor notified</span>
                                    </p>
                                </div>
                            </div>
                        </template>
                    </div>
                </section>

                <!-- donation history tab -->
                <section v-else class="tab-content">
                    <div class="history-header">
                        <p class="section-label section-label--tight">All recorded donor events</p>
                        <button type="button" class="btn-outline" @click="openRecordDonation">
                            <AssetIcon name="plus" :size="14" />
                            Record Donation
                        </button>
                    </div>

                    <div v-if="loadingHistory" class="history-list">
                        <div v-for="n in 4" :key="'skh-' + n" class="history-item skeleton-block" />
                    </div>
                    <p v-else-if="donationHistory.length === 0" class="empty-state">No donation records yet.</p>
                    <div v-else class="history-list">
                        <div v-for="event in donationHistory" :key="event.id" class="history-item">
                            <span class="history-item__dot" :class="'history-item__dot--' + event.result" />
                            <div class="history-item__body">
                                <p class="history-item__date">{{ event.date }}</p>
                                <p class="history-item__title">{{ event.title }}</p>
                                <p class="history-item__meta">{{ event.bloodType }} &middot; {{ event.facilityName }}
                                    &middot; {{ event.method }}</p>
                                <p class="history-item__result">{{ event.resultNote }}</p>
                            </div>
                            <span class="pill" :class="'pill--' + event.status.toLowerCase()">{{ event.status
                                }}</span>
                        </div>
                    </div>
                </section>
            </div>
        </div>

        <!-- ADD DONOR modal -->
        <Transition name="modal">
            <div v-if="showAddDonorModal" class="modal-overlay" @click.self="closeAddDonor">
                <div class="modal-card">
                    <div class="modal-card__header">
                        <h2 class="modal-card__title">Add Donor</h2>
                        <button type="button" class="modal-card__close" @click="closeAddDonor">
                            <AssetIcon name="x" :size="18" />
                        </button>
                    </div>
                    <div class="modal-form">
                        <div class="form-group">
                            <label class="form-label">Full name</label>
                            <input v-model="addDonorForm.name" type="text" class="form-input"
                                placeholder="Juan Dela Cruz" />
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Blood type</label>
                                <select v-model="addDonorForm.bloodType" class="form-input">
                                    <option value="">Select</option>
                                    <option v-for="bt in bloodTypes" :key="bt" :value="bt">{{ bt }}</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Contact number</label>
                                <div class="form-input-icon">
                                    <input v-model="addDonorForm.contact" type="text" class="form-input"
                                        placeholder="0912-345-6789" />
                                    <AssetIcon name="phone" :size="16" class="form-input-icon__icon" />
                                </div>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Valid ID number</label>
                                <div class="form-input-icon">
                                    <input v-model="addDonorForm.validIdNumber" type="text" class="form-input" />
                                    <AssetIcon name="id-card" :size="16" class="form-input-icon__icon" />
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Facility</label>
                                <select v-model="addDonorForm.facilityId" class="form-input">
                                    <option value="">Select facility</option>
                                    <option v-for="f in facilities" :key="f.id" :value="f.id">{{ f.name }}</option>
                                </select>
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn-cancel" @click="closeAddDonor">Cancel</button>
                            <button type="button" class="btn-primary" :disabled="savingDonor || !canSaveDonor"
                                @click="submitAddDonor">
                                {{ savingDonor ? 'Saving...' : 'Add Donor' }}
                            </button>
                        </div>
                        <p v-if="addDonorError" class="modal-error">{{ addDonorError }}</p>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- EDIT INFO modal -->
        <Transition name="modal">
            <div v-if="showEditInfoModal" class="modal-overlay" @click.self="closeEditInfo">
                <div class="modal-card">
                    <div class="modal-card__header">
                        <h2 class="modal-card__title">Edit Donor Info</h2>
                        <button type="button" class="modal-card__close" @click="closeEditInfo">
                            <AssetIcon name="x" :size="18" />
                        </button>
                    </div>
                    <div class="modal-form">
                        <div class="form-group">
                            <label class="form-label">Full name</label>
                            <input v-model="editForm.name" type="text" class="form-input" />
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Blood type</label>
                                <select v-model="editForm.bloodType" class="form-input">
                                    <option v-for="bt in bloodTypes" :key="bt" :value="bt">{{ bt }}</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Contact number</label>
                                <input v-model="editForm.contact" type="text" class="form-input" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Eligibility status</label>
                            <select v-model="editForm.status" class="form-input">
                                <option value="Eligible">Eligible</option>
                                <option value="Deferred">Deferred</option>
                                <option value="Flagged">Flagged</option>
                            </select>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn-cancel" @click="closeEditInfo">Cancel</button>
                            <button type="button" class="btn-primary" :disabled="savingEdit" @click="submitEditInfo">
                                {{ savingEdit ? 'Saving...' : 'Save Changes' }}
                            </button>
                        </div>
                        <p v-if="editError" class="modal-error">{{ editError }}</p>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- ADD FLAG modal -->
        <Transition name="modal">
            <div v-if="showAddFlagModal" class="modal-overlay" @click.self="closeAddFlag">
                <div class="modal-card">
                    <div class="modal-card__header">
                        <h2 class="modal-card__title">Add Flag</h2>
                        <button type="button" class="modal-card__close" @click="closeAddFlag">
                            <AssetIcon name="x" :size="18" />
                        </button>
                    </div>
                    <div class="modal-form">
                        <p class="modal-subtitle">Flag this donor if they need to be deferred or asked to return
                            later. The donor will optionally be notified with the reason below.</p>

                        <div class="form-group">
                            <label class="form-label">Reason</label>
                            <select v-model="flagForm.reason" class="form-input">
                                <option value="">Select a reason</option>
                                <option value="Low hemoglobin level">Low hemoglobin level</option>
                                <option value="Recent illness or medication">Recent illness or medication</option>
                                <option value="Below minimum donation interval">Below minimum donation interval
                                </option>
                                <option value="Failed eligibility screening">Failed eligibility screening</option>
                                <option value="Other">Other (specify below)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Additional notes</label>
                            <textarea v-model="flagForm.notes" class="form-input form-textarea" rows="3"
                                placeholder="e.g. Please return after 3 months for re-screening."></textarea>
                        </div>
                        <label class="checkbox-row">
                            <input v-model="flagForm.notifyDonor" type="checkbox" />
                            <span>Notify donor via SMS / email with this reason</span>
                        </label>

                        <div class="modal-actions">
                            <button type="button" class="btn-cancel" @click="closeAddFlag">Cancel</button>
                            <button type="button" class="btn-primary" :disabled="savingFlag || !canSaveFlag"
                                @click="submitAddFlag">
                                {{ savingFlag ? 'Saving...' : 'Add Flag' }}
                            </button>
                        </div>
                        <p v-if="flagError" class="modal-error">{{ flagError }}</p>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- RECORD DONATION modal -->
        <Transition name="modal">
            <div v-if="showRecordDonationModal" class="modal-overlay" @click.self="closeRecordDonation">
                <div class="modal-card">
                    <div class="modal-card__header">
                        <h2 class="modal-card__title">Record Donation</h2>
                        <button type="button" class="modal-card__close" @click="closeRecordDonation">
                            <AssetIcon name="x" :size="18" />
                        </button>
                    </div>
                    <div class="modal-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Blood type</label>
                                <input :value="selectedDonor?.bloodType" type="text" class="form-input" disabled />
                            </div>
                            <div class="form-group">
                                <label class="form-label">Volume (mL)</label>
                                <input v-model.number="donationForm.volume" type="number" class="form-input"
                                    placeholder="450" />
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Date</label>
                                <input v-model="donationForm.date" type="date" class="form-input" />
                            </div>
                            <div class="form-group">
                                <label class="form-label">Method</label>
                                <select v-model="donationForm.method" class="form-input">
                                    <option value="Walk-in">Walk-in</option>
                                    <option value="Appointment">Appointment</option>
                                    <option value="Mobile Drive">Mobile Drive</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Staff notes</label>
                            <textarea v-model="donationForm.notes" class="form-input form-textarea" rows="2"></textarea>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn-cancel" @click="closeRecordDonation">Cancel</button>
                            <button type="button" class="btn-primary" :disabled="savingDonation"
                                @click="submitRecordDonation">
                                {{ savingDonation ? 'Saving...' : 'Record Donation' }}
                            </button>
                        </div>
                        <p v-if="donationError" class="modal-error">{{ donationError }}</p>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'

definePageMeta({
    middleware: ['auth', 'department'],
    layout: 'blood-centerdashboard',
  requires: 'donors.view',
})

/**
 * NOTE ON API SHAPE
 * -------------------------------------------------------------------------
 *  GET  /api/bloodcenter/donors/stats
 *    -> { total, eligible, deferred }
 *
 *  GET  /api/bloodcenter/donors?type=&status=
 *    -> [{ id, donorCode, name, bloodType, contact, lastDonation, status }]
 *
 *  GET  /api/bloodcenter/donors/:id
 *    -> { id, donorCode, name, bloodType, contact, lastDonation, status,
 *          facilityName, totalDonations, registeredVia,
 *          flags: [{ id, reason, flaggedBy, flaggedDate, notified }] }
 *
 *  GET  /api/bloodcenter/donors/:id/history
 *    -> [{ id, date, title, bloodType, facilityName, method, resultNote,
 *          status, result }]   result: 'success' | 'deferred'
 *
 *  GET  /api/bloodcenter/facilities
 *    -> [{ id, name }]
 *
 *  POST /api/bloodcenter/donors           { name, bloodType, contact, validIdNumber, facilityId }
 *    -> created donor
 *
 *  PUT  /api/bloodcenter/donors/:id       { name, bloodType, contact, status }
 *    -> updated donor
 *
 *  POST /api/bloodcenter/donors/:id/flags { reason, notes, notifyDonor }
 *    -> created flag (also triggers a notification to the donor if notifyDonor is true)
 *
 *  POST /api/bloodcenter/donors/:id/donations { volume, date, method, notes }
 *    -> created donation record
 * -------------------------------------------------------------------------
 */

/**
 * Donor API.
 *
 * Kaniadto raw `$fetch('/api/bloodcenter/...')` ni ang tanan. Duha ka problema
 * ang naa niadto: (1) walay Authorization header, ug (2) ang `/api` prefix kay
 * ni-agi sa `nitro.devProxy` nga naa ra sa `nuxt dev` — sa gi-build nga app,
 * mo-404 siya sa Nitro. Ang upat nga endpoint nga naa gyud sa Laravel kay
 * gibalhin na sa `bloodCenterService`, nga mao nay nagdala sa token.
 *
 * Ang lima sa ubos WALA pay route sa server (walay stats, facilities, update,
 * flags, o donations nga endpoint sa `/blood-center/donors`). Gibiyaan sila nga
 * dayag nga wala pa ma-implementar imbes tagoan sa likod og call nga dili
 * gyud molihok — tan-awa ang endpoint matrix sa audit plan.
 */
const notImplemented = (name) => async () => {
    throw Object.assign(
        new Error(`${name} has no backend endpoint yet.`),
        { status: 501, notImplemented: true },
    )
}

const api = {
    // Naa nay server route:
    getDonors: (params) => bloodCenterService.donors(params),
    getDonor: (id) => bloodCenterService.showDonor(id),
    getDonorHistory: (id) => bloodCenterService.donorHistory(id),
    createDonor: (payload) => bloodCenterService.createDonor(payload),

    // Wala pa (Phase P/0B):
    getStats: notImplemented('Donor statistics'),
    getFacilities: notImplemented('Facility list'),
    updateDonor: notImplemented('Updating a donor'),
    addFlag: notImplemented('Flagging a donor'),
    recordDonation: notImplemented('Recording a donation'),
}

const initialLoading = ref(true)
const loadError = ref('')

const bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']
const facilities = ref([])

const stats = reactive({ total: 0, eligible: 0, deferred: 0 })
const loadingStats = ref(false)

const typeFilter = ref('all')
const statusFilter = ref('all')
const donors = ref([])
const loadingDonors = ref(false)

const AVATAR_COLORS = ['#1565C0', '#2E7D32', '#F57C00', '#D32F2F', '#6D4C41', '#5E35B1']

function initials(name) {
    if (!name) return '?'
    return name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function avatarColor(index) {
    return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function bloodTypeClass(bloodType) {
    const group = bloodType.replace('+', '').replace('-', '')
    const map = { A: 'pill--type-a', B: 'pill--type-b', AB: 'pill--type-ab', O: 'pill--type-o' }
    return map[group] || 'pill--type-o'
}

// ---- List view ----
async function loadStats() {
    loadingStats.value = true
    try {
        const data = await api.getStats()
        Object.assign(stats, data)
    } catch (err) {
        loadError.value = 'Could not load donor statistics.'
        console.error(err)
    } finally {
        loadingStats.value = false
    }
}

async function loadDonors() {
    loadingDonors.value = true
    try {
        donors.value = await api.getDonors({ type: typeFilter.value, status: statusFilter.value })
    } catch (err) {
        loadError.value = 'Could not load donor records.'
        console.error(err)
    } finally {
        loadingDonors.value = false
    }
}

async function loadFacilities() {
    try {
        facilities.value = await api.getFacilities()
    } catch (err) {
        console.error(err)
    }
}

async function loadAll() {
    loadError.value = ''
    await Promise.all([loadStats(), loadDonors(), loadFacilities()])
}

function onFilterChange() {
    loadDonors()
}

// ---- Detail View ----
const selectedDonorId = ref(null)
const selectedDonor = ref(null)
const loadingDetail = ref(false)
const activeDetailTab = ref('info')
const donationHistory = ref([])
const loadingHistory = ref(false)

async function viewDonor(donor) {
    selectedDonorId.value = donor.id
    activeDetailTab.value = 'info'
    await Promise.all([loadDonorDetail(donor.id), loadDonorHistory(donor.id)])
}

async function loadDonorDetail(id) {
    loadingDetail.value = true
    try {
        selectedDonor.value = await api.getDonor(id)
    } catch (err) {
        loadError.value = 'Could not load donor profile.'
        console.error(err)
    } finally {
        loadingDetail.value = false
    }
}

async function loadDonorHistory(id) {
    loadingHistory.value = true
    try {
        donationHistory.value = await api.getDonorHistory(id)
    } catch (err) {
        console.error(err)
    } finally {
        loadingHistory.value = false
    }
}

function backToList() {
    selectedDonorId.value = null
    selectedDonor.value = null
    donationHistory.value = []
    loadDonors()
    loadStats()
}

// ---- ADD MODAL modal ----
const showAddDonorModal = ref(false)
const savingDonor = ref(false)
const addDonorError = ref('')
const addDonorForm = reactive({ name: '', bloodType: '', contact: '', validIdNumber: '', facilityId: '' })

const canSaveDonor = computed(() =>
    Boolean(addDonorForm.name) && Boolean(addDonorForm.bloodType) && Boolean(addDonorForm.contact)
)

function openAddDonor() {
    showAddDonorModal.value = true
    addDonorError.value = ''
    Object.assign(addDonorForm, { name: '', bloodType: '', contact: '', validIdNumber: '', facilityId: '' })
}

function closeAddDonor() {
    showAddDonorModal.value = false
}

async function submitAddDonor() {
    if (!canSaveDonor.value) {
        addDonorError.value = 'Please fill in the required fields.'
        return
    }
    savingDonor.value = true
    addDonorError.value = ''
    try {
        await api.createDonor({ ...addDonorForm })
        closeAddDonor()
        await loadAll()
    } catch (err) {
        addDonorError.value = 'Could not add donor. Please try again.'
        console.error(err)
    } finally {
        savingDonor.value = false
    }
}

// ---- EDIT INFO modal ----
const showEditInfoModal = ref(false)
const savingEdit = ref(false)
const editError = ref('')
const editForm = reactive({ name: '', bloodType: '', contact: '', status: 'Eligible' })

function openEditInfo() {
    if (!selectedDonor.value) return
    showEditInfoModal.value = true
    editError.value = ''
    Object.assign(editForm, {
        name: selectedDonor.value.name,
        bloodType: selectedDonor.value.bloodType,
        contact: selectedDonor.value.contact,
        status: selectedDonor.value.status,
    })
}

function closeEditInfo() {
    showEditInfoModal.value = false
}

async function submitEditInfo() {
    savingEdit.value = true
    editError.value = ''
    try {
        const updated = await api.updateDonor(selectedDonorId.value, { ...editForm })
        selectedDonor.value = { ...selectedDonor.value, ...updated }
        closeEditInfo()
    } catch (err) {
        editError.value = 'Could not save changes. Please try again.'
        console.error(err)
    } finally {
        savingEdit.value = false
    }
}

// ---- ADD FLAG modal ----
const showAddFlagModal = ref(false)
const savingFlag = ref(false)
const flagError = ref('')
const flagForm = reactive({ reason: '', notes: '', notifyDonor: true })

const canSaveFlag = computed(() => Boolean(flagForm.reason))

function openAddFlag() {
    showAddFlagModal.value = true
    flagError.value = ''
    Object.assign(flagForm, { reason: '', notes: '', notifyDonor: true })
}

function closeAddFlag() {
    showAddFlagModal.value = false
}

async function submitAddFlag() {
    if (!canSaveFlag.value) {
        flagError.value = 'Please select a reason for the flag.'
        return
    }
    savingFlag.value = true
    flagError.value = ''
    try {
        await api.addFlag(selectedDonorId.value, { ...flagForm })
        closeAddFlag()
        await loadDonorDetail(selectedDonorId.value)
    } catch (err) {
        flagError.value = 'Could not add flag. Please try again.'
        console.error(err)
    } finally {
        savingFlag.value = false
    }
}

// ---- RECORD DONATION modal ----
const showRecordDonationModal = ref(false)
const savingDonation = ref(false)
const donationError = ref('')
const donationForm = reactive({ volume: 450, date: '', method: 'Walk-in', notes: '' })

function openRecordDonation() {
    showRecordDonationModal.value = true
    donationError.value = ''
    Object.assign(donationForm, { volume: 450, date: '', method: 'Walk-in', notes: '' })
}

function closeRecordDonation() {
    showRecordDonationModal.value = false
}

async function submitRecordDonation() {
    if (!donationForm.date) {
        donationError.value = 'Please select a donation date.'
        return
    }
    savingDonation.value = true
    donationError.value = ''
    try {
        await api.recordDonation(selectedDonorId.value, { ...donationForm })
        closeRecordDonation()
        await Promise.all([loadDonorDetail(selectedDonorId.value), loadDonorHistory(selectedDonorId.value)])
    } catch (err) {
        donationError.value = 'Could not record donation. Please try again.'
        console.error(err)
    } finally {
        savingDonation.value = false
    }
}

onMounted(async () => {
    await loadAll()
    initialLoading.value = false
})
</script>

<style scoped>
.donors-page {
    --primary: #1565c0;
    --accent: #d32f2f;
    --success: #2e7d32;
    --warning: #f57c00;
    --purple: #5e35b1;
    --text-primary: #1f2937;
    --text-secondary: #9ca3af;
    max-width: 1200px;
    background: var(--rb-page-bg);
    margin: 0 auto;
    padding: 24px 32px 40px;
    font-family: var(--rb-font-sans);
    color: var(--text-primary);
}

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
    to {
        transform: rotate(360deg);
    }
}

@media (prefers-reduced-motion: reduce) {

    .spinner {
        animation: none !important;
    }
}

.donors-inner {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

/* Header */
.header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 24px;
}

.page-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
}

.page-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 2px 0 0;
}

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
    white-space: nowrap;
}

.btn-primary:hover {
    opacity: 0.92;
}

.btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-outline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 14px;
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

.btn-cancel {
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    background: #f3f4f6;
    color: #374151;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
}

.btn-cancel:hover {
    background: #e5e7eb;
}

.btn-link {
    background: none;
    border: none;
    color: var(--primary);
    text-decoration: underline;
    cursor: pointer;
    font-size: 13px;
}

.error-banner {
    background: #fdeaea;
    color: #a11d1d;
    border: 1px solid #f6c9c9;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

/* Stats */
.stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
}

.stat-card {
    background: #fff;
    border-radius: 14px;
    border: 1px solid #eef0f3;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    padding: 20px 22px;
}

.stat-card__label {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-secondary);
    margin: 0;
}

.stat-card__value {
    font-size: 30px;
    font-weight: 800;
    margin: 6px 0 0;
    color: var(--text-primary);
    line-height: 1.1;
}

.stat-card__value--success {
    color: var(--success);
}

.stat-card__value--accent {
    color: var(--accent);
}

/* Panel */
.panel {
    background: #fff;
    border-radius: 14px;
    border: 1px solid #eef0f3;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    overflow: hidden;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px 12px;
    flex-wrap: wrap;
    gap: 12px;
}

.panel-header__filters {
    display: flex;
    gap: 10px;
}

.section-label {
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-primary);
    margin: 0;
}

.section-label--tight {
    margin: 20px 0 10px;
}

.form-input {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 9px 12px;
    font-size: 13px;
    color: var(--text-primary);
    background: #fafbfc;
    font-family: inherit;
    transition: border-color 0.15s ease;
    width: 100%;
}
.form-input-icon {
    position: relative;
    display: flex;
    align-items: center;
}

.form-input-icon .form-input {
    padding-left: 36px;
}

.form-input-icon__icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: #9ca3af;
}

.form-input:focus {
    outline: none;
    border-color: var(--primary);
    background: #fff;
}

.form-input:disabled {
    background: #f3f4f6;
    color: var(--text-secondary);
}

.form-textarea {
    resize: vertical;
    font-family: inherit;
}

.filter-select {
    width: 150px;
    cursor: pointer;
}

/* Donor table */
.donor-table {
    display: flex;
    flex-direction: column;
}

.donor-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1.2fr 1.2fr 1fr 0.8fr;
    align-items: center;
    gap: 12px;
    padding: 14px 24px;
    font-size: 13px;
    border-top: 1px solid #f3f4f6;
    min-height: 60px;
}

.donor-row--head {
    font-size: 10.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-secondary);
    border-top: none;
    background: #fafbfc;
}

.donor-cell {
    display: flex;
    align-items: center;
    gap: 10px;
}

.donor-cell__text {
    display: flex;
    flex-direction: column;
}

.donor-cell__name {
    font-weight: 700;
    color: var(--text-primary);
}

.donor-cell__id {
    font-size: 11.5px;
    color: var(--text-secondary);
}

.avatar {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
}

.avatar--lg {
    width: 52px;
    height: 52px;
    font-size: 16px;
}

.view-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--primary);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
}

.view-link:hover {
    text-decoration: underline;
}

.empty-state {
    color: var(--text-secondary);
    font-size: 13px;
    padding: 24px;
    text-align: center;
}

/* Breadcrumb */
.breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
}

.breadcrumb__link {
    background: none;
    border: none;
    color: var(--primary);
    font-weight: 700;
    cursor: pointer;
    padding: 0;
    font-size: 14px;
}

.breadcrumb__link:hover {
    text-decoration: underline;
}

.breadcrumb__sep {
    color: var(--text-secondary);
}

.breadcrumb__current {
    color: var(--text-primary);
    font-weight: 700;
}

/* Detail header card */
.detail-header-card {
    background: #fff;
    border-radius: 14px;
    border: 1px solid #eef0f3;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    padding: 22px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    min-height: 90px;
}

.detail-header-card__left {
    display: flex;
    align-items: center;
    gap: 16px;
}

.detail-header-card__name-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.detail-header-card__name {
    font-size: 17px;
    font-weight: 800;
}

.detail-header-card__meta {
    font-size: 12.5px;
    color: var(--text-secondary);
    margin: 4px 0 0;
}

.detail-header-card__actions {
    display: flex;
    gap: 10px;
}

/* Tabs */
.tabs {
    display: flex;
    gap: 32px;
    border-bottom: 1px solid #f3f4f6;
    padding: 0 24px;
    background: #fafbfc;
}

.tab {
    background: none;
    border: none;
    padding: 14px 4px;
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-secondary);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 0.15s ease;
}

.tab:hover {
    color: var(--text-primary);
}

.tab--active {
    color: var(--primary);
    border-bottom: 2px solid var(--primary);
}

.tab-content {
    padding: 24px;
}

/* Info list */
.info-list {
    display: flex;
    flex-direction: column;
}

.info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 13px 0;
    border-bottom: 1px solid #f3f4f6;
    font-size: 13.5px;
}

.info-row:last-child {
    border-bottom: none;
}

.info-row__label {
    color: var(--text-secondary);
}

.info-row__value {
    font-weight: 600;
    color: var(--text-primary);
}

/* Flags */
.flag-card {
    display: flex;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    background: #fdeaea;
    border: 1px solid #f3c1c1;
    margin-bottom: 8px;
}

.flag-card__icon {
    color: var(--accent);
    flex-shrink: 0;
    margin-top: 2px;
}

.flag-card__reason {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.flag-card__meta {
    font-size: 11.5px;
    color: var(--text-secondary);
    margin: 3px 0 0;
}

/* Donation history */
.history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.history-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.history-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px 0;
    border-bottom: 1px solid #f3f4f6;
}

.history-item:last-child {
    border-bottom: none;
}

.history-item__dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    margin-top: 5px;
    flex-shrink: 0;
    background: var(--success);
}

.history-item__dot--deferred {
    background: var(--warning);
}

.history-item__body {
    flex: 1;
    min-width: 0;
}

.history-item__date {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0 0 2px;
    font-weight: 600;
}

.history-item__title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.history-item__meta {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 3px 0 0;
}

.history-item__result {
    font-size: 12px;
    color: var(--success);
    font-weight: 600;
    margin: 3px 0 0;
}

/* Pills */
.pill {
    font-size: 10.5px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 999px;
    white-space: nowrap;
}

.pill--eligible {
    background: #e8f5e9;
    color: var(--success);
}

.pill--deferred {
    background: #fff3e0;
    color: var(--warning);
}

.pill--flagged {
    background: #fdeaea;
    color: var(--accent);
}

.pill--completed {
    background: #e8f5e9;
    color: var(--success);
}

.pill--type-a {
    background: #fff3e0;
    color: var(--warning);
}

.pill--type-b {
    background: #e8f5e9;
    color: var(--success);
}

.pill--type-ab {
    background: #ede7f6;
    color: var(--purple);
}

.pill--type-o {
    background: #e3f2fd;
    color: var(--primary);
}

/* Checkbox */
.checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
}

.checkbox-row input {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--primary);
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
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
}

.modal-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid #f3f4f6;
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
    gap: 14px;
}

.modal-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
}

.form-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 4px;
    width: 100%;
    margin-left: auto;
}

.modal-error {
    color: #C62828;
    font-size: 12.5px;
    font-weight: 500;
    margin: 0;
}

.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

/* Skeletons */
.skeleton,
.skeleton-block {
    background: linear-gradient(90deg, #eceff3 25%, #f5f7fb 37%, #eceff3 63%);
    background-size: 400% 100%;
    animation: skeleton-loading 1.4s ease infinite;
    border-radius: 8px;
    color: transparent;
}

.skeleton-block {
    min-height: 60px;
}

@keyframes skeleton-loading {
    0% {
        background-position: 100% 50%;
    }

    100% {
        background-position: 0 50%;
    }
}

/* Responsive */
@media (max-width: 900px) {
    .stats-row {
        grid-template-columns: 1fr;
    }

    .donor-row {
        grid-template-columns: 1fr;
        gap: 6px;
    }

    .donor-row--head {
        display: none;
    }
}

@media (max-width: 640px) {
    .donors-page {
        padding: 16px 16px 32px;
    }

    .header-row {
        flex-direction: column;
        align-items: stretch;
    }

    .detail-header-card {
        flex-direction: column;
        align-items: flex-start;
    }

    .detail-header-card__actions {
        width: 100%;
    }

    .form-row {
        grid-template-columns: 1fr;
    }
}

/* ============ DARK MODE ============ */
:global(.dark .donors-page) {
    --primary: #60A5FA;
    --accent: #F87171;
    --success: #34D399;
    --warning: #FBBF24;
    --purple: #A78BFA;
    --text-primary: #F1F5F9;
    --text-secondary: #94A3B8;
    background: #0F172A;
}

:global(.dark .stat-card),
:global(.dark .panel),
:global(.dark .detail-header-card),
:global(.dark .modal-card) {
    background: #1E293B;
    border-color: #334155;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

:global(.dark .stat-card:hover) {
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
}

:global(.dark .stat-card__value) {
    color: #F1F5F9;
}
:global(.dark .stat-card__value--success) {
    color: #34D399;
}
:global(.dark .stat-card__value--accent) {
    color: #F87171;
}

:global(.dark .panel-header) {
    border-bottom-color: #334155;
}

:global(.dark .section-label) {
    color: #F1F5F9;
}

:global(.dark .form-input) {
    background: #1E293B;
    color: #F1F5F9;
    border-color: #334155;
}
:global(.dark .form-input:focus) {
    border-color: #60A5FA;
    background: #263449;
}
:global(.dark .form-input:disabled) {
    background: #263449;
    color: #94A3B8;
}
:global(.dark .form-input-icon__icon) {
    color: #94A3B8;
}

:global(.dark .filter-select) {
    background: #1E293B;
    color: #F1F5F9;
}

:global(.dark .donor-row) {
    border-top-color: #263449;
}
:global(.dark .donor-row--head) {
    background: #263449;
    color: #94A3B8;
}
:global(.dark .donor-cell__name) {
    color: #F1F5F9;
}
:global(.dark .donor-cell__id) {
    color: #94A3B8;
}

:global(.dark .view-link) {
    color: #60A5FA;
}

:global(.dark .empty-state) {
    color: #94A3B8;
}

:global(.dark .breadcrumb__link) {
    color: #60A5FA;
}
:global(.dark .breadcrumb__sep) {
    color: #94A3B8;
}
:global(.dark .breadcrumb__current) {
    color: #F1F5F9;
}

:global(.dark .detail-header-card__name) {
    color: #F1F5F9;
}
:global(.dark .detail-header-card__meta) {
    color: #94A3B8;
}

:global(.dark .tabs) {
    background: #0F172A;
    border-bottom-color: #334155;
}
:global(.dark .tab) {
    color: #94A3B8;
}
:global(.dark .tab:hover) {
    color: #F1F5F9;
}
:global(.dark .tab--active) {
    color: #60A5FA;
    border-bottom-color: #60A5FA;
}

:global(.dark .info-row) {
    border-bottom-color: #263449;
}
:global(.dark .info-row__label) {
    color: #94A3B8;
}
:global(.dark .info-row__value) {
    color: #F1F5F9;
}

:global(.dark .flag-card) {
    background: #3A1A1A;
    border-color: #F87171;
}
:global(.dark .flag-card__icon) {
    color: #F87171;
}
:global(.dark .flag-card__reason) {
    color: #F1F5F9;
}
:global(.dark .flag-card__meta) {
    color: #94A3B8;
}

:global(.dark .history-item) {
    border-bottom-color: #263449;
}
:global(.dark .history-item__date) {
    color: #94A3B8;
}
:global(.dark .history-item__title) {
    color: #F1F5F9;
}
:global(.dark .history-item__meta) {
    color: #94A3B8;
}
:global(.dark .history-item__result) {
    color: #34D399;
}
:global(.dark .history-item__dot--deferred) {
    background: #FBBF24;
}

:global(.dark .pill--eligible) {
    background: #1A3A2A;
    color: #34D399;
}
:global(.dark .pill--deferred) {
    background: #3E2C1A;
    color: #FBBF24;
}
:global(.dark .pill--flagged) {
    background: #3A1A1A;
    color: #F87171;
}
:global(.dark .pill--completed) {
    background: #1A3A2A;
    color: #34D399;
}
:global(.dark .pill--type-a) {
    background: #3E2C1A;
    color: #FBBF24;
}
:global(.dark .pill--type-b) {
    background: #1A3A2A;
    color: #34D399;
}
:global(.dark .pill--type-ab) {
    background: #2D1A4A;
    color: #A78BFA;
}
:global(.dark .pill--type-o) {
    background: #1A3A5F;
    color: #60A5FA;
}

:global(.dark .checkbox-row) {
    color: #F1F5F9;
}
:global(.dark .checkbox-row input) {
    accent-color: #60A5FA;
}

:global(.dark .modal-card__header) {
    border-bottom-color: #334155;
}
:global(.dark .modal-card__title) {
    color: #F1F5F9;
}
:global(.dark .modal-card__close) {
    color: #94A3B8;
}
:global(.dark .modal-card__close:hover) {
    color: #F1F5F9;
}
:global(.dark .modal-subtitle) {
    color: #94A3B8;
}
:global(.dark .form-label) {
    color: #94A3B8;
}
:global(.dark .modal-error) {
    color: #F87171;
}

:global(.dark .modal-overlay) {
    background: rgba(0, 0, 0, 0.7);
}

:global(.dark .btn-primary) {
    background: #60A5FA;
    color: #0F172A;
}
:global(.dark .btn-primary:hover) {
    opacity: 0.9;
}
:global(.dark .btn-primary:disabled) {
    opacity: 0.4;
}

:global(.dark .btn-outline) {
    background: #263449;
    color: #F1F5F9;
}
:global(.dark .btn-outline:hover) {
    background: #334155;
}

:global(.dark .btn-cancel) {
    background: #263449;
    color: #F1F5F9;
}
:global(.dark .btn-cancel:hover) {
    background: #334155;
}

:global(.dark .btn-link) {
    color: #60A5FA;
}

:global(.dark .error-banner) {
    background: rgba(239, 83, 80, 0.10);
    color: #EF9A9A;
    border-color: rgba(239, 83, 80, 0.24);
}

:global(.dark .page-title) {
    color: #F1F5F9;
}
:global(.dark .page-subtitle) {
    color: #94A3B8;
}

:global(.dark .spinner) {
    border-color: #1E293B;
    border-top-color: #60A5FA;
}

:global(.dark .skeleton-block) {
    background: linear-gradient(90deg, #1E293B 25%, #263449 37%, #1E293B 63%);
    background-size: 400% 100%;
    animation: skeleton-loading-dark 1.4s ease infinite;
}

@keyframes skeleton-loading-dark {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}

:global(.dark .avatar) {
    border: 2px solid #334155;
}

:global(.dark .avatar--lg) {
    border-width: 3px;
}

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.btn-cancel:focus-visible,
.btn-link:focus-visible {
  outline: 2px solid var(--rb-primary, #1565C0);
  outline-offset: 2px;
}
</style>