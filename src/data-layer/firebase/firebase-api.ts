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
  OfficialLeagues,
  SignInOutcome,
  SignedInIdentity,
  SystemSetupResult,
} from '../api'
import type { Environment } from '@/config/environments'
import type {
  Competition,
  CompetitionId,
  FormatRecord,
  GameWeekId,
  JoinableLeague,
  League,
  LeagueId,
  LeagueJoinCode,
  LeagueMember,
  BannedUser,
  LineupRules,
  Match,
  MatchConfig,
  MatchId,
  Player,
  PlayerConfig,
  PlayerFilter,
  PlayerId,
  PlayerRoleRecord,
  Round,
  RoundConfig,
  RoundId,
  SystemSetup,
  Team,
  TeamConfig,
  TeamFilter,
  TeamId,
  Tournament,
  TournamentConfig,
  TournamentFilter,
  TournamentId,
  TournamentLeagueIndexEntry,
  TournamentRoundConfig,
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

  /**
   * The two paths carrying a tournament's timing, recomputed from every match.
   *
   * **Both are start times.** `endDate` is the last match's start, not when
   * anything finishes — a Test runs five days, and nothing here pretends to
   * know that. It is absent while any match is undated, which is what lets a
   * tournament with only match one dated behave correctly.
   */
  function tournamentDates(
    tournamentId: TournamentId,
    matches: Record<string, Match>,
  ): Record<string, number | null> {
    const all = Object.values(matches)
    const dated = all
      .map((match) => match.startTimestamp)
      .filter((timestamp): timestamp is number => timestamp !== undefined)

    return {
      [service.path('tournaments', tournamentId, 'startDate')]:
        dated.length === 0 ? null : Math.min(...dated),
      [service.path('tournaments', tournamentId, 'endDate')]:
        dated.length === all.length && dated.length > 0
          ? Math.max(...dated)
          : null,
    }
  }

  /**
   * The round the last match falls in, found **by match number**. Ids are push
   * keys and sort by creation time, which is not the fixture order.
   */
  function lastRound(
    rounds: readonly Round[],
    matches: Record<string, Match>,
  ): Round | undefined {
    let best: Round | undefined
    let bestNumber = -1

    for (const round of rounds) {
      const number = matches[round.lastMatchId]?.matchNumber ?? -1
      if (number > bestNumber) {
        bestNumber = number
        best = round
      }
    }

    return best
  }

  /** The documented default for a regular league, and its ceiling. */
  const OFFICIAL_LEAGUE_SLOTS = 200

  /**
   * One league, as the card both the tournament row and the code lookup render.
   *
   * **Two small reads per league**, and neither is the league itself: how many
   * managers it holds, and when joining closes. A league read is subtree-shaped
   * and would drag its whole auction config — a base price for every player in
   * the tournament — to render six fields.
   */
  async function joinableLeague(
    leagueId: LeagueId,
    entry: TournamentLeagueIndexEntry,
    tournamentId: TournamentId,
    tournamentName: string,
  ): Promise<JoinableLeague> {
    const [members, joinDeadline] = await Promise.all([
      service.read<Record<string, LeagueMember>>(paths.leagueMembers(leagueId)),
      service.read<number>(
        service.path('leagues', leagueId, 'fantasyLeagueJoinDeadline'),
      ),
    ])

    const me = service.currentSession()?.uid
    const all = Object.values(members ?? {})

    return {
      leagueId,
      leagueName: entry.leagueName,
      tournamentId,
      tournamentName,
      isAuctionEnabled: entry.isAuctionEnabled,
      leagueEntry: entry.leagueEntry,
      maxSlots: entry.maxSlots,
      // Managers only. An owner or admin who does not play holds no slot, and a
      // ban strips `manager`, so both drop out here for free.
      filledSlots: all.filter((m) => m.leagueRoles?.manager === true).length,
      joinDeadline: joinDeadline ?? 0,
      // Empty when not a member. Owning a league is not playing in it, so the
      // caller has to be able to tell those apart.
      myRoles:
        (me === undefined ? undefined : members?.[me]?.leagueRoles) ?? {},
    }
  }

  /**
   * **Eight characters**, as `05-data-model.md` specifies, from an alphabet
   * with no `0`/`O` or `1`/`I`/`L` because people read these aloud and type
   * them from memory.
   */
  function joinCode(): string {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)]
    }
    return code
  }

  /**
   * **Claimed transactionally**, because a code has to be unique across every
   * league and only a transaction settles a race for one. Reading first and
   * then writing lets two creations both see nothing and both write.
   */
  async function claimJoinCode(leagueId: LeagueId): Promise<LeagueJoinCode> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = joinCode() as LeagueJoinCode
      const won = await service.claim(
        paths.leagueCodeToLeagueMapping(code),
        leagueId,
      )
      if (won) return code
    }
    throw new DataLayerError(
      'unknown',
      'Could not find an unused join code. Try again.',
    )
  }

  /**
   * One gameweek per round.
   *
   * The impact sub is a change *during* a gameweek, so it is forced off where a
   * round holds a single match and there is no during.
   */
  function oneGameWeekPerRound(
    tournament: Tournament,
  ): Record<string, RoundConfig> {
    const matches = tournament.matches ?? {}
    const numberOf = (matchId: MatchId) => matches[matchId]?.matchNumber ?? 0

    const rounds = Object.values(tournament.rounds ?? {}).sort(
      (a, b) => numberOf(a.firstMatchId) - numberOf(b.firstMatchId),
    )

    const configs: Record<string, RoundConfig> = {}

    rounds.forEach((round, index) => {
      const gameWeekId = service.generateKey() as GameWeekId
      const span =
        numberOf(round.lastMatchId) - numberOf(round.firstMatchId) + 1

      configs[round.roundId] = {
        // Absent allowances mean unlimited, which is what an open league wants.
        isImpactSubAllowed: span > 1,
        gameWeeks: {
          [gameWeekId]: {
            gameWeekId,
            gameWeekName: round.roundName,
            gameWeekNumber: index + 1,
            startMatchId: round.firstMatchId,
            endMatchId: round.lastMatchId,
          },
        },
      }
    })

    return configs
  }

  /**
   * One official league, as the paths that create it.
   *
   * **Four paths, and they only make sense together**: the league, the
   * tournament's index of its leagues, and the owner's own index. An index is a
   * view, never a source of truth, so one written without the others is worse
   * than none.
   *
   * The owner is **not a manager**. A manager has a fantasy team name, chosen
   * when joining, so whoever publishes joins their own league the same way
   * everyone else does.
   */
  async function officialLeague(
    inputs: {
      tournament: Tournament
      ownerId: UserId
      ownerName: string
      rules: LineupRules
      offset: number
      joinDeadline: number
    },
    gameWeeks: boolean,
  ): Promise<Record<string, unknown>> {
    const { tournament, ownerId, ownerName, rules, offset, joinDeadline } =
      inputs

    const leagueId = service.generateKey() as LeagueId
    const leagueJoinCode = await claimJoinCode(leagueId)

    const leagueName = `${tournament.tournamentName} — Official ${
      gameWeeks ? 'Gameweek' : 'Match'
    } League`

    const roles = { leagueOwner: true, leagueAdmin: true } as const

    const base = {
      leagueId,
      leagueName,
      leagueOwner: ownerId,
      leagueJoinCode,
      tournamentId: tournament.tournamentId,
      leagueEntry: 'Open',
      maxSlots: OFFICIAL_LEAGUE_SLOTS,
      fantasyLineupRules: rules,
      leagueMembers: { [ownerId]: { leagueRoles: roles } },
      fantasyLeagueTeamChangesDeadlineOffset: offset,
      fantasyLeagueJoinDeadline: joinDeadline,
      isCustomScoringSystem: false,
      isAuctionEnabled: false,
    }

    return {
      [paths.leagues(leagueId)]: gameWeeks
        ? {
            ...base,
            isGameWeeksEnabled: true,
            roundConfigs: oneGameWeekPerRound(tournament),
          }
        : // No change allowances at all. Absent is unlimited, which is what an
          // open league everybody can walk into should be.
          { ...base, isGameWeeksEnabled: false },

      // The tournament page's list of its leagues. Exactly the fields that row
      // renders, and no more, or it drifts into a second copy of the league.
      [service.path(
        'tournaments',
        tournament.tournamentId,
        'leagues',
        leagueId,
      )]: {
        leagueName,
        isAuctionEnabled: false,
        leagueEntry: 'Open',
        maxSlots: OFFICIAL_LEAGUE_SLOTS,
      },

      // My Leagues, for the owner.
      [service.path('users', ownerId, 'leagues', leagueId)]: {
        leagueName,
        tournamentId: tournament.tournamentId,
        tournamentName: tournament.tournamentName,
        isAuctionEnabled: false,
        ownerName,
        maxSlots: OFFICIAL_LEAGUE_SLOTS,
        membershipStatus: 'Accepted',
        myRoles: roles,
      },
    }
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

    async getFormats(): Promise<FormatRecord[]> {
      const all = await service.read<Record<string, FormatRecord>>(
        paths.formats(),
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
    // Tournaments
    // -----------------------------------------------------------------------

    async getTournaments(filter?: TournamentFilter): Promise<Tournament[]> {
      const all = await service.read<Record<string, Tournament>>(
        paths.tournaments(),
      )
      let tournaments = Object.values(all ?? {})

      if (filter?.includeUnpublished !== true) {
        tournaments = tournaments.filter((t) => t.publishedAt !== undefined)
      }
      if (filter?.competitionId !== undefined) {
        const competitionId = filter.competitionId
        tournaments = tournaments.filter(
          (t) => t.competitionId === competitionId,
        )
      }

      return tournaments.sort((a, b) =>
        a.tournamentName.localeCompare(b.tournamentName),
      )
    },

    async getTournament(tournamentId: TournamentId): Promise<Tournament> {
      const tournament = await service.read<Tournament>(
        paths.tournaments(tournamentId),
      )
      if (tournament === undefined) {
        throw new DataLayerError(
          'unknown',
          `No tournament with id ${tournamentId}.`,
        )
      }
      return tournament
    },

    /**
     * **The index first, then one read per league for its members.**
     *
     * The index carries what the row renders and deliberately not how full the
     * league is: a stored counter would have to be updated on every member's
     * own index entry on every join. So the count is derived, and the cost is
     * one small read each — `leagueMembers` only, never the league itself,
     * which would drag its whole auction config and gameweek structure.
     */
    async getLeaguesForTournament(
      tournamentId: TournamentId,
    ): Promise<JoinableLeague[]> {
      const [index, tournamentName] = await Promise.all([
        service.read<Record<string, TournamentLeagueIndexEntry>>(
          paths.tournamentLeagues(tournamentId),
        ),
        service.read<string>(
          service.path('tournaments', tournamentId, 'tournamentName'),
        ),
      ])

      const entries = Object.entries(index ?? {})
      if (entries.length === 0) return []

      const cards = await Promise.all(
        entries.map(([leagueId, entry]) =>
          joinableLeague(
            leagueId as LeagueId,
            entry,
            tournamentId,
            tournamentName ?? '',
          ),
        ),
      )

      return cards.sort((a, b) => a.leagueName.localeCompare(b.leagueName))
    },

    /**
     * **The mapping exists so a typed code resolves in a single read.** A code
     * is not a league's address — it is a capability, which is why URLs carry
     * the id instead.
     *
     * Finding a league is not entering one. A closed league resolves here and
     * still refuses a join.
     */
    async getLeagueByCode(
      leagueJoinCode: string,
    ): Promise<JoinableLeague | undefined> {
      const code = leagueJoinCode.trim().toUpperCase()
      if (code === '') return undefined

      const leagueId = await service.read<LeagueId>(
        paths.leagueCodeToLeagueMapping(code as LeagueJoinCode),
      )
      if (leagueId === undefined) return undefined

      const league = await service.read<League>(paths.leagues(leagueId))
      if (league === undefined) return undefined

      const tournamentName =
        (await service.read<string>(
          service.path('tournaments', league.tournamentId, 'tournamentName'),
        )) ?? ''

      return joinableLeague(
        leagueId,
        {
          leagueName: league.leagueName,
          isAuctionEnabled: league.isAuctionEnabled,
          leagueEntry: league.leagueEntry,
          maxSlots: league.maxSlots,
        },
        league.tournamentId,
        tournamentName,
      )
    },

    /**
     * **Every refusal is decided here**, not hidden in the interface. Anyone can
     * read the database directly with the client SDK, so a disabled button is
     * convenience and this is the guard.
     *
     * The ban is checked at `bannedUsers`, not on a join request: a public
     * league has no request to consult, so a ban has to be independently
     * checkable at a known path.
     */
    async joinLeague(
      leagueId: LeagueId,
      fantasyTeamName: string,
    ): Promise<void> {
      const session = requireSession()
      const userId = session.uid as UserId

      const teamName = fantasyTeamName.trim()
      if (teamName === '') {
        throw new DataLayerError('unknown', 'Pick a team name first.')
      }

      const [league, banned] = await Promise.all([
        service.read<League>(paths.leagues(leagueId)),
        service.read<BannedUser>(paths.bannedUsers(leagueId, userId)),
      ])

      if (league === undefined) {
        throw new DataLayerError('unknown', 'That league no longer exists.')
      }
      if (banned !== undefined) {
        throw new DataLayerError(
          'unknown',
          'You are banned from this league and cannot rejoin it.',
        )
      }
      if (league.leagueEntry !== 'Open') {
        throw new DataLayerError(
          'unknown',
          'This league is closed, so joining needs its admin to approve you. Requesting to join is not built yet.',
        )
      }
      if (Date.now() > league.fantasyLeagueJoinDeadline) {
        throw new DataLayerError(
          'unknown',
          'The deadline to join this league has passed.',
        )
      }

      const members = league.leagueMembers ?? {}
      const mine = members[userId]

      if (mine?.leagueRoles?.manager === true) {
        throw new DataLayerError(
          'unknown',
          'You are already playing in this league.',
        )
      }

      const filled = Object.values(members).filter(
        (member) => member.leagueRoles?.manager === true,
      ).length

      if (filled >= league.maxSlots) {
        throw new DataLayerError('unknown', 'This league is full.')
      }

      /*
        Both are copied into the index rather than looked up when My Leagues
        renders, which is the point of an index: it carries exactly the fields
        its page shows, so drawing a card costs no further reads.
      */
      const [ownerName, tournamentName] = await Promise.all([
        service.read<string>(
          service.path('users', league.leagueOwner, 'userName'),
        ),
        service.read<string>(
          service.path('tournaments', league.tournamentId, 'tournamentName'),
        ),
      ])

      // Merged, not replaced. Someone joining a league they own keeps owning it.
      const myRoles = { ...(mine?.leagueRoles ?? {}), manager: true as const }

      await service.update({
        /*
          **Leaf paths on the membership, deliberately.** Writing the member
          object whole would erase `leagueOwner` and `leagueAdmin` from anyone
          joining a league they run — which is every official league.
        */
        [paths.leagueMembers(leagueId, userId) + '/fantasyTeamName']: teamName,
        [paths.leagueMembers(leagueId, userId) + '/leagueRoles/manager']: true,

        /*
          The index cannot be rebuilt: lose this and the league disappears from
          this person's interface permanently. It goes in the same write as the
          membership for exactly that reason.
        */
        [paths.userLeagues(userId, leagueId)]: {
          leagueName: league.leagueName,
          tournamentId: league.tournamentId,
          tournamentName: tournamentName ?? '',
          isAuctionEnabled: league.isAuctionEnabled,
          ownerName: ownerName ?? 'Unknown',
          maxSlots: league.maxSlots,
          membershipStatus: 'Accepted',
          myRoles,
        },
      })
    },

    /**
     * **One node written whole**, rather than a multi-path update: everything
     * created here lives under the one tournament and nothing outside it is
     * touched.
     *
     * The round is created with the matches deliberately. Every match belongs
     * to exactly one round, so a tournament that briefly had matches and no
     * round would already have broken that.
     */
    async createTournament(config: TournamentConfig): Promise<TournamentId> {
      if (!Number.isInteger(config.matchCount) || config.matchCount < 1) {
        throw new DataLayerError(
          'unknown',
          'A tournament needs at least one match.',
        )
      }

      const tournamentId = service.generateKey() as TournamentId
      const matchIds = Array.from(
        { length: config.matchCount },
        () => service.generateKey() as MatchId,
      )

      const matches: Record<string, Match> = {}
      matchIds.forEach((matchId, index) => {
        // No teams and no date. Absent is how "not yet known" is spelled, and
        // Firebase would drop the keys anyway.
        matches[matchId] = { matchId, matchNumber: index + 1 }
      })

      const roundId = service.generateKey() as RoundId
      const firstMatchId = matchIds[0]
      const lastMatchId = matchIds[matchIds.length - 1]
      if (firstMatchId === undefined || lastMatchId === undefined) {
        throw new DataLayerError('unknown', 'A tournament needs a match.')
      }

      await service.write(paths.tournaments(tournamentId), {
        tournamentId,
        tournamentName: config.tournamentName.trim(),
        competitionId: config.competitionId,
        matches,
        rounds: {
          [roundId]: {
            roundId,
            roundName: 'Round 1',
            firstMatchId,
            lastMatchId,
            // No `eliminatedTeams`. An empty object is not stored.
          },
        },
        // No participants, no startDate, no publishedAt. All absent.
      })

      return tournamentId
    },

    async renameTournament(
      tournamentId: TournamentId,
      tournamentName: string,
    ): Promise<void> {
      await service.write(
        service.path('tournaments', tournamentId, 'tournamentName'),
        tournamentName.trim(),
      )
    },

    /**
     * **Three nodes, one write.** `participatingPlayers`,
     * `participatingTeamPlayers` and `participatingTeams` are three views of
     * one fact, and any two of them disagreeing is a corruption nothing detects.
     *
     * A team that lost every player is removed as a node; a team that survives
     * has its members adjusted one by one. Those are kept apart deliberately —
     * Firebase rejects an update that writes both a path and its ancestor.
     */
    async updateTournamentParticipants(
      tournamentId: TournamentId,
      participants: Partial<Record<PlayerId, TeamId>>,
    ): Promise<void> {
      const before =
        (await service.read<Partial<Record<PlayerId, TeamId>>>(
          service.path('tournaments', tournamentId, 'participatingPlayers'),
        )) ?? {}

      const at = (...segments: string[]) =>
        service.path('tournaments', tournamentId, ...segments)

      const update: Record<string, unknown> = {}

      const present = (teams: Partial<Record<PlayerId, TeamId>>) =>
        new Set(
          Object.values(teams).filter((id): id is TeamId => id !== undefined),
        )

      const teamsBefore = present(before)
      const teamsAfter = present(participants)

      for (const [playerId, teamId] of Object.entries(participants)) {
        if (teamId === undefined) continue
        const was = before[playerId as PlayerId]
        if (was === teamId) continue

        update[at('participatingPlayers', playerId)] = teamId
        update[at('participatingTeamPlayers', teamId, playerId)] = true

        // Moved between two teams that both survive: clear the old side.
        if (was !== undefined && teamsAfter.has(was)) {
          update[at('participatingTeamPlayers', was, playerId)] = null
        }
      }

      for (const [playerId, teamId] of Object.entries(before)) {
        if (participants[playerId as PlayerId] !== undefined) continue

        update[at('participatingPlayers', playerId)] = null
        if (teamId !== undefined && teamsAfter.has(teamId)) {
          update[at('participatingTeamPlayers', teamId, playerId)] = null
        }
      }

      for (const teamId of teamsAfter) {
        if (!teamsBefore.has(teamId)) {
          update[at('participatingTeams', teamId)] = true
        }
      }
      for (const teamId of teamsBefore) {
        if (teamsAfter.has(teamId)) continue
        update[at('participatingTeams', teamId)] = null
        // The whole node goes, so no per-player nulls for this team above.
        update[at('participatingTeamPlayers', teamId)] = null
      }

      if (Object.keys(update).length > 0) await service.update(update)
    },

    /**
     * **The tournament's start and end are recomputed here**, in the same
     * write. They are what every reader uses to place a tournament in Upcoming,
     * Active or Past, and nothing derives them by walking the match list — so a
     * change that missed this would make every reader wrong at once.
     *
     * Each config is the full state of that match, so an absent field clears
     * the stored one. That is what lets a date or a fixture be taken back.
     */
    async updateMatches(
      tournamentId: TournamentId,
      configs: readonly MatchConfig[],
    ): Promise<void> {
      if (configs.length === 0) return

      const stored =
        (await service.read<Record<string, Match>>(
          paths.tournamentMatches(tournamentId),
        )) ?? {}

      const update: Record<string, unknown> = {}
      const merged: Record<string, Match> = { ...stored }

      for (const config of configs) {
        const existing = stored[config.matchId]
        if (existing === undefined) {
          throw new DataLayerError(
            'unknown',
            `This tournament has no match ${config.matchId}.`,
          )
        }

        const at = (field: string) =>
          service.path(
            'tournaments',
            tournamentId,
            'matches',
            config.matchId,
            field,
          )

        update[at('team1Id')] = config.team1Id ?? null
        update[at('team2Id')] = config.team2Id ?? null
        update[at('startTimestamp')] = config.startTimestamp ?? null
        update[at('venue')] = config.venue?.trim() || null

        merged[config.matchId] = {
          ...existing,
          team1Id: config.team1Id,
          team2Id: config.team2Id,
          startTimestamp: config.startTimestamp,
          venue: config.venue,
        }
      }

      Object.assign(update, tournamentDates(tournamentId, merged))

      await service.update(update)
    },

    /**
     * **The final round grows with them**, in the same write, because a match
     * outside every round could never fall inside a gameweek and so could never
     * be played.
     */
    async addMatches(tournamentId: TournamentId, count: number): Promise<void> {
      if (!Number.isInteger(count) || count < 1) {
        throw new DataLayerError('unknown', 'Add at least one match.')
      }

      const [storedMatches, storedRounds] = await Promise.all([
        service.read<Record<string, Match>>(
          paths.tournamentMatches(tournamentId),
        ),
        service.read<Record<string, Round>>(
          paths.tournamentRounds(tournamentId),
        ),
      ])

      const matches = storedMatches ?? {}
      const highest = Object.values(matches).reduce(
        (max, match) => Math.max(max, match.matchNumber),
        0,
      )

      const update: Record<string, unknown> = {}
      const added: MatchId[] = []

      for (let i = 1; i <= count; i += 1) {
        const matchId = service.generateKey() as MatchId
        added.push(matchId)
        update[paths.tournamentMatches(tournamentId, matchId)] = {
          matchId,
          matchNumber: highest + i,
        } satisfies Match
      }

      const lastAdded = added[added.length - 1]
      const finalRound = lastRound(Object.values(storedRounds ?? {}), matches)

      if (lastAdded === undefined) return

      if (finalRound === undefined) {
        // Only reachable if a tournament somehow has no round at all. One is
        // created rather than leaving matches outside every round.
        const roundId = service.generateKey() as RoundId
        const firstAdded = added[0]
        if (firstAdded !== undefined) {
          update[paths.tournamentRounds(tournamentId, roundId)] = {
            roundId,
            roundName: 'Round 1',
            firstMatchId: firstAdded,
            lastMatchId: lastAdded,
          }
        }
      } else {
        update[
          service.path(
            'tournaments',
            tournamentId,
            'rounds',
            finalRound.roundId,
            'lastMatchId',
          )
        ] = lastAdded
      }

      // A new match has no date, so the end is no longer known. `startDate`
      // is unaffected — nothing earlier was added.
      update[service.path('tournaments', tournamentId, 'endDate')] = null

      await service.update(update)
    },

    /**
     * **Off the end only, and only while unpublished.** Both restrictions are
     * load-bearing rather than cautious.
     *
     * Off the end because `matchNumber` is the ordering key. Taking one out of
     * the middle would renumber every match after it, and every round boundary
     * is defined against those numbers — the structure would move without
     * anything saying so.
     *
     * Unpublished because that is the window where nothing can reference a
     * match. A league cannot be created against an unpublished tournament, so
     * there are no lineups and no points to strand. Once there are, the reason
     * nothing else in this admin deletes applies here too.
     */
    async removeMatches(
      tournamentId: TournamentId,
      count: number,
    ): Promise<void> {
      if (!Number.isInteger(count) || count < 1) {
        throw new DataLayerError('unknown', 'Remove at least one match.')
      }

      const tournament = await service.read<Tournament>(
        paths.tournaments(tournamentId),
      )
      if (tournament === undefined) {
        throw new DataLayerError('unknown', 'No such tournament.')
      }
      if (tournament.publishedAt !== undefined) {
        throw new DataLayerError(
          'unknown',
          'This tournament is published, so its matches may already have lineups and points against them. Matches can only be removed from a draft.',
        )
      }

      const ordered = Object.values(tournament.matches ?? {}).sort(
        (a, b) => a.matchNumber - b.matchNumber,
      )
      if (count >= ordered.length) {
        throw new DataLayerError(
          'unknown',
          `A tournament needs at least one match, and this one has ${ordered.length}.`,
        )
      }

      const removed = ordered.slice(ordered.length - count)
      const remaining = ordered.slice(0, ordered.length - count)
      const survivor = remaining[remaining.length - 1]
      if (survivor === undefined) {
        throw new DataLayerError('unknown', 'A tournament needs a match.')
      }

      const update: Record<string, unknown> = {}
      const goneIds = new Set(removed.map((match) => match.matchId))

      for (const match of removed) {
        update[paths.tournamentMatches(tournamentId, match.matchId)] = null
      }

      // Rounds are trimmed to what is left. One that held nothing but removed
      // matches goes with them, because an empty round is not a phase of
      // anything — and the remaining rounds still tile the remaining matches.
      const numberOf = (matchId: MatchId) =>
        tournament.matches?.[matchId]?.matchNumber ?? 0

      for (const round of Object.values(tournament.rounds ?? {})) {
        if (numberOf(round.firstMatchId) > survivor.matchNumber) {
          update[paths.tournamentRounds(tournamentId, round.roundId)] = null
          continue
        }
        if (goneIds.has(round.lastMatchId)) {
          update[
            service.path(
              'tournaments',
              tournamentId,
              'rounds',
              round.roundId,
              'lastMatchId',
            )
          ] = survivor.matchId
        }
      }

      const kept: Record<string, Match> = {}
      for (const match of remaining) kept[match.matchId] = match
      Object.assign(update, tournamentDates(tournamentId, kept))

      await service.update(update)
    },

    /**
     * **The rounds must tile the matches exactly** — start at match one, no
     * gaps, no overlaps, and end at the last match. That is checked here rather
     * than in the form, because the form is convenience and this is the guard.
     *
     * Replacing the whole set keeps that rule in one place, and lets a mistaken
     * split be undone, which matters when nothing deletes.
     */
    async setRounds(
      tournamentId: TournamentId,
      rounds: readonly TournamentRoundConfig[],
    ): Promise<void> {
      const [storedMatches, storedRounds] = await Promise.all([
        service.read<Record<string, Match>>(
          paths.tournamentMatches(tournamentId),
        ),
        service.read<Record<string, Round>>(
          paths.tournamentRounds(tournamentId),
        ),
      ])

      const matches = Object.values(storedMatches ?? {})
      if (matches.length === 0) {
        throw new DataLayerError(
          'unknown',
          'This tournament has no matches to put in rounds.',
        )
      }

      const byNumber = new Map(matches.map((m) => [m.matchNumber, m.matchId]))
      const lastNumber = Math.max(...matches.map((m) => m.matchNumber))

      const ordered = [...rounds].sort(
        (a, b) => a.firstMatchNumber - b.firstMatchNumber,
      )
      let expected = 1

      for (const round of ordered) {
        if (round.roundName.trim() === '') {
          throw new DataLayerError('unknown', 'Every round needs a name.')
        }
        if (round.firstMatchNumber !== expected) {
          throw new DataLayerError(
            'unknown',
            `Rounds must cover every match with no gaps or overlaps. Expected a round starting at match ${expected}.`,
          )
        }
        if (round.lastMatchNumber < round.firstMatchNumber) {
          throw new DataLayerError('unknown', 'A round cannot be empty.')
        }
        expected = round.lastMatchNumber + 1
      }

      if (expected !== lastNumber + 1) {
        throw new DataLayerError(
          'unknown',
          `Rounds must cover every match. Match ${expected} onwards is in no round.`,
        )
      }

      const existing = storedRounds ?? {}
      const update: Record<string, unknown> = {}
      const kept = new Set<string>()

      for (const round of ordered) {
        const roundId = round.roundId ?? (service.generateKey() as RoundId)
        kept.add(roundId)

        const firstMatchId = byNumber.get(round.firstMatchNumber)
        const lastMatchId = byNumber.get(round.lastMatchNumber)
        if (firstMatchId === undefined || lastMatchId === undefined) {
          throw new DataLayerError('unknown', 'A round names a missing match.')
        }

        // Anything recorded against a round that keeps its id survives — today
        // that is the eliminated teams.
        const eliminatedTeams = existing[roundId]?.eliminatedTeams
        const hasEliminated =
          eliminatedTeams !== undefined &&
          Object.keys(eliminatedTeams).length > 0

        update[paths.tournamentRounds(tournamentId, roundId)] = {
          roundId,
          roundName: round.roundName.trim(),
          firstMatchId,
          lastMatchId,
          ...(hasEliminated ? { eliminatedTeams } : {}),
        }
      }

      for (const roundId of Object.keys(existing)) {
        if (!kept.has(roundId)) {
          update[paths.tournamentRounds(tournamentId, roundId as RoundId)] =
            null
        }
      }

      await service.update(update)
    },

    /**
     * **Publishing and opening the official leagues are one write.** Publishing
     * first and then failing to create the league would leave a tournament
     * everyone can see with nothing in it to join, and no record that anything
     * was meant to be there.
     *
     * The join code is the exception, claimed before the update. A code has to
     * be unique across leagues, and only a transaction can settle a race for
     * one — a read then a write lets two creations both see nothing and both
     * write. An unused code left behind by a failed update costs nothing.
     */
    async publishTournament(
      tournamentId: TournamentId,
      officialLeagues?: OfficialLeagues,
    ): Promise<void> {
      const session = requireSession()

      const tournament = await service.read<Tournament>(
        paths.tournaments(tournamentId),
      )
      if (tournament === undefined) {
        throw new DataLayerError('unknown', 'No such tournament.')
      }

      const matches = Object.values(tournament.matches ?? {}).sort(
        (a, b) => a.matchNumber - b.matchNumber,
      )
      const dated = matches.filter(
        (match) => match.startTimestamp !== undefined,
      )

      // The documented gate, enforced here rather than only in the form.
      if (dated.length === 0) {
        throw new DataLayerError(
          'unknown',
          'A tournament cannot be published until at least its first match has a start time.',
        )
      }

      const wantsLeague =
        officialLeagues?.matchBased === true ||
        officialLeagues?.gameWeekBased === true

      if (
        wantsLeague &&
        Object.keys(tournament.participatingPlayers ?? {}).length === 0
      ) {
        throw new DataLayerError(
          'unknown',
          'This tournament has no players, so a league against it would have nobody to pick. Set its teams and players first.',
        )
      }

      const update: Record<string, unknown> = {}

      // Absent means not published, so this is only written when it is missing.
      // Re-publishing must not move the timestamp.
      if (tournament.publishedAt === undefined) {
        update[service.path('tournaments', tournamentId, 'publishedAt')] =
          Date.now()
      }

      if (wantsLeague) {
        const [owner, lineupRules, deadlineOffset] = await Promise.all([
          service.read<User>(paths.users(session.uid as UserId)),
          service.read<LineupRules>(paths.standardFantasyLineupRules()),
          service.read<number>(
            paths.standardFantasyLeagueTeamChangesDeadlineOffset(),
          ),
        ])

        const offset = deadlineOffset ?? STANDARD_TEAM_CHANGES_DEADLINE_OFFSET
        const rules = lineupRules ?? STANDARD_FANTASY_LINEUP_RULES

        // No later than the first match's deadline, which is its start minus
        // the offset teams lock by.
        const firstStart = Math.min(
          ...dated.map((match) => match.startTimestamp ?? Number.MAX_VALUE),
        )

        const common = {
          tournament,
          ownerId: session.uid as UserId,
          ownerName: owner?.userName ?? 'System admin',
          rules,
          offset,
          joinDeadline: firstStart - offset,
        }

        if (officialLeagues?.matchBased === true) {
          Object.assign(update, await officialLeague(common, false))
        }
        if (officialLeagues?.gameWeekBased === true) {
          Object.assign(update, await officialLeague(common, true))
        }
      }

      await service.update(update)
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
