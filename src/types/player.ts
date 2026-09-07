/**
 * `players/{playerId}`.
 *
 * A cricketer. The fantasy participants are managers, and they are users.
 */

import type { CompetitionId, PlayerId, TeamId } from './ids'
import type { PlayerRole } from './reference'

/**
 * JOIN: `currentTeams` values → `teams`, and its keys → `competitions`.
 *
 * DERIVED: whether this player is overseas. There is no flag — it is `country`
 * not being India. Hardcoding India is a known Phase 1 limitation.
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

  /** Overseas is derived from this: anything that is not India. */
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
   * Fully retired from cricket, which is the one case an empty `currentTeams`
   * cannot express: an empty map is otherwise indistinguishable from a newly
   * created player not yet assigned to any team.
   */
  isRetired: boolean
}
