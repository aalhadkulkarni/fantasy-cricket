/**
 * The frontend's data types.
 *
 * Most of these still mirror the Firebase node they came from, because that is
 * where the work started. **That is a stage, not the design.** These are the
 * shapes the interface is built out of, and they are heading towards carrying
 * resolved entities and derived values, so that a component receives what it
 * renders rather than ids to go and chase.
 *
 * Three things follow from that:
 *
 * - The `DERIVED` and `JOIN` markers scattered through these files are a
 *   **build list**, not a record of things deliberately left out. Each one names
 *   something a screen needs and cannot currently find.
 * - **Resolve where the join is static for the context.** A player's role
 *   record, their team for the tournament being viewed, whether they are
 *   overseas — none of those change while a page is open, so resolving them
 *   once and putting them on the type is pure gain. It also stops six
 *   components each deriving the same thing slightly differently.
 * - **Leave out what has no single answer.** Points are per player per match,
 *   rank needs every manager's total, a gameweek's lock depends on the clock.
 *   Those belong to per-screen shapes composed from these types, not to the
 *   entities themselves.
 *
 * Each file names the database path it is currently sourced from. Keep those:
 * knowing where a value comes from stays useful, including in Phase 2. But a
 * path says where the data is read, not what the type is for.
 *
 * Reads are subtree-shaped — fetching a path pulls everything beneath it — and
 * that governs how the data layer fetches. It is why several of these types are
 * grouped the way they are.
 *
 * ---
 *
 * **Times are epoch milliseconds.** Every instant — `finishedAt`,
 * `startTimestamp`, `deadline`, `requestedAt`, `bannedAt`, `publishedAt`,
 * `archivedAt` and the rest — is a millisecond count, never seconds.
 *
 * They stay `number` for now. Firebase's server timestamp arrives as exactly
 * that and `new Date(value)` takes it directly, so converting costs nothing
 * wherever a real `Date` is wanted.
 *
 * The reason to revisit: **instants and durations are the same type today.**
 * `fantasyLeagueTeamChangesDeadlineOffset`, its standard-league twin in
 * `standards.ts`, and the timeline's time limit, time added and time remaining
 * are all millisecond counts too. Assigning a duration where an instant belongs
 * compiles cleanly and is silently wrong.
 *
 * **Durations stay `number` regardless.** That part is decided.
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
