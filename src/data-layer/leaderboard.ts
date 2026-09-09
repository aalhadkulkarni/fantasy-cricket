/**
 * Standings, computed on the fly.
 *
 * **Each call is one subtree read plus arithmetic, never one call per
 * manager.** Read the league's lineups node once — `matchBasedLineups/{id}` or
 * `gameWeekBasedLineups/{id}` — read the points node once, and compute here. At
 * twenty managers and sixty-four matches that is roughly a hundred kilobytes
 * across three reads and single-digit milliseconds of work.
 *
 * There is no materialised alternative. Standard points cannot be pre-computed
 * into every league for every manager, and storing totals would mean a
 * correction had to chase every manager it touched.
 *
 * **The multipliers are fixed: 2x for the captain, 1.5x for the vice-captain.**
 * The vice-captain is **not** promoted to 2x when the captain does not play.
 * Transfer point adjustments are layered on top, and are the single exception to
 * points never being stored per manager.
 *
 * **Ties share a rank and subsequent ranks are offset by the number tied**, so
 * ranks are not dense. Pre-season everyone is on zero, so by the same rule
 * everyone is rank one and the ordering within that is arbitrary.
 *
 * That whole computation belongs on a server, and this is the Phase 1 server.
 */

import type {
  GameWeekId,
  LeaderboardRow,
  LeagueId,
  MatchId,
  ScoringWatermark,
} from '@/types'
import { notImplemented } from './not-implemented'

/** Overall, which is what the page opens on. */
export function getLeaderboard(leagueId: LeagueId): Promise<LeaderboardRow[]> {
  return notImplemented('getLeaderboard', { leagueId })
}

/** **Only locked gameweeks may be asked for.** A gameweek locks at its first match's deadline. */
export function getLeaderboardForGameWeek(
  leagueId: LeagueId,
  gameWeekId: GameWeekId,
): Promise<LeaderboardRow[]> {
  return notImplemented('getLeaderboardForGameWeek', { leagueId, gameWeekId })
}

/**
 * **Only locked matches may be asked for.** A match locks at its scheduled
 * start minus the league's team-changes offset.
 *
 * **Locked is not the same as scored.** A match can have started without its
 * points being in, in which case this has nothing to report and the interface
 * says so rather than showing zeroes.
 */
export function getLeaderboardForMatch(
  leagueId: LeagueId,
  matchId: MatchId,
): Promise<LeaderboardRow[]> {
  return notImplemented('getLeaderboardForMatch', { leagueId, matchId })
}

/**
 * The match up to which points are entered, for the "Points calculated till
 * match X" label.
 *
 * **Always expressed in matches, never gameweeks.** Points are match-based
 * whichever kind of league this is. This makes the scoring frontier visible
 * instead of leaving people to guess why the standings look stale.
 */
export function getScoringWatermark(
  leagueId: LeagueId,
): Promise<ScoringWatermark> {
  return notImplemented('getScoringWatermark', { leagueId })
}
