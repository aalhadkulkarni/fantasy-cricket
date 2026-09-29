/**
 * Which implementation of the contract this session uses.
 *
 * **The contract itself lives in `@fantasy-cricket/shared`**, because the
 * service implements the same interface. This file is only the wiring: pick
 * an implementation once at bootstrap and hand it to everything above.
 *
 * ```
 * component  →  dataLayer.getLeagueDetails()   public, backend-agnostic
 *            →  httpApi.getLeagueDetails()     one implementation of Api
 *            →  GET /v1/getLeagueDetails       the service does the rest
 * ```
 */

import { apiBaseUrl, type Environment } from '@/config/environments'
import { DataLayerError, type Api } from '@fantasy-cricket/shared'

import { createHttpApi } from './http/http-api'

// ---------------------------------------------------------------------------
// Which one is active
// ---------------------------------------------------------------------------

let currentApi: (Api & { readonly environment: Environment }) | undefined

/**
 * Chooses the backend for the session and builds it.
 *
 * **Call this at bootstrap, before anything else.** Every read and write goes
 * through what it constructs, and `getApi` refuses to work until it has run,
 * which is what makes "before anything else" a guarantee rather than a
 * convention.
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
 *
 * **Firebase is hardcoded here and that is the point.** This one line is the
 * whole of what changes when a second implementation exists.
 */
export function setEnvironment(environment: Environment): void {
  if (currentApi !== undefined) {
    if (currentApi.environment === environment) return
    throw new DataLayerError(
      'internal',
      `data-layer: the environment is already "${currentApi.environment}" and ` +
        `cannot be changed to "${environment}" mid-session`,
    )
  }

  currentApi = createHttpApi(environment, apiBaseUrl(environment))
}

/** The active backend. Throws until `setEnvironment` has run. */
export function getApi(): Api {
  if (currentApi === undefined) {
    throw new DataLayerError(
      'internal',
      'data-layer: no API. Call setEnvironment() at bootstrap, before anything ' +
        'reads or writes.',
    )
  }
  return currentApi
}
