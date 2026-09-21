/**
 * Reading a QR code off a live camera frame.
 *
 * This is deliberately the only place that knows *how* a frame becomes a
 * string. The scanner component asks for a decoder and gets one, or gets told
 * the browser cannot do it — it never reaches for an API itself.
 *
 * Two backends, tried in this order:
 *
 *  1. The browser's own BarcodeDetector, where it exists. Native, costs almost
 *     nothing per frame, and reads at full resolution. It is also far rarer
 *     than "Chromium ships it" suggests: Chrome and Edge only expose it where
 *     the operating system supplies the detector — Android, ChromeOS and
 *     macOS. On Windows and Linux desktop it is absent even in current Chrome,
 *     and Safari and Firefox do not ship it anywhere.
 *  2. jsQR, a pure-JS decoder, everywhere else. Loaded on demand so its weight
 *     only reaches staff who actually open the scanner. This is the path a
 *     Windows counter PC takes, which makes it the common case here, not the
 *     fallback.
 *
 * Both satisfy the `QrDecoder` contract below and nothing outside this file
 * knows which one answered.
 */

/**
 * The longest edge jsQR is given to work with.
 *
 * jsQR is synchronous and its cost scales with pixel count, so a full 1280px
 * frame would block the main thread long enough to stutter the preview the
 * staff member is aiming with. A QR held up to a counter webcam is still read
 * comfortably at this width. BarcodeDetector is native and skips this entirely.
 */
const JSQR_MAX_WIDTH = 640

/**
 * A frame to read — in practice the `<video>` element the scanner previews into.
 *
 * Declared structurally rather than as the DOM's `CanvasImageSource` for the
 * same reason `idDocumentScanner.ts` declares its own frame shape: the lint
 * config here does not load DOM *type* globals, and a structural type keeps
 * this module testable without a browser. The dimensions are what the jsQR path
 * needs to size its canvas; BarcodeDetector only forwards the source untouched.
 */
export interface QrFrameSource {
  readonly videoWidth?: number
  readonly videoHeight?: number
  readonly width?: number
  readonly height?: number
}

export interface QrDecoder {
  /** Human-readable name of the decode backend, for diagnostics. */
  readonly backend: string
  /** Read a QR payload from one frame, or null if this frame has none. */
  decode: (source: QrFrameSource) => Promise<string | null>
  /** Release anything the backend is holding. */
  dispose: () => void
}

interface DetectedBarcode {
  rawValue: string
}

interface BarcodeDetectorLike {
  detect: (source: QrFrameSource) => Promise<DetectedBarcode[]>
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

/**
 * The slice of a 2D canvas context the jsQR path uses, declared locally for the
 * same reason as `QrFrameSource`.
 */
interface FrameCanvasContext {
  drawImage: (source: QrFrameSource, dx: number, dy: number, dw: number, dh: number) => void
  getImageData: (sx: number, sy: number, sw: number, sh: number) => { data: Uint8ClampedArray }
}

function barcodeDetectorCtor(): BarcodeDetectorConstructor | null {
  if (!import.meta.client) return null

  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector

  return typeof ctor === 'function' ? ctor : null
}

/**
 * Whether this browser can decode a QR code at all.
 *
 * Since jsQR needs nothing but a canvas, the answer on the client is now always
 * yes. It is kept as a check rather than inlined because the *camera* can still
 * be unavailable — permissions, hardware, an insecure origin — and `start()`
 * reports that separately and differently.
 */
export function isQrDecodingSupported(): Promise<boolean> {
  return Promise.resolve(import.meta.client)
}

/**
 * The native backend, or null where the platform does not provide one.
 */
async function createBarcodeDetectorDecoder(): Promise<QrDecoder | null> {
  const ctor = barcodeDetectorCtor()

  if (!ctor) return null

  // Having the constructor is not the same as supporting QR specifically —
  // some builds ship it with only linear formats.
  try {
    const formats = await ctor.getSupportedFormats?.()

    if (formats && !formats.includes('qr_code')) return null
  } catch {
    return null
  }

  const detector = new ctor({ formats: ['qr_code'] })

  return {
    backend: 'BarcodeDetector',
    async decode(source: QrFrameSource): Promise<string | null> {
      try {
        const results = await detector.detect(source)

        // A frame with no code in it is the normal case, not an error.
        return results?.[0]?.rawValue?.trim() || null
      } catch {
        // A transient decode failure (a frame mid-resize, say) must not kill
        // the scan loop — the next frame usually works.
        return null
      }
    },
    dispose() {
      // BarcodeDetector holds nothing that needs releasing.
    },
  }
}

/**
 * The portable backend: draw the frame to an offscreen canvas and hand the
 * pixels to jsQR.
 */
async function createJsQrDecoder(): Promise<QrDecoder | null> {
  if (!import.meta.client) return null

  let decodeFrame: typeof import('jsqr').default

  try {
    // Imported here rather than at the top of the file so the decoder is only
    // fetched once someone actually opens the scanner.
    const jsqr = await import('jsqr')

    decodeFrame = jsqr.default
  } catch {
    return null
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as FrameCanvasContext | null

  if (!ctx) return null

  return {
    backend: 'jsQR',
    decode(source: QrFrameSource): Promise<string | null> {
      const sourceWidth = source.videoWidth || source.width || 0
      const sourceHeight = source.videoHeight || source.height || 0

      // The scanner already guards on `videoWidth`, but a frame can still
      // arrive mid-resize with nothing in it.
      if (!sourceWidth || !sourceHeight) return Promise.resolve(null)

      const scale = Math.min(1, JSQR_MAX_WIDTH / sourceWidth)
      const width = Math.round(sourceWidth * scale)
      const height = Math.round(sourceHeight * scale)

      // Resizing a canvas clears it, so only touch it when the camera actually
      // changes resolution.
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      try {
        ctx.drawImage(source, 0, 0, width, height)

        const frame = ctx.getImageData(0, 0, width, height)

        // `dontInvert`: a donor's QR is dark-on-light on a phone screen or on
        // paper. Trying the inverted reading as well would double the per-frame
        // cost for a case that does not occur here.
        const code = decodeFrame(frame.data, width, height, { inversionAttempts: 'dontInvert' })

        return Promise.resolve(code?.data?.trim() || null)
      } catch {
        // Same reasoning as the native path: one bad frame is not a broken scan.
        // A tainted canvas would also land here, though a same-origin camera
        // stream does not taint one.
        return Promise.resolve(null)
      }
    },
    dispose() {
      // Let the backing bitmap go rather than holding a full frame for as long
      // as the page lives.
      canvas.width = 0
      canvas.height = 0
    },
  }
}

/**
 * Build a decoder for this browser, or null if none is available.
 */
export async function createQrDecoder(): Promise<QrDecoder | null> {
  return (await createBarcodeDetectorDecoder()) ?? (await createJsQrDecoder())
}

/**
 * Say what a caller can do when decoding is unavailable.
 *
 * Only reachable now if the decoder itself fails to load, so it points at the
 * fallback that always works rather than suggesting another browser.
 */
export const QR_UNSUPPORTED_MESSAGE
  = 'QR scanning could not start in this browser. Look the donor up by their valid ID instead.'
