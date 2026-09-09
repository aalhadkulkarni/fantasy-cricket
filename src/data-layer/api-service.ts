/**
 * The backend this layer is talking to, and how it is chosen.
 *
 * **This is the Phase 2 seam.** Phase 1 talks to Firebase Realtime Database
 * straight from the browser. Phase 2 puts a real backend behind it, and the
 * only thing that should have to change is which service is constructed here.
 *
 * **An environment means something different to each service, and translating
 * it is the service's own business.** The Firebase service turns it into a path
 * prefix, because the four environments are four roots inside one database. A
 * REST service would turn the same value into a base hostname. Neither concept
 * belongs out here.
 *
 * ---
 *
 * ## TODO — the interface is a stub
 *
 * `ApiService` currently declares only which backend it is and which
 * environment it was built for. **It will grow to carry the layer's operations**
 * — the 143 functions in `docs/06-data-layer.md` — so that each one delegates to
 * the active service instead of calling a client directly.
 *
 * It is deliberately not written out yet. Nothing is implemented, so every
 * method would be invented, and the shapes will be clearer once the first few
 * are built against a real client.
 *
 * **There is no REST implementation either**, for the same reason: its
 * endpoints do not exist. The interface is here now rather than later because
 * the alternative is retrofitting a seam under 143 functions already written
 * against a concrete client, which is the work this is meant to avoid.
 */

import type { Environment } from '@/config/environments'
import { createFirebaseService } from './firebase/firebase-service'

export type ApiServiceKind = 'firebase' | 'rest'

export interface ApiService {
  /** Which backend. Narrow on this to reach a service's own additions. */
  readonly kind: ApiServiceKind

  /** What it was constructed for. Fixed for the life of the service. */
  readonly environment: Environment
}

let currentService: ApiService | undefined

/**
 * Sets the environment for the session and builds the service for it.
 *
 * **Call this at bootstrap, before anything else.** Every read and write goes
 * through the service it creates, and `getApiService` refuses to work until it
 * has run — which is what makes "before anything else" a guarantee rather than
 * a convention.
 *
 * The environment is passed in rather than resolved here. Deciding it is
 * `src/config/environments.ts`, because it is a fact about the deployment
 * rather than about the backend.
 *
 * Idempotent rather than single-shot: calling it again with the same
 * environment is a no-op, and calling it with a *different* one throws.
 * Refusing every second call would break under Vite's hot reload, which
 * re-executes modules; this still catches the bug worth catching, which is two
 * different backends in one session.
 */
export function setEnvironment(environment: Environment): void {
  if (currentService !== undefined) {
    if (currentService.environment === environment) return
    throw new Error(
      `data-layer: the environment is already "${currentService.environment}" ` +
        `and cannot be changed to "${environment}" mid-session`,
    )
  }

  currentService = createFirebaseService(environment)
}

/** The active service. Throws until `setEnvironment` has run. */
export function getApiService(): ApiService {
  if (currentService === undefined) {
    throw new Error(
      'data-layer: no API service. Call setEnvironment() at bootstrap, ' +
        'before anything reads or writes.',
    )
  }
  return currentService
}
