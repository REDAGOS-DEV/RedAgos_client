/**
 * Deferral codes (project owner, 2026-10-24): every deferral is recorded under
 * one of the centre's codes, and the record shows the code, so a donor who
 * glimpses the screen, a printout or their own email sees "R1" and never the
 * reason. The reason reaches only staff allowed the clinical record, and the
 * Screening Physician keeps the list (Deferral Codes page).
 *
 * "Other" stays beside the codes: the reason typed, no code. The donor's
 * notice then carries neither.
 *
 * The server decides who reads a reason (it sends null otherwise); these only
 * decide how a code reads and what the forms send.
 */

export interface DeferralCode {
  id: number
  code: string
  /** Null for a viewer not allowed the reasons. */
  reason: string | null
  retired: boolean
  retired_at?: string | null
  uses?: number
  updated_at?: string | null
  updated_by?: string | null
}

/** Letters and digits, a dash between parts: R13, R2-Low. As the server checks it. */
export const DEFERRAL_CODE_PATTERN = /^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/

export const DEFERRAL_CODE_MAX = 16

/** The picker's value for "Other": the reason typed, no code. */
export const OTHER_DEFERRAL = 'other'

/** The code as the server stores it: trimmed, in the case it was written. */
export function normaliseDeferralCode(raw: string | null | undefined): string {
  return String(raw ?? '').trim()
}

export function isValidDeferralCode(raw: string | null | undefined): boolean {
  const code = normaliseDeferralCode(raw)
  return code.length > 0 && code.length <= DEFERRAL_CODE_MAX && DEFERRAL_CODE_PATTERN.test(code)
}

/**
 * The picker's options: the active codes alone, no reason beside them (project
 * owner, 2026-10-24), then Other.
 */
export function deferralCodeOptions(codes: readonly DeferralCode[]): { value: string, label: string }[] {
  return [
    ...codes.filter((c) => !c.retired).map((c) => ({ value: c.code, label: c.code })),
    { value: OTHER_DEFERRAL, label: 'Other' },
  ]
}

/** Whether a picked code and the words typed under Other make a complete choice. */
export function deferralChoiceComplete(picked: string, otherReason: string): boolean {
  return picked === OTHER_DEFERRAL ? otherReason.trim().length > 0 : picked !== ''
}

/** What the server takes: the code, or the reason typed under Other. */
export function deferralChoicePayload(picked: string, otherReason: string): { deferral_code: string } | { other_reason: string } {
  return picked === OTHER_DEFERRAL
    ? { other_reason: otherReason.trim() }
    : { deferral_code: picked }
}

/**
 * The next free code in the R series, offered when adding one: R13 after R12.
 * Retired codes count, since a code is never reused.
 */
export function nextDeferralCode(codes: readonly Pick<DeferralCode, 'code'>[]): string {
  const taken = codes
    .map((c) => /^R(\d+)$/i.exec(c.code)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number)

  return `R${(taken.length ? Math.max(...taken) : 0) + 1}`
}

/** Natural order, so R2 comes before R10, as the server lists them. */
export function sortDeferralCodes<T extends Pick<DeferralCode, 'code'>>(codes: readonly T[]): T[] {
  return [...codes].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }))
}
