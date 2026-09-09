/**
 * Shapes the data layer returns and accepts that no database node holds.
 *
 * **Everything here was invented to make the data layer's signatures
 * writable.** `docs/06-data-layer.md` names about a hundred and forty
 * functions, and roughly a dozen of them return or accept something the schema
 * has no shape for — an actions feed, a leaderboard row, a league summary, the
 * config a create form submits.
 *
 * They are collected in one file rather than spread through the others so that
 * the reviewed types stay reviewed and the guesses stay visible. **Expect these
 * to change.** Where a page document specified the fields, they are taken from
 * it and the source is named. Where it did not, the shape is a first cut.
 *
 * Two conventions, both from the data layer's own rules:
 *
 * - **Reads return resolved entities.** A leaderboard row carries the manager's
 *   name, not a `UserId` to look up.
 * - **Writes accept resolved entities too**, and the layer takes the ids out.
 *   Submitting a team passes the eleven `Player` objects the form was working
 *   with, not a mapped-back list of ids.
 */

import type {
  LeagueId,
  MatchId,
  PlayerId,
  TransferProposalId,
  UserId,
} from './ids'
import type { Format, LeagueRole, PlayerRole } from './reference'
import type { Player } from './player'
import type { Match } from './tournament'
import type { League, LeagueEntry, LineupRules, RoundConfig } from './league'
import type { ArchivedLeagueIndexEntry, LeagueIndexEntry } from './user'
import type { BannedUser, JoinRequest } from './membership'
import type { ManagerAuctionStatus } from './live-auction'
import type {
  ReceivedTransferProposalEntry,
  SentTransferProposalEntry,
  TransferProposal,
} from './transfer'

// ---------------------------------------------------------------------------
// League lifecycle
// ---------------------------------------------------------------------------

/**
 * Never stored. Computed from the auction's scheduled start, whether the
 * runtime node exists, the tournament's first match, and `finishedAt`.
 *
 * The old system held this as a constant in source, so advancing a league
 * required a redeploy.
 */
export type LeaguePhase =
  'preAuction' | 'auction' | 'teamSubmission' | 'active' | 'finished'

/**
 * A My Leagues card. The stored index entry plus the two things it cannot
 * carry.
 *
 * Neither is stored, for reasons recorded on `LeagueIndexEntry`: phase is a
 * function of the current time, and a slot counter would fan out to every
 * member's entry on every join.
 */
export interface LeagueCard extends LeagueIndexEntry {
  phase: LeaguePhase
  filledSlots: number
}

/** An Archived tab card. Its final position was snapshotted at migration. */
export interface ArchivedLeagueCard extends ArchivedLeagueIndexEntry {
  phase: 'finished'
}

/** League home. Fields from `docs/06-data-layer.md`, under League home. */
export interface LeagueSummary {
  leagueId: LeagueId
  leagueName: string
  leagueJoinCode: string
  phase: LeaguePhase

  /** The next moment anything locks. Absent once the league is finished. */
  nextDeadline?: number

  /** Absent for a spectator, and for an admin who does not play. */
  myRank?: number
}

// ---------------------------------------------------------------------------
// League configuration
// ---------------------------------------------------------------------------

/**
 * A field that carries its own edit lock. See the table in
 * `docs/08-pages/league-details.md`.
 *
 * League type, gameweek-or-match and accessibility are absent deliberately —
 * they are never editable, so they can never appear in this list.
 */
export type EditableLeagueField =
  | 'leagueName'
  | 'maxSlots'
  | 'fantasyLeagueJoinDeadline'
  | 'fantasyLeagueTeamChangesDeadlineOffset'
  | 'isCustomScoringSystem'
  | 'scoringRulesText'
  | 'fantasyLineupRules'
  | 'roundConfigs'
  | 'auctionStartTime'
  | 'auctionConfig'
  | 'transferWindows'
  | 'primaryAuctioneer'
  | 'secondaryAuctioneer'

/**
 * League Details reads this. Returning which fields are currently editable lets
 * the interface reflect the locks without reimplementing them — the layer
 * rejects a write to a locked field either way.
 *
 * The league is carried whole rather than intersected, because `League` is a
 * three-member union and intersecting it would collapse the discriminant.
 */
export interface LeagueConfig {
  league: League
  editableFields: readonly EditableLeagueField[]
}

/**
 * What the create form submits.
 *
 * Fields from `docs/06-data-layer.md` under Create League: tournament, name,
 * accessibility, max slots, join deadline, deadline offset, points source and
 * description, whether an auction is held, round and gameweek structure, change
 * allowances, and the full auction configuration.
 *
 * Flat rather than a union, because a form is filled in before it is valid. The
 * layer rejects the combinations that cannot exist — an auction league is
 * always gameweek-based, and a gameweek league has round configs rather than
 * tournament-wide change allowances.
 */
export interface CreateLeagueConfig {
  leagueName: string
  tournamentId: string
  leagueEntry: LeagueEntry
  maxSlots: number
  fantasyLeagueJoinDeadline: number
  fantasyLeagueTeamChangesDeadlineOffset: number
  fantasyLineupRules: LineupRules

  isCustomScoringSystem: boolean
  scoringRulesText?: string

  isGameWeeksEnabled: boolean
  isAuctionEnabled: boolean

  /** Gameweek leagues only. */
  roundConfigs?: Record<string, RoundConfig>

  /** Match-based leagues only. */
  totalChangesAllowed?: number
  totalCaptainChangesAllowed?: number
  totalViceCaptainChangesAllowed?: number

  /** Auction leagues only. */
  auctionStartTime?: number
  totalBudget?: number
  minSquadSize?: number
  maxSquadSize?: number
  maxOverseasPlayersAllowedInXI?: number
}

/** What `createLeague` hands back. The code is claimed transactionally. */
export interface CreatedLeague {
  leagueId: LeagueId
  leagueJoinCode: string
}

// ---------------------------------------------------------------------------
// People in a league
// ---------------------------------------------------------------------------

/**
 * A row of the members list. Fields from `docs/06-data-layer.md` under Members:
 * name, team name, admin badge — the badge coming from the roles.
 */
export interface LeagueMemberSummary {
  userId: UserId
  userName: string
  fantasyTeamName?: string
  leagueRoles: Partial<Record<LeagueRole, true>>
  pointsAdjustment?: number
}

/** A pending or rejected request, with the requester resolved. */
export interface JoinRequestSummary extends JoinRequest {
  userId: UserId
  userName: string
}

/** A ban, with both parties resolved. */
export interface BannedUserSummary extends BannedUser {
  userId: UserId
  userName: string
  bannedByName: string
}

// ---------------------------------------------------------------------------
// Actions Center
// ---------------------------------------------------------------------------

/**
 * The six standing conditions listed in `docs/08-pages/actions-center.md`.
 *
 * Everything here is derived. Nothing is stored, nothing is written, and there
 * is no read state — an item stays until the underlying thing resolves.
 */
export type ActionKind =
  | 'joinRequestAwaitingYourApproval'
  | 'yourJoinRequestPending'
  | 'incomingTransferOffer'
  | 'liveAuctionInYourLeague'
  | 'teamDeadlineWithNoTeamSet'
  | 'yourDraftTurn'

/**
 * FIRST CUT. The page document lists what the items *are* but not what a row
 * renders, so these fields are a guess at the minimum: enough to write a line
 * of text and link somewhere.
 */
export interface Action {
  kind: ActionKind
  leagueId: LeagueId
  leagueName: string

  /** Present where the item is about a moment, such as a team deadline. */
  deadline?: number
}

// ---------------------------------------------------------------------------
// Lineups
// ---------------------------------------------------------------------------

/**
 * What a team submission carries. The counters on a stored lineup are not here
 * — the layer maintains those, and a client that could set them could give
 * itself extra changes.
 */
export interface LineupSubmission {
  /** Exactly eleven. Rejected by the layer if not, and if the XI is illegal. */
  lineup: Player[]
  captainId: PlayerId
  viceCaptainId: PlayerId
}

/**
 * What is left of a manager's allowances.
 *
 * **Absent means unlimited**, matching `RoundConfig` and `LineupRule.max`. A
 * gameweek league configures allowances per round, so this is asked per round.
 */
export interface ChangesRemaining {
  changesRemaining?: number
  captainChangesRemaining?: number
  viceCaptainChangesRemaining?: number

  /** Forced false where a round's gameweeks are one match long. */
  isImpactSubAvailable: boolean
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

/**
 * Columns from `docs/08-pages/leaderboard.md`: rank, name, team name, points.
 *
 * **Tied managers share a rank and subsequent ranks are offset by the number
 * tied**, so ranks are not dense. Pre-season everyone is on zero and therefore
 * everyone is rank one.
 */
export interface LeaderboardRow {
  rank: number
  managerId: UserId
  managerName: string
  fantasyTeamName?: string
  points: number
}

/**
 * The match up to which points are entered, for the "Points calculated till
 * match X" label.
 *
 * **Always a match, never a gameweek.** Points are match-based whichever kind
 * of league this is. Absent before anything has been scored.
 */
export type ScoringWatermark = Match | undefined

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

/** What the offer builder submits. Players, not ids — the layer takes those. */
export interface TransferOffer {
  playersOffered: Player[]
  playersAsked: Player[]

  /**
   * Points move in one direction only. Both zero is a straight player swap, and
   * setting both is rejected.
   */
  pointsOffered: number
  pointsAsked: number
}

/** An offer someone made you, with the proposer resolved. */
export interface IncomingTransferOffer extends ReceivedTransferProposalEntry {
  transferProposalId: TransferProposalId
  proposedByName: string
}

/** An offer you made, with the recipient resolved. */
export interface OutgoingTransferOffer extends SentTransferProposalEntry {
  transferProposalId: TransferProposalId
  proposedToName: string
}

/**
 * A settled offer, shown in the completed lists. Carries the whole proposal
 * rather than the summary line, since this is the record of what happened.
 */
export interface CompletedTransfer {
  transferProposalId: TransferProposalId
  proposal: TransferProposal
  manager1Name: string
  manager2Name: string
}

// ---------------------------------------------------------------------------
// Auction
// ---------------------------------------------------------------------------

/**
 * A row of the auction's managers table: name, budget, number of players.
 *
 * `ManagerAuctionStatus` alone cannot draw it — the stored record is keyed by
 * `UserId` and carries no name.
 */
export interface AuctionManagerStatus extends ManagerAuctionStatus {
  managerId: UserId
  managerName: string
  fantasyTeamName?: string
}

/** A player in the auction pool, with this league's category and price. */
export interface AuctionPoolPlayer {
  player: Player
  playerCategory: string
  playerBasePrice: number
}

/** Whose turn it is, in order. Position one picks first. */
export interface DraftOrderEntry {
  managerId: UserId
  managerName: string
  position: number
}

// ---------------------------------------------------------------------------
// System administration
// ---------------------------------------------------------------------------

/** Which tab a tournament belongs in. Derived; see `Tournament`. */
export type TournamentStatus = 'upcoming' | 'active' | 'past'

/** Every field optional. Omitting all of them returns everything. */
export interface PlayerFilter {
  teamId?: string
  competitionId?: string
  format?: Format
  playerRole?: PlayerRole
  includeRetired?: boolean
}

/** Every field optional. Omitting all of them returns everything. */
export interface TeamFilter {
  competitionId?: string
  tournamentId?: string
  format?: Format
}

export interface CompetitionConfig {
  competitionName: string
  formatId: Format
}

export interface TeamConfig {
  teamName: string
  teamShortName: string
  competitionIds: readonly string[]
}

export interface PlayerConfig {
  playerName: string
  playerShortName: string
  country: string
  playerRole: PlayerRole
}

/**
 * A fixture being created or edited.
 *
 * `matchId` is absent when creating. Any write touching `startTimestamp` must
 * recompute the tournament's `startDate` and `endDate` in the same atomic
 * update, or they drift and every reader is wrong at once.
 */
export interface MatchConfig {
  matchId?: MatchId
  matchNumber: number
  team1Id?: string
  team2Id?: string
  startTimestamp?: number
  venue?: string
}

/**
 * A new tournament. Its participating players are prefilled from each player's
 * current team, and creation **never writes back** to those.
 */
export interface TournamentConfig {
  tournamentName: string
  competitionId: string
  participatingTeamIds: readonly string[]
  matches?: readonly MatchConfig[]
}

/** One player's score for a match. Blank and zero are equivalent. */
export type PlayerPoints = Record<PlayerId, number>
