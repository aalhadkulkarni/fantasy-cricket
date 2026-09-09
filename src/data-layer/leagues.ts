/**
 * Creating a league, reading and editing its configuration, and the standards a
 * new one inherits.
 *
 * Membership is `membership.ts`. The auction runtime is `auction.ts`.
 */

import type {
  CreateLeagueConfig,
  CreatedLeague,
  LeagueConfig,
  LeagueId,
  LeagueJoinCode,
  LeagueSummary,
  LineupRules,
  StandardAuctionConfig,
  UserId,
} from '@/types'
import { notImplemented } from './not-implemented'
import type {
  Subscriber,
  SubscriptionErrorHandler,
  Unsubscribe,
} from './subscriptions'

// ---------------------------------------------------------------------------
// Finding a league
// ---------------------------------------------------------------------------

/**
 * Resolves a typed join code to a league.
 *
 * **A code is a shortcut, not a bypass.** A closed league still requires
 * approval, so finding it this way does not join it.
 */
export function getLeagueByCode(
  leagueJoinCode: LeagueJoinCode,
): Promise<LeagueSummary | undefined> {
  return notImplemented('getLeagueByCode', { leagueJoinCode })
}

// ---------------------------------------------------------------------------
// Creating
// ---------------------------------------------------------------------------

/**
 * Returns the new league's id and its join code.
 *
 * **The code is claimed transactionally** on `leagueCodeToLeagueMapping`,
 * retrying with a fresh one on collision, because a read-then-write check can
 * lose a race.
 *
 * **Creation also writes both indexes in the same atomic multi-path update** —
 * the creator's league index and the tournament's league index. A partial write
 * leaves a league nobody can find.
 */
export function createLeague(
  config: CreateLeagueConfig,
): Promise<CreatedLeague> {
  return notImplemented('createLeague', { config })
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** League home. Name, code, phase, next deadline, your rank. */
export function getLeagueSummary(leagueId: LeagueId): Promise<LeagueSummary> {
  return notImplemented('getLeagueSummary', { leagueId })
}

/**
 * Everything `createLeague` was given, plus which fields are currently
 * editable.
 *
 * Returning the editable set lets the interface reflect the locks without
 * reimplementing them. **The layer rejects a write to a locked field either
 * way** — the form disabling it is convenience, not the guard.
 */
export function getLeagueConfig(leagueId: LeagueId): Promise<LeagueConfig> {
  return notImplemented('getLeagueConfig', { leagueId })
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/**
 * **Rejects a change to a locked field.** The locks are a fairness mechanism,
 * not a convenience: managers must be able to rely on the rules not changing
 * under them once they have committed.
 */
export function updateLeagueConfig(
  leagueId: LeagueId,
  changes: Partial<CreateLeagueConfig>,
): Promise<void> {
  return notImplemented('updateLeagueConfig', { leagueId, changes })
}

/**
 * **One atomic multi-path write.** The auctioneer is recorded twice on purpose
 * — as a role on the membership record, and as `primaryAuctioneer` on the
 * auction config so that showing who it is costs one field read rather than a
 * scan of every member. The two must never be written separately.
 */
export function assignAuctioneer(
  leagueId: LeagueId,
  targetUserId: UserId,
): Promise<void> {
  return notImplemented('assignAuctioneer', { leagueId, targetUserId })
}

/** Same duplication rule as `assignAuctioneer`. */
export function assignBackupAuctioneer(
  leagueId: LeagueId,
  targetUserId: UserId,
): Promise<void> {
  return notImplemented('assignBackupAuctioneer', { leagueId, targetUserId })
}

// ---------------------------------------------------------------------------
// Standards
// ---------------------------------------------------------------------------

/**
 * The auction defaults, and the seed for the create form.
 *
 * **Copied into a league at creation, not resolved at read time.** It holds
 * every player in the system while a league needs only its tournament's
 * participants, so the copy is a projection. And managers bid against these
 * values, so a standard edited mid-season must not retroactively change what a
 * completed auction ran under.
 */
export function getStandardAuctionConfig(): Promise<StandardAuctionConfig> {
  return notImplemented('getStandardAuctionConfig', {})
}

/** Default per-role composition limits. Copied at creation, same as above. */
export function getStandardLineupRules(): Promise<LineupRules> {
  return notImplemented('getStandardLineupRules', {})
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export function onLeagueSummaryChanged(
  leagueId: LeagueId,
  callback: Subscriber<LeagueSummary>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onLeagueSummaryChanged', {
    leagueId,
    callback,
    onError,
  })
}

export function onLeagueConfigChanged(
  leagueId: LeagueId,
  callback: Subscriber<LeagueConfig>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onLeagueConfigChanged', {
    leagueId,
    callback,
    onError,
  })
}
