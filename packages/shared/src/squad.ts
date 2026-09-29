/**
 * `squads/{leagueId}/{userId}/{matchId}`.
 *
 * The players a manager owns, in an auction league only. A regular league has
 * no squads — its managers pick from the whole tournament pool.
 *
 * Do not confuse with a lineup. A squad is what you own; a lineup is the eleven
 * you field out of it.
 */

import type { MatchId, PlayerId, UserId } from './ids'

/**
 * Keyed by match, because squad membership changes over time: after a transfer
 * the incoming player is available from the next match onward. So "the squad"
 * is always the squad *at some match*, and the player dropdown for match X
 * depends on what was owned at X rather than what is owned now.
 *
 * Stored densely, the same value copied forward until a transfer changes it.
 *
 * NOTE: the array is the second of only two places this model uses one, for the
 * same reason as a lineup — it is read and written whole.
 *
 * NOTE: squads are written **as each player sells**, inside the same atomic
 * write that updates bid history and the buyer's budget, not materialised when
 * the auction ends. So this node is correct at every point during an auction.
 *
 * DEFERRED: keying by gameweek instead, so a transfer takes effect only once
 * the current gameweek ends rather than mid-week. Independent of the sparse
 * storage question; either could be taken without the other.
 *
 * Squads are **always public**, unlike lineups. The visibility rule protects
 * which eleven you are fielding, because that is what can be exploited. Which
 * players you own was public at the auction while everyone watched you buy
 * them, and knowing who owns whom is a prerequisite for proposing a transfer.
 */
export type ManagerSquads = Record<MatchId, PlayerId[]>

/** The whole node for one league. */
export type LeagueSquads = Record<UserId, ManagerSquads>
