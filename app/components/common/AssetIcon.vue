<template>
  <span
    class="asset-icon"
    :style="{ width: iconSize, height: iconSize }"
    aria-hidden="true"
    v-html="svg"
  />
</template>

<script setup>
import { computed } from 'vue'

import activity from '~/assets/icons/activity.svg?raw'
import arrowRight from '~/assets/icons/arrow-right.svg?raw'
import barChart from '~/assets/icons/bar-chart.svg?raw'
import bell from '~/assets/icons/bell.svg?raw'
import bloodDrop from '~/assets/icons/blood-drop.svg?raw'
import bloodDropSmile from '~/assets/icons/blood-drop-smile.svg?raw'
import bolt from '~/assets/icons/bolt.svg?raw'
import boltFill from '~/assets/icons/bolt-fill.svg?raw'
import box from '~/assets/icons/box.svg?raw'
import calendar from '~/assets/icons/calendar.svg?raw'
import chart from '~/assets/icons/chart.svg?raw'
import chevronLeft from '~/assets/icons/chevron-left.svg?raw'
import chevronRight from '~/assets/icons/chevron-right.svg?raw'
import clipboard from '~/assets/icons/clipboard.svg?raw'
import clock from '~/assets/icons/clock.svg?raw'
import dollarSign from '~/assets/icons/dollar-sign.svg?raw'
import heart from '~/assets/icons/heart.svg?raw'
import heartFill from '~/assets/icons/heart-fill.svg?raw'
import mail from '~/assets/icons/mail.svg?raw'
import mapPin from '~/assets/icons/map-pin.svg?raw'
import mapPinSimple from '~/assets/icons/map-pin-simple.svg?raw'
import phone from '~/assets/icons/phone.svg?raw'
import quote from '~/assets/icons/quote.svg?raw'
import search from '~/assets/icons/search.svg?raw'
import settings from '~/assets/icons/settings.svg?raw'
import shield from '~/assets/icons/shield.svg?raw'
import starFill from '~/assets/icons/star-fill.svg?raw'
import users from '~/assets/icons/users.svg?raw'

const icons = {
  activity,
  'arrow-right': arrowRight,
  'bar-chart': barChart,
  bell,
  'blood-drop': bloodDrop,
  'blood-drop-smile': bloodDropSmile,
  bolt,
  'bolt-fill': boltFill,
  box,
  calendar,
  chart,
  'chevron-left': chevronLeft,
  'chevron-right': chevronRight,
  clipboard,
  clock,
  'dollar-sign': dollarSign,
  heart,
  'heart-fill': heartFill,
  mail,
  'map-pin': mapPin,
  'map-pin-simple': mapPinSimple,
  phone,
  quote,
  search,
  settings,
  shield,
  'star-fill': starFill,
  users,
}

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  size: {
    type: [Number, String],
    default: 16,
  },
})

const svg = computed(() => icons[props.name] || '')
const iconSize = computed(() => (
  typeof props.size === 'number' ? `${props.size}px` : props.size
))
</script>

<style scoped>
.asset-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}

.asset-icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
