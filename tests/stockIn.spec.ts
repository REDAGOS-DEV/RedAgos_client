import { describe, it, expect } from 'vitest'
import { matchStockInScan } from '../app/utils/stockIn'

const arrived = [
  { unit_id: 'SNBC-21627990-PRBC', bag_number: 'SNBC-21627990-PRBC' },
  { unit_id: 'SNBC-21627990-FFP', bag_number: 'SNBC-21627990-FFP' },
  { unit_id: 'SNBC-31415926-PRBC', bag_number: 'SNBC-31415926-PRBC', bag_expired: true },
  // A batch from outside: one sender's number on every bag.
  { unit_id: 'DD-4', bag_number: 'PRC-77 #1', external_unit_number: 'PRC-77' },
  { unit_id: 'DD-4-2', bag_number: 'PRC-77 #2', external_unit_number: 'PRC-77' },
]

describe('stocking in by scanning', () => {
  it('finds a RedAgos bag by its number, whatever the case or spacing', () => {
    expect(matchStockInScan('  snbc-21627990-ffp ', arrived, [])).toEqual({ kind: 'scanned', unitId: 'SNBC-21627990-FFP', label: 'SNBC-21627990-FFP' })
  })

  it('takes the next bag of a donation on each scan of its barcode sticker', () => {
    expect(matchStockInScan('21627990', arrived, [])).toMatchObject({ kind: 'scanned', unitId: 'SNBC-21627990-PRBC' })
    expect(matchStockInScan('21627990\r', arrived, ['SNBC-21627990-PRBC'])).toMatchObject({ kind: 'scanned', unitId: 'SNBC-21627990-FFP' })
    expect(matchStockInScan('21627990', arrived, ['SNBC-21627990-PRBC', 'SNBC-21627990-FFP'])).toEqual({ kind: 'already', code: '21627990' })
  })

  it('takes the next bag of a batch on each scan of the sender’s number', () => {
    expect(matchStockInScan('PRC-77', arrived, [])).toMatchObject({ kind: 'scanned', unitId: 'DD-4' })
    expect(matchStockInScan('PRC-77', arrived, ['DD-4'])).toMatchObject({ kind: 'scanned', unitId: 'DD-4-2' })
    expect(matchStockInScan('PRC-77', arrived, ['DD-4', 'DD-4-2'])).toEqual({ kind: 'already', code: 'PRC-77' })
  })

  it('says so when a bag is not waiting, or is past its date', () => {
    expect(matchStockInScan('SNBC-99999999-PRBC', arrived, [])).toEqual({ kind: 'unknown', code: 'SNBC-99999999-PRBC' })
    expect(matchStockInScan('SNBC-31415926-PRBC', arrived, [])).toEqual({ kind: 'expired', code: 'SNBC-31415926-PRBC' })
    expect(matchStockInScan('31415926', arrived, [])).toEqual({ kind: 'expired', code: '31415926' })
  })
})
