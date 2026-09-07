/**
 * Persistence types: the shapes Firebase Realtime Database actually holds.
 *
 * **They logically represent the schema; they do not mirror its key layout.**
 *
 * No derived values and no joins — what a consumer will want but cannot find is
 * recorded as a `DERIVED` or `JOIN` comment on the type itself, never quietly
 * added. But where the wire layout cannot be typed honestly, the grouping may
 * differ, so long as the information is identical.
 *
 * There is one such case today, and it is documented where it occurs:
 * `CurrentSubmittedBids` and `CurrentAcceptedBids` collect their per-player
 * entries under a named field — `submittedBids` and `acceptedBids` — because on
 * the wire those sit beside two fixed keys, and an index signature cannot
 * promise what that shape implies.
 *
 * The line to hold: **rearranging is allowed, inventing is not.** If a value is
 * not in the database, it does not appear here at any cost.
 *
 * One file per database node, so a file corresponds to something you can fetch
 * in one read. That matters because reads here are subtree-shaped: fetching a
 * path pulls everything beneath it.
 *
 * Whether components should consume these directly, or a separate domain shape
 * mapped from them, is **not yet decided**. These are needed either way — they
 * are what the data layer reads and writes.
 *
 * ---
 *
 * **Times are epoch milliseconds.** Every stored instant — `finishedAt`,
 * `startTimestamp`, `deadline`, `requestedAt`, `bannedAt`, `publishedAt`,
 * `archivedAt` and the rest — is a millisecond count, never seconds. Firebase's
 * server timestamp resolves to exactly that on read, so `new Date(value)` works
 * on any of them directly.
 *
 * `Date` was **considered and deferred, not rejected.** It is permitted under
 * the rule above, because converting at the boundary is the data layer's job
 * and a `Date` still logically represents what is stored. It is not here yet
 * for one reason: it would settle the domain-versus-persistence question above
 * as a side effect. If a domain shape appears, `Date` belongs there and these
 * stay numeric. If one never does, these become the app's types and `Date`
 * would have been the better call. **Revisit when that question is settled,
 * not before.**
 *
 * The reason it is worth revisiting: instants and durations are the same type
 * today. `fantasyLeagueTeamChangesDeadlineOffset`, its standard-league twin in
 * `standards.ts`, and the timeline's time limit, time added and time remaining
 * are all millisecond counts too. Assigning a duration where an instant belongs
 * compiles cleanly and is silently wrong.
 *
 * **Durations stay `number` regardless.** That part is decided, not deferred.
 */

export type * from './ids'
export type * from './reference'
export type * from './standards'
export type * from './user'
export type * from './competition'
export type * from './team'
export type * from './player'
export type * from './tournament'
export type * from './league'
export type * from './membership'
export type * from './lineup'
export type * from './squad'
export type * from './points'
export type * from './transfer'
export type * from './live-auction'

// The reference tables also export runtime values — the key arrays, which
// double as validators for anything arriving from the database.
export {
  SYSTEM_ROLES,
  LEAGUE_ROLES,
  FORMATS,
  PLAYER_ROLES,
  PLAYER_CATEGORIES,
  AUCTION_PHASES,
  TIMELINE_EVENTS,
} from './reference'
