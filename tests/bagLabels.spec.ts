import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { baseLabelsFrom, finalLabelsFrom, labelDate, splitBloodType } from '~/utils/bagLabels'
import { phlebotomyProblems } from '~/utils/phlebotomy'

/**
 * Two-phase bag labelling and the donation barcode sticker.
 *
 * Locked in: a Phase 1 (base) label never carries a blood type or a clearance;
 * the final label prints only what the server returned; a bare date is never
 * shifted a day; the barcode refuses what a bag number cannot hold; and both
 * labels are Processing's (final labels since 2026-10-22, project owner):
 * Stock Intake and Blood Inventory print none.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

const runtimeConfig = { public: { apiBaseURL: 'http://api.test/api' } }
vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

vi.stubGlobal('localStorage', {
  store: new Map<string, string>(),
  getItem(k: string) { return this.store.get(k) ?? null },
  setItem(k: string, v: string) { this.store.set(k, v) },
  removeItem(k: string) { this.store.delete(k) },
})

const { bloodCenterService } = await import('~/api/bloodcenter/BloodCenterService')

beforeEach(() => {
  fetchMock.mockReset()
})

describe('label fields', () => {
  it('writes a date the way a label prints it, without moving the day', () => {
    expect(labelDate('2026-10-12')).toBe('12 Oct 2026')
    expect(labelDate('2026-01-01T00:30:00+08:00')).toBe('1 Jan 2026')
    expect(labelDate(null)).toBe('')
  })

  it('prints the ABO group large and the Rh factor spelled out', () => {
    expect(splitBloodType('O+')).toEqual({ abo: 'O', rh: 'Rh POSITIVE' })
    expect(splitBloodType('AB-')).toEqual({ abo: 'AB', rh: 'Rh NEGATIVE' })
  })
})

describe('Phase 1 — the base label Processing prints', () => {
  const donation = {
    donation_barcode: '1234567',
    components: [
      { bag_number: '1234567-PRBC', component: 'Packed RBC', volume_ml: 250 },
      { bag_number: '1234567-FFP', component: 'Fresh Frozen Plasma', volume_ml: 220 },
      // Declared before stickers: no number, so no label.
      { bag_number: null, component: 'Packed RBC', volume_ml: null },
    ],
  }

  it('makes one label per numbered bag', () => {
    expect(baseLabelsFrom(donation)).toEqual([
      { bag_number: '1234567-PRBC', component: 'Packed RBC', volume_ml: 250, donation_barcode: '1234567' },
      { bag_number: '1234567-FFP', component: 'Fresh Frozen Plasma', volume_ml: 220, donation_barcode: '1234567' },
    ])
  })

  it('never carries a blood type or a clearance', () => {
    for (const label of baseLabelsFrom(donation)) {
      expect(label).not.toHaveProperty('abo')
      expect(label).not.toHaveProperty('clearances')
    }

    const sheet = source('app/components/BloodCenter/BagLabelSheet.vue')
    const base = sheet.split("v-if=\"sheet.variant === 'base'\"")[1]!.split('<template v-else>')[0]!

    expect(base).toContain('QUARANTINE — NOT FOR ISSUE')
    expect(base).not.toContain('label.abo')
    expect(base).not.toContain('label.rh')
    expect(base).not.toContain('label.clearances')
    expect(base).not.toContain('label.expiry')
  })
})

describe('Phase 2 — the final label Processing prints before the hand-over', () => {
  const payload = {
    donation_barcode: '1234567',
    collected_on: '2026-09-28',
    facility: 'Sub-National Blood Center - Mindanao',
    clearances: [
      { label: 'TTI cleared', code: 'TTI-000012', issued_at: '2026-09-28T09:00:00+08:00', issued_by: 'Ben Cruz' },
      { label: 'ABO/Rh cleared', code: 'IH-000013', issued_at: '2026-09-28T10:00:00+08:00', issued_by: 'Ben Cruz' },
    ],
    units: [
      { unit_id: '1234567-PRBC', blood_type: 'O+', component: 'Packed RBC', volume_ml: 250, expiry_date: '2026-11-09', labelled_at: '2026-09-29T08:00:00+08:00', labelled_by: 'Lea Navarro' },
      { unit_id: '1234567-FFP', blood_type: 'O+', component: 'Fresh Frozen Plasma', volume_ml: 220, expiry_date: '2027-09-28', labelled_at: '2026-09-29T08:00:00+08:00', labelled_by: 'Lea Navarro' },
    ],
  }

  it('carries the verified type, expiry, clearance codes and who labelled it', () => {
    const [prbc] = finalLabelsFrom(payload)

    expect(prbc).toMatchObject({
      unit_id: '1234567-PRBC',
      abo: 'O',
      rh: 'Rh POSITIVE',
      expiry: '9 Nov 2026',
      collected: '28 Sep 2026',
      labelled: 'Labelled 29 Sep 2026 by Lea Navarro',
      facility: 'Sub-National Blood Center - Mindanao',
    })
    expect(prbc!.clearances).toEqual([
      'TTI cleared · TTI-000012 · 28 Sep 2026 · Ben Cruz',
      'ABO/Rh cleared · IH-000013 · 28 Sep 2026 · Ben Cruz',
    ])
  })

  it('prints only the bags asked for, on a reprint', () => {
    expect(finalLabelsFrom(payload, ['1234567-FFP']).map((l) => l.unit_id)).toEqual(['1234567-FFP'])
  })
})

describe('the donation barcode', () => {
  const box = (barcode: string) => ({
    blood_bag_type: 'double',
    donation_barcode: barcode,
    started_time: '09:00',
    ended_time: '09:12',
    volume_ml: 450,
  })
  const day = new Date(2026, 8, 26, 12)
  const later = new Date(2026, 8, 26, 18)

  it('refuses what a bag number cannot hold, rather than quietly changing it', () => {
    expect(phlebotomyProblems(box('SNB/2026/01'), day, later))
      .toContain('A donation barcode is up to 30 letters, numbers and dashes.')
    expect(phlebotomyProblems(box('A'.repeat(31)), day, later))
      .toContain('A donation barcode is up to 30 letters, numbers and dashes.')
    expect(phlebotomyProblems(box('1234567'), day, later)).toEqual([])
  })
})

describe('the printed label', () => {
  const sheet = source('app/components/BloodCenter/BagLabelSheet.vue')

  it('prints on a 100 × 150 mm waybill page, not A4 (project owner, 2026-10-19)', () => {
    expect(sheet).toMatch(/@page bag-label \{\s*size: 100mm 150mm;/)
    expect(sheet).toContain('page: bag-label;')
    expect(sheet).toMatch(/\.bag-label \{[^}]*width: 100mm;[^}]*height: 150mm;/)
  })

  it('carries a QR of its own unit or bag number, built before the print dialog opens', () => {
    expect(sheet).toContain("QRCode.create(String(text), { errorCorrectionLevel: 'M' })")
    expect(sheet).toContain(':d="qrFor(label.unit_id).path"')
    expect(sheet).toContain(':d="qrFor(label.bag_number).path"')
  })
})

describe('where labelling happens', () => {
  it('prints final labels in Processing, never at Issuance (project owner, 2026-10-22)', () => {
    const processed = source('app/pages/blood-center/processed.vue')
    const bench = source('app/pages/blood-center/laboratory.vue')

    expect(processed).toContain('bloodCenterService.printFinalLabels(row.donation_id)')
    expect(processed).toContain("printLabelSheet(labels, 'final')")
    expect(processed).toContain('<BloodCenterBagLabelSheet />')
    expect(bench).toContain('service.printFinalLabels(id)')

    // Stock Intake books labelled bags in; it prints nothing.
    const intake = source('app/pages/blood-center/inventory-intake.vue')
    expect(intake).not.toContain('<BloodCenterBagLabelSheet')
    expect(intake).not.toContain("'final')")
    expect(source('app/pages/blood-center/inventory.vue')).not.toContain('<BloodCenterBagLabelSheet')
  })

  it('books bags in with the expiry on the final label', () => {
    expect(source('app/pages/blood-center/inventory-intake.vue')).toContain('row.expiry_date = component.expiry_date')
  })

  it('keeps Processing to the base label and the hand-over', () => {
    const processing = source('app/pages/blood-center/laboratory.vue')

    expect(processing).not.toContain('Labeling &amp; hand-over')
    expect(processing).toContain("printLabels(phaseOneLabels.value, 'base')")
    // The hand-over itself moved to the Processed list (project owner, 2026-10-19).
    expect(processing).toContain('View or edit on the Processed list')
    expect(processing).not.toContain('Next: hand-over to Issuance')
    expect(source('app/pages/blood-center/processed.vue')).toContain('Hand over to Issuance')
  })

  it('books only numbered bags, and never sends a unit number', () => {
    const intake = source('app/pages/blood-center/inventory-intake.vue')

    // No bag is entered by hand (project owner, 2026-10-22): a donation that
    // can be booked in is labelled, so its bags are numbered.
    expect(intake).not.toContain('unit_id')
    expect(intake).not.toContain('addUnitRow')
    expect(intake).toContain('if (!row.into_stock || !barcoded.value) return')
  })
})

describe('endpoints', () => {
  it('prints final labels through the laboratory namespace, as a POST', async () => {
    fetchMock.mockResolvedValueOnce({ units: [] })
    await bloodCenterService.printFinalLabels(42)

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/laboratory/donations/42/labels')
    expect(config.method).toBe('POST')
  })

  it('finds a donation at Stock Intake by its sticker', async () => {
    fetchMock.mockResolvedValueOnce({ data: [] })
    await bloodCenterService.inventoryIntakeQueue({ barcode: '1234567' })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/inventory/intake-queue')
    expect(config.params).toEqual({ barcode: '1234567' })
  })
})
