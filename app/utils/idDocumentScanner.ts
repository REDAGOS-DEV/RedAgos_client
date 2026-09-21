/**
 * Frame analysis for the guided Valid ID camera.
 *
 * Deliberately dependency-free and deliberately not a computer-vision library.
 * A real contour finder (OpenCV.js and friends) is megabytes of wasm to decide
 * whether a rectangle is roughly where we already drew a rectangle, on a page a
 * donor opens once. Everything here runs over a ~256px grayscale downscale of
 * the preview, which is enough to locate four strong edges and cheap enough to
 * do on every animation frame on a mid-range phone.
 *
 * Pure functions over plain typed arrays, so the thresholds that decide whether
 * a capture is allowed can be tested without a browser — see
 * tests/idDocumentScanner.spec.ts.
 */

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface GrayFrame {
  data: Uint8Array
  width: number
  height: number
}

/** An ImageData, or anything shaped like one, so tests can build frames by hand. */
export interface RgbaFrame {
  data: Uint8ClampedArray | number[]
  width: number
  height: number
}

export interface SceneAnalysis {
  /** Mean luma inside the guide, 0-255. */
  brightness: number
  /** Fraction of near-white pixels inside the guide — blown highlights, i.e. glare. */
  glare: number
  /** Detected document bounds in frame pixels, or null when no rectangle stood out. */
  box: Rect | null
  /** How far the four edges stood out from their surroundings, 0-1. */
  confidence: number
  /** Rotation of the detected rectangle away from the guide, in degrees. */
  tilt: number
  /** Detected area as a fraction of the guide area. */
  coverage: number
  /** Distance from the guide centre, as a fraction of guide width. */
  offset: number
  /** Whether the whole rectangle sits inside the guide, within tolerance. */
  contained: boolean
}

export type GuidanceCode =
  | 'dark'
  | 'no_document'
  | 'too_far'
  | 'outside'
  | 'off_centre'
  | 'tilted'
  | 'glare'
  | 'unsteady'
  | 'ready'

/**
 * What the donor is told, per condition.
 *
 * One sentence, one instruction, and always something they can act on: a
 * scanner that says "invalid" and stops is a scanner people photograph badly
 * and then give up on.
 */
export const GUIDANCE_MESSAGES: Record<GuidanceCode, string> = {
  dark: 'Move to a brighter area.',
  no_document: 'Position your ID inside the frame.',
  too_far: 'Move your ID closer.',
  outside: 'Keep the entire ID inside the frame.',
  off_centre: 'Centre your ID in the frame.',
  tilted: 'Align your ID with the frame.',
  glare: 'Tilt your ID away from the glare.',
  unsteady: 'Hold your phone steady.',
  ready: 'Hold steady...',
}

/**
 * The bar a frame has to clear before it is captured automatically.
 *
 * Tuned to be forgiving rather than strict. Every one of these has a manual
 * shutter behind it, so being slightly too lenient costs a photo the donor can
 * see and retake, while being too strict costs a scanner that never fires and a
 * donor who cannot submit an ID at all.
 */
export const SCAN_THRESHOLDS = {
  /** Mean luma below this and detection cannot be expected to work at all. */
  minBrightness: 62,
  /** Fraction of blown-out pixels that means the print is being washed out. */
  maxGlare: 0.055,
  /** Laplacian variance, measured on a native-resolution centre crop. */
  minSharpness: 55,
  /** Minimum per-edge prominence for us to believe there is a card there. */
  minConfidence: 0.35,
  /** Detected area as a fraction of the guide. Below this the print will not resolve. */
  minCoverage: 0.55,
  /** Above this the card is spilling out of the guide. */
  maxCoverage: 1.22,
  /** Centre drift, as a fraction of guide width. */
  maxOffset: 0.07,
  /** Degrees of rotation away from the guide. */
  maxTilt: 6,
  /** Movement between recent frames, as a fraction of the card width. */
  maxMotion: 0.035,
  /** Plausible width:height for an ID-1 card (1.585) through a phone lens. */
  minAspect: 1.15,
  maxAspect: 2.35,
}

export type ScanThresholds = typeof SCAN_THRESHOLDS

/** How far outside the guide we look for the card edges. */
const SEARCH_MARGIN = 0.14

/** Overshoot past the guide we forgive before calling the card "outside". */
const CONTAINMENT_TOLERANCE = 0.025

/**
 * Convert an RGBA frame to single-channel luma.
 *
 * Rec. 601 weights in fixed point: this runs over every pixel of every frame,
 * and the floating point version is measurably slower on the phones this is
 * aimed at.
 */
export function toGray(image: RgbaFrame): GrayFrame {
  const { width, height } = image
  const source = image.data
  const data = new Uint8Array(width * height)

  // The `!` runs through every pixel loop in this file. The bounds are the
  // loops' own, so an out-of-range read is a bug in the loop rather than a case
  // to handle, and a per-pixel guard would cost more than the work it guards.
  for (let p = 0, i = 0; p < data.length; p++, i += 4) {
    data[p] = (source[i]! * 77 + source[i + 1]! * 150 + source[i + 2]! * 29) >> 8
  }

  return { data, width, height }
}

function clampRect(rect: Rect, frame: { width: number; height: number }): Rect {
  const left = Math.max(0, Math.min(Math.round(rect.left), frame.width - 1))
  const top = Math.max(0, Math.min(Math.round(rect.top), frame.height - 1))
  const right = Math.max(left + 1, Math.min(Math.round(rect.left + rect.width), frame.width))
  const bottom = Math.max(top + 1, Math.min(Math.round(rect.top + rect.height), frame.height))

  return { left, top, width: right - left, height: bottom - top }
}

function expandRect(rect: Rect, margin: number, frame: { width: number; height: number }): Rect {
  const dx = rect.width * margin
  const dy = rect.height * margin

  return clampRect({
    left: rect.left - dx,
    top: rect.top - dy,
    width: rect.width + dx * 2,
    height: rect.height + dy * 2,
  }, frame)
}

/**
 * Mean luma and blown-highlight fraction over a region.
 */
export function regionLuma(frame: GrayFrame, region: Rect): { brightness: number; glare: number } {
  const rect = clampRect(region, frame)
  let sum = 0
  let clipped = 0
  let count = 0

  for (let y = rect.top; y < rect.top + rect.height; y++) {
    const row = y * frame.width

    for (let x = rect.left; x < rect.left + rect.width; x++) {
      const value = frame.data[row + x]!
      sum += value
      if (value >= 247) clipped++
      count++
    }
  }

  if (count === 0) return { brightness: 0, glare: 0 }

  return { brightness: sum / count, glare: clipped / count }
}

/**
 * Variance of the Laplacian — the standard cheap focus measure.
 *
 * Meaningful only at native resolution: downscaling is itself a low-pass
 * filter, so a blurry frame and a sharp one converge once you shrink them. The
 * caller feeds this a 1:1 crop of the middle of the card, not the preview
 * downscale everything else here uses.
 */
export function laplacianVariance(frame: GrayFrame, region?: Rect): number {
  const rect = clampRect(
    region ?? { left: 0, top: 0, width: frame.width, height: frame.height },
    frame
  )
  const right = Math.min(rect.left + rect.width, frame.width - 1)
  const bottom = Math.min(rect.top + rect.height, frame.height - 1)

  let sum = 0
  let sumSquares = 0
  let count = 0

  for (let y = Math.max(1, rect.top); y < bottom; y++) {
    const row = y * frame.width

    for (let x = Math.max(1, rect.left); x < right; x++) {
      const value =
        frame.data[row + x]! * 4
        - frame.data[row + x - 1]!
        - frame.data[row + x + 1]!
        - frame.data[row - frame.width + x]!
        - frame.data[row + frame.width + x]!

      sum += value
      sumSquares += value * value
      count++
    }
  }

  if (count === 0) return 0

  const mean = sum / count

  return sumSquares / count - mean * mean
}

/**
 * Sum of horizontal gradient down each column of a region.
 *
 * The left and right borders of a card are long vertical discontinuities, so
 * they show up as two clear spikes in this profile even when the background is
 * busy. A desk edge or a sleeve produces one spike, not a symmetric pair a
 * card-width apart.
 */
function columnEnergy(frame: GrayFrame, region: Rect): Float64Array {
  const profile = new Float64Array(region.width)

  for (let y = region.top; y < region.top + region.height; y++) {
    const row = y * frame.width

    for (let i = 1; i < region.width - 1; i++) {
      const x = region.left + i
      profile[i] = profile[i]! + Math.abs(frame.data[row + x + 1]! - frame.data[row + x - 1]!)
    }
  }

  return profile
}

/** Sum of vertical gradient across each row of a region. */
function rowEnergy(frame: GrayFrame, region: Rect): Float64Array {
  const profile = new Float64Array(region.height)

  for (let i = 1; i < region.height - 1; i++) {
    const y = region.top + i
    const above = (y - 1) * frame.width
    const below = (y + 1) * frame.width

    for (let x = region.left; x < region.left + region.width; x++) {
      profile[i] = profile[i]! + Math.abs(frame.data[below + x]! - frame.data[above + x]!)
    }
  }

  return profile
}

interface Peak {
  index: number
  /** Height of the peak relative to the mean of its search window. */
  prominence: number
  /** True when the peak sits on the edge of where we were allowed to look. */
  clamped: boolean
}

function findPeak(profile: Float64Array, from: number, to: number): Peak {
  let index = from
  let best = -1
  let sum = 0
  let count = 0

  for (let i = from; i <= to; i++) {
    const value = profile[i]!
    sum += value
    count++

    if (value > best) {
      best = value
      index = i
    }
  }

  const mean = count > 0 ? sum / count : 0

  return {
    index,
    prominence: mean > 1 ? best / mean : 0,
    clamped: index <= from + 1 || index >= to - 1,
  }
}

/** Map a peak prominence onto 0-1, where 1 is an unmistakable edge. */
function edgeConfidence(peak: Peak): number {
  return Math.max(0, Math.min(1, (peak.prominence - 1.25) / 1.75))
}

/**
 * Refine one edge line by line and return its angle, in degrees.
 *
 * The peak search gives a single x (or y) for the whole edge, which is its
 * average position and says nothing about rotation. Re-finding the edge at
 * several points along its length and fitting a line to those points is what
 * separates "the card is ten degrees off" from "the card is fine".
 */
function edgeAngle(
  frame: GrayFrame,
  box: Rect,
  position: number,
  orientation: 'vertical' | 'horizontal'
): number | null {
  const window = Math.max(2, Math.round((orientation === 'vertical' ? box.width : box.height) * 0.06))
  const along = orientation === 'vertical' ? box.height : box.width
  const start = orientation === 'vertical' ? box.top : box.left
  const samples = 9

  const points: Array<{ a: number; b: number }> = []

  for (let s = 0; s < samples; s++) {
    // Skip the outer 12%: the corners are where a rounded card stops being a
    // straight line, and including them biases every fit towards zero.
    const a = Math.round(start + along * (0.12 + (s / (samples - 1)) * 0.76))
    let best = -1
    let bestAt = position

    for (let offset = -window; offset <= window; offset++) {
      const b = position + offset
      let gradient: number

      if (orientation === 'vertical') {
        if (b <= 0 || b >= frame.width - 1 || a < 0 || a >= frame.height) continue
        gradient = Math.abs(frame.data[a * frame.width + b + 1]! - frame.data[a * frame.width + b - 1]!)
      } else {
        if (a < 0 || a >= frame.width || b <= 0 || b >= frame.height - 1) continue
        gradient = Math.abs(frame.data[(b + 1) * frame.width + a]! - frame.data[(b - 1) * frame.width + a]!)
      }

      if (gradient > best) {
        best = gradient
        bestAt = b
      }
    }

    if (best > 8) points.push({ a, b: bestAt })
  }

  if (points.length < 5) return null

  // Least squares fit of b against a.
  let sumA = 0
  let sumB = 0
  let sumAB = 0
  let sumAA = 0

  for (const point of points) {
    sumA += point.a
    sumB += point.b
    sumAB += point.a * point.b
    sumAA += point.a * point.a
  }

  const n = points.length
  const denominator = n * sumAA - sumA * sumA

  if (Math.abs(denominator) < 1e-6) return null

  const slope = (n * sumAB - sumA * sumB) / denominator

  // A clockwise screen rotation tilts horizontal edges by +slope and shifts
  // vertical edges by -slope, so the vertical pair is negated before averaging.
  const degrees = (Math.atan(slope) * 180) / Math.PI

  return orientation === 'vertical' ? -degrees : degrees
}

/**
 * Locate the ID inside (or near) the guide and describe how well it is placed.
 */
export function analyseScene(
  frame: GrayFrame,
  guide: Rect,
  thresholds: ScanThresholds = SCAN_THRESHOLDS
): SceneAnalysis {
  const { brightness, glare } = regionLuma(frame, guide)
  const search = expandRect(guide, SEARCH_MARGIN, frame)

  const empty: SceneAnalysis = {
    brightness,
    glare,
    box: null,
    confidence: 0,
    tilt: 0,
    coverage: 0,
    offset: 1,
    contained: false,
  }

  if (search.width < 16 || search.height < 16) return empty

  const columns = columnEnergy(frame, search)
  const rows = rowEnergy(frame, search)

  // Each edge is looked for in its own half of the search window. A card that
  // does not straddle the centre is too far off to be worth measuring, and
  // splitting this way stops one very strong background edge being taken as
  // both sides of the card at once.
  const midX = Math.floor(search.width / 2)
  const midY = Math.floor(search.height / 2)

  const leftEdge = findPeak(columns, 1, Math.max(2, midX - 2))
  const rightEdge = findPeak(columns, Math.min(columns.length - 3, midX + 2), columns.length - 2)
  const topEdge = findPeak(rows, 1, Math.max(2, midY - 2))
  const bottomEdge = findPeak(rows, Math.min(rows.length - 3, midY + 2), rows.length - 2)

  const confidence = Math.min(
    edgeConfidence(leftEdge),
    edgeConfidence(rightEdge),
    edgeConfidence(topEdge),
    edgeConfidence(bottomEdge)
  )

  if (confidence < thresholds.minConfidence) return { ...empty, confidence }

  const box: Rect = {
    left: search.left + leftEdge.index,
    top: search.top + topEdge.index,
    width: rightEdge.index - leftEdge.index,
    height: bottomEdge.index - topEdge.index,
  }

  if (box.width < 8 || box.height < 8) return { ...empty, confidence }

  // A rectangle that is not card-shaped is something else in the frame. Saying
  // "no document" is the honest answer and produces the right instruction;
  // calling it a badly placed ID would send the donor chasing advice about an
  // object that is not their ID.
  const aspect = box.width / box.height

  if (aspect < thresholds.minAspect || aspect > thresholds.maxAspect) {
    return { ...empty, confidence }
  }

  const angles = [
    edgeAngle(frame, box, box.left, 'vertical'),
    edgeAngle(frame, box, box.left + box.width, 'vertical'),
    edgeAngle(frame, box, box.top, 'horizontal'),
    edgeAngle(frame, box, box.top + box.height, 'horizontal'),
  ].filter((angle): angle is number => angle !== null)

  const tilt = angles.length > 0
    ? angles.reduce((total, angle) => total + angle, 0) / angles.length
    : 0

  const toleranceX = guide.width * CONTAINMENT_TOLERANCE
  const toleranceY = guide.height * CONTAINMENT_TOLERANCE

  // A peak pinned to the edge of the search window means the real edge is
  // further out than we were allowed to look: the card runs off the guide.
  const clamped = leftEdge.clamped || rightEdge.clamped || topEdge.clamped || bottomEdge.clamped

  const contained = !clamped
    && box.left >= guide.left - toleranceX
    && box.top >= guide.top - toleranceY
    && box.left + box.width <= guide.left + guide.width + toleranceX
    && box.top + box.height <= guide.top + guide.height + toleranceY

  const coverage = (box.width * box.height) / (guide.width * guide.height)

  const offset = Math.hypot(
    (box.left + box.width / 2) - (guide.left + guide.width / 2),
    (box.top + box.height / 2) - (guide.top + guide.height / 2)
  ) / guide.width

  return { brightness, glare, box, confidence, tilt, coverage, offset, contained }
}

/**
 * Rolling record of where the card has been, used to tell moving from settled.
 *
 * Stability is the one condition that cannot be read off a single frame, and it
 * is the one that matters most: a frame can pass every other check and still be
 * motion-blurred beyond reading.
 */
export function createStabilityTracker(size = 7) {
  let samples: Rect[] = []

  return {
    /** Record where the card was this frame. A null box clears the history. */
    push(box: Rect | null) {
      if (!box) {
        samples = []
        return
      }

      samples.push(box)
      if (samples.length > size) samples.shift()
    },

    /** Largest recent movement as a fraction of card width, or null while filling up. */
    motion(): number | null {
      if (samples.length < size) return null

      const centres = samples.map((box) => ({
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
        w: box.width,
      }))

      const reference = centres[centres.length - 1]!.w || 1
      let worst = 0

      for (const a of centres) {
        for (const b of centres) {
          worst = Math.max(
            worst,
            Math.abs(a.x - b.x) / reference,
            Math.abs(a.y - b.y) / reference,
            Math.abs(a.w - b.w) / reference
          )
        }
      }

      return worst
    },

    reset() {
      samples = []
    },
  }
}

export type StabilityTracker = ReturnType<typeof createStabilityTracker>

export interface ScanSample extends SceneAnalysis {
  /** Laplacian variance from the native-resolution detail crop. */
  sharpness: number
  /** Recent movement from the tracker, or null while it fills up. */
  motion: number | null
}

export interface Guidance {
  code: GuidanceCode
  message: string
  ready: boolean
}

/**
 * Turn one analysed frame into the single instruction the donor sees.
 *
 * Ordered by what blocks what. Lighting comes first because detection cannot
 * succeed in the dark, and reporting "position your ID inside the frame" to
 * somebody standing in a dim room sends them re-aiming a camera that was
 * already aimed correctly. Size comes before containment for the same reason:
 * a card that is far away is technically "inside the frame", and telling
 * somebody to keep it inside when the real problem is distance is advice they
 * cannot act on.
 */
export function evaluateScan(
  sample: ScanSample,
  thresholds: ScanThresholds = SCAN_THRESHOLDS
): Guidance {
  const guide = (code: GuidanceCode): Guidance => ({
    code,
    message: GUIDANCE_MESSAGES[code],
    ready: code === 'ready',
  })

  if (sample.brightness < thresholds.minBrightness) return guide('dark')
  if (!sample.box || sample.confidence < thresholds.minConfidence) return guide('no_document')
  if (sample.coverage < thresholds.minCoverage) return guide('too_far')
  if (!sample.contained || sample.coverage > thresholds.maxCoverage) return guide('outside')
  if (sample.offset > thresholds.maxOffset) return guide('off_centre')
  if (Math.abs(sample.tilt) > thresholds.maxTilt) return guide('tilted')
  if (sample.glare > thresholds.maxGlare) return guide('glare')

  // A null motion reading is "not enough frames yet", which is a reason to wait
  // rather than a reason to fire — auto-capture must never be the first thing
  // that happens when the camera opens.
  if (sample.motion === null || sample.motion > thresholds.maxMotion) return guide('unsteady')
  if (sample.sharpness < thresholds.minSharpness) return guide('unsteady')

  return guide('ready')
}

export interface CaptureVerdict {
  level: 'ok' | 'warning' | 'error'
  code: 'ok' | 'dark' | 'glare' | 'blurry' | 'undetected'
  message: string
}

/**
 * Judge the still that was actually taken, not the preview that led to it.
 *
 * The preview stream and the captured frame are not the same image — the
 * capture is full resolution, and on many phones it is a different exposure.
 * Re-checking here is what stops an unreadable photo reaching an administrator
 * who then has to reject it and make the donor start over days later.
 *
 * Thresholds are looser than the live ones on purpose. This is the last gate
 * before a person looks at the image, and a warning the donor can override is
 * the right response to "probably fine": they can see the photo, and they know
 * what their own ID looks like.
 */
export function assessCapture(
  capture: { brightness: number; glare: number; sharpness: number; detected: boolean },
  thresholds: ScanThresholds = SCAN_THRESHOLDS
): CaptureVerdict {
  if (capture.brightness < thresholds.minBrightness * 0.8) {
    return {
      level: 'error',
      code: 'dark',
      message: 'That photo is too dark to read. Move somewhere brighter and take it again.',
    }
  }

  if (capture.sharpness < thresholds.minSharpness * 0.7) {
    return {
      level: 'error',
      code: 'blurry',
      message: 'That photo came out blurry. Hold your phone steady and take it again.',
    }
  }

  if (capture.glare > thresholds.maxGlare * 2) {
    return {
      level: 'error',
      code: 'glare',
      message: 'Glare is covering part of your ID. Tilt it away from the light and take it again.',
    }
  }

  if (!capture.detected) {
    return {
      level: 'warning',
      code: 'undetected',
      message: 'We could not make out the edges of your ID. Check the whole card is visible before you continue.',
    }
  }

  return { level: 'ok', code: 'ok', message: 'Looks good. Check the details are readable.' }
}
