<template>
  <!--
    Hidden on screen. When useLabelPrint() prints, this is the only thing on the
    page: one 100 × 150 mm label per printed page, laid out like a courier
    waybill (project owner, 2026-10-19) for a 4 × 6 in thermal label printer.
  -->
  <Teleport to="body">
    <div class="bag-label-sheet" aria-hidden="true">
      <template v-if="sheet.variant === 'base'">
        <article v-for="label in sheet.labels" :key="label.bag_number" class="bag-label bag-label--base">
          <div class="wb">
            <header class="wb__head">
              <span class="wb__brand">RedAgos</span>
              <span class="wb__kind">BASE LABEL</span>
            </header>

            <p class="bag-label__hold">QUARANTINE — NOT FOR ISSUE</p>

            <section class="wb__id">
              <svg class="wb__qr" :viewBox="`0 0 ${qrFor(label.bag_number).size} ${qrFor(label.bag_number).size}`" shape-rendering="crispEdges">
                <path :d="qrFor(label.bag_number).path" fill="#000" />
              </svg>
              <div class="wb__id-text">
                <p class="wb__caption">BAG NO.</p>
                <p class="bag-label__number">{{ label.bag_number }}</p>
                <p v-if="label.donation_barcode" class="wb__small">Donation {{ label.donation_barcode }}</p>
              </div>
            </section>

            <section class="wb__cell wb__cell--grow">
              <p class="wb__caption">PRODUCT</p>
              <p class="bag-label__product">{{ label.component }}</p>
              <p v-if="label.volume_ml" class="wb__value">{{ label.volume_ml }} mL</p>
            </section>

            <footer class="wb__foot">
              <span>Base label · blood type and clearance are added on release</span>
              <span>Printed {{ printedOn }}</span>
            </footer>
          </div>
        </article>
      </template>

      <template v-else>
        <article v-for="label in sheet.labels" :key="label.unit_id" class="bag-label bag-label--final">
          <div class="wb">
            <header class="wb__head">
              <span class="wb__brand">
                RedAgos
                <small v-if="label.facility" class="wb__facility">{{ label.facility }}</small>
              </span>
              <span class="wb__kind">BLOOD UNIT</span>
            </header>

            <section class="wb__id">
              <svg class="wb__qr" :viewBox="`0 0 ${qrFor(label.unit_id).size} ${qrFor(label.unit_id).size}`" shape-rendering="crispEdges">
                <path :d="qrFor(label.unit_id).path" fill="#000" />
              </svg>
              <div class="wb__id-text">
                <p class="wb__caption">UNIT NO.</p>
                <p class="bag-label__number">{{ label.unit_id }}</p>
                <p v-if="label.donation_barcode" class="wb__small">Donation {{ label.donation_barcode }}</p>
              </div>
            </section>

            <section class="wb__main">
              <div class="bag-label__type">
                <span class="bag-label__abo">{{ label.abo }}</span>
                <span class="bag-label__rh">{{ label.rh }}</span>
              </div>
              <div class="wb__facts">
                <div class="wb__fact">
                  <p class="wb__caption">PRODUCT</p>
                  <p class="bag-label__product">{{ label.component }}</p>
                </div>
                <div v-if="label.volume_ml" class="wb__fact">
                  <p class="wb__caption">VOLUME</p>
                  <p class="wb__value">{{ label.volume_ml }} mL</p>
                </div>
                <div class="wb__fact wb__fact--expiry">
                  <p class="wb__caption">EXPIRES</p>
                  <p class="bag-label__expiry">{{ label.expiry }}</p>
                </div>
              </div>
            </section>

            <section class="wb__cell wb__cell--grow">
              <p class="wb__caption">TESTING CLEARANCES</p>
              <ul class="bag-label__clearances">
                <li v-for="line in label.clearances" :key="line">{{ line }}</li>
              </ul>
            </section>

            <footer class="wb__foot">
              <span>{{ label.released || 'Released for issue' }}</span>
              <span>Printed {{ printedOn }}</span>
            </footer>
          </div>
        </article>
      </template>
    </div>
  </Teleport>
</template>

<script setup>
import QRCode from 'qrcode'
import { labelDate } from '~/utils/bagLabels'

const { sheet } = useLabelPrint()

/*
 * Each label carries a QR of its own unit (or bag) number, as a waybill
 * carries its tracking number. Built synchronously, so it is on the page
 * before useLabelPrint() opens the print dialog; an image made async could
 * print blank.
 */
const qrCache = new Map()

function qrFor(text) {
  if (!qrCache.has(text)) {
    const { size, data } = QRCode.create(String(text), { errorCorrectionLevel: 'M' }).modules
    let path = ''

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data[y * size + x]) path += `M${x} ${y}h1v1h-1z`
      }
    }

    qrCache.set(text, { size, path })
  }

  return qrCache.get(text)
}

const printedOn = computed(() => (sheet.value.labels.length ? labelDate(new Date().toISOString()) : ''))
</script>

<!--
  Not scoped: the print rules must reach the rest of the page to hide it, and
  the sheet lives on <body>, outside every scoped component.
-->
<style>
.bag-label-sheet { display: none; }

/* A named page, so the waybill size applies to labels and never to any other
   print the app makes. 100 × 150 mm is the 4 × 6 in thermal label couriers
   print their waybills on. */
@page bag-label {
  size: 100mm 150mm;
  margin: 0;
}

@media print {
  html.printing-labels body > *:not(.bag-label-sheet) { display: none !important; }
  html.printing-labels .bag-label-sheet { display: block; }

  html.printing-labels,
  html.printing-labels body {
    margin: 0;
    padding: 0;
    background: #fff;
  }

  .bag-label {
    page: bag-label;
    box-sizing: border-box;
    width: 100mm;
    height: 150mm;
    padding: 3mm;
    overflow: hidden;
    break-after: page;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .bag-label:last-child { break-after: auto; }

  .bag-label p { margin: 0; }

  /* The waybill: one bordered box, cut into ruled sections. */
  .wb {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    height: 100%;
    border: 0.6mm solid #000;
  }

  .wb__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 3mm;
    padding: 2mm 3mm;
    background: #000;
    color: #fff;
  }

  .wb__brand { display: flex; flex-direction: column; font-size: 13pt; font-weight: 800; line-height: 1.1; }
  .wb__facility { font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .wb__kind { font-size: 9pt; font-weight: 800; letter-spacing: 0.08em; }

  .wb__id {
    display: grid;
    grid-template-columns: 30mm 1fr;
    align-items: center;
    gap: 3mm;
    padding: 3mm;
    border-bottom: 0.4mm solid #000;
  }

  .wb__qr { display: block; width: 30mm; height: 30mm; }
  .wb__id-text { min-width: 0; display: flex; flex-direction: column; gap: 1mm; }

  .wb__caption { font-size: 6.5pt; font-weight: 800; letter-spacing: 0.08em; }
  .wb__small { font-size: 8pt; }
  .wb__value { font-size: 12pt; font-weight: 700; }

  .bag-label__number {
    font-family: "Courier New", monospace;
    font-size: 17pt;
    font-weight: 700;
    line-height: 1.15;
    word-break: break-all;
  }

  .bag-label__product { font-size: 13pt; font-weight: 800; line-height: 1.2; }

  /* Phase 1: the hold, as loud as the label gets. */
  .bag-label__hold {
    padding: 3mm 2mm;
    border-bottom: 0.4mm solid #000;
    text-align: center;
    font-size: 13pt;
    font-weight: 800;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  /* Phase 2: blood type beside the product, expiry and volume. */
  .wb__main {
    display: grid;
    grid-template-columns: 40mm 1fr;
    border-bottom: 0.4mm solid #000;
  }

  .bag-label__type {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1mm;
    padding: 3mm 2mm;
    border-right: 0.4mm solid #000;
    text-align: center;
  }

  .bag-label__abo { font-size: 54pt; font-weight: 800; line-height: 1; }
  .bag-label__rh { font-size: 10pt; font-weight: 800; }

  .wb__facts { display: flex; flex-direction: column; }

  .wb__fact {
    display: flex;
    flex-direction: column;
    gap: 0.5mm;
    padding: 2mm 3mm;
    border-bottom: 0.3mm solid #000;
  }

  .wb__fact:last-child { border-bottom: 0; }
  .wb__fact--expiry { background: #000; color: #fff; }

  .bag-label__expiry { font-size: 14pt; font-weight: 800; white-space: nowrap; }

  .wb__cell { padding: 3mm; display: flex; flex-direction: column; gap: 1.5mm; }
  .wb__cell--grow { flex: 1; min-height: 0; overflow: hidden; }

  .bag-label__clearances {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 8pt;
    line-height: 1.4;
  }

  .wb__foot {
    display: flex;
    justify-content: space-between;
    gap: 3mm;
    padding: 2mm 3mm;
    border-top: 0.4mm solid #000;
    font-size: 7pt;
  }

  .wb__foot span:last-child { flex-shrink: 0; white-space: nowrap; }
}
</style>
