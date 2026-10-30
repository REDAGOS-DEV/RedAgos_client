/**
 * The badge modifier for a status tone, so a list's status reads as the centre's
 * Donor Management badges do: the colour on the dot (list-ui.css).
 *
 * The blood bank's status maps speak in tones (success, warning, danger, …);
 * this names the matching `.badge--*` class, neutral for anything else.
 */
const BADGE_BY_TONE: Record<string, string> = {
  success: 'badge--ok',
  ok: 'badge--ok',
  warning: 'badge--warn',
  warn: 'badge--warn',
  danger: 'badge--crit',
  crit: 'badge--crit',
  info: 'badge--info',
  primary: 'badge--info',
  progress: 'badge--progress',
  purple: 'badge--progress',
}

export function badgeClass(tone: string | null | undefined): string {
  return (tone && BADGE_BY_TONE[tone]) || 'badge--neutral'
}
