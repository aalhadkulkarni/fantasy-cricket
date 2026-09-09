/**
 * Reading and writing points.
 *
 * **Points are stored per player per match, never per manager.** A manager's
 * total is computed at read time by resolving their lineup and summing, which
 * is why a scoring correction means editing one number and every view is
 * instantly right. Stored totals would mean finding and fixing every manager
 * the mistake touched.
 *
 * **Resolution follows the league's flag, not a search order.** A
 * custom-scoring league reads only its own store. There is no per-match
 * fallback to standard: a match its admin has not entered yet has no points
 * rather than borrowed ones. Falling back would let one league score some
 * matches by its own rules and others by the standard ones, which is worse than
 * showing nothing because nobody would see it happen.
 */

import type {
  LeagueId,
  Match,
  MatchId,
  Player,
  PlayerPoints,
  TournamentId,
} from '@/types'
import { notImplemented } from './not-implemented'

/**
 * Reads custom **or** standard according to the league's
 * `isCustomScoringSystem`. Zero and absent are equivalent; the reason a player
 * scored nothing is not recorded.
 */
export function getPointsForMatch(
  leagueId: LeagueId,
  matchId: MatchId,
): Promise<PlayerPoints> {
  return notImplemented('getPointsForMatch', { leagueId, matchId })
}

// ---------------------------------------------------------------------------
// Custom points entry
// ---------------------------------------------------------------------------

/** Where the admin should be taken next. Absent once everything is scored. */
export function getNextUnscoredMatch(
  leagueId: LeagueId,
): Promise<Match | undefined> {
  return notImplemented('getNextUnscoredMatch', { leagueId })
}

/**
 * Who may be scored for this match, which is not the same question as who a
 * manager may pick — see `getSelectablePlayers` in `lineups.ts`.
 */
export function getEligiblePlayersForMatch(
  leagueId: LeagueId,
  matchId: MatchId,
): Promise<Player[]> {
  return notImplemented('getEligiblePlayersForMatch', { leagueId, matchId })
}

/** To prefill the entry form. Prefill must be reliable — see the write below. */
export function getCustomPointsForMatch(
  leagueId: LeagueId,
  matchId: MatchId,
): Promise<PlayerPoints> {
  return notImplemented('getCustomPointsForMatch', { leagueId, matchId })
}

/**
 * **A full replace.** Blank and zero are equivalent, so submitting rewrites
 * every player's value for that match. Anything missing from `playerPoints` is
 * therefore zeroed, which is why the prefill has to be right.
 *
 * **Writes both index orders in one atomic update**, or the match-major and
 * player-major copies diverge.
 */
export function updateCustomPoints(
  leagueId: LeagueId,
  matchId: MatchId,
  playerPoints: PlayerPoints,
): Promise<void> {
  return notImplemented('updateCustomPoints', {
    leagueId,
    matchId,
    playerPoints,
  })
}

/**
 * Standard points, entered once at tournament level by a system admin and used
 * by every league that has not opted into its own scoring.
 *
 * **Never copied into a league.** Copying would mean applying one correction in
 * every league that opted in.
 *
 * Same dual-write rule as `updateCustomPoints`.
 */
export function updateStandardPoints(
  tournamentId: TournamentId,
  matchId: MatchId,
  playerPoints: PlayerPoints,
): Promise<void> {
  return notImplemented('updateStandardPoints', {
    tournamentId,
    matchId,
    playerPoints,
  })
}
