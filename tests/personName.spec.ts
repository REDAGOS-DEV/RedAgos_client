import { describe, it, expect } from 'vitest'
import { cleanPersonName, cleanedNameInput } from '~/utils/personName'

describe('cleanPersonName', () => {
  it.each([
    'Maria',
    'Dela Cruz',
    'Ma. Luisa',
    'Santos Jr.',
    'Santos-Reyes',
    "O'Brien",
    'O’Brien',
    'Peña',
    'Peña',
    'José Ñiño',
  ])('keeps a real name as typed: %s', (name) => {
    expect(cleanPersonName(name)).toBe(name)
  })

  it.each([
    ['Maria 😀', 'Maria '],
    ['Ma❤️ria', 'Maria'],
    ['Juan 🇵🇭', 'Juan '],
    ['Juan 👍🏽', 'Juan '],
    ['Juan 1️⃣', 'Juan '],
    ['👨‍👩‍👧', ''],
    ['Maria2', 'Maria'],
    ['Maria@#', 'Maria'],
  ])('takes out emoji, digits and symbols: %s', (typed, kept) => {
    expect(cleanPersonName(typed)).toBe(kept)
  })
})

describe('cleanedNameInput', () => {
  it('leaves a clean value alone', () => {
    expect(cleanedNameInput('Maria', 5)).toBeNull()
  })

  it('keeps the caret after the same letter when an emoji is typed mid-name', () => {
    // "Ma|ria" with an emoji typed at the caret: "Ma😀|ria".
    expect(cleanedNameInput('Ma😀ria', 4)).toEqual({ value: 'Maria', caret: 2 })
  })

  it('puts the caret at the end when the input reports none', () => {
    expect(cleanedNameInput('Maria 2', null)).toEqual({ value: 'Maria ', caret: 6 })
  })
})
