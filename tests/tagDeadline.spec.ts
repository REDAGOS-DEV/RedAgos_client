import { describe, it, expect } from 'vitest'
import {
  actionsFor,
  bloodTypeMismatch,
  deadlineTier,
  formatRemaining,
  remainingMs,
  serverSkew,
  suggestedRequirement,
} from '~/utils/tagDeadline'
import { HOSPITAL_UNIT_STATUS_TONES, HOSPITAL_UNIT_STATUSES, UNIT_TAG_STATUS_TONES } from '~/types/hospitalInventory'

/**
 * The countdown on a hospital tag, and what each bag offers next.
 *
 * What is locked in: the countdown runs on the server's clock, never goes
 * below zero, and reads the way staff say it; and the actions offered mirror
 * the API's transition map — crossmatch before transfusion, nothing after a
 * transfusion, and nothing but discard for a bag past its date.
 */

const HOUR = 3_600_000
const MINUTE = 60_000

describe('the time left on a tag', () => {
  const deadline = '2026-10-03T08:00:00Z'
  const at = (iso: string) => Date.parse(iso)

  it('counts down to the deadline and stops at zero', () => {
    expect(remainingMs(deadline, at('2026-10-02T08:00:00Z'))).toBe(24 * HOUR)
    expect(remainingMs(deadline, at('2026-10-03T07:59:00Z'))).toBe(MINUTE)
    expect(remainingMs(deadline, at('2026-10-03T08:00:00Z'))).toBe(0)
    expect(remainingMs(deadline, at('2026-10-03T09:00:00Z'))).toBe(0)
  })

  it('measures against the server clock, not a wrong browser clock', () => {
    // The browser runs ten minutes fast.
    const received = at('2026-10-02T08:10:00Z')
    const skew = serverSkew('2026-10-02T08:00:00Z', received)

    expect(skew).toBe(10 * MINUTE)
    expect(remainingMs(deadline, received, skew)).toBe(24 * HOUR)
  })

  it('treats a missing or unreadable deadline as nothing left, and a missing clock as no skew', () => {
    expect(remainingMs(null, Date.now())).toBe(0)
    expect(remainingMs('not a date', Date.now())).toBe(0)
    expect(serverSkew(undefined, Date.now())).toBe(0)
  })

  it('reads the way staff say it', () => {
    expect(formatRemaining(18 * HOUR + 32 * MINUTE)).toBe('18h 32m')
    expect(formatRemaining(11 * HOUR + 8 * MINUTE + 59_000)).toBe('11h 08m')
    expect(formatRemaining(45 * MINUTE)).toBe('45m')
    expect(formatRemaining(30_000)).toBe('under a minute')
    expect(formatRemaining(0)).toBe('Overdue')
  })

  it('grows more urgent as the deadline nears', () => {
    expect(deadlineTier(10 * HOUR)).toBe('ok')
    expect(deadlineTier(5 * HOUR)).toBe('soon')
    expect(deadlineTier(90 * MINUTE)).toBe('critical')
    expect(deadlineTier(0)).toBe('overdue')
  })
})

describe('what a bag offers next', () => {
  it('is tag or discard on the shelf, and only discard past its date', () => {
    expect(actionsFor('available')).toEqual(['tag', 'discard'])
    expect(actionsFor('available', true)).toEqual(['discard'])
    expect(actionsFor('expired')).toEqual(['discard'])
  })

  it('never offers a transfusion before the crossmatch', () => {
    expect(actionsFor('tag_assigned')).toEqual(['crossmatch', 'release'])
    expect(actionsFor('tag_assigned')).not.toContain('transfuse')
    expect(actionsFor('tag_crossmatched')).toEqual(['transfuse', 'release'])
  })

  it('offers only release on a tagged bag past its date', () => {
    expect(actionsFor('tag_assigned', true)).toEqual(['release'])
    expect(actionsFor('tag_crossmatched', true)).toEqual(['release'])
  })

  it('asks for the return or discard of a bag that came back', () => {
    expect(actionsFor('pending_return')).toEqual(['return', 'discard'])
  })

  it('offers nothing once a bag is transfused or discarded', () => {
    expect(actionsFor('transfused')).toEqual([])
    expect(actionsFor('discarded')).toEqual([])
  })
})

describe('tagging helpers', () => {
  it('suggests the request a bag was received for', () => {
    expect(suggestedRequirement({ source: { request_id: 4, reference_number: 'RQ-1-0004', transfusion_request_id: 9, transfusion_reference: 'PTR-1-0009' } }))
      .toEqual({ id: 9, reference: 'PTR-1-0009' })
    expect(suggestedRequirement({ source: { request_id: 4, reference_number: 'RQ-1-0004', transfusion_request_id: null, transfusion_reference: null } }))
      .toBeNull()
  })

  it('warns on a blood type mismatch only when both are known', () => {
    expect(bloodTypeMismatch('A+', 'O+')).toBe(true)
    expect(bloodTypeMismatch('O+', 'O+')).toBe(false)
    expect(bloodTypeMismatch(null, 'O+')).toBe(false)
  })
})

describe('how the states are drawn', () => {
  it('never draws Tag Assigned and Tag Crossmatched alike', () => {
    expect(HOSPITAL_UNIT_STATUS_TONES.tag_assigned).not.toBe(HOSPITAL_UNIT_STATUS_TONES.tag_crossmatched)
    expect(UNIT_TAG_STATUS_TONES.tag_assigned).not.toBe(UNIT_TAG_STATUS_TONES.tag_crossmatched)
  })

  it('has a tone for every status the API can send', () => {
    for (const status of HOSPITAL_UNIT_STATUSES) {
      expect(HOSPITAL_UNIT_STATUS_TONES[status]).toBeTruthy()
    }
  })
})
