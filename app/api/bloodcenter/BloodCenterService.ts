import BaseService from '../BaseService'

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

  // --- Collection (Donor / Collection department) ---

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

  // --- Active donation transaction (Donor / Collection) ---

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

  // --- Laboratory / Processing department ---
  //
  // Picks up where the counter stops. The counter leaves a donation at
  // `collected`; nothing here is reachable before that, and `completed` —
  // cleared for issue to a patient — is only ever set from this department.

  async laboratoryQueue(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/laboratory/queue`, 'GET', params)
  }

  async laboratoryDonation(donationId: number): Promise<any> {
    return this.request(`${this.resource}/laboratory/donations/${donationId}`, 'GET')
  }

  /** Record the result a medical technologist reported. Moves it to `tested`. */
  async recordTestResult(donationId: number, payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/laboratory/donations/${donationId}/results`, 'POST', payload)
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

  // --- Inventory (Inventory / Storage department) ---

  async inventory(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/inventory`, 'GET', params)
  }

  async inventorySummary(): Promise<any> {
    return this.request(`${this.resource}/inventory/summary`, 'GET')
  }

  /**
   * Donations the laboratory has cleared that still owe units.
   *
   * Its own endpoint rather than the laboratory queue: Inventory holds
   * `donations.view` but not `lab.view`, and this carries the declared-versus-
   * recorded counts that neither of the donation listings does.
   */
  async inventoryIntakeQueue(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/inventory/intake-queue`, 'GET', params)
  }

  async recordBloodUnits(payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/inventory`, 'POST', payload)
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
   * Approve and hold stock.
   *
   * Omit `quantity` to hold everything the request still needs. Whatever is
   * sent, the server caps it at the outstanding amount and at what is on the
   * shelf, so a partial hold is a normal outcome rather than an error.
   */
  async allocateRequest(id: number | string, quantity?: number): Promise<any> {
    return this.request(
      `/blood-center/blood-requests/${id}/allocate`,
      'POST',
      quantity ? { quantity } : {},
    )
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

  /** Dispatch held units. Refused while the statement is unsettled. */
  async releaseRequest(id: number | string, allocationIds?: number[]): Promise<any> {
    return this.request(
      `/blood-center/blood-requests/${id}/release`,
      'POST',
      allocationIds ? { allocation_ids: allocationIds } : {},
    )
  }

  /** The statement raised against one request. */
  async billingForRequest(requestId: number | string): Promise<any> {
    return this.request(`/blood-center/billings/${requestId}`, 'GET')
  }

  /** Record a settlement. GCash payments must carry their reference. */
  async recordPayment(requestId: number | string, payload: Record<string, any>): Promise<any> {
    return this.request(`/blood-center/billings/${requestId}/payments`, 'POST', payload)
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