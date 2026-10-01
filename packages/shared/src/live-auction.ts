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

import type {
  BidId,
  NoBidId,
  PlayerId,
  TimelineMessageId,
  UserId,
} from './ids.ts'
import type { AuctionBatch } from './league.ts'
import type {
  AuctionPhase,
  PlayerCategory,
  PlayerRole,
  TimelineEventId,
} from './reference.ts'

// ---------------------------------------------------------------------------
// Fixed for Phase 1
// ---------------------------------------------------------------------------

/**
 * **Every bid is the asking price, and the asking price rises by this.** The
 * same step whatever the player is worth. Not configurable in Phase 1.
 */
export const BID_INCREMENT = 0.5

/**
 * **A round runs this long from its last accepted bid**, so every accepted bid
 * restarts it. Thirty seconds proved comfortably enough across real auctions.
 * Not configurable in Phase 1; the auctioneer can add time to a round.
 */
export const ROUND_SECONDS = 30

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * Authoritative state, written only by the auctioneer.
 *
 * **Most of it is absent at first.** The auction opens in `notStarted` with no
 * batch and no player; a batch is chosen, then a player. A reader must treat
 * each as optional rather than assume a player is always up.
 *
 * **The batch is an `AuctionBatch`**, one step of the league's batch
 * sequence, so the draft — a batch of its own — is expressible: `kind: 'draft'`
 * rather than a category and role.
 *
 * **A player is selected before bidding opens** ("Current player is X") and
 * the round exists only once bidding starts. So `betweenPlayers` with a current
 * player that has no round yet means "selected, not yet bidding".
 *
 * DERIVED: the countdown. Computed client-side against Firebase server time
 * from the round's deadline, never against the local clock.
 */
export interface AuctionState {
  phase: AuctionPhase

  currentBatch?: AuctionBatch
  currentPlayerId?: PlayerId
  lastPlayerId?: PlayerId

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
 * **What each kind of event carries**, keyed by its id. Written from the
 * catalogue's parameter names in `seed-data.ts`, with types the catalogue
 * cannot express. The writer (Phase E) and every renderer share this, so the
 * two cannot disagree about a field.
 */
export interface TimelineEventData {
  auctionStarted: Record<string, never>
  nextBatch: { playerCategory: PlayerCategory; playerRole: PlayerRole }
  nextPlayer: { playerId: PlayerId; basePrice: number; timeLimit: number }
  bid: { playerId: PlayerId; bid: number; managerId: UserId }
  noBid: { playerId: PlayerId; managerId: UserId }
  paused: Record<string, never>
  auctionRestarted: Record<string, never>
  auctionBeingRecovered: Record<string, never>
  auctionRecovered: { rewindedRounds: number }
  auctioneerChanged: { oldAuctioneerId: UserId; newAuctioneerId: UserId }
  sold: { playerId: PlayerId; winningBid: number; managerId: UserId }
  unsold: { playerId: PlayerId }
  draftStarted: Record<string, never>
  nextDraftManager: { managerId: UserId }
  draftPick: { managerId: UserId; playerId: PlayerId; basePrice: number }
  firstCall: { timeRemaining: number }
  secondCall: { timeRemaining: number }
  lastCall: { timeRemaining: number }
  timeUp: Record<string, never>
  timeIncreased: { timeAdded: number }
  auctionEnded: Record<string, never>
}

/**
 * One thing that happened, at `liveAuctions/{leagueId}/timeline`.
 *
 * Stores an event id plus its data rather than a pre-written sentence, which is
 * what lets every client render its own wording and lets the countdown be a
 * live timer instead of a series of "20 seconds left" log lines.
 *
 * **A discriminated union on `timelineEventId`**: narrow on the id and the data
 * is typed. An id this client does not know still arrives — an older page
 * reading a newer auction — so a renderer must fall back rather than break.
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
 */
export type TimelineMessage = {
  [Id in TimelineEventId]: {
    timelineMessageId: TimelineMessageId
    timelineEventId: Id
    timelineEventData: TimelineEventData[Id]
    /** When it was written, by the server's clock. Absent on older entries. */
    timestamp?: number
  }
}[TimelineEventId]

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
