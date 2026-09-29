/**
 * `standardPointsByMatch`, `standardPointsByPlayer`, `customPointsByMatch` and
 * `customPointsByPlayer`.
 *
 * Points are stored **per player per match**, never per manager. A manager's
 * total is computed at read time by resolving which players were in their
 * lineup and summing. That is why a scoring correction means editing one number
 * and every view is instantly right; stored totals would mean finding and
 * fixing every manager the mistake touched.
 */

import type { LeagueId, MatchId, PlayerId, TournamentId } from './ids'

/**
 * Zero and absent are equivalent. The reason a player scored nothing — did not
 * play, played badly — is not recorded.
 */
export type PointsForMatch = Record<PlayerId, number>
export type PointsForPlayer = Record<MatchId, number>

/**
 * Standard points, entered once by a system admin at tournament level and used
 * by every league that has not opted into its own scoring.
 *
 * NOTE: these two hold the **same values in both directions**, which is the one
 * place this model duplicates values rather than relationships. Everywhere else
 * a two-sided structure stores `true` on one side. So a correction has to write
 * both paths in the same atomic update or the copies diverge silently.
 *
 * Match-major serves points entry and the leaderboard; player-major serves
 * "this player's season so far". Worth checking at implementation whether both
 * are actually doing work — if only one is, dropping the other removes the
 * dual-write requirement with it.
 */
export type StandardPointsByMatch = Record<
  TournamentId,
  Record<MatchId, PointsForMatch>
>
export type StandardPointsByPlayer = Record<
  TournamentId,
  Record<PlayerId, PointsForPlayer>
>

/**
 * Custom points, keyed by league rather than tournament, and existing only for
 * leagues whose `isCustomScoringSystem` is true.
 *
 * **Resolution follows the flag, not a search order.** A custom-scoring league
 * reads only its own store. There is no per-match fallback to standard: a match
 * its admin has not entered yet simply has no points, rather than borrowed
 * ones. Falling back would let one league score some matches by its own rules
 * and others by the standard ones, which is worse than showing nothing because
 * nobody would see it happen.
 *
 * Standard points are never copied into a league. Copying would mean applying
 * one correction in every league that opted in.
 */
export type CustomPointsByMatch = Record<
  LeagueId,
  Record<MatchId, PointsForMatch>
>
export type CustomPointsByPlayer = Record<
  LeagueId,
  Record<PlayerId, PointsForPlayer>
>
