import BaseService from '../BaseService'

/** One entry from the server's privilege catalogue. */
export type AdminPrivilege = {
  key: string
  label: string
  description: string
}

/** A named privilege preset, as served by `GET /admin/privileges`. */
export type AdminPreset = {
  name: string
  privileges: string[]
}

export type PrivilegeCatalogue = {
  privileges: AdminPrivilege[]
  presets: AdminPreset[]
}

export type AdminAccountFilters = {
  per_page?: number
  page?: number
}

export type CreateAdminPayload = {
  first_name: string
  last_name: string
  email: string
  username: string
  password: string
  password_confirmation: string
  phone?: string
  roles: string[]
  /**
   * Omitted for an unrestricted account, where `is_super_admin` carries the
   * grant instead. Sending both is harmless — the server ignores the list for a
   * super admin — but sending neither creates an account that can reach
   * nothing, which is the intended fail-closed state.
   */
  admin_privileges?: string[]
  /**
   * Only an account that already holds unrestricted access may set this. The
   * server answers 422 on `is_super_admin` otherwise, which is the escalation
   * guard rather than a validation nicety.
   */
  is_super_admin?: boolean
}

/**
 * Platform admin accounts.
 *
 * Backed by the generic `/users` resource rather than an `/admin/accounts` one,
 * because that is what the server exposes — the whole group sits behind
 * `role:admin` plus `can:admin.accounts.manage`, so it is already the admin
 * account endpoint in everything but name.
 *
 * The privilege catalogue is fetched rather than duplicated here. A privilege
 * added to `AdminPrivileges` on the server then appears in the account form
 * without a client release, and the label shown is the label the gate enforces.
 */
class AdminAccountService extends BaseService {
  private static instance: AdminAccountService | null = null

  private resource: string

  constructor() {
    super()
    this.resource = '/users'
  }

  public static getInstance(): AdminAccountService {
    if (!AdminAccountService.instance) {
      AdminAccountService.instance = new AdminAccountService()
    }
    return AdminAccountService.instance
  }

  /** Every user the admin may list, paginated by the server. */
  async list(params: AdminAccountFilters = {}): Promise<any> {
    return this.request(this.resource, 'GET', params)
  }

  /** Create an account and assign its role and privileges in one request. */
  async create(payload: CreateAdminPayload): Promise<any> {
    return this.request(this.resource, 'POST', payload)
  }

  /** Change an existing account's privileges. */
  async update(uuid: string, payload: Partial<CreateAdminPayload>): Promise<any> {
    return this.request(`${this.resource}/${uuid}`, 'PATCH', payload)
  }

  /** The privilege catalogue and presets behind the account form. */
  async privileges(): Promise<PrivilegeCatalogue> {
    return this.request('/admin/privileges', 'GET')
  }
}

export const adminAccountService = AdminAccountService.getInstance()
