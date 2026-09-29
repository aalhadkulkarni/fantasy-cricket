/**
 * `teams/{teamId}`.
 *
 * A real cricket team: RCB, India. Not a fantasy team, which is a name on a
 * league membership.
 */

import type { CompetitionId, PlayerId, TeamId } from './ids'

/**
 * A team's squad is per competition, because the same team name means
 * different players in different competitions — India in ODIs is not India in
 * Tests.
 *
 * JOIN: both maps hold ids only. Competition names are in `competitions`,
 * player names in `players`.
 *
 * DERIVED: whether this team is eliminated. That is per tournament and lives on
 * `tournaments/{tournamentId}/rounds/{roundId}/eliminatedTeams`, not here,
 * because a team is only eliminated from a particular running.
 *
 * NOT MODELLED HERE: a defunct flag. `03-roles.md` says a system admin can mark
 * a team defunct, but the schema has nowhere to record it.
 */
export interface Team {
  teamId: TeamId
  teamName: string
  teamShortName: string

  /** Which competitions this team plays in. */
  competitionIds: Partial<Record<CompetitionId, true>>

  /** Squad per competition. The reverse of `Player.currentTeams`. */
  playerIds: Partial<Record<CompetitionId, Partial<Record<PlayerId, true>>>>
}
