/**
 * `transferProposals/{leagueId}` and `transferProposalsByManager/{leagueId}`.
 *
 * Trading players and points between managers, in an auction league, while a
 * transfer window is open.
 */

import type { MatchId, PlayerId, TransferProposalId, UserId } from './ids'

/**
 * The interface says "offer" rather than "proposal", because "propose an offer"
 * reads worse than "make an offer". The model kept the longer word.
 */
export type TransferProposalStatus = 'Pending' | 'Accepted' | 'Rejected'

interface TransferProposalBase {
  /** The proposer's side. `manager1` is always `proposedBy`. */
  manager1: UserId
  manager2: UserId
  proposedBy: UserId

  playersOfferedByManager1: PlayerId[]
  playersAskedFromManager2: PlayerId[]

  /**
   * Points move in one direction only: either offered or asked, never both.
   * Both zero is a straight player swap. Enforced in code, not in the database.
   *
   * Whoever *asks* for points receives a positive `pointsAdjustment`.
   */
  pointsOffered: number
  pointsAsked: number
}

interface PendingTransferProposal extends TransferProposalBase {
  status: 'Pending'
}

/**
 * DERIVED, and worth noting: acceptance is one atomic write touching both
 * squads, both points adjustments and this status. Validation runs three times
 * — at proposal, again at acceptance since squads change in between, and then
 * across both parties' other offers, auto-rejecting any now invalid.
 */
interface AcceptedTransferProposal extends TransferProposalBase {
  status: 'Accepted'

  /**
   * The match the squad change takes effect from. Present only once accepted,
   * which is why this is a union rather than an optional field.
   */
  applicableFromMatch: MatchId
}

interface RejectedTransferProposal extends TransferProposalBase {
  status: 'Rejected'

  /**
   * Auto-rejections carry a system-generated reason. Manual ones default to
   * "Not interested".
   *
   * NOTE: a window closing auto-rejects everything still pending, but Phase 1
   * has no scheduler, so that is inferred and written on the next read of the
   * offer rather than at the moment the window ends.
   */
  rejectionReason: string
}

/**
 * Three shapes. An accepted offer carries the match it applies from; a rejected
 * one carries a reason; a pending one carries neither. Narrow on `status`.
 */
export type TransferProposal =
  PendingTransferProposal | AcceptedTransferProposal | RejectedTransferProposal

// ---------------------------------------------------------------------------
// Per-manager index
// ---------------------------------------------------------------------------

/**
 * A denormalised row, so a manager's own offers are one read rather than a scan
 * of every proposal in the league.
 *
 * `shortSummary` is a pre-rendered line like "2 players offered including X,
 * 1 demanded, 500 points asked", carried instead of copying the whole offer.
 *
 * NOTE: `status` is duplicated from the proposal itself, so resolving an offer
 * has to write both sides in the same atomic update.
 */
interface TransferProposalIndexEntryBase {
  shortSummary: string
  status: TransferProposalStatus
}

export interface ReceivedTransferProposalEntry extends TransferProposalIndexEntryBase {
  proposedBy: UserId
}

export interface SentTransferProposalEntry extends TransferProposalIndexEntryBase {
  proposedTo: UserId
}

/** One entry in `transferProposalsByManager/{leagueId}`, keyed by `UserId`. */
export interface ManagerTransferProposals {
  transferProposalsReceived?: Record<
    TransferProposalId,
    ReceivedTransferProposalEntry
  >
  transferProposalsSent?: Record<TransferProposalId, SentTransferProposalEntry>
}
