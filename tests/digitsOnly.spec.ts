import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanDigits, cleanedDigitsInput } from '~/utils/digitsOnly'

describe('cleanDigits', () => {
  it.each([
    ['1234567', '1234567'],
    ['0001', '0001'],
    ['SEG-0001', '0001'],
    ['12 34-56', '123456'],
    ['abc', ''],
    ['١٢٣', ''],
  ])('keeps only 0–9: %s', (typed, kept) => {
    expect(cleanDigits(typed)).toBe(kept)
  })
})

describe('cleanedDigitsInput', () => {
  it('leaves a clean value alone', () => {
    expect(cleanedDigitsInput('1234', 4)).toBeNull()
  })

  it('keeps the caret after the same digit when a letter is typed mid-number', () => {
    // "12|34" with an "a" typed at the caret: "12a|34".
    expect(cleanedDigitsInput('12a34', 3)).toEqual({ value: '1234', caret: 2 })
  })

  it('puts the caret at the end when the input reports none', () => {
    expect(cleanedDigitsInput('12-34', null)).toEqual({ value: '1234', caret: 4 })
  })
})

describe('the donation barcode boxes', () => {
  it.each([
    'app/pages/blood-center/donation.vue',
    'app/components/BloodCenter/PaperDonationForm.vue',
  ])('take digits only: %s', (file) => {
    const source = readFileSync(resolve(__dirname, '..', file), 'utf8')
    const input = source.match(/<input[^>]*v-model="[^"]*donation_barcode"[^>]*>/s)?.[0] ?? ''

    expect(input).toContain('v-digits-only')
    expect(input).toContain('inputmode="numeric"')
  })
})
