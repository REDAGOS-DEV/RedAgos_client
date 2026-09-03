/**
 * The shape `GET /api/user` actually returns.
 *
 * Transcribed from `UserResource::toArray()` in the Laravel app, not from what
 * the client happened to read. Fields the resource whitelists but the client
 * never used are included, so the next person can see what is available without
 * opening the backend.
 *
 * Keep this in step with `app/Http/Resources/UserResource.php`. Nothing enforces
 * that automatically — a mismatch shows up as a runtime `undefined`, which is
 * why the fields below are typed exactly as the resource emits them, including
 * the nullable ones.
 */

/** Canonical role names, as stored in the database and checked by `RequireRole`. */
export type RoleName = 'admin' | 'donor' | 'blood_center' | 'blood_bank'

/** Blood-centre departments, from the server's `Department` enum. */
export type Department = 'collection' | 'laboratory' | 'inventory' | 'billing'

export interface Facility {
  id: number
  facility_name: string
  address: string | null
  /** e.g. `pending_approval`, `approved`, `suspended`, `rejected`. */
  status: string | null
}

export interface AppUser {
  uuid: string
  first_name: string | null
  last_name: string | null
  full_name: string
  email: string
  phone: string | null
  username: string | null
  account_status: string | null
  email_verified: boolean
  /** ISO 8601, or null while the account is not yet activated. */
  activated_at: string | null

  /**
   * Empty when the relation was not eager-loaded — `whenLoaded(..., [])`. An
   * empty array therefore means "not loaded" as well as "no roles", so never
   * read it as proof the user is unprivileged.
   */
  roles: RoleName[]

  department: Department | null
  department_label: string | null
  is_supervisor: boolean

  /**
   * Mirrored so the client can render the right navigation. Presentation only:
   * every ability is re-checked by `can:` middleware on the route that uses it.
   * Never treat this as authorization.
   */
  permissions: string[]

  /** Only present when the donor profile was eager-loaded. */
  blood_type: string | null

  /** Only present when the facility relation was eager-loaded. */
  facility: Facility | null

  /**
   * Not part of `UserResource` — set client-side by `updateAvatar()` after an
   * upload returns a temporary signed URL. There is no `avatar_url` column yet.
   */
  avatar?: string | null
}
