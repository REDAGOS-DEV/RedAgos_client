<template>
  <!-- One strip of figures, divided rather than boxed. Holds StatItem children. -->
  <dl class="ss" :style="{ '--ss-cols': columns }">
    <slot />
  </dl>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  /** How many figures sit in one row on a wide screen. */
  columns?: number
}>(), { columns: 4 })
</script>

<style scoped>
.ss {
  display: grid;
  grid-template-columns: repeat(var(--ss-cols), minmax(0, 1fr));
  margin: 0;
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: var(--rb-radius-lg);
  box-shadow: var(--rb-shadow-sm);
  overflow: hidden;
}
.ss > :deep(*) { border-left: 1px solid var(--rb-border); }
.ss > :deep(*:first-child) { border-left: 0; }

@media (max-width: 1100px) {
  .ss { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ss > :deep(*:nth-child(odd)) { border-left: 0; }
  .ss > :deep(*:nth-child(n + 3)) { border-top: 1px solid var(--rb-border); }
}
</style>
