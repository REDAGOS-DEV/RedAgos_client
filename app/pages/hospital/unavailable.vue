<template>
  <div class="unavailable">
    <div class="unavailable__card" role="status">
      <AssetIcon name="hospital" :size="40" class="unavailable__icon" />

      <h1 class="unavailable__title">The hospital portal isn't open yet</h1>

      <p class="unavailable__body">
        Blood requests, availability and tracking for hospital blood banks are still
        being built. The screens exist, but there is no service behind them yet — so
        rather than show you a page that cannot load anything, we've closed it until
        it works.
      </p>

      <p class="unavailable__body">
        Donor and blood centre accounts are unaffected and available now.
      </p>

      <div class="unavailable__actions">
        <NuxtLink to="/auth/role-selection" class="unavailable__btn unavailable__btn--primary">
          Choose a different account type
        </NuxtLink>
        <NuxtLink to="/" class="unavailable__btn">
          Back to home
        </NuxtLink>
      </div>

      <p class="unavailable__contact">
        Need blood urgently? Contact your partner blood centre directly.
      </p>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

definePageMeta({
  layout: 'default',
})

useHead({
  title: 'Hospital portal unavailable · RedAgos',
})
</script>

<style scoped>
.unavailable {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  background: var(--rb-page-bg);
}

.unavailable__card {
  max-width: 560px;
  padding: 40px;
  border: 1px solid var(--rb-border);
  border-radius: 16px;
  background: var(--rb-surface);
  text-align: center;
}

.unavailable__icon {
  color: var(--rb-accent);
  margin-bottom: 20px;
}

.unavailable__title {
  margin: 0 0 16px;
  font-size: 24px;
  font-weight: 700;
  color: var(--rb-text-primary);
}

.unavailable__body {
  margin: 0 0 16px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--rb-text-secondary);
}

.unavailable__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin: 28px 0 20px;
}

.unavailable__btn {
  padding: 10px 20px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  color: var(--rb-text-primary);
  background: var(--rb-surface);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.unavailable__btn:hover {
  background: var(--rb-surface-hover);
  border-color: var(--rb-border-hover);
}

.unavailable__btn--primary {
  background: var(--rb-primary);
  border-color: var(--rb-primary);
  color: #fff;
}

.unavailable__btn--primary:hover {
  background: #0f4c95;
  border-color: #0f4c95;
}

.unavailable__btn:focus-visible {
  outline: 2px solid var(--rb-primary);
  outline-offset: 2px;
}

.unavailable__contact {
  margin: 0;
  padding-top: 20px;
  border-top: 1px solid var(--rb-border);
  font-size: 13px;
  color: var(--rb-text-secondary);
}
</style>
