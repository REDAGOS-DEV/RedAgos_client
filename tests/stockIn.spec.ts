import { describe, it, expect } from 'vitest'
import { matchStockInScan } from '../app/utils/stockIn'

const arrived = [
  { unit_id: 'RA1-1007-02', bag_number: 'RA1-1007-02' },
  { unit_id: 'RA1-1016-02', bag_number: 'RA1-1016-02', bag_expired: true },
  // A batch from outside: one sender's number on every bag.
  { unit_id: 'DD-4', bag_number: 'PRC-77 #1', external_unit_number: 'PRC-77' },
  { unit_id: 'DD-4-2', bag_number: 'PRC-77 #2', external_unit_number: 'PRC-77' },
]

describe('stocking in by scanning', () => {
  it('finds a RedAgos bag by its number, whatever the case or spacing', () => {
    expect(matchStockInScan('  ra1-1007-02 ', arrived, [])).toEqual({ kind: 'scanned', unitId: 'RA1-1007-02', label: 'RA1-1007-02' })
  })

  it('takes the next bag of a batch on each scan of the sender’s number', () => {
    expect(matchStockInScan('PRC-77', arrived, [])).toMatchObject({ kind: 'scanned', unitId: 'DD-4' })
    expect(matchStockInScan('PRC-77', arrived, ['DD-4'])).toMatchObject({ kind: 'scanned', unitId: 'DD-4-2' })
    expect(matchStockInScan('PRC-77', arrived, ['DD-4', 'DD-4-2'])).toEqual({ kind: 'already', code: 'PRC-77' })
  })

  it('says so when a bag is not waiting, or is past its date', () => {
    expect(matchStockInScan('RA1-9999-01', arrived, [])).toEqual({ kind: 'unknown', code: 'RA1-9999-01' })
    expect(matchStockInScan('RA1-1016-02', arrived, [])).toEqual({ kind: 'expired', code: 'RA1-1016-02' })
  })
})
