import { donorService } from '~/api/donor/DonorService'

// Shared across the header and the profile page via useState, so submitting
// a Valid ID on /donor/profile updates the header badge immediately without
// needing a page reload or a route-change refetch.
export function useIdentityStatus() {
  const identityStatus = useState('identityStatus', () => null)

  async function fetchIdentityStatus() {
    try {
      const data = await donorService.profile()
      identityStatus.value = data?.identity?.status || 'unsubmitted'
    } catch (err) {
      console.error('Failed to load identity status:', err)
      // Keep whatever we already had rather than flashing back to "needs
      // action" on a transient network error.
      identityStatus.value = identityStatus.value || 'unsubmitted'
    }
  }

  function setIdentityStatus(status) {
    identityStatus.value = status || 'unsubmitted'
  }

  return { identityStatus, fetchIdentityStatus, setIdentityStatus }
}