<template>
  <div class="app-error">
    <div class="app-error__card" role="alert">
      <p class="app-error__code">{{ statusCode }}</p>

      <h1 class="app-error__title">{{ title }}</h1>

      <p class="app-error__body">{{ body }}</p>

      <!--
        Ang tinuod nga message ug stack kay sa development ra ipakita. Sa
        production, ang error gikan sa server mahimong maglangkob og internal
        nga detalye (path, driver, query) nga dili angay makita sa user.
      -->
      <pre v-if="isDev && error?.message" class="app-error__detail">{{ error.message }}</pre>

      <div class="app-error__actions">
        <button type="button" class="app-error__btn app-error__btn--primary" @click="handleClear">
          Try again
        </button>
        <NuxtLink to="/" class="app-error__btn">Back to home</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  error: {
    type: Object,
    default: () => ({}),
  },
})

const isDev = import.meta.dev

const statusCode = computed(() => props.error?.statusCode ?? 500)

const title = computed(() => {
  switch (statusCode.value) {
    case 404:
      return 'Page not found'
    case 403:
      return 'You do not have access to this page'
    case 401:
      return 'Please sign in to continue'
    default:
      return 'Something went wrong'
  }
})

const body = computed(() => {
  switch (statusCode.value) {
    case 404:
      return 'The page you are looking for does not exist, or it may have moved.'
    case 403:
      return 'Your account does not have permission to view this. If you think this is a mistake, contact your administrator.'
    case 401:
      return 'Your session may have expired. Signing in again should fix it.'
    default:
      return 'An unexpected error occurred on our end. Trying again often works; if it does not, please report it.'
  }
})

// clearError() mo-reset sa error state ug mo-navigate — mao ni ang paagi sa Nuxt
// para makagawas sa error page nga dili mag-full reload.
function handleClear() {
  clearError({ redirect: statusCode.value === 401 ? '/auth/role-selection' : '/' })
}
</script>

<style scoped>
.app-error {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  background: var(--rb-page-bg, #f7f8fa);
  font-family: var(--rb-font-sans, ui-sans-serif, system-ui, sans-serif);
}

.app-error__card {
  max-width: 520px;
  width: 100%;
  padding: 40px;
  border: 1px solid var(--rb-border, #eef1f5);
  border-radius: 16px;
  background: var(--rb-surface, #fff);
  text-align: center;
}

.app-error__code {
  margin: 0 0 8px;
  font-size: 48px;
  font-weight: 800;
  line-height: 1;
  color: var(--rb-accent, #d32f2f);
}

.app-error__title {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 700;
  color: var(--rb-text-primary, #1f2937);
}

.app-error__body {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--rb-text-secondary, #6b7280);
}

.app-error__detail {
  margin: 20px 0 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--rb-surface-alt, #fafbfc);
  color: var(--rb-text-secondary, #6b7280);
  font-size: 12px;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
}

.app-error__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 28px;
}

.app-error__btn {
  padding: 10px 20px;
  border: 1px solid var(--rb-border-strong, #e2e8f0);
  border-radius: 8px;
  background: var(--rb-surface, #fff);
  color: var(--rb-text-primary, #1f2937);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.app-error__btn:hover {
  background: var(--rb-surface-hover, #f8fafc);
}

.app-error__btn--primary {
  background: var(--rb-primary, #1565c0);
  border-color: var(--rb-primary, #1565c0);
  color: #fff;
}

.app-error__btn--primary:hover {
  background: #0f4c95;
  border-color: #0f4c95;
}

.app-error__btn:focus-visible {
  outline: 2px solid var(--rb-primary, #1565c0);
  outline-offset: 2px;
}
</style>
