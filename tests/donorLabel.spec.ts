import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { donorInitials, donorReference, donorTitle, visibleDonor } from '~/utils/donorLabel'

const blinded = { blinded: true, blood_type: 'O+' }
const named = { blinded: false, full_name: 'Rosalinda Magbanua', donor_code: 'DONOR-000042', blood_type: 'O+' }

describe('donorTitle', () => {
  it('names the bag, not the person, for a blinded donation', () => {
    expect(donorTitle(blinded, 'SEG-7781', 12)).toBe('Barcode SEG-7781')
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

describe('visibleDonor', () => {
  it('keeps only the blood type for a viewer without donors.view_identity, whatever was sent', () => {
    expect(visibleDonor(named, false)).toEqual({ blinded: true, blood_type: 'O+' })
    expect(visibleDonor(blinded, false)).toEqual({ blinded: true, blood_type: 'O+' })
    expect(visibleDonor(null, false)).toBeNull()
  })

  it('passes a named block through only to a viewer who may see it', () => {
    expect(visibleDonor(named, true)).toBe(named)
    expect(visibleDonor(blinded, true)).toEqual({ blinded: true, blood_type: 'O+' })
  })
})

describe('the blind screens', () => {
  const root = path.resolve(__dirname, '..')
  const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

  for (const page of ['testing', 'laboratory', 'inventory-intake']) {
    it(`${page}.vue titles a unit through donorTitle, never the raw name`, () => {
      const text = read(`app/pages/blood-center/${page}.vue`)

      expect(text).toContain('donorTitle(')
      expect(text).not.toMatch(/\{\{\s*(row|selected)\.donor\?\.full_name/)
    })
  }

  // Testing works blind, its head included (project owner, 2026-10-25).
  it('testing.vue and the serology results take every donation in through visibleDonor', () => {
    const testing = read('app/pages/blood-center/testing.vue')
    const results = read('app/components/BloodCenter/SerologyResults.vue')

    expect(testing).toContain("can('donors.view_identity')")
    expect(testing).toContain('queue.value = (res?.data ?? []).map(blindFor)')
    expect(testing).toContain('selected.value = blindFor(payload)')
    expect(results).toMatch(/rows\.value = \(res\?\.data \?\? \[\]\)\.map\(\(row\) => \(\{ \.\.\.row, donor: visibleDonor\(row\.donor, canViewIdentity\.value\) \}\)\)/)
  })

  // The referrals left Testing for the Screening Physician, who meets donors
  // and so sees who they are (project owner, 2026-10-25).
  it('counselling-referrals.vue is the physician\'s page, not a Testing one', () => {
    const referrals = read('app/pages/blood-center/counselling-referrals.vue')

    expect(referrals).toContain("requires: 'referrals.manage'")
    expect(referrals).not.toContain('lab.')
  })
})
