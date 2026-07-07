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
import alert from '~/assets/icons/alert.svg?raw'
import archive from '~/assets/icons/archive.svg?raw'
import arrowLeft from '~/assets/icons/arrow-left.svg?raw'
import arrowRight from '~/assets/icons/arrow-right.svg?raw'
import arrowUpRight from '~/assets/icons/arrow-up-right.svg?raw'
import barChart from '~/assets/icons/bar-chart.svg?raw'
import bell from '~/assets/icons/bell.svg?raw'
import bloodDrop from '~/assets/icons/blood-drop.svg?raw'
import bloodDropSmile from '~/assets/icons/blood-drop-smile.svg?raw'
import bolt from '~/assets/icons/bolt.svg?raw'
import boltFill from '~/assets/icons/bolt-fill.svg?raw'
import box from '~/assets/icons/box.svg?raw'
import calendar from '~/assets/icons/calendar.svg?raw'
import chart from '~/assets/icons/chart.svg?raw'
import check from '~/assets/icons/check.svg?raw'
import chevronLeft from '~/assets/icons/chevron-left.svg?raw'
import chevronRight from '~/assets/icons/chevron-right.svg?raw'
import chevronDown from '~/assets/icons/chevron-down.svg?raw'
import clipboard from '~/assets/icons/clipboard.svg?raw'
import clipboardCheck from '~/assets/icons/clipboard-check.svg?raw'
import clipboardPlus from '~/assets/icons/clipboard-plus.svg?raw'
import clock from '~/assets/icons/clock.svg?raw'
import dollarSign from '~/assets/icons/dollar-sign.svg?raw'
import download from '~/assets/icons/download.svg?raw'
import eye from '~/assets/icons/eye.svg?raw'
import eyeOff from '~/assets/icons/eye-off.svg?raw'
import filePlus from '~/assets/icons/file-plus.svg?raw'
import heart from '~/assets/icons/heart.svg?raw'
import heartFill from '~/assets/icons/heart-fill.svg?raw'
import helpCircle from '~/assets/icons/help-circle.svg?raw'
import history from '~/assets/icons/history.svg?raw'
import hospital from '~/assets/icons/hospital.svg?raw'
import house from '~/assets/icons/house.svg?raw'
import idCard from '~/assets/icons/id-card.svg?raw'
import info from '~/assets/icons/info.svg?raw'
import lock from '~/assets/icons/lock.svg?raw'
import logIn from '~/assets/icons/log-in.svg?raw'
import logOut from '~/assets/icons/log-out.svg?raw'
import mail from '~/assets/icons/mail.svg?raw'
import mapPin from '~/assets/icons/map-pin.svg?raw'
import mapPinSimple from '~/assets/icons/map-pin-simple.svg?raw'
import menu from '~/assets/icons/menu.svg?raw'
import phone from '~/assets/icons/phone.svg?raw'
import qrCode from '~/assets/icons/qr-code.svg?raw'
import quote from '~/assets/icons/quote.svg?raw'
import receipt from '~/assets/icons/receipt.svg?raw'
import search from '~/assets/icons/search.svg?raw'
import settings from '~/assets/icons/settings.svg?raw'
import share from '~/assets/icons/share.svg?raw'
import shield from '~/assets/icons/shield.svg?raw'
import shieldCheck from '~/assets/icons/shield-check.svg?raw'
import shieldPlus from '~/assets/icons/shield-plus.svg?raw'
import starFill from '~/assets/icons/star-fill.svg?raw'
import trash from '~/assets/icons/trash-2.svg?raw'
import truck from '~/assets/icons/truck.svg?raw'
import users from '~/assets/icons/users.svg?raw'
import userCircle from '~/assets/icons/user-circle.svg?raw'
import x from '~/assets/icons/x.svg?raw'
const icons = {
  activity,
  alert,
  archive,
  'arrow-left' : arrowLeft,
  'arrow-right': arrowRight,
  'arrow-up-right': arrowUpRight,
  'bar-chart': barChart,
  bell,
  'blood-drop': bloodDrop,
  'blood-drop-smile': bloodDropSmile,
  bolt,
  'bolt-fill': boltFill,
  box,
  calendar,
  chart,
  check,
  'chevron-left': chevronLeft,
  'chevron-right': chevronRight,
  'chevron-down' :chevronDown,
  clipboard,
  'clipboard-plus': clipboardPlus,
  'clipboard-check': clipboardCheck,
  clock,
  'dollar-sign': dollarSign,
  download,
  eye,
  'eye-off': eyeOff,
  'file-plus': filePlus,
  heart,
  'heart-fill': heartFill,
  'help-circle': helpCircle,
  history,
  hospital,
  house,
  idCard,
  info,
  lock,
  'log-in': logIn,
  'log-out': logOut,
  mail,
  'map-pin': mapPin,
  'map-pin-simple': mapPinSimple,
  menu,
  phone,
  'qr-code': qrCode,
  quote,
  receipt,
  search,
  settings,
  share,
  shield,
  'shield-check': shieldCheck,
  'shield-plus': shieldPlus,
  'star-fill': starFill,
  truck,
  'trash-2': trash,
  users,
  'user-circle': userCircle,
  x
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
