<template>
  <article class="sheet">
    <header class="sheet__head">
      <div>
        <p class="sheet__centre">{{ data.facility?.name || 'Blood Center' }}</p>
        <h1 class="sheet__title">Blood Donor's Health Questionnaire</h1>
        <p class="sheet__meta">
          Questionnaire version {{ data.question_version }}
          <template v-if="data.consent?.version"> · Consent {{ data.consent.version }}</template>
        </p>
      </div>
      <dl class="sheet__id">
        <div><dt>Donor ID</dt><dd>{{ personal.donor_code }}</dd></div>
        <div><dt>Answered</dt><dd>{{ longDate(data.screened_at) }}</dd></div>
        <div><dt>Valid until</dt><dd>{{ longDate(data.valid_until) }}</dd></div>
      </dl>
    </header>

    <!-- Where the answers came from, said once and plainly. -->
    <p class="sheet__source">
      {{ sourceLine }}
      <template v-if="data.is_current_version === false">
        This is an earlier version of the questionnaire; ask the remaining items in person.
      </template>
      <template v-if="data.is_expired"> These answers are past their validity date.</template>
    </p>

    <!--
      The four boxes the paper form prints in its top margin. Staff ask them in
      person on the day, so the sheet leaves them blank to be written in.
    -->
    <table class="sheet__intake">
      <tr>
        <th>Sleep</th><td />
        <th>Meal</th><td />
        <th>Meds</th><td />
        <th>Allergies</th><td />
      </tr>
    </table>

    <section class="sheet__section">
      <h2 class="sheet__heading">I-A. Personal data</h2>
      <table class="sheet__grid">
        <tr v-for="(row, i) in personalRows" :key="i">
          <template v-for="cell in row" :key="cell.label">
            <th>{{ cell.label }}</th>
            <td :colspan="cell.wide ? 3 : 1">{{ cell.value }}</td>
          </template>
        </tr>
      </table>
    </section>

    <section class="sheet__section">
      <h2 class="sheet__heading">I-B. Donor history</h2>
      <table class="sheet__questions">
        <thead>
          <tr>
            <th class="sheet__q-no">No.</th>
            <th>Question</th>
            <th class="sheet__q-mark">Yes</th>
            <th class="sheet__q-mark">No</th>
          </tr>
        </thead>
        <tbody v-for="section in data.sections || []" :key="section.key">
          <tr class="sheet__q-section">
            <td colspan="4">{{ section.title }}</td>
          </tr>
          <tr v-for="question in section.questions" :key="question.code">
            <td class="sheet__q-no">{{ question.number }}</td>
            <td>{{ question.text }}</td>
            <!-- A question never put to this donor is not a "No". -->
            <td v-if="!question.applicable || question.answer === null" colspan="2" class="sheet__q-na">
              {{ question.answer_label }}
            </td>
            <template v-else>
              <td class="sheet__q-mark">{{ question.answer ? '✓' : '' }}</td>
              <td class="sheet__q-mark">{{ question.answer ? '' : '✓' }}</td>
            </template>
          </tr>
        </tbody>
      </table>

      <p v-if="declaredLine" class="sheet__note">{{ declaredLine }}</p>
    </section>

    <section class="sheet__section sheet__section--keep">
      <h2 class="sheet__heading">I-C. Donor's informed consent</h2>
      <template v-if="data.consent?.captured">
        <ol class="sheet__consent">
          <li v-for="(statement, i) in data.consent.statements" :key="i">{{ statement }}</li>
        </ol>
        <p class="sheet__note">
          The donor accepted every statement above on {{ longDate(data.consent.consented_on) }}.
        </p>
      </template>
      <!-- Never a blank: a form with no consent has to say so. -->
      <p v-else class="sheet__note sheet__note--strong">{{ data.consent?.note || 'No consent is on file.' }}</p>

      <dl class="sheet__contact">
        <div><dt>Contact person</dt><dd>{{ personal.contact_person_name || '' }}</dd></div>
        <div><dt>Contact number</dt><dd>{{ personal.contact_person_number || '' }}</dd></div>
        <div class="sheet__contact-wide"><dt>Address</dt><dd>{{ personal.contact_person_address || '' }}</dd></div>
      </dl>

      <div class="sheet__signatures">
        <div><span class="sheet__line" />Donor's signature over printed name</div>
        <div><span class="sheet__line" />Date</div>
        <div><span class="sheet__line" />Interviewed by (signature over printed name)</div>
      </div>
    </section>

    <footer class="sheet__foot">
      Printed {{ longDateTime(data.printed_at) }} from RedAgos · {{ personal.donor_code }}
    </footer>
  </article>
</template>

<script setup>
/**
 * The donor's completed questionnaire as the paper DOH form.
 *
 * Built from the print read, which carries the answers and nothing the centre
 * made of them: no review markers and no advisory assessment. The sheet travels
 * with the donor from the desk to the physician, so it reads as the document
 * the donor declared, with the lines staff complete by hand left blank.
 */

const props = defineProps({
  data: { type: Object, required: true },
})

const personal = computed(() => props.data.personal_data || {})

function text(value) {
  return value === null || value === undefined || value === '' ? '' : String(value)
}

// Two label/value pairs to a row, in the order the paper form asks for them.
const personalRows = computed(() => {
  const p = personal.value
  const name = [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(', ')

  return [
    [{ label: 'Name (last, first, middle)', value: name, wide: true }],
    [{ label: 'Date of birth', value: text(p.date_of_birth) }, { label: 'Age', value: text(p.age) }],
    [{ label: 'Sex', value: text(p.sex) }, { label: 'Civil status', value: text(p.civil_status_label) }],
    [{ label: 'Home address', value: text(p.home_address), wide: true }],
    [{ label: 'Office address', value: text(p.office_address), wide: true }],
    [{ label: 'Contact number', value: text(p.contact_number) }, { label: 'Telephone no.', value: text(p.telephone_no) }],
    [{ label: 'E-mail address', value: text(p.email) }, { label: 'Occupation', value: text(p.occupation) }],
    [{ label: 'Nationality', value: text(p.nationality) }, { label: 'Religion', value: text(p.religion) }],
    [{ label: 'Blood type', value: text(p.blood_type) }, { label: 'Type of donor', value: text(p.donor_type_label) }],
    [{ label: 'No. of times donated', value: text(p.times_donated) }, { label: 'Date of last donation', value: text(p.last_donation?.date) }],
    [{ label: 'Venue of last donation', value: text(p.last_donation?.declared_venue), wide: true }],
  ]
})

const sourceLine = computed(() => {
  const on = longDate(props.data.screened_at)

  if (props.data.completed_via === 'counter') {
    return props.data.recorded_by
      ? `Completed onsite at the counter on ${on}, on ${props.data.recorded_by}'s device.`
      : `Completed onsite at the counter on ${on}.`
  }

  return `Completed by the donor in the Donor Portal on ${on}.`
})

const declaredLine = computed(() => {
  const v = props.data.vitals_declared || {}
  const parts = []

  if (v.weight_kg) parts.push(`Declared weight: ${v.weight_kg} kg`)
  if (v.last_menstrual_period) parts.push(`Last menstrual period: ${longDate(v.last_menstrual_period)}`)

  return parts.join(' · ')
})

function longDate(value) {
  if (!value) return '—'

  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)

  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
}

function longDateTime(value) {
  if (!value) return ''

  const d = new Date(value)

  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString([], { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
/*
 * Paper, not screen: black on white whatever the theme, sized for A4. The page
 * around it supplies the margins and the on-screen shadow.
 */
.sheet {
  width: 186mm;
  margin: 0 auto;
  color: #000;
  background: #fff;
  font-family: var(--rb-font-sans), Arial, sans-serif;
  font-size: 10.5px;
  line-height: 1.4;
}

.sheet__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8mm;
  padding-bottom: 3mm;
  border-bottom: 1.5px solid #000;
}

.sheet__centre { margin: 0; font-size: 11px; font-weight: 700; }
.sheet__title { margin: 1mm 0 0; font-size: 15px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; }
.sheet__meta { margin: 1mm 0 0; font-size: 9.5px; }

.sheet__id { margin: 0; display: grid; gap: 0.6mm; font-size: 9.5px; }
.sheet__id div { display: flex; justify-content: space-between; gap: 4mm; }
.sheet__id dt { margin: 0; }
.sheet__id dd { margin: 0; font-weight: 700; text-align: right; }

.sheet__source { margin: 2.5mm 0 0; font-size: 10px; }

.sheet__intake,
.sheet__grid,
.sheet__questions {
  width: 100%;
  border-collapse: collapse;
}

.sheet__intake { margin-top: 3mm; }
.sheet__intake th,
.sheet__intake td { border: 1px solid #000; padding: 1.6mm 2mm; }
.sheet__intake th { width: 1%; white-space: nowrap; font-weight: 700; text-align: left; }
.sheet__intake td { width: 24%; }

.sheet__section { margin-top: 4mm; }
.sheet__section--keep { break-inside: avoid; }

.sheet__heading {
  margin: 0 0 1.5mm;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.sheet__grid th,
.sheet__grid td { border: 1px solid #000; padding: 1.2mm 2mm; vertical-align: top; }
.sheet__grid th { width: 22%; font-weight: 600; text-align: left; font-size: 9.5px; }
.sheet__grid td { width: 28%; }

.sheet__questions th,
.sheet__questions td { border: 1px solid #000; padding: 1.1mm 1.6mm; vertical-align: top; }
.sheet__questions thead th { font-weight: 700; text-align: left; }
.sheet__questions tr { break-inside: avoid; }
.sheet__q-no { width: 8mm; text-align: center; }
.sheet__q-mark { width: 11mm; text-align: center !important; font-weight: 700; }
.sheet__q-na { text-align: center; font-style: italic; font-size: 9.5px; }
.sheet__q-section td { font-weight: 700; background: #eee; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.03em; }

.sheet__note { margin: 1.5mm 0 0; font-size: 9.5px; }
.sheet__note--strong { font-weight: 700; }

.sheet__consent { margin: 0; padding-left: 5mm; display: grid; gap: 1mm; }

.sheet__contact {
  margin: 3mm 0 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5mm 6mm;
}
.sheet__contact div { display: flex; gap: 2mm; border-bottom: 1px solid #000; padding-bottom: 0.5mm; }
.sheet__contact dt { margin: 0; font-weight: 600; white-space: nowrap; }
.sheet__contact dd { margin: 0; }
.sheet__contact-wide { grid-column: 1 / -1; }

.sheet__signatures {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr;
  gap: 8mm;
  margin-top: 12mm;
  font-size: 9.5px;
  text-align: center;
}
.sheet__line { display: block; border-top: 1px solid #000; margin-bottom: 1mm; }

.sheet__foot { margin-top: 6mm; font-size: 8.5px; text-align: right; }
</style>
