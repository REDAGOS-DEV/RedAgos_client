/**
 * Reactive donors after a verified screen (project owner, 2026-10-25).
 *
 * A reactive screen is not a diagnosis: the donor starts at
 * pending_confirmatory_testing, and only the Donor Counselling Physician moves them
 * on, from documented confirmatory results read through the centre's
 * approved marker-specific SOP.
 *
 * confirmationDecision() follows the same steps as the server's
 * app/Support/ConfirmationDecision.php, so the physician sees the decision
 * before confirming it. The server works it out again and refuses one that
 * differs, so this is a preview, never the authority.
 */

export type ConfirmationStatus =
  | 'pending_confirmatory_testing'
  | 'permanently_deferred'
  | 'temporarily_deferred'
  | 'indeterminate'
  | 'cleared'

export type ConfirmatoryOutcome = 'positive' | 'negative' | 'indeterminate'

export interface SopRule {
  marker: string
  outcome: string
  decision: string
  deferral_days?: number | string | null
  retest_after_days?: number | string | null
}

export interface ConfirmatoryResult {
  marker: string
  outcome: string
  reported_on: string
}

export interface Decision {
  status: ConfirmationStatus
  deferred_until: string | null
  retest_due_on: string | null
}

export const CONFIRMATION_LABELS: Record<ConfirmationStatus, string> = {
  pending_confirmatory_testing: 'Pending confirmatory testing',
  permanently_deferred: 'Permanently deferred',
  temporarily_deferred: 'Temporarily deferred',
  indeterminate: 'Indeterminate',
  cleared: 'Cleared for re-entry',
}

export const CONFIRMATORY_OUTCOMES: { value: ConfirmatoryOutcome, label: string }[] = [
  { value: 'positive', label: 'Positive' },
  { value: 'negative', label: 'Negative' },
  { value: 'indeterminate', label: 'Indeterminate' },
]

/** What an SOP rule may prescribe: every state but the one a case starts in. */
export const SOP_DECISIONS: { value: ConfirmationStatus, label: string }[] = [
  { value: 'permanently_deferred', label: 'Permanently deferred' },
  { value: 'temporarily_deferred', label: 'Temporarily deferred' },
  { value: 'indeterminate', label: 'Indeterminate (retest)' },
  { value: 'cleared', label: 'Cleared for re-entry' },
]

export const COUNSELLING_ROUTES = [
  { value: 'public_free', label: 'Free (public)' },
  { value: 'private', label: 'Private' },
]

/** Which wins when markers point different ways. Matches ConfirmationStatus::severity(). */
const SEVERITY: Record<ConfirmationStatus, number> = {
  permanently_deferred: 4,
  pending_confirmatory_testing: 3,
  indeterminate: 2,
  temporarily_deferred: 1,
  cleared: 0,
}

/** The pill tone for a status. */
export function confirmationTone(status: string | null | undefined): 'crit' | 'warn' | 'ok' | 'muted' {
  switch (status) {
    case 'permanently_deferred': return 'crit'
    case 'pending_confirmatory_testing':
    case 'indeterminate':
    case 'temporarily_deferred': return 'warn'
    case 'cleared': return 'ok'
    default: return 'muted'
  }
}

/** A YYYY-MM-DD date plus some days, without the time zone moving it. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d! + days))
  return date.toISOString().slice(0, 10)
}

function later(a: string | null, b: string): string {
  return a === null || b > a ? b : a
}

/**
 * The latest documented result per marker: the case's saved ones (newest
 * first, as the server sends them), overlaid by the ones about to be saved.
 */
export function latestResults(
  saved: ConfirmatoryResult[] = [],
  drafts: ConfirmatoryResult[] = [],
): Record<string, ConfirmatoryResult> {
  const latest: Record<string, ConfirmatoryResult> = {}

  for (const result of saved) {
    if (!latest[result.marker]) latest[result.marker] = result
  }

  for (const result of drafts) latest[result.marker] = result

  return latest
}

/**
 * What the SOP prescribes. Null when it cannot say: no rule for a result
 * (an incomplete SOP), or no reactive marker at all.
 */
export function confirmationDecision(
  reactive: string[],
  latest: Record<string, ConfirmatoryResult>,
  rules: SopRule[],
): Decision | null {
  if (!reactive.length) return null

  let status: ConfirmationStatus = 'cleared'
  let until: string | null = null
  let retest: string | null = null

  for (const marker of reactive) {
    const result = latest[marker]

    if (!result) {
      if (SEVERITY.pending_confirmatory_testing > SEVERITY[status]) status = 'pending_confirmatory_testing'
      continue
    }

    const rule = rules.find((r) => r.marker === marker && r.outcome === result.outcome)
    if (!rule || !(rule.decision in SEVERITY)) return null

    const decision = rule.decision as ConfirmationStatus
    if (SEVERITY[decision] > SEVERITY[status]) status = decision

    if (decision === 'temporarily_deferred') until = later(until, addDays(result.reported_on, Number(rule.deferral_days)))
    if (decision === 'indeterminate') retest = later(retest, addDays(result.reported_on, Number(rule.retest_after_days)))
  }

  return {
    status,
    deferred_until: status === 'temporarily_deferred' ? until : null,
    retest_due_on: status === 'indeterminate' ? retest : null,
  }
}

/** One row per marker and outcome, in the panel's order, filled from a version or blank. */
export function sopDraft(
  markers: { value: string }[],
  existing: SopRule[] = [],
): SopRule[] {
  const rows: SopRule[] = []

  for (const marker of markers) {
    for (const outcome of CONFIRMATORY_OUTCOMES) {
      const found = existing.find((r) => r.marker === marker.value && r.outcome === outcome.value)
      rows.push({
        marker: marker.value,
        outcome: outcome.value,
        decision: found?.decision ?? '',
        deferral_days: found?.deferral_days ?? null,
        retest_after_days: found?.retest_after_days ?? null,
      })
    }
  }

  return rows
}

function wholeDays(value: unknown, max: number): boolean {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= max
}

/** What stops a version from being approved, as the server would say it. */
export function sopProblems(rules: SopRule[], documentReference: string): string[] {
  const problems: string[] = []

  if (!documentReference.trim()) problems.push('Name the SOP document this version transcribes.')
  if (rules.some((r) => !r.decision)) problems.push('Choose a decision for every marker and outcome.')
  if (rules.some((r) => r.decision === 'temporarily_deferred' && !wholeDays(r.deferral_days, 36500))) {
    problems.push('Say how many days each temporary deferral lasts.')
  }
  if (rules.some((r) => r.decision === 'indeterminate' && !wholeDays(r.retest_after_days, 3650))) {
    problems.push('Say how many days after an indeterminate result to retest.')
  }

  return problems
}

/** The approve request's rules: days only where the decision takes them. */
export function sopPayload(rules: SopRule[]): SopRule[] {
  return rules.map((r) => ({
    marker: r.marker,
    outcome: r.outcome,
    decision: r.decision,
    deferral_days: r.decision === 'temporarily_deferred' ? Number(r.deferral_days) : null,
    retest_after_days: r.decision === 'indeterminate' ? Number(r.retest_after_days) : null,
  }))
}
