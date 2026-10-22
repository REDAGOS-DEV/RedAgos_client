import { describe, expect, it } from 'vitest'
import { PICKER_THEMES, accentSurfaces, accentTheme, contrast, customAccentTheme, isReddish, parseHex } from '../app/utils/accentThemes'

const rgb = (hex: string) => parseHex(hex)!

describe('custom accent colours', () => {
  const picks = ['#FFEB3B', '#00E5FF', '#D32F2F', '#8E24AA', '#1B5E20', '#000000', '#FFFFFF', '#7F7F7F', '#1565C0']

  it.each(picks)('%s: white text on the button passes 4.5:1', (hex) => {
    const t = customAccentTheme(hex)!
    expect(contrast(rgb(t.primary), [255, 255, 255])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(picks)('%s: its dark-mode text passes 4.5:1 on the dark card', (hex) => {
    const t = customAccentTheme(hex)!
    expect(contrast(rgb(t.textDark), [30, 41, 59])).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps a colour that already passes as it is', () => {
    expect(customAccentTheme('#1565C0')!.primary).toBe('#1565C0')
  })

  it('carries the pick in its key and an rgb triple for rgba()', () => {
    const t = customAccentTheme('#1565c0')!
    expect(t.key).toBe('custom:#1565C0')
    expect(t.primaryRgb).toBe('21, 101, 192')
  })

  it('is reached through accentTheme() by its key', () => {
    expect(accentTheme('custom:#8E24AA').name).toBe('Custom')
  })

  it('falls back to the default theme for a broken custom key', () => {
    expect(accentTheme('custom:not-a-colour').key).toBe('blue')
  })
})

describe('surfaces tinted by the theme', () => {
  const picks = ['#FFEB3B', '#00E5FF', '#D32F2F', '#8E24AA', '#1B5E20', '#1565C0', '#FF9800']

  it.each(picks)('%s: text passes on the light chrome, and the canvas stays a step darker', (hex) => {
    const { light } = accentSurfaces(customAccentTheme(hex)!)
    expect(contrast(rgb('#64748B'), rgb(light.chrome))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(rgb('#1E293B'), rgb(light.canvas))).toBeGreaterThanOrEqual(7)
    // White cards must still stand off the canvas.
    expect(contrast(rgb('#FFFFFF'), rgb(light.canvas))).toBeGreaterThan(1.05)
  })

  it.each(picks)('%s: light text passes on every dark surface', (hex) => {
    const { dark } = accentSurfaces(customAccentTheme(hex)!)
    for (const bg of [dark.base, dark.page, dark.surface, dark.chrome, dark.hover]) {
      expect(contrast(rgb('#EEF1F5'), rgb(bg))).toBeGreaterThanOrEqual(7)
      expect(contrast(rgb('#B4BCC9'), rgb(bg))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('gives neutral greys for a grey, black or white pick', () => {
    for (const hex of ['#7F7F7F', '#000000', '#FFFFFF']) {
      const [r, g, b] = rgb(accentSurfaces(customAccentTheme(hex)!).dark.chrome)
      expect(r).toBe(g)
      expect(g).toBe(b)
    }
  })

  it('keeps Classic Blue close to the slate the portal used before', () => {
    const [r, g, b] = rgb(accentSurfaces(accentTheme('blue')).dark.chrome)
    const [r0, g0, b0] = rgb('#333C4D')
    expect(Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0)).toBeLessThan(24)
  })
})

describe('the donor colour picker', () => {
  it('offers twelve presets, Classic Blue first, each with its own key', () => {
    expect(PICKER_THEMES).toHaveLength(12)
    expect(PICKER_THEMES[0]!.key).toBe('blue')
    expect(new Set(PICKER_THEMES.map(t => t.key)).size).toBe(12)
  })

  it.each(PICKER_THEMES.map(t => [t.key, t] as const))('%s resolves by its key and keeps readable buttons', (key, t) => {
    expect(accentTheme(key).key).toBe(key)
    expect(contrast(rgb(t.primary), [255, 255, 255])).toBeGreaterThanOrEqual(4.5)
  })

  it('has no red or pink preset', () => {
    for (const t of PICKER_THEMES) expect(isReddish(t.primary)).toBe(false)
  })

  it('flags red and pink picks, not orange, brown or grey ones', () => {
    for (const hex of ['#D32F2F', '#FF0000', '#E91E63', '#FF80AB', '#B71C1C']) expect(isReddish(hex)).toBe(true)
    for (const hex of ['#F57C00', '#795548', '#7F7F7F', '#1565C0', '#7B1FA2']) expect(isReddish(hex)).toBe(false)
  })
})
