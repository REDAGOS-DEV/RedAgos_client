import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

/**
 * One donor's visit, from the single QR scan to the recorded collection.
 *
 * The point of this composable is that the donor is verified *once*. The scan
 * establishes who is at the counter, which appointment they hold and that it
 * belongs to this facility; everything after that reads the context held here
 * rather than asking the donor to identify themselves again.
 *
 * State is per-page rather than app-wide on purpose. A counter handles one
 * donor at a time, and a transaction that survived navigation would be a
 * donor's identity left lying around on a shared machine.
 */

export type TransactionStage = 'scan' | 'verified' | 'screening' | 'collection' | 'done'

export interface TransactionDonor {
  uuid: string
  donor_code: string
  full_name: string
  blood_type: string | null
  phone: string | null
}

export interface TransactionAppointment {
  id: number
  appointment_datetime: string
  status: string
  status_label: string
  event_id: number | null
}

export interface TransactionDonation {
  id: number
  status: string
  status_label: string
  volume_ml: number | null
  rejection_reason: string | null
  appointment_id: number | null
  screening: Record<string, unknown> | null
}

export function useDonationTransaction() {
  const service = bloodCenterService

  const donor = ref<TransactionDonor | null>(null)
  const appointment = ref<TransactionAppointment | null>(null)
  const donation = ref<TransactionDonation | null>(null)

  const busy = ref(false)
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)

  /**
   * Where the visit has got to, derived from the records rather than tracked.
   *
   * A stage held as its own variable would drift from the server the moment a
   * request failed halfway, and the staff member would be looking at a step
   * that had not actually happened.
   */
  const stage = computed<TransactionStage>(() => {
    if (!donor.value) return 'scan'
    if (!donation.value) return 'verified'

    switch (donation.value.status) {
      case 'registered':
        return 'screening'
      case 'screening':
        return 'collection'
      default:
        return 'done'
    }
  })

  const isDeferred = computed(() => donation.value?.status === 'rejected')
  const isCollected = computed(() => Boolean(donation.value && donation.value.status !== 'registered'
    && donation.value.status !== 'screening' && donation.value.status !== 'rejected'))

  /**
   * Turn a service rejection into something a staff member can act on.
   *
   * The server names every business refusal with a code; those are the cases
   * where a generic message would leave staff guessing what to do next.
   */
  function messageFor(err: any): string {
    const code = err?.data?.code

    switch (code) {
      case 'qr_invalid':
        return 'That QR code is not valid. Ask for the donor’s valid ID instead.'
      case 'donor_not_found':
        return 'No donor matches that code. Ask for their valid ID instead.'
      case 'appointment_not_found':
        return 'That appointment is not booked at this facility.'
      case 'appointment_not_pending':
        return 'This appointment has already been checked in or closed.'
      case 'appointment_donor_mismatch':
        return 'That appointment belongs to a different donor.'
      case 'donation_already_open':
        return err?.data?.message || 'This donor already has a donation in progress.'
      case 'donation_not_screened':
        return 'Record the screening outcome before recording a collection.'
      case 'collection_already_recorded':
        return 'A collection is already recorded for this donation.'
      case 'screening_not_amendable':
        return 'The bag has already been drawn, so the screening can no longer be changed.'
      case 'facility_missing':
        return 'This account is not linked to a facility.'
      default:
        return err?.message || 'Something went wrong. Try again.'
    }
  }

  async function run<T>(work: () => Promise<T>): Promise<T | null> {
    busy.value = true
    error.value = null

    try {
      return await work()
    } catch (err: any) {
      error.value = messageFor(err)
      return null
    } finally {
      busy.value = false
    }
  }

  function adoptDonation(payload: any) {
    donation.value = payload ?? null

    if (payload?.appointment_id && appointment.value?.id !== payload.appointment_id) return

    // Keep the appointment card in step with the donation that closed it.
    if (appointment.value && payload && ['collected', 'tested', 'completed', 'rejected'].includes(payload.status)) {
      appointment.value = { ...appointment.value, status: 'completed', status_label: 'Donated' }
    }
  }

  /**
   * The one scan. Establishes donor, appointment and facility in a single call.
   */
  async function verifyQr(token: string) {
    const result = await run(() => service.verifyDonorQr(token))

    if (!result) return false

    donor.value = result.data?.donor ?? null
    appointment.value = result.data?.appointment ?? null
    donation.value = result.data?.open_donation ?? null

    notice.value = donation.value
      ? `Resuming donation #${donation.value.id} already in progress.`
      : appointment.value
        ? null
        : 'No appointment booked here today. You can still open a walk-in donation.'

    return true
  }

  /**
   * Adopt a donor the staff member found by valid ID instead of a scan.
   */
  function adoptDonor(found: TransactionDonor, existing: TransactionAppointment | null = null) {
    donor.value = found
    appointment.value = existing
    donation.value = null
    error.value = null
    notice.value = null
  }

  async function checkIn() {
    if (!appointment.value) return false

    const result = await run(() => service.checkInAppointment(appointment.value!.id))

    if (!result) return false

    appointment.value = result.data
    return true
  }

  async function markNoShow() {
    if (!appointment.value) return false

    const result = await run(() => service.markAppointmentNoShow(appointment.value!.id))

    if (!result) return false

    appointment.value = result.data
    reset()
    return true
  }

  async function openDonation() {
    if (!donor.value) return false

    const result = await run(() => service.openDonation({
      donor_uuid: donor.value!.uuid,
      ...(appointment.value ? { appointment_id: appointment.value.id } : {}),
    }))

    if (!result) return false

    adoptDonation(result.data)
    notice.value = null
    return true
  }

  async function recordScreening(payload: Record<string, unknown>) {
    if (!donation.value) return false

    const result = await run(() => service.recordScreening(donation.value!.id, payload))

    if (!result) return false

    adoptDonation(result.data)
    notice.value = result.message ?? null
    return true
  }

  async function recordCollection(payload: Record<string, unknown>) {
    if (!donation.value) return false

    const result = await run(() => service.recordCollection(donation.value!.id, payload))

    if (!result) return false

    adoptDonation(result.data)
    notice.value = result.message ?? null
    return true
  }

  /**
   * Clear the counter for the next donor.
   */
  function reset() {
    donor.value = null
    appointment.value = null
    donation.value = null
    error.value = null
    notice.value = null
  }

  return {
    donor,
    appointment,
    donation,
    stage,
    busy,
    error,
    notice,
    isDeferred,
    isCollected,
    verifyQr,
    adoptDonor,
    checkIn,
    markNoShow,
    openDonation,
    recordScreening,
    recordCollection,
    reset,
  }
}
