<template>
  <div class="link-page">
    <header class="link-top">
      <NuxtLink to="/" class="brand" aria-label="RedAgos home">
        <img :src="logo" alt="" class="brand__logo" width="30" height="30">
        <span class="brand__name">RedAgos</span>
      </NuxtLink>
    </header>

    <main class="link-main">
      <!-- Loading -->
      <div v-if="loading" class="card card--state" aria-busy="true">
        <span class="spinner" aria-hidden="true" />
        <p class="state-title">Loading the drive…</p>
      </div>

      <!-- Not a link -->
      <div v-else-if="notFound" class="card card--state" role="alert">
        <span class="state-icon"><AssetIcon name="search-x" :size="22" /></span>
        <h1 class="state-title">This registration link is not valid</h1>
        <p class="state-text">Ask the blood centre or the organiser for the drive's link.</p>
      </div>

      <div v-else-if="loadError" class="card card--state" role="alert">
        <span class="state-icon state-icon--error"><AssetIcon name="circle-alert" :size="22" /></span>
        <h1 class="state-title">Could not load the drive</h1>
        <p class="state-text">{{ loadError }}</p>
        <button type="button" class="btn btn--outline" @click="load">Try again</button>
      </div>

      <template v-else-if="drive">
        <!-- The drive -->
        <section class="card drive" aria-labelledby="drive-title">
          <p class="drive__centre">{{ drive.centre_name }}</p>
          <h1 id="drive-title" class="drive__name">{{ drive.name }}</h1>
          <ul class="drive__facts">
            <li><AssetIcon name="calendar" :size="15" />{{ longDate(drive.event_date) }}</li>
            <li v-if="drive.start_time"><AssetIcon name="clock" :size="15" />{{ hours(drive) }}</li>
            <li><AssetIcon name="map-pin" :size="15" />{{ drive.location }}</li>
          </ul>
          <p v-if="drive.announcement" class="drive__note">{{ drive.announcement }}</p>
        </section>

        <!-- Not taking registrations -->
        <section v-if="drive.state !== 'open'" class="card card--state" role="status">
          <span class="state-icon"><AssetIcon :name="drive.state === 'cancelled' ? 'circle-x' : 'lock'" :size="22" /></span>
          <h2 class="state-title">{{ LINK_STATE_TITLES[drive.state] }}</h2>
          <p v-if="drive.cancellation_reason" class="state-text">{{ drive.cancellation_reason }}</p>
        </section>

        <!-- Done -->
        <section v-else-if="done" class="card card--state" role="status" aria-live="polite">
          <span class="state-icon state-icon--ok"><AssetIcon name="check-circle" :size="22" /></span>
          <h2 class="state-title">{{ done.title }}</h2>
          <p class="state-text">{{ done.message }}</p>
          <button type="button" class="btn btn--outline" @click="startAgain">Register someone else</button>
        </section>

        <!-- The forms -->
        <section v-else class="card form-card" aria-labelledby="form-title">
          <h2 id="form-title" class="sr-only">Register for this drive</h2>

          <div class="seg" role="tablist" aria-label="Who is registering">
            <button
              v-for="tab in TABS"
              :key="tab.value"
              type="button"
              role="tab"
              class="seg__btn"
              :class="{ 'seg__btn--on': mode === tab.value }"
              :aria-selected="mode === tab.value"
              @click="switchMode(tab.value)"
            >
              <AssetIcon :name="tab.icon" :size="15" />
              {{ tab.label }}
            </button>
          </div>

          <p class="account-line">
            Have a donor portal account?
            <NuxtLink to="/auth/login" class="link">Sign in to book</NuxtLink>
          </p>

          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

          <!-- Myself -->
          <form v-if="mode === 'self'" class="form" novalidate @submit.prevent="submitSelf">
            <div class="row">
              <div class="field">
                <label for="self-first">First name</label>
                <input id="self-first" v-model="person.first_name" v-person-name class="input" :class="{ 'input--invalid': errors.first_name }" autocomplete="given-name" maxlength="150">
                <p v-if="errors.first_name" class="field-error">{{ errors.first_name }}</p>
              </div>
              <div class="field">
                <label for="self-last">Last name</label>
                <input id="self-last" v-model="person.last_name" v-person-name class="input" :class="{ 'input--invalid': errors.last_name }" autocomplete="family-name" maxlength="150">
                <p v-if="errors.last_name" class="field-error">{{ errors.last_name }}</p>
              </div>
            </div>

            <div class="row">
              <div class="field">
                <label for="self-phone">Mobile number</label>
                <PhoneField id="self-phone" v-model="person.phone" :invalid="Boolean(errors.phone)" />
                <p v-if="errors.phone" class="field-error">{{ errors.phone }}</p>
              </div>
              <div class="field">
                <label for="self-email">Email</label>
                <input id="self-email" v-model="person.email" type="email" class="input" :class="{ 'input--invalid': errors.email }" autocomplete="email" maxlength="255">
                <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
              </div>
            </div>

            <div class="row">
              <div class="field">
                <label for="self-birth">Birth date <span class="optional">optional</span></label>
                <DatePicker id="self-birth" v-model="person.birth_date" size="lg" theme="light" placeholder="Select your birth date" :max="todayIso" :invalid="Boolean(errors.birth_date)" />
                <p v-if="errors.birth_date" class="field-error">{{ errors.birth_date }}</p>
              </div>
              <div class="field">
                <label for="self-affiliation">School, office or group <span class="optional">optional</span></label>
                <input id="self-affiliation" v-model="person.affiliation" class="input" maxlength="150">
              </div>
            </div>

            <label class="consent" :class="{ 'consent--invalid': errors.consent }">
              <input v-model="consent" type="checkbox">
              <span>I agree that {{ drive.centre_name || 'the blood centre' }} may contact me about this drive.</span>
            </label>
            <p v-if="errors.consent" class="field-error">{{ errors.consent }}</p>

            <button type="submit" class="btn btn--primary btn--block" :disabled="submitting">
              {{ submitting ? 'Registering…' : 'Register' }}
            </button>
          </form>

          <!-- A group, sent by a partner -->
          <form v-else class="form" novalidate @submit.prevent="submitGroup">
            <div class="row">
              <div class="field">
                <label for="org-name">Organisation</label>
                <input id="org-name" v-model="partner.organisation_name" class="input" :class="{ 'input--invalid': errors.organisation_name }" maxlength="150">
                <p v-if="errors.organisation_name" class="field-error">{{ errors.organisation_name }}</p>
              </div>
              <div class="field">
                <label for="org-contact">Contact person</label>
                <input id="org-contact" v-model="partner.contact_name" v-person-name class="input" :class="{ 'input--invalid': errors.contact_name }" autocomplete="name" maxlength="150">
                <p v-if="errors.contact_name" class="field-error">{{ errors.contact_name }}</p>
              </div>
            </div>

            <div class="row">
              <div class="field">
                <label for="org-phone">Contact's mobile number</label>
                <PhoneField id="org-phone" v-model="partner.contact_phone" :invalid="Boolean(errors.contact_phone)" />
                <p v-if="errors.contact_phone" class="field-error">{{ errors.contact_phone }}</p>
              </div>
              <div class="field">
                <label for="org-email">Contact's email</label>
                <input id="org-email" v-model="partner.contact_email" type="email" class="input" :class="{ 'input--invalid': errors.contact_email }" autocomplete="email" maxlength="255">
                <p v-if="errors.contact_email" class="field-error">{{ errors.contact_email }}</p>
              </div>
            </div>

            <div class="people">
              <div class="people__head">
                <h3 class="people__title">People</h3>
                <span class="people__count">{{ filledPeople }} of {{ maxPeople }}</span>
              </div>

              <div v-for="(row, index) in people" :key="row.key" class="person">
                <span class="person__no" aria-hidden="true">{{ index + 1 }}</span>
                <input v-model="row.data.first_name" v-person-name class="input input--sm" :aria-label="`Person ${index + 1} first name`" placeholder="First name" maxlength="150">
                <input v-model="row.data.last_name" v-person-name class="input input--sm" :aria-label="`Person ${index + 1} last name`" placeholder="Last name" maxlength="150">
                <PhoneField v-model="row.data.phone" size="sm" :aria-label="`Person ${index + 1} mobile number`" />
                <input v-model="row.data.email" type="email" class="input input--sm" :aria-label="`Person ${index + 1} email`" placeholder="Email" maxlength="255">
                <input v-model="row.data.affiliation" class="input input--sm" :aria-label="`Person ${index + 1} section or department`" placeholder="Section or department" maxlength="150">
                <button
                  type="button"
                  class="icon-btn"
                  :disabled="people.length === 1"
                  :aria-label="`Remove person ${index + 1}`"
                  @click="removePerson(index)"
                >
                  <AssetIcon name="x" :size="15" />
                </button>
              </div>

              <button type="button" class="btn btn--outline btn--sm" :disabled="people.length >= maxPeople" @click="addPerson">
                <AssetIcon name="plus" :size="14" />
                Add person
              </button>
            </div>

            <label class="consent" :class="{ 'consent--invalid': errors.consent }">
              <input v-model="consent" type="checkbox">
              <span>The people listed agreed that {{ drive.centre_name || 'the blood centre' }} may contact them about this drive.</span>
            </label>
            <p v-if="errors.consent" class="field-error">{{ errors.consent }}</p>

            <button type="submit" class="btn btn--primary btn--block" :disabled="submitting">
              {{ submitting ? 'Sending…' : 'Send list' }}
            </button>
          </form>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'

import logo from '~/assets/images/RedAgosLogo.png'
import AssetIcon from '~/components/common/AssetIcon.vue'
import DatePicker from '~/components/common/DatePicker.vue'
import PhoneField from '~/components/common/PhoneField.vue'
import { driveLinkService } from '~/api/drive-links/DriveLinkService'
import {
  LINK_STATE_TITLES,
  blankPerson,
  groupErrorMessage,
  groupPayload,
  isBlankPerson,
  personProblem,
  selfPayload,
} from '~/utils/driveRegistration'

// Public: anyone holding the link, signed in or not. Not a portal route, so
// portal.global lets it through for every role.
definePageMeta({ layout: 'default' })

const route = useRoute()
const token = computed(() => String(route.params.token ?? ''))

useHead({ title: 'Drive registration · RedAgos' })

const TABS = [
  { value: 'self', label: 'Register myself', icon: 'user' },
  { value: 'group', label: 'Register a group', icon: 'users' },
]

const loading = ref(true)
const notFound = ref(false)
const loadError = ref('')
const drive = ref(null)
const maxPeople = ref(200)

const mode = ref('self')
const submitting = ref(false)
const formError = ref('')
const errors = reactive({})
const done = ref(null)

const person = reactive(blankPerson())
const consent = ref(false)

const partner = reactive({ organisation_name: '', contact_name: '', contact_phone: '', contact_email: '' })
let nextKey = 1
const people = ref([{ key: nextKey++, data: blankPerson() }])
const filledPeople = computed(() => people.value.filter((row) => !isBlankPerson(row.data)).length)

const todayIso = computed(() => new Date().toISOString().slice(0, 10))

async function load() {
  loading.value = true
  loadError.value = ''
  notFound.value = false
  // The server checks this too; a malformed link need not reach it.
  if (!/^[A-Za-z0-9]{32}$/.test(token.value)) {
    notFound.value = true
    loading.value = false
    return
  }
  try {
    const data = await driveLinkService.drive(token.value)
    drive.value = data.drive
    maxPeople.value = data.group_max_people ?? 200
  } catch (err) {
    if (err?.status === 404) notFound.value = true
    else loadError.value = err?.message || 'Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}

function clearErrors() {
  formError.value = ''
  for (const key of Object.keys(errors)) delete errors[key]
}

function switchMode(value) {
  mode.value = value
  consent.value = false
  clearErrors()
}

function addPerson() {
  people.value.push({ key: nextKey++, data: blankPerson() })
}

function removePerson(index) {
  people.value.splice(index, 1)
}

/** Field errors from a 422, first message each. */
function takeErrors(err) {
  const fieldErrors = err?.errors ?? {}
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (!errors[field]) errors[field] = Array.isArray(messages) ? messages[0] : messages
  }
}

/** A refusal for the drive itself (closed, cancelled) moves the page to that state. */
function refusedState(err) {
  const states = { registration_closed: 'closed', drive_cancelled: 'cancelled', drive_completed: 'completed' }
  const code = err?.data?.code
  if (err?.status === 409 && states[code]) {
    drive.value = { ...drive.value, state: states[code] }
    return true
  }
  return false
}

async function submitSelf() {
  clearErrors()
  const problem = personProblem(person)
  if (problem) {
    formError.value = problem
    return
  }
  if (!consent.value) {
    errors.consent = 'Agree to be contacted about this drive to register.'
    return
  }

  submitting.value = true
  try {
    const data = await driveLinkService.registerSelf(token.value, selfPayload(person, consent.value))
    done.value = { title: 'You are on the list', message: data.message }
  } catch (err) {
    if (refusedState(err)) return
    takeErrors(err)
    if (!Object.keys(errors).length) formError.value = err?.message || 'Could not register. Please try again.'
  } finally {
    submitting.value = false
  }
}

async function submitGroup() {
  clearErrors()
  const filled = people.value.map((row) => row.data).filter((row) => !isBlankPerson(row))
  if (!filled.length) {
    formError.value = 'Add at least one person.'
    return
  }
  const problemAt = filled.findIndex((row) => personProblem(row))
  if (problemAt >= 0) {
    formError.value = `Person ${problemAt + 1}: ${personProblem(filled[problemAt])}`
    return
  }
  if (!consent.value) {
    errors.consent = 'Confirm that the people listed agreed to be contacted about this drive.'
    return
  }

  submitting.value = true
  try {
    const data = await driveLinkService.registerGroup(token.value, groupPayload(partner, people.value.map((row) => row.data), consent.value))
    done.value = { title: 'List received', message: data.message }
  } catch (err) {
    if (refusedState(err)) return
    const rowMessage = groupErrorMessage(err?.errors)
    if (rowMessage && /^Person \d+:/.test(rowMessage)) formError.value = rowMessage
    else takeErrors(err)
    if (!formError.value && !Object.keys(errors).length) formError.value = err?.message || 'Could not send the list. Please try again.'
  } finally {
    submitting.value = false
  }
}

function startAgain() {
  done.value = null
  Object.assign(person, blankPerson())
  Object.assign(partner, { organisation_name: '', contact_name: '', contact_phone: '', contact_email: '' })
  people.value = [{ key: nextKey++, data: blankPerson() }]
  consent.value = false
  clearErrors()
}

function longDate(value) {
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function clock(value) {
  const [h, m] = String(value).split(':').map(Number)
  if (Number.isNaN(h)) return String(value)
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function hours(d) {
  return d.end_time ? `${clock(d.start_time)} to ${clock(d.end_time)}` : `From ${clock(d.start_time)}`
}

onMounted(load)
</script>

<style scoped>
.link-page {
  min-height: 100vh;
  background: var(--rb-page-bg, #f6f7f9);
  color: var(--rb-text-primary);
  font-family: var(--rb-font-sans);
}

.link-top {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  max-width: 760px;
  margin: 0 auto;
}

.brand { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: var(--rb-text-primary); }
.brand__logo { width: 30px; height: 30px; object-fit: contain; }
.brand__name { font-size: 16px; font-weight: 800; letter-spacing: -0.01em; }

.link-main {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.04);
  padding: 22px;
}

.card--state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 36px 22px;
}

.state-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: var(--rb-surface-alt);
  color: var(--rb-text-secondary);
}

.state-icon--error { color: var(--rb-accent-text); }
.state-icon--ok { background: rgba(var(--rb-success-rgb), 0.12); color: var(--rb-success-text); }
.state-title { margin: 4px 0 0; font-size: 17px; font-weight: 700; }
.state-text { margin: 0; max-width: 48ch; font-size: 14px; line-height: 1.5; color: var(--rb-text-secondary); }

.spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 3px solid var(--rb-border);
  border-top-color: var(--rb-primary);
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* The drive */
.drive__centre { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--rb-primary-text); }
.drive__name { margin: 4px 0 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.25; }

.drive__facts {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drive__facts li { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; line-height: 1.4; }
.drive__facts :deep(svg) { flex-shrink: 0; margin-top: 2px; color: var(--rb-text-secondary); }

.drive__note {
  margin: 14px 0 0;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-primary-rgb), 0.18);
  border-radius: 10px;
  background: rgba(var(--rb-primary-rgb), 0.05);
  font-size: 13.5px;
  line-height: 1.5;
  white-space: pre-line;
}

/* Tabs */
.seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
}

.seg__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 40px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.seg__btn--on { background: var(--rb-surface); color: var(--rb-text-primary); box-shadow: 0 1px 2px rgba(var(--rb-shadow-rgb), 0.1); }
.seg__btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.account-line { margin: 12px 0 0; font-size: 13px; color: var(--rb-text-secondary); }
.link { color: var(--rb-primary-text); font-weight: 600; }

/* Forms */
.form { display: flex; flex-direction: column; gap: 16px; margin-top: 18px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.field label { font-size: 13px; font-weight: 600; }
.optional { margin-left: 4px; font-weight: 500; color: var(--rb-text-secondary); }

.link-page .input {
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  font-family: inherit;
  font-size: 14px;
}

.link-page .input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.link-page .input::placeholder { color: var(--rb-placeholder); }
.link-page .input--invalid { border-color: var(--rb-accent); }
.link-page .input--sm { min-height: 36px; padding: 6px 10px; font-size: 13px; }

.field-error { margin: 0; font-size: 12.5px; color: var(--rb-accent-text); }

.form-error {
  margin: 14px 0 0;
  padding: 10px 12px;
  border: 1px solid rgba(var(--rb-accent-rgb), 0.35);
  border-radius: 10px;
  background: rgba(var(--rb-accent-rgb), 0.08);
  color: var(--rb-accent-text);
  font-size: 13.5px;
}

/* Consent */
.consent { display: flex; align-items: flex-start; gap: 10px; font-size: 13.5px; line-height: 1.45; cursor: pointer; }
.consent input { width: 17px; height: 17px; margin-top: 1px; flex-shrink: 0; accent-color: var(--rb-primary); }
.consent--invalid span { color: var(--rb-accent-text); }

/* The partner's people */
.people { display: flex; flex-direction: column; gap: 8px; }
.people__head { display: flex; align-items: baseline; justify-content: space-between; }
.people__title { margin: 0; font-size: 14px; font-weight: 700; }
.people__count { font-size: 12.5px; color: var(--rb-text-secondary); font-variant-numeric: tabular-nums; }

.person {
  display: grid;
  grid-template-columns: 22px 1fr 1fr 1.2fr 1.2fr 1fr 32px;
  align-items: center;
  gap: 6px;
}

.person__no { font-size: 12px; font-weight: 700; color: var(--rb-text-secondary); text-align: right; font-variant-numeric: tabular-nums; }

.icon-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--rb-border);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) { color: var(--rb-accent-text); border-color: rgba(var(--rb-accent-rgb), 0.4); }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 11px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.btn--primary { border: 0; background: var(--rb-primary); color: #fff; }
.btn--primary:hover:not(:disabled) { background: color-mix(in srgb, var(--rb-primary) 88%, #000); }
.btn--outline { border: 1px solid var(--rb-border-strong); background: var(--rb-surface); color: var(--rb-text-primary); }
.btn--sm { min-height: 36px; padding: 0 12px; font-size: 13px; align-self: flex-start; }
.btn--block { width: 100%; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 640px) {
  .card { padding: 18px 16px; }
  .row { grid-template-columns: 1fr; }

  .person {
    grid-template-columns: 22px 1fr 1fr 32px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--rb-border);
  }

  .person > :nth-child(4),
  .person > :nth-child(5),
  .person > :nth-child(6) { grid-column: 2 / 4; }

  .person > .icon-btn { grid-column: 4; grid-row: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; }
}
</style>
