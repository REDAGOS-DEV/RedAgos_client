<template>
  <!-- A status as a word in its colour, with a dot so it never rides on colour alone. -->
  <span class="sb" :class="`sb--${tone}`">
    <span v-if="dot" class="sb__dot" aria-hidden="true" />
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral'
  dot?: boolean
}>(), { tone: 'neutral', dot: true })
</script>

<style scoped>
.sb {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: var(--rb-radius-pill);
  font-size: var(--rb-fs-caption); font-weight: 700; line-height: 1.3; white-space: nowrap;
}
.sb__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.sb--success { color: var(--rb-success-text); background: rgba(var(--rb-success-rgb), .1); }
.sb--warning { color: var(--rb-warning-text); background: rgba(var(--rb-warning-rgb), .14); }
.sb--danger { color: var(--rb-accent-text); background: rgba(var(--rb-accent-rgb), .09); }
.sb--info { color: var(--rb-primary-text); background: rgba(var(--rb-primary-rgb), .1); }
.sb--purple { color: var(--rb-purple-text); background: rgba(var(--rb-purple-rgb), .1); }
.sb--neutral { color: var(--rb-text-secondary); background: var(--rb-surface-alt); border: 1px solid var(--rb-border); }
</style>
