/**
 * Who is calling.
 *
 * **Identity comes from a verified token, never from the request body.** The
 * browser sends the Firebase ID token it already holds; `verifyIdToken` checks
 * Google's signature against cached public keys, so a caller cannot claim to
 * be somebody else and the check costs no network round trip.
 *
 * This is the server half of what `requireSession()` did in the browser.
 */

import type { NextFunction, Request, Response } from 'express'
import { getAuth } from 'firebase-admin/auth'

export interface Session {
  uid: string
}

/** Set by `authenticate`, read by the routes. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: Session
    }
  }
}

/**
 * **Rejects rather than guesses.** A missing or bad token is a 401 with
 * nothing else attempted, so no route can accidentally run unauthenticated.
 */
export async function authenticate(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const header = request.header('authorization')

  if (header === undefined || !header.startsWith('Bearer ')) {
    response
      .status(401)
      .json({ code: 'unauthenticated', message: 'Sign in first.' })
    return
  }

  try {
    const token = await getAuth().verifyIdToken(header.slice('Bearer '.length))
    request.session = { uid: token.uid }
    next()
  } catch {
    // Expired, malformed, or signed by somebody else. All the same answer:
    // saying which would only help someone probing.
    response
      .status(401)
      .json({ code: 'unauthenticated', message: 'Your session has expired.' })
  }
}
