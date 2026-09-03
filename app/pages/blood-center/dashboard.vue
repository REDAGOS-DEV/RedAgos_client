<template>
  <div class="dashboard">
    <!-- Skeleton loading state -->
    <div v-if="loading" class="dashboard-inner">
      <div class="skeleton skeleton--header" />
      <div class="stats-grid">
        <div class="skeleton skeleton--card" v-for="n in 4" :key="n" />
      </div>
      <div class="skeleton skeleton--panel" style="height:320px" />
      <div class="insights-grid">
        <div class="skeleton skeleton--panel" style="height:280px" />
        <div class="skeleton skeleton--panel" style="height:280px" />
      </div>
      <div class="skeleton skeleton--panel" style="height:260px" />
    </div>

    <div v-else class="dashboard-inner">
      <!-- ============ HEADER ============ -->
      <div class="header-row fade-in" style="--delay: 0ms">
        <div>
          <h1 class="page-title">Blood Center Dashboard</h1>
          <p class="page-subtitle">Monitor blood inventory, manage hospital requests, coordinate donor activities, and oversee daily operations.</p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-outline" @click="exportReport" :disabled="exporting">
            <AssetIcon name="download" :size="14" />
            {{ exporting ? 'Exporting…' : 'Export Report' }}
          </button>
          <button type="button" class="btn-primary" @click="openRecordDonation">
            <AssetIcon name="plus" :size="15" />
            Record Donation
          </button>
        </div>
      </div>

      <!-- ============ KPI CARDS ============ -->
      <div class="stats-grid">
        <div class="stat-card fade-in" style="--delay: 60ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Total Blood Units</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-primary-rgb), 0.08)' }">
              <AssetIcon name="droplets" :size="14" style="color: var(--rb-primary)" />
            </div>
          </div>
          <p class="stat-card__value">{{ totalUnits === null ? '—' : totalUnits }}</p>
          <span class="stat-chip stat-chip--neutral">Across all components</span>
          <span v-if="weeklyChangePercent !== null" class="stat-trend" :class="weeklyChangePercent >= 0 ? 'stat-trend--up' : 'stat-trend--down'">
            <AssetIcon :name="weeklyChangePercent >= 0 ? 'arrow-up-right' : 'arrow-down-right'" :size="11" />
            {{ Math.abs(weeklyChangePercent) }}% this week
          </span>
        </div>

        <div class="stat-card fade-in" style="--delay: 110ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Donations Today</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-success-rgb), 0.08)' }">
              <AssetIcon name="trending-up" :size="14" style="color: var(--rb-success)" />
            </div>
          </div>
          <p class="stat-card__value">{{ donationsToday === null ? '—' : donationsToday }}</p>
          <span class="stat-chip stat-chip--neutral">{{ dailyGoal !== null ? `Goal: ${dailyGoal} units/day` : 'Daily goal not set' }}</span>
          <span v-if="vsYesterdayPercent !== null" class="stat-trend" :class="vsYesterdayPercent >= 0 ? 'stat-trend--up' : 'stat-trend--down'">
            <AssetIcon :name="vsYesterdayPercent >= 0 ? 'arrow-up-right' : 'arrow-down-right'" :size="11" />
            {{ Math.abs(vsYesterdayPercent) }}% vs yesterday
          </span>
        </div>

        <div class="stat-card fade-in" style="--delay: 160ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Pending Hospital Requests</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-warning-rgb), 0.08)' }">
              <AssetIcon name="package" :size="14" style="color: var(--rb-warning)" />
            </div>
          </div>
          <p class="stat-card__value">{{ pendingRequestsCount }}</p>
          <span class="stat-chip stat-chip--neutral">Needs fulfillment</span>
        </div>

        <div class="stat-card fade-in" :class="{ 'stat-card--emphasized': criticalTypesCount > 0 }" style="--delay: 210ms">
          <div class="stat-card__top">
            <p class="stat-card__label">Critical Blood Types</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-accent-rgb), 0.08)' }">
              <AssetIcon name="alert" :size="14" style="color: var(--rb-accent)" />
            </div>
          </div>
          <p class="stat-card__value" style="color: var(--rb-accent)">{{ criticalTypesCount }}</p>
          <span class="stat-chip stat-chip--neutral truncate-chip">{{ criticalTypesLabel }}</span>
        </div>
      </div>

      <!-- ============ BLOOD INVENTORY OVERVIEW ============ -->
      <div class="panel fade-in" style="--delay: 260ms">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Blood Inventory Overview</h2>
            <p class="panel-subtitle">Primary operational view of current stock by blood type.</p>
          </div>
          <div class="search-box">
            <AssetIcon name="search" :size="14" class="search-box__icon" />
            <input v-model="inventorySearch" type="text" placeholder="Search blood type" class="search-box__input" />
          </div>
        </div>

        <div class="inventory-table-wrap">
          <table class="inventory-table">
            <thead>
              <tr>
                <th v-for="col in inventoryColumns" :key="col.key" @click="toggleSort(col.key)" class="sortable-th">
                  <span class="sortable-th__inner">
                    {{ col.label }}
                    <AssetIcon
                      :name="sortColumn === col.key ? (sortDirection === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down'"
                      :size="11"
                      class="sort-icon"
                      :class="{ 'sort-icon--active': sortColumn === col.key }"
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sortedInventory" :key="row.blood_type" class="inventory-row">
                <td>
                  <span class="type-pill">{{ row.blood_type }}</span>
                </td>
                <td>{{ row.whole_blood }}</td>
                <td>{{ row.red_blood_cells }}</td>
                <td>{{ row.plasma }}</td>
                <td>{{ row.platelets }}</td>
                <td class="inventory-table__total">{{ row.total }}</td>
                <td>
                  <span class="status-pill" :class="`status-pill--${row.status}`">
                    <span class="status-pill__dot" />
                    {{ statusLabel(row.status) }}
                  </span>
                </td>
              </tr>
              <tr v-if="!sortedInventory.length">
                <td colspan="7" class="inventory-table__empty">
                  {{ inventory.length ? `No blood types match "${inventorySearch}"` : 'No inventory data available yet' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============ INVENTORY INSIGHTS ============ -->
      <div class="insights-grid fade-in" style="--delay: 300ms">
        <!-- Inventory Trends (line chart) -->
        <div class="panel insight-card">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Inventory Trends</h2>
              <p class="panel-subtitle">Monitor inventory changes over time.</p>
            </div>
            <div class="segmented-control">
              <button
                v-for="range in trendRanges"
                :key="range.value"
                type="button"
                class="segmented-control__btn"
                :class="{ 'segmented-control__btn--active': trendRange === range.value }"
                @click="trendRange = range.value"
              >
                {{ range.label }}
              </button>
            </div>
          </div>

          <div v-if="!currentTrendData.length" class="empty-state">
            <AssetIcon name="trending-up" :size="36" style="color: var(--rb-border-strong)" />
            <p>No inventory trend data available yet</p>
          </div>

          <div v-else class="chart-body">
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-dot" style="background: var(--rb-primary)" />Available Units</span>
              <span class="legend-item"><span class="legend-dot" style="background: var(--rb-accent)" />Reserved Units</span>
            </div>

            <div class="line-chart-wrap" @mouseleave="hoveredPointIndex = null">
              <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="line-chart" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--rb-primary)" stop-opacity="0.16" />
                    <stop offset="100%" stop-color="var(--rb-primary)" stop-opacity="0" />
                  </linearGradient>
                </defs>

                <line
                  v-for="(g, i) in gridLines"
                  :key="i"
                  :x1="chartPadding.left"
                  :x2="chartWidth - chartPadding.right"
                  :y1="g"
                  :y2="g"
                  class="chart-grid-line"
                />

                <path :d="areaPath" fill="url(#areaFill)" stroke="none" />
                <path :d="reservedPath" fill="none" stroke="var(--rb-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 4" />
                <path :d="availablePath" fill="none" stroke="var(--rb-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

                <g v-for="(p, i) in availablePoints" :key="'a'+i">
                  <circle :cx="p.x" :cy="p.y" r="3.2" fill="var(--rb-surface)" stroke="var(--rb-primary)" stroke-width="2" />
                  <rect
                    :x="p.x - (chartWidth / availablePoints.length) / 2"
                    y="0"
                    :width="chartWidth / availablePoints.length"
                    :height="chartHeight"
                    fill="transparent"
                    class="hover-target"
                    @mouseenter="hoveredPointIndex = i"
                  />
                </g>
                <circle v-for="(p, i) in reservedPoints" :key="'r'+i" :cx="p.x" :cy="p.y" r="2.6" fill="var(--rb-surface)" stroke="var(--rb-accent)" stroke-width="2" />

                <text v-for="(p, i) in availablePoints" :key="'lbl'+i" :x="p.x" :y="chartHeight - 6" class="chart-axis-label" text-anchor="middle">{{ p.label }}</text>
              </svg>

              <div
                v-if="hoveredPointIndex !== null"
                class="chart-tooltip"
                :style="{
                  left: (availablePoints[hoveredPointIndex].x / chartWidth) * 100 + '%',
                  top: (availablePoints[hoveredPointIndex].y / chartHeight) * 100 + '%'
                }"
              >
                <p class="chart-tooltip__label">{{ availablePoints[hoveredPointIndex].label }}</p>
                <p class="chart-tooltip__row"><span class="legend-dot" style="background: var(--rb-primary)" />Available: {{ availablePoints[hoveredPointIndex].value }}</p>
                <p class="chart-tooltip__row"><span class="legend-dot" style="background: var(--rb-accent)" />Reserved: {{ reservedPoints[hoveredPointIndex].value }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Blood Component Distribution -->
        <div class="panel insight-card">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Blood Component Distribution</h2>
              <p class="panel-subtitle">Visualize current inventory composition.</p>
            </div>
          </div>

          <div v-if="!donutTotal" class="empty-state">
            <AssetIcon name="package" :size="36" style="color: var(--rb-border-strong)" />
            <p>No component distribution data available yet</p>
          </div>

          <div v-else class="donut-body">
            <div class="donut-chart-wrap" @mouseleave="hoveredDonut = null">
              <svg viewBox="0 0 160 160" class="donut-chart">
                <circle cx="80" cy="80" :r="donutRadius" fill="none" stroke="var(--rb-surface-alt)" stroke-width="22" />
                <circle
                  v-for="seg in donutSegments"
                  :key="seg.label"
                  cx="80"
                  cy="80"
                  :r="donutRadius"
                  fill="none"
                  :stroke="seg.color"
                  stroke-width="22"
                  :stroke-dasharray="seg.dasharray"
                  :stroke-dashoffset="seg.dashoffset"
                  transform="rotate(-90 80 80)"
                  class="donut-segment"
                  :class="{ 'donut-segment--dim': hoveredDonut && hoveredDonut.label !== seg.label }"
                  @mouseenter="hoveredDonut = seg"
                />
              </svg>
              <div class="donut-center">
                <p class="donut-center__value">{{ hoveredDonut ? hoveredDonut.pct + '%' : donutTotal }}</p>
                <p class="donut-center__label">{{ hoveredDonut ? hoveredDonut.label : 'Total Units' }}</p>
              </div>
            </div>

            <div class="donut-legend">
              <div v-for="seg in donutSegments" :key="seg.label" class="donut-legend__row" @mouseenter="hoveredDonut = seg" @mouseleave="hoveredDonut = null">
                <span class="legend-dot" :style="{ background: seg.color }" />
                <span class="donut-legend__label">{{ seg.label }}</span>
                <span class="donut-legend__value">{{ seg.pct }}% &middot; {{ seg.value }} units</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ INCOMING HOSPITAL REQUESTS ============ -->
      <div class="panel fade-in" style="--delay: 340ms">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Incoming Hospital Requests</h2>
            <p class="panel-subtitle">New and in-progress requests from partner hospitals.</p>
          </div>
          <NuxtLink to="/blood-center/hospital-requests" class="panel-link">View all</NuxtLink>
        </div>

        <div v-if="requests.length" class="request-list">
          <div v-for="req in requests" :key="req.id" class="request-item">
            <div class="request-item__left">
              <div class="hospital-avatar" :style="{ background: urgencyIconBg(req.urgency), color: urgencyIconColor(req.urgency) }">
                {{ initials(req.hospital) }}
              </div>
              <div class="request-info">
                <div class="request-info__row">
                  <p class="request-hospital">{{ req.hospital }}</p>
                  <span class="urgency-pill" :class="`urgency-pill--${req.urgency}`">{{ req.urgency }}</span>
                </div>
                <p class="request-meta">
                  {{ req.code }} &middot;
                  <span class="type-pill type-pill--sm">{{ req.blood_type }}</span>
                  &middot; {{ req.units }} unit{{ req.units !== 1 ? 's' : '' }} &middot; {{ req.time_ago }}
                </p>
              </div>
            </div>
            <div class="request-item__right">
              <span class="status-pill status-pill--sm" :class="`status-pill--${req.status}`">
                <span class="status-pill__dot" />
                {{ req.status }}
              </span>
              <button type="button" class="btn-primary btn-primary--sm" @click="openConfirmModal(req)">
                {{ req.status === 'processing' ? 'Fulfill' : 'Process' }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <AssetIcon name="clipboard-check" :size="36" style="color: var(--rb-border-strong)" />
          <p>No pending hospital requests</p>
        </div>
      </div>

      <!-- ============ INVENTORY HEALTH SUMMARY ============ -->
      <div class="health-grid fade-in" style="--delay: 380ms">
        <div class="health-card health-card--healthy">
          <div class="health-card__icon">
            <AssetIcon name="shield-check" :size="18" style="color: var(--rb-success)" />
          </div>
          <div>
            <p class="health-card__value">{{ healthSummary.healthy }}</p>
            <p class="health-card__label">Healthy blood types</p>
            <p class="health-card__desc">Stock levels within safe range</p>
          </div>
        </div>
        <div class="health-card health-card--low">
          <div class="health-card__icon">
            <AssetIcon name="triangle-alert" :size="18" style="color: var(--rb-warning)" />
          </div>
          <div>
            <p class="health-card__value">{{ healthSummary.low }}</p>
            <p class="health-card__label">Low stock types</p>
            <p class="health-card__desc">Approaching reorder threshold</p>
          </div>
        </div>
        <div class="health-card health-card--critical">
          <div class="health-card__icon">
            <AssetIcon name="alert" :size="18" style="color: var(--rb-accent)" />
          </div>
          <div>
            <p class="health-card__value">{{ healthSummary.critical }}</p>
            <p class="health-card__label">Critical types</p>
            <p class="health-card__desc">Immediate replenishment needed</p>
          </div>
        </div>
      </div>

      <!-- ============ NEAR EXPIRY BLOOD UNITS ============ -->
      <div class="panel fade-in" style="--delay: 420ms">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Near Expiry Blood Units</h2>
            <p class="panel-subtitle">Units approaching their expiration window.</p>
          </div>
        </div>

        <div class="inventory-table-wrap">
          <table class="inventory-table expiry-table">
            <thead>
              <tr>
                <th>Blood Type</th>
                <th>Component</th>
                <th>Units</th>
                <th>Expiry Date</th>
                <th>Days Remaining</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in nearExpiry" :key="row.id" class="inventory-row" :class="`expiry-row--${expiryStatus(row.days_remaining)}`">
                <td><span class="type-pill">{{ row.blood_type }}</span></td>
                <td>{{ row.component }}</td>
                <td>{{ row.units }}</td>
                <td>{{ row.expiry_date }}</td>
                <td>{{ row.days_remaining <= 0 ? 'Today' : `${row.days_remaining} day${row.days_remaining !== 1 ? 's' : ''}` }}</td>
                <td>
                  <span class="status-pill" :class="`status-pill--${expiryStatus(row.days_remaining)}`">
                    <span class="status-pill__dot" />
                    {{ expiryStatusLabel(row.days_remaining) }}
                  </span>
                </td>
                <td>
                  <NuxtLink :to="`/blood-center/inventory?type=${row.blood_type}`" class="link-btn">
                    <AssetIcon name="eye" :size="13" />
                    View Inventory
                  </NuxtLink>
                </td>
              </tr>
              <tr v-if="!nearExpiry.length">
                <td colspan="7" class="inventory-table__empty">No units nearing expiry</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============ RECENT DONATION ACTIVITY ============ -->
      <div class="panel fade-in" style="--delay: 460ms">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Recent Donation Activity</h2>
            <p class="panel-subtitle">Latest donations recorded at this center.</p>
          </div>
          <NuxtLink to="/blood-center/donations" class="panel-link">View History</NuxtLink>
        </div>

        <div v-if="donationActivity.length" class="timeline">
          <div v-for="item in donationActivity" :key="item.id" class="timeline-item">
            <div class="timeline-item__marker">
              <AssetIcon name="droplets" :size="13" style="color: var(--rb-primary)" />
            </div>
            <div class="timeline-item__body">
              <div class="timeline-item__row">
                <p class="timeline-item__name">{{ item.donor_name }}</p>
                <span v-if="item.verified" class="verified-badge">
                  <AssetIcon name="check-circle" :size="11" />
                  Verified
                </span>
              </div>
              <p class="timeline-item__meta">
                {{ item.type }} &middot; {{ item.volume }} &middot; {{ item.time }}
              </p>
            </div>
            <span class="status-pill status-pill--sm" :class="`status-pill--${item.status}`">
              <span class="status-pill__dot" />
              {{ item.status }}
            </span>
          </div>
        </div>
        <div v-else class="empty-state">
          <AssetIcon name="droplets" :size="36" style="color: var(--rb-border-strong)" />
          <p>No donations recorded yet today</p>
        </div>
      </div>

      <!-- ============ RECENT SYSTEM ACTIVITY ============ -->
      <div class="panel fade-in" style="--delay: 500ms">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Recent System Activity</h2>
            <p class="panel-subtitle">Audit trail of actions across the system.</p>
          </div>
        </div>

        <div v-if="systemActivity.length" class="activity-feed">
          <div v-for="item in systemActivity" :key="item.id" class="activity-feed__item">
            <div class="activity-feed__icon" :style="{ background: `rgba(var(--rb-${item.tone}-rgb), 0.08)` }">
              <AssetIcon :name="item.icon" :size="14" :style="{ color: `var(--rb-${item.tone})` }" />
            </div>
            <div class="activity-feed__body">
              <p class="activity-feed__title">{{ item.title }}</p>
              <p class="activity-feed__desc">{{ item.description }}</p>
            </div>
            <span class="activity-feed__time">{{ item.time }}</span>
          </div>
        </div>
        <div v-else class="empty-state">
          <AssetIcon name="activity" :size="36" style="color: var(--rb-border-strong)" />
          <p>No recent activity</p>
        </div>
      </div>

      <!-- ============ QUICK ACTIONS ============ -->
      <div class="panel fade-in" style="--delay: 540ms">
        <div class="panel-header">
          <h2 class="panel-title">Quick Actions</h2>
        </div>
        <div class="quick-actions-grid">
          <button
            v-for="action in quickActions"
            :key="action.label"
            type="button"
            class="quick-action-card"
            @click="handleQuickAction(action)"
          >
            <div class="quick-action-card__icon">
              <AssetIcon :name="action.icon" :size="20" style="color: var(--rb-primary)" />
            </div>
            <p class="quick-action-card__label">{{ action.label }}</p>
            <p class="quick-action-card__desc">{{ action.description }}</p>
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm process/fulfill modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="confirmModalOpen" class="modal-overlay" @click.self="closeConfirmModal">
          <div class="modal-card" role="dialog" v-focus-trap aria-modal="true">
            <button type="button" class="modal-close" @click="closeConfirmModal">
              <AssetIcon name="x" :size="16" />
            </button>

            <div class="modal-icon">
              <AssetIcon name="alert" :size="18" style="color: var(--rb-primary)" />
            </div>

            <h3 class="modal-title">
              {{ selectedRequest?.status === 'processing' ? 'Mark as fulfilled?' : 'Process this request?' }}
            </h3>
            <p class="modal-subtitle" v-if="selectedRequest">
              {{ selectedRequest.code }} &middot; {{ selectedRequest.hospital }} &middot;
              {{ selectedRequest.units }} unit{{ selectedRequest.units !== 1 ? 's' : '' }} {{ selectedRequest.blood_type }}
            </p>

            <div class="modal-actions">
              <button type="button" class="btn-primary modal-actions__btn" :disabled="confirmSubmitting" @click="confirmAction">
                {{ confirmSubmitting ? 'Please wait…' : (selectedRequest?.status === 'processing' ? 'Fulfill' : 'Process') }}
              </button>
              <button type="button" class="btn-outline modal-actions__btn" @click="closeConfirmModal" :disabled="confirmSubmitting">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Record donation modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="recordModalOpen" class="modal-overlay" @click.self="closeRecordDonation">
          <div class="modal-card modal-card--form" role="dialog" v-focus-trap aria-modal="true">
            <button type="button" class="modal-close" @click="closeRecordDonation">
              <AssetIcon name="x" :size="16" />
            </button>

            <h3 class="modal-title modal-title--left">Record Donation</h3>
            <p class="modal-subtitle modal-subtitle--left">Log a new blood donation at this center.</p>

            <form class="donation-form" @submit.prevent="submitDonation">
              <label class="form-field">
                <span class="form-field__label">Donor ID or Name *</span>
                <input v-model="donationForm.donorIdOrName" type="text" required placeholder="e.g. DNR-001 or Maria Santos" class="form-field__input" />
              </label>

              <div class="form-row">
                <label class="form-field">
                  <span class="form-field__label">Blood Type *</span>
                  <select v-model="donationForm.bloodType" required class="form-field__input form-field__select">
                    <option value="" disabled>Select</option>
                    <option v-for="t in bloodTypeOptions" :key="t" :value="t">{{ t }}</option>
                  </select>
                </label>

                <label class="form-field">
                  <span class="form-field__label">Component</span>
                  <select v-model="donationForm.component" class="form-field__input form-field__select">
                    <option value="" disabled>Select</option>
                    <option v-for="c in componentOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
                  </select>
                </label>
              </div>

              <label class="form-field">
                <span class="form-field__label">Volume Collected</span>
                <input v-model="donationForm.volume" type="text" placeholder="e.g. 450 mL" class="form-field__input" />
              </label>

              <label class="form-field">
                <span class="form-field__label">Notes</span>
                <textarea v-model="donationForm.notes" rows="3" placeholder="Optional remarks…" class="form-field__input form-field__textarea" />
              </label>

              <p v-if="donationError" class="form-error">{{ donationError }}</p>

              <div class="modal-actions">
                <button type="submit" class="btn-primary modal-actions__btn" :disabled="donationSubmitting">
                  <AssetIcon name="check-circle" :size="15" />
                  {{ donationSubmitting ? 'Saving…' : 'Record Donation' }}
                </button>
                <button type="button" class="btn-outline modal-actions__btn" @click="closeRecordDonation" :disabled="donationSubmitting">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { useUser } from '~/composables/useUser'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'reports.view_all',
})

const { user, can } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || user.value?.facility_name || 'Blood Center')

const loading = ref(true)

// --- Top-level stats ---
const totalUnits = ref(null)
const donationsToday = ref(null)
const dailyGoal = ref(null)
const weeklyChangePercent = ref(null)
const vsYesterdayPercent = ref(null)

// --- Inventory table ---
const inventory = ref([])
const inventorySearch = ref('')
const sortColumn = ref('blood_type')
const sortDirection = ref('asc')

const inventoryColumns = [
  { key: 'blood_type', label: 'Blood Type' },
  { key: 'whole_blood', label: 'Whole Blood' },
  { key: 'red_blood_cells', label: 'Packed RBC' },
  { key: 'plasma', label: 'Fresh Frozen Plasma' },
  { key: 'platelets', label: 'Platelets' },
  { key: 'total', label: 'Total Units' },
  { key: 'status', label: 'Availability Status' },
]

const filteredInventory = computed(() => {
  const q = inventorySearch.value.trim().toLowerCase()
  if (!q) return inventory.value
  return inventory.value.filter(row => row.blood_type.toLowerCase().includes(q))
})

const sortedInventory = computed(() => {
  const list = [...filteredInventory.value]
  const col = sortColumn.value
  const dir = sortDirection.value === 'asc' ? 1 : -1
  list.sort((a, b) => {
    const av = a[col]
    const bv = b[col]
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
    return (av - bv) * dir
  })
  return list
})

function toggleSort(col) {
  if (sortColumn.value === col) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = col
    sortDirection.value = 'asc'
  }
}

function statusLabel(status) {
  const map = { adequate: 'Adequate', low: 'Low Stock', critical: 'Critical' }
  return map[status] || status
}

const pendingRequestsCount = computed(() => requests.value.filter(r => r.status === 'pending').length)

const criticalTypes = computed(() => inventory.value.filter(r => r.status === 'critical').map(r => r.blood_type))
const criticalTypesCount = computed(() => criticalTypes.value.length)
const criticalTypesLabel = computed(() => {
  if (!criticalTypesCount.value) return 'No critical types'
  return `${criticalTypes.value.join(' and ')} at critical`
})

const healthSummary = computed(() => ({
  healthy: inventory.value.filter(r => r.status === 'adequate').length,
  low: inventory.value.filter(r => r.status === 'low').length,
  critical: inventory.value.filter(r => r.status === 'critical').length,
}))

// Dev note: reference data (blood types, components) kay gikan sa
// /blood-center/reference-data endpoint — dili na hardcoded diri.
const bloodTypeOptions = ref([])
const componentOptions = ref([])

// --- Inventory Trends (line chart) ---
const chartWidth = 560
const chartHeight = 200
const chartPadding = { top: 16, right: 14, bottom: 26, left: 14 }
const gridLines = [chartPadding.top, (chartHeight - chartPadding.bottom + chartPadding.top) / 2, chartHeight - chartPadding.bottom]

const trendRanges = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
]
const trendRange = ref('weekly')
const inventoryTrends = reactive({ weekly: [], monthly: [], quarterly: [] })
const currentTrendData = computed(() => inventoryTrends[trendRange.value] || [])

const trendScale = computed(() => {
  const data = currentTrendData.value
  if (!data.length) return { max: 1, min: 0 }
  const values = data.flatMap(d => [d.available, d.reserved])
  return { max: Math.max(...values), min: 0 }
})

function xForIndex(i, len) {
  const innerWidth = chartWidth - chartPadding.left - chartPadding.right
  if (len <= 1) return chartPadding.left
  return chartPadding.left + (innerWidth * i) / (len - 1)
}
function yForValue(v) {
  const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom
  const { max, min } = trendScale.value
  if (max === min) return chartHeight - chartPadding.bottom
  const ratio = (v - min) / (max - min)
  return chartHeight - chartPadding.bottom - ratio * innerHeight
}
function pointsToPath(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

const availablePoints = computed(() =>
  currentTrendData.value.map((d, i) => ({ x: xForIndex(i, currentTrendData.value.length), y: yForValue(d.available), value: d.available, label: d.label }))
)
const reservedPoints = computed(() =>
  currentTrendData.value.map((d, i) => ({ x: xForIndex(i, currentTrendData.value.length), y: yForValue(d.reserved), value: d.reserved, label: d.label }))
)
const availablePath = computed(() => pointsToPath(availablePoints.value))
const reservedPath = computed(() => pointsToPath(reservedPoints.value))
const areaPath = computed(() => {
  if (!availablePoints.value.length) return ''
  const baseline = chartHeight - chartPadding.bottom
  const pts = availablePoints.value
  return `${pointsToPath(pts)} L ${pts[pts.length - 1].x.toFixed(1)} ${baseline} L ${pts[0].x.toFixed(1)} ${baseline} Z`
})
const hoveredPointIndex = ref(null)

// --- Blood Component Distribution (donut chart) ---
const donutRadius = 58
const donutCircumference = 2 * Math.PI * donutRadius
const componentDistributionOverride = ref([])
const hoveredDonut = ref(null)

const computedDistribution = computed(() => {
  if (componentDistributionOverride.value.length) return componentDistributionOverride.value
  const sums = inventory.value.reduce(
    (acc, row) => {
      acc.whole_blood += row.whole_blood
      acc.red_blood_cells += row.red_blood_cells
      acc.plasma += row.plasma
      acc.platelets += row.platelets
      return acc
    },
    { whole_blood: 0, red_blood_cells: 0, plasma: 0, platelets: 0 }
  )
  return [
    { label: 'Packed RBC', value: sums.red_blood_cells, color: 'var(--rb-primary)' },
    { label: 'Whole Blood', value: sums.whole_blood, color: 'var(--rb-accent)' },
    { label: 'Fresh Frozen Plasma', value: sums.plasma, color: 'var(--rb-purple)' },
    { label: 'Platelets', value: sums.platelets, color: 'var(--rb-teal)' },
  ]
})

const donutTotal = computed(() => computedDistribution.value.reduce((s, d) => s + d.value, 0))

const donutSegments = computed(() => {
  let cumulative = 0
  const total = donutTotal.value || 1
  return computedDistribution.value.map(seg => {
    const pct = seg.value / total
    const dash = pct * donutCircumference
    const geo = {
      ...seg,
      pct: Math.round(pct * 100),
      dasharray: `${dash.toFixed(2)} ${(donutCircumference - dash).toFixed(2)}`,
      dashoffset: (-cumulative).toFixed(2),
    }
    cumulative += dash
    return geo
  })
})

// --- Near expiry blood units ---
const nearExpiry = ref([])
function expiryStatus(days) {
  if (days <= 0) return 'critical'
  if (days <= 3) return 'critical'
  if (days <= 7) return 'low'
  return 'adequate'
}
function expiryStatusLabel(days) {
  if (days <= 0) return 'Expiring Today'
  if (days <= 3) return 'Within 3 Days'
  if (days <= 7) return 'Within 7 Days'
  return 'Monitor'
}

// --- Recent donation activity ---
const donationActivity = ref([])

// --- Recent system activity ---
const systemActivity = ref([])

// --- Quick actions ---
// Gi-filter sa parehas nga permissions sa sidebar. Bisan tuod supervisor ra
// ang makaabot ani nga page karon, ang shortcut dili gyud mo-offer og aksyon
// nga i-refuse ra sa server.
const ALL_QUICK_ACTIONS = [
  { label: 'Record Donation', description: 'Log a new donation entry', icon: 'droplets', kind: 'modal', requires: 'donations.record' },
  { label: 'Manage Inventory', description: 'Update stock levels and units', icon: 'package', kind: 'link', to: '/blood-center/inventory', requires: 'inventory.view' },
  { label: 'Process Requests', description: 'Review and fulfill hospital requests', icon: 'clipboard-list', kind: 'link', to: '/blood-center/bloodrequests', requires: 'requests.view' },
  { label: 'Generate Reports', description: 'Export operational summaries', icon: 'file-text', kind: 'export', requires: 'reports.view_own' },
  { label: 'Manage Donors', description: 'View and update donor records', icon: 'users', kind: 'link', to: '/blood-center/donors', requires: 'donors.view' },
  { label: 'Manage Staff', description: 'Add colleagues and assign departments', icon: 'user-check', kind: 'link', to: '/blood-center/staff', requires: 'staff.manage' },
]

const quickActions = computed(() => ALL_QUICK_ACTIONS.filter((action) => can(action.requires)))

function handleQuickAction(action) {
  if (action.kind === 'modal') return openRecordDonation()
  if (action.kind === 'export') return exportReport()
  if (action.kind === 'link' && action.to) return navigateTo(action.to)
}

// --- Hospital requests ---
const requests = ref([])

const urgencyIconBg = (urgency) => {
  if (urgency === 'emergency') return 'rgba(var(--rb-accent-rgb), 0.08)'
  if (urgency === 'urgent') return 'rgba(var(--rb-warning-rgb), 0.08)'
  return 'rgba(var(--rb-primary-rgb), 0.08)'
}
const urgencyIconColor = (urgency) => {
  if (urgency === 'emergency') return 'var(--rb-accent)'
  if (urgency === 'urgent') return 'var(--rb-warning)'
  return 'var(--rb-primary)'
}
function initials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

// --- Confirm process/fulfill modal ---
const confirmModalOpen = ref(false)
const selectedRequest = ref(null)
const confirmSubmitting = ref(false)

const openConfirmModal = (req) => {
  selectedRequest.value = req
  confirmModalOpen.value = true
}
const closeConfirmModal = () => {
  if (confirmSubmitting.value) return
  confirmModalOpen.value = false
  selectedRequest.value = null
}
const confirmAction = async () => {
  if (!selectedRequest.value) return
  confirmSubmitting.value = true
  const req = selectedRequest.value
  try {
    if (req.status === 'processing') {
      // Dev note: i-connect sa /blood-center/hospital-requests/:id/fulfill endpoint
      await bloodCenterService.fulfillRequest?.(req.id)
      req.status = 'fulfilled'
      requests.value = requests.value.filter(r => r.id !== req.id)
    } else {
      // Dev note: i-connect sa /blood-center/hospital-requests/:id/process endpoint
      await bloodCenterService.processRequest?.(req.id)
      req.status = 'processing'
    }
    confirmModalOpen.value = false
    selectedRequest.value = null
  } catch (err) {
    console.error('Failed to update hospital request:', err)
  } finally {
    confirmSubmitting.value = false
  }
}

// --- Record donation modal ---
const recordModalOpen = ref(false)
const donationSubmitting = ref(false)
const donationError = ref('')

const emptyDonationForm = () => ({
  donorIdOrName: '',
  bloodType: '',
  component: '',
  volume: '',
  notes: '',
})
const donationForm = reactive(emptyDonationForm())

const openRecordDonation = () => {
  Object.assign(donationForm, emptyDonationForm())
  donationError.value = ''
  recordModalOpen.value = true
}
const closeRecordDonation = () => {
  if (donationSubmitting.value) return
  recordModalOpen.value = false
}
const submitDonation = async () => {
  if (!donationForm.donorIdOrName.trim() || !donationForm.bloodType) {
    donationError.value = 'Donor and blood type are required.'
    return
  }
  donationSubmitting.value = true
  donationError.value = ''
  try {
    // Dev note: i-connect sa /blood-center/donations endpoint para ma-log ang bag-ong donation
    await bloodCenterService.recordDonation?.({ ...donationForm })
    donationsToday.value += 1
    recordModalOpen.value = false
  } catch (err) {
    console.error('Failed to record donation:', err)
    donationError.value = 'Something went wrong while saving. Please try again.'
  } finally {
    donationSubmitting.value = false
  }
}

const exporting = ref(false)
const exportReport = async () => {
  exporting.value = true
  try {
    // Dev note: i-connect sa /blood-center/reports/export endpoint
    await bloodCenterService.exportReport?.()
  } catch (err) {
    console.error('Failed to export report:', err)
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  try {
    // Dev note: gikan sa /blood-center/dashboard-summary, /inventory, /hospital-requests,
    // /inventory-trends, /component-distribution, /near-expiry, /donations, /activity-log endpoints.
    // Walay hardcoded/mock values diri — kung wala'y balik gikan sa API, mag-empty state na lang
    // ang UI (empty array/null) imbes mag-display og sample data.
    const data = await bloodCenterService.dashboardOverview?.()

    totalUnits.value = data?.total_units ?? null
    donationsToday.value = data?.donations_today ?? null
    dailyGoal.value = data?.daily_goal ?? null
    weeklyChangePercent.value = data?.weekly_change_percent ?? null
    vsYesterdayPercent.value = data?.vs_yesterday_percent ?? null

    inventory.value = data?.inventory ?? []
    requests.value = data?.hospital_requests ?? []

    const trends = data?.inventory_trends ?? {}
    inventoryTrends.weekly = trends.weekly ?? []
    inventoryTrends.monthly = trends.monthly ?? []
    inventoryTrends.quarterly = trends.quarterly ?? []

    componentDistributionOverride.value = data?.component_distribution ?? []
    nearExpiry.value = data?.near_expiry ?? []
    donationActivity.value = data?.recent_donations ?? []
    systemActivity.value = data?.system_activity ?? []

    // Dev note: reference dropdown data (blood types, components) — kinahanglan gikan sa
    // /blood-center/reference-data endpoint, dili hardcoded diri sa component.
    const reference = data?.reference ?? (await bloodCenterService.referenceData?.()) ?? {}
    bloodTypeOptions.value = reference?.blood_types ?? []
    componentOptions.value = reference?.components ?? []
  } catch (err) {
    console.error('Failed to load blood center dashboard:', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>

.dashboard {
  font-family: var(--rb-font-sans);
  max-width: 1200px;
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px 32px 40px;
  transition: background-color 0.2s ease;
}

/* Skeleton loading */
.skeleton {
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--header { height: 44px; max-width: 320px; }
.skeleton--card { height: 108px; }
.skeleton--panel { border-radius: 14px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.fade-in {
  animation: fadeInUp 0.45s ease both;
  animation-delay: var(--delay, 0ms);
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .fade-in, .skeleton, .stat-card, .quick-action-card { animation: none !important; transition: none !important; }
}

.dashboard-inner {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Header */
.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.page-title {
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--rb-text-primary);
  margin: 0;
}
.page-subtitle {
  font-size: 13px;
  color: var(--rb-text-secondary);
  margin: 3px 0 0;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 15px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  background: var(--rb-primary);
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.06);
  transition: opacity 0.15s ease, transform 0.15s ease;
  border: none;
  cursor: pointer;
  text-decoration: none;
  line-height: 1.2;
  font-family: inherit;
}
.btn-primary:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.btn-primary--sm { padding: 7px 13px; font-size: 12px; }

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 15px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--rb-text-primary);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  line-height: 1.2;
  font-family: inherit;
}
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-outline:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.stat-card {
  background: var(--rb-surface);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  border: 1px solid var(--rb-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.2s ease;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(var(--rb-shadow-rgb), 0.06);
  border-color: var(--rb-border-hover);
}
.stat-card--emphasized {
  border-color: rgba(var(--rb-accent-rgb), 0.25);
  box-shadow: 0 0 0 1px rgba(var(--rb-accent-rgb), 0.13), 0 4px 14px rgba(var(--rb-accent-rgb), 0.08);
}
.stat-card__top { display: flex; align-items: center; justify-content: space-between; }
.stat-card__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
  margin: 0;
}
.stat-card__badge {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-card__value { font-size: 24px; font-weight: 800; color: var(--rb-text-primary); margin: 0; line-height: 1; }
.stat-chip {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  max-width: 100%;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
}
.truncate-chip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stat-trend { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; }
.stat-trend--up { color: var(--rb-success); }
.stat-trend--down { color: var(--rb-accent); }

/* Panels */
.panel {
  background: var(--rb-surface);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  border: 1px solid var(--rb-border);
  overflow: hidden;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--rb-border);
  flex-wrap: wrap;
}
.panel-title { font-weight: 700; font-size: 14px; color: var(--rb-text-primary); margin: 0; }
.panel-subtitle { font-size: 12px; color: var(--rb-text-secondary); margin: 3px 0 0; }
.panel-link { font-size: 12px; font-weight: 600; color: var(--rb-primary); text-decoration: none; flex-shrink: 0; }
.panel-link:hover { text-decoration: underline; }

.search-box { position: relative; flex-shrink: 0; width: 200px; }
.search-box__icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--rb-text-secondary); pointer-events: none; }
.search-box__input {
  width: 100%;
  padding: 7px 10px 7px 30px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  font-size: 12.5px;
  background: var(--rb-surface-alt);
  color: var(--rb-text-primary);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.search-box__input:focus { outline: none; border-color: var(--rb-primary); background: var(--rb-surface); }

/* Inventory table */
.inventory-table-wrap { overflow-x: auto; }
.inventory-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.inventory-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--rb-text-secondary);
  padding: 10px 18px;
  background: var(--rb-surface-alt);
  white-space: nowrap;
}
.sortable-th { cursor: pointer; user-select: none; }
.sortable-th:hover { color: var(--rb-text-primary); }
.sortable-th__inner { display: inline-flex; align-items: center; gap: 4px; }
.sort-icon { opacity: 0.5; }
.sort-icon--active { opacity: 1; color: var(--rb-primary); }

.inventory-table tbody td {
  padding: 12px 18px;
  border-top: 1px solid var(--rb-surface-alt);
  color: var(--rb-text-primary);
  white-space: nowrap;
}
.inventory-row { transition: background-color 0.12s ease; }
.inventory-row:hover { background: var(--rb-surface-hover); }
.inventory-table__total { font-weight: 700; }
.inventory-table__empty { text-align: center; color: var(--rb-text-secondary); padding: 28px; white-space: normal; }

.type-pill {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent);
}
.type-pill--sm { font-size: 11px; padding: 2px 8px; }

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  text-transform: capitalize;
  transition: transform 0.12s ease;
}
.status-pill:hover { transform: translateY(-1px); }
.status-pill--sm { font-size: 11px; padding: 3px 9px; }
.status-pill__dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; flex-shrink: 0; }
.status-pill--adequate { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success); }
.status-pill--low { background: rgba(var(--rb-warning-rgb), 0.08); color: var(--rb-warning); }
.status-pill--critical { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent); }
.status-pill--pending { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }
.status-pill--processing { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary); }

/* Near-expiry row emphasis */
.expiry-row--critical td:first-child { box-shadow: inset 3px 0 0 var(--rb-accent); }
.expiry-row--low td:first-child { box-shadow: inset 3px 0 0 var(--rb-warning); }

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-primary);
  text-decoration: none;
}
.link-btn:hover { text-decoration: underline; }

/* Insights (charts) */
.insights-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.insight-card { display: flex; flex-direction: column; }

.segmented-control {
  display: inline-flex;
  padding: 3px;
  background: var(--rb-surface-alt);
  border-radius: 999px;
  gap: 2px;
  flex-shrink: 0;
}
.segmented-control__btn {
  padding: 6px 12px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  background: transparent;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease, color 0.15s ease;
}
.segmented-control__btn--active { background: var(--rb-surface); color: var(--rb-primary); box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.08); }

.chart-body { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 10px; }
.chart-legend { display: flex; gap: 16px; }
.legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--rb-text-secondary); font-weight: 600; }
.legend-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }

.line-chart-wrap { position: relative; }
.line-chart { width: 100%; height: 200px; display: block; overflow: visible; }
.chart-grid-line { stroke: var(--rb-border); stroke-width: 1; }
.chart-axis-label { font-size: 9.5px; fill: var(--rb-text-secondary); font-family: inherit; }
.hover-target { cursor: pointer; }

.chart-tooltip {
  position: absolute;
  transform: translate(-50%, -115%);
  background: var(--rb-text-primary);
  color: var(--rb-surface);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 11px;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 8px 20px rgba(var(--rb-shadow-rgb), 0.18);
  z-index: 2;
}
.chart-tooltip__label { font-weight: 700; margin: 0 0 4px; }
.chart-tooltip__row { display: flex; align-items: center; gap: 5px; margin: 2px 0; }

.donut-body { padding: 16px 18px 18px; display: flex; align-items: center; gap: 22px; }
.donut-chart-wrap { position: relative; width: 160px; height: 160px; flex-shrink: 0; }
.donut-chart { width: 100%; height: 100%; }
.donut-segment { transition: opacity 0.15s ease; cursor: pointer; }
.donut-segment--dim { opacity: 0.35; }
.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  pointer-events: none;
}
.donut-center__value { font-size: 20px; font-weight: 800; color: var(--rb-text-primary); margin: 0; }
.donut-center__label { font-size: 10.5px; color: var(--rb-text-secondary); margin: 2px 0 0; max-width: 90px; }

.donut-legend { display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 0; }
.donut-legend__row { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px; border-radius: 8px; transition: background 0.12s ease; }
.donut-legend__row:hover { background: var(--rb-surface-alt); }
.donut-legend__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); flex: 1; }
.donut-legend__value { font-size: 11.5px; color: var(--rb-text-secondary); flex-shrink: 0; }

/* Hospital requests */
.request-list { display: flex; flex-direction: column; }
.request-item { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 18px; border-top: 1px solid var(--rb-surface-alt); }
.request-item:first-child { border-top: none; }
.request-item__left { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }

.hospital-avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
}

.request-info { min-width: 0; }
.request-info__row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.request-hospital { font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.urgency-pill { font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px; text-transform: capitalize; flex-shrink: 0; }
.urgency-pill--urgent { background: rgba(var(--rb-warning-rgb), 0.08); color: var(--rb-warning); }
.urgency-pill--routine { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary); }
.urgency-pill--emergency { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent); }

.request-meta { font-size: 11.5px; color: var(--rb-text-secondary); margin: 4px 0 0; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.request-item__right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.empty-state { padding: 28px; text-align: center; color: var(--rb-text-secondary); font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 8px; }

/* Inventory health summary */
.health-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.health-card {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.health-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(var(--rb-shadow-rgb), 0.06); }
.health-card__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--rb-surface-alt);
}
.health-card--healthy .health-card__icon { background: rgba(var(--rb-success-rgb), 0.08); }
.health-card--low .health-card__icon { background: rgba(var(--rb-warning-rgb), 0.08); }
.health-card--critical .health-card__icon { background: rgba(var(--rb-accent-rgb), 0.08); }
.health-card__value { font-size: 22px; font-weight: 800; color: var(--rb-text-primary); margin: 0; line-height: 1.1; }
.health-card__label { font-size: 12.5px; font-weight: 700; color: var(--rb-text-primary); margin: 3px 0 0; }
.health-card__desc { font-size: 11.5px; color: var(--rb-text-secondary); margin: 2px 0 0; }

/* Timeline (recent donation activity) */
.timeline { display: flex; flex-direction: column; }
.timeline-item { display: flex; align-items: flex-start; gap: 12px; padding: 13px 18px; border-top: 1px solid var(--rb-surface-alt); }
.timeline-item:first-child { border-top: none; }
.timeline-item__marker {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.timeline-item__body { flex: 1; min-width: 0; }
.timeline-item__row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.timeline-item__name { font-size: 13px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.timeline-item__meta { font-size: 11.5px; color: var(--rb-text-secondary); margin: 3px 0 0; }
.verified-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--rb-success);
  background: rgba(var(--rb-success-rgb), 0.08);
  padding: 2px 7px;
  border-radius: 999px;
}

/* Activity feed */
.activity-feed { display: flex; flex-direction: column; }
.activity-feed__item { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-top: 1px solid var(--rb-surface-alt); }
.activity-feed__item:first-child { border-top: none; }
.activity-feed__icon { width: 30px; height: 30px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.activity-feed__body { flex: 1; min-width: 0; }
.activity-feed__title { font-size: 12.5px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.activity-feed__desc { font-size: 11.5px; color: var(--rb-text-secondary); margin: 2px 0 0; }
.activity-feed__time { font-size: 11px; color: var(--rb-text-secondary); flex-shrink: 0; white-space: nowrap; }

/* Quick actions */
.quick-actions-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; padding: 18px; }
.quick-action-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.quick-action-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(var(--rb-shadow-rgb), 0.08);
  border-color: var(--rb-border-hover);
  background: var(--rb-surface);
}
.quick-action-card:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.quick-action-card__icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(var(--rb-primary-rgb), 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}
.quick-action-card__label { font-size: 13px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.quick-action-card__desc { font-size: 11.5px; color: var(--rb-text-secondary); margin: 0; }

/* Modals */
.modal-overlay { position: fixed; inset: 0; background: var(--rb-overlay); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 1000; }
.modal-card { background: var(--rb-surface); border-radius: 16px; padding: 24px; width: 100%; max-width: 400px; box-shadow: 0 20px 50px rgba(var(--rb-shadow-rgb), 0.25); position: relative; }
.modal-card .btn-primary { color: #ffffff; background: var(--rb-primary); }
.modal-card .btn-primary:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
.modal-card .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.modal-card .btn-outline { color: var(--rb-text-primary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong); }
.modal-card .btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.modal-card .btn-outline:disabled { opacity: 0.6; cursor: not-allowed; }
.modal-card--form { max-width: 460px; }
.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--rb-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
}
.modal-close:hover { background: var(--rb-surface-alt); }
.modal-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(var(--rb-primary-rgb), 0.08); display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
.modal-title { font-size: 16px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 6px; }
.modal-title--left { margin-top: 4px; }
.modal-subtitle { font-size: 12.5px; color: var(--rb-text-secondary); margin: 0 0 20px; }
.modal-subtitle--left { margin-bottom: 18px; }
.modal-actions { display: flex; gap: 10px; margin-top: 4px; }
.modal-actions__btn { flex: 1; }

/* Donation form */
.donation-form { display: flex; flex-direction: column; gap: 14px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field__label { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); }
.form-field__input {
  padding: 9px 12px;
  border-radius: 9px;
  border: 1px solid var(--rb-border-strong);
  font-size: 13px;
  color: var(--rb-text-primary);
  background: var(--rb-surface);
  transition: border-color 0.15s ease;
  font-family: inherit;
}
.form-field__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.08); }
.form-field__input::placeholder { color: var(--rb-placeholder); }
.form-field__select {
  appearance: none;
  background: var(--rb-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E") no-repeat right 12px center;
}
.form-field__textarea { resize: vertical; min-height: 64px; }
.form-error { font-size: 12px; color: var(--rb-accent); margin: -6px 0 0; }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

/* Responsive */
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .insights-grid { grid-template-columns: 1fr; }
  .health-grid { grid-template-columns: 1fr; }
  .quick-actions-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 640px) {
  .dashboard { padding: 16px 16px 32px; }
  .header-row { flex-direction: column; align-items: stretch; }
  .header-actions { justify-content: space-between; }
  .panel-header { flex-direction: column; align-items: stretch; }
  .search-box { width: 100%; }
  .request-item { flex-direction: column; align-items: stretch; }
  .request-item__right { justify-content: space-between; }
  .form-row { grid-template-columns: 1fr; }
  .donut-body { flex-direction: column; }
  .quick-actions-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>