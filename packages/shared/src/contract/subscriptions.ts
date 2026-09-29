/**
 * The shared shape of every subscription in the data layer.
 *
 * **Shared because the `Api` interface names them**, and both sides compile
 * against that interface. Only the browser implements one today: the auth
 * listener, which never crosses HTTP. The live auction will add more, reading
 * the database directly for the same reason.
 *
 * The two decisions recorded here are unchanged: a separate optional error
 * callback rather than `(error, data)`, and a returned handle rather than a
 * matching `off`, because that is what a `useEffect` cleanup expects.
 */

/** Detaches the listener. RTDB listeners leak if this is never called. */
export type Unsubscribe = () => void

/** Receives each update. Called again on every change, not once. */
export type Subscriber<T> = (data: T) => void

/** Receives a permission denial or a lost connection. */
export type SubscriptionErrorHandler = (error: Error) => void
