<template>
  <div class="page">
    <!-- TOASTS -->
    <div class="toast-stack">
      <transition-group name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.variant}`">
          <div class="toast-title">{{ t.title }}</div>
          <div v-if="t.message" class="toast-message">{{ t.message }}</div>
        </div>
      </transition-group>
    </div>

    <!-- HEADER -->
    <header class="page-header">
      <div>
        <h1 class="page-title">Incoming Requests</h1>
        <p class="page-subtitle">Review, prioritize, and process blood requests submitted by partner hospitals.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" @click="handleRefresh" :disabled="loading">
          <AssetIcon name="refresh-cw" :size="16" :class="{ spinning: loading }" />
          Refresh
        </button>
        <button class="btn btn-outline" @click="handleExportAll">
          <AssetIcon name="download" :size="16" />
          Export Requests
        </button>
      </div>
    </header>

    <!-- ERROR / RETRY BANNER -->
    <div v-if="error" class="retry-banner">
      <AssetIcon name="triangle-alert" :size="16" />
      <span>Couldn't load incoming requests. {{ error?.message || 'Please try again.' }}</span>
      <button class="btn btn-outline btn-sm" @click="handleRefresh">Retry</button>
    </div>

    <!-- EMERGENCY ALERT -->
    <transition name="fade">
      <div v-if="primaryEmergency" class="emergency-banner">
        <div class="emergency-main">
          <div class="emergency-icon">
            <AssetIcon name="triangle-alert" :size="20" />
          </div>
          <div class="emergency-body">
            <div class="emergency-title-row">
              <span class="emergency-title">Emergency Blood Request</span>
              <span class="emergency-id">{{ primaryEmergency.code }}</span>
            </div>
            <div class="emergency-grid">
              <div><span class="e-label">Hospital</span><span class="e-value">{{ primaryEmergency.hospital }}</span></div>
              <div><span class="e-label">Blood Type</span><span class="e-value">{{ primaryEmergency.bloodType }}</span></div>
              <div><span class="e-label">Component</span><span class="e-value">{{ primaryEmergency.component }}</span></div>
              <div><span class="e-label">Units Requested</span><span class="e-value">{{ primaryEmergency.units }}</span></div>
              <div><span class="e-label">Needed Within</span><span class="e-value">{{ primaryEmergency.neededBy }}</span></div>
              <div>
                <!--
                  Coverage, not shelf stock. The queue endpoint does not carry
                  availability, so this read `available` and rendered a bare
                  " units" with a permanent red flag beneath it.
                -->
                <span class="e-label">Reserved</span>
                <span class="e-value inv-inline" :class="'inv-' + coverageLevel(primaryEmergency)">
                  <AssetIcon :name="inventoryIcon(coverageLevel(primaryEmergency))" :size="13" />
                  {{ primaryEmergency.allocated }} / {{ primaryEmergency.units }} units
                </span>
              </div>
            </div>
            <p v-if="primaryEmergency.allocated === 0" class="insufficient-tag">
              <AssetIcon name="octagon-alert" :size="14" /> No stock reserved yet — review to check availability
            </p>
          </div>
        </div>
        <div class="emergency-actions">
          <button class="btn btn-primary btn-sm" @click="openReview(primaryEmergency)">Review Request</button>
          <button class="btn btn-outline btn-sm" @click="activeFilter = 'Emergency'">View Queue</button>
          <button class="icon-btn" @click="dismissAlert(primaryEmergency.id)" aria-label="Dismiss alert">
            <AssetIcon name="x" :size="16" />
          </button>
        </div>
      </div>
    </transition>

    <!-- SUMMARY CARDS -->
    <section class="summary-grid">
      <template v-if="summaryLoading">
        <div v-for="n in 4" :key="'sk-' + n" class="summary-card skeleton-card" />
      </template>
      <template v-else>
        <div v-for="stat in summaryStats" :key="stat.key" class="summary-card" :class="{ 'is-danger': stat.danger }">
          <div class="summary-icon" :class="{ 'is-danger': stat.danger }">
            <AssetIcon :name="stat.icon" :size="20" />
          </div>
          <div class="summary-body">
            <p class="summary-value">{{ stat.value }}</p>
            <p class="summary-label">{{ stat.label }}</p>
            <p class="summary-trend" :class="{ up: stat.trendUp === true, down: stat.trendUp === false }">
              <AssetIcon v-if="stat.trendUp === true" name="trending-up" :size="12" />
              <AssetIcon v-else-if="stat.trendUp === false" name="trending-down" :size="12" />
              {{ stat.trend }}
            </p>
          </div>
        </div>
      </template>
    </section>

    <!-- QUICK FILTERS -->
    <div class="quick-filters">
      <button
        v-for="opt in filterOptions"
        :key="opt"
        class="pill"
        :class="{ active: activeFilter === opt }"
        @click="activeFilter = opt"
      >
        {{ opt }}
      </button>
    </div>

    <!-- ADVANCED FILTER TOOLBAR -->
    <div class="toolbar">
      <div class="toolbar-search">
        <AssetIcon name="search" :size="16" class="search-icon" />
        <input v-model="searchQuery" type="text" placeholder="Search request ID, hospital, doctor..." @input="onSearchInput" />
      </div>

      <select v-model="toolbarFilters.hospital">
        <option value="">Hospital</option>
        <option v-for="h in hospitalOptions" :key="h" :value="h">{{ h }}</option>
      </select>
      <select v-model="toolbarFilters.bloodType">
        <option value="">Blood Type</option>
        <option v-for="b in bloodTypeOptions" :key="b" :value="b">{{ b }}</option>
      </select>
      <select v-model="toolbarFilters.component">
        <option value="">Blood Component</option>
        <option v-for="c in componentOptions" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="toolbarFilters.priority">
        <option value="">Priority</option>
        <option>Routine</option>
        <option>Emergency</option>
      </select>
      <select v-model="toolbarFilters.status">
        <option value="">Status</option>
        <option>Pending</option>
        <option>Processing</option>
        <option>Partial</option>
        <option>Fulfilled</option>
        <option>Rejected</option>
        <option>Cancelled</option>
      </select>
      <input v-model="toolbarFilters.date" type="date" title="Request Date" />
      <input v-model="toolbarFilters.neededBy" type="date" title="Needed By" />

      <div class="toolbar-buttons">
        <button class="btn btn-outline btn-sm" @click="resetFilters">Reset Filters</button>
        <button class="btn btn-primary btn-sm" :disabled="loading" @click="loadRequests">Apply Filters</button>
      </div>

      <div class="toolbar-meta">
        <span>Showing {{ visibleRequests.length }} of {{ meta.total }} requests</span>
        <span class="dot">·</span>
        <span>Updated {{ lastUpdatedLabel }}</span>
        <template v-if="activeFilterCount > 0">
          <span class="dot">·</span>
          <span>{{ activeFilterCount }} active filter{{ activeFilterCount === 1 ? '' : 's' }}</span>
        </template>
      </div>
    </div>

    <!-- REQUEST TABLE -->
    <div class="table-card">
      <div v-if="loading" class="table-skeleton">
        <div v-for="n in 5" :key="n" class="skeleton-row" />
      </div>

      <div v-else-if="!error && visibleRequests.length === 0 && activeFilterCount === 0 && !searchQuery" class="empty-state">
        <AssetIcon name="inbox" :size="40" />
        <h3>No Incoming Requests</h3>
        <p>There are currently no hospital blood requests waiting for review.</p>
        <button class="btn btn-primary btn-sm" @click="handleRefresh">Refresh Requests</button>
      </div>

      <div v-else-if="!error && visibleRequests.length === 0" class="empty-state">
        <AssetIcon name="filter-x" :size="40" />
        <h3>No Requests Match Your Filters</h3>
        <p>Try adjusting your filters or clearing the current search.</p>
        <button class="btn btn-outline btn-sm" @click="resetFilters">Clear Filters</button>
      </div>

      <table v-else-if="!error" class="request-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Hospital</th>
            <th>Requested By</th>
            <th>Blood Type</th>
            <th>Component</th>
            <th>Units</th>
            <th>Reserved</th>
            <th>Priority</th>
            <th>Needed By</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="r in visibleRequests" :key="r.id">
            <tr
              class="table-row"
              :class="{ 'is-mutating': isMutating(r.id) }"
              @click="openReview(r)"
            >
              <td class="mono">
                <button
                  class="expand-btn"
                  @click.stop="toggleExpand(r.id)"
                  :aria-label="expandedIds.has(r.id) ? 'Collapse row' : 'Expand row'"
                >
                  <AssetIcon :name="expandedIds.has(r.id) ? 'chevron-down' : 'chevron-right'" :size="14" />
                </button>
                {{ r.code }}
              </td>
              <td>
                <div class="hospital-cell">
                  <span class="hospital-name">{{ r.hospital }}</span>
                  <span class="hospital-contact">{{ r.contact }}</span>
                </div>
              </td>
              <td class="requested-by">{{ r.requestedBy || r.contact || '—' }}</td>
              <td><span class="blood-pill">{{ r.bloodType }}</span></td>
              <td>{{ r.component }}</td>
              <td>{{ r.units }}</td>
              <td>
                <span class="inv-pill" :class="'inv-' + inventoryLevel(r)">
                  <AssetIcon :name="inventoryIcon(inventoryLevel(r))" :size="12" />
                  {{ r.allocated }} / {{ r.units }} held
                </span>
              </td>
              <td>
                <span class="priority-badge" :class="'priority-' + r.priority.toLowerCase()">
                  <AssetIcon :name="priorityIcon(r.priority)" :size="12" />
                  {{ r.priority }}
                </span>
              </td>
              <td class="needed-by">{{ r.neededBy }}</td>
              <td>
                <span class="status-badge" :class="'status-' + r.status.toLowerCase().replace(/\s+/g, '-')">{{ r.status }}</span>
              </td>
              <td class="actions-cell" @click.stop>
                <button class="btn btn-primary btn-xs" :disabled="isMutating(r.id)" @click="openReview(r)">
                  Review
                </button>
                <div class="menu-wrap">
                  <button class="icon-btn" @click="toggleMenu(r.id)" aria-label="More actions">
                    <AssetIcon name="move-vertical" :size="16" />
                  </button>
                  <div v-if="openMenuId === r.id" v-click-outside="() => (openMenuId = null)" class="context-menu">
                    <button @click="openMenuId = null; openReview(r)">
                      <AssetIcon name="eye" :size="14" /> View Details
                    </button>
                    <button @click="openMenuId = null; openReview(r)">
                      <AssetIcon name="search" :size="14" /> Review Request
                    </button>
                    <button
                      :disabled="isMutating(r.id)"
                      @click="openMenuId = null; requestApprove(r)"
                    >
                      <AssetIcon name="check" :size="14" /> Approve Request
                    </button>
                    <button class="danger" :disabled="isMutating(r.id)" @click="openMenuId = null; requestReject(r)">
                      <AssetIcon name="circle-x" :size="14" /> Reject Request
                    </button>
                    <button @click="openMenuId = null; toggleExpand(r.id)">
                      <AssetIcon name="package-search" :size="14" /> Check Inventory
                    </button>
                    <button
                      :disabled="isMutating(r.id)"
                      @click="openMenuId = null; requestApprove(r)"
                    >
                      <AssetIcon name="archive" :size="14" /> Reserve Inventory
                    </button>
                    <button @click="openMenuId = null; openReview(r)">
                      <AssetIcon name="activity" :size="14" /> View Timeline
                    </button>
                    <button @click="openMenuId = null; handlePrint(r)">
                      <AssetIcon name="printer" :size="14" /> Print Request
                    </button>
                    <button @click="openMenuId = null; handleExportPdf(r)">
                      <AssetIcon name="file-text" :size="14" /> Export PDF
                    </button>
                  </div>
                </div>
              </td>
            </tr>

            <!-- INLINE ROW EXPANSION (quick review, does not replace the drawer) -->
            <tr v-if="expandedIds.has(r.id)" class="expanded-row">
              <td colspan="11">
                <div class="expanded-content">
                  <div class="expanded-grid">
                    <div><span class="e-label">Hospital</span><span class="e-value">{{ r.hospital }}</span></div>
                    <div><span class="e-label">Requested By</span><span class="e-value">{{ r.requestedBy || r.contact || '—' }}</span></div>
                    <div><span class="e-label">Blood Requirement</span><span class="e-value">{{ r.bloodType }} · {{ r.component }} · {{ r.units }} units</span></div>
                    <div>
                      <span class="e-label">Inventory Availability</span>
                      <span class="e-value inv-inline" :class="'inv-' + inventoryLevel(r)">
                        <AssetIcon :name="inventoryIcon(inventoryLevel(r))" :size="12" /> {{ r.allocated }} / {{ r.units }} held
                      </span>
                    </div>
                    <div>
                      <span class="e-label">Priority</span>
                      <span class="priority-badge" :class="'priority-' + r.priority.toLowerCase()">
                        <AssetIcon :name="priorityIcon(r.priority)" :size="12" /> {{ r.priority }}
                      </span>
                    </div>
                    <div><span class="e-label">Needed By</span><span class="e-value">{{ r.neededBy }}</span></div>
                    <div>
                      <span class="e-label">Status</span>
                      <span class="status-badge" :class="'status-' + r.status.toLowerCase().replace(/\s+/g, '-')">{{ r.status }}</span>
                    </div>
                  </div>
                  <div class="expanded-actions">
                    <button class="btn btn-outline btn-xs" @click="openReview(r)">Full Review</button>
                    <button
                      class="btn btn-outline btn-xs"
                      :disabled="isMutating(r.id)"
                      @click="requestReject(r)"
                    >
                      Reject Request
                    </button>
                    <button
                      class="btn btn-primary btn-xs"
                      :disabled="isMutating(r.id)"
                      @click="requestApprove(r)"
                    >
                      Approve &amp; Reserve
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- RECENT ACTIVITY -->
    <section class="activity-card">
      <h2 class="section-title">Recent Request Activity</h2>

      <div v-if="activityLoading" class="activity-skeleton">
        <div v-for="n in 4" :key="n" class="skeleton-row" />
      </div>

      <p v-else-if="activity.length === 0" class="activity-empty">No recent activity yet.</p>

      <ul v-else class="activity-list">
        <li v-for="item in activity" :key="item.id" class="activity-item">
          <span class="activity-dot" :class="activityToneClass(item.type)">
            <AssetIcon :name="activityIcon(item.type)" :size="14" />
          </span>
          <div class="activity-body">
            <p><strong>{{ item.description }}</strong> — {{ item.hospital }}</p>
            <span class="activity-meta">{{ item.time }} · {{ item.staff }}</span>
          </div>
        </li>
      </ul>
    </section>

    <!-- REVIEW DRAWER -->
    <transition name="drawer">
      <aside v-if="drawerOpen" class="drawer-overlay" @click.self="closeDrawer">
        <div class="drawer">
          <header class="drawer-header">
            <h2>Review Request</h2>
            <button class="icon-btn" @click="closeDrawer" aria-label="Close"><AssetIcon name="x" :size="18" /></button>
          </header>

          <div v-if="drawerLoading" class="drawer-loading">
            <div v-for="n in 4" :key="n" class="skeleton-row" />
          </div>

          <div v-else-if="activeRequest" class="drawer-content">
            <section class="drawer-section">
              <h3>Request Information</h3>
              <dl class="detail-grid">
                <div><dt>Request ID</dt><dd class="mono">{{ activeRequest.code }}</dd></div>
                <div><dt>Request Date</dt><dd>{{ activeRequest.requestDate }}</dd></div>
                <div><dt>Priority</dt><dd><span class="priority-badge" :class="'priority-' + activeRequest.priority.toLowerCase()"><AssetIcon :name="priorityIcon(activeRequest.priority)" :size="12" /> {{ activeRequest.priority }}</span></dd></div>
                <div><dt>Status</dt><dd><span class="status-badge" :class="'status-' + activeRequest.status.toLowerCase().replace(/\s+/g, '-')">{{ activeRequest.status }}</span></dd></div>
                <div><dt>Needed By</dt><dd>{{ activeRequest.neededBy }}</dd></div>
                <div><dt>Submitted By</dt><dd>{{ activeRequest.requestedBy || activeRequest.contact }}</dd></div>
              </dl>
            </section>

            <section class="drawer-section">
              <h3>Hospital Information</h3>
              <dl class="detail-grid">
                <div><dt>Hospital Name</dt><dd>{{ activeRequest.hospital }}</dd></div>
                <div><dt>Department</dt><dd>{{ activeRequest.department || '—' }}</dd></div>
                <div><dt>Doctor</dt><dd>{{ activeRequest.contact }}</dd></div>
                <div><dt>Contact Number</dt><dd>{{ activeRequest.phone || '—' }}</dd></div>
                <div><dt>Email</dt><dd>{{ activeRequest.email || '—' }}</dd></div>
                <div><dt>Address</dt><dd>{{ activeRequest.address || '—' }}</dd></div>
              </dl>
            </section>

            <section class="drawer-section">
              <h3>Blood Request</h3>
              <dl class="detail-grid">
                <div><dt>Blood Type</dt><dd><span class="blood-pill">{{ activeRequest.bloodType }}</span></dd></div>
                <div><dt>Component</dt><dd>{{ activeRequest.component }}</dd></div>
                <div><dt>Units Requested</dt><dd>{{ activeRequest.units }}</dd></div>
                <div><dt>Needed By</dt><dd>{{ activeRequest.neededBy }}</dd></div>
              </dl>
              <div class="notes-block">
                <p class="notes-label">Reason for Request</p>
                <p class="notes-text">{{ activeRequest.reason || '—' }}</p>
                <p class="notes-label">Clinical Notes</p>
                <p class="notes-text">{{ activeRequest.notes || '—' }}</p>
              </div>
            </section>

            <section class="drawer-section">
              <h3>Inventory Availability</h3>
              <!--
                One row per component. A request can ask for several, each
                answered from a different shelf, so a single "Requested /
                Available" pair could only ever describe the first of them —
                and printed the request's TOTAL units beside one component's
                name, which read as a larger request than it was.
              -->
              <table v-if="(activeRequest.lines || []).length" class="avail-table">
                <thead>
                  <tr>
                    <th scope="col">Component</th>
                    <th scope="col" class="num">Requested</th>
                    <th scope="col" class="num">Outstanding</th>
                    <th scope="col" class="num">Available</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="line in activeRequest.lines" :key="line.request_item_id">
                    <td>{{ line.component?.name || '—' }}</td>
                    <td class="num">{{ line.requested ?? '—' }}</td>
                    <td class="num">{{ line.outstanding }}</td>
                    <td class="num">{{ line.available }}</td>
                    <td>
                      <span class="inv-inline" :class="'inv-' + lineLevel(line)">
                        <AssetIcon :name="inventoryIcon(lineLevel(line))" :size="12" />
                        {{ lineLevel(line) === 'ok'
                          ? 'Can cover'
                          : lineLevel(line) === 'low'
                            ? `Part only (${line.can_cover_now})`
                            : 'No stock' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <p v-else class="batch-empty">Availability is loading.</p>

              <p class="inventory-status-line" :class="'inv-' + availabilityLevel(activeRequest)">
                <AssetIcon :name="inventoryIcon(availabilityLevel(activeRequest))" :size="14" />
                {{ availabilityLevel(activeRequest) === 'ok'
                  ? 'Sufficient Inventory'
                  : availabilityLevel(activeRequest) === 'low'
                    ? 'Partial Inventory — some units can be reserved now'
                    : 'Insufficient Inventory' }}
              </p>

              <p class="inventory-advisory">
                Advisory at {{ activeRequest.availabilityAsOf || 'this moment' }} — nothing is held until you
                approve, and allocation re-checks every unit under a lock before reserving.
              </p>

              <p class="health-bar-label">Inventory Health</p>
              <div class="health-bar">
                <div
                  class="health-fill"
                  :class="'inv-' + availabilityLevel(activeRequest)"
                  :style="{ width: Math.min(100, ((activeRequest.available ?? 0) / Math.max(activeRequest.outstanding || activeRequest.units || 1, 1)) * 100) + '%' }"
                />
              </div>
            </section>

            <section class="drawer-section">
              <h3>Request Timeline</h3>
              <ol class="timeline">
                <li
                  v-for="(step, i) in timelineSteps"
                  :key="step"
                  :class="{ done: i <= currentStepIndex, current: i === currentStepIndex }"
                >
                  <span class="timeline-dot">
                    <AssetIcon v-if="i <= currentStepIndex" name="check" :size="10" />
                  </span>
                  {{ step }}
                </li>
              </ol>
            </section>
          </div>

          <footer class="drawer-footer">
            <button class="btn btn-outline" :disabled="drawerMutating" @click="requestReject(activeRequest)">
              Reject Request
            </button>
            <button
              v-if="activeRequest && availabilityLevel(activeRequest) === 'insufficient'"
              class="btn btn-outline"
              @click="handleReviewInventory(activeRequest)"
            >
              Review Inventory
            </button>
            <button
              v-else
              class="btn btn-primary"
              :disabled="drawerMutating"
              @click="requestApprove(activeRequest)"
            >
              {{ drawerMutating ? 'Processing…' : 'Approve & Reserve' }}
            </button>
          </footer>
        </div>
      </aside>
    </transition>

    <!-- APPROVAL CONFIRMATION MODAL -->
    <div v-if="showApproveModal" class="modal-overlay" @click.self="closeApproveModal">
      <div class="modal">
        <h2 class="modal-title">Approve Blood Request?</h2>
        <div class="modal-summary">
          <div class="modal-row"><span>Request ID</span><strong class="mono">{{ requestToApprove?.id }}</strong></div>
          <div class="modal-row"><span>Hospital</span><strong>{{ requestToApprove?.hospital }}</strong></div>
          <div class="modal-row"><span>Blood Type / Component</span><strong>{{ requestToApprove?.bloodType }} · {{ requestToApprove?.component }}</strong></div>
          <div class="modal-row"><span>Units Requested</span><strong>{{ requestToApprove?.units }}</strong></div>
          <div v-if="requestToApprove?.available !== undefined" class="modal-row">
            <span>Compatible Inventory</span>
            <strong class="inv-inline" :class="'inv-' + availabilityLevel(requestToApprove)">
              <AssetIcon :name="inventoryIcon(availabilityLevel(requestToApprove))" :size="13" />
              {{ requestToApprove.available }} units available
            </strong>
          </div>
          <div v-else class="modal-row">
            <span>Compatible Inventory</span>
            <strong>Checked when the hold is taken</strong>
          </div>
        </div>
        <p class="modal-desc">Approving this request will reserve the selected inventory units and move the request to Request Fulfillment.</p>
        <div class="modal-actions">
          <button class="btn btn-outline" :disabled="approving" @click="closeApproveModal">Cancel</button>
          <button class="btn btn-primary" :disabled="approving" @click="confirmApprove">
            {{ approving ? 'Approving…' : 'Approve & Reserve' }}
          </button>
        </div>
      </div>
    </div>

    <!-- REJECTION MODAL -->
    <div v-if="showRejectModal" class="modal-overlay" @click.self="closeRejectModal">
      <div class="modal">
        <h2 class="modal-title">Reject Blood Request?</h2>
        <p class="modal-desc">{{ requestToReject?.id }} — {{ requestToReject?.hospital }}</p>
        <div class="field">
          <label class="field-label">Rejection Reason *</label>
          <select v-model="rejectReason" class="field-select">
            <option value="" disabled>Select a reason</option>
            <option>Insufficient Inventory</option>
            <option>Invalid Request</option>
            <option>Duplicate Request</option>
            <option>Request Cancelled by Hospital</option>
            <option>Other</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">Additional Notes</label>
          <textarea
            v-model="rejectNotes"
            class="field-textarea"
            rows="3"
            placeholder="Optional context for this rejection"
          />
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" :disabled="rejecting" @click="closeRejectModal">Cancel</button>
          <button class="btn btn-danger" :disabled="!rejectReason || rejecting" @click="confirmReject">
            {{ rejecting ? 'Rejecting…' : 'Reject Request' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { ref, computed, watch, onMounted } from 'vue'
import { useDarkMode } from '~/composables/useDarkMode'
import { useIncomingRequests } from '~/composables/useIncomingRequests'
import { componentSummary, REQUEST_STATUS_LABELS } from '~/types/bloodRequest'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

definePageMeta({ middleware: ['auth', 'department'], layout: 'blood-centerdashboard',
  requires: 'requests.view',
})

const { isDark } = useDarkMode()

/*
 * This page destructured eleven names from useIncomingRequests(), seven of
 * which it has never returned — `activity`, `loading`, `isMutating`,
 * `fetchRequestDetail`, `approveAndReserve`, `rejectRequest` and
 * `fetchActivity` were all undefined. Calling one threw, and the table then
 * read `r.priority.toLowerCase()` on rows that carry no `priority`, which
 * throws during render and takes the whole page down with it.
 *
 * The composable's real surface is below. Everything the template expects but
 * the API does not send is built in mapRequest(), with a defined fallback for
 * every field so a render can no longer throw.
 */
const {
  requests: apiRequests,
  summary,
  selected,
  inventory,
  filters,
  meta,
  isLoading: loading,
  isActing,
  error,
  fetchRequests,
  fetchSummary,
  openRequest,
  allocate,
  reject,
} = useIncomingRequests()

/* ------------------------------------------------------------------ *
 * API row -> the view model this page's markup was written against.
 * ------------------------------------------------------------------ */

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Flatten one request for the table.
 *
 * `id` stays the numeric key every API call needs; `code` is the reference
 * number staff actually read. Fields the schema has no answer for — the
 * requesting doctor, their phone, the department — resolve to an em dash
 * rather than being invented, which is the rule this feature has followed
 * throughout.
 */
function mapRequest(r) {
  const allocated = r.allocated_count ?? 0
  const units = r.quantity ?? 0

  return {
    id: r.id,
    code: r.reference_number ?? `#${r.id}`,
    hospital: r.requesting_facility?.name ?? '—',
    contact: r.requesting_facility?.address ?? '',
    requestedBy: '',
    bloodType: r.blood_type?.code ?? '—',
    component: componentSummary(r),
    units,
    items: r.items ?? [],
    // Coverage, not shelf stock: the queue endpoint does not carry
    // availability, and printing "0 available" beside a request nobody has
    // checked would read as "we have none" rather than "we have not looked".
    allocated,
    outstanding: r.outstanding_quantity ?? Math.max(0, units - allocated),
    priority: r.is_emergency ? 'Emergency' : 'Routine',
    status: r.status_label ?? REQUEST_STATUS_LABELS[r.status] ?? 'Pending',
    statusValue: r.status,
    urgency: r.urgency_level,
    purpose: r.purpose_label ?? '',
    patient: r.patient?.full_name ?? '',
    requestDate: formatDateTime(r.request_date),
    neededBy: r.is_emergency ? 'Immediate' : 'Routine',
    reason: r.rejection_reason ?? '',
    reference_number: r.reference_number,
  }
}

const requests = computed(() => (apiRequests.value ?? []).map(mapRequest))

/* TOASTS */
const toasts = ref([])
let toastId = 0
function toast(title, variant = 'success', message = '') {
  const id = ++toastId
  toasts.value.push({ id, title, message, variant })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 3600)
}

/* FILTER STATE */
const activeFilter = ref('All')
const searchQuery = ref('')
const dismissedAlertIds = ref([])

// The statuses the schema actually accepts, plus the two urgency levels.
// "Urgent", "Under Review", "Approved" and "Ready for Fulfillment" were never
// values this API could return, so filtering by them matched nothing.
const filterOptions = ['All', 'Emergency', 'Routine', 'Pending', 'Processing', 'Partial', 'Fulfilled', 'Rejected', 'Cancelled']

const STATUS_FILTERS = {
  Pending: 'pending',
  Processing: 'processing',
  Partial: 'partial',
  Fulfilled: 'fulfilled',
  Rejected: 'rejected',
  Cancelled: 'cancelled',
}
const URGENCY_FILTERS = { Emergency: 'emergency', Routine: 'routine' }

const toolbarFilters = ref({
  hospital: '',
  bloodType: '',
  component: '',
  priority: '',
  status: '',
  date: '',
  neededBy: '',
})

const activeFilterCount = computed(() => Object.values(toolbarFilters.value).filter(Boolean).length)

const hospitalOptions = computed(() => [...new Set(requests.value.map((r) => r.hospital))])
const bloodTypeOptions = computed(() => [...new Set(requests.value.map((r) => r.bloodType))])
const componentOptions = computed(() =>
  [...new Set(requests.value.flatMap((r) => r.items.map((i) => i.component?.name).filter(Boolean)))],
)

/**
 * The rows actually shown.
 *
 * Status, urgency and the free-text search are applied by the API. Hospital,
 * blood type and component are narrowed here, because the queue endpoint takes
 * ids for those and this toolbar collects names.
 */
const visibleRequests = computed(() =>
  requests.value.filter((r) => {
    const f = toolbarFilters.value
    if (f.hospital && r.hospital !== f.hospital) return false
    if (f.bloodType && r.bloodType !== f.bloodType) return false
    if (f.component && !r.items.some((i) => i.component?.name === f.component)) return false
    if (f.priority && r.priority !== f.priority) return false
    return true
  }),
)

const lastUpdatedAt = ref(null)
const lastUpdatedLabel = computed(() => {
  if (!lastUpdatedAt.value) return '—'
  const seconds = Math.round((Date.now() - lastUpdatedAt.value) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
})

let searchDebounce = null
function onSearchInput() {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => loadRequests(), 400)
}

/**
 * Push the toolbar into the composable's filter bag, then load page one.
 *
 * fetchRequests() takes a page number. This used to hand it the whole filter
 * object, which went out as page[status]=… and came back 422 — the queue then
 * rendered empty no matter what was in it.
 */
async function loadRequests() {
  const quick = activeFilter.value
  const toolbar = toolbarFilters.value

  filters.status = STATUS_FILTERS[toolbar.status] ?? STATUS_FILTERS[quick] ?? undefined
  filters.urgency_level = URGENCY_FILTERS[quick] ?? URGENCY_FILTERS[toolbar.priority] ?? undefined
  filters.search = searchQuery.value.trim() || undefined

  await fetchRequests(1)
  lastUpdatedAt.value = Date.now()
}

function resetFilters() {
  toolbarFilters.value = { hospital: '', bloodType: '', component: '', priority: '', status: '', date: '', neededBy: '' }
  searchQuery.value = ''
  activeFilter.value = 'All'
  loadRequests()
}

async function handleRefresh() {
  await Promise.all([loadRequests(), fetchSummary()])
}

/**
 * Whether an action is in flight against this row.
 *
 * The composable exposes one `isActing` flag for the whole queue, so the id of
 * the row being acted on is tracked here to keep the spinner on the right one.
 */
const mutatingId = ref(null)
function isMutating(id) {
  return isActing.value && mutatingId.value === id
}

/* re-fetch whenever a quick filter pill changes */
watch(activeFilter, () => loadRequests())

/* SUMMARY CARDS */
const summaryLoading = computed(() => loading.value && !summary.value)

/**
 * Recent activity, derived from the requests already loaded.
 *
 * There is no activity endpoint, and the page previously called a
 * `fetchActivity` the composable does not have. Every event below is a
 * timestamp the queue already carries, so the card shows real history instead
 * of throwing.
 */
const activity = computed(() => {
  const events = []

  for (const r of apiRequests.value ?? []) {
    const hospital = r.requesting_facility?.name ?? '—'

    if (r.request_date) {
      events.push({
        id: `${r.id}-received`,
        type: r.is_emergency ? 'emergency' : 'received',
        description: `${r.reference_number} ${r.is_emergency ? 'raised as an emergency' : 'received'}`,
        hospital,
        at: r.request_date,
        staff: 'Requesting facility',
      })
    }

    if (r.reviewed_at) {
      events.push({
        id: `${r.id}-reviewed`,
        type: r.status === 'rejected' ? 'rejected' : 'approved',
        description: `${r.reference_number} ${r.status === 'rejected' ? 'rejected' : 'reviewed'}`,
        hospital,
        at: r.reviewed_at,
        staff: 'Blood centre',
      })
    }

    if (r.fulfilled_at) {
      events.push({
        id: `${r.id}-fulfilled`,
        type: 'reserved',
        description: `${r.reference_number} fulfilled`,
        hospital,
        at: r.fulfilled_at,
        staff: 'Blood centre',
      })
    }
  }

  return events
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8)
    .map((event) => ({ ...event, time: formatDateTime(event.at) }))
})

const summaryStats = computed(() => {
  // The endpoint returns { totals: {…per status}, open_emergencies,
  // awaiting_release }, not the flat camelCase keys this block assumed.
  const payload = summary.value || {}
  const totals = payload.totals || {}
  const s = {
    pending: totals.pending ?? 0,
    emergency: payload.open_emergencies ?? 0,
    underReview: totals.processing ?? 0,
    readyForFulfillment: payload.awaiting_release ?? 0,
  }

  return [
    {
      key: 'pending',
      label: 'Pending Requests',
      value: s.pending ?? 0,
      icon: 'clock',
      trend: s.pendingTrend ?? 'Awaiting staff review',
      trendUp: s.pendingTrendUp ?? null,
    },
    {
      key: 'emergency',
      label: 'Emergency Requests',
      value: s.emergency ?? 0,
      icon: 'triangle-alert',
      trend: s.emergencyTrend ?? 'Requires immediate action',
      trendUp: null,
      danger: true,
    },
    {
      key: 'review',
      label: 'Under Review',
      value: s.underReview ?? 0,
      icon: 'search',
      trend: s.underReviewTrend ?? 'Currently being assessed',
      trendUp: s.underReviewTrendUp ?? null,
    },
    {
      key: 'ready',
      label: 'Ready for Fulfillment',
      value: s.readyForFulfillment ?? 0,
      icon: 'circle-check-big',
      trend: s.readyTrend ?? 'Approved and inventory available',
      trendUp: s.readyTrendUp ?? null,
    },
  ]
})

/* EMERGENCY BANNER */
const emergencyRequests = computed(() =>
  requests.value.filter((r) => r.priority === 'Emergency' && !dismissedAlertIds.value.includes(r.id))
)
const primaryEmergency = computed(() => emergencyRequests.value[0] || null)

function dismissAlert(id) {
  dismissedAlertIds.value.push(id)
}

/* ROW EXPANSION */
const expandedIds = ref(new Set())
function toggleExpand(id) {
  const next = new Set(expandedIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expandedIds.value = next
}

/* REVIEW DRAWER */
const drawerOpen = ref(false)
const drawerLoading = ref(false)
const activeRequest = ref(null)

// Matches the RedAgos request lifecycle up to the review/approval stage only.
const timelineSteps = [
  'Request Submitted',
  'Request Received',
  'Under Review',
  'Inventory Checked',
  'Approved',
  'Inventory Reserved',
  'Request Fulfillment',
]
const statusStepIndex = {
  Pending: 1,
  'Under Review': 2,
  Rejected: 2,
  Approved: 4,
  'Ready for Fulfillment': 6,
}
const currentStepIndex = computed(() => statusStepIndex[activeRequest.value?.status] ?? 0)

const drawerMutating = computed(() => Boolean(activeRequest.value) && isActing.value)

/**
 * Open one request beside the stock that could fill it.
 *
 * fetchRequestDetail() never existed; the composable's openRequest() loads
 * `selected` and `inventory` instead. The per-line availability from the
 * review endpoint is folded back in so the drawer can show real coverage.
 */
async function openReview(request) {
  drawerOpen.value = true
  drawerLoading.value = true
  activeRequest.value = request

  try {
    await openRequest(request.id)

    if (selected.value) {
      const lines = inventory.value?.lines ?? []

      activeRequest.value = {
        ...mapRequest(selected.value),
        available: lines.reduce((sum, line) => sum + (line.available ?? 0), 0),
        outstanding: inventory.value?.outstanding ?? 0,
        canFullyCover: inventory.value?.can_fully_cover ?? false,
        availabilityAsOf: inventory.value?.as_of
          ? new Date(inventory.value.as_of).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
          : null,
        lines,
      }
    }
  } finally {
    drawerLoading.value = false
  }
}

function closeDrawer() {
  drawerOpen.value = false
  setTimeout(() => (activeRequest.value = null), 250)
}

/** Scroll the drawer back to the availability table. */
function handleReviewInventory() {
  document.querySelector('.drawer-content')?.scrollTo({ top: 0, behavior: 'smooth' })
}

/* APPROVAL — confirmation modal */
const showApproveModal = ref(false)
const requestToApprove = ref(null)
const approving = ref(false)

/**
 * Open the approval confirmation.
 *
 * No longer refuses up front. The guard here asked coverage whether there was
 * stock, so a request with nothing reserved yet — which is every new request —
 * was turned away before the server was ever asked. Allocation re-checks every
 * unit under a lock anyway, and a partial hold is a normal outcome it reports
 * rather than an error, so the decision belongs there.
 */
function requestApprove(request) {
  if (!request) return
  requestToApprove.value = request
  showApproveModal.value = true
}

function closeApproveModal() {
  if (approving.value) return
  showApproveModal.value = false
  requestToApprove.value = null
}

async function confirmApprove() {
  if (!requestToApprove.value) return
  approving.value = true
  mutatingId.value = requestToApprove.value.id

  try {
    // Holds stock FEFO across the request's lines and moves it to Processing.
    await allocate(requestToApprove.value.id)
    toast('Request Approved', 'success', `${requestToApprove.value.code} was approved and stock has been reserved.`)
    showApproveModal.value = false
    requestToApprove.value = null
    closeDrawer()
    await Promise.all([loadRequests(), fetchSummary()])
  } catch (err) {
    // The API refuses with a message written for staff; show it rather than
    // replacing it with something vaguer.
    toast('Unable to Approve Request', 'danger', err?.message || 'Please try again in a moment.')
  } finally {
    approving.value = false
    mutatingId.value = null
  }
}

/* REJECTION — confirmation modal with required reason*/
const showRejectModal = ref(false)
const requestToReject = ref(null)
const rejectReason = ref('')
const rejectNotes = ref('')
const rejecting = ref(false)

function requestReject(request) {
  if (!request) return
  requestToReject.value = request
  rejectReason.value = ''
  rejectNotes.value = ''
  showRejectModal.value = true
}

function closeRejectModal() {
  if (rejecting.value) return
  showRejectModal.value = false
  requestToReject.value = null
}

async function confirmReject() {
  if (!requestToReject.value || !rejectReason.value) return
  rejecting.value = true
  mutatingId.value = requestToReject.value.id

  // The API takes one reason string and shows it to the requester, so the
  // optional notes are appended rather than dropped.
  const reason = [rejectReason.value, rejectNotes.value].filter(Boolean).join(' — ')

  try {
    await reject(requestToReject.value.id, reason)
    toast('Request Rejected', 'danger', 'The request has been marked as rejected.')
    showRejectModal.value = false
    requestToReject.value = null
    closeDrawer()
    await Promise.all([loadRequests(), fetchSummary()])
  } catch (err) {
    toast('Unable to Reject Request', 'danger', err?.message || 'Please try again in a moment.')
  } finally {
    rejecting.value = false
    mutatingId.value = null
  }
}

/* ROW MENU */
const openMenuId = ref(null)
function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id
}

// Minimal outside-click directive so the context menu closes without a global click listener leak.
const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (event) => {
      if (!el.contains(event.target)) binding.value(event)
    }
    document.addEventListener('click', el._clickOutside, true)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside, true)
  },
}

function handlePrint(request) {
  toast('Preparing Print View', 'info', `${request.id} is ready to print.`)
  window.print()
}

/**
 * Download this incoming request as the DOH Blood Request Form (Adult).
 *
 * Byte-identical to the copy the requesting hospital prints — both portals
 * call the same server-side renderer.
 */
async function handleExportPdf(request) {
  try {
    const blob = await bloodCenterService.downloadRequestForm(request.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `BRF-${request.reference_number ?? request.id}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to download request form:', err)
    toast('Export Failed', 'danger', err?.message || 'Could not download the request form.')
  }
}

function handleExportAll() {
  // connect to actual bulk export endpoint (e.g. GET /api/center/requests/export)
  toast('Export Started', 'info', 'Preparing an export of the current request list.')
}

/* INVENTORY HELPERS */
/*
 * Coverage and availability are two different questions and this page needs
 * both. Coverage is how much stock is already held FOR the request; the queue
 * endpoint carries it for every row. Availability is how much issuable stock
 * is on the shelf, which only the review endpoint knows, per component.
 *
 * They were briefly the same function, which is why a request for one unit
 * with one unit available still read "Insufficient Inventory": nothing had
 * been reserved yet, and coverage was being asked an availability question.
 */

/** How much of the request is already reserved. Used by the queue and banner. */
function coverageLevel(request) {
  if (!request || !request.units) return 'insufficient'
  if (request.allocated >= request.units) return 'ok'
  if (request.allocated > 0) return 'low'
  return 'insufficient'
}

/**
 * Whether the shelf can answer what is still outstanding.
 *
 * Measured against `outstanding` rather than the full request: units already
 * held are not needed from stock again, so judging against the original figure
 * would call a part-reserved request short when it is not.
 */
function availabilityLevel(request) {
  if (!request) return 'insufficient'

  const available = request.available ?? 0
  const needed = request.outstanding ?? request.units ?? 0

  if (needed <= 0) return 'ok'
  if (available >= needed) return 'ok'
  if (available > 0) return 'low'
  return 'insufficient'
}

/** Per-component availability, as the review endpoint reports it. */
function lineLevel(line) {
  if (!line) return 'insufficient'
  if (line.can_fully_cover) return 'ok'
  if ((line.available ?? 0) > 0) return 'low'
  return 'insufficient'
}

// The queue column and the emergency banner both speak coverage.
const inventoryLevel = coverageLevel
function inventoryIcon(level) {
  return { ok: 'check', low: 'triangle-alert', insufficient: 'x' }[level] || 'check'
}
function priorityIcon(priority) {
  return { Routine: 'info', Urgent: 'triangle-alert', Emergency: 'octagon-alert' }[priority] || 'info'
}

/* ACTIVITY FEED HELPERS */
const activityLoading = computed(() => loading.value && activity.value.length === 0)

function activityToneClass(type) {
  if (type === 'emergency' || type === 'rejected') return 'danger'
  if (type === 'approved' || type === 'reserved') return 'success'
  return 'info'
}
function activityIcon(type) {
  const map = {
    received: 'inbox',
    emergency: 'triangle-alert',
    reserved: 'archive',
    approved: 'circle-check-big',
    rejected: 'circle-x',
  }
  return map[type] || 'activity'
}

/* INITIAL LOAD */
onMounted(() => {
  handleRefresh()
})
</script>

<style scoped>
/* TOKENS */
.page {
  /*
   * Two families. The `-fill` tokens are the surfaces that carry white text,
   * so they stay deep in both themes; the plain names are the colours used AS
   * text and icons, and those lift in the dark block below. Left as one set,
   * every status pill, trend arrow and stage badge sat between 2.2:1 and 3:1
   * on a dark card.
   */
  --primary: #1565c0;
  --primary-fill: #1565c0;
  --primary-fill-hover: #0d47a1;
  --bg: #F7F8FA;
  --card: #ffffff;
  --border: #e5eaf0;
  --text: #1e293b;
  --text-secondary: #64748b;
  --success: #2e7d32;
  --success-fill: #2e7d32;
  /* amber-500 is 2.1:1 on the pale tint it sits on; amber-700 reads. The
     fill keeps the brighter value — nothing writes on it. */
  --warning: #b45309;
  --warning-fill: #f59e0b;
  --danger: #d32f2f;
  --danger-fill: #d32f2f;
  --info: #2563eb;
  --info-fill: #2563eb;
  --purple: #7c3aed;
  --radius: 14px;
  --card-padding: 24px;
  --shadow: 0 1px 2px rgba(15, 23, 42, 0.04);

  background: var(--bg);
  color: var(--text);
  font-family: var(--rb-font-sans);
  /* Same column as every other blood-centre page, so a user moving between
     them does not see the content jump width and the gutters change. */
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* TOASTS */
.toast-stack {
  position: fixed; top: 20px; right: 20px; z-index: 300;
  display: flex; flex-direction: column; gap: 8px; max-width: 320px;
}
.toast {
  padding: 12px 16px; border-radius: 12px; color: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}
.toast-title { font-size: 13px; font-weight: 600; }
.toast-message { font-size: 12.5px; font-weight: 400; line-height: 1.55; margin-top: 2px; }
.toast--success { background: var(--success-fill); }
.toast--danger { background: var(--danger-fill); }
.toast--warning { background: #B45309; }
.toast--info { background: var(--info-fill); }
.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(20px); }

/* HEADER */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.02em; }
.page-subtitle { font-size: 13px; color: var(--text-secondary); margin: 0; }
.header-actions { display: flex; gap: 10px; }

.btn {
  display: inline-flex; align-items: center; gap: 6px; border-radius: 10px;
  font-size: 13px; font-weight: 700; padding: 10px 16px; cursor: pointer;
  border: 1px solid transparent; transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.btn-sm { padding: 8px 14px; font-size: 12px; }
.btn-xs { padding: 5px 10px; font-size: 12px; border-radius: 8px; }
.btn-primary { background: var(--primary-fill); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--primary-fill-hover); }
.btn-outline { background: var(--card); color: var(--text); border-color: var(--border); }
.btn-outline:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
.btn-danger { background: var(--danger-fill); color: #fff; }
.btn-danger:hover:not(:disabled) { background: #a82424; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.icon-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px;
  border-radius: 8px; border: 1px solid var(--border); background: var(--card);
  color: var(--text-secondary); cursor: pointer; transition: all 0.15s ease;
}
.icon-btn:hover { border-color: var(--primary); color: var(--primary); }

.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* RETRY BANNER */
.retry-banner {
  display: flex; align-items: center; gap: 10px; background: #FDF1F1;
  border: 1px solid #F2D2D2; color: #C62828; border-radius: 12px;
  padding: 12px 16px; font-size: 13px; font-weight: 500;
}
.retry-banner .btn { margin-left: auto; }

/* EMERGENCY BANNER */
.emergency-banner {
  background: #FDF1F1; border: 1px solid #F2D2D2; border-left: 4px solid var(--danger);
  border-radius: var(--radius); padding: 20px 24px; display: flex;
  justify-content: space-between; gap: 20px; align-items: flex-start;
}
.emergency-main { display: flex; gap: 14px; }
.emergency-icon {
  width: 36px; height: 36px; border-radius: 10px; background: var(--danger-fill); color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.emergency-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.emergency-title { font-weight: 600; font-size: 15px; color: #C62828; }
.emergency-id { font-size: 12px; color: var(--text-secondary); font-family: monospace; }
/* auto-fit, not a fixed count: the content column now changes width
   when the rail expands, so the grid has to answer to its container
   rather than to a viewport breakpoint that no longer describes it. */
.emergency-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px 24px; }
.e-label { display: block; font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
.e-value { display: block; font-size: 14px; font-weight: 600; }
.insufficient-tag { margin-top: 12px; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #C62828; }
.emergency-actions { display: flex; align-items: flex-start; gap: 8px; flex-shrink: 0; }

/* SUMMARY CARDS */
.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.summary-card {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: var(--card-padding); display: flex; gap: 14px; box-shadow: var(--shadow);
}
.skeleton-card { min-height: 88px; background: linear-gradient(90deg, #eef2f7 25%, #f7f9fc 37%, #eef2f7 63%); background-size: 400% 100%; animation: shimmer 1.4s infinite; }
.summary-icon {
  width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0; background: #e8f0fc; color: var(--primary);
  display: flex; align-items: center; justify-content: center;
}
.summary-icon.is-danger { background: #fdecea; color: var(--danger); }
.summary-value { font-size: 26px; font-weight: 700; margin: 0; line-height: 1.1; }
.summary-label { font-size: 13px; color: var(--text-secondary); margin: 2px 0 6px; }
.summary-trend { font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; margin: 0; }
.summary-trend.up { color: var(--success); }
.summary-trend.down { color: var(--danger); }

/* QUICK FILTERS */
.quick-filters { display: flex; flex-wrap: wrap; gap: 8px; }
.pill {
  padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 600;
  border: 1px solid var(--border); background: var(--card); color: var(--text-secondary);
  cursor: pointer; transition: all 0.15s ease;
}
.pill:hover { border-color: var(--primary); color: var(--primary); }
.pill.active { background: var(--primary-fill); border-color: var(--primary-fill); color: #fff; }

/* TOOLBAR */
.toolbar {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  box-shadow: var(--shadow); position: sticky; top: 0; z-index: 5;
}
.toolbar-search { position: relative; flex: 1 1 220px; min-width: 200px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); }
.toolbar-search input { width: 100%; padding: 9px 12px 9px 32px; border-radius: 10px; border: 1px solid var(--border); font-size: 13px; background: var(--bg); }
.toolbar select, .toolbar input[type="date"] { padding: 9px 10px; border-radius: 10px; border: 1px solid var(--border); font-size: 13px; background: var(--bg); color: var(--text); }
.toolbar-buttons { display: flex; gap: 8px; }
.toolbar-meta { margin-left: auto; font-size: 12px; color: var(--text-secondary); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.dot { opacity: 0.5; }

/* TABLE */
.table-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: auto; }
.request-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 1000px; }
.request-table thead th {
  position: sticky; top: 0; background: var(--card); text-align: left; padding: 14px 16px;
  font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.03em;
  border-bottom: 1px solid var(--border); z-index: 2;
}
.table-row { border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s ease, border-left 0.15s ease; border-left: 3px solid transparent; }
.table-row:hover { background: #f4f8fd; border-left-color: var(--primary); }
.table-row.is-mutating { opacity: 0.6; pointer-events: none; }
.request-table td { padding: 14px 16px; vertical-align: middle; }
.mono { font-family: monospace; font-size: 12px; color: var(--text-secondary); }

.expand-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;
  border: none; background: transparent; color: var(--text-secondary); cursor: pointer; border-radius: 6px;
  margin-right: 2px; vertical-align: middle;
}
.expand-btn:hover { background: var(--bg); color: var(--primary); }

.hospital-cell { display: flex; flex-direction: column; }
.hospital-name { font-weight: 600; }
.hospital-contact { font-size: 12px; color: var(--text-secondary); }
.requested-by { color: var(--text-secondary); font-size: 12.5px; }

.blood-pill { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; padding: 3px 8px; border-radius: 8px; background: #fdecea; color: var(--danger); font-weight: 700; font-size: 12px; }

.inv-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 8px; }
.inv-inline { display: inline-flex; align-items: center; gap: 4px; }
.inv-ok { color: var(--success); background: #e8f5e9; }
.inv-low { color: var(--warning); background: #fef3e0; }
.inv-insufficient { color: var(--danger); background: #fdecea; }
.inventory-status-line { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; margin: 10px 0 0; padding: 6px 10px; border-radius: 8px; }
.inventory-status-line.inv-ok { background: #e8f5e9; }
.inventory-status-line.inv-low { background: #fef3e0; }
.inventory-status-line.inv-insufficient { background: #fdecea; }

.priority-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.priority-routine { background: #eef2f7; color: var(--text-secondary); }
.priority-urgent { background: #fef3e0; color: var(--warning); }
.priority-emergency { background: #fdecea; color: var(--danger); }

.status-badge { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.status-pending { background: #eef2f7; color: var(--text-secondary); }
.status-under-review { background: #e8f0fc; color: var(--info); }
.status-approved { background: #e8f5e9; color: var(--success); }
.status-rejected { background: #fdecea; color: var(--danger); }
.status-ready-for-fulfillment { background: #ede7fb; color: var(--purple); }

.needed-by { color: var(--text-secondary); font-size: 12.5px; }

.actions-cell { display: flex; align-items: center; gap: 8px; }
.menu-wrap { position: relative; }
.context-menu {
  position: absolute; right: 0; top: 36px; background: var(--card); border: 1px solid var(--border);
  border-radius: 12px; box-shadow: 0 8px 24px rgba(15,23,42,0.12); display: flex; flex-direction: column;
  min-width: 190px; padding: 6px; z-index: 10;
}
.context-menu button { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; border: none; background: transparent; font-size: 13px; text-align: left; cursor: pointer; color: var(--text); width: 100%; }
.context-menu button:hover:not(:disabled) { background: var(--bg); }
.context-menu button.danger { color: var(--danger); }
.context-menu button:disabled { opacity: 0.5; cursor: not-allowed; }

/* EXPANDED ROW */
.expanded-row td { padding: 0; }
.expanded-content { background: var(--bg); padding: 18px 20px; border-bottom: 1px solid var(--border); }
.expanded-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px 20px; margin-bottom: 14px; }
.expanded-actions { display: flex; gap: 8px; justify-content: flex-end; }

/* skeleton / empty */
.table-skeleton, .activity-skeleton, .drawer-loading { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.skeleton-row { height: 44px; border-radius: 10px; background: linear-gradient(90deg, #eef2f7 25%, #f7f9fc 37%, #eef2f7 63%); background-size: 400% 100%; animation: shimmer 1.4s infinite; }
@keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
.empty-state { padding: 60px 24px; text-align: center; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty-state h3 { margin: 8px 0 0; color: var(--text); font-size: 16px; }
.empty-state p { margin: 0 0 8px; font-size: 13px; }

/* ACTIVITY */
.activity-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--card-padding); box-shadow: var(--shadow); }
.section-title { font-size: 15px; font-weight: 700; margin: 0 0 16px; }
.activity-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.activity-empty { font-size: 13px; color: var(--text-secondary); margin: 0; }
.activity-item { display: flex; gap: 12px; align-items: flex-start; }
.activity-dot { width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.activity-dot.info { background: #e8f0fc; color: var(--info); }
.activity-dot.danger { background: #fdecea; color: var(--danger); }
.activity-dot.success { background: #e8f5e9; color: var(--success); }
.activity-body p { margin: 0; font-size: 13.5px; }
.activity-meta { font-size: 12px; color: var(--text-secondary); }

/* DRAWER */
.drawer-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); display: flex; justify-content: flex-end; z-index: 50; }
.drawer { width: 500px; max-width: 100%; height: 100%; background: var(--card); display: flex; flex-direction: column; box-shadow: -8px 0 30px rgba(15,23,42,0.15); }
.drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--border); }
.drawer-header h2 { margin: 0; font-size: 17px; }
.drawer-content { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 24px; }
.drawer-section h3 { margin: 0 0 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-secondary); }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; margin: 0; }
.detail-grid dt { font-size: 11px; color: var(--text-secondary); margin-bottom: 2px; }
.detail-grid dd { margin: 0; font-size: 13.5px; font-weight: 600; }

.notes-block { margin-top: 12px; background: var(--bg); border-radius: 10px; padding: 12px 14px; }
.notes-label { font-size: 11px; color: var(--text-secondary); margin: 0 0 2px; text-transform: uppercase; }
.notes-text { font-size: 13px; margin: 0 0 10px; }
.notes-text:last-child { margin-bottom: 0; }

.batches-label, .health-bar-label { font-size: 12px; color: var(--text-secondary); margin: 14px 0 6px; }
.batch-list { display: flex; flex-direction: column; gap: 6px; }
.batch-empty { font-size: 12.5px; color: var(--text-secondary); }
.batch-row { display: flex; flex-direction: column; gap: 3px; font-size: 12.5px; padding: 10px 12px; background: var(--bg); border-radius: 10px; }
.batch-main { display: flex; justify-content: space-between; font-weight: 700; }
.batch-expiry { color: var(--text-secondary); font-weight: 500; }
.batch-meta { display: flex; justify-content: space-between; color: var(--text-secondary); }
.health-bar { height: 8px; border-radius: 999px; background: var(--border); overflow: hidden; }
.health-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }
.health-fill.inv-ok { background: var(--success); }
.health-fill.inv-low { background: var(--warning-fill); }
.health-fill.inv-insufficient { background: var(--danger); }

.timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.timeline li { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-secondary); }
.timeline li.done { color: var(--text); font-weight: 600; }
.timeline li.current { color: var(--primary); font-weight: 700; }
.timeline-dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; }
.timeline li.done .timeline-dot { background: var(--primary); border-color: var(--primary); }
.timeline li.current .timeline-dot { border-color: var(--primary); }

.drawer-footer { display: flex; gap: 10px; padding: 16px 24px; border-top: 1px solid var(--border); }
.drawer-footer .btn { flex: 1; justify-content: center; }

/* MODALS */
.modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
.modal { background: var(--card); border-radius: var(--radius); padding: 24px; width: 100%; max-width: 440px; box-shadow: 0 8px 28px rgba(15, 23, 42, 0.18); }
.modal-title { font-size: 16px; font-weight: 700; margin: 0 0 4px; }
.modal-desc { font-size: 13px; color: var(--text-secondary); margin: 0 0 16px; }
.modal-summary { background: var(--bg); border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 8px; }
.modal-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; gap: 12px; }
.modal-row span { color: var(--text-secondary); }
.modal-row strong { text-align: right; }
.modal-actions { display: flex; gap: 10px; margin-top: 18px; }
.modal-actions .btn { flex: 1; justify-content: center; }

.field { margin-bottom: 14px; }
.field-label { font-size: 12px; font-weight: 600; display: block; margin-bottom: 6px; }
.field-select, .field-textarea {
  width: 100%; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text); font-size: 13px; font-family: inherit;
}
.field-textarea { resize: vertical; }

/* TRANSITIONS */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.25s ease; }
.drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: transform 0.25s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer, .drawer-leave-to .drawer { transform: translateX(100%); }

/* RESPONSIVE */
@media (max-width: 640px) {
  .page { padding: 16px 16px 32px; }
  .summary-grid { grid-template-columns: 1fr; }
  .emergency-banner { flex-direction: column; }
  .emergency-actions { flex-wrap: wrap; }
  .drawer { width: 100%; }
  .expanded-grid { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .summary-card, .pill, .table-row, .drawer, .health-fill, .spinning { transition: none !important; animation: none !important; }
}
/*
 * DARK MODE. Two rules about the selectors here, both learned the hard way:
 *
 *  - `:global(.dark) .selector` does NOT work — this toolchain drops the
 *    descendant half and emits a bare `.dark { … }`, putting the declaration
 *    on <html>.
 *  - `:global(.dark .selector)` works but is fully global, so it must be
 *    anchored on `.page`. Unanchored, these rules matched .summary-card,
 *    .table-row and friends on every other page in the app the moment this
 *    route's stylesheet was fetched.
 */
:global(.dark .page) {
  --bg: #0F172A; --card: #171e2c; --border: #2a3447; --text: #e2e8f0; --text-secondary: #94a3b8;
  /* Only the text family lifts; the -fill tokens keep their deep values so
     white-on-fill buttons and toasts stay legible. */
  --primary: #64b5f6; --success: #66bb6a; --warning: #fbbf24;
  --danger: #f87171; --info: #60a5fa; --purple: #a78bfa;
  --primary-fill-hover: #1976d2;
}
:global(.dark .page .summary-icon) { background: #1c2a42; }
:global(.dark .page .summary-icon.is-danger) { background: #3a1f22; }
:global(.dark .page .emergency-banner) { background: rgba(239, 83, 80, 0.10); border-color: rgba(239, 83, 80, 0.24); }
:global(.dark .page .retry-banner) { background: rgba(239, 83, 80, 0.10); border-color: rgba(239, 83, 80, 0.24); color: #EF9A9A; }
:global(.dark .page .blood-pill) { background: #3a1f22; }
:global(.dark .page .inv-ok) { background: #16301c; }
:global(.dark .page .inv-low) { background: #3a2c10; }
:global(.dark .page .inv-insufficient) { background: #3a1f22; }
:global(.dark .page .inventory-status-line.inv-ok) { background: #16301c; }
:global(.dark .page .inventory-status-line.inv-low) { background: #3a2c10; }
:global(.dark .page .inventory-status-line.inv-insufficient) { background: #3a1f22; }
:global(.dark .page .status-pending) { background: #1e2635; }
:global(.dark .page .status-under-review) { background: #16223a; }
:global(.dark .page .status-approved) { background: #16301c; }
:global(.dark .page .status-rejected) { background: #3a1f22; }
:global(.dark .page .status-ready-for-fulfillment) { background: #2a1f42; }
:global(.dark .page .table-row:hover) { background: #1c2536; }
:global(.dark .page .expanded-content) { background: #141b29; }
:global(.dark .page .skeleton-row),
:global(.dark .page .skeleton-card) { background: linear-gradient(90deg, #1c2536 25%, #212b3f 37%, #1c2536 63%); background-size: 400% 100%; }
:global(.dark .page .notes-block),
:global(.dark .page .batch-row),
:global(.dark .page .modal-summary),
:global(.dark .page .field-select),
:global(.dark .page .field-textarea),
:global(.dark .page .toolbar-search input),
:global(.dark .page .toolbar select),
:global(.dark .page .toolbar input[type="date"]) { background: #1c2536; }
:global(.dark .page .context-menu),
:global(.dark .page .modal) { box-shadow: 0 8px 24px rgba(0,0,0,0.4); }

.btn:focus-visible,
.icon-btn:focus-visible,
.expand-btn:focus-visible {
  outline: 2px solid var(--rb-primary, #1565C0);
  outline-offset: 2px;
}

/* Per-component availability in the review drawer. */
.avail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  margin-bottom: 10px;
}
.avail-table th {
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: .4px;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
  padding: 0 8px 6px;
  border-bottom: 1px solid var(--rb-border-strong);
}
.avail-table td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--rb-border);
  color: var(--rb-text-primary);
}
.avail-table tr:last-child td { border-bottom: none; }
.avail-table .num { text-align: right; }

.inventory-advisory {
  font-size: 11.5px;
  color: var(--rb-text-secondary);
  margin: 6px 0 12px;
}
</style>