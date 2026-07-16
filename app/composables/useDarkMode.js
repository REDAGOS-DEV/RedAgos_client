const isDark = ref(false)
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
  }

  function setTheme(value) {
    isDark.value = value
    applyClass(isDark.value)
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  }

  return { isDark, toggleTheme, setTheme }
}