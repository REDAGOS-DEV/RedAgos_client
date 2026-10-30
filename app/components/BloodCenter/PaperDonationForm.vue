<template>
  <section class="pdf" aria-labelledby="pdf-title">
    <header class="pdf__head">
      <h2 id="pdf-title" class="pdf__title">Add a donor from the sheet</h2>
    </header>

    <!-- 1. DONOR -->
    <div class="pdf__step">
      <span class="pdf__num" aria-hidden="true">1</span>
      <div class="pdf__body">
        <h3 class="pdf__label">Donor</h3>

        <template v-if="donor">
          <div class="donor">
            <span class="donor__avatar" aria-hidden="true">{{ initialsOf(donor.full_name) }}</span>
            <span class="donor__text">
              <span class="donor__name">{{ donor.full_name }}</span>
              <span class="donor__meta">{{ [donor.donor_code, donor.blood_type].filter(Boolean).join(' · ') }}</span>
            </span>
            <button type="button" class="pdf__btn pdf__btn--sm" :disabled="busy" @click="clearDonor">Change</button>
          </div>
          <BloodCenterPriorDeferralNotice v-if="donor.prior_deferral" :deferral="donor.prior_deferral" />
        </template>

        <BloodCenterQuickDonorForm
          v-else-if="registering"
          :blood-types="bloodTypes"
          :initial-name="query"
          @registered="onRegistered"
          @cancel="registering = false"
        />

        <template v-else>
          <label class="pdf__field">
            <span class="sr-only">Find the donor by name, email or phone number</span>
            <span class="search">
              <AssetIcon name="search" :size="15" class="search__icon" />
              <input
                ref="searchInput"
                v-model="query"
                type="search"
                class="pdf__input search__input"
                autocomplete="off"
                spellcheck="false"
                placeholder="Name, email or phone number on the form"
                @input="onQueryInput"
                @keydown.enter.prevent="runSearch"
              >
            </span>
          </label>
          <p class="pdf__status" aria-live="polite">
            <template v-if="searching">Searching…</template>
            <template v-else-if="query.trim().length === 1">Keep typing: two letters or more.</template>
          </p>
          <p v-if="searchError" class="pdf__alert" role="alert">{{ searchError }}</p>

          <ul v-if="results?.length" class="results">
            <li v-for="result in results" :key="result.uuid">
              <button type="button" class="result" :disabled="busy" @click="chooseDonor(result)">
                <span class="donor__avatar" aria-hidden="true">{{ initialsOf(result.full_name) }}</span>
                <span class="donor__text">
                  <span class="donor__name">
                    {{ result.full_name }}
                    <span v-if="result.scope === 'cross_facility'" class="tag">New to this centre</span>
                  </span>
                  <span class="donor__meta">{{ [result.donor_code, result.blood_type].filter(Boolean).join(' · ') }}</span>
                </span>
                <AssetIcon name="chevron-right" :size="16" class="result__go" />
              </button>
            </li>
          </ul>
          <p v-if="results && !results.length" class="pdf__status">
            No donor matches “{{ searchedFor }}”. A donor from another centre is found by their exact email or phone.
          </p>

          <button type="button" class="pdf__btn pdf__btn--ghost" @click="registering = true">
            <AssetIcon name="circle-plus" :size="14" />
            Not in RedAgos? Register the donor
          </button>
        </template>
      </div>
    </div>

    <!-- 2. SCREENING -->
    <div class="pdf__step">
      <span class="pdf__num" aria-hidden="true">2</span>
      <div class="pdf__body">
        <h3 class="pdf__label">Screening</h3>

        <div class="grid grid--2">
          <label class="pdf__field">
            <span class="pdf__flabel">Screened by</span>
            <input v-model="form.screened_by_name" type="text" class="pdf__input" maxlength="120" placeholder="As written on the paper">
          </label>
          <label class="pdf__field">
            <span class="pdf__flabel">Time screened <span class="pdf__optional">optional</span></span>
            <input v-model="form.screened_time" type="time" class="pdf__input">
          </label>
        </div>

        <fieldset class="outcomes">
          <legend class="pdf__flabel">Remarks</legend>
          <label
            v-for="option in PAPER_OUTCOMES"
            :key="option.value"
            class="outcome"
            :class="{ 'outcome--on': form.outcome === option.value, 'outcome--defer': option.value !== 'accepted' }"
          >
            <input v-model="form.outcome" type="radio" name="paper-outcome" :value="option.value" class="outcome__radio">
            {{ option.label }}
          </label>
        </fieldset>

        <!-- The code the drive's physician wrote, listed bare; or Other, with the reason as written. -->
        <div v-if="form.outcome !== 'accepted'" class="pdf__field">
          <label class="pdf__flabel" for="paper-deferral-code">Deferral code</label>
          <SelectField
            id="paper-deferral-code"
            v-model="form.deferral_code"
            :placeholder="deferralCodes.loading ? 'Loading…' : 'As written on the paper'"
            :options="deferralCodeChoices"
          />
          <span v-if="deferralCodes.error" class="pdf__flabel">{{ deferralCodes.error }}</span>
        </div>
        <label v-if="form.outcome !== 'accepted' && form.deferral_code === OTHER_DEFERRAL" class="pdf__field">
          <span class="pdf__flabel">Reason for deferral</span>
          <input v-model="form.other_reason" type="text" class="pdf__input" maxlength="255" placeholder="As written on the paper">
        </label>

        <div class="grid grid--6">
          <label class="pdf__field">
            <span class="pdf__flabel">Systolic BP</span>
            <input v-model="form.systolic_bp" type="number" class="pdf__input" placeholder="mmHg">
          </label>
          <label class="pdf__field">
            <span class="pdf__flabel">Diastolic BP</span>
            <input v-model="form.diastolic_bp" type="number" class="pdf__input" placeholder="mmHg">
          </label>
          <label class="pdf__field">
            <span class="pdf__flabel">Pulse</span>
            <input v-model="form.pulse_bpm" type="number" class="pdf__input" placeholder="bpm">
          </label>
          <label class="pdf__field">
            <span class="pdf__flabel">Temperature</span>
            <input v-model="form.temperature_c" type="number" step="0.1" class="pdf__input" placeholder="°C">
          </label>
          <label class="pdf__field">
            <span class="pdf__flabel">Weight</span>
            <input v-model="form.weight_kg" type="number" class="pdf__input" placeholder="kg">
          </label>
          <label class="pdf__field">
            <span class="pdf__flabel">Haemoglobin</span>
            <input v-model="form.haemoglobin_g_dl" type="number" step="0.1" class="pdf__input" placeholder="g/dL">
          </label>
        </div>

        <details class="more">
          <summary class="more__summary">More from the form: fingerprick typing, examination, notes</summary>
          <div class="more__body">
            <fieldset class="pdf__fieldset">
              <legend class="pdf__flabel">Fingerprick blood type <span class="pdf__optional">optional</span></legend>
              <BloodCenterBloodTypePicker v-model="form.fingerprick_blood_type_id" :blood-types="bloodTypes" optional />
            </fieldset>
            <div class="grid grid--4">
              <label v-for="field in EXAM_FIELDS" :key="field.key" class="pdf__field">
                <span class="pdf__flabel">{{ field.label }}</span>
                <input v-model="form[field.key]" type="text" class="pdf__input" maxlength="255">
              </label>
            </div>
            <label class="pdf__field">
              <span class="pdf__flabel">Notes <span class="pdf__optional">optional</span></span>
              <textarea v-model="form.notes" class="pdf__input pdf__textarea" rows="2" maxlength="500" />
            </label>
          </div>
        </details>
      </div>
    </div>

    <!-- 3. COLLECTION -->
    <div v-if="form.outcome === 'accepted'" class="pdf__step">
      <span class="pdf__num" aria-hidden="true">3</span>
      <div class="pdf__body">
        <h3 class="pdf__label">For phlebotomist use</h3>

        <fieldset class="outcomes">
          <legend class="sr-only">Was the bag drawn?</legend>
          <label class="outcome" :class="{ 'outcome--on': form.draw === 'collected' }">
            <input v-model="form.draw" type="radio" name="paper-draw" value="collected" class="outcome__radio">
            Bag drawn
          </label>
          <label class="outcome outcome--defer" :class="{ 'outcome--on': form.draw === 'failed' }">
            <input v-model="form.draw" type="radio" name="paper-draw" value="failed" class="outcome__radio">
            Draw not completed
          </label>
        </fieldset>

        <label v-if="form.draw === 'failed'" class="pdf__field">
          <span class="pdf__flabel">Why the draw was not completed</span>
          <input v-model="form.draw_failed_reason" type="text" class="pdf__input" maxlength="255">
        </label>

        <template v-else>
          <fieldset class="outcomes">
            <legend class="pdf__flabel">Blood bag</legend>
            <label
              v-for="bag in bagTypes"
              :key="bag.value"
              class="outcome"
              :class="{ 'outcome--on': form.blood_bag_type === bag.value }"
            >
              <input v-model="form.blood_bag_type" type="radio" name="paper-bag" :value="bag.value" class="outcome__radio">
              {{ bag.label }}
            </label>
          </fieldset>

          <div class="grid grid--5">
            <label class="pdf__field pdf__field--wide">
              <span class="pdf__flabel">Donation barcode (sticker)</span>
              <input
                v-model="form.donation_barcode"
                type="text"
                class="pdf__input pdf__input--mono"
                autocomplete="off"
                spellcheck="false"
                autocapitalize="characters"
                maxlength="30"
                placeholder="Scan or type the sticker"
              >
            </label>
            <label class="pdf__field">
              <span class="pdf__flabel">Time started</span>
              <input v-model="form.started_time" type="time" class="pdf__input">
            </label>
            <label class="pdf__field">
              <span class="pdf__flabel">Time ended</span>
              <input v-model="form.ended_time" type="time" class="pdf__input">
            </label>
            <label class="pdf__field">
              <span class="pdf__flabel">Volume</span>
              <input v-model="form.volume_ml" type="number" class="pdf__input" placeholder="mL">
            </label>
          </div>

          <label class="pdf__field pdf__field--half">
            <span class="pdf__flabel">Phlebotomist</span>
            <input v-model="form.phlebotomist_name" type="text" class="pdf__input" maxlength="120" placeholder="As written on the paper">
          </label>

          <label class="check">
            <input v-model="form.not_to_lab" type="checkbox">
            <span>
              <strong>This bag will not reach the laboratory</strong>
              <span class="pdf__optional">Lost or broken on the way back, or an old record. The draw still counts for the donor.</span>
            </span>
          </label>
          <label v-if="form.not_to_lab" class="pdf__field">
            <span class="pdf__flabel">Why</span>
            <input v-model="form.not_to_lab_reason" type="text" class="pdf__input" maxlength="255">
          </label>
        </template>
      </div>
    </div>

    <!-- SAVE -->
    <ul v-if="attempted && problems.length" class="problems" role="alert">
      <li v-for="problem in problems" :key="problem">{{ problem }}</li>
    </ul>

    <div v-if="conflict" class="conflict" role="alertdialog" aria-labelledby="conflict-text">
      <AssetIcon name="triangle-alert" :size="17" class="conflict__icon" />
      <p id="conflict-text" class="conflict__text">
        <strong>{{ conflict.message }}</strong>
        Check that this is the right donor and the right sheet. Save anyway only if the paper shows both draws.
      </p>
      <div class="conflict__actions">
        <button type="button" class="pdf__btn" :disabled="busy" @click="conflict = null">Back</button>
        <button type="button" class="pdf__btn pdf__btn--primary" :disabled="busy" @click="save(true)">Save anyway</button>
      </div>
    </div>

    <p v-if="error" class="pdf__alert" role="alert">{{ error }}</p>

    <div class="pdf__actions">
      <button type="button" class="pdf__btn" :disabled="busy" @click="reset">Clear</button>
      <button type="button" class="pdf__btn pdf__btn--primary" :disabled="busy || Boolean(conflict)" @click="save(false)">
        {{ busy ? 'Saving…' : 'Save donor' }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import AssetIcon from '~/components/common/AssetIcon.vue'
import SelectField from '~/components/common/SelectField.vue'
import type { BloodTypeOption } from '~/utils/bloodType'
import { OTHER_DEFERRAL, deferralCodeOptions, type DeferralCode } from '~/utils/deferralCodes'
import {
  PAPER_OUTCOMES,
  blankPaperRow,
  paperRowPayload,
  paperRowProblems,
  type PaperSheet,
} from '~/utils/paperDonations'
import { computed, nextTick, reactive, ref, watch } from 'vue'

/**
 * One donor's paper record from a drive: who, the screening, and the bag.
 *
 * Built to be typed through quickly from a stack of forms: after a save the
 * form clears, keeps the sheet's default names, and puts the cursor back in
 * the donor search. The server is the authority on every rule; the problems
 * list only says what is missing before a request is made.
 */

const props = defineProps<{
  sheet: PaperSheet
  bloodTypes: BloodTypeOption[]
  bagTypes: { value: string; label: string; code?: string }[]
}>()

const emit = defineEmits<{
  saved: [row: Record<string, any>, message: string]
}>()

const EXAM_FIELDS = [
  { key: 'general_appearance', label: 'General appearance' },
  { key: 'skin', label: 'Skin' },
  { key: 'heent', label: 'HEENT' },
  { key: 'heart_and_lungs', label: 'Heart and lungs' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'meal', label: 'Meal' },
  { key: 'meds', label: 'Meds' },
  { key: 'allergies', label: 'Allergies' },
] as const


const form = reactive(blankPaperRow(props.sheet))
const donor = ref<Record<string, any> | null>(null)
const registering = ref(false)
const attempted = ref(false)
const busy = ref(false)
const error = ref('')
const conflict = ref<{ message: string; date: string } | null>(null)

const problems = computed(() => {
  const list = paperRowProblems(form, props.sheet.held_on)
  return donor.value ? list : ['Choose the donor.', ...list]
})

/* ---------- the centre's deferral codes ---------- */

const deferralCodes = reactive<{ list: DeferralCode[], loading: boolean, loaded: boolean, error: string }>({
  list: [], loading: false, loaded: false, error: '',
})
const deferralCodeChoices = computed(() => deferralCodeOptions(deferralCodes.list))

async function loadDeferralCodes() {
  if (deferralCodes.loaded || deferralCodes.loading) return
  deferralCodes.loading = true
  deferralCodes.error = ''
  try {
    const res = await bloodCenterService.deferralCodes()
    deferralCodes.list = res?.data ?? []
    deferralCodes.loaded = true
  } catch (err: any) {
    deferralCodes.error = err?.message || 'The deferral codes could not be loaded.'
  } finally {
    deferralCodes.loading = false
  }
}

// Loaded the first time a row is marked deferred.
watch(() => form.outcome, (outcome) => { if (outcome !== 'accepted') loadDeferralCodes() })

/* ---------- donor search: the counter's own ---------- */

const searchInput = ref<HTMLInputElement | null>(null)
const query = ref('')
const searchedFor = ref('')
const searching = ref(false)
const searchError = ref('')
const results = ref<Record<string, any>[] | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchSeq = 0

function initialsOf(name: string) {
  return (name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}

function onQueryInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(runSearch, 300)
}

async function runSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  const q = query.value.trim()

  if (q.length < 2 || q === searchedFor.value) return

  const mine = ++searchSeq
  searching.value = true
  searchError.value = ''

  try {
    const res: any = await bloodCenterService.searchCounterDonors(q)
    if (mine !== searchSeq) return
    results.value = res?.data ?? []
    searchedFor.value = q
  } catch (err: any) {
    if (mine !== searchSeq) return
    results.value = null
    searchError.value = err?.status === 429
      ? 'Too many searches just now. Wait a moment and try again.'
      : err?.message || 'The search failed. Try again.'
  } finally {
    if (mine === searchSeq) searching.value = false
  }
}

/** Through the exact lookup, as at the counter: it carries any standing deferral. */
async function chooseDonor(result: Record<string, any>) {
  busy.value = true
  searchError.value = ''

  try {
    const found: any = await bloodCenterService.lookupDonor({ type: 'donor_code', value: result.donor_code })
    donor.value = {
      uuid: found.uuid,
      donor_code: found.donor_code,
      full_name: found.full_name,
      blood_type: found.blood_type ?? null,
      prior_deferral: found.prior_deferral ?? null,
    }
  } catch (err: any) {
    searchError.value = err?.status === 404
      ? 'That donor could not be found any more. Search again.'
      : err?.message || 'The donor could not be opened. Try again.'
  } finally {
    busy.value = false
  }
}

function onRegistered(registered: Record<string, any>) {
  registering.value = false
  donor.value = {
    uuid: registered.uuid,
    donor_code: registered.donor_code,
    full_name: registered.full_name,
    blood_type: registered.blood_type ?? null,
    prior_deferral: null,
  }
}

function clearDonor() {
  donor.value = null
  conflict.value = null
  resetSearch()
  nextTick(() => searchInput.value?.focus())
}

function resetSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchSeq++
  query.value = ''
  searchedFor.value = ''
  searching.value = false
  searchError.value = ''
  results.value = null
}

/* ---------- save ---------- */

function reset() {
  Object.assign(form, blankPaperRow(props.sheet))
  donor.value = null
  registering.value = false
  attempted.value = false
  error.value = ''
  conflict.value = null
  resetSearch()
  nextTick(() => searchInput.value?.focus())
}

async function save(confirmInterval: boolean) {
  attempted.value = true
  error.value = ''

  if (problems.value.length || !donor.value || busy.value) return

  busy.value = true

  try {
    const res: any = await bloodCenterService.recordPaperDonation(
      props.sheet.id,
      paperRowPayload(form, props.sheet.held_on, donor.value.uuid, confirmInterval),
    )
    emit('saved', res.data, res.message)
    busy.value = false
    reset()
  } catch (err: any) {
    busy.value = false

    if (err?.data?.code === 'interval_conflict') {
      conflict.value = { message: err.message, date: err.data?.data?.date ?? '' }
      return
    }

    conflict.value = null
    error.value = Object.values(err?.errors ?? {}).flat()[0] as string || err?.message || 'The record could not be saved.'
  }
}

defineExpose({ reset })
</script>

<style scoped>
.pdf {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 20px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.03);
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

.pdf__head { display: flex; flex-direction: column; gap: 3px; }
.pdf__title { margin: 0; font-size: 15px; font-weight: 700; }

/* Numbered steps down a rule, the order the paper form prints them. */
.pdf__step { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 12px; }

.pdf__num {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  background: var(--rb-surface-alt);
  font-size: 12px;
  font-weight: 700;
  color: var(--rb-text-secondary);
}

.pdf__body { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding-top: 2px; }
.pdf__label { margin: 0; font-size: 13.5px; font-weight: 700; }

.grid { display: grid; gap: 10px 12px; }
.grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.grid--5 { grid-template-columns: 2fr repeat(3, minmax(0, 1fr)); }
.grid--6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }

.pdf__field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.pdf__field--half { max-width: 50%; }
.pdf__flabel { font-size: 12px; font-weight: 600; }
.pdf__optional { margin-left: 3px; font-weight: 500; font-size: 11.5px; color: var(--rb-text-secondary); }
.pdf__fieldset { margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 6px; }
.pdf__status { margin: 0; min-height: 0; font-size: 12px; color: var(--rb-text-secondary); }
.pdf__status:empty { display: none; }

.pdf__input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 9px;
  background-color: var(--rb-surface);
  font-family: inherit;
  font-size: 13px;
  color: var(--rb-text-primary);
  color-scheme: light dark;
}

.pdf__input--mono { font-family: var(--rb-font-mono); text-transform: uppercase; }
.pdf__textarea { height: auto; min-height: 58px; padding: 8px 10px; line-height: 1.5; resize: vertical; }
.pdf__input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.pdf__input::placeholder { color: var(--rb-placeholder); }

.search { position: relative; display: block; max-width: 460px; }
.search__icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--rb-text-secondary); pointer-events: none; }
.search__input { padding-left: 34px; }

/* ---------- Donor ---------- */
.donor,
.result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--rb-border);
  border-radius: 10px;
  background: var(--rb-surface);
}

.donor { max-width: 460px; }

.donor__avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  font-size: 11.5px;
  font-weight: 700;
  color: var(--rb-text-secondary);
}

.donor__text { display: flex; flex-direction: column; min-width: 0; flex: 1; text-align: left; }
.donor__name { font-size: 13px; font-weight: 700; text-transform: capitalize; overflow-wrap: anywhere; }
.donor__meta { font-size: 11.5px; color: var(--rb-text-secondary); }

.results { display: flex; flex-direction: column; gap: 6px; max-width: 460px; margin: 0; padding: 0; list-style: none; }
.result { width: 100%; font-family: inherit; color: inherit; cursor: pointer; transition: border-color 0.12s ease, background 0.12s ease; }
.result:hover:not(:disabled) { border-color: rgba(var(--rb-primary-rgb), 0.45); background: var(--rb-surface-hover); }
.result:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.result__go { color: var(--rb-text-secondary); }

.tag {
  margin-left: 6px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid var(--rb-border-strong);
  font-size: 10.5px;
  font-weight: 600;
  text-transform: none;
  color: var(--rb-text-secondary);
}

/* ---------- Choices ---------- */
.outcomes { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; border: 0; }
.outcomes legend { width: 100%; margin-bottom: 6px; padding: 0; }

.outcome {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 0 13px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 9px;
  background: var(--rb-surface);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
}

.outcome__radio { position: absolute; opacity: 0; pointer-events: none; }
.outcome:hover { background: var(--rb-surface-hover); }
.outcome:has(.outcome__radio:focus-visible) { box-shadow: var(--rb-focus-ring); }
.outcome--on { border-color: var(--rb-primary); color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), 0.08); }
.outcome--defer.outcome--on { border-color: var(--rb-accent); color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), 0.07); }

.check { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; line-height: 1.45; cursor: pointer; }
.check input { margin-top: 3px; }
.check .pdf__optional { display: block; margin-left: 0; }

.more { border: 1px solid var(--rb-border); border-radius: 10px; }

.more__summary {
  padding: 9px 12px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.more__summary:hover { color: var(--rb-text-primary); }
.more__summary:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); border-radius: 10px; }
.more__body { display: flex; flex-direction: column; gap: 12px; padding: 4px 12px 12px; }

/* ---------- Save ---------- */
.problems {
  margin: 0;
  padding: 10px 12px 10px 30px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 10px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--rb-accent-text);
}

.conflict {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px 10px;
  padding: 12px 14px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.4);
  border-radius: 10px;
  background: rgba(var(--rb-accent-rgb), 0.05);
}

.conflict__icon { color: var(--rb-accent-text); margin-top: 1px; }
.conflict__text { margin: 0; font-size: 13px; line-height: 1.5; }
.conflict__text strong { display: block; }
.conflict__actions { grid-column: 2; display: flex; gap: 8px; }

.pdf__alert {
  margin: 0;
  padding: 9px 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 8px;
  color: var(--rb-accent-text);
  font-size: 13px;
}

.pdf__actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 14px; border-top: 1px solid var(--rb-border); }

.pdf__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.pdf__btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.pdf__btn:disabled { opacity: 0.55; cursor: not-allowed; }
.pdf__btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.pdf__btn--sm { height: 30px; padding: 0 10px; font-size: 12px; border-radius: 8px; }
.pdf__btn--primary { color: #fff; background: var(--rb-primary); border-color: var(--rb-primary); }
.pdf__btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.pdf__btn--ghost { align-self: flex-start; border-style: dashed; color: var(--rb-text-secondary); }
.pdf__btn--ghost:hover:not(:disabled) { color: var(--rb-primary-text); }

@media (max-width: 1100px) {
  .grid--6 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .grid--4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 760px) {
  .grid--2,
  .grid--5 { grid-template-columns: minmax(0, 1fr); }
  .grid--6 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pdf__field--half { max-width: none; }
  .pdf { padding: 16px; }
}
</style>
