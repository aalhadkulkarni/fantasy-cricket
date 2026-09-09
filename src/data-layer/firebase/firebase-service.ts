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
 * ---
 *
 * ## TODO — no Firebase client yet
 *
 * The SDK is not installed and there is no app, no auth and no database handle.
 * This service currently knows only how to build paths.
 *
 * When the client arrives it is held here, initialised for this environment,
 * and the layer's functions reach it through `getFirebaseService()` rather than
 * importing Firebase anywhere else.
 */

import type { Environment } from '@/config/environments'
import type { ApiService } from '../api-service'
import { getApiService } from '../api-service'

/** Forbidden in an RTDB key. A `/` is included because it would nest silently. */
const ILLEGAL_IN_KEY = /[/.$#[\]]/

export interface FirebaseService extends ApiService {
  readonly kind: 'firebase'

  /** The first segment of every path. The environment, literally. */
  readonly root: Environment

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
 */
export function createFirebaseService(
  environment: Environment,
): FirebaseService {
  return Object.freeze({
    kind: 'firebase' as const,
    environment,
    root: environment,

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
