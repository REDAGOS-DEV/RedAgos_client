<template>
  <div>
    <BloodCenterSidebar :blood-center="user" />
    <div class="lg:pl-64">
      <main class="min-h-screen">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useUser } from '@/composables/useUser'

const { user, fetchUser } = useUser()

onMounted(() => {
  if (!user.value) fetchUser()
})
</script>