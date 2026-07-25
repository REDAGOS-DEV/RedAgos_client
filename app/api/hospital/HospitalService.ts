import BaseService from '../BaseService'

export type RequestFilters = { status?: string; urgency?: string; search?: string; page?: number }
export type BloodRequestPayload = {
  blood_type_id: number | string
  component_id: number | string
  patient_name: string
  patient_identifier?: string
  quantity: number
  urgency_level: 'routine' | 'emergency'
}

class HospitalService extends BaseService {
  private static instance: HospitalService
  static getInstance() {
    if (!HospitalService.instance) HospitalService.instance = new HospitalService()
    return HospitalService.instance
  }

  dashboard() { return this.request<any>('/hospital/dashboard') }
  referenceData() { return this.request<any>('/hospital/reference-data') }
  availability(params: object = {}) { return this.request<any>('/hospital/availability', 'GET', params) }
  requests(params: RequestFilters = {}) { return this.request<any>('/hospital/requests', 'GET', params) }
  requestDetail(id: string | number) { return this.request<any>(`/hospital/requests/${id}`) }
  createRequest(payload: BloodRequestPayload) { return this.request<any>('/hospital/requests', 'POST', payload) }
  cancelRequest(id: string | number, reason?: string) { return this.request<any>(`/hospital/requests/${id}/cancel`, 'POST', { reason }) }
  reports(params: object = {}) { return this.request<any>('/hospital/reports', 'GET', params) }
  notifications(params: object = {}) { return this.request<any>('/hospital/notifications', 'GET', params) }
  markNotificationRead(id: string | number) { return this.request<any>(`/hospital/notifications/${id}/read`, 'PATCH') }
  notificationPreferences() { return this.request<any>('/hospital/notification-preferences') }
  updateNotificationPreferences(payload: object) { return this.request<any>('/hospital/notification-preferences', 'PATCH', payload) }
  profile() { return this.request<any>('/hospital/profile') }
  updateProfile(payload: object) { return this.request<any>('/hospital/profile', 'PATCH', payload) }
}

export const hospitalService = HospitalService.getInstance()
