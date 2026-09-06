import BaseService from '../BaseService'

/** Canonical facility type names, as stored by the server. */
export type FacilityTypeName = 'blood_center' | 'blood_bank'

export type FacilityFilters = {
  status?: string
  facility_type?: FacilityTypeName | string
  search?: string
  per_page?: number
  page?: number
}

/** The initial account created alongside the facility. */
export type PrimaryAccountPayload = {
  first_name: string
  last_name: string
  position: string
  email: string
  phone: string
  password: string
  password_confirmation: string
  username?: string
}

export type CreateFacilityPayload = {
  facility_type: FacilityTypeName
  name: string
  doh_license_number: string
  address: string
  email: string
  phone: string
  description?: string
  operating_hours?: string
  is_accepting_donations?: boolean
  slot_capacity?: number
  slot_interval_minutes?: number
  slots_start_at?: string
  slots_end_at?: string
  primary_account: PrimaryAccountPayload
}

/**
 * Facility Management, for the Super Admin.
 *
 * This used to point at `/admin/facility-registrations` and offer nothing but
 * decisions on an inbox. Facilities are created here now — there is no public
 * registration endpoint left to review the output of — so the resource is the
 * facilities themselves.
 */
class AdminService extends BaseService {
  private static instance: AdminService | null = null
  private resource: string

  constructor() {
    super()
    this.resource = '/admin/facilities'
  }

  public static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService()
    }
    return AdminService.instance
  }

  /** Every facility, with its type, primary account and status. */
  async list(params: FacilityFilters = {}): Promise<any> {
    return this.request(this.resource, 'GET', params)
  }

  /** Create a facility and its primary account in one request. */
  async create(payload: CreateFacilityPayload): Promise<any> {
    return this.request(this.resource, 'POST', payload)
  }

  // --- Legacy -------------------------------------------------------------
  //
  // Approve and reject are only reachable for facilities left in
  // `pending_approval` by the removed public registration flow. Their records
  // are preserved rather than deleted, so the Super Admin needs a way to clear
  // them by hand. Nothing created through `create()` above ever lands in that
  // state.
  //
  // There is no suspend or reinstate here: both endpoints were removed with
  // the rest of the facility lifecycle.

  async approve(id: number | string): Promise<any> {
    return this.request(`${this.resource}/${id}/approve`, 'POST')
  }

  async reject(id: number | string, reason: string): Promise<any> {
    return this.request(`${this.resource}/${id}/reject`, 'POST', { reason })
  }
}

export const adminService = AdminService.getInstance()
