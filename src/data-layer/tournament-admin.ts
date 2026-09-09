/**
 * Creating and maintaining tournaments. System admin only.
 *
 * **Tournament timing is maintained on write, never derived on read.**
 * `startDate` and `endDate` are the earliest and latest match *start* times,
 * and they are the only thing anything reads to place a tournament in a tab or
 * to find a league's first deadline. Any write touching a match start must
 * recompute both in the same atomic update, or they drift and every reader is
 * wrong at once. `endDate` stays absent while any match is undated, which is
 * what makes a tournament published with only match one dated behave correctly.
 */

import type {
  MatchConfig,
  PlayerId,
  TeamId,
  TournamentConfig,
  TournamentId,
} from '@/types'
import { notImplemented } from './not-implemented'

/**
 * **Reads each player's current team to prefill the tournament-scoped mapping,
 * and never writes back.** That freeze is the point: a player's club can change
 * without rewriting which team they played for in a finished season.
 */
export function createTournament(
  config: TournamentConfig,
): Promise<TournamentId> {
  return notImplemented('createTournament', { config })
}

/** Also maintains the reverse map, so "who is in this team here" stays one read. */
export function updateTournamentPlayers(
  tournamentId: TournamentId,
  players: Partial<Record<PlayerId, TeamId>>,
): Promise<void> {
  return notImplemented('updateTournamentPlayers', { tournamentId, players })
}

/** **Recomputes `startDate` and `endDate` in the same atomic write.** */
export function updateMatch(
  tournamentId: TournamentId,
  matchConfig: MatchConfig,
): Promise<void> {
  return notImplemented('updateMatch', { tournamentId, matchConfig })
}

/** Same recomputation rule, once for the whole batch. */
export function updateMatches(
  tournamentId: TournamentId,
  matchConfigs: readonly MatchConfig[],
): Promise<void> {
  return notImplemented('updateMatches', { tournamentId, matchConfigs })
}

/**
 * Sets `publishedAt`. **Rejected here if no match has a start time yet**, rather
 * than merely disabled in the admin interface.
 *
 * Its absence hides the tournament from the list entirely and stops a league
 * being created against it.
 */
export function publishTournament(tournamentId: TournamentId): Promise<void> {
  return notImplemented('publishTournament', { tournamentId })
}

/**
 * **Eliminated rather than qualified, deliberately:** if an admin is slow to
 * update it, managers can still pick their team. Nothing blocks on it.
 *
 * Marked by hand, not derived — a team can be mathematically out with league
 * games still to play.
 */
export function markTeamEliminated(
  tournamentId: TournamentId,
  teamId: TeamId,
  fromMatchId: string,
): Promise<void> {
  return notImplemented('markTeamEliminated', {
    tournamentId,
    teamId,
    fromMatchId,
  })
}

/**
 * Sets `completedAt`, which is what moves a tournament to Past.
 *
 * **Never set automatically**, because an admin may still be adding matches
 * they forgot. The layer only records the assertion that everything is in.
 */
export function markTournamentComplete(
  tournamentId: TournamentId,
): Promise<void> {
  return notImplemented('markTournamentComplete', { tournamentId })
}
