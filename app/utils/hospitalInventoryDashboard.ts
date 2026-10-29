import type { HospitalActivityKind, HospitalUnitStatus } from '~/types/hospitalInventory'
import { remainingDaysTag } from '~/utils/inventoryDashboard'
import type { ActivityKindMeta, InventoryTag } from '~/utils/inventoryDashboard'

/**
 * Shaping helpers for the hospital's Blood Bank Inventory dashboard.
 *
 * The hospital's counterpart of utils/inventoryDashboard.ts, under the same
 * rule: green, amber and red mark state alone. A tag stage is a step in the
 * work, not a fault, so it is neutral; the label tells Tag Assigned from Tag
 * Crossmatched. Every count comes from the server; these only decide how a
 * bag is shown.
 */

const STATUS_TAGS: Record<HospitalUnitStatus, InventoryTag> = {
  received: { label: 'Awaiting Stock-in', tone: 'neutral' },
  available: { label: 'Available', tone: 'success' },
  tag_assigned: { label: 'Tag Assigned', tone: 'neutral' },
  tag_crossmatched: { label: 'Tag Crossmatched', tone: 'neutral' },
  // Out of storage with no patient: someone has to confirm it back or discard it.
  pending_return: { label: 'Pending Return', tone: 'warning' },
  transfused: { label: 'Transfused', tone: 'muted' },
  expired: { label: 'Expired', tone: 'danger' },
  discarded: { label: 'Discarded', tone: 'muted' },
}

/**
 * A bag's status as the list shows it.
 *
 * An available bag within a week of its date reads as Expiring Soon, as at
 * the centre: still free to tag, and the one to tag next.
 */
export function hospitalUnitStatusTag(status: HospitalUnitStatus, daysRemaining: number | null): InventoryTag {
  if (status === 'available' && daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7) {
    return { label: 'Expiring Soon', tone: 'warning' }
  }

  return STATUS_TAGS[status] ?? { label: status, tone: 'muted' }
}

/**
 * The Remaining Days cell. A bag that was transfused or discarded has left
 * the blood bank, so it shows no days rather than a stale number.
 */
export function hospitalRemainingDaysTag(status: HospitalUnitStatus, daysRemaining: number | null): InventoryTag {
  if (status === 'transfused' || status === 'discarded') return { label: '—', tone: 'muted' }

  return remainingDaysTag(status, daysRemaining)
}

// Routine steps are neutral; only a bag lost to the shelf is marked.
const ACTIVITY_KINDS: Record<HospitalActivityKind, ActivityKindMeta> = {
  received: { label: 'Arrived', icon: 'truck', tone: 'neutral' },
  stocked: { label: 'Stocked In', icon: 'package-check', tone: 'neutral' },
  tagged: { label: 'Tagged to Patient', icon: 'user-check', tone: 'neutral' },
  crossmatched: { label: 'Crossmatched', icon: 'flask-conical', tone: 'neutral' },
  transfused: { label: 'Transfused', icon: 'blood-drop', tone: 'neutral' },
  untagged: { label: 'Tag Released', icon: 'user-x', tone: 'neutral' },
  returned: { label: 'Back in Storage', icon: 'refresh-cw', tone: 'neutral' },
  discarded: { label: 'Discarded', icon: 'trash-2', tone: 'danger' },
  expired: { label: 'Expired', icon: 'clock', tone: 'danger' },
}

/** How one activity entry is titled and marked. */
export function hospitalActivityKindMeta(kind: string): ActivityKindMeta {
  return ACTIVITY_KINDS[kind as HospitalActivityKind] ?? { label: 'Updated', icon: 'activity', tone: 'neutral' }
}
