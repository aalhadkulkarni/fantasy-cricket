/**
 * Identity: signing in, the signed-in person's record, and the system-wide role
 * grants.
 *
 * **These delegate and nothing more.** Where the data lives, and how it is
 * fetched, is the active backend's business — see `api.ts` for why the seam is
 * here rather than deeper.
 */

import type { User, UserId } from '@/types'

import { getApi, type SignInOutcome, type SignedInIdentity } from './api'
import { notImplemented } from './not-implemented'
import type { Subscriber, Unsubscribe } from './subscriptions'

export type { SignInOutcome, SignedInIdentity }

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
  return getApi().onAuthChanged(callback)
}

/**
 * Starts a Google sign-in.
 *
 * **Returns an outcome rather than throwing** for the expected cases. Someone
 * abandoning it changed their mind, and a superseded attempt is noise; neither
 * is a failure. Only a blocked popup needs saying out loud, because nothing on
 * screen explains it.
 */
export function signInWithGoogle(): Promise<SignInOutcome> {
  return getApi().signInWithGoogle()
}

export function signOut(): Promise<void> {
  return getApi().signOut()
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
 * says whether the auth provider just created the account, which is a different
 * question. The person above is `isNewUser: false` and still has no record.
 */
export function getCurrentUser(): Promise<User | undefined> {
  return getApi().getCurrentUser()
}

/**
 * Writes the record for the signed-in person.
 *
 * **Takes only the display name.** Identity comes from the session, never from
 * a parameter, because a client-supplied identity is the cheating vector this
 * layer exists to close.
 *
 * No prefill from the provider, deliberately: long-standing accounts often
 * carry a nickname or a joke, and an embarrassing prefill is worse than an
 * empty field.
 */
export function createUser(userName: string): Promise<User> {
  return getApi().createUser(userName)
}

/** System-wide. Nothing in the interface exposes this to a league admin. */
export function grantSystemAdmin(targetUserId: UserId): Promise<void> {
  return notImplemented('grantSystemAdmin', { targetUserId })
}

/**
 * The inverse of `grantSystemAdmin`.
 *
 * **The last system admin should not be able to remove themselves**, or the
 * system has nobody who can grant the role back and the only way out is editing
 * the database by hand. That check belongs here, in the layer, when this is
 * implemented.
 */
export function revokeSystemAdmin(targetUserId: UserId): Promise<void> {
  return notImplemented('revokeSystemAdmin', { targetUserId })
}
