import BaseService from '../BaseService'
import type {
  Billing,
  BillingSummary,
  BloodRequest,
  CashShift,
  CounterBill,
  CreateWalkInPayload,
  DuplicateMatch,
  PaymentAttempt,
  PaymentReceiptSummary,
  RequestEvent,
  StatementRevision,
  WalkInReference,
} from '~/types/bloodRequest'
import type { SaveStockThresholdsPayload, StockThresholdStatus } from '~/types/stockThreshold'

class BloodCenterService extends BaseService {
  private static instance: BloodCenterService | null = null
  private resource: string

  constructor() {
    super()
    this.resource = '/blood-center'
  }

  public static getInstance(): BloodCenterService {
    if (!BloodCenterService.instance) {
      BloodCenterService.instance = new BloodCenterService()
    }
    return BloodCenterService.instance
  }

  // Walay register(), registrationStatus() ug resubmitRegistration() dinhi.
  // Gitangtang na sa server ang tulo ka endpoint: ang Super Admin ra ang
  // mohimo og facility pinaagi sa POST /admin/facilities, so wala nay
  // registration nga i-submit o i-follow-up.

  async referenceData(): Promise<any> {
    return this.request(`${this.resource}/reference-data`, 'GET')
  }

  async dashboard(): Promise<any> {
    return this.request(`${this.resource}/dashboard`, 'GET')
  }

  async profile(): Promise<any> {
    return this.request(`${this.resource}/profile`, 'GET')
  }

  async updateProfile(payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/profile`, 'PATCH', payload)
  }

  async updatePassword(payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/password`, 'POST', payload)
  }

  // --- Collection department ---

  async collectionQueue(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/collection/queue`, 'GET', params)
  }

  async checkInAppointment(appointmentId: number): Promise<any> {
    return this.request(`${this.resource}/appointments/${appointmentId}/check-in`, 'POST')
  }

  async markAppointmentNoShow(appointmentId: number): Promise<any> {
    return this.request(`${this.resource}/appointments/${appointmentId}/no-show`, 'POST')
  }

  // Ang scanned nga token ra ang ipadala. Ang facility kay gikan sa bearer
  // token sa staff, dili gikan sa request — mao nay nag-scope sa verification
  // ngadto sa center nga gi-scanan.
  async verifyDonorQr(token: string): Promise<any> {
    return this.request(`${this.resource}/collection/verify-qr`, 'POST', { token })
  }

  // --- Active donation transaction (Collection) ---

  async donations(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donations`, 'GET', params)
  }

  async openDonation(payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donations`, 'POST', payload)
  }

  async updateDonationStatus(donationId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donations/${donationId}/status`, 'PATCH', payload)
  }

  // Mao ni ang mo-abli sa `screening` nga status — dili ang updateDonationStatus.
  // Pareho sa collection: kinahanglan naay record, dili lang status.
  async recordScreening(donationId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donations/${donationId}/screening`, 'POST', payload)
  }

  async recordCollection(donationId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donations/${donationId}/collection`, 'POST', payload)
  }

  // --- Laboratory queue (Testing and Processing departments) ---
  //
  // Picks up where the counter stops. The counter leaves a donation at
  // `collected`; nothing here is reachable before that, and `completed` —
  // cleared for issue to a patient — is only ever set by Processing here.

  async laboratoryQueue(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/laboratory/queue`, 'GET', params)
  }

  async laboratoryDonation(donationId: number): Promise<any> {
    return this.request(`${this.resource}/laboratory/donations/${donationId}`, 'GET')
  }

  // --- Testing department: Section II of the DOH form ---
  //
  // Duha ka section, gi-save nga tagsa-tagsa, para ang matag usa naay kaugalingon
  // nga "Screened by". Walay endpoint nga direkta mo-record og overall result:
  // gikan kini sa duha, so walay donation nga makapasar nga kulang og marker.

  /** ABO + Rh, as one `blood_type_id`. */
  async recordImmunohematology(donationId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/laboratory/donations/${donationId}/immunohematology`, 'POST', payload)
  }

  /**
   * The five-marker panel. A reactive marker must carry `confirm_reactive: true`:
   * it rejects the donation, permanently defers the donor and refers them.
   */
  async recordSerology(donationId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/laboratory/donations/${donationId}/serology`, 'POST', payload)
  }

  /**
   * A technologist's reactive panel waits for the Laboratory Supervisor:
   * verifying it rejects the donation, defers and refers the donor; returning
   * it clears the panel for re-entry. Both need `lab.verify_serology`.
   */
  async verifySerology(donationId: number): Promise<any> {
    return this.request(`${this.resource}/laboratory/donations/${donationId}/serology/verify`, 'POST')
  }

  async returnSerology(donationId: number): Promise<any> {
    return this.request(`${this.resource}/laboratory/donations/${donationId}/serology/return`, 'POST')
  }

  /**
   * Every serology panel recorded at this centre, marker by marker (TTI
   * Testing only). Each row says whether it can still be corrected.
   */
  async serologyResults(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/laboratory/serology-results`, 'GET', params)
  }

  async exportSerologyResults(params: Record<string, any> = {}): Promise<Blob> {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => [k, String(v)]),
    ).toString()

    return this.requestBlob(`${this.resource}/laboratory/serology-results/export${query ? `?${query}` : ''}`)
  }

  /** Donors with a reactive result the Testing department must follow up. */
  // --- Correction requests ---
  //
  // A saved record is never saved over. Its writer asks; the department's
  // approver or the Center Admin decides, and the server applies it.

  async corrections(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/corrections`, 'GET', params)
  }

  async requestCorrection(donationId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donations/${donationId}/corrections`, 'POST', payload)
  }

  /** A unit's storage location or expiry date. The subject is fixed by the route. */
  async requestUnitCorrection(unitId: string, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/inventory/${encodeURIComponent(unitId)}/corrections`, 'POST', payload)
  }

  /** When a dispatched unit left, and who took it. */
  async requestDispatchCorrection(allocationId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/allocations/${allocationId}/corrections`, 'POST', payload)
  }

  /** A recorded payment's amount, method or reference number. */
  async requestPaymentCorrection(paymentId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/payments/${paymentId}/corrections`, 'POST', payload)
  }

  /**
   * Ask for a counter payment to be voided, on the Billing Supervisor's
   * approval. Only while its cash shift is open; later is a refund, settled
   * outside RedAgos.
   */
  async requestPaymentVoid(paymentId: number, reason: string): Promise<any> {
    return this.request(`${this.resource}/payments/${paymentId}/void`, 'POST', { reason })
  }

  async approveCorrection(correctionId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/corrections/${correctionId}/approve`, 'POST', payload)
  }

  async rejectCorrection(correctionId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/corrections/${correctionId}/reject`, 'POST', payload)
  }

  async counsellingReferrals(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/laboratory/referrals`, 'GET', params)
  }

  async updateCounsellingReferral(referralId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/laboratory/referrals/${referralId}`, 'PATCH', payload)
  }

  /** How many referrals nobody has acted on, for the sidebar. Not audited, unlike the list. */
  async counsellingReferralsSummary(): Promise<any> {
    return this.request(`${this.resource}/laboratory/referrals/summary`, 'GET')
  }

  /** The mail icon: ask the donor to contact the centre, by email (if any) and in the app. */
  async requestReferralContact(referralId: number): Promise<any> {
    return this.request(`${this.resource}/laboratory/referrals/${referralId}/contact-request`, 'POST')
  }

  async declareComponents(donationId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/laboratory/donations/${donationId}/components`, 'POST', payload)
  }

  /**
   * Print, or reprint, a donation's final (Phase 2) labels — verified blood
   * type, expiry, clearance codes — one per declared bag. Processing's, once
   * Testing has cleared the donation (project owner, 2026-10-22). A POST: the
   * server records who labelled the bags and when, which the hand-over needs.
   */
  async printFinalLabels(donationId: number): Promise<any> {
    return this.request(`${this.resource}/laboratory/donations/${donationId}/labels`, 'POST')
  }

  /** Clear for issue, or reject. The only two outcomes the laboratory may set. */
  async updateLaboratoryStatus(donationId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/laboratory/donations/${donationId}/status`, 'PATCH', payload)
  }

  /** Processing's Processed list: every donation with a recorded breakdown, where it is handed over. */
  async processedDonations(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/laboratory/processed`, 'GET', params)
  }

  async exportProcessedDonations(params: Record<string, any> = {}): Promise<Blob> {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => [k, String(v)]),
    ).toString()

    return this.requestBlob(`${this.resource}/laboratory/processed/export${query ? `?${query}` : ''}`)
  }

  // --- Donor management (Collection department) ---
  //
  // Ang server nga prefix kay `/blood-center/donors` — dili `/bloodcenter/...`
  // nga gigamit sa Donors.vue kaniadto. Ang daan nga path wala mo-match og bisan
  // unsang route ug wala pod nagdala og bearer token.

  async donors(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donors`, 'GET', params)
  }

  async lookupDonor(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donors/lookup`, 'GET', params)
  }

  async createDonor(payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donors`, 'POST', payload)
  }

  async showDonor(uuid: string): Promise<any> {
    return this.request(`${this.resource}/donors/${uuid}`, 'GET')
  }

  async donorHistory(uuid: string): Promise<any> {
    return this.request(`${this.resource}/donors/${uuid}/history`, 'GET')
  }

  /**
   * Correct a donor's record. Only what is sent changes; the server decides
   * which fields this centre may change for this donor (`editable` on the
   * profile says the same in advance).
   */
  async updateDonor(uuid: string, payload: Record<string, any>): Promise<any> {
    return this.request(`${this.resource}/donors/${uuid}`, 'PATCH', payload)
  }

  /**
   * Give a walk-in donor their app sign-in: { donor_code, email,
   * temporary_password, reissued }. The password is in this answer only; the
   * server keeps a hash. Giving it again replaces it and signs the donor out.
   */
  async issueDonorSignIn(uuid: string): Promise<any> {
    return this.request(`${this.resource}/donors/${uuid}/sign-in`, 'POST')
  }

  /** FormData with a `photo` file. */
  async uploadDonorPhoto(uuid: string, form: FormData): Promise<any> {
    return this.request(`${this.resource}/donors/${uuid}/photo`, 'POST', form)
  }

  /**
   * The filtered donor list as a CSV that opens in Excel. requestBlob takes no
   * params, so the filters ride in the query string.
   */
  async exportDonors(params: Record<string, any> = {}): Promise<Blob> {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => [k, String(v)]),
    ).toString()

    return this.requestBlob(`${this.resource}/donors/export${query ? `?${query}` : ''}`)
  }

  /** Who the eligibility reminder would reach, without sending: { recipients, skipped }. */
  async donorReminderPreview(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donors/eligibility-reminders`, 'GET', params)
  }

  async sendDonorReminders(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donors/eligibility-reminders`, 'POST', params)
  }

  /** template: 'thank_you' | 'eligibility_reminder' */
  async emailDonor(uuid: string, template: string): Promise<any> {
    return this.request(`${this.resource}/donors/${uuid}/email`, 'POST', { template })
  }

  // --- Deferrals ---
  // Deferrals recorded on a donor by hand, outside a visit's screening. Every
  // other screen hears of them through the donor's standing, never from here.

  /** Paginated, this centre's own (donors.view_clinical). Filters: search, status (active | expired | lifted). */
  async deferrals(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/deferrals`, 'GET', params)
  }

  /** { donor_uuid, outcome, reason, deferred_on, ends_on }. ends_on counts only for temporarily_deferred. */
  async recordDeferral(payload: Record<string, any>): Promise<any> {
    return this.request(`${this.resource}/deferrals`, 'POST', payload)
  }

  async liftDeferral(id: number, reason: string): Promise<any> {
    return this.request(`${this.resource}/deferrals/${id}/lift`, 'POST', { reason })
  }

  // The centre's donor email wording, kept in Settings (center.configure).
  async emailTemplates(): Promise<any> {
    return this.request(`${this.resource}/facility/email-templates`, 'GET')
  }

  async saveEmailTemplate(template: string, payload: { subject: string, body: string }): Promise<any> {
    return this.request(`${this.resource}/facility/email-templates/${template}`, 'PUT', payload)
  }

  async resetEmailTemplate(template: string): Promise<any> {
    return this.request(`${this.resource}/facility/email-templates/${template}`, 'DELETE')
  }

  /**
   * The Donor/Collection dashboard: today, the donor pool, the coming week
   * and the last 30 days, for the caller's own centre. Counts only.
   */
  async collectionDashboard(): Promise<any> {
    return this.request(`${this.resource}/collection/dashboard`, 'GET')
  }

  /** The Testing department's dashboard: counts only. */
  async testingDashboard(): Promise<any> {
    return this.request(`${this.resource}/laboratory/testing-dashboard`, 'GET')
  }

  /** The Processing department's dashboard: counts only. */
  async processingDashboard(): Promise<any> {
    return this.request(`${this.resource}/laboratory/processing-dashboard`, 'GET')
  }

  // --- Donations list ---
  // Every visit opened at the counter. A visit left open is closed through
  // updateDonationStatus(id, { status: 'rejected', rejection_reason }).

  /** Paginated. Filters: search, status (a status or 'open'), blood_type_id, from, to. */
  async donationRecords(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donation-records`, 'GET', params)
  }

  async exportDonationRecords(params: Record<string, any> = {}): Promise<Blob> {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => [k, String(v)]),
    ).toString()

    return this.requestBlob(`${this.resource}/donation-records/export${query ? `?${query}` : ''}`)
  }

  // --- Paper records ---
  // A remote drive's paper records, typed in after the drive. One sheet per
  // drive and day; each donor on it becomes an ordinary donation dated on that
  // day. The donor search is the counter's own (searchCounterDonors,
  // lookupDonor).

  /** Paginated sheets, the most recent drive first, with row counts. */
  async paperSheets(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/paper-sheets`, 'GET', params)
  }

  /** { today, drives: [{ id, name, location, event_date, start_time }] }: drives already held. */
  async paperSheetOptions(): Promise<any> {
    return this.request(`${this.resource}/paper-sheets/options`, 'GET')
  }

  /** { mobile_event_id? | drive_name, location?, held_on, starts_at, screened_by_name?, phlebotomist_name?, notify_donors, notes? } */
  async createPaperSheet(payload: Record<string, any>): Promise<any> {
    return this.request(`${this.resource}/paper-sheets`, 'POST', payload)
  }

  /** The sheet and every donor typed from it (rows shaped like donationRecords). */
  async paperSheet(sheetId: number | string): Promise<any> {
    return this.request(`${this.resource}/paper-sheets/${sheetId}`, 'GET')
  }

  /** Only an empty sheet. */
  async deletePaperSheet(sheetId: number | string): Promise<any> {
    return this.request(`${this.resource}/paper-sheets/${sheetId}`, 'DELETE')
  }

  /** A donor named on the paper who is not in RedAgos yet: the counter's walk-in registration. */
  async registerPaperDonor(payload: Record<string, any>): Promise<any> {
    return this.request(`${this.resource}/paper-sheets/donors`, 'POST', payload)
  }

  /** One donor's record: the screening fields, and `collection` when a bag was drawn. */
  async recordPaperDonation(sheetId: number | string, payload: Record<string, any>): Promise<any> {
    return this.request(`${this.resource}/paper-sheets/${sheetId}/donations`, 'POST', payload)
  }

  /** Take back a record typed in error, before the laboratory has used it. */
  async removePaperDonation(sheetId: number | string, donationId: number, payload: { reason: string }): Promise<any> {
    return this.request(`${this.resource}/paper-sheets/${sheetId}/donations/${donationId}`, 'DELETE', payload)
  }

  // --- Appointments page (staff side) ---
  // Every booking at the centre and its mobile blood drives, and the desk
  // booking a donor who phones in. Check-in and no-show are above.

  /** Paginated: { data, current_page, last_page, total }. Filters: search, from, to, status. */
  async staffAppointments(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/appointments`, 'GET', params)
  }

  async exportAppointments(params: Record<string, any> = {}): Promise<Blob> {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => [k, String(v)]),
    ).toString()

    return this.requestBlob(`${this.resource}/appointments/export${query ? `?${query}` : ''}`)
  }

  /** { date, slots: [{ time, end, available, total }], drives: [...] } for a date or a drive. */
  async appointmentOptions(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/appointments/options`, 'GET', params)
  }

  /** { donor_uuid, date?, time_slot, drive_id?, notes? } */
  async bookAppointment(payload: Record<string, any>): Promise<any> {
    return this.request(`${this.resource}/appointments`, 'POST', payload)
  }

  /** The ✓ on the Appointments list: mark the booking collected. */
  async markAppointmentCollected(appointmentId: number): Promise<any> {
    return this.request(`${this.resource}/appointments/${appointmentId}/collected`, 'POST')
  }

  async cancelAppointment(appointmentId: number): Promise<any> {
    return this.request(`${this.resource}/appointments/${appointmentId}/cancel`, 'POST')
  }

  async deleteAppointment(appointmentId: number): Promise<any> {
    return this.request(`${this.resource}/appointments/${appointmentId}`, 'DELETE')
  }

  /**
   * The donor's health questionnaire, Sections I-A to I-C.
   *
   * Deliberately its own call rather than something the scan hands over. The
   * scan says who is at the counter; this is thirty declared health answers,
   * so the server gates and audits it separately. Nothing is fetched until a
   * staff member actually opens the drawer.
   *
   * `screening_id` is the pin carried through from the scan, which makes the
   * read exact. The manual valid-ID path has no token to pin with, so it omits
   * it and the server resolves the questionnaire itself.
   */
  async donorHealthQuestionnaire(uuid: string, params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donors/${uuid}/health-questionnaire`, 'GET', params)
  }

  /**
   * The completed questionnaire as the printed DOH form: the answers without
   * the review markers, which stay on the physician's read above.
   */
  async printableQuestionnaire(uuid: string, params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/donors/${uuid}/health-questionnaire/print`, 'GET', params)
  }

  /** The questions a walk-in answers onsite on the counter's device. */
  async counterQuestionnaireForm(uuid: string): Promise<any> {
    return this.request(`${this.resource}/donors/${uuid}/health-questionnaire/form`, 'GET')
  }

  /** Same payload as the donor's own app submission; returns the reference only. */
  async recordCounterQuestionnaire(uuid: string, payload: Record<string, any>): Promise<any> {
    return this.request(`${this.resource}/donors/${uuid}/health-questionnaire`, 'POST', payload)
  }

  /**
   * Find a walk-in by name, email or phone: { data: [...], truncated }.
   * A POST so the name never sits in a URL.
   */
  async searchCounterDonors(q: string): Promise<any> {
    return this.request(`${this.resource}/collection/donor-search`, 'POST', { q })
  }

  // --- Component settings ---
  //
  // Shelf life and price, held per facility. blood_components has no
  // facility_id and four facilities share it, so a value written there would
  // decide another centre's expiry dates — and a price switches on the
  // payment-before-release gate, which one centre must not turn on for another.
  //
  // Each is its own department's: Processing adds components and sets their
  // shelf life (components.configure), Billing prices them (billing.prices).
  // Neither endpoint accepts the other's field.

  async componentSettings(): Promise<any> {
    return this.request(`${this.resource}/blood-components`, 'GET')
  }

  async updateComponentSetting(componentId: number, payload: { shelf_life_days: number | null }): Promise<any> {
    return this.request(`${this.resource}/blood-components/${componentId}`, 'PATCH', payload)
  }

  /**
   * Add a component to the shared catalogue. Every centre sees it, as not
   * configured until it sets its own shelf life.
   */
  async addComponent(payload: {
    name: string
    code: string
    storage_temperature?: string | null
    shelf_life_days?: number | null
  }): Promise<any> {
    return this.request(`${this.resource}/blood-components`, 'POST', payload)
  }

  async componentPrices(): Promise<any> {
    return this.request(`${this.resource}/component-prices`, 'GET')
  }

  /**
   * Save every component's price at once. Each line is a price above zero or
   * an explicit no charge; the server writes nothing unless every component
   * ends up with one or the other (422 `prices_incomplete`).
   */
  async saveComponentPrices(payload: {
    prices: Array<{ component_id: number, no_charge: boolean, price: number | null }>
  }): Promise<any> {
    return this.request(`${this.resource}/component-prices`, 'PUT', payload)
  }

  // --- Facility logo (Blood Center Admin only) ---
  //
  // Ang facility kay gikan sa token sa staff, dili gikan sa request. FormData,
  // so ang BaseService mobiya sa Content-Type para ang browser ang mobutang sa
  // boundary.

  async uploadFacilityLogo(form: FormData): Promise<any> {
    return this.request(`${this.resource}/facility/logo`, 'POST', form)
  }

  async removeFacilityLogo(): Promise<any> {
    return this.request(`${this.resource}/facility/logo`, 'DELETE')
  }

  // The Daily Blood Stock Inventory's left-hand logo. Without one the report
  // prints the DOH seal. Same file rules, so the file goes under `logo` too.

  async uploadFacilitySeal(form: FormData): Promise<any> {
    return this.request(`${this.resource}/facility/seal`, 'POST', form)
  }

  async removeFacilitySeal(): Promise<any> {
    return this.request(`${this.resource}/facility/seal`, 'DELETE')
  }

  // --- Inventory (Issuance department) ---

  async inventory(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/inventory`, 'GET', params)
  }

  async inventorySummary(): Promise<any> {
    return this.request(`${this.resource}/inventory/summary`, 'GET')
  }

  // The centre's own stock movements, newest first; `unit_id` narrows it to
  // one bag's history.
  async inventoryActivity(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/inventory/activity`, 'GET', params)
  }

  // --- Stock thresholds ---
  //
  // The minimum stock per blood type and component. Anyone who can see the
  // inventory reads how it stands; only the Inventory Control Officer and the
  // Center Admin (`inventory.thresholds`) save.

  async stockThresholds(): Promise<StockThresholdStatus> {
    return this.request<StockThresholdStatus>(`${this.resource}/inventory/thresholds`, 'GET')
  }

  async saveStockThresholds(payload: SaveStockThresholdsPayload): Promise<StockThresholdStatus> {
    return this.request<StockThresholdStatus>(`${this.resource}/inventory/thresholds`, 'PUT', payload)
  }

  /**
   * Donations the laboratory has cleared that still owe units.
   *
   * Its own endpoint rather than the laboratory queue: Issuance holds
   * `donations.view` but not `lab.view`, and this carries the declared-versus-
   * recorded counts that neither of the donation listings does.
   */
  async inventoryIntakeQueue(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/inventory/intake-queue`, 'GET', params)
  }

  async recordBloodUnits(payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/inventory`, 'POST', payload)
  }

  /** The Daily Blood Stock Inventory, as of now. Issuance and supervisors. */
  async stockReport(): Promise<any> {
    return this.request(`${this.resource}/inventory/stock-report`, 'GET')
  }

  /** The same report as the printable PDF sheet. */
  async downloadStockReport(): Promise<Blob> {
    return this.requestBlob(`${this.resource}/inventory/stock-report/pdf`)
  }

  async updateBloodUnit(unitId: string, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/inventory/${unitId}`, 'PATCH', payload)
  }


  async discardBloodUnit(unitId: string, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/inventory/${unitId}/discard`, 'POST', payload)
  }

  // --- Staff roster (Supervisor only) ---

  async staff(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/staff`, 'GET', params)
  }

  /**
   * Departments and the roles within each, with the abilities a role grants.
   * Served so the staff form cannot drift from the server's matrix.
   */
  async staffRoles(): Promise<any> {
    return this.request(`${this.resource}/staff/roles`, 'GET')
  }

  async createStaff(payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/staff`, 'POST', payload)
  }

  async showStaff(uuid: string): Promise<any> {
    return this.request(`${this.resource}/staff/${uuid}`, 'GET')
  }

  async updateStaff(uuid: string, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/staff/${uuid}`, 'PATCH', payload)
  }

  async deleteStaff(uuid: string): Promise<any> {
    return this.request(`${this.resource}/staff/${uuid}`, 'DELETE')
  }

  async restoreStaff(uuid: string): Promise<any> {
    return this.request(`${this.resource}/staff/${uuid}/restore`, 'POST')
  }

  // --- Audit Log (Blood Center Admin only) ---

  /**
   * Paginated, newest first. Filters: search, module, type, from, to. The
   * response also carries the filter choices as `modules` and `types`.
   */
  async auditLog(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/audit-log`, 'GET', params)
  }

  async list(params: Record<string, any> = {}): Promise<any> {
    return this.request(this.resource, 'GET', params)
  }

  async create(payload: Record<string, any> = {}): Promise<any> {
    return this.request(this.resource, 'POST', payload)
  }

  async show(uuid: string): Promise<any> {
    return this.request(`${this.resource}/${uuid}`, 'GET')
  }

  async update(uuid: string, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/${uuid}`, 'PUT', payload)
  }

  async delete(uuid: string): Promise<any> {
    return this.request(`${this.resource}/${uuid}`, 'DELETE')
  }

  async restore(uuid: string): Promise<any> {
    return this.request(`${this.resource}/${uuid}/restore`, 'POST')
  }

  // ---------------------------------------------------------------------
  // Incoming blood requests — the fulfilling side of the workflow.
  //
  // These replace the fixture data in useIncomingRequests and the mock $fetch
  // shadow inside fulfillment.vue. Every path below is a route the Laravel app
  // actually serves; the commented-out paths those mocks carried
  // (/blood-center/bloodrequests, /api/center/requests/...) never existed.
  // ---------------------------------------------------------------------

  /** Requests addressed to this facility, emergencies first. */
  async incomingRequests(params: Record<string, any> = {}): Promise<any> {
    return this.request('/blood-center/blood-requests', 'GET', params)
  }

  /** The queue as CSV, with the list's filters (search, status/open, from, to). */
  async exportIncomingRequests(params: Record<string, any> = {}): Promise<Blob> {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => [k, String(v)]),
    ).toString()

    return this.requestBlob(`${this.resource}/blood-requests/export${query ? `?${query}` : ''}`)
  }

  /** Queue counters for the dashboard. */
  async incomingRequestsSummary(): Promise<any> {
    return this.request('/blood-center/blood-requests/summary', 'GET')
  }

  /** One request, with the live stock that could fill it. Holds nothing. */
  async reviewRequest(id: number | string): Promise<any> {
    return this.request(`/blood-center/blood-requests/${id}`, 'GET')
  }

  /**
   * Download this incoming request as the DOH Blood Request Form (Adult).
   *
   * The same document the requesting hospital prints, rendered by the same
   * server-side service, so the two copies cannot disagree.
   */
  async downloadRequestForm(id: number | string): Promise<Blob> {
    return this.requestBlob(`/blood-center/blood-requests/${id}/form`)
  }

  /**
   * Approve and hold stock.
   *
   * Omit `quantity` to hold everything the request still needs. Whatever is
   * sent, the server caps it at the outstanding amount and at what is on the
   * shelf, so a partial hold is a normal outcome rather than an error.
   *
   * Pass `requestItemId` to hold against one component of a multi-component
   * request; omit it and the server fills each line in form order.
   */
  async allocateRequest(
    id: number | string,
    quantity?: number,
    requestItemId?: number,
    unitIds?: string[],
  ): Promise<any> {
    const payload: Record<string, number | string[]> = {}

    if (quantity) payload.quantity = quantity
    if (requestItemId) payload.request_item_id = requestItemId
    // The bags staff picked: held exactly, or the pick is refused unit by unit.
    if (unitIds?.length) payload.unit_ids = unitIds

    return this.request(`/blood-center/blood-requests/${id}/allocate`, 'POST', payload)
  }

  /**
   * The referral slip for a watcher: the patient's request and what is still
   * needed from another blood centre. Audited on the server, as it is printed.
   */
  async referralSlip(id: number | string): Promise<any> {
    return this.request(`/blood-center/blood-requests/${id}/referral-slip`, 'GET')
  }

  /**
   * The units staff may pick for each line of a request, first-expiring first.
   * Reading holds nothing.
   */
  async requestUnits(id: number | string): Promise<any> {
    return this.request(`/blood-center/blood-requests/${id}/units`, 'GET')
  }

  /** Refuse a request. The reason is required and reaches the requester. */
  async rejectRequest(id: number | string, reason: string): Promise<any> {
    return this.request(`/blood-center/blood-requests/${id}/reject`, 'POST', { reason })
  }

  /** Give up holds and return those units to available stock. */
  async releaseHolds(id: number | string, reason: string, allocationIds?: number[]): Promise<any> {
    return this.request(`/blood-center/blood-requests/${id}/release-holds`, 'POST', {
      reason,
      ...(allocationIds ? { allocation_ids: allocationIds } : {}),
    })
  }

  /**
   * Dispatch held units. Refused while the statement is unsettled.
   *
   * `handedTo` names who physically took the units — for a walk-in, the
   * watcher. It is recorded on the request's history.
   */
  async releaseRequest(id: number | string, allocationIds?: number[], handedTo?: string | null): Promise<any> {
    return this.request(`/blood-center/blood-requests/${id}/release`, 'POST', {
      ...(allocationIds ? { allocation_ids: allocationIds } : {}),
      ...(handedTo ? { handed_to: handedTo } : {}),
    })
  }

  /**
   * Close the rest of one line this centre cannot supply.
   *
   * The line keeps what was requested; the remainder is recorded as
   * unavailable here and may still be sourced from another facility.
   */
  async closeRequestLine(id: number | string, itemId: number, note?: string | null): Promise<any> {
    return this.request(`/blood-center/blood-requests/${id}/items/${itemId}/close`, 'POST', note ? { note } : {})
  }

  /** Everything that has happened to an incoming request, oldest first. */
  async requestHistory(id: number | string): Promise<{ request_id: number; reference_number: string; events: RequestEvent[] }> {
    return this.request(`/blood-center/blood-requests/${id}/history`, 'GET')
  }

  // ---------------------------------------------------------------------
  // Walk-in Patient Transfusion requests.
  //
  // A watcher who came to the centre instead of the hospital blood bank,
  // recorded on the hospital's behalf. The phone confirmation was dropped
  // on 2026-10-19.
  // ---------------------------------------------------------------------

  /** Hospitals, components, indications and ID types for the walk-in form. */
  async walkInReference(): Promise<WalkInReference> {
    return this.request('/blood-center/blood-requests/walk-in/reference', 'GET')
  }

  /**
   * Look for a request the hospital already has open for this patient.
   *
   * A POST so the patient's name never sits in a URL or an access log.
   */
  async checkWalkInDuplicates(criteria: {
    hospital_id?: number | null
    hospital_name?: string | null
    patient_surname?: string | null
    patient_first_name?: string | null
    blood_type_id?: number | null
    presented_reference?: string | null
  }): Promise<{ matches: DuplicateMatch[]; requires_acknowledgement: boolean; window_days: number }> {
    return this.request('/blood-center/blood-requests/walk-in/duplicates', 'POST', criteria)
  }

  /** Record a walk-in a watcher brought. */
  async createWalkInRequest(payload: CreateWalkInPayload): Promise<{ message: string; request: BloodRequest }> {
    return this.request('/blood-center/blood-requests/walk-in', 'POST', payload)
  }

  /** Every statement raised against this facility's incoming requests. */
  async billings(params: Record<string, any> = {}): Promise<any> {
    return this.request('/blood-center/billings', 'GET', params)
  }

  /** The statement raised against one request, with the request behind it and its live lines. */
  async billingForRequest(requestId: number | string): Promise<any> {
    return this.request(`/blood-center/billings/${requestId}`, 'GET')
  }

  /**
   * The payments recorded against one statement, with what the caller may do to
   * each. Separate from the statement on purpose: it needs the ability to
   * record payments, which the roles that only read the statement do not hold.
   */
  async billingPayments(requestId: number | string): Promise<any> {
    return this.request(`/blood-center/billings/${requestId}/payments`, 'GET')
  }

  /**
   * Meet a statement from the government subsidy instead of charging for it.
   *
   * Zero-rates the statement and clears the request for release without
   * recording a payment, because none was taken. Money already collected is
   * left alone. The response carries the hospital's Statement of Account
   * issued with it (`statement`). Issuance applies it at the point of issue
   * (billing.subsidise, project owner 2026-10-19).
   */
  async applySubsidy(requestId: number | string, reason?: string): Promise<any> {
    return this.request(
      `/blood-center/billings/${requestId}/subsidy`,
      'POST',
      reason ? { reason } : {},
    )
  }

  /**
   * Record money taken at the counter. A manual GCash payment must carry its
   * reference. The server always records it as completed and issues its
   * receipt in the same step; the response carries the receipt.
   */
  async recordPayment(requestId: number | string, payload: Record<string, any>): Promise<any> {
    return this.request(`/blood-center/billings/${requestId}/payments`, 'POST', payload)
  }

  /** One payment split across methods (part cash, the rest by card, GCash or transfer): every part or none. */
  async recordSplitPayment(requestId: number | string, payload: Record<string, any>): Promise<any> {
    return this.request(`/blood-center/billings/${requestId}/payments/split`, 'POST', payload)
  }

  /** The Statements of Account issued for one request, oldest first. */
  async billingStatements(requestId: number | string): Promise<{ statements: StatementRevision[] }> {
    return this.request(`/blood-center/billings/${requestId}/statements`, 'GET')
  }

  /**
   * Issue a Statement of Account. If nothing has changed since the last one,
   * the server hands that one back (created: false) instead of numbering a new one.
   */
  async issueStatement(requestId: number | string): Promise<{ message: string; created: boolean; revision: StatementRevision }> {
    return this.request(`/blood-center/billings/${requestId}/statements`, 'POST')
  }

  /** One issued statement as its printed PDF. */
  async downloadStatement(revisionId: number | string): Promise<Blob> {
    return this.requestBlob(`/blood-center/statements/${revisionId}/pdf`)
  }

  /** One Payment Acknowledgement Receipt as its printed PDF. */
  async downloadReceipt(receiptId: number | string): Promise<Blob> {
    return this.requestBlob(`/blood-center/receipts/${receiptId}/pdf`)
  }

  /**
   * One receipt as data, for its page and the counter's 80mm print. The
   * payment reference and a card's additional information (the cardholder's
   * last name) come beside it: the receipt itself never carries them.
   */
  async receipt(receiptId: number | string): Promise<{ receipt: PaymentReceiptSummary; payment_reference: string | null; payment_additional_information: string | null }> {
    return this.request(`/blood-center/receipts/${receiptId}`, 'GET')
  }

  /** The receipts this centre has issued, newest first, paginated. */
  async receipts(params: Record<string, any> = {}): Promise<{ data: PaymentReceiptSummary[]; current_page: number; last_page: number; total: number }> {
    return this.request('/blood-center/receipts', 'GET', params)
  }

  /** The centre's billing at a glance, counted on the server. */
  async billingSummary(): Promise<BillingSummary> {
    return this.request('/blood-center/billings/summary', 'GET')
  }

  /**
   * Record that the hospital settled a weekly bill outside RedAgos, with its
   * reference and date. Allowed once the weekly order has been dispatched.
   */
  async settleWeeklyBill(
    requestId: number | string,
    payload: { settlement_reference: string; settled_at: string; settlement_note?: string | null },
  ): Promise<{ message: string; billing: Billing }> {
    return this.request(`/blood-center/billings/${requestId}/settlement`, 'POST', payload)
  }

  /** The billing journal, newest first, with the totals of everything the filters match. */
  async billingTransactions(params: Record<string, any> = {}): Promise<any> {
    return this.request('/blood-center/billing-transactions', 'GET', params)
  }

  /** The journal rows the filters match, as CSV. */
  async exportBillingTransactions(params: Record<string, any> = {}): Promise<Blob> {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined).map(([key, value]) => [key, String(value)]),
    ).toString()

    return this.requestBlob(`/blood-center/billing-transactions/export${query ? `?${query}` : ''}`)
  }

  /** The caller's open cash shift with its running figures, or null, and whether the counter works in shifts at all. */
  async currentShift(): Promise<{ shifts_enabled: boolean; session: CashShift | null }> {
    return this.request('/blood-center/pos/session', 'GET')
  }

  /** Open a cash shift at the counter with the float in the drawer. */
  async openShift(payload: { opening_float: number; counter_label?: string | null }): Promise<{ message: string; session: CashShift }> {
    return this.request('/blood-center/pos/sessions', 'POST', payload)
  }

  /** Close a shift with the drawer counted; a difference needs a note. */
  async closeShift(
    sessionId: number,
    payload: { counted_cash: number; count_breakdown?: Record<string, number> | null; closing_note?: string | null },
  ): Promise<{ message: string; session: CashShift }> {
    return this.request(`/blood-center/pos/sessions/${sessionId}/close`, 'POST', payload)
  }

  /** Shifts the caller may see: their own, or every one at the centre for a billing supervisor. */
  async cashShifts(params: Record<string, any> = {}): Promise<any> {
    return this.request('/blood-center/pos/sessions', 'GET', params)
  }

  /** One shift with its reading. */
  async cashShift(sessionId: number | string): Promise<{ session: CashShift }> {
    return this.request(`/blood-center/pos/sessions/${sessionId}`, 'GET')
  }

  /** A shift's reading as its printed report: X while open, Z once closed. */
  async downloadShiftReport(sessionId: number | string): Promise<Blob> {
    return this.requestBlob(`/blood-center/pos/sessions/${sessionId}/pdf`)
  }

  /** Find this centre's patient bills by reference or patient name. */
  async counterLookup(q: string): Promise<{ data: CounterBill[] }> {
    return this.request('/blood-center/pos/lookup', 'GET', { q })
  }

  /** The patient bills holding blood back, oldest first. */
  async counterQueue(): Promise<{ data: CounterBill[] }> {
    return this.request('/blood-center/pos/queue', 'GET')
  }

  /** One patient bill as the counter takes it. */
  async counterBill(requestId: number | string): Promise<{ bill: CounterBill }> {
    return this.request(`/blood-center/pos/bills/${requestId}`, 'GET')
  }

  /**
   * Open a GCash checkout for the watcher at the counter. Only the payer's
   * name is sent; the amount comes from the statement on the server, never
   * from here. Returns the open checkout if one already exists.
   */
  async startCheckout(requestId: number | string, payerName: string): Promise<{ message: string; created: boolean; attempt: PaymentAttempt }> {
    return this.request(`/blood-center/billings/${requestId}/checkout`, 'POST', { payer_name: payerName })
  }

  /** Every GCash checkout opened against one statement, newest first. */
  async checkoutAttempts(requestId: number | string): Promise<{ attempts: PaymentAttempt[] }> {
    return this.request(`/blood-center/billings/${requestId}/attempts`, 'GET')
  }

  /** Close an open checkout so the payment can be taken another way. */
  async supersedeCheckout(requestId: number | string, attemptId: number, reason: string): Promise<{ message: string; attempt: PaymentAttempt }> {
    return this.request(`/blood-center/billings/${requestId}/attempts/${attemptId}/supersede`, 'POST', { reason })
  }

  /** Ask the provider again about a checkout flagged for review (Billing Supervisor). */
  async reverifyCheckout(requestId: number | string, attemptId: number): Promise<{ message: string; attempt: PaymentAttempt }> {
    return this.request(`/blood-center/billings/${requestId}/attempts/${attemptId}/reverify`, 'POST')
  }

  /** Close a checkout once the provider confirms nothing was paid on it (Billing Supervisor). */
  async closeCheckout(requestId: number | string, attemptId: number, reason: string): Promise<{ message: string; attempt: PaymentAttempt }> {
    return this.request(`/blood-center/billings/${requestId}/attempts/${attemptId}/close`, 'POST', { reason })
  }

  /**
   * Mobile blood drives this facility runs.
   *
   * Lahi ni sa donor-facing nga GET /blood-drives: kana kay read-only nga
   * catalogue sa umaabot nga drives sa tanang centre. Kini facility-scoped ug
   * apil ang mga drive nga nahuman na.
   */
  async drives(): Promise<any> {
    return this.request(`${this.resource}/drives`, 'GET')
  }

  /** Schedule a drive. Ang facility kay gikan sa token, dili sa payload. */
  async createDrive(payload: Record<string, any>): Promise<any> {
    return this.request(`${this.resource}/drives`, 'POST', payload)
  }

  async listNotifications(params: Record<string, any> = {}): Promise<any> {
    return this.request('/blood-center/notifications', 'GET', params)
  }

  async notificationsUnreadCount(): Promise<any> {
    return this.request('/blood-center/notifications/unread-count', 'GET')
  }

  async markNotificationRead(id: string): Promise<any> {
    return this.request(`/blood-center/notifications/${id}`, 'PATCH')
  }

  async markAllNotificationsRead(): Promise<any> {
    return this.request('/blood-center/notifications/mark-all-read', 'POST')
  }
}

export const bloodCenterService = BloodCenterService.getInstance()