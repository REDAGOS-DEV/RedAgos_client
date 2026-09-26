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

/**
 * What the scan tells the counter about the donor's questionnaire.
 *
 * Metadata only. Enough to draw the summary strip and decide whether to warn
 * about a superseded form or missing consent, with no answers in it -- the
 * document comes from its own endpoint when staff ask for it.
 */
export interface QuestionnaireMeta {
  available: boolean
  screening_id: number | null
  question_version: number | null
  is_current_version: boolean | null
  question_count: number | null
  screened_on: string | null
  valid_until: string | null
  consent_captured: boolean
}

/**
 * A permanent or indefinite deferral already on this donor's record.
 *
 * Carries no reason: what check-in needs is that a decision exists and when it
 * was made. The reason is clinical detail and lives behind the donor's history.
 *
 * It blocks nothing. The officer reads it and decides.
 */
export interface PriorDeferral {
  outcome: string
  outcome_label: string
  recorded_on: string | null
}

/**
 * The "For Phlebotomist Use Only" box of Section II, as the server recorded it.
 *
 * Collections recorded before the box existed carry only who drew the bag and
 * when; their bag, segment and times are null.
 */
export interface TransactionCollection {
  blood_bag_type: string | null
  blood_bag_type_label: string | null
  segment_number: string | null
  started_at: string | null
  ended_at: string | null
  collected_at: string | null
  phlebotomist: string | null
}

export interface TransactionDonation {
  id: number
  status: string
  status_label: string
  volume_ml: number | null
  rejection_reason: string | null
  appointment_id: number | null
  screening: Record<string, unknown> | null
  collection?: TransactionCollection | null
}

export function useDonationTransaction() {
  const service = bloodCenterService

  const donor = ref<TransactionDonor | null>(null)
  const appointment = ref<TransactionAppointment | null>(null)
  const donation = ref<TransactionDonation | null>(null)

  const busy = ref(false)
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)

  // The questionnaire is held apart from the donation on purpose: it belongs to
  // the donor and outlives any single visit, and it must stay readable from the
  // moment they are verified right through to the end of the collection. Staff
  // compare their own findings against these answers while recording them.
  const priorDeferral = ref<PriorDeferral | null>(null)

  /**
   * The four boxes printed at the top of the donor's questionnaire sheet.
   *
   * They live here rather than in either component because both touch them:
   * the questionnaire drawer is where staff fill them in, since that is where
   * they sit on the paper, and the screening form is what carries them to the
   * server. Holding them in one place is what stops the two drifting.
   *
   * Staff-entered throughout. The donor never fills these in the app — the
   * officer asks in person and types what they are told, which is why they are
   * editable in an otherwise read-only document.
   */
  const intakeForm = reactive({
    sleep: '',
    meal: '',
    meds: '',
    allergies: '',
  })

  function resetIntake() {
    Object.assign(intakeForm, { sleep: '', meal: '', meds: '', allergies: '' })
  }
  const questionnaireMeta = ref<QuestionnaireMeta | null>(null)
  const questionnaire = ref<Record<string, unknown> | null>(null)
  const questionnaireOpen = ref(false)
  const questionnaireError = ref<string | null>(null)
  const questionnaireLoading = ref(false)

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

    // Two counters scanning the same tube, or a mis-scan. The server says it
    // in a validation error rather than a code, from the rule or the index.
    const segmentError = err?.data?.errors?.segment_number?.[0]
    if (segmentError) return segmentError

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
      case 'donor_not_presented':
        return 'This donor has not presented here yet. Open their donation first, then review the questionnaire.'
      case 'questionnaire_not_found':
        return 'This donor has not completed the health questionnaire in the app.'
      case 'questionnaire_unavailable':
        return 'The questionnaire is temporarily unavailable. Try again shortly.'
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

    // A screening already recorded for this visit carries these, so a staff
    // member reopening the drawer sees what was entered rather than a blank
    // set of boxes they would have to fill twice.
    const screening = payload?.screening

    if (screening) {
      Object.assign(intakeForm, {
        sleep: screening.sleep ?? '',
        meal: screening.meal ?? '',
        meds: screening.meds ?? '',
        allergies: screening.allergies ?? '',
      })
    }

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
    questionnaireMeta.value = result.data?.health_questionnaire ?? null
    priorDeferral.value = result.data?.prior_deferral ?? null

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
  function adoptDonor(
    found: TransactionDonor,
    existing: TransactionAppointment | null = null,
    deferral: PriorDeferral | null = null,
  ) {
    donor.value = found
    appointment.value = existing
    donation.value = null
    error.value = null
    notice.value = null

    // Found by ID rather than scanned, so there is no pinned screening and no
    // metadata to draw the strip from. The questionnaire is still reachable --
    // the server resolves which one -- but only once loadQuestionnaire() asks.
    questionnaireMeta.value = null
    questionnaire.value = null
    questionnaireError.value = null

    // The ID lookup carries the same notice the scan does. A donor who left
    // their phone at home — or one a laboratory result permanently deferred —
    // must not walk past it. Outcome and date only; the reason stays behind
    // the donor's history.
    priorDeferral.value = deferral
  }

  /**
   * Fetch the questionnaire, once per visit.
   *
   * Cached rather than re-fetched on every open: it cannot change while the
   * donor stands at the counter, and re-requesting would write another audit
   * entry each time a staff member closed and reopened the drawer.
   */
  async function loadQuestionnaire(force = false) {
    if (!donor.value) return false
    if (questionnaire.value && !force) return true

    questionnaireLoading.value = true
    questionnaireError.value = null

    try {
      const params: Record<string, number> = {}
      if (questionnaireMeta.value?.screening_id) {
        params.screening_id = questionnaireMeta.value.screening_id
      }

      const result = await service.donorHealthQuestionnaire(donor.value.uuid, params)
      questionnaire.value = result.data ?? null

      return true
    } catch (err: any) {
      questionnaireError.value = messageFor(err)
      return false
    } finally {
      questionnaireLoading.value = false
    }
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
    questionnaireMeta.value = null
    questionnaire.value = null
    questionnaireOpen.value = false
    questionnaireError.value = null
    priorDeferral.value = null
    resetIntake()
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
    priorDeferral,
    intakeForm,
    resetIntake,
    questionnaireMeta,
    questionnaire,
    questionnaireOpen,
    questionnaireError,
    questionnaireLoading,
    loadQuestionnaire,
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
