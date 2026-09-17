import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Booking a cleared donation's bags onto the shelf.
 *
 * The route each call takes is what matters here. Intake is donation-scoped —
 * every unit points back at the donation it came from — and the blood type is
 * never sent, because the server derives it from that donation. A payload that
 * carried a blood type would be a payload that could label a bag wrongly.
 */

const runtimeConfig = { public: { apiBaseURL: 'http://api.test/api' } }
vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

vi.stubGlobal('localStorage', {
  store: new Map<string, string>(),
  getItem(k: string) { return this.store.get(k) ?? null },
  setItem(k: string, v: string) { this.store.set(k, v) },
  removeItem(k: string) { this.store.delete(k) },
})

const { bloodCenterService } = await import('~/api/bloodcenter/BloodCenterService')

beforeEach(() => {
  fetchMock.mockReset()
})

describe('BloodCenterService inventory intake', () => {
  const service = bloodCenterService

  it('reads the intake queue from its own endpoint', async () => {
    fetchMock.mockResolvedValueOnce({ data: [] })
    await service.inventoryIntakeQueue()

    const [url, config] = fetchMock.mock.calls[0]!

    // Not the laboratory queue: Inventory holds donations.view but not
    // lab.view, so that route would 403 for the people who need this one.
    expect(url).toBe('/blood-center/inventory/intake-queue')
    expect(config.method).toBe('GET')
  })

  it('records units against the donation they came from', async () => {
    fetchMock.mockResolvedValueOnce({ units: [] })
    await service.recordBloodUnits({
      donation_id: 7,
      units: [{ component_id: 2, expiry_date: '2026-10-30', storage_location: 'Cold Storage A-1' }],
    })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/inventory')
    expect(config.method).toBe('POST')
    expect(config.body.donation_id).toBe(7)

    // The one field that must never be client-supplied. The server reads it
    // from the donation instead, because a mislabelled unit can kill someone.
    expect(config.body.units[0]).not.toHaveProperty('blood_type_id')
  })

  it('leaves a unit number out when none was typed, so the server allocates one', async () => {
    fetchMock.mockResolvedValueOnce({ units: [] })
    await service.recordBloodUnits({
      donation_id: 7,
      units: [{ component_id: 2, expiry_date: '2026-10-30' }],
    })

    const [, config] = fetchMock.mock.calls[0]!

    expect(config.body.units[0]).not.toHaveProperty('unit_id')
  })

  it('reads component settings from the blood-centre namespace, not admin', async () => {
    fetchMock.mockResolvedValueOnce({ data: [] })
    await service.componentSettings()

    const [url, config] = fetchMock.mock.calls[0]!

    // Shelf life and price are a facility's own setting. An /admin/... path
    // here would mean one centre editing values the other three read.
    expect(url).toBe('/blood-center/blood-components')
    expect(config.method).toBe('GET')
  })

  it('sends a cleared shelf life as null rather than omitting it', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.updateComponentSetting(4, { shelf_life_days: null, price: 0 })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/blood-components/4')
    expect(config.method).toBe('PATCH')
    // Null means "not configured", which intake refuses on. Dropping the key
    // would read as "leave it alone" and the clear would silently not happen.
    expect(config.body).toEqual({ shelf_life_days: null, price: 0 })
  })

  it('discards a unit through the unit-scoped route', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.discardBloodUnit('SNBC-0001-01', { reason: 'Bag compromised' })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/inventory/SNBC-0001-01/discard')
    expect(config.method).toBe('POST')
  })
})
