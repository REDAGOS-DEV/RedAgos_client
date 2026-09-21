/*
 * Expected Laravel endpoints (adjust paths to match your actual routes):
 *   GET  /api/hospital/bloodrequests/:id/billing
 *       -> { billing: {...}, line_items: [...], payments: [...] }
 *   POST /api/hospital/bloodrequests/:id/billing/pay
 *       -> { billing: {...}, payment: {...} }
 *
 * Field names mirror the proposal's `billing`, `payment`, and
 * `blood_component` tables so the mock data below can be swapped for real
 * API responses without reshaping the template.
 *
 * `billing`: { billing_id, request_id, billed_by, billing_date, total_amount, status }
 *   status: 'UNPAID' | 'PARTIAL' | 'PAID'
 * `lineItems`: [{ component_id, component_name, quantity, price }]
 * `payments`: [{ payment_id, billing_id, amount_paid, payment_method, paid_at }]
 *   payment_method: 'CASH' | 'GCASH'
 *
 * Toggle: this composable follows the same USE_MOCK_DATA convention as
 * app/pages/blood-center/reports.vue. Walay `/hospital/bloodrequests/:id/billing`
 * route pa ang Laravel side, so mag-mock lang ni hangtod naa na.
 */

import { hospitalService } from '~/api/hospital/HospitalService'

function mockDelay(ms = 400) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildMockBilling(requestId) {
  return {
    billing_id: `BIL-2026-${String(requestId).padStart(4, '0')}`,
    request_id: requestId,
    billed_by: 'Maria Lourdes Guerra, RMT',
    billing_date: '2026-04-14T09:20:00',
    total_amount: 4500,
    status: 'UNPAID',
  }
}

const MOCK_LINE_ITEMS = [
  { component_id: 1, component_name: 'Packed Red Blood Cells', quantity: 2, price: 1800 },
  { component_id: 2, component_name: 'Processing & Cross-matching Fee', quantity: 1, price: 900 },
]

export const useBloodRequestBilling = (requestId) => {
  const USE_MOCK_DATA = useRuntimeConfig().public.useMocks

  const billing = ref(null)
  const lineItems = ref([])
  const payments = ref([])

  const isLoadingBilling = ref(true)
  const billingError = ref(null)
  const isPaying = ref(false)

  async function fetchBilling() {
    isLoadingBilling.value = true
    billingError.value = null
    try {
      if (USE_MOCK_DATA) {
        await mockDelay()
        billing.value = buildMockBilling(requestId)
        lineItems.value = MOCK_LINE_ITEMS
        payments.value = []
      } else {
        const data = await hospitalService.requestBilling(requestId)
        billing.value = data?.billing ?? null
        lineItems.value = data?.line_items ?? []
        payments.value = data?.payments ?? []
      }
    } catch (err) {
      billingError.value = err
      billing.value = null
      lineItems.value = []
      payments.value = []
    } finally {
      isLoadingBilling.value = false
    }
  }

  async function payBilling({ amount, method }) {
    if (!billing.value) return
    isPaying.value = true
    try {
      if (USE_MOCK_DATA) {
        await mockDelay(600)
        payments.value.push({
          payment_id: `PMT-${Date.now()}`,
          billing_id: billing.value.billing_id,
          amount_paid: amount,
          payment_method: method,
          paid_at: new Date().toISOString(),
        })
        const paidTotal = payments.value.reduce((sum, p) => sum + p.amount_paid, 0)
        billing.value.status = paidTotal >= billing.value.total_amount ? 'PAID' : 'PARTIAL'
      } else {
        const data = await hospitalService.payRequestBilling(requestId, { amount, method })
        billing.value = data?.billing ?? billing.value
        if (data?.payment) payments.value.push(data.payment)
      }
      return true
    } catch (err) {
      billingError.value = err
      return false
    } finally {
      isPaying.value = false
    }
  }

  return {
    billing,
    lineItems,
    payments,
    isLoadingBilling,
    billingError,
    isPaying,
    fetchBilling,
    payBilling,
  }
}
