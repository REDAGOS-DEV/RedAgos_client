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
  icon: string
  tone: BloodCenterTask['tone']
}

/** Most pressing first: the dashboards show them in this order. */
const TASKS: TaskDef[] = [
  { key: 'urgent', requires: 'requests.release', label: ['emergency requests open', 'emergency request open'], detail: 'Release blood for these first.', to: '/blood-center/fulfillment', icon: 'circle-alert', tone: 'urgent' },
  { key: 'verification', requires: 'lab.verify_serology', label: ['results to verify', 'result to verify'], detail: 'Reactive results and corrections waiting for you.', to: '/blood-center/serology-results', icon: 'clipboard-list', tone: 'urgent' },
  { key: 'pending', requires: 'requests.view', label: ['hospital requests waiting', 'hospital request waiting'], detail: 'Requests not yet decided.', to: '/blood-center/bloodrequests', icon: 'clipboard-check', tone: 'warning' },
  { key: 'corrections', requires: 'corrections.approve', label: ['corrections to approve', 'correction to approve'], detail: 'Filed in your department.', to: '/blood-center/corrections', icon: 'pencil', tone: 'warning' },
  { key: 'referrals', requires: 'lab.referrals', label: ['referrals not acted on', 'referral not acted on'], detail: 'Donors still to contact for counselling.', to: '/blood-center/counselling-referrals', icon: 'life-buoy', tone: 'warning' },
  { key: 'handover', requires: 'lab.update_status', label: ['units to hand over', 'unit to hand over'], detail: 'Processed and waiting for Issuance.', to: '/blood-center/processed?status=awaiting_handover', icon: 'check-check', tone: 'info' },
  { key: 'lowStock', requires: 'inventory.view', label: ['stocks below minimum', 'stock below minimum'], detail: 'Blood types or components under their minimum.', to: '/blood-center/stock-thresholds', icon: 'triangle-alert', tone: 'warning' },
  { key: 'expiring', requires: 'inventory.view', label: ['units expire within 3 days', 'unit expires within 3 days'], detail: 'Issue these first.', to: '/blood-center/inventory', icon: 'clock', tone: 'info' },
  { key: 'drives', requires: 'drives.manage', label: ['drives today or tomorrow', 'drive today or tomorrow'], detail: 'Check the staff and supplies.', to: '/blood-center/drives', icon: 'route', tone: 'info' },
]

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function useBloodCenterTasks() {
  const counts = useState<Counts>('blood-center-task-counts', () => ({}))
  const loaded = useState<boolean>('blood-center-task-loaded', () => false)
  const { can } = useUser()

  async function load(): Promise<void> {
    const next: Counts = {}
    const jobs: Promise<unknown>[] = []

    if (can('requests.view')) {
      jobs.push(bloodCenterService.incomingRequestsSummary().then((summary) => {
        next.pending = summary?.totals?.pending ?? 0
        next.urgent = summary?.open_emergencies ?? 0
      }))
    }
    if (can('corrections.approve')) {
      jobs.push(bloodCenterService.corrections({ scope: 'review', status: 'pending', per_page: 1 }).then((review) => {
        next.corrections = review?.total ?? 0
      }))
    }
    if (can('lab.verify_serology')) {
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
    if (can('lab.update_status') && can('lab.record_components')) {
      jobs.push(bloodCenterService.processedDonations({ status: 'awaiting_handover', per_page: 1 }).then((waiting) => {
        next.handover = waiting?.total ?? 0
      }))
    }
    if (can('inventory.view')) {
      jobs.push(bloodCenterService.stockThresholds().then((status) => {
        next.lowStock = status?.totals?.low ?? 0
      }))
      jobs.push(bloodCenterService.inventorySummary().then((summary) => {
        next.expiring = Number(summary?.near_expiry?.within_3_days ?? 0)
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
        icon: def.icon,
        tone: def.tone,
      }
    }))

  return { counts, loaded, tasks, load }
}
