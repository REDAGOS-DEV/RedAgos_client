<template>
  <main class="login-screen">
    <div class="login-shell">
      <AuthBrandPanel />

      <section class="form-panel">
        <div class="form-card">
          <div class="mobile-brand">
            <div class="mobile-brand-curve">
              <img :src="logo" alt="RedAgos Logo" class="mobile-logo" />
              <p class="brand-name">
                Red<span>Agos</span>
              </p>
              <p class="brand-subtitle">Blood Bank System</p>
            </div>
          </div>

          <NuxtLink to="/" class="back-link">
            <AssetIcon name="chevron-left" :size="18" />
          </NuxtLink>

          <h1>Create an Account</h1>

          <p class="form-subtitle">
            Select your role to get started with RedAgos
          </p>

          <!-- Blood centers and hospital blood banks are absent on purpose: a
               RedAgos administrator creates those accounts. -->
          <p class="facility-note">
            Blood center and hospital blood bank accounts are created by a
            RedAgos administrator. Contact them to have yours set up.
          </p>

          <div class="role-selection-form">
            <div class="roles-container">
              <label
                v-for="role in roles"
                :key="role.id"
                class="role-card"
                :class="{
                  selected: selectedRole === role.id,
                  [role.colorClass]: true,
                }"
                @click="selectRole(role.id)"
              >
                <div class="role-card-content">
                  <div class="role-icon" :class="role.iconClass">
                    <svg
                      v-if="role.id === 'donor'"
                      aria-hidden="true"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <svg
                      v-else-if="role.id === 'admin'"
                      aria-hidden="true"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div class="role-info">
                    <div class="role-name">
                      {{ role.name }}
                    </div>
                    <div class="role-desc">
                      {{ role.description }}
                    </div>
                  </div>
                </div>

                <input
                  type="radio"
                  name="role"
                  :value="role.id"
                  :checked="selectedRole === role.id"
                  class="role-radio"
                  @change="selectRole(role.id)"
                />
              </label>
            </div>

            <button
              type="button"
              class="continue-button"
              :disabled="!selectedRole"
              @click="continueWithRole"
            >
              Continue →
            </button>

            <p class="signin-text">
              Already have an account?
              <NuxtLink to="/auth/donor/login">
                Sign In
              </NuxtLink>
            </p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import logo from '~/assets/images/RedAgosLogo.png'
import AuthBrandPanel from '~/components/auth/AuthBrandPanel.vue'
import AssetIcon from '~/components/common/AssetIcon.vue'
import { PUBLIC_ROLES, destinationFor } from '~/utils/publicRoles'

definePageMeta({
  alias: ['/home'],
})

const selectedRole = ref('')

// Duha na lang ka kapilian ang nahibilin. Gitangtang ang Blood Center ug ang
// Hospital Blood Bank: ang Super Admin ra ang mohimo niadto nga account pinaagi
// sa Facility Management, ug wala nay public endpoint sa server nga mohimo og
// facility. Kon ibalik ang card, motultol ra siya sa dead end.
const roles = PUBLIC_ROLES

const selectRole = (roleId) => {
  selectedRole.value = roleId
}

const continueWithRole = async () => {
  if (!selectedRole.value) return

  await navigateTo(destinationFor(selectedRole.value))
}
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.login-screen {
  min-height: 100vh;
  background: #eef4fb;
  color: #1f2937;
  font-family: var(--rb-font-sans);
}

.login-shell {
  display: grid;
  min-height: 100vh;
  grid-template-columns: 540px 1fr;
}

.form-panel {
  display: flex;
  min-height: 100vh;
  justify-content: flex-start;
  padding: 0;
}

.form-card {
  width: 100%;
  max-width: 560px;
  margin-top: 62px;
  margin-left: 140px;
}

/* ── MOBILE BRAND — hidden on desktop ── */
.mobile-brand {
  display: none;
}

.mobile-brand-curve {
  position: relative;
  width: calc(100% + 48px);
  margin: -36px -24px 20px;
  padding: 44px 24px 56px;
  background: #1565C0;
  text-align: center;
}

.mobile-logo {
  width: 56px;
  height: 56px;
  object-fit: contain;
  display: block;
  margin: 0 auto 10px;
}

.mobile-brand .brand-name {
  color: #ffffff;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.01em;
  margin: 0;
}

.mobile-brand .brand-name span {
  color: #eb3535;
}

.mobile-brand .brand-subtitle {
  color: rgba(255, 255, 255, 0.82);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 4px 0 0;
}

.back-link {
  display: inline-flex;
  align-items: center;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.back-link:hover {
  color: #334155;
}

h1 {
  margin: 46px 0 0;
  color: #1f2937;
  font-size: 38px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.18;
}

.form-subtitle {
  margin: 16px 0 0;
  color: #64748b;
  font-size: 16px;
  line-height: 1.5;
}

.facility-note {
  margin: 12px 0 0;
  padding: 12px 14px;
  border-left: 3px solid #1e6fc8;
  border-radius: 0 8px 8px 0;
  background: #eef4fb;
  color: #475569;
  font-size: 13.5px;
  line-height: 1.5;
}

.role-selection-form {
  margin-top: 54px;
}

.roles-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
}

.role-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.role-card:hover {
  border-color: #d1d5db;
  background: #F0F7FF;
}
.role-card[class*="role-donor"]:hover {
  border-color: #ef4444;
  background: #FEF2F2;
}

.role-card[class*="role-admin"]:hover {
  border-color: #1f2937;
  background: #F0F0F0;
}

.role-card-content {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.role-icon {
  display: flex;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: #ffffff;
}

.role-icon svg {
  width: 24px;
  height: 24px;
}

.icon-donor {
  background: #ef4444;
}

.icon-admin {
  background: #1f2937;
}

.role-info {
  flex: 1;
}

.role-name {
  display: flex;
  align-items: center;
  color: #1f2937;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 4px;
}

.role-desc {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.4;
}

.role-radio {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  cursor: pointer;
}

.role-card.role-donor .role-radio {
  accent-color: #ef4444;
}

.role-card.role-admin .role-radio {
  accent-color: #1f2937;
}

/* Selected states with colors */
.role-card.selected {
  border-width: 2px;
}

.role-card.selected.role-donor {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.04);
}

.role-card.selected.role-admin {
  border-color: #1f2937;
  background: rgba(31, 41, 55, 0.04);
}

.continue-button {
  display: flex;
  width: 100%;
  height: 52px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 0;
  border-radius: 8px;
  background: #1e6fc8;
  color: #ffffff;
  cursor: pointer;
  font-size: 16px;
  font-weight: 800;
  transition: background 0.2s ease;
}

.continue-button:hover:not(:disabled) {
  background: #185dac;
}

.continue-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.signin-text {
  margin: 24px 0 0;
  color: #64748b;
  font-size: 14px;
  text-align: center;
}

.signin-text a {
  color: #1266c3;
  font-weight: 800;
  text-decoration: none;
}

.signin-text a:hover {
  color: #0d4f9c;
}

@media (max-width: 1023px) {
  .login-shell {
    display: block;
  }

  .brand-panel {
    display: none;
  }

  .form-panel {
    position: relative;
    justify-content: center;
    padding: 0 24px 56px;
  }

  .form-card {
    margin: 0;
    max-width: 100%;
    text-align: center;
  }

  .mobile-brand {
    display: block;
  }

  .back-link {
    position: absolute;
    top: 16px;
    left: 18px;
    z-index: 5;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.16);
    padding: 6px 12px 6px 8px;
    border-radius: 999px;
    font-size: 13px;
  }

  .back-link:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.26);
  }

  .mobile-brand-curve {
    padding-top: 56px;
  }

  h1 {
    margin-top: 22px;
    font-size: 24px;
    line-height: 1.25;
  }

  .form-subtitle {
    margin-top: 8px;
    font-size: 14px;
  }

  .role-selection-form {
    text-align: left;
    margin-top: 32px;
  }
}

@media (max-width: 520px) {
  .form-panel {
    padding: 0 18px 40px;
  }

  .mobile-brand-curve {
    width: calc(100% + 36px);
    margin: -20px -18px 18px;
    padding: 52px 18px 48px;
  }

  h1 {
    font-size: 24px;
  }

  .role-card {
    padding: 16px;
  }

  .role-icon {
    width: 40px;
    height: 40px;
  }

  .role-name {
    font-size: 15px;
  }

  .role-desc {
    font-size: 12px;
  }
}

.continue-button:focus-visible {
  outline: 2px solid var(--rb-primary, #1565C0);
  outline-offset: 2px;
}
</style>