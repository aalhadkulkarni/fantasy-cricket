/**
 * Signing in, and the token every API call carries.
 *
 * **The only Firebase left in the browser.** Reads and writes go through the
 * service now; this stays because a Google popup and an auth-state listener
 * cannot cross HTTP. It is also what produces the ID token the service
 * verifies, so the browser proves who it is without ever holding database
 * access.
 *
 * Split out of `FirebaseService`, which has moved to the service with the
 * rest of the data access.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User as FirebaseAuthUser,
} from 'firebase/auth'

import { FIREBASE_CONFIG } from '@/config/firebase'
import {
  DataLayerError,
  type SignInOutcome,
  type SignedInIdentity,
  type Subscriber,
  type Unsubscribe,
} from '@fantasy-cricket/shared'

/**
 * One app for the session. Initialising twice throws, and Vite's hot reload
 * re-executes modules, so this is created once and reused.
 */
let app: FirebaseApp | undefined

function auth(): Auth {
  app ??= initializeApp(FIREBASE_CONFIG)
  return getAuth(app)
}

function toIdentity(user: FirebaseAuthUser): SignedInIdentity {
  return {
    userId: user.uid as SignedInIdentity['userId'],
    photoUrl: user.photoURL ?? undefined,
  }
}

/**
 * Fires with the current session, then again on every change.
 *
 * **It has not fired yet when the app first renders**, and that gap is real:
 * restoring an existing session is asynchronous. Treating "not fired" as
 * "signed out" makes every visit flash the login page before redirecting.
 */
export function onAuthChanged(
  callback: Subscriber<SignedInIdentity | undefined>,
): Unsubscribe {
  return onAuthStateChanged(auth(), (user) => {
    callback(user === null ? undefined : toIdentity(user))
  })
}

/**
 * **Returns an outcome rather than throwing**, because two of the three
 * non-success cases are not errors: someone closing the popup changed their
 * mind, and a superseded popup is noise. Only a blocked popup needs saying
 * out loud, and only because nothing on screen explains it.
 *
 * Popup rather than redirect: `signInWithRedirect` breaks on browsers that
 * partition third-party storage unless the auth handler is self-hosted, which
 * makes it the more fragile choice on a product used mostly on phones.
 */
export async function signInWithGoogle(): Promise<SignInOutcome> {
  try {
    await signInWithPopup(auth(), new GoogleAuthProvider())
    return 'signedIn'
  } catch (cause) {
    switch ((cause as { code?: string }).code) {
      case 'auth/popup-closed-by-user':
        return 'dismissed'
      case 'auth/cancelled-popup-request':
        return 'superseded'
      case 'auth/popup-blocked':
        return 'blocked'
      default:
        throw new DataLayerError(
          'internal',
          `signing in failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          cause,
        )
    }
  }
}

export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth())
  } catch (cause) {
    throw new DataLayerError(
      'internal',
      `signing out failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      cause,
    )
  }
}

/**
 * The token for the current user, or nothing when signed out.
 *
 * **The SDK owns refreshing.** Tokens last an hour and it mints a fresh one
 * when this is called near expiry, so there is no refresh logic here and none
 * is wanted: a second implementation of it would be the thing that breaks.
 */
export async function idToken(): Promise<string | undefined> {
  const user = auth().currentUser
  return user === null ? undefined : await user.getIdToken()
}
