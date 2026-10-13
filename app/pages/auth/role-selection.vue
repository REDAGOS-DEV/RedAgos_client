<template>
  <!--
    "Get started": dinhi motugpa ang tawo human mag-logout o kung ma-401,
    ug sa /home. Duha ka butang ra ang mahimo dinhi:

      - mag-create og donor account (ang bugtong public sign-up), o
      - mag-sign in sa iyang portal.

    Ang administrator kay wala dinhi, bisan sa "Sign in" nga lista. Ang
    admin login kay dili gi-link sa public nga site: diretso nga URL ra
    (/auth/admin/login, i-bookmark), ug didto ra pod mobalik human mag-logout.
  -->
  <AuthShell :hero="hero">
    <header class="au-header">
      <h1>Get started with RedAgos</h1>
      <p>Create a donor account, or sign in to your portal.</p>
    </header>

    <div class="au-form">
      <NuxtLink
        v-for="role in roles"
        :key="role.id"
        :to="destinationFor(role.id)"
        class="signup-card"
      >
        <span class="signup-icon"><AssetIcon name="blood-drop" :size="22" /></span>
        <span class="signup-text">
          <span class="signup-title">{{ role.name }}</span>
          <span class="signup-desc">{{ role.description }}</span>
        </span>
        <AssetIcon name="arrow-right" :size="18" class="signup-arrow" />
      </NuxtLink>

      <!-- Blood centers and hospital blood banks are absent on purpose: a
           RedAgos administrator creates those accounts. -->
      <p class="au-hint facility-note">
        <AssetIcon name="info" :size="14" />
        Blood center and hospital blood bank accounts are set up by a RedAgos
        administrator.
      </p>

      <div class="au-divider"><span>Already have an account? Sign in</span></div>

      <div class="au-roles">
        <NuxtLink
          v-for="portal in portals"
          :key="portal.key"
          :to="portal.to"
          class="au-role"
          :class="`au-role--${portal.key}`"
        >
          <AssetIcon :name="portal.icon" :size="18" class="au-role-icon" />
          {{ portal.label }}
        </NuxtLink>
      </div>
    </div>
  </AuthShell>
</template>

<script setup>
import AuthShell from '~/components/auth/AuthShell.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { PUBLIC_ROLES, destinationFor } from '~/utils/publicRoles'
import { authPhoto } from '~/utils/authPhotos'

definePageMeta({
  alias: ['/home'],
})

const hero = {
  lead: 'Give blood,',
  accent: 'save lives',
  desc: "Davao City's blood bank platform, connecting donors, hospitals, and blood centers.",
  ...authPhoto('donation'),
}

// Donor ra ang public sign-up. Ang Blood Center ug Hospital Blood Bank kay
// gihimo sa Super Admin pinaagi sa Facility Management, ug ang admin kay sa
// laing admin. Tan-awa ang publicRoles.ts.
const roles = PUBLIC_ROLES

// Ang sign-in sa matag portal. Wala ang administrator: ang admin login kay
// dili gi-link sa bisan asang public nga page, para dili ma-advertise kung
// asa ang pinaka-powerful nga portal. Dili ni security (makita gihapon ang
// URL), pagpakunhod ra sa exposure; ang tinuod nga proteksyon kay sa server.
const portals = [
  { key: 'donor', label: 'Donor', icon: 'blood-drop', to: '/auth/donor/login' },
  { key: 'hospital', label: 'Hospital', icon: 'hospital', to: '/auth/hospital/login' },
  { key: 'blood-center', label: 'Blood Center', icon: 'building-2', to: '/auth/blood-center/login' },
]
</script>

<style scoped>
/* The frame, fields and buttons come from AuthShell (.au-*). */

/* The one sign-up choice: a large, clearly clickable card. */
.signup-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 18px 18px 16px;
  border: 1px solid var(--au-border);
  border-radius: 16px;
  background: var(--au-card);
  text-decoration: none;
  box-shadow: 0 12px 28px -20px rgba(21, 101, 192, 0.6);
  transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms var(--au-ease);
}
.signup-card:hover {
  border-color: var(--au-accent);
  box-shadow: 0 16px 32px -18px rgba(21, 101, 192, 0.7);
}
.signup-card:active { transform: scale(0.99); }
.signup-card:focus-visible { outline: 2px solid var(--au-accent); outline-offset: 2px; }

.signup-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: #FDECEC;
  color: var(--au-brand);
}
.signup-text { flex: 1; min-width: 0; display: grid; gap: 2px; }
.signup-title { font-size: 16px; font-weight: 700; color: var(--au-text); }
.signup-desc { font-size: 13.5px; line-height: 1.45; color: var(--au-text-2); }
.signup-arrow {
  flex-shrink: 0;
  color: var(--au-accent-text);
  transition: transform 150ms var(--au-ease);
}
.signup-card:hover .signup-arrow { transform: translateX(3px); }

.facility-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.facility-note :deep(svg) { flex-shrink: 0; margin-top: 2px; }

/* Three portals (donor, hospital, blood center): one row of three. */
.au-form .au-roles { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.au-form .au-roles :deep(.au-role) { gap: 6px; padding: 0 6px; font-size: 13.5px; }
.au-roles :deep(.au-role-icon) { flex-shrink: 0; }
@media (max-width: 420px) {
  .au-form .au-roles { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .signup-card,
  .signup-arrow { transition: none; }
}
</style>
