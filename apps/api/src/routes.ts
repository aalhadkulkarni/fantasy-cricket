/**
 * One route per operation, registered from the shared manifest.
 *
 * **Generated rather than hand-written**, so a method cannot exist on the
 * contract with no route, and a route cannot answer to a name the contract
 * does not have. The manifest also fixes the verb and the argument order, and
 * the client builds its calls from the same table.
 *
 * **Reads are GET, writes are POST.** A GET takes its arguments as query
 * parameters named after the parameter; a POST takes a JSON body keyed the
 * same way. Anything that is not a string arrives JSON-encoded, because a
 * query string has no types.
 */

import type { Request, RequestHandler, Response, Router } from 'express'

import {
  API_METHODS,
  DataLayerError,
  httpStatusFor,
  type Environment,
  type WireMethod,
} from '@fantasy-cricket/shared'

import { createFirebaseApi } from './firebase/firebase-api.ts'

/**
 * **A query parameter is always a string, so anything else is JSON.**
 * Ids and names pass through as they are; the filter objects, the lineups and
 * the booleans arrive encoded and are parsed back here.
 */
function decode(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  if (raw === '') return undefined

  // Ids are strings and must survive as strings: "01" is not the number 1.
  const first = raw[0] ?? ''
  if (!'{["-0123456789tfn'.includes(first)) return raw

  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/** Arguments in the order the method declares them, absent ones as undefined. */
function argumentsFor(method: WireMethod, request: Request): unknown[] {
  const spec = API_METHODS[method]
  const source: Record<string, unknown> =
    spec.verb === 'get'
      ? request.query
      : ((request.body ?? {}) as Record<string, unknown>)

  return spec.params.map((name) =>
    spec.verb === 'get' ? decode(source[name]) : source[name],
  )
}

/**
 * **The api object is built per request**, closing over the caller's verified
 * identity, so a handler can only ever see its own.
 */
function handlerFor(
  method: WireMethod,
  environment: Environment,
): RequestHandler {
  return (request, response, next) => {
    void (async () => {
      try {
        const api = createFirebaseApi(environment, request.session)
        const operation = api[method] as (
          ...args: unknown[]
        ) => Promise<unknown>
        const result = await operation.apply(api, argumentsFor(method, request))

        // `undefined` is a legitimate answer — no team yet, no watermark — and
        // JSON cannot carry it, so it becomes null and the client reads it back.
        response.json({ result: result ?? null })
      } catch (error) {
        next(error)
      }
    })()
  }
}

export function registerRoutes(router: Router, environment: Environment): void {
  for (const name of Object.keys(API_METHODS) as WireMethod[]) {
    const spec = API_METHODS[name]
    router[spec.verb](`/${name}`, handlerFor(name, environment))
  }
}

/**
 * **A refusal is not a failure.** A rule saying no carries its own status, so
 * logs and alerting can tell an ordinary "deadline has passed" from something
 * actually broken. Only the unexpected is a 500, and its message is replaced:
 * an internal one can name internals.
 */
export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  // Express identifies an error handler by its arity, so this must stay.
  _next: (error?: unknown) => void,
): void {
  if (error instanceof DataLayerError && error.code !== 'internal') {
    response
      .status(httpStatusFor(error.code))
      .json({ code: error.code, message: error.message })
    return
  }

  console.error(
    JSON.stringify({
      severity: 'ERROR',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }),
  )

  response
    .status(500)
    .json({ code: 'internal', message: 'Something went wrong.' })
}
