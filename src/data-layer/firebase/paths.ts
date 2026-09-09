/**
 * Every path in the database, built beneath the active environment root.
 *
 * **This is how the environment reaches the rest of the layer.** The service's
 * `path` method alone would only be a helper that call sites were free to
 * forget. Naming every node here, and building each one through the service,
 * means there is no way to address the database without the environment prefix
 * coming with it.
 *
 * One entry per top-level node in `docs/data-model.js`, twenty-nine of them,
 * with their deeper segments typed by the branded id that keys them. Passing
 * nothing gives the node itself, which is what a subtree read wants.
 *
 *     paths.leagues()                          // local/leagues
 *     paths.leagues(leagueId)                  // local/leagues/{leagueId}
 *     paths.matchBasedLineups(leagueId, userId, matchId)
 *
 * **Not exported above this layer.** A path is pure schema, and the fifth
 * boundary rule is that the schema does not leak upward. Nothing outside
 * `src/data-layer/` should ever need one.
 *
 * ---
 *
 * ## TODO — not yet wired into anything
 *
 * **No function in this layer calls these paths yet, because Firebase is not
 * installed and nothing is implemented.** Every one of the 143 functions still
 * returns `notImplemented`.
 *
 * When implementation starts, each function reads and writes through these
 * builders rather than composing strings of its own. That is the whole point of
 * having them: the environment routing is in place first, so it never has to be
 * retrofitted across a layer that already works without it.
 *
 * The remaining pieces, in order:
 *
 * 1. Install the Firebase SDK and initialise the app.
 * 2. Hold the database handle on the service in `firebase-service.ts`.
 * 3. Implement the functions, addressing everything through `paths`.
 * 4. Fill in the three hostnames in `src/config/environments.ts` and clear the
 *    forced override — see G9.
 */

import type {
  CompetitionId,
  Format,
  GameWeekId,
  LeagueId,
  LeagueJoinCode,
  MatchId,
  PlayerCategory,
  PlayerId,
  PlayerRole,
  TeamId,
  TournamentId,
  TransferProposalId,
  UserId,
  UserRole,
} from '@/types'
import { getFirebaseService, type DbPath } from './firebase-service'

/**
 * Joins the segments that were supplied, and **refuses a gap**.
 *
 * A path is a prefix chain: there is no way to ask for a league's members
 * without naming the league. Passing the third segment while leaving the second
 * undefined is a mistake at the call site, and quietly returning the shorter
 * path would hand back a subtree far larger than the one asked for.
 */
function under(
  node: string,
  ...segments: readonly (string | undefined)[]
): DbPath {
  const supplied: string[] = []
  let ended = false

  for (const segment of segments) {
    if (segment === undefined) {
      ended = true
      continue
    }
    if (ended) {
      throw new Error(
        `data-layer: path "${node}" was given a segment after an omitted one. ` +
          `Segments fill in order and cannot be skipped.`,
      )
    }
    supplied.push(segment)
  }

  return getFirebaseService().path(node, ...supplied)
}

export const paths = {
  // -------------------------------------------------------------------------
  // Reference tables — fixed enums stored as data, keyed semantically
  // -------------------------------------------------------------------------

  userRoles: (userRole?: UserRole) => under('userRoles', userRole),
  formats: (format?: Format) => under('formats', format),
  playerRoles: (playerRole?: PlayerRole) => under('playerRoles', playerRole),
  playerCategories: (playerCategory?: PlayerCategory) =>
    under('playerCategories', playerCategory),
  liveAuctionPhases: (auctionPhase?: string) =>
    under('liveAuctionPhases', auctionPhase),
  timelineEvents: (timelineEventId?: string) =>
    under('timelineEvents', timelineEventId),

  // -------------------------------------------------------------------------
  // Standards — copied into a league at creation, never resolved at read time
  // -------------------------------------------------------------------------

  /**
   * Written by the setup routine, read before it runs. Not a reference table —
   * a marker saying this environment has been seeded.
   */
  systemSetup: () => under('systemSetup'),

  standardAuctionConfig: () => under('standardAuctionConfig'),
  standardFantasyLineupRules: () => under('standardFantasyLineupRules'),
  standardFantasyLeagueTeamChangesDeadlineOffset: () =>
    under('standardFantasyLeagueTeamChangesDeadlineOffset'),

  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  /** Keyed by the Firebase Auth UID. There is no translation table. */
  users: (userId?: UserId) => under('users', userId),

  // -------------------------------------------------------------------------
  // Cricket
  // -------------------------------------------------------------------------

  competitions: (competitionId?: CompetitionId) =>
    under('competitions', competitionId),
  teams: (teamId?: TeamId) => under('teams', teamId),
  players: (playerId?: PlayerId) => under('players', playerId),
  tournaments: (tournamentId?: TournamentId) =>
    under('tournaments', tournamentId),

  // -------------------------------------------------------------------------
  // Leagues
  // -------------------------------------------------------------------------

  /**
   * Config and thin membership only. **Reading this drags the whole auction
   * config and gameweek structure**, which is why My Leagues reads
   * `leagues/{leagueId}/leagueMembers` instead.
   */
  leagues: (leagueId?: LeagueId) => under('leagues', leagueId),

  /** Where a join code is **claimed transactionally** at creation. */
  leagueCodeToLeagueMapping: (leagueJoinCode?: LeagueJoinCode) =>
    under('leagueCodeToLeagueMapping', leagueJoinCode),

  // -------------------------------------------------------------------------
  // Everything a league accumulates, split out so reading a league stays cheap
  // -------------------------------------------------------------------------

  matchBasedLineups: (
    leagueId?: LeagueId,
    userId?: UserId,
    matchId?: MatchId,
  ) => under('matchBasedLineups', leagueId, userId, matchId),

  gameWeekBasedLineups: (
    leagueId?: LeagueId,
    userId?: UserId,
    gameWeekId?: GameWeekId,
  ) => under('gameWeekBasedLineups', leagueId, userId, gameWeekId),

  squads: (leagueId?: LeagueId, userId?: UserId, matchId?: MatchId) =>
    under('squads', leagueId, userId, matchId),

  joinRequests: (leagueId?: LeagueId, userId?: UserId) =>
    under('joinRequests', leagueId, userId),

  bannedUsers: (leagueId?: LeagueId, userId?: UserId) =>
    under('bannedUsers', leagueId, userId),

  transferProposals: (
    leagueId?: LeagueId,
    transferProposalId?: TransferProposalId,
  ) => under('transferProposals', leagueId, transferProposalId),

  transferProposalsByManager: (leagueId?: LeagueId, userId?: UserId) =>
    under('transferProposalsByManager', leagueId, userId),

  /** **Does not exist until `startAuction` creates it.** Absence is normal. */
  liveAuctions: (leagueId?: LeagueId) => under('liveAuctions', leagueId),

  // -------------------------------------------------------------------------
  // Points — per player per match, never per manager
  // -------------------------------------------------------------------------

  /**
   * These two hold the **same values in both directions**, so a correction has
   * to write both paths in the same atomic update or the copies diverge
   * silently. Same for the custom pair below.
   */
  standardPointsByMatch: (tournamentId?: TournamentId, matchId?: MatchId) =>
    under('standardPointsByMatch', tournamentId, matchId),

  standardPointsByPlayer: (tournamentId?: TournamentId, playerId?: PlayerId) =>
    under('standardPointsByPlayer', tournamentId, playerId),

  customPointsByMatch: (leagueId?: LeagueId, matchId?: MatchId) =>
    under('customPointsByMatch', leagueId, matchId),

  customPointsByPlayer: (leagueId?: LeagueId, playerId?: PlayerId) =>
    under('customPointsByPlayer', leagueId, playerId),
} as const
