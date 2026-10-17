/**
 * Keep the signed-in user's roles and permissions current in an open tab.
 *
 * The user is read once when the app loads and kept in memory, so when an
 * Admin gives someone a role (or takes one away) in another session, that
 * person's open tab went on showing yesterday's buttons until a reload — the
 * new Appointments buttons hid that way on 2026-10-17. The server was always
 * right; only the copy the pages read to draw their controls was stale.
 *
 * Re-read quietly when the tab comes back into view, at most once a minute,
 * and every five minutes while it stays visible. useUser().refreshUser()
 * shows no loading state and keeps the user it has if a request fails.
 *
 * Client-only: there is no tab to come back to on the server.
 */
const MIN_GAP_MS = 60_000
const INTERVAL_MS = 5 * 60_000

export default defineNuxtPlugin(() => {
  const { refreshUser } = useUser()
  let last = Date.now()

  function maybeRefresh(force = false) {
    if (document.visibilityState !== 'visible') return
    if (!force && Date.now() - last < MIN_GAP_MS) return
    last = Date.now()
    refreshUser()
  }

  document.addEventListener('visibilitychange', () => maybeRefresh())
  window.addEventListener('focus', () => maybeRefresh())
  setInterval(() => maybeRefresh(true), INTERVAL_MS)
})
