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
  SamplePlayersResult,
  OfficialLeagues,
  SignInOutcome,
  SignedInIdentity,
  SystemSetupResult,
} from '../api'
import type { Environment } from '@/config/environments'
import type {
  ArchivedLeagueCard,
  ArchivedLeagueIndexEntry,
  BannedUser,
  Competition,
  CompetitionId,
  FormatRecord,
  GameWeek,
  GameWeekId,
  GameWeekLineup,
  JoinableLeague,
  League,
  LeagueCard,
  LeagueId,
  LeagueIndexEntry,
  LeagueJoinCode,
  LeagueMember,
  LeagueSummary,
  LineupRules,
  LineupSubmission,
  Match,
  MatchConfig,
  MatchId,
  MatchLineup,
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
import { derivePhase } from '../league-phase'
import {
  AUCTION_PHASE_RECORDS,
  FORMAT_RECORDS,
  PLAYER_CATEGORY_RECORDS,
  PLAYER_ROLE_RECORDS,
  SAMPLE_COMPETITION_NAME,
  SAMPLE_PLAYERS,
  SAMPLE_TEAM_SHORT_NAMES,
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
            /*
              **Named for itself, not for its round.** Naming it after the round
              made a team saved per gameweek read as one saved per round, which
              is a different thing: a round holds gameweeks, and in a longer
              tournament it holds several.
            */
            gameWeekName: `Game Week ${index + 1}`,
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

  /**
   * The shared body of the My Leagues reads. Only the filter differs.
   */
  async function leagueCards(
    keep: (entry: LeagueIndexEntry) => boolean,
  ): Promise<LeagueCard[]> {
    const session = requireSession()
    const index = await service.read<Record<string, LeagueIndexEntry>>(
      paths.userLeagues(session.uid as UserId),
    )

    const entries = Object.entries(index ?? {}).filter(([, e]) => keep(e))
    if (entries.length === 0) return []

    // Once per distinct tournament, not once per league.
    const tournamentIds = [...new Set(entries.map(([, e]) => e.tournamentId))]
    const startDates = new Map<string, number | undefined>(
      await Promise.all(
        tournamentIds.map(
          async (id) =>
            [
              id,
              await service.read<number>(
                service.path('tournaments', id, 'startDate'),
              ),
            ] as const,
        ),
      ),
    )

    const now = Date.now()

    return Promise.all(
      entries.map(async ([leagueId, entry]) => {
        const id = leagueId as LeagueId

        const [members, finishedAt, auctionStartTime, auctionRuntime] =
          await Promise.all([
            service.read<Record<string, LeagueMember>>(paths.leagueMembers(id)),
            service.read<number>(service.path('leagues', id, 'finishedAt')),
            entry.isAuctionEnabled
              ? service.read<number>(
                  service.path(
                    'leagues',
                    id,
                    'auctionDetails',
                    'auctionStartTime',
                  ),
                )
              : undefined,
            // Its absence is the normal pre-auction state, never an error.
            entry.isAuctionEnabled
              ? service.read<unknown>(service.path('liveAuctions', id))
              : undefined,
          ])

        return {
          ...entry,
          leagueId: id,
          filledSlots: Object.values(members ?? {}).filter(
            (member) => member.leagueRoles?.manager === true,
          ).length,
          phase: derivePhase({
            finishedAt,
            tournamentStartDate: startDates.get(entry.tournamentId),
            isAuctionEnabled: entry.isAuctionEnabled,
            auctionStartTime,
            auctionHasStarted: auctionRuntime !== undefined,
            now,
          }),
        }
      }),
    )
  }

  /** What is stored under a lineup: ids, not players. */
  interface StoredLineup {
    lineup: PlayerId[]
    captainId: PlayerId
    viceCaptainId: PlayerId
    changesRemaining?: number
    captainChangesRemaining?: number
    viceCaptainChangesRemaining?: number
  }

  interface StoredGameWeekLineup {
    startingLineup: PlayerId[]
    captainId: PlayerId
    viceCaptainId: PlayerId
    impactSub?: GameWeekLineup['impactSub']
    postImpactSubLineup?: PlayerId[]
  }

  /**
   * Ids to players, **in the order given**, because a lineup is a list rather
   * than a set and the order it was picked in is the order it reads back.
   */
  async function resolvePlayers(ids: readonly PlayerId[]): Promise<Player[]> {
    const everyone = await service.read<Record<string, Player>>(paths.players())

    return ids
      .map((id) => everyone?.[id])
      .filter((player): player is Player => player !== undefined)
  }

  /**
   * A league's fixtures and its deadline offset, in one place.
   *
   * Matches come back **ordered by `matchNumber`**, which is the only legitimate
   * ordering key — push keys sort by creation time, not fixture order.
   */
  async function leagueFixtures(leagueId: LeagueId): Promise<{
    tournamentId: TournamentId
    matches: Match[]
    rounds: RoundConfig[]
    offset: number
  }> {
    const [tournamentId, offset, roundConfigs] = await Promise.all([
      service.read<TournamentId>(
        service.path('leagues', leagueId, 'tournamentId'),
      ),
      service.read<number>(
        service.path(
          'leagues',
          leagueId,
          'fantasyLeagueTeamChangesDeadlineOffset',
        ),
      ),
      service.read<Record<string, RoundConfig>>(
        service.path('leagues', leagueId, 'roundConfigs'),
      ),
    ])

    if (tournamentId === undefined) {
      throw new DataLayerError('unknown', 'That league no longer exists.')
    }

    const stored = await service.read<Record<string, Match>>(
      paths.tournamentMatches(tournamentId),
    )

    return {
      tournamentId,
      matches: Object.values(stored ?? {}).sort(
        (a, b) => a.matchNumber - b.matchNumber,
      ),
      rounds: Object.values(roundConfigs ?? {}),
      offset: offset ?? 0,
    }
  }

  /**
   * **Only a manager has a team.** Owning or administering a league is not
   * playing in it, and a spectator and a banned member are in it without
   * playing either.
   *
   * Checked here rather than by hiding the form, because interface gating is
   * convenience and anyone can reach the database directly with the client SDK.
   */
  async function assertManager(leagueId: LeagueId): Promise<void> {
    const session = requireSession()

    const roles = await service.read<LeagueMember['leagueRoles']>(
      service.path(
        'leagues',
        leagueId,
        'leagueMembers',
        session.uid,
        'leagueRoles',
      ),
    )

    if (roles?.manager !== true) {
      throw new DataLayerError(
        'unknown',
        'You are not playing in this league. Join it as a manager first.',
      )
    }
  }

  /**
   * **An illegal team is refused here**, not merely disabled in the form.
   *
   * Consistent with the auction deliberately permitting illegal squads: a
   * manager who cannot field a legal XI scores zero for that period, and
   * refusing the submission produces that outcome while saying so plainly,
   * rather than accepting a team the system would silently void.
   */
  async function assertLegal(
    leagueId: LeagueId,
    submission: LineupSubmission,
  ): Promise<void> {
    const { lineup, captainId, viceCaptainId } = submission

    if (lineup.length !== 11) {
      throw new DataLayerError(
        'unknown',
        `A team is eleven players. This one has ${lineup.length}.`,
      )
    }

    const ids = new Set(lineup.map((player) => player.playerId))
    if (ids.size !== 11) {
      throw new DataLayerError(
        'unknown',
        'The same player cannot be picked twice.',
      )
    }
    if (!ids.has(captainId) || !ids.has(viceCaptainId)) {
      throw new DataLayerError(
        'unknown',
        'The captain and vice-captain must both be in the eleven.',
      )
    }
    if (captainId === viceCaptainId) {
      throw new DataLayerError(
        'unknown',
        'The captain and vice-captain cannot be the same player.',
      )
    }

    const rules = await api.getLineupRules(leagueId)

    for (const [role, rule] of Object.entries(rules)) {
      if (rule === undefined) continue
      const count = lineup.filter((p) => p.playerRole === role).length

      if (count < rule.min) {
        throw new DataLayerError(
          'unknown',
          `This league needs at least ${rule.min} of role ${role}. You have ${count}.`,
        )
      }
      // Absent means no upper limit.
      if (rule.max !== undefined && count > rule.max) {
        throw new DataLayerError(
          'unknown',
          `This league allows at most ${rule.max} of role ${role}. You have ${count}.`,
        )
      }
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

    /**
     * **One read of the index, then a few small ones per league.**
     *
     * The index carries what a card renders except two things it cannot: the
     * phase, which depends on the current time, and the member count, which
     * would otherwise need a stored counter updated on every member's own entry
     * on every join.
     *
     * **Never reads `leagues/{id}` whole.** That is subtree-shaped and would
     * drag an auction config — a base price for every player in the tournament
     * — plus the gameweek structure, per league, to render six fields.
     *
     * **The tournament is read once per distinct tournament**, not once per
     * league, because leagues cluster on tournaments.
     */
    async getActiveLeagues(): Promise<LeagueCard[]> {
      return leagueCards((entry) => entry.membershipStatus === 'Accepted')
    },

    async getPendingLeagues(): Promise<LeagueCard[]> {
      return leagueCards((entry) => entry.membershipStatus === 'Pending')
    },

    /**
     * **Reads beneath the league, never the league whole.** Six small leaf reads
     * beat one subtree read that would drag an auction config and a gameweek
     * structure to render a strip.
     */
    async getLeagueSummary(leagueId: LeagueId): Promise<LeagueSummary> {
      const session = requireSession()
      const userId = session.uid as UserId

      const at = (field: string) => service.path('leagues', leagueId, field)

      const [
        leagueName,
        leagueJoinCode,
        tournamentId,
        isAuctionEnabled,
        isGameWeeksEnabled,
        finishedAt,
        me,
      ] = await Promise.all([
        service.read<string>(at('leagueName')),
        service.read<string>(at('leagueJoinCode')),
        service.read<TournamentId>(at('tournamentId')),
        service.read<boolean>(at('isAuctionEnabled')),
        service.read<boolean>(at('isGameWeeksEnabled')),
        service.read<number>(at('finishedAt')),
        service.read<LeagueMember>(paths.leagueMembers(leagueId, userId)),
      ])

      if (leagueName === undefined || tournamentId === undefined) {
        throw new DataLayerError('unknown', 'That league no longer exists.')
      }

      const [tournamentName, startDate, offset, auctionStartTime, runtime] =
        await Promise.all([
          service.read<string>(
            service.path('tournaments', tournamentId, 'tournamentName'),
          ),
          service.read<number>(
            service.path('tournaments', tournamentId, 'startDate'),
          ),
          service.read<number>(at('fantasyLeagueTeamChangesDeadlineOffset')),
          isAuctionEnabled === true
            ? service.read<number>(
                service.path(
                  'leagues',
                  leagueId,
                  'auctionDetails',
                  'auctionStartTime',
                ),
              )
            : undefined,
          isAuctionEnabled === true
            ? service.read<unknown>(service.path('liveAuctions', leagueId))
            : undefined,
        ])

      return {
        leagueId,
        leagueName,
        leagueJoinCode: leagueJoinCode ?? '',
        phase: derivePhase({
          finishedAt,
          tournamentStartDate: startDate,
          isAuctionEnabled: isAuctionEnabled === true,
          auctionStartTime,
          auctionHasStarted: runtime !== undefined,
          now: Date.now(),
        }),
        /*
          The next moment anything locks: the first match's start minus the
          offset teams lock by. **Deadlines always come from the scheduled start
          and never shift with delays.**
        */
        nextDeadline:
          startDate === undefined ? undefined : startDate - (offset ?? 0),
        // Rank is deliberately absent. See the contract.
        deadlineOffset: offset ?? 0,
        isAuctionEnabled: isAuctionEnabled === true,
        isGameWeeksEnabled: isGameWeeksEnabled === true,
        myRoles: me?.leagueRoles ?? {},
        tournamentId,
        tournamentName: tournamentName ?? '',
      }
    },

    /**
     * A separate node, read only when its tab is opened.
     *
     * **The move into it is not built.** A league belongs here once it has been
     * finished for twenty-four hours, and Phase 1 has no scheduler, so the
     * documents put that migration on the next My Leagues load as one atomic
     * update. Nothing can be finished yet, so nothing has needed moving.
     */
    async getArchivedLeagues(): Promise<ArchivedLeagueCard[]> {
      const session = requireSession()
      const index = await service.read<
        Record<string, ArchivedLeagueIndexEntry>
      >(service.path('users', session.uid, 'archivedLeagues'))

      return Object.entries(index ?? {}).map(([leagueId, entry]) => ({
        ...entry,
        leagueId: leagueId as LeagueId,
        phase: 'finished' as const,
      }))
    },

    // -----------------------------------------------------------------------
    // My Team
    // -----------------------------------------------------------------------

    async getLineupRules(leagueId: LeagueId): Promise<LineupRules> {
      return (
        (await service.read<LineupRules>(
          service.path('leagues', leagueId, 'fantasyLineupRules'),
        )) ?? {}
      )
    },

    /**
     * **The earliest match whose deadline has not passed**, or the last one once
     * they all have. Its own read rather than something carried on the league,
     * because someone may sit on this page long enough for a deadline to pass
     * beneath them.
     *
     * A deadline is the scheduled start minus the league's offset, and **never
     * shifts with a delay**.
     */
    async getCurrentMatch(leagueId: LeagueId): Promise<Match> {
      const { matches, offset } = await leagueFixtures(leagueId)
      const now = Date.now()

      const open = matches.find(
        (match) =>
          match.startTimestamp === undefined ||
          match.startTimestamp - offset > now,
      )

      const match = open ?? matches[matches.length - 1]
      if (match === undefined) {
        throw new DataLayerError('unknown', 'This tournament has no matches.')
      }
      return match
    },

    /**
     * The phase of the tournament the current match falls in.
     *
     * **Resolved against the tournament, not the league's round configs.** A
     * match-based league has no round configs at all and still belongs to a
     * round, and the round's name lives on the tournament either way.
     *
     * **Found by `matchNumber`.** A round stores a first and last match id, and
     * ids are push keys that sort by creation time rather than fixture order.
     */
    async getCurrentRound(leagueId: LeagueId): Promise<Round> {
      const current = await api.getCurrentMatch(leagueId)
      const { tournamentId, matches } = await leagueFixtures(leagueId)

      const rounds = await service.read<Record<string, Round>>(
        paths.tournamentRounds(tournamentId),
      )

      const numberOf = (matchId: MatchId) =>
        matches.find((m) => m.matchId === matchId)?.matchNumber ?? 0

      const round = Object.values(rounds ?? {}).find(
        (r) =>
          numberOf(r.firstMatchId) <= current.matchNumber &&
          current.matchNumber <= numberOf(r.lastMatchId),
      )

      if (round === undefined) {
        throw new DataLayerError(
          'unknown',
          'No round covers the current match.',
        )
      }
      return round
    },

    async getCurrentGameWeek(leagueId: LeagueId): Promise<GameWeek> {
      const current = await api.getCurrentMatch(leagueId)
      const { rounds, matches } = await leagueFixtures(leagueId)

      const numberOf = (matchId: MatchId) =>
        matches.find((m) => m.matchId === matchId)?.matchNumber ?? 0

      for (const round of rounds) {
        for (const gameWeek of Object.values(round.gameWeeks ?? {})) {
          if (
            numberOf(gameWeek.startMatchId) <= current.matchNumber &&
            current.matchNumber <= numberOf(gameWeek.endMatchId)
          ) {
            return gameWeek
          }
        }
      }

      throw new DataLayerError(
        'unknown',
        "No gameweek covers the current match. The league's gameweek structure is incomplete.",
      )
    },

    /**
     * **The whole tournament pool**, for a regular league.
     *
     * Expensive in a way its signature hides: the tournament stores player ids
     * only, and there is no query that fetches a chosen two hundred, so the
     * names come from reading the entire catalogue. Item 1 in
     * `docs/09-future-exploration.md` is the fix.
     */
    async getSelectablePlayers(
      leagueId: LeagueId,
      _matchId: MatchId,
    ): Promise<Player[]> {
      const tournamentId = await service.read<TournamentId>(
        service.path('leagues', leagueId, 'tournamentId'),
      )
      if (tournamentId === undefined) {
        throw new DataLayerError('unknown', 'That league no longer exists.')
      }

      const [participants, everyone] = await Promise.all([
        service.read<Partial<Record<PlayerId, TeamId>>>(
          service.path('tournaments', tournamentId, 'participatingPlayers'),
        ),
        service.read<Record<string, Player>>(paths.players()),
      ])

      const ids = new Set(Object.keys(participants ?? {}))

      return Object.values(everyone ?? {})
        .filter((player) => ids.has(player.playerId))
        .sort((a, b) => a.playerName.localeCompare(b.playerName))
    },

    async getMyTeamForMatch(
      leagueId: LeagueId,
      matchId: MatchId,
    ): Promise<MatchLineup | undefined> {
      const session = requireSession()
      const stored = await service.read<StoredLineup>(
        service.path('matchBasedLineups', leagueId, session.uid, matchId),
      )
      if (stored === undefined) return undefined

      return {
        ...stored,
        lineup: await resolvePlayers(stored.lineup),
      }
    },

    async getMyTeamForGameWeek(
      leagueId: LeagueId,
      gameWeekId: GameWeekId,
    ): Promise<GameWeekLineup | undefined> {
      const session = requireSession()
      const stored = await service.read<StoredGameWeekLineup>(
        service.path('gameWeekBasedLineups', leagueId, session.uid, gameWeekId),
      )
      if (stored === undefined) return undefined

      const [startingLineup, postImpactSubLineup] = await Promise.all([
        resolvePlayers(stored.startingLineup),
        stored.postImpactSubLineup === undefined
          ? undefined
          : resolvePlayers(stored.postImpactSubLineup),
      ])

      return {
        captainId: stored.captainId,
        viceCaptainId: stored.viceCaptainId,
        startingLineup,
        ...(stored.impactSub === undefined
          ? {}
          : { impactSub: stored.impactSub }),
        ...(postImpactSubLineup === undefined ? {} : { postImpactSubLineup }),
      }
    },

    /**
     * **Written densely, from this match to the end of the tournament.**
     *
     * A lineup applies forward until replaced, and the model stores that
     * literally rather than deriving it — which is why editing at match fifteen
     * overwrites everything from fifteen onward, including a change made at
     * match thirty and since forgotten. The interface warns; the layer does it.
     */
    async updateTeamForMatch(
      leagueId: LeagueId,
      matchId: MatchId,
      lineup: LineupSubmission,
    ): Promise<void> {
      const session = requireSession()
      await assertManager(leagueId)

      const { matches, offset } = await leagueFixtures(leagueId)

      const from = matches.find((match) => match.matchId === matchId)
      if (from === undefined) {
        throw new DataLayerError('unknown', 'No such match in this tournament.')
      }
      if (
        from.startTimestamp !== undefined &&
        from.startTimestamp - offset <= Date.now()
      ) {
        throw new DataLayerError(
          'unknown',
          'The deadline for this match has passed.',
        )
      }

      await assertLegal(leagueId, lineup)

      const stored = {
        lineup: lineup.lineup.map((player) => player.playerId),
        captainId: lineup.captainId,
        viceCaptainId: lineup.viceCaptainId,
        // No change counters. Absent is unlimited, and nothing configures them.
      }

      const update: Record<string, unknown> = {}
      for (const match of matches) {
        if (match.matchNumber < from.matchNumber) continue
        update[
          service.path(
            'matchBasedLineups',
            leagueId,
            session.uid,
            match.matchId,
          )
        ] = stored
      }

      await service.update(update)
    },

    /** One entry, never dense. A gameweek league has one per gameweek. */
    async updateTeamForGameWeek(
      leagueId: LeagueId,
      gameWeekId: GameWeekId,
      lineup: LineupSubmission,
    ): Promise<void> {
      const session = requireSession()
      await assertManager(leagueId)

      const { matches, rounds, offset } = await leagueFixtures(leagueId)

      const gameWeek = rounds
        .flatMap((round) => Object.values(round.gameWeeks ?? {}))
        .find((gw) => gw.gameWeekId === gameWeekId)

      if (gameWeek === undefined) {
        throw new DataLayerError('unknown', 'No such gameweek in this league.')
      }

      // **A gameweek locks at the deadline of its first match.**
      const first = matches.find(
        (match) => match.matchId === gameWeek.startMatchId,
      )
      if (
        first?.startTimestamp !== undefined &&
        first.startTimestamp - offset <= Date.now()
      ) {
        throw new DataLayerError(
          'unknown',
          'The deadline for this gameweek has passed.',
        )
      }

      await assertLegal(leagueId, lineup)

      await service.write(
        service.path('gameWeekBasedLineups', leagueId, session.uid, gameWeekId),
        {
          startingLineup: lineup.lineup.map((player) => player.playerId),
          captainId: lineup.captainId,
          viceCaptainId: lineup.viceCaptainId,
        },
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

    /**
     * **Test data, not reference data**, which is why it has no marker and no
     * guard against a second run. It leans on `createPlayers`, so a name already
     * in the catalogue is skipped rather than duplicated and pressing it twice
     * adds only what the first press missed.
     *
     * The teams are created if missing, and a team that exists but does not play
     * the T20 Series has it **added to** its base tournaments — never replaced,
     * because removing one cascades and would clear a roster.
     */
    async createSamplePlayers(): Promise<SamplePlayersResult> {
      const competitions = await api.getCompetitions()
      const competition = competitions.find(
        (c) => c.competitionName === SAMPLE_COMPETITION_NAME,
      )

      if (competition === undefined) {
        throw new DataLayerError(
          'unknown',
          `There is no ${SAMPLE_COMPETITION_NAME} base tournament. Press Set up basic system first.`,
        )
      }

      const competitionId = competition.competitionId
      const teams = await api.getTeams()
      const teamsCreated: string[] = []
      const teamIds = new Map<string, TeamId>()

      for (const teamName of Object.keys(SAMPLE_TEAM_SHORT_NAMES)) {
        const existing = teams.find((team) => team.teamName === teamName)

        if (existing === undefined) {
          const teamId = await api.createTeam({
            teamName,
            teamShortName: SAMPLE_TEAM_SHORT_NAMES[teamName] ?? teamName,
            competitionIds: [competitionId],
          })
          teamIds.set(teamName, teamId)
          teamsCreated.push(teamName)
          continue
        }

        teamIds.set(teamName, existing.teamId)

        // The union, never a replacement. `updateTeam` treats a missing
        // competition as a removal and cascades it.
        if (existing.competitionIds?.[competitionId] !== true) {
          await api.updateTeam(existing.teamId, {
            competitionIds: [
              ...(Object.keys(
                existing.competitionIds ?? {},
              ) as CompetitionId[]),
              competitionId,
            ],
          })
        }
      }

      const result = await api.createPlayers(
        SAMPLE_PLAYERS.map((player) => {
          const teamId = teamIds.get(player.teamName)

          return {
            playerName: player.playerName,
            playerShortName: player.playerShortName,
            country: player.country,
            playerRole: player.playerRole,
            currentTeams:
              teamId === undefined ? {} : { [competitionId]: teamId },
          }
        }),
      )

      return {
        created: result.created,
        skipped: result.skipped,
        teamsCreated,
        competitionName: competition.competitionName,
      }
    },

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
