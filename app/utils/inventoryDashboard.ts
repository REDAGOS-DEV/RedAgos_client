import type { StockThresholdCell } from '~/types/stockThreshold'

/**
 * Shaping helpers for the Blood Inventory dashboard.
 *
 * Kept apart from the page so they can be tested without rendering it. Every
 * count comes from the server; these only decide how a count is shown.
 */

/**
 * The order the availability cards are laid out in: the Rh-positive types on
 * one row, the Rh-negative ones under them.
 */
const DASHBOARD_TYPE_ORDER = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-']

/** Blood types in dashboard order, unknown codes last. */
export function orderDashboardTypes<T extends { code: string }>(types: T[]): T[] {
  const rank = (code: string) => {
    const index = DASHBOARD_TYPE_ORDER.indexOf(code)
    return index === -1 ? DASHBOARD_TYPE_ORDER.length : index
  }

  return [...types].sort((a, b) => rank(a.code) - rank(b.code))
}

/**
 * Whether a blood type is rare in the population this centre serves.
 *
 * Every Rh-negative type is: in the Philippines fewer than one person in a
 * hundred is Rh-negative, so each one is hard to replace however many bags are
 * on the shelf.
 */
export function isRareBloodType(code: string): boolean {
  return code.endsWith('-')
}

/**
 * How much of a blood type's minimum stock is on the shelf, as a whole percent.
 *
 * Each monitored component counts up to its own minimum and no further, so a
 * surplus of red cells cannot hide an empty platelet shelf. Rounded down, so
 * 100 means every minimum is met. Null when the type has no minimum set:
 * there is nothing to measure it against.
 */
export function typeCoverage(cells: StockThresholdCell[], bloodTypeId: number): number | null {
  let needed = 0
  let held = 0

  for (const cell of cells) {
    if (cell.blood_type_id !== bloodTypeId || !cell.minimum_units) continue

    needed += cell.minimum_units
    held += Math.min(cell.available, cell.minimum_units)
  }

  return needed === 0 ? null : Math.floor((held / needed) * 100)
}

/**
 * The only colours a state may take: green healthy, amber warning, red
 * critical. Anything that is not one of those is neutral ink, or muted for
 * what has left the shelf.
 */
export type InventoryTone = 'success' | 'warning' | 'danger' | 'neutral' | 'muted'

export interface InventoryTag {
  label: string
  tone: InventoryTone
}

/**
 * A unit's status as the list shows it.
 *
 * An available unit within a week of its date reads as Expiring Soon: it is
 * still issuable, but it is the one to issue next.
 */
export function unitStatusTag(status: string, daysRemaining: number | null): InventoryTag {
  if (status === 'available' && daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7) {
    return { label: 'Expiring Soon', tone: 'warning' }
  }

  const tags: Record<string, InventoryTag> = {
    available: { label: 'Available', tone: 'success' },
    reserved: { label: 'Reserved', tone: 'neutral' },
    quarantined: { label: 'Quarantined', tone: 'neutral' },
    issued: { label: 'Issued', tone: 'neutral' },
    expired: { label: 'Expired', tone: 'danger' },
    discarded: { label: 'Discarded', tone: 'muted' },
  }

  return tags[status] ?? { label: status, tone: 'muted' }
}

/** Whether a unit can be handed out now, and if not, why not in a word. */
export function unitAvailability(status: string): InventoryTag {
  if (status === 'available') return { label: 'In Stock', tone: 'success' }
  if (status === 'reserved') return { label: 'Reserved', tone: 'neutral' }
  if (status === 'quarantined') return { label: 'On Hold', tone: 'neutral' }

  // Issued, expired or discarded: gone, which is not in itself a fault.
  return { label: 'Not Available', tone: 'muted' }
}

/**
 * The Remaining Days cell. A unit that has left the shelf has no days left to
 * count, so it shows none rather than a stale number.
 */
export function remainingDaysTag(status: string, daysRemaining: number | null): InventoryTag {
  if (daysRemaining === null || status === 'issued' || status === 'discarded') {
    return { label: '—', tone: 'muted' }
  }

  if (status === 'expired' || daysRemaining < 0) return { label: 'Expired', tone: 'danger' }
  if (daysRemaining === 0) return { label: 'Today', tone: 'danger' }

  const label = `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`

  if (daysRemaining <= 3) return { label, tone: 'danger' }
  if (daysRemaining <= 7) return { label, tone: 'warning' }

  return { label, tone: 'neutral' }
}

/** "3 days left", "Expires today": the Expiring Soon panel's pill. */
export function daysLeftLabel(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'Expires today'

  return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
}

/**
 * The page buttons to draw: the first and last page always, the current page
 * with one either side, and an ellipsis for each gap. Seven pages or fewer are
 * all drawn.
 */
export function pageWindow(current: number, last: number): Array<number | '…'> {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)

  const pages: Array<number | '…'> = [1]
  const start = Math.max(2, Math.min(current - 1, last - 3))
  const end = Math.min(last - 1, Math.max(current + 1, 4))

  if (start > 2) pages.push('…')
  for (let page = start; page <= end; page++) pages.push(page)
  if (end < last - 1) pages.push('…')

  pages.push(last)

  return pages
}

/** "Just now", "5 minutes ago", "2 hours ago", "3 days ago". */
export function timeAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return ''

  const then = new Date(iso).getTime()

  if (Number.isNaN(then)) return ''

  const seconds = Math.max(0, Math.round((now - then) / 1000))

  if (seconds < 60) return 'Just now'

  const steps: Array<[number, string]> = [
    [60 * 60 * 24 * 30, 'month'],
    [60 * 60 * 24 * 7, 'week'],
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hour'],
    [60, 'minute'],
  ]

  for (const [size, unit] of steps) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size)
      return `${count} ${unit}${count === 1 ? '' : 's'} ago`
    }
  }

  return 'Just now'
}

export interface ActivityKindMeta {
  label: string
  icon: string
  tone: InventoryTone
}

// Routine movements are neutral; only a unit lost to stock is marked.
const ACTIVITY_KINDS: Record<string, ActivityKindMeta> = {
  booked_in: { label: 'Booked In', icon: 'circle-plus', tone: 'neutral' },
  released: { label: 'Released to Stock', icon: 'package-check', tone: 'neutral' },
  reserved: { label: 'Reserved', icon: 'clipboard-list', tone: 'neutral' },
  issued: { label: 'Issued', icon: 'send', tone: 'neutral' },
  hold_returned: { label: 'Hold Returned', icon: 'unlock', tone: 'neutral' },
  updated: { label: 'Details Updated', icon: 'pencil', tone: 'neutral' },
  reinstated: { label: 'Reinstated', icon: 'refresh-cw', tone: 'neutral' },
  discarded: { label: 'Discarded', icon: 'trash-2', tone: 'danger' },
  expired: { label: 'Expired', icon: 'clock', tone: 'danger' },
}

/** How one activity entry is titled and marked. */
export function activityKindMeta(kind: string): ActivityKindMeta {
  return ACTIVITY_KINDS[kind] ?? { label: 'Updated', icon: 'activity', tone: 'neutral' }
}
