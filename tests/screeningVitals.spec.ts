import { describe, it, expect } from 'vitest'
import {
  findingText,
  lockedVitalCodes,
  missingVitals,
  rangeText,
  suggestedDeferralCode,
  vitalFindings,
  type VitalRanges,
} from '~/utils/screeningVitals'

/**
 * The counter's six vital signs (project owner, 2026-10-24).
 *
 * What is locked in: a reading left blank holds the counter back; a reading
 * out of range is found and suggests its code; and the vital-sign codes no
 * reading suggests are left out of the deferral form.
 */

// As the server sends them for a woman (haemoglobin from 12.5).
const ranges: VitalRanges = {
  systolic_bp: { label: 'Systolic BP', unit: 'mmHg', min: 90, max: 160, low_code: 'R7', high_code: 'R7' },
  diastolic_bp: { label: 'Diastolic BP', unit: 'mmHg', min: 60, max: 100, low_code: 'R7', high_code: 'R7' },
  pulse_bpm: { label: 'Pulse', unit: 'bpm', min: 60, max: 100, low_code: null, high_code: null },
  temperature_c: { label: 'Temperature', unit: '°C', min: null, max: 37.5, low_code: null, high_code: 'R3' },
  weight_kg: { label: 'Weight', unit: 'kg', min: 50, max: null, low_code: 'R8', high_code: null },
  haemoglobin_g_dl: { label: 'Haemoglobin', unit: 'g/dL', min: 12.5, max: 17.5, low_code: 'R2-Low', high_code: 'R2-High' },
}

const VITAL_ONLY = ['R2-Low', 'R2-High', 'R7', 'R8']

const normal = { systolic_bp: 118, diastolic_bp: 76, pulse_bpm: 72, temperature_c: 36.6, weight_kg: 65, haemoglobin_g_dl: 14.2 }

describe('the counter vital signs', () => {
  it('names each reading not yet recorded, a zero counting as recorded', () => {
    expect(missingVitals(ranges, {})).toHaveLength(6)
    expect(missingVitals(ranges, { ...normal, pulse_bpm: null, weight_kg: '' })).toEqual(['Pulse', 'Weight'])
    expect(missingVitals(ranges, { ...normal, pulse_bpm: 0 })).toEqual([])
  })

  it('finds nothing in a normal set, so every vital-sign code stays locked', () => {
    expect(vitalFindings(ranges, normal)).toEqual([])
    expect(lockedVitalCodes(VITAL_ONLY, [])).toEqual(VITAL_ONLY)
    expect(suggestedDeferralCode([])).toBeNull()
  })

  it('finds a low haemoglobin, unlocks R2-Low and suggests it', () => {
    const findings = vitalFindings(ranges, { ...normal, haemoglobin_g_dl: 11.9 })

    expect(findings).toEqual([{ field: 'haemoglobin_g_dl', label: 'Haemoglobin', value: 11.9, unit: 'g/dL', direction: 'low', code: 'R2-Low' }])
    expect(lockedVitalCodes(VITAL_ONLY, findings)).toEqual(['R2-High', 'R7', 'R8'])
    expect(suggestedDeferralCode(findings)).toBe('R2-Low')
    expect(findingText(findings[0]!, ranges.haemoglobin_g_dl!)).toBe('Haemoglobin 11.9 g/dL is below range (12.5–17.5 g/dL)')
  })

  it('suggests the first reading with a code, and none for a pulse out of range', () => {
    const findings = vitalFindings(ranges, { ...normal, pulse_bpm: 120, temperature_c: 38.2 })

    expect(findings.map((f) => f.field)).toEqual(['pulse_bpm', 'temperature_c'])
    expect(suggestedDeferralCode(findings)).toBe('R3')
    expect(suggestedDeferralCode(vitalFindings(ranges, { ...normal, pulse_bpm: 120 }))).toBeNull()
  })

  it('prints a range as the form shows it', () => {
    expect(rangeText(ranges.haemoglobin_g_dl!)).toBe('12.5–17.5 g/dL')
    expect(rangeText(ranges.weight_kg!)).toBe('≥ 50 kg')
    expect(rangeText(ranges.temperature_c!)).toBe('≤ 37.5 °C')
  })
})
