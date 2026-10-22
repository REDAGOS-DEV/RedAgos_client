<template>
  <div class="inv-page inv-tones">
    <!-- Skeleton loading state -->
    <div v-if="loading" class="inv-inner" aria-busy="true">
      <div class="skeleton skeleton--header" />
      <div class="kpi-row">
        <div v-for="n in 5" :key="n" class="skeleton skeleton--kpi" />
      </div>
      <div class="inv-grid">
        <div class="skeleton skeleton--panel" style="grid-area: types; height: 380px" />
        <div class="skeleton skeleton--panel" style="grid-area: expiring; height: 380px" />
        <div class="skeleton skeleton--panel" style="grid-area: list; height: 520px" />
        <div class="skeleton skeleton--panel" style="grid-area: activity; height: 520px" />
      </div>
    </div>

    <div v-else class="inv-inner">
      <!-- ============ HEADER ============ -->
      <header class="page-head">
        <div>
          <h1 class="page-title">Blood Inventory</h1>
          <p class="page-subtitle">Monitor and manage {{ facilityLabel }}'s blood units in real time.</p>
        </div>
        <div class="page-head__meta">
          <span v-if="lastUpdatedLabel" class="live-note">
            <span class="live-note__dot" aria-hidden="true" />
            Updated {{ lastUpdatedLabel }}
          </span>
          <button type="button" class="btn-outline btn-outline--sm" :disabled="refreshing" @click="refreshAll()">
            <AssetIcon name="refresh-cw" :size="13" :class="{ 'spin-icon': refreshing }" />
            Refresh
          </button>
        </div>
      </header>

      <p v-if="loadError" class="load-error" role="alert">
        <AssetIcon name="circle-alert" :size="15" />
        <span>{{ loadError }}</span>
        <button type="button" class="link-btn" @click="refreshAll()">Try again</button>
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
      <LowStockBanner :cells="lowStock" to="/blood-center/stock-thresholds" />

      <div class="inv-grid">
        <!-- ============ BLOOD TYPE AVAILABILITY ============ -->
        <section class="panel types-panel" aria-labelledby="types-title">
          <header class="panel-head">
            <div>
              <h2 id="types-title" class="panel-title">Blood Type Availability</h2>
              <p class="panel-subtitle">
                Issuable units by component. Each ring shows how much of the type's critical level is on the shelf.
              </p>
            </div>
            <ul class="legend" aria-label="Legend">
              <li class="tone--success"><span class="legend__dot" />Healthy</li>
              <li class="tone--warning"><span class="legend__dot" />Low Stock</li>
              <li class="tone--danger"><span class="legend__dot" />Critical</li>
              <li><span class="rare-chip">Rare</span>Rh-negative</li>
            </ul>
          </header>

          <p v-if="!anyMinimumSet" class="types-hint">
            <AssetIcon name="info" :size="14" />
            <span>No critical level is set yet, so no type is graded.</span>
            <NuxtLink to="/blood-center/stock-thresholds" class="link-btn">Set levels</NuxtLink>
          </p>

          <div class="type-grid">
            <button
              v-for="card in typeCards"
              :key="card.code"
              type="button"
              class="type-card"
              :class="[`tone--${levelTone(card.level)}`, { 'type-card--active': filters.bloodTypeId === card.id }]"
              :aria-pressed="filters.bloodTypeId === card.id"
              :aria-label="typeCardLabel(card)"
              @click="toggleTypeFilter(card)"
            >
              <span class="type-card__head">
                <span class="type-card__code">{{ displayType(card.code) }}</span>
                <span v-if="card.rare" class="rare-chip">Rare</span>
              </span>

              <span class="type-card__body">
                <span class="type-card__summary">
                  <span class="gauge" :title="ringTitle(card)">
                    <svg viewBox="0 0 64 64" class="gauge__svg" aria-hidden="true">
                      <circle class="gauge__track" :class="{ 'gauge__track--none': card.coverage === null }" cx="32" cy="32" r="26" />
                      <circle
                        v-if="card.coverage"
                        class="gauge__fill"
                        cx="32"
                        cy="32"
                        r="26"
                        :stroke-dasharray="ringDash(card.coverage)"
                      />
                    </svg>
                    <span class="gauge__value">{{ card.coverage === null ? '—' : `${card.coverage}%` }}</span>
                  </span>
                  <span class="type-card__units"><strong>{{ formatCount(card.total) }}</strong> unit{{ card.total === 1 ? '' : 's' }}</span>
                  <span class="badge">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ levelLabel(card.level) }}
                  </span>
                </span>

                <span class="type-card__components">
                  <span
                    v-for="comp in card.components"
                    :key="comp.id"
                    class="comp"
                    :class="{ 'comp--short': comp.status === 'low' || comp.status === 'critical', [`tone--${levelTone(comp.status)}`]: true }"
                    :title="componentTitle(comp)"
                  >
                    <span class="comp__dot" aria-hidden="true" />
                    <span class="comp__code">{{ comp.code }}</span>
                    <span class="comp__count">{{ formatCount(comp.available) }}</span>
                  </span>
                </span>
              </span>
            </button>
          </div>
        </section>

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
            Nothing expires in the next 7 days.
          </p>
          <table v-else class="mini-table">
            <thead>
              <tr>
                <th>Unit ID / Blood Type</th>
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
                :aria-label="`${row.id}, ${row.blood_type} ${row.component}, ${daysLeftLabel(row.days_remaining)}. Open details`"
                @click="openDetails(row)"
                @keydown.enter.self="openDetails(row)"
              >
                <td>
                  <span class="mini-row__id mono">{{ row.id }}</span>
                  <span class="type-chip">{{ displayType(row.blood_type) }}</span>
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
              <p class="panel-subtitle">Scan and manage blood units.</p>
            </div>
            <NuxtLink v-if="canRegisterUnits" to="/blood-center/inventory-intake" class="btn-primary">
              <AssetIcon name="plus" :size="15" />
              Register Blood Unit
            </NuxtLink>
          </header>

          <div class="list-filters">
            <label class="search-field">
              <AssetIcon name="search" :size="15" class="search-field__icon" />
              <input
                v-model="filters.search"
                type="search"
                class="search-field__input"
                placeholder="Search by unit ID or location…"
                aria-label="Search by unit ID or storage location"
                @keydown.enter.prevent="loadUnits(1)"
              />
            </label>

            <label class="filter-field">
              <span class="filter-field__label">Blood Type</span>
              <select v-model="filters.bloodTypeId" class="filter-select">
                <option value="">All</option>
                <option v-for="t in bloodTypeOptions" :key="t.id" :value="t.id">{{ displayType(t.code) }}</option>
              </select>
            </label>

            <label class="filter-field">
              <span class="filter-field__label">Component</span>
              <select v-model="filters.componentId" class="filter-select">
                <option value="">All</option>
                <option v-for="c in componentOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </label>

            <label class="filter-field">
              <span class="filter-field__label">Expiry Risk</span>
              <select v-model="filters.expiryRisk" class="filter-select" @change="onExpiryRiskChange">
                <option value="">All</option>
                <option value="3">Within 3 days</option>
                <option value="7">Within 7 days</option>
                <option value="expired">Expired</option>
              </select>
            </label>

            <label class="filter-field">
              <span class="filter-field__label">Status</span>
              <select v-model="filters.status" class="filter-select" @change="onStatusChange">
                <option value="">All</option>
                <option v-for="st in statusOptions" :key="st.value" :value="st.value">{{ st.label }}</option>
              </select>
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
                  <th>Unit ID</th>
                  <th>Blood Type</th>
                  <th>Component</th>
                  <th :aria-sort="filters.sort === 'recent' ? 'descending' : 'none'">
                    <button type="button" class="th-sort" :class="{ 'th-sort--on': filters.sort === 'recent' }" @click="filters.sort = 'recent'">
                      Collection Date
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
                  <th>Availability</th>
                  <th class="actions-col"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, index) in unitRows"
                  :key="row.id"
                  class="unit-row"
                 
                  tabindex="0"
                  :aria-label="`${row.id}, ${row.blood_type} ${row.component}, ${row.tag.label}. Open details`"
                  @click="openDetails(row)"
                  @keydown.enter.self="openDetails(row)"
                >
                  <td class="mono">{{ row.id }}</td>
                  <td><span class="type-text">{{ displayType(row.blood_type) }}</span></td>
                  <td class="wrap-cell">{{ row.component }}</td>
                  <td class="num">{{ formatDay(row.collected_at) }}</td>
                  <td class="num" :class="{ 'ink-danger': row.remaining.label === 'Expired' }">{{ row.expiry_date || '—' }}</td>
                  <td>
                    <span class="days" :class="`tone--${row.remaining.tone}`">{{ row.remaining.label }}</span>
                  </td>
                  <td class="wrap-cell" :class="{ 'cell-muted': !row.storage_location }">{{ row.storage_location || 'Not set' }}</td>
                  <td><span class="badge" :class="`tone--${row.tag.tone}`"><span class="badge__dot" aria-hidden="true" />{{ row.tag.label }}</span></td>
                  <td>
                    <span class="avail" :class="`tone--${row.availability.tone}`">
                      <span class="avail__dot" aria-hidden="true" />
                      {{ row.availability.label }}
                    </span>
                  </td>
                  <td class="actions-col" @click.stop>
                    <div class="row-menu" @focusout="onRowMenuFocusOut">
                      <button
                        type="button"
                        class="row-menu__trigger"
                        :aria-label="`Actions for unit ${row.id}`"
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
                        <!-- The head edits a unit directly. Everyone else files a correction, and only the roles the server admits are offered it. -->
                        <button v-if="canEditUnit && isEditable(row)" type="button" role="menuitem" class="row-menu__item" @click="rowAction('edit', row)">
                          <AssetIcon name="pencil" :size="13" /> Edit unit
                        </button>
                        <button v-else-if="canRequestUnitCorrection && isEditable(row)" type="button" role="menuitem" class="row-menu__item" @click="rowAction('edit', row)">
                          <AssetIcon name="pencil" :size="13" /> Request correction
                        </button>
                        <template v-if="canDiscardUnits && isDiscardable(row)">
                          <div class="row-menu__divider" />
                          <button type="button" role="menuitem" class="row-menu__item row-menu__item--danger" @click="rowAction('discard', row)">
                            <AssetIcon name="trash-2" :size="13" /> Discard
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
              <p class="empty-state__title">{{ hasActiveFilters ? 'No units match these filters' : 'No units in stock yet' }}</p>
              <p class="empty-state__desc">
                {{ hasActiveFilters ? 'Clear a filter to see more.' : 'Units appear here once they are booked in at Stock Intake.' }}
              </p>
              <button v-if="hasActiveFilters" type="button" class="btn-outline btn-outline--sm" @click="clearFilters">Clear filters</button>
            </div>
          </div>

          <footer v-if="unitsMeta.total" class="list-foot">
            <p class="list-foot__summary">
              Showing {{ formatCount(unitsMeta.from) }}–{{ formatCount(unitsMeta.to) }} of {{ formatCount(unitsMeta.total) }} unit{{ unitsMeta.total === 1 ? '' : 's' }}
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
            No stock has moved yet.
          </p>
          <ol v-else class="activity-list">
            <li v-for="item in activity" :key="item.id" class="activity-item">
              <span class="activity-item__icon" :class="`tone--${activityKindMeta(item.kind).tone}`" aria-hidden="true">
                <AssetIcon :name="activityKindMeta(item.kind).icon" :size="16" />
              </span>
              <span class="activity-item__body">
                <span class="activity-item__title">{{ activityKindMeta(item.kind).label }}</span>
                <span class="activity-item__meta">
                  <span class="mono">{{ item.unit_id }}</span>
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

    <!-- ============ UNIT DETAILS DRAWER ============ -->
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
                <p class="detail-drawer__eyebrow">{{ drawerUnit.id }}</p>
                <h2 id="unit-drawer-title" class="detail-drawer__title">
                  {{ displayType(drawerUnit.blood_type) }} &middot; {{ drawerUnit.component }}
                </h2>
              </div>
              <button type="button" class="modal-close" aria-label="Close" @click="closeDetails">
                <AssetIcon name="x" :size="16" />
              </button>
            </header>

            <div class="detail-drawer__body">
              <section>
                <p class="drawer-section-title">Unit</p>
                <dl class="drawer-info-grid">
                  <div><dt>Blood Type</dt><dd>{{ displayType(drawerUnit.blood_type) }}</dd></div>
                  <div><dt>Component</dt><dd>{{ drawerUnit.component }}</dd></div>
                  <div><dt>Volume</dt><dd>{{ drawerUnit.volume_ml ? `${drawerUnit.volume_ml} mL` : '—' }}</dd></div>
                  <div>
                    <dt>Status</dt>
                    <dd><span class="badge" :class="`tone--${drawerTag.tone}`"><span class="badge__dot" aria-hidden="true" />{{ drawerTag.label }}</span></dd>
                  </div>
                  <div><dt>Collection Date</dt><dd>{{ formatLongDate(drawerUnit.collected_at) }}</dd></div>
                  <div>
                    <dt>Expiry Date</dt>
                    <dd>
                      {{ formatLongDate(drawerUnit.expiry_date) }}
                      <span class="drawer-note">{{ drawerRemaining }}</span>
                    </dd>
                  </div>
                  <div><dt>Storage Location</dt><dd>{{ drawerUnit.storage_location || 'Not set' }}</dd></div>
                  <div><dt>Donation</dt><dd>{{ drawerUnit.donation_id ? `#${drawerUnit.donation_id}` : '—' }}</dd></div>
                  <div><dt>Booked In</dt><dd>{{ formatDateTime(drawerUnit.recorded_at) || '—' }}</dd></div>
                  <div v-if="drawerUnit.discard_reason" class="drawer-info-grid__wide"><dt>Discard Reason</dt><dd>{{ drawerUnit.discard_reason }}</dd></div>
                </dl>
              </section>

              <section>
                <p class="drawer-section-title">Movement History</p>
                <p v-if="drawerHistoryLoading" class="drawer-muted">Loading…</p>
                <p v-else-if="drawerHistoryError" class="drawer-muted">{{ drawerHistoryError }}</p>
                <p v-else-if="!drawerHistory.length" class="drawer-muted">No recorded movement yet.</p>
                <ol v-else class="history-list">
                  <li v-for="item in drawerHistory" :key="item.id" class="history-list__item">
                    <span class="activity-item__icon activity-item__icon--sm" :class="`tone--${activityKindMeta(item.kind).tone}`" aria-hidden="true">
                      <AssetIcon :name="activityKindMeta(item.kind).icon" :size="13" />
                    </span>
                    <span class="history-list__body">
                      <strong>{{ activityKindMeta(item.kind).label }}</strong>
                      <span>{{ formatDateTime(item.at) }} &middot; {{ item.actor || 'System' }}</span>
                    </span>
                  </li>
                </ol>
              </section>
            </div>

            <footer v-if="drawerActions" class="detail-drawer__footer">
              <button v-if="canChangeUnit && isEditable(drawerUnit)" type="button" class="btn-outline" @click="fromDrawer('edit')">
                <AssetIcon name="pencil" :size="14" /> {{ canEditUnit ? 'Edit Unit' : 'Request Correction' }}
              </button>
              <button v-if="canDiscardUnits && isDiscardable(drawerUnit)" type="button" class="btn-outline btn-outline--danger" @click="fromDrawer('discard')">
                <AssetIcon name="trash-2" :size="14" /> Discard
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
              <p v-else-if="!allActivity.length && !allActivityLoading" class="drawer-muted drawer-muted--pad">No stock has moved yet.</p>
              <ol class="activity-list">
                <li v-for="item in allActivity" :key="item.id" class="activity-item">
                  <span class="activity-item__icon" :class="`tone--${activityKindMeta(item.kind).tone}`" aria-hidden="true">
                    <AssetIcon :name="activityKindMeta(item.kind).icon" :size="16" />
                  </span>
                  <span class="activity-item__body">
                    <span class="activity-item__title">{{ activityKindMeta(item.kind).label }}</span>
                    <span class="activity-item__meta">
                      <span class="mono">{{ item.unit_id }}</span>
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

    <!-- ============ EDIT UNIT MODAL ============ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="batchModalOpen" class="modal-overlay inv-tones" @click.self="closeBatchModal">
          <div class="modal-card modal-card--wide" role="dialog" aria-modal="true" aria-labelledby="edit-unit-title" v-focus-trap @dialog-escape="closeBatchModal">
            <button type="button" class="modal-close" aria-label="Close" @click="closeBatchModal">
              <AssetIcon name="x" :size="16" />
            </button>

            <h3 id="edit-unit-title" class="modal-title">
              {{ canEditUnit ? 'Edit unit' : 'Request a correction to unit' }} {{ editingBatchId }}
            </h3>
            <p class="modal-subtitle">
              Only where a unit is kept and when it expires can be changed. Its blood type, component and
              donation are facts about the donation it came from, so they are fixed here.
              <template v-if="!canEditUnit">
                Your change goes to the Inventory Control Officer to approve.
              </template>
            </p>

            <form class="batch-form" @submit.prevent="submitBatchForm">
              <div class="form-row">
                <label class="form-field">
                  <span class="form-field__label">Storage Location</span>
                  <select v-model="batchForm.storageLocation" class="form-field__input form-field__select">
                    <option value="">Not recorded</option>
                    <option v-for="loc in storageLocationOptions" :key="loc" :value="loc">{{ loc }}</option>
                  </select>
                </label>
                <label class="form-field">
                  <span class="form-field__label">Expiry Date</span>
                  <input v-model="batchForm.expiryDate" type="date" class="form-field__input" />
                </label>
              </div>

              <p v-if="batchFormError" class="form-error">{{ batchFormError }}</p>

              <div class="modal-actions">
                <button type="submit" class="btn-primary modal-actions__btn" :disabled="batchSubmitting">
                  <AssetIcon name="circle-check-big" :size="15" />
                  {{ batchSubmitting ? 'Saving…' : (canEditUnit ? 'Save Changes' : 'Review correction') }}
                </button>
                <button type="button" class="btn-outline modal-actions__btn" :disabled="batchSubmitting" @click="closeBatchModal">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ============ DISCARD MODAL ============ -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="discardTarget" class="modal-overlay inv-tones" @click.self="closeDiscard">
          <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="discard-title" v-focus-trap @dialog-escape="closeDiscard">
            <button type="button" class="modal-close" aria-label="Close" @click="closeDiscard">
              <AssetIcon name="x" :size="16" />
            </button>
            <h3 id="discard-title" class="modal-title">Discard unit {{ discardTarget.id }}</h3>
            <p class="modal-subtitle">
              {{ displayType(discardTarget.blood_type) }} {{ discardTarget.component }}. A discarded unit leaves stock for good;
              the reason is kept in the audit trail.
            </p>
            <form class="batch-form" @submit.prevent="submitDiscard">
              <label class="form-field">
                <span class="form-field__label">Reason</span>
                <textarea
                  v-model="discardReason"
                  class="form-field__input form-field__textarea"
                  maxlength="255"
                  rows="3"
                  placeholder="For example: bag leaking, haemolysed, past expiry"
                  required
                />
              </label>
              <p v-if="discardError" class="form-error">{{ discardError }}</p>
              <div class="modal-actions">
                <button type="submit" class="btn-danger modal-actions__btn" :disabled="discardSubmitting || !discardReason.trim()">
                  <AssetIcon name="trash-2" :size="15" />
                  {{ discardSubmitting ? 'Discarding…' : 'Discard unit' }}
                </button>
                <button type="button" class="btn-outline modal-actions__btn" :disabled="discardSubmitting" @click="closeDiscard">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Says what an action did, or why it did nothing. -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="notice" class="inventory-toast" role="status">
          <AssetIcon name="circle-alert" :size="15" />
          <span>{{ notice }}</span>
          <button type="button" class="inventory-toast__close" aria-label="Dismiss" @click="notice = ''">
            <AssetIcon name="x" :size="13" />
          </button>
        </div>
      </Transition>
    </Teleport>

    <BloodCenterCorrectionRequestDialog
      v-if="unitCorrection"
      subject="unit_details"
      :target-id="unitCorrection.unitId"
      :changes="unitCorrection.changes"
      :previous="unitCorrection.previous"
      @close="closeUnitCorrection"
      @submitted="onUnitCorrectionSent"
    />

  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import BloodCenterCorrectionRequestDialog from '~/components/BloodCenter/CorrectionRequestDialog.vue'
import LowStockBanner from '~/components/common/LowStockBanner.vue'
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount, resolveComponent } from 'vue'
import { useUser } from '~/composables/useUser'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { typeHealthByCode } from '~/utils/stockThreshold'
import {
  activityKindMeta,
  daysLeftLabel,
  isRareBloodType,
  orderDashboardTypes,
  pageWindow,
  remainingDaysTag,
  timeAgo,
  typeCoverage,
  unitAvailability,
  unitStatusTag,
} from '~/utils/inventoryDashboard'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'inventory.view',
})

const NuxtLinkComponent = resolveComponent('NuxtLink')

const { user, can, canFile } = useUser()

// Every number on this page is the signed-in account's own centre: the server
// resolves the facility from the session, never from anything sent from here.
const facilityLabel = computed(() => user.value?.facility?.facility_name || user.value?.facility_name || 'your blood center')

// A unit is edited directly only by whoever holds inventory.update (the
// Inventory Control Officer). The IT Data Entry Clerk files a correction
// instead, and a custom role in the same department is offered neither: it
// holds the ability but not the post, and the server refuses it.
const canEditUnit = computed(() => can('inventory.update'))
const canRequestUnitCorrection = computed(() => !canEditUnit.value && can('corrections.request') && canFile('unit_details'))
const canChangeUnit = computed(() => canEditUnit.value || canRequestUnitCorrection.value)
// Booking stock in is Issuance's. Final labels are Processing's (2026-10-22).
const canRegisterUnits = computed(() => can('inventory.create'))
const canDiscardUnits = computed(() => can('inventory.discard'))
const canSeeFulfillment = computed(() => can('requests.release'))

const loading = ref(true)
const loadError = ref('')
const refreshing = ref(false)
const lastUpdated = ref(null)
const now = ref(Date.now())

// --- Reference data ---
const bloodTypeOptions = ref([])
const componentOptions = ref([])
const statusOptions = ref([])
const storageLocationOptions = ref([])

// --- Overview: summary, minimums, expiring units, activity ---
const summary = ref(null)
const thresholds = ref(null)
// The facility's minimums against its stock. Supplementary: the page works
// without them, so a failed load just leaves the cards ungraded.
const stockCells = ref([])
const lowStock = ref([])
const expiringUnits = ref([])
const expiringError = ref('')
const activity = ref([])
const activityError = ref('')

function toRow(unit) {
  return {
    id: unit.id,
    blood_type: unit.blood_type?.code ?? null,
    component: unit.component?.name ?? null,
    volume_ml: unit.volume_ml ?? null,
    status: unit.status,
    expiry_date: unit.expiry_date,
    days_remaining: unit.days_remaining,
    storage_location: unit.storage_location,
    donation_id: unit.donation_id,
    collected_at: unit.collected_at ?? null,
    recorded_at: unit.recorded_at ?? null,
    discard_reason: unit.discard_reason ?? null,
  }
}

async function loadReference() {
  try {
    const reference = await bloodCenterService.referenceData()
    // Blood types arrive as {id, code, label} and components as {id, name, …};
    // the selects filter by id, which is what the server listing takes.
    bloodTypeOptions.value = orderDashboardTypes(reference?.blood_types ?? [])
    componentOptions.value = reference?.components ?? []
    statusOptions.value = reference?.statuses ?? []
    storageLocationOptions.value = reference?.storage_locations ?? []
  } catch (err) {
    console.error('Failed to load inventory reference data:', err)
  }
}

async function loadOverview() {
  const [summaryData, thresholdData, expiring, recent] = await Promise.all([
    bloodCenterService.inventorySummary().catch((err) => {
      console.error('Failed to load the inventory summary:', err)
      return null
    }),
    bloodCenterService.stockThresholds().catch(() => null),
    bloodCenterService.inventory({ expiring_within_days: 7, per_page: 6 }).catch(() => null),
    bloodCenterService.inventoryActivity({ per_page: 6 }).catch(() => null),
  ])

  loadError.value = summaryData ? '' : 'The inventory summary could not be loaded. The figures below may be out of date.'
  if (summaryData) {
    summary.value = summaryData
    if (summaryData.storage_locations?.length) storageLocationOptions.value = summaryData.storage_locations
  }

  thresholds.value = thresholdData
  stockCells.value = thresholdData?.cells ?? []
  lowStock.value = thresholdData?.low ?? []

  expiringError.value = expiring ? '' : 'Units close to expiry could not be loaded.'
  if (expiring) expiringUnits.value = (expiring.data ?? []).map(toRow)

  activityError.value = recent ? '' : 'Recent activity could not be loaded.'
  if (recent) activity.value = recent.data ?? []

  lastUpdated.value = new Date()
}

// --- KPI row ---
const availableTotal = computed(() => {
  // Counted from the same issuable cells as the cards below, so the headline
  // and the cards always add up. The summary's count is the fallback.
  if (stockCells.value.length) return stockCells.value.reduce((sum, cell) => sum + cell.available, 0)
  return summary.value?.totals?.available ?? null
})

const anyMinimumSet = computed(() => stockCells.value.some((cell) => cell.minimum_units !== null))
const typesBelowMinimum = computed(() => typeCards.value.filter((card) => card.level === 'low' || card.level === 'critical').length)

const kpis = computed(() => {
  const added = summary.value?.released_last_7_days ?? 0

  return [
    {
      key: 'available',
      label: 'Total Available Units',
      value: formatCount(availableTotal.value),
      sub: added > 0 ? `+${formatCount(added)} added in 7 days` : 'None added in 7 days',
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
      to: '/blood-center/stock-thresholds',
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
      key: 'reserved',
      label: 'Reserved for Requests',
      value: formatCount(summary.value?.totals?.reserved),
      sub: 'units',
      icon: 'clipboard-list',
      tone: 'neutral',
      onClick: () => showStatusInList('reserved'),
    },
    {
      key: 'issued',
      label: 'Issued Today',
      value: formatCount(summary.value?.issued_today),
      sub: 'units',
      icon: 'send',
      tone: 'neutral',
      ...(canSeeFulfillment.value ? { to: '/blood-center/fulfillment' } : {}),
    },
  ]
})

// --- Blood type availability ---
const typeCards = computed(() => {
  const types = orderDashboardTypes(thresholds.value?.blood_types ?? bloodTypeOptions.value)
  // Catalogue order, Whole Blood first, rather than the server's by-name order.
  const components = [...(thresholds.value?.components ?? [])].sort((a, b) => a.id - b.id)
  const summaryByCode = new Map((summary.value?.by_blood_type ?? []).map((row) => [row.code, row.available]))

  return types.map(({ id, code }) => {
    const own = stockCells.value.filter((cell) => cell.blood_type_id === id)
    // "Low" is the facility's own judgement: a type is graded against the
    // minimums staff set on the Stock Thresholds page, and the worst monitored
    // component decides. A type with no minimum set is not graded.
    const level = typeHealthByCode(stockCells.value, code)

    return {
      id,
      code,
      rare: isRareBloodType(code),
      level,
      coverage: typeCoverage(stockCells.value, id),
      total: own.length ? own.reduce((sum, cell) => sum + cell.available, 0) : Number(summaryByCode.get(code)) || 0,
      components: components.map((component) => {
        const cell = own.find((c) => c.component_id === component.id)
        return {
          id: component.id,
          code: component.code,
          name: component.name,
          available: cell?.available ?? 0,
          minimum: cell?.minimum_units ?? null,
          status: cell?.status ?? 'unmonitored',
        }
      }),
    }
  })
})

const LEVELS = {
  ok: { label: 'Good Stock', tone: 'success' },
  low: { label: 'Low Stock', tone: 'warning' },
  critical: { label: 'Critical Low', tone: 'danger' },
  unmonitored: { label: 'No level set', tone: 'muted' },
}
const levelLabel = (level) => LEVELS[level]?.label ?? level
const levelTone = (level) => LEVELS[level]?.tone ?? 'muted'

const RING_CIRCUMFERENCE = 2 * Math.PI * 26
function ringDash(coverage) {
  const filled = (Math.min(100, Math.max(0, coverage)) / 100) * RING_CIRCUMFERENCE
  return `${filled.toFixed(2)} ${RING_CIRCUMFERENCE.toFixed(2)}`
}

function ringTitle(card) {
  return card.coverage === null
    ? `No critical level is set for ${card.code}.`
    : `${card.coverage}% of ${card.code}'s critical level is on the shelf.`
}

function componentTitle(comp) {
  return comp.minimum === null
    ? `${comp.name}: ${comp.available} issuable, no critical level set`
    : `${comp.name}: ${comp.available} issuable, critical level ${comp.minimum}`
}

function typeCardLabel(card) {
  const coverage = card.coverage === null ? 'no critical level set' : `${card.coverage}% of critical level on the shelf`
  const filtered = filters.bloodTypeId === card.id
  return `${card.code}${card.rare ? ', rare' : ''}: ${card.total} issuable unit${card.total === 1 ? '' : 's'}, ${levelLabel(card.level)}, ${coverage}. ${filtered ? 'Showing only this type below; press to show all.' : 'Press to show only this type below.'}`
}

function toggleTypeFilter(card) {
  filters.bloodTypeId = filters.bloodTypeId === card.id ? '' : card.id
}

// --- Inventory list (server-paginated) ---
const PAGE_SIZE = 8
const listSection = ref(null)
const units = ref([])
const unitsLoading = ref(false)
const unitsError = ref('')
const unitsMeta = reactive({ page: 1, lastPage: 1, total: 0, from: 0, to: 0 })

const filters = reactive({
  search: '',
  bloodTypeId: '',
  componentId: '',
  expiryRisk: '',
  status: '',
  // Newest bags first: every status is listed, and in FEFO order the list
  // would open on units that left long ago.
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
  // "expiring within" lists available units only, and "expired" is a status.
  if (filters.expiryRisk === 'expired') params.status = 'expired'
  else if (filters.expiryRisk) params.expiring_within_days = Number(filters.expiryRisk)
  else if (filters.status) params.status = filters.status

  return params
}

let unitsTicket = 0
async function loadUnits(page = unitsMeta.page, { quiet = false } = {}) {
  const ticket = ++unitsTicket
  if (!quiet) unitsLoading.value = true

  try {
    const response = await bloodCenterService.inventory(unitParams(page))
    if (ticket !== unitsTicket) return

    const lastPage = response?.last_page ?? 1

    // A refresh can find the page gone (units discarded, a filter narrowed).
    if (!response?.data?.length && page > 1 && lastPage < page) {
      await loadUnits(lastPage, { quiet })
      return
    }

    units.value = (response?.data ?? []).map(toRow)
    unitsMeta.page = response?.current_page ?? page
    unitsMeta.lastPage = lastPage
    unitsMeta.total = response?.total ?? units.value.length
    unitsMeta.from = response?.from ?? 0
    unitsMeta.to = response?.to ?? 0
    unitsError.value = ''
  } catch (err) {
    if (ticket !== unitsTicket) return
    console.error('Failed to load blood units:', err)
    unitsError.value = err?.data?.message || 'The units could not be loaded.'
  } finally {
    if (ticket === unitsTicket) unitsLoading.value = false
  }
}

const unitRows = computed(() =>
  units.value.map((row) => ({
    ...row,
    tag: unitStatusTag(row.status, row.days_remaining),
    availability: unitAvailability(row.status),
    remaining: remainingDaysTag(row.status, row.days_remaining),
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

// --- What can be done to a unit ---
const isEditable = (row) => !['issued', 'discarded'].includes(row?.status)
// A unit held for a request is given up through Request Fulfillment, not here.
const isDiscardable = (row) => ['available', 'expired', 'quarantined'].includes(row?.status)

// --- Row action menu ---
const openMenuId = ref(null)
function onRowMenuFocusOut(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) openMenuId.value = null
}

function rowAction(action, row) {
  openMenuId.value = null
  if (action === 'view') openDetails(row)
  else if (action === 'edit') openEditBatchModal(row)
  else if (action === 'discard') openDiscard(row)
}

// --- Unit details drawer ---
const drawerUnit = ref(null)
const drawerHistory = ref([])
const drawerHistoryLoading = ref(false)
const drawerHistoryError = ref('')

const drawerTag = computed(() => (drawerUnit.value ? unitStatusTag(drawerUnit.value.status, drawerUnit.value.days_remaining) : null))
const drawerRemaining = computed(() => {
  const unit = drawerUnit.value
  if (!unit || unit.days_remaining === null || unit.days_remaining === undefined) return ''
  if (['issued', 'discarded'].includes(unit.status)) return ''
  const d = unit.days_remaining
  if (d < 0) return `Expired ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago`
  if (d === 0) return 'Expires today'
  return `${d} day${d === 1 ? '' : 's'} remaining`
})
const drawerActions = computed(() => {
  const unit = drawerUnit.value
  if (!unit) return false
  return (canChangeUnit.value && isEditable(unit))
    || (canDiscardUnits.value && isDiscardable(unit))
})

async function openDetails(row) {
  openMenuId.value = null
  drawerUnit.value = row
  drawerHistory.value = []
  drawerHistoryError.value = ''
  drawerHistoryLoading.value = true

  try {
    const response = await bloodCenterService.inventoryActivity({ unit_id: row.id, per_page: 50 })
    if (drawerUnit.value?.id === row.id) drawerHistory.value = response?.data ?? []
  } catch (err) {
    console.error('Failed to load unit history:', err)
    if (drawerUnit.value?.id === row.id) drawerHistoryError.value = 'This unit\'s history could not be loaded.'
  } finally {
    if (drawerUnit.value?.id === row.id) drawerHistoryLoading.value = false
  }
}

function closeDetails() {
  drawerUnit.value = null
}

function fromDrawer(action) {
  const row = drawerUnit.value
  closeDetails()
  if (row) rowAction(action, row)
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
    const response = await bloodCenterService.inventoryActivity({ page, per_page: 20 })
    allActivity.value = page === 1 ? (response?.data ?? []) : [...allActivity.value, ...(response?.data ?? [])]
    allActivityPage.value = response?.current_page ?? page
    allActivityLastPage.value = response?.last_page ?? page
  } catch (err) {
    console.error('Failed to load inventory activity:', err)
    allActivityError.value = 'Activity could not be loaded.'
  } finally {
    allActivityLoading.value = false
  }
}

function openActivityDrawer() {
  activityDrawerOpen.value = true
  loadAllActivity(1)
}

// --- Edit unit modal ---
const batchModalOpen = ref(false)
const batchSubmitting = ref(false)
const batchFormError = ref('')
const editingBatchId = ref(null)
const editingUnit = ref(null)
const batchForm = reactive({ storageLocation: '', expiryDate: '' })

// There is deliberately no "add" counterpart. Stock is created by booking a
// cleared donation in at /blood-center/inventory-intake, because every unit has
// to point back at the donation it came from — a free-standing batch cannot.
function openEditBatchModal(row) {
  Object.assign(batchForm, {
    expiryDate: row.expiry_date || '',
    storageLocation: row.storage_location || '',
  })
  editingBatchId.value = row.id
  editingUnit.value = row
  batchFormError.value = ''
  batchModalOpen.value = true
}

function closeBatchModal() {
  if (batchSubmitting.value) return
  batchModalOpen.value = false
}

const unitCorrection = ref(null)

function onUnitCorrectionSent(response) {
  unitCorrection.value = null
  notice.value = response?.message ?? 'Correction requested.'
}

// The edit modal sits above the dialog, so it steps aside while the dialog is
// open and comes back, with what was typed, if the request is cancelled.
function closeUnitCorrection() {
  unitCorrection.value = null
  batchModalOpen.value = true
}

/**
 * What the form changes on the unit, and nothing else.
 *
 * An expired unit takes a new expiry date and nothing more — the server refuses
 * a storage location on it — so sending the untouched location along with a
 * date change used to make every edit of an expired unit fail.
 */
function changedUnitFields(row) {
  const changes = {}

  if (batchForm.expiryDate && batchForm.expiryDate !== (row.expiry_date || '')) {
    changes.expiry_date = batchForm.expiryDate
  }

  if (row.status !== 'expired' && (batchForm.storageLocation || null) !== (row.storage_location || null)) {
    changes.storage_location = batchForm.storageLocation || null
  }

  return changes
}

async function submitBatchForm() {
  if (!editingBatchId.value) return

  const row = editingUnit.value
  const changes = row ? changedUnitFields(row) : {}

  if (!Object.keys(changes).length) {
    batchFormError.value = 'Nothing has changed yet.'
    return
  }

  // Anyone but the head files a correction: the change is reviewed in the
  // dialog and applied only once it is approved.
  if (!canEditUnit.value) {
    batchFormError.value = ''
    unitCorrection.value = {
      unitId: editingBatchId.value,
      changes,
      previous: { storage_location: row.storage_location || null, expiry_date: row.expiry_date || null },
    }
    batchModalOpen.value = false
    return
  }

  batchSubmitting.value = true
  batchFormError.value = ''
  try {
    await bloodCenterService.updateBloodUnit(editingBatchId.value, changes)
    batchModalOpen.value = false
    notice.value = `Unit ${editingBatchId.value} updated.`
    await refreshAll({ quiet: true })
  } catch (err) {
    console.error('Failed to update blood unit:', err)
    batchFormError.value = err?.data?.message || 'Something went wrong while saving. Please try again.'
  } finally {
    batchSubmitting.value = false
  }
}

// --- Discard ---
const discardTarget = ref(null)
const discardReason = ref('')
const discardSubmitting = ref(false)
const discardError = ref('')

function openDiscard(row) {
  discardTarget.value = row
  discardReason.value = ''
  discardError.value = ''
}

function closeDiscard() {
  if (discardSubmitting.value) return
  discardTarget.value = null
}

async function submitDiscard() {
  const row = discardTarget.value
  const reason = discardReason.value.trim()
  if (!row || !reason) return

  discardSubmitting.value = true
  discardError.value = ''
  try {
    await bloodCenterService.discardBloodUnit(row.id, { reason })
    discardSubmitting.value = false
    discardTarget.value = null
    notice.value = `Unit ${row.id} discarded.`
    await refreshAll({ quiet: true })
  } catch (err) {
    console.error('Failed to discard blood unit:', err)
    discardError.value = err?.data?.message || 'The unit could not be discarded.'
  } finally {
    discardSubmitting.value = false
  }
}

// --- Toast ---
const notice = ref('')
let noticeTimer = null
watch(notice, (message) => {
  clearTimeout(noticeTimer)
  if (message) noticeTimer = setTimeout(() => { notice.value = '' }, 6000)
})

// --- Formatting ---
function displayType(code) {
  // A true minus sign, which reads as "minus" aloud and lines up with the plus.
  return code ? String(code).replace('-', '−') : '—'
}

function formatCount(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return Number(value).toLocaleString('en-US')
}

// Dates as the centre keeps them: its own calendar day, year first.
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
async function refreshAll({ quiet = false } = {}) {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await Promise.all([loadOverview(), loadUnits(unitsMeta.page, { quiet })])
  } finally {
    refreshing.value = false
  }
}

// Kept current without a reload, as the thresholds grid is: once a minute, and
// only while the tab is in view.
const POLL_MS = 60_000
let pollTimer = null

onMounted(async () => {
  await loadReference()
  await Promise.all([loadOverview(), loadUnits(1)])
  loading.value = false

  pollTimer = setInterval(() => {
    now.value = Date.now()
    if (!document.hidden) refreshAll({ quiet: true })
  }, POLL_MS)
})

onBeforeUnmount(() => {
  clearInterval(pollTimer)
  clearTimeout(searchTimer)
  clearTimeout(noticeTimer)
})
</script>

<style scoped>
/* A quiet, neutral page. Every container shares one surface and is set apart
   by a hairline border; hierarchy comes from three steps of grey ink. Colour
   is kept for state alone (green healthy, amber low, red critical), and only
   on dots, icons, badges and text, never on a card or a panel.

   Both modes read the app's own tokens, so dark mode has the sidebar's navy
   surfaces (project owner, 2026-10-19; the page had a charcoal palette of
   its own), and the child it hosts (the threshold banner) follows without
   being edited. Dark mode lifts only the page's
   state colours and row dividers, on this page's root.
   Teleported dialogs carry the class too. The dark selector sits whole
   inside :global(): Vue compiles `:global(.dark) .x` to plain `.dark`, which
   would declare these tokens on <html> and repaint the whole app. */
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
  --tone: var(--inv-muted);
}
:global(.dark .inv-tones) {
  /* Row dividers a step softer than the app's #334155 border, on #1E293B. */
  --inv-border-soft: #263345;
  --inv-ok: #4ADE80;
  --inv-warn: #FBBF24;
  --inv-crit: #F87171;
  color-scheme: dark;
}
.tone--success { --tone: var(--inv-ok); }
.tone--warning { --tone: var(--inv-warn); }
.tone--danger { --tone: var(--inv-crit); }
.tone--neutral { --tone: var(--inv-muted); }
.tone--muted { --tone: var(--inv-faint); }

/* The page keeps the app's shared column. Its background is carried past it
   to the content area's edges, so a wide screen shows no strip beside it. A
   shadow, not clip-path: a clip would also clip the correction dialog, which
   is fixed in place rather than teleported, and stack it under the header. */
.inv-page {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  background: var(--inv-page);
  box-shadow: 0 0 0 100vmax var(--inv-page);
  color: var(--inv-text);
  padding: 24px var(--rb-gutter, 24px) 40px;
  transition: background-color 0.2s ease;
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
  .skeleton, .spin-icon, .detail-drawer, .gauge__fill, .kpi, .type-card { animation: none !important; transition: none !important; }
}

/* Focus: the strongest ink, on any surface. */
.inv-tones :is(button, a, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--inv-text); outline-offset: 2px;
}

/* Header */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.015em; color: var(--inv-text); margin: 0; }
.page-subtitle { font-size: 13px; color: var(--inv-muted); margin: 4px 0 0; }
.page-head__meta { display: flex; align-items: center; gap: 12px; }
.live-note { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--inv-muted); }
.live-note__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--inv-ok); }

.spin-icon { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.load-error {
  display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 14px; border-radius: 10px;
  background: var(--inv-surface); border: 1px solid var(--inv-border); color: var(--inv-text); font-size: 13px;
}
.load-error :deep(svg) { color: var(--inv-crit); }
.load-error span { flex: 1; }

/* Buttons: one inverted primary, the rest outlined. */
.btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; line-height: 1.2;
  color: var(--inv-surface); background: var(--inv-text); border: 1px solid var(--inv-text);
  cursor: pointer; text-decoration: none; font-family: inherit; transition: opacity 0.15s ease;
}
.btn-primary:hover:not(:disabled) { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-outline, .btn-danger {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; line-height: 1.2;
  color: var(--inv-text); background: var(--inv-surface); border: 1px solid var(--inv-border);
  cursor: pointer; font-family: inherit; transition: background 0.15s ease, border-color 0.15s ease;
}
.btn-outline:hover:not(:disabled), .btn-danger:hover:not(:disabled) { background: var(--inv-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled, .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline--sm { padding: 6px 11px; font-size: 12px; }
.btn-outline--danger, .btn-danger { color: var(--inv-crit); }

.link-btn {
  display: inline-flex; align-items: center; gap: 4px; padding: 0; border: none; background: none;
  font: inherit; font-size: 12.5px; font-weight: 500; color: var(--inv-muted); cursor: pointer; text-decoration: none;
}
.link-btn:hover { color: var(--inv-text); text-decoration: underline; text-underline-offset: 3px; }
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
.kpi--action:hover { border-color: var(--rb-border-hover); background: var(--inv-hover); }
.kpi__icon {
  width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: var(--inv-elevated); border: 1px solid var(--inv-border); color: var(--tone);
}
.kpi__body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.kpi__label { font-size: 12.5px; font-weight: 500; color: var(--inv-muted); }
.kpi__value { font-size: 24px; font-weight: 650; line-height: 1.1; letter-spacing: -0.02em; color: var(--inv-text); font-variant-numeric: tabular-nums; }
.kpi__sub { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--inv-muted); }
.kpi__sub--up :deep(svg) { color: var(--inv-ok); }
.kpi__chevron { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--inv-faint); }
.kpi--action:hover .kpi__chevron { color: var(--inv-muted); }

/* Main grid: the mock-up's two columns, stacking once the page narrows. */
.inv-grid {
  display: grid; gap: 16px; align-items: stretch;
  grid-template-columns: minmax(0, 1fr) 360px;
  grid-template-areas: "types expiring" "list activity";
}
.types-panel { grid-area: types; }
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

/* Legend */
.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin: 2px 0 0; padding: 0; list-style: none; }
.legend li { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--inv-muted); }
.legend__dot { width: 7px; height: 7px; border-radius: 999px; background: var(--tone); }

.types-hint {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 18px 10px; padding: 9px 12px; border-radius: 8px;
  border: 1px dashed var(--inv-border); font-size: 12.5px; color: var(--inv-muted);
}

.rare-chip {
  font-size: 9.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; line-height: 1;
  padding: 3px 5px; border-radius: 4px; border: 1px solid var(--inv-border); color: var(--inv-muted);
}

/* Blood type cards */
.types-panel { container-type: inline-size; container-name: types; }
.type-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 4px 18px 18px; }
.type-card {
  display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 12px 14px 14px; border-radius: 10px;
  border: 1px solid var(--inv-border); background: var(--inv-surface);
  color: var(--inv-text); font: inherit; text-align: left; cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.type-card:hover { border-color: var(--rb-border-hover); background: var(--inv-hover); }
.type-card--active { border-color: var(--inv-muted); box-shadow: inset 0 0 0 1px var(--inv-muted); }
.type-card__head { display: flex; align-items: center; gap: 8px; }
.type-card__code { font-size: 17px; font-weight: 700; color: var(--inv-text); }
.type-card__body { display: flex; gap: 12px; align-items: flex-start; }
.type-card__summary { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; flex-shrink: 0; }
.type-card__units { font-size: 12px; color: var(--inv-muted); white-space: nowrap; }
.type-card__units strong { font-size: 13px; font-weight: 600; color: var(--inv-text); font-variant-numeric: tabular-nums; }

/* The ring is a meter (named gauge: Tailwind's `ring` utility owns .ring).
   Its fill is the one coloured mark on the card, over a neutral track. */
.gauge { position: relative; width: 62px; height: 62px; display: inline-flex; }
.gauge__svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.gauge__track { fill: none; stroke: var(--inv-border); stroke-width: 6; }
.gauge__fill { fill: none; stroke: var(--tone); stroke-width: 6; stroke-linecap: round; transition: stroke-dasharray 0.4s ease; }
.gauge__value {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 12.5px; font-weight: 600; color: var(--inv-text); font-variant-numeric: tabular-nums;
}

/* Badge: neutral chip, state in the dot. */
.badge {
  display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  border: 1px solid var(--inv-border); background: var(--inv-elevated);
  font-size: 11.5px; font-weight: 500; line-height: 1.5; color: var(--inv-text);
}
.badge__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--tone); flex-shrink: 0; }

.type-card__components { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; padding-top: 2px; }
.comp { display: grid; grid-template-columns: 6px minmax(0, 1fr) auto; align-items: center; gap: 7px; font-size: 11.5px; line-height: 1.35; }
.comp__dot { width: 4px; height: 4px; border-radius: 999px; background: var(--inv-border); }
.comp--short .comp__dot { width: 6px; height: 6px; background: var(--tone); }
.comp__code { color: var(--inv-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.comp__count { color: var(--inv-text); font-variant-numeric: tabular-nums; text-align: right; }
.comp--short .comp__count { font-weight: 600; color: var(--tone); }

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

/* Activity */
.activity-list { list-style: none; margin: 0; padding: 0; }
.activity-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--inv-border-soft); }
.activity-item:first-child { border-top: none; }
.activity-item__icon {
  width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: var(--inv-elevated); border: 1px solid var(--inv-border); color: var(--tone);
}
.activity-item__icon--sm { width: 26px; height: 26px; border-radius: 7px; }
.activity-item__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.activity-item__title { font-size: 13px; font-weight: 500; color: var(--inv-text); }
.activity-item__meta { display: flex; flex-wrap: wrap; gap: 4px 8px; font-size: 11.5px; color: var(--inv-muted); }
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
.search-field__input:focus { outline: none; border-color: var(--inv-muted); }
.filter-field { display: flex; flex-direction: column; gap: 4px; flex: 0 1 140px; min-width: 120px; }
.filter-field__label { font-size: 11.5px; font-weight: 500; color: var(--inv-muted); }
.filter-select {
  width: 100%; height: 36px; padding: 0 30px 0 12px; border-radius: 8px; border: 1px solid var(--inv-border);
  background: var(--inv-elevated) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239ca3af' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E") no-repeat right 12px center;
  color: var(--inv-text); appearance: none; font: inherit; font-size: 12.5px; cursor: pointer; transition: border-color 0.15s ease;
}
.filter-select:focus { outline: none; border-color: var(--inv-muted); }
.clear-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border: none; border-radius: 8px;
  background: none; color: var(--inv-text); font: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; white-space: nowrap;
}
.clear-btn:hover:not(:disabled) { background: var(--inv-hover); }
.clear-btn:disabled { color: var(--inv-faint); cursor: default; }

.list-error { margin: 0 18px 12px; font-size: 12.5px; color: var(--inv-crit); }

.table-wrap { position: relative; overflow-x: auto; flex: 1; transition: opacity 0.15s ease; }
.table-wrap--busy { opacity: 0.55; }
.unit-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.unit-table thead th {
  text-align: left; font-size: 11.5px; font-weight: 500; color: var(--inv-muted); padding: 9px 8px;
  border-top: 1px solid var(--inv-border); border-bottom: 1px solid var(--inv-border); white-space: nowrap;
}
.unit-table tbody td { padding: 10px 8px; border-bottom: 1px solid var(--inv-border-soft); color: var(--inv-text); white-space: nowrap; vertical-align: middle; }
.unit-table .wrap-cell { white-space: normal; min-width: 120px; }
.unit-row { cursor: pointer; transition: background 0.12s ease; }
.unit-row:hover { background: var(--inv-hover); }
.unit-row:focus-visible { outline-offset: -2px; }
.actions-col { width: 44px; text-align: right; }
.mono { font-family: var(--rb-font-mono); font-size: 11.5px; }
.num { font-variant-numeric: tabular-nums; }
.cell-muted { color: var(--inv-muted) !important; }
.ink-danger { color: var(--inv-crit) !important; }
.days { font-variant-numeric: tabular-nums; color: var(--tone); }
.days.tone--warning, .days.tone--danger { font-weight: 600; }
.days.tone--neutral { color: var(--inv-text); }

.th-sort {
  display: inline-flex; align-items: center; gap: 3px; padding: 0; border: 0; background: none;
  font: inherit; color: inherit; cursor: pointer;
}
.th-sort:hover, .th-sort--on { color: var(--inv-text); }
.th-sort:focus-visible { border-radius: 4px; }

.avail { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--inv-text); white-space: nowrap; }
.avail__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--tone); flex-shrink: 0; }

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
.row-menu__item:hover, .row-menu__item:focus-visible { background: var(--inv-hover); outline: none; }
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
.pager__btn--on, .pager__btn--on:hover:not(:disabled) { background: var(--inv-text); border-color: var(--inv-text); color: var(--inv-surface); }
.pager__gap { font-size: 12px; color: var(--inv-muted); padding: 0 2px; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 24px; text-align: center;
  font-size: 13px; color: var(--inv-muted);
}
.empty-state__title { font-size: 14px; font-weight: 600; color: var(--inv-text); margin: 4px 0 0; }
.empty-state__desc { font-size: 12.5px; margin: 0 0 6px; }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* The two children this page hosts keep their structure; their tinted chips
   become neutral ones with the state in the ink, as everywhere else here. */
.inv-page :deep(.low-banner),
.inv-page :deep(.low-banner--critical) { background: var(--inv-surface); border-color: var(--inv-border); border-radius: 12px; }
.inv-page :deep(.low-banner__icon) { background: var(--inv-elevated); border: 1px solid var(--inv-border); color: var(--inv-warn); }
.inv-page :deep(.low-banner--critical .low-banner__icon) { color: var(--inv-crit); }
.inv-page :deep(.low-banner__title) { font-weight: 600; color: var(--inv-text); }
.inv-page :deep(.low-banner__chip) {
  display: inline-flex; align-items: center; gap: 6px; background: var(--inv-elevated); border: 1px solid var(--inv-border);
  color: var(--inv-text); font-weight: 500;
}
.inv-page :deep(.low-banner__chip::before) { content: ''; width: 6px; height: 6px; border-radius: 999px; background: var(--inv-warn); }
.inv-page :deep(.low-banner__chip--critical::before) { background: var(--inv-crit); }
.inv-page :deep(.low-banner__chip--more) { color: var(--inv-muted); }
.inv-page :deep(.low-banner__chip--more::before) { display: none; }
.inv-page :deep(.low-banner__link) { color: var(--inv-text); font-weight: 500; }

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
.drawer-section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--inv-muted); margin: 0 0 10px; }
.drawer-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 12px; margin: 0; }
.drawer-info-grid dt { font-size: 11.5px; color: var(--inv-muted); margin-bottom: 3px; }
.drawer-info-grid dd { font-size: 13px; font-weight: 500; color: var(--inv-text); margin: 0; }
.drawer-info-grid__wide { grid-column: 1 / -1; }
.drawer-note { display: block; font-size: 11.5px; font-weight: 400; color: var(--inv-muted); }
.drawer-muted { font-size: 12.5px; color: var(--inv-muted); margin: 0; }
.drawer-muted--pad { padding: 20px 22px; }
.drawer-more { display: flex; justify-content: center; padding: 14px; border-top: 1px solid var(--inv-border); }
.history-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.history-list__item { display: flex; align-items: flex-start; gap: 10px; }
.history-list__body { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--inv-muted); }
.history-list__body strong { font-size: 13px; font-weight: 500; color: var(--inv-text); }
.drawer-fade-enter-active, .drawer-fade-leave-active { transition: opacity 0.2s ease; }
.drawer-fade-enter-from, .drawer-fade-leave-to { opacity: 0; }

/* Modals */
.modal-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(0, 0, 0, 0.5); }
.modal-card {
  position: relative; width: 100%; max-width: 420px; padding: 24px; border-radius: 12px; background: var(--inv-surface);
  border: 1px solid var(--inv-border); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3); font-family: var(--rb-font-sans); color: var(--inv-text);
}
.modal-card--wide { max-width: 560px; }
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

.batch-form { display: flex; flex-direction: column; gap: 14px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field__label { font-size: 12px; font-weight: 500; color: var(--inv-muted); }
.form-field__input {
  padding: 9px 12px; border-radius: 8px; border: 1px solid var(--inv-border); font: inherit; font-size: 13px;
  color: var(--inv-text); background: var(--inv-elevated); transition: border-color 0.15s ease;
}
.form-field__input:focus { outline: none; border-color: var(--inv-muted); }
.form-field__input::placeholder { color: var(--inv-muted); }
.form-field__select {
  appearance: none; padding-right: 30px;
  background: var(--inv-elevated) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239ca3af' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E") no-repeat right 12px center;
}
.form-field__textarea { resize: vertical; min-height: 72px; }
.form-error { font-size: 12px; color: var(--inv-crit); margin: -4px 0 0; }


.inventory-toast {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 1100;
  display: flex; align-items: center; gap: 0.55rem; max-width: min(46rem, calc(100vw - 32px)); padding: 0.7rem 0.9rem;
  border-radius: 10px; border: 1px solid var(--inv-border); background: var(--inv-elevated); color: var(--inv-text);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28); font-family: var(--rb-font-sans); font-size: 13px;
}
.inventory-toast__close { border: 0; background: none; color: var(--inv-muted); cursor: pointer; display: inline-flex; padding: 0.15rem; }

/* Responsive: by the width the page actually has. */
@container inv (max-width: 1240px) {
  .kpi-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .inv-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas: "types types" "list list" "expiring activity";
  }
}
@container inv (max-width: 760px) {
  .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .inv-grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "types" "list" "expiring" "activity"; }
}
@container inv (max-width: 440px) {
  .kpi-row { grid-template-columns: minmax(0, 1fr); }
}
@container types (max-width: 880px) {
  .type-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container types (max-width: 440px) {
  .type-grid { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 640px) {
  .inv-page { padding: 16px 16px 32px; }
  .filter-field { flex: 1 1 calc(50% - 5px); }
  .form-row { grid-template-columns: 1fr; }
  .detail-drawer { width: 100%; }
  .detail-drawer__footer .btn-outline { flex: 1 1 100%; }
}
</style>
