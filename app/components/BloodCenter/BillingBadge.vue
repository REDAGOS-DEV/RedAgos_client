<template>
  <span class="badge" :class="`badge--${tone}`"><slot /></span>
</template>

<script setup lang="ts">
/**
 * The status pill every billing page uses: a statement's, a receipt's, a payment's.
 *
 * Colour is never the only signal; the label inside always names the state.
 */
withDefaults(defineProps<{
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'purple'
}>(), { tone: 'muted' })
</script>

<style scoped>
.badge {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px;
  font-size: 11.5px; font-weight: 700; white-space: nowrap; line-height: 1.4;
}
.badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
.badge--success { color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), .12); }
.badge--warning { color: var(--rb-warning-text); background: rgba(var(--rb-warning-rgb), .14); }
.badge--danger { color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), .1); }
.badge--info { color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .1); }
.badge--purple { color: var(--rb-purple-text); background: rgba(var(--rb-purple-rgb), .12); }
.badge--muted { color: var(--rb-text-secondary); background: var(--rb-surface-alt); border: 1px solid var(--rb-border); }
</style>
