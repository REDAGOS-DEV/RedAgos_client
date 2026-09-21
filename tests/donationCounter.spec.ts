import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed, reactive } from 'vue'

/**
 * The counter's one-scan donation transaction.
 *
 * What is worth locking in here is the rule the whole workflow rests on: the
 * donor is verified once, and every later stage reads that context instead of
 * asking who they are again. The stage machine is derived from the donation
 * record rather than tracked separately, so these tests are also what stops it
 * drifting out of step with the server after a failed request.
 */

// --- Nuxt auto-imports the composable expects ------------------------------
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('reactive', reactive)

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

const { useDonationTransaction } = await import('~/composables/useDonationTransaction')
const { bloodCenterService } = await import('~/api/bloodcenter/BloodCenterService')

const DONOR = {
  uuid: 'donor-uuid',
  donor_code: 'DONOR-000123',
  full_name: 'Juan Dela Cruz',
  blood_type: 'O+',
  phone: '09171234567',
}

const APPOINTMENT = {
  id: 7,
  appointment_datetime: '2026-09-15T09:00:00.000Z',
  status: 'scheduled',
  status_label: 'Scheduled',
  event_id: null,
}

function donation(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: 42,
    status,
    status_label: status,
    volume_ml: null,
    rejection_reason: null,
    appointment_id: APPOINTMENT.id,
    screening: null,
    ...extra,
  }
}

/** Shape ofetch throws: the parsed body hangs off `response._data`. */
function httpError(status: number, data: any = {}) {
  const err: any = new Error(data.message || `HTTP ${status}`)
  err.response = { status, _data: data }
  err.data = data
  err.status = status
  return err
}

beforeEach(() => {
  fetchMock.mockReset()
})

describe('useDonationTransaction', () => {
  it('starts on the scan stage with nothing verified', () => {
    const tx = useDonationTransaction()

    expect(tx.stage.value).toBe('scan')
    expect(tx.donor.value).toBeNull()
  })

  it('one scan establishes donor, appointment and any open donation', async () => {
    fetchMock.mockResolvedValueOnce({
      data: { donor: DONOR, appointment: APPOINTMENT, open_donation: null },
    })

    const tx = useDonationTransaction()
    const ok = await tx.verifyQr('raw-token')

    expect(ok).toBe(true)
    expect(tx.donor.value).toEqual(DONOR)
    expect(tx.appointment.value).toEqual(APPOINTMENT)
    // Verified but no donation open yet — the next act is to start one.
    expect(tx.stage.value).toBe('verified')
  })

  it('resumes a donation that is already in progress', async () => {
    fetchMock.mockResolvedValueOnce({
      data: { donor: DONOR, appointment: APPOINTMENT, open_donation: donation('screening') },
    })

    const tx = useDonationTransaction()
    await tx.verifyQr('raw-token')

    // A staff member who closed the tab mid-visit must land back where they
    // were, not open a second donation for the same donor.
    expect(tx.stage.value).toBe('collection')
    expect(tx.notice.value).toContain('Resuming donation #42')
  })

  it('says so when the donor has no appointment here today', async () => {
    fetchMock.mockResolvedValueOnce({
      data: { donor: DONOR, appointment: null, open_donation: null },
    })

    const tx = useDonationTransaction()
    await tx.verifyQr('raw-token')

    expect(tx.appointment.value).toBeNull()
    expect(tx.notice.value).toContain('walk-in')
  })

  it('turns a refused QR into an instruction, not a raw error', async () => {
    fetchMock.mockRejectedValueOnce(httpError(404, { code: 'qr_invalid', message: 'This QR code is not valid.' }))

    const tx = useDonationTransaction()
    const ok = await tx.verifyQr('nonsense')

    expect(ok).toBe(false)
    expect(tx.donor.value).toBeNull()
    // Staff need to know what to do next, not what the server called it.
    expect(tx.error.value).toContain('valid ID')
  })

  it('names the donation already open rather than refusing blankly', async () => {
    fetchMock
      .mockResolvedValueOnce({ data: { donor: DONOR, appointment: null, open_donation: null } })
      .mockRejectedValueOnce(httpError(409, {
        code: 'donation_already_open',
        message: 'This donor already has a donation in progress (#42).',
      }))

    const tx = useDonationTransaction()
    await tx.verifyQr('raw-token')
    await tx.openDonation()

    expect(tx.error.value).toContain('#42')
  })

  it('walks registered to screening to collection as the record changes', async () => {
    fetchMock.mockResolvedValueOnce({ data: { donor: DONOR, appointment: APPOINTMENT, open_donation: null } })

    const tx = useDonationTransaction()
    await tx.verifyQr('raw-token')

    fetchMock.mockResolvedValueOnce({ data: donation('registered') })
    await tx.openDonation()
    expect(tx.stage.value).toBe('screening')

    fetchMock.mockResolvedValueOnce({ data: donation('screening') })
    await tx.recordScreening({ outcome: 'qualified' })
    expect(tx.stage.value).toBe('collection')

    fetchMock.mockResolvedValueOnce({ data: donation('collected', { volume_ml: 450 }) })
    await tx.recordCollection({ volume_ml: 450 })
    expect(tx.stage.value).toBe('done')
    expect(tx.isDeferred.value).toBe(false)
  })

  it('a deferral ends the visit and closes the appointment in the UI', async () => {
    fetchMock.mockResolvedValueOnce({ data: { donor: DONOR, appointment: APPOINTMENT, open_donation: null } })

    const tx = useDonationTransaction()
    await tx.verifyQr('raw-token')

    fetchMock.mockResolvedValueOnce({ data: donation('registered') })
    await tx.openDonation()

    fetchMock.mockResolvedValueOnce({
      data: donation('rejected', { rejection_reason: 'Haemoglobin below the accepted threshold.' }),
    })
    await tx.recordScreening({ outcome: 'deferred', deferral_reason: 'Haemoglobin below the accepted threshold.' })

    expect(tx.stage.value).toBe('done')
    expect(tx.isDeferred.value).toBe(true)
    // The slot must not keep reading as held once the donor has gone home.
    expect(tx.appointment.value?.status).toBe('completed')
  })

  it('reset clears the donor so the next person starts from a scan', async () => {
    fetchMock.mockResolvedValueOnce({ data: { donor: DONOR, appointment: APPOINTMENT, open_donation: null } })

    const tx = useDonationTransaction()
    await tx.verifyQr('raw-token')
    tx.reset()

    // A shared counter machine must not leave one donor's identity on screen.
    expect(tx.donor.value).toBeNull()
    expect(tx.appointment.value).toBeNull()
    expect(tx.stage.value).toBe('scan')
  })
})

describe('BloodCenterService counter endpoints', () => {
  const service = bloodCenterService

  it('posts only the scanned token to verify-qr', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.verifyDonorQr('raw-token')

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/collection/verify-qr')
    expect(config.method).toBe('POST')
    // The facility comes from the bearer token, never the body — sending one
    // would let a scan be attributed to a centre the staff member is not at.
    expect(config.body).toEqual({ token: 'raw-token' })
  })

  it('records a screening on its own endpoint, not the status route', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.recordScreening(42, { outcome: 'qualified' })

    const [url, config] = fetchMock.mock.calls[0]!

    // `screening` is reached by recording one, the same way `collected` is
    // reached by recording a collection.
    expect(url).toBe('/blood-center/donations/42/screening')
    expect(config.method).toBe('POST')
  })

  it('records a collection on the donation it belongs to', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.recordCollection(42, { volume_ml: 450 })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/donations/42/collection')
    expect(config.body).toEqual({ volume_ml: 450 })
  })

  it('checks in against the appointment route', async () => {
    fetchMock.mockResolvedValueOnce({})
    await service.checkInAppointment(7)

    expect(fetchMock.mock.calls[0]![0]).toBe('/blood-center/appointments/7/check-in')
  })
})
