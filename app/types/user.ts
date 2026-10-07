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

/**
 * Blood-centre departments, from the server's `Department` enum. A predefined
 * role decides its own; a custom role is placed in one directly.
 */
export type Department = 'collection' | 'processing' | 'testing' | 'issuance' | 'billing'

/** The Read / Write / Update / Delete privileges that cap a staff member's role. */
export type StaffPrivilege = 'read' | 'write' | 'update' | 'delete'

/**
 * The predefined blood-centre staff roles, from the server's `StaffRole` enum.
 */
export type StaffRole =
  | 'screening_physician'
  | 'phlebotomist'
  | 'apheresis_specialist'
  | 'medical_receptionist'
  | 'component_technologist'
  | 'processing_assistant'
  | 'serology_technologist'
  | 'lab_supervisor'
  | 'inventory_control_officer'
  | 'dispatch_coordinator'
  | 'it_data_clerk'
  | 'billing_clerk'

export interface Facility {
  id: number
  facility_name: string
  address: string | null
  /**
   * One of `approved`, `pending_approval` or `rejected`. There is no suspended
   * state: a facility is created active by a Super Admin and stays that way,
   * and the other two only occur on records left by the removed public
   * registration flow.
   */
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
  /** Null for donors, admins, blood-bank staff, a custom role and a management-only supervisor. */
  staff_role: StaffRole | null
  staff_role_label: string | null
  /** A typed role, when none of the predefined ones fits. */
  custom_role: string | null
  /** The predefined role's title or the custom role — what the roster shows. */
  role_label: string | null
  /** The privileges in force; all four for an account that never had them set. */
  staff_privileges: StaffPrivilege[]
  is_supervisor: boolean

  /**
   * Unrestricted platform admin. Holds every `admin.*` privilege without any of
   * them being stored, so read this rather than inspecting `admin_privileges`
   * when asking "may they do everything".
   */
  is_super_admin: boolean

  /**
   * The admin privileges actually granted, resolved by the server — already the
   * full set for a super admin. Empty for donors and blood-centre staff.
   */
  admin_privileges: string[]

  /**
   * The preset the granted privileges match (`verification_officer`,
   * `auditor`), `super_admin` for the unrestricted kind, or null for a
   * hand-picked set the account form shows as "Custom". Derived by the server
   * from the stored list, never stored alongside it.
   */
  admin_role: string | null

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
   * The donor's profile photo, from `UserResource.avatar_url`: a 30-minute
   * signed URL, never the storage path. Null when there is no photo.
   * `updateAvatar()` swaps it in place after an upload.
   */
  avatar: string | null
}
