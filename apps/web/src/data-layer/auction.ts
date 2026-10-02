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
  AcceptedBidsForPlayer,
  AuctionManagerStatus,
  AuctionPoolPlayer,
  AuctionSettings,
  AuctionState,
  DraftOrderEntry,
  LeagueId,
  Player,
  ManagerAuctionStatus,
  PlayerBiddingHistory,
  PlayerId,
  PlayerStatus,
  TimelineMessage,
  UserId,
} from '@fantasy-cricket/shared'
import { getApi } from './api'
import {
  listenToChildrenAdded,
  listenToServerTimeOffset,
  listenToValue,
  readValue,
} from './firebase/realtime'
import { notImplemented } from './not-implemented'
import type {
  Subscriber,
  SubscriptionErrorHandler,
  Unsubscribe,
} from '@fantasy-cricket/shared'

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

/**
 * **What a manager prepares from**: the start, the rules, the batch order and
 * the auctioneer. Reads only the league, so it works for weeks before the
 * auction exists.
 */
export function getAuctionSettings(
  leagueId: LeagueId,
): Promise<AuctionSettings> {
  return getApi().getAuctionSettings(leagueId)
}

/**
 * Every player up for auction, with this league's category and base price.
 * The slow read on Auction Center, so it is fetched on its own.
 */
export function getAuctionPlayerPool(
  leagueId: LeagueId,
): Promise<AuctionPoolPlayer[]> {
  return getApi().getAuctionPlayerPool(leagueId)
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
 * **Every position, held or not.** A position is claimed when a manager joins,
 * so the order is known before any bidding — a manager's strategy depends on
 * where they sit. One nobody holds yet has no manager, and reads as TBA. **It
 * snakes** — 1 to 6, then 6 back to 1, repeating.
 */
export function getDraftOrder(leagueId: LeagueId): Promise<DraftOrderEntry[]> {
  return getApi().getDraftOrder(leagueId)
}

/**
 * Every bid on one player, in order.
 *
 * **Never fetched with the page.** The full history for every player is the
 * entire auction, so it is read one player at a time, when asked for.
 */
export async function getPlayerBiddingHistory(
  leagueId: LeagueId,
  playerId: PlayerId,
): Promise<PlayerBiddingHistory | undefined> {
  // Straight from the database, like the rest of the live auction. Absent for
  // a player nobody has bid on yet.
  return readValue<PlayerBiddingHistory>([
    'liveAuctions',
    leagueId,
    'playerWiseBiddingHistory',
    playerId,
  ])
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
 * **Refused** for a player not up, after passing, when leading, over budget or
 * with a full squad. Whether it is accepted — the price, the clock — is the
 * auctioneer's to judge, and an invalid bid is silently ignored.
 */
export function submitBid(
  leagueId: LeagueId,
  playerId: PlayerId,
  amount: number,
): Promise<void> {
  return getApi().submitBid(leagueId, playerId, amount)
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
  return getApi().submitNoBid(leagueId, playerId)
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/**
 * The shared display's live feed. Everything authoritative arrives here.
 *
 * **Read straight from the database**, not through the service: the auction
 * changes several times a second for everyone watching. Read-only — every
 * write still goes through the service.
 *
 * **`undefined` until the auctioneer starts the auction**, and that is the
 * normal pre-auction state, not an error.
 */
export function onAuctionStateChanged(
  leagueId: LeagueId,
  callback: Subscriber<AuctionState | undefined>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return listenToValue<AuctionState>(
    ['liveAuctions', leagueId, 'auctionState'],
    callback,
    onError,
  )
}

/**
 * **Every manager's budget and holdings**, live. Empty until the auction is
 * started — the page fills the managers table from the league until then.
 */
export function onManagerStatusesChanged(
  leagueId: LeagueId,
  callback: Subscriber<Partial<Record<UserId, ManagerAuctionStatus>>>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return listenToValue<Partial<Record<UserId, ManagerAuctionStatus>>>(
    ['liveAuctions', leagueId, 'managerStatus'],
    (value) => callback(value ?? {}),
    onError,
  )
}

/**
 * **What has become of each player** — sold, unsold or pending — live. A
 * player with no entry has not gone up yet, which counts as remaining.
 */
export function onPlayerStatusesChanged(
  leagueId: LeagueId,
  callback: Subscriber<Partial<Record<PlayerId, PlayerStatus>>>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return listenToValue<Partial<Record<PlayerId, PlayerStatus>>>(
    ['liveAuctions', leagueId, 'playerStatus'],
    (value) => callback(value ?? {}),
    onError,
  )
}

/**
 * **The current player's round, as the auctioneer accepted it**: the leading
 * bid and who holds it, the asking price, the deadline, every accepted bid and
 * pass. Keyed by player, so a page listens to the one that is up and moves
 * when the next one goes up.
 */
export function onCurrentRoundChanged(
  leagueId: LeagueId,
  playerId: PlayerId,
  callback: Subscriber<AcceptedBidsForPlayer | undefined>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return listenToValue<AcceptedBidsForPlayer>(
    ['liveAuctions', leagueId, 'currentAcceptedBids', playerId],
    callback,
    onError,
  )
}

/**
 * **What every manager has bid on the current player**, as they wrote it —
 * keyed by manager, so a manager's newer bid replaces their older one. The
 * auctioneer's browser reads this and decides what to accept.
 */
export function onSubmittedBids(
  leagueId: LeagueId,
  playerId: PlayerId,
  callback: Subscriber<Partial<Record<UserId, number>>>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return listenToValue<Partial<Record<UserId, number>>>(
    ['liveAuctions', leagueId, 'currentSubmittedBids', playerId, 'bids'],
    (value) => callback(value ?? {}),
    onError,
  )
}

/**
 * **Who has passed on the current player**, as written by the managers
 * themselves. Passing is irreversible for the round, so a manager's own entry
 * is what tells their panel to say so.
 */
export function onSubmittedNoBids(
  leagueId: LeagueId,
  playerId: PlayerId,
  callback: Subscriber<Partial<Record<UserId, true>>>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return listenToValue<Partial<Record<UserId, true>>>(
    ['liveAuctions', leagueId, 'currentSubmittedBids', playerId, 'noBids'],
    (value) => callback(value ?? {}),
    onError,
  )
}

/**
 * **This device's clock against the database's**, in milliseconds. The
 * countdown is computed from server time, never the local clock: the server's
 * now is `Date.now()` plus this.
 */
export function onServerTimeOffset(
  callback: Subscriber<number>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return listenToServerTimeOffset(callback, onError)
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
  // Every entry so far, then each new one, in the order they were written.
  return listenToChildrenAdded<TimelineMessage>(
    ['liveAuctions', leagueId, 'timeline'],
    callback,
    onError,
  )
}
