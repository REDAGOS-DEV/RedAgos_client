import BaseService from '../BaseService'

export type BloodComponentRow = {
  id: number
  name: string
  shelf_life_days: number | null
  storage_temperature: string | null
  shelf_life_configured: boolean
}

export type UpdateBloodComponentPayload = {
  /** Null is a real answer: it puts the component back to "not configured". */
  shelf_life_days: number | null
  storage_temperature?: string | null
}

/**
 * The platform's blood component catalogue.
 *
 * Shelf life is what every blood unit's expiry date is derived from, and
 * `blood_components` carries no facility id — one row serves the whole network.
 * It is therefore set here, by a platform admin, rather than by a blood centre
 * that would be changing every other centre's expiry dates without knowing it.
 */
class BloodComponentService extends BaseService {
  private static instance: BloodComponentService | null = null
  private resource: string

  constructor() {
    super()
    this.resource = '/admin/blood-components'
  }

  public static getInstance(): BloodComponentService {
    if (!BloodComponentService.instance) {
      BloodComponentService.instance = new BloodComponentService()
    }
    return BloodComponentService.instance
  }

  async list(): Promise<any> {
    return this.request(this.resource, 'GET')
  }

  async update(id: number, payload: UpdateBloodComponentPayload): Promise<any> {
    return this.request(`${this.resource}/${id}`, 'PATCH', payload)
  }
}

export const bloodComponentService = BloodComponentService.getInstance()
