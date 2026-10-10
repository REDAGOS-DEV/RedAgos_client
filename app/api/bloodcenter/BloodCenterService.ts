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

  async dashboardSummary(): Promise<any> {
    return this.request(`${this.resource}/dashboard-summary`, 'GET')
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

  async declareComponents(donationId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/laboratory/donations/${donationId}/components`, 'POST', payload)
  }

  /** Clear for issue, or reject. The only two outcomes the laboratory may set. */
  async updateLaboratoryStatus(donationId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/laboratory/donations/${donationId}/status`, 'PATCH', payload)
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

  // --- Component settings (supervisor only) ---
  //
  // Shelf life and price, held per facility. blood_components has no
  // facility_id and four facilities share it, so a value written there would
  // decide another centre's expiry dates — and a price switches on the
  // payment-before-release gate, which one centre must not turn on for another.

  async componentSettings(): Promise<any> {
    return this.request(`${this.resource}/blood-components`, 'GET')
  }

  async updateComponentSetting(componentId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/blood-components/${componentId}`, 'PATCH', payload)
  }

  // --- Facility logo (supervisor only) ---
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

  // --- Inventory (Issuance department) ---

  async inventory(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/inventory`, 'GET', params)
  }

  async inventorySummary(): Promise<any> {
    return this.request(`${this.resource}/inventory/summary`, 'GET')
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

  /**
   * Release every quarantined unit of a donation to available stock.
   *
   * The server refuses unless TTI Testing and Immunohematology have both
   * cleared the donation — for a supervisor too. All or nothing per donation.
   */
  async releaseQuarantine(donationId: number): Promise<any> {
    return this.request(`${this.resource}/inventory/quarantine/${donationId}/release`, 'POST')
  }

  /**
   * The final (Phase 2) label data for a donation's released bags — verified
   * blood type, expiry, clearance codes, who released them. Refused while the
   * bags are still in quarantine. Issuance only.
   */
  async bloodLabels(donationId: number): Promise<any> {
    return this.request(`${this.resource}/inventory/donations/${donationId}/labels`, 'GET')
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
  ): Promise<any> {
    const payload: Record<string, number> = {}

    if (quantity) payload.quantity = quantity
    if (requestItemId) payload.request_item_id = requestItemId

    return this.request(`/blood-center/blood-requests/${id}/allocate`, 'POST', payload)
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
  // A watcher who came to the centre instead of the hospital blood bank.
  // Issuance phones the hospital and records the request only once the
  // hospital confirms it; a "no" is never sent.
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
    hospital_id: number
    patient_surname?: string | null
    patient_first_name?: string | null
    blood_type_id?: number | null
    presented_reference?: string | null
  }): Promise<{ matches: DuplicateMatch[]; requires_acknowledgement: boolean; window_days: number }> {
    return this.request('/blood-center/blood-requests/walk-in/duplicates', 'POST', criteria)
  }

  /** Record a walk-in the hospital has confirmed by phone. */
  async createWalkInRequest(payload: CreateWalkInPayload): Promise<{ message: string; request: BloodRequest }> {
    return this.request('/blood-center/blood-requests/walk-in', 'POST', payload)
  }

  /** Every statement raised against this facility's incoming requests. */
  async billings(params: Record<string, any> = {}): Promise<any> {
    return this.request('/blood-center/billings', 'GET', params)
  }

  /** The statement raised against one request. */
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
   * left alone.
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

  /** One receipt as data, for the counter's 80mm print. */
  async receipt(receiptId: number | string): Promise<{ receipt: PaymentReceiptSummary }> {
    return this.request(`/blood-center/receipts/${receiptId}`, 'GET')
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