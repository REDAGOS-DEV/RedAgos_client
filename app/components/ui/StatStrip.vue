<template>
  <!-- A row of figures, each its own card with space between. Holds StatItem children. -->
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
  gap: 14px;
  margin: 0;
}
.ss > :deep(*) {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: var(--rb-radius-lg);
  box-shadow: var(--rb-shadow-sm);
  overflow: hidden;
}

@media (max-width: 1100px) {
  .ss { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
