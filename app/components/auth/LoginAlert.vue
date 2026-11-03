<template>
  <!--
    The sign-in error banner. An unverified address no longer lands here: the
    sign-in screen swaps the form for the code step instead (EmailCodeStep).
  -->
  <div v-if="message" class="login-alert" role="alert">
    <div class="login-alert__row">
      <AssetIcon name="octagon-alert" :size="16" class="login-alert__icon" />
      <p class="login-alert__body">{{ message }}</p>
    </div>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

/**
 * Lifted out of the donor login page so all four portals show the same thing.
 */
defineProps({
  /** The error to show. Empty renders nothing. */
  message: { type: String, default: '' },
})
</script>

<style scoped>
.login-alert {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid #FECDCA;
  border-radius: 12px;
  background: #FEF3F2;
  color: #7A271A;
  font-size: 13px;
  line-height: 1.55;
  text-align: left;
}

.login-alert__row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.login-alert__icon {
  flex: 0 0 auto;
  margin-top: 2px;
  color: #B42318;
}

.login-alert__body {
  margin: 0;
  font-weight: 400;
}

/* No dark variant: the sign-in screen, the only place this is used, is
   always light. */
</style>
