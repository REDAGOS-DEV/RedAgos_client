const isDark = ref(false)
// 'light' | 'dark' | 'system'. System follows the OS and stores nothing,
// which is how the page behaved before anyone picked a theme.
const themeMode = ref('system')
let initialized = false

function applyClass(value) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', value)
}

function init() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  const stored = localStorage.getItem('theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  themeMode.value = stored === 'dark' || stored === 'light' ? stored : 'system'
  isDark.value = stored ? stored === 'dark' : prefersDark
  applyClass(isDark.value)

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      isDark.value = e.matches
      applyClass(isDark.value)
    }
  })
}

export function useDarkMode() {
  if (!initialized) init()

  function toggleTheme() {
    isDark.value = !isDark.value
    applyClass(isDark.value)
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    themeMode.value = isDark.value ? 'dark' : 'light'
  }

  function setTheme(value) {
    isDark.value = value
    applyClass(isDark.value)
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    themeMode.value = isDark.value ? 'dark' : 'light'
  }

  /** Light, dark, or back to following the operating system. */
  function setThemeMode(mode) {
    if (mode === 'system') {
      localStorage.removeItem('theme')
      themeMode.value = 'system'
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
      applyClass(isDark.value)
      return
    }
    setTheme(mode === 'dark')
  }

  return { isDark, themeMode, toggleTheme, setTheme, setThemeMode }
}