/**
 * **Live reads, straight from the database.** The browser's only database
 * access, and read-only.
 *
 * Everything else goes through the service. The live auction is the
 * exception because it changes several times a second for everyone watching,
 * and a listener on the database is what delivers that. **Writes never come
 * here**: a bid, a sell and every auctioneer action still go through the
 * service, and the database rules allow the browser exactly one thing —
 * reading `liveAuctions/<leagueId>` while signed in. `/liveAuctions` itself
 * stays closed, so nobody can list every league's auction.
 *
 * **Loaded only when first used.** The database SDK is a large module, and
 * every page except the auction does without it, so it is imported
 * dynamically and lands in a chunk of its own.
 *
 * **No Firebase type leaves this file.** Callers receive plain values and an
 * unsubscribe function, exactly as the contract's subscription shape says.
 */

// Types only: erased at build, so they do not pull the SDK into the main
// bundle. The SDK itself arrives through the dynamic import below.
import type { Database } from 'firebase/database'
import type * as DatabaseSdk from 'firebase/database'

import {
  DataLayerError,
  type Subscriber,
  type SubscriptionErrorHandler,
  type Unsubscribe,
} from '@fantasy-cricket/shared'

import { activeEnvironment } from '../api'
import { firebaseApp } from './firebase-auth'

type DatabaseModule = typeof DatabaseSdk

/** Imported once, on first use. Hot reload re-runs this module; that is fine. */
let loading: Promise<{ sdk: DatabaseModule; database: Database }> | undefined

function connect(): Promise<{ sdk: DatabaseModule; database: Database }> {
  loading ??= import('firebase/database').then((sdk) => ({
    sdk,
    database: sdk.getDatabase(firebaseApp()),
  }))
  return loading
}

/**
 * A path beneath this session's environment root, built from segments so no
 * caller spells out a root by hand. The same rule the service follows.
 */
function rooted(segments: readonly string[]): string {
  return [activeEnvironment(), ...segments].join('/')
}

function asError(cause: unknown, what: string): Error {
  return new DataLayerError(
    'unavailable',
    `listening to ${what} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    cause,
  )
}

/**
 * **Every change to one value**, starting with its current state.
 *
 * Absent arrives as `undefined` rather than as an error — a live auction that
 * has not been started is the normal state for weeks.
 *
 * Returns synchronously, as a `useEffect` cleanup needs, even though the SDK
 * is still loading: an unsubscribe before it arrives means it never attaches.
 */
export function listenToValue<T>(
  segments: readonly string[],
  callback: Subscriber<T | undefined>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  let detach: (() => void) | undefined
  let cancelled = false
  const path = rooted(segments)

  void connect()
    .then(({ sdk, database }) => {
      if (cancelled) return
      detach = sdk.onValue(
        sdk.ref(database, path),
        (snapshot) => {
          callback(snapshot.exists() ? (snapshot.val() as T) : undefined)
        },
        (cause) => onError?.(asError(cause, path)),
      )
    })
    .catch((cause: unknown) => onError?.(asError(cause, path)))

  return () => {
    cancelled = true
    detach?.()
  }
}

/**
 * **One read, no listening.** For data wanted on demand rather than kept live —
 * one player's bidding history, opened from a list. Absent comes back as
 * `undefined`.
 */
export async function readValue<T>(
  segments: readonly string[],
): Promise<T | undefined> {
  const path = rooted(segments)
  try {
    const { sdk, database } = await connect()
    const snapshot = await sdk.get(sdk.ref(database, path))
    return snapshot.exists() ? (snapshot.val() as T) : undefined
  } catch (cause) {
    throw asError(cause, path)
  }
}

/**
 * **Each child added under a node, in key order**, including those already
 * there when listening starts. Push keys sort by creation time, so this is
 * arrival order — what a timeline needs.
 */
export function listenToChildrenAdded<T>(
  segments: readonly string[],
  callback: Subscriber<T>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  let detach: (() => void) | undefined
  let cancelled = false
  const path = rooted(segments)

  void connect()
    .then(({ sdk, database }) => {
      if (cancelled) return
      detach = sdk.onChildAdded(
        sdk.query(sdk.ref(database, path), sdk.orderByKey()),
        (snapshot) => callback(snapshot.val() as T),
        (cause) => onError?.(asError(cause, path)),
      )
    })
    .catch((cause: unknown) => onError?.(asError(cause, path)))

  return () => {
    cancelled = true
    detach?.()
  }
}

/**
 * **How far this device's clock is from the database's, in milliseconds.**
 * The countdown is computed against server time, never the local clock: add
 * this to `Date.now()` for the server's idea of now.
 *
 * At the database root rather than under the environment — `.info` is the
 * connection's own information, not data.
 */
export function listenToServerTimeOffset(
  callback: Subscriber<number>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  let detach: (() => void) | undefined
  let cancelled = false

  void connect()
    .then(({ sdk, database }) => {
      if (cancelled) return
      detach = sdk.onValue(
        sdk.ref(database, '.info/serverTimeOffset'),
        (snapshot) => {
          const offset: unknown = snapshot.val()
          callback(typeof offset === 'number' ? offset : 0)
        },
        (cause) => onError?.(asError(cause, 'the server clock')),
      )
    })
    .catch((cause: unknown) => onError?.(asError(cause, 'the server clock')))

  return () => {
    cancelled = true
    detach?.()
  }
}
