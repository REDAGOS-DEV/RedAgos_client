import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'
import { useUser } from '~/composables/useUser'

/**
 * What waits for the signed-in blood-centre staff member: the counts behind
 * the sidebar's badges and the dashboards' "Needs you" strip, so the two can
 * never disagree.
 *
 * Each count is loaded on its own, and only for a user who may open the page
 * it points at (the same abilities the pages require), so one refusal or
 * failure never hides the others. They match the notices the server sends
 * (app/Support/StaffNotificationTopics.php): a task here is the same task the
 * bell announced.
 */

export interface BloodCenterTask {
  key: string
  count: number
  label: string
  detail: string
  to: string
  /** The verb on the button when a task stands alone. */
  action: string
  icon: string
  tone: 'urgent' | 'warning' | 'info'
}

type Counts = Record<string, number>

interface TaskDef {
  key: string
  /** Any one of these abilities shows it. */
  requires: string | readonly string[]
  /** Plural label, then singular. */
  label: [string, string]
  detail: string
  to: string
  action: string
  icon: string
  tone: BloodCenterTask['tone']
}

/** Most pressing first: the dashboards show them in this order. */
const TASKS: TaskDef[] = [
  { key: 'urgent', requires: 'requests.release', label: ['emergency requests open', 'emergency request open'], detail: 'Release blood for these first.', to: '/blood-center/fulfillment', action: 'Release', icon: 'circle-alert', tone: 'urgent' },
  { key: 'verification', requires: 'lab.verify_serology', label: ['results to verify', 'result to verify'], detail: 'Reactive results and corrections waiting for you.', to: '/blood-center/serology-results', action: 'Verify', icon: 'clipboard-list', tone: 'urgent' },
  { key: 'pending', requires: 'requests.view', label: ['hospital requests waiting', 'hospital request waiting'], detail: 'Requests not yet decided.', to: '/blood-center/bloodrequests', action: 'Review', icon: 'clipboard-check', tone: 'warning' },
  { key: 'invoices', requires: 'billing.record_payment', label: ['invoices still to be paid', 'invoice still to be paid'], detail: 'Patient invoices with a balance.', to: '/blood-center/billing', action: 'View invoices', icon: 'file-text', tone: 'warning' },
  { key: 'corrections', requires: 'corrections.approve', label: ['corrections to approve', 'correction to approve'], detail: 'Filed in your department.', to: '/blood-center/corrections', action: 'Review', icon: 'pencil', tone: 'warning' },
  { key: 'referrals', requires: 'lab.referrals', label: ['referrals not acted on', 'referral not acted on'], detail: 'Donors still to contact for counselling.', to: '/blood-center/counselling-referrals', action: 'Contact', icon: 'life-buoy', tone: 'warning' },
  { key: 'handover', requires: 'lab.update_status', label: ['units to hand over', 'unit to hand over'], detail: 'Processed and waiting for Issuance.', to: '/blood-center/processed?status=awaiting_handover', action: 'Hand over', icon: 'check-check', tone: 'info' },
  { key: 'lowStock', requires: 'inventory.view', label: ['stocks below minimum', 'stock below minimum'], detail: 'Blood types or components under their minimum.', to: '/blood-center/stock-thresholds', action: 'View stock', icon: 'triangle-alert', tone: 'warning' },
  { key: 'expiring', requires: 'inventory.view', label: ['units expire within 3 days', 'unit expires within 3 days'], detail: 'Issue these first.', to: '/blood-center/inventory', action: 'View units', icon: 'clock', tone: 'info' },
  // The Admin's: people and setup (AdminOverviewService on the server).
  { key: 'coverageGaps', requires: 'staff.manage', label: ['key roles have no one', 'key role has no one'], detail: 'Assign someone so the work does not stop.', to: '/blood-center/staff', action: 'Assign', icon: 'user-x', tone: 'urgent' },
  { key: 'unassigned', requires: 'staff.manage', label: ['staff without a role', 'staff member without a role'], detail: 'They cannot do anything until assigned.', to: '/blood-center/staff', action: 'Assign roles', icon: 'users', tone: 'warning' },
  { key: 'pendingActivation', requires: 'staff.manage', label: ['accounts not yet activated', 'account not yet activated'], detail: 'Added, but not signed in yet.', to: '/blood-center/staff', action: 'View staff', icon: 'clock', tone: 'info' },
  { key: 'setupMissing', requires: 'staff.manage', label: ['centre setup items missing', 'centre setup item missing'], detail: 'The logo or left report logo for documents.', to: '/blood-center/settings?tab=center', action: 'Upload', icon: 'settings', tone: 'info' },
  { key: 'drives', requires: 'drives.manage', label: ['drives today or tomorrow', 'drive today or tomorrow'], detail: 'Check the staff and supplies.', to: '/blood-center/drives', action: 'Open drives', icon: 'route', tone: 'info' },
]

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * `full` reads every count. `background` (the sidebar's refresh as you move
 * between pages or come back to the tab) leaves out the two read from
 * throttled lists, results to verify and units to hand over, and keeps
 * their last value: a throttled route is never read on a schedule.
 */
type LoadMode = 'full' | 'background'

/** The task counts that come from throttled routes. */
const THROTTLED_KEYS = ['verification', 'handover'] as const

interface Flight {
  token: string | null
  mode: LoadMode
  again: LoadMode | null
  done: Promise<void>
}

/** The load running now, shared by every caller. Outside the composable so there is one. */
let flight: Flight | null = null

/** The signed-in session, so a load started for one never lands in another's counts. */
const sessionToken = (): string | null => (import.meta.client ? localStorage.getItem('_token') : null)

const wider = (a: LoadMode | null, b: LoadMode): LoadMode => (a === 'full' || b === 'full' ? 'full' : 'background')

export interface LoadTaskOptions {
  /** The sidebar's own refresh: skips the throttled counts. */
  background?: boolean
  /** The caller has just changed something a running load may have read before it. */
  afterChange?: boolean
}

export function useBloodCenterTasks() {
  const counts = useState<Counts>('blood-center-task-counts', () => ({}))
  const loaded = useState<boolean>('blood-center-task-loaded', () => false)
  // The Admin's whole summary, kept for the dashboard's Admin section.
  const adminOverview = useState<any>('blood-center-admin-overview', () => null)
  const { can } = useUser()

  /**
   * Read the counts the signed-in person may see.
   *
   * One load at a time. A caller that arrives while one runs joins it, so the
   * sidebar and a dashboard's strip mounting together ask the server once.
   * A caller that has just changed something (`afterChange`), or that wants
   * more than a running background load reads, queues one more load after it
   * instead of taking the older answer.
   */
  function load(options: LoadTaskOptions = {}): Promise<void> {
    const mode: LoadMode = options.background ? 'background' : 'full'
    const token = sessionToken()

    if (flight && flight.token === token) {
      const covered = !options.afterChange && (flight.mode === 'full' || mode === 'background')
      if (!covered) flight.again = wider(flight.again, mode)

      return flight.done
    }

    const current: Flight = { token, mode, again: null, done: Promise.resolve() }
    flight = current

    current.done = (async () => {
      try {
        let next: LoadMode | null = mode

        while (next) {
          current.mode = next
          current.again = null
          await loadOnce(next, token)
          next = current.again
        }
      } finally {
        if (flight === current) flight = null
      }
    })()

    return current.done
  }

  async function loadOnce(mode: LoadMode, token: string | null): Promise<void> {
    const next: Counts = {}
    const jobs: Promise<unknown>[] = []
    let overview: any = adminOverview.value

    if (can('requests.view')) {
      jobs.push(bloodCenterService.incomingRequestsSummary().then((summary) => {
        next.pending = summary?.totals?.pending ?? 0
        next.urgent = summary?.open_emergencies ?? 0
      }))
    }
    // The sidebar's Invoices badge: invoices still to be paid.
    if (can('billing.record_payment')) {
      jobs.push(bloodCenterService.billingSummary().then((summary) => {
        next.invoices = summary?.outstanding?.count ?? 0
      }))
    }
    if (can('corrections.approve')) {
      jobs.push(bloodCenterService.corrections({ scope: 'review', status: 'pending', per_page: 1 }).then((review) => {
        next.corrections = review?.total ?? 0
      }))
    }
    if (can('lab.verify_serology') && mode === 'full') {
      jobs.push(Promise.all([
        bloodCenterService.serologyResults({ outcome: 'awaiting_verification', per_page: 1 }),
        bloodCenterService.serologyResults({ outcome: 'correction_pending', per_page: 1 }),
      ]).then(([waiting, corrections]) => {
        next.verification = (waiting?.total ?? 0) + (corrections?.total ?? 0)
      }))
    }
    // The summary route, not the list, which is audited on every read.
    if (can('lab.referrals')) {
      jobs.push(bloodCenterService.counsellingReferralsSummary().then((summary) => {
        next.referrals = summary?.pending_count ?? 0
      }))
    }
    // Counted for the one role that hands units over.
    if (can('lab.update_status') && can('lab.record_components') && mode === 'full') {
      jobs.push(bloodCenterService.processedDonations({ status: 'awaiting_handover', per_page: 1 }).then((waiting) => {
        next.handover = waiting?.total ?? 0
      }))
    }
    if (can('inventory.view')) {
      jobs.push(bloodCenterService.stockThresholds().then((status) => {
        next.lowStock = status?.totals?.low ?? 0
      }))
      // The near-expiry figures alone, not the whole inventory summary.
      jobs.push(bloodCenterService.inventoryNearExpiry().then((result) => {
        next.expiring = Number(result?.near_expiry?.within_3_days ?? 0)
      }))
    }
    if (can('staff.manage')) {
      jobs.push(bloodCenterService.adminOverview().then((data) => {
        overview = data ?? null
        next.coverageGaps = data?.needs?.coverage_gaps ?? 0
        next.unassigned = data?.needs?.unassigned ?? 0
        next.pendingActivation = data?.needs?.pending_activation ?? 0
        next.setupMissing = data?.needs?.setup_missing ?? 0
      }))
    }
    if (can('drives.manage')) {
      jobs.push(bloodCenterService.drives().then((data) => {
        const list = Array.isArray(data) ? data : (data?.drives ?? [])
        const today = localDay(new Date())
        const tomorrow = localDay(new Date(Date.now() + 86_400_000))
        next.drives = list.filter((d: any) => [today, tomorrow].includes(String(d.event_date ?? '').slice(0, 10))).length
      }))
    }

    for (const result of await Promise.allSettled(jobs)) {
      if (result.status === 'rejected') console.error(result.reason)
    }

    // Signed out, or someone else signed in, while this was out.
    if (sessionToken() !== token) return

    if (mode === 'background') {
      for (const key of THROTTLED_KEYS) {
        if (key in counts.value) next[key] = counts.value[key]!
      }
    }

    adminOverview.value = overview
    counts.value = next
    loaded.value = true
  }

  /** The tasks with something waiting, most pressing first. */
  const tasks = computed<BloodCenterTask[]>(() => TASKS
    .filter(def => can(def.requires) && (counts.value[def.key] ?? 0) > 0)
    .map((def) => {
      const count = counts.value[def.key]!
      return {
        key: def.key,
        count,
        label: count === 1 ? def.label[1] : def.label[0],
        detail: def.detail,
        to: def.to,
        action: def.action,
        icon: def.icon,
        tone: def.tone,
      }
    }))

  return { counts, loaded, tasks, load, adminOverview }
}
