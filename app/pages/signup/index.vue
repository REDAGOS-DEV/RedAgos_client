<template>
  <main class="login-screen">
    <div class="login-shell">
      <AuthBrandPanel />

      <section class="form-panel">
        <div class="form-card">
          <div class="mobile-brand">
            <p class="brand-name">
              Red<span>Agos</span>
            </p>
            <p class="brand-subtitle">Blood Bank System</p>
          </div>

          <NuxtLink to="/" class="back-link">
            &larr; Back to Home
          </NuxtLink>

          <h1>Create an Account</h1>

          <p class="form-subtitle">
            Select your role to get started with RedAgos
          </p>

          <div class="role-selection-form">
            <div class="roles-container">
              <label
                v-for="role in roles"
                :key="role.id"
                class="role-card"
                :class="{ selected: selectedRole === role.id, [role.colorClass]: true }"
                @click="selectRole(role.id)"
              >
                <div class="role-card-content">
                  <div class="role-icon" :class="role.iconClass">
                    <svg
                      v-if="role.id === 'hospital'"
                      aria-hidden="true"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 21h16M6 21V7l6-3 6 3v14M9 11h2M13 11h2M9 15h2M13 15h2" />
                    </svg>
                    <svg
                      v-else-if="role.id === 'blood-center'"
                      aria-hidden="true"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 3s6 6.1 6 10a6 6 0 1 1-12 0c0-3.9 6-10 6-10z" />
                      <path stroke-linecap="round" d="M9.5 14.5a2.5 2.5 0 0 0 5 0" />
                    </svg>
                    <svg
                      v-else-if="role.id === 'donor'"
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
                    <div class="role-name">{{ role.name }}</div>
                    <div class="role-desc">{{ role.description }}</div>
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
              <NuxtLink to="/login">
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
import AuthBrandPanel from '~/components/auth/AuthBrandPanel.vue'

const selectedRole = ref('')

const roles = [
  {
    id: 'hospital',
    name: 'Hospital Blood Bank',
    description: 'Request and manage blood supply for your hospital',
    colorClass: 'role-hospital',
    iconClass: 'icon-hospital',
  },
  {
    id: 'blood-center',
    name: 'Blood Center',
    description: 'Process requests, manage donors, and inventory.',
    colorClass: 'role-blood-center',
    iconClass: 'icon-blood-center',
  },
  {
    id: 'donor',
    name: 'Donor',
    description: 'Register to donate blood and book appointments.',
    colorClass: 'role-donor',
    iconClass: 'icon-donor',
  },
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Manage the system, users, and overall operations.',
    colorClass: 'role-admin',
    iconClass: 'icon-admin',
  },
]

const selectRole = (roleId) => {
  selectedRole.value = roleId
}

const continueWithRole = async () => {
  if (!selectedRole.value) return

  await navigateTo(`/signup/${selectedRole.value}`)
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
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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

.mobile-brand {
  display: none;
}

.mobile-brand .brand-name {
  color: #1769c9;
}

.mobile-brand .brand-subtitle {
  color: #64748b;
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
.role-card[class*="role-hospital"]:hover{
    border-color: #2563eb;
    background: #F0F7FF;
}
.role-card[class*="role-blood-center"]:hover {
  border-color: #42A5F5;
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

.icon-hospital {
  background: #2563eb;
}

.icon-blood-center {
  background: #3b82f6;
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

.role-card.role-hospital .role-radio {
  accent-color: #2563eb;
}

.role-card.role-blood-center .role-radio {
  accent-color: #3b82f6;
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

.role-card.selected.role-hospital

.role-card.selected.role-blood-center {
  border-color: #42A5F5;
  background: rgba(37, 99, 235, 0.04);
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

  .form-panel {
    justify-content: center;
    padding: 56px 24px;
  }

  .form-card {
    margin: 0;
    max-width: 100%;
  }

  .mobile-brand {
    display: block;
    margin-bottom: 48px;
  }

  .mobile-brand .brand-name {
    color: #1769c9;
  }

  .mobile-brand .brand-subtitle {
    color: #64748b;
  }
}

@media (max-width: 520px) {
  .form-panel {
    padding: 36px 18px;
  }

  h1 {
    font-size: 34px;
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
</style>
