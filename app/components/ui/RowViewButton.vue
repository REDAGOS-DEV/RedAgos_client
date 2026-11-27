<template>
  <!--
    A list row's View: the eye that opens everything about the record, so the
    row itself can keep one plain value per column (project owner, 2026-11-27).
    Donor Management's and Staff Accounts' bordered eye.
  -->
  <button type="button" class="row-view" :aria-label="label" title="View details" @click.stop="$emit('view')">
    <AssetIcon name="eye" :size="15" />
  </button>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'

defineProps({
  /** Read by screen readers, e.g. "View INV-1-000003". */
  label: { type: String, required: true },
})

defineEmits(['view'])
</script>

<style scoped>
.row-view {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-secondary);
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.row-view:hover {
  color: var(--rb-primary-text);
  border-color: rgba(var(--rb-primary-rgb), 0.45);
  background: var(--rb-surface-hover);
}
.row-view:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
@media (prefers-reduced-motion: reduce) {
  .row-view { transition: none; }
}
</style>
