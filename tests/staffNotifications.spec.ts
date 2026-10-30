import { describe, expect, it } from 'vitest'
import { groupByDay, inboxOrder, safeRoute, tabsFor, type StaffNotification } from '~/utils/staffNotifications'

const note = (id: string, created_at: string, extra: Partial<StaffNotification> = {}): StaffNotification => ({
  id, category: 'request', title: id, desc: null, meta: null, icon: null, tone: null,
  action_label: null, action_route: null, urgent: false, read: false, created_at, ...extra,
})

describe('the blood-centre inbox', () => {
  const now = new Date('2026-10-31T10:00:00')

  it('puts an unread emergency first, then the newest', () => {
    const order = inboxOrder([
      note('old', '2026-10-29T08:00:00'),
      note('new', '2026-10-31T09:00:00'),
      note('emergency', '2026-10-30T08:00:00', { urgent: true }),
      note('read-emergency', '2026-10-31T09:30:00', { urgent: true, read: true }),
    ]).map(n => n.id)
    expect(order).toEqual(['emergency', 'read-emergency', 'new', 'old'])
  })

  it('groups by day under Needs attention, Today and Yesterday', () => {
    const labels = groupByDay([
      note('a', '2026-10-31T09:00:00'),
      note('b', '2026-10-30T09:00:00'),
      note('c', '2026-10-30T07:00:00', { urgent: true }),
    ], now).map(g => `${g.label}:${g.items.length}`)
    expect(labels).toEqual(['Needs attention:1', 'Today:1', 'Yesterday:1'])
  })

  it('offers only the kinds a role receives', () => {
    // A Lab Supervisor: results to verify, referrals, corrections.
    expect(tabsFor(['serology_verification', 'referrals', 'corrections']).map(t => t.label)).toEqual(['All', 'Laboratory', 'Corrections'])
    // The Inventory Control Officer: requests and stock.
    expect(tabsFor(['blood_requests', 'low_stock', 'expiring_units']).map(t => t.label)).toEqual(['All', 'Requests', 'Stock'])
    expect(tabsFor([]).map(t => t.label)).toEqual(['All'])
  })

  it('follows only a route inside the app', () => {
    expect(safeRoute('/blood-center/bloodrequests')).toBe('/blood-center/bloodrequests')
    expect(safeRoute('//evil.example')).toBeNull()
    expect(safeRoute('https://evil.example')).toBeNull()
  })
})
