<template>
  <!-- Requests sent from Issue whose invoice still has a balance (2026-10-31). -->
  <FulfillmentBoard view="fulfillment" />
</template>

<script setup>
import FulfillmentBoard from '~/components/BloodCenter/FulfillmentBoard.vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'requests.release',
  keepalive: true,
})

useHead({ title: 'Request Fulfillment · RedAgos' })
</script>
