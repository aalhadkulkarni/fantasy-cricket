/**
 * The Fantasy Cricket API.
 *
 * **Every rule the data layer enforces lives here now.** It used to run in the
 * browser, where anyone could skip it by writing to the database directly.
 * The browser holds no database access; it signs in, gets a token, and calls
 * these routes.
 *
 * One route per operation on the contract, registered from the shared
 * manifest. See `routes.ts`.
 */

import cors from 'cors'
import { initializeApp, applicationDefault } from 'firebase-admin/app'

import express from 'express'
import { authenticate } from './auth.ts'
import { allowedOrigins, resolveEnvironment } from './environment.ts'
import { errorHandler, registerRoutes } from './routes.ts'

/*
  Resolved before anything else, so a misconfigured deployment fails at boot
  rather than on its first write.
*/
const environment = resolveEnvironment()

/*
  **No key file anywhere.** On Cloud Run this picks up the service account the
  service runs as; locally it picks up `gcloud auth application-default login`.
*/
initializeApp({
  credential: applicationDefault(),
  databaseURL:
    'https://fantasy-cricket-league-c0346-default-rtdb.asia-southeast1.firebasedatabase.app',
})

const app = express()
app.use(express.json())

/*
  **How long each request takes, measured here.** One line per request in the
  logs — method, path, status, milliseconds — and a `Server-Timing` header on
  every answer, so where an auction's time goes is visible in DevTools and in
  Cloud Run's logs alike. First of all, so a preflight is logged too — which
  is how to see they have stopped — and token checks count.
*/
app.use((request, response, next) => {
  const startedAt = performance.now()
  // Read now: a router rewrites the path for its own routes before this logs.
  const { method, path } = request
  response.locals.startedAt = startedAt
  response.on('finish', () => {
    const ms = Math.round(performance.now() - startedAt)
    console.log(
      JSON.stringify({
        severity: 'INFO',
        message: `${method} ${path} ${response.statusCode} ${ms}ms`,
        method,
        path,
        status: response.statusCode,
        ms,
      }),
    )
  })
  next()
})

/*
  **The preflight is cached for two hours.** The site and the service are on
  different origins and every request carries `Authorization`, so the browser
  asks permission with an `OPTIONS` first. Without `maxAge` it asks again
  almost every time, which doubles the round trips of every auction write.
  Two hours is Chrome's ceiling; the cache is per URL and method, so each write
  endpoint preflights once in that time.
*/
app.use(cors({ origin: allowedOrigins(environment), maxAge: 7200 }))

/** Unauthenticated on purpose: Cloud Run and uptime checks call it. */
app.get('/health', (_request, response) => {
  response.json({ status: 'ok', environment })
})

/**
 * **Everything else is the contract, and everything else needs a token.**
 * The middleware runs before any route, so no operation can be reached
 * unauthenticated — including the ones whose own checks would have caught it.
 */
const v1 = express.Router()
v1.use(authenticate)
registerRoutes(v1, environment)
app.use('/v1', v1)

app.use(errorHandler)

/** Cloud Run sets PORT; 3000 is for running it locally. */
const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => {
  console.log(
    JSON.stringify({
      severity: 'INFO',
      message: `api listening`,
      port,
      environment,
    }),
  )
})
