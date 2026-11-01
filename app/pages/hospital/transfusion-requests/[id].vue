<template>
  <!-- A link from a notification or a search lands here; the list opens it in a dialog. -->
  <TransfusionRequestDetail :request-id="route.params.id" />
</template>

<script setup>
import TransfusionRequestDetail from '~/components/Hospital/TransfusionRequestDetail.vue'

definePageMeta({ middleware: ['auth', 'hospital-portal'], layout: 'hospitaldashboard', requires: 'hospital.requests.view' })

const route = useRoute()
</script>
