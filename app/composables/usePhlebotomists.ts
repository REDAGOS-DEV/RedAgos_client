import { bloodCenterService } from '~/api/bloodcenter/BloodCenterService'

export interface StaffChoice {
  id: number | string
  name: string
  is_you: boolean
}

/**
 * The "Phlebotomist" choices at the counter and on a drive's paper records
 * (project owner, 2026-11-11), read from the client only.
 *
 * A dedicated list (GET /collection/phlebotomists) is used once the server
 * has one, with nothing to change here. Until then the names come from what
 * staff already read: the phlebotomists on the centre's latest donation
 * records. Fetched once per session and shared; a failure leaves the list
 * empty, so the picker still offers Other.
 */
export function usePhlebotomists() {
  const list = useState<StaffChoice[]>('bc-phlebotomists', () => [])
  const loaded = useState<boolean>('bc-phlebotomists-loaded', () => false)
  const { user } = useUser()

  const myName = () => {
    const u = user.value as Record<string, any> | null
    return (u?.full_name || [u?.first_name, u?.last_name].filter(Boolean).join(' ') || '').trim()
  }

  async function fromServerList(): Promise<StaffChoice[] | null> {
    try {
      const res = await bloodCenterService.collectionPhlebotomists()
      return Array.isArray(res?.data) ? res.data : null
    } catch {
      return null
    }
  }

  async function fromDonationRecords(): Promise<StaffChoice[]> {
    try {
      const res = await bloodCenterService.donationRecords({ per_page: 100 })
      const me = myName()
      const names = new Set<string>()
      for (const row of res?.data ?? []) {
        const name = String(row?.collection?.collected_by ?? '').trim()
        if (name) names.add(name)
      }
      return [...names]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ id: name, name, is_you: name === me }))
    } catch {
      return []
    }
  }

  async function load(force = false) {
    if (loaded.value && !force) return
    list.value = (await fromServerList()) ?? (await fromDonationRecords())
    loaded.value = true
  }

  return { phlebotomists: list, loadPhlebotomists: load }
}
