<template>
  <!--
    For Dispatch (2026-10-31): requests whose invoice is cleared, ready to go
    out, then the ones waiting on the hospital's confirmation. Requests still
    owing stay on Request Fulfillment.
  -->
  <FulfillmentBoard view="dispatch" />
</template>

<script setup>
import FulfillmentBoard from '~/components/BloodCenter/FulfillmentBoard.vue'

definePageMeta({
  middleware: ['auth', 'department'],
  layout: 'blood-centerdashboard',
  requires: 'requests.release',
})

useHead({ title: 'For Dispatch · RedAgos' })
</script>
