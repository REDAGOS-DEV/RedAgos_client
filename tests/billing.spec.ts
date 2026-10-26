import { describe, it, expect } from 'vitest'
import {
  attemptTone,
  billStatusShares,
  cashCountTotal,
  CASH_DENOMINATIONS,
  changeDue,
  checkoutUnavailableMessage,
  facilityInitials,
  isAttemptPayable,
  isCounterEvent,
  isAttemptSettled,
  journalAmount,
  journalStatus,
  liveStatementTotals,
  needsReference,
  pesos,
  quickTenderAmounts,
  RECORDED_METHODS,
  receiptFigures,
  referenceName,
  reviewReasonMessage,
  shiftVariance,
  splitEntry,
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

describe('the statement and receipt pages', () => {
  it('takes the balance from the server, so a subsidised bill owes nothing', () => {
    expect(liveStatementTotals({ status: 'partial', total_amount: 1800, collected: 500, outstanding: '1300.00' }))
      .toEqual({ subtotal: 1800, subsidy: 0, paid: 500, balance: 1300 })

    expect(liveStatementTotals({ status: 'subsidised', total_amount: 900, collected: 0, outstanding: '0.00' }))
      .toEqual({ subtotal: 900, subsidy: 900, paid: 0, balance: 0 })
  })

  it('works out what was paid before a receipt from the balance it was made against', () => {
    const receipt = {
      amount_paid: '400.00',
      balance_before: '1300.00',
      balance_after: '900.00',
      statement: { document_number: 'SOA-1-000002', revision_number: 2, total_amount: '1800.00', amount_due: '1300.00' },
    }

    expect(receiptFigures(receipt)).toEqual({ total: 1800, paidBefore: 500, paid: 400, remaining: 900 })
    expect(receiptFigures({ ...receipt, statement: null })).toMatchObject({ total: null, paidBefore: null, remaining: 900 })
  })
})

describe('the counter overview', () => {
  it('keeps the statuses in one order whatever the counts', () => {
    const shares = billStatusShares({ unpaid: 6, paid: 2, partial: 1, subsidised: 1 })

    expect(shares.map((s) => s.key)).toEqual(['paid', 'subsidised', 'partial', 'unpaid'])
    expect(shares.map((s) => s.share)).toEqual([0.2, 0.1, 0.1, 0.6])
  })

  it('draws nothing when there are no bills yet', () => {
    expect(billStatusShares(null).every((s) => s.count === 0 && s.share === 0)).toBe(true)
  })
})

describe("the counter's recent transactions", () => {
  it('reads a payment as paid or part paid by the balance it left', () => {
    expect(journalStatus({ type: 'payment', balance_after: '0.00' })).toEqual({ label: 'Paid', tone: 'success' })
    expect(journalStatus({ type: 'payment', balance_after: '900.00' })).toEqual({ label: 'Part paid', tone: 'warning' })
    expect(journalStatus({ type: 'payment_void', balance_after: '900.00' }).label).toBe('Voided')
    expect(journalStatus({ type: 'subsidy', balance_after: '0.00' }).label).toBe('Subsidised')
  })

  it('leaves out the charges that raise a bill', () => {
    expect(isCounterEvent({ type: 'charge' })).toBe(false)
    expect(isCounterEvent({ type: 'charge_adjustment' })).toBe(false)
    expect(isCounterEvent({ type: 'payment' })).toBe(true)
    expect(isCounterEvent({ type: 'external_settlement' })).toBe(true)
  })
})

describe('payment methods recorded by hand', () => {
  it('offers cash, card, GCash and bank transfer, in the counter order', () => {
    expect(RECORDED_METHODS.map((m) => m.value)).toEqual(['cash', 'card', 'gcash', 'bank_transfer'])
  })

  it('needs a reference for everything but cash', () => {
    expect(needsReference('cash')).toBe(false)
    expect(needsReference('card')).toBe(true)
    expect(needsReference('gcash')).toBe(true)
    expect(needsReference('bank_transfer')).toBe(true)
    // The GCash checkout is confirmed by the provider, not keyed in.
    expect(needsReference('checkout')).toBe(false)
    expect(needsReference(null)).toBe(false)
  })

  it('names each reference for its field', () => {
    expect(referenceName('card')).toBe('Card terminal reference')
    expect(referenceName('bank_transfer')).toBe('Bank transfer reference')
    expect(referenceName('cash')).toBeNull()
  })
})

describe('a payment split across methods', () => {
  it('takes less cash than is due as a part, leaving the rest for another method', () => {
    expect(splitEntry(25000, 0, 'cash', 10000)).toEqual({ remaining: 25000, paid: 10000, change: 0, short: 15000, over: 0 })
  })

  it('gives change only on cash handed over beyond what is left', () => {
    expect(splitEntry(25000, 10000, 'cash', 20000)).toEqual({ remaining: 15000, paid: 15000, change: 5000, short: 0, over: 0 })
    expect(splitEntry(25000, 10000, 'card', 20000)).toEqual({ remaining: 15000, paid: 15000, change: 0, short: 0, over: 5000 })
  })

  it('settles exactly when the last part meets what is left', () => {
    expect(splitEntry('25000.00', 10000, 'bank_transfer', '15000')).toMatchObject({ paid: 15000, short: 0, over: 0 })
  })

  it('counts in centavos, so the parts add up', () => {
    expect(splitEntry(0.3, 0.1, 'cash', 0.2)).toMatchObject({ remaining: 0.2, paid: 0.2, short: 0 })
  })

  it('leaves nothing short until an amount is entered', () => {
    expect(splitEntry(900, 0, 'cash', null)).toEqual({ remaining: 900, paid: 0, change: 0, short: 0, over: 0 })
  })
})
