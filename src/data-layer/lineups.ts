/**
 * The eleven a manager fields, their own and other people's.
 *
 * **Team visibility is enforced here, not in the interface.** A manager's team
 * for a match is returned to anyone else only after that match's deadline. This
 * is the one rule in the product with a real cheating vector behind it, and
 * anyone can read the database directly with the client SDK, so a component
 * hiding the team is convenience rather than the guard.
 *
 * League admins are not exempt. In most leagues the admin also plays, which is
 * exactly why.
 */

import type {
  ChangesRemaining,
  GameWeek,
  GameWeekId,
  GameWeekLineup,
  LeagueId,
  LineupSubmission,
  Match,
  MatchId,
  MatchLineup,
  Player,
  PlayerId,
  Round,
  RoundId,
  UserId,
} from '@/types'
import { notImplemented } from './not-implemented'

// ---------------------------------------------------------------------------
// Where the league currently is
// ---------------------------------------------------------------------------

/**
 * These three are their own reads rather than being taken from league config,
 * because someone may sit on the page long enough for a deadline to pass
 * beneath them.
 */
export function getCurrentRound(leagueId: LeagueId): Promise<Round> {
  return notImplemented('getCurrentRound', { leagueId })
}

export function getCurrentGameWeek(leagueId: LeagueId): Promise<GameWeek> {
  return notImplemented('getCurrentGameWeek', { leagueId })
}

export function getCurrentMatch(leagueId: LeagueId): Promise<Match> {
  return notImplemented('getCurrentMatch', { leagueId })
}

// ---------------------------------------------------------------------------
// Your own team
// ---------------------------------------------------------------------------

/** The lineup for the gameweek, plus the impact sub if one has been made. */
export function getMyTeamForGameWeek(
  leagueId: LeagueId,
  gameWeekId: GameWeekId,
): Promise<GameWeekLineup> {
  return notImplemented('getMyTeamForGameWeek', { leagueId, gameWeekId })
}

export function getMyTeamForMatch(
  leagueId: LeagueId,
  matchId: MatchId,
): Promise<MatchLineup> {
  return notImplemented('getMyTeamForMatch', { leagueId, matchId })
}

/**
 * Regular leagues: the whole tournament pool.
 *
 * An auction league picks from its squad instead — see `getSquad`, which is
 * filtered by match because squad membership changes with transfers.
 */
export function getSelectablePlayers(
  leagueId: LeagueId,
  matchId: MatchId,
): Promise<Player[]> {
  return notImplemented('getSelectablePlayers', { leagueId, matchId })
}

/** Asked per round, because a gameweek league configures allowances per round. */
export function getChangesRemaining(
  leagueId: LeagueId,
  roundId: RoundId,
): Promise<ChangesRemaining> {
  return notImplemented('getChangesRemaining', { leagueId, roundId })
}

// ---------------------------------------------------------------------------
// Other managers' teams
// ---------------------------------------------------------------------------

/**
 * **Returns nothing when the deadline has not passed and the requester is not
 * that manager.** It does not return the team and trust the caller to hide it.
 *
 * Identity comes from context. A client-supplied "who is asking" is exactly the
 * cheating vector this exists to close.
 */
export function getTeamFor(
  leagueId: LeagueId,
  managerId: UserId,
  matchId: MatchId,
): Promise<MatchLineup | undefined> {
  return notImplemented('getTeamFor', { leagueId, managerId, matchId })
}

/**
 * The locked eleven, for highlighting a squad and for the leaderboard's team
 * modal.
 *
 * **An impact sub whose match has not started is not visible here.** Visibility
 * is per match rather than per gameweek precisely because of that.
 */
export function getLockedTeamFor(
  leagueId: LeagueId,
  managerId: UserId,
  matchId: MatchId,
): Promise<MatchLineup | undefined> {
  return notImplemented('getLockedTeamFor', { leagueId, managerId, matchId })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * **An illegal team is rejected here**, not merely disabled in the form.
 *
 * **A team write propagates forward.** It applies to every subsequent match
 * until changed again. The layer owns that behaviour; the interface only warns
 * about it.
 */
export function updateTeamForMatch(
  leagueId: LeagueId,
  matchId: MatchId,
  lineup: LineupSubmission,
): Promise<void> {
  return notImplemented('updateTeamForMatch', { leagueId, matchId, lineup })
}

export function updateTeamForGameWeek(
  leagueId: LeagueId,
  gameWeekId: GameWeekId,
  lineup: LineupSubmission,
): Promise<void> {
  return notImplemented('updateTeamForGameWeek', {
    leagueId,
    gameWeekId,
    lineup,
  })
}

/**
 * One swap during a gameweek, taking effect from a chosen match rather than
 * immediately. The match is chosen from those that have not started, so the set
 * shrinks as play goes on.
 *
 * Neither the captain nor the vice-captain can be subbed, so a sub can never
 * leave the gameweek without one.
 */
export function setImpactSub(
  leagueId: LeagueId,
  gameWeekId: GameWeekId,
  outPlayerId: PlayerId,
  inPlayerId: PlayerId,
  fromMatchId: MatchId,
): Promise<void> {
  return notImplemented('setImpactSub', {
    leagueId,
    gameWeekId,
    outPlayerId,
    inPlayerId,
    fromMatchId,
  })
}
