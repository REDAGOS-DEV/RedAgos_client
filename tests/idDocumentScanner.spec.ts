import { describe, it, expect } from 'vitest'

import {
  analyseScene,
  assessCapture,
  createStabilityTracker,
  evaluateScan,
  laplacianVariance,
  regionLuma,
  SCAN_THRESHOLDS,
  toGray,
  type Rect,
  type ScanSample,
} from '~/utils/idDocumentScanner'

/**
 * The guided ID camera decides, without asking anyone, whether a photo of a
 * government ID is good enough to send to a reviewer. Two ways that goes wrong:
 * it fires on a frame nobody can read, and the donor finds out days later when
 * the submission is rejected; or it never fires, and the donor cannot submit an
 * ID at all.
 *
 * Both live in the thresholds, and the thresholds are pure functions over pixel
 * buffers — so they are tested here, in the node environment the rest of this
 * suite uses, rather than behind a camera nobody can point at a fixture.
 *
 * The rendering, the stream and the permission prompts are out of scope, as
 * everywhere else in this suite.
 */

const WIDTH = 260
const HEIGHT = 180

/** The guide the scanner draws, in the coordinates of the frames built below. */
const GUIDE: Rect = { left: 40, top: 34, width: 180, height: 114 }

interface CardOptions {
  card?: Rect
  background?: number
  cardLuma?: number
  /** Degrees of clockwise rotation applied to the card. */
  tilt?: number
  /** Adds fine detail, which is what a focus measure is looking for. */
  texture?: boolean
}

/**
 * Paint a light card on a dark ground.
 *
 * A flat rectangle is the easiest thing in the world to detect, which is the
 * point: these fixtures are here to pin the *decisions*, not to prove the edge
 * finder survives a cluttered desk. Where a test needs detection to fail, it
 * takes the card away rather than making it subtle.
 */
function frameWithCard(options: CardOptions = {}) {
  const {
    card = GUIDE,
    background = 30,
    cardLuma = 210,
    tilt = 0,
    texture = false,
  } = options

  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4)

  const cx = card.left + card.width / 2
  const cy = card.top + card.height / 2
  const radians = (-tilt * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      // Rotate the sample point back into the card's own frame, so the painted
      // rectangle really is rotated rather than merely re-bounded.
      const dx = x - cx
      const dy = y - cy
      const ux = cx + dx * cos - dy * sin
      const uy = cy + dx * sin + dy * cos

      const inside = ux >= card.left && ux <= card.left + card.width
        && uy >= card.top && uy <= card.top + card.height

      let value = inside ? cardLuma : background

      if (inside && texture && Math.floor(ux / 3) % 2 === 0 && Math.floor(uy / 4) % 2 === 0) {
        value = 40
      }

      const offset = (y * WIDTH + x) * 4
      data[offset] = value
      data[offset + 1] = value
      data[offset + 2] = value
      data[offset + 3] = 255
    }
  }

  return toGray({ data, width: WIDTH, height: HEIGHT })
}

function flatFrame(luma: number) {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(255)

  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    data[i * 4] = luma
    data[i * 4 + 1] = luma
    data[i * 4 + 2] = luma
  }

  return toGray({ data, width: WIDTH, height: HEIGHT })
}

/** A sample that passes every gate, so each test can spoil exactly one thing. */
function goodSample(overrides: Partial<ScanSample> = {}): ScanSample {
  return {
    brightness: 140,
    glare: 0,
    box: { ...GUIDE },
    confidence: 0.9,
    tilt: 0,
    coverage: 0.95,
    offset: 0.01,
    contained: true,
    sharpness: 400,
    motion: 0.005,
    ...overrides,
  }
}

describe('pixel measurements', () => {
  it('reads brightness and glare off the region it was given', () => {
    expect(regionLuma(flatFrame(20), GUIDE).brightness).toBeCloseTo(20, 0)
    expect(regionLuma(flatFrame(255), GUIDE).glare).toBe(1)
    expect(regionLuma(flatFrame(120), GUIDE).glare).toBe(0)
  })

  it('separates a textured frame from a flat one by focus', () => {
    const flat = laplacianVariance(flatFrame(160))
    const detailed = laplacianVariance(frameWithCard({ texture: true }))

    expect(flat).toBeLessThan(SCAN_THRESHOLDS.minSharpness)
    expect(detailed).toBeGreaterThan(SCAN_THRESHOLDS.minSharpness)
  })
})

describe('locating the card', () => {
  it('finds a card that fills the guide', () => {
    const scene = analyseScene(frameWithCard(), GUIDE)

    expect(scene.box).not.toBeNull()
    expect(scene.confidence).toBeGreaterThanOrEqual(SCAN_THRESHOLDS.minConfidence)
    expect(scene.contained).toBe(true)
    expect(scene.coverage).toBeGreaterThan(0.85)
    expect(scene.offset).toBeLessThan(SCAN_THRESHOLDS.maxOffset)
  })

  it('reports no card when there is nothing in the frame', () => {
    const scene = analyseScene(flatFrame(150), GUIDE)

    expect(scene.box).toBeNull()
    expect(scene.confidence).toBeLessThan(SCAN_THRESHOLDS.minConfidence)
  })

  it('measures a small card as low coverage rather than as no card', () => {
    const small: Rect = { left: 92, top: 70, width: 76, height: 48 }
    const scene = analyseScene(frameWithCard({ card: small }), GUIDE)

    expect(scene.box).not.toBeNull()
    expect(scene.coverage).toBeLessThan(SCAN_THRESHOLDS.minCoverage)
  })

  it('notices a card that runs off the guide', () => {
    const oversized: Rect = { left: 10, top: 14, width: 240, height: 152 }
    const scene = analyseScene(frameWithCard({ card: oversized }), GUIDE)

    expect(scene.contained).toBe(false)
  })

  it('measures rotation, and calls a square-on card straight', () => {
    const straight = analyseScene(frameWithCard(), GUIDE)
    const tilted = analyseScene(frameWithCard({ tilt: 12 }), GUIDE)

    expect(Math.abs(straight.tilt)).toBeLessThan(SCAN_THRESHOLDS.maxTilt)
    expect(Math.abs(tilted.tilt)).toBeGreaterThan(SCAN_THRESHOLDS.maxTilt)
  })
})

describe('stability', () => {
  it('withholds a reading until it has seen enough frames', () => {
    const tracker = createStabilityTracker(7)

    tracker.push({ ...GUIDE })
    tracker.push({ ...GUIDE })

    expect(tracker.motion()).toBeNull()
  })

  it('scores a held card as still and a drifting one as moving', () => {
    const still = createStabilityTracker(7)
    const drifting = createStabilityTracker(7)

    for (let i = 0; i < 7; i++) {
      still.push({ ...GUIDE })
      drifting.push({ ...GUIDE, left: GUIDE.left + i * 4 })
    }

    expect(still.motion()).toBeLessThan(SCAN_THRESHOLDS.maxMotion)
    expect(drifting.motion()).toBeGreaterThan(SCAN_THRESHOLDS.maxMotion)
  })

  it('forgets everything when the card leaves the frame', () => {
    const tracker = createStabilityTracker(3)

    tracker.push({ ...GUIDE })
    tracker.push({ ...GUIDE })
    tracker.push(null)

    expect(tracker.motion()).toBeNull()
  })
})

describe('what the donor is told', () => {
  it('clears the shutter only when everything holds at once', () => {
    const guidance = evaluateScan(goodSample())

    expect(guidance.code).toBe('ready')
    expect(guidance.ready).toBe(true)
  })

  it.each<[string, Partial<ScanSample>, string]>([
    ['a dark room', { brightness: 40 }, 'dark'],
    ['an empty frame', { box: null, confidence: 0 }, 'no_document'],
    ['a distant card', { coverage: 0.3 }, 'too_far'],
    ['a card over the edge', { contained: false }, 'outside'],
    ['a card spilling out', { coverage: 1.6 }, 'outside'],
    ['an off-centre card', { offset: 0.2 }, 'off_centre'],
    ['a tilted card', { tilt: 14 }, 'tilted'],
    ['glare across the print', { glare: 0.3 }, 'glare'],
    ['a moving hand', { motion: 0.2 }, 'unsteady'],
    ['an out-of-focus lens', { sharpness: 10 }, 'unsteady'],
  ])('turns %s into %s', (_case, overrides, code) => {
    const guidance = evaluateScan(goodSample(overrides))

    expect(guidance.code).toBe(code)
    expect(guidance.ready).toBe(false)
    expect(guidance.message).toMatch(/\S/)
  })

  it('reports darkness rather than a missing card when both are true', () => {
    // Detection cannot work in the dark, so "position your ID inside the frame"
    // would be advice about a camera that was already aimed correctly.
    expect(evaluateScan(goodSample({ brightness: 30, box: null, confidence: 0 })).code).toBe('dark')
  })

  it('never fires before stability has a reading', () => {
    expect(evaluateScan(goodSample({ motion: null })).ready).toBe(false)
  })
})

describe('judging the captured still', () => {
  it('passes a clean capture', () => {
    const verdict = assessCapture({ brightness: 150, glare: 0.01, sharpness: 300, detected: true })

    expect(verdict.level).toBe('ok')
  })

  it.each<['dark' | 'blurry' | 'glare', Parameters<typeof assessCapture>[0]]>([
    ['dark', { brightness: 20, glare: 0, sharpness: 300, detected: true }],
    ['blurry', { brightness: 150, glare: 0, sharpness: 5, detected: true }],
    ['glare', { brightness: 200, glare: 0.5, sharpness: 300, detected: true }],
  ])('blocks a %s capture and says why', (code, capture) => {
    const verdict = assessCapture(capture)

    expect(verdict.code).toBe(code)
    expect(verdict.level).toBe('error')
    expect(verdict.message).toMatch(/\S/)
  })

  it('warns rather than blocks when only the edges were missed', () => {
    // The manual shutter exists for frames detection cannot read. Refusing them
    // outright would leave a donor whose phone the detector dislikes with no
    // way to submit an ID at all.
    const verdict = assessCapture({ brightness: 150, glare: 0.01, sharpness: 300, detected: false })

    expect(verdict.code).toBe('undetected')
    expect(verdict.level).toBe('warning')
  })

  it('is looser than the live gates, so a frame that fired can still be sent', () => {
    const verdict = assessCapture({
      brightness: SCAN_THRESHOLDS.minBrightness,
      glare: SCAN_THRESHOLDS.maxGlare,
      sharpness: SCAN_THRESHOLDS.minSharpness,
      detected: true,
    })

    expect(verdict.level).toBe('ok')
  })
})
