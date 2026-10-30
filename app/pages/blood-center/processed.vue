<template>
  <div class="processed-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Processed</h1>
        <!-- What waits at each step, under the title rather than crowding the toolbar (2026-10-28). -->
      <p v-if="waiting" class="waiting" aria-label="Units waiting at each step">
        <span class="waiting__item"><span class="waiting__dot waiting__dot--testing" aria-hidden="true" /><strong>{{ waiting.testing }}</strong> awaiting testing</span>
        <span class="waiting__item"><span class="waiting__dot waiting__dot--label" aria-hidden="true" /><strong>{{ waiting.label }}</strong> to label</span>
        <span class="waiting__item"><span class="waiting__dot waiting__dot--handover" aria-hidden="true" /><strong>{{ waiting.handover }}</strong> to hand over</span>
      </p>
      </div>
      <div class="header-actions">
        <button v-if="!noteOpen" type="button" class="note-link" @click="setNote(true)">
          <AssetIcon name="help-circle" :size="14" />
          How labelling works
        </button>
        <NuxtLink to="/blood-center/laboratory" class="btn-outline">
          <AssetIcon name="package-check" :size="14" />
          Component Processing
        </NuxtLink>
      </div>
    </header>

    <div v-if="noteOpen" class="note" role="note">
      <AssetIcon name="info" :size="15" />
      <p>
        A unit's bags stay with Processing until TTI Testing and Immunohematology have both cleared the donation.
        Then print and affix their final labels here and hand them over: Issuance books labelled bags straight into
        stock.
      </p>
      <button type="button" class="note__close" aria-label="Hide this note" @click="setNote(false)">
        <AssetIcon name="x" :size="14" />
      </button>
    </div>

    <div v-if="loadError" class="banner banner--error" role="alert">
      <AssetIcon name="circle-alert" :size="16" />
      <p class="banner__text">{{ loadError }}</p>
      <button type="button" class="btn-link" @click="load(pager.page)">Retry</button>
    </div>

    <div v-if="notice" class="banner" :class="`banner--${notice.tone}`" role="status">
      <AssetIcon :name="notice.tone === 'error' ? 'circle-alert' : 'circle-check-big'" :size="16" />
      <p class="banner__text">{{ notice.text }}</p>
      <button type="button" class="btn-link" @click="notice = null">Dismiss</button>
    </div>

    <section class="panel">
      <div class="toolbar">
        <div class="toolbar__filters">
          <label class="search">
            <AssetIcon name="search" :size="15" class="search__icon" />
            <input
              v-model="search"
              type="search"
              class="search__input"
              placeholder="Search bag / donation ID…"
              aria-label="Search by bag barcode, bag number or donation ID"
              @input="onSearchInput"
            >
          </label>
          <SelectField v-model="status" class="sel-filter" size="sm" aria-label="Filter by hand-over" :options="STATUS_FILTERS" @change="load()" />
        </div>

        <div class="toolbar__actions">
          <span v-if="updatedAt" class="updated">
            <AssetIcon name="clock" :size="13" />
            Updated {{ updatedAtLabel }}
          </span>
          <button type="button" class="btn-outline" :disabled="exporting || !pager.total" @click="exportList">
            <AssetIcon name="download" :size="14" />
            {{ exporting ? 'Exporting…' : 'Export' }}
          </button>
          <button type="button" class="btn-outline btn-outline--accent" :disabled="loading" @click="load(pager.page)">
            <AssetIcon name="refresh-cw" :size="14" :class="{ spin: loading }" />
            Refresh
          </button>
        </div>
      </div>

      <div class="table-wrap" :class="{ 'table-wrap--busy': loading && rows.length }">
        <table class="processed-table">
          <caption class="sr-only">Units processed at this centre</caption>
          <thead>
            <tr>
              <th scope="col" class="c-id">ID</th>
              <th scope="col" class="c-bag">Bag</th>
              <!-- Processing works blind: the blood type on the bag, never the person. -->
              <th scope="col" class="c-donor">{{ canViewIdentity ? 'Donor' : 'Group' }}</th>
              <th scope="col" class="c-components">Components</th>
              <th scope="col" class="c-testing">Testing</th>
              <th scope="col" class="c-processed" :aria-sort="sort === 'oldest' ? 'ascending' : 'descending'">
                <button type="button" class="th-sort" @click="toggleSort">
                  Processed
                  <AssetIcon :name="sort === 'oldest' ? 'chevron-up' : 'chevron-down'" :size="12" />
                </button>
              </th>
              <th scope="col" class="c-status">Hand-over</th>
              <th scope="col" class="c-actions">Actions</th>
            </tr>
          </thead>

          <tbody v-if="loading && !rows.length">
            <tr v-for="n in 6" :key="'sk-' + n">
              <td :colspan="COLUMN_COUNT"><span class="skeleton skeleton--line" /></td>
            </tr>
          </tbody>

          <tbody v-else-if="!rows.length">
            <tr>
              <td :colspan="COLUMN_COUNT" class="empty-cell">
                <div class="empty-state">
                  <span class="empty-state__icon"><AssetIcon :name="hasFilters ? 'search-x' : 'package-check'" :size="20" /></span>
                  <p class="empty-state__title">{{ hasFilters ? 'No units match' : 'Nothing processed yet' }}</p>
                  <p class="empty-state__text">
                    {{ hasFilters
                      ? 'Try another bag or donation ID, or show everything processed.'
                      : 'A unit appears here once its component breakdown is recorded on Component Processing.' }}
                  </p>
                  <button v-if="hasFilters" type="button" class="btn-outline" @click="clearFilters">Clear filters</button>
                </div>
              </td>
            </tr>
          </tbody>

          <tbody v-else>
            <tr v-for="row in rows" :key="row.donation_id" class="processed-row">
              <td class="c-id"><span class="code">{{ row.code }}</span></td>
              <td class="c-bag">
                <span v-if="row.bag?.barcode" class="bag">{{ row.bag.barcode }}</span>
                <span v-else class="muted">—</span>
                <span v-if="row.bag?.type" class="sub">{{ row.bag.type }}</span>
              </td>
              <td class="c-donor">
                <template v-if="row.donor && !row.donor.blinded">
                  <span class="donor__name">{{ row.donor.full_name }}</span>
                  <span class="sub">{{ row.donor.donor_code }}</span>
                </template>
                <span v-else-if="row.donor?.blood_type" class="blood">{{ row.donor.blood_type }}</span>
                <span v-else class="muted" title="Not typed yet">—</span>
              </td>
              <td class="c-components">
                <!-- By the code on each bag's label; the full name is the tooltip, and the dialog lists every bag. -->
                <span class="chips" :aria-label="breakdownSummary(row.components)">
                  <span v-for="chip in componentChips(row.components)" :key="chip.code" class="chip" :class="`comp--${componentTone(chip.name)}`" :title="chip.name">
                    <span class="chip__swatch" aria-hidden="true" />
                    {{ chip.code }}<span v-if="chip.count > 1" class="chip__count">×{{ chip.count }}</span>
                  </span>
                </span>
                <span class="sub sub--nowrap">
                  {{ row.bag_count }} bag{{ row.bag_count === 1 ? '' : 's' }}<template v-if="row.processed_volume_ml"> · {{ row.processed_volume_ml }} mL</template>
                </span>
              </td>
              <td class="c-testing">
                <span class="clearances">
                  <span class="clearance" :class="{ 'clearance--done': row.clearances?.tti }" :title="row.clearances?.tti ? 'TTI cleared' : 'TTI not cleared yet'">
                    <AssetIcon v-if="row.clearances?.tti" name="check" :size="11" />
                    TTI
                  </span>
                  <span class="clearance" :class="{ 'clearance--done': row.clearances?.immunohematology }" :title="row.clearances?.immunohematology ? 'ABO/Rh cleared' : 'ABO/Rh not cleared yet'">
                    <AssetIcon v-if="row.clearances?.immunohematology" name="check" :size="11" />
                    ABO/Rh
                  </span>
                </span>
              </td>
              <td class="c-processed">
                {{ formatShortDate(row.processed_at) || '—' }}
                <span v-if="row.processed_by" class="sub">{{ row.processed_by }}</span>
              </td>
              <td class="c-status">
                <span class="state" :class="`state--${row.label_state || row.status}`">{{ row.status_label }}</span>
                <span v-if="row.status !== 'rejected'" class="trail" :aria-label="`Step ${stepOf(row)} of 4`">
                  <span v-for="n in 4" :key="n" class="trail__dot" :class="{ 'trail__dot--done': n <= stepOf(row) }" />
                </span>
                <span v-if="row.status === 'rejected' && row.rejection_reason" class="sub" :title="row.rejection_reason">{{ row.rejection_reason }}</span>
                <span v-else-if="bookedText(row)" class="sub">{{ bookedText(row) }}</span>
                <span v-if="row.correction_pending" class="sub sub--pending">Correction pending</span>
              </td>
              <td class="c-actions">
                <div class="row-actions">
                  <button
                    type="button"
                    class="icon-btn"
                    :aria-label="`View ${row.code}`"
                    title="View"
                    @click="openRow(row, 'view')"
                  >
                    <AssetIcon name="eye" :size="15" />
                  </button>
                  <!-- A correction waiting for this viewer's decision takes the pen's place: the pen is closed while it waits. -->
                  <button
                    v-if="row.correction?.can_decide"
                    type="button"
                    class="icon-btn icon-btn--review"
                    :aria-label="`Review the correction to ${row.code}`"
                    title="Approve or reject the correction to this breakdown"
                    @click="openRow(row, 'review')"
                  >
                    <AssetIcon name="shield-check" :size="15" />
                  </button>
                  <!-- Edited here directly; nothing is saved until the component technologist approves. -->
                  <button
                    v-else
                    type="button"
                    class="icon-btn"
                    :disabled="!row.can?.correct"
                    :aria-label="`Edit the breakdown of ${row.code}`"
                    :title="editTitle(row)"
                    @click="openRow(row, 'edit')"
                  >
                    <AssetIcon name="pencil" :size="15" />
                  </button>
                  <!--
                    Final labels (project owner, 2026-10-22): printed here once
                    Testing has cleared the unit, before the hand-over; reprinted
                    after it for a bag whose label was lost.
                  -->
                  <button
                    v-if="row.status !== 'rejected'"
                    type="button"
                    class="icon-btn"
                    :class="{ 'icon-btn--due': row.label_state === 'awaiting_labels' }"
                    :disabled="!row.can?.print_labels || labelling !== null"
                    :aria-label="`${row.labelled_at ? 'Reprint' : 'Print'} the final labels of ${row.code}`"
                    :title="labelsBlockedText(row) ?? (row.labelled_at ? 'Reprint the final labels' : 'Print the final labels')"
                    @click="printFinalLabels(row)"
                  >
                    <AssetIcon :name="labelling === row.donation_id ? 'loader' : 'printer'" :size="15" :class="{ spin: labelling === row.donation_id }" />
                    <span v-if="row.label_state === 'awaiting_labels'" class="icon-btn__text">Print</span>
                  </button>
                  <!-- The hand-over to Issuance (it was the last card on Component Processing). -->
                  <template v-if="row.status === 'awaiting_handover'">
                    <button
                      type="button"
                      class="btn-handover"
                      :disabled="!row.can?.hand_over"
                      :aria-label="`Hand over ${row.code} to Issuance`"
                      :title="handoverBlockedText(row) ?? 'Hand over to Issuance'"
                      @click="openRow(row, 'handover')"
                    >
                      <AssetIcon name="send" :size="13" />
                      Hand over
                    </button>
                    <button
                      type="button"
                      class="icon-btn icon-btn--danger"
                      :disabled="!row.can?.reject"
                      :aria-label="`Reject ${row.code}`"
                      :title="row.can?.reject ? 'Reject this unit' : 'The component technologist rejects units.'"
                      @click="openRow(row, 'reject')"
                    >
                      <AssetIcon name="ban" :size="15" />
                    </button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="pager">
        <span class="pager__info">{{ pager.total }} unit(s)</span>
        <div class="pager__btns">
          <button type="button" class="btn-outline btn-outline--sm" :disabled="pager.page <= 1 || loading" @click="load(pager.page - 1)">
            <AssetIcon name="chevron-left" :size="14" />
            Prev
          </button>
          <span class="pager__page">Page {{ pager.page }} / {{ pager.lastPage }}</span>
          <button type="button" class="btn-outline btn-outline--sm" :disabled="pager.page >= pager.lastPage || loading" @click="load(pager.page + 1)">
            Next
            <AssetIcon name="chevron-right" :size="14" />
          </button>
        </div>
      </footer>
    </section>

    <!-- ============ VIEW / HAND OVER / REJECT ============ -->
    <Transition name="modal">
      <div v-if="open" class="modal-overlay" @click.self="closeRow">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="processed-dialog-title">
          <div class="modal-card__header">
            <h2 id="processed-dialog-title" class="modal-card__title">
              <AssetIcon :name="dialogTitle.icon" :size="17" />
              {{ dialogTitle.text }} · {{ open.row.code }}
            </h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeRow">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-card__body">
            <div class="subject">
              <AssetIcon :name="open.row.donor && !open.row.donor.blinded ? 'user' : 'droplets'" :size="14" />
              <p>
                <strong>{{ open.row.donor && !open.row.donor.blinded ? open.row.donor.full_name : 'Identity hidden' }}</strong>
                · Donation {{ open.row.code }}
                <template v-if="open.row.bag?.barcode"> · Bag <span class="mono">{{ open.row.bag.barcode }}</span></template>
              </p>
            </div>

            <div class="facts">
              <div class="fact">
                <span class="fact__label">Hand-over</span>
                <span class="state" :class="`state--${open.row.label_state || open.row.status}`">{{ open.row.status_label }}</span>
              </div>
              <div class="fact">
                <span class="fact__label">Processed</span>
                <span class="fact__value">{{ formatDateTime(open.row.processed_at) }}</span>
                <span v-if="open.row.processed_by" class="sub">{{ open.row.processed_by }}</span>
              </div>
              <div class="fact">
                <span class="fact__label">Collected</span>
                <span class="fact__value">{{ open.row.collected_volume_ml ? `${open.row.collected_volume_ml} mL` : 'Not recorded' }}</span>
              </div>
              <div class="fact">
                <span class="fact__label">Testing</span>
                <span class="clearances">
                  <span class="clearance" :class="{ 'clearance--done': open.row.clearances?.tti }">
                    <AssetIcon v-if="open.row.clearances?.tti" name="check" :size="11" />
                    TTI cleared
                  </span>
                  <span class="clearance" :class="{ 'clearance--done': open.row.clearances?.immunohematology }">
                    <AssetIcon v-if="open.row.clearances?.immunohematology" name="check" :size="11" />
                    ABO/Rh cleared
                  </span>
                </span>
              </div>
            </div>

            <!-- Reviewing, the proposal below sets the saved bags beside the proposed ones. -->
            <div v-if="open.mode !== 'edit' && open.mode !== 'review'" class="bags">
              <p class="bags__title">Bags ({{ open.row.bag_count }})</p>
              <ul class="bags__list">
                <li v-for="bag in open.row.components" :key="bag.id ?? bag.bag_number">
                  <span class="bags__number mono">{{ bag.bag_number || '—' }}</span>
                  <span>{{ bagText(bag) }}</span>
                </li>
              </ul>
              <p v-if="open.mode === 'view' && open.row.status !== 'rejected'" class="hint">
                Base labels are printed on
                <NuxtLink :to="`/blood-center/laboratory?donation=${open.row.donation_id}`" class="inline-link">Component Processing</NuxtLink>.
                <template v-if="open.row.labelled_at">
                  Final labels printed {{ formatDateTime(open.row.labelled_at) }}<template v-if="open.row.labelled_by"> by {{ open.row.labelled_by }}</template>.
                </template>
                <template v-else>Final labels print here once Testing has cleared both sections.</template>
              </p>
            </div>

            <!-- The breakdown, edited in place. Saved only through a correction. -->
            <template v-if="open.mode === 'edit'">
              <div class="bags">
                <p class="bags__title">Bags</p>
                <div v-for="(bag, index) in open.form" :key="index" class="bag-row">
                  <label class="form-field">
                    <span class="form-label">Component <span class="form-required" aria-hidden="true">*</span></span>
                    <SelectField v-model="bag.component_id" placeholder="Select" aria-label="Component"
                      :options="catalogue.map(component => ({ value: component.id, label: component.name }))" />
                  </label>
                  <label class="form-field form-field--volume">
                    <span class="form-label">Volume (mL) <span class="form-required" aria-hidden="true">*</span></span>
                    <input
                      v-model.number="bag.volume_ml"
                      type="number"
                      min="1"
                      max="1000"
                      inputmode="numeric"
                      class="form-input"
                      placeholder="mL"
                    >
                  </label>
                  <button
                    type="button"
                    class="icon-btn"
                    :disabled="open.form.length === 1"
                    aria-label="Remove this bag"
                    title="Remove this bag"
                    @click="open.form.splice(index, 1)"
                  >
                    <AssetIcon name="trash-2" :size="14" />
                  </button>
                </div>
                <div class="bag-form__foot">
                  <button
                    type="button"
                    class="btn-outline btn-outline--sm"
                    :disabled="open.form.length >= 10"
                    @click="open.form.push({ component_id: null, volume_ml: null })"
                  >
                    <AssetIcon name="plus" :size="13" />
                    Add bag
                  </button>
                  <!-- Information only: nothing here decides what a bag should hold. -->
                  <span v-if="editedVolume > 0" class="hint">
                    {{ editedVolume }} mL across {{ open.form.filter(isCompleteBag).length }} bag(s)<template v-if="open.row.collected_volume_ml">. {{ open.row.collected_volume_ml }} mL was collected</template>.
                  </span>
                </div>
              </div>

              <label class="form-field">
                <span class="form-label">What was entered wrongly, and why <span class="form-required" aria-hidden="true">*</span></span>
                <textarea
                  v-model="open.reason"
                  class="form-input form-textarea"
                  rows="2"
                  maxlength="1000"
                  placeholder="e.g. The second bag of FFP was not recorded"
                />
              </label>

              <p class="hint">
                A saved breakdown is never saved over.
                <template v-if="isHead">As the component technologist, your correction applies as soon as you send it.</template>
                <template v-else>Your correction goes to the component technologist, who approves it here. Nothing changes until they do.</template>
              </p>
            </template>

            <!-- A correction waiting for the component technologist: who asked, why, and what it changes. -->
            <div v-if="open.row.correction && open.mode !== 'handover'" class="proposal" :class="{ 'proposal--decide': open.mode === 'review' }">
              <p class="proposal__title">
                <AssetIcon name="pencil" :size="14" />
                Correction requested<template v-if="open.row.correction.requested_by"> by {{ open.row.correction.requested_by }}</template>
                <span class="proposal__when">{{ formatDateTime(open.row.correction.requested_at) }}</span>
              </p>
              <div class="proposal__diff">
                <div class="proposal__side">
                  <p class="proposal__label">Saved</p>
                  <ul>
                    <li v-for="bag in open.row.components" :key="`now-${bag.id}`">{{ bagText(bag) }}</li>
                  </ul>
                </div>
                <AssetIcon name="arrow-right" :size="14" class="proposal__arrow" />
                <div class="proposal__side">
                  <p class="proposal__label">Proposed</p>
                  <ul>
                    <li v-for="(bag, index) in open.row.correction.components" :key="`next-${index}`">{{ bagText(bag) }}</li>
                  </ul>
                </div>
              </div>
              <p v-if="open.row.correction.reason" class="proposal__reason">“{{ open.row.correction.reason }}”</p>
              <p v-if="!open.row.correction.can_decide" class="proposal__wait">Waiting for the component technologist's decision. Nothing changes until then.</p>
            </div>

            <label v-if="open.mode === 'review' && open.rejecting" class="form-field">
              <span class="form-label">Why it is rejected <span class="form-required" aria-hidden="true">*</span></span>
              <textarea v-model="open.note" class="form-input form-textarea" rows="2" maxlength="1000" />
            </label>

            <p v-if="open.row.status === 'rejected'" class="lock" role="note">
              <AssetIcon name="ban" :size="14" />
              {{ open.row.rejection_reason || 'No reason was recorded.' }} This unit can never become stock.
            </p>
            <p v-else-if="open.row.status === 'handed_over'" class="lock" role="note">
              <AssetIcon name="warehouse" :size="14" />
              Handed over to Issuance. {{ bookedText(open.row) }}.
            </p>
            <p v-else-if="open.mode === 'view' && !open.row.can?.hand_over" class="lock" role="note">
              <AssetIcon name="info" :size="14" />
              {{ handoverBlockedText(open.row) }}
            </p>

            <!-- A breakdown correction cannot be applied once the unit is handed over. -->
            <div v-if="open.row.correction_pending && open.mode === 'handover'" class="warn" role="note">
              <p class="warn__title">
                <AssetIcon name="octagon-alert" :size="15" />
                A correction to this breakdown is waiting for a decision
              </p>
              <p>
                Once the unit is handed over the breakdown is fixed, and the correction can no longer be applied.
                <template v-if="open.row.correction?.can_decide">Decide it first.</template>
                <template v-else>The component technologist decides it here.</template>
              </p>
              <button
                v-if="open.row.correction?.can_decide"
                type="button"
                class="btn-outline btn-outline--sm warn__action"
                @click="open.mode = 'review'"
              >
                <AssetIcon name="shield-check" :size="13" />
                Review the correction
              </button>
            </div>

            <div v-if="open.mode === 'handover'" class="confirm" role="note">
              <p class="confirm__title">
                <AssetIcon name="send" :size="15" />
                Hand {{ open.row.bag_count === 1 ? 'this bag' : `these ${open.row.bag_count} bags` }} over to Issuance?
              </p>
              <p>
                Processing for this unit is then complete. Issuance books the labelled bags straight into stock at
                Stock Intake. A handed-over unit cannot be rejected here.
              </p>
            </div>

            <template v-if="open.mode === 'reject'">
              <label class="form-field">
                <span class="form-label">Why is this unit not being issued? <span class="form-required" aria-hidden="true">*</span></span>
                <textarea
                  v-model="open.reason"
                  class="form-input form-textarea"
                  rows="2"
                  maxlength="255"
                  placeholder="e.g. Clotted during separation"
                />
              </label>
              <p class="hint">Recorded on the donation. A rejected unit can never become stock, and this cannot be undone here.</p>
            </template>

            <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
          </div>

          <div class="modal-card__footer">
            <button type="button" class="btn-outline" :disabled="Boolean(acting)" @click="closeRow">
              {{ open.mode === 'view' ? 'Close' : 'Cancel' }}
            </button>
            <template v-if="open.mode === 'view'">
              <button v-if="open.row.correction?.can_decide" type="button" class="btn-outline" @click="open.mode = 'review'">
                <AssetIcon name="shield-check" :size="14" />
                Review…
              </button>
              <button v-else-if="open.row.can?.correct" type="button" class="btn-outline" @click="open.mode = 'edit'">
                <AssetIcon name="pencil" :size="14" />
                Edit…
              </button>
            </template>
            <template v-if="open.mode === 'review'">
              <button
                v-if="!open.rejecting"
                type="button"
                class="btn-outline"
                :disabled="Boolean(acting)"
                @click="open.rejecting = true"
              >
                <AssetIcon name="x" :size="14" />
                Reject…
              </button>
              <button
                v-else
                type="button"
                class="btn-outline btn-outline--danger"
                :disabled="Boolean(acting) || !open.note.trim()"
                @click="rejectCorrection"
              >
                <AssetIcon name="x" :size="14" />
                {{ acting === 'reject-correction' ? 'Rejecting…' : 'Reject correction' }}
              </button>
              <button
                v-if="!open.rejecting"
                type="button"
                class="btn-primary"
                :disabled="Boolean(acting)"
                @click="approveCorrection"
              >
                <AssetIcon name="check" :size="14" />
                {{ acting === 'approve' ? 'Approving…' : 'Approve correction' }}
              </button>
            </template>
            <button
              v-if="open.mode === 'edit'"
              type="button"
              class="btn-primary"
              :disabled="!canRequest || Boolean(acting)"
              :title="editChanged ? (open.reason.trim() ? '' : 'Say what was entered wrongly') : 'Change a bag first'"
              @click="requestCorrection"
            >
              <AssetIcon name="check" :size="14" />
              {{ acting === 'file' ? 'Sending…' : (isHead ? 'Apply correction' : 'Request correction') }}
            </button>
            <template v-if="open.mode === 'view' && open.row.status === 'awaiting_handover'">
              <button v-if="open.row.can?.reject" type="button" class="btn-outline btn-outline--danger" @click="open.mode = 'reject'">
                <AssetIcon name="ban" :size="14" />
                Reject…
              </button>
              <button
                v-if="open.row.can?.print_labels"
                type="button"
                :class="open.row.can?.hand_over ? 'btn-outline' : 'btn-primary'"
                :disabled="labelling !== null"
                @click="printFinalLabels(open.row)"
              >
                <AssetIcon name="printer" :size="14" />
                {{ open.row.labelled_at ? 'Reprint final labels' : 'Print final labels' }}
              </button>
              <button v-if="open.row.can?.hand_over" type="button" class="btn-primary" @click="open.mode = 'handover'">
                <AssetIcon name="send" :size="14" />
                Hand over…
              </button>
            </template>
            <button
              v-if="open.mode === 'handover'"
              type="button"
              class="btn-primary"
              :disabled="Boolean(acting) || !open.row.can?.hand_over"
              @click="handOver"
            >
              <AssetIcon name="send" :size="14" />
              {{ acting === 'handover' ? 'Handing over…' : 'Hand over to Issuance' }}
            </button>
            <button
              v-if="open.mode === 'reject'"
              type="button"
              class="btn-primary btn-primary--danger"
              :disabled="Boolean(acting) || !open.reason.trim() || !open.row.can?.reject"
              @click="reject"
            >
              <AssetIcon name="ban" :size="14" />
              {{ acting === 'reject' ? 'Rejecting…' : 'Confirm rejection' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Hidden until final labels are printed. -->
    <BloodCenterBagLabelSheet />
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import SelectField from '~/components/common/SelectField.vue'
import BloodCenterBagLabelSheet from '~/components/BloodCenter/BagLabelSheet.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { finalLabelsFrom } from '~/utils/bagLabels'
import { formatShortDate } from '~/utils/donorRecords'
import {
  STATUS_FILTERS,
  bagText,
  bookedText,
  breakdownChanged,
  breakdownPayload,
  breakdownSummary,
  componentChips,
  correctionLockText,
  editableBags,
  handoverBlockedText,
  handoverErrorText,
  isCompleteBag,
  labelsBlockedText,
  labelsErrorText,
} from '~/utils/processedDonations'

/**
 * Processing's Processed list (project owner, 2026-10-19): every unit with a
 * recorded component breakdown, and where the hand-over to Issuance is made.
 * It was the last card on Component Processing; that page now records the
 * breakdown, and a processed unit leaves its queue for this list.
 *
 * Handing over and rejecting go through the laboratory status route, as they
 * always have. The server says per row whether either is still open
 * (`can.hand_over`, `can.reject`): only the component technologist holds
 * lab.update_status, and only an unfinished donation can be handed over.
 *
 * A saved breakdown is corrected here too (project owner, 2026-10-19), the
 * way TTI Testing corrects a panel on Serology Results: the pen edits the
 * bags in this dialog and files the correction, reason included, and the
 * component technologist reviews it here and approves or rejects it. Their
 * own correction applies as it is sent. The server says per row whether a
 * correction can still be filed (`can.correct`, `locked`) and who may decide
 * a pending one (`correction.can_decide`).
 *
 * ?status=awaiting_handover opens on what waits, where the sidebar's count
 * points. ?donation= opens that unit: Component Processing links here once
 * its breakdown is recorded, with &open=edit from "View or edit".
 *
 * API SHAPE
 * -------------------------------------------------------------------------
 *  GET /laboratory/processed?search=&status=&sort=&page=
 *      -> paginator; rows: { donation_id, code, donor (blinded without
 *         donors.view_identity), bag: { barcode, type }, components: [{ id,
 *         component, volume_ml, quantity, bag_number }], bag_count,
 *         processed_volume_ml, collected_volume_ml, processed_at,
 *         processed_by, clearances: { tti, immunohematology }, status
 *         (awaiting_handover | handed_over | rejected), status_label,
 *         rejection_reason, units_booked, correction_pending, correction:
 *         { id, requested_by, requested_at, reason, components, can_decide }
 *         | null, locked (handed_over | rejected | null),
 *         can: { hand_over, reject, correct } }
 *  GET /laboratory/processed/export?(same filters)            -> CSV
 *  PATCH /laboratory/donations/{id}/status { status: completed | rejected,
 *         rejection_reason? }                                 -> the hand-over
 *  POST /donations/{id}/corrections { subject: components, reason,
 *         changes: { components: [{ component_id, volume_ml }] } }
 *  POST /corrections/{id}/approve | /reject { note }          -> the decision
 * -------------------------------------------------------------------------
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'lab.record_components',
})

const route = useRoute()
const { can, user } = useUser()
const canViewIdentity = computed(() => can('donors.view_identity'))
// Processing's correction approver. Their own correction applies as it is filed.
const isHead = computed(() => (user.value?.staff_roles ?? []).includes('component_technologist'))

// The components a bag can hold, for the edit form.
const catalogue = ref([])

// The sidebar counts what waits for the hand-over; a change here recounts it.
const badgeRefresh = useState('blood-center-badge-refresh', () => 0)

const PER_PAGE = 25
const COLUMN_COUNT = 8

const loading = ref(false)
const loadError = ref('')
const notice = ref(null)
const updatedAt = ref(null)
const rows = ref([])
const pager = reactive({ page: 1, lastPage: 1, total: 0 })

const initialStatus = typeof route.query.status === 'string' ? route.query.status : ''
const search = ref('')
const status = ref(STATUS_FILTERS.some((option) => option.value === initialStatus) ? initialStatus : '')
const sort = ref('newest')

const hasFilters = computed(() => Boolean(search.value.trim() || status.value))
const updatedAtLabel = computed(() => updatedAt.value?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) ?? '')

function filterParams() {
  const params = {}
  if (search.value.trim()) params.search = search.value.trim()
  if (status.value) params.status = status.value
  if (sort.value !== 'newest') params.sort = sort.value
  return params
}

function formatDateTime(iso) {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return '—'
  return `${formatShortDate(iso)} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

/** How far a unit has got: 1 testing, 2 labels, 3 hand over, 4 handed over. */
function stepOf(row) {
  if (row.status === 'handed_over') return 4
  return { awaiting_testing: 1, awaiting_labels: 2, labelled: 3 }[row.label_state] ?? 1
}

/** Each component's colour, as on the Processing dashboard and bench. */
function componentTone(name) {
  const n = String(name).toLowerCase()
  if (n.includes('red') || n.includes('rbc') || n.includes('whole')) return 'red'
  if (n.includes('cryo')) return 'blue'
  if (n.includes('plasma')) return 'amber'
  if (n.includes('platelet')) return 'purple'
  return 'grey'
}

// The labelling rule, put away once read and remembered on this browser.
const NOTE_KEY = 'rb.processed.note'
const noteOpen = ref(true)
function setNote(open) {
  noteOpen.value = open
  try { localStorage.setItem(NOTE_KEY, open ? '1' : '0') } catch { /* private window: shown again next time */ }
}
onMounted(() => {
  try { noteOpen.value = localStorage.getItem(NOTE_KEY) !== '0' } catch { /* keep it shown */ }
})

async function load(page = 1) {
  loadWaiting()
  loading.value = true
  loadError.value = ''
  try {
    const res = await bloodCenterService.processedDonations({ ...filterParams(), page, per_page: PER_PAGE })
    rows.value = res?.data ?? []
    Object.assign(pager, { page: res?.current_page ?? page, lastPage: Math.max(1, res?.last_page ?? 1), total: res?.total ?? rows.value.length })
    updatedAt.value = new Date()
  } catch (err) {
    loadError.value = err?.message || 'Could not load the processed units.'
  } finally {
    loading.value = false
  }
}

let searchTimer = null

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => load(), 300)
}

function clearFilters() {
  search.value = ''
  status.value = ''
  load()
}

// ── What waits at each step, said once in the toolbar (2026-10-28) ──
// Information only, from the Processing dashboard; the list's own filter is
// the hand-over select.
const waiting = ref(null)
async function loadWaiting() {
  try {
    const d = await bloodCenterService.processingDashboard()
    waiting.value = d?.queue ? { testing: d.queue.awaiting_testing ?? 0, label: d.queue.to_label ?? 0, handover: d.queue.to_hand_over ?? 0 } : null
  } catch {
    waiting.value = null
  }
}

function toggleSort() {
  sort.value = sort.value === 'newest' ? 'oldest' : 'newest'
  load()
}

/* ---------- export ---------- */

const exporting = ref(false)

async function exportList() {
  exporting.value = true
  try {
    const blob = await bloodCenterService.exportProcessedDonations(filterParams())
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `processed-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    notice.value = { tone: 'error', text: 'Could not export the processed units. Please try again.' }
  } finally {
    exporting.value = false
  }
}

/* ---------- view, hand over, reject ---------- */

const open = ref(null)
const acting = ref('')
const actionError = ref('')

const dialogTitle = computed(() => {
  if (open.value?.mode === 'handover') return { icon: 'send', text: 'Hand over to Issuance' }
  if (open.value?.mode === 'reject') return { icon: 'ban', text: 'Reject unit' }
  if (open.value?.mode === 'edit') return { icon: 'pencil', text: 'Edit breakdown' }
  if (open.value?.mode === 'review') return { icon: 'shield-check', text: 'Review correction' }
  return { icon: 'package-check', text: 'Processed unit' }
})

// The edit form against what is saved: a correction must change something and say why.
const editChanged = computed(() => Boolean(open.value) && breakdownChanged(editableBags(open.value.row.components), open.value.form))
const editedVolume = computed(() => (open.value?.form ?? []).filter(isCompleteBag).reduce((sum, bag) => sum + Number(bag.volume_ml), 0))
const canRequest = computed(() => open.value?.mode === 'edit'
  && Boolean(open.value.row.can?.correct)
  && open.value.form.length > 0
  && open.value.form.every(isCompleteBag)
  && editChanged.value
  && open.value.reason.trim().length > 0)

/** The pen's tooltip: where an edit goes, or why there is none. */
function editTitle(row) {
  if (!row.can?.correct) return correctionLockText(row) ?? 'This breakdown cannot be edited.'
  return isHead.value
    ? 'Edit: as the component technologist, your correction applies as you send it'
    : 'Edit: saved only once the component technologist approves it'
}

/** What "View or edit" from Component Processing opens on: the review, then edit, then view. */
function editMode(row) {
  if (row.correction?.can_decide) return 'review'
  if (row.can?.correct) return 'edit'
  return 'view'
}

function openRow(row, mode = 'view') {
  open.value = { row, mode, reason: '', note: '', rejecting: false, form: editableBags(row.components) }
  actionError.value = ''
}

function closeRow() {
  if (acting.value) return
  open.value = null
  actionError.value = ''
}

/** Hand over or reject through the laboratory status route; the row's new state is the server's. */
async function decide(kind, payload) {
  const row = open.value?.row
  if (!row) return

  acting.value = kind
  actionError.value = ''
  try {
    const res = await bloodCenterService.updateLaboratoryStatus(row.donation_id, payload)
    acting.value = ''
    closeRow()
    notice.value = {
      tone: 'success',
      text: kind === 'handover'
        ? `${row.code} handed over to Issuance. Its bags can now be booked in at Stock Intake.`
        : (res?.message ?? `${row.code} rejected.`),
    }
    badgeRefresh.value++
    await load(pager.page)
  } catch (err) {
    acting.value = ''
    actionError.value = handoverErrorText(err)
    // Someone else finished it first: show where it now stands.
    if (err?.data?.code === 'donation_already_final') await load(pager.page)
  }
}

function handOver() {
  if (open.value?.row.can?.hand_over) decide('handover', { status: 'completed' })
}

/* ---------- final labels ---------- */

// Final labelling is Processing's (project owner, 2026-10-22): printed once
// Testing has cleared the unit, and required before the hand-over. Printing
// records who labelled the bags and when, so the row is reloaded after.
const { print: printLabelSheet } = useLabelPrint()
const labelling = ref(null)

async function printFinalLabels(row) {
  if (!row?.can?.print_labels || labelling.value !== null) return

  labelling.value = row.donation_id
  notice.value = null
  try {
    const res = await bloodCenterService.printFinalLabels(row.donation_id)
    const labels = finalLabelsFrom(res)

    // Close the dialog first, so only the label sheet is on the page to print.
    open.value = null
    await nextTick()
    if (labels.length) await printLabelSheet(labels, 'final')

    notice.value = { tone: 'success', text: res?.message ?? `Final labels for ${row.code} printed.` }
    await load(pager.page)
  } catch (err) {
    notice.value = { tone: 'error', text: labelsErrorText(err) }
  } finally {
    labelling.value = null
  }
}

function reject() {
  const reason = open.value?.reason.trim()
  if (open.value?.row.can?.reject && reason) decide('reject', { status: 'rejected', rejection_reason: reason })
}

/* ---------- breakdown corrections ---------- */

function correctionError(err, fallback) {
  return Object.values(err?.errors ?? err?.data?.errors ?? {}).flat()[0] || err?.message || fallback
}

/** Close, say what happened, and reload: the row's state is the server's. */
async function settled(message) {
  acting.value = ''
  closeRow()
  notice.value = { tone: 'success', text: message }
  badgeRefresh.value++
  await load(pager.page)
}

/** File the correction from this dialog: the same body recording the breakdown sends. */
async function requestCorrection() {
  if (!canRequest.value) return

  acting.value = 'file'
  actionError.value = ''
  try {
    const res = await bloodCenterService.requestCorrection(open.value.row.donation_id, {
      subject: 'components',
      reason: open.value.reason.trim(),
      changes: { components: breakdownPayload(open.value.form) },
    })
    await settled(res?.message ?? 'Correction requested.')
  } catch (err) {
    actionError.value = correctionError(err, 'The correction could not be sent.')
    acting.value = ''
  }
}

/** The component technologist's decision on a correction waiting for them. */
async function approveCorrection() {
  const correction = open.value?.row.correction
  if (!correction) return

  acting.value = 'approve'
  actionError.value = ''
  try {
    const res = await bloodCenterService.approveCorrection(correction.id)
    await settled(res?.message ?? 'Correction approved and applied.')
  } catch (err) {
    actionError.value = correctionError(err, 'The correction could not be approved.')
    acting.value = ''
  }
}

async function rejectCorrection() {
  const correction = open.value?.row.correction
  const note = open.value?.note.trim()
  if (!correction || !note) return

  acting.value = 'reject-correction'
  actionError.value = ''
  try {
    const res = await bloodCenterService.rejectCorrection(correction.id, { note })
    await settled(res?.message ?? 'Correction rejected.')
  } catch (err) {
    actionError.value = correctionError(err, 'The correction could not be rejected.')
    acting.value = ''
  }
}

/* ---------- keyboard and lifecycle ---------- */

function onKeydown(event) {
  if (event.key === 'Escape' && open.value) closeRow()
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)

  // Sent here for one unit: find it, and open it on what the link asked for —
  // its breakdown (&open=edit), or else its hand-over when that is still to do.
  const wanted = Number(route.query.donation)
  if (Number.isInteger(wanted) && wanted > 0) search.value = `DON-${wanted}`

  loadCatalogue()
  await load()

  const row = rows.value.find((entry) => entry.donation_id === wanted)
  if (row) openRow(row, route.query.open === 'edit' ? editMode(row) : (row.can?.hand_over ? 'handover' : 'view'))
})

async function loadCatalogue() {
  try {
    const res = await bloodCenterService.referenceData()
    catalogue.value = res?.components ?? []
  } catch {
    // The list still works; the edit form's component select stays empty.
  }
}

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.processed-page {
  font-family: var(--rb-font-sans);
  max-width: var(--rb-content-max, 1600px);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  background: var(--rb-page-bg);
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--rb-text-primary);
}

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.page-title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ---------- Note and banners ---------- */
.note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.22);
  border-left: 3px solid var(--rb-primary);
  border-radius: 10px;
  background: rgba(var(--rb-primary-rgb), 0.06);
  font-size: 13px;
  line-height: 1.5;
}

.note > :deep(.asset-icon) { flex-shrink: 0; margin-top: 2px; color: var(--rb-primary-text); }
.note p { margin: 0; }

.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 13px;
}

.banner > :deep(.asset-icon) { flex-shrink: 0; }
.banner__text { flex: 1; margin: 0; line-height: 1.45; }
.banner--success > :deep(.asset-icon) { color: var(--rb-success-text); }
.banner--error > :deep(.asset-icon) { color: var(--rb-accent-text); }
.banner--error { border-color: rgba(var(--rb-accent-rgb), 0.35); }

/* ---------- Buttons ---------- */
.btn-primary,
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.btn-primary { color: #fff; background: var(--rb-primary); border: 1px solid var(--rb-primary); }
.btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary--danger { background: var(--rb-accent); border-color: var(--rb-accent); }
.btn-primary--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-accent) 88%, #000); }

.btn-outline { color: var(--rb-text-primary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline--sm { height: 30px; padding: 0 10px; font-size: 12px; border-radius: 8px; gap: 4px; }
.btn-outline--accent { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); }
.btn-outline--danger { color: var(--rb-accent-text); border-color: rgba(var(--rb-accent-rgb), 0.45); }

.btn-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  padding: 0;
  color: var(--rb-primary-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}

.btn-link:hover { text-decoration: underline; }
.inline-link { color: var(--rb-primary-text); font-weight: 600; }

/* The row's one action: the hand-over, labelled, so it reads without a tooltip. */
.btn-handover {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid var(--rb-primary);
  border-radius: 8px;
  background: var(--rb-primary);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.12s ease, opacity 0.12s ease;
}

.btn-handover:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.btn-handover:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.btn-link:focus-visible,
.btn-handover:focus-visible,
.icon-btn:focus-visible,
.th-sort:focus-visible,
.modal-card__close:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

.spin { animation: spin 0.9s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- Panel and toolbar ---------- */
.panel {
  container-type: inline-size;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
  overflow: hidden;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--rb-border);
}

.toolbar__filters,
.toolbar__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar__filters { flex: 1 1 auto; min-width: 0; }
.toolbar__actions { justify-content: flex-end; margin-left: auto; }

.updated {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 4px;
  font-size: 12px;
  color: var(--rb-text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.search { position: relative; flex: 1 1 200px; min-width: 160px; max-width: 280px; }

.search__icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--rb-text-secondary);
  pointer-events: none;
}

.search__input,
.select {
  height: 36px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.search__input { width: 100%; padding: 0 12px 0 34px; }

.select {
  padding: 0 30px 0 12px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 10px 6px;
  appearance: none;
  cursor: pointer;
  field-sizing: content;
}

.search__input::placeholder { color: var(--rb-placeholder); }

.search__input:focus,
.select:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

/* ---------- Table ---------- */
.table-wrap { position: relative; overflow-x: auto; transition: opacity 0.15s ease; }
.table-wrap--busy { opacity: 0.55; }

.processed-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; }

.processed-table thead th {
  padding: 10px;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
  white-space: nowrap;
}

.processed-table tbody td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--rb-border);
  vertical-align: middle;
  overflow: hidden;
}

.processed-table th:first-child,
.processed-table td:first-child { padding-left: 16px; }

.processed-table th:last-child,
.processed-table td:last-child { padding-right: 16px; }

.processed-table tbody tr:last-child td { border-bottom: 0; }
.processed-row { transition: background 0.12s ease; }
.processed-row:hover { background: var(--rb-surface-hover); }

/* Every column but the breakdown is fixed, so the breakdown takes what is left. */
.c-id { width: 112px; }
.c-bag { width: 132px; }
/* The blood type pill; a name only reaches here for a viewer with identity, who has none in Processing. */
.c-donor { width: 72px; }
.c-testing { width: 150px; }
.c-processed { width: 128px; }
.c-status { width: 156px; }
/* View, edit (or review), the labelled hand-over and reject, with the cell's padding. */
.c-actions { width: 282px; }

.th-sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;
  cursor: pointer;
}

.th-sort:hover { color: var(--rb-text-primary); }

.code { font-family: var(--rb-font-mono); font-size: 12px; font-weight: 600; color: var(--rb-text-secondary); white-space: nowrap; }
.mono { font-family: var(--rb-font-mono); letter-spacing: 0.02em; }
.bag { display: block; font-family: var(--rb-font-mono); font-size: 12.5px; font-weight: 700; overflow-wrap: anywhere; }
.donor__name { display: block; font-weight: 700; text-transform: capitalize; overflow-wrap: break-word; }
.sub { display: block; margin-top: 2px; font-size: 11.5px; color: var(--rb-text-secondary); overflow-wrap: anywhere; }
.sub--nowrap { white-space: nowrap; overflow-wrap: normal; }

/* The breakdown: one chip per component, by its bag-label code. A chip never breaks; chips wrap between them. */
.chips { display: flex; flex-wrap: wrap; gap: 4px; }

.chip {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  padding: 1px 7px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 6px;
  background: var(--rb-surface-alt);
  font-family: var(--rb-font-mono);
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.5;
  letter-spacing: 0.02em;
  white-space: nowrap;
  cursor: default;
}

.chip__count { font-weight: 600; color: var(--rb-text-secondary); }
.c-status .sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub--pending { color: var(--rb-warning-text); font-weight: 600; }
.muted { color: var(--rb-text-secondary); }

.blood {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface-alt);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.clearances { display: flex; flex-wrap: wrap; gap: 4px; }

.clearance {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px;
  border: 1px solid var(--rb-border);
  border-radius: 999px;
  font-size: 11.5px;
  color: var(--rb-text-secondary);
  white-space: nowrap;
}

.clearance--done { border-color: transparent; background: rgba(var(--rb-success-rgb), 0.14); color: var(--rb-success-text); font-weight: 600; }

/* Where the unit stands. Waiting is the one to act on, so it is the one that stands out. */
.state {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.5;
  white-space: nowrap;
}

.state--awaiting_handover { background: rgba(var(--rb-warning-rgb), 0.14); color: var(--rb-warning-text); border-color: rgba(var(--rb-warning-rgb), 0.4); }
/* Waiting on Testing: nothing for Processing to do yet, so it stays quiet. */
.state--awaiting_testing { background: var(--rb-surface-alt); color: var(--rb-text-secondary); border-color: var(--rb-border-strong); }
/* Cleared: the labels are Processing's next step. */
.state--awaiting_labels { background: rgba(var(--rb-warning-rgb), 0.14); color: var(--rb-warning-text); border-color: rgba(var(--rb-warning-rgb), 0.4); }
.state--labelled { background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.3); }
.state--handed_over { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); border-color: rgba(var(--rb-success-rgb), 0.3); }
.state--rejected { background: rgba(var(--rb-accent-rgb), 0.12); color: var(--rb-accent-text); border-color: rgba(var(--rb-accent-rgb), 0.3); }

.row-actions { display: flex; align-items: center; gap: 6px; }

.icon-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.icon-btn:hover:not(:disabled) { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); background: var(--rb-surface-hover); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.icon-btn--danger:hover:not(:disabled) { color: var(--rb-accent-text); border-color: rgba(var(--rb-accent-rgb), 0.45); }

/* A correction waits for this viewer's decision: the one action that stands out, as on Serology Results. */
.icon-btn--review { background: rgba(var(--rb-warning-rgb), 0.14); border-color: rgba(var(--rb-warning-rgb), 0.45); color: var(--rb-warning-text); }
/* The labels are what this row waits on. */
.icon-btn--due { border-color: rgba(var(--rb-primary-rgb), 0.45); color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), 0.08); }
.icon-btn--review:hover:not(:disabled) { background: rgba(var(--rb-warning-rgb), 0.22); color: var(--rb-warning-text); border-color: rgba(var(--rb-warning-rgb), 0.6); }

/*
 * The panel narrows as the sidebar opens. The ID goes first (the bag and the
 * dialog still name the donation) and the two clearances stack. That keeps
 * the breakdown at 150px or more, enough for its chips on two lines at most;
 * below that the table scrolls sideways rather than squeeze it, as Serology
 * Results does. The min-width is the fixed columns (796px) plus those 150px.
 */
@container (max-width: 1120px) {
  .c-id { display: none; }
  .c-bag { width: 116px; }
  .c-testing { width: 100px; }
  .c-testing .clearances { flex-direction: column; align-items: flex-start; }
  .c-processed { width: 108px; }
  .processed-table { min-width: 984px; }
}

.skeleton {
  display: block;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 6px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton--line { height: 16px; width: 100%; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.empty-cell { padding: 0 !important; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 24px; text-align: center; }

.empty-state__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-bottom: 6px;
  border-radius: 12px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  color: var(--rb-text-secondary);
}

.empty-state__title { margin: 0; font-size: 14px; font-weight: 700; }
.empty-state__text { margin: 0 0 8px; max-width: 46ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* ---------- Pager ---------- */
.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  padding: 12px 16px;
  border-top: 1px solid var(--rb-border);
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.pager__btns { display: flex; align-items: center; gap: 8px; }
.pager__page { font-variant-numeric: tabular-nums; }

/* ---------- Modal ---------- */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--rb-overlay);
}

.modal-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 620px;
  max-height: calc(100vh - 40px);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
}

.modal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.modal-card__title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15.5px; font-weight: 700; }
.modal-card__title :deep(.asset-icon) { color: var(--rb-text-secondary); }

.modal-card__close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: none;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.modal-card__close:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }
.modal-card__body { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; overflow-y: auto; min-height: 0; }

.modal-card__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.subject {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.22);
  border-left: 3px solid var(--rb-primary);
  border-radius: 10px;
  background: rgba(var(--rb-primary-rgb), 0.06);
  font-size: 13px;
}

.subject > :deep(.asset-icon) { flex-shrink: 0; color: var(--rb-primary-text); }
.subject p { margin: 0; overflow-wrap: anywhere; }

.facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
.fact { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }

.fact__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}

.fact__value { font-size: 13.5px; }

.bags { display: flex; flex-direction: column; gap: 8px; }
.bags__title { margin: 0; font-size: 12.5px; font-weight: 600; }

.bags__list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  overflow: hidden;
}

.bags__list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  font-size: 13px;
  background: var(--rb-surface-alt);
}

.bags__list li + li { border-top: 1px solid var(--rb-border); }
.bags__number { min-width: 9.5rem; font-size: 12.5px; font-weight: 700; }

.lock {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  font-size: 13px;
  line-height: 1.5;
  color: var(--rb-text-secondary);
}

.lock > :deep(.asset-icon) { flex-shrink: 0; margin-top: 2px; }

.warn,
.confirm {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}

.warn { border: 1px solid rgba(var(--rb-warning-rgb), 0.4); background: rgba(var(--rb-warning-rgb), 0.07); }
.confirm { border: 1px solid rgba(var(--rb-primary-rgb), 0.3); background: rgba(var(--rb-primary-rgb), 0.05); }
.warn p,
.confirm p { margin: 0; }
.warn__title { display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--rb-warning-text); }
.confirm__title { display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--rb-primary-text); }

.form-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.form-label { font-size: 12.5px; font-weight: 600; }
.form-required { color: var(--rb-accent-text); }

/* Anchored on the root: other portals ship unscoped dark .form-input rules. */
.processed-page .form-input {
  width: 100%;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.processed-page .form-input:not(textarea) { height: 40px; padding: 0 12px; }
.processed-page .form-textarea { min-height: 64px; padding: 10px 12px; line-height: 1.5; resize: vertical; }
.processed-page .form-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.processed-page .form-select {
  padding-right: 30px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 10px 6px;
  appearance: none;
  cursor: pointer;
}

/* The edit form: one row per bag, component then volume. */
.bag-row { display: flex; align-items: flex-end; gap: 10px; }
.bag-row .form-field { flex: 1 1 auto; }
.bag-row .form-field--volume { flex: 0 0 8.5rem; }
.bag-row .icon-btn { width: 40px; height: 40px; }
.bag-form__foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }

/* A correction waiting for a decision: what is saved beside what it proposes. */
.proposal {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
  font-size: 13px;
  line-height: 1.5;
}

.proposal--decide { border-color: rgba(var(--rb-primary-rgb), 0.35); background: rgba(var(--rb-primary-rgb), 0.05); }
.proposal p { margin: 0; }
.proposal__title { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-weight: 700; }
.proposal__when { font-weight: 500; color: var(--rb-text-secondary); }
.proposal__diff { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: start; gap: 10px; }
.proposal__label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--rb-text-secondary); }
.proposal__side ul { margin: 4px 0 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 2px; }
.proposal__arrow { margin-top: 22px; color: var(--rb-text-secondary); }
.proposal__reason { color: var(--rb-text-primary); font-style: italic; overflow-wrap: anywhere; }
.proposal__wait { color: var(--rb-text-secondary); }

.warn__action { align-self: flex-start; }

.hint { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }

.form-error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-accent-text);
  font-size: 13px;
  line-height: 1.45;
}

.modal-enter-active,
.modal-leave-active { transition: opacity 0.18s ease; }

.modal-enter-from,
.modal-leave-to { opacity: 0; }

@media (max-width: 760px) {
  .toolbar__filters { flex-basis: 100%; }
  .search { max-width: none; flex: 1 1 100%; }
  .toolbar__actions { width: 100%; }
  .facts { grid-template-columns: minmax(0, 1fr); }
  .modal-overlay { padding: 10px; align-items: flex-end; }
  .modal-card__footer { flex-wrap: wrap; }
}

@media (max-width: 640px) {
  .processed-page { padding: 16px 16px 32px; }
  .page-header { flex-direction: column; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .spin { animation: none !important; }
}
</style>

<style scoped>
/* The system dropdown in a toolbar: a fixed width rather than the row's. */
.sel-filter { width: 180px; flex: none; }

/* ===== Refresh (project owner, 2026-10-28) ===== */

.note { position: relative; padding-right: 44px !important; }
.note__close { position: absolute; top: 8px; right: 8px; display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--rb-text-secondary); cursor: pointer; }
.note__close:hover { background: rgba(var(--rb-primary-rgb), .08); color: var(--rb-text-primary); }
.header-actions { display: flex; align-items: center; gap: 14px; }
.note-link { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text); cursor: pointer; }

/* Rows: the step trail, coloured chips, quieter waiting hand-overs. */
.trail { display: flex; gap: 3px; margin-top: 6px; }
.trail__dot { width: 14px; height: 4px; border-radius: 2px; background: var(--rb-border-strong); }
.trail__dot--done { background: var(--rb-success); }
.chip { display: inline-flex !important; align-items: center; gap: 5px; }
.chip__swatch { width: 7px; height: 7px; border-radius: 2px; background: var(--comp); }
.comp--red { --comp: rgb(var(--rb-accent-rgb)); }
.comp--amber { --comp: rgb(var(--rb-warning-rgb)); }
.comp--purple { --comp: rgb(var(--rb-purple-rgb, 124, 58, 237)); }
.comp--blue { --comp: rgb(var(--rb-primary-rgb)); }
.comp--grey { --comp: var(--rb-text-muted); }
.icon-btn__text { margin-left: 6px; font-size: 12.5px; font-weight: 700; }
.icon-btn--due { display: inline-flex !important; align-items: center; width: auto !important; padding: 0 10px !important; border-color: var(--rb-primary) !important; background: var(--rb-primary) !important; color: #fff !important; }
.icon-btn--due:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000) !important; }
/* A hand-over that cannot happen yet waits quietly, not as a faded blue button. */
.btn-handover:disabled { border: 1px solid var(--rb-border); background: var(--rb-surface); color: var(--rb-text-muted); opacity: 1; }
.processed-row:hover td { background: var(--rb-surface-hover); }
.row-actions { flex-wrap: nowrap; }
.icon-btn__text { margin-left: 5px !important; }
/* Room for "Print" beside the hand-over: the ID column gives a little. */
.c-id { width: 88px; }
.c-actions { width: 320px; }

/* What waits, one quiet line in the toolbar. */
.waiting { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin: 10px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.waiting__item { padding: 4px 10px; border: 1px solid var(--rb-border); border-radius: 999px; background: var(--rb-surface); line-height: 1.3; }
.waiting__item { display: inline-flex; align-items: center; gap: 6px; }
.waiting__item strong { font-weight: 800; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.waiting__dot { width: 8px; height: 8px; border-radius: 50%; }
.waiting__dot--testing { background: rgb(var(--rb-purple-rgb, 124, 58, 237)); }
.waiting__dot--label { background: var(--rb-warning); }
.waiting__dot--handover { background: var(--rb-primary); }
/* A narrower bench (the sidebar open): the table keeps room for its components
   and scrolls sideways rather than squeezing a column to nothing (2026-10-28). */
.processed-table th { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@container (max-width: 1120px) {
  .c-status { width: 140px; }
  .processed-table { min-width: 1040px; }
}
/* More room between the columns. */
.processed-table thead th { padding: 11px 16px; }
.processed-table tbody td { padding: 12px 16px; }
.processed-table th:first-child, .processed-table td:first-child { padding-left: 20px; }
.processed-table th:last-child, .processed-table td:last-child { padding-right: 20px; }
/* Widths grown by the extra padding, so no column loses its content. */
.c-id { width: 100px; }
.c-bag { width: 150px; }
.c-donor { width: 84px; }
.c-testing { width: 162px; }
.c-processed { width: 140px; }
.c-status { width: 168px; }
.c-actions { width: 340px; }

/*
  Most screens, and the sidebar open (2026-10-28): the table shares the room
  out by what each column holds instead of fixed widths, so no column is
  squeezed to "COMPO…"; the ID keeps its column, and a hand-over that
  cannot happen yet shows its icon alone (its title still says why).
*/
@container (max-width: 1300px) {
  .processed-table { table-layout: auto; min-width: 900px; }
  .processed-table th { width: auto !important; }
  .processed-table thead th { padding: 11px 12px; text-overflow: clip; }
  .processed-table tbody td { padding: 12px 12px; }
  .processed-table th:first-child, .processed-table td:first-child { padding-left: 16px; }
  .processed-table th:last-child, .processed-table td:last-child { padding-right: 16px; }
  /* The ID keeps its column here too (it was folded away below 1120px). */
  .c-id { display: table-cell; }
  .c-id, .c-bag, .c-processed, .c-actions { white-space: nowrap; }
  .c-components { min-width: 150px; }
  /* Actions and ID take only what their content needs (the 1% width of an
     auto table), so the rest of the width spreads between the other columns
     instead of pooling after the buttons (2026-10-31). */
  .processed-table th.c-actions, .processed-table td.c-actions,
  .processed-table th.c-id, .processed-table td.c-id { width: 1% !important; }
  .btn-handover:disabled { gap: 0; padding: 0 9px; font-size: 0; }
}
</style>
