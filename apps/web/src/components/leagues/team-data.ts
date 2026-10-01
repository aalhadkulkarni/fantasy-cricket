/**
 * Shaping a stored team for the read-only views, shared by My Team and the
 * leaderboard's team modal so the two cannot drift.
 */

import type { SavedTeam } from '@/components/leagues/changes-summary'
import { getPlayerPointsForMatch } from '@/data-layer'
import type {
  GameWeekLineup,
  LeagueId,
  LineupSubmission,
  Match,
  MatchId,
  MatchLineup,
  PlayerId,
  PlayerPoints,
  Team,
} from '@fantasy-cricket/shared'

/**
 * A stored team as the change box reads it. **The remaining counters ride
 * along**, since they are what "of N" is measured from.
 *
 * A gameweek team carries none, because its cap is per transition rather than a
 * running total, so "of N" is the gameweek's cap every time.
 */
export function toSaved(
  team: MatchLineup | GameWeekLineup | LineupSubmission | undefined,
): SavedTeam | undefined {
  if (team === undefined) return undefined

  const lineup = 'startingLineup' in team ? team.startingLineup : team.lineup

  return {
    lineup,
    captainId: team.captainId,
    viceCaptainId: team.viceCaptainId,
    ...('changesRemaining' in team
      ? {
          changesRemaining: team.changesRemaining,
          captainChangesRemaining: team.captainChangesRemaining,
          viceCaptainChangesRemaining: team.viceCaptainChangesRemaining,
        }
      : {}),
  }
}

/** A period's points: summed per player, and as each match scored them. */
export interface PeriodPoints {
  total: PlayerPoints
  /** In the order the matches were asked for, which is fixture order. */
  byMatch: { matchId: MatchId; points: PlayerPoints }[]
}

/**
 * Points across a set of matches, summed per player, **with the per-match
 * figures kept** for the breakdown a gameweek shows on tap.
 *
 * **A gameweek's figure is an aggregate**, which is option 2 in `my-team.md` —
 * one column of totals rather than one column per match, because the per-match
 * table cannot fit a phone without a scroll. The breakdown costs no extra
 * reads: the per-match figures are what the total is summed from. A
 * match-based league passes one match and gets it back unchanged.
 */
export async function gameWeekPoints(
  leagueId: LeagueId,
  matchIds: readonly MatchId[],
): Promise<PeriodPoints> {
  const perMatch = await Promise.all(
    matchIds.map((matchId) => getPlayerPointsForMatch(leagueId, matchId)),
  )

  const total: PlayerPoints = {}
  for (const scores of perMatch) {
    for (const [playerId, value] of Object.entries(scores)) {
      total[playerId as PlayerId] = (total[playerId as PlayerId] ?? 0) + value
    }
  }

  return {
    total,
    byMatch: matchIds.map((matchId, i) => ({
      matchId,
      points: perMatch[i] ?? {},
    })),
  }
}

/** "M2 · IND v AUS", the label a match goes by in a breakdown. */
export function matchLabel(
  match: Match | undefined,
  teams: readonly Team[],
): string {
  if (match === undefined) return 'Match'
  const short = (teamId: string | undefined) =>
    teamId === undefined
      ? 'TBD'
      : (teams.find((t) => t.teamId === teamId)?.teamShortName ?? 'TBD')
  return `M${match.matchNumber} · ${short(match.team1Id)} v ${short(match.team2Id)}`
}
