/**
 * Trading players and points between managers, in an auction league, while a
 * transfer window is open.
 *
 * The interface says "offer" rather than "proposal", because "propose an offer"
 * reads worse than "make an offer". The model kept the longer word.
 *
 * **Validation runs three times, all here:** at proposal, again at acceptance
 * since squads change in between, and then across both parties' other offers,
 * auto-rejecting any that acceptance just invalidated.
 *
 * **A known concurrency risk, accepted:** two managers accepting conflicting
 * offers for the same player in the same instant could both pass validation.
 * Rare, both parties are human, and an admin can correct it.
 */

import type {
  CompletedTransfer,
  IncomingTransferOffer,
  LeagueId,
  OutgoingTransferOffer,
  TransferOffer,
  TransferProposalId,
  TransferWindow,
  UserId,
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
 * **A pending offer from a closed window is never returned.**
 *
 * An offer still pending when its window's last match starts is dead, but
 * Phase 1 has nothing running on a schedule to say so and no client is
 * necessarily open at that moment. The layer infers the outcome on the next
 * read and writes the rejection then, so callers never see one.
 */
export function getIncomingOffers(
  leagueId: LeagueId,
): Promise<IncomingTransferOffer[]> {
  return notImplemented('getIncomingOffers', { leagueId })
}

/** Same lazy window-close rule as `getIncomingOffers`. */
export function getOutgoingOffers(
  leagueId: LeagueId,
): Promise<OutgoingTransferOffer[]> {
  return notImplemented('getOutgoingOffers', { leagueId })
}

export function getMyCompletedTransfers(
  leagueId: LeagueId,
): Promise<CompletedTransfer[]> {
  return notImplemented('getMyCompletedTransfers', { leagueId })
}

/** Everyone's, since who owns whom is public and a prerequisite for offering. */
export function getAllCompletedTransfers(
  leagueId: LeagueId,
): Promise<CompletedTransfer[]> {
  return notImplemented('getAllCompletedTransfers', { leagueId })
}

/**
 * The window currently open, or nothing.
 *
 * There is no stored open flag — a window is expressed as a range of matches
 * and openness is decided against the start time of its last match.
 */
export function getTransferWindow(
  leagueId: LeagueId,
): Promise<TransferWindow | undefined> {
  return notImplemented('getTransferWindow', { leagueId })
}

/** So an offer cannot ask for more points than the other manager holds. */
export function getPointsBalance(
  leagueId: LeagueId,
  managerId: UserId,
): Promise<number> {
  return notImplemented('getPointsBalance', { leagueId, managerId })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * **Rejected unless a window is open**, both squads still contain what the
 * offer names, both sides would still be able to field a legal XI, and the
 * points asked are within the other manager's balance.
 *
 * Points move in one direction only. Both zero is a straight player swap.
 */
export function proposeTransfer(
  leagueId: LeagueId,
  targetManagerId: UserId,
  offer: TransferOffer,
): Promise<TransferProposalId> {
  return notImplemented('proposeTransfer', { leagueId, targetManagerId, offer })
}

/**
 * **One atomic write** touching both squads, both points adjustments and this
 * offer's status. Then a second pass re-validates both parties' other offers
 * and auto-rejects any this acceptance just broke.
 *
 * The incoming player is available from the next match onward, which is why the
 * squad is keyed by match.
 */
export function acceptTransfer(
  leagueId: LeagueId,
  transferProposalId: TransferProposalId,
): Promise<void> {
  return notImplemented('acceptTransfer', { leagueId, transferProposalId })
}

/** Manual rejections default to "Not interested"; auto ones carry a generated reason. */
export function rejectTransfer(
  leagueId: LeagueId,
  transferProposalId: TransferProposalId,
  reason: string,
): Promise<void> {
  return notImplemented('rejectTransfer', {
    leagueId,
    transferProposalId,
    reason,
  })
}

/** The proposer taking their own offer back. */
export function withdrawTransfer(
  leagueId: LeagueId,
  transferProposalId: TransferProposalId,
): Promise<void> {
  return notImplemented('withdrawTransfer', { leagueId, transferProposalId })
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export function onTransferOfferReceived(
  leagueId: LeagueId,
  callback: Subscriber<IncomingTransferOffer>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onTransferOfferReceived', {
    leagueId,
    callback,
    onError,
  })
}

export function onTransferResolved(
  leagueId: LeagueId,
  callback: Subscriber<CompletedTransfer>,
  onError?: SubscriptionErrorHandler,
): Unsubscribe {
  return notImplemented('onTransferResolved', { leagueId, callback, onError })
}
