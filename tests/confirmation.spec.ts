import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  addDays,
  confirmationDecision,
  confirmationTone,
  latestResults,
  sopDraft,
  sopPayload,
  sopProblems,
  type SopRule,
} from '~/utils/confirmation'
import { SEROLOGY_MARKERS } from '~/utils/serology'

/**
 * Reactive donors after a verified screen (project owner, 2026-10-25). The
 * preview must follow app/Support/ConfirmationDecision.php step for step:
 * the server refuses a decision that differs from its own.
 */

/** Positive defers permanently, negative clears, indeterminate retests in 28 days. */
function rules(overrides: Record<string, Partial<SopRule>> = {}): SopRule[] {
  return sopDraft(SEROLOGY_MARKERS).map((rule) => ({
    ...rule,
    ...(rule.outcome === 'positive' ? { decision: 'permanently_deferred' } : {}),
    ...(rule.outcome === 'negative' ? { decision: 'cleared' } : {}),
    ...(rule.outcome === 'indeterminate' ? { decision: 'indeterminate', retest_after_days: 28 } : {}),
    ...(overrides[`${rule.marker}/${rule.outcome}`] ?? {}),
  }))
}

const result = (marker: string, outcome: string, reported_on = '2026-10-01') => ({ marker, outcome, reported_on })

describe('confirmationDecision', () => {
  it('keeps the donor pending while a reactive marker has no result', () => {
    const latest = latestResults([], [result('hbsag', 'negative')])

    expect(confirmationDecision(['hbsag', 'hcv'], latest, rules())?.status).toBe('pending_confirmatory_testing')
  })

  it('lets a marker that is enough to defer permanently decide without waiting', () => {
    const latest = latestResults([], [result('hcv', 'positive')])

    expect(confirmationDecision(['hbsag', 'hcv'], latest, rules())?.status).toBe('permanently_deferred')
  })

  it('runs a temporary deferral from the report date, the later one when two markers call for it', () => {
    const sop = rules({
      'malaria/positive': { decision: 'temporarily_deferred', deferral_days: 1095 },
      'syphilis/positive': { decision: 'temporarily_deferred', deferral_days: 365 },
    })
    const latest = latestResults([], [result('malaria', 'positive', '2026-10-01'), result('syphilis', 'positive', '2026-12-01')])

    expect(confirmationDecision(['malaria', 'syphilis'], latest, sop)).toEqual({
      status: 'temporarily_deferred',
      deferred_until: '2029-09-30',
      retest_due_on: null,
    })
  })

  it('sets the retest date for an indeterminate result, and clears on a negative retest', () => {
    const saved = [{ ...result('hbsag', 'indeterminate', '2026-09-01') }]

    expect(confirmationDecision(['hbsag'], latestResults(saved), rules())).toEqual({
      status: 'indeterminate',
      deferred_until: null,
      retest_due_on: '2026-09-29',
    })

    // The retest is newer than the saved result, so it is the one in force.
    expect(confirmationDecision(['hbsag'], latestResults(saved, [result('hbsag', 'negative')]), rules())?.status).toBe('cleared')
  })

  it('cannot say without a rule for the result, or without a reactive marker', () => {
    const incomplete = rules().filter((rule) => !(rule.marker === 'hiv' && rule.outcome === 'positive'))

    expect(confirmationDecision(['hiv'], latestResults([], [result('hiv', 'positive')]), incomplete)).toBeNull()
    expect(confirmationDecision([], {}, rules())).toBeNull()
  })
})

describe('the SOP form', () => {
  it('has a row for every marker and outcome, filled from the version in force', () => {
    const draft = sopDraft(SEROLOGY_MARKERS, [{ marker: 'hiv', outcome: 'positive', decision: 'permanently_deferred' }])

    expect(draft).toHaveLength(15)
    expect(draft[0]).toMatchObject({ marker: 'hiv', outcome: 'positive', decision: 'permanently_deferred' })
    expect(draft[1]).toMatchObject({ marker: 'hiv', outcome: 'negative', decision: '' })
  })

  it('says what stops approval, as the server would', () => {
    expect(sopProblems(sopDraft(SEROLOGY_MARKERS), '')).toEqual([
      'Name the SOP document this version transcribes.',
      'Choose a decision for every marker and outcome.',
    ])

    const missingDays = rules({ 'malaria/positive': { decision: 'temporarily_deferred', deferral_days: null } })
    expect(sopProblems(missingDays, 'SOP-1')).toEqual(['Say how many days each temporary deferral lasts.'])
    expect(sopProblems(rules(), 'SOP-1')).toEqual([])
  })

  it('sends days only where the decision takes them', () => {
    const payload = sopPayload(rules({ 'hiv/positive': { deferral_days: 30 } }))

    expect(payload[0]).toEqual({ marker: 'hiv', outcome: 'positive', decision: 'permanently_deferred', deferral_days: null, retest_after_days: null })
    expect(payload[2]).toMatchObject({ outcome: 'indeterminate', retest_after_days: 28 })
  })
})

describe('helpers', () => {
  it('adds days to a date without the time zone moving it, across a leap year', () => {
    expect(addDays('2026-10-01', 1095)).toBe('2029-09-30')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('tones a permanent deferral critical and a cleared donor ok', () => {
    expect(confirmationTone('permanently_deferred')).toBe('crit')
    expect(confirmationTone('pending_confirmatory_testing')).toBe('warn')
    expect(confirmationTone('cleared')).toBe('ok')
  })
})

describe('the pages', () => {
  const root = path.resolve(__dirname, '..')
  const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

  it('keeps the SOP page the physician\'s, and the decision a confirmation', () => {
    const sopPage = read('app/pages/blood-center/confirmatory-sop.vue')
    const referrals = read('app/pages/blood-center/counselling-referrals.vue')

    expect(sopPage).toContain("requires: 'confirmatory_sop.configure'")
    // The physician sends the SOP's decision, never one of their own.
    expect(referrals).toContain('decision: decision.value.status')
    expect(referrals).toContain('The reactive unit stays rejected')
  })
})
