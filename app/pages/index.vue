<template>
  <div class="landing">
    <LandingNavbar />
    <main>
      <LandingHeroSection />
      <LandingFeaturesSection />
      <LandingRolesSection />
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
  /* Safety net: no decoration may widen the page and cause sideways scroll
     on phones. `clip` keeps sticky positioning working, unlike `hidden`. */
  overflow-x: clip;
  min-height: 100dvh;
  background: var(--lp-bg);
  color: var(--lp-text);
  font-family: var(--rb-font-sans);
}
</style>
