/**
 * A one-slot registry so `BaseService` can report a rejected session without
 * knowing what should happen next.
 *
 * `BaseService.request()` runs during SSR, inside route middleware, and from
 * plain event handlers — none of which can safely call `navigateTo()` or a
 * composable. Reaching for `useUser()` there would work in a component and
 * break everywhere else, and the breakage is the silent kind.
 *
 * So the service stays pure: it normalises the error, reports the 401, and
 * throws as before. A client plugin registers the handler that owns the
 * redirect. Nothing changes for existing callers — their `catch` blocks still
 * receive the same error object.
 */
export type UnauthorizedHandler = (error: Error & { status?: number }) => void

let handler: UnauthorizedHandler | null = null

/**
 * Register the handler. Called once, by `plugins/session-expiry.client.ts`.
 */
export function onUnauthorized(fn: UnauthorizedHandler | null): void {
  handler = fn
}

/**
 * Report a 401. Never throws: a failure in session handling must not replace
 * the original error the caller is about to receive.
 */
export function reportUnauthorized(error: Error & { status?: number }): void {
  if (!handler) return

  try {
    handler(error)
  } catch (err) {
    if (import.meta.dev) {
      console.error('[unauthorized] handler threw', err)
    }
  }
}
