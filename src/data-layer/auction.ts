/**
 * The auction as everyone sees it, plus the only two writes a bidder makes.
 *
 * The auctioneer's controls are `auctioneer.ts`. **That split is the design,
 * not tidiness.** Bidders write only to their own bid and pass fields for the
 * current player; the auctioneer's client is the sole writer of authoritative
 * state — the current player, the leading bid, the asking price, the deadline.
 * Because bidders cannot touch authoritative state there is nothing to contend
 * over, which is why none of this needs transactions.
 *
 * **There is a known race.** The auctioneer may read one manager's bid before
 * another's even when the other wrote first. This has run through multiple real
 * auctions. It is accepted and must not be "fixed".
 *
 * **`liveAuctions/{leagueId}` does not exist until `startAuction` creates it.**
 * Its absence is the normal pre-auction state, where a league sits for weeks
 * while My Leagues reads it. Treating that as an error, or dereferencing it
 * unguarded, is the likeliest null-reference bug in the product.
 */

import type {
  AuctionManagerStatus,
  AuctionPoolPlayer,
  AuctionState,
  DraftOrderEntry,
  LeagueId,
  Player,
  PlayerBiddingHistory,
  PlayerId,
  TimelineMessage,
} from '@/types'
import { notImplemented } from './not-implemented'
import type {
  Subscriber,
  SubscriptionErrorHandler,
  Unsubscribe,
} from './subscriptions'

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Current player, phase, batch, leading bid, minimum next bid, deadline.
 *
 * **Needed as a read and not only a subscription**, because a client joining
 * mid-round has no transition to receive.
 *
 * The countdown is not here. Every client computes it against Firebase server
 * time from the deadline, never against the local clock.
 */
export function getAuctionState(
  leagueId: LeagueId,
): Promise<AuctionState | undefined> {
  return notImplemented('getAuctionState', { leagueId })
}

/** Every player up for auction, with this league's category and base price. */
export function getAuctionPlayerPool(
  leagueId: LeagueId,
): Promise<AuctionPoolPlayer[]> {
  return notImplemented('getAuctionPlayerPool', { leagueId })
}

export function getSoldPlayers(leagueId: LeagueId): Promise<Player[]> {
  return notImplemented('getSoldPlayers', { leagueId })
}

/**
 * **Unsold players re-enter at the draft.** Everyone unsold during Marquee and
 * Star is available there, and should be visibly marked as previously unsold.
 */
export function getUnsoldPlayers(leagueId: LeagueId): Promise<Player[]> {
  return notImplemented('getUnsoldPlayers', { leagueId })
}

/** Neither sold nor marked unsold yet. */
export function getRemainingPlayers(leagueId: LeagueId): Promise<Player[]> {
  return notImplemented('getRemainingPlayers', { leagueId })
}

/** The managers table: name, budget, number of players held. */
export function getManagerStatuses(
  leagueId: LeagueId,
): Promise<AuctionManagerStatus[]> {
  return notImplemented('getManagerStatuses', { leagueId })
}

/**
 * Generated at the very start, before any bidding, because a manager's strategy
 * depends on where they sit. **It snakes** — 1 to 6, then 6 back to 1,
 * repeating. Empty until the auctioneer generates it.
 */
export function getDraftOrder(leagueId: LeagueId): Promise<DraftOrderEntry[]> {
  return notImplemented('getDraftOrder', { leagueId })
}

/**
 * Every bid on one player, in order.
 *
 * **Never fetched with the page.** The full history for every player is the
 * entire auction, so it is read one player at a time, when asked for.
 */
export function getPlayerBiddingHistory(
  leagueId: LeagueId,
  playerId: PlayerId,
): Promise<PlayerBiddingHistory> {
  return notImplemented('getPlayerBiddingHistory', { leagueId, playerId })
}

// ---------------------------------------------------------------------------
// Bidder writes
// ---------------------------------------------------------------------------

/**
 * Writes **only** to the bidder's own path for the current player. That is the
 * entire reason the auction is safe without transactions.
 *
 * **Every bid is the current asking price**, which rises by a fixed 0.5
 * regardless of the player's value. Neither the increment nor the thirty-second
 * round timer is configurable in Phase 1.
 *
 * **Rejected** if the bidder has already passed on this player, or if the bid
 * would overdraw their budget.
 */
export function submitBid(
  leagueId: LeagueId,
  playerId: PlayerId,
  amount: number,
): Promise<void> {
  return notImplemented('submitBid', { leagueId, playerId, amount })
}

/**
 * **Passing is irreversible for that round.** Once a bidder passes they are out
 * until the next player.
 *
 * If a pass could be withdrawn, the rule that resolves a round — everyone
 * except the leader has passed, so it sells — becomes unstable, and a resolved
 * round could be un-resolved by someone changing their mind. This departs from
 * a real auction and that cost is accepted for a rule that terminates cleanly.
 */
export function submitNoBid(
  leagueId: LeagueId,
  playerId: PlayerId,
): Promise<void> {
  return notImplemented('submitNoBid', { leagueId, playerId })
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/** The shared display's live feed. Everything authoritative arrives here. */
export function onAuctionStateChanged(
  leagueId: LeagueId,
  callback: Subscriber<AuctionState>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onAuctionStateChanged', {
    leagueId,
    callback,
    onError,
  })
}

/**
 * **The timeline is display only.** It is read for rendering and never
 * dispatched on. No state change, no data change, no side effect hangs off an
 * entry arriving. Anything that needs to react reads the auction state instead,
 * which is authoritative and always present.
 *
 * The calls are not an exception. Every client already computes the countdown
 * from the deadline, so it knows five seconds remain without a last-call entry
 * telling it.
 */
export function onTimelineEvent(
  leagueId: LeagueId,
  callback: Subscriber<TimelineMessage>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onTimelineEvent', { leagueId, callback, onError })
}
