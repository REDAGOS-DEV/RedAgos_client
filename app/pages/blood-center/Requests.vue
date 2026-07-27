<template>
    <div class="requests-page">
        <div v-if="loading" class="loading-wrap">
            <div class="spinner" />
        </div>

        <div v-else class="requests-inner">
            <!-- Header -->
            <div class="header-row fade-in" style="--delay: 0ms">
                <div>
                    <h1 class="page-title">Blood Requests</h1>
                    <p class="page-subtitle">Manage and fulfill incoming blood requests</p>
                </div>
            </div>

            <!-- Critical alert -->
            <div v-if="criticalAlert" class="critical-banner fade-in" style="--delay: 40ms">
                <AssetIcon name="alert" :size="16" class="critical-banner__icon" />
                <p class="critical-banner__text"><strong>Critical:</strong> {{ criticalAlert.message }}</p>
                <a href="#" class="critical-banner__link" @click.prevent="scrollToRequest(criticalAlert.requestId)">
                    View requests
                    <AssetIcon name="arrow-right" :size="14" />
                </a>
            </div>

            <!-- Stats -->
            <div class="stats-row fade-in" style="--delay: 60ms">
                <div class="stat-card stat-card--pending">
                    <div class="stat-card__icon">
                        <AssetIcon name="clock" :size="18" />
                    </div>
                    <div class="stat-card__body">
                        <p class="stat-card__label">Pending</p>
                        <p class="stat-card__value">{{ stats.pending }}</p>
                        <p class="stat-card__caption">awaiting action</p>
                    </div>
                </div>
                <div class="stat-card stat-card--processing">
                    <div class="stat-card__icon">
                        <AssetIcon name="loader" :size="18" />
                    </div>
                    <div class="stat-card__body">
                        <p class="stat-card__label">Processing</p>
                        <p class="stat-card__value">{{ stats.processing }}</p>
                        <p class="stat-card__caption">in progress</p>
                    </div>
                </div>
                <div class="stat-card stat-card--dispatched">
                    <div class="stat-card__icon">
                        <AssetIcon name="truck" :size="18" />
                    </div>
                    <div class="stat-card__body">
                        <p class="stat-card__label">Dispatched</p>
                        <p class="stat-card__value">{{ stats.dispatched }}</p>
                        <p class="stat-card__caption">in transit</p>
                    </div>
                </div>
                <div class="stat-card stat-card--completed">
                    <div class="stat-card__icon">
                        <AssetIcon name="check-circle" :size="18" />
                    </div>
                    <div class="stat-card__body">
                        <p class="stat-card__label">Completed Today</p>
                        <p class="stat-card__value">{{ stats.completedToday }}</p>
                        <p class="stat-card__caption">fulfilled</p>
                    </div>
                </div>
            </div>

            <!-- Panel -->
            <div class="panel fade-in" style="--delay: 100ms">
                <div class="panel-header">
                    <p class="panel-title">All requests</p>
                    <div class="panel-filters">
                        <div class="select-wrap">
                            <select v-model="statusFilter" class="form-select">
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="processing">Processing</option>
                                <option value="dispatched">Dispatched</option>
                                <option value="received">Received</option>
                                <option value="rejected">Rejected</option>
                                <option value="partial">Partially Fulfilled</option>
                            </select>
                            <AssetIcon name="chevron-down" :size="14" class="select-wrap__icon" />
                        </div>
                        <div class="select-wrap">
                            <select v-model="urgencyFilter" class="form-select">
                                <option value="all">All urgency</option>
                                <option value="urgent">Urgent</option>
                                <option value="routine">Routine</option>
                            </select>
                            <AssetIcon name="chevron-down" :size="14" class="select-wrap__icon" />
                        </div>
                    </div>
                </div>

                <div class="table-wrap">
                    <table class="requests-table">
                        <thead>
                            <tr>
                                <th>Ref #</th>
                                <th>Blood Type</th>
                                <th>Component</th>
                                <th>Units</th>
                                <th>Urgency</th>
                                <th>Status</th>
                                <th>Hospital</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody v-if="loadingTable">
                            <tr v-for="n in 5" :key="'sk-' + n">
                                <td colspan="8">
                                    <div class="skeleton-block" style="height: 36px" />
                                </td>
                            </tr>
                        </tbody>

                        <tbody v-else-if="filteredRequests.length === 0">
                            <tr>
                                <td colspan="8" class="empty-cell">No blood requests match the current filters.</td>
                            </tr>
                        </tbody>

                        <tbody v-else>
                            <tr v-for="req in filteredRequests" :key="req.id" :id="`request-${req.id}`">
                                <td>
                                    <a href="#" class="ref-link" @click.prevent="openViewModal(req)">{{ req.ref }}</a>
                                </td>
                                <td>
                                    <span class="blood-pill" :style="bloodTypeStyle(req.bloodType)">{{ req.bloodType
                                        }}</span>
                                </td>
                                <td>{{ req.component }}</td>
                                <td>{{ req.units }} unit{{ req.units > 1 ? 's' : '' }}</td>
                                <td>
                                    <span class="urgency-pill" :class="`urgency-pill--${req.urgency}`">{{
                                        urgencyLabel(req.urgency) }}</span>
                                </td>
                                <td>
                                    <span class="status-pill" :class="`status-pill--${req.status}`">{{
                                        statusLabel(req.status) }}</span>
                                </td>
                                <td>{{ req.hospital }}</td>
                                <td>
                                    <a v-if="req.status === 'pending'" href="#" class="action-link"
                                        @click.prevent="openProcessModal(req)">
                                        Process
                                        <AssetIcon name="arrow-right" :size="12" />
                                    </a>
                                    <a v-else-if="req.status === 'processing'" href="#" class="action-link"
                                        @click.prevent="openDispatchModal(req)">
                                        Dispatch
                                        <AssetIcon name="arrow-right" :size="12" />
                                    </a>
                                    <a v-else-if="req.status === 'dispatched'" href="#" class="action-link"
                                        @click.prevent="openReceivedModal(req)">
                                        Mark Received
                                    </a>
                                    <a v-else href="#" class="action-link" @click.prevent="openViewModal(req)">View</a>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- PROCESS modal -->
        <Transition name="modal">
            <div v-if="showProcessModal" class="modal-overlay" @click.self="closeProcessModal">
                <div class="modal-card">
                    <div class="modal-card__header">
                        <h2 class="modal-card__title">Process Request &middot; {{ activeRequest?.ref }}</h2>
                        <button type="button" class="modal-card__close" @click="closeProcessModal">
                            <AssetIcon name="x" :size="18" />
                        </button>
                    </div>

                    <div class="modal-form">
                        <div class="request-summary">
                            <div class="request-summary__row"><span>Hospital</span><strong>{{ activeRequest?.hospital
                                    }}</strong></div>
                            <div class="request-summary__row"><span>Blood Type</span><strong>{{ activeRequest?.bloodType
                                    }} &middot; {{ activeRequest?.component }}</strong></div>
                            <div class="request-summary__row"><span>Units Requested</span><strong>{{
                                    activeRequest?.units }}</strong></div>
                            <div class="request-summary__row"><span>Urgency</span><strong>{{
                                    urgencyLabel(activeRequest?.urgency) }}</strong></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Units to allocate</label>
                            <input v-model.number="processForm.unitsAllocated" type="number" min="1"
                                class="form-input" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Assigned staff</label>
                            <input v-model="processForm.assignedStaff" type="text" class="form-input"
                                placeholder="Staff name..." />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Notes</label>
                            <textarea v-model="processForm.notes" class="form-textarea" rows="3"
                                placeholder="Optional notes..." />
                        </div>

                        <p v-if="processError" class="modal-error">{{ processError }}</p>

                        <div class="modal-actions">
                            <button type="button" class="btn-cancel" @click="closeProcessModal">Cancel</button>
                            <button type="button" class="btn-primary" :disabled="processing" @click="confirmProcess">
                                {{ processing ? 'Processing...' : 'Confirm & Process' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- DISPATCH modal -->
        <Transition name="modal">
            <div v-if="showDispatchModal" class="modal-overlay" @click.self="closeDispatchModal">
                <div class="modal-card">
                    <div class="modal-card__header">
                        <h2 class="modal-card__title">Dispatch Request &middot; {{ activeRequest?.ref }}</h2>
                        <button type="button" class="modal-card__close" @click="closeDispatchModal">
                            <AssetIcon name="x" :size="18" />
                        </button>
                    </div>

                    <div class="modal-form">
                        <div class="request-summary">
                            <div class="request-summary__row"><span>Hospital</span><strong>{{ activeRequest?.hospital
                                    }}</strong></div>
                            <div class="request-summary__row"><span>Blood Type</span><strong>{{ activeRequest?.bloodType
                                    }} &middot; {{ activeRequest?.component }}</strong></div>
                            <div class="request-summary__row"><span>Units</span><strong>{{ activeRequest?.units
                                    }}</strong></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Dispatch method</label>
                            <select v-model="dispatchForm.method" class="form-input">
                                <option value="ambulance">Ambulance</option>
                                <option value="courier">Courier</option>
                                <option value="pickup">Hospital Pickup</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Dispatch date</label>
                                <input v-model="dispatchForm.date" type="date" class="form-input" />
                            </div>
                            <div class="form-group">
                                <label class="form-label">Dispatch time</label>
                                <input v-model="dispatchForm.time" type="time" class="form-input" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Tracking / notes</label>
                            <textarea v-model="dispatchForm.notes" class="form-textarea" rows="3"
                                placeholder="Courier name, vehicle plate, etc..." />
                        </div>

                        <p v-if="dispatchError" class="modal-error">{{ dispatchError }}</p>

                        <div class="modal-actions">
                            <button type="button" class="btn-cancel" @click="closeDispatchModal">Cancel</button>
                            <button type="button" class="btn-primary" :disabled="dispatching" @click="confirmDispatch">
                                {{ dispatching ? 'Dispatching...' : 'Confirm Dispatch' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- MARK RECEIVED modalL -->
        <Transition name="modal">
            <div v-if="showReceivedModal" class="modal-overlay" @click.self="closeReceivedModal">
                <div class="modal-card">
                    <div class="modal-card__header">
                        <h2 class="modal-card__title">Mark as Received &middot; {{ activeRequest?.ref }}</h2>
                        <button type="button" class="modal-card__close" @click="closeReceivedModal">
                            <AssetIcon name="x" :size="18" />
                        </button>
                    </div>

                    <div class="modal-form">
                        <div class="request-summary">
                            <div class="request-summary__row"><span>Hospital</span><strong>{{ activeRequest?.hospital
                                    }}</strong></div>
                            <div class="request-summary__row"><span>Blood Type</span><strong>{{ activeRequest?.bloodType
                                    }} &middot; {{ activeRequest?.component }}</strong></div>
                            <div class="request-summary__row"><span>Units</span><strong>{{ activeRequest?.units
                                    }}</strong></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Received by</label>
                            <input v-model="receivedForm.receivedBy" type="text" class="form-input"
                                placeholder="Name of receiving staff..." />
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Received date</label>
                                <input v-model="receivedForm.date" type="date" class="form-input" />
                            </div>
                            <div class="form-group">
                                <label class="form-label">Received time</label>
                                <input v-model="receivedForm.time" type="time" class="form-input" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Condition</label>
                            <select v-model="receivedForm.condition" class="form-input">
                                <option value="good">Good condition</option>
                                <option value="partial">Partially fulfilled</option>
                                <option value="damaged">Damaged / Rejected</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Notes</label>
                            <textarea v-model="receivedForm.notes" class="form-textarea" rows="3"
                                placeholder="Optional notes..." />
                        </div>

                        <p v-if="receivedError" class="modal-error">{{ receivedError }}</p>

                        <div class="modal-actions">
                            <button type="button" class="btn-cancel" @click="closeReceivedModal">Cancel</button>
                            <button type="button" class="btn-primary" :disabled="marking" @click="confirmReceived">
                                {{ marking ? 'Saving...' : 'Confirm Received' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- VIEW modal -->
        <Transition name="modal">
            <div v-if="showViewModal" class="modal-overlay" @click.self="closeViewModal">
                <div class="modal-card">
                    <div class="modal-card__header">
                        <h2 class="modal-card__title">Request Details &middot; {{ activeRequest?.ref }}</h2>
                        <button type="button" class="modal-card__close" @click="closeViewModal">
                            <AssetIcon name="x" :size="18" />
                        </button>
                    </div>

                    <div class="modal-form">
                        <div class="request-summary">
                            <div class="request-summary__row"><span>Hospital</span><strong>{{ activeRequest?.hospital
                                    }}</strong></div>
                            <div class="request-summary__row"><span>Blood Type</span><strong>{{ activeRequest?.bloodType
                                    }} &middot; {{ activeRequest?.component }}</strong></div>
                            <div class="request-summary__row"><span>Units</span><strong>{{ activeRequest?.units
                                    }}</strong></div>
                            <div class="request-summary__row"><span>Urgency</span><strong>{{
                                    urgencyLabel(activeRequest?.urgency) }}</strong></div>
                            <div class="request-summary__row"><span>Status</span><strong>{{
                                    statusLabel(activeRequest?.status) }}</strong></div>
                            <div v-if="activeRequest?.createdAt" class="request-summary__row"><span>Requested
                                    on</span><strong>{{ activeRequest?.createdAt }}</strong></div>
                            <div v-if="activeRequest?.notes" class="request-summary__row"><span>Notes</span><strong>{{
                                    activeRequest?.notes }}</strong></div>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn-cancel" @click="closeViewModal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted, nextTick } from 'vue'

definePageMeta({
    middleware: 'auth',
    layout: 'blood-centerdashboard',
})

/**
 * NOTE ON API SHAPE
 * -------------------------------------------------------------------------
 * Mirrors the $fetch contract used in MobileDrives.vue / Appointments.vue.
 * Adjust paths below to match your actual backend routes.
 *
 *  GET  /api/bloodcenter/requests/stats
 *    -> { pending, processing, dispatched, completedToday }
 *
 *  GET  /api/bloodcenter/requests/critical-alert
 *    -> { message, requestId } | null
 *
 *  GET  /api/bloodcenter/requests?status=&urgency=
 *    -> [{
 *         id, ref, bloodType, component, units, urgency: 'urgent'|'routine',
 *         status: 'pending'|'processing'|'dispatched'|'received'|'rejected'|'partial',
 *         hospital, createdAt, notes
 *       }]
 *
 *  POST /api/bloodcenter/requests/:id/process   { unitsAllocated, assignedStaff, notes }
 *    -> updated request record (status -> 'processing')
 *
 *  POST /api/bloodcenter/requests/:id/dispatch  { method, date, time, notes }
 *    -> updated request record (status -> 'dispatched')
 *
 *  POST /api/bloodcenter/requests/:id/received  { receivedBy, date, time, condition, notes }
 *    -> updated request record (status -> 'received' | 'partial' | 'rejected')
 * -------------------------------------------------------------------------
 */

const api = {
    getStats: () => $fetch('/api/bloodcenter/requests/stats'),
    getCriticalAlert: () => $fetch('/api/bloodcenter/requests/critical-alert'),
    getRequests: (params) => $fetch('/api/bloodcenter/requests', { params }),
    processRequest: (id, body) => $fetch(`/api/bloodcenter/requests/${id}/process`, { method: 'POST', body }),
    dispatchRequest: (id, body) => $fetch(`/api/bloodcenter/requests/${id}/dispatch`, { method: 'POST', body }),
    markReceived: (id, body) => $fetch(`/api/bloodcenter/requests/${id}/received`, { method: 'POST', body }),
}

const loading = ref(true)
const loadingTable = ref(false)

const statusFilter = ref('all')
const urgencyFilter = ref('all')

const stats = reactive({ pending: 0, processing: 0, dispatched: 0, completedToday: 0 })
const criticalAlert = ref(null) // { message, requestId }
const requests = ref([])

const filteredRequests = computed(() =>
    requests.value.filter((r) => {
        const statusOk = statusFilter.value === 'all' || r.status === statusFilter.value
        const urgencyOk = urgencyFilter.value === 'all' || r.urgency === urgencyFilter.value
        return statusOk && urgencyOk
    })
)

function bloodTypeStyle(bt) {
    if (!bt) return {}
    if (bt.startsWith('AB')) return { background: '#EDE7F6', color: '#5E35B1' }
    if (bt.startsWith('A')) return { background: '#E3F2FD', color: '#1565C0' }
    if (bt.startsWith('B')) return { background: '#E8F5E9', color: '#2E7D32' }
    return { background: '#FDEAEA', color: '#D32F2F' } // O+/O- fallback
}

function urgencyLabel(u) {
    return u === 'urgent' ? 'Urgent' : 'Routine'
}

function statusLabel(s) {
    const map = {
        pending: 'Pending',
        processing: 'Processing',
        dispatched: 'Dispatched',
        received: 'Received',
        rejected: 'Rejected',
        partial: 'Partially Fulfilled',
    }
    return map[s] ?? s
}

// Shared active request reference across all modals
const activeRequest = ref(null)

// PROCESS modal state
const showProcessModal = ref(false)
const processing = ref(false)
const processError = ref('')
const processForm = reactive({ unitsAllocated: 1, assignedStaff: '', notes: '' })

function openProcessModal(req) {
    activeRequest.value = req
    processError.value = ''
    processForm.unitsAllocated = req.units
    processForm.assignedStaff = ''
    processForm.notes = ''
    showProcessModal.value = true
}
function closeProcessModal() {
    showProcessModal.value = false
    activeRequest.value = null
}
async function confirmProcess() {
    if (!activeRequest.value) return
    processing.value = true
    processError.value = ''
    try {
        const updated = await api.processRequest(activeRequest.value.id, { ...processForm })
        applyUpdatedRequest(updated)
        closeProcessModal()
    } catch (err) {
        // NOTE: wala pay live nga endpoint karon, so mag-fail ni nga call sa dev/UI stage.
        console.error('Failed to process request (expected while backend is not yet wired up):', err)
        processError.value = 'Could not process this request. Please try again.'
    } finally {
        processing.value = false
    }
}

// DISPATCH modal state
const showDispatchModal = ref(false)
const dispatching = ref(false)
const dispatchError = ref('')
const dispatchForm = reactive({ method: 'ambulance', date: '', time: '', notes: '' })

function openDispatchModal(req) {
    activeRequest.value = req
    dispatchError.value = ''
    dispatchForm.method = 'ambulance'
    dispatchForm.date = ''
    dispatchForm.time = ''
    dispatchForm.notes = ''
    showDispatchModal.value = true
}
function closeDispatchModal() {
    showDispatchModal.value = false
    activeRequest.value = null
}
async function confirmDispatch() {
    if (!activeRequest.value) return
    dispatching.value = true
    dispatchError.value = ''
    try {
        const updated = await api.dispatchRequest(activeRequest.value.id, { ...dispatchForm })
        applyUpdatedRequest(updated)
        closeDispatchModal()
    } catch (err) {
        console.error('Failed to dispatch request (expected while backend is not yet wired up):', err)
        dispatchError.value = 'Could not dispatch this request. Please try again.'
    } finally {
        dispatching.value = false
    }
}

// MARK RECEIVED modal state
const showReceivedModal = ref(false)
const marking = ref(false)
const receivedError = ref('')
const receivedForm = reactive({ receivedBy: '', date: '', time: '', condition: 'good', notes: '' })

function openReceivedModal(req) {
    activeRequest.value = req
    receivedError.value = ''
    receivedForm.receivedBy = ''
    receivedForm.date = ''
    receivedForm.time = ''
    receivedForm.condition = 'good'
    receivedForm.notes = ''
    showReceivedModal.value = true
}
function closeReceivedModal() {
    showReceivedModal.value = false
    activeRequest.value = null
}
async function confirmReceived() {
    if (!activeRequest.value) return
    marking.value = true
    receivedError.value = ''
    try {
        const updated = await api.markReceived(activeRequest.value.id, { ...receivedForm })
        applyUpdatedRequest(updated)
        closeReceivedModal()
    } catch (err) {
        console.error('Failed to mark request as received (expected while backend is not yet wired up):', err)
        receivedError.value = 'Could not update this request. Please try again.'
    } finally {
        marking.value = false
    }
}

// VIEW modal 
const showViewModal = ref(false)
function openViewModal(req) {
    activeRequest.value = req
    showViewModal.value = true
}
function closeViewModal() {
    showViewModal.value = false
    activeRequest.value = null
}

function applyUpdatedRequest(updated) {
    if (!updated) return
    const idx = requests.value.findIndex((r) => r.id === updated.id)
    if (idx !== -1) requests.value[idx] = updated
}

function scrollToRequest(id) {
    if (!id) return
    nextTick(() => {
        const el = document.getElementById(`request-${id}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
}

onMounted(async () => {
    try {
        const s = await api.getStats()
        Object.assign(stats, s)
    } catch (err) {
        console.error('Failed to load request stats (expected while backend is not yet wired up):', err)
    }

    try {
        criticalAlert.value = await api.getCriticalAlert()
    } catch (err) {
        console.error('Failed to load critical alert (expected while backend is not yet wired up):', err)
    }

    loadingTable.value = true
    try {
        requests.value = await api.getRequests({})
    } catch (err) {
        // wala pay live nga /api/bloodcenter/requests endpoint, so mag-fail gyud ni nga call. Gi-empty array,
        // maong mag-display ug empty state ang UI imbes mag-crash.
        console.error('Failed to load blood requests (expected while backend is not yet wired up):', err)
    } finally {
        loadingTable.value = false
    }

    loading.value = false
})
</script>

<style scoped>
.requests-page {
    --primary: #1565c0;
    --accent: #d32f2f;
    --success: #2e7d32;
    --warning: #f57c00;
    --text-primary: #1f2937;
    --text-secondary: #9ca3af;
    max-width: 1152px;
    background: #f5f7fa;
    margin: 0 auto;
    padding: 28px 36px 48px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: var(--text-primary);
}

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
    to {
        transform: rotate(360deg);
    }
}

.fade-in {
    animation: fadeInUp 0.5s ease both;
    animation-delay: var(--delay, 0ms);
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(12px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (prefers-reduced-motion: reduce) {

    .fade-in,
    .spinner {
        animation: none !important;
    }
}

.requests-inner {
    display: flex;
    flex-direction: column;
    gap: 22px;
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

/* Critical banner */
.critical-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #FDEAEA;
    border: 1px solid #F6C9C9;
    border-radius: 12px;
    padding: 14px 18px;
}

.critical-banner__icon {
    color: var(--accent);
    flex-shrink: 0;
}

.critical-banner__text {
    flex: 1;
    font-size: 13.5px;
    color: #A11D1D;
    margin: 0;
}

.critical-banner__text strong {
    font-weight: 800;
}

.critical-banner__link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 700;
    color: var(--primary);
    text-decoration: none;
    white-space: nowrap;
}

.critical-banner__link:hover {
    text-decoration: underline;
}

/* Stat cards */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #eef0f3;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  padding: 18px 20px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  position: relative;
  overflow: hidden;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: currentColor;
  opacity: 0.9;
}

.stat-card:hover {
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.07);
  transform: translateY(-2px);
}

.stat-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: currentColor;
}

.stat-card__icon :deep(svg) {
  color: #fff;
  opacity: 1;
}

.stat-card__body {
  min-width: 0;
}

.stat-card__label {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
  color: var(--text-secondary);
}

.stat-card__value {
  font-size: 28px;
  font-weight: 800;
  margin: 6px 0 2px;
  line-height: 1;
  color: var(--text-primary);
}

.stat-card__caption {
  font-size: 11.5px;
  font-weight: 600;
  margin: 0;
  color: var(--text-secondary);
}

.stat-card--pending { color: var(--warning); }
.stat-card--pending .stat-card__icon { background: #FFF3E0; }
.stat-card--pending .stat-card__icon :deep(svg) { color: var(--warning); }
.stat-card--pending .stat-card__caption { color: var(--warning); }

.stat-card--processing { color: var(--primary); }
.stat-card--processing .stat-card__icon { background: #E3F2FD; }
.stat-card--processing .stat-card__icon :deep(svg) { color: var(--primary); }

.stat-card--dispatched { color: #94A3B8; }
.stat-card--dispatched .stat-card__icon { background: #F1F5F9; }
.stat-card--dispatched .stat-card__icon :deep(svg) { color: #64748B; }

.stat-card--completed { color: var(--success); }
.stat-card--completed .stat-card__icon { background: #E8F5E9; }
.stat-card--completed .stat-card__icon :deep(svg) { color: var(--success); }
.stat-card--completed .stat-card__caption { color: var(--success); }

/* Panel */
.panel {
    background: #fff;
    border-radius: 16px;
    border: 1px solid #eef0f3;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    padding: 22px 24px 8px;
    overflow: hidden;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 18px;
    flex-wrap: wrap;
}

.panel-title {
    font-size: 14px;
    font-weight: 700;
    margin: 0;
}

.panel-filters {
    display: flex;
    gap: 10px;
}

.select-wrap {
    position: relative;
}

.form-select {
    appearance: none;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    padding: 9px 34px 9px 14px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-primary);
    background: #fff;
    cursor: pointer;
    min-width: 130px;
    transition: border-color 0.15s ease;
}

.form-select:hover {
    border-color: #bcd7f2;
}

.form-select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(21, 101, 192, 0.15);
}

.select-wrap__icon {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: #6b7280;
}

/* Table */
.table-wrap {
    overflow-x: auto;
}

.requests-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.requests-table thead th {
    text-align: left;
    font-size: 10.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-secondary);
    padding: 0 14px 12px;
    border-bottom: 1px solid #f3f4f6;
    white-space: nowrap;
}

.requests-table tbody td {
    padding: 14px;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
    white-space: nowrap;
}

.requests-table tbody tr:last-child td {
    border-bottom: none;
}

.requests-table tbody tr:hover {
    background: #FAFBFC;
}

.empty-cell {
    text-align: center;
    color: var(--text-secondary);
    padding: 32px 0 !important;
    white-space: normal !important;
}

.ref-link {
    color: var(--primary);
    font-weight: 700;
    text-decoration: none;
}

.ref-link:hover {
    text-decoration: underline;
}

.blood-pill {
    display: inline-block;
    font-size: 11px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 999px;
}

.urgency-pill {
    font-size: 10.5px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
}

.urgency-pill--urgent {
    background: #FDEAEA;
    color: var(--accent);
}

.urgency-pill--routine {
    background: #E8F5E9;
    color: var(--success);
}

.status-pill {
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 999px;
    white-space: nowrap;
}

.status-pill--pending {
    background: #FFF3E0;
    color: var(--warning);
}

.status-pill--processing {
    background: #E3F2FD;
    color: var(--primary);
}

.status-pill--dispatched {
    background: #E8F5E9;
    color: var(--success);
}

.status-pill--received {
    background: #E8F5E9;
    color: var(--success);
}

.status-pill--rejected {
    background: #FDEAEA;
    color: var(--accent);
}

.status-pill--partial {
    background: #FFF3E0;
    color: var(--warning);
}

.action-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--primary);
    font-size: 12.5px;
    font-weight: 700;
    text-decoration: none;
}

.action-link:hover {
    text-decoration: underline;
}

/* Skeletons */
.skeleton-block {
    background: linear-gradient(90deg, #eceff3 25%, #f5f7fb 37%, #eceff3 63%);
    background-size: 400% 100%;
    animation: skeleton-loading 1.4s ease infinite;
    border-radius: 8px;
}

@keyframes skeleton-loading {
    0% {
        background-position: 100% 50%;
    }

    100% {
        background-position: 0 50%;
    }
}

/* Modals */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 100;
}

.modal-card {
    background: #fff;
    border-radius: 16px;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
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

.request-summary {
    background: #F8FAFC;
    border: 1px solid #eef0f3;
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 4px;
}

.request-summary__row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 12.5px;
}

.request-summary__row span {
    color: var(--text-secondary);
}

.request-summary__row strong {
    color: var(--text-primary);
    font-weight: 700;
    text-align: right;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
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

.form-input,
.form-textarea {
    width: 100%;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 9px 12px;
    font-size: 13px;
    color: var(--text-primary);
    background: #fafbfc;
    font-family: inherit;
    transition: border-color 0.15s ease;
}

.form-input:focus,
.form-textarea:focus {
    outline: none;
    border-color: var(--primary);
    background: #fff;
}

.form-textarea {
    resize: vertical;
    min-height: 64px;
}

.modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 4px;
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
    transition: opacity 0.15s ease, box-shadow 0.15s ease;
}

.btn-primary:hover {
    opacity: 0.92;
    box-shadow: 0 4px 12px rgba(21, 101, 192, 0.25);
}

.btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
}

.modal-error {
    color: var(--accent);
    font-size: 12px;
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

/* Responsive */
@media (max-width: 900px) {
    .stats-row {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 640px) {
    .requests-page {
        padding: 16px 16px 32px;
    }

    .panel-header {
        flex-direction: column;
        align-items: stretch;
    }

    .panel-filters {
        flex-direction: column;
    }

    .form-row {
        grid-template-columns: 1fr;
    }
}
</style>