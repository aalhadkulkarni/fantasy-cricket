/**
 * The shared shape of every subscription in this layer.
 *
 * ---
 *
 * **PROVISIONAL. Two decisions are parked here, both listed as open in the
 * table at the end of `docs/06-data-layer.md`, and neither has been settled.**
 *
 * 1. **Error handling.** A subscription can fail with permission denied or a
 *    dropped connection, and a single data callback has nowhere to report it.
 *    The choice is a combined `(error, data)` callback, or a separate error
 *    callback. Written here as a separate optional error callback, because it
 *    keeps the common case — a handler that only cares about data — free of a
 *    parameter it always ignores.
 * 2. **Unsubscribe.** A returned handle, or a matching `off` call. Written here
 *    as a returned handle, because that is exactly what a `useEffect` cleanup
 *    expects to be given.
 *
 * **Both are placed in this one file on purpose.** Roughly fifteen functions
 * subscribe, and encoding either choice fifteen times would make changing it a
 * refactor. Changing it here is a two-line edit and every subscription follows.
 *
 * Nothing has been built against these yet, so switching costs nothing today.
 */

/** Detaches the listener. RTDB listeners leak if this is never called. */
export type Unsubscribe = () => void

/** Receives each update. Called again on every change, not once. */
export type Subscriber<T> = (data: T) => void

/** Receives a permission denial or a lost connection. */
export type SubscriptionErrorHandler = (error: Error) => void
