<template>
  <!-- A chart while it loads, inside a card whose heading is already real. -->
  <div class="sk-chart" aria-busy="true">
    <span v-for="(h, i) in BARS" :key="i" class="sk" :style="{ height: `${h}%` }" />
  </div>
</template>

<script setup>
const BARS = [38, 62, 46, 74, 54, 88, 60, 42, 70, 52, 80, 58]
</script>

<style scoped>
.sk-chart { display: flex; align-items: flex-end; gap: 10px; height: 200px; }
.sk-chart .sk { flex: 1; border-radius: 6px 6px 2px 2px; }
</style>
