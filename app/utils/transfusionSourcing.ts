/**
 * Splitting a patient's need across blood centres, as the hospital portal does it.
 *
 * A Patient Transfusion Request asks one or more centres for shares of what
 * the patient needs. The API suggests a split — earliest expiry first — and
 * refuses one that asks for more than the patient needs; this module is the
 * form's side of the same rules: the split staff edit, the Required /
 * Allocated / Remaining figures beside it, what stops it being sent, and the
 * payload the API takes.
 *
 * Pure functions only, so the rules can be tested without mounting a page.
 */

import type {
  AllocationSharePayload,
  BloodRequestStatus,
  CreateBloodRequestItemPayload,
  CreateTransfusionRequestPayload,
  FacilityAllocation,
  SourcingHolding,
  SourcingPlan,
  TransfusionLine,
  TransfusionRequest,
  UrgencyLevel,
} from '~/types/bloodRequest'

/** How many units of each component each centre is asked for: component id → facility id → units. */
export type Split = Record<number, Record<number, number>>

/** Read a typed quantity as a whole, non-negative number of units. */
export function units(value: unknown): number {
  const parsed = Math.trunc(Number(value))

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/**
 * Fill a quantity from centres in the order given, as far as each one's shelf goes.
 *
 * The API lists centres earliest expiry first, so filling from the top is the
 * FEFO rule. Whatever the shelves cannot cover is left unasked — a shortfall
 * the hospital may still ask a centre holding none for.
 */
export function fefoFill(holdings: SourcingHolding[], quantity: number): Record<number, number> {
  let left = Math.max(0, quantity)
  const shares: Record<number, number> = {}

  for (const holding of holdings) {
    const share = Math.min(holding.available, left)

    if (share > 0) shares[holding.facility.id] = share
    left -= share
  }

  return shares
}

/** The split the plan suggests, before staff change anything. */
export function suggestedSplit(plan: SourcingPlan | null | undefined): Split {
  const split: Split = {}

  for (const line of plan?.lines ?? []) {
    split[line.component.id] = fefoFill(line.facilities, line.quantity)
  }

  return split
}

/** Set one centre's share of one component, returning a new split. Zero removes it. */
export function setShare(split: Split, componentId: number, facilityId: number, quantity: unknown): Split {
  const shares = { ...(split[componentId] ?? {}) }
  const value = units(quantity)

  if (value > 0) {
    shares[facilityId] = value
  } else {
    delete shares[facilityId]
  }

  return { ...split, [componentId]: shares }
}

export interface ComponentAllocationTotals {
  componentId: number
  component: string
  /** What this split is for: the patient's need, or what is still unallocated. */
  required: number
  allocated: number
  /** Required less allocated, never below nought. */
  remaining: number
  /** Asked for more than required — the API refuses this. */
  over: number
}

/** Total Required / Allocated / Remaining, per component. */
export function allocationTotals(plan: SourcingPlan | null | undefined, split: Split): ComponentAllocationTotals[] {
  return (plan?.lines ?? []).map((line) => {
    const allocated = Object.values(split[line.component.id] ?? {}).reduce((sum, value) => sum + units(value), 0)

    return {
      componentId: line.component.id,
      component: line.component.name ?? 'Component',
      required: line.quantity,
      allocated,
      remaining: Math.max(0, line.quantity - allocated),
      over: Math.max(0, allocated - line.quantity),
    }
  })
}

/**
 * What stops the split from being sent, in the words staff will read.
 *
 * Asking for less than the patient needs is allowed — the rest stays
 * unallocated for later. Asking for more is not, and neither is asking
 * nobody for anything.
 */
export function allocationProblems(plan: SourcingPlan | null | undefined, split: Split): string[] {
  const totals = allocationTotals(plan, split)
  const problems: string[] = []

  for (const total of totals) {
    if (total.over > 0) {
      problems.push(`${total.component}: ${total.allocated} unit(s) allocated but only ${total.required} needed. Remove ${total.over}.`)
    }
  }

  if (totals.every((total) => total.allocated === 0)) {
    problems.push('Ask at least one facility for at least one unit.')
  }

  return problems
}

/**
 * What staff should know before sending, without stopping them.
 *
 * A centre may be asked for more than it shows today — stock arrives — and a
 * shortfall is allowed, but both are worth saying out loud.
 */
export function allocationWarnings(plan: SourcingPlan | null | undefined, split: Split): string[] {
  const warnings: string[] = []

  for (const line of plan?.lines ?? []) {
    const shares = split[line.component.id] ?? {}

    for (const holding of line.facilities) {
      const asked = units(shares[holding.facility.id])

      if (asked > holding.available) {
        warnings.push(`${holding.facility.name} shows ${holding.available} ${line.component.name ?? ''} available but is asked for ${asked}.`.replace(/ {2}/g, ' '))
      }
    }

    for (const facility of line.other_facilities) {
      if (units(shares[facility.id]) > 0) {
        warnings.push(`${facility.name} shows no matching ${line.component.name ?? 'stock'} today.`)
      }
    }
  }

  for (const total of allocationTotals(plan, split)) {
    if (total.over === 0 && total.remaining > 0 && total.allocated > 0) {
      warnings.push(`${total.remaining} unit(s) of ${total.component} will stay unallocated; you can ask another facility later.`)
    }
  }

  return warnings
}

/**
 * The split as the API takes it: one allocation per centre, a line per component asked of it.
 *
 * Centres are listed in the order they first appear, components within each
 * in plan order, and nothing at nought is sent.
 */
export function buildAllocationShares(plan: SourcingPlan | null | undefined, split: Split): AllocationSharePayload[] {
  const byFacility = new Map<number, AllocationSharePayload>()

  for (const line of plan?.lines ?? []) {
    for (const [facilityId, quantity] of Object.entries(split[line.component.id] ?? {})) {
      const value = units(quantity)

      if (value === 0) continue

      const id = Number(facilityId)
      const share = byFacility.get(id) ?? { facility_id: id, lines: [] }

      share.lines.push({ component_id: line.component.id, quantity: value })
      byFacility.set(id, share)
    }
  }

  return [...byFacility.values()]
}

/** What the request form holds before the split: the patient and what they need. */
export interface TransfusionDraft {
  bloodTypeId: number | null
  urgency: UrgencyLevel
  patient: {
    surname: string
    firstName: string
    middleName: string
    age: number | string | null
    sex: '' | 'male' | 'female'
  }
  lines: CreateBloodRequestItemPayload[]
}

/** The payload POST /hospital/transfusion-requests takes. */
export function buildTransfusionPayload(
  draft: TransfusionDraft,
  plan: SourcingPlan | null | undefined,
  split: Split,
): CreateTransfusionRequestPayload {
  const middle = draft.patient.middleName.trim()

  return {
    internal_stock_confirmed: true,
    blood_type_id: Number(draft.bloodTypeId),
    urgency_level: draft.urgency,
    patient_surname: draft.patient.surname.trim(),
    patient_first_name: draft.patient.firstName.trim(),
    patient_middle_name: middle === '' ? null : middle,
    patient_age: Number(draft.patient.age),
    patient_sex: draft.patient.sex as 'male' | 'female',
    lines: draft.lines.map((line) => ({
      component_id: line.component_id,
      quantity: line.quantity,
      indication_code: line.indication_code,
      ...(line.indication_other ? { indication_other: line.indication_other } : {}),
    })),
    allocations: buildAllocationShares(plan, split),
  }
}

/* ------------------------------------------------------------------ *
 * Reading a Patient Transfusion Request
 * ------------------------------------------------------------------ */

/**
 * Where the patient's request has got to, in one phrase.
 *
 * The status alone says Pending or Processing; the hospital wants to know
 * "Approved 4 of 5" and whether anything is still asked of nobody.
 */
export function transfusionProgressLabel(request: Pick<TransfusionRequest, 'status' | 'is_open' | 'totals' | 'needs_allocation'>): string {
  const { required, approved, fulfilled } = request.totals

  switch (request.status as BloodRequestStatus) {
    case 'cancelled':
      return 'Cancelled'
    case 'fulfilled':
      return 'Fulfilled'
    case 'partial':
      return request.is_open ? `Partially fulfilled — ${fulfilled} of ${required} released` : 'Partially Fulfilled (Closed)'
    case 'processing':
      return `Approved ${approved} of ${required}`
    default:
      return request.needs_allocation && request.totals.awaiting === 0
        ? 'Needs a facility'
        : 'Awaiting facility response'
  }
}

/** A share a centre has not answered can be withdrawn; anything it has acted on cannot. */
export function canWithdrawAllocation(allocation: Pick<FacilityAllocation, 'status'>, requestOpen: boolean): boolean {
  return requestOpen && allocation.status === 'pending'
}

/** The rest of a component can be closed while some of it is still asked for, or asked of nobody. */
export function canCloseRequirementLine(line: Pick<TransfusionLine, 'closed_at' | 'awaiting' | 'unallocated'>, requestOpen: boolean): boolean {
  return requestOpen && !line.closed_at && line.awaiting + line.unallocated > 0
}

/** Cancelling is for a request nothing was approved for; after that, remaining quantities are closed. */
export function canCancelTransfusion(request: Pick<TransfusionRequest, 'is_open' | 'totals'>): boolean {
  return request.is_open && request.totals.approved === 0 && request.totals.fulfilled === 0
}

/** Allocations that have released units the hospital has not yet confirmed. */
export function allocationsAwaitingReceipt(allocations: FacilityAllocation[] = []): FacilityAllocation[] {
  return allocations.filter((allocation) => (allocation.fulfilled_quantity ?? 0) > (allocation.received_count ?? 0))
}
