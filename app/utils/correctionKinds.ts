/**
 * Each kind of correctable record, by its icon and colour: the same on the
 * Corrections page and in the dialog that files one (2026-10-27).
 * Keyed by the server's CorrectionSubject.
 */
export interface CorrectionKind {
  icon: string
  tone: 'red' | 'purple' | 'blue' | 'green' | 'amber'
}

export const CORRECTION_KINDS: Record<string, CorrectionKind> = {
  screening: { icon: 'stethoscope', tone: 'red' },
  collection: { icon: 'droplets', tone: 'red' },
  immunohematology: { icon: 'pipette', tone: 'purple' },
  serology: { icon: 'flask-conical', tone: 'purple' },
  components: { icon: 'package', tone: 'purple' },
  unit_details: { icon: 'box', tone: 'blue' },
  dispatch: { icon: 'truck', tone: 'blue' },
  payment: { icon: 'philippine-peso', tone: 'green' },
  payment_void: { icon: 'ban', tone: 'amber' },
}

export function correctionKind(subject: string | null | undefined): CorrectionKind {
  return (subject && CORRECTION_KINDS[subject]) || { icon: 'pencil', tone: 'blue' }
}
