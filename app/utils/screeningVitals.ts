/**
 * The counter's six vital signs (project owner, 2026-10-24): all six before
 * the physician accepts or defers, and each judged against its normal range.
 *
 * The ranges come from the server with the donation (`donation.vitals`),
 * already set for the donor's sex; the server checks the same rules again on
 * save (ScreeningVitals). These only decide what the counter warns about and
 * which deferral codes its form offers:
 *  - a reading missing: nothing may be saved yet;
 *  - every reading normal: the donor may still be deferred, for a history
 *    reason or Other, but not under a vital-sign code;
 *  - a reading out of range: its code is offered, and suggested.
 */

export interface VitalRange {
  label: string
  unit: string
  min: number | null
  max: number | null
  low_code: string | null
  high_code: string | null
}

export type VitalRanges = Record<string, VitalRange>

export interface VitalFinding {
  field: string
  label: string
  value: number
  unit: string
  direction: 'low' | 'high'
  /** The deferral code this reading suggests, if any. */
  code: string | null
}

function reading(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** The labels of the readings not yet recorded, in the form's order. */
export function missingVitals(ranges: VitalRanges, readings: Record<string, unknown>): string[] {
  return Object.entries(ranges)
    .filter(([field]) => reading(readings[field]) === null)
    .map(([, range]) => range.label)
}

/** Each recorded reading outside its range. */
export function vitalFindings(ranges: VitalRanges, readings: Record<string, unknown>): VitalFinding[] {
  const findings: VitalFinding[] = []

  for (const [field, range] of Object.entries(ranges)) {
    const value = reading(readings[field])
    if (value === null) continue

    if (range.min !== null && value < range.min) {
      findings.push({ field, label: range.label, value, unit: range.unit, direction: 'low', code: range.low_code })
    } else if (range.max !== null && value > range.max) {
      findings.push({ field, label: range.label, value, unit: range.unit, direction: 'high', code: range.high_code })
    }
  }

  return findings
}

/** A range as the form prints it: 12.5–17.5 g/dL, ≥ 50 kg, ≤ 37.5 °C. */
export function rangeText(range: Pick<VitalRange, 'min' | 'max' | 'unit'>): string {
  if (range.min !== null && range.max !== null) return `${range.min}–${range.max} ${range.unit}`
  if (range.min !== null) return `≥ ${range.min} ${range.unit}`
  if (range.max !== null) return `≤ ${range.max} ${range.unit}`
  return ''
}

/** "Haemoglobin 11.9 g/dL is below range (12.5–17.5 g/dL)". */
export function findingText(finding: VitalFinding, range: VitalRange): string {
  return `${finding.label} ${finding.value} ${finding.unit} is ${finding.direction === 'low' ? 'below' : 'above'} range (${rangeText(range)})`
}

/** The vital-sign codes no reading suggests: left out of the form's codes. */
export function lockedVitalCodes(vitalOnlyCodes: readonly string[], findings: readonly VitalFinding[]): string[] {
  const unlocked = new Set(findings.map((f) => f.code?.toLowerCase()).filter(Boolean))
  return vitalOnlyCodes.filter((code) => !unlocked.has(code.toLowerCase()))
}

/** The first out-of-range reading's code, to pre-select in the form. */
export function suggestedDeferralCode(findings: readonly VitalFinding[]): string | null {
  return findings.find((f) => f.code)?.code ?? null
}
