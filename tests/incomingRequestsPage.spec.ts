import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * The Incoming Requests list (blood-center/bloodrequests.vue), laid out after
 * the owner's mock-up on 2026-10-19.
 *
 * What is locked in: one search over patient, hospital and reference; the
 * dates and the status go to the server, and so does the export; each row
 * offers only what the server would accept of it, behind the ability that
 * does it; Issue hands over to Request Fulfillment.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

const page = source('app/pages/blood-center/bloodrequests.vue')

describe('the toolbar', () => {
  it('searches patient and hospital, and filters by dates and status on the server', () => {
    expect(page).toContain(":placeholder=\"isPatientTab ? 'Search patient / hospital…' : 'Search hospital / request ID…'\"")
    expect(page).toContain('<DateRangeFilter v-model:from="fromDate" v-model:to="toDate"')
    expect(page).toContain("if (statusFilter.value === 'open') params.open = 1")
    expect(page).toContain('if (fromDate.value) params.from = fromDate.value')
    expect(page).toContain('if (toDate.value) params.to = toDate.value')
  })

  it('exports what the filters show, from the server', () => {
    expect(page).toContain('bloodCenterService.exportIncomingRequests(filterParams())')
    expect(source('app/api/bloodcenter/BloodCenterService.ts')).toContain('`${this.resource}/blood-requests/export')
  })

  it('records a new request only for whoever records walk-ins, and only among patient requests', () => {
    expect(page).toMatch(/<button v-if="canRecord && isPatientTab"[^>]*@click="showWalkIn = true"/)
  })
})

describe('patient requests and replenishment orders', () => {
  it('are listed on their own tabs, filtered by the server', () => {
    expect(page).toContain("{ value: 'patient_transfusion', label: 'Patient Requests'")
    expect(page).toContain("{ value: 'replenishment', label: 'Inventory Replenishment'")
    expect(page).toContain('const params = { request_purpose: purposeTab.value }')
    expect(source('app/composables/useIncomingRequests.js')).toContain('request_purpose: undefined,')
  })

  it('count what is still open on each tab, from the queue summary', () => {
    expect(page).toContain('return summary.value?.open_by_purpose?.[purpose] ?? 0')
  })

  it('keep the tab in the address, so a refresh opens the same one', () => {
    expect(page).toContain("const purposeTab = ref(route.query.type === 'replenishment' ? 'replenishment' : 'patient_transfusion')")
    expect(page).toContain('router.replace({ query: { ...route.query, type: query } })')
  })

  it('show the patient only where there is one', () => {
    expect(page).toContain('<th v-if="isPatientTab" scope="col" class="c-patient">Patient</th>')
    expect(page).toContain('<th v-else scope="col" class="c-patient">Blood Type</th>')
  })
})

describe('a row', () => {
  it('reserves only what is still needed, and only for whoever allocates', () => {
    expect(page).toContain('canReserve: isOpen && outstanding > 0,')
    expect(page).toMatch(/<template v-if="r\.canReserve">\s*<button\s+v-if="canAllocate"/)
  })

  it('rejects only while nothing is held or sent, and only for whoever decides', () => {
    expect(page).toContain('canReject: isOpen && allocated === 0,')
    expect(page).toMatch(/<template v-if="r\.canReject">\s*<button\s+v-if="canDecide"/)
  })

  it('issues on Request Fulfillment once units are reserved, for whoever releases', () => {
    expect(page).toContain("const canRelease = computed(() => can('requests.release'))")
    expect(page).toContain('<template v-if="r.isOpen && canRelease">')
    expect(page).toContain('<NuxtLink v-if="r.held > 0" to="/blood-center/fulfillment" class="btn-issue"')
    expect(page).toContain('held: Math.max(0, allocated - issued),')
  })

  it('counts units as issued of requested', () => {
    expect(page).toContain('{{ r.issued }} / {{ r.units }}')
    expect(page).toContain('const issued = r.fulfilled_quantity ?? 0')
  })
})

describe('the review', () => {
  it('opens in the middle of the page, like a donor profile, not as a side drawer', () => {
    expect(page).toContain('<div v-if="drawerOpen" class="review-overlay" @click.self="closeDrawer">')
    expect(page).toContain('<div class="review-card" role="dialog" aria-modal="true" aria-labelledby="review-title">')
    expect(page).not.toContain('class="drawer-overlay"')
  })

  it('stays under the approve and reject confirmations that open over it', () => {
    const style = page.split('<style scoped>')[1]!
    expect(style).toMatch(/\.review-overlay \{[^}]*z-index: 90;/)
    expect(style).toMatch(/\.modal-overlay \{[^}]*z-index: 100;/)
  })

  it('offers to reserve only what is still needed, and to issue once all of it is held', () => {
    expect(page).toMatch(/<template v-if="activeRequest\.canReserve">[\s\S]*?v-else-if="canAllocate"[\s\S]*?<\/template>\s*<NuxtLink v-else-if="activeRequest\.held > 0 && canRelease" to="\/blood-center\/fulfillment"/)
  })

  it('rejects only while nothing is held or sent', () => {
    expect(page).toMatch(/<template v-if="activeRequest\.canReject">\s*<button v-if="canDecide"/)
  })
})

describe('reserving', () => {
  const picker = source('app/components/BloodCenter/UnitPickerDialog.vue')

  it('lets staff pick the bags instead of the server choosing (project owner, 2026-10-19)', () => {
    expect(page).toContain('<UnitPickerDialog')
    expect(page).toContain('const result = await allocate(requestToApprove.value.id, unitIds)')
    expect(source('app/composables/useIncomingRequests.js')).toContain('bloodCenterService.allocateRequest(id, undefined, undefined, unitIds)')
    expect(source('app/api/bloodcenter/BloodCenterService.ts')).toContain('if (unitIds?.length) payload.unit_ids = unitIds')
  })

  it('lists each line\'s units from the server and caps a pick at what the line still needs', () => {
    expect(picker).toContain('bloodCenterService.requestUnits(props.request.id)')
    expect(picker).toContain(':disabled="busy || (!isPicked(line, unit) && pickedCount(line) >= line.allocatable)"')
    expect(picker).toContain('const set = new Set(line.units.slice(0, line.allocatable).map((unit) => unit.id))')
  })

  it('finds a bag by its typed or scanned number in each line, Enter ticking it (project owner, 2026-10-19)', () => {
    expect(picker).toContain('@keydown.enter.prevent="pickByNumber(line)"')
    // A bare donation sticker finds that donation's bag of the line's component.
    expect(picker).toContain("const asSticker = `${term}-${(line.component.code ?? '').toUpperCase()}`")
    // Typing narrows the list, past the first few.
    expect(picker).toContain('if (term) return line.units.filter((unit) => unit.id.toUpperCase().includes(term))')
    // A bag of another component on the request is ticked in its own line.
    expect(picker).toContain('picked there.')
  })

  it('shows a refusal against the unit it names', () => {
    expect(page).toContain("if (key.startsWith('unit_ids.') && unitIds[index]) byUnit[unitIds[index]] = [messages].flat()[0]")
    expect(picker).toContain('<span v-if="unitErrors[unit.id]" class="unit__error" role="alert">{{ unitErrors[unit.id] }}</span>')
  })
})

describe('when this centre cannot supply it all (project owner, 2026-10-19)', () => {
  const sheet = source('app/components/BloodCenter/ReferralSlipSheet.vue')

  it('offers a referral slip once something here is closed as unavailable', () => {
    expect(page).toContain('<div v-if="activeRequest.items.some((item) => item.closed_at)" class="share-actions">')
    expect(page).toContain('const data = await bloodCenterService.referralSlip(request.id)')
    expect(source('app/api/bloodcenter/BloodCenterService.ts')).toContain('`/blood-center/blood-requests/${id}/referral-slip`')
  })

  it('prints only when something is still needed elsewhere', () => {
    expect(page).toContain('if (!data?.still_needed) {')
  })

  it('prints a 100 × 150 mm slip with a QR of the patient request reference', () => {
    expect(sheet).toMatch(/@page referral-slip \{\s*size: 100mm 150mm;/)
    expect(sheet).toContain("QRCode.create(slip.value.reference_number, { errorCorrectionLevel: 'M' })")
    expect(sheet).toContain('STILL NEEDED FROM ANOTHER BLOOD CENTER')
  })
})

describe('a hospital not on RedAgos (project owner, 2026-10-19)', () => {
  const dialog = source('app/components/BloodCenter/WalkInRequestDialog.vue')

  it('can be typed by name on a walk-in, with no address asked for', () => {
    expect(dialog).toContain("{ value: NEW_HOSPITAL, label: 'Not in the list — type its name…' }")
    expect(dialog).toContain('<input v-model="form.hospitalName"')
    expect(dialog).not.toMatch(/hospitalAddress|hospital_address/)
  })

  it('is looked up for duplicates by that name', () => {
    expect(dialog).toContain('{ hospital_name: form.value.hospitalName.trim() }')
  })

  it('is marked in the list and the review, and the close toast does not claim it was told', () => {
    expect(page).toContain('registered: r.requesting_facility?.is_registered !== false,')
    expect(page).toContain('<span v-if="!r.registered" class="chip"')
    expect(page).toContain('v-if="!activeRequest.registered"')
    expect(page).toContain("' The hospital is not on RedAgos, so let the watcher know.'")
  })
})

describe('the composable', () => {
  it('pages the list and sends the new filters', () => {
    const composable = source('app/composables/useIncomingRequests.js')
    expect(composable).toContain('incomingRequests({ ...activeFilters(), page, per_page: PER_PAGE })')
    expect(composable).toMatch(/open: undefined,[\s\S]*from: undefined,\s*to: undefined,/)
  })
})
