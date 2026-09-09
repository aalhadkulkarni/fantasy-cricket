/**
 * The players a manager owns, in an auction league. A regular league has no
 * squads — its managers pick from the whole tournament pool.
 *
 * Do not confuse with a lineup. A squad is what you own; a lineup is the eleven
 * you field out of it.
 *
 * **Both calls take a match, because squad membership changes over time.** After
 * a transfer the incoming player is available from the next match onward, so
 * "the squad" is always the squad *at some match*. The squad at match 25 is not
 * the squad at match 35, and the player dropdown for a match depends on what
 * was owned then rather than what is owned now.
 *
 * **Squads are always public**, unlike lineups. The visibility rule protects
 * which eleven you are fielding, because that is what can be exploited. Who you
 * own was public at the auction while everyone watched you buy them, and it is
 * a prerequisite for proposing a transfer.
 *
 * NOTE: these return `Player[]`, following the rule that reads return resolved
 * entities. `ManagerSquads` in `src/types/squad.ts` still describes the stored
 * node, which holds ids — that type has not been changed.
 */

import type { LeagueId, MatchId, Player, UserId } from '@/types'
import { notImplemented } from './not-implemented'

/** Your own, at a given match. */
export function getSquad(
  leagueId: LeagueId,
  matchId: MatchId,
): Promise<Player[]> {
  return notImplemented('getSquad', { leagueId, matchId })
}

/** Everyone's, at a given match. Also what the transfer offer builder reads. */
export function getAllSquads(
  leagueId: LeagueId,
  matchId: MatchId,
): Promise<Record<UserId, Player[]>> {
  return notImplemented('getAllSquads', { leagueId, matchId })
}
