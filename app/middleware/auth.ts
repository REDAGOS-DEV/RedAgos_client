export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) {
    return
  }

  const token = localStorage.getItem('_token')

  if (!token) {
    return navigateTo({
      path: '/login',
      query: {
        redirect: to.fullPath,
      },
    })
  }
})
