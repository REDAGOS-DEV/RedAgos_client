/**
 * Shared dashboard-sidebar state.
 *
 * `namespace` keeps one portal's rail from driving another's. Every portal now
 * *reflows* its content column on hover, so a bucket shared across two of them
 * would let a hover latched in one move the page in the other. 'donor' stays
 * the default only because that build was written against the unnamespaced
 * keys; blood-centre and admin name their own.
 */
export function useSidebar(namespace = 'donor') {
  /*
   * `collapsed` is the persistent desktop rail state. It defaults to true: the
   * desktop sidebar sits collapsed and widens on hover instead of on a click,
   * so there is no expand button to remember a choice from. Nothing sets it to
   * false today, which makes `railExpanded` effectively `hoverExpanded` — it
   * stays separate so a pinned-open rail can be added without touching the
   * layouts that track it.
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
