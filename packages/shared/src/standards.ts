/**
 * `standardAuctionConfig`, `standardFantasyLineupRules` and
 * `standardFantasyLeagueTeamChangesDeadlineOffset`.
 *
 * Defaults a league inherits. **All three are copied into the league at
 * creation, not resolved at read time.** Points are the only standard that
 * resolves dynamically, and the difference is not an inconsistency: points get
 * corrected after the fact and a correction must reach every league, whereas
 * these are things managers commit against, so a standard edited mid-season
 * must not retroactively change what a completed auction ran under.
 */

import type { PlayerId } from './ids'
import type { LineupRules, LeaguePlayerAuctionDetail } from './league'

/**
 * The auction defaults, and the seed for the create form.
 *
 * NOTE: `playerDetails` here holds **every player in the system**, while a
 * league needs only its tournament's participants. So copying it into a league
 * is a projection onto one tournament rather than a snapshot, which is the
 * decisive reason not to resolve it dynamically — doing so would mean reading
 * every player in the system on every read and intersecting.
 */
export interface StandardAuctionConfig {
  playerDetails: Record<PlayerId, LeaguePlayerAuctionDetail>
  minSquadSize: number
  maxSquadSize: number

  /**
   * Number of manager slots.
   *
   * NOTE: this field has no counterpart on a league's own `AuctionConfig`. It
   * seeds the Max slots field on the create form, and the league then stores
   * that number once, at `League.maxSlots`. Two editable fields holding one
   * number could only ever desync, and they already had.
   */
  slots: number

  totalBudget: number
  maxOverseasPlayersAllowedInXI?: number
}

/** Default per-role composition limits for a legal XI. */
export type StandardFantasyLineupRules = LineupRules

/**
 * Default team-changes deadline offset, in milliseconds before a match starts.
 * Zero means teams lock at the first ball.
 *
 * Seeds the create form. There is no read-time fallback to it: a league always
 * carries its own value, because managers commit against their deadline and a
 * standard edited mid-season must not move lock times under them.
 */
export type StandardFantasyLeagueTeamChangesDeadlineOffset = number
