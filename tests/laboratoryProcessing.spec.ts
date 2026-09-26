import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The laboratory's side of a donation.
 *
 * What is worth locking in here is the route each action takes. `completed` on
 * a donation means *cleared for issue to a patient*, and it is only ever set
 * through the laboratory status route — if one of these URLs drifted onto a
 * collection endpoint, the counter would gain the ability to put untested
 * blood into issuable stock.
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

describe('BloodCenterService laboratory endpoints', () => {
  const service = bloodCenterService

  it('reads the laboratory queue, not the collection one', async () => {
    fetchMock.mockResolvedValueOnce({ data: [] })
    await service.laboratoryQueue()

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/laboratory/queue')
    expect(config.method).toBe('GET')
  })

  it('records immunohematology against the donation it belongs to', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.recordImmunohematology(42, { blood_type_id: 3 })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/laboratory/donations/42/immunohematology')
    expect(config.method).toBe('POST')
    // `recorded_by` is never sent: the server takes it from the bearer token,
    // so a section cannot be attributed to someone who did not screen it.
    expect(config.body).toEqual({ blood_type_id: 3 })
  })

  it('records the serology panel on its own endpoint', async () => {
    const panel = { hiv: 'non_reactive', hbsag: 'non_reactive', hcv: 'non_reactive', syphilis: 'non_reactive', malaria: 'non_reactive' }

    fetchMock.mockResolvedValueOnce({})
    await service.recordSerology(42, panel)

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/laboratory/donations/42/serology')
    expect(config.method).toBe('POST')
    expect(config.body).toEqual(panel)
    expect(config.body).not.toHaveProperty('recorded_by')
  })

  it('no longer offers a way to record an overall result directly', () => {
    // The outcome is derived from the two sections on the server. A client
    // call that set it would let a donation pass without all five markers.
    expect((service as any).recordTestResult).toBeUndefined()
  })

  it('reads and moves on counselling referrals in the laboratory namespace', async () => {
    fetchMock.mockResolvedValueOnce({ data: [] })
    await service.counsellingReferrals({ status: 'open' })

    let [url, config] = fetchMock.mock.calls[0]!
    expect(url).toBe('/blood-center/laboratory/referrals')
    expect(config.method).toBe('GET')

    fetchMock.mockResolvedValueOnce({})
    await service.updateCounsellingReferral(7, { status: 'contacted', note: null })

    ;[url, config] = fetchMock.mock.calls[1]!
    expect(url).toBe('/blood-center/laboratory/referrals/7')
    expect(config.method).toBe('PATCH')
    expect(config.body).toEqual({ status: 'contacted', note: null })
  })

  it('declares components on their own endpoint', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.declareComponents(42, { components: [{ component_id: 1, quantity: 2 }] })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/laboratory/donations/42/components')
    expect(config.method).toBe('POST')
    expect(config.body).toEqual({ components: [{ component_id: 1, quantity: 2 }] })
  })

  it('clears for issue through the laboratory status route', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.updateLaboratoryStatus(42, { status: 'completed' })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/laboratory/donations/42/status')
    expect(config.method).toBe('PATCH')
    expect(config.body).toEqual({ status: 'completed' })
  })

  it('carries the reason when a unit is rejected', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.updateLaboratoryStatus(42, { status: 'rejected', rejection_reason: 'Clotted during separation.' })

    const [, config] = fetchMock.mock.calls[0]!

    expect(config.body).toEqual({ status: 'rejected', rejection_reason: 'Clotted during separation.' })
  })

  it('reads one donation from the laboratory namespace', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.laboratoryDonation(42)

    expect(fetchMock.mock.calls[0]![0]).toBe('/blood-center/laboratory/donations/42')
  })
})
