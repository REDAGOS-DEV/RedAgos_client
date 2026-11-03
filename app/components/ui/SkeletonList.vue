<template>
  <!-- Rows of a list while they load, inside a card whose heading is already real. -->
  <div class="sk-list" aria-busy="true">
    <div v-for="n in rows" :key="n" class="sk-list__item">
      <span class="sk sk--icon" />
      <div class="sk-list__lines">
        <span class="sk sk--line" :style="{ width: `${WIDTHS[n % WIDTHS.length]}%` }" />
        <span class="sk sk--line" :style="{ width: `${WIDTHS[(n + 3) % WIDTHS.length] - 24}%` }" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  rows: { type: Number, default: 4 },
})

const WIDTHS = [72, 54, 86, 62, 78, 48, 68]
</script>

<style scoped>
.sk-list { display: flex; flex-direction: column; gap: 14px; }
.sk-list__item { display: flex; align-items: center; gap: 12px; }
.sk-list__lines { display: flex; flex: 1; flex-direction: column; gap: 8px; min-width: 0; }
</style>
