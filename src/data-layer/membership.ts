/**
 * Both ends of the membership pipeline: asking to join, and the admin resolving
 * it. Plus bans, roles, and removing a league.
 *
 * The two ends live together because they are one flow. `docs/06-data-layer.md`
 * lists the joining calls under My Leagues and Join by code, and the resolving
 * calls under Admin Center, but they write the same nodes and enforce the same
 * rules.
 *
 * **Membership is never decided from a user's league index.** That index is a
 * view. Any check asking "is this person in this league" reads
 * `leagues/{leagueId}/leagueMembers/{userId}`, which is the source of truth.
 */

import type {
  BannedUserSummary,
  JoinRequestSummary,
  LeagueId,
  LeagueMemberSummary,
  LeagueRole,
  UserId,
} from '@/types'
import { notImplemented } from './not-implemented'
import type {
  Subscriber,
  SubscriptionErrorHandler,
  Unsubscribe,
} from './subscriptions'

// ---------------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------------

/**
 * Public leagues only, and joining is immediate.
 *
 * **The deadline and the ban check are enforced here**, not hidden in the
 * interface. A ban is checkable before membership exists, which is why
 * `bannedUsers` is its own node rather than a status on a request.
 */
export function joinLeague(
  leagueId: LeagueId,
  fantasyTeamName: string,
): Promise<void> {
  return notImplemented('joinLeague', { leagueId, fantasyTeamName })
}

/**
 * Closed leagues. Re-requesting overwrites the same record and flips the status
 * back to pending, which loses the history of prior rejections. Nothing
 * consumes that, and it is what lets the request be keyed by user id.
 */
export function requestToJoin(
  leagueId: LeagueId,
  fantasyTeamName: string,
): Promise<void> {
  return notImplemented('requestToJoin', { leagueId, fantasyTeamName })
}

/** No team name, because a spectator does not field one. */
export function requestToJoinAsSpectator(leagueId: LeagueId): Promise<void> {
  return notImplemented('requestToJoinAsSpectator', { leagueId })
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/**
 * Pending and rejected.
 *
 * **Accepted entries are kept as a record but are not returned for display.**
 * Once someone is a member the member list is where you look for them, and a
 * second list saying the same thing only raises the question of which is real.
 */
export function getJoinRequests(
  leagueId: LeagueId,
): Promise<JoinRequestSummary[]> {
  return notImplemented('getJoinRequests', { leagueId })
}

/** Name, team name and roles. Used by Members, Admin Center and the auction. */
export function getMembers(leagueId: LeagueId): Promise<LeagueMemberSummary[]> {
  return notImplemented('getMembers', { leagueId })
}

export function getBannedUsers(
  leagueId: LeagueId,
): Promise<BannedUserSummary[]> {
  return notImplemented('getBannedUsers', { leagueId })
}

// ---------------------------------------------------------------------------
// Resolving requests
// ---------------------------------------------------------------------------

/**
 * **Writes the membership and the new member's league index atomically.** That
 * index cannot be rebuilt, so a partial write would leave someone a member of a
 * league they can never see.
 */
export function acceptJoinRequest(
  leagueId: LeagueId,
  requestedUserId: UserId,
): Promise<void> {
  return notImplemented('acceptJoinRequest', { leagueId, requestedUserId })
}

/** Soft. The person may request again. */
export function rejectJoinRequest(
  leagueId: LeagueId,
  requestedUserId: UserId,
): Promise<void> {
  return notImplemented('rejectJoinRequest', { leagueId, requestedUserId })
}

/** For an inappropriate team name, which is why the name is captured at request time. */
export function rejectJoinRequestAndBan(
  leagueId: LeagueId,
  requestedUserId: UserId,
): Promise<void> {
  return notImplemented('rejectJoinRequestAndBan', {
    leagueId,
    requestedUserId,
  })
}

// ---------------------------------------------------------------------------
// Bans and roles
// ---------------------------------------------------------------------------

/**
 * **A ban is expressed twice, and both writes belong to one update.** It strips
 * `manager` and adds `bannedFromLeague` on the membership record, which is what
 * makes slot counting and the leaderboard drop the person automatically, and it
 * writes a `bannedUsers` entry so the check can also run before membership
 * exists.
 */
export function banManager(
  leagueId: LeagueId,
  targetUserId: UserId,
): Promise<void> {
  return notImplemented('banManager', { leagueId, targetUserId })
}

/** The role to restore is explicit, since a ban stripped whatever they held. */
export function unbanUser(
  leagueId: LeagueId,
  targetUserId: UserId,
  roleToGrant: LeagueRole,
): Promise<void> {
  return notImplemented('unbanUser', { leagueId, targetUserId, roleToGrant })
}

export function makeAdmin(
  leagueId: LeagueId,
  targetUserId: UserId,
): Promise<void> {
  return notImplemented('makeAdmin', { leagueId, targetUserId })
}

/** **The owner cannot be removed as admin.** Enforced here. */
export function revokeAdmin(
  leagueId: LeagueId,
  targetUserId: UserId,
): Promise<void> {
  return notImplemented('revokeAdmin', { leagueId, targetUserId })
}

// ---------------------------------------------------------------------------
// Ending a league
// ---------------------------------------------------------------------------

/**
 * Sets `finishedAt`. **Never derived** — only a person knows whether every
 * point and correction is in. Its absence is what keeps a league out of the
 * Archived tab.
 */
export function markLeagueFinished(leagueId: LeagueId): Promise<void> {
  return notImplemented('markLeagueFinished', { leagueId })
}

/**
 * **Owner only, and only while the owner is the league's only member.**
 *
 * This exists for one case: a league created twice by mistake. A league has no
 * natural key, correctly, since two people running leagues with the same name
 * is legitimate, so a double-tapped Create produces two leagues and something
 * has to remove the spare.
 *
 * **The emptiness condition is the whole safety story.** Once anyone else has
 * joined, the league holds other people's season and no confirmation dialog
 * makes that safe to destroy. Enforced here, not in the button.
 *
 * **One atomic multi-path update, or it leaves orphans.** A league's data spans
 * eleven nodes keyed by `leagueId`, plus four reverse references. Most are
 * empty under the emptiness condition; clear them anyway, so a bug in that
 * check cannot leave half a league behind. The owner's entry in
 * `users/{userId}/leagues` is the one that must not survive — it cannot be
 * rebuilt, and a leftover points at a league that no longer exists.
 */
export function deleteLeague(leagueId: LeagueId): Promise<void> {
  return notImplemented('deleteLeague', { leagueId })
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export function onJoinRequestReceived(
  leagueId: LeagueId,
  callback: Subscriber<JoinRequestSummary>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onJoinRequestReceived', {
    leagueId,
    callback,
    onError,
  })
}

export function onMemberJoined(
  leagueId: LeagueId,
  callback: Subscriber<LeagueMemberSummary>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onMemberJoined', { leagueId, callback, onError })
}
