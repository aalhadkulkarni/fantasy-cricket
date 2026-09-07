/**
 * `users/{userId}` and `googleIdentifierToUserIdMapping`.
 *
 * Global identity, plus the two indexes that answer "which leagues is this
 * person in". Those indexes exist because RTDB cannot filter the `leagues` node
 * by a nested member key, which also means **they cannot be rebuilt**: lose an
 * entry and that league disappears from that user's interface permanently.
 */

import type { GoogleIdentifier, LeagueId, TournamentId, UserId } from './ids'
import type { LeagueRole, SystemRole } from './reference'

/**
 * Tracks the join pipeline and nothing else. Written at exactly two moments:
 * when a request is accepted, and when it is rejected.
 *
 * There is no `Banned` value. Banning does not touch this — it strips `manager`
 * and adds `bannedFromLeague` on the membership record, which `myRoles` below
 * already carries.
 */
export type MembershipStatus = 'Pending' | 'Accepted' | 'Rejected'

/**
 * One entry in `users/{userId}/leagues`, keyed by `LeagueId`.
 *
 * Denormalised copies of exactly what the My Leagues card renders, so the page
 * does not read every league in full just to draw a list.
 *
 * DERIVED, and deliberately not here: lifecycle status and filled slots. Status
 * is a function of the current time and nothing can write it; a slot counter
 * would fan out to every member's entry on every join, which is the most
 * frequent write in the model. Both come from narrow reads against the league.
 *
 * `finishedAt` and `auctionStartTime` are also not copied, though the fan-out
 * objection does not apply to them — a failed fan-out would leave one member
 * permanently wrong, and since archiving keys off `finishedAt`, that member's
 * league would then never archive.
 */
export interface LeagueIndexEntry {
  leagueName: string

  /** Immutable, so it is safe to copy, and it saves a waterfall to the tournament. */
  tournamentId: TournamentId
  tournamentName: string

  isAuctionEnabled: boolean
  ownerName: string
  maxSlots: number
  membershipStatus: MembershipStatus

  /** This user's roles in that league. Additive. */
  myRoles: Partial<Record<LeagueRole, true>>
}

/**
 * One entry in `users/{userId}/archivedLeagues`.
 *
 * A league moves here once `finishedAt` is set **and** twenty-four hours have
 * passed. There is no scheduler in Phase 1, so the move happens lazily on the
 * next My Leagues load, as one atomic update writing this path and deleting the
 * other. Never a write then a delete: this index cannot be rebuilt.
 *
 * The record moves unchanged and gains the snapshot below. Only the card
 * shrinks; a shrunk record could not be moved back.
 */
export interface ArchivedLeagueIndexEntry extends LeagueIndexEntry {
  archivedAt: number

  /**
   * Final position, computed once at migration.
   *
   * The single exception to points never being stored per manager, and a sound
   * one: marking a league finished is precisely the assertion that no
   * corrections remain, so this can never change again. Best effort — if the
   * leaderboard computation fails the move still happens and these are absent.
   */
  finalRank?: number
  finalManagerCount?: number
}

/**
 * JOIN: nothing. This is the root identity record.
 *
 * DERIVED: the avatar. It is not stored — it comes from Google's `photoURL` on
 * the auth object, with an initials fallback for accounts that have no picture
 * and for hotlinked images that later fail to load.
 */
export interface User {
  userId: UserId
  userName: string

  /**
   * Whatever identifies the Google account.
   *
   * OPEN: still undecided whether this is the Google user id or the email. It
   * matters more than it looks — the uniqueness guarantee on account creation
   * is only as strong as this key's stability, and an email address is mutable.
   */
  googleIdentifier: GoogleIdentifier
  googleEmailId: string

  /** Universal roles. Empty for almost everyone. */
  systemUserRoles: Partial<Record<SystemRole, true>>

  leagues: Record<LeagueId, LeagueIndexEntry>
  archivedLeagues?: Record<LeagueId, ArchivedLeagueIndexEntry>
}

/**
 * `googleIdentifierToUserIdMapping`.
 *
 * Resolves an auth identity to a user in one read, and is where that identity
 * is **claimed transactionally** at sign-up. Looking a user up first and
 * creating if absent does not work: two tabs both read nothing, both pass the
 * check, and both create. Whoever claims this path wins; the loser is rejected
 * and re-reads.
 */
export type GoogleIdentifierToUserIdMapping = Record<GoogleIdentifier, UserId>
