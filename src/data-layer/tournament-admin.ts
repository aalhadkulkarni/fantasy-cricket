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
  TournamentRoundConfig,
} from '@/types'
import { getApi } from './api'
import { notImplemented } from './not-implemented'

/**
 * The tournament, its placeholder matches, and **one round covering all of
 * them**, in one write.
 *
 * Teams and players are not set here — `updateTournamentParticipants` does
 * that, with the same editor that changes them later. The format is not set
 * either; it comes from the base tournament.
 */
export function createTournament(
  config: TournamentConfig,
): Promise<TournamentId> {
  return getApi().createTournament(config)
}

export function renameTournament(
  tournamentId: TournamentId,
  tournamentName: string,
): Promise<void> {
  return getApi().renameTournament(tournamentId, tournamentName)
}

/**
 * Who is playing, as a map of player to **the team they play for in this
 * tournament**.
 *
 * One argument rather than teams and players separately, because a player
 * already names their team and two arguments could disagree.
 *
 * **Prefilled from each player's current team and never written back.** That
 * freeze is the point: a player's club can change without rewriting which team
 * they played for in a finished season.
 */
export function updateTournamentParticipants(
  tournamentId: TournamentId,
  participants: Partial<Record<PlayerId, TeamId>>,
): Promise<void> {
  return getApi().updateTournamentParticipants(tournamentId, participants)
}

/**
 * **Recomputes `startDate` and `endDate` in the same atomic write.**
 *
 * Each config is the full state of that match, so an absent field clears the
 * stored one — which is what lets a date or a fixture be taken back.
 */
export function updateMatches(
  tournamentId: TournamentId,
  matchConfigs: readonly MatchConfig[],
): Promise<void> {
  return getApi().updateMatches(tournamentId, matchConfigs)
}

/**
 * Appends placeholders and **extends the final round to cover them**, so every
 * match still belongs to exactly one round.
 *
 * Adding matches to a tournament already under way is expected rather than
 * exceptional.
 */
export function addMatches(
  tournamentId: TournamentId,
  count: number,
): Promise<void> {
  return getApi().addMatches(tournamentId, count)
}

/**
 * **The one delete in this admin.** Matches come off the end only, and only
 * while the tournament is unpublished.
 *
 * Off the end because `matchNumber` is the ordering key, and removing from the
 * middle would renumber everything after it — silently moving every round and
 * gameweek boundary defined against those numbers.
 *
 * Unpublished because that is the window in which nothing can reference a
 * match. A league cannot exist against an unpublished tournament, so there are
 * no lineups and no points to strand, which is the reason nothing else here
 * deletes.
 *
 * Rounds are trimmed with them, and one left holding nothing goes too.
 */
export function removeMatches(
  tournamentId: TournamentId,
  count: number,
): Promise<void> {
  return getApi().removeMatches(tournamentId, count)
}

/**
 * The whole round structure at once, **in match numbers rather than ids**.
 *
 * The rounds must tile the matches exactly: start at match one, no gaps, no
 * overlaps, ending at the last match. A match in no round could never fall in a
 * gameweek, so it could never be played.
 *
 * Replacing the set rather than splitting and merging separately keeps that
 * rule in one place, and lets a mistaken split be undone — which matters when
 * nothing here deletes.
 */
export function setRounds(
  tournamentId: TournamentId,
  rounds: readonly TournamentRoundConfig[],
): Promise<void> {
  return getApi().setRounds(tournamentId, rounds)
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
