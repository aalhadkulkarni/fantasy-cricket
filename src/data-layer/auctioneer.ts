/**
 * The auctioneer's controls. Everything here writes authoritative state.
 *
 * **Only the current auctioneer may call any of it**, and control is derived
 * from who holds the role at that moment, so a handover is a data change rather
 * than a navigation problem. Enforced here; the control panel not rendering is
 * convenience.
 *
 * Separated from `auction.ts` because the read/write split is what makes the
 * auction safe without transactions. Bidders write only their own bid; the
 * auctioneer's client is the sole writer of everything below.
 */

import type {
  LeagueId,
  PlayerCategory,
  PlayerRole,
  PlayerId,
  UserId,
} from '@/types'
import { notImplemented } from './not-implemented'
import type {
  Subscriber,
  SubscriptionErrorHandler,
  Unsubscribe,
} from './subscriptions'

// ---------------------------------------------------------------------------
// Opening and closing
// ---------------------------------------------------------------------------

/**
 * **The only thing that creates `liveAuctions/{leagueId}`.** Before this the
 * node does not exist, and its absence is the normal pre-auction state.
 *
 * The phase it opens in is `notStarted`, which means the room is open and the
 * first player is not yet up — not "scheduled for next week".
 */
export function startAuction(leagueId: LeagueId): Promise<void> {
  return notImplemented('startAuction', { leagueId })
}

/**
 * Randomly generated, and **done before any bidding** because a manager's
 * strategy depends on where they sit in the draft.
 */
export function generateDraftOrder(leagueId: LeagueId): Promise<void> {
  return notImplemented('generateDraftOrder', { leagueId })
}

/**
 * The system prompts when the end looks reached, **but the auctioneer decides.**
 */
export function endAuction(leagueId: LeagueId): Promise<void> {
  return notImplemented('endAuction', { leagueId })
}

// ---------------------------------------------------------------------------
// Choosing what is up
// ---------------------------------------------------------------------------

/** **Ids, not display names**, matching how the current batch is stored. */
export function selectBatch(
  leagueId: LeagueId,
  playerCategory: PlayerCategory,
  playerRole: PlayerRole,
): Promise<void> {
  return notImplemented('selectBatch', { leagueId, playerCategory, playerRole })
}

export function selectPlayer(
  leagueId: LeagueId,
  playerId: PlayerId,
): Promise<void> {
  return notImplemented('selectPlayer', { leagueId, playerId })
}

export function selectRandomPlayerFromBatch(leagueId: LeagueId): Promise<void> {
  return notImplemented('selectRandomPlayerFromBatch', { leagueId })
}

// ---------------------------------------------------------------------------
// Running a round
// ---------------------------------------------------------------------------

/**
 * The auctioneer validates an incoming bid against the current asking price and
 * the deadline, then accepts it or ignores it.
 *
 * **Rejection is silence.** There is no reject call — an invalid bid is simply
 * not accepted.
 */
export function acceptBid(
  leagueId: LeagueId,
  playerId: PlayerId,
  managerId: UserId,
  amount: number,
): Promise<void> {
  return notImplemented('acceptBid', {
    leagueId,
    playerId,
    managerId,
    amount,
  })
}

export function acceptNoBid(
  leagueId: LeagueId,
  playerId: PlayerId,
  managerId: UserId,
): Promise<void> {
  return notImplemented('acceptNoBid', { leagueId, playerId, managerId })
}

/**
 * **Manual, deliberately.** The system does not auto-resolve on timeout, so the
 * auctioneer can make allowances for someone with connection trouble.
 *
 * **One atomic write** across bid history, the buyer's squad and their budget.
 * The squad is written here, on every sale, rather than materialised when the
 * auction ends — which is what makes squads correct at every point during it.
 *
 * **The auction does not prevent an illegal squad.** A manager may buy ten
 * batsmen. The consequence lands later, when they cannot field a legal XI.
 */
export function sellPlayer(
  leagueId: LeagueId,
  playerId: PlayerId,
  managerId: UserId,
  amount: number,
): Promise<void> {
  return notImplemented('sellPlayer', {
    leagueId,
    playerId,
    managerId,
    amount,
  })
}

export function markPlayerUnsold(
  leagueId: LeagueId,
  playerId: PlayerId,
): Promise<void> {
  return notImplemented('markPlayerUnsold', { leagueId, playerId })
}

/** Freezes the timer. It resets on resume rather than continuing. */
export function pauseAuction(leagueId: LeagueId): Promise<void> {
  return notImplemented('pauseAuction', { leagueId })
}

export function resumeAuction(leagueId: LeagueId): Promise<void> {
  return notImplemented('resumeAuction', { leagueId })
}

/** Good to have, not essential. For someone with connection trouble. */
export function addTimeToCurrentRound(
  leagueId: LeagueId,
  seconds: number,
): Promise<void> {
  return notImplemented('addTimeToCurrentRound', { leagueId, seconds })
}

/**
 * Undoes a sale or an unsold result, restoring budgets and squad membership and
 * rewriting that player's bid subtree entirely.
 *
 * **Gated behind the `recovering` phase**, which the auctioneer enters
 * deliberately, so a rewind cannot fire mid-round by accident. What enters and
 * leaves that phase, how far back a rewind may go, and who may do either are
 * **deferred to implementation** and not settled here.
 */
export function rewindLastRound(leagueId: LeagueId): Promise<void> {
  return notImplemented('rewindLastRound', { leagueId })
}

// ---------------------------------------------------------------------------
// The draft
// ---------------------------------------------------------------------------

/**
 * Turn-based rather than concurrent, and different from the auction proper.
 * **All draft picks go at base price.**
 *
 * **No round limit.** It continues while valid choices remain, so a single
 * manager with budget and squad space keeps picking after everyone else is
 * done. **A manager who can no longer pick is skipped, not blocked on.**
 */
export function startDraft(leagueId: LeagueId): Promise<void> {
  return notImplemented('startDraft', { leagueId })
}

export function acceptDraftPick(
  leagueId: LeagueId,
  playerId: PlayerId,
  managerId: UserId,
): Promise<void> {
  return notImplemented('acceptDraftPick', { leagueId, playerId, managerId })
}

// ---------------------------------------------------------------------------
// Handover
// ---------------------------------------------------------------------------

/**
 * Takes effect immediately and revokes the previous auctioneer's control. The
 * owner may also reassign at any time, including mid-auction.
 *
 * **One atomic multi-path write** covering both the auctioneer roles on the
 * membership records and `primaryAuctioneer` on the auction config. That
 * duplication is deliberate, so showing who the auctioneer is costs one field
 * read rather than a scan of every member's roles — and the two must never be
 * written separately.
 *
 * Presence detection and automatic failover are Phase 2. For now, if an
 * auctioneer goes silent, an admin reassigns manually.
 */
export function handOffAuctioneerRole(
  leagueId: LeagueId,
  targetUserId: UserId,
): Promise<void> {
  return notImplemented('handOffAuctioneerRole', { leagueId, targetUserId })
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/** The auctioneer's client validates each of these, then accepts or ignores it. */
export function onBidSubmitted(
  leagueId: LeagueId,
  callback: Subscriber<{
    playerId: PlayerId
    managerId: UserId
    amount: number
  }>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onBidSubmitted', { leagueId, callback, onError })
}

export function onNoBidSubmitted(
  leagueId: LeagueId,
  callback: Subscriber<{ playerId: PlayerId; managerId: UserId }>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onNoBidSubmitted', { leagueId, callback, onError })
}

export function onDraftPickSubmitted(
  leagueId: LeagueId,
  callback: Subscriber<{ playerId: PlayerId; managerId: UserId }>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onDraftPickSubmitted', { leagueId, callback, onError })
}
