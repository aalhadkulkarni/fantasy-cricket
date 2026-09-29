/**
 * What this layer throws.
 *
 * **Backend errors do not cross the boundary.** Firebase throws its own error
 * objects carrying its own codes, and rule 2 says no Firebase-shaped type
 * reaches anything above the data layer. A component catching one would be
 * coupled to the backend it is not supposed to know about.
 *
 * The original is kept as `cause`, so nothing is lost for debugging.
 */

/**
 * Three codes, because those are the three a caller could plausibly act on
 * differently. Anything else is `unknown` and means "this failed, show the
 * error state".
 */
export type DataLayerErrorCode =
  /** The rules refused it. In Phase 1 this should not happen — the rules are
   *  permissive and this layer is the guard. If it does, something is wrong
   *  with the rules rather than with the caller. */
  | 'permissionDenied'
  /** Offline, or the backend is unreachable. Worth retrying. */
  | 'unavailable'
  /** Anything else. Not retryable, and not something a caller can interpret. */
  | 'unknown'

export class DataLayerError extends Error {
  readonly code: DataLayerErrorCode

  constructor(code: DataLayerErrorCode, message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'DataLayerError'
    this.code = code
  }
}
