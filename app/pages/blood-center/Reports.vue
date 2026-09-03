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
                    <p class="page-subtitle">Monitor blood demand trends, identify potential shortages, and generate operational forecasting reports.</p>
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

            <!-- Global error banner (non blood-type-report errors) -->
            <div v-if="loadError" class="error-banner fade-in" style="--delay: 40ms">
                <AssetIcon name="alert" :size="15" />
                <span>{{ loadError }}</span>
                <button type="button" class="btn-link" @click="loadAll">Retry</button>
            </div>

            <!-- KPI cards -->
            <div class="stats-row fade-in" style="--delay: 60ms">
                <div v-if="loadingStats" v-for="n in 4" :key="'sks-' + n" class="stat-card stat-card--skeleton skeleton-block" />

                <template v-else>
                    <div class="stat-card">
                        <div class="stat-card__icon stat-card__icon--blue">
                            <AssetIcon name="trending-up" :size="18" />
                        </div>
                        <div class="stat-card__body">
                            <p class="stat-card__label">Predicted Demand</p>
                            <p class="stat-card__value">{{ stats.predictedDemand }} units</p>
                            <p class="stat-card__meta">Next {{ horizonFilter }} days</p>
                            <span class="trend-chip" :class="stats.predictedDemandTrend >= 0 ? 'trend-chip--up' : 'trend-chip--down'">
                                <AssetIcon :name="stats.predictedDemandTrend >= 0 ? 'arrow-up' : 'arrow-down'" :size="11" />
                                {{ Math.abs(stats.predictedDemandTrend) }}% vs previous {{ horizonFilter }} days
                            </span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-card__icon stat-card__icon--green">
                            <AssetIcon name="calendar-check" :size="18" />
                        </div>
                        <div class="stat-card__body">
                            <p class="stat-card__label">Inventory Coverage</p>
                            <p class="stat-card__value">{{ stats.coverageDays }} days</p>
                            <p class="stat-card__meta">Based on current usage</p>
                            <span class="trend-chip trend-chip--neutral">Stable</span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-card__icon stat-card__icon--red">
                            <AssetIcon name="alert" :size="18" />
                        </div>
                        <div class="stat-card__body">
                            <p class="stat-card__label">Blood Types At Risk</p>
                            <p class="stat-card__value">{{ stats.criticalTypes }}</p>
                            <p class="stat-card__meta">{{ stats.criticalTypeLabels }}</p>
                            <span class="trend-chip trend-chip--danger">Requires monitoring</span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-card__icon stat-card__icon--orange">
                            <AssetIcon name="check-circle" :size="18" />
                        </div>
                        <div class="stat-card__body">
                            <p class="stat-card__label">Fulfillment Rate</p>
                            <p class="stat-card__value">{{ stats.fulfillmentRate }}%</p>
                            <p class="stat-card__meta">Previous {{ horizonFilter }} days</p>
                            <span class="trend-chip trend-chip--up">
                                <AssetIcon name="arrow-up" :size="11" />
                                {{ stats.fulfillmentRateTrend }}%
                            </span>
                        </div>
                    </div>
                </template>
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

                    <!-- Quick forecast controls -->
                    <div class="quick-controls">
                        <div class="quick-controls__field">
                            <label class="form-label">Blood Type</label>
                            <select v-model="forecastControls.bloodType" class="form-input">
                                <option value="all">All Blood Types</option>
                                <option v-for="bt in bloodTypes" :key="bt" :value="bt">{{ bt }}</option>
                            </select>
                        </div>
                        <div class="quick-controls__field">
                            <label class="form-label">Blood Component</label>
                            <select v-model="forecastControls.component" class="form-input">
                                <option value="all">All Components</option>
                                <option value="whole_blood">Whole Blood</option>
                                <option value="plasma">Plasma</option>
                                <option value="platelets">Platelets</option>
                                <option value="red_cells">Red Cells</option>
                            </select>
                        </div>
                        <div class="quick-controls__field">
                            <label class="form-label">Forecast Period</label>
                            <select v-model="horizonFilter" class="form-input" @change="onFilterChange">
                                <option value="7">Next 7 Days</option>
                                <option value="14">Next 14 Days</option>
                                <option value="30">Next 30 Days</option>
                            </select>
                        </div>
                        <div class="quick-controls__field">
                            <label class="form-label">Facility</label>
                            <select v-model="facilityFilter" class="form-input" @change="onFilterChange">
                                <option value="all">All Facilities</option>
                                <option v-for="f in facilities" :key="f.id" :value="f.id">{{ f.name }}</option>
                            </select>
                        </div>
                        <div class="quick-controls__actions">
                            <button type="button" class="btn-primary" @click="onFilterChange">
                                <AssetIcon name="bar-chart" :size="14" />
                                Generate Forecast
                            </button>
                            <button type="button" class="btn-cancel" @click="resetForecastControls">Reset</button>
                        </div>
                    </div>

                    <div class="forecast-toolbar">
                        <div>
                            <p class="section-label">Stock vs. Predicted Demand by Blood Type</p>
                            <p class="section-sub">Compare current inventory against projected demand for the selected period.</p>
                        </div>
                        <select v-model="bloodTypeFilter" class="form-input filter-select">
                            <option value="all">All Blood Types</option>
                            <option v-for="bt in bloodTypes" :key="bt" :value="bt">{{ bt }}</option>
                        </select>
                    </div>

                    <!-- Bar chart -->
                    <div class="chart-card">
                        <div v-if="loadingForecast" class="chart-skeleton skeleton-block" />
                        <div v-else-if="filteredForecastData.length === 0" class="empty-state">
                            <AssetIcon name="bar-chart" :size="22" />
                            <p class="empty-state__title">No Forecast Available</p>
                            <p class="empty-state__body">Select forecasting parameters and generate a forecast to view projected demand.</p>
                            <button type="button" class="btn-primary" @click="onFilterChange">Generate Forecast</button>
                        </div>
                        <div v-else class="chart-plot">
                            <div class="chart-plot__axis">
                                <span v-for="tick in yAxisTicks" :key="tick">{{ tick }}</span>
                            </div>
                            <div class="chart-plot__grid">
                                <div class="bar-chart">
                                    <div v-for="row in filteredForecastData" :key="row.bloodType" class="bar-group">
                                        <div class="bar-tooltip">
                                            <strong>{{ row.bloodType }}</strong>
                                            <span>Current Stock: {{ row.currentStock }}</span>
                                            <span>Predicted Demand: {{ row.predictedDemand }}</span>
                                            <span>Projected Balance: {{ projectedBalance(row) >= 0 ? '+' : '' }}{{ projectedBalance(row) }}</span>
                                            <span>Risk: {{ row.status }}</span>
                                        </div>
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

                    <!-- Emergency demand analysis -->
                    <p class="section-label">Emergency Demand Analysis</p>
                    <p class="section-sub">Monitor emergency request spikes and blood types approaching critical shortage levels.</p>

                    <div class="alert-list">
                        <div v-if="loadingAlerts" v-for="n in 3" :key="'ska-' + n"
                            class="alert-card alert-card--skeleton skeleton-block" />
                        <p v-else-if="emergencyAlerts.length === 0" class="empty-state empty-state--inline">
                            No critical shortages projected for the selected period.
                        </p>
                        <template v-else>
                            <div v-for="alert in emergencyAlerts" :key="alert.id" class="alert-card"
                                :class="'alert-card--' + alert.severity">
                                <div class="alert-card__icon">
                                    <AssetIcon name="alert" :size="16" />
                                </div>
                                <svg class="alert-card__sparkline" viewBox="0 0 100 28" preserveAspectRatio="none">
                                    <polyline :points="sparklinePoints(alert.trend30d)" />
                                </svg>
                                <div class="alert-card__body">
                                    <p class="alert-card__title">
                                        <span class="pill pill--blood">{{ alert.bloodType }}</span>
                                        {{ alert.emergencyRequests }} emergency requests
                                        <span class="pill" :class="'pill--severity-' + alert.severity">{{ alert.severityLabel }}</span>
                                    </p>
                                    <p class="alert-card__meta">
                                        <span v-if="alert.changePct !== null" :class="alert.changePct >= 0 ? 'change--up' : 'change--down'">
                                            <AssetIcon :name="alert.changePct >= 0 ? 'arrow-up' : 'arrow-down'" :size="10" />
                                            {{ Math.abs(alert.changePct) }}% vs previous period
                                        </span>
                                        <span v-else>Stable</span>
                                    </p>
                                </div>
                            </div>
                        </template>
                    </div>

                    <div v-if="!loadingAlerts && emergencyAlerts.length > 0" class="alert-footer">
                        <span>{{ criticalAlertCount }} blood type{{ criticalAlertCount === 1 ? '' : 's' }} require attention.</span>
                        <button type="button" class="btn-outline-blue" @click="viewInventory">View Inventory</button>
                    </div>

                    <!-- Breakdown table -->
                    <p class="section-label">Blood Type Breakdown</p>
                    <div class="breakdown-table">
                        <div class="breakdown-row breakdown-row--head">
                            <span class="sortable" @click="toggleSort('bloodType')">Blood Type <AssetIcon v-if="sortKey==='bloodType'" :name="sortAsc ? 'arrow-up' : 'arrow-down'" :size="10" /></span>
                            <span class="sortable" @click="toggleSort('currentStock')">Current Stock <AssetIcon v-if="sortKey==='currentStock'" :name="sortAsc ? 'arrow-up' : 'arrow-down'" :size="10" /></span>
                            <span>Avg. Daily Usage</span>
                            <span>{{ horizonFilter }}-Day Forecast</span>
                            <span class="sortable" @click="toggleSort('balance')">Projected Balance <AssetIcon v-if="sortKey==='balance'" :name="sortAsc ? 'arrow-up' : 'arrow-down'" :size="10" /></span>
                            <span>Status</span>
                        </div>
                        <div v-if="loadingForecast" v-for="n in 4" :key="'skb-' + n"
                            class="breakdown-row skeleton-block" />
                        <p v-else-if="sortedForecastData.length === 0" class="empty-state empty-state--inline">
                            No forecast data for the selected filters.
                        </p>
                        <div v-else v-for="row in sortedForecastData" :key="'row-' + row.bloodType"
                            class="breakdown-row">
                            <span><span class="pill pill--blood">{{ row.bloodType }}</span></span>
                            <span>{{ row.currentStock }} units</span>
                            <span>{{ row.avgDailyUsage }} units/day</span>
                            <span>{{ row.predictedDemand }} units</span>
                            <span :class="{ 'balance--negative': projectedBalance(row) < 0 }">
                                {{ projectedBalance(row) >= 0 ? '+' : '' }}{{ projectedBalance(row) }} units
                            </span>
                            <span><span class="pill" :class="'pill--status-' + row.status.toLowerCase()">{{
                                row.status }}</span></span>
                        </div>
                    </div>

                    <!-- Forecast insights -->
                    <p class="section-label">Forecast Insights</p>
                    <div class="insights-panel">
                        <div v-if="loadingForecast" class="insight-row skeleton-block" />
                        <template v-else>
                            <div v-for="insight in forecastInsights" :key="insight.id" class="insight-row" :class="'insight-row--' + insight.level">
                                <AssetIcon :name="insight.icon" :size="16" class="insight-row__icon" />
                                <p class="insight-row__msg">{{ insight.message }}</p>
                                <button v-if="insight.action" type="button" class="btn-link" @click="viewInventory">{{ insight.action }}</button>
                            </div>
                        </template>
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
                                <option value="demand_forecast">Blood Demand Forecast Report</option>
                                <option value="inventory_forecast">Inventory Forecast Report</option>
                                <option value="emergency_demand">Emergency Demand Report</option>
                                <option value="blood_type_demand">Blood Type Demand Report</option>
                                <option value="forecasting_summary">Forecasting Summary Report</option>
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
                        <div class="report-generator__actions">
                            <button type="button" class="btn-primary" :disabled="!canGenerateReport" @click="openGenerateModal">
                                <AssetIcon name="bar-chart" :size="15" />
                                Generate Report
                            </button>
                            <button type="button" class="btn-cancel" @click="resetReportForm">Reset</button>
                        </div>
                    </div>

                    <!-- Weekly trend chart -->
                    <div class="chart-header-row">
                        <p class="section-label">Weekly Request Volume</p>
                        <div class="chart-header-row__stats" v-if="!loadingTrend && trendData.length">
                            <span><strong>{{ totalRequests }}</strong> Total Requests</span>
                            <span><strong>{{ averageWeeklyRequests }}</strong> Avg. Weekly Requests</span>
                        </div>
                    </div>
                    <div class="chart-card">
                        <div v-if="loadingTrend" class="chart-skeleton skeleton-block" />
                        <svg v-else viewBox="0 0 640 220" class="trend-chart" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="var(--rf-primary)" stop-opacity="0.22" />
                                    <stop offset="100%" stop-color="var(--rf-primary)" stop-opacity="0" />
                                </linearGradient>
                            </defs>
                            <path :d="trendAreaPath" class="trend-area" />
                            <path :d="trendLinePath" class="trend-line" />
                            <g v-for="(pt, i) in trendPointCoords" :key="'pt-' + i" class="trend-point">
                                <circle :cx="pt.x" :cy="pt.y" r="9" class="trend-dot__halo" />
                                <circle :cx="pt.x" :cy="pt.y" r="4" class="trend-dot" />
                                <text :x="pt.x" :y="pt.y - 14" class="trend-dot__value" text-anchor="middle">{{ trendData[i].requests }}</text>
                            </g>
                        </svg>
                        <div class="trend-labels">
                            <span v-for="week in trendData" :key="week.weekLabel">{{ week.weekLabel }}</span>
                        </div>
                    </div>

                    <!-- Recent reports -->
                    <p class="section-label">Recent Reports</p>

                    <div v-if="recentReportsError" class="error-banner error-banner--inline">
                        <AssetIcon name="alert" :size="15" />
                        <div>
                            <p class="error-banner__title">Unable to load recent reports.</p>
                            <p class="error-banner__body">We couldn't retrieve the latest forecasting reports. Please try again.</p>
                        </div>
                        <button type="button" class="btn-link" @click="loadRecentReports">Retry</button>
                    </div>

                    <div v-else class="reports-table">
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
                        <p v-else-if="recentReports.length === 0" class="empty-state empty-state--inline">
                            No reports generated yet.
                            <button type="button" class="btn-outline-blue" @click="openGenerateModal">Generate Report</button>
                        </p>
                        <div v-else v-for="report in recentReports" :key="report.id" class="reports-row">
                            <span class="reports-row__name">{{ report.name }}</span>
                            <span><span class="pill pill--type">{{ reportTypeLabel(report.type) }}</span></span>
                            <span>{{ report.dateRangeLabel }}</span>
                            <span>{{ report.generatedBy }}</span>
                            <span>{{ report.generatedAt }}</span>
                            <span class="reports-row__actions">
                                <button type="button" class="view-link" @click="openReportPreview(report)">View</button>
                                <button type="button" class="view-link" @click="handleExport(report, 'pdf')">Download</button>
                            </span>
                        </div>
                    </div>
                </section>
            </div>
        </div>

        <!-- GENERATE REPORT MODAL -->
        <Transition name="modal">
            <div v-if="showGenerateModal" class="modal-overlay" @click.self="closeGenerateModal">
                <div class="modal-card">
                    <div class="modal-card__header">
                        <h2 class="modal-card__title">Generate Forecasting Report</h2>
                        <button type="button" class="modal-card__close" @click="closeGenerateModal">
                            <AssetIcon name="x" :size="18" />
                        </button>
                    </div>
                    <div class="modal-form">
                        <div class="form-group">
                            <label class="form-label">Report Type</label>
                            <select v-model="reportForm.type" class="form-input">
                                <option value="request_trend">Request Trend Report</option>
                                <option value="demand_forecast">Blood Demand Forecast Report</option>
                                <option value="inventory_forecast">Inventory Forecast Report</option>
                                <option value="emergency_demand">Emergency Demand Report</option>
                                <option value="blood_type_demand">Blood Type Demand Report</option>
                                <option value="forecasting_summary">Forecasting Summary Report</option>
                            </select>
                        </div>
                        <div class="form-group form-group--row">
                            <div>
                                <label class="form-label">From</label>
                                <input v-model="reportForm.dateFrom" type="date" class="form-input" />
                            </div>
                            <div>
                                <label class="form-label">To</label>
                                <input v-model="reportForm.dateTo" type="date" class="form-input" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Blood Type</label>
                            <select v-model="reportForm.bloodType" class="form-input">
                                <option value="all">All Blood Types</option>
                                <option v-for="bt in bloodTypes" :key="bt" :value="bt">{{ bt }}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Facility</label>
                            <select v-model="facilityFilter" class="form-input">
                                <option value="all">All Facilities</option>
                                <option v-for="f in facilities" :key="f.id" :value="f.id">{{ f.name }}</option>
                            </select>
                        </div>

                        <p v-if="generateError" class="modal-error">{{ generateError }}</p>

                        <div class="modal-actions">
                            <button type="button" class="btn-cancel" @click="closeGenerateModal">Cancel</button>
                            <button type="button" class="btn-primary" :disabled="generatingReport" @click="handleGenerateReport">
                                {{ generatingReport ? 'Generating...' : 'Generate Report' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

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

        <!-- TOAST -->
        <Transition name="toast">
            <div v-if="toastMessage" class="toast">
                <AssetIcon name="check-circle" :size="16" />
                {{ toastMessage }}
            </div>
        </Transition>
    </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'

definePageMeta({
    middleware: ['auth', 'department'],
    layout: 'blood-centerdashboard',
  requires: 'reports.view_own',
})

/**
 * MOCK DATA TOGGLE
 * -------------------------------------------------------------------------
 * Same pattern used in HospitalBloodRequests: flip to false once the
 * backend endpoints below are live. Every load function branches on this
 * flag, so the real $fetch calls stay in place (not deleted) for the
 * backend teammate to wire up.
 * -------------------------------------------------------------------------
 */
// Gikan na sa runtimeConfig imbes hardcoded `true`, aron makita sa usa ka
// lugar kung unsa ang mock ug ma-flip nga walay edit sa code.
// Walay `/api/bloodcenter/reports/*` nga route ang Laravel — tan-awa ang
// endpoint matrix. Magpabilin ni nga true hangtod matuman ang Phase P.
const USE_MOCK_DATA = useRuntimeConfig().public.useMocks

/**
 * NOTE ON API SHAPE
 * -------------------------------------------------------------------------
 *  GET  /api/bloodcenter/reports/stats?facility=&horizon=
 *    -> { predictedDemand, predictedDemandTrend, coverageDays, criticalTypes,
 *         criticalTypeLabels, fulfillmentRate, fulfillmentRateTrend }
 *
 *  GET  /api/bloodcenter/reports/demand-forecast?facility=&horizon=&bloodType=&component=
 *    -> [{ bloodType, currentStock, avgDailyUsage, predictedDemand, status }]
 *      status: 'Healthy' | 'Low' | 'Critical'
 *
 *  GET  /api/bloodcenter/reports/emergency-alerts?facility=&horizon=
 *    -> [{ id, bloodType, severity, severityLabel, emergencyRequests, changePct, trend30d, facilityName }]
 *      severity: 'critical' | 'high' | 'moderate'
 *
 *  GET  /api/bloodcenter/reports/request-trend?facility=
 *    -> [{ weekLabel, requests }]
 *
 *  GET  /api/bloodcenter/reports/recent
 *    -> [{ id, name, type, dateRangeLabel, generatedBy, generatedAt }]
 *
 *  GET  /api/bloodcenter/facilities
 *    -> [{ id, name }]
 *
 *  POST /api/bloodcenter/reports/generate  { type, dateFrom, dateTo, bloodType, facility }
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

/**
 * MOCK DATA
 * -------------------------------------------------------------------------
 */
const MOCK_STATS = {
    predictedDemand: 184,
    predictedDemandTrend: 12.4,
    coverageDays: 18,
    criticalTypes: 2,
    criticalTypeLabels: 'B− and O−',
    fulfillmentRate: 94.8,
    fulfillmentRateTrend: 3.2,
}

const MOCK_FACILITIES = [
    { id: 'fac-1', name: 'RedAgos Central Blood Center' },
    { id: 'fac-2', name: 'St. Luke\'s Partner Facility' },
    { id: 'fac-3', name: 'Mercy General Hospital' },
]

// Projected Balance = Current Stock − Forecast Demand (derived, not hardcoded)
// Status derived from balance: negative -> Critical, within 3 units -> Low, else Healthy
const MOCK_FORECAST_DATA = [
    { bloodType: 'A+', currentStock: 98, avgDailyUsage: 11.7, predictedDemand: 82 },
    { bloodType: 'A−', currentStock: 18, avgDailyUsage: 2.8, predictedDemand: 20 },
    { bloodType: 'B+', currentStock: 73, avgDailyUsage: 9.1, predictedDemand: 64 },
    { bloodType: 'B−', currentStock: 9, avgDailyUsage: 2.3, predictedDemand: 16 },
    { bloodType: 'AB+', currentStock: 35, avgDailyUsage: 4.0, predictedDemand: 28 },
    { bloodType: 'AB−', currentStock: 6, avgDailyUsage: 1.0, predictedDemand: 8 },
    { bloodType: 'O+', currentStock: 152, avgDailyUsage: 18.7, predictedDemand: 131 },
    { bloodType: 'O−', currentStock: 26, avgDailyUsage: 4.9, predictedDemand: 34 },
].map((row) => {
    const balance = row.currentStock - row.predictedDemand
    const status = balance < 0 ? 'Critical' : balance <= 3 ? 'Low' : 'Healthy'
    return { ...row, status }
})

const MOCK_EMERGENCY_ALERTS = [
    { id: 'ea-1', bloodType: 'O−', emergencyRequests: 8, changePct: 28, severity: 'critical', severityLabel: 'Critical', trend30d: [2, 3, 2, 4, 5, 4, 6, 5, 7, 6, 8] },
    { id: 'ea-2', bloodType: 'B−', emergencyRequests: 5, changePct: 17, severity: 'high', severityLabel: 'High', trend30d: [1, 2, 2, 3, 2, 3, 4, 3, 4, 4, 5] },
    { id: 'ea-3', bloodType: 'A−', emergencyRequests: 3, changePct: null, severity: 'moderate', severityLabel: 'Moderate', trend30d: [3, 2, 3, 3, 2, 3, 3, 2, 3, 3, 3] },
]

const MOCK_TREND_DATA = [
    { weekLabel: 'Week 1', requests: 42 },
    { weekLabel: 'Week 2', requests: 48 },
    { weekLabel: 'Week 3', requests: 45 },
    { weekLabel: 'Week 4', requests: 57 },
    { weekLabel: 'Week 5', requests: 63 },
    { weekLabel: 'Week 6', requests: 59 },
    { weekLabel: 'Week 7', requests: 68 },
]

const MOCK_RECENT_REPORTS = [
    { id: 'rep-1', name: 'August Demand Forecast', type: 'demand_forecast', dateRangeLabel: 'Aug 1–9, 2026', generatedBy: 'Maria Santos', generatedAt: 'Aug 9, 2026 · 6:42 AM' },
    { id: 'rep-2', name: 'July Request Trends', type: 'request_trend', dateRangeLabel: 'Jul 1–31, 2026', generatedBy: 'Juan Dela Cruz', generatedAt: 'Aug 1, 2026 · 8:15 AM' },
    { id: 'rep-3', name: 'Emergency Demand Analysis', type: 'emergency_demand', dateRangeLabel: 'Jul 1–31, 2026', generatedBy: 'Ana Reyes', generatedAt: 'Aug 1, 2026 · 7:50 AM' },
]

function mockDelay(ms = 400) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const initialLoading = ref(true)
const activeTab = ref('forecast')
const loadError = ref('')
const recentReportsError = ref(false)

const facilityFilter = ref('all')
const facilities = ref([]) // [{ id, name }]
const horizonFilter = ref('7')
const bloodTypeFilter = ref('all')
const bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

const forecastControls = reactive({ bloodType: 'all', component: 'all' })

const stats = reactive({
    predictedDemand: 0,
    predictedDemandTrend: 0,
    coverageDays: 0,
    criticalTypes: 0,
    criticalTypeLabels: '',
    fulfillmentRate: 0,
    fulfillmentRateTrend: 0,
})
const loadingStats = ref(false)

const forecastData = ref([])
const loadingForecast = ref(false)

const emergencyAlerts = ref([])
const loadingAlerts = ref(false)

const trendData = ref([])
const loadingTrend = ref(false)

const recentReports = ref([])
const loadingRecentReports = ref(false)

const reportForm = reactive({ type: 'request_trend', dateFrom: '', dateTo: '', bloodType: 'all' })
const generatingReport = ref(false)
const generateError = ref('')
const showGenerateModal = ref(false)
const toastMessage = ref('')
let toastTimer = null

const canGenerateReport = computed(() => Boolean(reportForm.dateFrom) && Boolean(reportForm.dateTo))

const showReportModal = ref(false)
const loadingReportPreview = ref(false)
const selectedReport = ref(null)
const reportPreviewData = ref(null)

const sortKey = ref('bloodType')
const sortAsc = ref(true)

const CHART_MAX_BAR_HEIGHT = 150

function projectedBalance(row) {
    return row.currentStock - row.predictedDemand
}

const filteredForecastData = computed(() => {
    if (bloodTypeFilter.value === 'all') return forecastData.value
    return forecastData.value.filter((r) => r.bloodType === bloodTypeFilter.value)
})

const sortedForecastData = computed(() => {
    const rows = [...filteredForecastData.value]
    rows.sort((a, b) => {
        let av, bv
        if (sortKey.value === 'balance') {
            av = projectedBalance(a)
            bv = projectedBalance(b)
        } else {
            av = a[sortKey.value]
            bv = b[sortKey.value]
        }
        if (typeof av === 'string') return sortAsc.value ? av.localeCompare(bv) : bv.localeCompare(av)
        return sortAsc.value ? av - bv : bv - av
    })
    return rows
})

function toggleSort(key) {
    if (sortKey.value === key) {
        sortAsc.value = !sortAsc.value
    } else {
        sortKey.value = key
        sortAsc.value = true
    }
}

const maxForecastValue = computed(() => {
    const values = forecastData.value.flatMap((r) => [r.currentStock, r.predictedDemand])
    return Math.max(...values, 1)
})

// Round the scale up to a clean step (nearest 20) so the axis reads like a
// real chart (0/40/80/120/160) instead of an arbitrary data-driven max.
const AXIS_STEPS = 4
const niceAxisMax = computed(() => {
    const step = 20
    return Math.max(step, Math.ceil(maxForecastValue.value / step) * step)
})

const yAxisTicks = computed(() => {
    const ticks = []
    for (let i = AXIS_STEPS; i >= 0; i--) {
        ticks.push(Math.round((niceAxisMax.value / AXIS_STEPS) * i))
    }
    return ticks
})

function barHeight(value) {
    return Math.max(4, Math.round((value / niceAxisMax.value) * CHART_MAX_BAR_HEIGHT))
}

function sparklinePoints(series) {
    const max = Math.max(...series, 1)
    const step = 100 / (series.length - 1)
    return series.map((v, i) => `${(i * step).toFixed(1)},${(28 - (v / max) * 24).toFixed(1)}`).join(' ')
}

const criticalAlertCount = computed(
    () => emergencyAlerts.value.filter((a) => a.severity === 'critical' || a.severity === 'high').length,
)

const forecastInsights = computed(() => {
    const insights = []
    const critical = forecastData.value.find((r) => r.status === 'Critical')
    if (critical) {
        insights.push({
            id: 'insight-critical',
            level: 'critical',
            icon: 'alert',
            message: `${critical.bloodType} inventory may fall below projected demand within the selected forecast period.`,
            action: 'View Inventory',
        })
    }
    const trending = forecastData.value.find((r) => r.status === 'Low' && r.bloodType !== critical?.bloodType)
    if (trending) {
        insights.push({
            id: 'insight-warning',
            level: 'warning',
            icon: 'trending-up',
            message: `${trending.bloodType} demand is trending upward and may require closer inventory monitoring.`,
            action: 'View Inventory',
        })
    }
    const healthy = forecastData.value.filter((r) => r.status === 'Healthy').map((r) => r.bloodType)
    if (healthy.length) {
        insights.push({
            id: 'insight-healthy',
            level: 'healthy',
            icon: 'check-circle',
            message: `${healthy.slice(0, 2).join(' and ')} inventory ${healthy.length > 1 ? 'are' : 'is'} currently sufficient for projected demand.`,
            action: null,
        })
    }
    return insights
})

const maxTrendValue = computed(() => Math.max(...trendData.value.map((w) => w.requests), 1))
const totalRequests = computed(() => trendData.value.reduce((sum, w) => sum + w.requests, 0))
const averageWeeklyRequests = computed(() =>
    trendData.value.length ? Math.round(totalRequests.value / trendData.value.length) : 0,
)

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

// Catmull-Rom -> cubic Bezier smoothing, same signature used in the donor
// Dashboard.vue line chart, so both charts feel like one design language.
function smoothPath(points) {
    if (points.length < 2) return ''
    if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`
    let d = `M ${points[0].x},${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] || points[i]
        const p1 = points[i]
        const p2 = points[i + 1]
        const p3 = points[i + 2] || p2
        const c1x = p1.x + (p2.x - p0.x) / 6
        const c1y = p1.y + (p2.y - p0.y) / 6
        const c2x = p2.x - (p3.x - p1.x) / 6
        const c2y = p2.y - (p3.y - p1.y) / 6
        d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
    }
    return d
}

const trendLinePath = computed(() => smoothPath(trendPointCoords.value))
const trendAreaPath = computed(() => {
    const coords = trendPointCoords.value
    if (coords.length === 0) return ''
    const first = coords[0]
    const last = coords[coords.length - 1]
    return `${smoothPath(coords)} L ${last.x},200 L ${first.x},200 Z`
})

function reportTypeLabel(type) {
    const map = {
        request_trend: 'Request Trend',
        demand_forecast: 'Demand Forecast',
        inventory_forecast: 'Inventory Forecast',
        emergency_demand: 'Emergency Demand',
        blood_type_demand: 'Blood Type Demand',
        forecasting_summary: 'Forecasting Summary',
    }
    return map[type] || type
}

function showToast(message) {
    toastMessage.value = message
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toastMessage.value = ''), 3200)
}

async function loadFacilities() {
    try {
        if (USE_MOCK_DATA) {
            facilities.value = MOCK_FACILITIES
        } else {
            facilities.value = await api.getFacilities()
        }
    } catch (err) {
        console.error(err)
    }
}

async function loadStats() {
    loadingStats.value = true
    try {
        if (USE_MOCK_DATA) {
            await mockDelay()
            Object.assign(stats, MOCK_STATS)
        } else {
            const data = await api.getStats({ facility: facilityFilter.value, horizon: horizonFilter.value })
            Object.assign(stats, data)
        }
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
        if (USE_MOCK_DATA) {
            await mockDelay()
            forecastData.value = MOCK_FORECAST_DATA
        } else {
            forecastData.value = await api.getDemandForecast({
                facility: facilityFilter.value,
                horizon: horizonFilter.value,
                bloodType: forecastControls.bloodType,
                component: forecastControls.component,
            })
        }
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
        if (USE_MOCK_DATA) {
            await mockDelay()
            emergencyAlerts.value = MOCK_EMERGENCY_ALERTS
        } else {
            emergencyAlerts.value = await api.getEmergencyAlerts({ facility: facilityFilter.value, horizon: horizonFilter.value })
        }
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
        if (USE_MOCK_DATA) {
            await mockDelay()
            trendData.value = MOCK_TREND_DATA
        } else {
            trendData.value = await api.getRequestTrend({ facility: facilityFilter.value })
        }
    } catch (err) {
        loadError.value = 'Could not load request trend data.'
        console.error(err)
    } finally {
        loadingTrend.value = false
    }
}

async function loadRecentReports() {
    loadingRecentReports.value = true
    recentReportsError.value = false
    try {
        if (USE_MOCK_DATA) {
            await mockDelay()
            recentReports.value = MOCK_RECENT_REPORTS
        } else {
            recentReports.value = await api.getRecentReports()
        }
    } catch (err) {
        recentReportsError.value = true
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

function resetForecastControls() {
    forecastControls.bloodType = 'all'
    forecastControls.component = 'all'
    horizonFilter.value = '7'
    facilityFilter.value = 'all'
    onFilterChange()
}

function resetReportForm() {
    reportForm.type = 'request_trend'
    reportForm.dateFrom = ''
    reportForm.dateTo = ''
    reportForm.bloodType = 'all'
}

function viewInventory() {
    // Hook up to the Inventory module route as needed.
    navigateTo('/blood-center/inventory')
}

function openGenerateModal() {
    if (!canGenerateReport.value) {
        generateError.value = 'Please select a date range.'
        return
    }
    generateError.value = ''
    showGenerateModal.value = true
}

function closeGenerateModal() {
    showGenerateModal.value = false
    generateError.value = ''
}

async function handleGenerateReport() {
    if (!canGenerateReport.value) {
        generateError.value = 'Please select a date range.'
        return
    }
    generatingReport.value = true
    generateError.value = ''
    try {
        let newReport
        if (USE_MOCK_DATA) {
            await mockDelay(600)
            newReport = {
                id: `rep-${Date.now()}`,
                name: `${reportTypeLabel(reportForm.type)} Report`,
                type: reportForm.type,
                dateRangeLabel: `${reportForm.dateFrom} – ${reportForm.dateTo}`,
                generatedBy: 'You',
                generatedAt: 'Just now',
            }
        } else {
            newReport = await api.generateReport({
                type: reportForm.type,
                dateFrom: reportForm.dateFrom,
                dateTo: reportForm.dateTo,
                bloodType: reportForm.bloodType,
                facility: facilityFilter.value,
            })
        }
        recentReports.value = [newReport, ...recentReports.value]
        showGenerateModal.value = false
        showToast('Report generated successfully.')
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
        if (USE_MOCK_DATA) {
            await mockDelay()
            reportPreviewData.value = {
                summary: `Summary of ${report.name.toLowerCase()} covering ${report.dateRangeLabel}.`,
                stats: [
                    { label: 'Total Requests', value: '312' },
                    { label: 'Fulfilled', value: '296' },
                    { label: 'Emergency Requests', value: '16' },
                    { label: 'Avg. Fulfillment Time', value: '2.4 hrs' },
                ],
            }
        } else {
            reportPreviewData.value = await api.getReportPreview(report.id)
        }
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
        if (USE_MOCK_DATA) {
            showToast(`${report.name} exported as ${format.toUpperCase()}.`)
            return
        }
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
/* -------------------------------------------------------------------------
   Design tokens live at :global(:root) / :global(.dark), same convention
   established in dashboard.vue, so teleported elements (modals, toasts)
   inherit them correctly instead of only the .reports-page scope.
   ------------------------------------------------------------------------- */
:global(:root) {
    --rf-bg: #f7f9fc;
    --rf-card: #ffffff;
    --rf-border: #e5eaf0;
    --rf-text: #1e293b;
    --rf-text-secondary: #64748b;
    --rf-primary: #1565c0;
    --rf-primary-hover: #0d47a1;
    --rf-primary-soft: #e3f2fd;
    --rf-success: #2e7d32;
    --rf-success-soft: #e8f5e9;
    --rf-warning: #f59e0b;
    --rf-warning-soft: #fff3e0;
    --rf-danger: #d32f2f;
    --rf-danger-soft: #fdeaea;
    --rf-purple: #7c3aed;
    --rf-purple-soft: #ede7f6;
    --rf-teal: #0f766e;
    --rf-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
    --rf-skeleton-a: #eceff3;
    --rf-skeleton-b: #f5f7fb;
}

:global(.dark) {
    --rf-bg: #0f172a;
    --rf-card: #1a2437;
    --rf-border: #2a3650;
    --rf-text: #e5eaf0;
    --rf-text-secondary: #94a3b8;
    --rf-primary: #4f9cf9;
    --rf-primary-hover: #7ab8ff;
    --rf-primary-soft: rgba(79, 156, 249, 0.14);
    --rf-success: #4ade80;
    --rf-success-soft: rgba(74, 222, 128, 0.12);
    --rf-warning: #fbbf24;
    --rf-warning-soft: rgba(251, 191, 36, 0.12);
    --rf-danger: #f87171;
    --rf-danger-soft: rgba(248, 113, 113, 0.12);
    --rf-purple: #a78bfa;
    --rf-purple-soft: rgba(167, 139, 250, 0.12);
    --rf-teal: #2dd4bf;
    --rf-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
    --rf-skeleton-a: #202c45;
    --rf-skeleton-b: #263252;
}

.reports-page {
    max-width: 1152px;
    background: var(--rf-bg);
    margin: 0 auto;
    padding: 28px 36px 48px;
    font-family: var(--rb-font-sans);
    color: var(--rf-text);
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
    border: 4px solid var(--rf-border);
    border-top-color: var(--rf-primary);
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.fade-in {
    animation: fadeInUp 0.5s ease both;
    animation-delay: var(--delay, 0ms);
}

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
    .fade-in, .spinner { animation: none !important; }
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
    color: var(--rf-text);
}

.page-subtitle {
    font-size: 13px;
    color: var(--rf-text-secondary);
    margin: 4px 0 0;
    max-width: 520px;
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
    border: 1px solid var(--rf-border);
    border-radius: 10px;
    background: var(--rf-card);
    cursor: pointer;
    font-size: 13px;
    color: var(--rf-text);
}

.filter-select-input:focus {
    outline: none;
    border-color: var(--rf-primary);
    box-shadow: 0 0 0 2px var(--rf-primary-soft);
}

.select-wrap__icon {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--rf-text-secondary);
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
    background: var(--rf-primary);
    border: none;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(21, 101, 192, 0.15);
    transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    white-space: nowrap;
}

.btn-primary:hover:not(:disabled) {
    background: var(--rf-primary-hover);
    box-shadow: 0 6px 16px rgba(21, 101, 192, 0.25);
    transform: translateY(-1px);
}

.btn-primary:active:not(:disabled) { transform: translateY(0); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

.btn-outline-blue {
    padding: 8px 14px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
    background: var(--rf-primary-soft);
    color: var(--rf-primary);
    border: none;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.15s ease;
}

.btn-outline-blue:hover { opacity: 0.85; }

.btn-link {
    background: none;
    border: none;
    color: var(--rf-primary);
    text-decoration: underline;
    cursor: pointer;
    font-size: 13px;
}

.btn-cancel {
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    background: var(--rf-border);
    color: var(--rf-text);
    border: none;
    cursor: pointer;
    transition: opacity 0.15s ease;
}

.btn-cancel:hover { opacity: 0.85; }

.error-banner {
    background: var(--rf-danger-soft);
    color: var(--rf-danger);
    border: 1px solid var(--rf-danger);
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.error-banner--inline {
    align-items: flex-start;
    margin-bottom: 12px;
}

.error-banner__title {
    font-weight: 700;
    margin: 0;
}

.error-banner__body {
    margin: 2px 0 0;
    font-size: 12.5px;
    opacity: 0.9;
}

/* Stat cards */
.stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
}

.stat-card {
    position: relative;
    background: var(--rf-card);
    border-radius: 18px;
    border: 1px solid var(--rf-border);
    box-shadow: var(--rf-shadow);
    padding: 20px 22px;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    overflow: hidden;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.stat-card--skeleton { min-height: 96px; border: none; box-shadow: none; }

.stat-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.09);
}

.stat-card__icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.stat-card__icon--blue { background: var(--rf-primary-soft); color: var(--rf-primary); }
.stat-card__icon--orange { background: var(--rf-warning-soft); color: var(--rf-warning); }
.stat-card__icon--green { background: var(--rf-success-soft); color: var(--rf-success); }
.stat-card__icon--red { background: var(--rf-danger-soft); color: var(--rf-danger); }

.stat-card__body { min-width: 0; }

.stat-card__label {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--rf-text-secondary);
    margin: 0;
}

.stat-card__value {
    font-size: 24px;
    font-weight: 800;
    margin: 4px 0 0;
    color: var(--rf-text);
    line-height: 1.1;
}

.stat-card__meta {
    font-size: 11.5px;
    color: var(--rf-text-secondary);
    margin: 3px 0 0;
}

.trend-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10.5px;
    font-weight: 700;
    margin-top: 6px;
    padding: 2px 8px;
    border-radius: 999px;
}

.trend-chip--up { color: var(--rf-success); background: var(--rf-success-soft); }
.trend-chip--down { color: var(--rf-danger); background: var(--rf-danger-soft); }
.trend-chip--danger { color: var(--rf-danger); background: var(--rf-danger-soft); }
.trend-chip--neutral { color: var(--rf-text-secondary); background: var(--rf-border); }

/* Panel */
.panel {
    background: var(--rf-card);
    border-radius: 18px;
    border: 1px solid var(--rf-border);
    padding: 8px 0;
    box-shadow: var(--rf-shadow);
    overflow: hidden;
}

.tabs {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding: 16px 32px;
    border-bottom: 1px solid var(--rf-border);
}

.tab {
    background: none;
    border: none;
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 700;
    color: var(--rf-text-secondary);
    cursor: pointer;
    border-radius: 999px;
    transition: color 0.15s ease, background 0.15s ease;
}

.tab:hover { color: var(--rf-text); background: var(--rf-bg); }

.tab--active {
    color: #fff;
    background: var(--rf-primary);
}

.tab--active:hover { color: #fff; background: var(--rf-primary-hover); }

.tab-content { padding: 28px; }

.section-label {
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--rf-text);
    margin: 28px 0 4px;
    padding-left: 10px;
    border-left: 3px solid var(--rf-primary);
}

.section-label:first-child { margin-top: 0; }

.section-sub {
    font-size: 12.5px;
    color: var(--rf-text-secondary);
    margin: 0 0 12px;
    padding-left: 13px;
}

/* Quick forecast controls */
.quick-controls {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
    padding: 16px;
    border: 1px solid var(--rf-border);
    border-radius: 14px;
    background: var(--rf-bg);
    margin-bottom: 24px;
}

.quick-controls__field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 140px;
}

.quick-controls__actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
}

/* Forecast toolbar */
.forecast-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}

.forecast-toolbar .section-label { margin: 0; }

.form-input {
    border: 1px solid var(--rf-border);
    border-radius: 10px;
    padding: 9px 12px;
    font-size: 13px;
    color: var(--rf-text);
    background: var(--rf-card);
    font-family: inherit;
    transition: border-color 0.15s ease;
}

.form-input:focus {
    outline: none;
    border-color: var(--rf-primary);
}

.filter-select { cursor: pointer; width: 180px; }

/* Chart card */
.chart-card {
    border: 1px solid var(--rf-border);
    border-radius: 14px;
    padding: 20px 20px 12px;
    background: var(--rf-bg);
}

.chart-skeleton { height: 200px; }

.chart-header-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
}

.chart-header-row .section-label { margin: 24px 0 0; }

.chart-header-row__stats {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--rf-text-secondary);
}

.chart-header-row__stats strong { color: var(--rf-text); }

/* Bar chart */
.chart-plot {
    display: flex;
    gap: 10px;
}

.chart-plot__axis {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 150px;
    text-align: right;
    flex-shrink: 0;
}

.chart-plot__axis span {
    font-size: 10px;
    font-weight: 600;
    color: var(--rf-text-secondary);
    transform: translateY(-50%);
}

.chart-plot__axis span:first-child { transform: translateY(0); }
.chart-plot__axis span:last-child { transform: translateY(-100%); }

.chart-plot__grid {
    flex: 1;
    min-width: 0;
    background-image: repeating-linear-gradient(
        to bottom,
        var(--rf-border) 0,
        var(--rf-border) 1px,
        transparent 1px,
        transparent 37.5px
    );
    background-size: 100% 150px;
    background-repeat: no-repeat;
    background-position: top;
    border-bottom: 1px solid var(--rf-border);
}

.bar-chart {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    height: 150px;
    padding: 0 4px;
}

.bar-group {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex: 1;
}

.bar-tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) translateY(4px);
    background: var(--rf-text);
    color: var(--rf-card);
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 10.5px;
    line-height: 1.5;
    white-space: nowrap;
    display: flex;
    flex-direction: column;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease, transform 0.15s ease;
    z-index: 5;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

.bar-group:hover .bar-tooltip {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
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
    width: 22px;
    position: relative;
}

.bar-value {
    font-size: 9.5px;
    font-weight: 700;
    color: var(--rf-text-secondary);
    margin-bottom: 4px;
    white-space: nowrap;
}

.bar {
    width: 100%;
    border-radius: 5px 5px 2px 2px;
    transition: height 0.4s ease, opacity 0.15s ease;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.bar-group:hover .bar { opacity: 0.85; }

.bar--stock { background: linear-gradient(180deg, color-mix(in srgb, var(--rf-primary) 80%, white) 0%, var(--rf-primary) 100%); }
.bar--demand { background: linear-gradient(180deg, color-mix(in srgb, var(--rf-warning) 75%, white) 0%, var(--rf-warning) 100%); }
.bar--demand-over { background: linear-gradient(180deg, color-mix(in srgb, var(--rf-danger) 75%, white) 0%, var(--rf-danger) 100%); }

.bar-group__label {
    font-size: 11px;
    font-weight: 700;
    color: var(--rf-text);
}

.chart-legend {
    display: flex;
    gap: 18px;
    justify-content: center;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--rf-border);
    flex-wrap: wrap;
}

.legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    color: var(--rf-text-secondary);
    font-weight: 600;
}

.legend-swatch { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.legend-swatch--stock { background: var(--rf-primary); }
.legend-swatch--demand { background: var(--rf-warning); }
.legend-swatch--over { background: var(--rf-danger); }

/* Emergency alerts */
.alert-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.alert-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 12px;
    padding: 14px 16px 14px 20px;
    border: 1px solid var(--rf-border);
    background: var(--rf-card);
    overflow: hidden;
    transition: box-shadow 0.15s ease;
}

.alert-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--rf-danger);
}

.alert-card:hover { box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06); }

.alert-card--skeleton { min-height: 58px; border: none; }
.alert-card--skeleton::before { display: none; }
.alert-card--high::before { background: var(--rf-warning); }
.alert-card--moderate::before { background: var(--rf-text-secondary); }

.alert-card__icon {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: var(--rf-danger-soft);
    color: var(--rf-danger);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.alert-card--high .alert-card__icon { color: var(--rf-warning); background: var(--rf-warning-soft); }
.alert-card--moderate .alert-card__icon { color: var(--rf-text-secondary); background: var(--rf-border); }

.alert-card__sparkline {
    width: 64px;
    height: 26px;
    flex-shrink: 0;
}

.alert-card__sparkline polyline {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    color: var(--rf-danger);
}

.alert-card--high .alert-card__sparkline polyline { color: var(--rf-warning); }
.alert-card--moderate .alert-card__sparkline polyline { color: var(--rf-text-secondary); }

.alert-card__body { flex: 1; min-width: 0; }

.alert-card__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--rf-text);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.alert-card__meta {
    font-size: 11.5px;
    color: var(--rf-text-secondary);
    margin: 4px 0 0;
}

.change--up { color: var(--rf-danger); display: inline-flex; align-items: center; gap: 2px; }
.change--down { color: var(--rf-success); display: inline-flex; align-items: center; gap: 2px; }

.alert-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
    font-size: 12.5px;
    color: var(--rf-text-secondary);
}

/* Breakdown table */
.breakdown-table, .reports-table {
    border: 1px solid var(--rf-border);
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
    border-bottom: 1px solid var(--rf-border);
    transition: background 0.15s ease;
}

.breakdown-row:hover { background: var(--rf-bg); }
.breakdown-row:last-child { border-bottom: none; }

.breakdown-row--head {
    background: var(--rf-bg);
    font-weight: 800;
    text-transform: uppercase;
    font-size: 10.5px;
    letter-spacing: 0.03em;
    color: var(--rf-text-secondary);
}

.breakdown-row--head:hover { background: var(--rf-bg); }

.sortable {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    user-select: none;
}

.balance--negative { color: var(--rf-danger); font-weight: 700; }

/* Insights */
.insights-panel {
    border: 1px solid var(--rf-border);
    border-radius: 14px;
    overflow: hidden;
}

.insight-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    font-size: 12.5px;
    border-bottom: 1px solid var(--rf-border);
}

.insight-row:last-child { border-bottom: none; }
.insight-row--critical { color: var(--rf-danger); }
.insight-row--warning { color: var(--rf-warning); }
.insight-row--healthy { color: var(--rf-success); }

.insight-row__icon { flex-shrink: 0; margin-top: 1px; }
.insight-row__msg { flex: 1; color: var(--rf-text); margin: 0; }

/* Report generator */
.report-generator {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr auto;
    gap: 12px;
    align-items: end;
}

.report-generator__actions { display: flex; gap: 8px; }

.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group--row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.form-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--rf-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

/* Trend chart */
.trend-chart { width: 100%; height: 200px; overflow: visible; }
.trend-area { fill: url(#trendFill); stroke: none; }
.trend-line {
    fill: none;
    stroke: var(--rf-primary);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
}
.trend-dot { fill: var(--rf-card); stroke: var(--rf-primary); stroke-width: 2.5; transition: r 0.15s ease; }
.trend-dot__halo { fill: var(--rf-primary); opacity: 0; transition: opacity 0.15s ease; }
.trend-point:hover .trend-dot__halo { opacity: 0.12; }
.trend-point:hover .trend-dot { r: 5; }
.trend-dot__value {
    font-size: 10.5px;
    font-weight: 700;
    fill: var(--rf-text);
    opacity: 0;
    transition: opacity 0.15s ease;
    pointer-events: none;
}
.trend-point:hover .trend-dot__value { opacity: 1; }

.trend-labels {
    display: flex;
    justify-content: space-between;
    padding: 0 20px;
    margin-top: 4px;
    font-size: 11px;
    color: var(--rf-text-secondary);
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
    border-bottom: 1px solid var(--rf-border);
    transition: background 0.15s ease;
}

.reports-row:hover { background: var(--rf-bg); }
.reports-row:last-child { border-bottom: none; }

.reports-row--head {
    background: var(--rf-bg);
    font-weight: 800;
    text-transform: uppercase;
    font-size: 10.5px;
    letter-spacing: 0.03em;
    color: var(--rf-text-secondary);
}

.reports-row--head:hover { background: var(--rf-bg); }
.reports-row__name { font-weight: 700; color: var(--rf-text); }
.reports-row__actions { display: flex; gap: 10px; }

.view-link {
    font-size: 12px;
    color: var(--rf-primary);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
}

.view-link:hover { text-decoration: underline; }

/* Pills */
.pill { font-size: 10.5px; font-weight: 700; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
.pill--blood { background: var(--rf-danger-soft); color: var(--rf-danger); }
.pill--type { background: var(--rf-purple-soft); color: var(--rf-purple); }

.pill--status-healthy, .pill--status-low, .pill--status-critical,
.pill--severity-critical, .pill--severity-high, .pill--severity-moderate {
    display: inline-flex;
    align-items: center;
    gap: 5px;
}

.pill--status-healthy::before, .pill--status-low::before, .pill--status-critical::before,
.pill--severity-critical::before, .pill--severity-high::before, .pill--severity-moderate::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: currentColor;
    flex-shrink: 0;
}

.pill--status-healthy { background: var(--rf-success-soft); color: var(--rf-success); }
.pill--status-low { background: var(--rf-warning-soft); color: var(--rf-warning); }
.pill--status-critical { background: var(--rf-danger-soft); color: var(--rf-danger); }
.pill--severity-critical { background: var(--rf-danger-soft); color: var(--rf-danger); }
.pill--severity-high { background: var(--rf-warning-soft); color: var(--rf-warning); }
.pill--severity-moderate { background: var(--rf-border); color: var(--rf-text-secondary); }

/* Empty state */
.empty-state {
    color: var(--rf-text-secondary);
    font-size: 13px;
    padding: 32px 16px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}

.empty-state--inline { padding: 20px 0; flex-direction: row; justify-content: center; gap: 10px; }
.empty-state__title { font-weight: 700; color: var(--rf-text); margin: 4px 0 0; }
.empty-state__body { margin: 0 0 6px; max-width: 320px; }

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
    background: var(--rf-card);
    border-radius: 16px;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
    border: 1px solid var(--rf-border);
}

.modal-card--wide { max-width: 560px; }

.modal-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid var(--rf-border);
}

.modal-card__title { font-size: 15px; font-weight: 700; margin: 0; color: var(--rf-text); }

.modal-card__close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--rf-text-secondary);
    padding: 4px;
    display: flex;
    transition: color 0.15s ease;
}

.modal-card__close:hover { color: var(--rf-text); }

.modal-form {
    padding: 18px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.modal-subtitle { font-size: 13px; color: var(--rf-text-secondary); margin: 0; }

.preview-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.preview-stat {
    border: 1px solid var(--rf-border);
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.preview-stat__value { font-size: 20px; font-weight: 800; color: var(--rf-text); }
.preview-stat__label {
    font-size: 11px;
    color: var(--rf-text-secondary);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.donor-list { display: flex; flex-direction: column; gap: 10px; }
.donor-row { padding: 2px 0; }

.modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 4px;
}

.modal-error { color: var(--rf-danger); font-size: 12px; margin: 0; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

/* Toast */
.toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--rf-text);
    color: var(--rf-card);
    padding: 12px 18px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
    z-index: 200;
}

.toast-enter-active, .toast-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }

/* Skeletons */
.skeleton-block {
    background: linear-gradient(90deg, var(--rf-skeleton-a) 25%, var(--rf-skeleton-b) 37%, var(--rf-skeleton-a) 63%);
    background-size: 400% 100%;
    animation: skeleton-loading 1.4s ease infinite;
    border-radius: 8px;
    color: transparent;
    min-height: 60px;
}

@keyframes skeleton-loading {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
}

@media (prefers-reduced-motion: reduce) {
    .skeleton-block { animation: none; }
}

/* Responsive */
@media (max-width: 900px) {
    .stats-row { grid-template-columns: repeat(2, 1fr); }
    .report-generator { grid-template-columns: 1fr 1fr; }
    .quick-controls__actions { margin-left: 0; width: 100%; }
}

@media (max-width: 640px) {
    .reports-page { padding: 16px 16px 32px; }
    .header-row { flex-direction: column; align-items: stretch; }
    .header-actions { flex-direction: column; align-items: stretch; }
    .select-wrap { width: 100%; }
    .stats-row { grid-template-columns: 1fr; }
    .quick-controls { flex-direction: column; align-items: stretch; }
    .breakdown-row, .reports-row { grid-template-columns: 1fr; gap: 4px; }
    .report-generator { grid-template-columns: 1fr; }
    .chart-card { overflow-x: auto; }
    .chart-plot { min-width: 520px; }
    .bar-chart { min-width: 480px; }
}
</style>