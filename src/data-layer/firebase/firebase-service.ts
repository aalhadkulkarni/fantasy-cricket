/**
 * The Firebase Realtime Database backend.
 *
 * **What this service does with an environment is turn it into a path prefix.**
 * The four environments are four roots inside one database with identical
 * structure beneath each, so `local`, `test`, `preprod` and `prod` are
 * literally the first segment of every path. A REST service would take the same
 * value and produce a base hostname instead; neither translation belongs
 * outside its own service.
 *
 * **Every Firebase import in the app is in this folder**, which is rule 2 of the
 * boundary. Nothing above the data layer touches the SDK, and no
 * Firebase-shaped value crosses out of it — which is why `app` and `database`
 * are private, and why `read` unwraps its snapshot rather than returning one.
 *
 * ---
 *
 * **These primitives are Firebase's own and stay here.** `ApiService` carries
 * operations — `getLeague`, `acceptJoinRequest` — because those have a REST
 * implementation. `update({path: value})` does not: accepting a join request is
 * one multi-path write here and one POST there, with the server doing both
 * writes itself. A path *is* the schema, and the fifth boundary rule says the
 * schema never crosses upward.
 *
 * ---
 *
 * ## TODO — most of the layer's functions have no bodies yet
 *
 * As each gets implemented it moves onto `ApiService` and reaches these methods
 * through the Firebase implementation of it. Identity is the first area with
 * real bodies.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User as FirebaseAuthUser,
} from 'firebase/auth'
import {
  get,
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type Database,
} from 'firebase/database'

import type { Environment } from '@/config/environments'
import { FIREBASE_CONFIG } from '@/config/firebase'
import type { ApiService } from '../api-service'
import { getApiService } from '../api-service'
import { DataLayerError } from '../data-layer-error'
import type {
  Subscriber,
  SubscriptionErrorHandler,
  Unsubscribe,
} from '../subscriptions'

/** Forbidden in an RTDB key. A `/` is included because it would nest silently. */
const ILLEGAL_IN_KEY = /[/.$#[\]]/

declare const dbPathBrand: unique symbol

/**
 * A path beneath the active environment root.
 *
 * **Only `FirebaseService.path()` can produce one**, which is what makes the
 * environment impossible to bypass rather than merely easy to remember. Without
 * the brand every method here would take a plain string, and `read('leagues/x')`
 * would compile and address a path outside every root — the exact failure the
 * environment module exists to prevent.
 *
 * Branding works in parameter position. It does *not* work for the keys of a
 * record, which is the limit recorded in `src/types/ids.ts`, so `update`
 * validates its keys at runtime instead.
 */
export type DbPath = string & { readonly [dbPathBrand]: 'DbPath' }

/**
 * What the layer knows about whoever is signed in, with nothing
 * Firebase-shaped in it.
 *
 * A `User` from `firebase/auth` is as backend-specific as a `DataSnapshot`, so
 * it is unwrapped here rather than handed upward. Rule 2.
 */
export interface AuthSession {
  /** The Firebase Auth UID. This is the key `users/` is stored under. */
  uid: string

  /** Absent if the Google account has no email, which is rare but possible. */
  email: string | undefined

  /**
   * The Google account id — the `sub` claim, from `providerData`.
   *
   * Stored on the user record as insurance and never read afterwards. If the
   * Firebase project were deleted, it is the only thing that could say which
   * person a `uid` belonged to.
   */
  googleSubjectId: string | undefined

  /** Google's `photoURL`. Absent when the account has no picture. */
  photoUrl: string | undefined
}

/**
 * Why a sign-in did not complete.
 *
 * **Only `blocked` is a failure.** `dismissed` means the person changed their
 * mind, and rendering "sign-in failed" for that would be wrong. `superseded`
 * means a second popup replaced the first and nothing should be shown at all.
 */
export type SignInOutcome = 'signedIn' | 'dismissed' | 'superseded' | 'blocked'

/**
 * Maps a Firebase error onto something a caller can act on, keeping the
 * original as `cause`.
 */
function asDataLayerError(action: string, cause: unknown): DataLayerError {
  const raw = cause instanceof Error ? cause.message : String(cause)

  if (raw.includes('permission_denied') || raw.includes('PERMISSION_DENIED')) {
    return new DataLayerError(
      'permissionDenied',
      `${action} was refused by the database rules`,
      cause,
    )
  }

  if (raw.includes('network') || raw.includes('unavailable')) {
    return new DataLayerError(
      'unavailable',
      `${action} could not reach the database`,
      cause,
    )
  }

  return new DataLayerError('unknown', `${action} failed: ${raw}`, cause)
}

export class FirebaseService implements ApiService {
  readonly kind = 'firebase' as const

  /** What this service was constructed for. Fixed for its life. */
  readonly environment: Environment

  /** The first segment of every path. The environment, literally. */
  readonly root: Environment

  /** Private so nothing outside can reach the SDK. Rule 2. */
  readonly #app: FirebaseApp
  readonly #database: Database
  readonly #auth: Auth

  constructor(environment: Environment) {
    /*
      Refuse rather than let the SDK guess. With no `databaseURL` it does not
      fail: it assumes `https://{projectId}-default-rtdb.firebaseio.com`, the
      default US region. This database is in `asia-southeast1`, so that guess is
      wrong and every read would go quietly nowhere. Same reasoning as an
      unmapped hostname in `environments.ts`.
    */
    if (FIREBASE_CONFIG.databaseURL === '') {
      throw new DataLayerError(
        'unknown',
        'firebase: databaseURL is empty in src/config/firebase.ts. Copy it from ' +
          'the Realtime Database in the Firebase console. Leaving it empty is ' +
          'deliberate: the SDK would otherwise guess a US-region URL, which is ' +
          'wrong for this project.',
      )
    }

    this.environment = environment
    this.root = environment
    this.#app = initializeApp(FIREBASE_CONFIG)
    this.#database = getDatabase(this.#app)
    this.#auth = getAuth(this.#app)
  }

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  /**
   * Unwraps a Firebase auth user into something that can cross the boundary.
   *
   * The Google subject is `providerData`'s `uid` for the Google provider, which
   * is a different value from the Firebase UID above it. That distinction is
   * the whole reason this field exists.
   */
  #toSession(user: FirebaseAuthUser): AuthSession {
    const google = user.providerData.find(
      (p) => p.providerId === GoogleAuthProvider.PROVIDER_ID,
    )

    return {
      uid: user.uid,
      email: user.email ?? undefined,
      googleSubjectId: google?.uid ?? undefined,
      photoUrl: user.photoURL ?? undefined,
    }
  }

  /**
   * Fires with the current session, then again on every change.
   *
   * **It has not fired yet when the app first renders**, and that gap is real:
   * restoring an existing session is asynchronous. Treating "not fired" as
   * "signed out" makes every visit flash the login page before redirecting.
   * Callers must distinguish the two.
   */
  onAuthChanged(callback: Subscriber<AuthSession | undefined>): Unsubscribe {
    return onAuthStateChanged(this.#auth, (user) => {
      callback(user === null ? undefined : this.#toSession(user))
    })
  }

  /** The session right now, without waiting. Undefined before it has resolved. */
  currentSession(): AuthSession | undefined {
    const user = this.#auth.currentUser
    return user === null ? undefined : this.#toSession(user)
  }

  /**
   * Opens the Google sign-in popup and reports what happened.
   *
   * **Returns an outcome rather than throwing**, because two of the three
   * non-success cases are not errors. Someone closing the popup changed their
   * mind; a superseded popup is noise. Only a blocked popup needs saying out
   * loud, and only because nothing on screen explains it.
   *
   * Popup rather than redirect: `signInWithRedirect` breaks on browsers that
   * partition third-party storage unless the auth handler is self-hosted, which
   * makes it the more fragile choice on a product used mostly on phones.
   *
   * Anything genuinely unexpected still throws.
   */
  async signInWithGoogle(): Promise<SignInOutcome> {
    try {
      await signInWithPopup(this.#auth, new GoogleAuthProvider())
      return 'signedIn'
    } catch (cause) {
      switch ((cause as { code?: string }).code) {
        case 'auth/popup-closed-by-user':
          return 'dismissed'
        case 'auth/cancelled-popup-request':
          return 'superseded'
        case 'auth/popup-blocked':
          return 'blocked'
        default:
          throw asDataLayerError('signing in', cause)
      }
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.#auth)
    } catch (cause) {
      throw asDataLayerError('signing out', cause)
    }
  }

  // -------------------------------------------------------------------------
  // Paths
  // -------------------------------------------------------------------------

  /**
   * Builds a path beneath the root: `path('leagues', leagueId)` gives
   * `local/leagues/{leagueId}`.
   *
   * Segments are validated because one carrying a `/` would silently produce
   * extra nesting rather than an error, which is the wrong-root problem one
   * level down.
   */
  path(...segments: readonly string[]): DbPath {
    for (const segment of segments) {
      if (segment === '') {
        throw new DataLayerError(
          'unknown',
          `firebase: empty path segment in path(${segments.join(', ')})`,
        )
      }
      if (ILLEGAL_IN_KEY.test(segment)) {
        throw new DataLayerError(
          'unknown',
          `firebase: path segment "${segment}" contains a character that is ` +
            `not allowed in a database key`,
        )
      }
    }

    return [this.root, ...segments].join('/') as DbPath
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /**
   * One value, or `undefined` if nothing is there.
   *
   * **Never an empty object for a missing node.** Absence is meaningful all
   * over this model — a league with no members, an auction that has not
   * started — and the two must stay distinguishable.
   *
   * **`T` is an assertion, not a guarantee.** Firebase returns whatever is
   * actually stored and nothing here validates it. That is the honest limit of
   * the type system at this boundary; runtime validation is a separate
   * decision.
   */
  async read<T>(path: DbPath): Promise<T | undefined> {
    try {
      const snapshot = await get(ref(this.#database, path))
      // Unwrapped here so no DataSnapshot escapes. Rule 2.
      return snapshot.exists() ? (snapshot.val() as T) : undefined
    } catch (cause) {
      throw asDataLayerError(`reading ${path}`, cause)
    }
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  /** Replaces whatever is at the path. Everything beneath it is discarded. */
  async write(path: DbPath, value: unknown): Promise<void> {
    try {
      await set(ref(this.#database, path), value)
    } catch (cause) {
      throw asDataLayerError(`writing ${path}`, cause)
    }
  }

  /**
   * **The atomic multi-path write.** Every path lands or none does.
   *
   * The model depends on this in at least eight places: archiving a league,
   * accepting a join request, selling a player, accepting a transfer, deleting
   * a league, writing both points index orders, handing off the auctioneer, and
   * recomputing a tournament's dates. Each is several nodes that must never be
   * observed half-written.
   *
   * **Keys are checked at runtime, not by the type system.** A branded key type
   * would not help: two records with different key brands are mutually
   * assignable, which is the limit verified in `src/types/ids.ts`. So a key
   * outside the active root is rejected here.
   */
  async update(changes: Readonly<Record<string, unknown>>): Promise<void> {
    const prefix = `${this.root}/`

    for (const key of Object.keys(changes)) {
      if (!key.startsWith(prefix)) {
        throw new DataLayerError(
          'unknown',
          `firebase: update path "${key}" is not under the active root ` +
            `"${this.root}". Build every path with path() or the builders in ` +
            `paths.ts.`,
        )
      }
    }

    try {
      await update(ref(this.#database), changes)
    } catch (cause) {
      throw asDataLayerError(
        `updating ${Object.keys(changes).length} paths`,
        cause,
      )
    }
  }

  /** Deletes the node and everything beneath it. */
  async remove(path: DbPath): Promise<void> {
    try {
      await remove(ref(this.#database, path))
    } catch (cause) {
      throw asDataLayerError(`removing ${path}`, cause)
    }
  }

  // -------------------------------------------------------------------------
  // Keys and claims
  // -------------------------------------------------------------------------

  /**
   * A new push key, generated locally with no network call.
   *
   * No argument, because a push key does not depend on where it is stored.
   * Generating offline is what makes it usable inside `update`: the ids have to
   * exist before the update object can be assembled.
   *
   * Push keys are chronologically sortable and unique without coordination,
   * which is why nothing in this model needs a counter.
   */
  generateKey(): string {
    const key = push(ref(this.#database)).key
    if (key === null) {
      throw new DataLayerError('unknown', 'firebase: could not generate a key')
    }
    return key
  }

  /**
   * Writes the value **only if nothing is there**, and reports whether it won.
   *
   * Two things need this, and both would otherwise lose a race: claiming a
   * Google identity at sign-up, and claiming a league join code at creation.
   * Reading first and then writing does not work — two tabs both read nothing,
   * both pass the check, and both write.
   *
   * Deliberately narrower than a general transaction. Both real uses are this
   * exact pattern, and a general primitive with no caller would mean inventing
   * a shape. Built on `runTransaction`, so widening it later is small.
   */
  async claim(path: DbPath, value: unknown): Promise<boolean> {
    try {
      const result = await runTransaction(
        ref(this.#database, path),
        (current: unknown) => {
          // Returning undefined aborts the transaction, leaving what is there.
          if (current !== null) return undefined
          return value
        },
      )
      return result.committed
    } catch (cause) {
      throw asDataLayerError(`claiming ${path}`, cause)
    }
  }

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------

  /**
   * Fires on every change at the path, and once immediately with what is there.
   *
   * **Returns an unsubscribe handle**, which is what a `useEffect` cleanup
   * expects. RTDB listeners leak if it is never called.
   *
   * Errors go to a separate callback rather than a first argument on the data
   * one, so a handler that only cares about data is not carrying a parameter it
   * always ignores. Both of those were the open decisions in `subscriptions.ts`.
   */
  subscribe<T>(
    path: DbPath,
    onData: Subscriber<T>,
    onError?: SubscriptionErrorHandler,
  ): Unsubscribe {
    return onValue(
      ref(this.#database, path),
      (snapshot) => {
        // Same unwrapping as `read`. No DataSnapshot escapes.
        onData((snapshot.exists() ? snapshot.val() : undefined) as T)
      },
      (cause) => {
        onError?.(asDataLayerError(`subscribing to ${path}`, cause))
      },
    )
  }

  // -------------------------------------------------------------------------
  // Server time
  // -------------------------------------------------------------------------

  /**
   * A write-only sentinel the server replaces with its own clock.
   *
   * Used for every stored instant, so timestamps do not depend on whichever
   * device happened to write them. It has no value until it is written, which
   * is why the return type says nothing useful.
   *
   * NOT the auction countdown. That needs `.info/serverTimeOffset`, which is a
   * different thing and is not built yet.
   */
  serverTimestamp(): unknown {
    return serverTimestamp()
  }
}

/**
 * The active service, when it is a Firebase one.
 *
 * Throws if the session was set up against a different backend, which is the
 * correct answer rather than a cast that quietly lies.
 */
export function getFirebaseService(): FirebaseService {
  const service = getApiService()
  if (!(service instanceof FirebaseService)) {
    throw new DataLayerError(
      'unknown',
      `firebase: the active API service is "${service.kind}", not Firebase`,
    )
  }
  return service
}
