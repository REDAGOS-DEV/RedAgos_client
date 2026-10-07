<template>
  <!--
    Hidden on screen. When useLabelPrint() prints, this is the only thing on the
    page: one 100 × 100 mm label per printed page, for a blood-bag label printer.
  -->
  <Teleport to="body">
    <div class="bag-label-sheet" aria-hidden="true">
      <template v-if="sheet.variant === 'base'">
        <article v-for="label in sheet.labels" :key="label.bag_number" class="bag-label bag-label--base">
          <p class="bag-label__hold">QUARANTINE — NOT FOR ISSUE</p>
          <p class="bag-label__number">{{ label.bag_number }}</p>
          <p class="bag-label__product">
            {{ label.component }}<template v-if="label.volume_ml"> · {{ label.volume_ml }} mL</template>
          </p>
          <p v-if="label.donation_barcode" class="bag-label__line">Donation {{ label.donation_barcode }}</p>
          <p class="bag-label__foot">Base label · blood type and clearance are added on release</p>
        </article>
      </template>

      <template v-else>
        <article v-for="label in sheet.labels" :key="label.unit_id" class="bag-label bag-label--final">
          <p v-if="label.facility" class="bag-label__facility">{{ label.facility }}</p>
          <div class="bag-label__type">
            <span class="bag-label__abo">{{ label.abo }}</span>
            <span class="bag-label__rh">{{ label.rh }}</span>
          </div>
          <p class="bag-label__product">
            {{ label.component }}<template v-if="label.volume_ml"> · {{ label.volume_ml }} mL</template>
          </p>
          <p class="bag-label__expiry">EXP {{ label.expiry }}</p>
          <p class="bag-label__number bag-label__number--small">{{ label.unit_id }}</p>
          <ul class="bag-label__clearances">
            <li v-for="line in label.clearances" :key="line">{{ line }}</li>
          </ul>
          <p v-if="label.released" class="bag-label__foot">{{ label.released }}</p>
        </article>
      </template>
    </div>
  </Teleport>
</template>

<script setup>
const { sheet } = useLabelPrint()
</script>

<!--
  Not scoped: the print rules must reach the rest of the page to hide it, and
  the sheet lives on <body>, outside every scoped component.
-->
<style>
.bag-label-sheet { display: none; }

/* A named page, so the 100 mm size applies to labels and never to any other
   print the app makes. */
@page bag-label {
  size: 100mm 100mm;
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
    height: 100mm;
    padding: 5mm;
    display: flex;
    flex-direction: column;
    gap: 2mm;
    overflow: hidden;
    break-after: page;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
  }

  .bag-label:last-child { break-after: auto; }

  .bag-label p { margin: 0; }

  .bag-label__hold {
    padding: 2mm;
    border: 0.6mm solid #000;
    text-align: center;
    font-size: 12pt;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .bag-label__number {
    font-family: "Courier New", monospace;
    font-size: 20pt;
    font-weight: 700;
    letter-spacing: 0.02em;
    word-break: break-all;
  }

  .bag-label__number--small { font-size: 12pt; }

  .bag-label__product { font-size: 13pt; font-weight: 700; }
  .bag-label__line { font-size: 10pt; }
  .bag-label__facility { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; }

  .bag-label__type {
    display: flex;
    align-items: baseline;
    gap: 4mm;
    padding-bottom: 2mm;
    border-bottom: 0.4mm solid #000;
  }

  .bag-label__abo { font-size: 48pt; font-weight: 800; line-height: 1; }
  .bag-label__rh { font-size: 14pt; font-weight: 700; }

  .bag-label__expiry { font-size: 14pt; font-weight: 800; }

  .bag-label__clearances {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 7.5pt;
    line-height: 1.35;
  }

  .bag-label__foot { margin-top: auto !important; font-size: 7.5pt; }
}
</style>
