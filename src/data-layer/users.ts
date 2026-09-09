/**
 * Identity, and the one system-wide role grant.
 *
 * The uniqueness guarantee on account creation lives here, and it is not the
 * read. `getUserByGoogleIdentifier` is convenience; the transactional claim
 * inside `createUser` is the guard.
 */

import type { GoogleIdentifier, User, UserId } from '@/types'
import { notImplemented } from './not-implemented'

/**
 * Resolves an auth identity to a user, or nothing on a first visit.
 *
 * **This is not the guard against duplicate accounts.** The same person can
 * arrive twice — two tabs, a double-tapped button, a retry after a timeout —
 * and both attempts find nothing here. See `createUser`.
 */
export function getUserByGoogleIdentifier(
  googleIdentifier: GoogleIdentifier,
): Promise<User | undefined> {
  return notImplemented('getUserByGoogleIdentifier', { googleIdentifier })
}

/**
 * Creates the account, **claiming `googleIdentifierToUserIdMapping` for this
 * identity transactionally before writing anything else.**
 *
 * **Rejects when the identity is already claimed.** It does not silently return
 * the winner's record. The caller re-reads with `getUserByGoogleIdentifier` and
 * continues with whichever record won, so the person never sees a failure —
 * they do have an account, just not the one this tab was drafting. The losing
 * tab's typed display name is discarded.
 */
export function createUser(
  googleIdentifier: GoogleIdentifier,
  googleEmailId: string,
  userName: string,
): Promise<User> {
  return notImplemented('createUser', {
    googleIdentifier,
    googleEmailId,
    userName,
  })
}

/** The signed-in user. Identity comes from context, never from a parameter. */
export function getCurrentUser(): Promise<User> {
  return notImplemented('getCurrentUser', {})
}

/** System-wide. Nothing in the interface exposes this to a league admin. */
export function grantSystemAdmin(targetUserId: UserId): Promise<void> {
  return notImplemented('grantSystemAdmin', { targetUserId })
}
