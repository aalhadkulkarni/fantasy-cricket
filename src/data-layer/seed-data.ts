/**
 * The static content every environment needs before anything else can work.
 *
 * Reference tables are fixed enums stored as data: authored once by hand, read
 * at runtime for their display names, referenced everywhere by key. They are
 * not something a user creates, so they are seeded rather than entered.
 *
 * **Transcribed from `docs/data-model.js`**, which stays the source of truth. If
 * the two ever disagree, that file wins and this one is wrong.
 *
 * Plain data with no Firebase in sight. Writing it is `system-setup.ts`.
 *
 * ---
 *
 * ## Three things copied verbatim that look like slips
 *
 * Left exactly as the schema has them, because these are strings people will
 * read and changing them is a decision rather than a transcription:
 *
 * 1. **`bannedFromLeague` is named `BannedFromLeague`**, with no spaces, while
 *    every other role reads normally — `System Owner`, `Primary Auctioneer`.
 * 2. **`timeIncreased` says "Time limit for for current bidding"**, with "for"
 *    twice.
 * 3. **`timeUp` says "Time up for current bidding "**, with a trailing space.
 *
 * Fixing any of them is a one-line change here *and* in `docs/data-model.js`.
 * Worth doing before this is run against production, because the guard makes a
 * second run a no-op — correcting them afterwards means editing the database by
 * hand.
 *
 * ## And one field that does not exist
 *
 * **Plural role names.** Display needs "Batsmen" and "All Rounders", which
 * cannot be derived from the singular, and `PlayerRoleRecord` has nowhere to
 * put them. One line per role now; a migration later.
 */

import type {
  AuctionPhaseRecord,
  Format,
  FormatRecord,
  LineupRules,
  PlayerCategory,
  PlayerCategoryRecord,
  PlayerRole,
  PlayerRoleRecord,
  StandardAuctionConfig,
  TimelineEventId,
  TimelineEventRecord,
  UserRole,
  UserRoleRecord,
} from '@/types'

// ---------------------------------------------------------------------------
// Roles and people
// ---------------------------------------------------------------------------

/**
 * System and league roles share one node, told apart by `userRolesScope`. The
 * types split them into two unions, which is stricter than the data.
 */
export const USER_ROLES: Readonly<Record<UserRole, UserRoleRecord>> = {
  systemOwner: {
    userRolesId: 'systemOwner',
    userRolesName: 'System Owner',
    userRolesScope: 'System',
  },
  systemAdmin: {
    userRolesId: 'systemAdmin',
    userRolesName: 'System Admin',
    userRolesScope: 'System',
  },
  leagueOwner: {
    userRolesId: 'leagueOwner',
    userRolesName: 'League Owner',
    userRolesScope: 'League',
  },
  leagueAdmin: {
    userRolesId: 'leagueAdmin',
    userRolesName: 'League Admin',
    userRolesScope: 'League',
  },
  manager: {
    userRolesId: 'manager',
    userRolesName: 'Manager',
    userRolesScope: 'League',
  },
  primaryAuctioneer: {
    userRolesId: 'primaryAuctioneer',
    userRolesName: 'Primary Auctioneer',
    userRolesScope: 'League',
  },
  secondaryAuctioneer: {
    userRolesId: 'secondaryAuctioneer',
    userRolesName: 'Secondary Auctioneer',
    userRolesScope: 'League',
  },
  spectator: {
    userRolesId: 'spectator',
    userRolesName: 'Spectator',
    userRolesScope: 'League',
  },
  bannedFromLeague: {
    userRolesId: 'bannedFromLeague',
    // Verbatim from the schema. See note 1 in the header.
    userRolesName: 'BannedFromLeague',
    userRolesScope: 'League',
  },
}

// ---------------------------------------------------------------------------
// Cricket
// ---------------------------------------------------------------------------

export const FORMAT_RECORDS: Readonly<Record<Format, FormatRecord>> = {
  t20: { formatId: 't20', formatName: 'T20' },
  odi: { formatId: 'odi', formatName: 'ODI' },
  test: { formatId: 'test', formatName: 'Test' },
}

/**
 * `playerRoleIcon` is the emoji shown before a player's name in a lineup — a
 * bat, a ball, gloves. **Left empty deliberately**; choosing them is a separate
 * job and an empty string is what the type already allows.
 */
export const PLAYER_ROLE_RECORDS: Readonly<
  Record<PlayerRole, PlayerRoleRecord>
> = {
  batsman: {
    playerRoleId: 'batsman',
    playerRoleName: 'Batsman',
    playerRoleShortName: 'BAT',
    playerRoleIcon: '',
  },
  bowler: {
    playerRoleId: 'bowler',
    playerRoleName: 'Bowler',
    playerRoleShortName: 'BL',
    playerRoleIcon: '',
  },
  wicketKeeper: {
    playerRoleId: 'wicketKeeper',
    playerRoleName: 'Wicket Keeper',
    playerRoleShortName: 'WK',
    playerRoleIcon: '',
  },
  allRounder: {
    playerRoleId: 'allRounder',
    playerRoleName: 'All Rounder',
    playerRoleShortName: 'ALL',
    playerRoleIcon: '',
  },
}

/**
 * `playerCategoryAuctionFormat` drives batch progression: Marquee and Star are
 * bid for, General goes to the draft.
 */
export const PLAYER_CATEGORY_RECORDS: Readonly<
  Record<PlayerCategory, PlayerCategoryRecord>
> = {
  marquee: {
    playerCategoryId: 'marquee',
    playerCategoryName: 'Marquee',
    playerCategoryAuctionFormat: 'Auction',
  },
  star: {
    playerCategoryId: 'star',
    playerCategoryName: 'Star',
    playerCategoryAuctionFormat: 'Auction',
  },
  general: {
    playerCategoryId: 'general',
    playerCategoryName: 'General',
    playerCategoryAuctionFormat: 'Draft',
  },
}

/**
 * The starting set of base tournaments, which the interface calls **Base
 * Tournament** and never "competition".
 *
 * **No ids here.** Competitions are keyed by push key, unlike every reference
 * table above, so `system-setup.ts` generates one per entry at write time.
 * That is also the reason the setup guard exists: without it a second run would
 * create six more rather than overwriting six.
 *
 * A starting set, not a closed one. Admins create more.
 */
export const SEED_COMPETITIONS: readonly {
  competitionName: string
  formatId: Format
}[] = [
  { competitionName: 'IPL', formatId: 't20' },
  { competitionName: 'ODI World Cup', formatId: 'odi' },
  { competitionName: 'ODI Series', formatId: 'odi' },
  { competitionName: 'Test Series', formatId: 'test' },
  { competitionName: 'T20 Series', formatId: 't20' },
  { competitionName: 'World T20', formatId: 't20' },
]

// ---------------------------------------------------------------------------
// Auction
// ---------------------------------------------------------------------------

export const AUCTION_PHASE_RECORDS: Readonly<
  Record<string, AuctionPhaseRecord>
> = {
  notStarted: {
    phaseId: 'notStarted',
    phaseName: 'NotStarted',
    phaseDescription: 'Not Started',
  },
  betweenPlayers: {
    phaseId: 'betweenPlayers',
    phaseName: 'BetweenPlayers',
    phaseDescription: 'Between Players',
  },
  bidding: {
    phaseId: 'bidding',
    phaseName: 'Bidding',
    phaseDescription: 'Bidding',
  },
  paused: {
    phaseId: 'paused',
    phaseName: 'Paused',
    phaseDescription: 'Paused',
  },
  timeUp: {
    phaseId: 'timeUp',
    phaseName: 'TimeUp',
    phaseDescription: 'TimeUp',
  },
  sold: { phaseId: 'sold', phaseName: 'Sold', phaseDescription: 'Sold' },
  unsold: {
    phaseId: 'unsold',
    phaseName: 'Unsold',
    phaseDescription: 'Unsold',
  },
  recovering: {
    phaseId: 'recovering',
    phaseName: 'Recovering',
    phaseDescription: 'Recovering',
  },
  ended: { phaseId: 'ended', phaseName: 'Ended', phaseDescription: 'Ended' },
}

/**
 * The event **catalogue**, not the events that happened. Occurrences live at
 * `liveAuctions/{leagueId}/timeline` and carry an id plus its data, so each
 * client renders its own wording rather than reading a pre-written sentence.
 *
 * `params` names the values an occurrence carries. It does not say their types,
 * which is why the per-event discriminated union in `live-auction.ts` cannot be
 * derived from this and has to be written by hand.
 */
export const TIMELINE_EVENT_RECORDS: Readonly<
  Record<TimelineEventId, TimelineEventRecord>
> = {
  auctionStarted: {
    timelineEventId: 'auctionStarted',
    timelineEventType: 'AuctionStarted',
    timelineEventDescription: 'Auction Started',
    params: [],
  },
  nextBatch: {
    timelineEventId: 'nextBatch',
    timelineEventType: 'NextBatch',
    timelineEventDescription: 'Next batch of players selected',
    params: ['playerCategory', 'playerRole'],
  },
  nextPlayer: {
    timelineEventId: 'nextPlayer',
    timelineEventType: 'NextPlayer',
    timelineEventDescription: 'Next player bidding started',
    params: ['playerId', 'basePrice', 'timeLimit'],
  },
  bid: {
    timelineEventId: 'bid',
    timelineEventType: 'Bid',
    timelineEventDescription: 'Bid accepted for current player',
    params: ['playerId', 'bid', 'managerId'],
  },
  noBid: {
    timelineEventId: 'noBid',
    timelineEventType: 'NoBid',
    timelineEventDescription: 'No bid accepted for current player',
    params: ['playerId', 'managerId'],
  },
  paused: {
    timelineEventId: 'paused',
    timelineEventType: 'Paused',
    timelineEventDescription: 'Bidding paused',
    params: [],
  },
  auctionRestarted: {
    timelineEventId: 'auctionRestarted',
    timelineEventType: 'AuctionRestarted',
    timelineEventDescription: 'Bidding restarted',
    params: [],
  },
  auctionBeingRecovered: {
    timelineEventId: 'auctionBeingRecovered',
    timelineEventType: 'AuctionBeingRecovered',
    timelineEventDescription: 'Auction is being recovered to valid state',
    params: [],
  },
  auctionRecovered: {
    timelineEventId: 'auctionRecovered',
    timelineEventType: 'AuctionRecovered',
    timelineEventDescription: 'Auction state recovered to valid state',
    params: ['rewindedRounds'],
  },
  auctioneerChanged: {
    timelineEventId: 'auctioneerChanged',
    timelineEventType: 'AuctioneerChanged',
    timelineEventDescription: 'Auctioneer changed',
    params: ['oldAuctioneerId', 'newAuctioneerId'],
  },
  sold: {
    timelineEventId: 'sold',
    timelineEventType: 'Sold',
    timelineEventDescription: 'Current player was sold',
    params: ['playerId', 'winningBid', 'managerId'],
  },
  unsold: {
    timelineEventId: 'unsold',
    timelineEventType: 'Unsold',
    timelineEventDescription: 'Current player was unsold',
    params: ['playerId'],
  },
  draftStarted: {
    timelineEventId: 'draftStarted',
    timelineEventType: 'DraftStarted',
    timelineEventDescription: 'Draft started',
    params: [],
  },
  nextDraftManager: {
    timelineEventId: 'nextDraftManager',
    timelineEventType: 'NextDraftManager',
    timelineEventDescription:
      "It's the turn of the next manager in the draft sequence",
    params: ['managerId'],
  },
  draftPick: {
    timelineEventId: 'draftPick',
    timelineEventType: 'DraftPick',
    timelineEventDescription: 'Current manager made a draft pick',
    params: ['managerId', 'playerId', 'basePrice'],
  },
  firstCall: {
    timelineEventId: 'firstCall',
    timelineEventType: 'FirstCall',
    timelineEventDescription: 'First call for bids by auctioneer',
    params: ['timeRemaining'],
  },
  secondCall: {
    timelineEventId: 'secondCall',
    timelineEventType: 'SecondCall',
    timelineEventDescription: 'Second call for bids by auctioneer',
    params: ['timeRemaining'],
  },
  lastCall: {
    timelineEventId: 'lastCall',
    timelineEventType: 'LastCall',
    timelineEventDescription: 'Last call for bids by auctioneer',
    params: ['timeRemaining'],
  },
  timeUp: {
    timelineEventId: 'timeUp',
    timelineEventType: 'TimeUp',
    // Verbatim, trailing space included. See note 3 in the header.
    timelineEventDescription: 'Time up for current bidding ',
    params: [],
  },
  timeIncreased: {
    timelineEventId: 'timeIncreased',
    timelineEventType: 'TimeIncreased',
    // Verbatim, doubled "for" included. See note 2 in the header.
    timelineEventDescription:
      'Time limit for for current bidding increased by auctioneer',
    params: ['timeAdded'],
  },
  auctionEnded: {
    timelineEventId: 'auctionEnded',
    timelineEventType: 'AuctionEnded',
    timelineEventDescription: 'Auction ended',
    params: [],
  },
}

// ---------------------------------------------------------------------------
// Standards — what a new league inherits
// ---------------------------------------------------------------------------

/**
 * **`playerDetails` is empty**, and stays that way until an admin sets base
 * prices and categories for real players.
 *
 * Note that Firebase does not store an empty object, so this key will simply
 * not exist after the write. Reading it back gives `undefined`, which is the
 * same thing an absent map means everywhere else in this model.
 */
export const STANDARD_AUCTION_CONFIG: StandardAuctionConfig = {
  playerDetails: {},
  minSquadSize: 13,
  maxSquadSize: 20,
  slots: 6,
  totalBudget: 100,
  maxOverseasPlayersAllowedInXI: 4,
}

/**
 * Default per-role composition limits for a legal XI.
 *
 * **`max` is omitted rather than set to null** where there is no upper limit.
 * The schema writes `max: null`, and Firebase deletes any key written as null,
 * so the two produce the same stored result — but omitting it means what goes
 * in matches what comes back. `LineupRule` documents absent as meaning no
 * upper limit.
 */
export const STANDARD_FANTASY_LINEUP_RULES: LineupRules = {
  batsman: { min: 2 },
  bowler: { min: 2, max: 4 },
  wicketKeeper: { min: 1 },
  allRounder: { min: 1 },
}

/**
 * How long before a match starts that teams lock, in milliseconds. **Zero means
 * they lock at the first ball.**
 *
 * Seeds the create form. There is no read-time fallback to it — a league copies
 * the chosen value at creation and owns it from then on, because managers
 * commit against their own deadline.
 */
export const STANDARD_TEAM_CHANGES_DEADLINE_OFFSET = 0
