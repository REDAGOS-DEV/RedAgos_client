import BaseService from '../BaseService'
import type {
  AllocationSharePayload,
  AvailabilityResult,
  BloodRequest,
  BloodRequestFilters,
  BloodRequestStatus,
  CreateTransfusionRequestPayload,
  PatientMatch,
  RequestEvent,
  RequestReferenceData,
  SourcingPlan,
  TransfusionRequest,
  TransfusionRequestFilters,
} from '~/types/bloodRequest'
import type { HospitalNotificationList } from '~/types/hospitalNotification'
import type { SaveStockThresholdsPayload, StockThresholdStatus } from '~/types/stockThreshold'
import type {
  HospitalInventoryFilters,
  HospitalInventorySummary,
  HospitalUnit,
  TagEventFilters,
  TagUnitPayload,
  UnitActionResult,
  UnitTag,
  UnitTagEvent,
} from '~/types/hospitalInventory'
import type {
  ReceiveDirectDistributionPayload,
  CreateWeeklyRequestPayload,
  DirectDistribution,
  ExternalBloodSource,
  IsoWeekday,
  ReplenishmentSchedule,
  WeeklyRequest,
  WeeklyStatus,
} from '~/types/receiving'

/**
 * The requester side of the API: a hospital blood bank's own requests.
 *
 * Every method here maps to a route that exists. The previous version of this
 * file declared a surface the Laravel app never served, and the pages called a
 * further dozen methods it did not even declare — `listRequests`,
 * `bloodAvailability`, `uploadDocument` and the rest — which threw at runtime.
 * Anything not below is not available; add the endpoint before adding a method.
 */

export type { BloodRequestFilters, TransfusionRequestFilters }

export interface Paginated<T> {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

class HospitalService extends BaseService {
  private static instance: HospitalService

  static getInstance() {
    if (!HospitalService.instance) HospitalService.instance = new HospitalService()
    return HospitalService.instance
  }

  /**
   * Search participating blood centres for a type and component.
   *
   * Advisory only — the response says so in its own `advisory` field. Nothing
   * is held until a request is raised and a centre approves it.
   */
  availability(params: { blood_type_id: number; component_id: number; quantity?: number }) {
    return this.request<AvailabilityResult>('/hospital/availability', 'GET', params)
  }

  /**
   * The blood types, components and indication codes a request form needs.
   *
   * Served rather than hard-coded: the indication codes are the criteria a
   * physician certifies against, and a second copy in the client is a second
   * chance to offer a code the API would reject.
   */
  referenceData() {
    return this.request<RequestReferenceData>('/hospital/reference-data')
  }

  /** The facilities this blood bank may address a request to. */
  eligibleFacilities() {
    return this.request<{ facilities: Array<{ id: number; name: string; address: string | null }> }>(
      '/hospital/facilities',
    )
  }

  /* ---------------------------------------------------------------- *
   * Patient Transfusion Requests: the patient's need, split across the
   * centres asked to supply it. Each share is a facility allocation — a
   * blood request, served by the methods further down.
   * ---------------------------------------------------------------- */

  listTransfusionRequests(params: TransfusionRequestFilters = {}) {
    return this.request<Paginated<TransfusionRequest>>('/hospital/transfusion-requests', 'GET', params)
  }

  createTransfusionRequest(payload: CreateTransfusionRequestPayload) {
    return this.request<{ message: string; request: TransfusionRequest }>(
      '/hospital/transfusion-requests',
      'POST',
      payload,
    )
  }

  showTransfusionRequest(id: number | string) {
    return this.request<{ request: TransfusionRequest }>(`/hospital/transfusion-requests/${id}`)
  }

  /** Track by the PTR reference, or the RQ reference of any of its allocations. */
  trackTransfusionRequest(reference: string) {
    return this.request<{ request: TransfusionRequest }>(
      `/hospital/transfusion-requests/track/${encodeURIComponent(reference)}`,
    )
  }

  /**
   * Suggest how to split a need not yet recorded: centres holding matching
   * stock, earliest expiry first. Advisory — nothing is held.
   */
  draftSourcing(payload: { blood_type_id: number; lines: Array<{ component_id: number; quantity: number }> }) {
    return this.request<SourcingPlan>('/hospital/transfusion-requests/sourcing', 'POST', payload)
  }

  /** Suggest where to ask for whatever is still unallocated. */
  transfusionSourcing(id: number | string) {
    return this.request<SourcingPlan>(`/hospital/transfusion-requests/${id}/sourcing`)
  }

  /** Ask more centres for whatever is still unallocated. */
  addAllocations(id: number | string, allocations: AllocationSharePayload[]) {
    return this.request<{ message: string; request: TransfusionRequest }>(
      `/hospital/transfusion-requests/${id}/allocations`,
      'POST',
      { allocations },
    )
  }

  /** Withdraw a share its centre has not answered. Its units become unallocated again. */
  withdrawAllocation(id: number | string, allocationId: number, reason?: string | null) {
    return this.request<{ message: string; request: TransfusionRequest }>(
      `/hospital/transfusion-requests/${id}/allocations/${allocationId}/withdraw`,
      'POST',
      reason ? { reason } : {},
    )
  }

  /**
   * Close the rest of one component the patient no longer needs.
   *
   * Approved units are left alone; every centre still asked for this
   * component stops being asked.
   */
  closeTransfusionLine(id: number | string, itemId: number, note?: string | null) {
    return this.request<{ message: string; request: TransfusionRequest }>(
      `/hospital/transfusion-requests/${id}/items/${itemId}/close`,
      'POST',
      note ? { note } : {},
    )
  }

  /** Cancel a request nothing has been approved for. */
  cancelTransfusionRequest(id: number | string, reason?: string | null) {
    return this.request<{ message: string; request: TransfusionRequest }>(
      `/hospital/transfusion-requests/${id}/cancel`,
      'POST',
      reason ? { reason } : {},
    )
  }

  /** Everything that happened to the request and to each centre's share of it. */
  transfusionHistory(id: number | string) {
    return this.request<{ request_id: number; reference_number: string; events: RequestEvent[] }>(
      `/hospital/transfusion-requests/${id}/history`,
    )
  }

  /**
   * This blood bank's active Patient Transfusion Requests for a patient, before recording another.
   *
   * Includes one a blood centre recorded here after a walk-in. A POST so the
   * patient's name stays out of URLs and access logs.
   */
  patientMatches(criteria: { patient_surname: string; patient_first_name: string; blood_type_id?: number | null }) {
    return this.request<{ matches: PatientMatch[] }>('/hospital/transfusion-requests/patient-matches', 'POST', criteria)
  }

  /* ---------------------------------------------------------------- *
   * Blood requests: each facility allocation's and weekly replenishment's
   * own page — receipt, the DOH form and its history live there.
   * ---------------------------------------------------------------- */

  /** This blood bank's own requests. */
  listRequests(params: BloodRequestFilters = {}) {
    return this.request<Paginated<BloodRequest>>('/hospital/blood-requests', 'GET', params)
  }

  showRequest(id: number | string) {
    return this.request<{ request: BloodRequest }>(`/hospital/blood-requests/${id}`)
  }

  /**
   * Download this request as the DOH Blood Request Form (Adult).
   *
   * Rendered server-side so the hospital and the fulfilling centre print the
   * same document. requestBlob carries the bearer token, which a plain
   * <a href> could not.
   */
  downloadRequestForm(id: number | string) {
    return this.requestBlob(`/hospital/blood-requests/${id}/form`)
  }

  /** Track by the reference number printed on the paperwork. */
  trackRequest(reference: string) {
    return this.request<{ request: BloodRequest }>(
      `/hospital/blood-requests/track/${encodeURIComponent(reference)}`,
    )
  }


  /** Everything that has happened to one of this blood bank's requests. */
  requestHistory(id: number | string) {
    return this.request<{ request_id: number; reference_number: string; events: RequestEvent[] }>(
      `/hospital/blood-requests/${id}/history`,
    )
  }

  /**
   * Close the rest of one replenishment line this blood bank no longer needs.
   *
   * The line keeps what was requested. A facility allocation's line is closed
   * on its Patient Transfusion Request instead (closeTransfusionLine).
   */
  closeRequestLine(id: number | string, itemId: number, note?: string | null) {
    return this.request<{ message: string; status: BloodRequestStatus; status_label: string; is_open: boolean }>(
      `/hospital/blood-requests/${id}/items/${itemId}/close`,
      'POST',
      note ? { note } : {},
    )
  }


  /** Withdraw a request. Only possible while nothing is held for it. */
  cancelRequest(id: number | string, reason?: string) {
    return this.request<{ message: string; request: BloodRequest }>(
      `/hospital/blood-requests/${id}/cancel`,
      'POST',
      reason ? { reason } : {},
    )
  }

  /**
   * Billing summary for a request.
   *
   * No Laravel route serves this yet — `useBloodRequestBilling` mocks it
   * until one exists.
   */
  requestBilling(id: number | string) {
    return this.request<any>(`/hospital/blood-requests/${id}/billing`)
  }

  /** Record a payment against a request's billing. Also mock-gated for now. */
  payRequestBilling(id: number | string, payload: { amount: number; method: 'CASH' | 'GCASH' }) {
    return this.request<any>(`/hospital/blood-requests/${id}/billing/pay`, 'POST', payload)
  }

  /**
   * Confirm dispatched units arrived.
   *
   * Omit `allocationIds` to confirm everything outstanding; pass them when a
   * delivery arrived short and only part of it should be confirmed.
   */
  confirmReceipt(id: number | string, allocationIds?: number[]) {
    return this.request<{ message: string; status: string; status_label: string; stocked_count?: number }>(
      `/hospital/blood-requests/${id}/confirm-receipt`,
      'POST',
      allocationIds ? { allocation_ids: allocationIds } : {},
    )
  }

  /* ---------------------------------------------------------------- *
   * The blood bank's own stock: bags it confirmed receipt of, and the
   * patient tags placed on them. `unit` is always the bag number.
   * ---------------------------------------------------------------- */

  /** This blood bank's bags, first-expiring-first. */
  inventory(params: HospitalInventoryFilters = {}) {
    return this.request<Paginated<HospitalUnit>>('/hospital/inventory', 'GET', params)
  }

  /** Counts per status, available stock per blood type, and lapsed tags the sweep has not reached. */
  inventorySummary() {
    return this.request<HospitalInventorySummary>('/hospital/inventory/summary')
  }

  /** One bag, with every tag ever placed on it. */
  inventoryUnit(unit: string) {
    return this.request<{ unit: HospitalUnit; tags: UnitTag[]; as_of: string }>(
      `/hospital/inventory/${encodeURIComponent(unit)}`,
    )
  }

  /** Tags that ended — untagged or transfused — newest first. */
  tagEvents(params: TagEventFilters = {}) {
    return this.request<Paginated<UnitTagEvent>>('/hospital/inventory/tag-events', 'GET', params)
  }

  /** Tag an available bag to a patient: Tag Assigned, 24 hours to crossmatch. */
  tagUnit(unit: string, payload: TagUnitPayload) {
    return this.request<UnitActionResult>(`/hospital/inventory/${encodeURIComponent(unit)}/tag`, 'POST', payload)
  }

  /** Record the crossmatch: the bag leaves storage, 24 hours to transfuse. */
  crossmatchUnit(unit: string) {
    return this.request<UnitActionResult>(`/hospital/inventory/${encodeURIComponent(unit)}/crossmatch`, 'POST')
  }

  /** Record the transfusion. The bag never returns to stock. */
  transfuseUnit(unit: string) {
    return this.request<UnitActionResult>(`/hospital/inventory/${encodeURIComponent(unit)}/transfuse`, 'POST')
  }

  /** Release an active tag before its deadline. A reason is required. */
  releaseTag(unit: string, reason: string) {
    return this.request<UnitActionResult>(`/hospital/inventory/${encodeURIComponent(unit)}/release`, 'POST', { reason })
  }

  /** Confirm a bag pending return is back in storage. */
  confirmUnitReturn(unit: string) {
    return this.request<UnitActionResult>(`/hospital/inventory/${encodeURIComponent(unit)}/return`, 'POST')
  }

  /** Record that a bag left the shelf for disposal. A reason is required. */
  discardUnit(unit: string, reason: string) {
    return this.request<UnitActionResult>(`/hospital/inventory/${encodeURIComponent(unit)}/discard`, 'POST', { reason })
  }

  /* ---------------------------------------------------------------- *
   * Receiving: the blood bank's request days, the weekly request it
   * sends a center on them, and deliveries from outside RedAgos typed
   * in bag by bag. A weekly request is one replenishment per blood type;
   * its receipt is confirmed on each, through confirmReceipt above.
   * ---------------------------------------------------------------- */

  /** The blood bank's request days, one schedule per blood center. */
  replenishmentSchedules() {
    return this.request<{ schedules: ReplenishmentSchedule[] }>('/hospital/replenishment-schedules')
  }

  /** Set the days the blood bank sends one center its weekly request. Takes effect at once. */
  saveReplenishmentSchedule(targetFacilityId: number, daysOfWeek: IsoWeekday[]) {
    return this.request<{ message: string; schedule: ReplenishmentSchedule }>(
      `/hospital/replenishment-schedules/${targetFacilityId}`,
      'PUT',
      { days_of_week: daysOfWeek },
    )
  }

  /** Stop keeping request days for one center. Weekly requests already sent are untouched. */
  deleteReplenishmentSchedule(targetFacilityId: number) {
    return this.request<{ message: string }>(`/hospital/replenishment-schedules/${targetFacilityId}`, 'DELETE')
  }

  /** Per center: whether today is a request day, whether today's request went, and recent missed days. */
  weeklyStatus() {
    return this.request<WeeklyStatus>('/hospital/weekly-requests/status')
  }

  weeklyRequests(params: { target_facility_id?: number; search?: string; per_page?: number; page?: number } = {}) {
    return this.request<Paginated<WeeklyRequest>>('/hospital/weekly-requests', 'GET', params)
  }

  /** Send a center today's weekly request. Refused on a day that is not one of its request days. */
  createWeeklyRequest(payload: CreateWeeklyRequestPayload) {
    return this.request<{ message: string; weekly_request: WeeklyRequest }>('/hospital/weekly-requests', 'POST', payload)
  }

  /** One weekly request, with every bag dispatched for it. */
  showWeeklyRequest(id: number | string) {
    return this.request<{ weekly_request: WeeklyRequest }>(`/hospital/weekly-requests/${id}`)
  }

  directDistributions(params: { transfusion_request_id?: number; search?: string; per_page?: number; page?: number } = {}) {
    return this.request<Paginated<DirectDistribution>>('/hospital/direct-distributions', 'GET', params)
  }

  /** Receive one external bag for a Patient Transfusion Request; it goes straight into the blood bank's stock. */
  receiveDirectDistribution(payload: ReceiveDirectDistributionPayload) {
    return this.request<{ message: string; direct_distribution: DirectDistribution }>(
      '/hospital/direct-distributions',
      'POST',
      payload,
    )
  }

  /** The hospital's minimum stock per blood type and component, against its own shelf. */
  stockThresholds() {
    return this.request<StockThresholdStatus>('/hospital/inventory/thresholds')
  }

  saveStockThresholds(payload: SaveStockThresholdsPayload) {
    return this.request<StockThresholdStatus>('/hospital/inventory/thresholds', 'PUT', payload)
  }

  /** The blood services a bag can be received from. */
  externalBloodSources() {
    return this.request<{ sources: ExternalBloodSource[] }>('/hospital/external-blood-sources')
  }

  addExternalBloodSource(payload: { name: string; code?: string | null }) {
    return this.request<{ message: string; source: ExternalBloodSource }>('/hospital/external-blood-sources', 'POST', payload)
  }

  listNotifications(params: { category?: string; read?: boolean; per_page?: number; page?: number } = {}) {
    return this.request<HospitalNotificationList>('/hospital/notifications', 'GET', params)
  }

  notificationsUnreadCount() {
    return this.request<{ unread_count: number }>('/hospital/notifications/unread-count')
  }

  markNotificationRead(id: string) {
    return this.request<any>(`/hospital/notifications/${id}`, 'PATCH')
  }

  markAllNotificationsRead() {
    return this.request<{ message: string; unread_count: number }>(
      '/hospital/notifications/mark-all-read',
      'POST',
    )
  }
}

export const hospitalService = HospitalService.getInstance()
