/**
 * `matchBasedLineups/{leagueId}/{userId}` and
 * `gameWeekBasedLineups/{leagueId}/{userId}`.
 *
 * The eleven a manager fields. Split out of `leagues` because this is the
 * largest thing a league accumulates: reading a league to show its name would
 * otherwise drag every manager's selections across every match.
 *
 * **Two nodes, because these are two entities rather than one entity with two
 * shapes.** A match-based league keys by `MatchId` and carries change counters;
 * a gameweek league keys by `GameWeekId` and carries an impact sub. They share
 * almost no fields, and a league is one type for its entire life, so the two
 * are never read together.
 *
 * Merged into one node they could not be told apart: nothing stored there said
 * which shape it held, so a reader had to fetch the league first just to know
 * how to interpret what it already had. **Split, the path is the
 * discriminant** and each node has one concrete type.
 *
 * ---
 *
 * **The elevens hold resolved players; the pointers into them stay ids.**
 *
 * The database stores ids in both cases. The lists are resolved here because a
 * lineup exists to be rendered, and every row of it needs a name, a short name
 * and a role. Handing a component eleven ids means every component that draws a
 * lineup writes the same lookup.
 *
 * `captainId`, `viceCaptainId` and the two sides of an impact sub stay ids,
 * because their job is to point *into* a list that is already resolved. Drawing
 * a row is then `player.playerId === captainId`, which is the comparison you
 * want, and a resolved captain would be a second copy of an object already in
 * the array beside it.
 */

import type { GameWeekId, MatchId, PlayerId, UserId } from './ids'
import type { Player } from './player'

/**
 * One entry at `matchBasedLineups/{leagueId}/{userId}/{matchId}`.
 *
 * Stored **densely**: one entry per match, with the same value copied forward
 * until changed. Most of those copies carry no information, since a lineup
 * applies forward until replaced. Sparse storage is a known optimisation,
 * deferred because it only matters at sixty-plus match tournaments.
 *
 * NOTE: `lineup` is an array, which is one of only two places this model uses
 * one. It is allowed here because a lineup is always read and written whole and
 * is fixed at eleven, so none of the reasons to prefer maps apply.
 *
 * DERIVED: points for this match. Resolve each player against the points node,
 * apply 2x to the captain and 1.5x to the vice-captain, and sum. Never stored.
 */
export interface MatchLineup {
  /** Exactly eleven. Enforced in code; the database stores ids and cannot express it. */
  lineup: Player[]

  /** Ids, not players — they point into `lineup`. See the note at the top. */
  captainId: PlayerId
  viceCaptainId: PlayerId

  /**
   * Counters carried forward on every write. One change is one player out and
   * one player in, so swapping three uses three. Captain and vice-captain
   * changes count separately and are not team changes.
   */
  changesRemaining: number
  captainChangesRemaining: number
  viceCaptainChangesRemaining: number
}

/**
 * An impact substitution: one swap during a gameweek, taking effect from a
 * chosen match rather than immediately.
 *
 * NOTE: this is why team visibility is per match rather than per gameweek. A
 * sub must stay hidden from other managers until *that* match locks, not until
 * the gameweek does.
 */
export interface ImpactSub {
  /**
   * Ids for the same reason as the captain: `playerIdOut` points into
   * `startingLineup` and `playerIdIn` into `postImpactSubLineup`, both of which
   * are already resolved.
   */
  playerIdOut: PlayerId
  playerIdIn: PlayerId

  /** Chosen from matches that have not started, so the set shrinks as play goes on. */
  applicableFromMatch: MatchId
}

/**
 * One entry at `gameWeekBasedLineups/{leagueId}/{userId}/{gameWeekId}`.
 *
 * Not dense — one entry per gameweek, and it never was. The sparse-storage
 * deferral applies to match-based leagues only.
 *
 * DERIVED: which eleven applies to a given match. Before the impact sub's
 * `applicableFromMatch`, `startingLineup`; from it onward, `postImpactSubLineup`.
 *
 * NOTE: there are no change counters here. An auction league's allowances are
 * fixed rather than configured — unlimited between gameweeks, one impact sub
 * during one — because the squad won at auction is already the constraint.
 */
export interface GameWeekLineup {
  startingLineup: Player[]

  /**
   * Ids, pointing into the lineups. Neither can be impact subbed, so a sub can
   * never leave the gameweek without a captain or vice-captain.
   */
  captainId: PlayerId
  viceCaptainId: PlayerId

  impactSub?: ImpactSub

  /** Absent until a sub is made. Otherwise the eleven from `applicableFromMatch` on. */
  postImpactSubLineup?: Player[]
}

/**
 * `matchBasedLineups/{leagueId}` — every manager's lineups in one match-based
 * league.
 */
export type MatchBasedLeagueLineups = Record<
  UserId,
  Record<MatchId, MatchLineup>
>

/**
 * `gameWeekBasedLineups/{leagueId}` — every manager's lineups in one gameweek
 * league.
 */
export type GameWeekBasedLeagueLineups = Record<
  UserId,
  Record<GameWeekId, GameWeekLineup>
>
