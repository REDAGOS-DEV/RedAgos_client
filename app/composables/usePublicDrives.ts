import { bookingCatalogService } from '~/api/booking-catalog/BookingCatalogService'
import { fromPublicDrive, upcomingDrives, type PublicDriveRow, type UpcomingDrive } from '~/utils/donationDrives'

/** The one request in flight, so the hero and the Donation Drives section share it. */
let inFlight: Promise<void> | null = null

/**
 * The landing page's upcoming drives, as blood centers created and published
 * them (GET /public/drives). Shared by the hero's "Next donation drive" card
 * and the Donation Drives section, fetched once per visit to the page.
 *
 * Client only: `loaded` stays false until the answer is in, so the section
 * never flashes "No drives scheduled yet" before it knows. A failed request
 * shows no drives rather than an error, as on a page with none scheduled.
 */
export function usePublicDrives() {
  const drives = useState<UpcomingDrive[]>('landing-public-drives', () => [])
  const loaded = useState<boolean>('landing-public-drives-loaded', () => false)

  onMounted(() => {
    if (inFlight) return
    inFlight = bookingCatalogService.publicDrives()
      .then((rows: unknown) => {
        drives.value = upcomingDrives((Array.isArray(rows) ? rows as PublicDriveRow[] : []).map(fromPublicDrive))
      })
      .catch(() => {
        drives.value = []
      })
      .finally(() => {
        loaded.value = true
        inFlight = null
      })
  })

  return { drives, loaded }
}
