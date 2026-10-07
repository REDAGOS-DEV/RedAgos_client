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
 * the final label prints only what the server returned for released bags; a
 * bare date is never shifted a day; the barcode refuses what a bag number
 * cannot hold; and release plus final labelling live at Stock Intake, with
 * Blood Inventory showing quarantine read-only.
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

describe('Phase 2 — the final label Issuance prints on release', () => {
  const payload = {
    donation_barcode: '1234567',
    facility: 'Sub-National Blood Center - Mindanao',
    clearances: [
      { label: 'TTI cleared', code: 'TTI-000012', issued_at: '2026-09-28T09:00:00+08:00', issued_by: 'Ben Cruz' },
      { label: 'ABO/Rh cleared', code: 'IH-000013', issued_at: '2026-09-28T10:00:00+08:00', issued_by: 'Ben Cruz' },
    ],
    units: [
      { unit_id: '1234567-PRBC', blood_type: 'O+', component: 'Packed RBC', volume_ml: 250, expiry_date: '2026-11-09', released_at: '2026-09-29T08:00:00+08:00', released_by: 'Ana Reyes' },
      { unit_id: '1234567-FFP', blood_type: 'O+', component: 'Fresh Frozen Plasma', volume_ml: 220, expiry_date: '2027-09-28', released_at: '2026-09-29T08:00:00+08:00', released_by: 'Ana Reyes' },
    ],
  }

  it('carries the verified type, expiry, clearance codes and who released it', () => {
    const [prbc] = finalLabelsFrom(payload)

    expect(prbc).toMatchObject({
      unit_id: '1234567-PRBC',
      abo: 'O',
      rh: 'Rh POSITIVE',
      expiry: '9 Nov 2026',
      released: 'Released 29 Sep 2026 by Ana Reyes',
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

describe('where labelling happens', () => {
  it('releases and prints final labels at Stock Intake', () => {
    const intake = source('app/pages/blood-center/inventory-intake.vue')

    expect(intake).toContain('<BloodCenterQuarantinePanel allow-release @released="onReleased"')
    expect(intake).toContain("print(printable, 'final')")
    expect(intake).toContain('<BloodCenterBagLabelSheet')
  })

  it('shows quarantine read-only on Blood Inventory', () => {
    const inventory = source('app/pages/blood-center/inventory.vue')

    expect(inventory).toContain('<BloodCenterQuarantinePanel />')
    expect(inventory).not.toContain('allow-release')
  })

  it('keeps Processing to the base label and the hand-over', () => {
    const processing = source('app/pages/blood-center/laboratory.vue')

    expect(processing).toContain('Hand-over to Issuance')
    expect(processing).not.toContain('Labeling &amp; hand-over')
    expect(processing).toContain("printLabels(phaseOneLabels.value, 'base')")
  })

  it('books a numbered bag without sending a unit number', () => {
    const intake = source('app/pages/blood-center/inventory-intake.vue')

    expect(intake).toContain('...(!row.bag_number && row.unit_id?.trim() ? { unit_id: row.unit_id.trim() } : {})')
  })
})

describe('endpoints', () => {
  it('reads final label data from the inventory namespace', async () => {
    fetchMock.mockResolvedValueOnce({ units: [] })
    await bloodCenterService.bloodLabels(42)

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/inventory/donations/42/labels')
    expect(config.method).toBe('GET')
  })

  it('finds a donation at Stock Intake by its sticker', async () => {
    fetchMock.mockResolvedValueOnce({ data: [] })
    await bloodCenterService.inventoryIntakeQueue({ barcode: '1234567' })

    const [url, config] = fetchMock.mock.calls[0]!

    expect(url).toBe('/blood-center/inventory/intake-queue')
    expect(config.params).toEqual({ barcode: '1234567' })
  })
})
