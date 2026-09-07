/**
 * The six reference tables.
 *
 * These are fixed enums stored as data: authored once by hand, read at runtime
 * for their display names, and referenced everywhere by key. Since G52 their
 * keys are semantic (`manager`, `batsman`, `sold`) rather than numbered.
 *
 * Each table gets three things:
 *
 *   1. a `readonly` array of its keys, which is also the runtime validator for
 *      values arriving from the database;
 *   2. a union derived from that array, which types every reference to it;
 *   3. an interface for the stored record, for whatever reads the table itself.
 *
 * No `enum`. A reference table is not a name-to-value map — a category carries
 * an auction format, a role carries an icon and a short name — so an enum would
 * cover only the key and need a second structure beside it for the rest. The
 * union is also literally the string the database holds, which is the right
 * property for types whose job is to describe stored JSON.
 *
 * The display names are not duplicated here. They live in the database and are
 * read at runtime.
 */

// ---------------------------------------------------------------------------
// userRoles
// ---------------------------------------------------------------------------

/**
 * NOTE: the database keeps system and league roles in one node and tells them
 * apart only with a `userRolesScope` field, so at runtime nothing stops
 * `systemUserRoles` holding `manager`. Splitting the union here is stricter
 * than the data is.
 */
export const SYSTEM_ROLES = ['systemOwner', 'systemAdmin'] as const
export type SystemRole = (typeof SYSTEM_ROLES)[number]

export const LEAGUE_ROLES = [
  'leagueOwner',
  'leagueAdmin',
  'manager',
  'primaryAuctioneer',
  'secondaryAuctioneer',
  'spectator',
  'bannedFromLeague',
] as const
export type LeagueRole = (typeof LEAGUE_ROLES)[number]

export type UserRole = SystemRole | LeagueRole

/** Stored at `userRoles/{userRole}`. */
export interface UserRoleRecord {
  userRolesId: UserRole
  userRolesName: string
  userRolesScope: 'System' | 'League'
}

// ---------------------------------------------------------------------------
// formats
// ---------------------------------------------------------------------------

export const FORMATS = ['t20', 'odi', 'test'] as const
export type Format = (typeof FORMATS)[number]

/** Stored at `formats/{format}`. */
export interface FormatRecord {
  formatId: Format
  formatName: string
}

// ---------------------------------------------------------------------------
// playerRoles
// ---------------------------------------------------------------------------

export const PLAYER_ROLES = [
  'batsman',
  'bowler',
  'wicketKeeper',
  'allRounder',
] as const
export type PlayerRole = (typeof PLAYER_ROLES)[number]

/** Stored at `playerRoles/{playerRole}`. */
export interface PlayerRoleRecord {
  playerRoleId: PlayerRole
  playerRoleName: string
  playerRoleShortName: string
  /** Emoji shown before the player's name in a lineup. May be empty. */
  playerRoleIcon: string
}

// ---------------------------------------------------------------------------
// playerCategories
// ---------------------------------------------------------------------------

export const PLAYER_CATEGORIES = ['marquee', 'star', 'general'] as const
export type PlayerCategory = (typeof PLAYER_CATEGORIES)[number]

/**
 * Stored at `playerCategories/{playerCategory}`.
 *
 * `playerCategoryAuctionFormat` is what drives batch progression: Marquee and
 * Star are bid for, General goes to the draft.
 */
export interface PlayerCategoryRecord {
  playerCategoryId: PlayerCategory
  playerCategoryName: string
  playerCategoryAuctionFormat: 'Auction' | 'Draft'
}

// ---------------------------------------------------------------------------
// liveAuctionPhases
// ---------------------------------------------------------------------------

export const AUCTION_PHASES = [
  'notStarted',
  'betweenPlayers',
  'bidding',
  'paused',
  'timeUp',
  'sold',
  'unsold',
  'recovering',
  'ended',
] as const
export type AuctionPhase = (typeof AUCTION_PHASES)[number]

/**
 * Stored at `liveAuctionPhases/{auctionPhase}`.
 *
 * NOTE: `notStarted` does not mean "scheduled for next week". The runtime node
 * does not exist until `startAuction` creates it, so this phase means the room
 * is open and the first player is not yet up. See `08-pages/auction-center.md`.
 */
export interface AuctionPhaseRecord {
  phaseId: AuctionPhase
  phaseName: string
  phaseDescription: string
}

// ---------------------------------------------------------------------------
// timelineEvents
// ---------------------------------------------------------------------------

export const TIMELINE_EVENTS = [
  'auctionStarted',
  'nextBatch',
  'nextPlayer',
  'bid',
  'noBid',
  'paused',
  'auctionRestarted',
  'auctionBeingRecovered',
  'auctionRecovered',
  'auctioneerChanged',
  'sold',
  'unsold',
  'draftStarted',
  'nextDraftManager',
  'draftPick',
  'firstCall',
  'secondCall',
  'lastCall',
  'timeUp',
  'timeIncreased',
  'auctionEnded',
] as const
export type TimelineEventId = (typeof TIMELINE_EVENTS)[number]

/**
 * Stored at `timelineEvents/{timelineEventId}`.
 *
 * This is the event *catalogue*, not the events that happened. Occurrences live
 * in `liveAuctions/{leagueId}/timeline` and carry an id plus its data, so each
 * client renders its own wording rather than reading a pre-written sentence.
 *
 * DERIVED / NOT MODELLED HERE: `params` is a list of parameter names, so the
 * catalogue cannot say what type each one is. The occurrence types in
 * `live-auction.ts` are where that becomes a discriminated union with real
 * fields — this record only describes the row as stored.
 */
export interface TimelineEventRecord {
  timelineEventId: TimelineEventId
  /** PascalCase, unlike the key. `auctionStarted` has type `AuctionStarted`. */
  timelineEventType: string
  timelineEventDescription: string
  params?: readonly string[]
}
