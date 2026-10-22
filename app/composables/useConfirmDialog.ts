/**
 * The donor portal's own confirm dialog, in place of window.confirm().
 *
 *   const { confirm } = useConfirmDialog()
 *   if (!(await confirm({ title: 'Discard your changes?', tone: 'danger' }))) return
 *
 * Resolves true when the donor confirms, false on the other button, Escape or
 * a click outside. One dialog at a time: asking again settles the open one as
 * false first. The dialog itself is components/donor/ConfirmDialog.vue,
 * mounted once by the donor layout.
 */
export interface ConfirmOptions {
  title: string
  message?: string
  /** The button that goes ahead. */
  confirmLabel?: string
  /** The safe button, focused first. */
  cancelLabel?: string
  /** 'warning' for a change that can't be undone, 'danger' for one that loses something. */
  tone?: 'info' | 'warning' | 'danger'
  icon?: string
}

// Outside the composable, so every caller settles the same open dialog.
let resolver: ((_confirmed: boolean) => void) | null = null

export function useConfirmDialog() {
  const dialog = useState<ConfirmOptions | null>('donor-confirm-dialog', () => null)

  function confirm(options: ConfirmOptions): Promise<boolean> {
    resolver?.(false)
    dialog.value = { tone: 'info', confirmLabel: 'Continue', cancelLabel: 'Cancel', ...options }
    return new Promise((resolve) => {
      resolver = resolve
    })
  }

  function settle(confirmed: boolean): void {
    const resolve = resolver
    resolver = null
    dialog.value = null
    resolve?.(confirmed)
  }

  return { dialog, confirm, settle }
}
