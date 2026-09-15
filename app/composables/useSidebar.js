/**
 * Shared dashboard-sidebar state.
 *
 * `namespace` keeps one portal's rail from driving another's. The donor and
 * admin builds were written against a single unnamespaced set of keys, so
 * 'donor' stays the default and their behaviour is unchanged; the blood centre
 * asks for its own bucket because its layout *reflows* on hover and must not
 * inherit a hover the donor drawer latched.
 */
export function useSidebar(namespace = 'donor') {
  /*
   * `collapsed` is the persistent desktop rail state. It defaults to true: the
   * desktop sidebar sits collapsed and widens on hover instead of on a click,
   * so there is no expand button to remember a choice from.
   *
   * `hoverExpanded` is the transient widening. It is kept apart from
   * `collapsed` so each portal can decide what may follow it — the donor rail
   * floats the widened sidebar over the page, the blood centre reflows the
   * content beside it.
   */
  const collapsed = useState(`${namespace}-sidebar-collapsed`, () => true)
  const hoverExpanded = useState(`${namespace}-sidebar-hover-expanded`, () => false)
  const mobileOpen = useState(`${namespace}-sidebar-mobile-open`, () => false)

  /**
   * The rail's visual state, derived once so the sidebar and the layout that
   * reserves space for it can never disagree about which width is showing.
   */
  const railExpanded = computed(() => !collapsed.value || hoverExpanded.value)

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
    railExpanded,
    expandOnHover,
    collapseOnHover,
    mobileOpen,
    openMobile,
    closeMobile
  }
}
