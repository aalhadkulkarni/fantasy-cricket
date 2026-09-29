/**
 * `joinRequests/{leagueId}` and `bannedUsers/{leagueId}`.
 *
 * The membership pipeline. Split out of `leagues` because they are read by the
 * Admin Center and nothing else, so nesting them would drag every pending
 * request along with a league's name.
 */

import type { UserId } from './ids'
import type { LeagueRole } from './reference'

/**
 * `Rejected` is soft — the person may request again. There is no hard-rejected
 * value, because a reject-and-ban writes a `bannedUsers` entry instead.
 */
export type JoinRequestStatus = 'Pending' | 'Accepted' | 'Rejected'

/**
 * One entry in `joinRequests/{leagueId}`, keyed by `UserId`.
 *
 * Keyed by user so "does this person have a request here" is a direct read
 * rather than a scan. Re-requesting overwrites the same record and flips the
 * status back to `Pending`, which loses the history of prior rejections —
 * nothing consumes that, and it is what lets the key stay a user id.
 *
 * JOIN: the key is the only identity. Name and avatar are in `users`.
 *
 * NOTE: accepted entries are kept as a record but are **not shown**. Once
 * someone is a member the member list is where you look for them, and a second
 * list beside it saying the same thing only raises the question of which is
 * real.
 *
 * NOT MODELLED HERE: `resolvedAt` and `resolvedBy`, deliberately. Appeals are
 * out of Phase 1, so there is no consumer for that audit trail.
 */
export interface JoinRequest {
  /** Present when requesting as a manager, absent for a spectator. */
  fantasyTeamName?: string

  /**
   * In practice `manager` or `spectator`. Captured at request time rather than
   * at team submission, so an admin can reject or ban over an inappropriate
   * team name before it is ever visible in the league.
   */
  leagueRoleRequested: LeagueRole

  /** Lets the admin sort the queue. */
  requestedAt: number

  status: JoinRequestStatus
}

/**
 * One entry in `bannedUsers/{leagueId}`, keyed by `UserId`.
 *
 * A separate node rather than a status on the join request, because the ban
 * check happens at a different moment. In an open league joining needs no
 * approval and there is no request to consult, but a banned user must still be
 * turned away, so a ban has to be independently checkable at a known path.
 *
 * NOTE: this is not the whole story. Being banned is expressed on the
 * membership record itself, by stripping `manager` and adding
 * `bannedFromLeague`. That is what makes slot counting and the leaderboard drop
 * the person automatically. This node exists so the check can happen before
 * membership does.
 */
export interface BannedUser {
  bannedAt: number

  /** JOIN: → `users`, for "banned by whom". */
  bannedBy: UserId
}
