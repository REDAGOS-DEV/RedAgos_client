<template>
  <span ref="el">{{ displayValue }}</span>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  value: {
    type: Number,
    required: true,
  },
})

const displayValue = ref(props.value)
let rafId = null

watch(
  () => props.value,
  (newVal) => {
    const start = displayValue.value
    const duration = 400 // ms
    const startTime = performance.now()

    if (rafId) cancelAnimationFrame(rafId)

    function update(time) {
      const progress = Math.min((time - startTime) / duration, 1)
      // Ease out cubic for smooth feel
      const eased = 1 - Math.pow(1 - progress, 3)
      displayValue.value = Math.round(start + (newVal - start) * eased)
      if (progress < 1) {
        rafId = requestAnimationFrame(update)
      } else {
        displayValue.value = newVal
      }
    }
    rafId = requestAnimationFrame(update)
  },
  { immediate: true }
)
</script>