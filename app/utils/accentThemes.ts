/**
 * Colour themes a donor can pick in Settings → Appearance.
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

export function accentTheme(key: string | null | undefined): AccentTheme {
  return ACCENT_THEMES.find(t => t.key === key) ?? ACCENT_THEMES[0]!
}
