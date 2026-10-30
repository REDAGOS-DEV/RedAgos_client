<template>
  <!--
    Hidden on screen. When useReferralSlip() prints, this is the only thing on
    the page: one 100 × 150 mm slip, in the same waybill shape as the bag
    labels, for the watcher to carry to the next blood centre.
  -->
  <Teleport to="body">
    <div class="referral-slip-sheet" aria-hidden="true">
      <article v-if="slip" class="rs">
        <div class="rs__box">
          <header class="rs__head">
            <span class="rs__brand">
              RedAgos
              <small v-if="slip.centre" class="rs__centre">{{ slip.centre }}</small>
            </span>
            <span class="rs__kind">REFERRAL SLIP</span>
          </header>

          <section class="rs__id">
            <svg class="rs__qr" :viewBox="`0 0 ${qr.size} ${qr.size}`" shape-rendering="crispEdges">
              <path :d="qr.path" fill="#000" />
            </svg>
            <div class="rs__id-text">
              <p class="rs__caption">BLOOD REQUEST</p>
              <p class="rs__ref">{{ slip.reference_number }}</p>
              <p v-if="slip.hospital" class="rs__small">{{ slip.hospital }}</p>
            </div>
          </section>

          <section class="rs__patient">
            <div class="rs__patient-who">
              <p class="rs__caption">PATIENT</p>
              <p class="rs__name">{{ slip.patient?.full_name || '—' }}</p>
              <p v-if="patientMeta" class="rs__small">{{ patientMeta }}</p>
            </div>
            <div class="rs__type">
              <p class="rs__caption">BLOOD TYPE</p>
              <p class="rs__abo">{{ slip.blood_type || '—' }}</p>
            </div>
          </section>

          <section class="rs__cell">
            <p class="rs__caption">STILL NEEDED FROM ANOTHER BLOOD CENTER</p>
            <table class="rs__needs">
              <tbody>
                <tr v-for="line in needed" :key="line.component">
                  <td>{{ line.component }} <span class="rs__code">{{ line.code }}</span></td>
                  <td class="rs__units">{{ line.unallocated }} unit{{ line.unallocated === 1 ? '' : 's' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-if="covered.length" class="rs__small">Already covered: {{ covered.join(', ') }}</p>
          </section>

          <section class="rs__cell rs__cell--grow">
            <p class="rs__caption">AT THE NEXT BLOOD CENTER</p>
            <p class="rs__text">
              Bring this slip and the hospital's request form. Staff choose <strong>New Request</strong>, enter the
              hospital, patient and blood type, and scan the QR or type <strong>{{ slip.reference_number }}</strong>
              as the reference on the paperwork, then add their share of the units above.
            </p>
          </section>

          <footer class="rs__foot">
            <span>Issued {{ issuedOn }}<template v-if="slip.centre"> by {{ slip.centre }}</template></span>
            <span v-if="slip.request_reference">From {{ slip.request_reference }}</span>
          </footer>
        </div>
      </article>
    </div>
  </Teleport>
</template>

<script setup>
import QRCode from 'qrcode'
import { labelDate } from '~/utils/bagLabels'

const { slip } = useReferralSlip()

/** The PTR reference as a QR, drawn synchronously so it is on the page before the print dialog opens. */
const qr = computed(() => {
  if (!slip.value) return { size: 1, path: '' }

  const { size, data } = QRCode.create(slip.value.reference_number, { errorCorrectionLevel: 'M' }).modules
  let path = ''

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y * size + x]) path += `M${x} ${y}h1v1h-1z`
    }
  }

  return { size, path }
})

const needed = computed(() => (slip.value?.lines ?? []).filter((line) => line.unallocated > 0))
const covered = computed(() => (slip.value?.lines ?? []).filter((line) => line.unallocated < 1).map((line) => line.component).filter(Boolean))

const patientMeta = computed(() => {
  const patient = slip.value?.patient
  if (!patient) return ''
  const sex = patient.sex ? patient.sex.charAt(0).toUpperCase() + patient.sex.slice(1) : null
  return [patient.age ? `${patient.age} years` : null, sex].filter(Boolean).join(' · ')
})

const issuedOn = computed(() => labelDate(slip.value?.issued_at))
</script>

<!--
  Not scoped: the print rules must reach the rest of the page to hide it, and
  the sheet lives on <body>, outside every scoped component. Every class is
  rs-prefixed so it never meets the bag labels' own print rules.
-->
<style>
.referral-slip-sheet { display: none; }

@page referral-slip {
  size: 100mm 150mm;
  margin: 0;
}

@media print {
  html.printing-slip body > *:not(.referral-slip-sheet) { display: none !important; }
  html.printing-slip .referral-slip-sheet { display: block; }

  html.printing-slip,
  html.printing-slip body {
    margin: 0;
    padding: 0;
    background: #fff;
  }

  .rs {
    page: referral-slip;
    box-sizing: border-box;
    width: 100mm;
    height: 150mm;
    padding: 3mm;
    overflow: hidden;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .rs p { margin: 0; }

  .rs__box {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    height: 100%;
    border: 0.6mm solid #000;
  }

  .rs__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 3mm;
    padding: 2mm 3mm;
    background: #000;
    color: #fff;
  }

  .rs__brand { display: flex; flex-direction: column; font-size: 13pt; font-weight: 800; line-height: 1.1; }
  .rs__centre { font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .rs__kind { font-size: 9pt; font-weight: 800; letter-spacing: 0.08em; }

  .rs__id {
    display: grid;
    grid-template-columns: 28mm 1fr;
    align-items: center;
    gap: 3mm;
    padding: 3mm;
    border-bottom: 0.4mm solid #000;
  }

  .rs__qr { display: block; width: 28mm; height: 28mm; }
  .rs__id-text { min-width: 0; display: flex; flex-direction: column; gap: 1mm; }

  .rs__caption { font-size: 6.5pt; font-weight: 800; letter-spacing: 0.08em; }
  .rs__small { font-size: 8pt; }
  .rs__ref { font-family: "Courier New", monospace; font-size: 17pt; font-weight: 700; line-height: 1.15; word-break: break-all; }

  .rs__patient {
    display: grid;
    grid-template-columns: 1fr 28mm;
    border-bottom: 0.4mm solid #000;
  }

  .rs__patient-who { padding: 3mm; display: flex; flex-direction: column; gap: 1mm; min-width: 0; }
  .rs__name { font-size: 12pt; font-weight: 800; text-transform: capitalize; overflow-wrap: anywhere; }

  .rs__type {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1mm;
    padding: 2mm;
    border-left: 0.4mm solid #000;
  }

  .rs__abo { font-size: 24pt; font-weight: 800; line-height: 1; }

  .rs__cell { padding: 3mm; display: flex; flex-direction: column; gap: 1.5mm; border-bottom: 0.4mm solid #000; }
  .rs__cell--grow { flex: 1; min-height: 0; overflow: hidden; border-bottom: 0; }

  .rs__needs { width: 100%; border-collapse: collapse; font-size: 11pt; }
  .rs__needs td { padding: 1.2mm 0; border-bottom: 0.2mm solid #000; }
  .rs__needs tr:last-child td { border-bottom: 0; }
  .rs__code { font-family: "Courier New", monospace; font-size: 8pt; font-weight: 700; }
  .rs__units { text-align: right; font-weight: 800; white-space: nowrap; }

  .rs__text { font-size: 8.5pt; line-height: 1.45; }

  .rs__foot {
    display: flex;
    justify-content: space-between;
    gap: 3mm;
    padding: 2mm 3mm;
    border-top: 0.4mm solid #000;
    font-size: 7pt;
  }

  .rs__foot span:last-child { flex-shrink: 0; white-space: nowrap; }
}
</style>
