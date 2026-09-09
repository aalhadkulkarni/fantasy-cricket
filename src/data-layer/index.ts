/**
 * The data layer: every read, write and subscription the app is allowed to
 * make.
 *
 * **This is the contract between client and server** — the equivalent of a set
 * of REST endpoints. Everything above it is a client talking to a server that
 * happens to run in the same process for now. Phase 2 replaces Firebase with a
 * real backend, and this seam is what makes that possible without touching
 * anything above it.
 *
 * Five rules, none negotiable:
 *
 * 1. **No component imports Firebase.** Ever.
 * 2. **No Firebase-shaped type crosses the boundary** — no snapshots, no
 *    references.
 * 3. **All reads, writes and subscriptions go through here.**
 * 4. **Reads and subscriptions are distinct**, with different lifecycles.
 * 5. **The schema does not leak either.** No function requires its caller to
 *    know how the backend stores anything. The test: could this be
 *    reimplemented against a completely different backend without changing its
 *    callers?
 *
 * **This layer is also the Phase 1 server.** Any rule that will be a
 * server-side check later is enforced here now, not in components — team
 * visibility, join deadlines, squad validity, bid legality, transfer validity,
 * ban checks. Interface gating is convenience; anyone can read the database
 * directly with the client SDK.
 *
 * ---
 *
 * **Nothing here is implemented.** Every function is a signature whose body
 * throws. See `not-implemented.ts`.
 *
 * **These signatures are expected to change.** They describe what the layer
 * must support and roughly what goes in and out. They are not a frozen API.
 * Adding a function, splitting one, or changing what it takes and returns is
 * fine whenever the use case calls for it.
 *
 * Two conventions worth knowing before adding anything:
 *
 * - **Reads take ids and return resolved entities.** `getPlayersForTournament`
 *   returns players, not player ids.
 * - **Identity comes from context, never from a parameter.** `getMyTeam(leagueId,
 *   matchId)`, not `getMyTeam(currentUserId, ...)`. A parameter naming someone
 *   else is `targetUserId`, `requestedUserId` or `managerId`. A client-supplied
 *   "who is asking" is exactly the cheating vector on team visibility.
 *
 * Grouping is by subject rather than by page, because pages share calls.
 * `docs/06-data-layer.md` lists `getMembers` three times and twelve other names
 * twice; each is defined once here.
 *
 * ---
 *
 * ## TODO — Firebase is not wired in yet
 *
 * **Identity and system setup work. Everything else still throws.** As each
 * area is built, its functions become one-line delegations to `getApi()` and
 * the backend work lands in `firebase/firebase-api.ts`.
 *
 * ```
 * component  →  dataLayer.getCurrentUser()     here: backend-agnostic
 *            →  firebaseApi.getCurrentUser()   one implementation of Api
 *            →  FirebaseService.read(path)     the client, private to firebase/
 * ```
 *
 * A future `RestApi` sits beside `FirebaseApi`, satisfying the same interface.
 * **Migration adds rather than replaces**: both can exist, and because the
 * contract is per-operation, a third implementation could delegate some methods
 * to one backend and some to another while a move is under way. Nothing above
 * this file changes when that happens.
 *
 * Still open: filling in the test, preprod and prod hostnames in
 * `src/config/environments.ts` and clearing the forced override — see G9.
 */

// The only thing this layer exposes about its backend: tell it which
// environment to run against, at bootstrap, before anything else.
//
// It exports no environment values or types of its own. Deciding the
// environment is `src/config/environments.ts`, because it is a fact about the
// deployment rather than about the backend. Nothing about paths or services is
// re-exported either — a path is pure schema, and the fifth rule above is that
// the schema does not leak upward.
export { setEnvironment } from './api'
export type { Api } from './api'

export * from './users'
export * from './actions'
export * from './my-leagues'
export * from './leagues'
export * from './membership'
export * from './tournaments'
export * from './lineups'
export * from './squads'
export * from './points'
export * from './leaderboard'
export * from './transfers'
export * from './auction'
export * from './auctioneer'
export * from './cricket-data'
export * from './tournament-admin'

// The shared subscription shapes. Both the error-handling and unsubscribe
// decisions are parked in that one file, deliberately — see its header.
export type {
  Subscriber,
  SubscriptionErrorHandler,
  Unsubscribe,
} from './subscriptions'
