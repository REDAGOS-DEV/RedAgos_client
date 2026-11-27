<template>
  <!-- A row of figures, each its own card with space between. Holds StatItem children. -->
  <dl class="ss" :class="`ss--${variant}`" :style="{ '--ss-cols': columns }">
    <slot />
  </dl>
</template>

<script setup lang="ts">
import { provide, toRef } from 'vue'

const props = withDefaults(defineProps<{
  /** How many figures sit in one row on a wide screen. */
  columns?: number
  /**
   * cards: each figure its own card (the default). panel: the same cards
   * drawn as the hospital dashboard's KPIs: no icon chip, a dot by the label,
   * a larger number, a quieter zero (2026-11-26).
   */
  variant?: 'cards' | 'panel'
}>(), { columns: 4, variant: 'cards' })

// Its figures draw a zero quieter in the panel (StatItem reads this).
provide('statStripVariant', toRef(props, 'variant'))
</script>

<style scoped>
.ss {
  display: grid;
  grid-template-columns: repeat(var(--ss-cols), minmax(0, 1fr));
  gap: 14px;
  margin: 0;
}
.ss--cards > :deep(*) {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: var(--rb-radius-lg);
  box-shadow: var(--rb-shadow-sm);
  overflow: hidden;
}

/* Each figure its own card with room between them (project owner,
   2026-11-26: joined cells read cramped), drawn as the dashboard's KPIs. */
.ss--panel { gap: 14px; }
.ss--panel > :deep(*) {
  background: var(--rb-surface);
  border: 1px solid var(--rb-border);
  border-radius: var(--rb-radius-lg);
  box-shadow: var(--rb-shadow-sm);
  overflow: hidden;
}
.ss--panel :deep(.si) { padding: 16px 20px 18px; }
/* No icon chip: a dot in the label carries the tone, as the dashboard's KPI panels. */
.ss--panel :deep(.si__icon) { display: none; }
.ss--panel :deep(.si__body) { gap: 4px; }
.ss--panel :deep(.si__label) { display: flex; align-items: center; gap: 7px; font-size: 12.5px; }
.ss--panel :deep(.si__label)::before { content: ''; width: 7px; height: 7px; flex: none; border-radius: 999px; background: var(--si-dot, var(--rb-primary)); }
.ss--panel :deep(.si--success) { --si-dot: var(--rb-success); }
.ss--panel :deep(.si--warning) { --si-dot: var(--rb-warning); }
.ss--panel :deep(.si--danger) { --si-dot: var(--rb-accent); }
.ss--panel :deep(.si--purple) { --si-dot: var(--rb-purple, var(--rb-primary)); }
.ss--panel :deep(.si--neutral) { --si-dot: var(--rb-text-muted); }
.ss--panel :deep(.si__value) { font-size: 30px; font-weight: 700; line-height: 1.15; letter-spacing: -0.03em; }
.ss--panel :deep(.si__hint) { color: var(--rb-text-muted); }
/* A zero reads quieter than a figure that holds something. */
.ss--panel :deep(.si--zero .si__value) { color: var(--rb-text-muted); }
.ss--panel :deep(.si--zero .si__label)::before { opacity: 0.45; }
.ss--panel :deep(.si--pressed) { border-color: rgba(var(--rb-primary-rgb), .55); box-shadow: inset 0 -3px 0 var(--rb-primary); }

@media (max-width: 1100px) {
  .ss { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
