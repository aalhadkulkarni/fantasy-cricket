/**
 * `users/{userId}`.
 *
 * Global identity, plus the two indexes that answer "which leagues is this
 * person in". Those indexes exist because RTDB cannot filter the `leagues` node
 * by a nested member key, which also means **they cannot be rebuilt**: lose an
 * entry and that league disappears from that user's interface permanently.
 *
 * **`userId` is the Firebase Auth UID.** There is no lookup table translating
 * an auth identity into an id of our own, because the UID is stable, unique,
 * and the only thing a Phase 2 security rule can verify — `auth.uid` resolves
 * to exactly this.
 *
 * That choice removes the duplicate-account problem rather than solving it. Two
 * tabs signing in as the same person both address `users/{sameUid}`, so there
 * is nothing to claim and no race to lose. Only the display name can differ,
 * and last write wins.
 *
 * **What it costs**, recorded so nobody meets it by surprise: leaving Firebase
 * Auth changes every user id. See the migration note in `05-data-model.md` —
 * user ids appear as *values* about as often as they appear as keys.
 */

import type { LeagueId, TournamentId, UserId } from './ids'
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
  /** The Firebase Auth UID, and the key this record is stored under. */
  userId: UserId

  userName: string

  /**
   * The Google account id — the `sub` claim, from `providerData` on the auth
   * user.
   *
   * **Nothing reads it, and that is the point.** It is insurance: if the
   * Firebase project were ever deleted, this is the only thing that could say
   * which person a `userId` belonged to. One field against an otherwise
   * unrecoverable loss.
   */
  googleSubjectId: string

  googleEmailId: string

  /** Universal roles. Empty for almost everyone. */
  systemUserRoles: Partial<Record<SystemRole, true>>

  leagues: Record<LeagueId, LeagueIndexEntry>
  archivedLeagues?: Record<LeagueId, ArchivedLeagueIndexEntry>
}
