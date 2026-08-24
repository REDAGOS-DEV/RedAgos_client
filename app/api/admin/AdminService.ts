import BaseService from '../BaseService'

export type RegistrationFilters = {
  status?: string
  per_page?: number
  page?: number
}

class AdminService extends BaseService {
  private static instance: AdminService | null = null
  private resource: string

  constructor() {
    super()
    this.resource = '/admin/facility-registrations'
  }

  public static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService()
    }
    return AdminService.instance
  }

  async list(params: RegistrationFilters = {}): Promise<any> {
    return this.request(this.resource, 'GET', params)
  }

  async approve(id: number | string): Promise<any> {
    return this.request(`${this.resource}/${id}/approve`, 'POST')
  }

  async reject(id: number | string, reason: string): Promise<any> {
    return this.request(`${this.resource}/${id}/reject`, 'POST', { reason })
  }

  async suspend(id: number | string, reason: string): Promise<any> {
    return this.request(`${this.resource}/${id}/suspend`, 'POST', { reason })
  }

  async reinstate(id: number | string): Promise<any> {
    return this.request(`${this.resource}/${id}/reinstate`, 'POST')
  }
}

export const adminService = AdminService.getInstance()
