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
import badgeCheck from '~/assets/icons/badge-check.svg?raw'
import barChart from '~/assets/icons/bar-chart.svg?raw'
import bell from '~/assets/icons/bell.svg?raw'
import bloodDrop from '~/assets/icons/blood-drop.svg?raw'
import bloodDropSmile from '~/assets/icons/blood-drop-smile.svg?raw'
import bolt from '~/assets/icons/bolt.svg?raw'
import boltFill from '~/assets/icons/bolt-fill.svg?raw'
import box from '~/assets/icons/box.svg?raw'
import briefcase from '~/assets/icons/briefcase.svg?raw'
import building2 from '~/assets/icons/building-2.svg?raw'
import calendar from '~/assets/icons/calendar.svg?raw'
import calendarCheck from '~/assets/icons/calendar-check.svg?raw'
import camera from '~/assets/icons/camera.svg?raw'
import chart from '~/assets/icons/chart.svg?raw'
import checkCheck from '~/assets/icons/check-check.svg?raw'
import checkCircle from '~/assets/icons/check-circle.svg?raw'
import check from '~/assets/icons/check.svg?raw'
import chevronLeft from '~/assets/icons/chevron-left.svg?raw'
import chevronRight from '~/assets/icons/chevron-right.svg?raw'
import chevronDown from '~/assets/icons/chevron-down.svg?raw'
import chevronUp from '~/assets/icons/chevron-up.svg?raw'
import circleAlert from '~/assets/icons/circle-alert.svg?raw'
import circleCheck from '~/assets/icons/circle-check-big.svg?raw'
import circlePlus from '~/assets/icons/circle-plus.svg?raw'
import circle from '~/assets/icons/circle.svg?raw'
import circleX from '~/assets/icons/circle-x.svg?raw'
import clipboard from '~/assets/icons/clipboard.svg?raw'
import clipboardCheck from '~/assets/icons/clipboard-check.svg?raw'
import clipboardList from '~/assets/icons/clipboard-list.svg?raw'
import clipboardPlus from '~/assets/icons/clipboard-plus.svg?raw'
import clock from '~/assets/icons/clock.svg?raw'
import cloudUpload from '~/assets/icons/cloud-upload.svg?raw'
import creditCard from '~/assets/icons/credit-card.svg?raw'
import database from '~/assets/icons/database.svg?raw'
import dollarSign from '~/assets/icons/dollar-sign.svg?raw'
import drawerSlide from '~/assets/icons/drawer-slide.svg?raw'
import dropletOff from '~/assets/icons/droplet-off.svg?raw'
import droplets from '~/assets/icons/droplets.svg?raw'
import download from '~/assets/icons/download.svg?raw'
import eye from '~/assets/icons/eye.svg?raw'
import eyeOff from '~/assets/icons/eye-off.svg?raw'
import fileDown from '~/assets/icons/file-down.svg?raw'
import filePlus from '~/assets/icons/file-plus.svg?raw'
import fileText from '~/assets/icons/file-text.svg?raw'
import flag from '~/assets/icons/flag.svg?raw'
import flaskConical from '~/assets/icons/flask-conical.svg?raw'
import heart from '~/assets/icons/heart.svg?raw'
import heartFill from '~/assets/icons/heart-fill.svg?raw'
import helpCircle from '~/assets/icons/help-circle.svg?raw'
import history from '~/assets/icons/history.svg?raw'
import hospital from '~/assets/icons/hospital.svg?raw'
import house from '~/assets/icons/house.svg?raw'
import idCard from '~/assets/icons/id-card.svg?raw'
import inbox from '~/assets/icons/inbox.svg?raw'
import info from '~/assets/icons/info.svg?raw'
import layoutDashboard from '~/assets/icons/layout-dashboard.svg?raw'
import lifeBuoy from '~/assets/icons/life-buoy.svg?raw'
import link from '~/assets/icons/link.svg?raw'
import list from '~/assets/icons/list.svg?raw'
import loader from '~/assets/icons/loader.svg?raw'
import lock from '~/assets/icons/lock.svg?raw'
import logIn from '~/assets/icons/log-in.svg?raw'
import logOut from '~/assets/icons/log-out.svg?raw'
import mail from '~/assets/icons/mail.svg?raw'
import mapPin from '~/assets/icons/map-pin.svg?raw'
import mapPinSimple from '~/assets/icons/map-pin-simple.svg?raw'
import menu from '~/assets/icons/menu.svg?raw'
import monitor from '~/assets/icons/monitor.svg?raw'
import moon from '~/assets/icons/moon.svg?raw'
import moveVertical from '~/assets/icons/move-vertical.svg?raw'
import octagonAlert from '~/assets/icons/octagon-alert.svg?raw'
import Package from '~/assets/icons/package.svg?raw'
import packageCheck from '~/assets/icons/package-check.svg?raw'
import packageSearch from '~/assets/icons/package-search.svg?raw'
import palette from '~/assets/icons/palette.svg?raw'
import pencil from '~/assets/icons/pencil.svg?raw'
import phone from '~/assets/icons/phone.svg?raw'
import plus from '~/assets/icons/plus.svg?raw'
import printer from '~/assets/icons/printer.svg?raw'
import qrCode from '~/assets/icons/qr-code.svg?raw'
import quote from '~/assets/icons/quote.svg?raw'
import receipt from '~/assets/icons/receipt.svg?raw'
import refreshCw from '~/assets/icons/refresh-cw.svg?raw'
import route from '~/assets/icons/route.svg?raw'
import scanLine from '~/assets/icons/scan-line.svg?raw'
import search from '~/assets/icons/search.svg?raw'
import searchX from '~/assets/icons/search-x.svg?raw'
import send from '~/assets/icons/send.svg?raw'
import settings from '~/assets/icons/settings.svg?raw'
import share from '~/assets/icons/share.svg?raw'
import shield from '~/assets/icons/shield.svg?raw'
import shieldCheck from '~/assets/icons/shield-check.svg?raw'
import shieldPlus from '~/assets/icons/shield-plus.svg?raw'
import slidersHorizontal from '~/assets/icons/sliders-horizontal.svg?raw'
import smartphone from '~/assets/icons/smartphone.svg?raw'
import smile from '~/assets/icons/smile.svg?raw'
import triangleAlert from '~/assets/icons/triangle-alert.svg?raw'
import starFill from '~/assets/icons/star-fill.svg?raw'
import stethoscope from '~/assets/icons/stethoscope.svg?raw'
import sun from '~/assets/icons/sun.svg?raw'
import trash from '~/assets/icons/trash-2.svg?raw'
import trendingDown from '~/assets/icons/trending-down.svg?raw'
import trendingUp from '~/assets/icons/trending-up.svg?raw'
import truck from '~/assets/icons/truck.svg?raw'
import unlock from '~/assets/icons/unlock.svg?raw'
import upload from '~/assets/icons/upload.svg?raw'
import user from '~/assets/icons/user.svg?raw'
import users from '~/assets/icons/users.svg?raw'
import userCheck from '~/assets/icons/user-check.svg?raw'
import userCircle from '~/assets/icons/user-circle.svg?raw'
import userX from '~/assets/icons/user-x.svg?raw'
import warehouse from '~/assets/icons/warehouse.svg?raw'
import x from '~/assets/icons/x.svg?raw'
const icons = {
  activity,
  alert,
  archive,
  'arrow-left' : arrowLeft,
  'arrow-right': arrowRight,
  'arrow-up-right': arrowUpRight,
  'badge-check': badgeCheck,
  'bar-chart': barChart,
  bell,
  'blood-drop': bloodDrop,
  'blood-drop-smile': bloodDropSmile,
  bolt,
  'bolt-fill': boltFill,
  box,
  briefcase,
  'building-2': building2,
  calendar,
  'calendar-check': calendarCheck,
  camera,
  chart,
  'check-circle': checkCircle,
  'check-check': checkCheck,
  check,
  'chevron-left': chevronLeft,
  'chevron-right': chevronRight,
  'chevron-down' :chevronDown,
  'chevron-up': chevronUp,
  'circle-alert': circleAlert,
  'circle-plus': circlePlus,
  'circle-check-big': circleCheck,
  'circle-x': circleX,
  circle,
  clipboard,
  'clipboard-plus': clipboardPlus,
  'clipboard-check': clipboardCheck,
  'clipboard-list': clipboardList,
  clock,
  'cloud-upload': cloudUpload,
  'credit-card': creditCard,
  database,
  'dollar-sign': dollarSign,
  'drawer-slide': drawerSlide,
  'droplet-off': dropletOff,
  droplets,
  download,
  eye,
  'eye-off': eyeOff,
  'file-down': fileDown,
  'file-plus': filePlus,
  'file-text': fileText,
  flag,
  'flask-conical': flaskConical,
  heart,
  'heart-fill': heartFill,
  'help-circle': helpCircle,
  history,
  hospital,
  house,
  'id-card': idCard,
  inbox,
  info,
  lock,
  'layout-dashboard': layoutDashboard,
  'life-buoy': lifeBuoy,
  loader,
  link,
  list,
  'log-in': logIn,
  'log-out': logOut,
  mail,
  'map-pin': mapPin,
  'map-pin-simple': mapPinSimple,
  menu,
  monitor,
  moon,
  'move-vertical': moveVertical,
  'octagon-alert': octagonAlert,
  'package': Package,
  'package-check': packageCheck,
  'package-search': packageSearch,
  palette,
  pencil,
  phone,
  plus,
  printer,
  'qr-code': qrCode,
  quote,
  receipt,
  'refresh-cw': refreshCw,
  route,
  'scan-line': scanLine,
  search,
  'search-x': searchX,
  send,
  settings,
  share,
  shield,
  'shield-check': shieldCheck,
  'shield-plus': shieldPlus,
  'sliders-horizontal': slidersHorizontal,
  smartphone,
  smile,
  stethoscope,
  'star-fill': starFill,
  'triangle-alert': triangleAlert,
  'trending-down': trendingDown,
  'trending-up': trendingUp,
  truck,
  sun,
  'trash-2': trash,
  unlock,
  upload,
  user,
  users,
  'user-check' : userCheck,
  'user-circle': userCircle,
  warehouse,
  'user-x' : userX,
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
