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
  CreatePlayersResult,
  SignInOutcome,
  SignedInIdentity,
  SystemSetupResult,
} from '../api'
import type { Environment } from '@/config/environments'
import type {
  Competition,
  CompetitionId,
  Player,
  PlayerConfig,
  PlayerFilter,
  PlayerId,
  PlayerRoleRecord,
  SystemSetup,
  Team,
  TeamConfig,
  TeamFilter,
  TeamId,
  User,
  UserId,
} from '@/types'

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
    // Cricket data
    // -----------------------------------------------------------------------

    async getCompetitions(): Promise<Competition[]> {
      const all = await service.read<Record<string, Competition>>(
        paths.competitions(),
      )
      return Object.values(all ?? {})
    },

    async getPlayerRoles(): Promise<PlayerRoleRecord[]> {
      const all = await service.read<Record<string, PlayerRoleRecord>>(
        paths.playerRoles(),
      )
      return Object.values(all ?? {})
    },

    /**
     * **Filtered after the read, not by a query.** The catalogue is a few dozen
     * rows and reads here are subtree-shaped anyway, so a query would buy
     * nothing and cost an index.
     */
    async getTeams(filter?: TeamFilter): Promise<Team[]> {
      const all = await service.read<Record<string, Team>>(paths.teams())
      let teams = Object.values(all ?? {})

      if (filter?.competitionId !== undefined) {
        const competitionId = filter.competitionId
        teams = teams.filter((t) => t.competitionIds?.[competitionId] === true)
      }

      // TODO: tournamentId and format. Neither has a caller yet, and both need
      // a second read — the tournament, or the competition behind it.

      return teams.sort((a, b) => a.teamName.localeCompare(b.teamName))
    },

    async createTeam(team: TeamConfig): Promise<TeamId> {
      const teamId = service.generateKey() as TeamId

      await service.write(paths.teams(teamId), {
        teamId,
        teamName: team.teamName,
        teamShortName: team.teamShortName,
        competitionIds: Object.fromEntries(
          team.competitionIds.map((id) => [id, true]),
        ),
        // No `playerIds`. Firebase stores neither an empty object nor a null,
        // so writing one would change nothing — absent is what "no roster"
        // looks like everywhere in this model.
      } satisfies Omit<Team, 'playerIds'> & { teamId: TeamId })

      return teamId
    },

    /**
     * **Removing a competition is the closest thing here to a delete**, and it
     * cascades. The team leaves that competition, its roster there goes, and
     * every player who listed this team for that competition stops doing so.
     *
     * Without the cascade the two sides of membership disagree: a player would
     * still name a team that no longer lists them, and nothing would detect it.
     *
     * One atomic update, so a half-applied removal cannot happen. Every path is
     * known after the single read below.
     */
    async updateTeam(
      teamId: TeamId,
      changes: Partial<TeamConfig>,
    ): Promise<void> {
      const team = await service.read<Team>(paths.teams(teamId))
      if (team === undefined) {
        throw new DataLayerError('unknown', `firebase: no team ${teamId}`)
      }

      const update: Record<string, unknown> = {}
      const at = (...segments: string[]) => service.path(...segments)

      if (changes.teamName !== undefined) {
        update[at('teams', teamId, 'teamName')] = changes.teamName
      }
      if (changes.teamShortName !== undefined) {
        update[at('teams', teamId, 'teamShortName')] = changes.teamShortName
      }

      if (changes.competitionIds !== undefined) {
        const wanted = new Set<string>(changes.competitionIds)
        const current = Object.keys(team.competitionIds ?? {})

        for (const competitionId of current) {
          if (wanted.has(competitionId)) continue

          // Leaving a competition: drop the membership, the roster, and every
          // player's record of playing here.
          update[at('teams', teamId, 'competitionIds', competitionId)] = null
          update[at('teams', teamId, 'playerIds', competitionId)] = null

          const roster = team.playerIds?.[competitionId as CompetitionId] ?? {}
          for (const playerId of Object.keys(roster)) {
            update[at('players', playerId, 'currentTeams', competitionId)] =
              null
          }
        }

        for (const competitionId of wanted) {
          if (current.includes(competitionId)) continue
          update[at('teams', teamId, 'competitionIds', competitionId)] = true
        }
      }

      if (Object.keys(update).length === 0) return
      await service.update(update)
    },

    // -- players -------------------------------------------------------------

    /**
     * **Fully retired players are hidden by default.** They drop out of the
     * player list entirely, and `system-admin.md` defers a Retired Players view
     * to Phase 2 — retirement is rare enough not to come up here.
     */
    async getPlayers(filter?: PlayerFilter): Promise<Player[]> {
      const all = await service.read<Record<string, Player>>(paths.players())
      let players = Object.values(all ?? {})

      if (filter?.includeRetired !== true) {
        players = players.filter((p) => p.isRetired !== true)
      }
      if (filter?.playerRole !== undefined) {
        players = players.filter((p) => p.playerRole === filter.playerRole)
      }
      if (filter?.competitionId !== undefined) {
        const cid = filter.competitionId
        players = players.filter((p) => p.currentTeams?.[cid] !== undefined)
      }
      if (filter?.teamId !== undefined) {
        const teamId = filter.teamId
        players = players.filter((p) =>
          Object.values(p.currentTeams ?? {}).includes(teamId),
        )
      }

      // TODO: format. Needs the competitions behind it, so a second read.

      return players.sort((a, b) => a.playerName.localeCompare(b.playerName))
    },

    /**
     * **One atomic update for the whole batch**, records and roster entries
     * together. Two hundred players is roughly twelve hundred paths, which a
     * single multi-path update handles comfortably — and all-or-nothing is what
     * stops a failed save leaving half a squad to reconcile by hand.
     *
     * **Existing names are skipped, not duplicated.** Matched on name, which is
     * the only thing a person can be expected to keep stable, so re-adding a
     * squad is safe.
     */
    async createPlayers(
      players: readonly PlayerConfig[],
    ): Promise<CreatePlayersResult> {
      const existing = await service.read<Record<string, Player>>(
        paths.players(),
      )
      const takenNames = new Set(
        Object.values(existing ?? {}).map((p) => p.playerName.toLowerCase()),
      )

      const update: Record<string, unknown> = {}
      const skipped: string[] = []
      let created = 0

      for (const config of players) {
        const playerName = config.playerName.trim()
        if (takenNames.has(playerName.toLowerCase())) {
          skipped.push(playerName)
          continue
        }
        // Guards duplicates inside the batch itself, not just against the
        // database — two identical rows would otherwise both be written.
        takenNames.add(playerName.toLowerCase())

        const playerId = service.generateKey() as PlayerId
        const currentTeams = config.currentTeams ?? {}

        update[paths.players(playerId)] = {
          playerId,
          playerName,
          playerShortName: config.playerShortName.trim(),
          country: config.country.trim(),
          playerRole: config.playerRole,
          isRetired: false,
          ...(Object.keys(currentTeams).length > 0 ? { currentTeams } : {}),
        }

        // The other side of each membership, written in the same call.
        for (const [competitionId, teamId] of Object.entries(currentTeams)) {
          if (teamId === undefined) continue
          update[
            service.path('teams', teamId, 'playerIds', competitionId, playerId)
          ] = true
        }

        created += 1
      }

      if (Object.keys(update).length > 0) await service.update(update)
      return { created, skipped }
    },

    /**
     * Fields only. Team membership goes through `addPlayerToTeam` and
     * `removePlayerFromTeam`, because each of those has to touch the team side
     * too and doing it here would hide that.
     */
    async updatePlayer(
      playerId: PlayerId,
      changes: Partial<PlayerConfig>,
    ): Promise<void> {
      const update: Record<string, unknown> = {}
      const at = (field: string) => service.path('players', playerId, field)

      if (changes.playerName !== undefined) {
        update[at('playerName')] = changes.playerName.trim()
      }
      if (changes.playerShortName !== undefined) {
        update[at('playerShortName')] = changes.playerShortName.trim()
      }
      if (changes.country !== undefined) {
        update[at('country')] = changes.country.trim()
      }
      if (changes.playerRole !== undefined) {
        update[at('playerRole')] = changes.playerRole
      }

      if (Object.keys(update).length === 0) return
      await service.update(update)
    },

    /**
     * **Adding is moving.** There is one team per competition, so setting a new
     * one necessarily unsets the old — and the old team's roster entry has to go
     * with it, in the same update, or the two sides disagree and nothing
     * detects it.
     */
    async addPlayerToTeam(
      playerId: PlayerId,
      teamId: TeamId,
      competitionId: CompetitionId,
    ): Promise<void> {
      const previous = await service.read<TeamId>(
        service.path('players', playerId, 'currentTeams', competitionId),
      )
      if (previous === teamId) return

      const update: Record<string, unknown> = {
        [service.path('players', playerId, 'currentTeams', competitionId)]:
          teamId,
        [service.path('teams', teamId, 'playerIds', competitionId, playerId)]:
          true,
      }

      if (previous !== undefined) {
        update[
          service.path('teams', previous, 'playerIds', competitionId, playerId)
        ] = null
      }

      await service.update(update)
    },

    async removePlayerFromTeam(
      playerId: PlayerId,
      competitionId: CompetitionId,
    ): Promise<void> {
      const previous = await service.read<TeamId>(
        service.path('players', playerId, 'currentTeams', competitionId),
      )
      if (previous === undefined) return

      await service.update({
        [service.path('players', playerId, 'currentTeams', competitionId)]:
          null,
        [service.path('teams', previous, 'playerIds', competitionId, playerId)]:
          null,
      })
    },

    async setPlayerRetired(
      playerId: PlayerId,
      isRetired: boolean,
    ): Promise<void> {
      await service.write(
        service.path('players', playerId, 'isRetired'),
        isRetired,
      )
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
