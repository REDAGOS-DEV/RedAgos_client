<template>
  <div class="inv-page">
    <!-- Skeleton loading state -->
    <div v-if="loading" class="inv-inner">
      <div class="skeleton skeleton--header" />
      <div class="type-grid">
        <div class="skeleton skeleton--type" v-for="n in 8" :key="n" />
      </div>
      <div class="skeleton skeleton--toolbar" />
      <div class="stats-grid">
        <div class="skeleton skeleton--card" v-for="n in 4" :key="n" />
      </div>
      <div class="skeleton skeleton--panel" style="height:360px" />
      <div class="insights-grid">
        <div class="skeleton skeleton--panel" style="height:280px" />
        <div class="skeleton skeleton--panel" style="height:280px" />
      </div>
    </div>
    <!-- ============ HEADER ============ -->
    <div v-else class="inv-inner">
      <div class="fade-in" style="--delay: 0ms">
        <div class="header-row">
          <div>
            <h1 class="page-title">Blood Inventory</h1>
            <p class="page-subtitle">Manage and monitor all blood units across all blood components and blood types.</p>
          </div>
          <div class="header-actions">
            <button type="button" class="btn-outline" @click="syncInventory" :disabled="syncing">
              <AssetIcon name="refresh-cw" :size="14" :class="{ 'spin-icon': syncing }" />
              {{ syncing ? 'Syncing…' : 'Sync Inventory' }}
            </button>
            <button type="button" class="btn-primary" @click="openAddBatchModal">
              <AssetIcon name="plus" :size="15" />
              Add Inventory Batch
            </button>
          </div>
        </div>
      </div>

      <!-- ============ EXPIRY ALERT ============ -->
      <div v-if="expiryAlert.visible && expiringBatches.length" class="alert-banner fade-in" style="--delay: 40ms">
        <div class="alert-banner__icon">
          <AssetIcon name="alert-triangle" :size="18" style="color: var(--rb-warning)" />
        </div>
        <div class="alert-banner__body">
          <p class="alert-banner__title">Attention Required</p>
          <p class="alert-banner__desc">
            {{ expiringBatches.length }} blood inventory batch{{ expiringBatches.length !== 1 ? 'es' : '' }} will expire within the next 3 days.
          </p>
          <div class="alert-banner__list">
            <span v-for="b in expiringBatches.slice(0, 4)" :key="b.id" class="alert-banner__chip">
              {{ b.blood_type }} {{ b.component }}
            </span>
            <span v-if="expiringBatches.length > 4" class="alert-banner__chip alert-banner__chip--muted">
              +{{ expiringBatches.length - 4 }} more
            </span>
          </div>
        </div>
        <div class="alert-banner__actions">
          <button type="button" class="btn-primary btn-primary--sm" @click="scrollToNearExpiry">View Expiring Inventory</button>
          <button type="button" class="alert-banner__dismiss" @click="expiryAlert.visible = false">
            <AssetIcon name="x" :size="15" />
          </button>
        </div>
      </div>

      <!-- ============ INTERACTIVE BLOOD TYPE SUMMARY ============ -->
      <div class="type-grid fade-in" style="--delay: 80ms">
        <button
          v-for="bt in bloodTypeSummary"
          :key="bt.blood_type"
          type="button"
          class="type-card"
          :class="{ 'type-card--active': activeBloodType === bt.blood_type }"
          @click="toggleBloodTypeFilter(bt.blood_type)"
        >
          <div class="type-card__top">
            <span class="type-card__type">{{ bt.blood_type }}</span>
            <span class="health-badge" :class="`health-badge--${bt.health}`">{{ healthLabel(bt.health) }}</span>
          </div>
          <p class="type-card__units">{{ bt.total_units }} <span class="type-card__units-label">units</span></p>
          <div class="progress-track">
            <div class="progress-fill" :class="`progress-fill--${bt.health}`" :style="{ width: bt.progress + '%' }" />
          </div>
          <p class="type-card__updated">Updated {{ bt.last_updated || '—' }}</p>
        </button>
      </div>

      <!-- ============ SEARCH & FILTER BAR ============ -->
      <div class="panel toolbar fade-in" style="--delay: 110ms">
        <div class="toolbar__row">
          <div class="search-box search-box--lg">
            <AssetIcon name="search" :size="14" class="search-box__icon" />
            <input v-model="filters.search" type="text" placeholder="Search inventory…" class="search-box__input" />
          </div>

          <select v-model="filters.bloodType" class="filter-select">
            <option value="">Blood Type</option>
            <option v-for="t in bloodTypeOptions" :key="t" :value="t">{{ t }}</option>
          </select>

          <select v-model="filters.component" class="filter-select">
            <option value="">Component</option>
            <option v-for="c in componentOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>

          <select v-model="filters.status" class="filter-select">
            <option value="">Inventory Status</option>
            <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>

          <select v-model="filters.storageLocation" class="filter-select">
            <option value="">Storage Location</option>
            <option v-for="loc in storageLocationOptions" :key="loc" :value="loc">{{ loc }}</option>
          </select>

          <select v-model="filters.expiryStatus" class="filter-select">
            <option value="">Expiry Status</option>
            <option value="expired">Expired</option>
            <option value="today">Expiring Today</option>
            <option value="3days">Within 3 Days</option>
            <option value="7days">Within 7 Days</option>
            <option value="ok">Not Near Expiry</option>
          </select>

          <select v-model="filters.sortBy" class="filter-select">
            <option value="last_updated">Sort: Last Updated</option>
            <option value="expiry_date">Sort: Expiry Date</option>
            <option value="blood_type">Sort: Blood Type</option>
            <option value="available_units">Sort: Available Units</option>
          </select>
        </div>

        <div class="toolbar__row toolbar__row--end">
          <button type="button" class="btn-outline btn-outline--sm" @click="resetFilters">Reset Filters</button>
          <button type="button" class="btn-primary btn-primary--sm" @click="applyFilters">Apply Filters</button>
        </div>

        <p class="toolbar__summary">
          Showing {{ filteredBatches.length }} inventory record{{ filteredBatches.length !== 1 ? 's' : '' }}
          <span v-if="lastSyncedLabel"> &middot; Updated {{ lastSyncedLabel }}</span>
          <span v-if="activeFilterCount"> &middot; {{ activeFilterCount }} active filter{{ activeFilterCount !== 1 ? 's' : '' }}</span>
        </p>
      </div>

      <!-- ============ INVENTORY HEALTH SUMMARY ============ -->
      <div class="stats-grid fade-in" style="--delay: 140ms">
        <div class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Total Inventory</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-primary-rgb), 0.08)' }">
              <AssetIcon name="database" :size="14" style="color: var(--rb-primary)" />
            </div>
          </div>
          <p class="stat-card__value">{{ totalInventoryUnits === null ? '—' : totalInventoryUnits }}</p>
          <span class="stat-chip stat-chip--neutral">Units on hand</span>
        </div>

        <div class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Healthy Inventory</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-success-rgb), 0.08)' }">
              <AssetIcon name="shield-check" :size="14" style="color: var(--rb-success)" />
            </div>
          </div>
          <p class="stat-card__value">{{ healthyBatchCount }}</p>
          <span class="stat-chip stat-chip--neutral">Batches at safe levels</span>
        </div>

        <div class="stat-card">
          <div class="stat-card__top">
            <p class="stat-card__label">Reserved Inventory</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-purple-rgb), 0.08)' }">
              <AssetIcon name="lock" :size="14" style="color: var(--rb-purple)" />
            </div>
          </div>
          <p class="stat-card__value">{{ totalReservedUnits === null ? '—' : totalReservedUnits }}</p>
          <span class="stat-chip stat-chip--neutral">Units held for hospitals</span>
        </div>

        <div class="stat-card" :class="{ 'stat-card--emphasized': expiringSoonCount > 0 }">
          <div class="stat-card__top">
            <p class="stat-card__label">Expiring Soon</p>
            <div class="stat-card__badge" :style="{ background: 'rgba(var(--rb-warning-rgb), 0.08)' }">
              <AssetIcon name="clock" :size="14" style="color: var(--rb-warning)" />
            </div>
          </div>
          <p class="stat-card__value" :style="expiringSoonCount ? { color: 'var(--rb-warning)' } : {}">{{ expiringSoonCount }}</p>
          <span class="stat-chip stat-chip--neutral">Within 7 days</span>
        </div>
      </div>

      <!-- ============ MAIN INVENTORY TABLE ============ -->
      <div ref="inventoryTableSection" class="panel fade-in" style="--delay: 180ms">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Inventory Records</h2>
            <p class="panel-subtitle">Batch-level view of every unit currently tracked.</p>
          </div>
        </div>

        <div v-if="!paginatedBatches.length" class="empty-state">
          <AssetIcon name="inbox" :size="40" style="color: var(--rb-border-strong)" />
          <p class="empty-state__title">No Inventory Found</p>
          <p class="empty-state__desc">No blood inventory matches your current filters.</p>
          <button type="button" class="btn-primary" @click="openAddBatchModal">
            <AssetIcon name="plus" :size="14" />
            Add Inventory Batch
          </button>
        </div>

        <div v-else class="inventory-table-wrap">
          <table class="inventory-table">
            <thead>
              <tr>
                <th class="expand-col" />
                <th>Batch ID</th>
                <th>Blood Type</th>
                <th>Component</th>
                <th>Available</th>
                <th>Reserved</th>
                <th>Collection Date</th>
                <th>Expiry Date</th>
                <th>Storage Location</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in paginatedBatches" :key="row.id">
                <tr class="inventory-row" @click="toggleExpand(row.id)">
                  <td class="expand-col">
                    <AssetIcon :name="expandedRowId === row.id ? 'chevron-down' : 'chevron-right'" :size="14" style="color: var(--rb-text-secondary)" />
                  </td>
                  <td class="mono-cell">{{ row.batch_id }}</td>
                  <td><span class="type-pill">{{ row.blood_type }}</span></td>
                  <td>{{ row.component }}</td>
                  <td>{{ row.available_units }}</td>
                  <td>{{ row.reserved_units }}</td>
                  <td>{{ formatDate(row.collection_date) }}</td>
                  <td>{{ formatDate(row.expiry_date) }}</td>
                  <td>{{ row.storage_location || '—' }}</td>
                  <td>
                    <span class="status-pill" :class="`status-pill--${row.status}`">
                      <span class="status-pill__dot" />
                      {{ statusLabel(row.status) }}
                    </span>
                  </td>
                  <td>{{ row.last_updated || '—' }}</td>
                  <td class="actions-col" @click.stop>
                    <div class="row-menu">
                      <button type="button" class="row-menu__trigger" @click="toggleRowMenu(row.id)">
                        <AssetIcon name="move-vertical" :size="16" />
                      </button>
                      <div v-if="openMenuId === row.id" class="row-menu__dropdown" @click.stop>
                        <button type="button" class="row-menu__item" @click="handleRowAction('view', row)">
                          <AssetIcon name="eye" :size="13" /> View Details
                        </button>
                        <button type="button" class="row-menu__item" @click="handleRowAction('edit', row)">
                          <AssetIcon name="pencil" :size="13" /> Edit Inventory
                        </button>
                        <button type="button" class="row-menu__item" @click="handleRowAction('reserve', row)">
                          <AssetIcon name="lock" :size="13" /> Reserve Units
                        </button>
                        <button type="button" class="row-menu__item" @click="handleRowAction('release', row)">
                          <AssetIcon name="unlock" :size="13" /> Release Units
                        </button>
                        <button type="button" class="row-menu__item" @click="handleRowAction('transfer', row)">
                          <AssetIcon name="send" :size="13" /> Transfer Inventory
                        </button>
                        <button type="button" class="row-menu__item" @click="handleRowAction('print', row)">
                          <AssetIcon name="printer" :size="13" /> Print Label
                        </button>
                        <button type="button" class="row-menu__item" @click="handleRowAction('history', row)">
                          <AssetIcon name="history" :size="13" /> View Movement History
                        </button>
                        <button type="button" class="row-menu__item" @click="handleRowAction('mark-expiring', row)">
                          <AssetIcon name="alert-triangle" :size="13" /> Mark as Expiring
                        </button>
                        <div class="row-menu__divider" />
                        <button type="button" class="row-menu__item row-menu__item--danger" @click="handleRowAction('archive', row)">
                          <AssetIcon name="archive" :size="13" /> Archive Inventory
                        </button>
                        <button type="button" class="row-menu__item row-menu__item--danger" @click="handleRowAction('discard', row)">
                          <AssetIcon name="trash-2" :size="13" /> Discard Inventory
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>

                <tr v-if="expandedRowId === row.id" class="expanded-row">
                  <td :colspan="12">
                    <div class="expanded-panel">
                      <div class="expanded-col">
                        <p class="expanded-col__title">Inventory Overview</p>
                        <dl class="expanded-dl">
                          <div><dt>Batch Number</dt><dd>{{ row.batch_number || row.batch_id }}</dd></div>
                          <div><dt>Collection Source</dt><dd>{{ row.donation_source || '—' }}</dd></div>
                          <div><dt>Storage Location</dt><dd>{{ row.storage_location || '—' }}</dd></div>
                          <div><dt>Notes</dt><dd>{{ row.notes || '—' }}</dd></div>
                        </dl>
                      </div>
                      <div class="expanded-col">
                        <p class="expanded-col__title">Expiry Timeline</p>
                        <p class="expanded-timeline">
                          <span>{{ formatDate(row.collection_date) }}</span>
                          <span class="expanded-timeline__bar" />
                          <span>{{ formatDate(row.expiry_date) }}</span>
                        </p>
                        <p class="expanded-col__note">{{ daysRemainingLabel(row.expiry_date) }}</p>

                        <p class="expanded-col__title expanded-col__title--spaced">Reserved History</p>
                        <div v-if="row.reserved_history?.length" class="expanded-list">
                          <p v-for="(h, i) in row.reserved_history" :key="i" class="expanded-list__row">{{ h.hospital }} &middot; {{ h.units }} units &middot; {{ h.date }}</p>
                        </div>
                        <p v-else class="expanded-col__note">No reservation history</p>
                      </div>
                      <div class="expanded-col">
                        <p class="expanded-col__title">Hospital Allocation</p>
                        <div v-if="row.hospital_allocation?.length" class="expanded-list">
                          <p v-for="(a, i) in row.hospital_allocation" :key="i" class="expanded-list__row">{{ a.hospital }} &middot; {{ a.units }} units</p>
                        </div>
                        <p v-else class="expanded-col__note">No current allocations</p>

                        <p class="expanded-col__title expanded-col__title--spaced">Movement Timeline</p>
                        <div v-if="row.movement_history?.length" class="expanded-list">
                          <p v-for="(m, i) in row.movement_history" :key="i" class="expanded-list__row">{{ m.action }} &middot; {{ m.date }}</p>
                        </div>
                        <p v-else class="expanded-col__note">No recorded movement yet</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div v-if="paginatedBatches.length" class="pagination">
          <p class="pagination__summary">Page {{ page }} of {{ totalPages }}</p>
          <div class="pagination__controls">
            <button type="button" class="btn-outline btn-outline--sm" :disabled="page <= 1" @click="page--">Previous</button>
            <button type="button" class="btn-outline btn-outline--sm" :disabled="page >= totalPages" @click="page++">Next</button>
          </div>
        </div>
      </div>

      <!-- ============ INVENTORY INSIGHTS ============ -->
      <div class="insights-grid fade-in" style="--delay: 220ms">
        <div class="panel insight-card">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Inventory Trend</h2>
              <p class="panel-subtitle">Movement of available vs. reserved units over time.</p>
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
            <p>No trend data available yet</p>
          </div>

          <div v-else class="chart-body">
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-dot" style="background: var(--rb-primary)" />Available Units</span>
              <span class="legend-item"><span class="legend-dot" style="background: var(--rb-accent)" />Reserved Units</span>
            </div>

            <div class="line-chart-wrap" @mouseleave="hoveredPointIndex = null">
              <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="line-chart" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="invAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--rb-primary)" stop-opacity="0.16" />
                    <stop offset="100%" stop-color="var(--rb-primary)" stop-opacity="0" />
                  </linearGradient>
                </defs>

                <line v-for="(g, i) in gridLines" :key="i" :x1="chartPadding.left" :x2="chartWidth - chartPadding.right" :y1="g" :y2="g" class="chart-grid-line" />

                <path :d="areaPath" fill="url(#invAreaFill)" stroke="none" />
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

        <div class="panel insight-card">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Blood Component Distribution</h2>
              <p class="panel-subtitle">Percentage and total units by component.</p>
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

      <!-- ============ NEAR EXPIRY INVENTORY ============ -->
      <div ref="nearExpirySection" class="panel fade-in" style="--delay: 260ms">
        <div class="panel-header">
          <h2 class="panel-title">Expiring Soon</h2>
        </div>

        <div v-if="!nearExpiryBatches.length" class="empty-state">
          <AssetIcon name="clock" :size="36" style="color: var(--rb-border-strong)" />
          <p>No units nearing expiry</p>
        </div>

        <div v-else class="inventory-table-wrap">
          <table class="inventory-table">
            <thead>
              <tr>
                <th>Blood Type</th>
                <th>Component</th>
                <th>Batch ID</th>
                <th>Remaining Units</th>
                <th>Expiry Date</th>
                <th>Days Remaining</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in nearExpiryBatches" :key="row.id" class="inventory-row" :class="`expiry-row--${expiryTier(row.days_remaining)}`">
                <td><span class="type-pill">{{ row.blood_type }}</span></td>
                <td>{{ row.component }}</td>
                <td class="mono-cell">{{ row.batch_id }}</td>
                <td>{{ row.available_units }}</td>
                <td>{{ formatDate(row.expiry_date) }}</td>
                <td>{{ row.days_remaining <= 0 ? 'Today' : `${row.days_remaining} day${row.days_remaining !== 1 ? 's' : ''}` }}</td>
                <td>
                  <button type="button" class="link-btn" @click="openBatchDetail(row)">
                    <AssetIcon name="eye" :size="13" /> View Inventory
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ============ RECENT INVENTORY ACTIVITY ============ -->
      <div class="panel fade-in" style="--delay: 300ms">
        <div class="panel-header">
          <h2 class="panel-title">Recent Inventory Activity</h2>
        </div>

        <div v-if="!activityLog.length" class="empty-state">
          <AssetIcon name="activity" :size="36" style="color: var(--rb-border-strong)" />
          <p>No recent activity</p>
        </div>

        <div v-else class="timeline">
          <div v-for="item in activityLog" :key="item.id" class="timeline-item">
            <div class="timeline-item__marker" :style="{ background: `rgba(var(--rb-${item.tone || 'primary'}-rgb), 0.08)` }">
              <AssetIcon :name="item.icon" :size="13" :style="{ color: `var(--rb-${item.tone || 'primary'})` }" />
            </div>
            <div class="timeline-item__body">
              <p class="timeline-item__name">{{ item.title }}</p>
              <p class="timeline-item__meta">{{ item.description }}</p>
            </div>
            <div class="timeline-item__right">
              <p class="activity-feed__time">{{ item.time }}</p>
              <p class="timeline-item__user">{{ item.user || '—' }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ QUICK ACTIONS ============ -->
      <div class="panel fade-in" style="--delay: 340ms">
        <div class="panel-header">
          <h2 class="panel-title">Quick Actions</h2>
        </div>

        <div class="quick-actions-body">
          <div class="quick-actions-group">
            <p class="quick-actions-group__label">Primary Operations</p>
            <div class="quick-actions-grid quick-actions-grid--primary">
              <button
                v-for="action in primaryQuickActions"
                :key="action.label"
                type="button"
                class="quick-action-card quick-action-card--primary"
                @click="handleQuickAction(action)"
              >
                <div class="quick-action-card__icon quick-action-card__icon--primary">
                  <AssetIcon :name="action.icon" :size="20" style="color: var(--rb-primary)" />
                </div>
                <p class="quick-action-card__label">{{ action.label }}</p>
                <p class="quick-action-card__desc">{{ action.description }}</p>
              </button>
            </div>
          </div>

          <div class="quick-actions-group">
            <p class="quick-actions-group__label">Secondary Operations</p>
            <div class="quick-actions-grid quick-actions-grid--secondary">
              <button
                v-for="action in secondaryQuickActions"
                :key="action.label"
                type="button"
                class="quick-action-card"
                @click="handleQuickAction(action)"
              >
                <div class="quick-action-card__icon">
                  <AssetIcon :name="action.icon" :size="18" style="color: var(--rb-text-secondary)" />
                </div>
                <p class="quick-action-card__label">{{ action.label }}</p>
                <p class="quick-action-card__desc">{{ action.description }}</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ ADD / EDIT INVENTORY BATCH MODAL ============ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="batchModalOpen" class="modal-overlay" @click.self="closeBatchModal">
          <div class="modal-card modal-card--wide" role="dialog" aria-modal="true">
            <button type="button" class="modal-close" @click="closeBatchModal">
              <AssetIcon name="x" :size="16" />
            </button>

            <h3 class="modal-title modal-title--left">{{ batchModalMode === 'edit' ? 'Edit Inventory' : 'Add Inventory Batch' }}</h3>
            <p class="modal-subtitle modal-subtitle--left">{{ batchModalMode === 'edit' ? 'Update this inventory batch record.' : 'Log a new inventory batch into the system.' }}</p>

            <form class="batch-form" @submit.prevent="submitBatchForm">
              <p class="batch-form__section">Inventory Information</p>
              <div class="form-row">
                <label class="form-field">
                  <span class="form-field__label">Blood Type *</span>
                  <select v-model="batchForm.bloodType" required class="form-field__input form-field__select">
                    <option value="" disabled>Select</option>
                    <option v-for="t in bloodTypeOptions" :key="t" :value="t">{{ t }}</option>
                  </select>
                </label>
                <label class="form-field">
                  <span class="form-field__label">Component *</span>
                  <select v-model="batchForm.component" required class="form-field__input form-field__select">
                    <option value="" disabled>Select</option>
                    <option v-for="c in componentOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
                  </select>
                </label>
              </div>
              <label class="form-field">
                <span class="form-field__label">Available Units *</span>
                <input v-model.number="batchForm.availableUnits" type="number" min="0" required class="form-field__input" />
              </label>

              <p class="batch-form__section">Collection Details</p>
              <div class="form-row">
                <label class="form-field">
                  <span class="form-field__label">Collection Date *</span>
                  <input v-model="batchForm.collectionDate" type="date" required class="form-field__input" />
                </label>
                <label class="form-field">
                  <span class="form-field__label">Expiry Date *</span>
                  <input v-model="batchForm.expiryDate" type="date" required class="form-field__input" />
                </label>
              </div>
              <label class="form-field">
                <span class="form-field__label">Donation Source</span>
                <input v-model="batchForm.donationSource" type="text" placeholder="e.g. Mobile blood drive, walk-in donor" class="form-field__input" />
              </label>

              <div class="form-row">
                <label class="form-field">
                  <span class="form-field__label">Storage Location</span>
                  <select v-model="batchForm.storageLocation" class="form-field__input form-field__select">
                    <option value="" disabled>Select</option>
                    <option v-for="loc in storageLocationOptions" :key="loc" :value="loc">{{ loc }}</option>
                  </select>
                </label>
                <label class="form-field">
                  <span class="form-field__label">Batch Number</span>
                  <input v-model="batchForm.batchNumber" type="text" placeholder="Auto-generated if left blank" class="form-field__input" />
                </label>
              </div>

              <label class="form-field">
                <span class="form-field__label">Notes</span>
                <textarea v-model="batchForm.notes" rows="3" placeholder="Optional remarks…" class="form-field__input form-field__textarea" />
              </label>

              <p v-if="batchFormError" class="form-error">{{ batchFormError }}</p>

              <div class="modal-actions">
                <button type="submit" class="btn-primary modal-actions__btn" :disabled="batchSubmitting">
                  <AssetIcon name="circle-check" :size="15" />
                  {{ batchSubmitting ? 'Saving…' : (batchModalMode === 'edit' ? 'Save Changes' : 'Add Batch') }}
                </button>
                <button type="button" class="btn-outline modal-actions__btn" @click="closeBatchModal" :disabled="batchSubmitting">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ============ MANAGE INVENTORY MODAL ============ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="manageModalOpen" class="modal-overlay" @click.self="closeManageModal">
          <div class="modal-card modal-card--wide" role="dialog" aria-modal="true">
            <button type="button" class="modal-close" @click="closeManageModal">
              <AssetIcon name="x" :size="16" />
            </button>

            <h3 class="modal-title modal-title--left">Manage Inventory</h3>
            <p class="modal-subtitle modal-subtitle--left" v-if="manageTargetBatch">
              {{ manageTargetBatch.batch_id }} &middot; {{ manageTargetBatch.blood_type }} {{ manageTargetBatch.component }}
            </p>

            <div class="manage-actions-grid">
              <button type="button" class="manage-action-card" @click="runManageAction('reserve')">
                <AssetIcon name="lock" :size="18" style="color: var(--rb-primary)" />
                <span>Reserve Inventory</span>
              </button>
              <button type="button" class="manage-action-card" @click="runManageAction('release')">
                <AssetIcon name="unlock" :size="18" style="color: var(--rb-primary)" />
                <span>Release Inventory</span>
              </button>
              <button type="button" class="manage-action-card" @click="runManageAction('transfer')">
                <AssetIcon name="send" :size="18" style="color: var(--rb-primary)" />
                <span>Transfer Inventory</span>
              </button>
              <button type="button" class="manage-action-card" @click="runManageAction('print')">
                <AssetIcon name="printer" :size="18" style="color: var(--rb-primary)" />
                <span>Print Label</span>
              </button>
              <button type="button" class="manage-action-card manage-action-card--danger" @click="runManageAction('archive')">
                <AssetIcon name="archive" :size="18" style="color: var(--rb-accent)" />
                <span>Archive Inventory</span>
              </button>
              <button type="button" class="manage-action-card manage-action-card--danger" @click="runManageAction('discard')">
                <AssetIcon name="trash-2" :size="18" style="color: var(--rb-accent)" />
                <span>Discard Inventory</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ============ PRINT LABELS MODAL ============ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="printModalOpen" class="modal-overlay" @click.self="closePrintLabelsModal">
          <div class="modal-card modal-card--wide" role="dialog" aria-modal="true">
            <button type="button" class="modal-close" @click="closePrintLabelsModal">
              <AssetIcon name="x" :size="16" />
            </button>

            <h3 class="modal-title modal-title--left">Print Labels</h3>
            <p class="modal-subtitle modal-subtitle--left">Select batches, set quantity, and preview before printing.</p>

            <div v-if="!printableBatches.length" class="empty-state">
              <AssetIcon name="printer" :size="32" style="color: var(--rb-border-strong)" />
              <p>No available batches to print labels for.</p>
            </div>

            <template v-else>
              <div class="print-batch-list">
                <label v-for="b in printableBatches" :key="b.id" class="print-batch-row">
                  <input type="checkbox" :checked="printSelectedIds.includes(b.id)" @change="togglePrintSelection(b)" />
                  <div class="print-batch-row__info">
                    <p class="print-batch-row__title">{{ b.batch_id }} &middot; {{ b.blood_type }} {{ b.component }}</p>
                    <p class="print-batch-row__meta">Collected {{ formatDate(b.collection_date) }} &middot; Expires {{ formatDate(b.expiry_date) }}</p>
                  </div>
                  <input
                    v-if="printSelectedIds.includes(b.id)"
                    type="number"
                    min="1"
                    :max="b.available_units"
                    v-model.number="printQuantities[b.id]"
                    class="print-batch-row__qty"
                    @click.stop
                  />
                </label>
              </div>

              <div v-if="printSelectedIds.length" class="print-preview">
                <p class="expanded-col__title">Label Preview</p>
                <div class="print-preview__grid">
                  <div v-for="id in printSelectedIds" :key="id" class="print-label-card">
                    <p class="print-label-card__type">{{ inventoryBatches.find(b => b.id === id)?.blood_type }}</p>
                    <p class="print-label-card__meta">{{ inventoryBatches.find(b => b.id === id)?.component }}</p>
                    <p class="print-label-card__meta">{{ inventoryBatches.find(b => b.id === id)?.batch_id }}</p>
                    <p class="print-label-card__meta">Exp {{ formatDate(inventoryBatches.find(b => b.id === id)?.expiry_date) }}</p>
                    <div class="print-label-card__barcode" />
                  </div>
                </div>
              </div>

              <div class="modal-actions">
                <button
                  type="button"
                  class="btn-primary modal-actions__btn"
                  :disabled="!printSelectedIds.length || printSubmitting"
                  @click="submitPrintLabels"
                >
                  <AssetIcon name="printer" :size="15" />
                  {{ printSubmitting ? 'Preparing…' : 'Generate & Print' }}
                </button>
                <button type="button" class="btn-outline modal-actions__btn" @click="closePrintLabelsModal" :disabled="printSubmitting">Cancel</button>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ============ INVENTORY DETAIL DRAWER (View Details) ============ -->
    <Teleport to="body">
      <Transition name="drawer-fade">
        <div v-if="drawerOpen" class="drawer-overlay" @click.self="closeDetailsDrawer">
          <aside class="detail-drawer" role="dialog" aria-modal="true" aria-label="Inventory batch details">
            <header class="detail-drawer__header">
              <div>
                <p class="detail-drawer__eyebrow">{{ drawerBatch?.batch_id }}</p>
                <h2 class="detail-drawer__title">{{ drawerBatch?.blood_type }} &middot; {{ drawerBatch?.component }}</h2>
              </div>
              <button type="button" class="modal-close" @click="closeDetailsDrawer">
                <AssetIcon name="x" :size="16" />
              </button>
            </header>

            <div v-if="drawerBatch" class="detail-drawer__body">
              <section class="detail-drawer__section">
                <p class="expanded-col__title">Inventory Overview</p>
                <dl class="drawer-info-grid">
                  <div><dt>Blood Type</dt><dd>{{ drawerBatch.blood_type }}</dd></div>
                  <div><dt>Component</dt><dd>{{ drawerBatch.component }}</dd></div>
                  <div><dt>Available Units</dt><dd>{{ drawerBatch.available_units }}</dd></div>
                  <div><dt>Reserved Units</dt><dd>{{ drawerBatch.reserved_units }}</dd></div>
                  <div><dt>Batch Number</dt><dd>{{ drawerBatch.batch_number || drawerBatch.batch_id }}</dd></div>
                  <div><dt>Collection Source</dt><dd>{{ drawerBatch.donation_source || '—' }}</dd></div>
                  <div><dt>Storage Location</dt><dd>{{ drawerBatch.storage_location || '—' }}</dd></div>
                  <div><dt>Collection Date</dt><dd>{{ formatDate(drawerBatch.collection_date) }}</dd></div>
                  <div><dt>Expiry Date</dt><dd>{{ formatDate(drawerBatch.expiry_date) }}</dd></div>
                  <div>
                    <dt>Inventory Status</dt>
                    <dd>
                      <span class="status-pill" :class="`status-pill--${drawerBatch.status}`">
                        <span class="status-pill__dot" />{{ statusLabel(drawerBatch.status) }}
                      </span>
                    </dd>
                  </div>
                </dl>
              </section>

              <section class="detail-drawer__section">
                <p class="expanded-col__title">Reserved History</p>
                <div v-if="drawerBatch.reserved_history?.length" class="expanded-list">
                  <p v-for="(h, i) in drawerBatch.reserved_history" :key="i" class="expanded-list__row">
                    {{ h.hospital }} &middot; {{ h.units }} units &middot; {{ h.date }}
                  </p>
                </div>
                <p v-else class="expanded-col__note">No reservation history</p>
              </section>

              <section class="detail-drawer__section">
                <p class="expanded-col__title">Hospital Allocation</p>
                <div v-if="drawerBatch.hospital_allocation?.length" class="expanded-list">
                  <p v-for="(a, i) in drawerBatch.hospital_allocation" :key="i" class="expanded-list__row">
                    {{ a.hospital }} &middot; {{ a.units }} units
                  </p>
                </div>
                <p v-else class="expanded-col__note">No current allocations</p>
              </section>

              <section class="detail-drawer__section">
                <p class="expanded-col__title">Movement Timeline</p>
                <div v-if="drawerBatch.movement_history?.length" class="expanded-list">
                  <p v-for="(m, i) in drawerBatch.movement_history" :key="i" class="expanded-list__row">
                    {{ m.action }} &middot; {{ m.date }}
                  </p>
                </div>
                <p v-else class="expanded-col__note">No recorded movement yet</p>
              </section>
            </div>

            <footer v-if="drawerBatch" class="detail-drawer__footer">
              <button type="button" class="btn-outline" @click="editFromDrawer">
                <AssetIcon name="pencil" :size="14" /> Edit Inventory
              </button>
              <button type="button" class="btn-outline" @click="reserveFromDrawer">
                <AssetIcon name="lock" :size="14" /> Reserve Units
              </button>
              <button type="button" class="btn-outline" @click="transferFromDrawer">
                <AssetIcon name="send" :size="14" /> Transfer Units
              </button>
              <button type="button" class="btn-primary" @click="printFromDrawer">
                <AssetIcon name="printer" :size="14" /> Print Label
              </button>
            </footer>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { useUser } from '~/composables/useUser.js'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'inventory.view',
})

const { user } = useUser()
const facilityLabel = computed(() => user.value?.facility?.facility_name || user.value?.facility_name || 'Blood Center')

const loading = ref(true)
const syncing = ref(false)
const lastSyncedLabel = ref('')

// --- Reference/dropdown data — (/blood-center/reference-data) endpoint ---
const bloodTypeOptions = ref([])
const componentOptions = ref([])
const statusOptions = ref([])
const storageLocationOptions = ref([])

// --- Inventory batches (main dataset) ---
const inventoryBatches = ref([])

// --- Filters ---
const activeBloodType = ref('')
const filters = reactive({
  search: '',
  bloodType: '',
  component: '',
  status: '',
  storageLocation: '',
  expiryStatus: '',
  sortBy: 'last_updated',
})

const activeFilterCount = computed(() => {
  let count = 0
  if (filters.search.trim()) count++
  if (filters.bloodType) count++
  if (filters.component) count++
  if (filters.status) count++
  if (filters.storageLocation) count++
  if (filters.expiryStatus) count++
  return count
})

function toggleBloodTypeFilter(bt) {
  if (activeBloodType.value === bt) {
    activeBloodType.value = ''
    filters.bloodType = ''
  } else {
    activeBloodType.value = bt
    filters.bloodType = bt
  }
  page.value = 1
}

function resetFilters() {
  filters.search = ''
  filters.bloodType = ''
  filters.component = ''
  filters.status = ''
  filters.storageLocation = ''
  filters.expiryStatus = ''
  filters.sortBy = 'last_updated'
  activeBloodType.value = ''
  page.value = 1
}
function applyFilters() {
  page.value = 1
}

function daysRemaining(expiryDate) {
  if (!expiryDate) return null
  const expiry = new Date(expiryDate)
  if (Number.isNaN(expiry.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expiry.setHours(0, 0, 0, 0)
  return Math.round((expiry - today) / 86400000)
}

function matchesExpiryFilter(row, filterValue) {
  const d = daysRemaining(row.expiry_date)
  if (d === null) return false
  switch (filterValue) {
    case 'expired': return d < 0
    case 'today': return d === 0
    case '3days': return d >= 0 && d <= 3
    case '7days': return d >= 0 && d <= 7
    case 'ok': return d > 7
    default: return true
  }
}

const filteredBatches = computed(() => {
  const q = filters.search.trim().toLowerCase()
  let list = inventoryBatches.value.filter(row => {
    if (q) {
      const haystack = `${row.batch_id} ${row.blood_type} ${row.component} ${row.storage_location || ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (filters.bloodType && row.blood_type !== filters.bloodType) return false
    if (filters.component && row.component !== filters.component) return false
    if (filters.status && row.status !== filters.status) return false
    if (filters.storageLocation && row.storage_location !== filters.storageLocation) return false
    if (filters.expiryStatus && !matchesExpiryFilter(row, filters.expiryStatus)) return false
    return true
  })

  list = [...list].sort((a, b) => {
    const col = filters.sortBy
    if (col === 'expiry_date') return new Date(a.expiry_date) - new Date(b.expiry_date)
    if (col === 'blood_type') return a.blood_type.localeCompare(b.blood_type)
    if (col === 'available_units') return b.available_units - a.available_units
    return new Date(b.last_updated_at || 0) - new Date(a.last_updated_at || 0)
  })

  return list
})

// --- Pagination ---
const page = ref(1)
const pageSize = 10
const totalPages = computed(() => Math.max(1, Math.ceil(filteredBatches.value.length / pageSize)))
const paginatedBatches = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredBatches.value.slice(start, start + pageSize)
})

// --- Blood type summary cards ---
const bloodTypeSummary = computed(() => {
  const order = bloodTypeOptions.value.length ? bloodTypeOptions.value : []
  return order.map(bt => {
    const rows = inventoryBatches.value.filter(r => r.blood_type === bt)
    const total = rows.reduce((sum, r) => sum + (r.available_units || 0), 0)
    const criticalCount = rows.filter(r => r.status === 'critical').length
    const lowCount = rows.filter(r => r.status === 'low').length
    let health = 'healthy'
    if (criticalCount) health = 'critical'
    else if (lowCount) health = 'low'
    const maxRef = 120
    const progress = Math.min(100, Math.round((total / maxRef) * 100))
    const lastUpdated = rows
      .map(r => r.last_updated)
      .filter(Boolean)
      .sort()
      .slice(-1)[0]
    return { blood_type: bt, total_units: total, health, progress, last_updated: lastUpdated }
  })
})

function healthLabel(h) {
  const map = { healthy: 'Healthy', low: 'Low', critical: 'Critical' }
  return map[h] || h
}

// --- Inventory health summary stats ---
const totalInventoryUnits = computed(() =>
  inventoryBatches.value.length ? inventoryBatches.value.reduce((s, r) => s + (r.available_units || 0), 0) : null
)
const totalReservedUnits = computed(() =>
  inventoryBatches.value.length ? inventoryBatches.value.reduce((s, r) => s + (r.reserved_units || 0), 0) : null
)
const healthyBatchCount = computed(() => inventoryBatches.value.filter(r => r.status === 'available').length)
const expiringSoonCount = computed(() => inventoryBatches.value.filter(r => {
  const d = daysRemaining(r.expiry_date)
  return d !== null && d >= 0 && d <= 7
}).length)

function statusLabel(status) {
  const map = { available: 'Available', reserved: 'Reserved', low: 'Low', critical: 'Critical', expired: 'Expired' }
  return map[status] || status
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

function daysRemainingLabel(expiryDate) {
  const d = daysRemaining(expiryDate)
  if (d === null) return 'Expiry date not set'
  if (d < 0) return `Expired ${Math.abs(d)} day${Math.abs(d) !== 1 ? 's' : ''} ago`
  if (d === 0) return 'Expires today'
  return `${d} day${d !== 1 ? 's' : ''} remaining`
}

function expiryTier(days) {
  if (days <= 0) return 'critical'
  if (days <= 3) return 'critical'
  if (days <= 7) return 'low'
  return 'available'
}

// --- Expiry alert banner ---
const expiryAlert = reactive({ visible: true })
const expiringBatches = computed(() =>
  inventoryBatches.value.filter(r => {
    const d = daysRemaining(r.expiry_date)
    return d !== null && d >= 0 && d <= 3
  })
)
const nearExpirySection = ref(null)
function scrollToNearExpiry() {
  nearExpirySection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// --- Near expiry table (within 7 days) ---
const nearExpiryBatches = computed(() =>
  inventoryBatches.value
    .map(r => ({ ...r, days_remaining: daysRemaining(r.expiry_date) }))
    .filter(r => r.days_remaining !== null && r.days_remaining <= 7)
    .sort((a, b) => a.days_remaining - b.days_remaining)
)

// --- Row expansion (inline "Inventory Detail Expansion") ---
const expandedRowId = ref(null)
function toggleExpand(id) {
  expandedRowId.value = expandedRowId.value === id ? null : id
}

// --- Row action menu ---
const openMenuId = ref(null)
function toggleRowMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id
}

function handleRowAction(action, row) {
  openMenuId.value = null
  if (action === 'view' || action === 'history') { openDetailsDrawer(row); return }
  if (action === 'edit') { openEditBatchModal(row); return }
  if (action === 'print') { openPrintLabelsModal(row); return }
  if (['reserve', 'release', 'transfer', 'archive', 'discard'].includes(action)) {
    openManageModal(row, action)
    return
  }
  if (action === 'mark-expiring') {
    // i-connect sa /blood-center/inventory/:id/mark-expiring endpoint
    bloodCenterService.markAsExpiring?.(row.id)
  }
}

const inventoryTableSection = ref(null)
function openBatchDetail(row) {
  if (row.days_remaining <= 0) filters.expiryStatus = 'today'
  else if (row.days_remaining <= 3) filters.expiryStatus = '3days'
  else filters.expiryStatus = '7days'
  page.value = 1
  inventoryTableSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// --- Inventory detail drawer (View Details) ---
const drawerOpen = ref(false)
const drawerBatch = ref(null)
function openDetailsDrawer(row) {
  drawerBatch.value = row
  drawerOpen.value = true
  openMenuId.value = null
}
function closeDetailsDrawer() {
  drawerOpen.value = false
  drawerBatch.value = null
}
function editFromDrawer() {
  const row = drawerBatch.value
  closeDetailsDrawer()
  if (row) openEditBatchModal(row)
}
function reserveFromDrawer() {
  const row = drawerBatch.value
  closeDetailsDrawer()
  if (row) openManageModal(row, 'reserve')
}
function transferFromDrawer() {
  const row = drawerBatch.value
  closeDetailsDrawer()
  if (row) openManageModal(row, 'transfer')
}
function printFromDrawer() {
  const row = drawerBatch.value
  closeDetailsDrawer()
  if (row) openPrintLabelsModal(row)
}

// --- Inventory trend chart ---
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

// --- Component distribution donut chart ---
const donutRadius = 58
const donutCircumference = 2 * Math.PI * donutRadius
const componentDistributionOverride = ref([])
const hoveredDonut = ref(null)

const componentColorMap = {
  'Packed RBC': 'var(--rb-primary)',
  'Whole Blood': 'var(--rb-accent)',
  'Fresh Frozen Plasma': 'var(--rb-purple)',
  Platelets: 'var(--rb-teal)',
  Cryoprecipitate: 'var(--rb-warning)',
}

const computedDistribution = computed(() => {
  if (componentDistributionOverride.value.length) return componentDistributionOverride.value
  const sums = {}
  inventoryBatches.value.forEach(row => {
    const label = componentOptions.value.find(c => c.value === row.component)?.label || row.component
    sums[label] = (sums[label] || 0) + (row.available_units || 0)
  })
  return Object.entries(sums).map(([label, value]) => ({ label, value, color: componentColorMap[label] || 'var(--rb-text-secondary)' }))
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

// --- Recent inventory activity ---
const activityLog = ref([])

// --- Quick actions ---
const quickActions = [
  {
    label: 'Record Donation',
    description: 'Register newly collected blood.',
    icon: 'droplets',
    kind: 'link',
    to: '/blood-center/dashboard',
    tier: 'primary',
  },
  {
    label: 'Add Inventory Batch',
    description: 'Add collected units to inventory.',
    icon: 'plus',
    kind: 'modal',
    tier: 'primary',
  },
  {
    label: 'Transfer Units',
    description: 'Move units between supported facilities.',
    icon: 'send',
    kind: 'manage',
    tier: 'secondary',
  },
  {
    label: 'Print Labels',
    description: 'Generate and print blood unit labels.',
    icon: 'printer',
    kind: 'print',
    tier: 'secondary',
  },
  {
    label: 'Inventory Report',
    description: 'View or export inventory reports.',
    icon: 'file-text',
    kind: 'report',
    tier: 'secondary',
  },
]
const primaryQuickActions = computed(() => quickActions.filter(a => a.tier === 'primary'))
const secondaryQuickActions = computed(() => quickActions.filter(a => a.tier === 'secondary'))

function handleQuickAction(action) {
  if (action.kind === 'modal') return openAddBatchModal()
  if (action.kind === 'manage') return openManageModal(null, 'transfer')
  if (action.kind === 'print') return openPrintLabelsModal()
  if (action.kind === 'report') {
    return navigateTo('/blood-center/reports')
  }
  if (action.kind === 'link' && action.to) return navigateTo(action.to)
}

async function syncInventory() {
  syncing.value = true
  try {
    // i-connect sa /blood-center/inventory/sync endpoint
    await bloodCenterService.syncInventory?.()
    await loadDashboard()
  } catch (err) {
    console.error('Failed to sync inventory:', err)
  } finally {
    syncing.value = false
  }
}

// --- Add / Edit batch modal ---
const batchModalOpen = ref(false)
const batchModalMode = ref('add')
const batchSubmitting = ref(false)
const batchFormError = ref('')
const editingBatchId = ref(null)

const emptyBatchForm = () => ({
  bloodType: '',
  component: '',
  availableUnits: null,
  collectionDate: '',
  expiryDate: '',
  donationSource: '',
  storageLocation: '',
  batchNumber: '',
  notes: '',
})
const batchForm = reactive(emptyBatchForm())

function openAddBatchModal() {
  Object.assign(batchForm, emptyBatchForm())
  batchModalMode.value = 'add'
  editingBatchId.value = null
  batchFormError.value = ''
  batchModalOpen.value = true
}
function openEditBatchModal(row) {
  Object.assign(batchForm, {
    bloodType: row.blood_type,
    component: row.component,
    availableUnits: row.available_units,
    collectionDate: row.collection_date,
    expiryDate: row.expiry_date,
    donationSource: row.donation_source || '',
    storageLocation: row.storage_location || '',
    batchNumber: row.batch_number || '',
    notes: row.notes || '',
  })
  batchModalMode.value = 'edit'
  editingBatchId.value = row.id
  batchFormError.value = ''
  batchModalOpen.value = true
}
function closeBatchModal() {
  if (batchSubmitting.value) return
  batchModalOpen.value = false
}
async function submitBatchForm() {
  if (!batchForm.bloodType || !batchForm.component || batchForm.availableUnits === null) {
    batchFormError.value = 'Blood type, component, and available units are required.'
    return
  }
  batchSubmitting.value = true
  batchFormError.value = ''
  try {
    if (batchModalMode.value === 'edit' && editingBatchId.value) {
      // i-connect sa /blood-center/inventory/:id endpoint (PUT/PATCH)
      await bloodCenterService.updateInventoryBatch?.(editingBatchId.value, { ...batchForm })
    } else {
      // i-connect sa /blood-center/inventory endpoint (POST)
      await bloodCenterService.createInventoryBatch?.({ ...batchForm })
    }
    batchModalOpen.value = false
    await loadDashboard()
  } catch (err) {
    console.error('Failed to save inventory batch:', err)
    batchFormError.value = 'Something went wrong while saving. Please try again.'
  } finally {
    batchSubmitting.value = false
  }
}

// --- Manage inventory modal (reserve/release/transfer/archive/discard) ---
const manageModalOpen = ref(false)
const manageTargetBatch = ref(null)
function openManageModal(row, presetAction) {
  manageTargetBatch.value = row
  manageModalOpen.value = true
  if (presetAction && row) runManageAction(presetAction)
}
function closeManageModal() {
  manageModalOpen.value = false
  manageTargetBatch.value = null
}
async function runManageAction(action) {
  const row = manageTargetBatch.value
  try {
    // i-connect sa /blood-center/inventory/:id/{action} endpoints
    await bloodCenterService.manageInventoryAction?.(row?.id, action)
    if (['reserve', 'release', 'archive', 'discard'].includes(action)) {
      await loadDashboard()
    }
  } catch (err) {
    console.error(`Failed to run inventory action "${action}":`, err)
  } finally {
    manageModalOpen.value = false
  }
}

// --- Print Labels modal  ---
const printModalOpen = ref(false)
const printSelectedIds = ref([])
const printQuantities = reactive({})
const printSubmitting = ref(false)
const printableBatches = computed(() => inventoryBatches.value.filter(b => (b.available_units || 0) > 0))

function openPrintLabelsModal(presetBatch = null) {
  printSelectedIds.value = presetBatch ? [presetBatch.id] : []
  Object.keys(printQuantities).forEach(k => delete printQuantities[k])
  if (presetBatch) printQuantities[presetBatch.id] = 1
  printModalOpen.value = true
}
function closePrintLabelsModal() {
  if (printSubmitting.value) return
  printModalOpen.value = false
}
function togglePrintSelection(row) {
  const idx = printSelectedIds.value.indexOf(row.id)
  if (idx === -1) {
    printSelectedIds.value.push(row.id)
    printQuantities[row.id] = 1
  } else {
    printSelectedIds.value.splice(idx, 1)
    delete printQuantities[row.id]
  }
}
async function submitPrintLabels() {
  if (!printSelectedIds.value.length) return
  printSubmitting.value = true
  try {
    // i-connect sa /blood-center/inventory/print-labels endpoint (POST).
    // Payload: [{ batchId, quantity }]. Backend should return a barcode/PDF per
    // batch. Per spec, labels expose only batch/type/component/dates — no
    // patient or donor identifying information.
    const payload = printSelectedIds.value.map(id => ({ batchId: id, quantity: printQuantities[id] || 1 }))
    await bloodCenterService.printInventoryLabels?.(payload)
    printModalOpen.value = false
  } catch (err) {
    console.error('Failed to print labels:', err)
  } finally {
    printSubmitting.value = false
  }
}

async function loadDashboard() {
  try {
    // gikan sa /blood-center/inventory-overview endpoint — nag-uli sa tanan
    // (batches, reference data, trends, distribution, activity log). Walay hardcoded/mock
    // values diri; kung wala'y balik gikan sa API, mag-empty state na lang ang UI.
    const data = await bloodCenterService.inventoryOverview?.()

    inventoryBatches.value = data?.batches ?? []
    activityLog.value = data?.activity_log ?? []
    lastSyncedLabel.value = data?.last_synced_label ?? ''

    const trends = data?.inventory_trends ?? {}
    inventoryTrends.weekly = trends.weekly ?? []
    inventoryTrends.monthly = trends.monthly ?? []
    inventoryTrends.quarterly = trends.quarterly ?? []

    componentDistributionOverride.value = data?.component_distribution ?? []

    const reference = data?.reference ?? (await bloodCenterService.referenceData?.()) ?? {}
    bloodTypeOptions.value = reference?.blood_types ?? []
    componentOptions.value = reference?.components ?? []
    statusOptions.value = reference?.statuses ?? []
    storageLocationOptions.value = reference?.storage_locations ?? []
  } catch (err) {
    console.error('Failed to load blood inventory:', err)
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<style scoped>
.inv-page {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  max-width: 1280px;
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px 32px 40px;
  transition: background-color 0.2s ease;
}

.inv-inner { display: flex; flex-direction: column; gap: 20px; }

/* Skeleton */
.skeleton {
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--crumb { height: 16px; max-width: 180px; }
.skeleton--header { height: 44px; max-width: 340px; margin-top: 8px; }
.skeleton--type { height: 110px; border-radius: 14px; }
.skeleton--toolbar { height: 96px; }
.skeleton--card { height: 108px; }
.skeleton--panel { border-radius: 14px; }
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.fade-in { animation: fadeInUp 0.45s ease both; animation-delay: var(--delay, 0ms); }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) {
  .fade-in, .skeleton, .stat-card, .quick-action-card, .type-card, .health-card, .spin-icon, .detail-drawer { animation: none !important; transition: none !important; }
}

.header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-title { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; color: var(--rb-text-primary); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 3px 0 0; }
.header-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.spin-icon { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 15px; border-radius: 10px; font-size: 13px; font-weight: 600;
  color: #ffffff; background: var(--rb-primary); box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.06);
  transition: opacity 0.15s ease, transform 0.15s ease; border: none; cursor: pointer;
  text-decoration: none; line-height: 1.2; font-family: inherit;
}
.btn-primary:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.btn-primary--sm { padding: 7px 13px; font-size: 12px; }

.btn-outline {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 15px; border-radius: 10px; font-size: 13px; font-weight: 600;
  color: var(--rb-text-primary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong);
  cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease; line-height: 1.2; font-family: inherit;
}
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-outline:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.btn-outline--sm { padding: 7px 13px; font-size: 12px; }

/* Alert banner */
.alert-banner {
  display: flex; align-items: flex-start; gap: 14px; padding: 16px 18px; border-radius: 14px;
  background: rgba(var(--rb-warning-rgb), 0.06); border: 1px solid rgba(var(--rb-warning-rgb), 0.25);
}
.alert-banner__icon {
  width: 36px; height: 36px; border-radius: 10px; background: rgba(var(--rb-warning-rgb), 0.12);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.alert-banner__body { flex: 1; min-width: 0; }
.alert-banner__title { font-size: 13.5px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.alert-banner__desc { font-size: 12.5px; color: var(--rb-text-secondary); margin: 3px 0 8px; }
.alert-banner__list { display: flex; flex-wrap: wrap; gap: 6px; }
.alert-banner__chip {
  font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px;
  background: var(--rb-surface); border: 1px solid var(--rb-border-strong); color: var(--rb-text-primary);
}
.alert-banner__chip--muted { color: var(--rb-text-secondary); }
.alert-banner__actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.alert-banner__dismiss {
  width: 28px; height: 28px; border-radius: 8px; border: none; background: transparent;
  color: var(--rb-text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.alert-banner__dismiss:hover { background: rgba(var(--rb-warning-rgb), 0.12); }

/* Blood type summary cards */
.type-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; }
.type-card {
  display: flex; flex-direction: column; gap: 8px; text-align: left; padding: 14px;
  border-radius: 14px; background: var(--rb-surface); border: 1px solid var(--rb-border);
  cursor: pointer; font-family: inherit; transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.type-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(var(--rb-shadow-rgb), 0.06); }
.type-card--active { border-color: var(--rb-primary); background: rgba(var(--rb-primary-rgb), 0.05); box-shadow: 0 0 0 1px var(--rb-primary); }
.type-card__top { display: flex; align-items: center; justify-content: space-between; }
.type-card__type { font-size: 15px; font-weight: 800; color: var(--rb-accent); }
.type-card__units { font-size: 19px; font-weight: 800; color: var(--rb-text-primary); margin: 0; }
.type-card__units-label { font-size: 11px; font-weight: 600; color: var(--rb-text-secondary); }
.type-card__updated { font-size: 10.5px; color: var(--rb-text-secondary); margin: 0; }

.health-badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; }
.health-badge--healthy { background: rgba(var(--rb-success-rgb), 0.1); color: var(--rb-success); }
.health-badge--low { background: rgba(var(--rb-warning-rgb), 0.1); color: var(--rb-warning); }
.health-badge--critical { background: rgba(var(--rb-accent-rgb), 0.1); color: var(--rb-accent); }

.progress-track { height: 5px; border-radius: 999px; background: var(--rb-surface-alt); overflow: hidden; }
.progress-fill { height: 100%; border-radius: 999px; transition: width 0.4s ease; }
.progress-fill--healthy { background: var(--rb-success); }
.progress-fill--low { background: var(--rb-warning); }
.progress-fill--critical { background: var(--rb-accent); }

/* Toolbar */
.toolbar { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.toolbar__row { display: flex; flex-wrap: wrap; gap: 10px; }
.toolbar__row--end { justify-content: flex-end; }
.toolbar__summary { font-size: 12px; color: var(--rb-text-secondary); margin: 0; }

.search-box { position: relative; flex-shrink: 0; width: 200px; }
.search-box--lg { width: 260px; flex: 1; min-width: 200px; }
.search-box__icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--rb-text-secondary); pointer-events: none; }
.search-box__input {
  width: 100%; padding: 8px 10px 8px 30px; border-radius: 10px; border: 1px solid var(--rb-border-strong);
  font-size: 12.5px; background: var(--rb-surface-alt); color: var(--rb-text-primary); transition: border-color 0.15s ease, background 0.15s ease;
}
.search-box__input:focus { outline: none; border-color: var(--rb-primary); background: var(--rb-surface); }

.filter-select {
  padding: 8px 30px 8px 12px; border-radius: 10px; border: 1px solid var(--rb-border-strong);
  font-size: 12.5px; background: var(--rb-surface-alt) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E") no-repeat right 12px center;
  color: var(--rb-text-primary); appearance: none; font-family: inherit; cursor: pointer; transition: border-color 0.15s ease;
}
.filter-select:focus { outline: none; border-color: var(--rb-primary); }

/* Panels (shared) */
.panel { background: var(--rb-surface); border-radius: 14px; box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03); border: 1px solid var(--rb-border); overflow: hidden; transition: background-color 0.2s ease, border-color 0.2s ease; }
.panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--rb-border); flex-wrap: wrap; }
.panel-title { font-weight: 700; font-size: 14px; color: var(--rb-text-primary); margin: 0; }
.panel-subtitle { font-size: 12px; color: var(--rb-text-secondary); margin: 3px 0 0; }

/* Stats grid */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card {
  background: var(--rb-surface); border-radius: 14px; padding: 16px; box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  border: 1px solid var(--rb-border); display: flex; flex-direction: column; gap: 8px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.2s ease;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(var(--rb-shadow-rgb), 0.06); border-color: var(--rb-border-hover); }
.stat-card--emphasized { border-color: rgba(var(--rb-warning-rgb), 0.3); box-shadow: 0 0 0 1px rgba(var(--rb-warning-rgb), 0.15); }
.stat-card__top { display: flex; align-items: center; justify-content: space-between; }
.stat-card__label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rb-text-secondary); margin: 0; }
.stat-card__badge { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-card__value { font-size: 24px; font-weight: 800; color: var(--rb-text-primary); margin: 0; line-height: 1; }
.stat-chip { display: inline-flex; align-items: center; align-self: flex-start; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

/* Inventory table */
.inventory-table-wrap { overflow-x: auto; }
.inventory-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.inventory-table thead th {
  position: sticky; top: 0; z-index: 1; text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: var(--rb-text-secondary); padding: 10px 16px; background: var(--rb-surface-alt); white-space: nowrap;
}
.expand-col { width: 34px; }
.actions-col { width: 48px; text-align: right; }
.inventory-table tbody td { padding: 12px 16px; border-top: 1px solid var(--rb-surface-alt); color: var(--rb-text-primary); white-space: nowrap; }
.inventory-row { cursor: pointer; transition: background-color 0.12s ease; }
.inventory-row:hover { background: var(--rb-surface-hover); }
.mono-cell { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; }

.type-pill { display: inline-flex; align-items: center; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent); }

.status-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 999px; text-transform: capitalize; }
.status-pill__dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; flex-shrink: 0; }
.status-pill--available { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success); }
.status-pill--reserved { background: rgba(var(--rb-purple-rgb), 0.08); color: var(--rb-purple); }
.status-pill--low { background: rgba(var(--rb-warning-rgb), 0.08); color: var(--rb-warning); }
.status-pill--critical { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent); }
.status-pill--expired { background: var(--rb-surface-alt); color: var(--rb-text-secondary); }

.expiry-row--critical td:first-child { box-shadow: inset 3px 0 0 var(--rb-accent); }
.expiry-row--low td:first-child { box-shadow: inset 3px 0 0 var(--rb-warning); }

.link-btn {
  display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--rb-primary);
  background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; text-decoration: none;
}
.link-btn:hover { text-decoration: underline; }

/* Row action menu */
.row-menu { position: relative; display: inline-flex; }
.row-menu__trigger {
  width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: var(--rb-text-secondary);
  display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.12s ease;
}
.row-menu__trigger:hover { background: var(--rb-surface-alt); color: var(--rb-text-primary); }
.row-menu__dropdown {
  position: absolute; top: 34px; right: 0; z-index: 20; min-width: 210px; background: var(--rb-surface);
  border: 1px solid var(--rb-border-strong); border-radius: 12px; box-shadow: 0 12px 28px rgba(var(--rb-shadow-rgb), 0.14);
  padding: 6px; display: flex; flex-direction: column; gap: 1px;
}
.row-menu__item {
  display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 8px; border: none; background: transparent;
  color: var(--rb-text-primary); font-size: 12.5px; font-weight: 500; text-align: left; cursor: pointer; font-family: inherit; white-space: nowrap;
}
.row-menu__item:hover { background: var(--rb-surface-alt); }
.row-menu__item--danger { color: var(--rb-accent); }
.row-menu__item--danger:hover { background: rgba(var(--rb-accent-rgb), 0.08); }
.row-menu__divider { height: 1px; background: var(--rb-border); margin: 4px 2px; }

/* Expanded row */
.expanded-row td { padding: 0; border-top: none; }
.expanded-panel { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 18px 20px; background: var(--rb-surface-alt); white-space: normal; }
.expanded-col__title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rb-text-secondary); margin: 0 0 8px; }
.expanded-col__title--spaced { margin-top: 14px; }
.expanded-dl { display: flex; flex-direction: column; gap: 6px; margin: 0; }
.expanded-dl div { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; }
.expanded-dl dt { color: var(--rb-text-secondary); }
.expanded-dl dd { margin: 0; color: var(--rb-text-primary); font-weight: 600; text-align: right; }
.expanded-timeline { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--rb-text-secondary); margin: 0; }
.expanded-timeline__bar { flex: 1; height: 2px; background: var(--rb-border-strong); border-radius: 999px; }
.expanded-col__note { font-size: 12px; color: var(--rb-text-secondary); margin: 4px 0 0; }
.expanded-list { display: flex; flex-direction: column; gap: 4px; }
.expanded-list__row { font-size: 12px; color: var(--rb-text-primary); margin: 0; }

/* Pagination */
.pagination { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-top: 1px solid var(--rb-border); }
.pagination__summary { font-size: 12px; color: var(--rb-text-secondary); margin: 0; }
.pagination__controls { display: flex; gap: 8px; }

/* Insights */
.insights-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.insight-card { display: flex; flex-direction: column; }
.segmented-control { display: inline-flex; padding: 3px; background: var(--rb-surface-alt); border-radius: 999px; gap: 2px; flex-shrink: 0; }
.segmented-control__btn { padding: 6px 12px; font-size: 11.5px; font-weight: 600; color: var(--rb-text-secondary); background: transparent; border: none; border-radius: 999px; cursor: pointer; font-family: inherit; transition: background 0.15s ease, color 0.15s ease; }
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
.chart-tooltip { position: absolute; transform: translate(-50%, -115%); background: var(--rb-text-primary); color: var(--rb-surface); border-radius: 10px; padding: 8px 10px; font-size: 11px; pointer-events: none; white-space: nowrap; box-shadow: 0 8px 20px rgba(var(--rb-shadow-rgb), 0.18); z-index: 2; }
.chart-tooltip__label { font-weight: 700; margin: 0 0 4px; }
.chart-tooltip__row { display: flex; align-items: center; gap: 5px; margin: 2px 0; }

.donut-body { padding: 16px 18px 18px; display: flex; align-items: center; gap: 22px; }
.donut-chart-wrap { position: relative; width: 160px; height: 160px; flex-shrink: 0; }
.donut-chart { width: 100%; height: 100%; }
.donut-segment { transition: opacity 0.15s ease; cursor: pointer; }
.donut-segment--dim { opacity: 0.35; }
.donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; pointer-events: none; }
.donut-center__value { font-size: 20px; font-weight: 800; color: var(--rb-text-primary); margin: 0; }
.donut-center__label { font-size: 10.5px; color: var(--rb-text-secondary); margin: 2px 0 0; max-width: 90px; }
.donut-legend { display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 0; }
.donut-legend__row { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px; border-radius: 8px; transition: background 0.12s ease; }
.donut-legend__row:hover { background: var(--rb-surface-alt); }
.donut-legend__label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); flex: 1; }
.donut-legend__value { font-size: 11.5px; color: var(--rb-text-secondary); flex-shrink: 0; }

/* Timeline (activity) */
.timeline { display: flex; flex-direction: column; }
.timeline-item { display: flex; align-items: flex-start; gap: 12px; padding: 13px 18px; border-top: 1px solid var(--rb-surface-alt); }
.timeline-item:first-child { border-top: none; }
.timeline-item__marker { width: 30px; height: 30px; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.timeline-item__body { flex: 1; min-width: 0; }
.timeline-item__name { font-size: 13px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.timeline-item__meta { font-size: 11.5px; color: var(--rb-text-secondary); margin: 3px 0 0; }
.timeline-item__right { text-align: right; flex-shrink: 0; }
.timeline-item__user { font-size: 11px; color: var(--rb-text-secondary); margin: 2px 0 0; }
.activity-feed__time { font-size: 11px; color: var(--rb-text-secondary); margin: 0; white-space: nowrap; }

/* Quick actions */
.quick-actions-body { display: flex; flex-direction: column; gap: 16px; padding: 18px; }
.quick-actions-group__label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--rb-text-secondary); margin: 0 0 10px; }
.quick-actions-grid { display: grid; gap: 12px; }
.quick-actions-grid--primary { grid-template-columns: repeat(2, 1fr); }
.quick-actions-grid--secondary { grid-template-columns: repeat(3, 1fr); }
.quick-action-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 16px; border-radius: 12px;
  border: 1px solid var(--rb-border); background: var(--rb-surface-alt); cursor: pointer; text-align: left; font-family: inherit;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.quick-action-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(var(--rb-shadow-rgb), 0.08); border-color: var(--rb-border-hover); background: var(--rb-surface); }
.quick-action-card:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.quick-action-card--primary { background: rgba(var(--rb-primary-rgb), 0.04); border-color: rgba(var(--rb-primary-rgb), 0.18); }
.quick-action-card--primary:hover { background: rgba(var(--rb-primary-rgb), 0.07); border-color: var(--rb-primary); }
.quick-action-card__icon { width: 38px; height: 38px; border-radius: 10px; background: var(--rb-surface); border: 1px solid var(--rb-border); display: flex; align-items: center; justify-content: center; }
.quick-action-card__icon--primary { background: rgba(var(--rb-primary-rgb), 0.08); border-color: transparent; }
.quick-action-card__label { font-size: 12.5px; font-weight: 700; color: var(--rb-text-primary); margin: 2px 0 0; }
.quick-action-card__desc { font-size: 11px; color: var(--rb-text-secondary); margin: 0; line-height: 1.35; }

/* Empty state */
.empty-state { padding: 40px 24px; text-align: center; color: var(--rb-text-secondary); font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty-state__title { font-size: 15px; font-weight: 700; color: var(--rb-text-primary); margin: 4px 0 0; }
.empty-state__desc { font-size: 12.5px; color: var(--rb-text-secondary); margin: 0 0 6px; }

/* Modals */
.modal-overlay { position: fixed; inset: 0; background: var(--rb-overlay); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 1000; }
.modal-card { background: var(--rb-surface); border-radius: 16px; padding: 24px; width: 100%; max-width: 400px; box-shadow: 0 20px 50px rgba(var(--rb-shadow-rgb), 0.25); position: relative; }
.modal-card--wide { max-width: 560px; }
.modal-card .btn-primary { color: #ffffff; background: var(--rb-primary); }
.modal-card .btn-outline { color: var(--rb-text-primary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong); }
.modal-close { position: absolute; top: 16px; right: 16px; width: 28px; height: 28px; border-radius: 8px; border: none; background: transparent; color: var(--rb-text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s ease; }
.modal-close:hover { background: var(--rb-surface-alt); }
.modal-title { font-size: 16px; font-weight: 700; color: var(--rb-text-primary); margin: 0 0 6px; }
.modal-title--left { margin-top: 4px; }
.modal-subtitle { font-size: 12.5px; color: var(--rb-text-secondary); margin: 0 0 20px; }
.modal-subtitle--left { margin-bottom: 18px; }
.modal-actions { display: flex; gap: 10px; margin-top: 4px; }
.modal-actions__btn { flex: 1; }

.batch-form { display: flex; flex-direction: column; gap: 14px; max-height: 60vh; overflow-y: auto; padding-right: 2px; }
.batch-form__section { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rb-text-secondary); margin: 4px 0 -4px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field__label { font-size: 12px; font-weight: 600; color: var(--rb-text-primary); }
.form-field__input { padding: 9px 12px; border-radius: 9px; border: 1px solid var(--rb-border-strong); font-size: 13px; color: var(--rb-text-primary); background: var(--rb-surface); transition: border-color 0.15s ease; font-family: inherit; }
.form-field__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.08); }
.form-field__input::placeholder { color: var(--rb-placeholder); }
.form-field__select { appearance: none; background: var(--rb-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E") no-repeat right 12px center; }
.form-field__textarea { resize: vertical; min-height: 64px; }
.form-error { font-size: 12px; color: var(--rb-accent); margin: -6px 0 0; }

.manage-actions-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.manage-action-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 18px 10px; border-radius: 12px;
  border: 1px solid var(--rb-border-strong); background: var(--rb-surface-alt); cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600;
  color: var(--rb-text-primary); text-align: center; transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.manage-action-card:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(var(--rb-shadow-rgb), 0.08); background: var(--rb-surface); }
.manage-action-card--danger { color: var(--rb-accent); }
.manage-action-card--danger:hover { background: rgba(var(--rb-accent-rgb), 0.06); }

/* Print labels modal */
.print-batch-list { display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; margin-bottom: 16px; }
.print-batch-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--rb-border); cursor: pointer; }
.print-batch-row:hover { background: var(--rb-surface-hover); }
.print-batch-row__info { flex: 1; min-width: 0; }
.print-batch-row__title { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); margin: 0; }
.print-batch-row__meta { font-size: 11px; color: var(--rb-text-secondary); margin: 2px 0 0; }
.print-batch-row__qty { width: 56px; padding: 5px 6px; border-radius: 8px; border: 1px solid var(--rb-border-strong); font-size: 12px; text-align: center; }
.print-preview { margin-bottom: 16px; }
.print-preview__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-top: 8px; }
.print-label-card { border: 1px dashed var(--rb-border-strong); border-radius: 10px; padding: 10px; font-size: 10.5px; }
.print-label-card__type { font-weight: 800; color: var(--rb-accent); margin: 0; font-size: 13px; }
.print-label-card__meta { color: var(--rb-text-secondary); margin: 2px 0 0; }
.print-label-card__barcode { margin-top: 6px; height: 20px; background: repeating-linear-gradient(90deg, var(--rb-text-primary) 0 2px, transparent 2px 4px); }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

/* Inventory detail drawer (View Details) */
.drawer-overlay { position: fixed; inset: 0; background: var(--rb-overlay); display: flex; justify-content: flex-end; z-index: 1000; }
.detail-drawer {
  width: clamp(420px, 32vw, 520px); max-width: 100%; height: 100%; background: var(--rb-surface);
  display: flex; flex-direction: column; box-shadow: -12px 0 32px rgba(var(--rb-shadow-rgb), 0.18);
  animation: drawer-slide-in 0.25s ease;
}
@keyframes drawer-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
.detail-drawer__header { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 22px; border-bottom: 1px solid var(--rb-border); position: relative; }
.detail-drawer__eyebrow { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 11.5px; color: var(--rb-text-secondary); margin: 0 0 3px; }
.detail-drawer__title { font-size: 16px; font-weight: 700; color: var(--rb-text-primary); margin: 0; }
.detail-drawer__body { flex: 1; overflow-y: auto; padding: 20px 22px; display: flex; flex-direction: column; gap: 22px; }
.detail-drawer__footer { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px 22px; border-top: 1px solid var(--rb-border); }
.detail-drawer__footer .btn-outline, .detail-drawer__footer .btn-primary { flex: 1 1 45%; justify-content: center; }
.drawer-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0; }
.drawer-info-grid dt { font-size: 11px; color: var(--rb-text-secondary); margin-bottom: 3px; }
.drawer-info-grid dd { font-size: 13px; font-weight: 600; color: var(--rb-text-primary); margin: 0; }
.drawer-fade-enter-active, .drawer-fade-leave-active { transition: opacity 0.2s ease; }
.drawer-fade-enter-from, .drawer-fade-leave-to { opacity: 0; }

/* Responsive */
@media (max-width: 1200px) {
  .type-grid { grid-template-columns: repeat(4, 1fr); }
}
@media (max-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .insights-grid { grid-template-columns: 1fr; }
  .quick-actions-grid--primary { grid-template-columns: repeat(2, 1fr); }
  .quick-actions-grid--secondary { grid-template-columns: repeat(3, 1fr); }
  .expanded-panel { grid-template-columns: 1fr; }
  .manage-actions-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .inv-page { padding: 16px 16px 32px; }
  .type-grid { grid-template-columns: repeat(2, 1fr); }
  .header-row { flex-direction: column; align-items: stretch; }
  .header-actions { justify-content: space-between; }
  .panel-header { flex-direction: column; align-items: stretch; }
  .search-box--lg { width: 100%; }
  .toolbar__row--end { justify-content: stretch; }
  .toolbar__row--end .btn-outline, .toolbar__row--end .btn-primary { flex: 1; }
  .form-row { grid-template-columns: 1fr; }
  .donut-body { flex-direction: column; }
  .quick-actions-grid--primary, .quick-actions-grid--secondary { grid-template-columns: repeat(2, 1fr); }
  .manage-actions-grid { grid-template-columns: 1fr; }
  .detail-drawer { width: 100%; }
  .detail-drawer__footer .btn-outline, .detail-drawer__footer .btn-primary { flex: 1 1 100%; }
}
</style>