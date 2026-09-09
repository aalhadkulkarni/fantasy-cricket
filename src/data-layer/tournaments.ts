/**
 * Reading tournaments and everything scoped to one.
 *
 * The interface calls these Tournaments. The level above them, `competitions`,
 * is a system-admin concept and lives in `cricket-data.ts`.
 *
 * Creating and maintaining a tournament is `tournament-admin.ts`.
 */

import type {
  JoinableLeague,
  Match,
  Player,
  Round,
  Team,
  Tournament,
  TournamentFilter,
  TournamentId,
  TournamentLeagueIndexEntry,
} from '@/types'
import { getApi } from './api'
import { notImplemented } from './not-implemented'
import type {
  Subscriber,
  SubscriptionErrorHandler,
  Unsubscribe,
} from './subscriptions'

/**
 * **Published only for a non-admin caller.** A tournament with no `publishedAt`
 * is never returned to one, so it cannot be seen or have a league created
 * against it. A system admin sees drafts too; that is decided from context, not
 * from a parameter.
 *
 * Which tab a tournament belongs in is derived: Upcoming while `startDate` is
 * in the future, Active once it has passed, Past once `completedAt` is set.
 * **Past is deliberately not derived from `endDate`**, which is a *start* time
 * — a Test runs five days, so a tournament would leave Active while its final
 * was still being played.
 *
 * **Filtering is client-side** beyond this. The list is small and already
 * fetched.
 */
export function getTournaments(
  filter?: TournamentFilter,
): Promise<Tournament[]> {
  return getApi().getTournaments(filter)
}

/** Those carrying a `publishedAt`. This populates the create-league dropdown. */
export function getPublishedTournaments(): Promise<Tournament[]> {
  return notImplemented('getPublishedTournaments', {})
}

/**
 * The whole tournament, **including its matches and rounds**. They live inside
 * it, so this is one read rather than three.
 */
export function getTournament(tournamentId: TournamentId): Promise<Tournament> {
  return getApi().getTournament(tournamentId)
}

/**
 * Every match, in `matchNumber` order.
 *
 * **`matchNumber` is the ordering key, never `matchId`.** Ids are push keys and
 * sort by creation time, so anything asking "is this match inside that round"
 * compares numbers.
 */
export function getFixtures(tournamentId: TournamentId): Promise<Match[]> {
  return notImplemented('getFixtures', { tournamentId })
}

export function getTeamsForTournament(
  tournamentId: TournamentId,
): Promise<Team[]> {
  return notImplemented('getTeamsForTournament', { tournamentId })
}

/**
 * The players in this tournament, resolved.
 *
 * **This is the read the whole app leans on.** Every screen that names a player
 * resolves against this list rather than fetching players one at a time.
 *
 * Today it is expensive in a way its signature hides: the tournament's
 * participant map holds ids and team ids only, so the names have to come from
 * the global `players` node, and there is no query that fetches a chosen two
 * hundred. See item 1 in `docs/09-future-exploration.md`.
 */
export function getPlayersForTournament(
  tournamentId: TournamentId,
): Promise<Player[]> {
  return notImplemented('getPlayersForTournament', { tournamentId })
}

/**
 * Every league on this tournament, **public and closed alike**. Closed leagues
 * are visible to everyone; only entry is restricted, which is why a join code
 * is a shortcut rather than the access mechanism.
 *
 * Carries how full each one is, which nothing stores. See the type.
 */
export function getLeaguesForTournament(
  tournamentId: TournamentId,
): Promise<JoinableLeague[]> {
  return getApi().getLeaguesForTournament(tournamentId)
}

/**
 * Needed to configure gameweeks, which are equal length within a round. That is
 * what makes rounds necessary: a sixty-match group stage divides evenly and a
 * four-match knockout tail does not.
 */
export function getRoundsForTournament(
  tournamentId: TournamentId,
): Promise<Round[]> {
  return notImplemented('getRoundsForTournament', { tournamentId })
}

export function onLeagueAddedToTournament(
  tournamentId: TournamentId,
  callback: Subscriber<TournamentLeagueIndexEntry>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onLeagueAddedToTournament', {
    tournamentId,
    callback,
    onError,
  })
}
