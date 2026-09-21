import BaseService from '../BaseService'
import type {
  AvailabilityResult,
  BloodRequest,
  BloodRequestFilters,
  CreateBloodRequestPayload,
  RequestReferenceData,
} from '~/types/bloodRequest'

/**
 * The requester side of the API: a hospital blood bank's own requests.
 *
 * Every method here maps to a route that exists. The previous version of this
 * file declared a surface the Laravel app never served, and the pages called a
 * further dozen methods it did not even declare — `listRequests`,
 * `bloodAvailability`, `uploadDocument` and the rest — which threw at runtime.
 * Anything not below is not available; add the endpoint before adding a method.
 */

export type { BloodRequestFilters, CreateBloodRequestPayload }

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

  /** This blood bank's own requests. */
  listRequests(params: BloodRequestFilters = {}) {
    return this.request<Paginated<BloodRequest>>('/hospital/blood-requests', 'GET', params)
  }

  createRequest(payload: CreateBloodRequestPayload) {
    return this.request<{ message: string; request: BloodRequest }>(
      '/hospital/blood-requests',
      'POST',
      payload,
    )
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
    return this.request<{ message: string; status: string; status_label: string }>(
      `/hospital/blood-requests/${id}/confirm-receipt`,
      'POST',
      allocationIds ? { allocation_ids: allocationIds } : {},
    )
  }

  listNotifications(params: { category?: string; read?: boolean; per_page?: number } = {}) {
    return this.request<any>('/hospital/notifications', 'GET', params)
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
