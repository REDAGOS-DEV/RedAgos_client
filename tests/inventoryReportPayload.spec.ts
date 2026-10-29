import { describe, it, expect } from 'vitest'
import { inventoryReportPayload } from '../app/api/hospital/HospitalService'

describe('an Inventory Report\'s settings, as the server reads them', () => {
  it('sends the chosen ids in the server\'s names', () => {
    expect(inventoryReportPayload({ by: 'all', components: [3, 1], bloodTypes: [2] }))
      .toEqual({ by: 'all', components: [3, 1], blood_types: [2] })
  })

  it('leaves a list out when nothing narrows it, and sheets per type by default', () => {
    expect(inventoryReportPayload({})).toEqual({ by: 'type' })
  })
})
