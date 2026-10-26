import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ageLabel, durationLabel, panelPeak, panelTotals } from '~/utils/testingDashboard'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = (file: string) => readFileSync(path.join(root, file), 'utf8')

describe('testing dashboard helpers', () => {
  const days = [
    { date: '2026-10-20', non_reactive: 3, reactive: 1 },
    { date: '2026-10-21', non_reactive: 6, reactive: 0 },
    { date: '2026-10-22', non_reactive: 2, reactive: 2 },
  ]

  it('reads the busiest day and the totals across both outcomes', () => {
    expect(panelPeak(days)).toBe(6)
    expect(panelPeak([])).toBe(0)
    expect(panelTotals(days)).toEqual({ panels: 14, reactive: 3 })
  })

  it('says a span the way a person would', () => {
    expect(durationLabel(0.75)).toBe('45 min')
    expect(durationLabel(0.001)).toBe('1 min')
    expect(durationLabel(5)).toBe('5 h')
    expect(durationLabel(5.46)).toBe('5.5 h')
    expect(durationLabel(50)).toBe('2.1 days')
    expect(durationLabel(48)).toBe('2 days')
  })

  it('shows a dash for what is not known', () => {
    expect(durationLabel(null)).toBe('—')
    expect(durationLabel(undefined)).toBe('—')
    expect(durationLabel(-1)).toBe('—')
    expect(ageLabel(null)).toBe('—')
    expect(ageLabel('not a date')).toBe('—')
  })

  it('reads how long ago something was drawn', () => {
    const now = new Date('2026-10-22T12:00:00Z')
    expect(ageLabel('2026-10-22T09:00:00Z', now)).toBe('3 h')
    expect(ageLabel('2026-10-19T12:00:00Z', now)).toBe('3 days')
  })
})

describe('the Testing dashboard', () => {
  const page = source('app/pages/blood-center/testing-dashboard.vue')
  const nav = source('app/composables/useBloodCenterNav.ts')

  it('is gated, in the page and the sidebar, on the ability the server checks', () => {
    expect(page).toContain("requires: 'lab.record_serology'")
    expect(nav).toMatch(/label: 'Testing Dashboard', path: '\/blood-center\/testing-dashboard'[^}]*requires: 'lab\.record_serology'/)
  })

  it('reads the dashboard endpoint and names no donor', () => {
    expect(source('app/api/bloodcenter/BloodCenterService.ts')).toContain('/laboratory/testing-dashboard')
    expect(page).not.toMatch(/donor\.(first_name|last_name|full_name|email)/)
  })

  it('shows the supervisor counts only when the server sends them, and no referral counts', () => {
    expect(page).toContain('v-if="data.approvals"')
    expect(page).not.toContain('referrals.')
  })
})
