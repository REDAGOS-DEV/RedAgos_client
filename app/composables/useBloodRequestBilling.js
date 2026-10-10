/*
 * What one of the hospital's requests was billed — read only.
 *
 * GET /api/hospital/blood-requests/:id/billing
 *   -> { billing, statements: [...], receipts: [...] }
 *
 * Kini kay basahon ra. Walay "Pay Now" dinhi: ang pasyente o ang watcher ang
 * mobayad sa billing counter sa blood centre (cash o GCash), ug ang weekly nga
 * order kay statement ra — gi-settle sa gawas sa RedAgos (desisyon sa project
 * owner, 2026-10-10). Gitangtang ang mock ug ang payBilling, kay ang server na
 * ang tinuod nga tinubdan ug walay amount nga gikan sa browser.
 *
 * A request with no statement yet (nothing reserved) answers 404
 * `billing_missing`; that is a state, not an error, and reads as "no
 * statement yet".
 */

import { hospitalService } from '~/api/hospital/HospitalService'
import { saveBlob } from '~/utils/billing'

export const useBloodRequestBilling = (requestId) => {
  const billing = ref(null)
  const statements = ref([])
  const receipts = ref([])

  const isLoadingBilling = ref(true)
  const billingError = ref(null)
  const downloadingId = ref(null)

  async function fetchBilling() {
    isLoadingBilling.value = true
    billingError.value = null

    try {
      const data = await hospitalService.requestBilling(requestId)
      billing.value = data?.billing ?? null
      statements.value = data?.statements ?? []
      receipts.value = data?.receipts ?? []
    } catch (err) {
      billing.value = null
      statements.value = []
      receipts.value = []

      // No statement yet is a normal state for a request nothing was reserved for.
      if (err?.data?.code !== 'billing_missing') {
        billingError.value = err?.message || 'Could not load the billing for this request.'
      }
    } finally {
      isLoadingBilling.value = false
    }
  }

  async function downloadStatement(revision) {
    downloadingId.value = `soa-${revision.id}`

    try {
      saveBlob(await hospitalService.downloadStatement(revision.id), `${revision.document_number}.pdf`)
      return true
    } catch (err) {
      billingError.value = err?.message || 'The statement could not be downloaded.'
      return false
    } finally {
      downloadingId.value = null
    }
  }

  async function downloadReceipt(receipt) {
    downloadingId.value = `ar-${receipt.id}`

    try {
      saveBlob(await hospitalService.downloadReceipt(receipt.id), `${receipt.receipt_number}.pdf`)
      return true
    } catch (err) {
      billingError.value = err?.message || 'The receipt could not be downloaded.'
      return false
    } finally {
      downloadingId.value = null
    }
  }

  return {
    billing,
    statements,
    receipts,
    isLoadingBilling,
    billingError,
    downloadingId,
    fetchBilling,
    downloadStatement,
    downloadReceipt,
  }
}
