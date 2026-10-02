/**
 * The auctioneer's controls. Everything here writes authoritative state.
 *
 * **Only the current auctioneer may call any of it**, and control is derived
 * from who holds the role at that moment, so a handover is a data change rather
 * than a navigation problem. Checked in the service; the control panel not
 * rendering is convenience.
 *
 * **The auctioneer's browser is the sole processor of the auction**: it
 * listens to what managers submit, judges each bid against the round it holds
 * in memory, and accepts it through here, one at a time. Every write still
 * goes through the service, which checks again.
 */

import type {
  AuctionCall,
  LeagueId,
  PlayerId,
  UserId,
} from '@fantasy-cricket/shared'

import { getApi } from './api'
import { notImplemented } from './not-implemented'

// ---------------------------------------------------------------------------
// Opening and closing
// ---------------------------------------------------------------------------

/**
 * **The only thing that creates `liveAuctions/{leagueId}`.** Every manager
 * starts on the full budget, and joining closes.
 *
 * It opens in `notStarted`: the room is open and no player is up yet — not
 * "scheduled for next week".
 */
export function startAuction(leagueId: LeagueId): Promise<void> {
  return getApi().startAuction(leagueId)
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

/** The next batch in the league's sequence. **In order only**, so no choice. */
export function nextBatch(leagueId: LeagueId): Promise<void> {
  return getApi().nextBatch(leagueId)
}

/** A player from the current batch, before bidding opens. */
export function putUpPlayer(
  leagueId: LeagueId,
  playerId: PlayerId,
): Promise<void> {
  return getApi().putUpPlayer(leagueId, playerId)
}

/** The same, drawn at random from those left in the batch. */
export function putUpRandomPlayer(leagueId: LeagueId): Promise<void> {
  return getApi().putUpRandomPlayer(leagueId)
}

/** Opens bidding at base price, with the thirty-second clock running. */
export function startBidding(leagueId: LeagueId): Promise<void> {
  return getApi().startBidding(leagueId)
}

// ---------------------------------------------------------------------------
// Running a round
// ---------------------------------------------------------------------------

/**
 * Accepts one submitted bid. The browser has already judged it against the
 * asking price and the deadline; the service checks again before writing.
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
  return getApi().acceptBid(leagueId, playerId, managerId, amount)
}

export function acceptNoBid(
  leagueId: LeagueId,
  playerId: PlayerId,
  managerId: UserId,
): Promise<void> {
  return getApi().acceptNoBid(leagueId, playerId, managerId)
}

/** A first, second or last call onto the timeline. Changes no state. */
export function announceCall(
  leagueId: LeagueId,
  call: AuctionCall,
): Promise<void> {
  return getApi().announceCall(leagueId, call)
}

/** Closes bidding once the clock has run out. Selling stays manual. */
export function markTimeUp(leagueId: LeagueId): Promise<void> {
  return getApi().markTimeUp(leagueId)
}

/**
 * **Manual, deliberately.** The system does not auto-resolve on timeout, so the
 * auctioneer can make allowances for someone with connection trouble.
 *
 * Sells to the leader at the leading bid, both read by the service. **One
 * atomic write** across bid history, the buyer's budget and their squad for
 * every match — written on every sale, so squads are right throughout.
 *
 * **The auction does not prevent an illegal squad.** A manager may buy ten
 * batsmen. The consequence lands later, when they cannot field a legal XI.
 */
export function sellPlayer(leagueId: LeagueId): Promise<void> {
  return getApi().sellPlayer(leagueId)
}

/**
 * **A last resort**, for when something has broken: sell to a chosen manager at
 * a chosen price. The bidding so far is kept.
 */
export function sellPlayerManually(
  leagueId: LeagueId,
  managerId: UserId,
  amount: number,
): Promise<void> {
  return getApi().sellPlayerManually(leagueId, managerId, amount)
}

export function markPlayerUnsold(leagueId: LeagueId): Promise<void> {
  return getApi().markPlayerUnsold(leagueId)
}

/**
 * **Back to before Start auction**, for testing. The live auction, the squads
 * and anything built on them go; members and the draft order stay. Refused in
 * production.
 */
export function resetAuction(leagueId: LeagueId): Promise<void> {
  return getApi().resetAuction(leagueId)
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
 * Undoes the last round's result, restoring budgets and squad membership.
 * **Only inside recovery**, which the auctioneer starts and ends deliberately.
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
 * Always to the backup, and takes effect immediately. **One atomic write**
 * covering the auctioneer roles on the membership records and
 * `primaryAuctioneer` on the auction config — the two must never disagree.
 *
 * Not in Milestone 4: the official league has no backup.
 */
export function handOffAuctioneerRole(
  leagueId: LeagueId,
  targetUserId: UserId,
): Promise<void> {
  return notImplemented('handOffAuctioneerRole', { leagueId, targetUserId })
}
