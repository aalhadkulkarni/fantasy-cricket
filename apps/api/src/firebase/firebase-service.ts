/**
 * The Firebase Realtime Database backend, on the server.
 *
 * **What this service does with an environment is turn it into a path prefix.**
 * The four environments are four roots inside one database with identical
 * structure beneath each, so `local`, `test`, `preprod` and `prod` are
 * literally the first segment of every path.
 *
 * **Every Firebase import in the service is in this folder.** Nothing above it
 * touches the SDK, and no Firebase-shaped value crosses out of it — which is
 * why `database` is private, and why `read` unwraps its snapshot rather than
 * returning one.
 *
 * ---
 *
 * **This is the Admin SDK, not the browser one.** It authenticates as the
 * service account and ignores the security rules, which is what lets the
 * rules deny everything to clients. The cost is that nothing here is guarded
 * by the database: every check is one this code performs, which is the whole
 * reason the data layer exists.
 *
 * **No auth and no subscriptions.** Signing in is the browser's job, and lives
 * in `apps/web/src/data-layer/firebase/firebase-auth.ts`. Listeners are the
 * browser's too, for the live auction, and it reads those nodes directly.
 *
 * **This is a client, not an `Api`.** It knows about paths, snapshots and
 * multi-path updates, none of which a REST backend has. A path *is* the
 * schema, and the fifth boundary rule says the schema never crosses upward.
 */

import {
  getDatabase,
  ServerValue,
  type Database,
} from 'firebase-admin/database'

import { DataLayerError, type Environment } from '@fantasy-cricket/shared'

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
 * Maps a Firebase error onto something a caller can act on, keeping the
 * original as `cause`.
 */
function asDataLayerError(action: string, cause: unknown): DataLayerError {
  const raw = cause instanceof Error ? cause.message : String(cause)

  if (raw.includes('permission_denied') || raw.includes('PERMISSION_DENIED')) {
    return new DataLayerError(
      'forbidden',
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

  return new DataLayerError('internal', `${action} failed: ${raw}`, cause)
}

export class FirebaseService {
  /** What this service was constructed for. Fixed for its life. */
  readonly environment: Environment

  /** The first segment of every path. The environment, literally. */
  readonly root: Environment

  readonly #database: Database

  /**
   * **The app is initialised once at startup**, in `index.ts`, with the
   * service account this deployment runs as. This takes the default one
   * rather than creating its own, so a second service never appears.
   */
  constructor(environment: Environment) {
    this.environment = environment
    this.root = environment
    this.#database = getDatabase()
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
          'internal',
          `firebase: empty path segment in path(${segments.join(', ')})`,
        )
      }
      if (ILLEGAL_IN_KEY.test(segment)) {
        throw new DataLayerError(
          'internal',
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
      const snapshot = await this.#database.ref(path).get()
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
      await this.#database.ref(path).set(value)
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
          'internal',
          `firebase: update path "${key}" is not under the active root ` +
            `"${this.root}". Build every path with path() or the builders in ` +
            `paths.ts.`,
        )
      }
    }

    try {
      await this.#database.ref().update(changes)
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
      await this.#database.ref(path).remove()
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
    const key = this.#database.ref().push().key
    if (key === null) {
      throw new DataLayerError('internal', 'firebase: could not generate a key')
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
      const result = await this.#database
        .ref(path)
        .transaction((current: unknown) => {
          // Returning undefined aborts the transaction, leaving what is there.
          if (current !== null) return undefined
          return value
        })
      return result.committed
    } catch (cause) {
      throw asDataLayerError(`claiming ${path}`, cause)
    }
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
    return ServerValue.TIMESTAMP
  }
}
