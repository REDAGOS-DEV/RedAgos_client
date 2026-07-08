<template>
  <div>
    <!-- i-uncomment ni ug i-condition base sa role if naa nay 'role' column sa backend -->
    <!-- <DonorSidebar v-if="user?.role === 'donor'" :donor="user" /> -->
    <!-- <BloodCenterSidebar v-else-if="user?.role === 'blood-center'" :blood-center="user" /> -->

    
        <!-- for testing --> 
    <DonorSidebar :donor="user" />

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