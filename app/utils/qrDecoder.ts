/**
 * Reading a QR code off a live camera frame.
 *
 * This is deliberately the only place that knows *how* a frame becomes a
 * string. The scanner component asks for a decoder and gets one, or gets told
 * the browser cannot do it — it never reaches for an API itself.
 *
 * Today the only backend is the browser's own BarcodeDetector, which covers
 * Chrome, Edge and Android WebView. Safari and Firefox do not ship it, and
 * those browsers currently fall through to `null`, which the scanner surfaces
 * as "use the donor's ID instead" rather than a broken camera.
 *
 * To widen that: `npm install jsqr`, then add a branch to `createQrDecoder()`
 * that imports it and reads `ImageData` off a `willReadFrequently` canvas. The
 * `QrDecoder` shape below is the whole contract, and nothing outside this file
 * needs to change.
 */

/**
 * A frame to read — in practice the `<video>` element the scanner previews into.
 *
 * Declared structurally rather than as the DOM's `CanvasImageSource` for the
 * same reason `idDocumentScanner.ts` declares its own frame shape: nothing here
 * inspects the source, it only forwards it, and a structural type keeps this
 * module testable without a browser.
 */
export type QrFrameSource = object

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

function barcodeDetectorCtor(): BarcodeDetectorConstructor | null {
  if (!import.meta.client) return null

  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector

  return typeof ctor === 'function' ? ctor : null
}

/**
 * Whether this browser can decode a QR code at all.
 *
 * Checked before the camera is opened, so a browser that cannot scan says so
 * instead of showing a live preview that will never resolve to anything.
 */
export async function isQrDecodingSupported(): Promise<boolean> {
  const ctor = barcodeDetectorCtor()

  if (!ctor) return false

  // Having the constructor is not the same as supporting QR specifically —
  // some builds ship it with only linear formats.
  try {
    const formats = await ctor.getSupportedFormats?.()

    return !formats || formats.includes('qr_code')
  } catch {
    return false
  }
}

/**
 * Build a decoder for this browser, or null if none is available.
 */
export async function createQrDecoder(): Promise<QrDecoder | null> {
  const ctor = barcodeDetectorCtor()

  if (!ctor || !(await isQrDecodingSupported())) return null

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
 * Say what a donor-facing caller can do when decoding is unavailable.
 */
export const QR_UNSUPPORTED_MESSAGE
  = 'This browser cannot scan QR codes. Use Chrome or Edge, or look the donor up by their valid ID instead.'
