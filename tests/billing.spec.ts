import { describe, it, expect } from 'vitest'
import {
  attemptTone,
  cashCountTotal,
  CASH_DENOMINATIONS,
  changeDue,
  checkoutUnavailableMessage,
  facilityInitials,
  isAttemptPayable,
  isAttemptSettled,
  journalAmount,
  pesos,
  quickTenderAmounts,
  reviewReasonMessage,
  shiftVariance,
  statementFigures,
  statementStamp,
  takesPayment,
  transactionTone,
} from '~/utils/billing'

/**
 * Billing on screen.
 *
 * What is locked in: a checkout is shown as payable only while the server says
 * it is active and gave a link; polling stops only on a state the server will
 * never move out of; a weekly (statement-only) order never offers a payment;
 * and every reason the server can give for "no checkout" reads as something
 * billing staff can act on.
 */
describe('pesos', () => {
  it('reads decimal strings and numbers the same', () => {
    expect(pesos('1500.00')).toBe(pesos(1500))
    expect(pesos('0.30')).toBe('₱0.30')
  })

  it('treats a missing or broken amount as zero rather than NaN', () => {
    expect(pesos(null)).toBe('₱0.00')
    expect(pesos('not a number')).toBe('₱0.00')
  })
})

describe('checkout state', () => {
  it('is payable only while active with a link', () => {
    expect(isAttemptPayable({ status: 'active', checkout_url: 'https://checkout.xendit.co/ps-1' })).toBe(true)
    expect(isAttemptPayable({ status: 'active', checkout_url: null })).toBe(false)
    expect(isAttemptPayable({ status: 'awaiting_verification', checkout_url: 'https://checkout.xendit.co/ps-1' })).toBe(false)
    expect(isAttemptPayable(null)).toBe(false)
  })

  it('keeps polling while the server may still change its answer', () => {
    expect(isAttemptSettled('creating')).toBe(false)
    expect(isAttemptSettled('active')).toBe(false)
    expect(isAttemptSettled('awaiting_verification')).toBe(false)
  })

  it('stops polling once the checkout can never change again', () => {
    for (const status of ['completed', 'expired', 'canceled', 'failed', 'superseded'] as const) {
      expect(isAttemptSettled(status)).toBe(true)
    }
  })

  it('marks a payment being confirmed as a warning, not a success', () => {
    expect(attemptTone('awaiting_verification')).toBe('warning')
    expect(attemptTone('completed')).toBe('success')
  })
})

describe('which statements take a payment', () => {
  it('offers payment only on a collectible statement that still blocks release', () => {
    expect(takesPayment({ collects_payment: true, clears_release: false })).toBe(true)
    expect(takesPayment({ collects_payment: true, clears_release: true })).toBe(false)
  })

  it('never offers payment on a weekly statement-only order, even if it were blocking', () => {
    expect(takesPayment({ collects_payment: false, clears_release: false })).toBe(false)
  })
})

describe('messages', () => {
  it('explains every reason the server gives for no checkout', () => {
    const reasons = [
      'checkout_disabled',
      'merchant_not_configured',
      'billing_not_collectible',
      'billing_settled_by_decision',
      'billing_settled',
      'payment_in_progress',
      'exceeds_channel_limit',
    ]

    const messages = reasons.map(checkoutUnavailableMessage)

    expect(new Set(messages).size).toBe(reasons.length)
    expect(checkoutUnavailableMessage('billing_not_collectible')).toMatch(/weekly/i)
  })

  it('tells a supervisor what to do with a checkout flagged for review', () => {
    expect(reviewReasonMessage('verification_timeout')).toMatch(/dashboard/i)
    expect(reviewReasonMessage('late_completion')).toMatch(/refund/i)
    expect(reviewReasonMessage('something_new')).toMatch(/supervisor/i)
  })
})

describe('billing documents', () => {
  const revision = (over: Partial<Parameters<typeof statementFigures>[0]> = {}) => ({
    billing_status: 'unpaid' as const,
    total_amount: '1000.00',
    collected_at_issue: '0.00',
    amount_due: '1000.00',
    ...over,
  })

  it('prints an unpaid statement as payable in full', () => {
    expect(statementFigures(revision())).toEqual({ subtotal: 1000, subsidy: 0, payable: 1000, paid: 0, balance: 1000 })
  })

  it('takes earlier payments off the balance but not off the amount payable', () => {
    const f = statementFigures(revision({ billing_status: 'partial', collected_at_issue: '400.00', amount_due: '600.00' }))

    expect(f.payable).toBe(1000)
    expect(f.paid).toBe(400)
    expect(f.balance).toBe(600)
  })

  it('shows a subsidy as waiving the whole charge, never as a balance', () => {
    const f = statementFigures(revision({ billing_status: 'subsidised', collected_at_issue: '400.00', amount_due: '0.00' }))

    expect(f.subsidy).toBe(1000)
    expect(f.payable).toBe(0)
    expect(f.balance).toBe(0)
    // What was collected before the subsidy stays on record.
    expect(f.paid).toBe(400)
  })

  it('adds centavos without drift', () => {
    expect(statementFigures(revision({ total_amount: '0.30', amount_due: '0.30' })).payable).toBe(0.3)
  })

  it('stamps every statement status with its own label', () => {
    const statuses = ['unpaid', 'partial', 'paid', 'void', 'subsidised', 'statement_only', 'settled_outside'] as const
    const labels = statuses.map((s) => statementStamp(s).label)

    expect(new Set(labels).size).toBe(statuses.length)
    expect(statementStamp('paid').tone).toBe('success')
    expect(statementStamp('unpaid').tone).toBe('danger')
  })

  it('heads a document of a centre without a logo with its own initials, as the PDF does', () => {
    expect(facilityInitials('Davao Regional Blood Center')).toBe('DR')
    expect(facilityInitials('Bureau of Blood Services')).toBe('BB')
    expect(facilityInitials('The Philippine Red Cross')).toBe('PR')
    expect(facilityInitials('Blood Center #2')).toBe('BC')
    expect(facilityInitials('Tagum')).toBe('T')
    expect(facilityInitials(null)).toBe('')
  })
})

/**
 * The counter and the journal.
 *
 * What is locked in: change is worked in centavos and never offered when the
 * cash does not cover the payment; the quick amounts are the exact sum and the
 * next round notes; a drawer count adds up exactly; a difference reads as
 * over or short; and a journal amount says which way it moved the bill.
 */
describe('the counter', () => {
  it('works out the change in centavos, and offers none when the cash is short', () => {
    expect(changeDue(2000, 1800)).toBe(200)
    expect(changeDue('1000.00', '999.70')).toBe(0.3)
    expect(changeDue(500, 500)).toBe(0)
    expect(changeDue(400, 500)).toBeNull()
  })

  it('offers the exact sum, then the next round notes above it', () => {
    expect(quickTenderAmounts(1830)).toEqual([1830, 1900, 2000])
    expect(quickTenderAmounts(500)).toEqual([500, 1000])
    expect(quickTenderAmounts(0)).toEqual([])
  })

  it('adds up a drawer count exactly, ignoring blanks and negatives', () => {
    expect(cashCountTotal({ 1000: 1, 500: 1, 100: 3, 50: 1 })).toBe(1850)
    expect(cashCountTotal({ '0.25': 3, 1: '', 5: -2 })).toBe(0.75)
  })

  it('lists the same notes and coins the server accepts', () => {
    expect([...CASH_DENOMINATIONS]).toEqual(['1000', '500', '200', '100', '50', '20', '10', '5', '1', '0.25'])
  })

  it('reads a drawer difference as balanced, over or short', () => {
    expect(shiftVariance('0.00')).toEqual({ label: 'Balanced', tone: 'success' })
    expect(shiftVariance('50.00').tone).toBe('warning')
    expect(shiftVariance('50.00').label).toContain('Over by')
    expect(shiftVariance('-50.00').tone).toBe('danger')
    expect(shiftVariance('-50.00').label).toContain('Short by')
  })
})

describe('the journal', () => {
  it('signs an amount by which way it moved the bill', () => {
    expect(journalAmount({ amount: '900.00' })).toBe(`+${pesos(900)}`)
    expect(journalAmount({ amount: '-500.00' })).toBe(`−${pesos(500)}`)
    expect(journalAmount({ amount: '0.00' })).toBe(pesos(0))
  })

  it('gives money in and money reversed different tones', () => {
    expect(transactionTone('payment')).toBe('success')
    expect(transactionTone('payment_void')).toBe('danger')
    expect(transactionTone('external_settlement')).toBe('success')
    expect(transactionTone('charge')).toBe('muted')
  })
})
