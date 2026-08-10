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