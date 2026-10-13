<template>
  <section id="contact" class="contact lp-section">
    <div class="lp-inner">
      <!-- ── Blood service facilities ── -->
      <div class="facilities">
        <header v-reveal class="facilities-head">
          <h2 class="lp-h2">Blood service facilities</h2>
          <p class="lp-lead">
            Blood service facilities in Davao City. Contact them directly to donate
            blood or request blood supply.
          </p>
        </header>

        <ul class="facility-list">
          <li
            v-for="(facility, i) in facilities"
            :key="facility.name"
            v-reveal="i * 80"
            class="facility"
          >
            <h3>{{ facility.name }}</h3>
            <dl class="facility-details">
              <div>
                <dt><AssetIcon name="map-pin" :size="16" /><span class="sr-only">Address</span></dt>
                <dd>{{ facility.address }}</dd>
              </div>
              <div>
                <dt><AssetIcon name="phone" :size="16" /><span class="sr-only">Phone</span></dt>
                <dd><a :href="`tel:${facility.tel}`">{{ facility.phone }}</a></dd>
              </div>
              <div>
                <dt><AssetIcon name="clock" :size="16" /><span class="sr-only">Hours</span></dt>
                <dd>{{ facility.hours }}</dd>
              </div>
            </dl>
          </li>
        </ul>
      </div>

      <!-- ── Closing call to action ── -->
      <div v-reveal class="cta">
        <div class="cta-copy">
          <h2 class="cta-heading">Ready to make a real difference?</h2>
          <p class="cta-sub">
            Join RedAgos and become part of Davao City's modern blood service network.
            Every registration counts, every donation matters.
          </p>
        </div>
        <div class="cta-buttons">
          <NuxtLink to="/auth/donor/register" class="lp-btn cta-primary">
            Register Now
            <AssetIcon name="arrow-right" :size="16" />
          </NuxtLink>
          <NuxtLink to="/auth/donor/login" class="lp-btn cta-secondary">Sign In</NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

// Public contact details of each facility, as they publish them. Nothing here
// comes from RedAgos records.
const facilities = [
  {
    name: 'Southern Philippines Medical Center',
    address: 'J.P. Laurel Ave, Bajada, Davao City',
    phone: '(082) 227-2731',
    tel: '+63822272731',
    hours: 'Mon to Fri, 8:00 AM to 5:00 PM',
  },
  {
    name: 'Sub-National Blood Center',
    address: 'J.P. Laurel Avenue, Bajada, Davao City',
    phone: '(082) 221-6900',
    tel: '+63822216900',
    hours: 'Mon to Fri, 8:00 AM to 3:00 PM',
  },
  {
    name: 'Philippine Red Cross Davao Chapter',
    address: 'Quirino Ave, Davao City',
    phone: '(082) 226-2661',
    tel: '+63822262661',
    hours: 'Mon to Sun, 8:00 AM to 5:00 PM',
  },
]
</script>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ── Facilities: heading left, directory right ── */
.facilities {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.4fr);
  gap: clamp(2rem, 6vw, 5rem);
  align-items: start;
}

.facility-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.facility {
  padding: 22px 24px;
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: var(--lp-radius);
}
.facility h3 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 700;
  color: var(--lp-text);
}
.facility-details {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 12px 20px;
  margin: 0;
}
.facility-details > div { display: flex; align-items: flex-start; gap: 8px; }
.facility-details dt { margin-top: 2px; color: var(--lp-accent-text); }
.facility-details dd { margin: 0; font-size: 14px; line-height: 1.45; color: var(--lp-text-2); }
/* Phone and hours never break mid-value ("5:00 / PM"). */
.facility-details > div:not(:first-child) dd { white-space: nowrap; }
.facility-details a { color: var(--lp-accent-text); font-weight: 600; text-decoration: none; }
.facility-details a:hover { text-decoration: underline; text-underline-offset: 3px; }

/* ── CTA panel ── */
.cta {
  margin-top: 96px;
  padding: clamp(32px, 5vw, 56px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 32px;
  border-radius: 24px;
  /* A Philippine Red Cross drive under a deep blue overlay; the overlay keeps white text
     above 7:1 wherever it falls on the image. */
  background:
    linear-gradient(100deg, rgba(11, 42, 85, 0.96) 0%, rgba(13, 71, 161, 0.9) 55%, rgba(21, 101, 192, 0.72) 100%),
    url('/images/photos/prc-drive-overview.jpg') center / cover no-repeat;
  color: #fff;
  box-shadow: var(--lp-shadow-lg);
}
.cta-heading {
  margin: 0 0 12px;
  font-size: clamp(1.75rem, 3vw, 2.375rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.025em;
}
.cta-sub {
  max-width: 52ch;
  margin: 0;
  font-size: 16px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.9);
}
.cta-buttons { display: flex; flex-wrap: wrap; gap: 12px; }
.cta-primary { background: #fff; color: #0D47A1; }
.cta-primary:hover { background: #E3EEFA; }
.cta-secondary { border-color: rgba(255, 255, 255, 0.6); color: #fff; }
.cta-secondary:hover { background: rgba(255, 255, 255, 0.1); border-color: #fff; }
.cta .lp-btn:focus-visible { outline-color: #fff; }

/* ── Responsive ── */
@media (max-width: 960px) {
  .facilities { grid-template-columns: 1fr; }
  .facility-details { grid-template-columns: 1fr; }
  .facility-details > div:not(:first-child) dd { white-space: normal; }
  .cta { grid-template-columns: 1fr; margin-top: 72px; }
}
@media (max-width: 560px) {
  .cta-buttons .lp-btn { flex: 1 1 auto; }
}
</style>
