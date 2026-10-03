/**
 * The players a manager owns, in an auction league. A regular league has no
 * squads — its managers pick from the whole tournament pool.
 *
 * Do not confuse with a lineup. A squad is what you own; a lineup is the eleven
 * you field out of it.
 *
 * **Squad membership changes over time.** After a transfer the incoming player
 * is available from the next match onward, so "the squad" is always the squad
 * *at some match*. The Squads page shows it at the current match; My Team asks
 * for the match it is picking for.
 *
 * **Squads are always public**, unlike lineups. The visibility rule protects
 * which eleven you are fielding, because that is what can be exploited. Who you
 * own was public at the auction while everyone watched you buy them, and it is
 * a prerequisite for proposing a transfer.
 *
 * **One read for the Squads page**, rather than a squad per manager and a team
 * per manager: every squad, what each player went for, and the eleven to
 * highlight — your own saved XI, anyone else's latest locked one.
 */

import type { LeagueId, SquadsView } from '@fantasy-cricket/shared'

import { getApi } from './api'

export type { SquadsView }

/** Every manager's squad in an auction league, with the XI to highlight. */
export function getSquads(leagueId: LeagueId): Promise<SquadsView> {
  return getApi().getSquads(leagueId)
}
