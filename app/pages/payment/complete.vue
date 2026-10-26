<template>
  <div class="pay-page">
    <div class="pay-card">
      <AssetIcon name="check" :size="28" class="pay-icon" />
      <h1 class="pay-title">You can return to the billing counter</h1>
      <p class="pay-text">
        If you completed the GCash payment, the blood centre's billing staff will see it confirmed
        on their screen shortly and will hand you your receipt.
      </p>
      <p class="pay-text">
        If you cancelled or the payment did not go through, tell the billing staff — they can open a
        new checkout or take the payment in cash.
      </p>
      <p class="pay-note">You may close this page.</p>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

/*
 * Where the payer's phone lands after the Xendit checkout, paid or not.
 *
 * Kini nga page wala gyuy gi-claim nga "paid". Ang redirect gikan sa Xendit
 * dili pruweba nga nabayran — ang server ra ang mo-confirm pinaagi sa webhook
 * ug pag-check balik sa session. Mao nga walay API call dinhi ug walay status
 * nga gipakita; ang billing counter ang makakita sa tinuod nga resulta.
 *
 * Public on purpose: the payer is a patient's watcher with no RedAgos account.
 * portal.global leaves it alone because /payment is not a portal prefix.
 */

useHead({ title: 'Payment — RedAgos' })
</script>

<style scoped>
.pay-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: var(--rb-page-bg);
  font-family: var(--rb-font-sans);
}
.pay-card {
  width: 100%;
  max-width: 440px;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  padding: 28px 24px;
  text-align: center;
}
.pay-icon { color: var(--rb-primary); }
.pay-title { font-size: 19px; font-weight: 700; color: var(--rb-text-primary); margin: 12px 0 10px; }
.pay-text { font-size: 14px; line-height: 1.5; color: var(--rb-text-secondary); margin: 0 0 10px; }
.pay-note { font-size: 12.5px; color: var(--rb-text-muted); margin: 16px 0 0; }
</style>
