<template>
    <div class="reports-page">
        <div v-if="initialLoading" class="loading-wrap">
            <div class="spinner" />
        </div>

        <div v-else class="reports-inner">
            <!-- Header -->
            <div class="header-row fade-in" style="--delay: 0ms">
                <div>
                    <h1 class="page-title">Demand Forecasting &amp; Analytical Reports</h1>
                    <p class="page-subtitle">Monitor blood demand trends and generate operational reports</p>
                </div>
                <div class="header-actions">
                    <div class="select-wrap">
                        <select v-model="facilityFilter" class="filter-select-input" @change="onFilterChange">
                            <option value="all">All Facilities</option>
                            <option v-for="f in facilities" :key="f.id" :value="f.id">{{ f.name }}</option>
                        </select>
                        <AssetIcon name="chevron-down" :size="14" class="select-wrap__icon" />
                    </div>
                    <div class="select-wrap">
                        <select v-model="horizonFilter" class="filter-select-input" @change="onFilterChange">
                            <option value="7">Next 7 days</option>
                            <option value="14">Next 14 days</option>
                            <option value="30">Next 30 days</option>
                        </select>
                        <AssetIcon name="chevron-down" :size="14" class="select-wrap__icon" />
                    </div>
                </div>
            </div>

            <!-- Error banner -->
            <div v-if="loadError" class="error-banner fade-in" style="--delay: 40ms">
                {{ loadError }}
                <button type="button" class="btn-link" @click="loadAll">Retry</button>
            </div>

            <!-- KPI cards -->
            <div class="stats-row fade-in" style="--delay: 60ms">
                <div class="stat-card">
                    <div class="stat-card__icon stat-card__icon--blue">
                        <AssetIcon name="trending-up" :size="18" />
                    </div>
                    <div class="stat-card__body">
                        <p class="stat-card__label">Predicted Demand ({{ horizonFilter }}d)</p>
                        <p class="stat-card__value" :class="{ skeleton: loadingStats }">{{ loadingStats ? '' :
                            stats.predictedDemand + ' units' }}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-card__icon stat-card__icon--green">
                        <AssetIcon name="calendar-check" :size="18" />
                    </div>
                    <div class="stat-card__body">
                        <p class="stat-card__label">Inventory Coverage</p>
                        <p class="stat-card__value" :class="{ skeleton: loadingStats }">{{ loadingStats ? '' :
                            stats.coverageDays + ' days' }}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-card__icon stat-card__icon--red">
                        <AssetIcon name="alert" :size="18" />
                    </div>
                    <div class="stat-card__body">
                        <p class="stat-card__label">Blood Types At Risk</p>
                        <p class="stat-card__value" :class="{ skeleton: loadingStats }">{{ loadingStats ? '' :
                            stats.criticalTypes }}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-card__icon stat-card__icon--orange">
                        <AssetIcon name="check-circle" :size="18" />
                    </div>
                    <div class="stat-card__body">
                        <p class="stat-card__label">Fulfillment Rate</p>
                        <p class="stat-card__value" :class="{ skeleton: loadingStats }">{{ loadingStats ? '' :
                            stats.fulfillmentRate + '%' }}</p>
                    </div>
                </div>
            </div>

            <!-- Main panel -->
            <div class="panel fade-in" style="--delay: 100ms">
                <div class="tabs">
                    <button type="button" class="tab" :class="{ 'tab--active': activeTab === 'forecast' }"
                        @click="activeTab = 'forecast'">
                        Demand Forecast
                    </button>
                    <button type="button" class="tab" :class="{ 'tab--active': activeTab === 'analytics' }"
                        @click="activeTab = 'analytics'">
                        Analytical Reports
                    </button>
                </div>

                <!-- DEMAND FORECAST TAB -->
                <section v-if="activeTab === 'forecast'" class="tab-content">
                    <div class="forecast-toolbar">
                        <p class="section-label">Stock vs. Predicted Demand by Blood Type</p>
                        <select v-model="bloodTypeFilter" class="form-input filter-select">
                            <option value="all">All Blood Types</option>
                            <option v-for="bt in bloodTypes" :key="bt" :value="bt">{{ bt }}</option>
                        </select>
                    </div>

                    <!-- Bar chart -->
                    <div class="chart-card">
                        <div v-if="loadingForecast" class="chart-skeleton skeleton-block" />
                        <div v-else class="bar-chart">
                            <div v-for="row in filteredForecastData" :key="row.bloodType" class="bar-group">
                                <div class="bar-group__bars">
                                    <div class="bar-col">
                                        <span class="bar-value">{{ row.currentStock }}</span>
                                        <div class="bar bar--stock"
                                            :style="{ height: barHeight(row.currentStock) + 'px' }" />
                                    </div>
                                    <div class="bar-col">
                                        <span class="bar-value">{{ row.predictedDemand }}</span>
                                        <div class="bar"
                                            :class="row.predictedDemand > row.currentStock ? 'bar--demand-over' : 'bar--demand'"
                                            :style="{ height: barHeight(row.predictedDemand) + 'px' }" />
                                    </div>
                                </div>
                                <span class="bar-group__label">{{ row.bloodType }}</span>
                            </div>
                        </div>
                        <div class="chart-legend">
                            <span class="legend-item"><i class="legend-swatch legend-swatch--stock" />Current
                                Stock</span>
                            <span class="legend-item"><i class="legend-swatch legend-swatch--demand" />Predicted
                                Demand</span>
                            <span class="legend-item"><i class="legend-swatch legend-swatch--over" />Demand Exceeds
                                Stock</span>
                        </div>
                    </div>

                    <!-- Emergency demand alerts -->
                    <p class="section-label">Emergency Demand Analysis</p>
                    <div class="alert-list">
                        <div v-if="loadingAlerts" v-for="n in 2" :key="'ska-' + n"
                            class="alert-card skeleton-block" />
                        <p v-else-if="emergencyAlerts.length === 0" class="empty-state">
                            No critical shortages projected for the selected period.
                        </p>
                        <div v-else v-for="alert in emergencyAlerts" :key="alert.id" class="alert-card"
                            :class="'alert-card--' + alert.severity">
                            <div class="alert-card__icon">
                                <AssetIcon name="alert" :size="16" />
                            </div>
                            <div class="alert-card__body">
                                <p class="alert-card__title">
                                    <span class="pill pill--blood">{{ alert.bloodType }}</span>
                                    {{ alert.message }}
                                </p>
                                <p class="alert-card__meta">Projected shortfall in {{ alert.daysUntilShortage }} day{{
                                    alert.daysUntilShortage === 1 ? '' : 's' }} at {{ alert.facilityName }}</p>
                            </div>
                            <button type="button" class="btn-outline-blue" @click="requestReplenishment(alert)">
                                Request Replenishment
                            </button>
                        </div>
                    </div>

                    <!-- Breakdown table -->
                    <p class="section-label">Blood Type Breakdown</p>
                    <div class="breakdown-table">
                        <div class="breakdown-row breakdown-row--head">
                            <span>Blood Type</span>
                            <span>Current Stock</span>
                            <span>Avg. Daily Usage</span>
                            <span>{{ horizonFilter }}-Day Forecast</span>
                            <span>Projected Balance</span>
                            <span>Status</span>
                        </div>
                        <div v-if="loadingForecast" v-for="n in 4" :key="'skb-' + n"
                            class="breakdown-row skeleton-block" />
                        <div v-else v-for="row in filteredForecastData" :key="'row-' + row.bloodType"
                            class="breakdown-row">
                            <span><span class="pill pill--blood">{{ row.bloodType }}</span></span>
                            <span>{{ row.currentStock }} units</span>
                            <span>{{ row.avgDailyUsage }} units/day</span>
                            <span>{{ row.predictedDemand }} units</span>
                            <span :class="{ 'balance--negative': (row.currentStock - row.predictedDemand) < 0 }">
                                {{ row.currentStock - row.predictedDemand >= 0 ? '+' : '' }}{{ row.currentStock -
                                    row.predictedDemand }} units
                            </span>
                            <span><span class="pill" :class="'pill--status-' + row.status.toLowerCase()">{{
                                row.status }}</span></span>
                        </div>
                    </div>
                </section>

                <!-- ANALYTICAL REPORTS TAB -->
                <section v-else class="tab-content">
                    <p class="section-label">Generate Report</p>

                    <div class="report-generator">
                        <div class="form-group">
                            <label class="form-label">Report Type</label>
                            <select v-model="reportForm.type" class="form-input">
                                <option value="request_trend">Request Trend Report</option>
                                <option value="forecasting">Forecasting Report</option>
                                <option value="donation_performance">Donation Performance Report</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">From</label>
                            <input v-model="reportForm.dateFrom" type="date" class="form-input" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">To</label>
                            <input v-model="reportForm.dateTo" type="date" class="form-input" />
                        </div>
                        <button type="button" class="btn-primary report-generator__btn"
                            :disabled="generatingReport || !canGenerateReport" @click="handleGenerateReport">
                            <AssetIcon name="bar-chart" :size="15" />
                            {{ generatingReport ? 'Generating...' : 'Generate Report' }}
                        </button>
                    </div>
                    <p v-if="generateError" class="modal-error">{{ generateError }}</p>

                    <!-- Weekly trend chart -->
                    <p class="section-label">Weekly Request Volume</p>
                    <div class="chart-card">
                        <div v-if="loadingTrend" class="chart-skeleton skeleton-block" />
                        <svg v-else viewBox="0 0 640 220" class="trend-chart" preserveAspectRatio="none">
                            <polyline :points="trendAreaPoints" class="trend-area" />
                            <polyline :points="trendLinePoints" class="trend-line" />
                            <circle v-for="(pt, i) in trendPointCoords" :key="'pt-' + i" :cx="pt.x" :cy="pt.y" r="4"
                                class="trend-dot" />
                        </svg>
                        <div class="trend-labels">
                            <span v-for="week in trendData" :key="week.weekLabel">{{ week.weekLabel }}</span>
                        </div>
                    </div>

                    <!-- Recent reports -->
                    <p class="section-label">Recent Reports</p>
                    <div class="reports-table">
                        <div class="reports-row reports-row--head">
                            <span>Report Name</span>
                            <span>Type</span>
                            <span>Date Range</span>
                            <span>Generated By</span>
                            <span>Generated</span>
                            <span></span>
                        </div>
                        <div v-if="loadingRecentReports" v-for="n in 3" :key="'skr-' + n"
                            class="reports-row skeleton-block" />
                        <p v-else-if="recentReports.length === 0" class="empty-state">No reports generated yet.</p>
                        <div v-else v-for="report in recentReports" :key="report.id" class="reports-row">
                            <span class="reports-row__name">{{ report.name }}</span>
                            <span><span class="pill pill--type">{{ reportTypeLabel(report.type) }}</span></span>
                            <span>{{ report.dateRangeLabel }}</span>
                            <span>{{ report.generatedBy }}</span>
                            <span>{{ report.generatedAt }}</span>
                            <span class="reports-row__actions">
                                <button type="button" class="view-link" @click="openReportPreview(report)">View</button>
                                <button type="button" class="view-link" @click="handleExport(report, 'pdf')">PDF</button>
                                <button type="button" class="view-link"
                                    @click="handleExport(report, 'xlsx')">Excel</button>
                            </span>
                        </div>
                    </div>
                </section>
            </div>
        </div>

        <!-- REPORT PREVIEW MODAL -->
        <Transition name="modal">
            <div v-if="showReportModal" class="modal-overlay" @click.self="closeReportPreview">
                <div class="modal-card modal-card--wide">
                    <div class="modal-card__header">
                        <h2 class="modal-card__title">{{ selectedReport?.name }}</h2>
                        <button type="button" class="modal-card__close" @click="closeReportPreview">
                            <AssetIcon name="x" :size="18" />
                        </button>
                    </div>

                    <div class="modal-form">
                        <div v-if="loadingReportPreview" class="donor-list">
                            <div v-for="n in 4" :key="'skp-' + n" class="donor-row skeleton-block" />
                        </div>
                        <div v-else-if="reportPreviewData">
                            <p class="modal-subtitle">{{ reportPreviewData.summary }}</p>
                            <div class="preview-stats">
                                <div v-for="stat in reportPreviewData.stats" :key="stat.label" class="preview-stat">
                                    <span class="preview-stat__value">{{ stat.value }}</span>
                                    <span class="preview-stat__label">{{ stat.label }}</span>
                                </div>
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn-cancel" @click="closeReportPreview">Close</button>
                            <button type="button" class="btn-primary"
                                @click="handleExport(selectedReport, 'pdf')">Export as PDF</button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'

definePageMeta({
    middleware: 'auth',
    layout: 'blood-centerdashboard',
})

/**
 * NOTE ON API SHAPE
 * -------------------------------------------------------------------------
 * Mirrors the contract used in Appointments.vue ($fetch against Nuxt server
 * routes / your backend proxy). Adjust the paths below to match your actual
 * routes if they differ.
 *
 *  GET  /api/bloodcenter/reports/stats?facility=&horizon=
 *    -> { predictedDemand, coverageDays, criticalTypes, fulfillmentRate }
 *
 *  GET  /api/bloodcenter/reports/demand-forecast?facility=&horizon=
 *    -> [{ bloodType, currentStock, avgDailyUsage, predictedDemand, status }]
 *      status: 'Sufficient' | 'Watch' | 'Critical'
 *
 *  GET  /api/bloodcenter/reports/emergency-alerts?facility=&horizon=
 *    -> [{ id, bloodType, severity, message, daysUntilShortage, facilityName }]
 *      severity: 'critical' | 'warning'
 *
 *  GET  /api/bloodcenter/reports/request-trend?facility=
 *    -> [{ weekLabel, requests, fulfilled }]
 *
 *  GET  /api/bloodcenter/reports/recent
 *    -> [{ id, name, type, dateRangeLabel, generatedBy, generatedAt, status }]
 *
 *  GET  /api/bloodcenter/facilities
 *    -> [{ id, name }]
 *
 *  POST /api/bloodcenter/reports/generate  { type, dateFrom, dateTo }
 *    -> { id, name, type, dateRangeLabel, generatedBy, generatedAt }
 *
 *  GET  /api/bloodcenter/reports/:id/preview
 *    -> { summary, stats: [{ label, value }] }
 *
 *  GET  /api/bloodcenter/reports/:id/export?format=pdf|xlsx
 *    -> file download (blob)
 * -------------------------------------------------------------------------
 */

const api = {
    getStats: (params) => $fetch('/api/bloodcenter/reports/stats', { params }),
    getDemandForecast: (params) => $fetch('/api/bloodcenter/reports/demand-forecast', { params }),
    getEmergencyAlerts: (params) => $fetch('/api/bloodcenter/reports/emergency-alerts', { params }),
    getRequestTrend: (params) => $fetch('/api/bloodcenter/reports/request-trend', { params }),
    getRecentReports: () => $fetch('/api/bloodcenter/reports/recent'),
    getFacilities: () => $fetch('/api/bloodcenter/facilities'),
    generateReport: (payload) => $fetch('/api/bloodcenter/reports/generate', { method: 'POST', body: payload }),
    getReportPreview: (id) => $fetch(`/api/bloodcenter/reports/${id}/preview`),
    exportReport: (id, format) =>
        $fetch(`/api/bloodcenter/reports/${id}/export`, { params: { format }, responseType: 'blob' }),
}

const initialLoading = ref(true)
const activeTab = ref('forecast')
const loadError = ref('')

const facilityFilter = ref('all')
const facilities = ref([]) // [{ id, name }]
const horizonFilter = ref('7')
const bloodTypeFilter = ref('all')
const bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

const stats = reactive({ predictedDemand: 0, coverageDays: 0, criticalTypes: 0, fulfillmentRate: 0 })
const loadingStats = ref(false)

const forecastData = ref([])
const loadingForecast = ref(false)

const emergencyAlerts = ref([])
const loadingAlerts = ref(false)

const trendData = ref([])
const loadingTrend = ref(false)

const recentReports = ref([])
const loadingRecentReports = ref(false)

const reportForm = reactive({ type: 'request_trend', dateFrom: '', dateTo: '' })
const generatingReport = ref(false)
const generateError = ref('')

const canGenerateReport = computed(() => Boolean(reportForm.dateFrom) && Boolean(reportForm.dateTo))

const showReportModal = ref(false)
const loadingReportPreview = ref(false)
const selectedReport = ref(null)
const reportPreviewData = ref(null)

const CHART_MAX_BAR_HEIGHT = 150

const filteredForecastData = computed(() => {
    if (bloodTypeFilter.value === 'all') return forecastData.value
    return forecastData.value.filter((r) => r.bloodType === bloodTypeFilter.value)
})

const maxForecastValue = computed(() => {
    const values = forecastData.value.flatMap((r) => [r.currentStock, r.predictedDemand])
    return Math.max(...values, 1)
})

function barHeight(value) {
    return Math.max(4, Math.round((value / maxForecastValue.value) * CHART_MAX_BAR_HEIGHT))
}

const maxTrendValue = computed(() => Math.max(...trendData.value.map((w) => w.requests), 1))

function trendCoords() {
    const width = 640
    const height = 220
    const padding = 20
    const usableWidth = width - padding * 2
    const usableHeight = height - padding * 2
    const count = trendData.value.length
    if (count === 0) return []
    return trendData.value.map((w, i) => {
        const x = count === 1 ? padding : padding + (i / (count - 1)) * usableWidth
        const y = padding + usableHeight - (w.requests / maxTrendValue.value) * usableHeight
        return { x, y }
    })
}

const trendPointCoords = computed(() => trendCoords())

const trendLinePoints = computed(() => trendPointCoords.value.map((p) => `${p.x},${p.y}`).join(' '))

const trendAreaPoints = computed(() => {
    const coords = trendPointCoords.value
    if (coords.length === 0) return ''
    const first = coords[0]
    const last = coords[coords.length - 1]
    const base = `${first.x},200 ` + coords.map((p) => `${p.x},${p.y}`).join(' ') + ` ${last.x},200`
    return base
})

function reportTypeLabel(type) {
    const map = {
        request_trend: 'Request Trend',
        forecasting: 'Forecasting',
        donation_performance: 'Donation Performance',
    }
    return map[type] || type
}

async function loadFacilities() {
    try {
        facilities.value = await api.getFacilities()
    } catch (err) {
        console.error(err)
    }
}

async function loadStats() {
    loadingStats.value = true
    try {
        const data = await api.getStats({ facility: facilityFilter.value, horizon: horizonFilter.value })
        Object.assign(stats, data)
    } catch (err) {
        loadError.value = 'Could not load forecast statistics.'
        console.error(err)
    } finally {
        loadingStats.value = false
    }
}

async function loadForecastData() {
    loadingForecast.value = true
    try {
        forecastData.value = await api.getDemandForecast({ facility: facilityFilter.value, horizon: horizonFilter.value })
    } catch (err) {
        loadError.value = 'Could not load demand forecast.'
        console.error(err)
    } finally {
        loadingForecast.value = false
    }
}

async function loadEmergencyAlerts() {
    loadingAlerts.value = true
    try {
        emergencyAlerts.value = await api.getEmergencyAlerts({ facility: facilityFilter.value, horizon: horizonFilter.value })
    } catch (err) {
        loadError.value = 'Could not load emergency demand alerts.'
        console.error(err)
    } finally {
        loadingAlerts.value = false
    }
}

async function loadTrendData() {
    loadingTrend.value = true
    try {
        trendData.value = await api.getRequestTrend({ facility: facilityFilter.value })
    } catch (err) {
        loadError.value = 'Could not load request trend data.'
        console.error(err)
    } finally {
        loadingTrend.value = false
    }
}

async function loadRecentReports() {
    loadingRecentReports.value = true
    try {
        recentReports.value = await api.getRecentReports()
    } catch (err) {
        loadError.value = 'Could not load recent reports.'
        console.error(err)
    } finally {
        loadingRecentReports.value = false
    }
}

async function loadAll() {
    loadError.value = ''
    await Promise.all([
        loadFacilities(),
        loadStats(),
        loadForecastData(),
        loadEmergencyAlerts(),
        loadTrendData(),
        loadRecentReports(),
    ])
}

function onFilterChange() {
    loadStats()
    loadForecastData()
    loadEmergencyAlerts()
}

function requestReplenishment(alert) {
    // Hook up to the Inventory Replenishment flow as needed.
    console.log('Request replenishment', alert.id)
}

async function handleGenerateReport() {
    if (!canGenerateReport.value) {
        generateError.value = 'Please select a date range.'
        return
    }
    generatingReport.value = true
    generateError.value = ''
    try {
        const newReport = await api.generateReport({
            type: reportForm.type,
            dateFrom: reportForm.dateFrom,
            dateTo: reportForm.dateTo,
        })
        recentReports.value = [newReport, ...recentReports.value]
        await openReportPreview(newReport)
    } catch (err) {
        generateError.value = 'Could not generate report. Please try again.'
        console.error(err)
    } finally {
        generatingReport.value = false
    }
}

async function openReportPreview(report) {
    selectedReport.value = report
    showReportModal.value = true
    loadingReportPreview.value = true
    try {
        reportPreviewData.value = await api.getReportPreview(report.id)
    } catch (err) {
        reportPreviewData.value = null
        console.error(err)
    } finally {
        loadingReportPreview.value = false
    }
}

function closeReportPreview() {
    showReportModal.value = false
    selectedReport.value = null
    reportPreviewData.value = null
}

async function handleExport(report, format) {
    if (!report) return
    try {
        const blob = await api.exportReport(report.id, format)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${report.name}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
        link.click()
        URL.revokeObjectURL(url)
    } catch (err) {
        console.error('Could not export report', err)
    }
}

onMounted(async () => {
    await loadAll()
    initialLoading.value = false
})
</script>

<style scoped>
.reports-page {
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

.reports-inner {
    display: flex;
    flex-direction: column;
    gap: 28px;
}

/* Header */
.header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 24px;
    flex-wrap: wrap;
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

.header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
}

.select-wrap {
    position: relative;
    width: 168px;
}

.filter-select-input {
    width: 100%;
    height: 42px;
    padding: 0 34px 0 14px;
    appearance: none;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-primary);
}

.filter-select-input:focus {
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

.btn-outline-blue {
    padding: 8px 14px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
    background: #e3f2fd;
    color: var(--primary);
    border: none;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s ease;
}

.btn-outline-blue:hover {
    background: #d3e6fa;
}

.btn-link {
    background: none;
    border: none;
    color: var(--primary);
    text-decoration: underline;
    cursor: pointer;
    font-size: 13px;
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

/* Stat cards */
.stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
}

.stat-card {
    background: #fff;
    border-radius: 16px;
    border: 1px solid #eef0f3;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    padding: 20px 22px;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.stat-card:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
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
}

.stat-card__icon--blue {
    background: #e3f2fd;
    color: var(--primary);
}

.stat-card__icon--orange {
    background: #f3e1d2;
    color: var(--warning);
}

.stat-card__icon--green {
    background: #e8f5e9;
    color: var(--success);
}

.stat-card__icon--red {
    background: #fdeaea;
    color: var(--accent);
}

.stat-card__body {
    min-width: 0;
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
    font-size: 24px;
    font-weight: 800;
    margin: 4px 0 0;
    color: var(--text-primary);
    line-height: 1.1;
}

/* Panel */
.panel {
    background: #fff;
    border-radius: 18px;
    border: 1px solid #eef0f3;
    padding: 8px 0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    overflow: hidden;
}

.tabs {
    display: flex;
    justify-content: center;
    gap: 75px;
    border-bottom: 1px solid #f3f4f6;
    padding: 0 32px;
    background: #fafbfc;
}

.tab {
    background: none;
    border: none;
    padding: 12px 18px;
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 10px 10px 0 0;
    border-bottom: 2px solid transparent;
    transition: color 0.15s ease, background 0.15s ease;
}

.tab:hover {
    color: var(--text-primary);
}

.tab--active {
    color: var(--primary);
    background: #fff;
    border-bottom: 2px solid var(--primary);
}

.tab-content {
    padding: 28px;
}

.section-label {
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-primary);
    margin: 24px 0 12px;
}

.section-label:first-child {
    margin-top: 0;
}

/* Forecast toolbar */
.forecast-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}

.forecast-toolbar .section-label {
    margin: 0;
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
}

.form-input:focus {
    outline: none;
    border-color: var(--primary);
    background: #fff;
}

.filter-select {
    cursor: pointer;
    width: 180px;
}

/* Chart card */
.chart-card {
    border: 1px solid #eef0f3;
    border-radius: 14px;
    padding: 20px 20px 12px;
    background: #fbfcfe;
}

.chart-skeleton {
    height: 200px;
}

/* Bar chart */
.bar-chart {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    height: 150px;
    padding: 0 4px;
}

.bar-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex: 1;
}

.bar-group__bars {
    display: flex;
    align-items: flex-end;
    gap: 5px;
    height: 150px;
}

.bar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
    width: 18px;
}

.bar-value {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--text-secondary);
    margin-bottom: 4px;
    white-space: nowrap;
}

.bar {
    width: 100%;
    border-radius: 4px 4px 0 0;
    transition: height 0.4s ease;
}

.bar--stock {
    background: var(--primary);
}

.bar--demand {
    background: var(--warning);
}

.bar--demand-over {
    background: var(--accent);
}

.bar-group__label {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-primary);
}

.chart-legend {
    display: flex;
    gap: 18px;
    justify-content: center;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid #f3f4f6;
    flex-wrap: wrap;
}

.legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    color: var(--text-secondary);
    font-weight: 600;
}

.legend-swatch {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    display: inline-block;
}

.legend-swatch--stock {
    background: var(--primary);
}

.legend-swatch--demand {
    background: var(--warning);
}

.legend-swatch--over {
    background: var(--accent);
}

/* Alerts */
.alert-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.alert-card {
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 12px;
    padding: 14px 16px;
    border: 1px solid #f3c1c1;
    background: #fdeaea;
}

.alert-card--warning {
    border-color: #f6dbb8;
    background: #fff3e0;
}

.alert-card__icon {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: #fff;
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.alert-card--warning .alert-card__icon {
    color: var(--warning);
}

.alert-card__body {
    flex: 1;
    min-width: 0;
}

.alert-card__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.alert-card__meta {
    font-size: 11.5px;
    color: var(--text-secondary);
    margin: 4px 0 0;
}

/* Breakdown table */
.breakdown-table,
.reports-table {
    border: 1px solid #eef0f3;
    border-radius: 14px;
    overflow: hidden;
}

.breakdown-row {
    display: grid;
    grid-template-columns: 1fr 1.2fr 1.3fr 1.3fr 1.2fr 1fr;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    font-size: 12.5px;
    border-bottom: 1px solid #f3f4f6;
}

.breakdown-row:last-child {
    border-bottom: none;
}

.breakdown-row--head {
    background: #fafbfc;
    font-weight: 800;
    text-transform: uppercase;
    font-size: 10.5px;
    letter-spacing: 0.03em;
    color: var(--text-secondary);
}

.balance--negative {
    color: var(--accent);
    font-weight: 700;
}

/* Report generator */
.report-generator {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr auto;
    gap: 12px;
    align-items: end;
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

.report-generator__btn {
    height: 42px;
}

/* Trend chart */
.trend-chart {
    width: 100%;
    height: 200px;
    overflow: visible;
}

.trend-area {
    fill: rgba(21, 101, 192, 0.08);
    stroke: none;
}

.trend-line {
    fill: none;
    stroke: var(--primary);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.trend-dot {
    fill: #fff;
    stroke: var(--primary);
    stroke-width: 2.5;
}

.trend-labels {
    display: flex;
    justify-content: space-between;
    padding: 0 20px;
    margin-top: 4px;
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 600;
}

/* Reports table */
.reports-row {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1.2fr 1fr 1fr 1.1fr;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    font-size: 12.5px;
    border-bottom: 1px solid #f3f4f6;
}

.reports-row:last-child {
    border-bottom: none;
}

.reports-row--head {
    background: #fafbfc;
    font-weight: 800;
    text-transform: uppercase;
    font-size: 10.5px;
    letter-spacing: 0.03em;
    color: var(--text-secondary);
}

.reports-row__name {
    font-weight: 700;
    color: var(--text-primary);
}

.reports-row__actions {
    display: flex;
    gap: 10px;
}

.view-link {
    font-size: 12px;
    color: var(--primary);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
}

.view-link:hover {
    text-decoration: underline;
}

/* Pills */
.pill {
    font-size: 10.5px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 999px;
    white-space: nowrap;
}

.pill--blood {
    background: #fdeaea;
    color: var(--accent);
}

.pill--type {
    background: #ede7f6;
    color: #5e35b1;
}

.pill--status-sufficient {
    background: #e8f5e9;
    color: var(--success);
}

.pill--status-watch {
    background: #fff3e0;
    color: var(--warning);
}

.pill--status-critical {
    background: #fdeaea;
    color: var(--accent);
}

/* Empty state */
.empty-state {
    color: var(--text-secondary);
    font-size: 13px;
    padding: 20px 0;
    text-align: center;
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

.modal-card--wide {
    max-width: 560px;
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

.preview-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.preview-stat {
    border: 1px solid #eef0f3;
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.preview-stat__value {
    font-size: 20px;
    font-weight: 800;
    color: var(--text-primary);
}

.preview-stat__label {
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.donor-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.donor-row {
    padding: 2px 0;
}

.modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 4px;
}

.modal-error {
    color: var(--accent);
    font-size: 12px;
    margin: 8px 0 0;
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
        grid-template-columns: repeat(2, 1fr);
    }

    .report-generator {
        grid-template-columns: 1fr 1fr;
    }
}

@media (max-width: 640px) {
    .reports-page {
        padding: 16px 16px 32px;
    }

    .header-row {
        flex-direction: column;
        align-items: stretch;
    }

    .header-actions {
        flex-direction: column;
        align-items: stretch;
    }

    .select-wrap {
        width: 100%;
    }

    .breakdown-row,
    .reports-row {
        grid-template-columns: 1fr;
        gap: 4px;
    }

    .report-generator {
        grid-template-columns: 1fr;
    }
}
</style>