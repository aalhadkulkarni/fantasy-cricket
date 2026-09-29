/**
 * The Fantasy Cricket API.
 *
 * **A walking skeleton.** Two routes, enough to prove the chain end to end:
 * the container builds, deploys, reaches the database, and verifies a real
 * signed-in user. The 67 data-layer operations follow once this is standing.
 *
 * `docs/10-milestones.md` records why this exists: every rule the data layer
 * enforces is advisory while it runs in the browser.
 */

import cors from 'cors'
import express from 'express'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'

import { authenticate } from './auth.ts'
import { allowedOrigins, resolveEnvironment } from './environment.ts'

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
app.use(cors({ origin: allowedOrigins(environment) }))

/** Unauthenticated on purpose: Cloud Run and uptime checks call it. */
app.get('/health', (_request, response) => {
  response.json({ status: 'ok', environment })
})

/**
 * **The one that matters.** It proves the token check, the database
 * connection and the environment root all work together: it answers with who
 * you are and whether this deployment can read your user record.
 */
app.get('/v1/whoami', authenticate, async (request, response, next) => {
  try {
    const uid = request.session?.uid ?? ''
    const snapshot = await getDatabase()
      .ref(`${environment}/users/${uid}/userName`)
      .get()

    response.json({
      uid,
      environment,
      userName: (snapshot.val() as string | null) ?? undefined,
    })
  } catch (error) {
    next(error)
  }
})

/** Last resort. The message is never returned: it can name internals. */
app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(
      JSON.stringify({
        severity: 'ERROR',
        message: error instanceof Error ? error.message : String(error),
      }),
    )
    response
      .status(500)
      .json({ code: 'internal', message: 'Something went wrong.' })
  },
)

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
