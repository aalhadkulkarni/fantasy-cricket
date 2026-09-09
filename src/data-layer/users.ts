/**
 * Identity: signing in, the signed-in person's record, and the one system-wide
 * role grant.
 *
 * **`users/` is keyed by the Firebase Auth UID.** There is no lookup table
 * translating an auth identity into an id of our own, and no transactional
 * claim at sign-up. Two tabs signing in as the same person both address
 * `users/{sameUid}`, so two records for one human cannot happen — the problem
 * is removed rather than guarded against.
 *
 * Only the display name can differ between those two tabs, and last write wins.
 *
 * ---
 *
 * **TODO: these reach `getFirebaseService()` directly.** Product operations
 * should go through `ApiService` so the backend can be swapped, but it carries
 * no operations yet. These are the first functions in the layer with real
 * bodies, so they are also the first to face that gap. They move when the
 * interface grows.
 */

import type { User, UserId } from '@/types'

import { DataLayerError } from './data-layer-error'
import {
  getFirebaseService,
  type SignInOutcome,
} from './firebase/firebase-service'
import { paths } from './firebase/paths'
import { notImplemented } from './not-implemented'
import type { Subscriber, Unsubscribe } from './subscriptions'

export type { SignInOutcome }

/**
 * Who is signed in, as far as the auth provider is concerned.
 *
 * Distinct from a `User`, which is our own record and may not exist yet. This
 * is available the moment the session resolves; that is not.
 */
export interface SignedInIdentity {
  userId: UserId

  /**
   * Google's `photoURL`. **Absent when the account has no picture**, which is
   * one of the two cases an initials fallback has to cover — the other being a
   * URL that stops loading later.
   */
  photoUrl: string | undefined
}

/**
 * Whether anyone is signed in, and who.
 *
 * Fires with the current answer and again on each change. **It has not fired
 * when the app first renders**, because restoring a session is asynchronous.
 * Treating "not fired yet" as "signed out" makes every visit flash the login
 * page before redirecting, which is why the caller has to tell those apart.
 */
export function onAuthChanged(
  callback: Subscriber<SignedInIdentity | undefined>,
): Unsubscribe {
  return getFirebaseService().onAuthChanged((session) => {
    callback(
      session === undefined
        ? undefined
        : { userId: session.uid as UserId, photoUrl: session.photoUrl },
    )
  })
}

/**
 * Opens the Google sign-in popup.
 *
 * **Returns an outcome rather than throwing** for the expected cases. Someone
 * closing the popup changed their mind, and a superseded popup is noise;
 * neither is a failure. Only a blocked popup needs saying out loud, because
 * nothing on screen explains it.
 */
export function signInWithGoogle(): Promise<SignInOutcome> {
  return getFirebaseService().signInWithGoogle()
}

export function signOut(): Promise<void> {
  return getFirebaseService().signOut()
}

/**
 * The signed-in person's record, or `undefined` when they are authenticated but
 * have no record yet.
 *
 * **That `undefined` is the mid-creation state**, and it is load-bearing.
 * Someone can sign in, abandon the display-name modal, and come back; the next
 * visit has to route them into the modal rather than into an app that assumes a
 * profile.
 *
 * **This lookup is the guard for that, not Firebase's `isNewUser`.** That flag
 * says whether Firebase Auth just created the account, which is a different
 * question. The person above is `isNewUser: false` and still has no record.
 *
 * Throws if nobody is signed in at all, which is a caller bug rather than a
 * state to render.
 */
export async function getCurrentUser(): Promise<User | undefined> {
  const service = getFirebaseService()
  const session = service.currentSession()

  if (session === undefined) {
    throw new DataLayerError(
      'unknown',
      'getCurrentUser: nobody is signed in. Check the auth session first.',
    )
  }

  return service.read<User>(paths.users(session.uid as UserId))
}

/**
 * Writes the record for the signed-in person.
 *
 * **Takes only the display name.** The UID, email and Google subject all come
 * from the auth session, never from parameters, because a client-supplied
 * identity is the cheating vector this layer exists to close.
 *
 * No prefill from Google, deliberately: long-standing accounts often carry a
 * nickname or a joke, and an embarrassing prefill is worse than an empty field.
 *
 * **A plain write, not a claim.** Two tabs racing here both address the same
 * path, so the worst outcome is that one display name overwrites the other.
 */
export async function createUser(userName: string): Promise<User> {
  const service = getFirebaseService()
  const session = service.currentSession()

  if (session === undefined) {
    throw new DataLayerError(
      'unknown',
      'createUser: nobody is signed in. There is no identity to write.',
    )
  }

  const user: User = {
    userId: session.uid as UserId,
    userName,
    googleSubjectId: session.googleSubjectId ?? '',
    googleEmailId: session.email ?? '',
    // Firebase stores neither an empty object nor a null, so an empty map here
    // simply means the key will not exist. Absent is what "no roles" looks like.
    systemUserRoles: {},
    leagues: {},
  }

  await service.write(paths.users(user.userId), user)
  return user
}

/** System-wide. Nothing in the interface exposes this to a league admin. */
export function grantSystemAdmin(targetUserId: UserId): Promise<void> {
  return notImplemented('grantSystemAdmin', { targetUserId })
}
