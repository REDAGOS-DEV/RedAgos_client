import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * Walk-ins and booked donors reach the Donation counter already identified
 * (project owner, 2026-10-24). The counter's own walk-in search (2026-10-17)
 * and QR scan are gone: a walk-in starts from Donor Management (eligible
 * donors only), a booked donor's QR is scanned on Donations, and a visit under
 * way is carried on from Donations.
 *
 * What is locked in: each way in carries the donor, and the counter brings
 * them up through the arrival endpoint, which answers as the scan does.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

// Line endings normalised: a Windows checkout (core.autocrlf) writes CRLF.
function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n')
}

describe('ways into the Donation counter', () => {
  const donations = source('app/pages/blood-center/donations.vue')
  const scan = source('app/components/BloodCenter/DonorQrScanDialog.vue')
  const transaction = source('app/composables/useDonationTransaction.ts')
  const service = source('app/api/bloodcenter/BloodCenterService.ts')

  it('scans a booked donor on Donations, in a popup from the upper right', () => {
    expect(donations).toContain('<button v-if="canStartVisit" type="button" class="btn-primary" @click="scanning = true">')
    expect(donations).toContain('<DonorQrScanDialog v-if="scanning" @close="scanning = false" />')
    // The toolbar's own Donation Counter button is gone.
    expect(donations).not.toMatch(/to="\/blood-center\/donation" class="btn-primary"/)
  })

  it('verifies the QR in the popup and hands it to the counter in memory, never in the address', () => {
    expect(scan).toContain('const result = await bloodCenterService.verifyDonorQr(token)')
    expect(scan).toContain('handoff.value = { data: result?.data ?? null }')
    expect(scan).toContain("await navigateTo('/blood-center/donation')")
    expect(scan).not.toContain('query')
  })

  it('carries an open visit on from Donations with its donor', () => {
    expect(donations).toContain(':to="continueLink(row.donor.uuid)"')
    expect(donations).toContain(':to="continueLink(detail.donor.uuid)"')
    expect(donations).toContain("const canStartVisit = computed(() => canUseCounter.value && can('appointments.verify'))")
  })

  it('brings a donor up through the arrival endpoint, as the scan answers', () => {
    expect(service).toContain('return this.request(`${this.resource}/collection/arrival/${donorUuid}`, \'GET\')')
    expect(transaction).toContain("adoptArrival(result.data, 'walk_in')")
    expect(transaction).toContain("adoptArrival(result.data, 'qr')")
  })
})
