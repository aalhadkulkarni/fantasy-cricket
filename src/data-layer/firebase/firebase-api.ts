/**
 * `Api` implemented against Firebase.
 *
 * **This is where backend knowledge lives.** Which paths hold what, that a
 * user record is keyed by the auth UID, that seeding is one atomic multi-path
 * update — all of it stops here. Above this line an operation is just an
 * operation.
 *
 * It holds a `FirebaseService`, which is the client: paths, reads, writes,
 * atomic updates, claims, subscriptions. **That service is private to this
 * folder.** Nothing above imports it, which is what stops schema knowledge
 * leaking upward.
 *
 * A future `RestApi` sits beside this file, satisfying the same interface with
 * an HTTP client instead. Neither replaces the other; both can exist, and a
 * third could delegate per operation while a migration runs.
 *
 * ---
 *
 * **One file for now.** It carries six operations. It gets split by subject —
 * `api/users.ts`, `api/leagues.ts` — mirroring the public files by name, once
 * that stops being comfortable to read.
 */

import type {
  Api,
  SignInOutcome,
  SignedInIdentity,
  SystemSetupResult,
} from '../api'
import type { Environment } from '@/config/environments'
import type { CompetitionId, SystemSetup, User, UserId } from '@/types'

import { DataLayerError } from '../data-layer-error'
import {
  AUCTION_PHASE_RECORDS,
  FORMAT_RECORDS,
  PLAYER_CATEGORY_RECORDS,
  PLAYER_ROLE_RECORDS,
  SEED_COMPETITIONS,
  STANDARD_AUCTION_CONFIG,
  STANDARD_FANTASY_LINEUP_RULES,
  STANDARD_TEAM_CHANGES_DEADLINE_OFFSET,
  TIMELINE_EVENT_RECORDS,
  USER_ROLES,
} from '../seed-data'
import type { Subscriber, Unsubscribe } from '../subscriptions'
import { FirebaseService } from './firebase-service'
import { createPaths } from './paths'

/**
 * Also exposes the environment it was built for, which `setEnvironment` reads
 * to decide whether a second call is a no-op or a mistake. Not part of `Api`:
 * nothing above the layer needs to ask a backend which environment it is, and
 * `src/config/environments.ts` answers that question anyway.
 */
export interface FirebaseApi extends Api {
  readonly environment: Environment
}

export function createFirebaseApi(environment: Environment): FirebaseApi {
  const service = new FirebaseService(environment)
  const paths = createPaths(service)

  /** Throws rather than returning undefined: calling these signed out is a bug. */
  function requireSession() {
    const session = service.currentSession()
    if (session === undefined) {
      throw new DataLayerError(
        'unknown',
        'firebase: nobody is signed in. Check the auth session first.',
      )
    }
    return session
  }

  const api: FirebaseApi = {
    environment,

    // -----------------------------------------------------------------------
    // Identity
    // -----------------------------------------------------------------------

    onAuthChanged(
      callback: Subscriber<SignedInIdentity | undefined>,
    ): Unsubscribe {
      return service.onAuthChanged((session) => {
        callback(
          session === undefined
            ? undefined
            : { userId: session.uid as UserId, photoUrl: session.photoUrl },
        )
      })
    },

    signInWithGoogle(): Promise<SignInOutcome> {
      return service.signInWithGoogle()
    },

    signOut(): Promise<void> {
      return service.signOut()
    },

    /**
     * **`users/` is keyed by the Firebase Auth UID**, so there is no lookup
     * table to walk — the session's uid is the key.
     *
     * Returning nothing means authenticated with no record yet, which is the
     * mid-creation state. **That is what decides whether to show the
     * display-name modal**, never Firebase's `isNewUser`: that flag reports
     * whether Auth just created the account, and someone who abandoned the
     * modal and came back is `isNewUser: false` with still no record.
     */
    getCurrentUser(): Promise<User | undefined> {
      const session = requireSession()
      return service.read<User>(paths.users(session.uid as UserId))
    },

    /**
     * **A plain write, not a claim.** Two tabs racing here address the same
     * path, so the worst outcome is one display name overwriting the other.
     * That is why no transaction is needed and why the mapping node that used
     * to guard this was deleted.
     */
    async createUser(userName: string): Promise<User> {
      const session = requireSession()

      const user: User = {
        userId: session.uid as UserId,
        userName,
        googleSubjectId: session.googleSubjectId ?? '',
        googleEmailId: session.email ?? '',
        // Firebase stores neither an empty object nor a null, so these keys
        // simply will not exist. Absent is what "none" looks like.
        systemUserRoles: {},
        leagues: {},
      }

      await service.write(paths.users(user.userId), user)
      return user
    },

    // -----------------------------------------------------------------------
    // System
    // -----------------------------------------------------------------------

    /**
     * Seeds the reference tables and the standards, once per environment.
     *
     * **Reads its own marker first and does nothing if it is already there.**
     * The marker is written inside the same atomic update as everything else,
     * so either the whole seed landed and the marker exists, or neither did.
     *
     * That guard matters most for competitions. They are keyed by push key
     * rather than by name, so a second run would create six *more* rather than
     * overwriting six, and nothing afterwards would say which set was real.
     *
     * TODO: this does not check the caller's role. A route guard hides the
     * button, but that is convenience — this layer is the actual check.
     */
    async setUpBasicSystem(): Promise<SystemSetupResult> {
      const existing = await service.read<SystemSetup>(paths.systemSetup())
      if (existing !== undefined) {
        return {
          status: 'alreadyDone',
          environment: service.root,
          written: {},
          completedAt: existing.completedAt,
        }
      }

      /*
        Push keys are generated locally with no network call, which is what lets
        the competitions be part of a single atomic update — their ids have to
        exist before the update object can be assembled.
      */
      const competitions = SEED_COMPETITIONS.map((competition) => ({
        competitionId: service.generateKey() as CompetitionId,
        ...competition,
      }))

      const completedAt = Date.now()

      await service.update({
        [paths.userRoles()]: USER_ROLES,
        [paths.formats()]: FORMAT_RECORDS,
        [paths.playerRoles()]: PLAYER_ROLE_RECORDS,
        [paths.playerCategories()]: PLAYER_CATEGORY_RECORDS,
        [paths.liveAuctionPhases()]: AUCTION_PHASE_RECORDS,
        [paths.timelineEvents()]: TIMELINE_EVENT_RECORDS,

        [paths.competitions()]: Object.fromEntries(
          competitions.map((c) => [c.competitionId, c]),
        ),

        [paths.standardAuctionConfig()]: STANDARD_AUCTION_CONFIG,
        [paths.standardFantasyLineupRules()]: STANDARD_FANTASY_LINEUP_RULES,
        [paths.standardFantasyLeagueTeamChangesDeadlineOffset()]:
          STANDARD_TEAM_CHANGES_DEADLINE_OFFSET,

        // Last, but in the same call, so it can never mark an incomplete seed.
        [paths.systemSetup()]: { completedAt } satisfies SystemSetup,
      })

      return {
        status: 'seeded',
        environment: service.root,
        completedAt,
        written: {
          userRoles: Object.keys(USER_ROLES).length,
          formats: Object.keys(FORMAT_RECORDS).length,
          playerRoles: Object.keys(PLAYER_ROLE_RECORDS).length,
          playerCategories: Object.keys(PLAYER_CATEGORY_RECORDS).length,
          liveAuctionPhases: Object.keys(AUCTION_PHASE_RECORDS).length,
          timelineEvents: Object.keys(TIMELINE_EVENT_RECORDS).length,
          competitions: competitions.length,
        },
      }
    },
  }

  return api
}
