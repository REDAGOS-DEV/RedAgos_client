<template>
  <!-- Initials (or a photo), so a list without faces still reads as people.
       A hidden identity shows a lock, never a guess at the name. -->
  <span class="pav" :class="[`pav--${size}`, { 'pav--hidden': hidden }]" aria-hidden="true">
    <AssetIcon v-if="hidden" name="lock" :size="size === 'lg' ? 16 : 13" />
    <img v-else-if="photo" :src="photo" alt="">
    <template v-else>{{ letters }}</template>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import AssetIcon from '~/components/common/AssetIcon.vue'

const props = defineProps({
  name: { type: String, default: '' },
  photo: { type: String, default: '' },
  hidden: { type: Boolean, default: false },
  size: { type: String, default: 'md', validator: (v) => ['md', 'lg'].includes(v) },
})

/** Up to two letters: "Yana dela Cruz" -> "YD". */
const letters = computed(() =>
  String(props.name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
)
</script>

<style scoped>
.pav {
  display: grid; flex-shrink: 0; place-items: center; overflow: hidden;
  width: 34px; height: 34px; border-radius: 50%;
  background: rgba(var(--rb-primary-rgb), 0.1); color: var(--rb-primary-text);
  font-size: 12px; font-weight: 700; letter-spacing: 0.02em; line-height: 1;
}
.pav img { width: 100%; height: 100%; object-fit: cover; }
.pav--lg { width: 46px; height: 46px; font-size: 15px; }
.pav--hidden { background: var(--rb-surface-alt); color: var(--rb-text-muted); border: 1px dashed var(--rb-border-strong); }
</style>
