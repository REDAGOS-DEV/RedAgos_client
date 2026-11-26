<template>
  <!--
    The way back to the page above, as a round arrow beside the page's title
    (project owner, 2026-11-26), in place of the "Back to …" text line that
    sat above it. The header's breadcrumb names the same page; this is the
    one the eye meets at the title.
  -->
  <NuxtLink
    :to="to"
    class="back-btn"
    :aria-label="`Back to ${label}`"
    :title="`Back to ${label}`"
  >
    <AssetIcon name="arrow-left" :size="17" />
  </NuxtLink>
</template>

<script setup lang="ts">
import AssetIcon from '~/components/common/AssetIcon.vue'

defineProps<{
  /** The page it goes back to. */
  to: string
  /** That page's name, as the menu and breadcrumb call it. */
  label: string
}>()
</script>

<style scoped>
.back-btn {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 999px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}
.back-btn:hover {
  border-color: rgba(var(--rb-primary-rgb), 0.45);
  background: rgba(var(--rb-primary-rgb), 0.06);
  color: var(--rb-primary-text);
  transform: translateX(-2px);
}
.back-btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }

/* Not on paper: a printed page has nowhere to go back to. */
@media print { .back-btn { display: none !important; } }

@media (prefers-reduced-motion: reduce) {
  .back-btn { transition: none; }
  .back-btn:hover { transform: none; }
}
</style>
