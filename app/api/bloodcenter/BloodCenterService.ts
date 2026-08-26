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

  async register(payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/register`, 'POST', payload)
  }

  async referenceData(): Promise<any> {
    return this.request(`${this.resource}/reference-data`, 'GET')
  }

  async registrationStatus(): Promise<any> {
    return this.request(`${this.resource}/registration-status`, 'GET')
  }

  async resubmitRegistration(payload: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/registration/resubmit`, 'POST', payload)
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

  // --- Inventory (Inventory / Storage department) ---

  async inventory(params: Record<string, any> = {}): Promise<any> {
    return this.request(`${this.resource}/inventory`, 'GET', params)
  }

  async inventorySummary(): Promise<any> {
    return this.request(`${this.resource}/inventory/summary`, 'GET')
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
}

export const bloodCenterService = BloodCenterService.getInstance()