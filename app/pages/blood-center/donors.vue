<template>
  <div class="donors-page">
    <!-- Skeleton loading state, the same as the other pages -->
    <div v-if="initialLoading" class="donors-inner" aria-busy="true" aria-label="Loading donors">
      <div class="skeleton-head">
        <div class="skeleton skeleton--header" />
        <div class="skeleton skeleton--sub" />
      </div>
      <div class="skeleton skeleton--panel" />
    </div>

    <div v-else class="donors-inner">
      <header class="header-row">
        <div>
          <h1 class="page-title">Donor Management</h1>
          <p class="page-subtitle">{{ listSummary }}</p>
        </div>
      </header>

      <div v-if="loadError" class="banner banner--error" role="alert">
        <AssetIcon name="circle-alert" :size="16" />
        <p class="banner__text">{{ loadError }}</p>
        <button type="button" class="btn-link" @click="loadDonors(pager.page)">Retry</button>
      </div>

      <div v-if="notice" class="banner" :class="`banner--${notice.tone}`" role="status">
        <AssetIcon :name="notice.tone === 'error' ? 'circle-alert' : 'circle-check-big'" :size="16" />
        <p class="banner__text">{{ notice.text }}</p>
        <button type="button" class="btn-link" @click="notice = null">Dismiss</button>
      </div>

      <section class="panel">
        <!-- Search and filters are the server's, so they reach every page and the export. -->
        <div class="toolbar">
          <div class="toolbar__filters">
            <label class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                v-model="search"
                type="search"
                class="search__input"
                placeholder="Search name / phone / email / ID"
                aria-label="Search donors by name, phone, email or ID number"
                @input="onSearchInput"
              >
            </label>

            <SelectField v-if="!contactOnly" v-model="bloodTypeId" class="sel-filter" size="sm" aria-label="Filter by blood group"
              :options="[{ value: '', label: 'All groups' }, ...bloodTypeOptions.map(bt => ({ value: bt.id, label: bt.code }))]" @change="loadDonors()" />

            <SelectField v-model="statusFilter" class="sel-filter" size="sm" aria-label="Filter by status"
              :options="[{ value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]"
              @change="loadDonors()" />
          </div>

          <div class="toolbar__actions">
            <span v-if="updatedAt" class="updated" :title="`List loaded at ${updatedAtLabel}`">
              <AssetIcon name="clock" :size="13" />
              Updated {{ updatedAtLabel }}
            </span>

            <button
              v-if="canViewProfile"
              type="button"
              class="btn-outline btn-outline--squeeze"
              :disabled="exporting || !pager.total"
              title="Export your centre's donors (CSV)"
              @click="exportList"
            >
              <AssetIcon name="download" :size="14" />
              <span class="btn-text">{{ exporting ? 'Exporting…' : 'Export' }}</span>
            </button>

            <button v-if="canManage" type="button" class="btn-outline btn-outline--accent" title="Email your centre's donors who can give again" @click="openRemind">
              <AssetIcon name="send" :size="14" />
              Remind Eligible
            </button>

            <button
              type="button"
              class="btn-outline btn-outline--squeeze"
              :disabled="loadingDonors"
              aria-label="Refresh the list"
              :title="updatedAt ? `Refresh · updated ${updatedAtLabel}` : 'Refresh'"
              @click="loadDonors(pager.page)"
            >
              <AssetIcon name="refresh-cw" :size="14" :class="{ spin: loadingDonors }" />
              <span class="btn-text">Refresh</span>
            </button>

            <button v-if="canManage" type="button" class="btn-primary" @click="openCreate">
              <AssetIcon name="plus" :size="15" />
              New Donor
            </button>
          </div>
        </div>

        <div class="table-wrap" :class="{ 'table-wrap--busy': loadingDonors && donors.length }">
          <table class="donor-table">
            <caption class="sr-only">Donors who have registered, booked or donated at this centre</caption>
            <thead>
              <tr>
                <th scope="col" class="c-id" :aria-sort="sort === 'name' ? 'none' : (sort === 'oldest' ? 'ascending' : 'descending')">
                  <button type="button" class="th-sort" @click="toggleIdSort">
                    ID
                    <AssetIcon :name="sort === 'oldest' ? 'chevron-up' : 'chevron-down'" :size="12" :class="{ 'th-sort__off': sort === 'name' }" />
                  </button>
                </th>
                <th scope="col" class="c-donor" :aria-sort="sort === 'name' ? 'ascending' : 'none'">
                  <button type="button" class="th-sort" @click="setSort('name')">
                    Donor
                    <AssetIcon name="chevron-down" :size="12" :class="{ 'th-sort__off': sort !== 'name' }" />
                  </button>
                </th>
                <th v-if="!contactOnly" scope="col" class="c-group">Group</th>
                <th scope="col" class="c-phone">Phone</th>
                <th v-if="!contactOnly" scope="col" class="c-address">Address</th>
                <th scope="col" class="c-last">Last donation</th>
                <th scope="col" class="c-total num">Total</th>
                <th scope="col" class="c-elig">Eligibility</th>
                <th scope="col" class="c-status">Status</th>
                <th scope="col" class="c-actions" :style="{ width: `${actionsWidth}px` }">Actions</th>
              </tr>
            </thead>

            <tbody v-if="loadingDonors && !donors.length">
              <tr v-for="n in 6" :key="'skr-' + n">
                <td :colspan="columnCount"><span class="skeleton skeleton--line" /></td>
              </tr>
            </tbody>

            <tbody v-else-if="!donors.length">
              <tr>
                <td :colspan="columnCount" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-state__icon"><AssetIcon :name="hasFilters ? 'search-x' : 'users'" :size="20" /></span>
                    <p class="empty-state__title">{{ hasFilters ? 'No donors match' : 'No donors yet' }}</p>
                    <p class="empty-state__text">
                      {{ hasFilters
                        ? 'Try another name, phone, email or ID, or clear the filters.'
                        : 'Donors appear here once they register, book or donate at this centre.' }}
                    </p>
                    <button v-if="hasFilters" type="button" class="btn-outline" @click="clearFilters">Clear filters</button>
                    <button v-else-if="canManage" type="button" class="btn-primary" @click="openCreate">
                      <AssetIcon name="plus" :size="15" />
                      New Donor
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-for="donor in donors" :key="donor.uuid" class="donor-row">
                <td class="c-id"><span class="donor-code">{{ donor.donorCode }}</span></td>
                <td class="c-donor">
                  <div class="donor-cell">
                    <span class="donor-cell__name">{{ donor.name }}</span>
                    <span v-if="donor.otherCentre" class="donor-cell__other" title="Not yet booked, registered or donated at your centre">Other centre</span>
                    <span v-if="donor.subline" class="donor-cell__sub">{{ donor.subline }}</span>
                    <!-- Takes the Phone column's place when the panel is too narrow for it. -->
                    <span v-if="donor.phone" class="donor-cell__sub donor-cell__phone">{{ donor.phone }}</span>
                  </div>
                </td>
                <td v-if="!contactOnly" class="c-group">
                  <span v-if="donor.bloodType" class="blood">{{ donor.bloodType }}</span>
                  <span v-else class="muted" title="Not typed yet">—</span>
                </td>
                <td class="c-phone nowrap">{{ donor.phone || '—' }}</td>
                <td v-if="!contactOnly" class="c-address" :title="donor.address">{{ donor.address || '—' }}</td>
                <td class="c-last nowrap">
                  {{ donor.lastDonation || '—' }}
                  <span v-if="donor.lastDonationDeclared" class="declared" title="As the donor declared it; not recorded in RedAgos">*</span>
                </td>
                <td class="c-total num">
                  <span class="total">
                    <span class="total__count">{{ donor.totalDonations }}</span>
                    <span v-if="donor.tier" class="tier" :class="`tier--${donor.tier.key}`">{{ donor.tier.label }}</span>
                  </span>
                </td>
                <td class="c-elig">
                  <span class="badge" :class="`badge--${donor.eligibility.tone}`" :title="donor.eligibility.hint">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ donor.eligibility.label }}
                  </span>
                </td>
                <td class="c-status">
                  <span class="badge" :class="donor.status === 'active' ? 'badge--ok' : 'badge--neutral'">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ donor.status === 'active' ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="c-actions">
                  <div class="row-actions">
                    <!-- Straight to the counter with this donor, no searching there: eligible donors only. -->
                    <template v-if="canStartDonation && donor.uuid">
                      <NuxtLink
                        v-if="!startDonationBlock(donor.eligibility)"
                        :to="counterLink(donor.uuid)"
                        class="icon-btn"
                        :aria-label="`Start a donation for ${donor.name} at the counter`"
                        title="Start donation"
                      >
                        <AssetIcon name="heart" :size="15" />
                      </NuxtLink>
                      <button
                        v-else
                        type="button"
                        class="icon-btn"
                        disabled
                        :aria-label="`Cannot start a donation for ${donor.name}. ${startDonationBlock(donor.eligibility)}`"
                        :title="startDonationBlock(donor.eligibility)"
                      >
                        <AssetIcon name="heart" :size="15" />
                      </button>
                    </template>
                    <button
                      v-if="canViewProfile && !donor.contactOnly"
                      type="button"
                      class="icon-btn"
                      :aria-label="`View ${donor.name}'s profile`"
                      title="View profile"
                      @click="openProfile(donor)"
                    >
                      <AssetIcon name="eye" :size="15" />
                    </button>
                    <button
                      v-if="canManage && !donor.contactOnly"
                      type="button"
                      class="icon-btn"
                      :aria-label="`Edit ${donor.name}`"
                      title="Edit"
                      @click="openEdit(donor.uuid)"
                    >
                      <AssetIcon name="pencil" :size="15" />
                    </button>
                    <button
                      v-if="canManage"
                      type="button"
                      class="icon-btn"
                      :disabled="!donor.email || donor.otherCentre"
                      :aria-label="emailBlock(donor) ? `${donor.name}: ${emailBlock(donor)}` : `Email ${donor.name}`"
                      :title="emailBlock(donor) || 'Send email'"
                      @click="openEmail(donor)"
                    >
                      <AssetIcon name="mail" :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer v-if="pager.total" class="pager">
          <span class="pager__info">Showing {{ pager.from || 0 }}–{{ pager.to || 0 }} of {{ pager.total }}</span>
          <div class="pager__btns">
            <button
              type="button"
              class="pager__btn"
              :disabled="pager.page <= 1 || loadingDonors"
              aria-label="Previous page"
              @click="loadDonors(pager.page - 1)"
            >
              <AssetIcon name="chevron-left" :size="15" />
            </button>
            <span class="pager__page">Page {{ pager.page }} of {{ pager.lastPage }}</span>
            <button
              type="button"
              class="pager__btn"
              :disabled="pager.page >= pager.lastPage || loadingDonors"
              aria-label="Next page"
              @click="loadDonors(pager.page + 1)"
            >
              <AssetIcon name="chevron-right" :size="15" />
            </button>
          </div>
        </footer>
      </section>
    </div>

    <!-- ============ REMIND ELIGIBLE ============ -->
    <Transition name="modal">
      <div v-if="remind.open" class="modal-overlay" @click.self="closeRemind">
        <div class="modal-card modal-card--sm" role="dialog" aria-modal="true" aria-labelledby="remind-title">
          <div class="modal-card__header">
            <h2 id="remind-title" class="modal-card__title">
              <AssetIcon name="triangle-alert" :size="17" />
              Email all eligible donors?
            </h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeRemind">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-card__body">
            <p v-if="remind.loading" class="modal-text">Counting eligible donors…</p>
            <template v-else-if="remind.preview">
              <p class="modal-text">
                An eligibility-reminder email will be sent to every active, eligible donor that has an email address
                <template v-if="hasFilters"> and matches the current filters</template>:
                <strong>{{ remind.preview.recipients }} donor{{ remind.preview.recipients === 1 ? '' : 's' }}</strong>.
              </p>
              <p v-if="remindSkipped" class="modal-hint">Not included: {{ remindSkipped }}.</p>
              <p class="modal-hint">It is sent in {{ centerLabel }}'s name, and replies go to your centre's email address.</p>
            </template>
            <p v-if="remind.error" class="form-error" role="alert">{{ remind.error }}</p>
          </div>

          <div class="modal-card__footer">
            <button type="button" class="btn-outline" @click="closeRemind">Cancel</button>
            <button
              type="button"
              class="btn-primary"
              :disabled="remind.loading || remind.sending || !remind.preview?.recipients"
              @click="sendReminders"
            >
              {{ remind.sending ? 'Sending…' : 'Send Reminders' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ============ REGISTER / EDIT DONOR ============ -->
    <Transition name="modal">
      <div v-if="form.open" class="modal-overlay" @click.self="closeForm">
        <div class="modal-card modal-card--form" role="dialog" aria-modal="true" aria-labelledby="donor-form-title">
          <div class="modal-card__header">
            <h2 id="donor-form-title" class="modal-card__title">
              <AssetIcon name="user" :size="17" />
              {{ form.mode === 'create' ? 'Register Donor' : `Edit Donor ${form.donorCode}` }}
            </h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeForm">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <form id="donor-form" class="modal-card__body modal-form" novalidate @submit.prevent="submitForm">
            <p v-if="form.loading" class="modal-text">Loading the donor's record…</p>

            <template v-else>
              <p v-if="form.error" class="form-error" role="alert">{{ form.error }}</p>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="d-first">First name <span class="req">*</span></label>
                  <input id="d-first" v-model="form.data.first_name" type="text" class="form-input" maxlength="150" :disabled="!form.editable.identity" required>
                  <p v-if="fieldError('first_name')" class="field-error">{{ fieldError('first_name') }}</p>
                </div>
                <div class="form-group">
                  <label class="form-label" for="d-last">Last name <span class="req">*</span></label>
                  <input id="d-last" v-model="form.data.last_name" type="text" class="form-input" maxlength="150" :disabled="!form.editable.identity" required>
                  <p v-if="fieldError('last_name')" class="field-error">{{ fieldError('last_name') }}</p>
                </div>
              </div>
              <p v-if="!form.editable.identity" class="form-hint form-hint--lock">
                <AssetIcon name="lock" :size="12" />
                Name and date of birth were verified against the donor's ID.
              </p>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="d-gender">Gender</label>
                  <SelectField id="d-gender" v-model="form.data.gender" :options="[{ value: '', label: 'Not given' }, ...GENDER_OPTIONS]" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="d-birth">Date of birth <span class="req">*</span></label>
                  <DatePicker id="d-birth" v-model="form.data.birth_date" :max="todayIso" :disabled="!form.editable.identity" :invalid="!!fieldError('birth_date')" />
                  <p v-if="fieldError('birth_date')" class="field-error">{{ fieldError('birth_date') }}</p>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="d-bt">Blood group</label>
                  <SelectField id="d-bt" v-model="form.data.blood_type_id"
                    :options="[{ value: '', label: 'Unknown — the laboratory will type it' }, ...bloodTypeOptions.map(bt => ({ value: String(bt.id), label: bt.code }))]" />
                  <p v-if="fieldError('blood_type_id')" class="field-error">{{ fieldError('blood_type_id') }}</p>
                </div>
                <div class="form-group">
                  <label class="form-label" for="d-id">Valid ID number <span v-if="form.mode === 'create'" class="req">*</span></label>
                  <input
                    id="d-id"
                    v-model="form.data.valid_id_number"
                    type="text"
                    class="form-input mono"
                    maxlength="50"
                    placeholder="As printed on the ID card"
                    :disabled="form.mode === 'edit'"
                    :required="form.mode === 'create'"
                  >
                  <p v-if="fieldError('valid_id_number')" class="field-error">{{ fieldError('valid_id_number') }}</p>
                  <p v-else-if="form.mode === 'create'" class="form-hint">Each ID registers one donor, so no one is added twice.</p>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="d-phone">Phone</label>
                  <input id="d-phone" v-model="form.data.phone" type="tel" class="form-input" placeholder="09XXXXXXXXX" :disabled="!form.editable.contact">
                  <p v-if="fieldError('phone')" class="field-error">{{ fieldError('phone') }}</p>
                </div>
                <div class="form-group">
                  <label class="form-label" for="d-email">Email</label>
                  <input id="d-email" v-model="form.data.email" type="email" class="form-input" maxlength="150" :disabled="!form.editable.contact">
                  <p v-if="fieldError('email')" class="field-error">{{ fieldError('email') }}</p>
                </div>
              </div>
              <p v-if="!form.editable.contact" class="form-hint form-hint--lock">
                <AssetIcon name="lock" :size="12" />
                The donor manages their phone, email and photo from their own account.
              </p>

              <div class="form-group">
                <label class="form-label" for="d-address">Address</label>
                <input id="d-address" v-model="form.data.address" type="text" class="form-input" maxlength="255" placeholder="House no., street, barangay, city">
                <p v-if="fieldError('address')" class="field-error">{{ fieldError('address') }}</p>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="d-occupation">Occupation</label>
                  <input id="d-occupation" v-model="form.data.occupation" type="text" class="form-input" maxlength="100">
                </div>
                <div class="form-group">
                  <label class="form-label" for="d-last-donation">Last donation date</label>
                  <DatePicker id="d-last-donation" v-model="form.data.last_donation_date" :max="todayIso" />
                  <p v-if="fieldError('last_donation_date')" class="field-error">{{ fieldError('last_donation_date') }}</p>
                  <p v-else class="form-hint">As the donor recalls it. A donation recorded here always wins.</p>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="d-status">Status</label>
                  <SelectField id="d-status" v-model="form.data.status" :options="[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]" />
                  <p class="form-hint">Inactive donors are not sent eligibility reminders.</p>
                </div>
                <div class="form-group">
                  <span class="form-label" id="d-photo-label">Donor photo <span class="form-optional">optional</span></span>
                  <div class="photo-field">
                    <span class="avatar avatar--md" aria-hidden="true">
                      <img v-if="form.photoPreview" :src="form.photoPreview" alt="">
                      <template v-else>{{ initials(`${form.data.first_name} ${form.data.last_name}`.trim()) }}</template>
                    </span>
                    <label v-if="form.editable.photo" class="btn-outline btn-outline--sm photo-field__pick">
                      <AssetIcon name="camera" :size="13" />
                      {{ form.photoFile ? 'Change' : 'Choose photo' }}
                      <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" aria-labelledby="d-photo-label" @change="onPhotoPicked">
                    </label>
                    <span v-else class="form-hint">Set by the donor</span>
                  </div>
                  <p v-if="fieldError('photo')" class="field-error">{{ fieldError('photo') }}</p>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="d-notes">Notes</label>
                <textarea id="d-notes" v-model="form.data.notes" class="form-input form-textarea" rows="3" maxlength="2000" placeholder="Seen only by staff at this centre" />
              </div>
            </template>
          </form>

          <div class="modal-card__footer">
            <button type="button" class="btn-outline" @click="closeForm">Cancel</button>
            <button type="submit" form="donor-form" class="btn-primary" :disabled="form.saving || form.loading || !canSaveForm">
              <AssetIcon name="check" :size="15" />
              {{ form.saving ? 'Saving…' : 'Save Donor' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ============ DONOR PROFILE ============ -->
    <Transition name="modal">
      <div v-if="profileView.open" class="modal-overlay" @click.self="closeProfile">
        <div class="modal-card modal-card--profile" role="dialog" aria-modal="true" aria-labelledby="profile-title">
          <div class="modal-card__header">
            <h2 id="profile-title" class="modal-card__title">
              <AssetIcon name="user" :size="17" />
              Donor Profile
            </h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeProfile">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-card__body">
            <div v-if="profileView.loading" class="skeleton skeleton--hero" />
            <div v-else-if="profileView.error" class="banner banner--error" role="alert">
              <AssetIcon name="circle-alert" :size="16" />
              <p class="banner__text">{{ profileView.error }}</p>
              <button type="button" class="btn-link" @click="loadProfile(profileView.uuid)">Retry</button>
            </div>

            <template v-else-if="profile">
              <div class="hero">
                <div class="hero__who">
                  <span class="avatar avatar--lg" aria-hidden="true">
                    <img v-if="profile.photoUrl" :src="profile.photoUrl" alt="">
                    <template v-else>{{ initials(profile.name) }}</template>
                  </span>
                  <div class="hero__text">
                    <div class="hero__name-row">
                      <p class="hero__name">{{ profile.name }}</p>
                      <span v-if="profile.bloodType" class="blood">{{ profile.bloodType }}</span>
                    </div>
                    <p class="hero__meta">{{ profile.metaLine }}</p>
                    <div class="hero__badges">
                      <span class="badge" :class="`badge--${profile.eligibility.tone}`" :title="profile.eligibility.hint">
                        <span class="badge__dot" aria-hidden="true" />
                        {{ profile.eligibility.key === 'waiting' ? `Eligible from ${profile.nextEligible}` : profile.eligibility.label }}
                      </span>
                      <span v-if="profile.tier" class="tier" :class="`tier--${profile.tier.key}`">
                        {{ profile.tier.label }} Donor ({{ profile.totalDonations }})
                      </span>
                      <span v-if="profile.status === 'inactive'" class="badge badge--neutral">
                        <span class="badge__dot" aria-hidden="true" />
                        Inactive
                      </span>
                    </div>
                  </div>
                </div>

                <div v-if="(canManage || canStartDonation) && !profile.restricted" class="hero__actions">
                  <template v-if="canStartDonation && profile.uuid">
                    <NuxtLink
                      v-if="!startDonationBlock(profile.eligibility)"
                      :to="counterLink(profile.uuid)"
                      class="btn-outline btn-outline--sm"
                    >
                      <AssetIcon name="heart" :size="13" />
                      Start Donation
                    </NuxtLink>
                    <button
                      v-else
                      type="button"
                      class="btn-outline btn-outline--sm"
                      disabled
                      :title="startDonationBlock(profile.eligibility)"
                    >
                      <AssetIcon name="heart" :size="13" />
                      Start Donation
                    </button>
                  </template>
                  <template v-if="canManage">
                    <button type="button" class="btn-outline btn-outline--sm" :disabled="!profile.email || profile.otherCentre" :title="emailBlock(profile) || undefined" @click="openEmail(profile)">
                      <AssetIcon name="mail" :size="13" />
                      Email Donor
                    </button>
                    <button type="button" class="btn-outline btn-outline--sm" @click="openEdit(profile.uuid)">
                      <AssetIcon name="pencil" :size="13" />
                      Edit
                    </button>
                  </template>
                </div>
              </div>

              <p v-if="profile.restricted" class="notice">
                <AssetIcon name="lock" :size="14" />
                <span>{{ profile.restrictionNote }}</span>
              </p>

              <dl class="facts">
                <div class="fact"><dt>Phone</dt><dd>{{ profile.phone || '—' }}</dd></div>
                <div class="fact">
                  <dt>Email</dt>
                  <dd>
                    {{ profile.email || '—' }}
                    <span v-if="profile.email && profile.emailVerified === false" class="fact__sub">Not verified</span>
                  </dd>
                </div>
                <div class="fact"><dt>Occupation</dt><dd>{{ profile.occupation || '—' }}</dd></div>
                <div class="fact">
                  <dt>Last donation</dt>
                  <dd>
                    {{ profile.lastDonation || 'None recorded' }}
                    <span v-if="profile.lastDonationDeclared" class="fact__sub">As declared by the donor</span>
                  </dd>
                </div>
                <div class="fact"><dt>Next eligible</dt><dd>{{ profile.nextEligible || 'Now' }}</dd></div>
                <div v-if="!profile.restricted" class="fact fact--wide"><dt>Address</dt><dd>{{ profile.address || '—' }}</dd></div>
                <div v-if="profile.notes" class="fact fact--full"><dt>Notes</dt><dd class="fact__notes">{{ profile.notes }}</dd></div>
              </dl>

              <!-- The portal sign-in the desk gives a walk-in donor. On screen only, never printed. -->
              <section v-if="!profile.restricted" class="sub-section">
                <h3 class="sub-section__title">
                  <AssetIcon name="log-in" :size="14" />
                  Portal Sign-In
                </h3>

                <div class="signin-status">
                  <span class="badge" :class="`badge--${profile.signIn.tone}`">
                    <span class="badge__dot" aria-hidden="true" />
                    {{ profile.signIn.label }}
                  </span>
                  <span class="sub-section__note">{{ profile.signIn.note }}</span>
                </div>

                <template v-if="canManage && profile.signIn.canIssue">
                  <div v-if="signInView.confirming" class="signin-confirm">
                    <p class="modal-hint">
                      This replaces the old password and signs {{ profile.firstName }} out of the portal.
                    </p>
                    <div class="signin-confirm__actions">
                      <button type="button" class="btn-outline btn-outline--sm" :disabled="signInView.issuing" @click="signInView.confirming = false">
                        Cancel
                      </button>
                      <button type="button" class="btn-outline btn-outline--sm btn-outline--accent" :disabled="signInView.issuing" @click="giveSignIn(profile)">
                        <AssetIcon name="refresh-cw" :size="13" />
                        {{ signInView.issuing ? 'Giving…' : 'Give New Password' }}
                      </button>
                    </div>
                  </div>
                  <button
                    v-else
                    type="button"
                    class="btn-outline btn-outline--sm signin-give"
                    :disabled="signInView.issuing"
                    @click="profile.signIn.issued ? (signInView.confirming = true) : giveSignIn(profile)"
                  >
                    <AssetIcon :name="profile.signIn.issued ? 'refresh-cw' : 'log-in'" :size="13" />
                    {{ signInView.issuing ? 'Giving…' : (profile.signIn.issued ? 'Give New Password' : 'Give Sign-In') }}
                  </button>
                </template>
                <p v-if="signInView.error" class="form-error" role="alert">{{ signInView.error }}</p>
              </section>

              <!-- The history carries deferral reasons and final results: the physician's alone. -->
              <section v-if="!profile.restricted" class="sub-section">
                <h3 class="sub-section__title">
                  <AssetIcon name="heart" :size="14" />
                  Donation History
                </h3>

                <p v-if="!canViewHistory" class="sub-section__note">
                  Donation history is part of the donor's clinical record, which the screening physician reads.
                  {{ profile.donationsHere ? `${profile.donationsHere} visit${profile.donationsHere === 1 ? '' : 's'} recorded at this centre.` : '' }}
                </p>
                <div v-else-if="profileView.historyLoading" class="skeleton skeleton--line skeleton--tall" />
                <p v-else-if="profileView.historyError" class="sub-section__note">{{ profileView.historyError }}</p>
                <p v-else-if="!history.length" class="sub-section__note">
                  No donations at this centre yet.
                  <template v-if="profile.totalDonations">
                    {{ profile.totalDonations }} at other centres; their details stay with those centres.
                  </template>
                </p>
                <div v-else class="history-wrap">
                  <table class="history-table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Bag</th>
                        <th scope="col">Component</th>
                        <th scope="col">Center</th>
                        <th scope="col">Screening</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in history" :key="item.id">
                        <td class="nowrap">{{ item.date }}</td>
                        <td class="mono strong">{{ item.bag || '—' }}</td>
                        <td>{{ item.components || '—' }}</td>
                        <td>{{ item.center || '—' }}</td>
                        <td>
                          <span class="badge" :class="`badge--${item.tone}`" :title="item.lab || undefined">
                            <span class="badge__dot" aria-hidden="true" />
                            {{ item.statusLabel }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section v-if="!profile.restricted" class="sub-section">
                <h3 class="sub-section__title">
                  <AssetIcon name="circle-x" :size="14" />
                  Deferrals
                </h3>

                <ul v-if="deferrals.length" class="deferral-list">
                  <li v-for="d in deferrals" :key="d.key" class="deferral">
                    <span class="badge" :class="`badge--${d.tone}`">
                      <span class="badge__dot" aria-hidden="true" />
                      {{ d.label }}
                    </span>
                    <span class="deferral__date">{{ d.date }}</span>
                    <!-- A screening's code, its reason folded: the screen may face the donor. -->
                    <DeferralCodeTag v-if="d.coded && (d.code || d.reason)" :code="d.code" :reason="d.reason" />
                    <span v-else-if="d.reason" class="deferral__reason">{{ d.reason }}</span>
                  </li>
                </ul>
                <p v-else class="sub-section__note">
                  {{ canViewHistory ? 'No deferrals on record.' : 'No deferral stands on this donor\'s record.' }}
                </p>
              </section>
            </template>
          </div>

          <div class="modal-card__footer">
            <button type="button" class="btn-outline" @click="closeProfile">Close</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ============ PORTAL SIGN-IN, shown once ============ -->
    <!-- No backdrop click and no Escape: closing it is the last sight of the password. -->
    <Transition name="modal">
      <div v-if="credentials" class="modal-overlay modal-overlay--top">
        <div class="modal-card modal-card--sm" role="dialog" aria-modal="true" aria-labelledby="credentials-title">
          <div class="modal-card__header">
            <h2 id="credentials-title" class="modal-card__title">
              <AssetIcon name="log-in" :size="17" />
              Portal Sign-In
            </h2>
          </div>

          <div class="modal-card__body">
            <p class="modal-text">
              <template v-if="credentials.registered"><strong>{{ credentials.name }}</strong> has been registered. </template>
              Tell {{ credentials.registered ? 'them' : credentials.name }} these to sign in to the RedAgos portal:
            </p>

            <dl class="credentials">
              <div class="credential">
                <dt>Donor code</dt>
                <dd>
                  <span class="credential__value">{{ credentials.donorCode }}</span>
                  <button type="button" class="copy-btn" aria-label="Copy donor code" @click="copyCredential('code', credentials.donorCode)">
                    <AssetIcon :name="credentials.copied === 'code' ? 'check' : 'clipboard'" :size="14" />
                    {{ credentials.copied === 'code' ? 'Copied' : 'Copy' }}
                  </button>
                </dd>
              </div>
              <div v-if="credentials.email" class="credential">
                <dt>Or email</dt>
                <dd>
                  <span class="credential__value credential__value--email">{{ credentials.email }}</span>
                </dd>
              </div>
              <div class="credential credential--key">
                <dt>Temporary password</dt>
                <dd>
                  <span class="credential__value credential__value--key">{{ credentials.password }}</span>
                  <button type="button" class="copy-btn" aria-label="Copy temporary password" @click="copyCredential('password', credentials.password)">
                    <AssetIcon :name="credentials.copied === 'password' ? 'check' : 'clipboard'" :size="14" />
                    {{ credentials.copied === 'password' ? 'Copied' : 'Copy' }}
                  </button>
                </dd>
              </div>
            </dl>

            <p class="modal-hint">
              Shown only this once. The donor chooses their own password the first time they sign in.
              If they lose this one, give a new one from their Donor Profile.
            </p>
          </div>

          <div class="modal-card__footer">
            <button type="button" class="btn-primary" @click="closeCredentials">Done</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ============ SEND EMAIL ============ -->
    <Transition name="modal">
      <div v-if="emailView.open" class="modal-overlay modal-overlay--top" @click.self="closeEmail">
        <div class="modal-card modal-card--sm" role="dialog" aria-modal="true" aria-labelledby="email-title">
          <div class="modal-card__header">
            <h2 id="email-title" class="modal-card__title">
              <AssetIcon name="mail" :size="17" />
              Send Email to Donor
            </h2>
            <button type="button" class="modal-card__close" aria-label="Close" @click="closeEmail">
              <AssetIcon name="x" :size="18" />
            </button>
          </div>

          <div class="modal-card__body">
            <p class="modal-text">
              Choose the email to send to <strong>{{ emailView.name }}</strong>.
              Templates are editable in
              <NuxtLink v-if="canEditTemplates" to="/blood-center/settings?tab=center" class="inline-link">Settings</NuxtLink>
              <template v-else>Settings by your centre's admin</template>.
            </p>

            <div class="email-choices">
              <button
                type="button"
                class="btn-primary"
                :disabled="Boolean(emailView.sending) || !emailView.canThank"
                :title="emailView.canThank ? undefined : 'No donation at this centre to thank them for yet'"
                @click="sendEmail('thank_you')"
              >
                <AssetIcon name="heart" :size="14" />
                {{ emailView.sending === 'thank_you' ? 'Sending…' : 'Thank-You' }}
              </button>
              <button
                type="button"
                class="btn-outline btn-outline--accent"
                :disabled="Boolean(emailView.sending) || Boolean(emailView.remindBlocked)"
                :title="emailView.remindBlocked || undefined"
                @click="sendEmail('eligibility_reminder')"
              >
                <AssetIcon name="clock" :size="14" />
                {{ emailView.sending === 'eligibility_reminder' ? 'Sending…' : 'Eligibility Reminder' }}
              </button>
            </div>

            <p v-if="emailView.remindBlocked" class="modal-hint">{{ emailView.remindBlocked }}</p>
            <p v-if="emailView.error" class="form-error" role="alert">{{ emailView.error }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import DatePicker from '~/components/common/DatePicker.vue'
import SelectField from '~/components/common/SelectField.vue'
import { resolveApiAssetURL } from '~/api/BaseService'
import AssetIcon from '~/components/common/AssetIcon.vue'
import DeferralCodeTag from '~/components/BloodCenter/DeferralCodeTag.vue'
import {
  GENDER_OPTIONS,
  blankDonorForm,
  donorFormFrom,
  donorSubline,
  donorTier,
  editPayload,
  eligibilityBadge,
  exportFilename,
  formatPhone,
  formatShortDate,
  ageFrom,
  genderLabel,
  initials,
  orderBloodGroups,
  registerPayload,
  reminderSkipSummary,
  startDonationBlock,
} from '~/utils/donorRecords'
import { COLLECTION_ABILITIES } from '~/composables/useBloodCenterNav'
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  // donors.view_contact, which Recruitment also holds: the server answers them
  // with a contact list, and the profile and history below stay hidden.
  requires: 'donors.view_contact',
})

const { can, user } = useUser()
const canViewProfile = computed(() => can('donors.view'))
const canViewHistory = computed(() => can('donors.view_clinical'))
const canManage = computed(() => can('donors.manage'))
const canEditTemplates = computed(() => can('center.configure'))

/*
 * Start a donation for a donor from this list (project owner, 2026-10-24):
 * the counter opens with them already identified, with today's booking if
 * they have one (it no longer searches for anyone itself). For those who can
 * use the counter and bring a donor up there, and only for an eligible donor
 * (startDonationBlock says why not otherwise).
 */
const canStartDonation = computed(() => can('appointments.verify') && can(COLLECTION_ABILITIES))

function counterLink(donorUuid) {
  return { path: '/blood-center/donation', query: { donor: donorUuid } }
}

/**
 * API SHAPE (tinuod nga mga ruta, /api/blood-center/donors)
 * -------------------------------------------------------------------------
 *  GET   /donors?search=&blood_type_id=&status=&sort=&page=&per_page=
 *    -> Laravel paginator; data: [{ uuid, donor_code, full_name, blood_type,
 *       gender, birth_date, phone, email, address, total_donations,
 *       last_donation_at, last_donation_declared, next_eligible_date,
 *       eligibility, deferral, status, contact_only? }]
 *  GET   /donors/export?(same filters)        -> CSV (Excel)
 *  GET   /donors/eligibility-reminders         -> { recipients, skipped }
 *  POST  /donors/eligibility-reminders         -> { message, sent, failed, skipped }
 *  GET   /donors/{uuid}                        -> the profile, with `editable`
 *  GET   /donors/{uuid}/history                -> { donations: [...] } (clinical)
 *  POST  /donors                               -> register
 *  PATCH /donors/{uuid}                        -> only the changed fields
 *  POST  /donors/{uuid}/photo                  -> FormData { photo }
 *  POST  /donors/{uuid}/email                  { template }
 *  POST  /donors/{uuid}/sign-in                -> { donor_code, email,
 *       temporary_password, reissued }: shown once, on screen, never printed
 * -------------------------------------------------------------------------
 */

const PER_PAGE = 25

const initialLoading = ref(true)
const loadError = ref('')
// { tone: 'success' | 'error', text }
const notice = ref(null)

const todayIso = computed(() => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})

const centerLabel = computed(() => user.value?.facility?.name || 'your centre')

function errorMessage(err, fallback) {
  return Object.values(err?.errors ?? err?.data?.errors ?? {}).flat()[0] || err?.message || fallback
}

/* ---------- reference data (blood groups) ---------- */

const bloodTypeOptions = ref([])

async function loadReference() {
  try {
    const data = await bloodCenterService.referenceData()
    bloodTypeOptions.value = orderBloodGroups((data?.blood_types ?? []).map((bt) => ({ id: bt.id, code: bt.code ?? bt.label })))
  } catch {
    // Without it the blood-group filter and picker are empty, nothing else.
    bloodTypeOptions.value = []
  }
}

/* ---------- list ---------- */

const donors = ref([])
const loadingDonors = ref(false)
const search = ref('')
const bloodTypeId = ref('')
const statusFilter = ref('')
const sort = ref('newest')
const updatedAt = ref(null)
const pager = reactive({ page: 1, lastPage: 1, total: 0, from: 0, to: 0 })

const contactOnly = computed(() => donors.value.length > 0 && donors.value.every((d) => d.contactOnly))
const columnCount = computed(() => (contactOnly.value ? 8 : 10))

// The table has fixed column widths so it fits its panel. The actions column
// is sized for the buttons this role actually sees: 30px each, 6px apart,
// plus the cell's padding. Never narrower than its "Actions" heading.
const actionsWidth = computed(() => {
  const buttons = (canStartDonation.value ? 1 : 0) + (canViewProfile.value ? 1 : 0) + (canManage.value ? 2 : 0)
  return Math.max(84, 26 + buttons * 30 + Math.max(0, buttons - 1) * 6)
})
const hasFilters = computed(() => Boolean(search.value.trim() || bloodTypeId.value || statusFilter.value))

const updatedAtLabel = computed(() => updatedAt.value
  ? updatedAt.value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  : '')

// Every donor in RedAgos, whichever centre they gave at (project owner,
// 2026-10-25). Export and Remind Eligible stay with this centre's own.
const listSummary = computed(() => {
  if (!pager.total && !hasFilters.value) return 'Every donor in RedAgos, at any blood centre.'
  if (hasFilters.value) return `${pager.total} donor${pager.total === 1 ? '' : 's'} match the filters`
  return `${pager.total} donor${pager.total === 1 ? '' : 's'} in RedAgos, at any blood centre`
})

/** Why a donor cannot be emailed from here, or ''. */
function emailBlock(donor) {
  if (donor.otherCentre) return 'Emails go only to donors who have booked, registered or donated at your centre'
  if (!donor.email) return 'No email address on record'
  return ''
}

/** The filters as the server reads them, shared by the list, export and reminders. */
function filterParams() {
  const params = { sort: sort.value }
  if (search.value.trim()) params.search = search.value.trim()
  if (bloodTypeId.value) params.blood_type_id = bloodTypeId.value
  if (statusFilter.value) params.status = statusFilter.value
  return params
}

function mapDonor(row) {
  return {
    uuid: row.uuid,
    donorCode: row.donor_code || '—',
    name: row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed donor',
    subline: donorSubline(row.gender, row.birth_date),
    bloodType: row.blood_type || '',
    phone: formatPhone(row.phone),
    email: row.email || '',
    address: row.address || '',
    totalDonations: row.total_donations ?? 0,
    donationsHere: row.donations_here ?? 0,
    tier: donorTier(row.total_donations),
    lastDonation: formatShortDate(row.last_donation_at),
    lastDonationDeclared: Boolean(row.last_donation_declared),
    eligibility: eligibilityBadge(row),
    deferral: row.deferral ?? null,
    status: row.status || 'active',
    contactOnly: Boolean(row.contact_only),
    otherCentre: row.scope === 'cross_facility',
  }
}

async function loadDonors(page = 1) {
  loadingDonors.value = true
  loadError.value = ''
  try {
    const res = await bloodCenterService.donors({ ...filterParams(), page, per_page: PER_PAGE })
    const rows = Array.isArray(res) ? res : (res?.data ?? [])

    donors.value = rows.map(mapDonor)
    Object.assign(pager, {
      page: res?.current_page ?? page,
      lastPage: res?.last_page ?? 1,
      total: res?.total ?? rows.length,
      from: res?.from ?? (rows.length ? 1 : 0),
      to: res?.to ?? rows.length,
    })
    updatedAt.value = new Date()
  } catch (err) {
    loadError.value = err?.message || 'Could not load donor records.'
    console.error(err)
  } finally {
    loadingDonors.value = false
  }
}

let searchTimer = null

// Typing waits a beat before asking the server, rather than once per key.
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadDonors(), 300)
}

function clearFilters() {
  search.value = ''
  bloodTypeId.value = ''
  statusFilter.value = ''
  loadDonors()
}

function setSort(value) {
  sort.value = value
  loadDonors()
}

function toggleIdSort() {
  setSort(sort.value === 'newest' ? 'oldest' : 'newest')
}

/* ---------- export ---------- */

const exporting = ref(false)

async function exportList() {
  exporting.value = true
  try {
    const blob = await bloodCenterService.exportDonors(filterParams())
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFilename()
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    notice.value = { tone: 'error', text: err?.status === 403 ? 'You are not allowed to export the donor list.' : 'Could not export the donor list. Please try again.' }
  } finally {
    exporting.value = false
  }
}

/* ---------- remind eligible ---------- */

const remind = reactive({ open: false, loading: false, sending: false, preview: null, error: '' })
const remindSkipped = computed(() => reminderSkipSummary(remind.preview?.skipped))

async function openRemind() {
  Object.assign(remind, { open: true, loading: true, sending: false, preview: null, error: '' })
  try {
    remind.preview = await bloodCenterService.donorReminderPreview(filterParams())
  } catch (err) {
    remind.error = errorMessage(err, 'Could not count the eligible donors.')
  } finally {
    remind.loading = false
  }
}

function closeRemind() {
  if (remind.sending) return
  remind.open = false
}

async function sendReminders() {
  remind.sending = true
  remind.error = ''
  try {
    const res = await bloodCenterService.sendDonorReminders(filterParams())
    remind.sending = false
    remind.open = false
    notice.value = {
      tone: res?.failed ? 'error' : 'success',
      text: res?.failed ? `${res.message} ${res.failed} could not be sent; try again later.` : (res?.message || 'Reminders sent.'),
    }
  } catch (err) {
    remind.error = errorMessage(err, 'Could not send the reminders. Please try again.')
    remind.sending = false
  }
}

/* ---------- profile ---------- */

const profileView = reactive({ open: false, uuid: null, loading: false, error: '', historyLoading: false, historyError: '' })
const profile = ref(null)
const history = ref([])

function mapProfile(data) {
  const base = mapDonor({
    ...data,
    total_donations: data?.total_donations ?? data?.donation_summary?.total_donations,
    last_donation_at: data?.last_donation_at ?? data?.donation_summary?.last_donation_at,
    next_eligible_date: data?.next_eligible_date ?? data?.donation_summary?.next_eligible_date,
  })

  const age = ageFrom(data?.birth_date)

  return {
    ...base,
    metaLine: [
      base.donorCode,
      genderLabel(data?.gender),
      age === null ? '' : `${age} years`,
    ].filter(Boolean).join(' · '),
    photoUrl: resolveApiAssetURL(data?.photo_url),
    occupation: data?.occupation ?? '',
    notes: data?.notes ?? '',
    emailVerified: data?.email_verified,
    nextEligible: base.eligibility.key === 'waiting' ? formatShortDate(data?.next_eligible_date ?? data?.donation_summary?.next_eligible_date) : '',
    restricted: Boolean(data?.restricted),
    restrictionNote: data?.restriction_note ?? '',
    acceptsReminders: data?.accepts_eligibility_reminders !== false,
    editable: data?.editable ?? { identity: false, contact: false, photo: false },
    firstName: data?.first_name || base.name,
    signIn: signInStatus(data),
  }
}

/**
 * The Portal Sign-In section: where the desk's sign-in stands for this donor.
 * `can_issue` is the server's own rule (no confirmed email, account usable).
 */
function signInStatus(data) {
  const s = data?.sign_in ?? {}
  const issued = Boolean(s.issued_at)
  const canIssue = Boolean(s.can_issue)
  const base = { issued, canIssue }
  const forgot = canIssue ? ' If they forget it, give a new one.' : ''

  if (data?.account_status === 'suspended' || data?.account_status === 'deactivated') {
    return { ...base, tone: 'neutral', label: 'Unavailable', note: 'This account is suspended or deactivated.' }
  }
  if (s.claimed) {
    return { ...base, tone: 'ok', label: 'Signed in', note: `The donor has signed in and set their own password.${forgot}` }
  }
  if (issued) {
    return { ...base, tone: 'warn', label: 'Not signed in yet', note: `Given ${formatShortDate(s.issued_at)}. If the donor lost the password, give a new one.` }
  }
  if (!canIssue && data?.email_verified) {
    return { ...base, tone: 'info', label: 'Own email', note: 'Signs in with their own confirmed email, and resets a forgotten password from the sign-in page.' }
  }
  return { ...base, tone: 'neutral', label: 'No sign-in yet', note: 'Give one so the donor can use the RedAgos portal without registering.' }
}

/* ---------- portal sign-in ---------- */

const signInView = reactive({ issuing: false, confirming: false, error: '' })

// { name, donorCode, email, password, registered, copied }. Dropped on Done:
// the server keeps only a hash, so this is the one time anyone sees it.
const credentials = ref(null)
let copiedTimer = null

function showCredentials(data, name, registered) {
  credentials.value = {
    name,
    donorCode: data?.donor_code ?? '',
    email: data?.email ?? '',
    password: data?.temporary_password ?? '',
    registered,
    copied: '',
  }
}

function closeCredentials() {
  clearTimeout(copiedTimer)
  credentials.value = null
}

async function copyCredential(key, text) {
  try {
    await navigator.clipboard.writeText(text)
    credentials.value.copied = key
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { if (credentials.value) credentials.value.copied = '' }, 2000)
  } catch {
    // No clipboard (an insecure origin or a refused permission): the value is
    // on screen to read out, which is the point anyway.
  }
}

async function giveSignIn(p) {
  if (signInView.issuing) return
  signInView.issuing = true
  signInView.error = ''

  try {
    const res = await bloodCenterService.issueDonorSignIn(p.uuid)
    signInView.confirming = false
    showCredentials(res?.data ?? res, p.name, false)
    await loadProfile(p.uuid)
  } catch (err) {
    signInView.error = err?.message || 'Could not give the sign-in. Please try again.'
  } finally {
    signInView.issuing = false
  }
}

const SCREENING_TONE = { completed: 'ok', collected: 'ok', tested: 'ok', rejected: 'crit' }

/** One donation as the history table shows it. */
function mapEvent(d) {
  const s = d.screening
  const deferred = s?.is_deferral || d.laboratory_deferral

  return {
    id: d.id,
    date: formatShortDate(d.donation_date),
    bag: d.bag ?? '',
    components: (d.components ?? []).join(', '),
    center: d.center ?? '',
    statusLabel: deferred ? 'Deferred' : (d.status === 'completed' ? 'Cleared' : (d.status_label || 'Pending')),
    tone: deferred ? 'crit' : (SCREENING_TONE[d.status] ?? 'warn'),
    lab: d.laboratory ? [d.laboratory.result_label, d.laboratory.blood_type ? `typed ${d.laboratory.blood_type}` : ''].filter(Boolean).join(' · ') : '',
    raw: d,
  }
}

/**
 * The deferrals section. With the clinical record: every deferred visit, with
 * its reason. Without it: the one deferral standing now, outcome and date only.
 */
const deferrals = computed(() => {
  if (!profile.value) return []

  if (canViewHistory.value) {
    return history.value.flatMap((item) => {
      const d = item.raw
      const rows = []
      if (d.screening?.is_deferral) {
        rows.push({
          key: `s-${d.id}`,
          label: d.screening.outcome_label || 'Deferred',
          tone: d.screening.is_blocking ? 'crit' : 'warn',
          date: formatShortDate(d.screening.screened_at || d.donation_date),
          coded: true,
          code: d.screening.deferral_code || null,
          reason: d.screening.deferral_reason || null,
        })
      }
      // A reactive result's confirmatory case, by its explicit status
      // (project owner, 2026-10-25): pending confirmatory testing until the
      // physician records the outcome. A cleared one no longer defers.
      if (d.laboratory_deferral) {
        const lab = d.laboratory_deferral
        const until = lab.deferred_until ? ` until ${formatShortDate(lab.deferred_until)}` : ''
        rows.push({
          key: `l-${d.id}`,
          label: `${lab.status_label || lab.outcome_label || 'Deferred'}${until}`,
          tone: lab.status === 'cleared' ? 'ok' : lab.is_blocking ? 'crit' : 'warn',
          date: formatShortDate(lab.recorded_at),
          reason: 'After laboratory testing',
        })
      }
      return rows
    })
  }

  const standing = profile.value.deferral
  return standing
    ? [{ key: 'standing', label: standing.outcome_label || 'Deferred', tone: standing.kind === 'temporary' ? 'warn' : 'crit', date: formatShortDate(standing.recorded_on), reason: '' }]
    : []
})

async function openProfile(donor) {
  Object.assign(profileView, { open: true, uuid: donor.uuid, historyError: '' })
  Object.assign(signInView, { issuing: false, confirming: false, error: '' })
  profile.value = null
  history.value = []
  await Promise.all([
    loadProfile(donor.uuid),
    canViewHistory.value ? loadHistory(donor.uuid) : Promise.resolve(),
  ])
}

async function loadProfile(uuid) {
  profileView.loading = true
  profileView.error = ''
  try {
    profile.value = mapProfile(await bloodCenterService.showDonor(uuid))
  } catch (err) {
    profile.value = null
    profileView.error = err?.message || 'Could not load this donor.'
  } finally {
    profileView.loading = false
  }
}

async function loadHistory(uuid) {
  profileView.historyLoading = true
  profileView.historyError = ''
  try {
    const data = await bloodCenterService.donorHistory(uuid)
    history.value = (data?.donations ?? []).map(mapEvent)
  } catch (err) {
    history.value = []
    profileView.historyError = err?.message || 'Could not load the donation history.'
  } finally {
    profileView.historyLoading = false
  }
}

function closeProfile() {
  profileView.open = false
}

/* ---------- register / edit ---------- */

const ALL_EDITABLE = { identity: true, contact: true, photo: true }

const form = reactive({
  open: false,
  mode: 'create',
  uuid: null,
  donorCode: '',
  loading: false,
  saving: false,
  error: '',
  errors: {},
  data: blankDonorForm(),
  original: blankDonorForm(),
  editable: { ...ALL_EDITABLE },
  photoFile: null,
  photoPreview: '',
})

const canSaveForm = computed(() => {
  const d = form.data
  const base = d.first_name.trim() && d.last_name.trim() && d.birth_date
  return Boolean(form.mode === 'create' ? base && d.valid_id_number.trim() : base)
})

function fieldError(field) {
  return form.errors?.[field]?.[0] ?? ''
}

function resetPhoto(preview = '') {
  if (form.photoPreview && form.photoPreview.startsWith('blob:')) URL.revokeObjectURL(form.photoPreview)
  form.photoFile = null
  form.photoPreview = preview
}

function openCreate() {
  resetPhoto()
  Object.assign(form, {
    open: true,
    mode: 'create',
    uuid: null,
    donorCode: '',
    loading: false,
    saving: false,
    error: '',
    errors: {},
    data: blankDonorForm(),
    original: blankDonorForm(),
    editable: { ...ALL_EDITABLE },
  })
}

async function openEdit(uuid) {
  resetPhoto()
  Object.assign(form, { open: true, mode: 'edit', uuid, donorCode: '', loading: true, saving: false, error: '', errors: {} })

  try {
    // Always the server's latest, with which fields this centre may change.
    const data = await bloodCenterService.showDonor(uuid)
    const values = donorFormFrom(data)
    Object.assign(form, {
      donorCode: data?.donor_code ?? '',
      data: values,
      original: { ...values },
      editable: data?.editable ?? { identity: false, contact: false, photo: false },
    })
    resetPhoto(resolveApiAssetURL(data?.photo_url) || '')
  } catch (err) {
    form.error = err?.message || 'Could not load this donor.'
  } finally {
    form.loading = false
  }
}

function closeForm() {
  if (form.saving) return
  form.open = false
  resetPhoto()
}

function onPhotoPicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  if (file.size > 2 * 1024 * 1024) {
    form.errors = { ...form.errors, photo: ['The photo must be 2 MB or smaller.'] }
    return
  }

  resetPhoto(URL.createObjectURL(file))
  form.photoFile = file
  form.errors = Object.fromEntries(Object.entries(form.errors).filter(([key]) => key !== 'photo'))
}

async function uploadPhoto(uuid) {
  if (!form.photoFile) return ''
  const body = new FormData()
  body.append('photo', form.photoFile)
  try {
    await bloodCenterService.uploadDonorPhoto(uuid, body)
    return ''
  } catch (err) {
    return errorMessage(err, 'the photo could not be uploaded')
  }
}

async function submitForm() {
  if (!canSaveForm.value || form.saving) return
  form.saving = true
  form.error = ''
  form.errors = {}

  try {
    let uuid = form.uuid
    let message = ''

    if (form.mode === 'create') {
      const res = await bloodCenterService.createDonor(registerPayload(form.data))
      uuid = (res?.data ?? res)?.uuid
      message = res?.message || `${form.data.first_name.trim()} has been registered.`
    } else {
      const payload = editPayload(form.data, form.original)
      if (Object.keys(payload).length) {
        const res = await bloodCenterService.updateDonor(uuid, payload)
        message = res?.message || 'Donor record updated.'
      } else {
        message = form.photoFile ? 'Photo updated.' : 'Nothing was changed.'
      }
    }

    const photoProblem = uuid ? await uploadPhoto(uuid) : ''

    // A walk-in leaves the desk able to use the portal: the sign-in is given as
    // part of registering (project owner, 2026-10-21). If it fails, the
    // registration still stands and the profile can give it.
    const registeredName = `${form.data.first_name} ${form.data.last_name}`.trim()
    let signIn = null
    let signInProblem = ''
    if (form.mode === 'create' && uuid) {
      try {
        const res = await bloodCenterService.issueDonorSignIn(uuid)
        signIn = res?.data ?? res
      } catch {
        signInProblem = 'The portal sign-in could not be given. Give it from their Donor Profile.'
      }
    }

    form.saving = false
    closeForm()
    const problem = [
      photoProblem ? `${photoProblem.charAt(0).toLowerCase()}${photoProblem.slice(1)}` : '',
      signInProblem,
    ].filter(Boolean).join(' ')
    notice.value = problem
      ? { tone: 'error', text: `${message} However, ${problem}` }
      : { tone: 'success', text: message }
    if (signIn) showCredentials(signIn, registeredName, true)

    await loadDonors(form.mode === 'create' ? 1 : pager.page)
    if (profileView.open && profileView.uuid === uuid) await loadProfile(uuid)
  } catch (err) {
    form.errors = err?.errors ?? err?.data?.errors ?? {}
    form.error = Object.keys(form.errors).length
      ? 'Please check the highlighted fields.'
      : (err?.message || 'Could not save this donor. Please try again.')
  } finally {
    form.saving = false
  }
}

/* ---------- send email ---------- */

const emailView = reactive({ open: false, uuid: null, name: '', canThank: true, remindBlocked: '', sending: '', error: '' })

/** Opens from a list row or from the profile; both carry what the buttons need. */
function openEmail(donor) {
  const kind = donor.deferral?.kind
  // The first that applies, in the server's order (DonorOutreachService::sendOne).
  const remindBlocked = [
    [kind === 'permanent' || kind === 'indefinite', 'A deferred donor cannot be reminded to donate.'],
    [donor.eligibility?.key === 'in_progress', 'This donor is in a visit at your centre right now.'],
    [donor.status === 'inactive', 'This donor is inactive. Mark them active to remind them.'],
    [donor.acceptsReminders === false, 'This donor has turned off eligibility reminders.'],
  ].find(([applies]) => applies)?.[1] ?? ''

  Object.assign(emailView, {
    open: true,
    uuid: donor.uuid,
    name: donor.name,
    canThank: (donor.donationsHere ?? 0) > 0,
    remindBlocked,
    sending: '',
    error: '',
  })
}

function closeEmail() {
  if (emailView.sending) return
  emailView.open = false
}

async function sendEmail(template) {
  emailView.sending = template
  emailView.error = ''
  try {
    const res = await bloodCenterService.emailDonor(emailView.uuid, template)
    emailView.sending = ''
    emailView.open = false
    notice.value = { tone: 'success', text: res?.message || 'Email sent.' }
  } catch (err) {
    emailView.error = errorMessage(err, 'Could not send the email. Please try again.')
    emailView.sending = ''
  }
}

/* ---------- keyboard ---------- */

// Escape closes the topmost dialog.
function onKeydown(event) {
  if (event.key !== 'Escape') return
  // The sign-in window closes on Done only: it is the last sight of the password.
  if (credentials.value) return
  if (emailView.open) closeEmail()
  else if (form.open) closeForm()
  else if (remind.open) closeRemind()
  else if (profileView.open) closeProfile()
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  await Promise.all([loadDonors(), loadReference()])
  initialLoading.value = false
})

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  clearTimeout(copiedTimer)
  window.removeEventListener('keydown', onKeydown)
  resetPhoto()
})
</script>

<style scoped>
.donors-page {
  max-width: var(--rb-content-max, 1600px);
  background: var(--rb-page-bg);
  margin: 0 auto;
  padding: 24px var(--rb-gutter, 24px) 40px;
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
}

.donors-inner {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

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

/* ---------- Skeletons ---------- */
.skeleton {
  display: block;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  border-radius: 14px;
  animation: shimmer 1.4s ease infinite;
}

.skeleton-head { display: flex; flex-direction: column; gap: 8px; }
.skeleton--header { height: 28px; max-width: 260px; border-radius: 8px; }
.skeleton--sub { height: 14px; max-width: 340px; border-radius: 6px; }
.skeleton--panel { height: 520px; }
.skeleton--hero { height: 120px; }
.skeleton--line { height: 16px; width: 100%; border-radius: 6px; }
.skeleton--tall { height: 64px; border-radius: 10px; }

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* ---------- Header ---------- */
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0; color: var(--rb-text-primary); }
.page-subtitle { font-size: 13px; color: var(--rb-text-secondary); margin: 3px 0 0; }

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

.btn-primary { color: #fff; background: var(--rb-primary); border: 1px solid var(--rb-primary); box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.06); }
.btn-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

.btn-outline { color: var(--rb-text-primary); background: var(--rb-surface); border: 1px solid var(--rb-border-strong); }
.btn-outline:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline--accent { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); }
.btn-outline--sm { height: 30px; padding: 0 11px; font-size: 12px; border-radius: 8px; }

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--rb-primary-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-link:hover { text-decoration: underline; }
.inline-link { color: var(--rb-primary-text); font-weight: 600; }

.btn-primary:focus-visible,
.btn-outline:focus-visible,
.btn-link:focus-visible,
.icon-btn:focus-visible,
.th-sort:focus-visible,
.pager__btn:focus-visible,
.modal-card__close:focus-visible,
.inline-link:focus-visible {
  outline: none;
  box-shadow: var(--rb-focus-ring);
}

.photo-field__pick:focus-within { box-shadow: var(--rb-focus-ring); }

.spin { animation: spin 0.9s linear infinite; }

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ---------- Banners ---------- */
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
.banner__text { flex: 1; margin: 0; line-height: 1.45; color: var(--rb-text-primary); }
.banner--success > :deep(.asset-icon) { color: var(--rb-success-text); }
.banner--error > :deep(.asset-icon) { color: var(--rb-accent-text); }
.banner--error { border-color: rgba(var(--rb-accent-rgb), 0.35); }

.notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--rb-text-secondary);
}

.notice :deep(.asset-icon) { flex-shrink: 0; margin-top: 1px; }

/* ---------- Panel and toolbar ---------- */
/* The panel is a size container: the table drops columns by the panel's own
   width (see "Fitting the table"), which the sidebar's state also changes. */
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
.toolbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar__filters { flex: 1 1 auto; min-width: 0; }

.toolbar__actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
}

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

.search {
  position: relative;
  flex: 1 1 240px;
  min-width: 150px;
  max-width: 320px;
}

/* One row: filters on the left, actions on the right (project owner,
   2026-10-24). As the panel narrows, the search gives way first, then the
   "Updated" time (still on Refresh's tooltip), then Export's and Refresh's
   words (still read out). Only a phone's width wraps (see Narrow screens). */
.toolbar { flex-wrap: nowrap; }
.toolbar__filters { flex-wrap: nowrap; }
.toolbar__actions { flex: none; flex-wrap: nowrap; }

@container (max-width: 1240px) {
  .updated { display: none; }
}

@container (max-width: 1100px) {
  .btn-text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .btn-outline--squeeze { width: 36px; padding: 0; }
}

.toolbar__filters .select { flex-shrink: 0; }

.search__icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--rb-text-secondary);
  pointer-events: none;
}

.search__input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 34px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.search__input::placeholder { color: var(--rb-placeholder); }
.search__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.select {
  height: 36px;
  padding: 0 30px 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 10px 6px;
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
  appearance: none;
  cursor: pointer;
}

.select:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

/* ---------- Table ---------- */
/* Positioned, so the visually hidden caption cannot escape the scroller. */
.table-wrap { position: relative; overflow-x: auto; transition: opacity 0.15s ease; }
.table-wrap--busy { opacity: 0.55; }

/* Fixed layout: the columns take the widths below and Donor and Address share
   what is left, so the table fits its panel instead of growing to its content. */
.donor-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; }

.donor-table thead th {
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

.donor-table tbody td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--rb-border);
  vertical-align: middle;
  color: var(--rb-text-primary);
  overflow: hidden;
}

.donor-table th:first-child,
.donor-table td:first-child { padding-left: 16px; }

.donor-table th:last-child,
.donor-table td:last-child { padding-right: 16px; }

.donor-table tbody tr:last-child td { border-bottom: 0; }

/* ---------- Fitting the table ---------- */
/* Widths include the cell's padding. c-donor and c-address have none: they
   split the rest. The actions column is sized in the template, by how many
   buttons the viewer's role shows. */
.c-id { width: 116px; }
.c-group { width: 64px; }
.c-phone { width: 120px; }
.c-last { width: 124px; }
.c-total { width: 84px; }
.c-elig { width: 168px; }
.c-status { width: 108px; }

.donor-cell__phone { display: none; }

/* Too narrow for Address beside the donor's name: it stays on the profile. */
@container (max-width: 1100px) {
  .c-address { display: none; }
}

/* The eligibility badge already gives the next date; the profile has the last. */
@container (max-width: 1000px) {
  .c-last { display: none; }
}

/* The phone moves under the donor's name. */
@container (max-width: 900px) {
  .c-phone { display: none; }
  .donor-cell__phone { display: block; }
}
.donor-row { transition: background 0.12s ease; }
.donor-row:hover { background: var(--rb-surface-hover); }

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
.th-sort__off { opacity: 0.35; }

.num { text-align: right; font-variant-numeric: tabular-nums; }
.donor-table thead th.num { text-align: right; }
.nowrap { white-space: nowrap; }
.muted { color: var(--rb-text-secondary); }
.mono { font-family: var(--rb-font-mono); font-size: 12px; }
.strong { font-weight: 700; }

.donor-code {
  font-family: var(--rb-font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--rb-primary-text);
  white-space: nowrap;
}

.donor-cell { display: flex; flex-direction: column; min-width: 0; }
.donor-cell__name { font-weight: 700; text-transform: capitalize; overflow-wrap: anywhere; }
.donor-cell__sub { font-size: 11.5px; color: var(--rb-text-secondary); }
.donor-cell__other {
  align-self: flex-start;
  margin: 2px 0 1px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  white-space: nowrap;
}

/* The full address is in the cell's title and on the profile. */
td.c-address {
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rb-text-secondary);
}

.declared { margin-left: 2px; color: var(--rb-text-secondary); cursor: help; }

.blood {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface-alt);
  color: var(--rb-text-primary);
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
}

/* The count over its tier, so the column stays narrow. */
.total { display: inline-flex; flex-direction: column; align-items: flex-end; gap: 3px; font-weight: 600; }
.total__count { line-height: 1.2; }

/* Recognition, not state: neutral, with the tier's name doing the work. */
.tier {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 6px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface-alt);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  white-space: nowrap;
}

/* Status: the colour lives on the dot, never on the badge's fill. */
.badge {
  --tone: var(--rb-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--rb-border);
  background: var(--rb-surface);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--rb-text-primary);
  white-space: nowrap;
}

.badge__dot { width: 6px; height: 6px; border-radius: 999px; background: var(--tone); flex-shrink: 0; }
.badge--ok { --tone: var(--rb-success); }
.badge--info { --tone: var(--rb-primary); }
.badge--warn { --tone: var(--rb-warning); }
.badge--crit { --tone: var(--rb-accent); }
.badge--neutral { --tone: var(--rb-text-muted); color: var(--rb-text-secondary); }

.row-actions { display: flex; gap: 6px; }

.icon-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.icon-btn:hover:not(:disabled) { color: var(--rb-primary-text); border-color: rgba(var(--rb-primary-rgb), 0.45); background: var(--rb-surface-hover); }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.empty-cell { padding: 0 !important; }

/* ---------- Pager ---------- */
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--rb-border);
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.pager__btns { display: flex; align-items: center; gap: 8px; }

.pager__btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  cursor: pointer;
}

.pager__btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.pager__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pager__page { font-variant-numeric: tabular-nums; }

/* ---------- Empty state ---------- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 48px 24px;
  text-align: center;
}

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

.empty-state__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--rb-text-primary); }
.empty-state__text { margin: 0 0 8px; max-width: 44ch; font-size: 13px; line-height: 1.5; color: var(--rb-text-secondary); }

/* ---------- Modals ---------- */
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

/* The email dialog opens over the profile. */
.modal-overlay--top { z-index: 110; }

.modal-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 560px;
  max-height: calc(100vh - 40px);
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(var(--rb-shadow-rgb), 0.28);
}

.modal-card--sm { max-width: 460px; }
.modal-card--form { max-width: 640px; }
.modal-card--profile { max-width: 820px; }

.modal-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.modal-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15.5px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

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

.modal-card__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
  overflow-y: auto;
  min-height: 0;
}

.modal-card__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--rb-border);
  flex-shrink: 0;
}

.modal-text { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--rb-text-primary); }
.modal-hint { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }

.email-choices { display: flex; flex-wrap: wrap; gap: 10px; }

/* ---------- Form ---------- */
.modal-form { gap: 14px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.form-label { font-size: 12.5px; font-weight: 600; color: var(--rb-text-primary); }
.form-optional { margin-left: 4px; font-weight: 500; color: var(--rb-text-secondary); }
.req { color: var(--rb-accent-text); }
.form-hint { margin: 0; font-size: 12px; line-height: 1.45; color: var(--rb-text-secondary); }
.form-hint--lock { display: flex; align-items: center; gap: 6px; margin-top: -6px; }
.field-error { margin: 0; font-size: 12px; color: var(--rb-accent-text); }

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

/* Anchored on the page root: other portals ship unscoped dark .form-input rules. */
.donors-page .form-input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
}

.donors-page .form-input:disabled { background-color: var(--rb-surface-alt); color: var(--rb-text-secondary); cursor: not-allowed; }
.donors-page .form-input::placeholder { color: var(--rb-placeholder); }
.donors-page .form-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }

.donors-page .form-select {
  padding-right: 30px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 10px 6px;
  appearance: none;
  cursor: pointer;
}

.donors-page .form-textarea { height: auto; min-height: 76px; padding: 10px 12px; line-height: 1.5; resize: vertical; }

.photo-field { display: flex; align-items: center; gap: 12px; min-height: 38px; }
.photo-field__pick { cursor: pointer; }

/* ---------- Avatar ---------- */
.avatar {
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
  border-radius: 999px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
  font-weight: 700;
}

.avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar--md { width: 38px; height: 38px; font-size: 13px; }
.avatar--lg { width: 60px; height: 60px; font-size: 19px; }

/* ---------- Profile ---------- */
.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--rb-border);
}

.hero__who { display: flex; align-items: center; gap: 14px; min-width: 0; }
.hero__text { min-width: 0; }
.hero__name-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.hero__name { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; color: var(--rb-text-primary); text-transform: capitalize; }
.hero__meta { margin: 3px 0 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.hero__badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.hero__actions { display: flex; flex-direction: column; align-items: stretch; gap: 8px; flex-shrink: 0; }

.facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px 18px;
  margin: 0;
}

.fact { min-width: 0; }
.fact--wide { grid-column: span 2; }
.fact--full { grid-column: 1 / -1; }

.fact dt {
  margin: 0 0 3px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
}

.fact dd { margin: 0; font-size: 13px; font-weight: 600; color: var(--rb-text-primary); overflow-wrap: anywhere; }
.fact__sub { display: block; font-size: 11.5px; font-weight: 500; color: var(--rb-text-secondary); }
.fact__notes { font-weight: 500; white-space: pre-line; }

.sub-section { display: flex; flex-direction: column; gap: 8px; }

.sub-section__title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.sub-section__title :deep(.asset-icon) { color: var(--rb-text-secondary); }
.sub-section__note { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--rb-text-secondary); }

.history-wrap { position: relative; overflow-x: auto; border: 1px solid var(--rb-border); border-radius: 10px; }
.history-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }

.history-table th {
  padding: 8px 12px;
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

.history-table td { padding: 9px 12px; border-bottom: 1px solid var(--rb-border); color: var(--rb-text-primary); }
.history-table tr:last-child td { border-bottom: 0; }

.deferral-list { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.deferral { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 12.5px; }
.deferral__date { font-weight: 600; color: var(--rb-text-primary); }
.deferral__reason { color: var(--rb-text-secondary); }

/* ---------- Portal sign-in ---------- */
.signin-status { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.signin-give { align-self: flex-start; }

.signin-confirm {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface-alt);
}

.signin-confirm__actions { display: flex; flex-wrap: wrap; gap: 8px; }

.credentials {
  display: flex;
  flex-direction: column;
  margin: 0;
  border: 1px solid var(--rb-border);
  border-radius: 12px;
  overflow: hidden;
}

.credential { padding: 10px 14px; border-bottom: 1px solid var(--rb-border); }
.credential:last-child { border-bottom: 0; }
.credential--key { background: var(--rb-surface-alt); }

.credential dt {
  margin: 0 0 4px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rb-text-secondary);
}

.credential dd { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0; }

.credential__value {
  min-width: 0;
  font-family: var(--rb-font-mono);
  font-size: 16px;
  font-weight: 700;
  color: var(--rb-text-primary);
  overflow-wrap: anywhere;
}

.credential__value--email { font-family: inherit; font-size: 14px; font-weight: 600; }
.credential__value--key { font-size: 22px; letter-spacing: 0.08em; }

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.copy-btn:hover { background: var(--rb-surface-hover); }
.copy-btn:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }

.modal-enter-active,
.modal-leave-active { transition: opacity 0.18s ease; }

.modal-enter-from,
.modal-leave-to { opacity: 0; }

/* ---------- Narrow screens ---------- */
@media (max-width: 760px) {
  .toolbar,
  .toolbar__filters,
  .toolbar__actions { flex-wrap: wrap; }
  .toolbar__filters { flex-basis: 100%; }
  .search { flex: 1 1 100%; }
  .toolbar__actions { width: 100%; }
  .updated { width: 100%; }
  .form-row { grid-template-columns: 1fr; }
  .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hero { flex-direction: column; }
  .hero__actions { flex-direction: row; }
  .modal-overlay { padding: 10px; align-items: flex-end; }
  .modal-card { max-height: calc(100vh - 20px); }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .spin { animation: none !important; }
}
</style>

<style scoped>
/* The system dropdown in a toolbar: narrow enough for one row, and it may
   give a little more before the row runs out. */
.sel-filter { width: 140px; flex: 0 1 140px; min-width: 118px; }
</style>
