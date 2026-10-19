<template>
  <AuthLoginLayout
    portal="admin"
    title="Administrator Sign In"
    restricted
    subtitle="Manage facilities, users, and the rest of the system"
  >
    <template #footer>
      <!-- Walay self-registration ang admin. Ang bag-ong admin account
           kay gihimo ra sa naa nang admin pinaagi sa POST /users.
           Wala gi-ingon nga "sign-ins are recorded": wala pa'y audit log
           sa server, ug dili ta mosaad og butang nga wala pa. -->
      <p class="signup-text">
        For authorized RedAgos administrators only. New administrator
        accounts are created by an existing administrator.
      </p>
    </template>
  </AuthLoginLayout>
</template>

<script setup>
import AuthLoginLayout from '~/components/auth/AuthLoginLayout.vue'
</script>
