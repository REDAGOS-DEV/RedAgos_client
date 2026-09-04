import BaseService from '../BaseService'

export type IdentityFilters = {
  status?: string
  per_page?: number
  page?: number
}

/**
 * Separate from AdminService because that class binds itself to a single
 * `resource` string, and the two queues are unrelated.
 */
class DonorIdentityService extends BaseService {
  private static instance: DonorIdentityService | null = null
  private resource: string

  constructor() {
    super()
    this.resource = '/admin/donor-identities'
  }

  public static getInstance(): DonorIdentityService {
    if (!DonorIdentityService.instance) {
      DonorIdentityService.instance = new DonorIdentityService()
    }
    return DonorIdentityService.instance
  }

  async list(params: IdentityFilters = {}): Promise<any> {
    return this.request(this.resource, 'GET', params)
  }

  /**
   * `submissionVersion` is the version the reviewer was actually shown. The
   * server refuses the decision if the donor has replaced the document since.
   */
  async approve(uuid: string, submissionVersion: number): Promise<any> {
    return this.request(`${this.resource}/${uuid}/approve`, 'POST', {
      submission_version: submissionVersion,
    })
  }

  async reject(uuid: string, submissionVersion: number, reason: string): Promise<any> {
    return this.request(`${this.resource}/${uuid}/reject`, 'POST', {
      submission_version: submissionVersion,
      reason,
    })
  }

  /**
   * The ID photo, fetched with the reviewer's token. The route is authenticated
   * rather than signed, and every administrator view of it is audited.
   */
  async image(uuid: string): Promise<Blob> {
    return this.requestBlob(`/donors/${uuid}/identity-image`)
  }
}

export const donorIdentityService = DonorIdentityService.getInstance()
