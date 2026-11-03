/**
 * Colour themes a user can pick in Settings → Appearance (donor and blood
 * center portals).
 *
 * Every theme is from the blue / blue-green family (the team's "shades of
 * blue green" chart), so RedAgos still reads as RedAgos. The gradient uses
 * the chart colours as they are; `primary` is the chart colour darkened just
 * until white text on it passes 4.5:1, so a theme stays as close to the
 * chart as accessibility allows. `primary` is the
 * button and link colour, chosen so white text on it passes WCAG AA (4.5:1 or
 * more), and `textDark` is its lighter twin for text on dark-mode cards
 * (also 4.5:1 or more on #1E293B). `headerText` says which text colour stays
 * readable on the gradient: 'dark' themes keep dark text; 'light' themes are
 * deep enough that the dashboard header puts white text on their dark end.
 *
 * The contrast numbers were computed when these were chosen; re-check them if
 * a colour changes.
 */

export interface AccentTheme {
  key: string
  name: string
  gradFrom: string
  gradTo: string
  primary: string
  primaryHover: string
  /** "r, g, b" of `primary`, for rgba(var(--rb-primary-rgb), a). */
  primaryRgb: string
  textDark: string
  headerText: 'dark' | 'light'
}

export const DEFAULT_ACCENT = 'blue'

export const ACCENT_THEMES: AccentTheme[] = [
  {
    key: 'blue',
    name: 'Classic Blue',
    gradFrom: '#E5EFFC',
    gradTo: '#ADCCEF',
    primary: '#1565C0',
    primaryHover: '#11539D',
    primaryRgb: '21, 101, 192',
    textDark: '#64B5F6',
    headerText: 'dark',
  },
  {
    key: 'spanish',
    name: 'Spanish Blue',
    gradFrom: '#87CEFA',
    gradTo: '#4B9CD3',
    primary: '#0070BB',
    primaryHover: '#005C99',
    primaryRgb: '0, 112, 187',
    textDark: '#0098FD',
    headerText: 'dark',
  },
  {
    key: 'sea',
    name: 'Sea Blue',
    gradFrom: '#AFEEEE',
    gradTo: '#87CEEB',
    primary: '#006994',
    primaryHover: '#005679',
    primaryRgb: '0, 105, 148',
    textDark: '#009FE1',
    headerText: 'dark',
  },
  {
    key: 'bondi',
    name: 'Bondi Blue',
    gradFrom: '#ADD8E6',
    gradTo: '#0095B6',
    primary: '#007C97',
    primaryHover: '#00667C',
    primaryRgb: '0, 124, 151',
    textDark: '#00A2C5',
    headerText: 'dark',
  },
  {
    key: 'bluegreen',
    name: 'Blue Green',
    gradFrom: '#96DED1',
    gradTo: '#0D98BA',
    primary: '#0B7D99',
    primaryHover: '#09677D',
    primaryRgb: '11, 125, 153',
    textDark: '#0EA4C8',
    headerText: 'dark',
  },
  {
    key: 'teal',
    name: 'Teal',
    gradFrom: '#8FE2E1',
    gradTo: '#00CED1',
    primary: '#008080',
    primaryHover: '#006969',
    primaryRgb: '0, 128, 128',
    textDark: '#00A9A9',
    headerText: 'dark',
  },
  {
    key: 'tiffany',
    name: 'Tiffany',
    gradFrom: '#AFEEEE',
    gradTo: '#0ABAB5',
    primary: '#07807C',
    primaryHover: '#066966',
    primaryRgb: '7, 128, 124',
    textDark: '#0ABAB5',
    headerText: 'dark',
  },
  {
    key: 'cadet',
    name: 'Cadet Blue',
    gradFrom: '#C4D8E2',
    gradTo: '#5F9EA0',
    primary: '#4A7B7D',
    primaryHover: '#3D6567',
    primaryRgb: '74, 123, 125',
    textDark: '#62A0A2',
    headerText: 'dark',
  },
]

/** A custom colour's key: `custom:#RRGGBB`. */
export const CUSTOM_PREFIX = 'custom:'

export function accentTheme(key: string | null | undefined): AccentTheme {
  if (key?.startsWith(CUSTOM_PREFIX)) {
    const custom = customAccentTheme(key.slice(CUSTOM_PREFIX.length))
    if (custom) return custom
  }
  return ACCENT_THEMES.find(t => t.key === key)
    ?? PICKER_THEMES.find(t => t.key === key)
    ?? ACCENT_THEMES[0]!
}

// ── Custom colours ──
//
// Any colour the donor picks, turned into a full theme the way the listed
// ones were made by hand: `primary` is the pick darkened just until white text
// on it passes 4.5:1, `textDark` the pick lightened until it passes 4.5:1 on
// the darkest card colour a portal uses in dark mode, and the gradient two
// light tints of it.

type Rgb = [number, number, number]
type Hsl = [number, number, number]

/** "#RRGGBB" (or "RRGGBB") → [r, g, b], or null. */
export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = Number.parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

function toHsl([r, g, b]: Rgb): Hsl {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return [h / 6, s, l]
}

function fromHsl([h, s, l]: Hsl): Rgb {
  if (s === 0) return [l * 255, l * 255, l * 255]
  const hue = (p: number, q: number, t: number) => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255]
}

/** The pick at a new lightness, same hue and saturation. */
function withLightness(rgb: Rgb, l: number): Rgb {
  const [h, s] = toHsl(rgb)
  return fromHsl([h, s, Math.min(1, Math.max(0, l))])
}

/** Mix toward white: amount 0 = the colour, 1 = white. */
function tint([r, g, b]: Rgb, amount: number): Rgb {
  return [r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount]
}

const WHITE: Rgb = [255, 255, 255]
// The darkest card a themed portal puts accent text on in dark mode
// (#1E293B, the slate surface); the donor's lighter slate passes with it.
const DARK_CARD: Rgb = [30, 41, 59]
const MIN_CONTRAST = 4.5

/** A full theme from any colour, or null if it isn't one. */
export function customAccentTheme(hex: string): AccentTheme | null {
  const pick = parseHex(hex)
  if (!pick) return null
  const rounded = (rgb: Rgb): Rgb => rgb.map(Math.round) as Rgb

  // Buttons: darken until white text on them passes.
  let l = toHsl(pick)[2]
  let primary = rounded(pick)
  while (contrast(primary, WHITE) < MIN_CONTRAST && l > 0) {
    l -= 0.01
    primary = rounded(withLightness(pick, l))
  }
  const primaryHover = rounded(withLightness(primary, toHsl(primary)[2] - 0.08))

  // Text on dark cards: lighten until it passes.
  let ld = toHsl(pick)[2]
  let textDark = rounded(pick)
  while (contrast(textDark, DARK_CARD) < MIN_CONTRAST && ld < 1) {
    ld += 0.01
    textDark = rounded(withLightness(pick, ld))
  }

  return {
    key: `${CUSTOM_PREFIX}${toHex(rounded(pick))}`,
    name: 'Custom',
    gradFrom: toHex(rounded(tint(pick, 0.86))),
    gradTo: toHex(rounded(tint(pick, 0.55))),
    primary: toHex(primary),
    primaryHover: toHex(primaryHover),
    primaryRgb: primary.join(', '),
    textDark: toHex(textDark),
    headerText: 'dark',
  }
}

// ── Surfaces tinted by the theme ──
//
// The portal's chrome and canvas take the theme's hue, the way a browser
// theme tints its toolbar: very light in light mode, a deep low-saturation
// slate in dark mode. Saturation is capped, so a grey, black or white pick
// gives neutral surfaces rather than a hint of red (hue 0). Text colours stay
// as they are: these surfaces sit at the far light and dark ends, where the
// portal's text keeps its contrast.

export interface AccentSurfaces {
  light: { chrome: string, canvas: string }
  dark: {
    base: string
    page: string
    surface: string
    surfaceAlt: string
    hover: string
    chrome: string
    border: string
    borderHover: string
    inset: string
  }
}

/** Chrome's dark greys: its tab strip, toolbar, menus and dividers. */
export const CHROME_DARK = {
  base: '#1A1B1E',
  page: '#202124',
  surface: '#292A2D',
  surfaceAlt: '#252629',
  hover: '#3C3D41',
  chrome: '#2D2E31',
  border: '#3C4043',
  borderHover: '#5F6368',
  inset: '#1F2023',
} as const

// The text each set of surfaces has to carry: the portal's secondary grey on
// the light ones. The dark ones are Chrome's own greys (CHROME_DARK).
const LIGHT_TEXT_MUTED: Rgb = [100, 116, 139] // #64748B

/** The tinted surfaces for a theme, from its button colour's hue. */
export function accentSurfaces(theme: AccentTheme): AccentSurfaces {
  const [h, s] = toHsl(parseHex(theme.primary) ?? [21, 101, 192])
  // Cap per surface; a near-grey pick stays grey.
  const sat = (cap: number) => (s < 0.08 ? 0 : Math.min(s, cap))
  // Rounded to whole channels, as the hex will be, so the checks below see
  // exactly the colour that ships.
  const at = (cap: number, l: number) =>
    fromHsl([h, sat(cap), Math.min(1, Math.max(0, l))]).map(Math.round) as Rgb

  // Light: the chrome (header, sidebar, bottom bar) carries the grey labels,
  // so it is lifted until they pass; hues differ in brightness at the same
  // lightness. The canvas sits a step darker, as the neutral #F5F6F8 did, so
  // the white cards still stand off it.
  let up = 0
  while (up < 0.025 && contrast(LIGHT_TEXT_MUTED, at(0.5, 0.975 + up)) < MIN_CONTRAST) up += 0.0025

  // Dark: Chrome's own dark greys (project owner, 2026-10-31), the same for
  // every theme, so the portal sits with the browser's toolbar; the theme
  // colours only the buttons, links and highlights. Was a slate tinted by
  // the theme's hue.
  const hex = (rgb: Rgb) => toHex(rgb.map(Math.round) as Rgb)
  const dark: AccentSurfaces['dark'] = { ...CHROME_DARK }

  return {
    light: {
      chrome: hex(at(0.5, 0.975 + up)),
      canvas: hex(at(0.25, 0.955)),
    },
    dark,
  }
}

/** "r, g, b" of a hex colour, for rgba(var(--x), a). */
export function rgbTriple(hex: string): string {
  return (parseHex(hex) ?? [0, 0, 0]).join(', ')
}

// ── The donor's colour picker ──
//
// Twelve calm presets, blue first. None is red or pink: red is the brand's
// alert and blood-type colour, and a red button would read as one. Three
// come from the list above, so a donor who chose them keeps the same theme;
// the rest are made from a seed like a custom pick, with their own key.

const PICKER_SEEDS: Array<[key: string, name: string, seed: string]> = [
  ['green', 'Green', '#2E7D32'],
  ['olive', 'Olive', '#6B7F2A'],
  ['amber', 'Amber', '#B26A00'],
  ['brown', 'Brown', '#795548'],
  ['indigo', 'Indigo', '#3949AB'],
  ['violet', 'Violet', '#5E35B1'],
  ['purple', 'Purple', '#7B1FA2'],
  ['slate', 'Slate', '#475569'],
  ['gray', 'Gray', '#616161'],
]

const seeded = PICKER_SEEDS.map(([key, name, seed]) => ({ ...customAccentTheme(seed)!, key, name }))
const listed = (key: string) => ACCENT_THEMES.find(t => t.key === key)!

export const PICKER_THEMES: AccentTheme[] = [
  listed('blue'),
  listed('sea'),
  listed('teal'),
  ...seeded,
]

/**
 * Whether a colour is red or pink (hue near 0 or 330-360), clear enough to
 * be read as one. The picker warns, it doesn't refuse.
 */
export function isReddish(hex: string): boolean {
  const rgb = parseHex(hex)
  if (!rgb) return false
  const [h, s, l] = toHsl(rgb)
  const deg = h * 360
  return s >= 0.25 && l > 0.12 && l < 0.92 && (deg < 15 || deg >= 320)
}
