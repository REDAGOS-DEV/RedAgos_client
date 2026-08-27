/**
 * Nuxt serializes SSR console output into the development payload. HTTP client
 * errors may contain Response/Request instances, which devalue cannot encode.
 * Keep the useful diagnostics while reducing errors to serializable fields.
 */
export default definePayloadPlugin(() => {
  definePayloadReducer('AppError', (value: unknown) => {
    if (!(value instanceof Error)) return

    const error = value as Error & { status?: unknown }

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      status: typeof error.status === 'number' ? error.status : undefined,
    }
  })

  definePayloadReviver('AppError', (value) => {
    const error = new Error(value.message)
    error.name = value.name
    error.stack = value.stack

    if (typeof value.status === 'number') {
      ;(error as Error & { status?: number }).status = value.status
    }

    return error
  })
})
