/**
 * `tournaments/{tournamentId}`.
 *
 * The interface calls this simply a **Tournament**: IPL 2027, one running of a
 * competition. It carries its own matches, rounds and participant lists, plus a
 * thin index of the leagues playing it.
 */

import type {
  CompetitionId,
  LeagueId,
  MatchId,
  PlayerId,
  RoundId,
  TeamId,
  TournamentId,
} from './ids'
import type { LeagueEntry } from './league'

// ---------------------------------------------------------------------------
// Matches and rounds
// ---------------------------------------------------------------------------

/**
 * `matchNumber` is the ordering key, not `matchId`. Ids are opaque push keys
 * and sort by creation time, so anything asking "is this match inside that
 * round" must compare numbers.
 *
 * DERIVED: the deadline. A match locks at `startTimestamp` minus the league's
 * `fantasyLeagueTeamChangesDeadlineOffset`, so it differs per league and cannot
 * live here.
 *
 * DERIVED: whether the match has ended. End times are not stored — add the
 * format's duration to the start. Being slightly wrong is harmless, because
 * deadlines always come from the scheduled start and never shift with delays.
 */
export interface Match {
  matchId: MatchId
  matchNumber: number

  /** Absent until the fixture is known, as in a knockout not yet decided. */
  team1Id?: TeamId
  team2Id?: TeamId

  /**
   * Absent until the date is announced. **A match is created as a placeholder**
   * and filled in from inside the tournament, so an undated match is the normal
   * starting state rather than an error.
   *
   * The publish gate is what guarantees at least match one has one before
   * anybody outside the admin panel can see the tournament.
   */
  startTimestamp?: number

  /** Optional. Extra work for the admin, so absent means show no venue. */
  venue?: string
}

/**
 * A phase of the tournament — group stage, playoffs. Rounds are what make a
 * knockout tail expressible, since gameweeks must be equal length within one.
 *
 * DERIVED: the matches in this round. Everything between `firstMatchId` and
 * `lastMatchId` by `matchNumber`.
 */
export interface Round {
  roundId: RoundId
  roundName: string
  firstMatchId: MatchId
  lastMatchId: MatchId

  /**
   * Eliminated rather than qualified, deliberately: if an admin is slow to
   * update it, managers can still pick their team. Nothing blocks on it.
   *
   * Marked manually, not derived — a team can be mathematically out with league
   * games still to play.
   */
  eliminatedTeams: Partial<Record<TeamId, true>>
}

// ---------------------------------------------------------------------------
// The league index carried on a tournament
// ---------------------------------------------------------------------------

/**
 * One row of the tournament detail page's league list, at
 * `tournaments/{tournamentId}/leagues/{leagueId}`.
 *
 * A denormalised copy, because RTDB cannot filter the global `leagues` node by
 * tournament without one. It holds exactly what the row renders and no more.
 *
 * DERIVED, and deliberately absent: lifecycle status, and slots remaining.
 * Both need reads against the league itself, which is the cost of keeping this
 * index thin.
 */
export interface TournamentLeagueIndexEntry {
  leagueName: string
  isAuctionEnabled: boolean
  leagueEntry: LeagueEntry
  maxSlots: number
}

// ---------------------------------------------------------------------------
// The tournament
// ---------------------------------------------------------------------------

/**
 * DERIVED: which tab this belongs in. Upcoming while `startDate` is in the
 * future, Active once it has passed, Past once `completedAt` is set. Past is
 * deliberately not derived from `endDate`, because that is a *start* time and a
 * Test runs five days — a tournament would leave Active while its final was
 * still being played.
 *
 * JOIN: `competitionId` → `competitions`, and through it the format.
 */
export interface Tournament {
  tournamentId: TournamentId
  tournamentName: string
  competitionId: CompetitionId

  /**
   * Set by a deliberate admin action. Its absence hides the tournament from the
   * list entirely and stops a league being created against it. Gated on at
   * least the first match having a start time.
   */
  publishedAt?: number

  /**
   * The admin asserting the tournament is over. This is what moves it to Past.
   * Never set automatically, because they may still be adding matches they
   * forgot.
   */
  completedAt?: number

  /**
   * Earliest and latest match *start* times. Authoritative for reads and
   * maintained on write: any change to a match start recomputes both in the
   * same atomic update, or they drift and every reader is wrong at once.
   *
   * `endDate` is absent while any match is undated, which is what makes a
   * tournament published with only match one dated behave correctly.
   *
   * **`startDate` is absent too until some match has a date.** A tournament is
   * created with nothing but placeholders, so it has no earliest start yet.
   * `docs/data-model.js` shows it present, but that example is a published
   * tournament, where the publish gate has already guaranteed a dated match.
   */
  startDate?: number
  endDate?: number

  /**
   * FUTURE: a thin team record here instead of a set of ids, so a screen can
   * render a team name without reading the global `teams` node. See
   * `docs/09-future-exploration.md`.
   */
  participatingTeams: Partial<Record<TeamId, true>>

  /**
   * Frozen per tournament, prefilled from `Player.currentTeams` at creation and
   * never written back. A player's club can change without rewriting history.
   *
   * FUTURE: a thin player record here instead of a bare team id. Today nothing
   * renderable lives in this node, so drawing a tournament's players means
   * reading the entire global catalogue to join against two hundred of them.
   * See `docs/09-future-exploration.md`.
   */
  participatingPlayers: Partial<Record<PlayerId, TeamId>>

  /** The reverse of the above, so "who is in this team here" is one read. */
  participatingTeamPlayers: Partial<
    Record<TeamId, Partial<Record<PlayerId, true>>>
  >

  matches: Record<MatchId, Match>
  rounds: Record<RoundId, Round>

  leagues: Record<LeagueId, TournamentLeagueIndexEntry>
}
