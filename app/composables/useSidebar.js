export function useSidebar() {
  const collapsed = useState('donor-sidebar-collapsed', () => false)
  const mobileOpen = useState('donor-sidebar-mobile-open', () => false)

  const toggleCollapsed = () => {
    collapsed.value = !collapsed.value
  }

  const openMobile = () => {
    mobileOpen.value = true
  }

  const closeMobile = () => {
    mobileOpen.value = false
  }

  return {
    collapsed,
    toggleCollapsed,
    mobileOpen,
    openMobile,
    closeMobile
  }
}