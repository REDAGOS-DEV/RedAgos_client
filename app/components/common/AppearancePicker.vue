<template>
  <!--
    The portals' appearance picker, laid out like the browser's own Customize
    panel: a mode, then a colour, any colour. Shared by the donor and blood
    centre Settings, and saved on this device (useDarkMode, useAccentTheme), so
    one choice shows in every portal.
  -->
  <div class="ap">
    <p class="ap__label">Mode</p>
    <div class="modes" role="radiogroup" aria-label="Mode">
      <button
        v-for="m in MODES"
        :key="m.value"
        type="button"
        role="radio"
        class="mode"
        :class="{ 'mode--on': themeMode === m.value }"
        :aria-checked="themeMode === m.value"
        @click="setThemeMode(m.value)"
      >
        <span class="mode__art" :class="`mode__art--${m.value}`" aria-hidden="true">
          <span class="mode__bar" />
          <span class="mode__line" />
          <span class="mode__line mode__line--short" />
          <span class="mode__btn" />
        </span>
        <span class="mode__label">
          <AssetIcon :name="m.icon" :size="14" />
          {{ m.label }}
        </span>
      </button>
    </div>

    <p class="ap__label">
      Color
      <span class="ap__current">{{ hoveredColour || currentColourName }}</span>
    </p>
    <div class="swatches" role="radiogroup" aria-label="Colour theme">
      <button
        v-for="t in pickerSwatches"
        :key="t.key"
        type="button"
        role="radio"
        class="swatch"
        :class="{ 'swatch--on': accentKey === t.key }"
        :aria-checked="accentKey === t.key"
        :title="t.name"
        @click="setAccent(t.key)"
        @mouseenter="hoveredColour = t.name"
        @mouseleave="hoveredColour = ''"
      >
        <span class="swatch__circle" :style="{ background: t.background, '--ring': t.primary }">
          <span v-if="accentKey === t.key" class="swatch__check">
            <AssetIcon name="check" :size="12" />
          </span>
        </span>
        <span class="sr-only">{{ t.name }}</span>
      </button>

      <!-- Any colour: the theme is made from it (utils/accentThemes.ts). -->
      <label
        class="swatch swatch--custom"
        :class="{ 'swatch--on': isCustom }"
        title="Custom colour"
        @mouseenter="hoveredColour = 'Custom'"
        @mouseleave="hoveredColour = ''"
      >
        <span
          class="swatch__circle"
          :style="isCustom
            ? { background: swatchBackground(customTheme), '--ring': customTheme.primary }
            : { '--ring': 'var(--rb-primary)' }"
        >
          <!-- Eyedropper: a colour of your own, as in the browser's picker. -->
          <AssetIcon v-if="!isCustom" name="pipette" :size="16" class="swatch__plus" />
          <span v-else class="swatch__check">
            <AssetIcon name="check" :size="12" />
          </span>
        </span>
        <span class="sr-only">Custom colour</span>
        <input
          type="color"
          class="swatch__input"
          :value="customInputValue"
          aria-label="Pick a custom colour"
          @input="pickCustom($event.target.value)"
        >
      </label>
    </div>

    <!-- A warning, not a block: red is the portals' alert and blood-type colour. -->
    <p v-if="customIsRed" class="ap__warn" role="status">
      <AssetIcon name="info" :size="13" />
      Red is also used for blood type and alerts, so buttons may be harder to tell apart.
    </p>
  </div>
</template>

<script setup>
import AssetIcon from '~/components/common/AssetIcon.vue'
import { useAccentTheme } from '~/composables/useAccentTheme'
import { useDarkMode } from '~/composables/useDarkMode'
import { CUSTOM_PREFIX, PICKER_THEMES, accentSurfaces, accentTheme, isReddish } from '~/utils/accentThemes'

const { current: accentKey, set: setAccent } = useAccentTheme()
// Light, dark, or as the device is set: the same choice as the account menu.
const { isDark, themeMode, setThemeMode } = useDarkMode()

const MODES = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'Device', icon: 'monitor' },
]

/*
 * Each swatch shows the theme as it will look in the current mode, like the
 * browser's picker: the bar on top, the button colour bottom-left and the
 * page bottom-right. In light mode the bar is drawn in the theme's tint, as
 * the real one is nearly white and every swatch would look the same.
 */
function swatchBackground(t) {
  const surfaces = accentSurfaces(t)
  const top = isDark.value ? surfaces.dark.chrome : t.gradFrom
  const page = isDark.value ? surfaces.dark.page : surfaces.light.canvas
  return `linear-gradient(${top} 0 50%, transparent 50%), linear-gradient(90deg, ${t.primary} 0 50%, ${page} 50% 100%)`
}
const pickerSwatches = computed(() => PICKER_THEMES.map(t => ({ ...t, background: swatchBackground(t) })))

// A custom colour lives in the same saved key, as `custom:#RRGGBB`.
const isCustom = computed(() => String(accentKey.value).startsWith(CUSTOM_PREFIX))
const customTheme = computed(() => accentTheme(accentKey.value))
const currentColourName = computed(() => (isCustom.value ? 'Custom' : accentTheme(accentKey.value).name))
// The picker opens on the colour in use (an <input type=color> wants lowercase #rrggbb).
const customInputValue = computed(() =>
  (isCustom.value ? accentKey.value.slice(CUSTOM_PREFIX.length) : accentTheme(accentKey.value).primary).toLowerCase())

// The name above the grid follows the pointer, then falls back to the pick.
const hoveredColour = ref('')

const customIsRed = computed(() => isCustom.value && isReddish(accentKey.value.slice(CUSTOM_PREFIX.length)))

function pickCustom(hex) {
  if (/^#[0-9a-f]{6}$/i.test(hex)) setAccent(`${CUSTOM_PREFIX}${hex}`)
}
</script>

<style scoped>
.ap__label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 18px 0 10px;
  font-size: var(--rb-fs-small);
  font-weight: 700;
  color: var(--rb-text-primary);
}
.ap__label:first-child { margin-top: 0; }
.ap__current { font-size: var(--rb-fs-caption); font-weight: 600; color: var(--rb-text-secondary); }

/* ── Mode: a tiny window in each; Device is split down the middle ── */
.modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; max-width: 460px; }
.mode {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--rb-border);
  border-radius: 14px;
  background: var(--rb-surface);
  font: inherit;
  cursor: pointer;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.mode:hover { border-color: var(--rb-border-hover, #CBD5E1); }
.mode--on { border-color: var(--rb-primary); box-shadow: 0 0 0 3px rgba(var(--rb-primary-rgb), 0.18); }
.mode:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; }
.mode__art {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
  height: 64px;
  padding: 8px;
  overflow: hidden;
  border-radius: 9px;
  background: #F5F6F8;
}
.mode__art--dark { background: #1D2636; }
.mode__art--system { background: linear-gradient(90deg, #F5F6F8 0 50%, #1D2636 50% 100%); }
.mode__bar { height: 8px; border-radius: 4px; background: #FFFFFF; box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.06); }
.mode__art--dark .mode__bar { background: #333C4D; box-shadow: none; }
.mode__art--system .mode__bar { background: linear-gradient(90deg, #FFFFFF 0 50%, #333C4D 50% 100%); }
.mode__line { width: 70%; height: 5px; border-radius: 3px; background: rgba(15, 23, 42, 0.18); }
.mode__line--short { width: 45%; }
.mode__art--dark .mode__line { background: rgba(238, 241, 245, 0.25); }
.mode__btn { width: 34%; height: 9px; margin-top: auto; border-radius: 999px; background: var(--rb-primary); }
.mode__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: var(--rb-fs-small);
  font-weight: 600;
  color: var(--rb-text-primary);
}
.mode--on .mode__label { color: var(--rb-primary-text); font-weight: 700; }

/* ── Colour swatches ── */
.swatches { display: flex; flex-wrap: wrap; gap: 12px; }
.swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;
}
.swatch:focus-visible { outline: 2px solid var(--rb-primary); outline-offset: 2px; border-radius: 12px; }
.swatch__circle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.1);
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.swatch:hover .swatch__circle { transform: scale(1.06); }
/* The ring sits on the card: white in light mode, the card colour in dark. */
.swatch--on .swatch__circle { box-shadow: 0 0 0 3px var(--rb-surface, #fff), 0 0 0 5px var(--ring); }
.swatch__check {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.55);
  color: #fff;
}

/* ── Custom colour ── */
.swatch--custom { position: relative; }
.swatch--custom .swatch__circle {
  background: conic-gradient(#EF4444, #F59E0B, #EAB308, #22C55E, #06B6D4, #3B82F6, #8B5CF6, #EC4899, #EF4444);
}
.swatch__plus { padding: 3px; border-radius: 50%; background: rgba(255, 255, 255, 0.9); color: #0F172A; }
/* The native picker sits invisibly over the circle, so a click opens it. */
.swatch__input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: 0; padding: 0; }
.swatch--custom:focus-within .swatch__circle { outline: 2px solid var(--rb-primary); outline-offset: 3px; }

.ap__warn {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 14px 0 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: #FFF8E1;
  color: #8A5A00;
  font-size: var(--rb-fs-caption);
  line-height: 1.4;
}
.ap__warn :deep(svg) { flex-shrink: 0; margin-top: 2px; }
html.dark .ap__warn { background: rgba(255, 193, 7, 0.12); color: #FFD54F; }

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 640px) {
  .modes { gap: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .mode,
  .swatch__circle { transition: none; }
}
</style>
