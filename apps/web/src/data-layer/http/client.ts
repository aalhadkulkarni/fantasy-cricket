/**
 * The one place the browser talks to the API.
 *
 * **Every call carries the Firebase ID token.** The SDK owns minting and
 * refreshing it, so there is no refresh logic here — a second implementation
 * of that is exactly what would break.
 *
 * **A refusal comes back as the same `DataLayerError` the layer used to
 * throw**, rebuilt from the code and message the service sent, so every page's
 * error handling keeps working unchanged.
 */

import {
  API_METHODS,
  DataLayerError,
  type ErrorBody,
  type WireMethod,
} from '@fantasy-cricket/shared'

import { idToken } from '../firebase/firebase-auth'

/**
 * **Query strings have no types**, so anything that is not already a string
 * goes as JSON and the service parses it back. Ids and names stay as they are,
 * which keeps the common URL readable.
 */
function encode(value: unknown): string | undefined {
  if (value === undefined) return undefined
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export function createClient(baseUrl: string) {
  return async function call(
    method: WireMethod,
    args: readonly unknown[],
  ): Promise<unknown> {
    const spec = API_METHODS[method]
    const token = await idToken()

    if (token === undefined) {
      throw new DataLayerError('unauthenticated', 'Sign in first.')
    }

    const url = new URL(`${baseUrl}/v1/${method}`)
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    }
    let body: string | undefined

    if (spec.verb === 'get') {
      spec.params.forEach((name, index) => {
        const encoded = encode(args[index])
        if (encoded !== undefined) url.searchParams.set(name, encoded)
      })
    } else {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(
        Object.fromEntries(
          spec.params
            .map((name, index) => [name, args[index]] as const)
            .filter(([, value]) => value !== undefined),
        ),
      )
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: spec.verb.toUpperCase(),
        headers,
        body,
      })
    } catch (cause) {
      // Offline, DNS, the service asleep: worth retrying, unlike a refusal.
      throw new DataLayerError(
        'unavailable',
        'Could not reach the server. Check your connection and try again.',
        cause,
      )
    }

    if (!response.ok) {
      const failure = (await response.json().catch(() => undefined)) as
        ErrorBody | undefined

      throw new DataLayerError(
        failure?.code ?? 'internal',
        failure?.message ??
          `The server refused the request (${response.status}).`,
      )
    }

    // `null` on the wire is `undefined` here: JSON cannot carry the difference,
    // and absence is meaningful all over this model.
    const { result } = (await response.json()) as { result: unknown }
    return result ?? undefined
  }
}
