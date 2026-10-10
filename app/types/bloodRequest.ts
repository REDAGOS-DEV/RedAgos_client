/**
 * The blood request vocabulary, as the API actually speaks it.
 *
 * Before this file the client carried four mutually incompatible sets of
 * status strings and three of urgency, none of which matched the database:
 * `useBloodRequestDetails` spoke Title Case ("Ready for Pickup"), the request
 * list spoke lower case ("ready"), the incoming queue spoke a third set
 * ("Under Review"), and the fulfilment page ran an eight-stage pipeline of its
 * own. None of them could ever have round-tripped, because the schema has only
 * ever accepted the six values below.
 *
 * This module is the single source of truth. Import the types and the label
 * maps from here rather than restating literals in a component.
 */

/** blood_requests.status — the coarse lifecycle of the request itself. */
export type BloodRequestStatus =
  | 'pending'
  | 'processing'
  | 'partial'
  | 'fulfilled'
  | 'rejected'
  | 'cancelled'

/**
 * blood_requests.urgency_level — the only two the schema accepts.
 *
 * The DOH request form calls these ROUTINE and STAT, and so does the UI. The
 * stored value stays `emergency`, because the triage scope, the emergency
 * banner and the submission notification all key off it. See PRIORITY_LABELS.
 */
export type UrgencyLevel = 'routine' | 'emergency'

/**
 * blood_requests.request_purpose — why the request was raised.
 *
 * Separate from urgency and never to be merged with it: a restock can be STAT
 * and a named-patient transfusion can be routine. This decides whether the
 * request carries patient identity at all.
 */
export type RequestPurpose = 'patient_transfusion' | 'replenishment'

/**
 * blood_requests.request_source — where the request was keyed in.
 *
 * A separate axis from purpose. A walk-in is still a Patient Transfusion
 * request from the patient's hospital; the watcher simply brought it to a blood
 * centre, which confirmed it with the hospital by phone and entered it there.
 */
export type RequestSource = 'blood_bank_portal' | 'blood_center_walk_in'

/**
 * How far one line of a request has been met. Derived by the API from what was
 * released and closed — never stored.
 */
export type LineFulfilmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'closed_short'

/**
 * How far one component of a Patient Transfusion Request has been met, across
 * every facility asked for it. Derived by the API — never stored.
 */
export type TransfusionLineStatus =
  | 'awaiting_response'
  | 'needs_allocation'
  | 'partially_approved'
  | 'approved'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'closed_short'

/** Why the rest of a line will not be supplied by the facility handling it. */
export type LineClosureReason = 'unavailable' | 'not_needed'

/** request_allocations.status — one bag's hold against one request. */
export type AllocationStatus = 'allocated' | 'released' | 'cancelled'

/** blood_units.status — where a bag is in its own life. */
export type BloodUnitStatus =
  | 'available'
  | 'reserved'
  | 'issued'
  | 'expired'
  | 'discarded'

/**
 * billings.status.
 *
 * `subsidised`: the government met the cost. `statement_only`: a weekly
 * (replenishment) order, billed to the hospital by statement and settled
 * outside RedAgos — it takes no payment here and never blocks release.
 * `settled_outside`: that weekly bill once billing staff record the hospital's
 * settlement of it, with its reference and date.
 */
export type BillingStatus = 'unpaid' | 'partial' | 'paid' | 'void' | 'subsidised' | 'statement_only' | 'settled_outside'

/**
 * payments.payment_method / payments.status / payments.source
 *
 * `voided`: a counter payment voided on the Billing Supervisor's approval
 * while its shift was open. It stays on record and no longer counts.
 */
export type PaymentMethod = 'cash' | 'gcash'
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'voided'
export type PaymentSource = 'manual' | 'gateway'

/** billing_transactions: what a journal row was for, what it was, and where it came in. */
export type TransactionCategory = 'patient_transfusion' | 'weekly_replenishment'
export type TransactionType =
  | 'charge'
  | 'charge_adjustment'
  | 'payment'
  | 'payment_correction'
  | 'payment_void'
  | 'subsidy'
  | 'external_settlement'
  | 'opening_balance'
export type TransactionChannel = 'counter' | 'gateway' | 'outside' | 'system'

/** payment_attempts.status — one GCash checkout's state. */
export type PaymentAttemptStatus =
  | 'creating'
  | 'active'
  | 'awaiting_verification'
  | 'completed'
  | 'expired'
  | 'canceled'
  | 'failed'
  | 'superseded'

export interface FacilityStub {
  id: number
  name: string
  address: string | null
}

/** On a request, both are null when its lines differ in blood type: a weekly request restocking several. */
export interface BloodTypeStub {
  id: number | null
  code: string | null
}

export interface ComponentStub {
  id: number
  name: string | null
}

export interface RequestAllocation {
  id: number
  /** Which line of the request this bag answers. */
  request_item_id: number | null
  unit_id: string
  status: AllocationStatus
  status_label: string
  expiry_date: string | null
  storage_location?: string | null
  allocated_at: string | null
  released_at: string | null
  /** Who physically took the units. Null for a release made before it was recorded, or with no name given. */
  handed_to?: string | null
  received_at: string | null
}

/**
 * One component asked for on a request, with the indication claimed for it.
 *
 * `quantity` is what was requested and never changes. The fulfilment figures
 * beside it say what was provided: fulfilled is what the centre released,
 * received what the hospital confirmed, and remaining is requested less
 * fulfilled.
 *
 * `allocated_count` and `outstanding_quantity` are only sent when the caller
 * loaded allocations with units — the detail views.
 */
export interface BloodRequestItem {
  id: number
  /** On a facility allocation: the patient's requirement line this is a share of. */
  transfusion_request_item_id?: number | null
  /** The request's own on every request but a weekly one, whose lines can each restock a different type. */
  blood_type?: BloodTypeStub
  component: ComponentStub
  quantity: number
  indication_code: string | null
  indication_label: string | null
  indication_description: string | null
  indication_other: string | null
  /** The criterion to show: the requester's own words for an "Others" code. */
  indication_text: string | null
  closed_at?: string | null
  closure_reason?: LineClosureReason | null
  closure_reason_label?: string | null
  closure_note?: string | null
  reserved_quantity?: number
  fulfilled_quantity?: number
  received_quantity?: number
  remaining_quantity?: number
  /** What this facility may still hold for the line. */
  allocatable_quantity?: number
  line_status?: LineFulfilmentStatus
  line_status_label?: string
  allocated_count?: number
  outstanding_quantity?: number
}

/**
 * The Patient Transfusion Request a facility allocation is a share of.
 *
 * A stub: a centre sees which requirement, and how much of each component the
 * patient needs in all — never which other centres were asked.
 */
export interface TransfusionRequestStub {
  id: number
  reference_number: string
  status: BloodRequestStatus
  status_label: string
  is_open: boolean
  required: Array<{ transfusion_request_item_id: number; component_id: number; component: string | null; quantity: number }>
}

/** The watcher who presented a walk-in, and who at the hospital confirmed it. */
export interface WalkInDetails {
  representative: {
    name: string
    relationship: string
    contact: string
    id_type: string | null
    id_type_label: string | null
    id_number: string | null
  }
  presented_reference: string | null
  attending_physician: string | null
  patient_ward: string | null
  patient_record_number: string | null
  verification: {
    method: 'phone'
    verifier_name: string
    verifier_position: string
    verifier_contact: string
    verified_at: string | null
    recorded_by: string | null
    notes: string | null
  }
  duplicate_acknowledgement: string | null
}

/** Null on a replenishment request, which has no patient. */
export interface PatientDetails {
  surname: string | null
  first_name: string | null
  middle_name: string | null
  /** "SURNAME, First Middle", as the form prints it. */
  full_name: string | null
  age: number | null
  sex: 'male' | 'female' | null
}

export interface BloodRequest {
  id: number
  reference_number: string
  requesting_facility: FacilityStub | null
  /** Absent on the fulfilling side's projection, which always means itself. */
  target_facility?: FacilityStub | null
  request_purpose: RequestPurpose
  purpose_label: string
  request_source: RequestSource
  source_label: string
  is_walk_in: boolean
  /** The hospital user who submitted it. Null on a walk-in. */
  requester_name: string | null
  /** The blood-centre staff member who entered a walk-in. */
  recorder_name: string | null
  patient: PatientDetails | null
  /** Null id and code when the lines differ in blood type; blood_types then names them all. */
  blood_type: BloodTypeStub
  /** Every blood type the lines ask for, in blood-group order. One code on every request but a weekly one. */
  blood_types?: string[]
  /** What the request asks for. A form can tick several components. */
  items: BloodRequestItem[]
  /** The sum of every line's units. Derived server-side, never stored. */
  quantity: number
  urgency_level: UrgencyLevel
  urgency_label: string
  is_emergency?: boolean
  status: BloodRequestStatus
  status_label: string
  /** False once nothing more may be done: terminal, or partial with every remainder closed. */
  is_open: boolean
  closed_at: string | null
  /** Held units that still lay claim to stock. Counted in SQL, not derived here. */
  allocated_count: number
  received_count: number
  /** What this facility still has to find. */
  outstanding_quantity: number
  /** Released units — fulfilment is counted at dispatch. */
  fulfilled_quantity: number
  /** Requested less fulfilled. */
  remaining_quantity: number
  rejection_reason: string | null
  request_date: string | null
  reviewed_at: string | null
  fulfilled_at: string | null
  /** Set when this request is one facility's share of a Patient Transfusion Request. */
  transfusion_request: TransfusionRequestStub | null
  /**
   * Set when this replenishment was sent as a weekly request. It is
   * dispatched in one delivery, and whatever is not supplied is closed as
   * unavailable when it goes.
   */
  weekly_request?: { id: number; reference_number: string | null; request_day: string | null } | null
  walk_in: WalkInDetails | null
  allocations?: RequestAllocation[]
}

/**
 * One line of a history snapshot, as GET …/history returns it.
 *
 * An allocation's event snapshots its own lines (`request_item_id`,
 * reserved); a requirement's event snapshots the patient's need
 * (`transfusion_request_item_id`, required, approved, unallocated). Both carry
 * requested, fulfilled, received and remaining, so a timeline reads them alike.
 */
export interface RequestEventLine {
  request_item_id?: number
  transfusion_request_item_id?: number
  /** The line's blood type code, on an allocation's snapshot recorded since lines carried their own. */
  blood_type?: string | null
  component: string | null
  required?: number
  requested: number
  reserved?: number
  approved?: number
  fulfilled: number
  received: number
  unallocated?: number
  remaining: number
  status: LineFulfilmentStatus | TransfusionLineStatus
  status_label: string | null
}

export interface RequestEvent {
  id: number
  event: string
  event_label: string
  from_status: BloodRequestStatus | null
  to_status: BloodRequestStatus | null
  to_status_label: string | null
  actor: { id: number; name: string } | null
  actor_facility: { id: number; name: string } | null
  /** Which facility allocation it happened to; null for an event on the requirement itself. */
  allocation?: { id: number; reference_number: string; facility: string | null } | null
  item: { id: number; blood_type?: string | null; component: string | null } | null
  related_request: { id: number; reference_number: string; facility: string | null } | null
  lines: RequestEventLine[]
  unit_count: number
  unit_ids: string[]
  meta: Record<string, unknown>
  note: string | null
  created_at: string | null
}

/**
 * A Patient Transfusion Request the hospital already has for the walk-in's patient.
 *
 *  - here: this centre already has an open allocation of it — open that instead.
 *  - continue: some units are asked of nobody yet — add this centre's share to it.
 *  - duplicate: anything else — a second request, allowed only with a reason.
 */
export type DuplicateRelation = 'here' | 'continue' | 'duplicate'

export interface DuplicateMatch {
  /** The Patient Transfusion Request. */
  id: number
  reference_number: string
  relation: DuplicateRelation
  /** This centre's open allocation of it, on a "here" match. */
  allocation: { id: number; reference_number: string } | null
  /** The centres asked for it, by name. */
  facilities: string[]
  request_source: RequestSource
  source_label: string
  status: BloodRequestStatus
  status_label: string
  is_open: boolean
  request_date: string | null
  blood_type: BloodTypeStub
  urgency_level: UrgencyLevel
  patient: PatientDetails
  lines: Array<{
    transfusion_request_item_id: number
    component: ComponentStub
    required: number
    approved: number
    fulfilled: number
    unallocated: number
  }>
  unallocated_quantity: number
}

/** GET /blood-center/blood-requests/walk-in/reference */
export interface WalkInReference {
  hospitals: Array<{ id: number; name: string; address: string | null; phone: string | null }>
  blood_types: Array<{ id: number; code: string; label: string }>
  components: ComponentOption[]
  priorities: Array<{ value: UrgencyLevel; label: string }>
  purpose: { value: RequestPurpose; label: string }
  id_types: Array<{ value: string; label: string }>
  duplicate_window_days: number
}

export interface CreateWalkInPayload {
  hospital_id: number
  /** Set to add this centre's share to an existing Patient Transfusion Request. */
  transfusion_request_id?: number | null
  urgency_level: UrgencyLevel
  patient_surname?: string
  patient_first_name?: string
  patient_middle_name?: string | null
  patient_age?: number
  patient_sex?: 'male' | 'female'
  blood_type_id?: number
  presented_reference?: string | null
  attending_physician?: string | null
  patient_ward?: string | null
  patient_record_number?: string | null
  items: Array<{
    component_id?: number
    transfusion_request_item_id?: number
    quantity: number
    indication_code?: string | null
    indication_other?: string | null
  }>
  representative: {
    name: string
    relationship: string
    contact: string
    id_type?: string | null
    id_number?: string | null
  }
  verification: {
    confirmed: true
    verifier_name: string
    verifier_position: string
    verifier_contact: string
    verified_at: string
    notes?: string | null
  }
  duplicate_acknowledgement?: string | null
}

export interface AvailabilityHolding {
  facility: FacilityStub
  available: number
  /** How much of the ask this facility covers — not the same as what it holds. */
  can_fulfil: number
  covers_request: boolean | null
  earliest_expiry: string | null
}

export interface AvailabilityResult {
  criteria: {
    blood_type: BloodTypeStub
    component: ComponentStub
    quantity: number | null
  }
  facilities: AvailabilityHolding[]
  totals: { facilities_with_stock: number; units_available: number }
  /** Always true. A search result is never a hold — see the API's own note. */
  advisory: boolean
  as_of: string
}

export interface Billing {
  id: number
  request_id: number
  total_amount: number
  collected: number
  status: BillingStatus
  status_label: string
  is_zero_rated: boolean
  is_subsidised: boolean
  /** A weekly bill, before and after the hospital settles it. */
  is_statement_only: boolean
  is_settled_outside?: boolean
  /** False for void, subsidised and statement-only statements: nothing is collected in RedAgos. */
  collects_payment: boolean
  represents_collected_money: boolean
  clears_release: boolean
  billing_date: string | null
  /** Set once the hospital settled a weekly bill outside RedAgos. */
  settlement?: { settled_at: string | null; reference: string | null; note: string | null } | null
}

/** One payment on a statement, as GET …/billings/{id}/payments lists it to whoever may record payments. */
export interface RecordedPayment {
  id: number
  amount_paid: number
  /** Cash at the counter: what was handed over, and the change given back. */
  amount_tendered: string | null
  change_given: string | null
  payment_method: PaymentMethod
  payment_method_label: string
  reference_number: string | null
  status: PaymentStatus
  status_label: string
  source: PaymentSource
  source_label: string
  payment_date: string | null
  cash_session: { id: number; session_number: string; is_open: boolean } | null
  voided_at: string | null
  void_reason: string | null
  receipt: PaymentReceiptSummary | null
  pending_correction: boolean
  pending_void: boolean
  can_request_correction: boolean
  can_request_void: boolean
}

/** One row of the billing journal. Amounts are decimal strings, signed against the bill. */
export interface BillingTransaction {
  id: number
  transaction_number: string
  occurred_at: string | null
  category: TransactionCategory
  category_label: string
  type: TransactionType
  type_label: string
  channel: TransactionChannel
  channel_label: string
  payment_method: PaymentMethod | null
  payment_method_label: string | null
  amount: string
  /** A debit raises what is owed; a credit settles it. */
  direction: 'debit' | 'credit' | 'none'
  balance_after: string
  billing_id: number
  request: { id: number; reference_number: string } | null
  payment_id: number | null
  receipt: { id: number; receipt_number: string } | null
  statement: { id: number; document_number: string } | null
  cash_session: { id: number; session_number: string } | null
  reverses_transaction_number: string | null
  reference: string | null
  note: string | null
  recorded_by: string | null
}

/** The totals of every journal row a filter matches, as positive money. */
export interface BillingTransactionTotals {
  count: number
  charged: string
  collected: string
  subsidised: string
  settled_outside: string
}

/** GET /blood-center/billings/summary — counted on the server. */
export interface BillingSummary {
  outstanding: { count: number; amount: string }
  collected_today: string
  collected_this_month: string
  subsidised_this_month: { count: number; amount: string }
  weekly_awaiting_settlement: { count: number; amount: string }
  weekly_settled_this_month: number
  issuer: { name: string | null; logo_url: string | null }
  as_of: string
}

/** A cash shift's drawer, in decimal strings. Counted and variance only once closed. */
export interface CashShiftFigures {
  opening_float: string
  cash_collected: string
  cash_voided: string
  expected_cash: string
  gcash_counter: string
  gcash_checkout: string
  total_collected: string
  counted_cash?: string
  variance?: string
}

/** A cashier's shift at the billing counter. `figures` and `transactions` come with a reading. */
export interface CashShift {
  id: number
  session_number: string
  status: 'open' | 'closed'
  status_label: string
  counter_label: string | null
  cashier: { id: number; name: string } | null
  opened_at: string | null
  closed_at: string | null
  closed_by: string | null
  opening_float: string
  expected_cash: string | null
  counted_cash: string | null
  variance: string | null
  count_breakdown: Record<string, number> | null
  closing_note: string | null
  figures?: CashShiftFigures
  counts?: { payments: number; voids: number }
  pending_voids?: number
  transactions?: BillingTransaction[]
}

/** A patient bill as the counter finds it. Amounts are decimal strings. */
export interface CounterBill {
  request_id: number
  reference_number: string
  transfusion_reference: string | null
  presented_reference: string | null
  is_walk_in: boolean
  patient_name: string | null
  requesting_facility: string | null
  blood_types: string[]
  is_emergency: boolean
  request_date: string | null
  billing_status: BillingStatus
  billing_status_label: string
  total_amount: string
  collected: string
  outstanding: string
  clears_release: boolean
  takes_payment: boolean
  /** Only on GET /pos/bills/{id}. */
  lines?: StatementLine[]
  billing?: Billing
  checkout?: CheckoutAvailability
  open_attempt?: PaymentAttempt | null
}

/** One frozen line of an issued statement. Amounts are decimal strings. */
export interface StatementLine {
  component_name: string
  quantity: number
  unit_price: string
  line_total: string
}

/** One issued Statement of Account (SOA-…). It never changes once issued. */
export interface StatementRevision {
  id: number
  document_number: string
  revision_number: number
  reason: 'statement' | 'checkout' | 'payment'
  billing_status: BillingStatus
  billing_status_label: string
  statement_only: boolean
  currency: string
  total_amount: string
  collected_at_issue: string
  amount_due: string
  issued_at: string | null
  /** The staff member whose action issued it; null for one issued by the system. */
  issued_by?: string | null
  issuer?: BillingFacilityCard
  /** A Patient Transfusion statement bills the patient; a weekly one the hospital, with no patient. */
  bill_to?: { patient_name: string | null; facility: string | null }
  request_reference?: string | null
  lines: StatementLine[]
}

/** The issuing centre as a billing document heads it. */
export interface BillingFacilityCard {
  name: string | null
  address: string | null
  doh_license_number?: string | null
  phone?: string | null
  email?: string | null
  /**
   * A signed, expiring link to the logo the document was issued with — the
   * centre's own, never a shared mark. Null when the centre has none; its
   * initials stand in.
   */
  logo_url?: string | null
}

/** A Payment Acknowledgement Receipt (AR-…), as lists show it. Not a BIR official receipt. */
export interface PaymentReceiptSummary {
  id: number
  receipt_number: string
  issued_at: string | null
  amount_paid: string | null
  balance_after: string | null
  is_partial: boolean
  payment_method_label: string | null
  statement_document_number: string | null
  voided: boolean
  void_reason: string | null
  replaces_receipt_number: string | null
  /*
   * The rest of the receipt, frozen when it was issued, for showing it as it
   * prints. Never the payment reference: that comes with the payment, to
   * whoever may record payments.
   */
  balance_before?: string | null
  payer_name?: string | null
  received_by?: string | null
  issuing_facility?: BillingFacilityCard | null
  request?: { reference_number: string | null; patient_name: string | null; requesting_facility: string | null } | null
  statement?: { document_number: string; revision_number: number; total_amount: string; amount_due: string } | null
  payment?: {
    method_label: string | null
    source: PaymentSource | null
    paid_at: string | null
    /** Cash at the counter: what was handed over, and the change given back. */
    amount_tendered?: string | null
    change_given?: string | null
    cash_session_number?: string | null
  }
  /** Empty on a receipt issued before receipts carried their lines. */
  lines?: StatementLine[]
}

/**
 * One GCash checkout opened at the counter. The payer's name is never sent
 * back. `checkout_url` is present only while the checkout can still be paid.
 */
export interface PaymentAttempt {
  id: number
  status: PaymentAttemptStatus
  status_label: string
  amount: string
  currency: string
  checkout_url: string | null
  expires_at: string | null
  statement_document_number: string | null
  failure_code: string | null
  review_required: boolean
  review_reason: string | null
  created_at: string | null
  completed_at: string | null
}

/** Why a checkout cannot be opened right now, from GET /blood-center/billings/{id}. */
export interface CheckoutAvailability {
  available: boolean
  reason: string | null
}

/** GET /hospital/blood-requests/{id}/billing — read only. */
export interface HospitalBillingView {
  billing: Billing
  statements: StatementRevision[]
  receipts: PaymentReceiptSummary[]
}

export interface CreateBloodRequestItemPayload {
  component_id: number
  quantity: number
  indication_code: string | null
  /** Required when the chosen code is an "Others" code. */
  indication_other?: string | null
}

/* ------------------------------------------------------------------ *
 * Patient Transfusion Requests
 *
 * The patient's need is the Patient Transfusion Request (PTR-…); each centre
 * asked for a share of it has a Facility Allocation (RQ-…), which is an
 * ordinary BloodRequest; the bags a centre holds for its allocation are
 * "reserved units" (RequestAllocation). docs/IMPLEMENTATION_DECISIONS.md on
 * the server keeps the full terminology map.
 * ------------------------------------------------------------------ */

/**
 * One component of the patient's need, beside what came of asking for it.
 *
 * `quantity` is required and never changes. requested is what was asked of
 * centres; awaiting what they have still to answer; approved what they hold or
 * released (approval reserves); remaining is required less approved; and
 * unallocated what nobody is holding or still considering — what can still be
 * asked of another centre.
 */
export interface TransfusionLine {
  id: number
  component: ComponentStub
  quantity: number
  indication_code: string | null
  indication_label: string | null
  indication_text: string | null
  requested: number
  awaiting: number
  approved: number
  fulfilled: number
  received: number
  remaining: number
  unallocated: number
  closed_at: string | null
  closure_note: string | null
  line_status: TransfusionLineStatus | null
  line_status_label: string | null
}

export interface TransfusionTotals {
  required: number
  requested: number
  awaiting: number
  approved: number
  fulfilled: number
  received: number
  remaining: number
  unallocated: number
}

/** One centre's share, with its status in the words a hospital uses. */
export type FacilityAllocation = BloodRequest & { allocation_status_label: string }

export interface TransfusionRequest {
  id: number
  reference_number: string
  request_purpose: 'patient_transfusion'
  purpose_label: string
  request_source: RequestSource
  source_label: string
  is_walk_in: boolean
  requesting_facility: FacilityStub | null
  requester_name: string | null
  recorder_name: string | null
  patient: PatientDetails
  blood_type: BloodTypeStub
  urgency_level: UrgencyLevel
  urgency_label: string
  is_emergency: boolean
  status: BloodRequestStatus
  status_label: string
  is_open: boolean
  /** Some units are asked of nobody — the hospital should search again. */
  needs_allocation: boolean
  totals: TransfusionTotals
  lines: TransfusionLine[]
  allocation_count: number
  /** Names of the centres asked, for a listing row. */
  facilities: string[]
  internal_stock_checked_at: string | null
  request_date: string | null
  fulfilled_at: string | null
  closed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  /** Only on the detail view. */
  allocations?: FacilityAllocation[]
  walk_in?: WalkInDetails | null
}

/** One centre holding matching stock, and how much of the need it is suggested for. */
export interface SourcingHolding {
  facility: FacilityStub
  available: number
  earliest_expiry: string | null
  suggested: number
}

export interface SourcingLine {
  transfusion_request_item_id: number | null
  component: ComponentStub
  /** What this plan is for: the need, or what is still unallocated. */
  quantity: number
  /** Earliest expiry first — the FEFO rule — then the deepest shelf. */
  facilities: SourcingHolding[]
  /** Eligible centres holding none today; they may still be asked. */
  other_facilities: FacilityStub[]
  suggested_total: number
  shortfall: number
}

/** POST /hospital/transfusion-requests/sourcing and GET …/{id}/sourcing */
export interface SourcingPlan {
  blood_type: BloodTypeStub
  lines: SourcingLine[]
  /** Always true: a plan holds nothing. */
  advisory: boolean
  as_of: string
}

/** One centre asked for a share: a component and quantity per line. */
export interface AllocationSharePayload {
  facility_id: number
  lines: Array<{ component_id: number; quantity: number }>
}

export interface CreateTransfusionRequestPayload {
  internal_stock_confirmed: true
  blood_type_id: number
  urgency_level: UrgencyLevel
  patient_surname: string
  patient_first_name: string
  patient_middle_name?: string | null
  patient_age: number
  patient_sex: 'male' | 'female'
  lines: CreateBloodRequestItemPayload[]
  allocations: AllocationSharePayload[]
}

/** An active requirement for the patient, before the hospital records another. */
export interface PatientMatch {
  id: number
  reference_number: string
  request_source: RequestSource
  source_label: string
  status: BloodRequestStatus
  status_label: string
  is_open: boolean
  request_date: string | null
  facilities: string[]
  totals: TransfusionTotals
}

export interface TransfusionRequestFilters {
  status?: BloodRequestStatus
  urgency_level?: UrgencyLevel
  request_source?: RequestSource
  search?: string
  per_page?: number
  page?: number
}

/** GET /hospital/reference-data — what the request form is built from. */
export interface IndicationCodeOption {
  code: string
  label: string
  description: string
  /** True for the "Others" codes, which the form says trigger a review. */
  requires_explanation: boolean
}

export interface ComponentOption {
  id: number
  name: string
  indication_codes: IndicationCodeOption[]
}

export interface RequestReferenceData {
  blood_types: Array<{ id: number; code: string; label: string }>
  components: ComponentOption[]
  purposes: Array<{ value: RequestPurpose; label: string; requires_patient: boolean }>
  priorities: Array<{ value: UrgencyLevel; label: string }>
}

export interface BloodRequestFilters {
  status?: BloodRequestStatus
  urgency_level?: UrgencyLevel
  request_source?: RequestSource
  request_purpose?: RequestPurpose
  blood_type_id?: number
  component_id?: number
  search?: string
  per_page?: number
  page?: number
}

/**
 * Display labels, kept beside the types they describe.
 *
 * The API already sends `status_label` and `urgency_label`; these exist for the
 * places that only have the raw value to hand, such as a filter pill built from
 * the status list rather than from a row.
 */
export const REQUEST_STATUS_LABELS: Record<BloodRequestStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  partial: 'Partially Fulfilled',
  fulfilled: 'Fulfilled',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  routine: 'Routine',
  emergency: 'Emergency',
}

/**
 * The same two levels as the DOH request form names them.
 *
 * Use these anywhere the user is looking at request paperwork; URGENCY_LABELS
 * remains for the operational screens that have always said "Emergency".
 */
export const PRIORITY_LABELS: Record<UrgencyLevel, string> = {
  routine: 'Routine',
  emergency: 'STAT',
}

export const REQUEST_PURPOSE_LABELS: Record<RequestPurpose, string> = {
  patient_transfusion: 'Patient Transfusion',
  replenishment: 'Blood Bank Replenishment',
}

export const REQUEST_PURPOSES: RequestPurpose[] = ['patient_transfusion', 'replenishment']

export const REQUEST_SOURCE_LABELS: Record<RequestSource, string> = {
  blood_bank_portal: 'Blood Bank Portal',
  blood_center_walk_in: 'Blood Center Walk-in',
}

export const REQUEST_SOURCES: RequestSource[] = ['blood_bank_portal', 'blood_center_walk_in']

export const LINE_STATUS_LABELS: Record<LineFulfilmentStatus, string> = {
  unfulfilled: 'Unfulfilled',
  partial: 'Partially Fulfilled',
  fulfilled: 'Fulfilled',
  closed_short: 'Closed — not supplied',
}

export const LINE_STATUS_TONES: Record<LineFulfilmentStatus, 'info' | 'progress' | 'warning' | 'success' | 'danger' | 'muted'> = {
  unfulfilled: 'danger',
  partial: 'warning',
  fulfilled: 'success',
  closed_short: 'muted',
}

export const TRANSFUSION_LINE_STATUS_LABELS: Record<TransfusionLineStatus, string> = {
  awaiting_response: 'Awaiting facility response',
  needs_allocation: 'Needs another facility',
  partially_approved: 'Partially approved',
  approved: 'Approved',
  partially_fulfilled: 'Partially fulfilled',
  fulfilled: 'Fulfilled',
  closed_short: 'Closed — no longer needed',
}

export const TRANSFUSION_LINE_STATUS_TONES: Record<TransfusionLineStatus, 'info' | 'progress' | 'warning' | 'success' | 'danger' | 'muted'> = {
  awaiting_response: 'info',
  needs_allocation: 'danger',
  partially_approved: 'progress',
  approved: 'progress',
  partially_fulfilled: 'warning',
  fulfilled: 'success',
  closed_short: 'muted',
}

export const ALLOCATION_STATUS_LABELS: Record<AllocationStatus, string> = {
  allocated: 'Reserved',
  released: 'Released',
  cancelled: 'Cancelled',
}

/** Every status, in lifecycle order, for filter controls. */
export const REQUEST_STATUSES: BloodRequestStatus[] = [
  'pending',
  'processing',
  'partial',
  'fulfilled',
  'rejected',
  'cancelled',
]

export const URGENCY_LEVELS: UrgencyLevel[] = ['routine', 'emergency']

/**
 * The tone a status should be rendered in.
 *
 * Kept here so a badge in the hospital portal and one in the blood centre
 * cannot drift into disagreeing about what "partial" looks like.
 */
export const REQUEST_STATUS_TONES: Record<BloodRequestStatus, 'info' | 'progress' | 'warning' | 'success' | 'danger' | 'muted'> = {
  pending: 'info',
  processing: 'progress',
  partial: 'warning',
  fulfilled: 'success',
  rejected: 'danger',
  cancelled: 'muted',
}

/**
 * Name the components a request asks for, in one line.
 *
 * A request can tick several components on one form, but a table row has room
 * for one phrase. Two are listed in full because that is the common case; past
 * that it counts the rest rather than overflowing the column.
 */
export function componentSummary(request: Pick<BloodRequest, 'items'>): string {
  // Distinct: a weekly request can ask for one component in several blood types.
  const names = [...new Set((request.items ?? [])
    .map((item) => item.component?.name)
    .filter((name): name is string => Boolean(name)))]

  if (names.length === 0) return '\u2014'
  if (names.length <= 2) return names.join(', ')

  return `${names[0]}, ${names[1]} +${names.length - 2} more`
}

type BloodTyped = Partial<Pick<BloodRequest, 'blood_type' | 'blood_types' | 'items'>>

/**
 * Every blood type a request asks for, in the order the API sends them.
 *
 * Read from blood_types, which the API sends in blood-group order; the lines
 * and then the request's own type are the fallback for a request loaded
 * without it.
 */
export function bloodTypeCodes(request: BloodTyped | null | undefined): string[] {
  if (request?.blood_types?.length) return request.blood_types

  const fromLines = [...new Set((request?.items ?? [])
    .map((item) => item.blood_type?.code)
    .filter((code): code is string => Boolean(code)))]

  if (fromLines.length) return fromLines

  return request?.blood_type?.code ? [request.blood_type.code] : []
}

/** Whether a request's lines differ in blood type \u2014 a weekly request restocking several. */
export function hasMixedBloodTypes(request: BloodTyped | null | undefined): boolean {
  return bloodTypeCodes(request).length > 1
}

/** Name the blood type a request is for: "O+", or "A+, B+, O-" when its lines differ. */
export function bloodTypeSummary(request: BloodTyped | null | undefined): string {
  const codes = bloodTypeCodes(request)

  return codes.length ? codes.join(', ') : '\u2014'
}

/**
 * Name one line of a request: its component, with its blood type when the lines differ.
 *
 * "A+ Cryoprecipitate" and "AB+ Cryoprecipitate" are two lines of one weekly
 * request; on any other request the type is the request's and is shown once.
 */
export function requestLineLabel(request: BloodTyped | null | undefined, item: Pick<BloodRequestItem, 'blood_type' | 'component'>): string {
  const name = item.component?.name ?? '\u2014'
  const code = item.blood_type?.code

  return hasMixedBloodTypes(request) && code ? `${code} ${name}` : name
}

/**
 * The status as it should read, including whether a partial request is finished.
 *
 * A partially fulfilled request whose every remainder was closed keeps the
 * `partial` status — that is what was supplied — but can no longer be filled,
 * so it reads "Partially Fulfilled (Closed)". The same holds for a Patient
 * Transfusion Request.
 */
export function requestStatusLabel(request: { status: BloodRequestStatus; status_label?: string | null; is_open: boolean }): string {
  const label = request.status_label || REQUEST_STATUS_LABELS[request.status] || request.status

  return request.status === 'partial' && request.is_open === false ? `${label} (Closed)` : label
}

/**
 * Describe where a request has got to, for a progress timeline.
 *
 * Fulfilment is counted at dispatch, so the status says how much the centre
 * has provided. Receipt is recorded per unit by the hospital and read here from
 * the counts, because it no longer moves the status.
 */
export function requestStage(request: BloodRequest): string {
  if (request.status === 'rejected') return 'Rejected'
  if (request.status === 'cancelled') return 'Cancelled'
  if (request.status === 'pending') return request.is_walk_in ? 'Recorded at blood center' : 'Submitted'

  const fulfilled = request.fulfilled_quantity ?? 0
  const receivedAll = fulfilled > 0 && (request.received_count ?? 0) >= fulfilled

  if (request.status === 'fulfilled') return receivedAll ? 'Received' : 'Fulfilled — awaiting receipt'

  if (request.status === 'partial') {
    if (request.is_open === false) return receivedAll ? 'Partially fulfilled — closed, received' : 'Partially fulfilled — closed'

    return 'Partially fulfilled'
  }

  if (request.allocated_count > 0) return 'Stock reserved'

  return 'Under review'
}
