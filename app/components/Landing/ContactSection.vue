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
            <div class="facility-top">
              <h3>{{ facility.name }}</h3>
              <span class="facility-type">
                <AssetIcon :name="facility.typeIcon" :size="13" />
                {{ facility.type }}
              </span>
            </div>

            <!-- Filled in on the client: it depends on the current time in
                 Manila, and the server render must match hydration. -->
            <p v-if="status[facility.name]" class="facility-status" :class="{ open: status[facility.name].open }">
              <span class="status-dot" aria-hidden="true"></span>
              {{ status[facility.name].label }}
            </p>

            <dl class="facility-details">
              <div>
                <dt><AssetIcon name="map-pin" :size="16" /><span class="sr-only">Address</span></dt>
                <dd>{{ facility.address }}</dd>
              </div>
              <div>
                <dt><AssetIcon name="clock" :size="16" /><span class="sr-only">Hours</span></dt>
                <dd>{{ facility.hoursText }}</dd>
              </div>
            </dl>

            <div class="facility-actions">
              <a :href="`tel:${facility.tel}`" class="lp-btn lp-btn--secondary lp-btn--sm">
                <AssetIcon name="phone" :size="16" />
                <span><span class="sr-only">Call </span>{{ facility.phone }}</span>
              </a>
              <a
                :href="mapsUrl(facility)"
                target="_blank"
                rel="noopener"
                class="lp-btn lp-btn--secondary lp-btn--sm"
                :aria-label="`Directions to ${facility.name}`"
              >
                <AssetIcon name="map-pin" :size="16" />
                Directions
              </a>
            </div>
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
          <NuxtLink to="/auth/login" class="lp-btn cta-secondary">Sign In</NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { facilityStatus } from '~/utils/facilityHours'

// Public contact details of each facility, as they publish them. Nothing here
// comes from RedAgos records. `hours` drives the "Open now" label (days:
// 0 = Sunday … 6 = Saturday, Philippine time); keep it in step with
// `hoursText` and with what each facility actually publishes.
const facilities = [
  {
    name: 'Southern Philippines Medical Center',
    type: 'Hospital',
    typeIcon: 'hospital',
    address: 'J.P. Laurel Ave, Bajada, Davao City',
    phone: '(082) 227-2731',
    tel: '+63822272731',
    hoursText: 'Mon to Fri, 8:00 AM to 5:00 PM',
    hours: [{ days: [1, 2, 3, 4, 5], open: '08:00', close: '17:00' }],
  },
  {
    name: 'Sub-National Blood Center',
    type: 'Blood center',
    typeIcon: 'building-2',
    address: 'J.P. Laurel Avenue, Bajada, Davao City',
    phone: '(082) 221-6900',
    tel: '+63822216900',
    hoursText: 'Mon to Fri, 8:00 AM to 3:00 PM',
    hours: [{ days: [1, 2, 3, 4, 5], open: '08:00', close: '15:00' }],
  },
  {
    name: 'Philippine Red Cross Davao Chapter',
    type: 'Red Cross',
    typeIcon: 'heart',
    address: 'Quirino Ave, Davao City',
    phone: '(082) 226-2661',
    tel: '+63822262661',
    hoursText: 'Mon to Sun, 8:00 AM to 5:00 PM',
    hours: [{ days: [0, 1, 2, 3, 4, 5, 6], open: '08:00', close: '17:00' }],
  },
]

const mapsUrl = facility =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${facility.name}, ${facility.address}`)}`

// "Open now" is computed on the client and refreshed each minute, so a page
// left open past closing time does not keep saying "Open".
const status = ref({})
let timer
function refreshStatus() {
  status.value = Object.fromEntries(facilities.map(f => [f.name, facilityStatus(f.hours)]))
}
onMounted(() => {
  refreshStatus()
  timer = setInterval(refreshStatus, 60_000)
})
onBeforeUnmount(() => clearInterval(timer))
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
.facility-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.facility h3 {
  margin: 0;
  font-size: 16.5px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--lp-text);
}
.facility-type {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--lp-accent-soft);
  color: var(--lp-accent-text);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

/* A real state indicator (open / closed), so the dot is earned. */
.facility-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px;
  font-size: 13.5px;
  font-weight: 600;
  color: #B42318;
}
.facility-status.open { color: #1B7A3A; }
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 18%, transparent);
}

.facility-details {
  display: grid;
  gap: 8px;
  margin: 0 0 18px;
}
.facility-details > div { display: flex; align-items: flex-start; gap: 8px; }
.facility-details dt { margin-top: 2px; color: var(--lp-muted); }
.facility-details dd { margin: 0; font-size: 14px; line-height: 1.45; color: var(--lp-text-2); }

.facility-actions { display: flex; flex-wrap: wrap; gap: 8px; }

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
  .cta { grid-template-columns: 1fr; margin-top: 72px; }
}
@media (max-width: 560px) {
  .cta-buttons .lp-btn { flex: 1 1 auto; }
  /* Two equal buttons on every card, so the cards line up. */
  .facility-actions { display: grid; grid-template-columns: 1fr 1fr; }
  .facility-actions .lp-btn { padding: 0 10px; }
}
</style>
