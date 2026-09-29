/**
 * What the data layer throws, and how it survives the wire.
 *
 * **A code per rule, plus the message the server wrote.** The code is for the
 * caller to branch on and for logs to group by; the message is what a person
 * reads. Messages are rendered on the server because that is where the context
 * is — "You have 2 transfers left and this uses 3" needs both numbers.
 *
 * **Backend errors never cross the boundary.** Firebase throws its own objects
 * with its own codes, and no Firebase-shaped type may reach anything above the
 * data layer. The original is kept as `cause` for debugging.
 */

export type ErrorCode =
  // -- who is asking -------------------------------------------------------
  /** No session, or a token that did not verify. */
  | 'unauthenticated'
  /** Signed in, but not a system admin. */
  | 'notSystemAdmin'
  /** Not the league's owner or one of its admins. */
  | 'notLeagueAdmin'
  /** In the league, but not playing in it. Owning is not playing. */
  | 'notAManager'
  /** Barred from the league. Deliberately distinct from `notAManager`. */
  | 'banned'
  /** Refused by the database rules themselves, rather than by a check here. */
  | 'forbidden'

  // -- joining -------------------------------------------------------------
  | 'alreadyMember'
  | 'leagueFull'
  | 'joinDeadlinePassed'
  /** A closed league needs its admin to approve, which is not built yet. */
  | 'closedLeague'

  // -- time ----------------------------------------------------------------
  /** The team for this match or gameweek can no longer be changed. */
  | 'deadlinePassed'
  /** Standings asked for before the period's deadline, so nothing is final. */
  | 'periodNotLocked'

  // -- what was submitted --------------------------------------------------
  /** More changes than the allowance or the cap permits. */
  | 'allowanceExceeded'
  /** Duplicate players, captaincy rules, or the role limits. */
  | 'illegalLineup'
  /** A match whose two teams are not decided yet. */
  | 'teamsNotSet'
  /** Points that are not numbers, or for a player in neither team. */
  | 'invalidPoints'
  /** Anything else the caller got wrong, including bad arguments. */
  | 'invalid'

  // -- what was asked for --------------------------------------------------
  /** A league, tournament, match, gameweek, round or user that is not there. */
  | 'notFound'
  /** An admin action refused because the data is not ready for it. */
  | 'invalidConfig'

  // -- everything else -----------------------------------------------------
  /** Offline, or the backend is unreachable. Worth retrying. */
  | 'unavailable'
  /** Unexpected. Not retryable, and not something a caller can interpret. */
  | 'internal'

/**
 * **The code is the precise answer; the status is the coarse one.** Logs and
 * alerting read the status, so an ordinary refusal must not look like a bug:
 * a rule saying no is a 4xx, and only `internal` is a 500.
 */
export function httpStatusFor(code: ErrorCode): number {
  switch (code) {
    case 'unauthenticated':
      return 401
    case 'notSystemAdmin':
    case 'notLeagueAdmin':
    case 'notAManager':
    case 'banned':
    case 'forbidden':
      return 403
    case 'notFound':
      return 404
    case 'alreadyMember':
    case 'leagueFull':
    case 'joinDeadlinePassed':
    case 'closedLeague':
    case 'deadlinePassed':
    case 'periodNotLocked':
    case 'allowanceExceeded':
    case 'invalidConfig':
      return 409
    case 'illegalLineup':
    case 'teamsNotSet':
    case 'invalidPoints':
    case 'invalid':
      return 400
    case 'unavailable':
      return 503
    case 'internal':
      return 500
  }
}

/** What an error looks like on the wire. */
export interface ErrorBody {
  code: ErrorCode
  message: string
}

export class DataLayerError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'DataLayerError'
    this.code = code
  }
}

/** Narrow an unknown catch. */
export function isDataLayerError(error: unknown): error is DataLayerError {
  return error instanceof DataLayerError
}
