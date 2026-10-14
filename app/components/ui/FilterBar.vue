<template>
  <!--
    The filters above a list: search first, then the filters people use most,
    then "More filters" for the rest. Every active filter shows as a chip that
    removes it, with "Clear all" at the end.
  -->
  <div class="fb">
    <div class="fb__row">
      <div v-if="searchable" class="fb__search">
        <AssetIcon name="search" :size="15" class="fb__search-icon" />
        <input
          :value="search"
          type="search"
          class="fb__search-input"
          :placeholder="searchPlaceholder"
          :aria-label="searchLabel || searchPlaceholder"
          @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        >
      </div>
      <slot />
      <button
        v-if="$slots.more"
        type="button"
        class="ui-btn ui-btn--sm fb__more-btn"
        :class="{ 'fb__more-btn--on': moreOpen }"
        :aria-expanded="moreOpen"
        @click="moreOpen = !moreOpen"
      >
        <AssetIcon name="sliders-horizontal" :size="14" />
        More filters
        <span v-if="moreCount" class="fb__count">{{ moreCount }}</span>
      </button>
    </div>

    <div v-if="$slots.more && moreOpen" class="fb__row fb__row--more">
      <slot name="more" />
    </div>

    <div v-if="chips.length" class="fb__chips" aria-label="Active filters">
      <span v-for="chip in chips" :key="chip.key" class="fb__chip">
        {{ chip.label }}
        <button type="button" :aria-label="`Remove filter ${chip.label}`" @click="emit('remove', chip.key)">
          <AssetIcon name="x" :size="12" />
        </button>
      </span>
      <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" @click="emit('clear')">Clear all</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import AssetIcon from '~/components/common/AssetIcon.vue'

withDefaults(defineProps<{
  search?: string
  searchable?: boolean
  searchPlaceholder?: string
  searchLabel?: string
  /** Every applied filter, so each can be removed on its own. */
  chips?: { key: string; label: string }[]
  /** How many of the folded-away filters are set, shown on the button. */
  moreCount?: number
}>(), {
  search: '',
  searchable: true,
  searchPlaceholder: 'Search',
  searchLabel: undefined,
  chips: () => [],
  moreCount: 0,
})

const emit = defineEmits<{
  'update:search': [value: string]
  remove: [key: string]
  clear: []
}>()

const moreOpen = defineModel<boolean>('moreOpen', { default: false })
</script>

<style scoped>
.fb { display: flex; flex-direction: column; gap: var(--rb-space-3); }
.fb__row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--rb-space-2); }
.fb__row > :slotted(*) { flex: 0 0 auto; }
.fb__search { position: relative; flex: 1 1 260px; min-width: 220px; }
.fb__search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--rb-text-muted); pointer-events: none; }
.fb__search-input {
  width: 100%; height: 36px; padding: 0 12px 0 36px;
  font: inherit; font-size: var(--rb-fs-small); color: var(--rb-text-primary);
  background: var(--rb-surface); border: 1px solid var(--rb-border-strong); border-radius: var(--rb-radius-sm);
}
.fb__search-input:focus { outline: none; border-color: var(--rb-primary); box-shadow: var(--rb-focus-ring); }
.fb__more-btn { height: 36px; }
.fb__more-btn--on { border-color: var(--rb-primary); color: var(--rb-primary-text); }
.fb__count { min-width: 18px; padding: 0 6px; border-radius: 999px; font-size: 11px; font-weight: 800; line-height: 18px; color: #fff; background: var(--rb-primary); text-align: center; }

.fb__chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.fb__chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 4px 3px 10px; border-radius: 999px;
  font-size: var(--rb-fs-caption); font-weight: 600; color: var(--rb-primary-text);
  background: rgba(var(--rb-primary-rgb), .08); border: 1px solid rgba(var(--rb-primary-rgb), .2);
}
.fb__chip button { display: grid; place-items: center; width: 18px; height: 18px; border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; }
.fb__chip button:hover { background: rgba(var(--rb-primary-rgb), .15); }
.fb__chip button:focus-visible { outline: none; box-shadow: var(--rb-focus-ring); }
</style>
