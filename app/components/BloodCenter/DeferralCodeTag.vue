<template>
  <span class="dct" :class="{ 'dct--open': shown }">
    <span v-if="code" class="dct__code">{{ code }}</span>
    <span v-else-if="reason || other" class="dct__code dct__code--other" title="No code: the reason was typed">Other</span>
    <span v-else class="dct__none">—</span>

    <template v-if="reason">
      <button
        type="button"
        class="dct__toggle"
        :aria-expanded="shown"
        :aria-label="shown ? `Hide the reason for ${code || 'this deferral'}` : `Show the reason for ${code || 'this deferral'}`"
        @click.stop="shown = !shown"
      >
        <AssetIcon :name="shown ? 'eye-off' : 'eye'" :size="13" />
        <span v-if="!compact">{{ shown ? 'Hide' : 'Reason' }}</span>
      </button>
      <span v-if="shown" class="dct__reason">{{ reason }}</span>
    </template>
  </span>
</template>

<script setup>
/**
 * A deferral as the record shows it: the code, and what it stands for only
 * when asked (project owner, 2026-10-24).
 *
 * The server sends the reason only to staff allowed the clinical record; even
 * then it stays folded until clicked, because the screen may be facing the
 * donor. A deferral with no code (recorded under Other, or before codes
 * existed) reads "Other", its typed reason folded the same way.
 */

import AssetIcon from '~/components/common/AssetIcon.vue'

defineProps({
  code: { type: String, default: null },
  reason: { type: String, default: null },
  /** Recorded under Other, for a viewer the server sent no reason. */
  other: { type: Boolean, default: false },
  /** The toggle as an icon alone, for a narrow table cell. */
  compact: { type: Boolean, default: false },
})

const shown = ref(false)
</script>

<style scoped>
.dct { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; max-width: 100%; }

.dct__code {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--rb-surface-alt);
  border: 1px solid var(--rb-border);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  color: var(--rb-text-primary);
  white-space: nowrap;
}
.dct__code--other { font-weight: 600; letter-spacing: normal; color: var(--rb-text-secondary); }
.dct__none { color: var(--rb-text-secondary); }

.dct__toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--rb-text-secondary);
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}
.dct__toggle:hover { color: var(--rb-text-primary); background: var(--rb-surface-hover); }
.dct__toggle:focus-visible { outline: 2px solid var(--rb-primary-text); outline-offset: 1px; }

.dct__reason { flex-basis: 100%; font-size: 12.5px; line-height: 1.45; color: var(--rb-text-primary); overflow-wrap: anywhere; }
</style>
