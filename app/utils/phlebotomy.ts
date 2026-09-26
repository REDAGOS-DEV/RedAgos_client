/**
 * The "For Phlebotomist Use Only" box of Section II of the DOH form.
 *
 * Mirrors the server's rules so the counter can say what is missing before a
 * request is made. The server stays the authority: it normalises the segment
 * number the same way and enforces uniqueness per facility.
 */

export interface PhlebotomyForm {
  blood_bag_type: string
  segment_number: string
  started_time: string
  ended_time: string
  volume_ml: number | string | null
}

/**
 * Strip what a barcode scanner appends and what a person types differently.
 *
 * Scanners send a trailing carriage return or tab; staff type in either case.
 * Without this a scanned and a typed copy of the same tube would be two
 * different numbers. Matches RecordCollectionRequest on the server.
 */
export function normalizeSegmentNumber(value: string | null | undefined): string {
  // eslint-disable-next-line no-control-regex
  return (value ?? '').replace(/[\s\u0000-\u001f\u007f]+/g, '').toUpperCase()
}

/**
 * A `HH:MM` time on the day of the visit, as an ISO timestamp.
 *
 * The form asks for "Time Started" and "Time Ended", not dates: the draw
 * happens on the visit day. Built in local time, so the ISO string carries the
 * offset and the server compares absolute instants.
 */
export function atTimeOn(day: Date | string, time: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim())

  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (hours > 23 || minutes > 59) return null

  const at = new Date(day)

  if (Number.isNaN(at.getTime())) return null

  at.setHours(hours, minutes, 0, 0)

  return at.toISOString()
}

/**
 * The current time as `HH:MM`, for the "Now" buttons.
 */
export function timeNow(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Everything wrong with the box, in the order the form prints it. Empty when ready.
 */
export function phlebotomyProblems(form: PhlebotomyForm, day: Date | string, now: Date = new Date()): string[] {
  const problems: string[] = []

  if (!form.blood_bag_type) problems.push('Choose the blood bag.')
  if (!normalizeSegmentNumber(form.segment_number)) problems.push('Scan or type the segment number.')

  const started = atTimeOn(day, form.started_time)
  const ended = atTimeOn(day, form.ended_time)

  if (!started) problems.push('Record the time started.')
  if (!ended) problems.push('Record the time ended.')

  if (started && ended && new Date(ended) < new Date(started)) {
    problems.push('The time ended cannot be before the time started.')
  }

  if (ended && new Date(ended) > now) problems.push('The time ended cannot be in the future.')

  const volume = Number(form.volume_ml)

  if (!Number.isFinite(volume) || volume < 100 || volume > 1000) {
    problems.push('Record a volume between 100 and 1000 mL.')
  }

  return problems
}
