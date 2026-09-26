/**
 * ABO + Rh, as the DOH form prints them, over the combined codes the server stores.
 *
 * Section II of the form has "Blood Type" and "Rh Typing" as two rows, but the
 * server keeps one `blood_types` row per combination (A+ … O-) — the code the
 * donor profile, the mismatch guard and every blood unit already use. These
 * helpers are the one place the two pickers are turned into that row and back.
 */

export const ABO_GROUPS = ['A', 'B', 'AB', 'O'] as const

export type AboGroup = (typeof ABO_GROUPS)[number]

export type RhFactor = 'positive' | 'negative'

export interface BloodTypeOption {
  id: number
  code: string
  label?: string
}

/**
 * Split a stored code such as `AB-` into its two form rows.
 *
 * Anything that is not an ABO group followed by + or - comes back blank rather
 * than guessed at.
 */
export function splitBloodTypeCode(code: string | null | undefined): { abo: AboGroup | ''; rh: RhFactor | '' } {
  const match = /^(AB|A|B|O)([+-])$/.exec((code ?? '').trim().toUpperCase())

  if (!match) return { abo: '', rh: '' }

  return {
    abo: match[1] as AboGroup,
    rh: match[2] === '+' ? 'positive' : 'negative',
  }
}

/**
 * Join the two form rows into the stored code, or null until both are chosen.
 */
export function bloodTypeCode(abo: string | null | undefined, rh: string | null | undefined): string | null {
  if (!abo || !ABO_GROUPS.includes(abo as AboGroup)) return null
  if (rh !== 'positive' && rh !== 'negative') return null

  return `${abo}${rh === 'positive' ? '+' : '-'}`
}

/**
 * The `blood_types` row for an ABO group and Rh factor.
 *
 * Null when either is unchosen, or when this centre's reference data has no
 * row for the combination — never a nearby one.
 */
export function resolveBloodTypeId(
  types: BloodTypeOption[],
  abo: string | null | undefined,
  rh: string | null | undefined,
): number | null {
  const code = bloodTypeCode(abo, rh)

  if (!code) return null

  return types.find((type) => type.code?.toUpperCase() === code)?.id ?? null
}

/**
 * The stored code for a `blood_types` id, or null.
 */
export function bloodTypeCodeFor(types: BloodTypeOption[], id: number | null | undefined): string | null {
  if (id === null || id === undefined) return null

  return types.find((type) => type.id === id)?.code ?? null
}
