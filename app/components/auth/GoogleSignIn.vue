<template>
  <!--
    "Sign in with" and Google's round icon button (Google Identity Services,
    type "icon"), as the usual sign-in pages show it. Until a client ID is
    configured the same round button shows, switched off, saying why.
  -->
  <div class="gsi">
    <div class="gsi__divider"><span>Sign in with</span></div>
    <div class="gsi__row">
      <div v-if="clientId && !failed" ref="slot" class="gsi__slot" :class="{ 'gsi__slot--busy': disabled }" />
      <button
        v-else
        type="button"
        class="gsi__placeholder"
        disabled
        :title="failed ? 'Google sign-in could not load.' : 'Google sign-in is not set up yet.'"
        aria-label="Sign in with Google (not available)"
      >
        <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Sign in with Google (2026-10-30). The browser gets an ID token from Google
 * and hands it to `credential`; the server checks it with Google and opens the
 * account that uses the address (POST /login/google).
 */
const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ credential: [token: string] }>()

const clientId = useRuntimeConfig().public.googleClientId as string
const slot = ref<HTMLElement | null>(null)
const failed = ref(false)

const SCRIPT = 'https://accounts.google.com/gsi/client'

function loadScript(): Promise<void> {
  const w = window as any
  if (w.google?.accounts?.id) return Promise.resolve()

  return new Promise((resolve, reject) => {
    let tag = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`)
    if (!tag) {
      tag = document.createElement('script')
      tag.src = SCRIPT
      tag.async = true
      tag.defer = true
      document.head.appendChild(tag)
    }
    tag.addEventListener('load', () => resolve(), { once: true })
    tag.addEventListener('error', () => reject(new Error('gsi')), { once: true })
  })
}

function draw() {
  const google = (window as any).google
  if (!google?.accounts?.id || !slot.value) return

  google.accounts.id.initialize({
    client_id: clientId,
    callback: (response: { credential?: string }) => {
      if (response?.credential && !props.disabled) emit('credential', response.credential)
    },
    ux_mode: 'popup',
  })
  // Google's own round "G" button.
  google.accounts.id.renderButton(slot.value, {
    type: 'icon',
    theme: 'outline',
    size: 'large',
    shape: 'circle',
  })
}

onMounted(async () => {
  if (!clientId) return
  try {
    await loadScript()
    draw()
  } catch {
    failed.value = true
  }
})
</script>

<style scoped>
/* A clear step below Sign In, and room before the footer (2026-10-30). */
.gsi { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; margin: 6px 0 4px; }
.gsi__divider { display: flex; align-items: center; gap: 14px; width: 100%; font-size: 12.5px; font-weight: 500; color: var(--rb-text-secondary); }
.gsi__divider::before, .gsi__divider::after { content: ''; flex: 1; height: 1px; background: var(--rb-border-strong, var(--rb-border)); }
@media (max-height: 700px) { .gsi { gap: 12px; margin-top: 2px; } }
.gsi__row { display: flex; justify-content: center; gap: 16px; }
.gsi__slot { display: flex; justify-content: center; min-height: 44px; }
.gsi__slot--busy { opacity: 0.5; pointer-events: none; }
.gsi__placeholder {
  display: grid; place-items: center; width: 44px; height: 44px;
  border: 1px solid var(--rb-border-strong); border-radius: 50%;
  background: var(--rb-surface); cursor: not-allowed; opacity: 0.6;
}
</style>
