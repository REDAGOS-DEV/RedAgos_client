<template>
  <!-- The donors page's pager: where the page sits, and a step either way. -->
  <footer v-if="total" class="pager">
    <span class="pager__info">Showing {{ from || 0 }}–{{ to || 0 }} of {{ total }}</span>
    <div class="pager__btns">
      <button
        type="button"
        class="pager__btn"
        :disabled="page <= 1 || busy"
        aria-label="Previous page"
        @click="$emit('go', page - 1)"
      >
        <AssetIcon name="chevron-left" :size="15" />
      </button>
      <span class="pager__page">Page {{ page }} of {{ lastPage }}</span>
      <button
        type="button"
        class="pager__btn"
        :disabled="page >= lastPage || busy"
        aria-label="Next page"
        @click="$emit('go', page + 1)"
      >
        <AssetIcon name="chevron-right" :size="15" />
      </button>
    </div>
  </footer>
</template>

<script setup lang="ts">
/**
 * The pager under a list, as the blood centre's Donor Management draws it
 * (project owner, 2026-10-30). The page is the caller's: it says where the
 * list stands and is told which page to go to.
 */
import AssetIcon from '~/components/common/AssetIcon.vue'

defineProps<{
  page: number
  lastPage: number
  from: number
  to: number
  total: number
  busy?: boolean
}>()

defineEmits<{ go: [page: number] }>()
</script>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--rb-border);
  font-size: 12.5px;
  color: var(--rb-text-secondary);
}

.pager__btns { display: flex; align-items: center; gap: 8px; }

.pager__btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--rb-border-strong);
  border-radius: 8px;
  background: var(--rb-surface);
  color: var(--rb-text-primary);
  cursor: pointer;
}

.pager__btn:hover:not(:disabled) { background: var(--rb-surface-hover); }
.pager__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pager__btn:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
.pager__page { font-variant-numeric: tabular-nums; }
</style>
