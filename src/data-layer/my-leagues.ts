/**
 * The four My Leagues tabs.
 *
 * One call per tab, which preserves the lazy-load boundary: Archived and
 * Rejected are not fetched until those are opened.
 *
 * **The stored index is not enough, and that is accepted.** A card shows a
 * phase and a filled-slot count, and neither is in `users/{uid}/leagues`. Phase
 * is a function of the current time and nothing can write it; a slot counter
 * would fan out to every member's entry on every join, which is the most
 * frequent write in the model. So these calls read the index and then make a
 * small number of narrow reads per league.
 *
 * **Read `leagues/{leagueId}/leagueMembers`, never `leagues/{leagueId}`.**
 * Reads are subtree-shaped, so reading the league drags its auction config — a
 * base price and category for every player in the tournament — plus the whole
 * gameweek structure. Twenty to thirty kilobytes per league against roughly
 * one, on the page people return to daily. Avoiding that is why the index
 * exists.
 *
 * **The tournament is read once per distinct tournament, not once per league.**
 * Leagues cluster on tournaments.
 */

import type { ArchivedLeagueCard, LeagueCard } from '@/types'
import { notImplemented } from './not-implemented'
import type {
  Subscriber,
  SubscriptionErrorHandler,
  Unsubscribe,
} from './subscriptions'

/**
 * Joined and spectated, merged.
 *
 * **This call also performs the archive migration**, for the current user's own
 * entries only, whenever it meets one that has passed `finishedAt` plus
 * twenty-four hours. Phase 1 has no scheduler, so nothing else would move it.
 * Each user migrates their own subtree, so there is no contention and repeating
 * it is harmless.
 *
 * **One atomic multi-path update**, writing the archived entry and deleting the
 * live one together. Never a write then a delete: RTDB cannot answer "which
 * leagues contain this user", which is the entire reason this index exists, so
 * a lost entry cannot be rebuilt and would hide that league from that person
 * permanently.
 *
 * The migration snapshots their final rank. Best effort — if that computation
 * fails the move still happens and the card omits the position.
 */
export function getActiveLeagues(): Promise<LeagueCard[]> {
  return notImplemented('getActiveLeagues', {})
}

/** Requested but not yet accepted or rejected. */
export function getPendingLeagues(): Promise<LeagueCard[]> {
  return notImplemented('getPendingLeagues', {})
}

/** Reads `users/{uid}/archivedLeagues`, and only when that tab is opened. */
export function getArchivedLeagues(): Promise<ArchivedLeagueCard[]> {
  return notImplemented('getArchivedLeagues', {})
}

/** Fetched only when the side panel is opened. A rejection is soft. */
export function getRejectedLeagues(): Promise<LeagueCard[]> {
  return notImplemented('getRejectedLeagues', {})
}

/** Fires when one of your own pending requests is accepted or rejected. */
export function onJoinRequestResolved(
  callback: Subscriber<LeagueCard>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onJoinRequestResolved', { callback, onError })
}
