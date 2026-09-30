/**
 * `players/{playerId}`.
 *
 * A cricketer. The fantasy participants are managers, and they are users.
 */

import type { CompetitionId, PlayerId, TeamId } from './ids.ts'
import type { PlayerCategory, PlayerRole } from './reference.ts'

/**
 * JOIN: `currentTeams` values → `teams`, and its keys → `competitions`.
 *
 * DERIVED: whether this player is overseas. There is no flag, and it is not a
 * property of the player alone — it is `country` not matching the
 * tournament's `homeNation`.
 *
 * DERIVED: which team this player is in *for a given tournament*. Not this
 * field. `currentTeams` is the live answer, used to prefill when a tournament
 * is created; the tournament then keeps its own frozen mapping in
 * `participatingPlayers`, and never writes back here.
 */
export interface Player {
  playerId: PlayerId
  playerName: string
  playerShortName: string

  /**
   * **The team they play for in the tournament being viewed**, as its short
   * name — "IND". Resolved by the layer from the tournament's frozen
   * `participatingPlayers`, never from `currentTeams`. Absent wherever no
   * tournament is in context, such as the admin's player catalogue.
   */
  teamShortName?: string

  /** Overseas is derived from this against a tournament's `homeNation`. */
  country: string

  /**
   * Current team per competition.
   *
   * Retiring from a competition means deleting its entry here. There is no
   * per-format retirement flag, because a player can retire from T20
   * internationals and still play the IPL, so a format-level answer would be
   * wrong at the source.
   */
  currentTeams: Partial<Record<CompetitionId, TeamId>>

  /**
   * System-wide, and deliberately not overridable per league. Standard points
   * depend on it — a bowler is not penalised for a duck where a batsman is —
   * so a league overriding roles while using standard points would be scoring
   * against a role the points system does not recognise.
   */
  playerRole: PlayerRole

  /**
   * **The standard auction values**, resolved by the layer from
   * `standardAuctionConfig/playerDetails` — not stored on the player. Present
   * only where the catalogue is read for the admin, and only for players that
   * have values: those created before values became required have none.
   *
   * A league has its own copy, frozen when the league is created, so these are
   * never what an auction runs on.
   */
  playerCategory?: PlayerCategory
  playerBasePrice?: number

  /**
   * Fully retired from cricket, which is the one case an empty `currentTeams`
   * cannot express: an empty map is otherwise indistinguishable from a newly
   * created player not yet assigned to any team.
   */
  isRetired: boolean
}
