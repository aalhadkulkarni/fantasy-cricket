/**
 * `liveAuctions/{leagueId}`.
 *
 * The auction **runtime**, not its configuration. Configuration is
 * `leagues/{leagueId}/auctionDetails`, in `league.ts`. Config is admin-edited
 * and freezes when the auction starts; this is written many times a second for
 * two hours and then never again, which is why it is a separate top-level node.
 *
 * **This node does not exist until `startAuction` creates it.** Its absence is
 * the normal pre-auction state and must not be treated as an error. That is the
 * likeliest null-reference bug in the product, because a league sits in the
 * pre-auction state for weeks while My Leagues reads it.
 *
 * The read/write split is the whole design. Bidders write **only** to
 * `currentSubmittedBids/{playerId}/bids/{their own userId}` and the matching
 * `noBids` path. The auctioneer's client is the sole writer of everything else.
 * Because bidders cannot touch authoritative state there is nothing to contend
 * over, which is why none of this needs transactions.
 */

import type { BidId, NoBidId, PlayerId, TimelineMessageId, UserId } from './ids'
import type {
  AuctionPhase,
  PlayerCategory,
  PlayerRole,
  TimelineEventId,
} from './reference'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * The batch currently being auctioned. Ids, not display names — the client
 * renders labels from the reference tables.
 */
export interface CurrentBatch {
  playerCategory: PlayerCategory
  playerRole: PlayerRole
}

/**
 * Authoritative state, written only by the auctioneer's client.
 *
 * DERIVED: the countdown. Computed client-side against Firebase server time
 * from the deadline in `currentAcceptedBids`, never against the local clock.
 */
export interface AuctionState {
  currentBatch: CurrentBatch
  currentPlayerId: PlayerId
  lastPlayerId: PlayerId

  phase: AuctionPhase

  /** Whose turn it is during the draft. Absent outside the draft. */
  currentDraftManagerId?: UserId
}

/**
 * Per-manager budget and holdings during the auction.
 *
 * `playerList` maps a player to the price paid, so it is both the squad so far
 * and the spend record.
 *
 * DERIVED: whether this manager can still bid, and on what. Needs the squad
 * size limits and role composition from the league's auction config, which is
 * not in this node.
 */
export interface ManagerAuctionStatus {
  budget: number
  playerList: Record<PlayerId, number>
}

// ---------------------------------------------------------------------------
// Bids
// ---------------------------------------------------------------------------

/** One accepted bid, in the permanent history. */
export interface Bid {
  bidId: BidId
  bidNumber: number
  bid: number
  managerId: UserId
  timestamp: number

  /** Present only on the bid that won. */
  sold?: true
}

export type PlayerAuctionStatus = 'Sold' | 'Unsold' | 'Pending'

/** Permanent record of the bidding on one player. */
export interface PlayerBiddingHistory {
  status: PlayerAuctionStatus
  bids: Record<BidId, Bid>
}

interface SoldPlayer {
  playerId: PlayerId
  status: 'Sold'
  managerId: UserId
  winningBid: number
}

interface UnsoldOrPendingPlayer {
  playerId: PlayerId
  status: 'Unsold' | 'Pending'
}

/** Who owns whom, and for how much. Narrow on `status` to reach the buyer. */
export type PlayerStatus = SoldPlayer | UnsoldOrPendingPlayer

// ---------------------------------------------------------------------------
// The live round
// ---------------------------------------------------------------------------

/**
 * What bidders have written for the current player.
 *
 * Keyed by manager, so a manager's second bid **overwrites their first**. There
 * is no history here; history is `playerWiseBiddingHistory`.
 */
export interface SubmittedBidsForPlayer {
  bids: Record<UserId, number>

  /** Passing is irreversible for the round, so this only ever goes to true. */
  noBids: Record<UserId, true>
}

/** One accepted no-bid, in the auctioneer-written record. */
export interface NoBid {
  noBidNumber: number
  managerId: UserId
  timestamp: number
}

/** The auctioneer's authoritative view of the current player's round. */
export interface AcceptedBidsForPlayer {
  basePrice: number

  /** Absent before the first bid. */
  currentLeadingBid?: number
  currentLeadingManager?: UserId

  /** The asking price. Rises by the fixed increment of 0.5. */
  minNextBid: number

  /** Last accepted bid plus thirty seconds. Bids after this are ignored. */
  deadline: number

  bids: Record<BidId, Bid>
  lastAcceptedBid: BidId
  noBids: Record<NoBidId, NoBid>
}

/**
 * `currentPlayer` and `takingBids` are **auctioneer-written and
 * bidder-readable**, which is load-bearing: without that rule a bidder could
 * flip `takingBids` and reopen bidding on themselves.
 *
 * Bids are keyed per player, so there is no clearing step between rounds and no
 * risk of a previous player's value leaking into the current one. The previous
 * player's subtree is deleted before the next goes up.
 *
 * NOTE — the grouping here is ours, not the database's. On the wire those
 * per-player entries sit directly beside `currentPlayer` and `takingBids`,
 * because RTDB has no reason to nest them. TypeScript cannot describe that
 * honestly: an index signature is a promise that *every* key yields a bid
 * record, which `takingBids` plainly does not. Grouping them under one field
 * says the same thing and types cleanly.
 *
 * Nothing is lost by the difference, because **nothing reads these nodes
 * whole.** Every access is a narrow path — `submitBid` writes one bid,
 * `acceptBid` accepts one, and the auctioneer subscribes to a single bidder's
 * field.
 */
export interface CurrentSubmittedBids {
  currentPlayer: PlayerId
  takingBids: boolean
  submittedBids: Record<PlayerId, SubmittedBidsForPlayer>
}

export interface CurrentAcceptedBids {
  currentPlayer: PlayerId
  takingBids: boolean
  acceptedBids: Record<PlayerId, AcceptedBidsForPlayer>
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

/**
 * One thing that happened, at `liveAuctions/{leagueId}/timeline`.
 *
 * Stores an event id plus its data rather than a pre-written sentence, which is
 * what lets every client render its own wording and lets the countdown be a
 * live timer instead of a series of "20 seconds left" log lines.
 *
 * **DISPLAY ONLY. The timeline is written to and read for rendering, never
 * dispatched on.** No state change, no data change, no side effect hangs off an
 * entry arriving. Anything that needs to react reads `auctionState` or
 * `currentAcceptedBids`, which are authoritative and always present.
 *
 * The calls are not an exception. Every client already computes the countdown
 * against Firebase server time from the deadline, so it knows five seconds
 * remain without a `lastCall` entry telling it. Reacting to the entry rather
 * than the deadline puts the reaction out of step with the countdown sitting
 * beside it on screen.
 *
 * DERIVED: the rendered message. Look `timelineEventId` up in `timelineEvents`
 * and fill from `timelineEventData`.
 *
 * NOT MODELLED HERE: the shape of `timelineEventData` per event. The catalogue
 * lists parameter *names* only, so there is nothing to derive a per-event type
 * from. Making this a discriminated union would mean writing those shapes by
 * hand, which is worth doing when something actually renders the timeline.
 */
export interface TimelineMessage {
  timelineMessageId: TimelineMessageId
  timelineEventId: TimelineEventId
  timelineEventData: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// The runtime
// ---------------------------------------------------------------------------

export interface LiveAuction {
  auctionState: AuctionState
  managerStatus: Record<UserId, ManagerAuctionStatus>

  /** Permanent, per player. Survives the auction as its historical record. */
  playerWiseBiddingHistory: Record<PlayerId, PlayerBiddingHistory>
  playerStatus: Record<PlayerId, PlayerStatus>

  /** Live only. Holds the current player's round and is cleared before the next. */
  currentSubmittedBids: CurrentSubmittedBids
  currentAcceptedBids: CurrentAcceptedBids

  timeline: Record<TimelineMessageId, TimelineMessage>
}
