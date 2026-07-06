<template>
  <div>
    <DonorSidebar />

    <!-- main content area, naay left padding para dili ma-overlap sa fixed sidebar (w-64 = 16rem) -->
    <div class="lg:pl-64">
      <main class="min-h-screen">
        <slot />
      </main>
    </div>
  </div>
</template>