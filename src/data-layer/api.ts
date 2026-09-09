/**
 * The contract between the app and whatever is behind it.
 *
 * **This is the Phase 2 seam.** Phase 1 talks to Firebase Realtime Database
 * from the browser. Phase 2 puts a real backend there, and the only thing that
 * should change is which implementation of `Api` is constructed.
 *
 * ```
 * component  →  dataLayer.getCurrentUser()     public, backend-agnostic
 *            →  firebaseApi.getCurrentUser()   one implementation of Api
 *            →  FirebaseService.read(path)     the client, private to firebase/
 * ```
 *
 * **A backend client is not an `Api`.** `FirebaseService` knows about paths,
 * snapshots and multi-path updates; a REST client would know about URLs and
 * status codes. Neither belongs in this interface, and a path *is* the schema,
 * which the fifth boundary rule keeps below this line. What goes here are
 * operations, which both can implement without either leaking: Firebase writes
 * a join request with one atomic multi-path update, REST posts once and the
 * server does the same writes itself.
 *
 * ---
 *
 * **Migration adds rather than replaces.** A future `RestApi` sits beside
 * `FirebaseApi`, both satisfying this interface, and nothing above changes when
 * it arrives. Because the contract is per-operation, the move need not even be
 * all at once: a third implementation can satisfy `Api` by delegating some
 * methods to one backend and some to another, which is how such a move is
 * actually staged.
 *
 * ---
 *
 * ## This interface is deliberately small
 *
 * It carries only what is genuinely implemented. `docs/06-data-layer.md` names
 * about 140 operations and most still throw; those keep calling
 * `notImplemented` from their own files and move onto this interface as each
 * one lands. An interface full of methods nothing implements would say nothing
 * about what actually works.
 *
 * It gets split into slices by subject once it grows past what one file can
 * hold, mirroring the public files by name.
 */

import type { Environment } from '@/config/environments'
import type {
  Competition,
  CompetitionId,
  FormatRecord,
  MatchConfig,
  Player,
  PlayerConfig,
  PlayerFilter,
  PlayerId,
  PlayerRoleRecord,
  Team,
  TeamConfig,
  TeamFilter,
  TeamId,
  Tournament,
  TournamentConfig,
  TournamentFilter,
  TournamentId,
  TournamentRoundConfig,
  User,
  UserId,
} from '@/types'

import { DataLayerError } from './data-layer-error'
import { createFirebaseApi } from './firebase/firebase-api'
import type { Subscriber, Unsubscribe } from './subscriptions'

// ---------------------------------------------------------------------------
// Contract types
// ---------------------------------------------------------------------------

/**
 * Who is signed in, as far as the auth provider is concerned.
 *
 * Distinct from a `User`, which is our own record and may not exist yet. This
 * is available the moment the session resolves; that is not.
 */
export interface SignedInIdentity {
  userId: UserId

  /**
   * The account's picture. **Absent when there is none**, which is one of the
   * two cases an initials fallback has to cover — the other being a URL that
   * stops loading later.
   */
  photoUrl: string | undefined
}

/**
 * How a sign-in ended.
 *
 * **Only `blocked` is a failure.** `dismissed` means the person changed their
 * mind, and rendering "sign-in failed" for that would be wrong. `superseded`
 * means a second attempt replaced the first and nothing should be shown.
 */
export type SignInOutcome = 'signedIn' | 'dismissed' | 'superseded' | 'blocked'

/** What a bulk player add did, so the caller can say more than "saved". */
export interface CreatePlayersResult {
  created: number
  /** Names already present. Re-adding a squad is safe rather than duplicating it. */
  skipped: readonly string[]
}

/**
 * Which official leagues to open alongside publishing a tournament.
 *
 * **The publisher owns and administers them but does not play them.** Being a
 * manager means having a fantasy team name, which is chosen when joining, so
 * the admin joins through the same door as everyone else.
 *
 * Both are public, use standard points, and hold no auction — the whole point
 * is that anyone can walk in.
 */
export interface OfficialLeagues {
  /** Changes counted across the whole tournament. */
  matchBased?: boolean
  /** One gameweek per round, so the impact sub exists wherever a round has more than one match. */
  gameWeekBased?: boolean
}

/** What seeding an environment did, so a caller can say more than "done". */
export interface SystemSetupResult {
  status: 'seeded' | 'alreadyDone'
  /** Which environment was written to, or would have been. */
  environment: string
  /** Node name to entry count. Empty when nothing was written. */
  written: Record<string, number>
  /** When the environment was originally seeded. */
  completedAt: number
}

// ---------------------------------------------------------------------------
// The interface
// ---------------------------------------------------------------------------

export interface Api {
  // -- identity ------------------------------------------------------------

  /** Fires with the current session, then again on every change. */
  onAuthChanged(callback: Subscriber<SignedInIdentity | undefined>): Unsubscribe

  signInWithGoogle(): Promise<SignInOutcome>
  signOut(): Promise<void>

  /** The signed-in person's record, or nothing if they have none yet. */
  getCurrentUser(): Promise<User | undefined>

  /** Writes the record for the signed-in person. Identity comes from the session. */
  createUser(userName: string): Promise<User>

  // -- cricket data --------------------------------------------------------

  /** The interface calls these Base Tournaments and never "competitions". */
  getCompetitions(): Promise<Competition[]>

  /**
   * The reference table. Display names live in the database rather than in the
   * union, so anything rendering a role has to read them.
   */
  getPlayerRoles(): Promise<PlayerRoleRecord[]>

  /** Likewise. A tournament's format is its competition's, resolved through here. */
  getFormats(): Promise<FormatRecord[]>

  getTeams(filter?: TeamFilter): Promise<Team[]>

  createTeam(team: TeamConfig): Promise<TeamId>

  /**
   * **Removing a competition takes the team out of it entirely**, including its
   * roster there and every affected player's record. That is the closest thing
   * to a delete this admin has, and it is deliberate — nothing here destroys a
   * team outright.
   */
  updateTeam(teamId: TeamId, changes: Partial<TeamConfig>): Promise<void>

  /** Fully retired players are excluded unless the filter asks for them. */
  getPlayers(filter?: PlayerFilter): Promise<Player[]>

  /**
   * Writes the players **and their team memberships in one update**, so the
   * reverse side on each team lands with them or not at all.
   *
   * Names that already exist are skipped rather than duplicated, and reported.
   */
  createPlayers(players: readonly PlayerConfig[]): Promise<CreatePlayersResult>

  updatePlayer(
    playerId: PlayerId,
    changes: Partial<PlayerConfig>,
  ): Promise<void>

  /**
   * **Replaces** any team this player already had for that competition,
   * clearing the old roster entry in the same update. There is one team per
   * competition, so adding is always moving.
   */
  addPlayerToTeam(
    playerId: PlayerId,
    teamId: TeamId,
    competitionId: CompetitionId,
  ): Promise<void>

  /** Also how "retired from this competition" is expressed. */
  removePlayerFromTeam(
    playerId: PlayerId,
    competitionId: CompetitionId,
  ): Promise<void>

  /**
   * Fully retired from cricket. The one case an empty team map cannot express,
   * since that is indistinguishable from a new player not yet assigned.
   */
  setPlayerRetired(playerId: PlayerId, isRetired: boolean): Promise<void>

  // -- tournaments ---------------------------------------------------------

  /** Unpublished tournaments are excluded unless the filter asks for them. */
  getTournaments(filter?: TournamentFilter): Promise<Tournament[]>

  getTournament(tournamentId: TournamentId): Promise<Tournament>

  /**
   * The tournament, its placeholder matches, and **one round covering all of
   * them**, in one write. Every match belongs to exactly one round, so a
   * tournament that existed briefly without a round would already be invalid.
   *
   * Teams and players are not set here. They come after, through
   * `updateTournamentParticipants`.
   */
  createTournament(config: TournamentConfig): Promise<TournamentId>

  renameTournament(
    tournamentId: TournamentId,
    tournamentName: string,
  ): Promise<void>

  /**
   * Who is playing, **as a map of player to the team they play for here**.
   *
   * One argument rather than teams and players separately, because a player
   * already names their team and two arguments could disagree. The teams follow
   * from the players.
   *
   * **Frozen at this moment and never written back to the player.** A
   * cricketer changing clubs next season must not rewrite a tournament that has
   * already been played.
   */
  updateTournamentParticipants(
    tournamentId: TournamentId,
    participants: Partial<Record<PlayerId, TeamId>>,
  ): Promise<void>

  /**
   * **Also recomputes the tournament's start and end**, in the same write. They
   * are authoritative for reads rather than derived from the match list, so a
   * change that misses the recompute makes every reader wrong at once.
   */
  updateMatches(
    tournamentId: TournamentId,
    matches: readonly MatchConfig[],
  ): Promise<void>

  /**
   * Appends placeholders after the last match and extends the final round to
   * cover them, so the rounds still account for every match.
   *
   * A tournament already under way can gain matches; that is expected rather
   * than exceptional.
   */
  addMatches(tournamentId: TournamentId, count: number): Promise<void>

  /**
   * **The one delete in this admin, and it is narrow on purpose.** Matches come
   * off the end only, and only while the tournament is unpublished.
   *
   * Off the end, because `matchNumber` is the ordering key: removing from the
   * middle would renumber everything after it, silently moving every round and
   * gameweek boundary defined against those numbers.
   *
   * Unpublished, because that is the window in which nothing can reference a
   * match. A league cannot exist against an unpublished tournament, so there
   * are no lineups and no points to strand — which is the reason nothing else
   * here deletes.
   */
  removeMatches(tournamentId: TournamentId, count: number): Promise<void>

  /**
   * The whole round structure at once, **addressed in match numbers**.
   *
   * Replacing the set rather than splitting, merging and renaming separately
   * means the one rule — the rounds tile the matches exactly — is checked in a
   * single place. It is also what makes a mistaken split fixable, which matters
   * because nothing here deletes.
   */
  setRounds(
    tournamentId: TournamentId,
    rounds: readonly TournamentRoundConfig[],
  ): Promise<void>

  /**
   * Makes the tournament visible and lets leagues be created against it.
   *
   * **Refused here if no match has a start time**, rather than merely disabled
   * in the admin form, because interface gating is convenience and this layer
   * is the guard.
   *
   * Any official leagues asked for are created **in the same write** as the
   * publish. Publishing and then failing to create the league would leave a
   * tournament people can see with nothing to join.
   */
  publishTournament(
    tournamentId: TournamentId,
    officialLeagues?: OfficialLeagues,
  ): Promise<void>

  // -- system --------------------------------------------------------------

  setUpBasicSystem(): Promise<SystemSetupResult>
}

// ---------------------------------------------------------------------------
// Which one is active
// ---------------------------------------------------------------------------

let currentApi: (Api & { readonly environment: Environment }) | undefined

/**
 * Chooses the backend for the session and builds it.
 *
 * **Call this at bootstrap, before anything else.** Every read and write goes
 * through what it constructs, and `getApi` refuses to work until it has run,
 * which is what makes "before anything else" a guarantee rather than a
 * convention.
 *
 * The environment is passed in rather than resolved here. Deciding it is
 * `src/config/environments.ts`, because it is a fact about the deployment
 * rather than about the backend.
 *
 * Idempotent rather than single-shot: calling it again with the same
 * environment is a no-op, and calling it with a *different* one throws.
 * Refusing every second call would break under Vite's hot reload, which
 * re-executes modules; this still catches the bug worth catching, which is two
 * different backends in one session.
 *
 * **Firebase is hardcoded here and that is the point.** This one line is the
 * whole of what changes when a second implementation exists.
 */
export function setEnvironment(environment: Environment): void {
  if (currentApi !== undefined) {
    if (currentApi.environment === environment) return
    throw new DataLayerError(
      'unknown',
      `data-layer: the environment is already "${currentApi.environment}" and ` +
        `cannot be changed to "${environment}" mid-session`,
    )
  }

  currentApi = createFirebaseApi(environment)
}

/** The active backend. Throws until `setEnvironment` has run. */
export function getApi(): Api {
  if (currentApi === undefined) {
    throw new DataLayerError(
      'unknown',
      'data-layer: no API. Call setEnvironment() at bootstrap, before anything ' +
        'reads or writes.',
    )
  }
  return currentApi
}
