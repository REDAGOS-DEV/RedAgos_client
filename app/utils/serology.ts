/**
 * The Testing department's five-marker serology panel.
 *
 * Exactly five, fixed by the project owner — the form's "NAT" and "Others"
 * rows are not recorded. The server sends the panel in its reference data;
 * this list is the fallback and the order the form prints them in.
 */

export type MarkerReading = 'reactive' | 'non_reactive' | ''

export interface SerologyMarkerOption {
  value: string
  label: string
}

export const SEROLOGY_MARKERS: SerologyMarkerOption[] = [
  { value: 'hiv', label: 'HIV' },
  { value: 'hbsag', label: 'HBsAg (Hepatitis B)' },
  { value: 'hcv', label: 'HCV (Hepatitis C)' },
  { value: 'syphilis', label: 'Syphilis' },
  { value: 'malaria', label: 'Malaria' },
]

/**
 * A blank panel: nothing pre-selected, so every reading is a deliberate choice.
 */
export function blankPanel(markers: SerologyMarkerOption[] = SEROLOGY_MARKERS): Record<string, MarkerReading> {
  return Object.fromEntries(markers.map((marker) => [marker.value, ''])) as Record<string, MarkerReading>
}

/**
 * Whether every marker has a reading. The panel is saved whole or not at all.
 */
export function panelComplete(
  readings: Record<string, MarkerReading>,
  markers: SerologyMarkerOption[] = SEROLOGY_MARKERS,
): boolean {
  return markers.every((marker) => readings[marker.value] === 'reactive' || readings[marker.value] === 'non_reactive')
}

/**
 * The markers read as reactive, by label, in the form's order.
 */
export function reactiveMarkers(
  readings: Record<string, MarkerReading>,
  markers: SerologyMarkerOption[] = SEROLOGY_MARKERS,
): string[] {
  return markers.filter((marker) => readings[marker.value] === 'reactive').map((marker) => marker.label)
}

/**
 * The request body for the panel.
 *
 * `confirm_reactive` is sent only once the medical technologist has confirmed
 * a reactive reading. The server refuses a reactive panel without it, because
 * a reactive marker rejects the donation, permanently defers the donor and
 * refers them — and none of it can be undone from here.
 */
export function serologyPayload(
  readings: Record<string, MarkerReading>,
  confirmed: boolean,
  markers: SerologyMarkerOption[] = SEROLOGY_MARKERS,
): Record<string, string | boolean> {
  const payload: Record<string, string | boolean> = {}

  for (const marker of markers) payload[marker.value] = readings[marker.value]

  if (reactiveMarkers(readings, markers).length > 0) payload.confirm_reactive = confirmed

  return payload
}
