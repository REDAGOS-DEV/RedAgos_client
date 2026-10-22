import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { bagPeak, bagTotals, bagsPerUnit } from '~/utils/processingDashboard'

/**
 * The Processing dashboard (project owner, 2026-10-22).
 *
 * What is locked in: the page and its sidebar link ask for the ability the
 * server checks; the queue reads in bench order (separate, wait for Testing,
 * label, hand over); the technologist's card shows only when the server sends
 * it; and no donor is named.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = (file: string) => readFileSync(path.join(root, file), 'utf8')

describe('processing dashboard helpers', () => {
  const days = [
    { date: '2026-10-20', bags: 6, units: 2 },
    { date: '2026-10-21', bags: 0, units: 0 },
    { date: '2026-10-22', bags: 5, units: 2 },
  ]

  it('reads the busiest day and the totals', () => {
    expect(bagPeak(days)).toBe(6)
    expect(bagPeak([])).toBe(0)
    expect(bagTotals(days)).toEqual({ bags: 11, units: 4 })
  })

  it('reads bags per unit, and a dash when nothing was separated', () => {
    expect(bagsPerUnit(days)).toBe('2.8')
    expect(bagsPerUnit([{ date: '2026-10-22', bags: 6, units: 2 }])).toBe('3')
    expect(bagsPerUnit([])).toBe('—')
  })
})

describe('the Processing dashboard', () => {
  const page = source('app/pages/blood-center/processing-dashboard.vue')
  const nav = source('app/composables/useBloodCenterNav.ts')

  it('is gated, in the page and the sidebar, on the ability the server checks', () => {
    expect(page).toContain("requires: 'lab.record_components'")
    expect(nav).toMatch(/label: 'Processing Dashboard', path: '\/blood-center\/processing-dashboard'[^}]*requires: 'lab\.record_components'/)
    expect(source('app/api/bloodcenter/BloodCenterService.ts')).toContain('/laboratory/processing-dashboard')
  })

  it('reads the queue in bench order', () => {
    const order = ['To separate', 'Awaiting testing', 'Ready to label', 'Ready to hand over'].map((label) => page.indexOf(`label: '${label}'`))
    expect(order.every((at) => at > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('shows the technologist card only when the server sends it, and names no donor', () => {
    expect(page).toContain('v-if="data.technologist"')
    expect(page).not.toMatch(/donor\.(first_name|last_name|full_name|email)/)
  })
})
