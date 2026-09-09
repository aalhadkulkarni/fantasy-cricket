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
  Team,
  TeamConfig,
  TeamFilter,
  TeamId,
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

  getTeams(filter?: TeamFilter): Promise<Team[]>

  createTeam(team: TeamConfig): Promise<TeamId>

  /**
   * **Removing a competition takes the team out of it entirely**, including its
   * roster there and every affected player's record. That is the closest thing
   * to a delete this admin has, and it is deliberate — nothing here destroys a
   * team outright.
   */
  updateTeam(teamId: TeamId, changes: Partial<TeamConfig>): Promise<void>

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
