/**
 * Print the referral slip a watcher takes to the next blood centre, and only
 * the slip (project owner, 2026-10-19).
 *
 * The same shape as useLabelPrint(): <BloodCenterReferralSlipSheet> sits on
 * <body> hidden until printing; this fills it, marks the document so its
 * print CSS hides everything else, and opens the print dialog. The mark comes
 * off once the dialog closes.
 */
export interface ReferralSlip {
  reference_number: string
  request_reference: string | null
  hospital: string | null
  patient: { full_name: string | null, age: number | null, sex: string | null } | null
  blood_type: string | null
  urgency_label: string | null
  centre: string | null
  lines: Array<{ component: string | null, code: string | null, required: number, unallocated: number }>
  still_needed: number
  issued_at: string
}

export function useReferralSlip() {
  const slip = useState<ReferralSlip | null>('referral-slip', () => null)

  async function printSlip(next: ReferralSlip): Promise<boolean> {
    if (!import.meta.client) return false

    slip.value = next

    await nextTick()

    const root = document.documentElement

    const done = () => {
      root.classList.remove('printing-slip')
      window.removeEventListener('afterprint', done)
    }

    root.classList.add('printing-slip')
    window.addEventListener('afterprint', done)
    window.print()

    return true
  }

  return { slip, printSlip }
}
