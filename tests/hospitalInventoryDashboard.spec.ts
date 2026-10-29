import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  hospitalActivityKindMeta,
  hospitalRemainingDaysTag,
  hospitalUnitStatusTag,
} from '../app/utils/hospitalInventoryDashboard'

const root = path.resolve(__dirname, '..')
const source = (file: string) => readFileSync(path.join(root, file), 'utf8')

describe('a hospital bag\'s status tag', () => {
  it('reads an available bag within a week of its date as Expiring Soon', () => {
    expect(hospitalUnitStatusTag('available', 7)).toEqual({ label: 'Expiring Soon', tone: 'warning' })
    expect(hospitalUnitStatusTag('available', 8)).toEqual({ label: 'Available', tone: 'success' })
  })

  it('keeps the tag stages neutral and tells them apart by name', () => {
    const assigned = hospitalUnitStatusTag('tag_assigned', 2)
    const crossmatched = hospitalUnitStatusTag('tag_crossmatched', 2)

    expect(assigned.tone).toBe('neutral')
    expect(crossmatched.tone).toBe('neutral')
    expect(assigned.label).not.toBe(crossmatched.label)
  })

  it('marks the statuses someone has to act on, and greys what has left', () => {
    expect(hospitalUnitStatusTag('pending_return', 4).tone).toBe('warning')
    expect(hospitalUnitStatusTag('expired', -1).tone).toBe('danger')
    expect(hospitalUnitStatusTag('transfused', 3).tone).toBe('muted')
    expect(hospitalUnitStatusTag('discarded', 3).tone).toBe('muted')
  })
})

describe('a hospital bag\'s remaining days', () => {
  it('counts nothing for a bag that has left the blood bank', () => {
    expect(hospitalRemainingDaysTag('transfused', 5)).toEqual({ label: '—', tone: 'muted' })
    expect(hospitalRemainingDaysTag('discarded', 5)).toEqual({ label: '—', tone: 'muted' })
  })

  it('counts down the centre\'s way for a bag still here', () => {
    expect(hospitalRemainingDaysTag('available', 2)).toEqual({ label: '2 days', tone: 'danger' })
    expect(hospitalRemainingDaysTag('tag_assigned', 6)).toEqual({ label: '6 days', tone: 'warning' })
    expect(hospitalRemainingDaysTag('expired', -2)).toEqual({ label: 'Expired', tone: 'danger' })
  })
})

describe('the hospital activity feed', () => {
  it('names every kind the server sends', () => {
    for (const kind of ['received', 'stocked', 'tagged', 'crossmatched', 'transfused', 'untagged', 'returned', 'discarded', 'expired']) {
      expect(hospitalActivityKindMeta(kind).label).not.toBe('Updated')
    }
  })

  it('marks only a bag lost to the shelf', () => {
    expect(hospitalActivityKindMeta('discarded').tone).toBe('danger')
    expect(hospitalActivityKindMeta('expired').tone).toBe('danger')
    expect(hospitalActivityKindMeta('transfused').tone).toBe('neutral')
  })

  it('is read through the service', () => {
    expect(source('app/api/hospital/HospitalService.ts')).toContain("'/hospital/inventory/activity'")
  })
})
