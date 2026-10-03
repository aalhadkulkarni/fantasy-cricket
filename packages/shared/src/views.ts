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
} from './ids.ts'
import type {
  Format,
  LeagueRole,
  PlayerCategory,
  PlayerRole,
} from './reference.ts'
import type { Player } from './player.ts'
import type { Match } from './tournament.ts'
import type { Team } from './team.ts'
import type {
  AuctionBatch,
  GameWeek,
  League,
  LeagueEntry,
  LineupRules,
  RoundConfig,
} from './league.ts'
import type { ArchivedLeagueIndexEntry, LeagueIndexEntry } from './user.ts'
import type { BannedUser, JoinRequest } from './membership.ts'
import type { ManagerAuctionStatus } from './live-auction.ts'
import type {
  ReceivedTransferProposalEntry,
  SentTransferProposalEntry,
  TransferProposal,
} from './transfer.ts'

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
  /** Not on the stored entry, which is keyed by it. */
  leagueId: LeagueId
  phase: LeaguePhase
  filledSlots: number
}

/**
 * A league someone might join, on a tournament page or resolved from a code.
 *
 * **Not the My Leagues card.** There you are looking at your own leagues, so the
 * card carries your status and where to go next. Here you may have no
 * relationship with the league at all, so it carries what someone deciding
 * whether to join needs instead.
 *
 * One type for both surfaces, because the decision is the same one either way.
 *
 * `filledSlots` counts members holding `manager` and is **never stored** — a
 * counter would fan out to every member's index entry on every join. Deriving it
 * costs one read per league, which `docs/data-model.js` records as the open
 * question on the tournament page. Settled in favour of showing it, because a
 * full league cannot be joined and the row has to be able to say so.
 */
export interface JoinableLeague {
  leagueId: LeagueId
  leagueName: string
  tournamentId: TournamentId
  tournamentName: string
  isAuctionEnabled: boolean
  /** Model vocabulary. The interface says public and closed. */
  leagueEntry: LeagueEntry
  maxSlots: number
  filledSlots: number

  /** Not on the thin index either, so it is read per league. */
  joinDeadline: number

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
  leagueId: LeagueId
  phase: 'finished'
}

/** League home. Fields from `docs/06-data-layer.md`, under League home. */
export interface LeagueSummary {
  leagueId: LeagueId
  leagueName: string
  leagueJoinCode: string
  phase: LeaguePhase

  /**
   * The next team deadline still ahead: the next match's in a match-based
   * league, the next gameweek's first match's in a gameweek league. Absent
   * when none is left, or when the next one has no start time yet.
   */
  nextDeadline?: number

  /**
   * Your overall rank, from the stored leaderboard. Absent for anyone not
   * playing, and before the league is active, when everyone is on zero.
   */
  myRank?: number

  /**
   * How long before a match starts that teams lock, in milliseconds. Zero means
   * the first ball.
   *
   * **A deadline is a match's scheduled start minus this**, and it never shifts
   * with a delay. Carried here so a screen holding a match can work out whether
   * it is still editable without reading the league again.
   */
  deadlineOffset: number

  /**
   * What a manager may change across the whole league. **Absent means
   * unlimited**, matching the stored counters.
   *
   * Carried here so the screen can say "0 of 6" on match one, where there is no
   * previous match to read a remaining count from.
   */
  changeAllowances: {
    teamChanges?: number
    captainChanges?: number
    viceCaptainChanges?: number
  }

  /**
   * The two facts that decide which sections exist. **A league is one type for
   * its whole life**, so neither ever changes — an auction league is always
   * gameweek-based, and the gameweek flag decides which node holds the lineups.
   */
  isAuctionEnabled: boolean
  isGameWeeksEnabled: boolean

  /** Which sections you can see. A spectator has no My Team. */
  myRoles: Partial<Record<LeagueRole, true>>

  /** Needed to resolve fixtures, gameweeks and the selectable pool. */
  tournamentId: TournamentId
  tournamentName: string
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

/** One round of a gameweek league, as League Details shows it. */
export interface RoundDetails {
  roundName: string
  gameWeeks: number
  /** Most players changeable going into the round. Absent means unlimited. */
  beforeRoundCap?: number
  /** Most players changeable between gameweeks inside it. Absent means unlimited. */
  betweenGameWeeksCap?: number
  isImpactSubAllowed: boolean
}

/**
 * **A league's configuration, resolved for reading.** Owner and tournament come
 * back as names, allowances as numbers or absent for unlimited, and rounds in
 * fixture order, so the page never needs to know how any of it is stored.
 */
export interface LeagueDetails {
  leagueId: LeagueId
  leagueName: string
  tournamentName: string
  ownerName: string
  isAuctionEnabled: boolean
  isGameWeeksEnabled: boolean
  leagueEntry: LeagueEntry
  managers: number
  maxSlots: number
  /** Milliseconds before a match's start that teams lock. */
  deadlineOffset: number
  isCustomScoringSystem: boolean
  scoringRulesText?: string
  /** Match-based leagues only. Absent means unlimited. */
  changeAllowances: {
    teamChanges?: number
    captainChanges?: number
    viceCaptainChanges?: number
  }
  /** Gameweek leagues only, in fixture order. */
  rounds: RoundDetails[]
  finishedAt?: number
  /** The scheduled start of the league's last match, which gates finishing it. */
  lastMatchStartsAt?: number
}

/**
 * Standings for one locked match or gameweek.
 *
 * **Locked is not the same as scored.** `isScored` is false when its points are
 * not in yet, so the interface can say so rather than rank everyone on zero.
 */
export interface PeriodLeaderboard {
  rows: LeaderboardRow[]
  isScored: boolean
}

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
  /** Carries `teamShortName` for this league's tournament. */
  player: Player
  playerCategory: PlayerCategory
  playerBasePrice: number
}

/**
 * One draft position. **Every position is listed**, held or not: one nobody has
 * claimed yet has no manager, and reads as TBA. Position one picks first, and
 * the order snakes back after the last.
 */
export interface DraftOrderEntry {
  position: number
  managerId?: UserId
  managerName?: string
  fantasyTeamName?: string
}

/**
 * **What a manager prepares from**, for Auction Center: when, under what
 * rules, in what order, and who is running it. The fast part of the page — the
 * player pool is its own read, because it is the slow one.
 */
/**
 * **A match, with when it counts as over** — for opening My Team on the one
 * that matters, never for a deadline.
 */
export interface Fixture extends Match {
  /**
   * The start plus the format's duration, or the next match's start if that is
   * sooner. Absent while undated.
   */
  endsAt?: number
}

/** One player in a manager's squad, as the Squads page shows them. */
export interface SquadEntry {
  /** With `teamShortName` for this tournament. */
  player: Player
  /** What they went for at auction. */
  pricePaid?: number
}

/** One manager's squad, and the eleven to highlight in it. */
export interface ManagerSquadView {
  userId: UserId
  userName: string
  teamName: string
  /** Role, then name. */
  players: SquadEntry[]
  /**
   * **The eleven to highlight.** Your own saved XI for the current period;
   * for anyone else, their latest **locked** XI — an unlocked selection is
   * never shown. Absent when there is none to show.
   */
  xi?: {
    playerIds: PlayerId[]
    captainId: PlayerId
    viceCaptainId: PlayerId
    /** "Gameweek 3", or the match it is for. */
    periodName: string
  }
}

/**
 * **Everything the Squads page shows, in one read.** Squads are public, so
 * every manager's is here; only the highlighted XI follows the visibility
 * rule.
 */
export interface SquadsView {
  /** The caller first when they manage a team here; then by team name. */
  managers: ManagerSquadView[]
  /** The caller, when one of `managers` is theirs. */
  mine?: UserId
  homeNation: string
  /** Absent means no cap. */
  maxOverseasPlayersAllowedInXI?: number
  lineupRules: LineupRules
}

export interface AuctionSettings {
  auctionStartTime: number
  totalBudget: number
  minSquadSize: number
  maxSquadSize: number
  /** Absent means no cap. */
  maxOverseasPlayersAllowedInXI?: number
  /** The fixed step every bid rises by. */
  bidIncrement: number
  /** How long a round runs from its last accepted bid. */
  roundSeconds: number
  /** Absent on a league created before the sequence existed. */
  batchSequence?: AuctionBatch[]
  auctioneer: { userId: UserId; userName: string }
  /**
   * The tournament's home nation, **India when none is set**. A player from
   * anywhere else is overseas.
   */
  homeNation: string
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

/**
 * What the base tournament form submits.
 *
 * **`homeNation` as an empty string clears it** on an update. Absent in a
 * partial update means leave it alone, so "no home nation" needs a value of its
 * own.
 */
export interface CompetitionConfig {
  competitionName: string
  formatId: Format
  homeNation?: string
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
   * Free text. Overseas is derived from this against a tournament's
   * `homeNation`, so it only has to match that string.
   */
  country: string

  playerRole: PlayerRole

  /**
   * **The standard auction values, required on creation.** Written to
   * `standardAuctionConfig` in the same atomic update as the player, so every
   * player created from here on can be auctioned. The base price is positive
   * and a multiple of 0.5, the bid increment.
   */
  playerCategory: PlayerCategory
  playerBasePrice: number

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

/**
 * One gameweek of a league, with what the screen cannot derive from it.
 *
 * A `GameWeek` stores its first and last match id, and **membership is decided
 * by `matchNumber`** — ids are push keys that sort by creation time rather than
 * fixture order. Resolving that is the layer's job, so the ids come back
 * already worked out.
 */
export interface LeagueGameWeek {
  gameWeek: GameWeek
  /** The round it belongs to, which `my-team.md` asks to be shown beside it. */
  roundName: string
  /** The matches it spans, in order. A gameweek aggregate sums across these. */
  matchIds: readonly MatchId[]
  /** The first match's start. The deadline is this minus the league's offset. */
  startsAt?: number

  /**
   * **When the gameweek counts as over**, for opening My Team on the one that
   * matters: its last match's start plus the format's duration, or the next
   * gameweek's first start, whichever is earlier — several matches can fall on
   * one day. Absent while a match in it is undated.
   */
  endsAt?: number

  /**
   * The most players that may change **going into this gameweek**, from the one
   * before it. Absent means unlimited, and it is also absent for the very first
   * gameweek, which has no previous one to differ from.
   *
   * **A cap on each transition, not a pool for the round.** Entering a round is
   * limited by that round's "before the round starts" allowance; moving between
   * gameweeks inside it by its "between gameweeks" one. Resolved here so a
   * screen never needs to know how a league's rounds are configured.
   *
   * Captain and vice-captain changes have no allowance in a gameweek league and
   * are unlimited.
   */
  changeCap?: number
}

/** One player's score for a match. Blank and zero are equivalent. */
export type PlayerPoints = Record<PlayerId, number>

/** One side of a fixture, with the players it has in this tournament. */
export interface MatchSide {
  team: Team
  /** Sorted by name. */
  players: Player[]
}

/**
 * Who can be scored in a match: both teams' players in this tournament. Only
 * ever returned for a match whose two teams are known.
 */
export interface MatchPlayers {
  match: Match
  sides: [MatchSide, MatchSide]
}
