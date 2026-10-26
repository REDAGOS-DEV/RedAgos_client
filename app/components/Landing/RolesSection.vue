<template>
  <section id="roles" class="roles lp-section">
    <div class="lp-inner">
      <header v-reveal class="lp-head lp-head--center">
        <h2 class="lp-h2">
          Built for every part of the <span class="accent">blood chain</span>
        </h2>
        <p class="lp-lead">
          One connected system for the people who give blood, the centers that
          process it, and the hospitals that deliver it to patients.
        </p>
      </header>

      <div class="role-grid">
        <article
          v-for="(role, index) in roles"
          :key="role.key"
          v-reveal="index * 100"
          class="role-card"
          :class="`role-card--${role.key}`"
        >
          <div class="role-media">
            <img :src="role.photo" :alt="role.alt" class="lp-photo" loading="lazy" />
          </div>

          <div class="role-body">
            <div class="role-title">
              <span class="role-icon"><AssetIcon :name="role.icon" :size="20" /></span>
              <h3>{{ role.title }}</h3>
            </div>
            <p class="role-desc">{{ role.desc }}</p>

            <ul class="role-list">
              <li v-for="item in role.items" :key="item">
                <AssetIcon name="check-circle" class="role-check" :size="16" />
                <span>{{ item }}</span>
              </li>
            </ul>

            <div class="role-footer">
              <NuxtLink
                :to="role.to"
                class="lp-btn lp-btn--sm"
                :class="role.key === 'donor' ? 'lp-btn--primary' : 'lp-btn--secondary'"
              >
                {{ role.cta }}
                <AssetIcon name="arrow-right" :size="16" />
              </NuxtLink>
              <p class="role-note">
                {{ role.note }}
                <NuxtLink v-if="role.noteLink" :to="role.noteLink.to" class="role-note-link">
                  {{ role.noteLink.label }}
                </NuxtLink>
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

const img = (id, w) => `https://images.unsplash.com/photo-${id}?w=${w}&q=70&auto=format&fit=crop`

const roles = [
  {
    key: 'donor',
    icon: 'blood-drop',
    photo: '/images/photos/prc-physical-assessment.jpg',
    alt: "A donor's physical assessment at a Philippine Red Cross blood drive",
    title: 'Donors',
    desc: 'Give blood with less waiting and more visibility into your impact.',
    items: [
      'Book donation appointments',
      'Complete eligibility screening online',
      'View your donation history',
      'Get notified about donation drives',
    ],
    cta: 'Donor Sign In',
    to: '/auth/login',
    note: 'New donor?',
    noteLink: { label: 'Create an account', to: '/auth/donor/register' },
  },
  {
    key: 'center',
    icon: 'building-2',
    photo: img('1582719471384-894fbb16e074', 600),
    alt: 'A laboratory scientist examining a sample under a microscope',
    title: 'Blood Centers',
    desc: 'Manage every unit from collection to dispatch in one place.',
    items: [
      'Collection and laboratory testing',
      'Component processing and storage',
      'Fulfill hospital blood requests',
      'Billing, receipts, and reports',
    ],
    cta: 'Blood Center Sign In',
    to: '/auth/login',
    note: 'Facility accounts are set up by the RedAgos administrator.',
  },
  {
    key: 'hospital',
    icon: 'hospital',
    photo: '/images/photos/pgh-ward.jpg',
    alt: 'A ward of the Philippine General Hospital in Manila',
    title: 'Hospital Blood Banks',
    desc: 'Keep blood ready for patients and request supply before you run short.',
    items: [
      'Check blood availability',
      'Submit and track blood requests',
      'Weekly and direct stock receiving',
      'Stock thresholds and low-stock alerts',
    ],
    cta: 'Hospital Sign In',
    to: '/auth/login',
    note: 'Facility accounts are set up by the RedAgos administrator.',
  },
]
</script>

<style scoped>
.roles { background: var(--lp-surface); }
.accent { color: var(--lp-accent-text); }

/* Bento: donors (the main public audience) large on the left,
   the two facility portals stacked on the right. */
.role-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  grid-template-rows: auto auto;
  gap: 20px;
}

.role-card {
  display: flex;
  overflow: hidden;
  background: var(--lp-bg);
  border: 1px solid var(--lp-border);
  border-radius: 24px;
}
.role-card--donor {
  grid-row: span 2;
  flex-direction: column;
  background: var(--lp-accent-soft);
  border-color: transparent;
}
.role-card--center,
.role-card--hospital { flex-direction: row; }

/* The photo fills whatever space the text leaves, so the image never sets
   the card's height (a tall source photo used to stretch the whole row). */
.role-media {
  position: relative;
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
}
.role-media .lp-photo {
  position: absolute;
  inset: 0;
  border-radius: 0;
}
.role-card--donor .role-media { flex: 1; min-height: 240px; }
.role-card--donor .role-body { flex: 0 0 auto; }
.role-card--center .role-media,
.role-card--hospital .role-media { width: 34%; }

.role-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 28px;
}

.role-title { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.role-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--lp-surface);
  color: var(--lp-accent-text);
  box-shadow: var(--lp-shadow);
}
.role-card--donor .role-icon { background: var(--lp-brand); color: #fff; box-shadow: none; }
.role-title h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--lp-text);
}
.role-desc {
  margin: 0 0 18px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--lp-text-2);
}

.role-list {
  list-style: none;
  margin: 0 0 24px;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
}
.role-card--donor .role-list { grid-template-columns: 1fr; }
.role-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--lp-text);
}
.role-check { margin-top: 2px; color: var(--lp-accent-text); }

.role-footer {
  margin-top: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}
.role-note { margin: 0; font-size: 13px; line-height: 1.45; color: var(--lp-muted); }
.role-note-link { font-weight: 600; color: var(--lp-accent-text); text-decoration: none; }
.role-note-link:hover { text-decoration: underline; text-underline-offset: 3px; }

/* ── Responsive ── */
@media (max-width: 1024px) {
  .role-grid { grid-template-columns: 1fr; max-width: 640px; margin: 0 auto; }
  .role-card--donor { grid-row: auto; }
  .role-card--donor .role-media { flex: none; aspect-ratio: 16 / 9; }
}
@media (max-width: 640px) {
  .role-card--center,
  .role-card--hospital { flex-direction: column; }
  .role-card--center .role-media,
  .role-card--hospital .role-media { width: 100%; aspect-ratio: 16 / 9; }
  .role-body { padding: 22px; }
  .role-list { grid-template-columns: 1fr; }
}
</style>
