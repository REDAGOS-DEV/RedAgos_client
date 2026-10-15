<template>
  <!-- Keys as keycaps: keys pressed together joined by "+", alternatives by "or". -->
  <span class="combo">
    <template v-for="(combo, i) in combos" :key="i">
      <span v-if="i" class="combo__or">or</span>
      <span class="combo__set">
        <template v-for="(key, j) in combo" :key="key">
          <span v-if="j" class="combo__plus" aria-hidden="true">+</span>
          <kbd class="combo__key">{{ key }}</kbd>
        </template>
      </span>
    </template>
  </span>
</template>

<script setup lang="ts">
import type { ShortcutKeys } from '~/utils/bloodCenterHelp'

defineProps<{ combos: ShortcutKeys[] }>()
</script>

<style scoped>
.combo { display: inline-flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.combo__set { display: inline-flex; align-items: center; gap: 3px; }
.combo__or { font-size: 11.5px; color: var(--rb-text-muted); }
.combo__plus { font-size: 11px; color: var(--rb-text-muted); }
.combo__key {
  display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding: 0 7px;
  border: 1px solid var(--rb-border-strong); border-bottom-width: 2px; border-radius: 6px;
  font-family: var(--rb-font-mono); font-size: 11.5px; font-weight: 700; color: var(--rb-text-primary); background: var(--rb-surface-alt);
}
</style>
