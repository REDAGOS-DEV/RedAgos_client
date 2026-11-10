<template>
  <!--
    The staff portals are made for a desktop or laptop (project owner,
    2026-11-11), so a phone or a small tablet sees this instead of a squeezed
    layout. Shown by width alone, in CSS (below 900px: a laptop at 125-150%
    zoom stays above it), so the server render and the browser agree.
    "Continue anyway" lets an urgent task go on, for the rest of the tab.
  -->
  <div v-if="!dismissed" class="don" role="dialog" aria-modal="true" aria-labelledby="don-title">
    <div class="don__card">
      <span class="don__icon" aria-hidden="true"><AssetIcon name="monitor" :size="26" /></span>
      <h2 id="don-title" class="don__title">Best on a desktop or laptop</h2>
      <p class="don__text">
        The {{ portal }} is made for the computers at the centre, so some pages will not fit this screen.
        Open RedAgos on a desktop or laptop, or turn this device sideways.
      </p>
      <button type="button" class="don__btn" @click="dismiss">Continue anyway</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

defineProps({
  // "blood center portal", "hospital blood bank portal"
  portal: { type: String, required: true },
})

const KEY = 'redagos:desktop-notice-dismissed'
const dismissed = ref(false)

onMounted(() => {
  try { dismissed.value = sessionStorage.getItem(KEY) === '1' } catch { /* private mode: show it */ }
})

function dismiss() {
  dismissed.value = true
  try { sessionStorage.setItem(KEY, '1') } catch { /* nothing to remember it in */ }
}
</script>

<style scoped>
/* Hidden at desktop widths; the overlay only exists for small screens. */
.don { display: none; }

@media (max-width: 899px) {
  .don {
    position: fixed;
    inset: 0;
    z-index: 300;
    display: grid;
    place-items: center;
    padding: 24px 16px;
    /* Dimmed like a dialog's backdrop, so the squeezed page reads as behind it. */
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(3px);
  }
}

.don__card {
  width: 100%;
  max-width: 400px;
  padding: 28px 24px;
  border: 1px solid var(--rb-border);
  border-radius: 20px;
  background: var(--rb-surface);
  box-shadow: 0 20px 50px -24px rgba(15, 23, 42, 0.35);
  font-family: var(--rb-font-sans);
  color: var(--rb-text-primary);
  text-align: center;
}

.don__icon {
  display: inline-grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 14px;
  border-radius: 16px;
  background: rgba(var(--rb-primary-rgb), 0.1);
  color: var(--rb-primary-text);
}

.don__title { margin: 0 0 8px; font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
.don__text { margin: 0 0 20px; font-size: 13.5px; line-height: 1.55; color: var(--rb-text-secondary); }

.don__btn {
  height: 40px;
  padding: 0 18px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 10px;
  background: var(--rb-surface);
  font: inherit;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--rb-text-primary);
  cursor: pointer;
}
.don__btn:hover { background: var(--rb-surface-hover); }
.don__btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
</style>
