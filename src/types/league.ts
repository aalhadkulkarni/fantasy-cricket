/**
 * `leagues/{leagueId}` and `leagueCodeToLeagueMapping`.
 *
 * Config and thin membership only. Everything a league accumulates — lineups,
 * squads, join requests, transfer offers, the live auction — sits in its own
 * top-level node keyed by `leagueId`, so that reading a league to show its name
 * does not drag twenty managers' selections across sixty-four matches with it.
 *
 * Auction *configuration* lives here. The auction *runtime* is
 * `liveAuctions/{leagueId}`, in `live-auction.ts`. Config is admin-edited and
 * freezes when the auction starts; the runtime is written many times a second
 * for two hours and then never again.
 */

import type {
  GameWeekId,
  LeagueId,
  LeagueJoinCode,
  MatchId,
  PlayerId,
  RoundId,
  TournamentId,
  TransferWindowId,
  UserId,
} from './ids'
import type { LeagueRole, PlayerCategory, PlayerRole } from './reference'

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

/**
 * One entry in `leagues/{leagueId}/leagueMembers`, keyed by `UserId`.
 *
 * JOIN: the key is the only identity here. Display name, avatar and email are
 * in `users/{userId}`.
 *
 * DERIVED: a manager's points total. Never stored per manager — resolve their
 * lineup for each match, sum the player points, apply the captain and
 * vice-captain multipliers, then add `pointsAdjustment`.
 *
 * DERIVED: rank, which needs the whole league's totals.
 */
export interface LeagueMember {
  /** Managers only. Absent for spectators, and for admins who do not play. */
  fantasyTeamName?: string

  /**
   * Additive. One person is routinely owner, admin and manager at once.
   *
   * A ban is expressed here: strip `manager`, add `bannedFromLeague`. That is
   * what makes slot counting and the leaderboard drop them automatically, since
   * both already filter on `manager`.
   */
  leagueRoles: Partial<Record<LeagueRole, true>>

  /**
   * Net effect of accepted transfers. Managers only.
   *
   * The one thing the leaderboard needs that player points cannot produce, so
   * it is the single exception to points never being stored per manager. The
   * per-transfer amounts stay in `transferProposals`, so this can be rebuilt if
   * it drifts.
   */
  pointsAdjustment?: number
}

// ---------------------------------------------------------------------------
// Lineup rules
// ---------------------------------------------------------------------------

/**
 * Per-role composition limits for a legal XI.
 *
 * **Absent means no upper limit.** Not null: Firebase deletes a key written as
 * null, so a read never sees one. Writing null is how the layer *removes* a
 * limit; reading it back gives absence. Same everywhere in these types.
 */
export interface LineupRule {
  min: number
  max?: number
}

export type LineupRules = Partial<Record<PlayerRole, LineupRule>>

// ---------------------------------------------------------------------------
// Gameweek structure
// ---------------------------------------------------------------------------

/**
 * A gameweek is a contiguous run of matches. Equal length within a round, which
 * is what makes rounds necessary: a sixty-match group stage divides evenly,
 * a four-match knockout tail does not divide the same way.
 *
 * JOIN: `startMatchId` and `endMatchId` point into
 * `tournaments/{tournamentId}/matches`.
 *
 * DERIVED: the matches *between* those two. Resolve by `matchNumber`, never by
 * comparing ids — ids are opaque push keys and sort by creation time, not by
 * fixture order.
 *
 * DERIVED: whether this gameweek is locked. It locks at the deadline of its
 * first match, which is that match's start minus the league's offset.
 */
export interface GameWeek {
  gameWeekId: GameWeekId
  gameWeekName: string
  gameWeekNumber: number
  startMatchId: MatchId
  endMatchId: MatchId
}

/**
 * Per-round change allowances, keyed by `RoundId` under `roundConfigs`.
 *
 * An absent allowance means unlimited, as with `LineupRule.max`.
 */
export interface RoundConfig {
  maxNumberOfChangesAllowedBeforeRoundStart?: number
  maxNumberOfChangesAllowedBetweenGameWeeks?: number
  /** Forced false where a round's gameweeks are one match long. */
  isImpactSubAllowed: boolean
  gameWeeks: Record<GameWeekId, GameWeek>
}

// ---------------------------------------------------------------------------
// Auction configuration
// ---------------------------------------------------------------------------

/** Per-player overrides for this league. Role is deliberately not overridable. */
export interface LeaguePlayerAuctionDetail {
  playerCategory: PlayerCategory
  playerBasePrice: number
}

/**
 * Copied from `standardAuctionConfig` at creation rather than resolved at read
 * time, for two reasons: the standard holds every player in the system while a
 * league needs only its tournament's participants, so the copy is a projection
 * rather than a snapshot; and managers bid against these values, so a standard
 * edited mid-season must not retroactively change what a completed auction ran
 * under.
 *
 * There is no `slots` field. The slot count lives once, on `League.maxSlots`.
 */
export interface AuctionConfig {
  lastUpdatedBy: {
    user: UserId
    timestamp: number
  }
  /** JOIN: keys point at `players/{playerId}` for name, country and role. */
  playerDetails: Record<PlayerId, LeaguePlayerAuctionDetail>
  totalBudget: number
  minSquadSize: number
  maxSquadSize: number
  /** Absent means no cap. Overseas means the player's country is not India. */
  maxOverseasPlayersAllowedInXI?: number
}

/**
 * A window during which transfers may be proposed, expressed as a range of
 * matches.
 *
 * DERIVED: whether it is open. There is no stored flag — compare now against
 * the start time of `endMatchId`.
 */
export interface TransferWindow {
  transferWindowId: TransferWindowId
  startMatchId: MatchId
  endMatchId: MatchId
}

/**
 * DERIVED: whether the auction has started, is running, or is done. The
 * runtime node `liveAuctions/{leagueId}` does not exist until `startAuction`
 * creates it, so its absence is the normal pre-auction state and must not be
 * treated as an error.
 */
export interface AuctionDetails {
  auctionConfig: AuctionConfig
  /** Absent when the admin disabled transfers. */
  transferWindows?: Record<TransferWindowId, TransferWindow>
  /** Empty until the auctioneer generates it, which happens before any bidding. */
  draftOrder: Record<UserId, number>
  auctionStartTime: number

  /**
   * NOTE: deliberately duplicates the `primaryAuctioneer` and
   * `secondaryAuctioneer` roles on the membership record, so that showing who
   * the auctioneer is costs one field read rather than a scan of every member's
   * roles. A handover must write both in one atomic update.
   */
  primaryAuctioneer: UserId
  /** Absent at creation, since nobody has joined yet to be the backup. */
  secondaryAuctioneer?: UserId
}

// ---------------------------------------------------------------------------
// The league itself
// ---------------------------------------------------------------------------

/** Model vocabulary. The interface says "public" and "closed". */
export type LeagueEntry = 'Open' | 'Private'

/**
 * Fields every league has, whatever its type.
 *
 * DERIVED, and the big one: `phase` — Pre-auction, Auction phase, Team
 * submission, Active, Finished. Never stored, because it is a function of the
 * current time and Phase 1 has no server to write it when a deadline passes.
 * Computed from `auctionStartTime`, whether the runtime node exists, the
 * tournament's first match start, and `finishedAt`.
 *
 * DERIVED: `filledSlots` — count members holding `manager`. No stored counter,
 * because it would fan out to every member's league index entry on every join.
 *
 * DERIVED: which fields are currently editable. Every field carries its own
 * lock, and the locks are a fairness mechanism rather than a convenience.
 *
 * JOIN: `tournamentId` → `tournaments`, `leagueOwner` → `users`.
 */
interface LeagueBase {
  leagueId: LeagueId
  leagueName: string
  leagueOwner: UserId
  leagueJoinCode: LeagueJoinCode

  /**
   * FUTURE: carry the tournament itself rather than its id — a thin one, since
   * the full record drags every match and participant. See
   * `docs/09-future-exploration.md`.
   */
  tournamentId: TournamentId

  leagueEntry: LeagueEntry
  maxSlots: number
  fantasyLineupRules: LineupRules
  leagueMembers: Record<UserId, LeagueMember>

  /**
   * How long before a match starts that teams lock, in milliseconds. Zero means
   * they lock at the first ball. Always written at creation, seeded from the
   * standard — there is no read-time fallback, because managers commit against
   * their deadline.
   */
  fantasyLeagueTeamChangesDeadlineOffset: number
  fantasyLeagueJoinDeadline: number

  /**
   * Set by a deliberate admin action, never derived: only a person knows
   * whether every point and correction is in. Its absence is what keeps a
   * league out of the Archived tab.
   */
  finishedAt?: number

  /**
   * False means standard points, entered once at tournament level. True means
   * the admin enters their own, and then this league reads *only* its own
   * store — there is no per-match fallback to standard.
   */
  isCustomScoringSystem: boolean

  /**
   * Free text explaining how the admin calculates points. Present exactly when
   * `isCustomScoringSystem` is true.
   */
  scoringRulesText?: string
}

/**
 * Changes are counted across the whole tournament rather than per round.
 * Lineups for this kind of league are stored densely, one entry per match.
 */
interface MatchBasedLeague extends LeagueBase {
  isGameWeeksEnabled: false
  isAuctionEnabled: false
  totalChangesAllowed: number
  totalCaptainChangesAllowed: number
  totalViceCaptainChangesAllowed: number
}

/** Changes are configured per round instead, and lineups are stored per gameweek. */
interface GameWeekLeagueBase extends LeagueBase {
  isGameWeeksEnabled: true
  roundConfigs: Record<RoundId, RoundConfig>
}

interface RegularGameWeekLeague extends GameWeekLeagueBase {
  isAuctionEnabled: false
}

/**
 * An auction league is always gameweek-based. Its change allowances are fixed
 * rather than configured — unlimited between gameweeks, one impact sub during
 * one — because the squad won at auction is already the constraint.
 */
interface AuctionLeague extends GameWeekLeagueBase {
  isAuctionEnabled: true
  auctionDetails: AuctionDetails
}

/**
 * Three shapes, not one.
 *
 * The combination that does not exist is match-based plus auction: an auction
 * league forces gameweeks. That rule was previously only a comment in the
 * schema saying "enforced through code, cannot be expressed as a database
 * rule". Here the compiler enforces it.
 *
 * Narrow with `isGameWeeksEnabled` and `isAuctionEnabled`.
 */
export type League = MatchBasedLeague | RegularGameWeekLeague | AuctionLeague

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

/**
 * `leagueCodeToLeagueMapping`. Resolves a typed code to a league in one read,
 * and is also where a new code is claimed transactionally at creation, since a
 * read-then-write check can lose a race.
 */
export type LeagueCodeToLeagueMapping = Record<LeagueJoinCode, LeagueId>
