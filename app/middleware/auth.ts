const LOGIN_ROUTES: Record<string, string> = {
  '/donor': '/auth/donor/login',
  '/hospital': '/auth/hospital/login',
  '/blood-center': '/auth/blood-center/login',
}

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) {
    return
  }

  if (localStorage.getItem('_token')) {
    return
  }

  // Ang login page kay lahi each role, so kuhaon nato gikan sa path desired path. 
  // Ang role-selection kay fallback lang kung wala mo-match.
  const prefix = Object.keys(LOGIN_ROUTES).find((p) => to.path.startsWith(p))

  return navigateTo({
    path: prefix ? LOGIN_ROUTES[prefix] : '/auth/role-selection',
    query: {
      redirect: to.fullPath,
    },
  })
})

