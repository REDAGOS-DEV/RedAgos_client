import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  ROSTER_STATUS_FILTERS,
  blankPerson,
  donorPrefillFromQuery,
  driveLinkUrl,
  filterRoster,
  groupErrorMessage,
  groupPayload,
  isBlankPerson,
  personPayload,
  personProblem,
  registerDonorQuery,
  rosterName,
  rosterTone,
  selfCheckLabel,
  selfPayload,
  type RosterRow,
} from '~/utils/driveRegistration'

/**
 * Drive pre-registration (project owner, 2026-11-11 and 2026-11-12): a
 * drive's registration link for people without an account and for partners,
 * with no limit and no health questions, and the drive's roster staff read.
 * Staff never type people onto the list; nothing here calls anyone eligible,
 * and outcomes come from the records the server reads.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const source = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

function row(overrides: Partial<RosterRow> = {}): RosterRow {
  return {
    key: 'entry-1',
    kind: 'listed',
    entry_id: 1,
    appointment_id: null,
    donation_id: null,
    walk_in: false,
    first_name: 'Ana',
    last_name: 'Reyes',
    email: 'ana@example.com',
    phone: '+639171234567',
    birth_date: '1998-05-14',
    affiliation: null,
    source: 'self',
    source_label: 'Self',
    organisation: null,
    status: 'pre_registered',
    status_label: 'Pre-registered',
    self_check: 'not_completed',
    donor: null,
    possible_donor: null,
    anonymised: false,
    can: { withdraw: true, match: false, unmatch: false, register: true, check_in: false, open_counter: false },
    ...overrides,
  }
}

describe('the registration link', () => {
  it('is the portal address with /drives/{token}, and nothing without a token', () => {
    expect(driveLinkUrl('https://redagos.org/', 'abc')).toBe('https://redagos.org/drives/abc')
    expect(driveLinkUrl('https://redagos.org', null)).toBe('')
  })

  it('asks for a name and one contact, and sends blanks as null', () => {
    expect(personProblem(blankPerson())).toMatch(/name/)
    expect(personProblem({ ...blankPerson(), first_name: 'Ana', last_name: 'Reyes' })).toMatch(/mobile number or an email/)
    expect(personProblem({ ...blankPerson(), first_name: 'Ana', last_name: 'Reyes', email: 'a@b.co' })).toBe('')
    expect(personPayload({ ...blankPerson(), first_name: ' Ana ', last_name: 'Reyes', phone: '+639171234567' })).toEqual({
      first_name: 'Ana', last_name: 'Reyes', phone: '+639171234567', email: null, birth_date: null, affiliation: null,
    })
  })

  it('sends no health answers: someone without an account is screened in person', () => {
    const payload = selfPayload({ ...blankPerson(), first_name: 'A', last_name: 'B', email: 'a@b.co' }, true)
    expect(payload).toMatchObject({ consent: true })
    expect(payload).not.toHaveProperty('self_check')
  })

  it('drops a partner\'s empty rows rather than refusing them', () => {
    const people = [{ ...blankPerson(), first_name: 'Ben', last_name: 'Cruz', email: 'ben@x.co' }, blankPerson()]
    expect(isBlankPerson(people[1]!)).toBe(true)
    const payload = groupPayload({ organisation_name: ' Red Cross Youth ', contact_name: 'Liza', contact_phone: '', contact_email: 'l@x.co' }, people, true)
    expect(payload).toMatchObject({ organisation_name: 'Red Cross Youth', contact_phone: null, contact_email: 'l@x.co', consent: true })
    expect(payload.people).toHaveLength(1)
  })

  it('names the row a refused partner entry is on, counting from 1', () => {
    expect(groupErrorMessage({ 'people.2.email': ['Enter a valid email address.'] })).toBe('Person 3: Enter a valid email address.')
    expect(groupErrorMessage({ contact_phone: ['Enter a mobile number or an email address for the contact person.'] }))
      .toBe('Enter a mobile number or an email address for the contact person.')
  })
})

describe('the roster', () => {
  it('reads the self-check as Cleared, Needs follow-up or Not completed, never as eligible', () => {
    expect(selfCheckLabel('cleared')).toBe('Cleared')
    expect(selfCheckLabel('follow_up')).toBe('Needs follow-up')
    expect(selfCheckLabel('not_completed')).toBe('Not completed')
    expect(selfCheckLabel(null)).toBe('Not completed')
    for (const value of ['cleared', 'follow_up', 'not_completed']) {
      expect(selfCheckLabel(value)).not.toMatch(/eligib/i)
    }
  })

  it('filters by every status the records produce', () => {
    expect(ROSTER_STATUS_FILTERS.map((f) => f.value)).toEqual([
      '', 'pre_registered', 'booked', 'checked_in', 'collected', 'deferred', 'no_show', 'cancelled', 'withdrawn',
    ])
    expect(rosterTone('collected')).toBe('ok')
    expect(rosterTone('no_show')).toBe('crit')
  })

  it('names an anonymised entry as removed', () => {
    expect(rosterName(row({ anonymised: true, first_name: null, last_name: null }))).toMatch(/Removed/)
  })

  it('searches by name, email, organisation, donor code or a number typed the local way', () => {
    const rows = [
      row(),
      row({ key: 'booking-2', kind: 'booking', first_name: 'Ben', last_name: 'Cruz', email: 'ben@x.co', phone: '+639185556666', source: 'portal', status: 'booked', donor: { uuid: 'u', code: 'DONOR-000042', name: 'Ben Cruz' } }),
      row({ key: 'entry-3', first_name: 'Carla', last_name: 'Dizon', email: 'carla@x.co', phone: '+639990001111', source: 'partner', organisation: 'Red Cross Youth' }),
    ]
    expect(filterRoster(rows, 'reyes', '', '').map((r) => r.key)).toEqual(['entry-1'])
    expect(filterRoster(rows, '0918 555', '', '').map((r) => r.key)).toEqual(['booking-2'])
    expect(filterRoster(rows, 'donor-000042', '', '').map((r) => r.key)).toEqual(['booking-2'])
    expect(filterRoster(rows, 'red cross', '', '').map((r) => r.key)).toEqual(['entry-3'])
    expect(filterRoster(rows, '', 'booked', '').map((r) => r.key)).toEqual(['booking-2'])
    expect(filterRoster(rows, '', '', 'partner').map((r) => r.key)).toEqual(['entry-3'])
  })

  it('opens Donor Management\'s Register Donor form with what the person typed, and reads it back', () => {
    const query = registerDonorQuery(12, row())
    expect(query).toMatchObject({ register: 'drive', drive: '12', entry: '1', first_name: 'Ana', email: 'ana@example.com', phone: '+639171234567' })
    expect(donorPrefillFromQuery(query)).toEqual({
      driveId: '12',
      entryId: '1',
      fields: { first_name: 'Ana', last_name: 'Reyes', phone: '+639171234567', email: 'ana@example.com', birth_date: '1998-05-14' },
    })
    expect(donorPrefillFromQuery({})).toBeNull()
    expect(donorPrefillFromQuery({ register: 'drive', drive: 'x', entry: '1' })).toBeNull()
    expect(donorPrefillFromQuery({ ...query, birth_date: 'soon' })?.fields.birth_date).toBe('')
  })
})

describe('the pages', () => {
  const link = source('app/pages/drives/[token].vue')
  const roster = source('app/pages/blood-center/drive-registrations/[id].vue')
  const drives = source('app/pages/blood-center/drives.vue')
  const donors = source('app/pages/blood-center/donors.vue')

  it('keeps the link page public: the default layout, no auth middleware', () => {
    expect(link).toContain("definePageMeta({ layout: 'default' })")
    expect(link).not.toMatch(/middleware:/)
  })

  it('asks no health questions on the link, and offers sign-in to account holders', () => {
    expect(link).toContain('Sign in to book')
    expect(link).not.toMatch(/self[-_ ]?check/i)
  })

  it('gives staff no way to type a person onto the list', () => {
    expect(roster).not.toMatch(/registerSelf|registerGroup|Add person/)
    expect(roster).toContain("requires: 'drives.manage'")
  })

  it('keeps planning apart from what happened on the day', () => {
    expect(roster).toContain('Pre-registered donors')
    for (const figure of ['Checked in', 'Walk-ins', 'No-show', 'Deferred', 'Collected']) {
      expect(roster).toContain(`label="${figure}"`)
    }
    expect(roster).not.toContain('Expected participants')
  })

  it('sends a check-in and a walk-in on to the Donation counter', () => {
    expect(roster).toContain('bloodCenterService.checkInDriveRegistration(')
    expect(roster).toContain('bloodCenterService.driveWalkIn(')
    expect(roster.match(/\/blood-center\/donation\?donor=/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('confirms in its own dialogs, with focus kept inside', () => {
    expect(roster.match(/v-focus-trap/g)?.length).toBe(2)
    expect(roster).toContain('@dialog-escape="closeConfirm"')
    expect(roster).toContain('@dialog-escape="closeWalkIn"')
  })

  it('reaches the roster from each published drive', () => {
    expect(drives).toContain('/blood-center/drive-registrations/${drive.id}')
  })

  it('lets Donor Management register someone from the roster and link them', () => {
    expect(donors).toContain('donorPrefillFromQuery(route.query)')
    expect(donors).toContain('bloodCenterService.matchDriveRegistration(')
  })
})
