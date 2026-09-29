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

/**
 * Who is calling, taken from the verified token and nothing else.
 *
 * **The same three facts the browser used to read from its auth session.**
 * `googleSubjectId` is stored on a new user record as insurance: if the
 * Firebase project were ever lost, it is the only thing that could say which
 * person a `uid` belonged to.
 */
export interface Session {
  /** The Firebase Auth UID. This is the key `users/` is stored under. */
  uid: string

  /** Absent if the Google account has no email, which is rare but possible. */
  email: string | undefined

  /** Google's own subject id, which is not the Firebase UID. */
  googleSubjectId: string | undefined
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

/** The Google provider's own subject id, if this account has one. */
function googleSubjectOf(
  identities: Record<string, unknown>,
): string | undefined {
  const google = identities['google.com']
  return Array.isArray(google) && typeof google[0] === 'string'
    ? google[0]
    : undefined
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

    request.session = {
      uid: token.uid,
      email: token.email,
      // Where Firebase records the provider's own id for this account. The
      // SDK types this map as `any`, so it is narrowed rather than trusted.
      googleSubjectId: googleSubjectOf(token.firebase.identities),
    }
    next()
  } catch {
    // Expired, malformed, or signed by somebody else. All the same answer:
    // saying which would only help someone probing.
    response
      .status(401)
      .json({ code: 'unauthenticated', message: 'Your session has expired.' })
  }
}
