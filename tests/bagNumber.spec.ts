import { describe, expect, it } from 'vitest'
import { bagMatchesCode, isSticker, parseBagNumber } from '../app/utils/bagNumber'

// [centre]-[barcode]-[component], and -2 for a second bag of a component
// (project owner, 2026-11-13). Mirrors the server's BagNumbers.
describe('bag numbers', () => {
  it('reads a bag number back into its parts, in any case', () => {
    expect(parseBagNumber('SNBC-21627990-PRBC')).toEqual({ centre: 'SNBC', sticker: '21627990', component: 'PRBC', sequence: 1 })
    expect(parseBagNumber(' snbc-21627990-prbc-2\r')).toEqual({ centre: 'SNBC', sticker: '21627990', component: 'PRBC', sequence: 2 })
    expect(parseBagNumber('21627990-FFP')).toEqual({ centre: null, sticker: '21627990', component: 'FFP', sequence: 1 })
  })

  it('reads nothing else as one', () => {
    for (const text of ['21627990', 'DD-4-12', 'PRC-77 #1', 'Maria', '', null, 'SNBC-2162A990-PRBC', 'ABCDEFG-1-PRBC']) {
      expect(parseBagNumber(text)).toBeNull()
    }
  })

  it('knows a scanned sticker: digits only', () => {
    expect(isSticker(' 21627990\n')).toBe(true)
    expect(isSticker('SNBC-21627990-PRBC')).toBe(false)
    expect(isSticker('')).toBe(false)
  })

  it('finds a bag by its full number or by its donation’s sticker', () => {
    expect(bagMatchesCode('snbc-21627990-prbc', 'SNBC-21627990-PRBC')).toBe(true)
    expect(bagMatchesCode('21627990', 'SNBC-21627990-PRBC-2')).toBe(true)
    expect(bagMatchesCode('2162799', 'SNBC-21627990-PRBC')).toBe(false)
    expect(bagMatchesCode('SNBC-21627990-FFP', 'SNBC-21627990-PRBC')).toBe(false)
    expect(bagMatchesCode('21627990', 'DD-4')).toBe(false)
    expect(bagMatchesCode('', 'SNBC-21627990-PRBC')).toBe(false)
  })
})
