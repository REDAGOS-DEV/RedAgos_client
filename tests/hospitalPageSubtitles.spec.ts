import { describe, expect, it } from 'vitest'
import { hospitalPageSubtitle } from '../app/utils/hospitalPageSubtitles'

// The abilities each hospital role holds, from the server's HospitalPermissions.
const SHARED = ['hospital.requests.view', 'hospital.inventory.view']
const INVENTORY = [...SHARED, 'hospital.inventory.stock_in', 'hospital.inventory.handle', 'hospital.inventory.discard', 'hospital.inventory.thresholds', 'hospital.receiving.direct']
const REQUESTING = [...SHARED, 'hospital.requests.manage', 'hospital.schedules.manage', 'hospital.receipt.confirm', 'hospital.billing.view']
const HEAD = [...new Set([...INVENTORY, ...REQUESTING, 'hospital.staff.manage'])]

const as = (abilities: string[]) => (ability: string) => abilities.includes(ability)

describe('hospital page subtitles', () => {
  it('tells inventory staff what they do on the inventory, and requesting staff who does', () => {
    expect(hospitalPageSubtitle('inventory', as(INVENTORY))).toContain('Tag bags to patients')
    expect(hospitalPageSubtitle('inventory', as(REQUESTING))).toContain('Inventory staff handle the bags')
  })

  it('tells requesting staff what they do on requests, and inventory staff who does', () => {
    expect(hospitalPageSubtitle('patientRequests', as(REQUESTING))).toContain('Raise blood requests')
    expect(hospitalPageSubtitle('patientRequests', as(INVENTORY))).toContain('Requesting staff raise them')
    expect(hospitalPageSubtitle('weekly', as(INVENTORY))).toContain('Requesting staff send it')
    expect(hospitalPageSubtitle('requestDays', as(INVENTORY))).toContain('Requesting staff set them')
  })

  it('gives the Head the line for doing the work, on both sides', () => {
    expect(hospitalPageSubtitle('inventory', as(HEAD))).toContain('Tag bags to patients')
    expect(hospitalPageSubtitle('patientRequests', as(HEAD))).toContain('Raise blood requests')
    expect(hospitalPageSubtitle('dashboard', as(HEAD))).toContain('patient requests, weekly restock and the stock')
  })

  it('words the dashboard for each role', () => {
    expect(hospitalPageSubtitle('dashboard', as(REQUESTING))).toContain('waiting on you')
    expect(hospitalPageSubtitle('dashboard', as(INVENTORY))).toContain('running low')
  })
})
