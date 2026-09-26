import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  ABO_GROUPS,
  bloodTypeCode,
  bloodTypeCodeFor,
  resolveBloodTypeId,
  splitBloodTypeCode,
} from '~/utils/bloodType'
import { atTimeOn, normalizeSegmentNumber, phlebotomyProblems, timeNow } from '~/utils/phlebotomy'
import {
  SEROLOGY_MARKERS,
  blankPanel,
  panelComplete,
  reactiveMarkers,
  serologyPayload,
} from '~/utils/serology'

/**
 * Section II of the DOH donor form: "For Technical Management Use Only".
 *
 * The phlebotomist's box at the counter, and the Testing department's
 * Immunohematology and Serology tables on their own page. What is locked in
 * here is what a quiet refactor could lose: that ABO + Rh resolve to exactly
 * one stored row and never a guess, that a scanned and a typed segment are the
 * same number, that a reactive panel is never sent without a confirmation, and
 * that the preliminary fingerprick typing never pre-fills the real one.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((code, i) => ({ id: i + 1, code, label: code }))

describe('ABO + Rh over the combined blood type codes', () => {
  it('resolves all eight combinations to their own row', () => {
    for (const abo of ABO_GROUPS) {
      for (const rh of ['positive', 'negative'] as const) {
        const code = `${abo}${rh === 'positive' ? '+' : '-'}`
        const id = resolveBloodTypeId(BLOOD_TYPES, abo, rh)

        expect(id, code).toBe(BLOOD_TYPES.find((t) => t.code === code)!.id)
      }
    }
  })

  it('resolves nothing until both rows are chosen', () => {
    expect(resolveBloodTypeId(BLOOD_TYPES, 'A', '')).toBeNull()
    expect(resolveBloodTypeId(BLOOD_TYPES, '', 'positive')).toBeNull()
    expect(bloodTypeCode('O', null)).toBeNull()
  })

  it('never picks a nearby row for a combination the centre has not set up', () => {
    const withoutONegative = BLOOD_TYPES.filter((t) => t.code !== 'O-')

    expect(resolveBloodTypeId(withoutONegative, 'O', 'negative')).toBeNull()
  })

  it('splits a stored code back into the two form rows', () => {
    expect(splitBloodTypeCode('AB-')).toEqual({ abo: 'AB', rh: 'negative' })
    expect(splitBloodTypeCode('o+')).toEqual({ abo: 'O', rh: 'positive' })
    // AB must not be read as A with a stray B.
    expect(splitBloodTypeCode('AB+').abo).toBe('AB')
    expect(splitBloodTypeCode('XX-TEST')).toEqual({ abo: '', rh: '' })
    expect(splitBloodTypeCode(null)).toEqual({ abo: '', rh: '' })
  })

  it('reads the code for an id, and nothing for an unknown one', () => {
    expect(bloodTypeCodeFor(BLOOD_TYPES, 7)).toBe('O+')
    expect(bloodTypeCodeFor(BLOOD_TYPES, 99)).toBeNull()
    expect(bloodTypeCodeFor(BLOOD_TYPES, null)).toBeNull()
  })
})

describe('the phlebotomist box', () => {
  const day = new Date(2026, 8, 26, 12, 0, 0)
  const later = new Date(2026, 8, 26, 18, 0, 0)

  function box(overrides: Record<string, unknown> = {}) {
    return {
      blood_bag_type: 'double',
      segment_number: 'SEG-0001',
      started_time: '09:00',
      ended_time: '09:12',
      volume_ml: 450,
      ...overrides,
    } as any
  }

  it('normalises a scanned segment the way the server stores it', () => {
    // A scanner appends a carriage return; staff type in lower case.
    expect(normalizeSegmentNumber(' abc 123\r')).toBe('ABC123')
    expect(normalizeSegmentNumber('seg-0001\t')).toBe('SEG-0001')
    expect(normalizeSegmentNumber(undefined)).toBe('')
  })

  it('puts the two times on the visit day', () => {
    const iso = atTimeOn(day, '09:05')!
    const at = new Date(iso)

    expect(at.getFullYear()).toBe(2026)
    expect(at.getMonth()).toBe(8)
    expect(at.getDate()).toBe(26)
    expect(at.getHours()).toBe(9)
    expect(at.getMinutes()).toBe(5)
  })

  it('refuses a time that is not a clock time', () => {
    expect(atTimeOn(day, '')).toBeNull()
    expect(atTimeOn(day, '25:00')).toBeNull()
    expect(atTimeOn(day, '9')).toBeNull()
  })

  it('formats "Now" as a clock time', () => {
    expect(timeNow(new Date(2026, 0, 1, 7, 4))).toBe('07:04')
  })

  it('is ready when every line of the box is filled', () => {
    expect(phlebotomyProblems(box(), day, later)).toEqual([])
  })

  it('names each missing line', () => {
    const problems = phlebotomyProblems(box({ blood_bag_type: '', segment_number: '  ', started_time: '', ended_time: '' }), day, later)

    expect(problems).toContain('Choose the blood bag.')
    expect(problems).toContain('Scan or type the segment number.')
    expect(problems).toContain('Record the time started.')
    expect(problems).toContain('Record the time ended.')
  })

  it('refuses a draw that ends before it started, or in the future', () => {
    expect(phlebotomyProblems(box({ started_time: '09:30', ended_time: '09:10' }), day, later))
      .toContain('The time ended cannot be before the time started.')

    expect(phlebotomyProblems(box({ ended_time: '19:00' }), day, later))
      .toContain('The time ended cannot be in the future.')
  })

  it('keeps the volume bounds the server enforces', () => {
    expect(phlebotomyProblems(box({ volume_ml: 50 }), day, later)).toContain('Record a volume between 100 and 1000 mL.')
  })
})

describe('the serology panel', () => {
  const allClear = Object.fromEntries(SEROLOGY_MARKERS.map((m) => [m.value, 'non_reactive'])) as any

  it('is exactly the five markers the Testing department records', () => {
    expect(SEROLOGY_MARKERS.map((m) => m.value)).toEqual(['hiv', 'hbsag', 'hcv', 'syphilis', 'malaria'])
  })

  it('starts blank, so every reading is a deliberate choice', () => {
    const panel = blankPanel()

    expect(Object.values(panel).every((v) => v === '')).toBe(true)
    expect(panelComplete(panel)).toBe(false)
  })

  it('is complete only with a reading for every marker', () => {
    expect(panelComplete(allClear)).toBe(true)
    expect(panelComplete({ ...allClear, malaria: '' })).toBe(false)
  })

  it('names the reactive markers in the form order', () => {
    expect(reactiveMarkers({ ...allClear, syphilis: 'reactive', hiv: 'reactive' })).toEqual(['HIV', 'Syphilis'])
    expect(reactiveMarkers(allClear)).toEqual([])
  })

  it('never sends a confirmation with a clear panel', () => {
    expect(serologyPayload(allClear, true)).toEqual(allClear)
  })

  it('always says whether a reactive panel was confirmed', () => {
    const reactive = { ...allClear, hbsag: 'reactive' }

    expect(serologyPayload(reactive, false)).toEqual({ ...reactive, confirm_reactive: false })
    expect(serologyPayload(reactive, true)).toEqual({ ...reactive, confirm_reactive: true })
  })
})

describe('the Testing page', () => {
  const page = source('app/pages/blood-center/testing.vue')

  it('is the Testing department\'s own page', () => {
    expect(page).toContain("requires: 'lab.record_result'")
  })

  it('confirms a reactive panel before saving it', () => {
    // A reactive marker rejects the donation, defers the donor and refers
    // them. The dialog is the only way to send confirm_reactive: true.
    expect(page).toContain('if (pendingReactive.value.length)')
    expect(page).toContain('confirmingReactive.value = true')
    expect(page).toContain('saveSerology(false)')
    expect(page).toMatch(/function confirmReactive\(\)\s*\{\s*saveSerology\(true\)/)
  })

  it('never pre-fills the typing from the fingerprick or the donor profile', () => {
    expect(page).toContain('typingForm.blood_type_id = payload.immunohematology?.blood_type_id ?? null')
    expect(page).not.toMatch(/typingForm\.blood_type_id\s*=.*fingerprick/)
    expect(page).not.toMatch(/typingForm\.blood_type_id\s*=.*donor\?\.blood_type/)
  })

  it('keeps the referral list behind its own ability', () => {
    expect(page).toContain("can('lab.referrals')")
    expect(page).toMatch(/v-if="canSeeReferrals"[\s\S]*?Counselling referrals/)
  })
})

describe('the Processing page', () => {
  const page = source('app/pages/blood-center/laboratory.vue')

  it('is Processing\'s own page and no longer records a test result', () => {
    expect(page).toContain("requires: 'lab.record_components'")
    expect(page).not.toContain('recordTestResult')
    expect(page).not.toContain('resultForm')
  })

  it('treats a result recorded before the panel as unfinished', () => {
    expect(page).toContain('selected.value?.test_result?.is_legacy')
  })
})

describe('the counter', () => {
  const page = source('app/pages/blood-center/collection.vue')

  it('sends the whole phlebotomist box, with the segment normalised', () => {
    expect(page).toContain('blood_bag_type: collectionForm.blood_bag_type')
    expect(page).toContain('segment_number: normalizeSegmentNumber(collectionForm.segment_number)')
    expect(page).toContain('started_at: atTimeOn(today, collectionForm.started_time)')
    expect(page).toContain('ended_at: atTimeOn(today, collectionForm.ended_time)')
  })

  it('never sends a phlebotomist: that is whoever is signed in', () => {
    expect(page).not.toMatch(/collected_by\s*:/)
  })

  it('does not let a scanner\'s Enter submit half a record', () => {
    expect(page).toContain('@keydown.enter.prevent')
  })

  it('carries the valid-ID lookup\'s deferral into the visit', () => {
    expect(page).toContain('found.prior_deferral ?? null')
  })
})

describe('navigation', () => {
  const nav = source('app/composables/useBloodCenterNav.ts')

  it('gives Testing and Processing each their own page, gated on their own write', () => {
    expect(nav).toMatch(/label: 'Testing', path: '\/blood-center\/testing'[^}]*requires: 'lab\.record_result'/)
    expect(nav).toMatch(/label: 'Processing', path: '\/blood-center\/laboratory'[^}]*requires: 'lab\.record_components'/)
  })
})
