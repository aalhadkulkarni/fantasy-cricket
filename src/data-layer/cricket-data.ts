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
  PlayerRoleRecord,
  Team,
  TeamConfig,
  TeamFilter,
  TeamId,
} from '@/types'
import { getApi, type CreatePlayersResult } from './api'

export type { CreatePlayersResult }
import { notImplemented } from './not-implemented'

// ---------------------------------------------------------------------------
// Competitions
// ---------------------------------------------------------------------------

export function getCompetitions(): Promise<Competition[]> {
  return getApi().getCompetitions()
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

/**
 * By competition, tournament or format. Omitting the filter returns everything.
 *
 * Sorted by name, because every screen that shows teams shows them as a list
 * and nothing else would give a stable order.
 */
export function getTeams(filter?: TeamFilter): Promise<Team[]> {
  return getApi().getTeams(filter)
}

export function createTeam(team: TeamConfig): Promise<TeamId> {
  return getApi().createTeam(team)
}

/** Bulk creation, for setting up a competition in one go. */
export function createTeams(teams: readonly TeamConfig[]): Promise<TeamId[]> {
  return notImplemented('createTeams', { teams })
}

/**
 * **Removing a competition takes the team out of it entirely** — its roster
 * there goes with it, and so does every affected player's record of playing for
 * it. That is the closest thing this admin has to a delete, and it is
 * deliberate: nothing here destroys a team outright, because a team removed
 * from its competitions is already out of every tournament that could draw on
 * it.
 */
export function updateTeam(
  teamId: TeamId,
  changes: Partial<TeamConfig>,
): Promise<void> {
  return getApi().updateTeam(teamId, changes)
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

/**
 * By team, competition, role or format. Omitting the filter returns everyone
 * **except the fully retired**, who drop out of the list entirely.
 */
export function getPlayers(filter?: PlayerFilter): Promise<Player[]> {
  return getApi().getPlayers(filter)
}

/** One player. A thin wrapper over the bulk call, which does the real work. */
export async function createPlayer(
  player: PlayerConfig,
): Promise<CreatePlayersResult> {
  return createPlayers([player])
}

/**
 * **Players and their team memberships in one atomic write.** Each membership
 * has a reverse side on the team, and half of that pairing is worse than none.
 *
 * Names that already exist are skipped rather than duplicated, and reported, so
 * re-adding a squad is safe.
 */
export function createPlayers(
  players: readonly PlayerConfig[],
): Promise<CreatePlayersResult> {
  return getApi().createPlayers(players)
}

/**
 * Fields only. Team membership goes through `addPlayerToTeam` and
 * `removePlayerFromTeam`, each of which has to touch the team side too.
 */
export function updatePlayer(
  playerId: PlayerId,
  changes: Partial<PlayerConfig>,
): Promise<void> {
  return getApi().updatePlayer(playerId, changes)
}

// ---------------------------------------------------------------------------
// Team membership
// ---------------------------------------------------------------------------

/**
 * **Adding is moving.** There is one team per competition, so setting a new one
 * necessarily unsets the old — and the old team's roster entry goes with it, in
 * the same atomic update. Splitting that into remove-then-add would leave a
 * window where the player is in neither.
 *
 * Membership is per competition because the same player is in different teams
 * in different ones: India in ODIs is not Mumbai Indians in the IPL.
 *
 * **The admin flow is: set teams first, then create the tournament.** Tournament
 * creation prefills from these and never writes back.
 */
export function addPlayerToTeam(
  playerId: PlayerId,
  teamId: TeamId,
  competitionId: CompetitionId,
): Promise<void> {
  return getApi().addPlayerToTeam(playerId, teamId, competitionId)
}

/**
 * **Also how "retired from this competition" is expressed.** There is no
 * per-format retirement flag, because a player can retire from T20
 * internationals and still play the IPL, so a format-level answer would be
 * wrong at the source.
 *
 * No team argument: there is only one per competition, and passing it would
 * invite a caller to pass the wrong one.
 */
export function removePlayerFromTeam(
  playerId: PlayerId,
  competitionId: CompetitionId,
): Promise<void> {
  return getApi().removePlayerFromTeam(playerId, competitionId)
}

/**
 * Full retirement from cricket, **not per format and not per competition.**
 *
 * The one case an empty team map cannot express, since that is otherwise
 * indistinguishable from a newly created player not yet assigned anywhere.
 *
 * A retired player drops out of the player list, and there is no screen that
 * lists them — a Retired Players view is deferred to Phase 2.
 */
export function setPlayerRetired(
  playerId: PlayerId,
  isRetired: boolean,
): Promise<void> {
  return getApi().setPlayerRetired(playerId, isRetired)
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

/** Likewise. Anything rendering a player's role needs these for its names. */
export function getPlayerRoles(): Promise<PlayerRoleRecord[]> {
  return getApi().getPlayerRoles()
}
