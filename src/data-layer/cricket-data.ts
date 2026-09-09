/**
 * The cricket catalogue: competitions, teams, players, formats and matches.
 *
 * System admin only, except for the reads, which everything else joins against.
 *
 * The interface calls a competition a **Base Tournament** — IPL, ODI World Cup
 * — and it never appears under the name "competition" in user-facing copy. A
 * `Tournament` is one running of one.
 */

import type {
  Competition,
  CompetitionConfig,
  CompetitionId,
  FormatRecord,
  Match,
  MatchId,
  Player,
  PlayerConfig,
  PlayerFilter,
  PlayerId,
  Team,
  TeamConfig,
  TeamFilter,
  TeamId,
} from '@/types'
import { notImplemented } from './not-implemented'

// ---------------------------------------------------------------------------
// Competitions
// ---------------------------------------------------------------------------

export function getCompetitions(): Promise<Competition[]> {
  return notImplemented('getCompetitions', {})
}

export function getCompetition(
  competitionId: CompetitionId,
): Promise<Competition> {
  return notImplemented('getCompetition', { competitionId })
}

/**
 * The format is set here and **inherited by every tournament** under this
 * competition, rather than set on each one.
 */
export function createCompetition(
  config: CompetitionConfig,
): Promise<CompetitionId> {
  return notImplemented('createCompetition', { config })
}

export function updateCompetition(
  competitionId: CompetitionId,
  changes: Partial<CompetitionConfig>,
): Promise<void> {
  return notImplemented('updateCompetition', { competitionId, changes })
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

/** By competition, tournament or format. Omitting the filter returns everything. */
export function getTeams(filter?: TeamFilter): Promise<Team[]> {
  return notImplemented('getTeams', { filter })
}

export function createTeam(team: TeamConfig): Promise<TeamId> {
  return notImplemented('createTeam', { team })
}

/** Bulk creation, for setting up a competition in one go. */
export function createTeams(teams: readonly TeamConfig[]): Promise<TeamId[]> {
  return notImplemented('createTeams', { teams })
}

export function updateTeam(
  teamId: TeamId,
  changes: Partial<TeamConfig>,
): Promise<void> {
  return notImplemented('updateTeam', { teamId, changes })
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

/** By team, competition or format. Omitting the filter returns everything. */
export function getPlayers(filter?: PlayerFilter): Promise<Player[]> {
  return notImplemented('getPlayers', { filter })
}

export function createPlayer(player: PlayerConfig): Promise<PlayerId> {
  return notImplemented('createPlayer', { player })
}

export function createPlayers(
  players: readonly PlayerConfig[],
): Promise<PlayerId[]> {
  return notImplemented('createPlayers', { players })
}

/**
 * Does not touch team membership. `setCurrentTeam` is the only writer of that.
 */
export function updatePlayer(
  playerId: PlayerId,
  changes: Partial<PlayerConfig>,
): Promise<void> {
  return notImplemented('updatePlayer', { playerId, changes })
}

// ---------------------------------------------------------------------------
// Team membership
// ---------------------------------------------------------------------------

/**
 * **The only writer of a player's current team.**
 *
 * Current team is per competition, because the same player is in different
 * teams in different ones — India in ODIs is not India in Tests, and a player
 * can retire from T20 internationals and still play the IPL.
 *
 * **There is no per-format retirement call.** Retiring from a competition means
 * removing that competition's entry, which this and its inverse already cover.
 *
 * **The admin flow is: set current teams first, then create the tournament.**
 * Tournament creation prefills from these and never writes back.
 */
export function setCurrentTeam(
  competitionId: CompetitionId,
  playerId: PlayerId,
  teamId: TeamId,
): Promise<void> {
  return notImplemented('setCurrentTeam', {
    competitionId,
    playerId,
    teamId,
  })
}

export function addPlayerToTeam(
  teamId: TeamId,
  playerId: PlayerId,
): Promise<void> {
  return notImplemented('addPlayerToTeam', { teamId, playerId })
}

export function removePlayerFromTeam(
  teamId: TeamId,
  playerId: PlayerId,
): Promise<void> {
  return notImplemented('removePlayerFromTeam', { teamId, playerId })
}

/**
 * Full retirement from cricket, **not per format and not per competition.**
 *
 * This is the one case an empty current-teams map cannot express, since that is
 * otherwise indistinguishable from a newly created player not yet assigned
 * anywhere.
 */
export function markPlayerAsRetired(playerId: PlayerId): Promise<void> {
  return notImplemented('markPlayerAsRetired', { playerId })
}

export function markPlayerAsUnRetired(playerId: PlayerId): Promise<void> {
  return notImplemented('markPlayerAsUnRetired', { playerId })
}

// ---------------------------------------------------------------------------
// Matches and formats
// ---------------------------------------------------------------------------

export function getMatch(matchId: MatchId): Promise<Match> {
  return notImplemented('getMatch', { matchId })
}

/** The reference table. Display names live in the database, not in the union. */
export function getFormats(): Promise<FormatRecord[]> {
  return notImplemented('getFormats', {})
}
