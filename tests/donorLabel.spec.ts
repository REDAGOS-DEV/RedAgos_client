import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { donorInitials, donorReference, donorTitle } from '~/utils/donorLabel'

const blinded = { blinded: true, blood_type: 'O+' }
const named = { blinded: false, full_name: 'Rosalinda Magbanua', donor_code: 'DONOR-000042', blood_type: 'O+' }

describe('donorTitle', () => {
  it('names the bag, not the person, for a blinded donation', () => {
    expect(donorTitle(blinded, 'SEG-7781', 12)).toBe('Segment SEG-7781')
    expect(donorTitle(blinded, null, 12)).toBe('Donation #12')
  })

  it('names the donor for a role that meets donors', () => {
    expect(donorTitle(named, 'SEG-7781', 12)).toBe('Rosalinda Magbanua')
    expect(donorTitle(null, null, 12)).toBe('Unknown donor')
  })
})

describe('donorReference and donorInitials', () => {
  it('never falls back to a name for a blinded donation', () => {
    expect(donorReference(blinded)).toBe('Blind — by barcode')
    expect(donorInitials(blinded)).toBe('')
  })

  it('uses the donor code and initials otherwise', () => {
    expect(donorReference(named)).toBe('DONOR-000042')
    expect(donorInitials(named)).toBe('RM')
  })
})

describe('the blind screens', () => {
  const root = path.resolve(__dirname, '..')

  for (const page of ['testing', 'laboratory', 'inventory-intake']) {
    it(`${page}.vue titles a unit through donorTitle, never the raw name`, () => {
      const text = readFileSync(path.join(root, `app/pages/blood-center/${page}.vue`), 'utf8')

      expect(text).toContain('donorTitle(')
      expect(text).not.toMatch(/\{\{\s*(row|selected)\.donor\?\.full_name/)
    })
  }
})
