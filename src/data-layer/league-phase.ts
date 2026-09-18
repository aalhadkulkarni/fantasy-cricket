import type { LeaguePhase } from '@/types'

/**
 * A league's lifecycle phase.
 *
 * **Never stored, and derived in exactly one place.** `my-leagues.md` and
 * `league-home.md` describe the same five states and say plainly that it is one
 * derivation shared by both — implementing it twice is how they drift.
 *
 * It is not stored because it is a function of the current time, and Phase 1
 * has no server to write a field when a deadline passes. The old system held it
 * as a constant in source, so advancing a league needed a redeploy.
 *
 * **Not backend knowledge**, so it sits here rather than in `firebase/`. A REST
 * implementation would feed it the same four facts and get the same answer.
 */
export function derivePhase(facts: {
  /** The admin asserting every point and correction is in. */
  finishedAt: number | undefined

  /** The earliest match start. Absent until some match has a date. */
  tournamentStartDate: number | undefined

  isAuctionEnabled: boolean

  /** Auction leagues only. When bidding is scheduled to open. */
  auctionStartTime: number | undefined

  /**
   * Whether the auction runtime node exists. **Its absence is the normal
   * pre-auction state**, not an error.
   */
  auctionHasStarted: boolean

  now: number
}): LeaguePhase {
  // A person decides this, and nothing overrides them.
  if (facts.finishedAt !== undefined) return 'finished'

  // Once the cricket has started, the league is running whatever came before.
  if (
    facts.tournamentStartDate !== undefined &&
    facts.now >= facts.tournamentStartDate
  ) {
    return 'active'
  }

  if (facts.isAuctionEnabled) {
    // Squads are won before teams are picked, so team submission is what
    // follows a finished auction rather than something running alongside it.
    if (facts.auctionHasStarted) return 'teamSubmission'
    if (
      facts.auctionStartTime !== undefined &&
      facts.now >= facts.auctionStartTime
    ) {
      return 'auction'
    }
    return 'preAuction'
  }

  // A regular league has nothing before team submission.
  return 'teamSubmission'
}
