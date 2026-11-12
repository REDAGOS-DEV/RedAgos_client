<template>
  <!-- A list's rows while they load, inside its real table and under its real headings. -->
  <tr v-for="n in rows" :key="n" aria-hidden="true">
    <td v-for="c in columns" :key="c" :class="cellClasses[c - 1]">
      <span class="sk sk--line" :style="{ width: `${WIDTHS[(n * 3 + c) % WIDTHS.length]}%` }" />
    </td>
  </tr>
</template>

<script setup>
defineProps({
  columns: { type: Number, required: true },
  rows: { type: Number, default: 6 },
  // The real columns' classes, in order, so a column the page hides at some
  // width (a container query on its class) hides in the loading rows too.
  cellClasses: { type: Array, default: () => [] },
})

const WIDTHS = [72, 54, 86, 62, 78, 48, 68]
</script>
