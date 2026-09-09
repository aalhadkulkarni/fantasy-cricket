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
 * Firebase-shaped value crosses out of it.
 *
 * ---
 *
 * ## TODO — the functions have no bodies yet
 *
 * The app and the database handle are live, but all 143 functions still throw.
 * When they get bodies they reach the handle through `getFirebaseService()`
 * and address it with the builders in `paths.ts`.
 *
 * Auth is not set up either. That arrives with the login story.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getDatabase, type Database } from 'firebase/database'

import type { Environment } from '@/config/environments'
import { FIREBASE_CONFIG } from '@/config/firebase'
import type { ApiService } from '../api-service'
import { getApiService } from '../api-service'

/** Forbidden in an RTDB key. A `/` is included because it would nest silently. */
const ILLEGAL_IN_KEY = /[/.$#[\]]/

export interface FirebaseService extends ApiService {
  readonly kind: 'firebase'

  /** The first segment of every path. The environment, literally. */
  readonly root: Environment

  /** Held so nothing else has to call `initializeApp`. */
  readonly app: FirebaseApp

  /**
   * The database handle. **Not exported above this layer** — it is the most
   * Firebase-shaped object there is, and rule 2 says it stays inside.
   */
  readonly database: Database

  /**
   * Builds a path beneath the root: `path('leagues', leagueId)` gives
   * `local/leagues/{leagueId}`.
   *
   * Segments are validated because one carrying a `/` would silently produce
   * extra nesting rather than an error, which is the wrong-root problem one
   * level down.
   */
  path(...segments: readonly string[]): string
}

/**
 * Named `create…` rather than `FirebaseService` so the type keeps that name. A
 * factory rather than a class, which sidesteps `erasableSyntaxOnly` forbidding
 * parameter properties, and leaves nothing bound to `this`.
 *
 * Called once, by `setEnvironment`, which is idempotent — so a hot reload
 * cannot initialise the app twice.
 */
export function createFirebaseService(
  environment: Environment,
): FirebaseService {
  /*
    Refuse rather than let the SDK guess. With no `databaseURL` it does not
    fail: it assumes `https://{projectId}-default-rtdb.firebaseio.com`, the
    default US region. This database is in `asia-southeast1`, so that guess is
    wrong and every read would go quietly nowhere. Same reasoning as an unmapped
    hostname in `environments.ts`.
  */
  if (FIREBASE_CONFIG.databaseURL === '') {
    throw new Error(
      'firebase: databaseURL is empty in src/config/firebase.ts. ' +
        'Copy it from the Realtime Database in the Firebase console. Leaving it ' +
        'empty is deliberate: the SDK would otherwise guess a US-region URL, ' +
        'which is wrong for this project.',
    )
  }

  const app = initializeApp(FIREBASE_CONFIG)

  return Object.freeze({
    kind: 'firebase' as const,
    environment,
    root: environment,
    app,
    database: getDatabase(app),

    path(...segments: readonly string[]): string {
      for (const segment of segments) {
        if (segment === '') {
          throw new Error(
            `firebase: empty path segment in path(${segments.join(', ')})`,
          )
        }
        if (ILLEGAL_IN_KEY.test(segment)) {
          throw new Error(
            `firebase: path segment "${segment}" contains a character that is ` +
              `not allowed in a database key`,
          )
        }
      }

      return [environment, ...segments].join('/')
    },
  })
}

/**
 * The active service, when it is a Firebase one.
 *
 * Throws if the session was set up against a different backend, which is the
 * correct answer rather than a cast that quietly lies. The check is explicit
 * because `ApiService` has one implementation today; it becomes an ordinary
 * discriminated narrow once there are two.
 */
export function getFirebaseService(): FirebaseService {
  const service = getApiService()
  if (service.kind !== 'firebase') {
    throw new Error(
      `firebase: the active API service is "${service.kind}", not Firebase`,
    )
  }
  return service as FirebaseService
}
