<template>
  <div class="prices-page">
    <PageHeader
      title="Component Prices"
      subtitle="What a patient pays per unit of each component. Any price above ₱0 is paid for before the units are released."
    >
      <template #actions>
        <div class="header-actions">
          <span v-if="dirtyCount" class="unsaved">{{ dirtyCount }} unsaved</span>
          <button type="button" class="btn btn--ghost" :disabled="busy || saving" @click="load">
            <AssetIcon name="refresh-cw" :size="14" :class="{ spin: busy }" />
            {{ busy ? 'Loading…' : 'Refresh' }}
          </button>
          <button type="button" class="btn btn--primary" :disabled="busy || saving || !rows.length" @click="saveAll">
            <AssetIcon name="check" :size="14" />
            {{ saving ? 'Saving…' : 'Save All Prices' }}
          </button>
        </div>
      </template>
    </PageHeader>

    <!-- 2. Where the list stands; each chip a filter (2026-10-27). -->
    <div v-if="rows.length" class="tally" role="group" aria-label="Show components">
      <button
        v-for="t in tally"
        :key="t.key"
        type="button"
        class="tally__chip"
        :class="[`tally__chip--${t.key}`, { 'tally__chip--on': filter === t.key }]"
        :aria-pressed="filter === t.key"
        :disabled="!t.count && filter !== t.key"
        @click="toggleFilter(t.key)"
      >
        <AssetIcon :name="t.icon" :size="14" />
        <span class="tally__label">{{ t.label }}</span>
        <span class="tally__count">{{ t.count }}</span>
      </button>
      <button v-if="filter" type="button" class="tally__clear" @click="filter = ''">Show all</button>
    </div>

    <div
      v-if="shownBanner"
      class="alert"
      :class="`alert--${shownBannerKind}`"
      :role="shownBannerKind === 'error' ? 'alert' : 'status'"
    >
      <AssetIcon :name="shownBannerKind === 'success' ? 'circle-check-big' : shownBannerKind === 'error' ? 'circle-alert' : 'info'" :size="16" />
      <span>{{ shownBanner }}</span>
    </div>

    <section class="card" aria-label="Component prices">
      <table v-if="busy || rows.length" class="prices">
        <thead>
          <tr>
            <th>Component</th>
            <th>Charging</th>
            <th>Price per unit</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="busy && !rows.length">
            <tr v-for="n in 4" :key="`sk-${n}`">
              <td><span class="skeleton skeleton--name" /><span class="skeleton skeleton--code" /></td>
              <td><span class="skeleton skeleton--seg" /></td>
              <td><span class="skeleton skeleton--input" /></td>
            </tr>
          </template>
          <tr v-else-if="!visibleRows.length">
            <td colspan="3" class="empty-filter">
              Nothing left here.
              <button type="button" class="link-btn" @click="filter = ''">Show all components</button>
            </td>
          </tr>
          <tr
            v-for="row in visibleRows"
            v-else
            :key="row.id"
            :class="{ 'row--dirty': isDirty(row), 'row--invalid': errors[row.id] }"
          >
            <td>
              <span class="name">{{ row.name }}</span>
              <span class="code">{{ row.code }}</span>
            </td>
            <td>
              <!-- One choice per component: charge for it, or not (was a No charge checkbox). -->
              <div class="seg" role="radiogroup" :aria-label="`Charging for ${row.name}`">
                <button
                  type="button"
                  role="radio"
                  class="seg__btn"
                  :class="{ 'seg__btn--on': !drafts[row.id].noCharge }"
                  :aria-checked="!drafts[row.id].noCharge"
                  :disabled="saving"
                  @click="drafts[row.id].noCharge && setNoCharge(row, false)"
                >
                  Charge
                </button>
                <button
                  type="button"
                  role="radio"
                  class="seg__btn"
                  :class="{ 'seg__btn--on': drafts[row.id].noCharge }"
                  :aria-checked="drafts[row.id].noCharge"
                  :disabled="saving"
                  @click="!drafts[row.id].noCharge && setNoCharge(row, true)"
                >
                  No charge
                </button>
              </div>
            </td>
            <td>
              <label
                v-if="!drafts[row.id].noCharge"
                class="input-group"
                :class="{ 'input-group--invalid': errors[row.id] }"
              >
                <span class="input-group__prefix">₱</span>
                <span class="sr-only">{{ row.name }} price per unit</span>
                <input
                  :ref="(el) => { inputs[row.id] = el }"
                  v-model="drafts[row.id].price"
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  inputmode="decimal"
                  placeholder="Enter price"
                  :disabled="saving"
                  :aria-invalid="errors[row.id] ? 'true' : undefined"
                  :aria-describedby="errors[row.id] ? `price-error-${row.id}` : undefined"
                  class="cell-input"
                  @input="recheck(row)"
                >
              </label>
              <span v-else class="free">
                <AssetIcon name="heart" :size="14" />
                Free to the patient
              </span>
              <p v-if="errors[row.id]" :id="`price-error-${row.id}`" class="field-error">
                {{ errors[row.id].message }}
              </p>
              <!-- 5. What it was, while the change is not saved. -->
              <p v-else-if="isDirty(row)" class="was">Was {{ savedLabel(row) }}</p>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="cp-empty">
        <span class="cp-empty__icon" aria-hidden="true"><AssetIcon name="flask-conical" :size="24" /></span>
        <h2 class="cp-empty__title">No components to price yet</h2>
        <p class="cp-empty__text">
          Processing adds the blood components your centre makes. Each one appears here to be given a price, or marked No charge.
        </p>
        <NuxtLink v-if="canConfigureComponents" to="/blood-center/blood-components" class="btn">
          <AssetIcon name="flask-conical" :size="15" />
          Blood Components
        </NuxtLink>
      </div>
    </section>

    <!-- 8. Subsidies and discounts live beside the prices. -->
    <p v-if="rows.length" class="aside-note">
      <AssetIcon name="badge-check" :size="14" />
      A subsidy or discount on these prices is set up in
      <NuxtLink to="/blood-center/billing-programs">Billing Programs</NuxtLink>.
    </p>

    <!-- 6. Save within reach while changes are pending. -->
    <Transition name="savebar">
      <div v-if="dirtyCount" class="savebar" role="region" aria-label="Unsaved changes">
        <span class="savebar__text">
          <AssetIcon name="pencil" :size="14" />
          {{ dirtyCount }} {{ dirtyCount === 1 ? 'change' : 'changes' }} not saved
        </span>
        <button type="button" class="btn btn--ghost" :disabled="saving" @click="discard">Discard</button>
        <button type="button" class="btn btn--primary" :disabled="busy || saving" @click="saveAll">
          <AssetIcon name="check" :size="14" />
          {{ saving ? 'Saving…' : 'Save All Prices' }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import PageHeader from '~/components/ui/PageHeader.vue'
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

/**
 * What a blood centre charges per unit of each component: the Billing
 * department's alone (`billing.prices`, the Billing Supervisor).
 *
 * Held per facility, beside the shelf life Processing sets: a non-zero price
 * switches on the payment-before-release gate, which one centre must not be
 * able to turn on for another.
 *
 * One Save All Prices saves the whole list, and nothing is saved while any
 * component has neither a price nor No charge. A blank no longer means free:
 * free is a decision, ticked as No charge (project owner, 2026-10-15). The
 * server holds the same rule, so a component Processing adds after this page
 * loaded is caught there and named the same way.
 */

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'billing.prices',
})

useHead({ title: 'Component Prices · RedAgos' })

const MAX_PRICE = 1000000

const rows = ref([])
const drafts = reactive({})
const errors = reactive({})
const inputs = {}
const busy = ref(false)
const saving = ref(false)
const banner = ref('')
const bannerKind = ref('notice')

// Errors show only after a save is tried; from then on each edit rechecks its row.
const attempted = ref(false)

const dirtyCount = computed(() => rows.value.filter(isDirty).length)

const { can } = useUser()
const canConfigureComponents = computed(() => can('components.configure'))

// ── Where the list stands, by what is typed (2026-10-27) ──
function standing(row) {
  const draft = drafts[row.id]

  if (!draft) return 'unset'
  if (draft.noCharge) return 'free'

  return draftPrice(row) === null ? 'unset' : 'priced'
}

const tally = computed(() => {
  const count = (key) => rows.value.filter((row) => standing(row) === key).length

  return [
    { key: 'priced', label: 'Priced', icon: 'philippine-peso', count: count('priced') },
    { key: 'free', label: 'No charge', icon: 'heart', count: count('free') },
    { key: 'unset', label: 'Not set', icon: 'circle-alert', count: count('unset') },
  ]
})

/**
 * The chip picked, and the rows it matched then: a row being fixed stays in
 * view until another chip is picked, rather than vanishing mid-typing.
 */
const filter = ref('')
const filterIds = ref([])

function toggleFilter(key) {
  if (filter.value === key) {
    filter.value = ''

    return
  }

  filter.value = key
  filterIds.value = rows.value.filter((row) => standing(row) === key).map((row) => row.id)
}

const visibleRows = computed(() => (filter.value ? rows.value.filter((row) => filterIds.value.includes(row.id)) : rows.value))

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

/** What the server holds for a row, said in words. */
function savedLabel(row) {
  if (row.no_charge) return 'no charge'

  return row.price === null ? 'not set' : peso.format(row.price)
}

/** Put every row back to what the server holds. */
function discard() {
  rows.value.forEach(seedDraft)
  attempted.value = false
  clearErrors()
  banner.value = ''
}

/**
 * The message for what is still blocking the save, in the order of the list.
 * Worked out from the field errors, so it shrinks as they are fixed.
 */
const validationBanner = computed(() => {
  const named = (kind) => rows.value.filter((row) => errors[row.id]?.kind === kind).map((row) => row.name)
  const missing = named('missing')
  const invalid = named('invalid')

  return [
    missing.length ? `Cannot save prices. Configure a price for: ${missing.join(', ')}.` : '',
    invalid.length ? `${missing.length ? 'Also correct' : 'Cannot save prices. Correct'} the price for: ${invalid.join(', ')}.` : '',
  ].filter(Boolean).join(' ')
})

const shownBanner = computed(() => validationBanner.value || banner.value)
const shownBannerKind = computed(() => (validationBanner.value ? 'error' : bannerKind.value))

function seedDraft(row) {
  drafts[row.id] = {
    price: row.no_charge || row.price === null ? '' : row.price,
    noCharge: Boolean(row.no_charge),
    // The price typed before No charge was ticked, put back if it is unticked.
    stash: '',
  }
}

function draftPrice(row) {
  const price = drafts[row.id]?.price

  return price === '' || price === null || price === undefined ? null : Number(price)
}

function isDirty(row) {
  const draft = drafts[row.id]

  if (!draft) return false
  if (draft.noCharge !== Boolean(row.no_charge)) return true

  return !draft.noCharge && draftPrice(row) !== row.price
}

/** Why this row cannot be saved as it stands, or null when it can. */
function problemWith(row) {
  if (drafts[row.id].noCharge) return null

  const price = draftPrice(row)

  if (price === null) return { kind: 'missing', message: 'Enter a price, or tick No charge.' }
  if (!Number.isFinite(price) || price <= 0) {
    return { kind: 'invalid', message: 'Enter a price above ₱0, or tick No charge.' }
  }
  if (price > MAX_PRICE) return { kind: 'invalid', message: 'A price cannot be more than ₱1,000,000.' }
  if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-6) {
    return { kind: 'invalid', message: 'Use at most two decimal places.' }
  }

  return null
}

function setError(row, problem) {
  if (problem) errors[row.id] = problem
  else delete errors[row.id]
}

function recheck(row) {
  if (attempted.value || errors[row.id]) setError(row, problemWith(row))
}

function setNoCharge(row, checked) {
  const draft = drafts[row.id]

  if (checked) {
    draft.stash = draft.price
    draft.price = ''
  } else {
    draft.price = draft.stash
    draft.stash = ''
  }

  draft.noCharge = checked
  recheck(row)
}

function clearErrors() {
  Object.keys(errors).forEach((id) => delete errors[id])
}

function scrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

/** Bring the first field still in error into view, in list order, and put the cursor in it. */
async function focusFirstError() {
  filter.value = ''
  await nextTick()

  const first = rows.value.find((row) => errors[row.id])
  const input = first ? inputs[first.id] : null

  if (!input) return

  input.scrollIntoView({ behavior: scrollBehavior(), block: 'center' })
  input.focus({ preventScroll: true })
}

function firstError(err, fallback) {
  return err?.data?.message
    || Object.values(err?.data?.errors ?? err?.errors ?? {}).flat()[0]
    || err?.message
    || fallback
}

/** Take the server's list, keeping what is being typed into rows it still has. */
function applyRows(data, { keepDrafts = false } = {}) {
  rows.value = data

  rows.value.forEach((row) => {
    if (!keepDrafts || !drafts[row.id]) seedDraft(row)
  })
}

async function load() {
  busy.value = true
  banner.value = ''
  attempted.value = false
  clearErrors()

  try {
    const res = await bloodCenterService.componentPrices()

    applyRows(res?.data ?? [])
    filter.value = ''

  } catch (err) {
    bannerKind.value = 'error'
    banner.value = firstError(err, 'The prices could not be loaded.')
  } finally {
    busy.value = false
  }
}

/** The line sent for one row. A No charge line carries no price. */
function lineFor(row) {
  const noCharge = drafts[row.id].noCharge

  return { component_id: row.id, no_charge: noCharge, price: noCharge ? null : draftPrice(row) }
}

/**
 * Put the server's refusal on the fields it is about.
 *
 * `prices_incomplete` names components with no price, which includes one
 * Processing added after this page loaded: the list is reloaded so it has a
 * field to mark. A field error is keyed by its line in what was sent.
 */
async function showRefusal(err, sent) {
  const data = err?.data ?? {}

  if (data.code === 'prices_incomplete' && Array.isArray(data.components)) {
    if (data.components.some((id) => !rows.value.some((row) => row.id === id))) {
      const res = await bloodCenterService.componentPrices().catch(() => null)

      if (res?.data) applyRows(res.data, { keepDrafts: true })
    }

    data.components.forEach((id) => {
      const row = rows.value.find((r) => r.id === id)

      if (row) setError(row, { kind: 'missing', message: 'Enter a price, or tick No charge.' })
    })
  }

  Object.entries(data.errors ?? {}).forEach(([key, messages]) => {
    const match = /^prices\.(\d+)\./.exec(key)
    const row = match ? rows.value.find((r) => r.id === sent[Number(match[1])]?.component_id) : null

    if (row) setError(row, { kind: 'invalid', message: [messages].flat()[0] })
  })

  if (Object.keys(errors).length) {
    await focusFirstError()
  } else {
    bannerKind.value = 'error'
    banner.value = firstError(err, 'The prices could not be saved.')
  }
}

async function saveAll() {
  attempted.value = true
  banner.value = ''
  rows.value.forEach((row) => setError(row, problemWith(row)))

  if (Object.keys(errors).length) {
    await focusFirstError()

    return
  }

  if (!dirtyCount.value) {
    bannerKind.value = 'notice'
    banner.value = 'No changes to save.'

    return
  }

  const sent = rows.value.map(lineFor)

  saving.value = true

  try {
    const res = await bloodCenterService.saveComponentPrices({ prices: sent })

    applyRows(res?.data ?? rows.value)
    attempted.value = false
    clearErrors()
    bannerKind.value = 'success'
    banner.value = res?.message || 'Prices saved.'
  } catch (err) {
    await showRefusal(err, sent)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.prices-page {
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

.prices-page__header { display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
.prices-page__title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
.header-actions { display: inline-flex; align-items: center; gap: 8px; }

.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}
.alert :deep(svg) { flex-shrink: 0; }
.alert--notice { background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); border: 1px solid rgba(var(--rb-primary-rgb), 0.25); }
.alert--success { background: rgba(var(--rb-success-rgb), 0.08); color: var(--rb-success-text); border: 1px solid rgba(var(--rb-success-rgb), 0.25); }
.alert--error { background: rgba(var(--rb-accent-rgb), 0.08); color: var(--rb-accent-text); border: 1px solid rgba(var(--rb-accent-rgb), 0.25); }

.card {
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
}

.prices { width: 100%; border-collapse: collapse; font-size: 13px; }
.prices th {
  text-align: left;
  padding: 10px 16px;
  background: var(--rb-surface-alt);
  border-bottom: 1px solid var(--rb-border);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--rb-text-secondary);
}
.prices td { padding: 10px 16px; border-bottom: 1px solid var(--rb-border); vertical-align: middle; }
.prices tr:last-child td { border-bottom: 0; }
.prices tbody tr { transition: background-color 0.12s ease; }
.prices tbody tr:hover { background: var(--rb-surface-hover); }
.row--dirty { background: rgba(var(--rb-primary-rgb), 0.04); }
.prices tbody tr.row--invalid { background: rgba(var(--rb-accent-rgb), 0.05); }

.name { font-weight: 600; }
.code {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.empty { padding: 32px 16px; text-align: center; color: var(--rb-text-secondary); }

.input-group {
  display: inline-flex;
  align-items: center;
  width: 170px;
  height: 36px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.input-group:focus-within { border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.input-group--off { background: var(--rb-surface-alt); }
.input-group--invalid,
.input-group--invalid:focus-within { border-color: var(--rb-accent); box-shadow: 0 0 0 3px rgba(var(--rb-accent-rgb), 0.16); }
.input-group--invalid .input-group__prefix { color: var(--rb-accent-text); border-right-color: rgba(var(--rb-accent-rgb), 0.4); }
.input-group__prefix {
  padding: 0 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  background: var(--rb-surface-alt);
  align-self: stretch;
  display: grid;
  place-items: center;
  border-right: 1px solid var(--rb-border);
}

.cell-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.cell-input:focus { outline: none; }
.cell-input::placeholder { color: var(--rb-placeholder); }
.cell-input:disabled { cursor: not-allowed; }

.field-error {
  margin: 5px 0 0;
  max-width: 220px;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--rb-accent-text);
}

.no-charge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.no-charge input { width: 16px; height: 16px; margin: 0; accent-color: var(--rb-primary); cursor: pointer; }
.no-charge input:disabled,
.no-charge input:disabled + span { cursor: not-allowed; opacity: 0.6; }

.unsaved {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--rb-primary-text);
}
.unsaved::before { content: ''; width: 6px; height: 6px; border-radius: 999px; background: currentColor; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.btn:hover:not(:disabled) { background: var(--rb-surface-hover); border-color: var(--rb-border-hover); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 2px; }
.btn--ghost { border-color: transparent; background: transparent; color: var(--rb-text-secondary); }
.btn--ghost:hover:not(:disabled) { color: var(--rb-text-primary); }
.btn--primary { background: var(--rb-primary); border-color: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) { background: #0D47A1; border-color: #0D47A1; }

.skeleton {
  display: block;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--rb-skeleton-a) 25%, var(--rb-skeleton-b) 37%, var(--rb-skeleton-a) 63%);
  background-size: 400% 100%;
  animation: price-shimmer 1.4s ease infinite;
}
.skeleton--name { width: 60%; height: 12px; }
.skeleton--code { width: 52px; height: 20px; }
.skeleton--input { width: 170px; height: 36px; border-radius: 10px; }
.skeleton--check { width: 96px; height: 16px; }
@keyframes price-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.spin { animation: price-spin 0.9s linear infinite; }
@keyframes price-spin { to { transform: rotate(360deg); } }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin { animation: none; }
}

/* ===== Refresh (project owner, 2026-10-27) ===== */
.prices-page { padding-bottom: 96px; }
.prices-page > .card, .tally, .aside-note, .alert { width: 100%; }
.card { border-radius: 16px; }

/* Where the list stands. */
.tally { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.tally__chip {
  --tone-rgb: var(--rb-success-rgb);
  display: inline-flex; align-items: center; gap: 7px;
  height: 34px; padding: 0 12px;
  border: 1px solid var(--rb-border); border-radius: 999px;
  background: var(--rb-surface); font: inherit; font-size: 12.5px; font-weight: 600;
  color: var(--rb-text-secondary); cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.tally__chip :deep(.asset-icon) { color: rgb(var(--tone-rgb)); }
.tally__chip--free { --tone-rgb: var(--rb-primary-rgb); }
.tally__chip--unset { --tone-rgb: var(--rb-warning-rgb); }
.tally__chip:hover:not(:disabled) { border-color: rgba(var(--tone-rgb), 0.5); background: rgba(var(--tone-rgb), 0.05); }
.tally__chip:disabled { opacity: 0.55; cursor: default; }
.tally__chip:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.tally__chip--on, .tally__chip--on:hover:not(:disabled) { border-color: rgb(var(--tone-rgb)); background: rgba(var(--tone-rgb), 0.08); color: var(--rb-text-primary); }
.tally__count { min-width: 22px; padding: 1px 7px; border-radius: 999px; background: var(--rb-surface-alt); font-size: 12px; font-weight: 800; text-align: center; font-variant-numeric: tabular-nums; color: var(--rb-text-primary); }
.tally__chip--unset:not(:disabled) .tally__count { background: rgba(var(--rb-warning-rgb), 0.16); color: var(--rb-warning-text); }
.tally__clear { border: 0; background: none; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-primary-text); cursor: pointer; }

/* The rows. */
.prices td { padding: 12px 16px; }
.prices th:first-child, .prices td:first-child { width: 36%; }
.prices th:nth-child(2), .prices td:nth-child(2) { width: 28%; }
.prices tbody tr.row--dirty { box-shadow: inset 3px 0 0 var(--rb-primary); }
.prices tbody tr.row--invalid { box-shadow: inset 3px 0 0 var(--rb-accent); }
.name { display: block; font-size: 13.5px; }
.code { margin-top: 4px; }
.skeleton--name { margin-bottom: 6px; }
.skeleton--seg { width: 172px; height: 34px; border-radius: 10px; }

/* Charge | No charge. */
.seg { display: inline-flex; padding: 3px; border-radius: 10px; background: var(--rb-surface-alt); border: 1px solid var(--rb-border); }
.seg__btn { height: 28px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--rb-text-secondary); cursor: pointer; white-space: nowrap; }
.seg__btn:hover:not(:disabled):not(.seg__btn--on) { color: var(--rb-text-primary); }
.seg__btn--on { background: var(--rb-surface); font-weight: 700; color: var(--rb-primary-text); box-shadow: 0 0 0 1px rgba(var(--rb-primary-rgb), 0.35), 0 1px 2px rgba(var(--rb-shadow-rgb), 0.12); }
.seg__btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.seg__btn:disabled { cursor: not-allowed; opacity: 0.6; }

.free { display: inline-flex; align-items: center; gap: 6px; height: 36px; font-size: 13px; font-weight: 600; color: var(--rb-primary-text); }
.was { margin: 5px 0 0; font-size: 11.5px; color: var(--rb-text-muted); }
.empty-filter { padding: 28px 16px; text-align: center; color: var(--rb-text-secondary); }
.link-btn { margin-left: 6px; border: 0; background: none; font: inherit; font-weight: 600; color: var(--rb-primary-text); cursor: pointer; }

/* Empty: as on Invoices and Payments. */
.cp-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 24px; text-align: center; }
.cp-empty__icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: rgba(var(--rb-primary-rgb), 0.08); color: var(--rb-primary-text); box-shadow: 0 0 0 6px rgba(var(--rb-primary-rgb), 0.04); }
.cp-empty__title { margin: 6px 0 0; font-size: 17px; font-weight: 800; color: var(--rb-text-primary); }
.cp-empty__text { max-width: 480px; margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--rb-text-secondary); text-wrap: pretty; }
.cp-empty .btn { margin-top: 6px; text-decoration: none; }

.aside-note { margin: 0; font-size: 12.5px; color: var(--rb-text-secondary); }
.aside-note a { font-weight: 600; color: var(--rb-primary-text); }
.aside-note :deep(.asset-icon) { margin-right: 4px; vertical-align: -2px; }

/* Save within reach. */
.savebar {
  position: sticky; bottom: 16px; z-index: 5;
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 10px 10px 10px 16px;
  border: 1px solid var(--rb-border); border-radius: 14px;
  background: var(--rb-surface);
  box-shadow: 0 8px 24px rgba(var(--rb-shadow-rgb), 0.14);
}
.savebar__text { display: inline-flex; flex: 1; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; color: var(--rb-primary-text); }
.savebar-enter-active, .savebar-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.savebar-enter-from, .savebar-leave-to { opacity: 0; transform: translateY(8px); }
@media (prefers-reduced-motion: reduce) {
  .savebar-enter-active, .savebar-leave-active, .tally__chip { transition: none; }
}
</style>
