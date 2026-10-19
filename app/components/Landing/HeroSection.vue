<template>
  <section id="home" class="hero">
    <div class="hero-content">
      <div class="hero-copy">
        <p class="lp-pill">
          <span class="lp-pill-icon"><AssetIcon name="heart" :size="14" /></span>
          Davao City's Blood Bank Network
        </p>

        <h1 class="hero-title">
          Saving lives through <span class="accent">smart blood</span> services
        </h1>

        <p class="hero-desc">
          Davao City's blood bank platform connecting donors, hospitals, and
          blood centers for faster, life-saving blood services.
        </p>

        <div class="hero-btns">
          <NuxtLink to="/auth/donor/register" class="lp-btn lp-btn--primary">
            Register Now
            <AssetIcon name="arrow-right" :size="16" class="btn-arrow" />
          </NuxtLink>
          <!-- Not "Sign In": the navbar already has it. This gives donors who
               are not ready to register a lighter first step. -->
          <a href="#drives" class="lp-btn lp-btn--secondary" @click.prevent="goToDrives">
            <AssetIcon name="calendar" :size="16" />
            Find a donation drive
          </a>
        </div>
      </div>

      <!--
        The real donor portal, on a phone, over a brand-blue disc. The screen
        is an actual screenshot (test account, no names or personal data);
        only the phone frame is drawn in CSS. Retake the screenshot if the
        portal's look changes: public/images/photos/redagos-donor-phone.jpg
      -->
      <div class="hero-visual">
        <div class="phone">
          <div class="phone-screen">
            <!-- Status-bar strip: the camera island sits here, above the
                 app, as on a real phone, instead of covering its top bar. -->
            <span class="phone-island" aria-hidden="true"></span>
            <img
              :src="phoneShot"
              alt="The RedAgos donor portal on a phone: a Book a donation button, blood type and QR code status, and a getting-started checklist"
              width="860"
              height="1864"
              fetchpriority="high"
            >
          </div>
        </div>

        <!-- The soonest public drive, from the same list as the Donation
             Drives section. Hidden when nothing is scheduled. -->
        <a
          v-if="nextDrive"
          href="#drives"
          class="drive-card"
          :aria-label="`Next donation drive: ${nextDrive.title}, ${nextDrive.weekday}. See all drives`"
          @click.prevent="goToDrives"
        >
          <span class="drive-date" aria-hidden="true">
            <span class="drive-month">{{ nextDrive.month }}</span>
            <span class="drive-day">{{ nextDrive.day }}</span>
          </span>
          <span class="drive-text" aria-hidden="true">
            <span class="drive-label">Next donation drive</span>
            <span class="drive-title">{{ nextDrive.title }}</span>
          </span>
        </a>

        <!-- A general donation fact. No inventory, request or donor data is
             ever shown on the public page. -->
        <div class="fact">
          <span class="fact-icon"><AssetIcon name="heart" :size="18" /></span>
          <span>
            <span class="fact-value">Up to 3 lives</span>
            <span class="fact-label">saved by one donation</span>
          </span>
        </div>
      </div>
    </div>

    <div class="stats-wrap">
      <dl class="stats">
        <div v-for="stat in stats" :key="stat.label" class="stat">
          <span class="stat-icon"><AssetIcon :name="stat.icon" :size="20" /></span>
          <div>
            <dt class="stat-label">{{ stat.label }}</dt>
            <dd class="stat-num">{{ stat.value }}</dd>
          </div>
        </div>
      </dl>
    </div>
  </section>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { upcomingDrives } from '~/utils/donationDrives'

// A real screenshot of the donor portal; see public/images/photos/README.md.
const phoneShot = '/images/photos/redagos-donor-phone.jpg'

const nextDrive = computed(() => upcomingDrives()[0] ?? null)

// Same behaviour as the navbar links: smooth scroll, and a #drives hash
// (there is no /drives route).
function goToDrives() {
  document.getElementById('drives')?.scrollIntoView({ behavior: 'smooth' })
  window.history.replaceState(null, '', '#drives')
}

const stats = [
  { icon: 'users', value: '3 portals', label: 'Donors, centers, hospitals' },
  { icon: 'activity', value: '24/7', label: 'Online access' },
  { icon: 'calendar-check', value: 'Every 8 weeks', label: 'You can donate whole blood' },
]
</script>

<style scoped>
@keyframes rise {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: none; }
}

.hero {
  position: relative;
  /* The blue disc behind the phone is wider than a phone screen and sits
     right of centre; without this it pushed the whole page sideways on
     mobile (360px screens scrolled to 407px). `clip`, not `hidden`, so the
     stats card can still hang below the hero. */
  overflow-x: clip;
  /* Clears the fixed 64px navbar (plus its 14px inset) with ~32px to spare. */
  padding: 112px 1.5rem 0;
  background:
    radial-gradient(50% 60% at 90% 10%, rgba(21, 101, 192, 0.12), transparent 70%),
    radial-gradient(35% 45% at 0% 20%, rgba(198, 40, 40, 0.06), transparent 70%),
    linear-gradient(180deg, #EAF2FC 0%, var(--lp-bg) 100%);
}

.hero-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  align-items: center;
  gap: clamp(2.5rem, 6vw, 5.5rem);
}

/* ── Copy ── */
.hero-copy { animation: rise 0.8s var(--lp-ease) 0.05s both; }

.hero-title {
  margin: 0 0 22px;
  font-size: clamp(2.375rem, 4vw, 3.375rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.025em;
  color: var(--lp-text);
}
.accent {
  position: relative;
  display: inline-block;
  color: var(--lp-accent-text);
}
/* The hand-drawn red underline: the one place red is used for emphasis. */
.accent::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -6px;
  width: 100%;
  height: 12px;
  border-bottom: 4px solid var(--lp-brand);
  border-radius: 50%;
  transform: rotate(-2deg);
}

.hero-desc {
  max-width: 44ch;
  margin: 0 0 32px;
  font-size: 18px;
  line-height: 1.65;
  color: var(--lp-text-2);
}

.hero-btns { display: flex; flex-wrap: wrap; gap: 12px; }
.hero-btns .lp-btn { height: 52px; padding: 0 28px; }
.btn-arrow { transition: transform 0.2s var(--lp-ease); }
.lp-btn:hover .btn-arrow { transform: translateX(3px); }

/* ── Phone on a blue disc ── */
.hero-visual {
  /* The phone's height follows the viewport, so on a short laptop screen the
     copy beside it (centred against it) stays high and the CTAs stay above
     the fold. */
  --phone-h: clamp(420px, calc(100dvh - 200px), 560px);

  position: relative;
  display: grid;
  place-items: center;
  min-height: calc(var(--phone-h) + 48px);
  animation: rise 0.9s var(--lp-ease) 0.15s both;
}
/* The disc: brand blue, a little right of and below the phone's centre. */
.hero-visual::before {
  content: '';
  position: absolute;
  width: calc(var(--phone-h) * 0.92);
  aspect-ratio: 1;
  left: 50%;
  top: 50%;
  transform: translate(-42%, -46%);
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.22), transparent 55%),
    linear-gradient(140deg, #1565C0 0%, #1E88E5 55%, #42A5F5 100%);
  box-shadow: 0 40px 80px -30px rgba(21, 101, 192, 0.55);
}

/* The phone: a dark bezel around the real screenshot, tilted slightly. */
.phone {
  position: relative;
  z-index: 1;
  padding: 10px;
  border-radius: 46px;
  background: #0B1F3A;
  box-shadow:
    inset 0 0 0 2px #24324D,
    0 2px 4px rgba(11, 31, 58, 0.2),
    0 40px 70px -24px rgba(11, 31, 58, 0.55);
  transform: rotate(-6deg);
}
.phone-screen {
  position: relative;
  height: var(--phone-h);
  aspect-ratio: 860 / 1864;
  overflow: hidden;
  padding-top: 34px;
  border-radius: 36px;
  /* Same grey as the portal's own page background, so the status-bar strip
     reads as part of the screen. */
  background: #F7F8FA;
}
.phone-screen img {
  display: block;
  width: 100%;
  height: auto;
}
/* The camera "island", centred in the status-bar strip. */
.phone-island {
  position: absolute;
  top: 9px;
  left: 50%;
  width: 28%;
  height: 20px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: #0B1F3A;
}

.fact {
  position: absolute;
  z-index: 2;
  top: 14%;
  right: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px 14px 14px;
  background: var(--lp-surface);
  border-radius: 18px;
  box-shadow: var(--lp-shadow-lg);
}
.fact-icon {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--lp-brand-soft);
  color: var(--lp-brand);
}
.fact-value { display: block; font-size: 17px; font-weight: 800; color: var(--lp-text); }
.fact-label { display: block; font-size: 13px; color: var(--lp-muted); }

/* "Next drive": bottom-left of the phone, mirroring the fact card. */
.drive-card {
  position: absolute;
  z-index: 2;
  left: 0;
  bottom: 12%;
  max-width: 300px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px 12px 12px;
  background: var(--lp-surface);
  border-radius: 18px;
  box-shadow: var(--lp-shadow-lg);
  text-decoration: none;
  transition: transform 0.2s var(--lp-ease);
}
.drive-card:hover { transform: translateY(-2px); }
.drive-card:focus-visible { outline: 2px solid var(--lp-accent); outline-offset: 3px; }
.drive-date {
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--lp-brand-soft);
}
.drive-month {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lp-brand);
}
.drive-day { font-size: 18px; font-weight: 800; line-height: 1; color: var(--lp-text); }
.drive-text { min-width: 0; display: grid; gap: 1px; }
.drive-label { font-size: 12px; color: var(--lp-muted); }
.drive-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--lp-text);
}

/* ── Stats card, overlapping the hero's lower edge ── */
.stats-wrap {
  position: relative;
  max-width: 1200px;
  margin: 48px auto 0;
  transform: translateY(50%);
  z-index: 1;
}
.stats {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 28px 12px;
  background: var(--lp-surface);
  border-radius: var(--lp-radius);
  box-shadow: var(--lp-shadow-lg);
}
.stat {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 28px;
}
.stat + .stat { border-left: 1px solid var(--lp-border); }
.stat-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--lp-accent-soft);
  color: var(--lp-accent-text);
}
.stat-num {
  margin: 2px 0 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--lp-text);
}
.stat-label { font-size: 13px; color: var(--lp-muted); }
/* Visually the number reads first, as in a stat card. */
.stat > div { display: flex; flex-direction: column-reverse; }

/* ── Responsive ── */
@media (max-width: 1024px) {
  .hero-content { grid-template-columns: 1fr; }
  .hero-visual { max-width: 560px; width: 100%; margin: 0 auto; }
  .fact { right: 4%; }
  .drive-card { left: 4%; }
  .stats-wrap { transform: none; margin: 56px auto 0; padding-bottom: 24px; }
}

@media (max-width: 640px) {
  .hero { padding: 104px 1rem 0; }
  .hero-desc { font-size: 16px; }
  .hero-btns .lp-btn { flex: 1 1 auto; }
  .hero-visual { --phone-h: 440px; }
  .phone { padding: 8px; border-radius: 38px; }
  .phone-screen { border-radius: 30px; padding-top: 28px; }
  .phone-island { top: 7px; height: 17px; }
  /* Phones have room for one card. The next drive is the more useful one,
     so it stays (bottom-left, over the disc) and the fact card goes. */
  .fact { display: none; }
  .drive-card { left: 0; bottom: 6%; max-width: 270px; }
  .fact-icon { width: 36px; height: 36px; }
  .stats { grid-template-columns: 1fr; padding: 8px 20px; }
  .stat { padding: 18px 0; }
  .stat + .stat { border-left: none; border-top: 1px solid var(--lp-border); }
}

@media (prefers-reduced-motion: reduce) {
  .hero-copy,
  .hero-visual { animation: none; }
  .btn-arrow,
  .drive-card { transition: none; }
}
</style>
