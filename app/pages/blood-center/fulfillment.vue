<template>
  <div class="rf-page" :class="{ 'rf-dark': isDark }">
    <!-- ================= HEADER ================= -->
    <header class="rf-header">
      <div class="rf-header-left">
        <h1 class="rf-title">Request Fulfillment</h1>
        <p class="rf-subtitle">
          Process and coordinate the fulfillment of approved hospital blood requests.
        </p>
      </div>
      <div class="rf-header-actions">
        <button class="rf-btn rf-btn-outline" :disabled="pending" @click="refreshQueue">
          <AssetIcon name="refresh-cw" :class="{ 'rf-spin': pending }" />
          Refresh Queue
        </button>
        <button class="rf-btn rf-btn-outline" :disabled="exporting" @click="exportReport">
          <AssetIcon name="upload" />
          {{ exporting ? 'Exporting…' : 'Export Fulfillment Report' }}
        </button>
      </div>
    </header>

    <!-- ================= OPERATION ALERT ================= -->
    <div v-if="pending && !alertChecked" class="rf-alert rf-skeleton-card" style="height:64px" />
    <div v-else-if="activeAlert" class="rf-alert" role="alert">
      <div class="rf-alert-icon"><AssetIcon name="triangle-alert" /></div>
      <div class="rf-alert-body">
        <p class="rf-alert-title">{{ activeAlert.title }}</p>
        <p class="rf-alert-desc">{{ activeAlert.description }}</p>
      </div>
      <div class="rf-alert-actions">
        <button class="rf-btn rf-btn-primary rf-btn-sm" @click="handleAlertAction(activeAlert)">
          {{ activeAlert.actionLabel }}
        </button>
        <button class="rf-btn rf-btn-ghost rf-btn-sm" @click="dismissAlert">Dismiss</button>
      </div>
    </div>

    <!-- ================= SUMMARY CARDS ================= -->
    <section class="rf-kpi-grid" aria-label="Fulfillment summary">
      <template v-if="pending && !kpis.length">
        <div v-for="n in 4" :key="n" class="rf-kpi-card rf-skeleton-card" />
      </template>
      <article
        v-for="kpi in kpis"
        v-else
        :key="kpi.key"
        class="rf-kpi-card"
        :style="{ '--kpi-accent': kpi.accent }"
      >
        <div class="rf-kpi-top">
          <div class="rf-kpi-icon"><AssetIcon :name="kpi.icon" /></div>
          <span v-if="kpi.trend !== null && kpi.trend !== undefined" class="rf-kpi-trend" :class="kpi.trend >= 0 ? 'is-up' : 'is-down'">
            <AssetIcon :name="kpi.trend >= 0 ? 'trending-up' : 'trending-down'" />
            {{ Math.abs(kpi.trend) }}%
          </span>
        </div>
        <p class="rf-kpi-value">{{ kpi.value }}</p>
        <p class="rf-kpi-label">{{ kpi.label }}</p>
        <p class="rf-kpi-desc">{{ kpi.description }}</p>
      </article>
    </section>

    <!-- ================= STATUS FILTER PILLS ================= -->
    <div class="rf-filter-pills" role="tablist" aria-label="Fulfillment status filters">
      <button
        v-for="pill in statusPills"
        :key="pill.value"
        class="rf-pill"
        :class="{ 'is-active': query.status === pill.value }"
        role="tab"
        :aria-selected="query.status === pill.value"
        @click="setStatus(pill.value)"
      >
        {{ pill.label }}
        <span class="rf-pill-count">{{ statusCounts[pill.value] ?? 0 }}</span>
      </button>
    </div>

    <!-- ================= ADVANCED FILTER TOOLBAR ================= -->
    <div class="rf-toolbar">
      <div class="rf-toolbar-search">
        <AssetIcon name="search" />
        <input
          v-model="query.search"
          type="text"
          placeholder="Search request ID, hospital, blood type, or batch..."
          aria-label="Search fulfillment requests"
          @keyup.enter="applyFilters"
        />
      </div>

      <select v-model="query.hospital" class="rf-select" aria-label="Filter by hospital">
        <option value="">Hospital</option>
        <option v-for="h in filterOptions.hospitals" :key="h" :value="h">{{ h }}</option>
      </select>

      <select v-model="query.bloodType" class="rf-select" aria-label="Filter by blood type">
        <option value="">Blood Type</option>
        <option v-for="b in filterOptions.bloodTypes" :key="b" :value="b">{{ b }}</option>
      </select>

      <select v-model="query.component" class="rf-select" aria-label="Filter by component">
        <option value="">Component</option>
        <option v-for="c in filterOptions.components" :key="c" :value="c">{{ c }}</option>
      </select>

      <select v-model="query.priority" class="rf-select" aria-label="Filter by priority">
        <option value="">Priority</option>
        <option v-for="p in filterOptions.priorities" :key="p" :value="p">{{ p }}</option>
      </select>

      <select v-model="query.dispatchStatus" class="rf-select" aria-label="Filter by fulfillment status">
        <option value="">Fulfillment Status</option>
        <option v-for="s in statusPills.slice(1)" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>

      <select v-model="query.dispatchMethod" class="rf-select" aria-label="Filter by dispatch method">
        <option value="">Dispatch Method</option>
        <option v-for="m in filterOptions.dispatchMethods" :key="m" :value="m">{{ m }}</option>
      </select>

      <select v-model="query.assignedStaff" class="rf-select" aria-label="Filter by assigned staff">
        <option value="">Assigned Staff</option>
        <option v-for="s in filterOptions.staff" :key="s" :value="s">{{ s }}</option>
      </select>

      <input v-model="query.date" type="date" class="rf-select" aria-label="Filter by date" />

      <div class="rf-toolbar-btns">
        <button class="rf-btn rf-btn-outline rf-btn-sm" @click="resetFilters">Reset Filters</button>
        <button class="rf-btn rf-btn-primary rf-btn-sm" @click="applyFilters">Apply Filters</button>
      </div>

      <div class="rf-toolbar-meta">
        <span>Showing {{ meta.total ?? requests.length }} active requests</span>
        <span class="rf-toolbar-updated">Updated {{ lastUpdatedLabel }}</span>
      </div>
    </div>

    <div class="rf-content-grid">
      <!-- ================= MAIN FULFILLMENT TABLE ================= -->
      <div class="rf-table-wrap">
        <div v-if="pending" class="rf-skeleton-table">
          <div v-for="n in 6" :key="n" class="rf-skeleton-row" />
        </div>

        <div v-else-if="error" class="rf-empty-state">
          <AssetIcon name="triangle-alert" class="rf-empty-illustration" />
          <h3>Unable to Load Fulfillment Queue</h3>
          <p>We couldn't retrieve the latest fulfillment information.</p>
          <button class="rf-btn rf-btn-primary" @click="refreshQueue">Try Again</button>
        </div>

        <div v-else-if="requests.length === 0 && !hasActiveFilters" class="rf-empty-state">
          <AssetIcon name="inbox" class="rf-empty-illustration" />
          <h3>No Active Fulfillment Requests</h3>
          <p>There are currently no approved hospital requests waiting for fulfillment.</p>
          <button class="rf-btn rf-btn-primary" @click="refreshQueue">Refresh Queue</button>
        </div>

        <div v-else-if="requests.length === 0 && hasActiveFilters" class="rf-empty-state">
          <AssetIcon name="search" class="rf-empty-illustration" />
          <h3>No Fulfillment Requests Found</h3>
          <p>No active fulfillment requests match your current filters.</p>
          <div class="rf-empty-actions">
            <button class="rf-btn rf-btn-outline" @click="resetFilters">Clear Filters</button>
            <button class="rf-btn rf-btn-primary" @click="refreshQueue">Refresh Queue</button>
          </div>
        </div>

        <table v-else class="rf-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Hospital</th>
              <th>Blood Type</th>
              <th>Component</th>
              <th>Reserved Units</th>
              <th>Assigned Staff</th>
              <th>Dispatch Method</th>
              <th>Current Stage</th>
              <th>Needed By</th>
              <th class="rf-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="req in requests" :key="req.id" class="rf-row">
              <td class="rf-mono">{{ req.id }}</td>
              <td>
                <p class="rf-cell-strong">{{ req.hospital }}</p>
                <p class="rf-cell-sub">{{ req.department }}</p>
              </td>
              <td><span class="rf-blood-badge">{{ req.bloodType }}</span></td>
              <td>{{ req.component }}</td>
              <td>
                <p class="rf-cell-strong">{{ req.reservedUnits }} units</p>
                <p class="rf-cell-sub">{{ (req.batchIds || []).join(', ') }}</p>
              </td>
              <td>{{ req.assignedStaff || '—' }}</td>
              <td>{{ req.dispatchMethod || '—' }}</td>
              <td>
                <span class="rf-stage-badge" :class="`is-${stageToSlug(req.stage)}`">
                  <AssetIcon :name="stageIcon(req.stage)" />
                  {{ req.stage }}
                </span>
              </td>
              <td :class="{ 'rf-needed-urgent': isUrgent(req.neededBy) }">{{ formatTime(req.neededBy) }}</td>
              <td class="rf-actions-cell">
                <button class="rf-btn rf-btn-primary rf-btn-sm" @click="openDrawer(req.id)">Continue</button>
                <div class="rf-menu-wrap">
                  <button class="rf-icon-btn" @click="toggleMenu(req.id)" aria-label="More actions">
                    <AssetIcon name="move-vertical" />
                  </button>
                  <div v-if="openMenu === req.id" class="rf-menu">
                    <button @click="openDrawer(req.id)">View Fulfillment Details</button>
                    <button @click="handleUpdateStatus(req)">Update Status</button>
                    <button @click="openAssignStaffModal(req)">Assign Staff</button>
                    <button @click="openAssignCourierModal(req)">Assign Courier</button>
                    <button @click="printDispatchForm(req)">Print Dispatch Form</button>
                    <button @click="printBloodLabels(req)">Print Blood Labels</button>
                    <button @click="openTimelineModal(req)">View Timeline</button>
                    <div class="rf-menu-divider" />
                    <button @click="exportSingleRequest(req)">Export PDF</button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ================= SIDE COLUMN ================= -->
      <aside class="rf-side-col">
        <div class="rf-card rf-dispatch-panel">
          <h3 class="rf-card-title">Today's Dispatch</h3>
          <div v-if="pending && !dispatchPanel" class="rf-skeleton-row" style="height:90px" />
          <div v-else class="rf-dispatch-grid">
            <div class="rf-dispatch-stat">
              <p class="rf-dispatch-value">{{ dispatchPanel?.scheduled ?? '—' }}</p>
              <p class="rf-dispatch-label">Scheduled Dispatches</p>
            </div>
            <div class="rf-dispatch-stat">
              <p class="rf-dispatch-value">{{ dispatchPanel?.inTransit ?? '—' }}</p>
              <p class="rf-dispatch-label">In Transit</p>
            </div>
            <div class="rf-dispatch-stat">
              <p class="rf-dispatch-value">{{ dispatchPanel?.deliveredToday ?? '—' }}</p>
              <p class="rf-dispatch-label">Delivered Today</p>
            </div>
            <div class="rf-dispatch-stat">
              <p class="rf-dispatch-value">{{ dispatchPanel?.avgPrepTime ?? '—' }}</p>
              <p class="rf-dispatch-label">Avg. Preparation Time</p>
            </div>
          </div>
        </div>

        <div class="rf-card rf-activity-panel">
          <h3 class="rf-card-title">Recent Fulfillment Activity</h3>
          <div v-if="pending && !activityLog.length" class="rf-skeleton-row" style="height:160px" />
          <ul v-else-if="activityLog.length" class="rf-timeline">
            <li v-for="event in activityLog" :key="event.id" class="rf-timeline-item">
              <span class="rf-timeline-dot" :class="`is-${event.type}`">
                <AssetIcon :name="event.icon" />
              </span>
              <div class="rf-timeline-body">
                <p class="rf-timeline-desc">{{ event.description }}</p>
                <p class="rf-timeline-meta">{{ event.staff }} · {{ event.timestamp }}</p>
              </div>
            </li>
          </ul>
          <p v-else class="rf-timeline-empty">No activity recorded yet today.</p>
        </div>
      </aside>
    </div>

    <!-- ================= FULFILLMENT DETAILS MODAL ================= -->
    <Teleport to="body">
      <div v-if="drawerRequestId" class="rf-drawer-overlay" :class="{ 'rf-dark': isDark }" @click.self="closeDrawer">
        <aside class="rf-drawer" role="dialog" aria-label="Fulfillment details">
          <div v-if="drawerPending" class="rf-drawer-loading">
            <div v-for="n in 5" :key="n" class="rf-skeleton-row" />
          </div>

          <template v-else-if="drawerRequest">
            <header class="rf-drawer-header">
              <div>
                <p class="rf-drawer-eyebrow">{{ drawerRequest.id }}</p>
                <h2>{{ drawerRequest.hospital }}</h2>
              </div>
              <button class="rf-icon-btn" @click="closeDrawer" aria-label="Close drawer"><AssetIcon name="x" /></button>
            </header>

            <div class="rf-drawer-body">
              <div class="rf-stepper">
                <div
                  v-for="(step, i) in workflowSteps"
                  :key="step"
                  class="rf-step"
                  :class="stepClass(i)"
                  :title="step"
                >
                  <span class="rf-step-dot">
                    <AssetIcon v-if="i < currentStepIndex" name="check" />
                    <span v-else>{{ i + 1 }}</span>
                  </span>
                  <span class="rf-step-label">{{ step }}</span>
                </div>
              </div>

              <!-- SECTION 1 — HOSPITAL INFORMATION -->
              <section class="rf-drawer-section">
                <h3>Hospital Information</h3>
                <dl class="rf-info-grid">
                  <div><dt>Hospital Name</dt><dd>{{ drawerRequest.hospital }}</dd></div>
                  <div><dt>Contact Person</dt><dd>{{ drawerRequest.contactPerson || '—' }}</dd></div>
                  <div><dt>Receiving Department</dt><dd>{{ drawerRequest.department || '—' }}</dd></div>
                  <div><dt>Requesting Personnel</dt><dd>{{ drawerRequest.requestingPersonnel || '—' }}</dd></div>
                  <div>
                    <dt>Priority</dt>
                    <dd><span class="rf-priority-badge" :class="`is-${(drawerRequest.priority || '').toLowerCase()}`">{{ drawerRequest.priority }}</span></dd>
                  </div>
                  <div><dt>Required Delivery Time</dt><dd>{{ formatTime(drawerRequest.neededBy) }}</dd></div>
                </dl>
              </section>

              <!-- SECTION 2 — BLOOD REQUEST -->
              <section class="rf-drawer-section">
                <h3>Blood Request</h3>
                <dl class="rf-info-grid">
                  <div><dt>Blood Type</dt><dd>{{ drawerRequest.bloodType }}</dd></div>
                  <div><dt>Blood Component</dt><dd>{{ drawerRequest.component }}</dd></div>
                  <div><dt>Requested Units</dt><dd>{{ drawerRequest.requestedUnits ?? '—' }} units</dd></div>
                  <div><dt>Reserved Units</dt><dd>{{ drawerRequest.reservedUnits ?? '—' }} units</dd></div>
                  <div><dt>Needed By</dt><dd>{{ formatTime(drawerRequest.neededBy) }}</dd></div>
                  <div><dt>Reason for Request</dt><dd>{{ drawerRequest.reason || '—' }}</dd></div>
                </dl>
                <div v-if="drawerRequest.clinicalNotes" class="rf-clinical-notes">
                  <p class="rf-notes-label">Clinical Notes</p>
                  <p class="rf-clinical-notes-text">{{ drawerRequest.clinicalNotes }}</p>
                </div>
              </section>

              <!-- SECTION 3 — RESERVED BLOOD UNITS -->
              <section class="rf-drawer-section">
                <h3>Reserved Blood Units</h3>
                <p class="rf-section-hint">Sorted earliest-expiring first (FEFO).</p>
                <div class="rf-unit-cards">
                  <div v-for="unit in drawerRequest.units || []" :key="unit.batchId" class="rf-unit-card">
                    <div class="rf-unit-card-top">
                      <span class="rf-mono">{{ unit.batchId }}</span>
                      <span class="rf-unit-status" :class="`is-${unit.status.toLowerCase()}`">{{ unit.status }}</span>
                    </div>
                    <p><strong>{{ unit.bloodType }}</strong> · {{ unit.component }} · {{ unit.units }} units</p>
                    <p class="rf-cell-sub">Collected {{ unit.collectionDate }} · Expires {{ unit.expiryDate }}</p>
                    <p class="rf-cell-sub">Storage: {{ unit.storageLocation }}</p>
                  </div>
                  <p v-if="!(drawerRequest.units || []).length" class="rf-section-hint">No units allocated yet.</p>
                </div>
              </section>

              <!-- SECTION 4 — PREPARATION CHECKLIST -->
              <section class="rf-drawer-section">
                <h3>Preparation Checklist</h3>
                <p class="rf-section-hint">{{ checklistProgressLabel }}</p>
                <ul class="rf-checklist">
                  <li v-for="item in drawerRequest.checklist || []" :key="item.key">
                    <label>
                      <input
                        type="checkbox"
                        :checked="item.done"
                        @change="toggleChecklistItem(item)"
                      />
                      <AssetIcon v-if="item.done" name="check" class="rf-check-icon" />
                      <span :class="{ 'is-done': item.done }">{{ item.label }}</span>
                    </label>
                  </li>
                </ul>
              </section>

              <!-- SECTION 5 — DISPATCH INFORMATION -->
              <section class="rf-drawer-section">
                <h3>Dispatch Information</h3>
                <label class="rf-notes-label" for="rf-dispatch-method">Dispatch Method</label>
                <select id="rf-dispatch-method" v-model="drawerRequest.dispatchMethod" class="rf-select rf-select-block">
                  <option v-for="m in dispatchMethods" :key="m" :value="m">{{ m }}</option>
                </select>

                <dl class="rf-info-grid" style="margin-top:14px">
                  <div v-if="drawerRequest.dispatchMethod === 'Courier'"><dt>Courier Name</dt><dd>{{ drawerRequest.courier || '—' }}</dd></div>
                  <div v-if="drawerRequest.dispatchMethod !== 'Hospital Pickup'"><dt>Vehicle</dt><dd>{{ drawerRequest.vehicle || '—' }}</dd></div>
                  <div v-if="drawerRequest.dispatchMethod === 'Courier'"><dt>Tracking Number</dt><dd>{{ drawerRequest.trackingNumber || '—' }}</dd></div>
                  <div><dt>Estimated Arrival</dt><dd>{{ drawerRequest.estimatedArrival || '—' }}</dd></div>
                  <div><dt>Recipient Name</dt><dd>{{ drawerRequest.recipientName || '—' }}</dd></div>
                </dl>
                <label class="rf-notes-label" for="rf-dispatch-notes">Dispatch Notes</label>
                <textarea
                  id="rf-dispatch-notes"
                  v-model="dispatchNotesDraft"
                  class="rf-textarea"
                  rows="3"
                  @blur="persistDispatchNotes"
                />
              </section>
            </div>

            <footer class="rf-drawer-footer">
              <button class="rf-btn rf-btn-outline" :disabled="saving" @click="saveProgress">
                {{ saving ? 'Saving…' : 'Save Progress' }}
              </button>
              <button
                v-if="drawerRequest.stage !== 'Completed'"
                class="rf-btn rf-btn-primary"
                :disabled="advancing"
                @click="beginAdvanceStage"
              >
                {{ advancing ? 'Updating…' : primaryActionLabel }}
              </button>
              <span v-else class="rf-drawer-done-hint"><AssetIcon name="check-check" /> Fulfillment completed</span>
            </footer>
          </template>
        </aside>
      </div>
    </Teleport>

    <!-- ================= CONFIRMATION MODALS ================= -->
    <Teleport to="body">
      <div v-if="confirmDialog.type" class="rf-modal-overlay" :class="{ 'rf-dark': isDark }" @click.self="closeConfirmDialog">
        <div class="rf-modal" role="dialog" aria-modal="true">
          <!-- Generic status update -->
          <template v-if="confirmDialog.type === 'status'">
            <h3 class="rf-modal-title">Mark Request as {{ confirmDialog.targetStage }}?</h3>
            <div class="rf-modal-summary">
              <div class="rf-modal-summary-row"><span>Request</span><strong>{{ confirmDialog.request.id }}</strong></div>
              <div class="rf-modal-summary-row"><span>Hospital</span><strong>{{ confirmDialog.request.hospital }}</strong></div>
              <div class="rf-modal-summary-row"><span>Blood</span><strong>{{ confirmDialog.request.reservedUnits }} {{ confirmDialog.request.bloodType }} {{ confirmDialog.request.component }}</strong></div>
            </div>
            <p class="rf-modal-note">All required preparation and quality checks should be completed before proceeding.</p>
            <div class="rf-modal-footer">
              <button class="rf-btn rf-btn-outline" @click="closeConfirmDialog">Cancel</button>
              <button class="rf-btn rf-btn-primary" :disabled="advancing" @click="confirmStatusUpdate">Confirm Status Update</button>
            </div>
          </template>

          <!-- Dispatch confirmation -->
          <template v-else-if="confirmDialog.type === 'dispatch'">
            <h3 class="rf-modal-title">Dispatch Blood Units</h3>
            <div class="rf-modal-summary">
              <div class="rf-modal-summary-row"><span>Request ID</span><strong>{{ confirmDialog.request.id }}</strong></div>
              <div class="rf-modal-summary-row"><span>Hospital</span><strong>{{ confirmDialog.request.hospital }}</strong></div>
              <div class="rf-modal-summary-row"><span>Blood Type</span><strong>{{ confirmDialog.request.bloodType }}</strong></div>
              <div class="rf-modal-summary-row"><span>Component</span><strong>{{ confirmDialog.request.component }}</strong></div>
              <div class="rf-modal-summary-row"><span>Units</span><strong>{{ confirmDialog.request.reservedUnits }}</strong></div>
            </div>
            <div class="rf-form-grid">
              <div class="rf-form-field">
                <label>Dispatch Method</label>
                <select v-model="confirmDialog.form.dispatchMethod" class="rf-select rf-select-block">
                  <option v-for="m in dispatchMethods" :key="m" :value="m">{{ m }}</option>
                </select>
              </div>
              <div class="rf-form-field">
                <label>Recipient</label>
                <input v-model="confirmDialog.form.recipientName" type="text" class="rf-select rf-select-block" placeholder="Name of receiving personnel" />
              </div>
              <div class="rf-form-field" v-if="confirmDialog.form.dispatchMethod === 'Courier'">
                <label>Tracking Number</label>
                <input v-model="confirmDialog.form.trackingNumber" type="text" class="rf-select rf-select-block" placeholder="e.g. TRK-00231" />
              </div>
              <div class="rf-form-field">
                <label>Estimated Arrival</label>
                <input v-model="confirmDialog.form.estimatedArrival" type="text" class="rf-select rf-select-block" placeholder="e.g. 3:30 PM" />
              </div>
            </div>
            <div class="rf-modal-footer">
              <button class="rf-btn rf-btn-outline" @click="closeConfirmDialog">Cancel</button>
              <button class="rf-btn rf-btn-primary" :disabled="advancing" @click="confirmDispatch">Confirm Dispatch</button>
            </div>
          </template>

          <!-- Delivery confirmation -->
          <template v-else-if="confirmDialog.type === 'delivery'">
            <h3 class="rf-modal-title">Confirm Delivery</h3>
            <div class="rf-modal-summary">
              <div class="rf-modal-summary-row"><span>Request</span><strong>{{ confirmDialog.request.id }}</strong></div>
              <div class="rf-modal-summary-row"><span>Hospital</span><strong>{{ confirmDialog.request.hospital }}</strong></div>
            </div>
            <div class="rf-form-grid">
              <div class="rf-form-field">
                <label>Received By</label>
                <input v-model="confirmDialog.form.receivedBy" type="text" class="rf-select rf-select-block" placeholder="Recipient name" />
              </div>
              <div class="rf-form-field">
                <label>Delivery Date</label>
                <input v-model="confirmDialog.form.deliveryDate" type="date" class="rf-select rf-select-block" />
              </div>
              <div class="rf-form-field">
                <label>Delivery Time</label>
                <input v-model="confirmDialog.form.deliveryTime" type="time" class="rf-select rf-select-block" />
              </div>
              <div class="rf-form-field rf-form-field-full">
                <label>Delivery Notes</label>
                <textarea v-model="confirmDialog.form.deliveryNotes" class="rf-textarea" rows="2" placeholder="Optional notes or proof reference" />
              </div>
            </div>
            <div class="rf-modal-footer">
              <button class="rf-btn rf-btn-outline" @click="closeConfirmDialog">Cancel</button>
              <button class="rf-btn rf-btn-primary" :disabled="advancing" @click="confirmDelivery">Confirm Delivery</button>
            </div>
          </template>

          <!-- Completion confirmation -->
          <template v-else-if="confirmDialog.type === 'complete'">
            <h3 class="rf-modal-title">Complete Fulfillment?</h3>
            <div class="rf-modal-summary">
              <div class="rf-modal-summary-row"><span>Request</span><strong>{{ confirmDialog.request.id }}</strong></div>
              <div class="rf-modal-summary-row"><span>Hospital</span><strong>{{ confirmDialog.request.hospital }}</strong></div>
            </div>
            <p class="rf-modal-note">This will mark the request as fully fulfilled and remove it from the active fulfillment queue.</p>
            <div class="rf-modal-footer">
              <button class="rf-btn rf-btn-outline" @click="closeConfirmDialog">Cancel</button>
              <button class="rf-btn rf-btn-primary" :disabled="advancing" @click="confirmComplete">Complete Fulfillment</button>
            </div>
          </template>

          <!-- Assign staff -->
          <template v-else-if="confirmDialog.type === 'assign-staff'">
            <h3 class="rf-modal-title">Assign Staff</h3>
            <div class="rf-modal-summary">
              <div class="rf-modal-summary-row"><span>Request</span><strong>{{ confirmDialog.request.id }}</strong></div>
              <div class="rf-modal-summary-row"><span>Hospital</span><strong>{{ confirmDialog.request.hospital }}</strong></div>
            </div>
            <div class="rf-form-field">
              <label>Assigned Staff</label>
              <select v-model="confirmDialog.form.staff" class="rf-select rf-select-block">
                <option value="">Unassigned</option>
                <option v-for="s in staffPool" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div class="rf-modal-footer">
              <button class="rf-btn rf-btn-outline" @click="closeConfirmDialog">Cancel</button>
              <button class="rf-btn rf-btn-primary" :disabled="advancing" @click="confirmAssignStaff">Confirm Assignment</button>
            </div>
          </template>

          <!-- Assign courier -->
          <template v-else-if="confirmDialog.type === 'assign-courier'">
            <h3 class="rf-modal-title">Assign Courier</h3>
            <div class="rf-modal-summary">
              <div class="rf-modal-summary-row"><span>Request</span><strong>{{ confirmDialog.request.id }}</strong></div>
              <div class="rf-modal-summary-row"><span>Hospital</span><strong>{{ confirmDialog.request.hospital }}</strong></div>
            </div>
            <div class="rf-form-grid">
              <div class="rf-form-field">
                <label>Dispatch Method</label>
                <select v-model="confirmDialog.form.dispatchMethod" class="rf-select rf-select-block">
                  <option v-for="m in dispatchMethods" :key="m" :value="m">{{ m }}</option>
                </select>
              </div>
              <div class="rf-form-field" v-if="confirmDialog.form.dispatchMethod === 'Courier'">
                <label>Courier Name</label>
                <input v-model="confirmDialog.form.courier" type="text" class="rf-select rf-select-block" placeholder="e.g. JRS Medical Courier" />
              </div>
              <div class="rf-form-field" v-if="confirmDialog.form.dispatchMethod !== 'Hospital Pickup'">
                <label>Vehicle</label>
                <input v-model="confirmDialog.form.vehicle" type="text" class="rf-select rf-select-block" placeholder="e.g. Motorcycle" />
              </div>
              <div class="rf-form-field" v-if="confirmDialog.form.dispatchMethod === 'Courier'">
                <label>Tracking Number</label>
                <input v-model="confirmDialog.form.trackingNumber" type="text" class="rf-select rf-select-block" placeholder="e.g. TRK-00231" />
              </div>
            </div>
            <div class="rf-modal-footer">
              <button class="rf-btn rf-btn-outline" @click="closeConfirmDialog">Cancel</button>
              <button class="rf-btn rf-btn-primary" :disabled="advancing" @click="confirmAssignCourier">Confirm Assignment</button>
            </div>
          </template>
        </div>
      </div>
    </Teleport>

    <!-- ================= TIMELINE MODAL ================= -->
    <Teleport to="body">
      <div v-if="timelineRequest" class="rf-modal-overlay" :class="{ 'rf-dark': isDark }" @click.self="closeTimelineModal">
        <div class="rf-modal rf-timeline-modal" role="dialog" aria-modal="true">
          <div class="rf-modal-header-row">
            <div>
              <p class="rf-drawer-eyebrow">{{ timelineRequest.id }}</p>
              <h3 class="rf-modal-title" style="margin:0">{{ timelineRequest.hospital }} — Timeline</h3>
            </div>
            <button class="rf-icon-btn" @click="closeTimelineModal" aria-label="Close timeline"><AssetIcon name="x" /></button>
          </div>
          <ul v-if="(timelineRequest.timeline || []).length" class="rf-timeline" style="margin-top:16px">
            <li v-for="event in timelineRequest.timeline" :key="event.id" class="rf-timeline-item">
              <span class="rf-timeline-dot" :class="`is-${event.type}`">
                <AssetIcon :name="event.icon" />
              </span>
              <div class="rf-timeline-body">
                <p class="rf-timeline-desc">{{ event.description }}</p>
                <p class="rf-timeline-meta">{{ event.staff }} · {{ event.timestamp }}</p>
              </div>
            </li>
          </ul>
          <p v-else class="rf-timeline-empty" style="margin-top:16px">No timeline events recorded yet.</p>
          <div class="rf-modal-footer">
            <button class="rf-btn rf-btn-outline" @click="closeTimelineModal">Close</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ================= TOASTS ================= -->
    <Teleport to="body">
      <div class="rf-toast-container" :class="{ 'rf-dark': isDark }">
        <div v-for="toast in toasts" :key="toast.id" class="rf-toast" :class="`is-${toast.type}`">
          <AssetIcon :name="toast.type === 'success' ? 'check-check' : 'triangle-alert'" />
          <div>
            <p class="rf-toast-title">{{ toast.title }}</p>
            <p class="rf-toast-desc">{{ toast.description }}</p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useDarkMode } from '~/composables/useDarkMode'
import AssetIcon from '~/components/common/AssetIcon.vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'requests.process',
})

const { isDark } = useDarkMode()

/* WALA PAY BACKEND — mock API para sa Request Fulfillment page.
   Once naa na ang Laravel endpoints, ilisan na lang ni nga block
   sa tinuod nga $fetch (Nuxt's global $fetch) — ang mga call sa
   ubos (endpoints.*) dili na kinahanglan bag-uhon kay pareho ra
   ang shape sa response nga gi-expect nila. */
const endpoints = {
  queue: '/api/blood-center/fulfillment',
  alert: '/api/blood-center/fulfillment/alert',
  dispatchPanel: '/api/blood-center/fulfillment/dispatch-panel',
  activity: '/api/blood-center/fulfillment/activity',
  detail: (id) => `/api/blood-center/fulfillment/${id}`,
  updateChecklist: (id, itemKey) => `/api/blood-center/fulfillment/${id}/checklist/${itemKey}`,
  saveProgress: (id) => `/api/blood-center/fulfillment/${id}/save`,
  advanceStage: (id) => `/api/blood-center/fulfillment/${id}/advance`,
  dispatchNotes: (id) => `/api/blood-center/fulfillment/${id}/notes`,
  exportReport: '/api/blood-center/fulfillment/export',
}

const dispatchMethods = ['Courier', 'Hospital Pickup', 'Internal Transport']

// Stage order used for the workflow stepper (Approved & Inventory Reserved
// happen before a request appears in this active table).
const stageOrder = ['Ready for Preparation', 'Preparing', 'Quality Check', 'Ready for Dispatch', 'Dispatched', 'Delivered', 'Completed']

function makeMockStore() {
  const now = Date.now()
  const iso = (mins) => new Date(now + mins * 60000).toISOString()

  const requests = reactive([
    {
      id: 'REQ-2026-0045', hospital: "St. Luke's Medical Center", department: 'Emergency Department',
      contactPerson: 'Dr. Elena Ramos', requestingPersonnel: 'Dr. Elena Ramos', priority: 'Critical',
      neededBy: iso(25), bloodType: 'O−', component: 'Packed RBC', requestedUnits: 4, reservedUnits: 4,
      reason: 'Emergency transfusion — trauma patient', clinicalNotes: 'Patient in OR, active hemorrhage control in progress.',
      assignedStaff: 'Maria Santos', dispatchMethod: 'Courier', courier: '', vehicle: '', trackingNumber: '', estimatedArrival: '',
      recipientName: '', dispatchNotes: '', stage: 'Ready for Dispatch',
      batchIds: ['BU-2026-018', 'BU-2026-024'],
      units: [
        { batchId: 'BU-2026-018', bloodType: 'O−', component: 'Packed RBC', units: 2, collectionDate: 'Jun 22, 2026', expiryDate: 'Jul 27, 2026', storageLocation: 'Fridge A · Shelf 2', status: 'Verified' },
        { batchId: 'BU-2026-024', bloodType: 'O−', component: 'Packed RBC', units: 2, collectionDate: 'Jun 25, 2026', expiryDate: 'Jul 30, 2026', storageLocation: 'Fridge A · Shelf 2', status: 'Verified' },
      ],
      checklist: [
        { key: 'verify-type', label: 'Verify Blood Type', done: true },
        { key: 'verify-component', label: 'Verify Blood Component', done: true },
        { key: 'verify-expiry', label: 'Verify Expiry Date', done: true },
        { key: 'inspect-bag', label: 'Inspect Blood Bag Integrity', done: true },
        { key: 'print-labels', label: 'Print Blood Labels', done: true },
        { key: 'package-units', label: 'Package Blood Units', done: true },
        { key: 'prepare-docs', label: 'Prepare Dispatch Documents', done: false },
        { key: 'assign-courier', label: 'Assign Courier / Pickup Method', done: false },
      ],
      timeline: [
        { id: 't1', type: 'success', icon: 'check', description: 'Request approved by Blood Center reviewer.', staff: 'Dr. Alvin Cruz', timestamp: '8:10 AM' },
        { id: 't2', type: 'info', icon: 'package', description: '4 O− Packed RBC units reserved for St. Luke\'s Medical Center.', staff: 'Maria Santos', timestamp: '8:42 AM' },
        { id: 't3', type: 'success', icon: 'check', description: 'Units passed quality verification.', staff: 'Maria Santos', timestamp: '9:15 AM' },
      ],
      createdAt: iso(-90),
    },
    {
      id: 'REQ-2026-0046', hospital: 'Davao Doctors Hospital', department: 'Surgery Ward',
      contactPerson: 'Nurse Bea Alcantara', requestingPersonnel: 'Dr. Ramon Tiu', priority: 'High',
      neededBy: iso(180), bloodType: 'A+', component: 'Platelets', requestedUnits: 3, reservedUnits: 3,
      reason: 'Scheduled surgery — platelet support', clinicalNotes: '', assignedStaff: 'Joseph Villar',
      dispatchMethod: 'Hospital Pickup', courier: '', vehicle: '', trackingNumber: '', estimatedArrival: '',
      recipientName: '', dispatchNotes: '', stage: 'Quality Check',
      batchIds: ['BU-2026-031'],
      units: [
        { batchId: 'BU-2026-031', bloodType: 'A+', component: 'Platelets', units: 3, collectionDate: 'Aug 5, 2026', expiryDate: 'Aug 10, 2026', storageLocation: 'Agitator Rack 1', status: 'Pending' },
      ],
      checklist: [
        { key: 'verify-type', label: 'Verify Blood Type', done: true },
        { key: 'verify-component', label: 'Verify Blood Component', done: true },
        { key: 'verify-expiry', label: 'Verify Expiry Date', done: true },
        { key: 'inspect-bag', label: 'Inspect Blood Bag Integrity', done: false },
        { key: 'print-labels', label: 'Print Blood Labels', done: false },
        { key: 'package-units', label: 'Package Blood Units', done: false },
        { key: 'prepare-docs', label: 'Prepare Dispatch Documents', done: false },
        { key: 'assign-courier', label: 'Assign Courier / Pickup Method', done: false },
      ],
      timeline: [
        { id: 't1', type: 'success', icon: 'check', description: 'Request approved by Blood Center reviewer.', staff: 'Dr. Alvin Cruz', timestamp: '7:30 AM' },
        { id: 't2', type: 'info', icon: 'package', description: '3 A+ Platelet units reserved for Davao Doctors Hospital.', staff: 'Joseph Villar', timestamp: '7:50 AM' },
      ],
      createdAt: iso(-120),
    },
    {
      id: 'REQ-2026-0047', hospital: 'Southern Philippines Medical Center', department: 'Hematology Unit',
      contactPerson: 'Dr. Iris Nolasco', requestingPersonnel: 'Dr. Iris Nolasco', priority: 'Standard',
      neededBy: iso(600), bloodType: 'B+', component: 'Fresh Frozen Plasma', requestedUnits: 2, reservedUnits: 2,
      reason: 'Elective procedure — plasma replacement', clinicalNotes: '', assignedStaff: 'Maria Santos',
      dispatchMethod: 'Internal Transport', courier: '', vehicle: 'RedAgos Van 02', trackingNumber: '', estimatedArrival: '',
      recipientName: '', dispatchNotes: '', stage: 'Preparing',
      batchIds: ['BU-2026-040'],
      units: [
        { batchId: 'BU-2026-040', bloodType: 'B+', component: 'Fresh Frozen Plasma', units: 2, collectionDate: 'Jul 1, 2026', expiryDate: 'Jul 1, 2027', storageLocation: 'Freezer B · Bay 4', status: 'Verified' },
      ],
      checklist: [
        { key: 'verify-type', label: 'Verify Blood Type', done: true },
        { key: 'verify-component', label: 'Verify Blood Component', done: true },
        { key: 'verify-expiry', label: 'Verify Expiry Date', done: false },
        { key: 'inspect-bag', label: 'Inspect Blood Bag Integrity', done: false },
        { key: 'print-labels', label: 'Print Blood Labels', done: false },
        { key: 'package-units', label: 'Package Blood Units', done: false },
        { key: 'prepare-docs', label: 'Prepare Dispatch Documents', done: false },
        { key: 'assign-courier', label: 'Assign Courier / Pickup Method', done: false },
      ],
      timeline: [
        { id: 't1', type: 'success', icon: 'check', description: 'Request approved by Blood Center reviewer.', staff: 'Dr. Alvin Cruz', timestamp: '9:00 AM' },
        { id: 't2', type: 'info', icon: 'package', description: '2 B+ Fresh Frozen Plasma units reserved for SPMC.', staff: 'Maria Santos', timestamp: '9:20 AM' },
      ],
      createdAt: iso(-40),
    },
    {
      id: 'REQ-2026-0048', hospital: 'Metro Davao Medical & Research Center', department: 'ICU',
      contactPerson: 'Dr. Paolo Rivera', requestingPersonnel: 'Dr. Paolo Rivera', priority: 'High',
      neededBy: iso(-15), bloodType: 'AB−', component: 'Packed RBC', requestedUnits: 2, reservedUnits: 2,
      reason: 'ICU transfusion support', clinicalNotes: 'Patient hemodynamically unstable.', assignedStaff: 'Joseph Villar',
      dispatchMethod: 'Courier', courier: 'JRS Medical Courier', vehicle: 'Motorcycle', trackingNumber: 'TRK-88231',
      estimatedArrival: '10:45 AM', recipientName: 'ICU Charge Nurse', dispatchNotes: 'Handle with cold chain box.',
      stage: 'Dispatched',
      batchIds: ['BU-2026-011'],
      units: [
        { batchId: 'BU-2026-011', bloodType: 'AB−', component: 'Packed RBC', units: 2, collectionDate: 'Jun 15, 2026', expiryDate: 'Jul 20, 2026', storageLocation: 'Fridge B · Shelf 1', status: 'Verified' },
      ],
      checklist: [
        { key: 'verify-type', label: 'Verify Blood Type', done: true },
        { key: 'verify-component', label: 'Verify Blood Component', done: true },
        { key: 'verify-expiry', label: 'Verify Expiry Date', done: true },
        { key: 'inspect-bag', label: 'Inspect Blood Bag Integrity', done: true },
        { key: 'print-labels', label: 'Print Blood Labels', done: true },
        { key: 'package-units', label: 'Package Blood Units', done: true },
        { key: 'prepare-docs', label: 'Prepare Dispatch Documents', done: true },
        { key: 'assign-courier', label: 'Assign Courier / Pickup Method', done: true },
      ],
      timeline: [
        { id: 't1', type: 'success', icon: 'check', description: 'Request approved by Blood Center reviewer.', staff: 'Dr. Alvin Cruz', timestamp: '6:00 AM' },
        { id: 't2', type: 'info', icon: 'package', description: '2 AB− Packed RBC units reserved for Metro Davao MRC.', staff: 'Joseph Villar', timestamp: '6:20 AM' },
        { id: 't3', type: 'success', icon: 'truck', description: 'Blood units dispatched via JRS Medical Courier.', staff: 'Joseph Villar', timestamp: '9:55 AM' },
      ],
      createdAt: iso(-240),
    },
    {
      id: 'REQ-2026-0049', hospital: "St. Luke's Medical Center", department: 'Obstetrics',
      contactPerson: 'Dr. Ana Bautista', requestingPersonnel: 'Dr. Ana Bautista', priority: 'Standard',
      neededBy: iso(-800), bloodType: 'O+', component: 'Packed RBC', requestedUnits: 3, reservedUnits: 3,
      reason: 'Postpartum hemorrhage precaution', clinicalNotes: '', assignedStaff: 'Maria Santos',
      dispatchMethod: 'Hospital Pickup', courier: '', vehicle: '', trackingNumber: '', estimatedArrival: '9:00 AM',
      recipientName: 'Dr. Ana Bautista', dispatchNotes: '', stage: 'Completed',
      batchIds: ['BU-2026-002'],
      units: [
        { batchId: 'BU-2026-002', bloodType: 'O+', component: 'Packed RBC', units: 3, collectionDate: 'Jun 1, 2026', expiryDate: 'Jul 6, 2026', storageLocation: 'Fridge A · Shelf 1', status: 'Verified' },
      ],
      checklist: [
        { key: 'verify-type', label: 'Verify Blood Type', done: true },
        { key: 'verify-component', label: 'Verify Blood Component', done: true },
        { key: 'verify-expiry', label: 'Verify Expiry Date', done: true },
        { key: 'inspect-bag', label: 'Inspect Blood Bag Integrity', done: true },
        { key: 'print-labels', label: 'Print Blood Labels', done: true },
        { key: 'package-units', label: 'Package Blood Units', done: true },
        { key: 'prepare-docs', label: 'Prepare Dispatch Documents', done: true },
        { key: 'assign-courier', label: 'Assign Courier / Pickup Method', done: true },
      ],
      timeline: [
        { id: 't1', type: 'success', icon: 'check', description: 'Request approved by Blood Center reviewer.', staff: 'Dr. Alvin Cruz', timestamp: 'Yesterday, 2:00 PM' },
        { id: 't2', type: 'success', icon: 'truck', description: 'Blood units picked up by requesting hospital.', staff: 'Maria Santos', timestamp: 'Yesterday, 4:10 PM' },
        { id: 't3', type: 'success', icon: 'check-check', description: 'Fulfillment completed and archived.', staff: 'Maria Santos', timestamp: 'Yesterday, 4:15 PM' },
      ],
      createdAt: iso(-1600),
    },
    {
      id: 'REQ-2026-0050', hospital: 'Davao Doctors Hospital', department: 'Blood Bank Unit',
      contactPerson: 'Nurse Carlo Feran', requestingPersonnel: 'Dr. Ramon Tiu', priority: 'Standard',
      neededBy: iso(900), bloodType: 'O+', component: 'Packed RBC', requestedUnits: 5, reservedUnits: 5,
      reason: 'Elective surgery stock replenishment', clinicalNotes: '', assignedStaff: '',
      dispatchMethod: 'Courier', courier: '', vehicle: '', trackingNumber: '', estimatedArrival: '',
      recipientName: '', dispatchNotes: '', stage: 'Ready for Preparation',
      batchIds: ['BU-2026-051', 'BU-2026-052'],
      units: [
        { batchId: 'BU-2026-051', bloodType: 'O+', component: 'Packed RBC', units: 3, collectionDate: 'Jul 20, 2026', expiryDate: 'Aug 24, 2026', storageLocation: 'Fridge A · Shelf 3', status: 'Pending' },
        { batchId: 'BU-2026-052', bloodType: 'O+', component: 'Packed RBC', units: 2, collectionDate: 'Jul 22, 2026', expiryDate: 'Aug 26, 2026', storageLocation: 'Fridge A · Shelf 3', status: 'Pending' },
      ],
      checklist: [
        { key: 'verify-type', label: 'Verify Blood Type', done: false },
        { key: 'verify-component', label: 'Verify Blood Component', done: false },
        { key: 'verify-expiry', label: 'Verify Expiry Date', done: false },
        { key: 'inspect-bag', label: 'Inspect Blood Bag Integrity', done: false },
        { key: 'print-labels', label: 'Print Blood Labels', done: false },
        { key: 'package-units', label: 'Package Blood Units', done: false },
        { key: 'prepare-docs', label: 'Prepare Dispatch Documents', done: false },
        { key: 'assign-courier', label: 'Assign Courier / Pickup Method', done: false },
      ],
      timeline: [
        { id: 't1', type: 'success', icon: 'check', description: 'Request approved by Blood Center reviewer.', staff: 'Dr. Alvin Cruz', timestamp: '10:05 AM' },
        { id: 't2', type: 'info', icon: 'package', description: '5 O+ Packed RBC units reserved for Davao Doctors Hospital.', staff: 'Unassigned', timestamp: '10:12 AM' },
      ],
      createdAt: iso(-10),
    },
  ])

  return requests
}

const mockStore = makeMockStore()

function delay(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stageAccent(stage) {
  return {
    'Ready for Preparation': '#7C3AED',
    'Preparing': '#F59E0B',
    'Quality Check': '#7C3AED',
    'Ready for Dispatch': '#2563EB',
    'Dispatched': '#0F766E',
    'Delivered': '#1565C0',
    'Completed': '#2E7D32',
  }[stage] || '#64748B'
}

function buildKpis() {
  const active = mockStore.filter((r) => r.stage !== 'Completed')
  const readyForPrep = active.filter((r) => r.stage === 'Ready for Preparation').length
  const preparing = active.filter((r) => r.stage === 'Preparing').length
  const readyForDispatch = active.filter((r) => r.stage === 'Ready for Dispatch').length
  const fulfilledToday = mockStore.filter((r) => r.stage === 'Completed').length

  return [
    { key: 'ready-prep', label: 'Ready for Preparation', value: readyForPrep, description: 'Approved requests waiting for blood-unit preparation.', icon: 'package', accent: '#7C3AED', trend: 4 },
    { key: 'preparing', label: 'Preparing', value: preparing, description: 'Requests currently being prepared.', icon: 'flask-conical', accent: '#F59E0B', trend: -2 },
    { key: 'ready-dispatch', label: 'Ready for Dispatch', value: readyForDispatch, description: 'Completed preparation and ready to leave the Blood Center.', icon: 'truck', accent: '#2563EB', trend: 6 },
    { key: 'fulfilled-today', label: 'Fulfilled Today', value: fulfilledToday, description: 'Requests successfully completed today.', icon: 'check-check', accent: '#2E7D32', trend: 12 },
  ]
}

function buildStatusCounts() {
  const counts = { all: 0 }
  for (const s of stageOrder) counts[stageToSlugPlain(s)] = 0
  for (const r of mockStore) {
    const slug = stageToSlugPlain(r.stage)
    counts[slug] = (counts[slug] || 0) + 1
    if (r.stage !== 'Completed') counts.all += 1
  }
  return counts
}

function stageToSlugPlain(stage) {
  return (stage || '').toLowerCase().replace(/\s+/g, '-')
}

async function mockFetchQueue(params = {}) {
  await delay()
  let list = mockStore.filter((r) => r.stage !== 'Completed' || params.status === 'completed')

  if (params.status && params.status !== 'all') {
    const wanted = params.status
    list = list.filter((r) => stageToSlugPlain(r.stage) === wanted)
  }
  if (params.search) {
    const q = params.search.toLowerCase()
    list = list.filter((r) =>
      r.id.toLowerCase().includes(q) ||
      r.hospital.toLowerCase().includes(q) ||
      r.bloodType.toLowerCase().includes(q) ||
      (r.batchIds || []).some((b) => b.toLowerCase().includes(q))
    )
  }
  if (params.hospital) list = list.filter((r) => r.hospital === params.hospital)
  if (params.bloodType) list = list.filter((r) => r.bloodType === params.bloodType)
  if (params.component) list = list.filter((r) => r.component === params.component)
  if (params.priority) list = list.filter((r) => r.priority === params.priority)
  if (params.dispatchStatus) list = list.filter((r) => stageToSlugPlain(r.stage) === params.dispatchStatus)
  if (params.dispatchMethod) list = list.filter((r) => r.dispatchMethod === params.dispatchMethod)
  if (params.assignedStaff) list = list.filter((r) => r.assignedStaff === params.assignedStaff)
  if (params.date) list = list.filter((r) => (r.neededBy || '').slice(0, 10) === params.date)

  const hospitals = [...new Set(mockStore.map((r) => r.hospital))]
  const bloodTypes = [...new Set(mockStore.map((r) => r.bloodType))]
  const components = [...new Set(mockStore.map((r) => r.component))]
  const priorities = [...new Set(mockStore.map((r) => r.priority))]
  const couriers = [...new Set(mockStore.map((r) => r.courier).filter(Boolean))]
  const staff = [...new Set(mockStore.map((r) => r.assignedStaff).filter(Boolean))]

  return {
    requests: list.map((r) => ({ ...r })),
    kpis: buildKpis(),
    statusCounts: buildStatusCounts(),
    filterOptions: { hospitals, bloodTypes, components, priorities, couriers, staff, dispatchMethods },
    meta: { total: list.length },
  }
}

async function mockFetchAlert() {
  await delay(250)
  const qcPending = mockStore.filter((r) => r.stage === 'Quality Check').length
  const urgentDispatch = mockStore.filter((r) => {
    if (r.stage !== 'Ready for Dispatch') return false
    const mins = (new Date(r.neededBy).getTime() - Date.now()) / 60000
    return mins > 0 && mins <= 30
  }).length

  if (urgentDispatch > 0) {
    return {
      title: 'Attention Required',
      description: `${urgentDispatch} request${urgentDispatch > 1 ? 's are' : ' is'} scheduled for dispatch within the next 30 minutes.`,
      actionLabel: 'Review Requests',
      requestId: mockStore.find((r) => r.stage === 'Ready for Dispatch')?.id,
    }
  }
  if (qcPending > 0) {
    return {
      title: 'Attention Required',
      description: `${qcPending} request${qcPending > 1 ? 's' : ''} require quality verification before dispatch.`,
      actionLabel: 'Review Requests',
      requestId: mockStore.find((r) => r.stage === 'Quality Check')?.id,
    }
  }
  return null
}

async function mockFetchDispatchPanel() {
  await delay(250)
  return {
    scheduled: mockStore.filter((r) => r.stage === 'Ready for Dispatch').length,
    inTransit: mockStore.filter((r) => r.stage === 'Dispatched').length,
    deliveredToday: mockStore.filter((r) => r.stage === 'Delivered' || r.stage === 'Completed').length,
    avgPrepTime: '38 min',
  }
}

async function mockFetchActivity() {
  await delay(250)
  return mockStore
    .flatMap((r) => r.timeline.map((t) => ({ ...t, id: `${r.id}-${t.id}` })))
    .slice(-8)
    .reverse()
}

async function mockFetchDetail(id) {
  await delay(300)
  const found = mockStore.find((r) => r.id === id)
  return found ? { ...found, checklist: found.checklist.map((c) => ({ ...c })), units: found.units.map((u) => ({ ...u })) } : null
}

function findRequest(id) {
  return mockStore.find((r) => r.id === id)
}

/* -------- Mock $fetch shadow. Ilisan ra sa tinuod nga $fetch
   sa Nuxt/Laravel kung naa na ang backend. -------- */
async function useMockFulfillmentApi(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase()

  if (url === endpoints.queue) return mockFetchQueue(options.params || {})
  if (url === endpoints.alert) return mockFetchAlert()
  if (url === endpoints.dispatchPanel) return mockFetchDispatchPanel()
  if (url === endpoints.activity) return mockFetchActivity()
  if (url === endpoints.exportReport) {
    await delay(500)
    return { downloadUrl: '#' }
  }

  const detailMatch = url.match(/\/api\/blood-center\/fulfillment\/([^/]+)$/)
  if (detailMatch && method === 'GET') return mockFetchDetail(detailMatch[1])

  const checklistMatch = url.match(/\/api\/blood-center\/fulfillment\/([^/]+)\/checklist\/([^/]+)$/)
  if (checklistMatch && method === 'PATCH') {
    await delay(200)
    const [, id, key] = checklistMatch
    const req = findRequest(id)
    const item = req?.checklist.find((c) => c.key === key)
    if (item) item.done = options.body?.done ?? item.done
    return { success: true }
  }

  const saveMatch = url.match(/\/api\/blood-center\/fulfillment\/([^/]+)\/save$/)
  if (saveMatch && method === 'PATCH') {
    await delay(300)
    const req = findRequest(saveMatch[1])
    if (req && options.body) {
      const { checklist, dispatchNotes, ...rest } = options.body
      if (checklist) req.checklist = checklist
      if (dispatchNotes !== undefined) req.dispatchNotes = dispatchNotes
      Object.assign(req, rest)
    }
    return { success: true }
  }

  const notesMatch = url.match(/\/api\/blood-center\/fulfillment\/([^/]+)\/notes$/)
  if (notesMatch && method === 'PATCH') {
    await delay(200)
    const req = findRequest(notesMatch[1])
    if (req) req.dispatchNotes = options.body?.notes ?? req.dispatchNotes
    return { success: true }
  }

  const advanceMatch = url.match(/\/api\/blood-center\/fulfillment\/([^/]+)\/advance$/)
  if (advanceMatch && method === 'POST') {
    await delay(400)
    const req = findRequest(advanceMatch[1])
    if (!req) return {}
    const payload = options.body || {}
    const nextStage = payload.targetStage
    if (nextStage) req.stage = nextStage
    Object.assign(req, payload.fields || {})
    req.timeline.push({
      id: `t${req.timeline.length + 1}`,
      type: payload.timelineType || 'success',
      icon: payload.timelineIcon || 'check',
      description: payload.timelineDescription || `Status updated to ${nextStage}.`,
      staff: payload.staff || 'Current User',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    })
    return { ...req }
  }

  return {}
}

// Gi-shadow ang global $fetch sa mock. Gibutang sa likod sa flag aron dayag
// nga mock ni ug dili aksidenteng magpabilin kung naa nay tinuod nga endpoint.
// Walay `/blood-center/fulfillment*` nga route karon (Phase P).
const $fetch = useRuntimeConfig().public.useMocks
  ? useMockFulfillmentApi
  : globalThis.$fetch

const statusPills = [
  { label: 'All', value: 'all' },
  { label: 'Ready for Preparation', value: 'ready-for-preparation' },
  { label: 'Preparing', value: 'preparing' },
  { label: 'Quality Check', value: 'quality-check' },
  { label: 'Ready for Dispatch', value: 'ready-for-dispatch' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Completed', value: 'completed' },
]
const workflowSteps = [
  'Approved', 'Inventory Reserved', 'Preparing', 'Quality Check',
  'Ready for Dispatch', 'Dispatched', 'Delivered', 'Completed',
]

/* ---------------------------------------------------------------
   QUERY STATE (drives the API request)
--------------------------------------------------------------- */
const query = reactive({
  search: '', status: 'all', hospital: '', bloodType: '', component: '',
  dispatchStatus: '', priority: '', dispatchMethod: '', assignedStaff: '', date: '',
})
const defaultQuery = { ...query }
const hasActiveFilters = computed(() =>
  Object.entries(query).some(([k, v]) => k !== 'status' && v) || query.status !== 'all'
)

/* ---------------------------------------------------------------
   DATA FETCHING
--------------------------------------------------------------- */
const { data: queueData, pending, error, refresh: refreshQueueData } = await useAsyncData(
  'fulfillment-queue',
  () => $fetch(endpoints.queue, { params: { ...query } }),
  { watch: [() => query.status] }
)

const { data: alertData, refresh: refreshAlert } = await useAsyncData(
  'fulfillment-alert',
  () => $fetch(endpoints.alert)
)
const alertChecked = ref(true)
const alertDismissed = ref(false)

const { data: dispatchPanelData, refresh: refreshDispatchPanel } = await useAsyncData(
  'fulfillment-dispatch-panel',
  () => $fetch(endpoints.dispatchPanel)
)

const { data: activityData, refresh: refreshActivity } = await useAsyncData(
  'fulfillment-activity',
  () => $fetch(endpoints.activity)
)

const requests = computed(() => queueData.value?.requests ?? [])
const kpis = computed(() => queueData.value?.kpis ?? [])
const statusCounts = computed(() => queueData.value?.statusCounts ?? {})
const filterOptions = computed(() => queueData.value?.filterOptions ?? { hospitals: [], bloodTypes: [], components: [], priorities: [], couriers: [], staff: [], dispatchMethods })
const meta = computed(() => queueData.value?.meta ?? {})
const activeAlert = computed(() => (alertDismissed.value ? null : alertData.value ?? null))
const dispatchPanel = computed(() => dispatchPanelData.value ?? null)
const activityLog = computed(() => activityData.value ?? [])

const lastUpdatedLabel = ref('just now')

async function refreshQueue() {
  await Promise.all([refreshQueueData(), refreshAlert(), refreshDispatchPanel(), refreshActivity()])
  alertDismissed.value = false
  lastUpdatedLabel.value = 'just now'
}

function setStatus(value) {
  query.status = value
}
function applyFilters() {
  refreshQueueData().then(() => (lastUpdatedLabel.value = 'just now'))
}
function resetFilters() {
  Object.assign(query, defaultQuery)
  applyFilters()
}
function dismissAlert() {
  alertDismissed.value = true
}

const exporting = ref(false)
async function exportReport() {
  exporting.value = true
  try {
    const res = await $fetch(endpoints.exportReport, { method: 'POST', body: { ...query } })
    if (res?.downloadUrl && typeof window !== 'undefined') {
      pushToast('success', 'Report Ready', 'Fulfillment report export has started.')
    }
  } catch (e) {
    console.error('Export failed', e)
    pushToast('error', 'Export Failed', 'Could not export the fulfillment report.')
  } finally {
    exporting.value = false
  }
}

async function handleAlertAction(alert) {
  if (alert?.requestId) {
    await openDrawer(alert.requestId)
  }
}

const stageIconMap = {
  'Ready for Preparation': 'package',
  'Preparing': 'flask-conical',
  'Quality Check': 'shield-check',
  'Ready for Dispatch': 'truck',
  'Dispatched': 'send',
  'Delivered': 'package-check',
  'Completed': 'check-check',
}
function stageIcon(stage) {
  return stageIconMap[stage] || 'circle'
}
function stageToSlug(stage) {
  return stageToSlugPlain(stage)
}
function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function isUrgent(iso) {
  if (!iso) return false
  return new Date(iso).getTime() - Date.now() < 1000 * 60 * 60
}

/* ---------------------------------------------------------------
   ROW MENU
--------------------------------------------------------------- */
const openMenu = ref(null)
function toggleMenu(id) {
  openMenu.value = openMenu.value === id ? null : id
}
function closeMenu() {
  openMenu.value = null
}

const STAFF_POOL = ['Maria Santos', 'Joseph Villar', 'Dr. Alvin Cruz', 'Ken Ibarra', 'Angela Reyes']
const staffPool = STAFF_POOL

async function handleUpdateStatus(req) {
  await openDrawer(req.id)
  beginAdvanceStage()
}

function openAssignStaffModal(req) {
  confirmDialog.type = 'assign-staff'
  confirmDialog.request = req
  confirmDialog.form = { staff: req.assignedStaff || '' }
  closeMenu()
}

async function confirmAssignStaff() {
  const req = confirmDialog.request
  const staff = confirmDialog.form.staff
  advancing.value = true
  try {
    await $fetch(endpoints.saveProgress(req.id), { method: 'PATCH', body: { assignedStaff: staff } })
    if (drawerRequest.value?.id === req.id) drawerRequest.value.assignedStaff = staff
    await refreshQueue()
    pushToast('success', 'Staff Assigned', `${staff || 'Unassigned'} set for ${req.id}.`)
  } catch (e) {
    console.error('Assign staff failed', e)
    pushToast('error', 'Assignment Failed', `Could not assign staff for ${req.id}.`)
  } finally {
    advancing.value = false
    closeConfirmDialog()
  }
}

function openAssignCourierModal(req) {
  confirmDialog.type = 'assign-courier'
  confirmDialog.request = req
  confirmDialog.form = {
    dispatchMethod: req.dispatchMethod || 'Courier',
    courier: req.courier || '',
    vehicle: req.vehicle || '',
    trackingNumber: req.trackingNumber || '',
  }
  closeMenu()
}

async function confirmAssignCourier() {
  const req = confirmDialog.request
  const form = confirmDialog.form
  advancing.value = true
  try {
    await $fetch(endpoints.saveProgress(req.id), {
      method: 'PATCH',
      body: {
        dispatchMethod: form.dispatchMethod,
        courier: form.courier,
        vehicle: form.vehicle,
        trackingNumber: form.trackingNumber,
      },
    })
    if (drawerRequest.value?.id === req.id) Object.assign(drawerRequest.value, form)
    await refreshQueue()
    pushToast('success', 'Courier Assigned', `Dispatch details updated for ${req.id}.`)
  } catch (e) {
    console.error('Assign courier failed', e)
    pushToast('error', 'Assignment Failed', `Could not update dispatch details for ${req.id}.`)
  } finally {
    advancing.value = false
    closeConfirmDialog()
  }
}

const timelineRequest = ref(null)
function openTimelineModal(req) {
  timelineRequest.value = req
  closeMenu()
}
function closeTimelineModal() {
  timelineRequest.value = null
}

function openPrintWindow(title, bodyHtml) {
  if (typeof window === 'undefined') return
  const win = window.open('', '_blank', 'width=680,height=880')
  if (!win) {
    pushToast('error', 'Popup Blocked', 'Please allow pop-ups to print this document.')
    return
  }
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 32px; color: #1E293B; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          .rf-print-sub { color: #64748B; font-size: 12.5px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #E5EAF0; font-size: 13px; }
          th { color: #64748B; font-size: 11px; text-transform: uppercase; }
          .rf-print-badge { display: inline-block; font-weight: 700; padding: 3px 10px; border-radius: 8px; background: #FCE4E4; color: #D32F2F; }
        </style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

function printDispatchForm(req) {
  closeMenu()
  openPrintWindow(`Dispatch Form — ${req.id}`, `
    <h1>Blood Dispatch Form</h1>
    <p class="rf-print-sub">${req.id} · Generated ${new Date().toLocaleString('en-US')}</p>
    <table>
      <tr><th>Hospital</th><td>${req.hospital}</td></tr>
      <tr><th>Department</th><td>${req.department || '—'}</td></tr>
      <tr><th>Blood Type</th><td><span class="rf-print-badge">${req.bloodType}</span></td></tr>
      <tr><th>Component</th><td>${req.component}</td></tr>
      <tr><th>Reserved Units</th><td>${req.reservedUnits} units</td></tr>
      <tr><th>Batch IDs</th><td>${(req.batchIds || []).join(', ') || '—'}</td></tr>
      <tr><th>Dispatch Method</th><td>${req.dispatchMethod || '—'}</td></tr>
      <tr><th>Assigned Staff</th><td>${req.assignedStaff || '—'}</td></tr>
      <tr><th>Needed By</th><td>${formatTime(req.neededBy)}</td></tr>
    </table>
  `)
  pushToast('success', 'Dispatch Form Ready', `Opening print preview for ${req.id}.`)
}

function printBloodLabels(req) {
  closeMenu()
  const rows = (req.units || []).map((u) => `
    <tr>
      <td>${u.batchId}</td>
      <td><span class="rf-print-badge">${u.bloodType}</span></td>
      <td>${u.component}</td>
      <td>${u.units}</td>
      <td>${u.expiryDate}</td>
    </tr>
  `).join('')
  openPrintWindow(`Blood Labels — ${req.id}`, `
    <h1>Blood Unit Labels</h1>
    <p class="rf-print-sub">${req.id} · ${req.hospital}</p>
    <table>
      <tr><th>Batch ID</th><th>Blood Type</th><th>Component</th><th>Units</th><th>Expiry</th></tr>
      ${rows || '<tr><td colspan="5">No units allocated yet.</td></tr>'}
    </table>
  `)
  pushToast('success', 'Blood Labels Ready', `Opening print preview for ${req.id}.`)
}

async function exportSingleRequest(req) {
  closeMenu()
  try {
    await $fetch(endpoints.exportReport, { method: 'POST', body: { requestId: req.id } })
    pushToast('success', 'Export Started', `PDF export for ${req.id} has started.`)
  } catch (e) {
    console.error('Export failed', e)
    pushToast('error', 'Export Failed', `Could not export ${req.id}.`)
  }
}

/* ---------------------------------------------------------------
   TOASTS
--------------------------------------------------------------- */
const toasts = ref([])
let toastSeq = 0
function pushToast(type, title, description) {
  const id = ++toastSeq
  toasts.value.push({ id, type, title, description })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 4000)
}

/* ---------------------------------------------------------------
   DRAWER
--------------------------------------------------------------- */
const drawerRequestId = ref(null)
const drawerRequest = ref(null)
const drawerPending = ref(false)
const dispatchNotesDraft = ref('')
const saving = ref(false)
const advancing = ref(false)

async function openDrawer(id) {
  drawerRequestId.value = id
  drawerPending.value = true
  closeMenu()
  try {
    const detail = await $fetch(endpoints.detail(id))
    drawerRequest.value = detail
    dispatchNotesDraft.value = detail?.dispatchNotes || ''
  } catch (e) {
    console.error('Failed to load fulfillment detail', e)
    drawerRequest.value = null
  } finally {
    drawerPending.value = false
  }
}
function closeDrawer() {
  drawerRequestId.value = null
  drawerRequest.value = null
}

const currentStepIndex = computed(() => {
  const map = {
    'Ready for Preparation': 1, 'Preparing': 2, 'Quality Check': 3, 'Ready for Dispatch': 4,
    'Dispatched': 5, 'Delivered': 6, 'Completed': 7,
  }
  return map[drawerRequest.value?.stage] ?? 0
})
function stepClass(i) {
  if (i < currentStepIndex.value) return 'is-complete'
  if (i === currentStepIndex.value) return 'is-current'
  return 'is-future'
}
const checklistProgressLabel = computed(() => {
  const list = drawerRequest.value?.checklist || []
  const done = list.filter((i) => i.done).length
  return `${done} of ${list.length} steps completed`
})
const primaryActionLabel = computed(() => {
  const stage = drawerRequest.value?.stage
  if (stage === 'Ready for Preparation') return 'Start Preparation'
  if (stage === 'Preparing') return 'Send to Quality Check'
  if (stage === 'Quality Check') return 'Mark Ready for Dispatch'
  if (stage === 'Ready for Dispatch') return 'Dispatch Blood Units'
  if (stage === 'Dispatched') return 'Mark as Delivered'
  if (stage === 'Delivered') return 'Complete Fulfillment'
  return 'Update Status'
})

async function toggleChecklistItem(item) {
  if (!drawerRequest.value) return
  const previous = item.done
  item.done = !item.done
  try {
    await $fetch(endpoints.updateChecklist(drawerRequest.value.id, item.key), {
      method: 'PATCH',
      body: { done: item.done },
    })
  } catch (e) {
    item.done = previous
    console.error('Checklist update failed', e)
  }
}

async function persistDispatchNotes() {
  if (!drawerRequest.value) return
  try {
    await $fetch(endpoints.dispatchNotes(drawerRequest.value.id), {
      method: 'PATCH',
      body: { notes: dispatchNotesDraft.value },
    })
  } catch (e) {
    console.error('Failed to save dispatch notes', e)
  }
}

async function saveProgress() {
  if (!drawerRequest.value) return
  saving.value = true
  try {
    await $fetch(endpoints.saveProgress(drawerRequest.value.id), {
      method: 'PATCH',
      body: { checklist: drawerRequest.value.checklist, dispatchNotes: dispatchNotesDraft.value },
    })
    pushToast('success', 'Progress Saved', `Changes to ${drawerRequest.value.id} have been saved.`)
  } catch (e) {
    console.error('Save progress failed', e)
    pushToast('error', 'Save Failed', 'Could not save progress. Please try again.')
  } finally {
    saving.value = false
  }
}

/* ---------------------------------------------------------------
   STAGE ADVANCE — routes to the right confirmation dialog
--------------------------------------------------------------- */
const confirmDialog = reactive({ type: null, request: null, targetStage: '', form: {} })

function beginAdvanceStage() {
  if (!drawerRequest.value) return
  const stage = drawerRequest.value.stage
  const req = drawerRequest.value

  if (stage === 'Ready for Dispatch') {
    confirmDialog.type = 'dispatch'
    confirmDialog.request = req
    confirmDialog.form = {
      dispatchMethod: req.dispatchMethod || 'Courier',
      recipientName: req.recipientName || '',
      trackingNumber: req.trackingNumber || '',
      estimatedArrival: req.estimatedArrival || '',
    }
  } else if (stage === 'Dispatched') {
    confirmDialog.type = 'delivery'
    confirmDialog.request = req
    confirmDialog.form = {
      receivedBy: req.recipientName || '',
      deliveryDate: new Date().toISOString().slice(0, 10),
      deliveryTime: '',
      deliveryNotes: '',
    }
  } else if (stage === 'Delivered') {
    confirmDialog.type = 'complete'
    confirmDialog.request = req
    confirmDialog.form = {}
  } else {
    const nextMap = { 'Ready for Preparation': 'Preparing', 'Preparing': 'Quality Check', 'Quality Check': 'Ready for Dispatch' }
    confirmDialog.type = 'status'
    confirmDialog.request = req
    confirmDialog.targetStage = nextMap[stage] || stage
    confirmDialog.form = {}
  }
}

function closeConfirmDialog() {
  confirmDialog.type = null
  confirmDialog.request = null
  confirmDialog.targetStage = ''
  confirmDialog.form = {}
}

async function runAdvance(payload) {
  advancing.value = true
  try {
    const updated = await $fetch(endpoints.advanceStage(confirmDialog.request.id), {
      method: 'POST',
      body: payload,
    })
    if (drawerRequest.value && drawerRequest.value.id === updated.id) {
      drawerRequest.value = { ...drawerRequest.value, ...updated }
    }
    await refreshQueue()
    return updated
  } finally {
    advancing.value = false
  }
}

async function confirmStatusUpdate() {
  const req = confirmDialog.request
  const target = confirmDialog.targetStage
  await runAdvance({
    targetStage: target,
    timelineDescription: `Status updated to ${target}.`,
    staff: req.assignedStaff || 'Current User',
  })
  pushToast('success', 'Fulfillment Updated', `${req.id} is now ${target}.`)
  closeConfirmDialog()
}

async function confirmDispatch() {
  const req = confirmDialog.request
  const form = confirmDialog.form
  await runAdvance({
    targetStage: 'Dispatched',
    fields: {
      dispatchMethod: form.dispatchMethod,
      recipientName: form.recipientName,
      trackingNumber: form.trackingNumber,
      estimatedArrival: form.estimatedArrival,
    },
    timelineIcon: 'truck',
    timelineDescription: `Blood units dispatched via ${form.dispatchMethod}.`,
    staff: req.assignedStaff || 'Current User',
  })
  pushToast('success', 'Blood Units Dispatched', `${req.id} has been marked as dispatched.`)
  closeConfirmDialog()
}

async function confirmDelivery() {
  const req = confirmDialog.request
  const form = confirmDialog.form
  await runAdvance({
    targetStage: 'Delivered',
    fields: {
      recipientName: form.receivedBy,
      dispatchNotes: form.deliveryNotes || req.dispatchNotes,
    },
    timelineIcon: 'package-check',
    timelineDescription: `Delivery confirmed and received by ${form.receivedBy || 'hospital staff'}.`,
    staff: req.assignedStaff || 'Current User',
  })
  pushToast('success', 'Delivery Confirmed', `${req.id} has been marked as delivered.`)
  closeConfirmDialog()
}

async function confirmComplete() {
  const req = confirmDialog.request
  await runAdvance({
    targetStage: 'Completed',
    timelineIcon: 'check-check',
    timelineDescription: 'Fulfillment completed and removed from the active queue.',
    staff: req.assignedStaff || 'Current User',
  })
  pushToast('success', 'Fulfillment Completed', `${req.id} has been completed and removed from the active queue.`)
  closeConfirmDialog()
  closeDrawer()
}

if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    if (!e.target.closest?.('.rf-menu-wrap')) closeMenu()
  })
}
</script>

<style scoped>
/* ============================================================
   REDAGOS DESIGN TOKENS
============================================================ */
.rf-page {
  --rf-primary: #1565C0;
  --rf-primary-hover: #0D47A1;
  --rf-bg: #F7F9FC;
  --rf-card: #FFFFFF;
  --rf-border: #E5EAF0;
  --rf-text: #1E293B;
  --rf-text-secondary: #64748B;
  --rf-success: #2E7D32;
  --rf-warning: #F59E0B;
  --rf-danger: #D32F2F;
  --rf-info: #2563EB;
  --rf-purple: #7C3AED;
  --rf-teal: #0F766E;
  --rf-radius: 18px;
  --rf-pad: 24px;
  --rf-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);

  background: var(--rf-bg);
  color: var(--rf-text);
  font-family: var(--rb-font-sans);
  padding: 28px clamp(16px, 3vw, 40px) 60px;
  min-height: 100vh;
}
.rf-page *,
.rf-page *::before,
.rf-page *::after {
  box-sizing: border-box;
}
.rf-page.rf-dark {
  --rf-bg: #0F1420;
  --rf-card: #171D2B;
  --rf-border: #2A3447;
  --rf-text: #E6EBF3;
  --rf-text-secondary: #94A3B8;
  --rf-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
}

/* ---------- Teleported theme scope ----------
   Teleport moves these nodes to <body>, outside .rf-page's DOM
   subtree, so CSS custom properties defined on .rf-page never
   reach them via inheritance even though the scoped selectors
   still match. Redeclare the tokens here, toggled by the same
   .rf-dark class, so drawer/modal/toast content is themed. */
.rf-drawer-overlay,
.rf-modal-overlay,
.rf-toast-container {
  --rf-primary: #1565C0;
  --rf-primary-hover: #0D47A1;
  --rf-bg: #F7F9FC;
  --rf-card: #FFFFFF;
  --rf-border: #E5EAF0;
  --rf-text: #1E293B;
  --rf-text-secondary: #64748B;
  --rf-success: #2E7D32;
  --rf-warning: #F59E0B;
  --rf-danger: #D32F2F;
  --rf-info: #2563EB;
  --rf-purple: #7C3AED;
  --rf-teal: #0F766E;
  --rf-radius: 18px;
  --rf-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
  font-family: var(--rb-font-sans);
  color: var(--rf-text);
}
.rf-drawer-overlay *,
.rf-drawer-overlay *::before,
.rf-drawer-overlay *::after,
.rf-modal-overlay *,
.rf-modal-overlay *::before,
.rf-modal-overlay *::after {
  box-sizing: border-box;
}
.rf-drawer-overlay.rf-dark,
.rf-modal-overlay.rf-dark,
.rf-toast-container.rf-dark {
  --rf-bg: #0F1420;
  --rf-card: #171D2B;
  --rf-border: #2A3447;
  --rf-text: #E6EBF3;
  --rf-text-secondary: #94A3B8;
  --rf-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
}

/* ---------- Header ---------- */
.rf-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
.rf-title { font-size: 28px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 6px; }
.rf-subtitle { color: var(--rf-text-secondary); font-size: 14.5px; max-width: 560px; margin: 0; }
.rf-header-actions { display: flex; gap: 10px; }

.rf-btn { display: inline-flex; align-items: center; gap: 8px; font-family: inherit; font-weight: 600; font-size: 14px; padding: 10px 18px; border-radius: 12px; border: 1px solid transparent; cursor: pointer; transition: all .18s ease; white-space: nowrap; }
.rf-btn:disabled { opacity: .6; cursor: not-allowed; }
.rf-btn-sm { padding: 7px 12px; font-size: 13px; }
.rf-btn-primary { background: var(--rf-primary); color: #fff; box-shadow: var(--rf-shadow); }
.rf-btn-primary:hover:not(:disabled) { background: var(--rf-primary-hover); transform: translateY(-1px); }
.rf-btn-outline { background: transparent; border-color: var(--rf-border); color: var(--rf-text); }
.rf-btn-outline:hover:not(:disabled) { background: rgba(21,101,192,0.06); border-color: var(--rf-primary); }
.rf-btn-ghost { background: transparent; border-color: transparent; color: var(--rf-text-secondary); }
.rf-btn-ghost:hover:not(:disabled) { color: var(--rf-text); }
.rf-spin { animation: rf-spin 1s linear infinite; }

/* ---------- Alert ---------- */
.rf-alert { display: flex; align-items: center; gap: 14px; background: #FFF8EC; border: 1px solid #FBD9A0; color: #92400E; border-radius: var(--rf-radius); padding: 16px 20px; margin-bottom: 22px; animation: rf-fade .3s ease; }
.rf-page.rf-dark .rf-alert { background: #2A2210; border-color: #4A3B12; color: #F5C46C; }
.rf-alert-icon { color: var(--rf-warning); flex-shrink: 0; }
.rf-alert-body { flex: 1; }
.rf-alert-title { font-weight: 700; font-size: 14.5px; margin: 0 0 2px; }
.rf-alert-desc { font-size: 13.5px; margin: 0; opacity: .9; }
.rf-alert-actions { display: flex; gap: 8px; flex-shrink: 0; }

/* ---------- KPI grid ---------- */
.rf-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-bottom: 24px; }
.rf-kpi-card { background: var(--rf-card); border: 1px solid var(--rf-border); border-radius: var(--rf-radius); padding: var(--rf-pad); box-shadow: var(--rf-shadow); transition: transform .2s ease, box-shadow .2s ease; min-height: 128px; }
.rf-kpi-card:hover { transform: translateY(-3px); box-shadow: 0 10px 26px rgba(15,23,42,.09); }
.rf-skeleton-card { background: linear-gradient(90deg, var(--rf-border) 25%, rgba(255,255,255,.6) 50%, var(--rf-border) 75%); background-size: 200% 100%; animation: rf-shimmer 1.4s infinite; }
.rf-kpi-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.rf-kpi-icon { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--kpi-accent) 14%, transparent); color: var(--kpi-accent); }
.rf-kpi-trend { font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 3px; }
.rf-kpi-trend.is-up { color: var(--rf-success); }
.rf-kpi-trend.is-down { color: var(--rf-danger); }
.rf-kpi-value { font-size: 30px; font-weight: 800; margin: 0; letter-spacing: -0.02em; }
.rf-kpi-label { font-weight: 600; font-size: 14px; margin: 4px 0 2px; }
.rf-kpi-desc { font-size: 12.5px; color: var(--rf-text-secondary); margin: 0; }

/* ---------- Status pills ----------
   Count now renders as a small floating badge pinned to the
   top-right corner of the pill (like a notification counter)
   instead of sitting inline with the label. */
.rf-filter-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; padding-top: 8px; }
.rf-pill {
  position: relative;
  font-size: 13.5px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid var(--rf-border);
  background: var(--rf-card);
  color: var(--rf-text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: all .15s ease;
}
.rf-pill:hover { border-color: var(--rf-primary); color: var(--rf-primary); }
.rf-pill.is-active { background: var(--rf-primary); border-color: var(--rf-primary); color: #fff; }
.rf-pill-count {
  position: absolute;
  top: -9px;
  right: -6px;
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10.5px;
  font-weight: 800;
  line-height: 1;
  border-radius: 999px;
  background: var(--rf-text-secondary);
  color: #fff;
  border: 2px solid var(--rf-bg);
  box-shadow: 0 2px 5px rgba(15,23,42,.18);
}
.rf-pill.is-active .rf-pill-count {
  background: var(--rf-danger);
  border-color: var(--rf-primary);
}

/* ---------- Toolbar ---------- */
.rf-toolbar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; background: var(--rf-card); border: 1px solid var(--rf-border); border-radius: var(--rf-radius); padding: 14px 18px; margin-bottom: 20px; box-shadow: var(--rf-shadow); }
.rf-toolbar-search { display: flex; align-items: center; gap: 8px; border: 1px solid var(--rf-border); border-radius: 10px; padding: 8px 12px; flex: 1 1 220px; color: var(--rf-text-secondary); }
.rf-toolbar-search input { border: none; outline: none; background: transparent; font-family: inherit; font-size: 13.5px; width: 100%; color: var(--rf-text); }
.rf-select { border: 1px solid var(--rf-border); border-radius: 10px; padding: 8px 10px; font-family: inherit; font-size: 13px; background: var(--rf-card); color: var(--rf-text); }
.rf-select-block { width: 100%; padding: 9px 12px; }
.rf-toolbar-btns { display: flex; gap: 8px; }
.rf-toolbar-meta { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; font-size: 12px; color: var(--rf-text-secondary); }
.rf-toolbar-updated { opacity: .75; }

/* ---------- Layout grid ---------- */
.rf-content-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; align-items: start; }

/* ---------- Table ----------
   Rebuilt for a clean, uniform grid: fixed layout with sane
   column widths so every row lines up, no stray vertical
   dividers, consistent vertical centering, and predictable
   truncation instead of ragged wrapping. */
.rf-table-wrap { background: var(--rf-card); border: 1px solid var(--rf-border); border-radius: var(--rf-radius); overflow: auto; box-shadow: var(--rf-shadow); }
.rf-table { width: 100%; border-collapse: collapse; font-size: 13.5px; min-width: 1040px; table-layout: fixed; }
.rf-table col,
.rf-table th,
.rf-table td { border-left: none; border-right: none; }
.rf-table thead th {
  position: sticky;
  top: 0;
  background: var(--rf-bg);
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--rf-text-secondary);
  padding: 13px 16px;
  border-bottom: 1px solid var(--rf-border);
  box-shadow: 0 1px 0 var(--rf-border);
  z-index: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rf-th-actions { text-align: right; }
.rf-row td {
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid var(--rf-border);
  border-left: 3px solid transparent;
  vertical-align: middle;
  height: 64px;
  overflow: visible;
  transition: background .15s ease, border-color .15s ease;
}
.rf-row:nth-child(even) td { background: rgba(15,23,42,.015); }
.rf-page.rf-dark .rf-row:nth-child(even) td { background: rgba(255,255,255,.02); }
.rf-row:hover td { background: rgba(21,101,192,0.06); }
.rf-row:hover td:first-child { border-left-color: var(--rf-primary); }
.rf-row:last-child td { border-bottom: none; }
.rf-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12.5px; }
.rf-cell-strong { font-weight: 600; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-cell-sub { font-size: 12px; color: var(--rf-text-secondary); margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-blood-badge { display: inline-block; font-weight: 700; font-size: 12.5px; padding: 3px 10px; border-radius: 8px; background: rgba(211,47,47,.1); border: 1px solid rgba(211,47,47,.2); color: var(--rf-danger); }
.rf-needed-urgent { color: var(--rf-danger); font-weight: 700; }

/* Uniform column widths so the grid stays aligned at any scroll position */
.rf-table col.rf-col-id { width: 130px; }
.rf-table th:nth-child(1), .rf-table td:nth-child(1) { width: 130px; }
.rf-table th:nth-child(2), .rf-table td:nth-child(2) { width: 190px; }
.rf-table th:nth-child(3), .rf-table td:nth-child(3) { width: 90px; }
.rf-table th:nth-child(4), .rf-table td:nth-child(4) { width: 120px; }
.rf-table th:nth-child(5), .rf-table td:nth-child(5) { width: 150px; }
.rf-table th:nth-child(6), .rf-table td:nth-child(6) { width: 130px; }
.rf-table th:nth-child(7), .rf-table td:nth-child(7) { width: 130px; }
.rf-table th:nth-child(8), .rf-table td:nth-child(8) { width: 160px; }
.rf-table th:nth-child(9), .rf-table td:nth-child(9) { width: 140px; }
.rf-table th:nth-child(10), .rf-table td:nth-child(10) { width: 168px; }

.rf-stage-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; padding: 4px 11px 4px 9px; border-radius: 999px; border: 1px solid transparent; white-space: nowrap; }
.rf-stage-badge.is-ready-for-preparation { background: rgba(124,58,237,.1); border-color: rgba(124,58,237,.22); color: var(--rf-purple); }
.rf-stage-badge.is-preparing { background: rgba(245,158,11,.12); border-color: rgba(245,158,11,.25); color: #B45309; }
.rf-stage-badge.is-quality-check { background: rgba(124,58,237,.1); border-color: rgba(124,58,237,.22); color: var(--rf-purple); }
.rf-stage-badge.is-ready-for-dispatch { background: rgba(37,99,235,.1); border-color: rgba(37,99,235,.22); color: var(--rf-info); }
.rf-stage-badge.is-dispatched { background: rgba(15,118,110,.1); border-color: rgba(15,118,110,.22); color: var(--rf-teal); }
.rf-stage-badge.is-delivered { background: rgba(21,101,192,.1); border-color: rgba(21,101,192,.22); color: var(--rf-primary); }
.rf-stage-badge.is-completed { background: rgba(46,125,50,.12); border-color: rgba(46,125,50,.24); color: var(--rf-success); }

.rf-actions-cell { display: flex; align-items: center; gap: 8px; justify-content: flex-end; position: relative; overflow: visible; flex-wrap: nowrap; }
.rf-actions-cell .rf-btn { flex-shrink: 0; }
.rf-icon-btn { width: 32px; height: 32px; flex-shrink: 0; border-radius: 9px; border: 1px solid var(--rf-border); background: var(--rf-card); color: var(--rf-text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.rf-icon-btn:hover { border-color: var(--rf-primary); color: var(--rf-primary); }
.rf-menu-wrap { position: relative; }
.rf-menu { position: absolute; right: 0; top: 38px; background: var(--rf-card); border: 1px solid var(--rf-border); border-radius: 12px; box-shadow: 0 10px 30px rgba(15,23,42,.14); min-width: 210px; padding: 6px; z-index: 20; display: flex; flex-direction: column; }
.rf-menu button { text-align: left; background: none; border: none; font-family: inherit; font-size: 13px; padding: 8px 10px; border-radius: 8px; cursor: pointer; color: var(--rf-text); }
.rf-menu button:hover { background: rgba(21,101,192,.08); color: var(--rf-primary); }
.rf-menu-divider { height: 1px; background: var(--rf-border); margin: 4px 2px; }

/* ---------- Empty / skeleton ---------- */
.rf-empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 70px 20px; color: var(--rf-text-secondary); }
.rf-empty-illustration { width: 64px; height: 64px; margin-bottom: 16px; opacity: .5; }
.rf-empty-state h3 { color: var(--rf-text); margin: 0 0 6px; }
.rf-empty-state p { margin: 0 0 18px; font-size: 13.5px; }
.rf-empty-actions { display: flex; gap: 10px; }
.rf-skeleton-table { padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.rf-skeleton-row { height: 46px; border-radius: 10px; background: linear-gradient(90deg, var(--rf-border) 25%, rgba(255,255,255,.6) 50%, var(--rf-border) 75%); background-size: 200% 100%; animation: rf-shimmer 1.4s infinite; }

/* ---------- Side column ---------- */
.rf-side-col { display: flex; flex-direction: column; gap: 18px; }
.rf-card { background: var(--rf-card); border: 1px solid var(--rf-border); border-radius: var(--rf-radius); padding: var(--rf-pad); box-shadow: var(--rf-shadow); }
.rf-card-title { font-size: 15px; font-weight: 700; margin: 0 0 14px; }
.rf-dispatch-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.rf-dispatch-value { font-size: 22px; font-weight: 800; margin: 0; }
.rf-dispatch-label { font-size: 12px; color: var(--rf-text-secondary); margin: 2px 0 0; }

.rf-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
.rf-timeline-item { display: flex; gap: 12px; }
.rf-timeline-dot { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rf-timeline-dot.is-success { background: rgba(46,125,50,.14); color: var(--rf-success); }
.rf-timeline-dot.is-info { background: rgba(37,99,235,.12); color: var(--rf-info); }
.rf-timeline-dot.is-warning { background: rgba(245,158,11,.14); color: #B45309; }
.rf-timeline-desc { font-size: 13.5px; margin: 0; font-weight: 500; }
.rf-timeline-meta { font-size: 12px; color: var(--rf-text-secondary); margin: 2px 0 0; }
.rf-timeline-empty { font-size: 13px; color: var(--rf-text-secondary); }

/* ---------- Fulfillment details modal ----------
   Header made sticky with a solid background so it stays above
   the scrolling body content, and the stepper gets breathing
   room on every side. Previously `.rf-stepper` only declared
   `overflow-x: auto`; per spec that silently forces the paired
   `overflow-y` to `auto` as well, which clipped the "current
   step" glow ring at the top/bottom. Explicit overflow-y: visible
   plus real padding fixes that clipping. */
.rf-drawer-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; animation: rf-fade .18s ease; }
.rf-drawer { width: 640px; max-width: 100%; max-height: 88vh; background: var(--rf-card); border-radius: var(--rf-radius); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(15,23,42,.28); animation: rf-modal-scale .2s ease; }
.rf-drawer-loading { padding: 24px; display: flex; flex-direction: column; gap: 12px; }
.rf-drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 22px 24px;
  border-bottom: 1px solid var(--rf-border);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--rf-card);
}
.rf-drawer-eyebrow { font-size: 12px; color: var(--rf-text-secondary); font-family: ui-monospace, monospace; margin: 0 0 2px; }
.rf-drawer-header h2 { font-size: 18px; margin: 0; }
.rf-drawer-body { flex: 1; overflow-y: auto; padding: 26px 24px 22px; display: flex; flex-direction: column; gap: 26px; }
.rf-drawer-section h3 { font-size: 14px; font-weight: 700; margin: 0 0 12px; }
.rf-section-hint { font-size: 12px; color: var(--rf-text-secondary); margin: -6px 0 12px; }
.rf-drawer-footer { display: flex; align-items: center; gap: 10px; padding: 18px 24px; border-top: 1px solid var(--rf-border); flex-shrink: 0; }
.rf-drawer-footer .rf-btn { flex: 1; justify-content: center; }
.rf-drawer-done-hint { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--rf-success); font-weight: 600; font-size: 13.5px; }

.rf-stepper {
  display: flex;
  align-items: flex-start;
  overflow-x: auto;
  overflow-y: visible;
  gap: 3px;
  min-height: 78px;
  padding: 12px 4px 16px;
  margin: 0 0 6px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.rf-stepper::-webkit-scrollbar { display: none; height: 0; }
.rf-step { display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 1 1 0; min-width: 0; position: relative; }
.rf-step-dot { width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 700; background: var(--rf-border); color: var(--rf-text-secondary); transition: all .2s ease; }
.rf-step.is-complete .rf-step-dot { background: var(--rf-primary); color: #fff; }
.rf-step.is-current .rf-step-dot { background: var(--rf-info); color: #fff; box-shadow: 0 0 0 4px rgba(37,99,235,.18); }
.rf-step-label { font-size: 9px; text-align: center; color: var(--rf-text-secondary); line-height: 1.25; white-space: normal; overflow-wrap: break-word; padding: 0 1px; }
.rf-step.is-complete .rf-step-label, .rf-step.is-current .rf-step-label { color: var(--rf-text); font-weight: 600; }

.rf-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 0; }
.rf-info-grid dt { font-size: 11.5px; color: var(--rf-text-secondary); margin-bottom: 3px; }
.rf-info-grid dd { font-size: 13.5px; font-weight: 600; margin: 0; }
.rf-priority-badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
.rf-priority-badge.is-critical { background: rgba(211,47,47,.12); color: var(--rf-danger); }
.rf-priority-badge.is-high { background: rgba(245,158,11,.14); color: #B45309; }
.rf-priority-badge.is-standard { background: rgba(100,116,139,.14); color: var(--rf-text-secondary); }

.rf-clinical-notes { margin-top: 14px; background: var(--rf-bg); border: 1px solid var(--rf-border); border-radius: 12px; padding: 12px 14px; }
.rf-clinical-notes-text { font-size: 13px; margin: 0; }

.rf-unit-cards { display: flex; flex-direction: column; gap: 10px; }
.rf-unit-card { border: 1px solid var(--rf-border); border-radius: 12px; padding: 12px 14px; font-size: 13px; }
.rf-unit-card-top { display: flex; justify-content: space-between; margin-bottom: 6px; }
.rf-unit-status { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.rf-unit-status.is-verified { background: rgba(46,125,50,.14); color: var(--rf-success); }
.rf-unit-status.is-pending { background: rgba(245,158,11,.14); color: #B45309; }

.rf-checklist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.rf-checklist label { display: flex; align-items: center; gap: 10px; font-size: 13.5px; cursor: pointer; }
.rf-checklist input[type='checkbox'] { width: 17px; height: 17px; accent-color: var(--rf-primary); }
.rf-checklist .is-done { text-decoration: line-through; color: var(--rf-text-secondary); }
.rf-check-icon { color: var(--rf-success); }

.rf-notes-label { display: block; font-size: 11.5px; color: var(--rf-text-secondary); margin: 14px 0 6px; }
.rf-textarea { width: 100%; border: 1px solid var(--rf-border); border-radius: 10px; padding: 10px 12px; font-family: inherit; font-size: 13px; resize: vertical; background: var(--rf-bg); color: var(--rf-text); }

/* ---------- Confirmation modals ---------- */
.rf-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 20px; animation: rf-fade .18s ease; }
.rf-modal { width: 440px; max-width: 100%; max-height: 88vh; overflow-y: auto; background: var(--rf-card); border-radius: var(--rf-radius); padding: 24px; box-shadow: 0 20px 60px rgba(15,23,42,.28); animation: rf-modal-scale .18s ease; }
.rf-modal-title { font-size: 16.5px; font-weight: 700; margin: 0 0 16px; }
.rf-modal-summary { display: flex; flex-direction: column; gap: 8px; background: var(--rf-bg); border: 1px solid var(--rf-border); border-radius: 12px; padding: 14px; margin-bottom: 14px; }
.rf-modal-summary-row { display: flex; justify-content: space-between; font-size: 13px; }
.rf-modal-summary-row span { color: var(--rf-text-secondary); }
.rf-modal-note { font-size: 13px; color: var(--rf-text-secondary); margin: 0 0 18px; line-height: 1.5; }
.rf-modal-footer { display: flex; gap: 10px; margin-top: 18px; }
.rf-modal-footer .rf-btn { flex: 1; justify-content: center; }
.rf-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.rf-form-field { display: flex; flex-direction: column; gap: 6px; }
.rf-form-field label { font-size: 11.5px; color: var(--rf-text-secondary); font-weight: 600; }
.rf-form-field-full { grid-column: 1 / -1; }
.rf-timeline-modal { width: 480px; }
.rf-modal-header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }

/* ---------- Toasts ---------- */
.rf-toast-container { position: fixed; bottom: 24px; right: 24px; display: flex; flex-direction: column; gap: 10px; z-index: 80; max-width: 340px; }
.rf-toast { display: flex; gap: 10px; align-items: flex-start; background: var(--rf-card); border: 1px solid var(--rf-border); border-radius: 14px; padding: 14px 16px; box-shadow: 0 10px 30px rgba(15,23,42,.14); animation: rf-toast-in .22s ease; }
.rf-toast.is-success { border-left: 3px solid var(--rf-success); }
.rf-toast.is-success svg, .rf-toast.is-success .rf-icon { color: var(--rf-success); }
.rf-toast.is-error { border-left: 3px solid var(--rf-danger); }
.rf-toast.is-error svg, .rf-toast.is-error .rf-icon { color: var(--rf-danger); }
.rf-toast-title { font-weight: 700; font-size: 13.5px; margin: 0; }
.rf-toast-desc { font-size: 12.5px; color: var(--rf-text-secondary); margin: 2px 0 0; }

/* ---------- Animations ---------- */
@keyframes rf-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes rf-modal-scale { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
@keyframes rf-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes rf-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes rf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ---------- Responsive ---------- */
@media (max-width: 1180px) {
  .rf-content-grid { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .rf-kpi-grid { grid-template-columns: 1fr 1fr; }
  .rf-header { flex-direction: column; }
  .rf-drawer, .rf-timeline-modal { width: 100%; }
  .rf-form-grid { grid-template-columns: 1fr; }
  .rf-modal { width: 100%; }
  .rf-drawer-header, .rf-drawer-body, .rf-drawer-footer { padding-left: 16px; padding-right: 16px; }
  .rf-step-label { font-size: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .rf-kpi-card, .rf-row td, .rf-drawer, .rf-drawer-overlay, .rf-spin, .rf-modal, .rf-toast { animation: none !important; transition: none !important; }
}
</style>