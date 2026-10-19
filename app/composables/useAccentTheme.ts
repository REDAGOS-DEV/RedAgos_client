import { ACCENT_THEMES, DEFAULT_ACCENT, accentTheme } from '~/utils/accentThemes'

/**
 * The chosen colour theme (Settings → Appearance in the donor or blood center
 * portal).
 *
 * One choice for every portal on this device: picking a colour in either
 * Settings page recolours both, so their sidebars and buttons always match.
 * Applied as CSS variables on <html>, so everything that reads --rb-primary
 * and friends follows it. Saved in localStorage; there is no server field for
 * it. Each themed portal's layout applies it on mount and removes it on the
 * way out, so portals without the picker keep the standard RedAgos blue.
 */
const STORAGE_KEY = 'redagos:portal-accent'

// Each portal used to save its own; the first one found is carried over.
const LEGACY_KEYS = ['redagos:donor-accent', 'redagos:blood-center-accent']

const VARS = [
  '--rb-primary',
  '--rb-primary-hover',
  '--rb-primary-rgb',
  '--accent-text-light',
  '--accent-text-dark',
  '--rb-grad-from',
  '--rb-grad-to',
] as const

export function useAccentTheme() {
  const current = useState<string>('portal-accent', () => DEFAULT_ACCENT)

  function apply(key: string) {
    if (typeof document === 'undefined') return
    const t = accentTheme(key)
    const root = document.documentElement.style
    root.setProperty('--rb-primary', t.primary)
    root.setProperty('--rb-primary-hover', t.primaryHover)
    root.setProperty('--rb-primary-rgb', t.primaryRgb)
    root.setProperty('--accent-text-light', t.primary)
    root.setProperty('--accent-text-dark', t.textDark)
    root.setProperty('--rb-grad-from', t.gradFrom)
    root.setProperty('--rb-grad-to', t.gradTo)
    document.documentElement.dataset.accent = t.key
  }

  /** Read the saved choice and apply it. Client only. */
  function init() {
    let key = DEFAULT_ACCENT
    try {
      key = localStorage.getItem(STORAGE_KEY)
        || LEGACY_KEYS.map(k => localStorage.getItem(k)).find(Boolean)
        || DEFAULT_ACCENT
    } catch {
      // Storage blocked: the default theme.
    }
    current.value = accentTheme(key).key
    apply(current.value)
  }

  function set(key: string) {
    current.value = accentTheme(key).key
    apply(current.value)
    try {
      localStorage.setItem(STORAGE_KEY, current.value)
    } catch {
      // Storage blocked: the theme still applies for this visit.
    }
  }

  /** Remove the theme's variables (leaving the portal). */
  function clear() {
    if (typeof document === 'undefined') return
    const root = document.documentElement.style
    for (const v of VARS) root.removeProperty(v)
    delete document.documentElement.dataset.accent
  }

  return { current, themes: ACCENT_THEMES, init, set, clear }
}
