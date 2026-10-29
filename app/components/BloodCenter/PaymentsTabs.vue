<template>
  <!--
    Receipts and Transactions are one list of payments seen two ways
    (2026-10-27): one sidebar link, these two tabs on top of both pages.
  -->
  <nav class="pay-tabs" aria-label="Payments">
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      class="pay-tabs__tab"
      :class="{ 'pay-tabs__tab--on': route.path === tab.to }"
      :aria-current="route.path === tab.to ? 'page' : undefined"
    >
      <AssetIcon :name="tab.icon" :size="15" />
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

const route = useRoute()

const TABS = [
  { to: '/blood-center/receipts', label: 'Receipts', icon: 'receipt' },
  { to: '/blood-center/billing-transactions', label: 'Transactions', icon: 'list' },
]
</script>

<style scoped>
.pay-tabs { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--rb-border); border-radius: 12px; background: var(--rb-surface); }
.pay-tabs__tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 16px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--rb-text-secondary);
  text-decoration: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.pay-tabs__tab:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }
.pay-tabs__tab--on, .pay-tabs__tab--on:hover { background: var(--rb-primary); color: #fff; }
.pay-tabs__tab:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
@media (prefers-reduced-motion: reduce) {
  .pay-tabs__tab { transition: none; }
}
</style>
