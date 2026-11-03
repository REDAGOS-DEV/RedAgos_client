<template>
  <div />
</template>

<script setup>
/*
 * A request cannot be edited yet: the API has no endpoint for it. This page's
 * form was written against helpers and fields that never existed, so every
 * visit ended in a 500 (2026-11-01). An old link now lands on the request.
 */
definePageMeta({
  middleware: [
    'auth',
    'hospital-portal',
    to => navigateTo(`/hospital/bloodrequests/${to.params.id}`, { replace: true }),
  ],
  layout: 'hospitaldashboard',
})
</script>
