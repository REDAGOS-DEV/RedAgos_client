<template>
  <div class="inv-page inv-tones">
    <!-- Skeleton loading state -->
    <div v-if="loading" class="inv-inner" aria-busy="true">
      <div class="skeleton skeleton--header" />
      <div class="kpi-row">
        <div v-for="n in 5" :key="n" class="skeleton skeleton--kpi" />
      </div>
      <div class="inv-grid">
        <div class="skeleton skeleton--panel" style="grid-area: list; height: 640px" />
        <div class="skeleton skeleton--panel" style="grid-area: expiring; height: 300px" />
        <div class="skeleton skeleton--panel" style="grid-area: activity; height: 320px" />
      </div>
    </div>

    <div v-else class="inv-inner">
      <!-- ============ HEADER ============ -->
      <header class="page-head">
        <div>
          <h1 class="page-title">Blood Bank Inventory</h1>
          <p class="page-subtitle">Monitor and manage {{ facilityLabel }}'s blood units in real time.</p>
        </div>
        <div class="page-head__meta">
          <span v-if="lastUpdatedLabel" class="live-note">
            <span class="live-note__dot" aria-hidden="true" />
            Updated {{ lastUpdatedLabel }}
          </span>
          <button type="button" class="btn-outline btn-outline--sm" :disabled="refreshing" @click="refresh()">
            <AssetIcon name="refresh-cw" :size="13" :class="{ 'spin-icon': refreshing }" />
            Refresh
          </button>
        </div>
      </header>

      <p v-if="loadError" class="load-error" role="alert">
        <AssetIcon name="circle-alert" :size="15" />
        <span>{{ loadError }}</span>
        <button type="button" class="link-btn" @click="refresh()">Try again</button>
      </p>

      <!-- A lapsed tag the sweep has not reached yet. Normally gone within a
           minute; one that lingers means the scheduler is down. -->
      <p v-if="summary?.overdue_active_tags" class="load-error load-error--warning" role="status">
        <AssetIcon name="clock" :size="15" />
        <span>
          {{ summary.overdue_active_tags }} tag{{ summary.overdue_active_tags === 1 ? ' has' : 's have' }} passed
          {{ summary.overdue_active_tags === 1 ? 'its' : 'their' }} 24-hour deadline and
          {{ summary.overdue_active_tags === 1 ? 'is' : 'are' }} being released.
        </span>
      </p>

      <!-- ============ KPI ROW ============ -->
      <section class="kpi-row" aria-label="Inventory at a glance">
        <component
          :is="kpi.to ? NuxtLinkComponent : kpi.onClick ? 'button' : 'div'"
          v-for="kpi in kpis"
          :key="kpi.key"
          v-bind="kpi.to ? { to: kpi.to } : kpi.onClick ? { type: 'button' } : {}"
          class="kpi"
          :class="[`tone--${kpi.tone}`, { 'kpi--action': kpi.to || kpi.onClick }]"
          @click="kpi.onClick ? kpi.onClick() : undefined"
        >
          <span class="kpi__icon" aria-hidden="true">
            <AssetIcon :name="kpi.icon" :size="20" />
          </span>
          <span class="kpi__body">
            <span class="kpi__label">{{ kpi.label }}</span>
            <span class="kpi__value">{{ kpi.value }}</span>
            <span class="kpi__sub" :class="{ 'kpi__sub--up': kpi.rising }">
              <AssetIcon v-if="kpi.rising" name="trending-up" :size="13" />
              {{ kpi.sub }}
            </span>
          </span>
          <AssetIcon v-if="kpi.to || kpi.onClick" name="chevron-right" :size="16" class="kpi__chevron" />
        </component>
      </section>

      <!-- Every shelf under its critical level, by name; hidden when none is. -->
      <LowStockBanner :cells="lowStock" to="/hospital/stock-thresholds" />

      <div class="inv-grid">
        <!-- ============ EXPIRING SOON ============ -->
        <aside class="panel side-panel expiring-panel" aria-labelledby="expiring-title">
          <header class="side-head">
            <h2 id="expiring-title" class="side-title">
              <span class="side-title__icon"><AssetIcon name="clock" :size="15" /></span>
              Expiring Soon
            </h2>
            <button type="button" class="link-btn" @click="showExpiringInList">View All</button>
          </header>

          <p v-if="expiringError" class="side-empty">{{ expiringError }}</p>
          <p v-else-if="!expiringUnits.length" class="side-empty">
            <AssetIcon name="check-circle" :size="22" />
            Nothing on the shelf expires in the next 7 days.
          </p>
          <table v-else class="mini-table">
            <thead>
              <tr>
                <th>Bag / Blood Type</th>
                <th>Expiry Date</th>
                <th>Remaining</th>
                <th><span class="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in expiringUnits"
                :key="row.id"
                class="mini-row"
                tabindex="0"
                :aria-label="`${bagLabel(row)}, ${row.blood_type?.code} ${row.component?.name}, ${daysLeftLabel(row.days_remaining)}. Open details`"
                @click="openDetails(row)"
                @keydown.enter.self="openDetails(row)"
              >
                <td>
                  <span class="mini-row__id mono">{{ bagLabel(row) }}</span>
                  <span class="type-chip">{{ displayType(row.blood_type?.code) }}</span>
                </td>
                <td class="num">{{ row.expiry_date }}</td>
                <td>
                  <span class="badge" :class="row.days_remaining <= 3 ? 'tone--danger' : 'tone--warning'">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ daysLeftLabel(row.days_remaining) }}
                  </span>
                </td>
                <td class="mini-row__chevron"><AssetIcon name="chevron-right" :size="15" /></td>
              </tr>
            </tbody>
          </table>
        </aside>

        <!-- ============ INVENTORY LIST ============ -->
        <section ref="listSection" class="panel list-panel" aria-labelledby="list-title">
          <header class="panel-head">
            <div>
              <h2 id="list-title" class="panel-title">Inventory List</h2>
              <p class="panel-subtitle">Every bag in your blood bank's custody, and the patients they are tagged to.</p>
            </div>
            <button type="button" class="btn-outline btn-outline--sm" @click="openTagHistory">
              <AssetIcon name="history" :size="13" />
              Tag History
            </button>
          </header>

          <div class="list-filters">
            <label class="search-field">
              <AssetIcon name="search" :size="15" class="search-field__icon" />
              <input
                v-model="filters.search"
                type="search"
                class="search-field__input"
                placeholder="Search bag number or tagged patient…"
                aria-label="Search by bag number or tagged patient"
                @keydown.enter.prevent="loadUnits(1)"
              />
            </label>

            <label class="filter-field">
              <span class="filter-field__label">Blood Type</span>
              <SelectField v-model="filters.bloodTypeId" size="sm" aria-label="Blood type"
                :options="[{ value: '', label: 'All' }, ...bloodTypeOptions.map(t => ({ value: t.id, label: displayType(t.code) }))]" />
            </label>

            <label class="filter-field">
              <span class="filter-field__label">Component</span>
              <SelectField v-model="filters.componentId" size="sm" aria-label="Component"
                :options="[{ value: '', label: 'All' }, ...componentOptions.map(c => ({ value: c.id, label: c.name }))]" />
            </label>

            <label class="filter-field">
              <span class="filter-field__label">Expiry Risk</span>
              <SelectField v-model="filters.expiryRisk" size="sm" aria-label="Expiry risk"
                :options="[{ value: '', label: 'All' }, { value: '3', label: 'Within 3 days' }, { value: '7', label: 'Within 7 days' }, { value: 'expired', label: 'Expired' }]"
                @change="onExpiryRiskChange" />
            </label>

            <label class="filter-field">
              <span class="filter-field__label">Status</span>
              <SelectField v-model="filters.status" size="sm" aria-label="Status"
                :options="[{ value: '', label: 'All' }, ...STATUS_OPTIONS]" @change="onStatusChange" />
            </label>

            <button type="button" class="clear-btn" :disabled="!hasActiveFilters" @click="clearFilters">
              <AssetIcon name="refresh-cw" :size="13" />
              Clear Filters
            </button>
          </div>

          <p v-if="unitsError" class="list-error" role="alert">{{ unitsError }}</p>

          <div class="table-wrap" :class="{ 'table-wrap--busy': unitsLoading }" :aria-busy="unitsLoading">
            <table v-if="unitRows.length" class="unit-table">
              <thead>
                <tr>
                  <th>Bag</th>
                  <th>Blood Type</th>
                  <th>Component</th>
                  <th :aria-sort="filters.sort === 'recent' ? 'descending' : 'none'">
                    <button type="button" class="th-sort" :class="{ 'th-sort--on': filters.sort === 'recent' }" @click="filters.sort = 'recent'">
                      Received
                      <AssetIcon v-if="filters.sort === 'recent'" name="chevron-down" :size="12" />
                    </button>
                  </th>
                  <th :aria-sort="filters.sort === 'fefo' ? 'ascending' : 'none'">
                    <button type="button" class="th-sort" :class="{ 'th-sort--on': filters.sort === 'fefo' }" @click="filters.sort = 'fefo'">
                      Expiry Date
                      <AssetIcon v-if="filters.sort === 'fefo'" name="chevron-up" :size="12" />
                    </button>
                  </th>
                  <th>Remaining Days</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th class="actions-col"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, index) in unitRows"
                  :key="row.id"
                  class="unit-row"
                  :class="rowClass(row)"
                  tabindex="0"
                  :aria-label="`${bagLabel(row)}, ${row.blood_type?.code} ${row.component?.name}, ${row.tag.label}. Open details`"
                  @click="openDetails(row)"
                  @keydown.enter.self="openDetails(row)"
                >
                  <td>
                    <span class="mono">{{ bagLabel(row) }}</span>
                    <span v-if="row.source?.transfusion_reference" class="cell-sub">for {{ row.source.transfusion_reference }}</span>
                    <span v-else-if="row.source?.direct_distribution" class="cell-sub">from {{ row.source.direct_distribution.source_name }}</span>
                  </td>
                  <td><span class="type-chip type-chip--cell">{{ displayType(row.blood_type?.code) }}</span></td>
                  <td class="wrap-cell">{{ row.component?.name || '—' }}</td>
                  <td class="num">{{ formatDay(row.received_at) }}</td>
                  <td class="num" :class="{ 'ink-danger': row.remaining.label === 'Expired' }">{{ row.expiry_date || '—' }}</td>
                  <td>
                    <span class="days" :class="[`tone--${row.remaining.tone}`, { 'days--pill': row.remaining.tone === 'warning' || row.remaining.tone === 'danger' }]">{{ row.remaining.label }}</span>
                  </td>
                  <td class="wrap-cell" :class="{ 'cell-muted': !row.storage_location }">{{ row.storage_location || 'Not set' }}</td>
                  <!-- The status, and under it the patient a tag holds the bag for, with its deadline. -->
                  <td class="status-cell">
                    <span class="badge" :class="`tone--${row.tag.tone}`"><span class="badge__dot" aria-hidden="true" />{{ row.tag.label }}</span>
                    <template v-if="row.active_tag">
                      <span class="patient">{{ row.active_tag.patient.full_name }}</span>
                      <span
                        class="countdown"
                        :class="`tone--${countdownTone(row)}`"
                        :aria-label="`${formatRemaining(remainingFor(row))} left until the ${row.active_tag.status === 'tag_assigned' ? 'crossmatch' : 'transfusion'} deadline`"
                      >
                        <AssetIcon name="clock" :size="12" />
                        {{ remainingFor(row) > 0 ? formatRemaining(remainingFor(row)) : 'Deadline passed — releasing' }}
                      </span>
                    </template>
                    <span v-else-if="row.last_tag && row.status === 'pending_return'" class="patient cell-muted">
                      Was {{ row.last_tag.patient.full_name }}
                    </span>
                  </td>
                  <td class="actions-col" @click.stop>
                    <div class="row-menu" @focusout="onRowMenuFocusOut">
                      <button
                        type="button"
                        class="row-menu__trigger"
                        :aria-label="`Actions for bag ${bagLabel(row)}`"
                        aria-haspopup="menu"
                        :aria-expanded="openMenuId === row.id"
                        @click="openMenuId = openMenuId === row.id ? null : row.id"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
                          <circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" />
                        </svg>
                      </button>
                      <div
                        v-if="openMenuId === row.id"
                        class="row-menu__dropdown"
                        :class="{ 'row-menu__dropdown--up': index >= unitRows.length - 3 && unitRows.length > 4 }"
                        role="menu"
                      >
                        <button type="button" role="menuitem" class="row-menu__item" @click="rowAction('view', row)">
                          <AssetIcon name="eye" :size="13" /> View details
                        </button>
                        <button
                          v-for="action in handleActions(row)"
                          :key="action"
                          type="button"
                          role="menuitem"
                          class="row-menu__item"
                          :disabled="actionBlocked(action, row)"
                          @click="rowAction(action, row)"
                        >
                          <AssetIcon :name="ACTIONS[action].icon" :size="13" /> {{ ACTIONS[action].label }}
                        </button>
                        <template v-if="canDiscardRow(row)">
                          <div class="row-menu__divider" />
                          <button type="button" role="menuitem" class="row-menu__item row-menu__item--danger" :disabled="busyUnit === row.unit_id" @click="rowAction('discard', row)">
                            <AssetIcon name="trash-2" :size="13" /> {{ ACTIONS.discard.label }}
                          </button>
                        </template>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-else-if="!unitsLoading" class="empty-state">
              <AssetIcon name="inbox" :size="36" />
              <p class="empty-state__title">{{ hasActiveFilters ? 'No bags match these filters' : 'No bags in your blood bank yet' }}</p>
              <p class="empty-state__desc">
                {{ hasActiveFilters ? 'Clear a filter to see more.' : 'Bags appear here once their arrival is confirmed, and are free to tag once stocked in at Stock Intake.' }}
              </p>
              <button v-if="hasActiveFilters" type="button" class="btn-outline btn-outline--sm" @click="clearFilters">Clear filters</button>
            </div>
          </div>

          <footer v-if="unitsMeta.total" class="list-foot">
            <p class="list-foot__summary">
              Showing {{ formatCount(unitsMeta.from) }}–{{ formatCount(unitsMeta.to) }} of {{ formatCount(unitsMeta.total) }} bag{{ unitsMeta.total === 1 ? '' : 's' }}
            </p>
            <nav v-if="unitsMeta.lastPage > 1" class="pager" aria-label="Inventory pages">
              <button type="button" class="pager__btn" :disabled="unitsMeta.page <= 1" aria-label="Previous page" @click="loadUnits(unitsMeta.page - 1)">
                <AssetIcon name="chevron-left" :size="14" />
              </button>
              <template v-for="(p, i) in pages" :key="`${p}-${i}`">
                <span v-if="p === '…'" class="pager__gap" aria-hidden="true">…</span>
                <button
                  v-else
                  type="button"
                  class="pager__btn"
                  :class="{ 'pager__btn--on': p === unitsMeta.page }"
                  :aria-current="p === unitsMeta.page ? 'page' : undefined"
                  :aria-label="`Page ${p}`"
                  @click="loadUnits(p)"
                >
                  {{ p }}
                </button>
              </template>
              <button type="button" class="pager__btn" :disabled="unitsMeta.page >= unitsMeta.lastPage" aria-label="Next page" @click="loadUnits(unitsMeta.page + 1)">
                <AssetIcon name="chevron-right" :size="14" />
              </button>
            </nav>
          </footer>
        </section>

        <!-- ============ RECENT ACTIVITY ============ -->
        <aside class="panel side-panel activity-panel" aria-labelledby="activity-title">
          <header class="side-head">
            <h2 id="activity-title" class="side-title">
              <span class="side-title__icon"><AssetIcon name="activity" :size="15" /></span>
              Recent Activity
            </h2>
            <button type="button" class="link-btn" @click="openActivityDrawer">View All</button>
          </header>

          <p v-if="activityError" class="side-empty">{{ activityError }}</p>
          <p v-else-if="!activity.length" class="side-empty">
            <AssetIcon name="activity" :size="22" />
            No bag has moved yet.
          </p>
          <ol v-else class="activity-list">
            <li v-for="item in activity" :key="item.id" class="activity-item">
              <span class="activity-item__icon" :class="`tone--${hospitalActivityKindMeta(item.kind).tone}`" aria-hidden="true">
                <AssetIcon :name="hospitalActivityKindMeta(item.kind).icon" :size="16" />
              </span>
              <span class="activity-item__body">
                <span class="activity-item__title">{{ hospitalActivityKindMeta(item.kind).label }}</span>
                <span class="activity-item__meta">
                  <span class="mono">{{ item.bag_number }}</span>
                  <span class="type-text">{{ displayType(item.blood_type) }}</span>
                  <span>{{ item.component }}</span>
                </span>
              </span>
              <span class="activity-item__when">
                <time :datetime="item.at" :title="formatDateTime(item.at)">{{ timeAgo(item.at, now) }}</time>
                <span>{{ item.actor || 'System' }}</span>
              </span>
            </li>
          </ol>
        </aside>
      </div>
    </div>

    <!-- ============ BAG DETAILS DRAWER ============ -->
    <Teleport to="body">
      <Transition name="drawer-fade">
        <div v-if="drawerUnit" class="drawer-overlay inv-tones" @click.self="closeDetails">
          <aside
            class="detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unit-drawer-title"
            v-focus-trap
            @dialog-escape="closeDetails"
          >
            <header class="detail-drawer__header">
              <div>
                <p class="detail-drawer__eyebrow">{{ bagLabel(drawerUnit) }}</p>
                <h2 id="unit-drawer-title" class="detail-drawer__title">
                  {{ displayType(drawerUnit.blood_type?.code) }} &middot; {{ drawerUnit.component?.name || '—' }}
                </h2>
              </div>
              <button type="button" class="modal-close" aria-label="Close" @click="closeDetails">
                <AssetIcon name="x" :size="16" />
              </button>
            </header>

            <div class="detail-drawer__body">
              <section>
                <p class="drawer-section-title">Bag</p>
                <dl class="drawer-info-grid">
                  <div><dt>Blood Type</dt><dd>{{ displayType(drawerUnit.blood_type?.code) }}</dd></div>
                  <div><dt>Component</dt><dd>{{ drawerUnit.component?.name || '—' }}</dd></div>
                  <div><dt>Volume</dt><dd>{{ drawerUnit.volume_ml ? `${drawerUnit.volume_ml} mL` : '—' }}</dd></div>
                  <div>
                    <dt>Status</dt>
                    <dd><span class="badge" :class="`tone--${drawerTag.tone}`"><span class="badge__dot" aria-hidden="true" />{{ drawerTag.label }}</span></dd>
                  </div>
                  <div><dt>Received</dt><dd>{{ formatDateTime(drawerUnit.received_at) || '—' }}</dd></div>
                  <div>
                    <dt>Expiry Date</dt>
                    <dd>
                      {{ formatLongDate(drawerUnit.expiry_date) }}
                      <span class="drawer-note">{{ drawerRemaining }}</span>
                    </dd>
                  </div>
                  <div><dt>Storage Location</dt><dd>{{ drawerUnit.storage_location || 'Not set' }}</dd></div>
                  <div>
                    <dt>Stocked In</dt>
                    <dd>
                      {{ formatDateTime(drawerUnit.stocked_at) || 'Not yet' }}
                      <span v-if="drawerUnit.stocked_by" class="drawer-note">{{ drawerUnit.stocked_by }}</span>
                    </dd>
                  </div>
                  <div class="drawer-info-grid__wide"><dt>Source</dt><dd>{{ sourceLabel(drawerUnit) }}</dd></div>
                  <div v-if="drawerUnit.discard_reason" class="drawer-info-grid__wide"><dt>Discard Reason</dt><dd>{{ drawerUnit.discard_reason }}</dd></div>
                </dl>
              </section>

              <section v-if="drawerUnit.active_tag">
                <p class="drawer-section-title">Tagged To</p>
                <dl class="drawer-info-grid">
                  <div class="drawer-info-grid__wide">
                    <dt>Patient</dt>
                    <dd>
                      {{ drawerUnit.active_tag.patient.full_name }}
                      <span class="drawer-note">
                        {{ [drawerUnit.active_tag.patient.record_number, drawerUnit.active_tag.patient.ward].filter(Boolean).join(' · ') || '—' }}
                      </span>
                    </dd>
                  </div>
                  <div><dt>Stage</dt><dd>{{ TAG_STAGE_LABELS[drawerUnit.active_tag.status] }}</dd></div>
                  <div>
                    <dt>Deadline</dt>
                    <dd>
                      <span class="countdown" :class="`tone--${countdownTone(drawerUnit)}`">
                        <AssetIcon name="clock" :size="12" />
                        {{ remainingFor(drawerUnit) > 0 ? formatRemaining(remainingFor(drawerUnit)) : 'Deadline passed — releasing' }}
                      </span>
                      <span class="drawer-note">by {{ formatDateTime(drawerUnit.active_tag.deadline_at) }}</span>
                    </dd>
                  </div>
                </dl>
              </section>

              <section>
                <p class="drawer-section-title">Tags</p>
                <p v-if="drawerTagsLoading" class="drawer-muted">Loading…</p>
                <p v-else-if="drawerTagsError" class="drawer-muted">{{ drawerTagsError }}</p>
                <p v-else-if="!drawerTags.length" class="drawer-muted">This bag has never been tagged to a patient.</p>
                <ol v-else class="history-list">
                  <li v-for="tag in drawerTags" :key="tag.id" class="history-list__item">
                    <span class="activity-item__icon activity-item__icon--sm tone--neutral" aria-hidden="true">
                      <AssetIcon :name="tag.status === 'transfused' ? 'blood-drop' : tag.untagged_at ? 'user-x' : 'user-check'" :size="13" />
                    </span>
                    <span class="history-list__body">
                      <strong>{{ tag.status_label }} &middot; {{ tag.patient.full_name }}</strong>
                      <span>Tagged {{ formatDateTime(tag.tagged_at) }}<template v-if="tag.actors?.tagged_by"> &middot; {{ tag.actors.tagged_by }}</template></span>
                      <span v-if="tag.untag_reason_label">
                        {{ tag.untag_reason_label }}<template v-if="tag.untag_note">: “{{ tag.untag_note }}”</template>
                      </span>
                    </span>
                  </li>
                </ol>
              </section>

              <section>
                <p class="drawer-section-title">Movement History</p>
                <p v-if="drawerHistoryLoading" class="drawer-muted">Loading…</p>
                <p v-else-if="drawerHistoryError" class="drawer-muted">{{ drawerHistoryError }}</p>
                <p v-else-if="!drawerHistory.length" class="drawer-muted">No recorded movement yet.</p>
                <ol v-else class="history-list">
                  <li v-for="item in drawerHistory" :key="item.id" class="history-list__item">
                    <span class="activity-item__icon activity-item__icon--sm" :class="`tone--${hospitalActivityKindMeta(item.kind).tone}`" aria-hidden="true">
                      <AssetIcon :name="hospitalActivityKindMeta(item.kind).icon" :size="13" />
                    </span>
                    <span class="history-list__body">
                      <strong>{{ hospitalActivityKindMeta(item.kind).label }}</strong>
                      <span>{{ formatDateTime(item.at) }} &middot; {{ item.actor || 'System' }}</span>
                    </span>
                  </li>
                </ol>
              </section>
            </div>

            <footer v-if="drawerActions.length" class="detail-drawer__footer">
              <button
                v-for="action in drawerActions"
                :key="action"
                type="button"
                class="btn-outline"
                :class="{ 'btn-outline--danger': action === 'discard' }"
                :disabled="actionBlocked(action, drawerUnit)"
                @click="fromDrawer(action)"
              >
                <AssetIcon :name="ACTIONS[action].icon" :size="14" /> {{ ACTIONS[action].label }}
              </button>
            </footer>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <!-- ============ ALL ACTIVITY DRAWER ============ -->
    <Teleport to="body">
      <Transition name="drawer-fade">
        <div v-if="activityDrawerOpen" class="drawer-overlay inv-tones" @click.self="activityDrawerOpen = false">
          <aside
            class="detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-drawer-title"
            v-focus-trap
            @dialog-escape="activityDrawerOpen = false"
          >
            <header class="detail-drawer__header">
              <div>
                <p class="detail-drawer__eyebrow">{{ facilityLabel }}</p>
                <h2 id="activity-drawer-title" class="detail-drawer__title">Inventory Activity</h2>
              </div>
              <button type="button" class="modal-close" aria-label="Close" @click="activityDrawerOpen = false">
                <AssetIcon name="x" :size="16" />
              </button>
            </header>

            <div class="detail-drawer__body detail-drawer__body--flush">
              <p v-if="allActivityError" class="drawer-muted drawer-muted--pad">{{ allActivityError }}</p>
              <p v-else-if="!allActivity.length && !allActivityLoading" class="drawer-muted drawer-muted--pad">No bag has moved yet.</p>
              <ol class="activity-list">
                <li v-for="item in allActivity" :key="item.id" class="activity-item">
                  <span class="activity-item__icon" :class="`tone--${hospitalActivityKindMeta(item.kind).tone}`" aria-hidden="true">
                    <AssetIcon :name="hospitalActivityKindMeta(item.kind).icon" :size="16" />
                  </span>
                  <span class="activity-item__body">
                    <span class="activity-item__title">{{ hospitalActivityKindMeta(item.kind).label }}</span>
                    <span class="activity-item__meta">
                      <span class="mono">{{ item.bag_number }}</span>
                      <span class="type-text">{{ displayType(item.blood_type) }}</span>
                      <span>{{ item.component }}</span>
                    </span>
                  </span>
                  <span class="activity-item__when">
                    <time :datetime="item.at">{{ formatDateTime(item.at) }}</time>
                    <span>{{ item.actor || 'System' }}</span>
                  </span>
                </li>
              </ol>
              <div v-if="allActivityPage < allActivityLastPage || allActivityLoading" class="drawer-more">
                <button type="button" class="btn-outline btn-outline--sm" :disabled="allActivityLoading" @click="loadAllActivity(allActivityPage + 1)">
                  {{ allActivityLoading ? 'Loading…' : 'Load more' }}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <!-- ============ TAG HISTORY DRAWER ============ -->
    <!-- Tags that ended — released, lapsed, or transfused — newest first. -->
    <Teleport to="body">
      <Transition name="drawer-fade">
        <div v-if="tagHistoryOpen" class="drawer-overlay inv-tones" @click.self="tagHistoryOpen = false">
          <aside
            class="detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tag-history-title"
            v-focus-trap
            @dialog-escape="tagHistoryOpen = false"
          >
            <header class="detail-drawer__header">
              <div>
                <p class="detail-drawer__eyebrow">{{ facilityLabel }}</p>
                <h2 id="tag-history-title" class="detail-drawer__title">Tag History</h2>
              </div>
              <button type="button" class="modal-close" aria-label="Close" @click="tagHistoryOpen = false">
                <AssetIcon name="x" :size="16" />
              </button>
            </header>

            <div class="drawer-filters">
              <label class="search-field">
                <AssetIcon name="search" :size="15" class="search-field__icon" />
                <input
                  v-model="eventFilters.search"
                  type="search"
                  class="search-field__input"
                  placeholder="Search bag number or patient…"
                  aria-label="Search tag history by bag number or patient"
                />
              </label>
              <label class="filter-field">
                <span class="filter-field__label">Outcome</span>
                <SelectField
                  v-model="eventFilters.status"
                  size="sm"
                  aria-label="Outcome"
                  :options="[
                    { value: '', label: 'All' },
                    ...['untagged_assigned', 'untagged_crossmatched', 'transfused'].map((value) => ({ value, label: UNIT_TAG_STATUS_LABELS[value] })),
                  ]"
                />
              </label>
            </div>

            <div class="detail-drawer__body detail-drawer__body--flush">
              <p v-if="eventsError" class="drawer-muted drawer-muted--pad">{{ eventsError }}</p>
              <p v-else-if="!events.length && !eventsLoading" class="drawer-muted drawer-muted--pad">
                No ended tags yet. Released and transfused bags appear here, newest first.
              </p>
              <ol class="activity-list">
                <li v-for="event in events" :key="event.id" class="activity-item">
                  <span class="activity-item__icon tone--neutral" aria-hidden="true">
                    <AssetIcon :name="event.status === 'transfused' ? 'blood-drop' : 'user-x'" :size="16" />
                  </span>
                  <span class="activity-item__body">
                    <span class="activity-item__title">{{ event.patient.full_name }}</span>
                    <span class="activity-item__meta">
                      <span class="badge"><span class="badge__dot" aria-hidden="true" />{{ event.status_label }}</span>
                      <span class="mono">{{ event.unit.bag_number || event.unit.unit_id }}</span>
                      <span class="type-text">{{ displayType(event.unit.blood_type) }}</span>
                      <span>{{ event.unit.component || '—' }}</span>
                    </span>
                    <span v-if="event.untag_reason" class="activity-item__note">
                      {{ event.untag_reason_label }}<template v-if="event.untag_note">: “{{ event.untag_note }}”</template>
                    </span>
                  </span>
                  <span class="activity-item__when">
                    <time :datetime="event.untagged_at || event.transfused_at">{{ formatDateTime(event.untagged_at || event.transfused_at) }}</time>
                    <span>{{ actorFor(event) }}</span>
                  </span>
                </li>
              </ol>
              <div v-if="eventsPage < eventsLastPage || eventsLoading" class="drawer-more">
                <button type="button" class="btn-outline btn-outline--sm" :disabled="eventsLoading" @click="loadEvents(eventsPage + 1)">
                  {{ eventsLoading ? 'Loading…' : 'Load more' }}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <!-- ============ BAG ACTION DIALOGS ============ -->
    <HospitalTagUnitDialog
      v-if="dialog?.kind === 'tag'"
      :unit="dialog.unit"
      :busy="dialogBusy"
      :error="dialogError"
      :field-errors="dialogFieldErrors"
      @confirm="runTag"
      @close="closeDialog"
    />

    <HospitalUnitReasonDialog
      v-if="dialog?.kind === 'release'"
      :title="`Release the tag on ${bagLabel(dialog.unit)}?`"
      label="Why is the tag being released?"
      confirm-label="Release tag"
      icon="user-x"
      :busy="dialogBusy"
      :error="dialogError"
      @confirm="runRelease"
      @close="closeDialog"
    >
      <template v-if="dialog.unit.status === 'tag_crossmatched'">
        The bag has already left storage for {{ dialog.unit.active_tag?.patient.full_name }}. It will be recorded as
        <strong>Untagged Crossmatched</strong> and wait as Pending Return until you confirm it is back in storage or discard it.
      </template>
      <template v-else>
        {{ dialog.unit.active_tag?.patient.full_name }} will no longer hold this bag. It will be recorded as
        <strong>Untagged Assigned</strong> and is available again at once.
      </template>
    </HospitalUnitReasonDialog>

    <HospitalUnitReasonDialog
      v-if="dialog?.kind === 'discard'"
      :title="`Discard ${bagLabel(dialog.unit)}?`"
      label="Why is the bag being discarded?"
      confirm-label="Discard bag"
      icon="trash-2"
      :busy="dialogBusy"
      :error="dialogError"
      @confirm="runDiscard"
      @close="closeDialog"
    >
      The bag leaves your stock for good. This cannot be undone.
    </HospitalUnitReasonDialog>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="confirmCopy" class="modal-overlay inv-tones" @click.self="!dialogBusy && closeDialog()">
          <div
            class="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unit-confirm-title"
            v-focus-trap
            @dialog-escape="!dialogBusy && closeDialog()"
          >
            <button type="button" class="modal-close" aria-label="Close" :disabled="dialogBusy" @click="closeDialog">
              <AssetIcon name="x" :size="16" />
            </button>
            <h3 id="unit-confirm-title" class="modal-title">{{ confirmCopy.title }}</h3>
            <p class="modal-subtitle">{{ confirmCopy.body }}</p>
            <p v-if="dialogError" class="form-error" role="alert">{{ dialogError }}</p>
            <div class="modal-actions">
              <button type="button" class="btn-primary modal-actions__btn" :disabled="dialogBusy" @click="runConfirm">
                {{ dialogBusy ? 'Working…' : confirmCopy.action }}
              </button>
              <button type="button" class="btn-outline modal-actions__btn" :disabled="dialogBusy" @click="closeDialog">Cancel</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Says what an action did, or why it did nothing. -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="notice" class="inventory-toast inv-tones" role="status">
          <AssetIcon name="circle-alert" :size="15" />
          <span>{{ notice }}</span>
          <button type="button" class="inventory-toast__close" aria-label="Dismiss" @click="notice = ''">
            <AssetIcon name="x" :size="13" />
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * The hospital blood bank's own stock: the bags it holds, and the patients they are tagged to.
 *
 * Laid out as the centre's Blood Inventory is (project owner, 2026-10-28):
 * headline cards, the list, Expiring Soon and Recent Activity. The type
 * cards moved to the dashboard the same day, and stock-in has a page of its
 * own, Stock Intake.
 *
 * A tag is one specific bag held for one specific patient. Tag Assigned keeps
 * it in storage with 24 hours to crossmatch; Tag Crossmatched means it left
 * storage with 24 hours to transfuse. The countdowns run on the server's
 * clock (`as_of`), not the browser's, and the page never acts when one
 * reaches zero: the server's sweep releases the tag, and the page refreshes
 * to show it. Every action is re-checked by the API under lock; a refusal is
 * explained and the list reloaded, since it means the bag moved on.
 */

import { resolveComponent } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import LowStockBanner from '~/components/common/LowStockBanner.vue'
import SelectField from '~/components/common/SelectField.vue'
import HospitalTagUnitDialog from '~/components/Hospital/TagUnitDialog.vue'
import HospitalUnitReasonDialog from '~/components/Hospital/UnitReasonDialog.vue'
import { hospitalService } from '~/api/hospital/HospitalService'
import {
  HOSPITAL_UNIT_STATUS_LABELS,
  HOSPITAL_UNIT_STATUSES,
  TAG_STAGE_LABELS,
  UNIT_REFUSAL_MESSAGES,
  UNIT_TAG_STATUS_LABELS,
} from '~/types/hospitalInventory'
import { actionsFor, deadlineTier, formatRemaining, remainingMs, serverSkew } from '~/utils/tagDeadline'
import { typeHealthByCode } from '~/utils/stockThreshold'
import { daysLeftLabel, orderDashboardTypes, pageWindow, timeAgo } from '~/utils/inventoryDashboard'
import { hospitalActivityKindMeta, hospitalRemainingDaysTag, hospitalUnitStatusTag } from '~/utils/hospitalInventoryDashboard'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.inventory.view' })

const NuxtLinkComponent = resolveComponent('NuxtLink')

/** What each bag action is called and drawn with, in the menu and the drawer. */
const ACTIONS = {
  tag: { label: 'Tag to patient', icon: 'user-check' },
  crossmatch: { label: 'Record crossmatch', icon: 'flask-conical' },
  transfuse: { label: 'Record transfusion', icon: 'blood-drop' },
  release: { label: 'Release tag', icon: 'user-x' },
  return: { label: 'Back in storage', icon: 'refresh-cw' },
  discard: { label: 'Discard', icon: 'trash-2' },
}

/** The Status filter: each status in lifecycle order, with both tag stages together after them. */
const STATUS_OPTIONS = [
  ...HOSPITAL_UNIT_STATUSES.map((value) => ({ value, label: HOSPITAL_UNIT_STATUS_LABELS[value] })),
  { value: 'tagged', label: 'Tagged (either stage)' },
]

/** How long after a deadline passes to look again: the sweep runs every minute. */
const SWEEP_GRACE_MS = 65_000

const route = useRoute()
const { user, can } = useUser()

// Every number on this page is the signed-in account's own blood bank: the
// server resolves the facility from the session.
const facilityLabel = computed(() => user.value?.facility?.facility_name || 'your blood bank')

/*
 * What this role may do (hospital roles, project owner 2026-10-11). The
 * server refuses the endpoints with `can:` either way; this only keeps a role
 * from being offered a button that would be refused.
 */
const canHandle = computed(() => can('hospital.inventory.handle'))
const canDiscard = computed(() => can('hospital.inventory.discard'))

const loading = ref(true)
const loadError = ref('')
const refreshing = ref(false)
const lastUpdated = ref(null)

/** The local clock, ticked so countdowns move between loads. */
const now = ref(Date.now())
/** How far this browser's clock is from the server's. */
const skew = ref(0)

// --- Reference data ---
const bloodTypeOptions = ref([])
const componentOptions = ref([])

async function loadReference() {
  try {
    const data = await hospitalService.referenceData()
    bloodTypeOptions.value = orderDashboardTypes(data?.blood_types ?? [])
    componentOptions.value = data?.components ?? []
  } catch {
    // The filters are a convenience; the page works without them.
  }
}

// --- Overview: summary, minimums, expiring bags, activity ---
const summary = ref(null)
const thresholds = ref(null)
// The blood bank's own minimums against its shelf. Supplementary: a failed
// load just leaves the cards ungraded and no banner.
const stockCells = ref([])
const lowStock = ref([])
const expiringUnits = ref([])
const expiringError = ref('')
const activity = ref([])
const activityError = ref('')

async function loadSummary() {
  try {
    const data = await hospitalService.inventorySummary()
    summary.value = data
    skew.value = serverSkew(data.as_of, Date.now())
    now.value = Date.now()
    loadError.value = ''
  } catch (err) {
    loadError.value = err?.message || 'The stock summary could not be loaded. The figures below may be out of date.'
  }
}

async function loadOverview() {
  const [thresholdData, expiring, recent] = await Promise.all([
    hospitalService.stockThresholds().catch(() => null),
    hospitalService.inventory({ expiring_within_days: 7, per_page: 6 }).catch(() => null),
    hospitalService.inventoryActivity({ per_page: 6 }).catch(() => null),
  ])

  thresholds.value = thresholdData
  stockCells.value = thresholdData?.cells ?? []
  lowStock.value = thresholdData?.low ?? []

  expiringError.value = expiring ? '' : 'Bags close to expiry could not be loaded.'
  if (expiring) expiringUnits.value = expiring.data ?? []

  activityError.value = recent ? '' : 'Recent activity could not be loaded.'
  if (recent) activity.value = recent.data ?? []
}

// --- KPI row ---
const totals = computed(() => summary.value?.totals ?? {})

const availableTotal = computed(() => {
  // Counted from the same issuable cells as the cards below, so the headline
  // and the cards always add up. The summary's count is the fallback.
  if (stockCells.value.length) return stockCells.value.reduce((sum, cell) => sum + cell.available, 0)
  return totals.value.available ?? null
})

const anyMinimumSet = computed(() => stockCells.value.some((cell) => cell.minimum_units !== null))
// Graded as the dashboard's type cards are: the worst monitored component decides.
const typesBelowMinimum = computed(() => (thresholds.value?.blood_types ?? [])
  .filter(({ code }) => ['low', 'critical'].includes(typeHealthByCode(stockCells.value, code)))
  .length)

const kpis = computed(() => {
  const added = summary.value?.stocked_last_7_days ?? 0
  const assigned = totals.value.tag_assigned ?? 0
  const crossmatched = totals.value.tag_crossmatched ?? 0
  const pending = totals.value.pending_return ?? 0

  return [
    {
      key: 'available',
      label: 'Total Available Units',
      value: formatCount(availableTotal.value),
      sub: added > 0 ? `+${formatCount(added)} stocked in 7 days` : 'None stocked in 7 days',
      rising: added > 0,
      icon: 'blood-drop',
      tone: 'neutral',
    },
    {
      key: 'critical',
      label: 'Critical Low Stock',
      value: anyMinimumSet.value ? formatCount(typesBelowMinimum.value) : '—',
      sub: anyMinimumSet.value
        ? `type${typesBelowMinimum.value === 1 ? '' : 's'} below critical level`
        : 'No critical levels set',
      icon: 'triangle-alert',
      // State rides on the icon alone: every card shares one surface.
      tone: !anyMinimumSet.value ? 'muted' : typesBelowMinimum.value > 0 ? 'danger' : 'success',
      to: '/hospital/stock-thresholds',
    },
    {
      key: 'expiring',
      label: 'Expiring Soon',
      value: formatCount(summary.value?.near_expiry?.within_7_days),
      sub: 'units (≤ 7 days)',
      icon: 'clock',
      tone: Number(summary.value?.near_expiry?.within_7_days) > 0 ? 'warning' : 'neutral',
      onClick: showExpiringInList,
    },
    {
      key: 'tagged',
      label: 'Tagged to Patients',
      value: summary.value ? formatCount(assigned + crossmatched) : '—',
      sub: `${formatCount(crossmatched)} of them crossmatched`,
      icon: 'user-check',
      tone: 'neutral',
      onClick: () => showStatusInList('tagged'),
    },
    {
      key: 'pending',
      label: 'Pending Return',
      value: formatCount(totals.value.pending_return),
      sub: 'out of storage, untagged',
      icon: 'refresh-cw',
      // Bags someone has to confirm back or discard.
      tone: pending > 0 ? 'warning' : 'neutral',
      onClick: () => showStatusInList('pending_return'),
    },
  ]
})

// --- Inventory list (server-paginated) ---
const PAGE_SIZE = 8
const listSection = ref(null)
const units = ref([])
const unitsLoading = ref(false)
const unitsError = ref('')
const unitsMeta = reactive({ page: 1, lastPage: 1, total: 0, from: 0, to: 0 })

// A link may open the list on one status (a patient's page sends ?status=tagged)
// or one blood type (the dashboard's type cards send ?blood_type_id=).
const startStatus = STATUS_OPTIONS.some((option) => option.value === route.query.status) ? route.query.status : ''
const startBloodType = Number(route.query.blood_type_id) || ''

const filters = reactive({
  search: '',
  bloodTypeId: startBloodType,
  componentId: '',
  expiryRisk: '',
  status: startStatus,
  // Newest arrivals first: every status is listed, and in FEFO order the list
  // would open on bags that left long ago.
  sort: 'recent',
})

const hasActiveFilters = computed(() =>
  Boolean(filters.search.trim() || filters.bloodTypeId || filters.componentId || filters.expiryRisk || filters.status),
)

function unitParams(page) {
  const params = { page, per_page: PAGE_SIZE, sort: filters.sort }
  const search = filters.search.trim()

  if (search) params.search = search
  if (filters.bloodTypeId) params.blood_type_id = filters.bloodTypeId
  if (filters.componentId) params.component_id = filters.componentId

  // Expiry risk and status are one choice at a time (see the change handlers):
  // "expiring within" lists available bags only, and "expired" is a status.
  if (filters.expiryRisk === 'expired') params.status = 'expired'
  else if (filters.expiryRisk) params.expiring_within_days = Number(filters.expiryRisk)
  else if (filters.status) params.status = filters.status

  return params
}

let unitsTicket = 0
async function loadUnits(page = unitsMeta.page, { quiet = false } = {}) {
  // Filters can change faster than the API answers; only the latest request
  // may draw the table.
  const ticket = ++unitsTicket
  if (!quiet) unitsLoading.value = true

  try {
    const response = await hospitalService.inventory(unitParams(page))
    if (ticket !== unitsTicket) return

    const lastPage = response?.last_page ?? 1

    // A refresh can find the page gone (bags transfused, a filter narrowed).
    if (!response?.data?.length && page > 1 && lastPage < page) {
      await loadUnits(lastPage, { quiet })
      return
    }

    units.value = response?.data ?? []
    unitsMeta.page = response?.current_page ?? page
    unitsMeta.lastPage = lastPage
    unitsMeta.total = response?.total ?? units.value.length
    unitsMeta.from = response?.from ?? 0
    unitsMeta.to = response?.to ?? 0
    unitsError.value = ''
  } catch (err) {
    if (ticket !== unitsTicket) return
    unitsError.value = err?.message || 'The bags could not be loaded. Please try again.'
  } finally {
    if (ticket === unitsTicket) unitsLoading.value = false
  }
}

const unitRows = computed(() =>
  units.value.map((unit) => ({
    ...unit,
    tag: hospitalUnitStatusTag(unit.status, unit.days_remaining),
    remaining: hospitalRemainingDaysTag(unit.status, unit.days_remaining),
  })),
)

const pages = computed(() => pageWindow(unitsMeta.page, unitsMeta.lastPage))

watch(
  () => [filters.bloodTypeId, filters.componentId, filters.expiryRisk, filters.status, filters.sort],
  () => loadUnits(1),
)

let searchTimer = null
watch(
  () => filters.search,
  () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => loadUnits(1), 300)
  },
)

function onExpiryRiskChange() {
  if (!filters.expiryRisk) return
  filters.status = ''
  // The soonest to go first, once the list is about expiry.
  filters.sort = 'fefo'
}

function onStatusChange() {
  if (filters.status) filters.expiryRisk = ''
}

function clearFilters() {
  Object.assign(filters, { search: '', bloodTypeId: '', componentId: '', expiryRisk: '', status: '', sort: 'recent' })
}

function scrollToList() {
  nextTick(() => listSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function showExpiringInList() {
  Object.assign(filters, { expiryRisk: '7', status: '', sort: 'fefo' })
  scrollToList()
}

function showStatusInList(status) {
  Object.assign(filters, { status, expiryRisk: '' })
  scrollToList()
}

// --- Countdowns: the server's clock, never the browser's ---
function remainingFor(unit) {
  return remainingMs(unit.active_tag?.deadline_at, now.value, skew.value)
}

function tierFor(unit) {
  return deadlineTier(remainingFor(unit))
}

/** A running deadline in the three state colours: calm, soon, nearly out. */
function countdownTone(unit) {
  const tier = tierFor(unit)
  return tier === 'critical' || tier === 'overdue' ? 'danger' : tier === 'soon' ? 'warning' : 'neutral'
}

// The left edge marks urgency, never colour alone: the countdown says it in words.
function rowClass(unit) {
  if (unit.active_tag) {
    const tier = tierFor(unit)
    return tier === 'critical' || tier === 'overdue' ? 'row--critical' : tier === 'soon' ? 'row--soon' : ''
  }

  return ''
}

/** Whether any tag on screen has passed its deadline. */
const anyOverdue = computed(() => [...units.value, drawerUnit.value].some((unit) => unit?.active_tag && remainingFor(unit) <= 0))

// --- What this role may do to a bag ---
/** The tag steps this role may take on a bag; discard is offered apart. */
function handleActions(unit) {
  return canHandle.value ? actionsFor(unit.status, unit.bag_expired).filter((action) => action !== 'discard') : []
}

function canDiscardRow(unit) {
  return canDiscard.value && actionsFor(unit.status, unit.bag_expired).includes('discard')
}

// Past a deadline only a release is still taken: the sweep is about to end the tag.
function actionBlocked(action, unit) {
  return busyUnit.value === unit.unit_id || (action !== 'release' && Boolean(unit.active_tag) && remainingFor(unit) <= 0)
}

// --- Row action menu ---
const openMenuId = ref(null)
function onRowMenuFocusOut(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) openMenuId.value = null
}

function rowAction(action, row) {
  openMenuId.value = null
  if (action === 'view') openDetails(row)
  else startAction(action, row)
}

// --- Bag details drawer ---
const drawerUnit = ref(null)
const drawerHistory = ref([])
const drawerHistoryLoading = ref(false)
const drawerHistoryError = ref('')
const drawerTags = ref([])
const drawerTagsLoading = ref(false)
const drawerTagsError = ref('')

const drawerTag = computed(() => (drawerUnit.value ? hospitalUnitStatusTag(drawerUnit.value.status, drawerUnit.value.days_remaining) : null))
const drawerRemaining = computed(() => {
  const unit = drawerUnit.value
  if (!unit || unit.days_remaining === null || unit.days_remaining === undefined) return ''
  if (['transfused', 'discarded'].includes(unit.status)) return ''
  const d = unit.days_remaining
  if (d < 0) return `Expired ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago`
  if (d === 0) return 'Expires today'
  return `${d} day${d === 1 ? '' : 's'} remaining`
})
const drawerActions = computed(() => {
  const unit = drawerUnit.value
  if (!unit) return []
  return [...handleActions(unit), ...(canDiscardRow(unit) ? ['discard'] : [])]
})

async function openDetails(row) {
  openMenuId.value = null
  drawerUnit.value = row
  drawerHistory.value = []
  drawerHistoryError.value = ''
  drawerHistoryLoading.value = true
  drawerTags.value = []
  drawerTagsError.value = ''
  drawerTagsLoading.value = true

  const unitId = row.unit_id

  hospitalService.inventoryActivity({ unit_id: unitId, per_page: 50 })
    .then((response) => { if (drawerUnit.value?.unit_id === unitId) drawerHistory.value = response?.data ?? [] })
    .catch(() => { if (drawerUnit.value?.unit_id === unitId) drawerHistoryError.value = 'This bag\'s history could not be loaded.' })
    .finally(() => { if (drawerUnit.value?.unit_id === unitId) drawerHistoryLoading.value = false })

  hospitalService.inventoryUnit(unitId)
    .then((response) => {
      if (drawerUnit.value?.unit_id !== unitId) return
      drawerTags.value = response?.tags ?? []
      // The fullest view of the bag, as it stands now.
      if (response?.unit) drawerUnit.value = response.unit
    })
    .catch(() => { if (drawerUnit.value?.unit_id === unitId) drawerTagsError.value = 'This bag\'s tags could not be loaded.' })
    .finally(() => { if (drawerUnit.value?.unit_id === unitId) drawerTagsLoading.value = false })
}

function closeDetails() {
  drawerUnit.value = null
}

function fromDrawer(action) {
  const row = drawerUnit.value
  closeDetails()
  if (row) startAction(action, row)
}

// --- All activity drawer ---
const activityDrawerOpen = ref(false)
const allActivity = ref([])
const allActivityPage = ref(0)
const allActivityLastPage = ref(1)
const allActivityLoading = ref(false)
const allActivityError = ref('')

async function loadAllActivity(page) {
  allActivityLoading.value = true
  allActivityError.value = ''
  try {
    const response = await hospitalService.inventoryActivity({ page, per_page: 20 })
    allActivity.value = page === 1 ? (response?.data ?? []) : [...allActivity.value, ...(response?.data ?? [])]
    allActivityPage.value = response?.current_page ?? page
    allActivityLastPage.value = response?.last_page ?? page
  } catch {
    allActivityError.value = 'Activity could not be loaded.'
  } finally {
    allActivityLoading.value = false
  }
}

function openActivityDrawer() {
  activityDrawerOpen.value = true
  loadAllActivity(1)
}

// --- Tag history drawer: the tags that ended ---
const tagHistoryOpen = ref(false)
const events = ref([])
const eventsPage = ref(0)
const eventsLastPage = ref(1)
const eventsLoading = ref(false)
const eventsError = ref('')
const eventFilters = reactive({ search: '', status: '' })

let eventsTicket = 0
async function loadEvents(page) {
  const ticket = ++eventsTicket
  eventsLoading.value = true
  eventsError.value = ''

  try {
    const response = await hospitalService.tagEvents({
      search: eventFilters.search.trim() || undefined,
      status: eventFilters.status || undefined,
      page,
      per_page: 20,
    })
    if (ticket !== eventsTicket) return

    events.value = page === 1 ? (response?.data ?? []) : [...events.value, ...(response?.data ?? [])]
    eventsPage.value = response?.current_page ?? page
    eventsLastPage.value = response?.last_page ?? page
  } catch (err) {
    if (ticket === eventsTicket) eventsError.value = err?.message || 'The tag history could not be loaded.'
  } finally {
    if (ticket === eventsTicket) eventsLoading.value = false
  }
}

function openTagHistory() {
  tagHistoryOpen.value = true
  loadEvents(1)
}

let eventsSearchTimer = null
watch(() => eventFilters.status, () => { if (tagHistoryOpen.value) loadEvents(1) })
watch(() => eventFilters.search, () => {
  clearTimeout(eventsSearchTimer)
  eventsSearchTimer = setTimeout(() => { if (tagHistoryOpen.value) loadEvents(1) }, 300)
})

function actorFor(event) {
  if (event.status === 'transfused') return event.actors?.transfused_by || '—'

  return event.untagged_by_system ? 'Automatic' : (event.actors?.untagged_by || 'Staff')
}

// --- Bag actions ---
const dialog = ref(null)
const dialogBusy = ref(false)
const dialogError = ref('')
const dialogFieldErrors = ref({})
const busyUnit = ref(null)

const confirmCopy = computed(() => {
  const value = dialog.value
  const patient = value?.unit?.active_tag?.patient?.full_name ?? 'the patient'

  switch (value?.kind) {
    case 'crossmatch':
      return {
        title: `Record the crossmatch for ${bagLabel(value.unit)}?`,
        body: `The bag leaves storage for ${patient}, and the transfusion must be recorded within 24 hours or the tag is released.`,
        action: 'Record crossmatch',
      }
    case 'transfuse':
      return {
        title: `Record the transfusion of ${bagLabel(value.unit)}?`,
        body: `The bag was transfused to ${patient}. It can never return to stock.`,
        action: 'Record transfusion',
      }
    case 'return':
      return {
        title: `Is ${bagLabel(value.unit)} back in storage?`,
        body: 'Confirm only once the bag is back in the blood bank\'s storage. It becomes available to tag again.',
        action: 'Confirm return',
      }
    default:
      return null
  }
})

function startAction(action, unit) {
  dialog.value = { kind: action, unit }
  dialogError.value = ''
  dialogFieldErrors.value = {}
}

function closeDialog() {
  dialog.value = null
  dialogError.value = ''
  dialogFieldErrors.value = {}
}

async function runTag(payload) {
  await perform((unit) => hospitalService.tagUnit(unit.unit_id, payload))
}

async function runRelease(reason) {
  await perform((unit) => hospitalService.releaseTag(unit.unit_id, reason))
}

async function runDiscard(reason) {
  await perform((unit) => hospitalService.discardUnit(unit.unit_id, reason))
}

async function runConfirm() {
  const calls = {
    crossmatch: (unit) => hospitalService.crossmatchUnit(unit.unit_id),
    transfuse: (unit) => hospitalService.transfuseUnit(unit.unit_id),
    return: (unit) => hospitalService.confirmUnitReturn(unit.unit_id),
  }

  await perform(calls[dialog.value.kind])
}

/**
 * Run one bag action from the open dialog, then reload what it changed.
 *
 * A 409 means the bag moved on since the list was drawn — tagged by somebody
 * else, a deadline passed — so the dialog closes, the reason is shown and the
 * list reloads. Validation errors stay in the dialog beside their fields.
 */
async function perform(call) {
  const unit = dialog.value?.unit

  if (!unit || !call) return

  dialogBusy.value = true
  busyUnit.value = unit.unit_id
  dialogError.value = ''
  dialogFieldErrors.value = {}

  try {
    const response = await call(unit)
    closeDialog()
    notice.value = response?.message || 'Updated.'
    await refresh({ quiet: true })
  } catch (err) {
    if (err?.status === 422) {
      dialogFieldErrors.value = err?.errors ?? {}
      dialogError.value = firstError(err) || 'Check the highlighted fields.'
    } else if (err?.status === 409 || err?.status === 404) {
      closeDialog()
      notice.value = refusalMessage(err)
      await refresh({ quiet: true })
    } else {
      dialogError.value = err?.message || 'That could not be done. Please try again.'
    }
  } finally {
    dialogBusy.value = false
    busyUnit.value = null
  }
}

/** Explain a refusal by its code, falling back to the API's own words. */
function refusalMessage(err) {
  const code = err?.data?.code

  return (code && code !== 'invalid_transition' && code !== 'unit_not_available' ? err?.data?.message : null)
    || UNIT_REFUSAL_MESSAGES[code]
    || err?.message
    || 'That could not be done.'
}

function firstError(err) {
  const first = Object.values(err?.errors ?? {})[0]

  return (Array.isArray(first) ? first[0] : first) || err?.message || ''
}

// --- Toast ---
const notice = ref('')
let noticeTimer = null
watch(notice, (message) => {
  clearTimeout(noticeTimer)
  if (message) noticeTimer = setTimeout(() => { notice.value = '' }, 6000)
})

// --- Formatting ---
/** The number staff see: the sender's own for an external bag. */
const bagLabel = (unit) => unit.bag_number || unit.unit_id

function sourceLabel(unit) {
  const delivery = unit.source?.direct_distribution
  if (delivery) {
    return [`Direct distribution from ${delivery.source_name || 'an outside blood service'}`, delivery.requested_for && `for ${delivery.requested_for}`]
      .filter(Boolean).join(' ')
  }
  if (unit.source?.reference_number) {
    return [`Request ${unit.source.reference_number}`, unit.source.transfusion_reference && `for ${unit.source.transfusion_reference}`]
      .filter(Boolean).join(' ')
  }
  return '—'
}

function displayType(code) {
  // A true minus sign, which reads as "minus" aloud and lines up with the plus.
  return code ? String(code).replace('-', '−') : '—'
}

function formatCount(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return Number(value).toLocaleString('en-US')
}

// Dates as the blood bank keeps them: its own calendar day, year first.
function formatDay(value) {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

function formatLongDate(value) {
  if (!value) return '—'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+08:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
}

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
  })
}

const lastUpdatedLabel = computed(() => (lastUpdated.value
  ? lastUpdated.value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  : ''))

// --- Refresh ---
async function refresh({ quiet = true } = {}) {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await Promise.all([loadSummary(), loadOverview(), loadUnits(unitsMeta.page, { quiet })])
    lastUpdated.value = new Date()
  } finally {
    refreshing.value = false
  }
}

// The server untags within a minute of the deadline; look again once it has.
let sweepTimer = null
watch(anyOverdue, (overdue) => {
  if (overdue && !sweepTimer) {
    sweepTimer = setTimeout(() => {
      sweepTimer = null
      refresh()
    }, SWEEP_GRACE_MS)
  }
})

// Kept current without a reload, as the thresholds grid is: once a minute, and
// only while the tab is in view. The countdowns tick on their own in between.
const POLL_MS = 60_000
let pollTimer = null
let ticker = null

onMounted(async () => {
  await loadReference()
  await Promise.all([loadSummary(), loadOverview(), loadUnits(1)])
  lastUpdated.value = new Date()
  loading.value = false

  ticker = setInterval(() => { now.value = Date.now() }, 30_000)
  pollTimer = setInterval(() => {
    if (!document.hidden) refresh()
  }, POLL_MS)
})

onBeforeUnmount(() => {
  clearInterval(pollTimer)
  clearInterval(ticker)
  clearTimeout(searchTimer)
  clearTimeout(eventsSearchTimer)
  clearTimeout(sweepTimer)
  clearTimeout(noticeTimer)
})
</script>

<style scoped>
/* The centre's Blood Inventory's look (project owner, 2026-10-28): a quiet,
   neutral page. Every container shares one surface and is set apart by a
   hairline border; hierarchy comes from three steps of grey ink. Colour is
   kept for state alone (green healthy, amber low, red critical), and only on
   dots, icons, badges and text, never on a card or a panel. Actions wear the
   app's blue.

   Both modes read the app's own tokens; dark mode lifts only the state
   colours and row dividers, on this page's root. Teleported drawers and
   dialogs carry the class too. The dark selector sits whole inside
   :global(): Vue compiles `:global(.dark) .x` to plain `.dark`, which would
   declare these tokens on <html> and repaint the whole app. */
.inv-tones {
  --inv-page: var(--rb-page-bg);
  --inv-surface: var(--rb-surface);
  --inv-elevated: var(--rb-surface-alt);
  --inv-hover: var(--rb-surface-hover);
  --inv-border: var(--rb-border-strong);
  --inv-border-soft: var(--rb-border);
  --inv-text: var(--rb-text-primary);
  --inv-muted: var(--rb-text-secondary);
  --inv-faint: var(--rb-text-muted);
  --inv-ok: #15803D;
  --inv-warn: #B45309;
  --inv-crit: #B91C1C;
  --inv-ok-fill: #1BAF7A;
  --inv-warn-fill: #EDA100;
  --inv-crit-fill: #DC2626;
  --inv-action: var(--rb-primary);
  --inv-action-hover: var(--rb-primary-hover);
  --inv-action-text: var(--rb-primary-text);
  --tone: var(--inv-muted);
  --tone-fill: var(--inv-faint);
}
:global(.dark .inv-tones) {
  /* Row dividers a step softer than the app's #334155 border, on #1E293B. */
  --inv-border-soft: var(--ink-hover, #263345);
  --inv-ok: #4ADE80;
  --inv-warn: #FBBF24;
  --inv-crit: #F87171;
  --inv-ok-fill: #199E70;
  --inv-warn-fill: #C98500;
  --inv-crit-fill: #EF4444;
  color-scheme: dark;
}
.tone--success { --tone: var(--inv-ok); --tone-fill: var(--inv-ok-fill); }
.tone--warning { --tone: var(--inv-warn); --tone-fill: var(--inv-warn-fill); }
.tone--danger { --tone: var(--inv-crit); --tone-fill: var(--inv-crit-fill); }
.tone--neutral { --tone: var(--inv-muted); --tone-fill: var(--inv-muted); }
.tone--muted { --tone: var(--inv-faint); --tone-fill: var(--inv-faint); }

/* The page keeps the app's shared column. Its background is carried past it
   to the content area's edges by a shadow, not clip-path: a clip would also
   clip the bag dialogs, which are fixed in place rather than teleported. */
.inv-page {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  background: var(--inv-page);
  box-shadow: 0 0 0 100vmax var(--inv-page);
  color: var(--inv-text);
  padding: 24px var(--rb-gutter, 24px) 40px;
}

/* The layout answers to the width the page is given, not the window's: the
   sidebar rail changes that width on its own. */
.inv-inner {
  display: flex; flex-direction: column; gap: 16px;
  container-type: inline-size; container-name: inv;
}

/* Skeleton */
.skeleton {
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 12px;
  animation: shimmer 1.4s ease infinite;
}
.skeleton--header { height: 44px; max-width: 340px; }
.skeleton--kpi { height: 88px; }
@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin-icon, .detail-drawer, .kpi { animation: none !important; transition: none !important; }
}

/* Focus: the action blue, on any surface. */
.inv-tones :is(button, a, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--inv-action-text); outline-offset: 2px;
}

/* Header */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.015em; color: var(--inv-text); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--inv-muted); margin: 4px 0 0; }
.page-head__meta { display: flex; align-items: center; gap: 12px; }
.live-note { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--inv-muted); }
.live-note__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--inv-ok-fill); box-shadow: 0 0 0 3px color-mix(in srgb, var(--inv-ok-fill) 22%, transparent); }

.spin-icon { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.load-error {
  display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 14px; border-radius: 10px;
  background: var(--inv-surface); border: 1px solid var(--inv-border); color: var(--inv-text); font-size: 13px;
}
.load-error :deep(svg) { color: var(--inv-crit); }
.load-error--warning :deep(svg) { color: var(--inv-warn); }
.load-error span { flex: 1; }

/* Buttons: one blue primary, the rest outlined. */
.btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; line-height: 1.2;
  color: #fff; background: var(--inv-action); border: 1px solid var(--inv-action);
  box-shadow: 0 1px 2px rgba(var(--rb-primary-rgb), 0.25);
  cursor: pointer; text-decoration: none; font-family: inherit; transition: background 0.15s ease, box-shadow 0.15s ease;
}
.btn-primary:hover:not(:disabled) { background: var(--inv-action-hover); border-color: var(--inv-action-hover); box-shadow: 0 4px 12px rgba(var(--rb-primary-rgb), 0.28); }
.btn-primary:active:not(:disabled) { transform: translateY(1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-outline {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; line-height: 1.2;
  color: var(--inv-text); background: var(--inv-surface); border: 1px solid var(--inv-border);
  cursor: pointer; font-family: inherit; white-space: nowrap; transition: background 0.15s ease, border-color 0.15s ease;
}
.btn-outline:hover:not(:disabled) { background: var(--inv-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline--sm { padding: 6px 11px; font-size: 12px; }
.btn-outline--danger { color: var(--inv-crit); border-color: color-mix(in srgb, var(--inv-crit) 35%, var(--inv-border)); }
.btn-outline--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--inv-crit) 8%, transparent); border-color: var(--inv-crit); }

.link-btn {
  display: inline-flex; align-items: center; gap: 4px; padding: 0; border: none; background: none;
  font: inherit; font-size: 12.5px; font-weight: 600; color: var(--inv-action-text); cursor: pointer; text-decoration: none;
}
.link-btn:hover { text-decoration: underline; text-underline-offset: 3px; }
.link-btn:focus-visible { border-radius: 4px; }

/* Summary cards: one surface, one shape. Only the icon takes a state colour. */
.kpi-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.kpi {
  position: relative; display: flex; align-items: center; gap: 14px; width: 100%; min-width: 0; min-height: 88px;
  padding: 16px 30px 16px 16px; border-radius: 12px; border: 1px solid var(--inv-border); background: var(--inv-surface);
  color: var(--inv-text); font: inherit; text-align: left; text-decoration: none;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.kpi--action { cursor: pointer; }
.kpi--action:hover { border-color: rgba(var(--rb-primary-rgb), 0.45); box-shadow: 0 4px 14px rgba(var(--rb-shadow-rgb, 15, 23, 42), 0.06); }
.kpi__icon {
  width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--tone-fill) 14%, transparent); color: var(--tone);
}
.kpi.tone--neutral .kpi__icon { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--inv-action-text); }
.kpi.tone--muted .kpi__icon { background: var(--inv-elevated); color: var(--inv-faint); }
.kpi__body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.kpi__label { font-size: 12.5px; font-weight: 500; color: var(--inv-muted); }
.kpi__value { font-size: 24px; font-weight: 650; line-height: 1.1; letter-spacing: -0.02em; color: var(--inv-text); font-variant-numeric: tabular-nums; }
.kpi__sub { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--inv-muted); }
.kpi__sub--up :deep(svg) { color: var(--inv-ok); }
.kpi__chevron { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--inv-faint); }
.kpi--action:hover .kpi__chevron { color: var(--inv-action-text); }

/* Main grid: the centre's two columns, stacking once the page narrows. */
.inv-grid {
  display: grid; gap: 16px; align-items: stretch;
  grid-template-columns: minmax(0, 1fr) 360px;
  grid-template-areas: "list expiring" "list activity";
}
.expiring-panel { grid-area: expiring; }
.list-panel { grid-area: list; }
.activity-panel { grid-area: activity; }

/* Panels */
.panel {
  position: relative; background: var(--inv-surface); border: 1px solid var(--inv-border); border-radius: 12px;
  min-width: 0; display: flex; flex-direction: column;
}
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px 12px; flex-wrap: wrap; }
.panel-title { font-size: 15px; font-weight: 600; color: var(--inv-text); margin: 0; }
.panel-subtitle { font-size: 12.5px; color: var(--inv-muted); margin: 3px 0 0; }

/* Badge: a tint of the state, the neutral ones left grey. */
.badge {
  display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  border: 1px solid color-mix(in srgb, var(--tone-fill) 30%, transparent); background: color-mix(in srgb, var(--tone-fill) 10%, transparent);
  font-size: 11.5px; font-weight: 500; line-height: 1.5; color: var(--inv-text);
}
.badge.tone--neutral, .badge.tone--muted, .badge:not([class*="tone--"]) { border-color: var(--inv-border); background: var(--inv-elevated); }
.badge__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--tone-fill); flex-shrink: 0; }

/* Side panels */
.side-panel { overflow: hidden; }
.side-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--inv-border); }
.side-title { display: flex; align-items: center; gap: 9px; margin: 0; font-size: 15px; font-weight: 600; color: var(--inv-text); }
.side-title__icon {
  width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;
  background: var(--inv-elevated); border: 1px solid var(--inv-border); color: var(--inv-muted);
}
.side-empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px; margin: 0; padding: 36px 18px;
  font-size: 12.5px; color: var(--inv-muted); text-align: center;
}

.mini-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.mini-table th {
  text-align: left; font-size: 11.5px; font-weight: 500; color: var(--inv-muted); padding: 9px 8px;
  border-bottom: 1px solid var(--inv-border); white-space: nowrap;
}
.mini-table th:first-child, .mini-table td:first-child { padding-left: 16px; }
.mini-table td { padding: 11px 8px; border-bottom: 1px solid var(--inv-border-soft); color: var(--inv-text); vertical-align: middle; }
.mini-table tr:last-child td { border-bottom: none; }
.mini-row { cursor: pointer; transition: background 0.12s ease; }
.mini-row:hover { background: var(--inv-hover); }
.mini-row:focus-visible { outline-offset: -2px; }
.mini-row__id { display: block; font-size: 11.5px; margin-bottom: 4px; white-space: nowrap; }
.mini-row__chevron { width: 24px; color: var(--inv-faint); }

.type-chip {
  display: inline-flex; padding: 0 6px; border-radius: 4px; border: 1px solid var(--inv-border);
  font-size: 11px; font-weight: 600; line-height: 1.6; color: var(--inv-text);
}
.type-text { font-weight: 600; color: var(--inv-text); white-space: nowrap; }
.type-chip--cell { min-width: 32px; justify-content: center; padding: 1px 7px; border-radius: 6px; background: var(--inv-elevated); font-size: 12px; }

/* Activity */
.activity-list { list-style: none; margin: 0; padding: 0; }
.activity-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--inv-border-soft); }
.activity-item:first-child { border-top: none; }
.activity-item__icon {
  width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--tone-fill) 12%, transparent); color: var(--tone);
}
.activity-item__icon.tone--neutral { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--inv-action-text); }
.activity-item__icon--sm { width: 26px; height: 26px; border-radius: 7px; }
.activity-item__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.activity-item__title { font-size: 13px; font-weight: 500; color: var(--inv-text); }
.activity-item__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 11.5px; color: var(--inv-muted); }
.activity-item__note { font-size: 11.5px; color: var(--inv-muted); }
.activity-item__when { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; font-size: 11px; color: var(--inv-muted); text-align: right; }
.activity-item__when span { max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Inventory list */
.list-filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; padding: 0 18px 14px; }
.search-field { position: relative; flex: 1 1 220px; min-width: 200px; }
.search-field__icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--inv-muted); pointer-events: none; }
.search-field__input {
  width: 100%; height: 36px; padding: 0 12px 0 34px; border-radius: 8px; border: 1px solid var(--inv-border);
  background: var(--inv-elevated); color: var(--inv-text); font: inherit; font-size: 12.5px; transition: border-color 0.15s ease;
}
.search-field__input::placeholder { color: var(--inv-muted); }
.search-field__input:focus { outline: none; border-color: var(--inv-action); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.12); }
.filter-field { display: flex; flex-direction: column; gap: 4px; flex: 0 1 140px; min-width: 120px; }
.filter-field__label { font-size: 11.5px; font-weight: 500; color: var(--inv-muted); }
.clear-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border: none; border-radius: 8px;
  background: none; color: var(--inv-action-text); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.clear-btn:hover:not(:disabled) { background: rgba(var(--rb-primary-rgb), 0.08); }
.clear-btn:disabled { color: var(--inv-faint); font-weight: 500; cursor: default; }

.list-error { margin: 0 18px 12px; font-size: 12.5px; color: var(--inv-crit); }

.table-wrap { position: relative; overflow-x: auto; flex: 1; transition: opacity 0.15s ease; }
.table-wrap--busy { opacity: 0.55; }
.unit-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.unit-table thead th {
  text-align: left; font-size: 11.5px; font-weight: 500; color: var(--inv-muted); padding: 9px 8px;
  border-top: 1px solid var(--inv-border); border-bottom: 1px solid var(--inv-border); white-space: nowrap;
}
.unit-table th:first-child, .unit-table td:first-child { padding-left: 18px; }
.unit-table tbody td { padding: 10px 8px; border-bottom: 1px solid var(--inv-border-soft); color: var(--inv-text); white-space: nowrap; vertical-align: middle; }
.unit-table .wrap-cell { white-space: normal; min-width: 120px; }
.unit-row { cursor: pointer; transition: background 0.12s ease; }
.unit-row:hover { background: var(--inv-hover); }
.unit-row:focus-visible { outline-offset: -2px; }
/* A tag near its deadline is marked along the row's edge; the countdown says it in words. */
.row--critical td:first-child { box-shadow: inset 3px 0 0 var(--inv-crit-fill); }
.row--soon td:first-child { box-shadow: inset 3px 0 0 var(--inv-warn-fill); }
.actions-col { width: 44px; text-align: right; }
.mono { font-family: var(--rb-font-mono); font-size: 11.5px; }
.num { font-variant-numeric: tabular-nums; }
.cell-sub { display: block; margin-top: 3px; font-size: 11.5px; color: var(--inv-muted); }
.cell-muted { color: var(--inv-muted) !important; }
.ink-danger { color: var(--inv-crit) !important; }
.days { font-variant-numeric: tabular-nums; color: var(--tone); }
.days.tone--warning, .days.tone--danger { font-weight: 600; }
.days.tone--neutral { color: var(--inv-text); }
.days--pill { display: inline-flex; padding: 1px 9px; border-radius: 999px; background: color-mix(in srgb, var(--tone-fill) 14%, transparent); }

.status-cell { min-width: 150px; }
.patient { display: block; margin: 5px 0 4px; font-size: 12px; white-space: normal; }
.countdown {
  display: inline-flex; align-items: center; gap: 5px; padding: 1px 9px; border-radius: 999px; white-space: nowrap;
  font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums;
  color: var(--tone); background: color-mix(in srgb, var(--tone-fill) 14%, transparent);
}
.countdown.tone--neutral { color: var(--inv-text); background: var(--inv-elevated); }

.th-sort {
  display: inline-flex; align-items: center; gap: 3px; padding: 0; border: 0; background: none;
  font: inherit; color: inherit; cursor: pointer;
}
.th-sort:hover { color: var(--inv-text); }
.th-sort--on { color: var(--inv-action-text); }
.th-sort:focus-visible { border-radius: 4px; }

/* Row action menu */
.row-menu { position: relative; display: inline-flex; }
.row-menu__trigger {
  width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: var(--inv-muted);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.row-menu__trigger:hover { background: var(--inv-elevated); color: var(--inv-text); }
.row-menu__dropdown {
  position: absolute; top: 34px; right: 0; z-index: 20; min-width: 200px; padding: 6px; display: flex; flex-direction: column; gap: 1px;
  background: var(--inv-elevated); border: 1px solid var(--inv-border); border-radius: 10px; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
}
.row-menu__dropdown--up { top: auto; bottom: 34px; }
.row-menu__item {
  display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 6px; border: none; background: transparent;
  color: var(--inv-text); font: inherit; font-size: 12.5px; text-align: left; cursor: pointer; white-space: nowrap;
}
.row-menu__item:hover:not(:disabled), .row-menu__item:focus-visible { background: var(--inv-hover); outline: none; }
.row-menu__item:disabled { opacity: 0.45; cursor: not-allowed; }
.row-menu__item--danger { color: var(--inv-crit); }
.row-menu__divider { height: 1px; background: var(--inv-border); margin: 4px 2px; }

.list-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 18px; }
.list-foot__summary { margin: 0; font-size: 12px; color: var(--inv-muted); }
.pager { display: flex; align-items: center; gap: 6px; }
.pager__btn {
  min-width: 30px; height: 30px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--inv-border);
  background: var(--inv-surface); color: var(--inv-text); font: inherit; font-size: 12px; font-weight: 500;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-variant-numeric: tabular-nums;
}
.pager__btn:hover:not(:disabled) { background: var(--inv-hover); }
.pager__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pager__btn--on, .pager__btn--on:hover:not(:disabled) { background: var(--inv-action); border-color: var(--inv-action); color: #fff; }
.pager__gap { font-size: 12px; color: var(--inv-muted); padding: 0 2px; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 24px; text-align: center;
  font-size: 13px; color: var(--inv-muted);
}
.empty-state__title { font-size: 14px; font-weight: 600; color: var(--inv-text); margin: 4px 0 0; }
.empty-state__desc { font-size: 12.5px; margin: 0 0 6px; max-width: 52ch; }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* The threshold banner keeps its structure; its tinted chips become neutral
   ones with the state in the dot, as everywhere else here. */
.inv-page :deep(.low-banner),
.inv-page :deep(.low-banner--critical) { background: var(--inv-surface); border-color: var(--inv-border); border-radius: 12px; }
.inv-page :deep(.low-banner__icon) { background: var(--inv-elevated); border: 1px solid var(--inv-border); color: var(--inv-warn); }
.inv-page :deep(.low-banner--critical .low-banner__icon) { color: var(--inv-crit); }
.inv-page :deep(.low-banner__title) { font-weight: 600; color: var(--inv-text); }
.inv-page :deep(.low-banner__chip) {
  display: inline-flex; align-items: center; gap: 6px; background: var(--inv-elevated); border: 1px solid var(--inv-border);
  color: var(--inv-text); font-weight: 500;
}
.inv-page :deep(.low-banner__chip::before) { content: ''; width: 6px; height: 6px; border-radius: 999px; background: var(--inv-warn-fill); }
.inv-page :deep(.low-banner__chip--critical::before) { background: var(--inv-crit-fill); }
.inv-page :deep(.low-banner__chip--more) { color: var(--inv-muted); }
.inv-page :deep(.low-banner__chip--more::before) { display: none; }
.inv-page :deep(.low-banner__link) { color: var(--inv-action-text); font-weight: 600; }

/* Drawers */
.drawer-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; justify-content: flex-end; background: rgba(0, 0, 0, 0.5); }
.detail-drawer {
  width: clamp(400px, 32vw, 500px); max-width: 100%; height: 100%; display: flex; flex-direction: column;
  background: var(--inv-surface); border-left: 1px solid var(--inv-border); box-shadow: -16px 0 40px rgba(0, 0, 0, 0.3);
  animation: drawer-slide-in 0.25s ease; font-family: var(--rb-font-sans); color: var(--inv-text);
}
@keyframes drawer-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
.detail-drawer__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 22px; border-bottom: 1px solid var(--inv-border); }
.detail-drawer__eyebrow { font-family: var(--rb-font-mono); font-size: 11.5px; color: var(--inv-muted); margin: 0 0 3px; }
.detail-drawer__title { font-size: 16px; font-weight: 600; color: var(--inv-text); margin: 0; }
.detail-drawer__body { flex: 1; overflow-y: auto; padding: 20px 22px; display: flex; flex-direction: column; gap: 22px; }
.detail-drawer__body--flush { padding: 0; gap: 0; }
.detail-drawer__footer { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px 22px; border-top: 1px solid var(--inv-border); }
.detail-drawer__footer .btn-outline { flex: 1 1 30%; }
.drawer-filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; padding: 14px 22px; border-bottom: 1px solid var(--inv-border); }
.drawer-section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--inv-muted); margin: 0 0 10px; }
.drawer-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 12px; margin: 0; }
.drawer-info-grid dt { font-size: 11.5px; color: var(--inv-muted); margin-bottom: 3px; }
.drawer-info-grid dd { font-size: 13px; font-weight: 500; color: var(--inv-text); margin: 0; }
.drawer-info-grid__wide { grid-column: 1 / -1; }
.drawer-note { display: block; margin-top: 3px; font-size: 11.5px; font-weight: 400; color: var(--inv-muted); }
.drawer-muted { font-size: 12.5px; color: var(--inv-muted); margin: 0; }
.drawer-muted--pad { padding: 20px 22px; }
.drawer-more { display: flex; justify-content: center; padding: 14px; border-top: 1px solid var(--inv-border); }
.history-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.history-list__item { display: flex; align-items: flex-start; gap: 10px; }
.history-list__body { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--inv-muted); }
.history-list__body strong { font-size: 13px; font-weight: 500; color: var(--inv-text); }
.drawer-fade-enter-active, .drawer-fade-leave-active { transition: opacity 0.2s ease; }
.drawer-fade-enter-from, .drawer-fade-leave-to { opacity: 0; }

/* Confirm dialog */
.modal-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0, 0, 0, 0.5); }
.modal-card {
  position: relative; width: 100%; max-width: 440px; padding: 24px; border-radius: 12px; background: var(--inv-surface);
  border: 1px solid var(--inv-border); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3); font-family: var(--rb-font-sans); color: var(--inv-text);
}
.modal-close {
  position: absolute; top: 16px; right: 16px; width: 28px; height: 28px; border-radius: 8px; border: none; background: transparent;
  color: var(--inv-muted); display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.detail-drawer__header .modal-close { position: static; flex-shrink: 0; }
.modal-close:hover { background: var(--inv-hover); color: var(--inv-text); }
.modal-title { font-size: 16px; font-weight: 600; color: var(--inv-text); margin: 4px 32px 6px 0; }
.modal-subtitle { font-size: 12.5px; line-height: 1.55; color: var(--inv-muted); margin: 0 0 18px; }
.modal-actions { display: flex; gap: 10px; margin-top: 4px; }
.modal-actions__btn { flex: 1; }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.form-error { font-size: 12px; color: var(--inv-crit); margin: -6px 0 12px; }

.inventory-toast {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 1100;
  display: flex; align-items: center; gap: 0.55rem; max-width: min(46rem, calc(100vw - 32px)); padding: 0.7rem 0.9rem;
  border-radius: 10px; border: 1px solid var(--inv-border); background: var(--inv-elevated); color: var(--inv-text);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28); font-family: var(--rb-font-sans); font-size: 13px;
}
.inventory-toast__close { border: 0; background: none; color: var(--inv-muted); cursor: pointer; display: inline-flex; padding: 0.15rem; }

/* Responsive: by the width the page actually has. */
@container inv (max-width: 1240px) {
  .kpi { padding-left: 14px; gap: 12px; }
  .inv-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas: "list list" "expiring activity";
  }
}
@container inv (max-width: 1040px) {
  .kpi-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .kpi-row > :first-child { grid-column: span 2; }
}
@container inv (max-width: 760px) {
  .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .inv-grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "list" "expiring" "activity"; }
}
@container inv (max-width: 440px) {
  .kpi-row { grid-template-columns: minmax(0, 1fr); }
  .kpi-row > :first-child { grid-column: auto; }
}

@media (max-width: 640px) {
  .inv-page { padding: 16px 16px 32px; }
  .filter-field { flex: 1 1 calc(50% - 5px); }
  .detail-drawer { width: 100%; }
  .detail-drawer__footer .btn-outline { flex: 1 1 100%; }
}
</style>
