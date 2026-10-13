<template>
  <section id="roles" class="roles" ref="sectionRef">
    <div class="section-inner">
      <div class="badge" :class="{ 'animate-in': visible }">
        <span class="badge-dot"></span>
        WHO IT'S FOR
      </div>

      <div class="heading-wrap" :class="{ 'animate-in': visible }">
        <h2 class="heading-top">
          Built for Every Part of the <span class="heading-blue">Blood Chain</span>
        </h2>
        <p class="subheading">
          One connected system for the people who give blood, the centers that
          process it, and the hospitals that deliver it to patients.
        </p>
      </div>

      <div class="role-grid">
        <article
          v-for="(role, index) in roles"
          :key="role.key"
          class="role-card"
          :class="[`role-${role.key}`, { 'animate-in': visible }]"
          :style="{ '--role-delay': `${0.1 + index * 0.1}s` }"
        >
          <div class="role-icon">
            <AssetIcon :name="role.icon" :size="24" />
          </div>
          <h3>{{ role.title }}</h3>
          <p class="role-desc">{{ role.desc }}</p>

          <ul class="role-list">
            <li v-for="item in role.items" :key="item">
              <AssetIcon name="check" class="role-check" :size="16" />
              <span>{{ item }}</span>
            </li>
          </ul>

          <!-- Pinned to the card bottom; every card fills the note line so the buttons align -->
          <div class="role-footer">
            <NuxtLink :to="role.to" class="role-cta">
              {{ role.cta }}
              <AssetIcon name="arrow-right" :size="16" />
            </NuxtLink>
            <p class="role-note">
              <template v-if="role.noteLink">
                {{ role.note }}
                <NuxtLink :to="role.noteLink.to" class="role-note-link">{{ role.noteLink.label }}</NuxtLink>
              </template>
              <template v-else>{{ role.note }}</template>
            </p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

const sectionRef = ref(null)
const visible = ref(false)

const roles = [
  {
    key: 'donor',
    icon: 'blood-drop',
    title: 'Donors',
    desc: 'Give blood with less waiting and more visibility into your impact.',
    items: [
      'Book donation appointments',
      'Complete eligibility screening online',
      'View your donation history',
      'Get notified about donation drives',
    ],
    cta: 'Donor Sign In',
    to: '/auth/donor/login',
    note: 'New donor?',
    noteLink: { label: 'Create an account', to: '/auth/donor/register' },
  },
  {
    key: 'center',
    icon: 'building-2',
    title: 'Blood Centers',
    desc: 'Manage every unit from collection to dispatch in one place.',
    items: [
      'Collection and laboratory testing',
      'Component processing and storage',
      'Fulfill hospital blood requests',
      'Billing, receipts, and reports',
    ],
    cta: 'Blood Center Sign In',
    to: '/auth/blood-center/login',
    note: 'Facility accounts are set up by the RedAgos administrator.',
  },
  {
    key: 'hospital',
    icon: 'hospital',
    title: 'Hospital Blood Banks',
    desc: 'Keep blood ready for patients and request supply before you run short.',
    items: [
      'Check blood availability',
      'Submit and track blood requests',
      'Weekly and direct stock receiving',
      'Stock thresholds and low-stock alerts',
    ],
    cta: 'Hospital Sign In',
    to: '/auth/hospital/login',
    note: 'Facility accounts are set up by the RedAgos administrator.',
  },
]

let observer

onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) visible.value = true },
    { threshold: 0.15 }
  )
  if (sectionRef.value) observer.observe(sectionRef.value)
})

onUnmounted(() => observer?.disconnect())
</script>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Same motion as FeaturesSection. The card/icon reveals animate the
   individual `translate`/`scale`/`rotate` properties so the `transform`
   used on hover is not held down by the finished animation. */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes cardReveal {
  0%   { opacity: 0; translate: 0 34px; scale: 0.96; filter: blur(4px); }
  100% { opacity: 1; translate: 0 0;    scale: 1;    filter: blur(0); }
}
@keyframes iconPop {
  0%   { scale: 0.78; rotate: -8deg; }
  70%  { scale: 1.08; rotate: 3deg; }
  100% { scale: 1;    rotate: 0deg; }
}

/* ── Section — same container as Hero/Drives/About/Footer ── */
.roles {
  padding: 0 0 100px;
  background: var(--lp-surface-alt);
  font-family: var(--rb-font-sans);
  scroll-margin-top: 76px;
}

.section-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Badge ── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 18px;
  border-radius: 999px;
  background: var(--lp-accent-soft);
  color: var(--lp-accent-text);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  border: 1px solid rgba(37, 99, 235, 0.2);
  margin-bottom: 32px;
  opacity: 0;
}
.badge.animate-in {
  animation: fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.05s forwards;
}
.badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--lp-accent);
}

/* ── Heading ── */
.heading-wrap {
  text-align: center;
  max-width: 780px;
  margin-bottom: 56px;
  opacity: 0;
}
.heading-wrap.animate-in {
  animation: fadeUp 0.65s cubic-bezier(0.22, 1, 0.36, 1) 0.12s forwards;
}
.heading-top {
  font-size: 44px;
  font-weight: 800;
  color: var(--lp-text);
  line-height: 1.15;
}
.heading-blue { color: var(--lp-accent-text); }
.subheading {
  margin: 16px auto 0;
  color: var(--lp-text-2);
  font-size: 17px;
  line-height: 1.7;
  max-width: 680px;
}

/* ── Grid ── */
.role-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

/* ── Card — each role gets its own accent ── */
.role-card {
  --accent: var(--lp-accent);
  --accent-soft: var(--lp-accent-soft);

  position: relative;
  background: var(--lp-surface);
  border: 1px solid var(--lp-border);
  border-radius: 16px;
  padding: 28px 24px 24px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: 0;
  transition: box-shadow 0.28s ease, transform 0.28s ease, border-color 0.28s ease;
}
.role-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.28s ease;
}
.role-donor    { --accent: var(--lp-brand);  --accent-soft: var(--lp-brand-soft); }
.role-center   { --accent: var(--lp-accent); --accent-soft: var(--lp-accent-soft); }
.role-hospital { --accent: #16a34a; --accent-soft: rgba(22, 163, 74, 0.08); }

.role-card.animate-in {
  animation: cardReveal 0.72s cubic-bezier(0.22, 1, 0.36, 1) var(--role-delay) forwards;
}
.role-card.animate-in .role-icon {
  animation: iconPop 0.52s cubic-bezier(0.22, 1, 0.36, 1) calc(var(--role-delay) + 0.16s) both;
}
.role-card:hover {
  box-shadow: 0 18px 44px rgba(37, 99, 235, 0.14);
  transform: translateY(-8px) scale(1.015);
  border-color: rgba(37, 99, 235, 0.16);
}
.role-card:hover::before {
  transform: scaleX(1);
}

.role-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
  transition: transform 0.28s ease;
}
.role-card:hover .role-icon {
  transform: translateY(-2px) rotate(-3deg);
}

.role-card h3 {
  font-size: 20px;
  font-weight: 700;
  color: var(--lp-text);
  margin-bottom: 8px;
}
.role-desc {
  font-size: 14px;
  color: var(--lp-muted);
  line-height: 1.6;
  margin-bottom: 20px;
}

.role-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 20px;
  border-top: 1px solid var(--lp-border);
  margin-bottom: 24px;
}
.role-list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  color: var(--lp-text-2);
  line-height: 1.45;
}
.role-check {
  color: var(--accent);
  flex-shrink: 0;
  margin-top: 1px;
}

.role-footer { margin-top: auto; }

.role-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 11px 16px;
  border-radius: 8px;
  border: 1px solid var(--lp-accent);
  color: var(--lp-accent-text);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s, color 0.2s, transform 0.15s, box-shadow 0.2s;
}
/* Same lift as the Hero/Contact buttons */
.role-cta:hover {
  background: var(--lp-accent);
  color: var(--lp-on-accent);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.3);
}
.role-note {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--lp-muted);
  text-align: center;
}
/* Side by side, a note that wraps would push its button up — reserve two lines */
@media (min-width: 1025px) {
  .role-note { min-height: 3em; }
}
.role-note-link {
  color: var(--lp-accent-text);
  font-weight: 600;
  text-decoration: none;
}
.role-note-link:hover { text-decoration: underline; }
.role-cta:focus-visible {
  outline: 2px solid var(--lp-accent);
  outline-offset: 2px;
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .role-grid {
    grid-template-columns: 1fr;
    max-width: 560px;
  }
}

@media (max-width: 640px) {
  .roles { padding: 0 0 64px; }
  .section-inner { padding: 0 1.25rem; }
  .heading-top { font-size: 28px; }
  .subheading { font-size: 15px; }
  .heading-wrap { margin-bottom: 36px; }
  .role-grid { gap: 14px; }
  .role-card { padding: 22px 18px 18px; }
  .role-icon { width: 42px; height: 42px; margin-bottom: 14px; }
  .role-card h3 { font-size: 18px; }
  .role-desc { margin-bottom: 16px; }
  .role-list { padding-top: 16px; gap: 8px; margin-bottom: 20px; }
}

@media (prefers-reduced-motion: reduce) {
  .badge, .heading-wrap, .role-card {
    opacity: 1;
    transform: none;
    animation: none;
  }
  .role-card.animate-in .role-icon { animation: none; }
  .role-card:hover,
  .role-card:hover .role-icon,
  .role-cta:hover { transform: none; }
}
</style>
