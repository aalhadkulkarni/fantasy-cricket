import type { AuctionPhase, LeaguePhase } from '@fantasy-cricket/shared'

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
 * implementation would feed it the same facts and get the same answer.
 */
export function derivePhase(facts: {
  /** The admin asserting every point and correction is in. */
  finishedAt: number | undefined

  /** The earliest match start. Absent until some match has a date. */
  tournamentStartDate: number | undefined

  isAuctionEnabled: boolean

  /**
   * The live auction's own phase, or absent when the auction has not been
   * started. **Absence is the normal pre-auction state**, not an error.
   */
  auctionPhase: AuctionPhase | undefined

  now: number
}): LeaguePhase {
  // A person decides this, and nothing overrides them.
  if (facts.finishedAt !== undefined) return 'finished'

  /*
    **An auction league stays in its auction until the auctioneer closes it.**
    Not the scheduled start, and not the first ball: squads are won before
    teams are picked, so team submission opens only once the auction is
    marked ended, whatever the clock or the fixtures say. An auction that
    never runs leaves the league waiting for it.
  */
  if (facts.isAuctionEnabled && facts.auctionPhase !== 'ended') {
    return facts.auctionPhase === undefined ? 'preAuction' : 'auction'
  }

  // Once the cricket has started, the league is running.
  if (
    facts.tournamentStartDate !== undefined &&
    facts.now >= facts.tournamentStartDate
  ) {
    return 'active'
  }

  return 'teamSubmission'
}
