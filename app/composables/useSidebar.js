export function useSidebar() {
  /*
   * `collapsed` is the persistent desktop rail state. It now defaults to true:
   * the desktop sidebar sits collapsed and widens on hover instead of on a
   * click, so there is no expand button to remember a choice from.
   *
   * `hoverExpanded` is the transient widening. It is deliberately kept apart
   * from `collapsed` because only the sidebar's own width may follow it — the
   * layout keeps reserving the collapsed rail width, so the expanded sidebar
   * floats over the content instead of reflowing the page on every hover.
   */
  const collapsed = useState('donor-sidebar-collapsed', () => true)
  const hoverExpanded = useState('donor-sidebar-hover-expanded', () => false)
  const mobileOpen = useState('donor-sidebar-mobile-open', () => false)

  const expandOnHover = () => {
    hoverExpanded.value = true
  }

  const collapseOnHover = () => {
    hoverExpanded.value = false
  }

  const openMobile = () => {
    mobileOpen.value = true
  }

  const closeMobile = () => {
    mobileOpen.value = false
  }

  return {
    collapsed,
    hoverExpanded,
    expandOnHover,
    collapseOnHover,
    mobileOpen,
    openMobile,
    closeMobile
  }
}
