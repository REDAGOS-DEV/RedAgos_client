<template>
  <div class="landing">
    <LandingNavbar />
    <main>
      <LandingHeroSection />
      <LandingFeaturesSection />
      <LandingDonationDrives />
      <LandingAboutSection />
      <LandingContactSection />
    </main>
    <LandingFooter />
  </div>
</template>

<style scoped>
/* Covers the default layout's bg-slate-50, which has no dark variant. */
.landing {
  min-height: 100dvh;
  background: var(--lp-bg);
  color: var(--lp-text);
  font-family: var(--rb-font-sans);
}
</style>
