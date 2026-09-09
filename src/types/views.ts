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
  CompetitionId,
  LeagueId,
  MatchId,
  PlayerId,
  RoundId,
  TeamId,
  TournamentId,
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

/**
 * A league as it appears on a tournament page.
 *
 * **Not the My Leagues card.** There you are looking at your own leagues, so
 * the card carries your roles, your status and where to go next. Here you may
 * have no relationship with the league at all, so it carries what someone
 * deciding whether to join needs instead.
 *
 * `filledSlots` counts members holding `manager` and is **never stored** — a
 * counter would fan out to every member's index entry on every join. Deriving
 * it costs one read per league, which `docs/data-model.js` records as the open
 * question on this page. Settled in favour of showing it, because a full league
 * cannot be joined and the row has to be able to say so.
 */
export interface TournamentLeagueCard {
  leagueId: LeagueId
  leagueName: string
  isAuctionEnabled: boolean
  /** Model vocabulary. The interface says public and closed. */
  leagueEntry: LeagueEntry
  maxSlots: number
  filledSlots: number

  /**
   * The signed-in person's roles here, **empty when they are not a member**.
   *
   * Roles are additive and a boolean cannot express them: whoever publishes a
   * tournament owns and administers its official leagues without playing them,
   * so "is a member" and "is playing" are different questions. The join action
   * turns on `manager` specifically, never on membership.
   */
  myRoles: Partial<Record<LeagueRole, true>>
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
  teamId?: TeamId
  competitionId?: CompetitionId
  format?: Format
  playerRole?: PlayerRole
  /** Fully retired players are hidden unless asked for. */
  includeRetired?: boolean
}

/**
 * Every field optional. Omitting all of them returns everything.
 *
 * The catalogue is small enough that filtering happens after the read rather
 * than as a database query — the page documents say the same about tournaments.
 */
export interface TeamFilter {
  competitionId?: CompetitionId
  tournamentId?: TournamentId
  format?: Format
}

export interface CompetitionConfig {
  competitionName: string
  formatId: Format
}

/**
 * What the create and edit forms submit.
 *
 * `competitionIds` is a list here and a set-map in storage, which is the shape
 * a form naturally produces. The backend converts.
 *
 * **Removing a competition is how a team is retired from it**, and there is no
 * delete anywhere in this admin — `system-admin.md` says removing a team from
 * its competitions is what takes it out of every tournament that could draw on
 * it.
 */
export interface TeamConfig {
  teamName: string
  teamShortName: string
  competitionIds: readonly CompetitionId[]
}

export interface PlayerConfig {
  playerName: string
  playerShortName: string

  /**
   * Free text. **Overseas is derived from this being anything but India**,
   * which is hardcoded and a known Phase 1 limitation — so a fixed country list
   * would imply a precision the model does not have.
   */
  country: string

  playerRole: PlayerRole

  /**
   * Which team, in which competition. Absent or empty means unassigned.
   *
   * **Part of creation rather than a second call**, because a player and their
   * team memberships have to land in one atomic write — the reverse side lives
   * on the team, and half of that pairing is worse than none of it.
   */
  currentTeams?: Partial<Record<CompetitionId, TeamId>>
}

/**
 * A fixture being edited.
 *
 * Every field but the identity is optional, because **a match starts life as a
 * placeholder** and is filled in later — the teams may not be decided and the
 * date may not be announced.
 *
 * Any write touching `startTimestamp` must recompute the tournament's
 * `startDate` and `endDate` in the same atomic update, or they drift and every
 * reader is wrong at once.
 */
export interface MatchConfig {
  matchId: MatchId
  team1Id?: TeamId
  team2Id?: TeamId
  startTimestamp?: number
  venue?: string
}

/**
 * A new tournament.
 *
 * **Teams and players are not here.** They are set afterwards, through
 * `updateTournamentParticipants`, using the same editor that changes them
 * later. The format is not here either — it comes from the base tournament.
 *
 * `matchCount` creates that many numbered placeholders and one round covering
 * all of them, since **every match must belong to exactly one round**.
 */
export interface TournamentConfig {
  tournamentName: string
  competitionId: CompetitionId
  /** At least one. Numbered from 1. */
  matchCount: number
}

/**
 * One round's boundaries, **in match numbers rather than match ids**.
 *
 * A round is stored as a first and last match id, but that is storage. What is
 * being said is "matches 1 to 60", and `matchNumber` is the only legitimate
 * ordering key — push keys sort by creation time, which is not the fixture
 * order.
 *
 * `roundId` is absent for a round being created. A round that keeps its id
 * keeps anything else recorded against it.
 */
export interface TournamentRoundConfig {
  roundId?: RoundId
  roundName: string
  firstMatchNumber: number
  lastMatchNumber: number
}

/**
 * Every field optional. Omitting all of them returns everything.
 *
 * Unpublished tournaments are hidden unless asked for, the same way fully
 * retired players are. **That is a system admin's request**, and once roles are
 * enforced the layer has to check rather than trust it.
 */
export interface TournamentFilter {
  competitionId?: CompetitionId
  includeUnpublished?: boolean
}

/** One player's score for a match. Blank and zero are equivalent. */
export type PlayerPoints = Record<PlayerId, number>
