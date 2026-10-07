import type { LabelVariant, PrintableLabel } from '~/utils/bagLabels'

/**
 * Print bag labels, and only the labels.
 *
 * The labels are drawn by <BloodCenterBagLabelSheet>, which sits on <body>
 * hidden until printing. This fills it, marks the document as printing labels
 * — its print CSS then hides everything else — and opens the browser's print
 * dialog, where staff pick the label printer. The mark comes off once the
 * dialog closes.
 */
export function useLabelPrint() {
  const sheet = useState<{ variant: LabelVariant; labels: PrintableLabel[] }>(
    'bag-label-sheet',
    () => ({ variant: 'final', labels: [] }),
  )

  async function print(labels: PrintableLabel[], variant: LabelVariant): Promise<boolean> {
    if (!import.meta.client || !labels.length) return false

    sheet.value = { variant, labels }

    await nextTick()

    const root = document.documentElement

    const done = () => {
      root.classList.remove('printing-labels')
      window.removeEventListener('afterprint', done)
    }

    root.classList.add('printing-labels')
    window.addEventListener('afterprint', done)
    window.print()

    return true
  }

  return { sheet, print }
}
