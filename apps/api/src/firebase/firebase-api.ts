/**
 * `Api` implemented against Firebase.
 *
 * **TODO: rename this file.** "api" means three things in this repo — the
 * `Api` contract, the `apps/api` workspace, and the deployed service — so
 * `firebase-api` inside `apps/api` reads badly. The accurate word is
 * *adapter*: `Api` is the port, this is the Firebase adapter for it, and a
 * SQL one would sit beside it under the same port. Left alone for now to keep
 * the migration diff readable.
 *
 * **This is where backend knowledge lives.** Which paths hold what, that a
 * user record is keyed by the auth UID, that seeding is one atomic multi-path
 * update — all of it stops here. Above this line an operation is just an
 * operation.
 *
 * It holds a `FirebaseService`, which is the client: paths, reads, writes,
 * atomic updates and claims. **That client is private to this folder.**
 * Nothing above imports it, which is what stops schema knowledge leaking
 * upward.
 *
 * **The browser satisfies the same interface with `HttpApi`**, which calls
 * this service over HTTP rather than reaching a database at all. Both
 * implement `Api`, which is what let the backend move without touching a
 * single page.
 *
 * ---
 *
 * **One file for now**, carrying all 64 operations that cross the wire. It
 * gets split by subject — `leagues.ts`, `lineups.ts`, `scoring.ts` —
 * mirroring the public files by name, once that stops being comfortable to
 * read. At 3,900 lines that point is close.
 */

import type {
  Api,
  CreatePlayersResult,
  SamplePlayersResult,
  SampleTournamentResult,
  SeedDataResult,
  MatchPlayerPoints,
  OfficialLeagues,
  SystemSetupResult,
} from '@fantasy-cricket/shared'
import type { Environment } from '@fantasy-cricket/shared'

import type { Session } from '../auth.ts'
import type {
  AcceptedBidsForPlayer,
  DraftPick,
  ArchivedLeagueCard,
  ArchivedLeagueIndexEntry,
  AuctionBatch,
  AuctionCall,
  AuctionConfig,
  AuctionPhase,
  AuctionPoolPlayer,
  AuctionSettings,
  AuctionState,
  Bid,
  BidId,
  BannedUser,
  Competition,
  CompetitionConfig,
  CompetitionId,
  DraftOrderEntry,
  FormatRecord,
  GameWeek,
  GameWeekId,
  GameWeekLineup,
  JoinableLeague,
  League,
  LeagueCard,
  LeagueGameWeek,
  LeagueId,
  LeagueIndexEntry,
  LeagueJoinCode,
  LeagueMember,
  LeaguePlayerAuctionDetail,
  LeagueSummary,
  LineupRules,
  LineupSubmission,
  ManagerAuctionStatus,
  Match,
  MatchConfig,
  MatchId,
  MatchLineup,
  MatchPlayers,
  MatchSide,
  LeagueDetails,
  LeagueMemberSummary,
  RoundDetails,
  PeriodLeaderboard,
  LeaderboardRow,
  ScoringWatermark,
  Player,
  PlayerConfig,
  PlayerFilter,
  PlayerId,
  PlayerPoints,
  PlayerRoleRecord,
  PlayerStatus,
  NoBidId,
  Round,
  RoundConfig,
  RoundId,
  StandardAuctionConfig,
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
  TimelineEventData,
  TimelineEventId,
  User,
  UserId,
} from '@fantasy-cricket/shared'

import {
  AUCTION_CALLS,
  BID_INCREMENT,
  CALL_AT_SECONDS,
  DataLayerError,
  DEFAULT_HOME_NATION,
  FORMATS,
  PLAYER_CATEGORIES,
  PLAYER_ROLES,
  ROUND_SECONDS,
} from '@fantasy-cricket/shared'
import { derivePhase } from '../league-phase.ts'
import { draftOrderList, nextDraftTurn } from '../draft-order.ts'
import {
  AUCTION_PHASE_RECORDS,
  changeAllowanceFor,
  FORMAT_RECORDS,
  PLAYER_CATEGORY_RECORDS,
  PLAYER_ROLE_RECORDS,
  SAMPLE_COMPETITION_NAME,
  SAMPLE_PLAYERS,
  SAMPLE_TEAM_SHORT_NAMES,
  SAMPLE_AUCTION_VALUES,
  SAMPLE_DEFAULT_AUCTION_VALUE,
  SEED_COMPETITIONS,
  STANDARD_AUCTION_CONFIG,
  STANDARD_FANTASY_LINEUP_RULES,
  STANDARD_TEAM_CHANGES_DEADLINE_OFFSET,
  TIMELINE_EVENT_RECORDS,
  USER_ROLES,
} from '../seed-data.ts'
import {
  auctionValueAt,
  FORMAT_COMPETITIONS,
  IPL_2026_PLAYERS,
  IPL_COMPETITION,
  IPL_ROUNDS,
  IPL_TEAMS,
  iplScheduleIn,
  NATIONAL_TEAMS,
  ROLE_OF,
  shortNames,
  type IntlFormat,
} from '../seed-ipl-2026.ts'
import { FirebaseService, type DbPath } from './firebase-service.ts'
import { createPaths } from './paths.ts'

/**
 * Also exposes the environment it was built for, which `setEnvironment` reads
 * to decide whether a second call is a no-op or a mistake. Not part of `Api`:
 * nothing above the layer needs to ask a backend which environment it is, and
 * `src/config/environments.ts` answers that question anyway.
 */
/**
 * **Everything the contract has except the three the browser keeps.**
 * `onAuthChanged`, `signInWithGoogle` and `signOut` are the Google popup and
 * the auth-state listener; there is nothing for a server to implement.
 */
export type ServerApi = Omit<
  Api,
  'onAuthChanged' | 'signInWithGoogle' | 'signOut'
>

export interface FirebaseApi extends ServerApi {
  readonly environment: Environment
}

/**
 * **One of these per request, carrying that caller's identity.**
 *
 * In the browser the signed-in user was ambient, so `requireSession()` could
 * ask the SDK. On a server there is no ambient user — there is one per
 * request — and closing over it is what makes it impossible for a handler to
 * see somebody else's. `session` is absent only on the routes that do not
 * need it; asking for it then is a bug and throws.
 *
 * **The environment comes from the deployment, never from the request.**
 */
export function createFirebaseApi(
  environment: Environment,
  session?: Session,
): FirebaseApi {
  const service = new FirebaseService(environment)
  const paths = createPaths(service)

  /** Throws rather than returning undefined: calling these signed out is a bug. */
  function requireSession() {
    if (session === undefined) {
      throw new DataLayerError('unauthenticated', 'Sign in first.')
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
   * The official auction league's slots. Beyond eight an auction stops being
   * fun, which is the ceiling; six is the room the standard config is built
   * around.
   */
  const OFFICIAL_AUCTION_LEAGUE_SLOTS = 6

  /** A generous ceiling on one points read. See `getPlayerPointsForMatches`. */
  const MAX_MATCHES_PER_POINTS_READ = 100

  /**
   * **Where this league's points for a match live**, decided once by its
   * scoring flag. A custom-scoring league reads only its own store and never
   * falls back to the standard one, per match or otherwise.
   */
  async function pointsPathFor(
    leagueId: LeagueId,
  ): Promise<(matchId: MatchId) => DbPath> {
    const [isCustom, tournamentId] = await Promise.all([
      service.read<boolean>(
        service.path('leagues', leagueId, 'isCustomScoringSystem'),
      ),
      service.read<TournamentId>(
        service.path('leagues', leagueId, 'tournamentId'),
      ),
    ])

    if (isCustom === true) {
      return (matchId) => paths.customPointsByMatch(leagueId, matchId)
    }
    if (tournamentId === undefined) {
      throw new DataLayerError('notFound', 'That league no longer exists.')
    }
    return (matchId) => paths.standardPointsByMatch(tournamentId, matchId)
  }

  /**
   * **What a participant with no standard auction values goes into a league's
   * pool as.** Players created before values were required have none, and
   * leaving them out would make them unbuyable for the whole season.
   */
  const DEFAULT_AUCTION_DETAIL: LeaguePlayerAuctionDetail = {
    playerCategory: 'general',
    playerBasePrice: 2,
  }

  /**
   * **The standard auction config, projected onto one tournament** and frozen
   * into the league. A projection rather than a snapshot: the standard holds
   * every player in the system, a league needs only its participants. Frozen
   * because managers bid against these values, so editing the standard later
   * must not change what an auction ran under.
   */
  async function auctionConfigFor(
    tournament: Tournament,
    ownerId: UserId,
  ): Promise<AuctionConfig> {
    const standard = await service.read<StandardAuctionConfig>(
      paths.standardAuctionConfig(),
    )
    const details = standard?.playerDetails ?? {}

    const playerDetails: Record<string, LeaguePlayerAuctionDetail> = {}
    for (const playerId of Object.keys(tournament.participatingPlayers ?? {})) {
      playerDetails[playerId] =
        details[playerId as PlayerId] ?? DEFAULT_AUCTION_DETAIL
    }

    const maxOverseas =
      standard?.maxOverseasPlayersAllowedInXI ??
      STANDARD_AUCTION_CONFIG.maxOverseasPlayersAllowedInXI

    return {
      lastUpdatedBy: { user: ownerId, timestamp: Date.now() },
      playerDetails,
      totalBudget: standard?.totalBudget ?? STANDARD_AUCTION_CONFIG.totalBudget,
      minSquadSize:
        standard?.minSquadSize ?? STANDARD_AUCTION_CONFIG.minSquadSize,
      maxSquadSize:
        standard?.maxSquadSize ?? STANDARD_AUCTION_CONFIG.maxSquadSize,
      // Absent means no cap, and Firebase would drop an undefined anyway.
      ...(maxOverseas === undefined
        ? {}
        : { maxOverseasPlayersAllowedInXI: maxOverseas }),
      // Frozen with the league, like the prices. An environment seeded before
      // the sequence existed has none stored, so the seed's is used.
      batchSequence:
        standard?.batchSequence ?? STANDARD_AUCTION_CONFIG.batchSequence ?? [],
    }
  }

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

    const me = session?.uid
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
   * A trimmed, non-empty name no other base tournament has, ignoring case.
   *
   * **Read-then-write, and that is enough here.** Only system admins create
   * base tournaments, a handful of times a year; two creating the same name in
   * the same second is not a case worth a transaction.
   */
  async function uniqueCompetitionName(
    raw: string,
    self?: CompetitionId,
  ): Promise<string> {
    const name = raw.trim()
    if (name === '') {
      throw new DataLayerError('invalid', 'A base tournament needs a name.')
    }

    const all = await service.read<Record<string, Competition>>(
      paths.competitions(),
    )
    const clash = Object.values(all ?? {}).find(
      (competition) =>
        competition.competitionId !== self &&
        competition.competitionName.toLowerCase() === name.toLowerCase(),
    )
    if (clash !== undefined) {
      throw new DataLayerError(
        'invalid',
        `There is already a base tournament called ${clash.competitionName}.`,
      )
    }
    return name
  }

  function assertFormat(formatId: unknown): void {
    if (!(FORMATS as readonly unknown[]).includes(formatId)) {
      throw new DataLayerError('invalid', 'Pick a format.')
    }
  }

  /**
   * **A player's standard auction values, checked.** The category must be one
   * of the three, and the base price positive and on the 0.5 grid every bid
   * moves along, so no auction can open at a price no bid could reach.
   */
  function auctionDetailFor(
    playerName: string,
    playerCategory: unknown,
    playerBasePrice: unknown,
  ): LeaguePlayerAuctionDetail {
    if (!(PLAYER_CATEGORIES as readonly unknown[]).includes(playerCategory)) {
      throw new DataLayerError(
        'invalid',
        `${playerName} needs a category: marquee, star or general.`,
      )
    }
    if (
      typeof playerBasePrice !== 'number' ||
      !Number.isFinite(playerBasePrice) ||
      playerBasePrice <= 0 ||
      !Number.isInteger(playerBasePrice * 2)
    ) {
      throw new DataLayerError(
        'invalid',
        `${playerName} needs a base price above zero, in steps of 0.5.`,
      )
    }
    return {
      playerCategory:
        playerCategory as LeaguePlayerAuctionDetail['playerCategory'],
      playerBasePrice,
    }
  }

  function draftPositionPath(leagueId: LeagueId, position: number): DbPath {
    return service.path(
      'leagues',
      leagueId,
      'auctionDetails',
      'draftOrder',
      String(position),
    )
  }

  /**
   * **A random free draft position, claimed transactionally**, the same way a
   * join code is: two managers joining at once can both see position 4 free,
   * but only one claim on it commits, and the other moves on to the next.
   *
   * A manager who already holds a position keeps it. The draft order is read
   * in either shape RTDB returns — a map, or an array with holes, which is
   * what small integer keys come back as.
   */
  async function claimDraftPosition(
    league: League,
    userId: UserId,
  ): Promise<number | undefined> {
    const raw = league.isAuctionEnabled
      ? league.auctionDetails.draftOrder
      : undefined
    const held = new Map<number, UserId>()
    for (const [key, holder] of Object.entries(raw ?? {})) {
      if (typeof holder === 'string') held.set(Number(key), holder)
    }

    for (const holder of held.values()) {
      if (holder === userId) return undefined
    }

    const free = Array.from({ length: league.maxSlots }, (_, i) => i + 1)
      .filter((position) => !held.has(position))
      .sort(() => Math.random() - 0.5)

    for (const position of free) {
      const won = await service.claim(
        draftPositionPath(league.leagueId, position),
        userId,
      )
      if (won) return position
    }

    throw new DataLayerError('leagueFull', 'This league is full.')
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
      'internal',
      'Could not find an unused join code. Try again.',
    )
  }

  /**
   * **Each round split into equal gameweeks of the length chosen for it.**
   * Numbered and named across the whole tournament, so the third gameweek is
   * "Game Week 3" whichever round it falls in.
   *
   * **Refused unless every round has a length that divides its match count**,
   * since gameweeks are equal length within a round. This is the check; the
   * publish form offering only divisors is convenience.
   *
   * The impact sub is a change *during* a gameweek, so it is forced off in a
   * round whose gameweeks are a single match and there is no during.
   */
  function gameWeeksFor(
    tournament: Tournament,
    lengths: Partial<Record<RoundId, number>> | undefined,
  ): Record<string, RoundConfig> {
    const matches = tournament.matches ?? {}
    const numberOf = (matchId: MatchId) => matches[matchId]?.matchNumber ?? 0
    const idAt = new Map(
      Object.values(matches).map((match) => [match.matchNumber, match.matchId]),
    )

    const rounds = Object.values(tournament.rounds ?? {}).sort(
      (a, b) => numberOf(a.firstMatchId) - numberOf(b.firstMatchId),
    )

    const configs: Record<string, RoundConfig> = {}
    let gameWeekNumber = 0

    for (const round of rounds) {
      const first = numberOf(round.firstMatchId)
      const span = numberOf(round.lastMatchId) - first + 1
      const length = lengths?.[round.roundId]

      if (length === undefined) {
        throw new DataLayerError(
          'invalidConfig',
          `Choose a gameweek length for ${round.roundName}.`,
        )
      }
      if (
        !Number.isInteger(length) ||
        length < 1 ||
        length > span ||
        span % length !== 0
      ) {
        throw new DataLayerError(
          'invalidConfig',
          `${round.roundName} has ${span} matches, so its gameweeks can only be a length that divides ${span}.`,
        )
      }

      const gameWeeks: Record<string, GameWeek> = {}

      for (let start = first; start < first + span; start += length) {
        const startMatchId = idAt.get(start)
        const endMatchId = idAt.get(start + length - 1)
        if (startMatchId === undefined || endMatchId === undefined) {
          throw new DataLayerError(
            'invalidConfig',
            `${round.roundName} names a match that does not exist.`,
          )
        }

        gameWeekNumber += 1
        const gameWeekId = service.generateKey() as GameWeekId
        gameWeeks[gameWeekId] = {
          gameWeekId,
          gameWeekName: `Game Week ${gameWeekNumber}`,
          gameWeekNumber,
          startMatchId,
          endMatchId,
        }
      }

      configs[round.roundId] = {
        // Absent allowances mean unlimited, which is what an open league wants.
        isImpactSubAllowed: length > 1,
        gameWeeks,
      }
    }

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
   * everyone else does. In an auction league the owner is also the auctioneer,
   * recorded on the membership and on `auctionDetails` in this same write —
   * the two copies must never disagree about who holds control.
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
    kind:
      | { type: 'match' }
      | { type: 'gameWeek'; roundConfigs: Record<string, RoundConfig> }
      | {
          type: 'auction'
          roundConfigs: Record<string, RoundConfig>
          auctionConfig: AuctionConfig
          auctionStartTime: number
        },
  ): Promise<Record<string, unknown>> {
    const { tournament, ownerId, ownerName, rules, offset } = inputs
    const isAuction = kind.type === 'auction'

    const leagueId = service.generateKey() as LeagueId
    const leagueJoinCode = await claimJoinCode(leagueId)

    const allowance = changeAllowanceFor(
      Object.keys(tournament.matches ?? {}).length,
    )

    const leagueName = `${tournament.tournamentName} — Official ${
      kind.type === 'auction'
        ? 'Auction'
        : kind.type === 'gameWeek'
          ? 'Gameweek'
          : 'Match'
    } League`

    const roles = isAuction
      ? ({
          leagueOwner: true,
          leagueAdmin: true,
          primaryAuctioneer: true,
        } as const)
      : ({ leagueOwner: true, leagueAdmin: true } as const)

    const maxSlots = isAuction
      ? OFFICIAL_AUCTION_LEAGUE_SLOTS
      : OFFICIAL_LEAGUE_SLOTS

    const base = {
      leagueId,
      leagueName,
      leagueOwner: ownerId,
      leagueJoinCode,
      tournamentId: tournament.tournamentId,
      leagueEntry: 'Open',
      maxSlots,
      fantasyLineupRules: rules,
      leagueMembers: { [ownerId]: { leagueRoles: roles } },
      fantasyLeagueTeamChangesDeadlineOffset: offset,
      // Nothing to join after bidding begins, so an auction league closes then.
      fantasyLeagueJoinDeadline:
        kind.type === 'auction' ? kind.auctionStartTime : inputs.joinDeadline,
      isCustomScoringSystem: false,
      isAuctionEnabled: isAuction,
    }

    let league: Record<string, unknown>
    switch (kind.type) {
      case 'match':
        league = {
          ...base,
          isGameWeeksEnabled: false,
          /*
            **One allowance for the whole league, sized by the tournament.**
            The same figure serves all three, because they are counted
            separately against their own allowances rather than sharing one
            pool. See `changeAllowanceFor`.
          */
          totalChangesAllowed: allowance,
          totalCaptainChangesAllowed: allowance,
          totalViceCaptainChangesAllowed: allowance,
        }
        break
      case 'gameWeek':
        league = {
          ...base,
          isGameWeeksEnabled: true,
          roundConfigs: kind.roundConfigs,
        }
        break
      case 'auction':
        league = {
          ...base,
          // Forced: an auction league is always gameweek-based. Its change
          // allowances are absent, which is unlimited — the squad won at
          // auction is already the constraint.
          isGameWeeksEnabled: true,
          roundConfigs: kind.roundConfigs,
          auctionDetails: {
            auctionConfig: kind.auctionConfig,
            auctionStartTime: kind.auctionStartTime,
            primaryAuctioneer: ownerId,
            // No draftOrder: positions are claimed as managers join, and an
            // empty map is not stored. No transfer windows: not in Phase 1's
            // official league.
          },
        }
        break
    }

    return {
      [paths.leagues(leagueId)]: league,

      // The tournament page's list of its leagues. Exactly the fields that row
      // renders, and no more, or it drifts into a second copy of the league.
      [service.path(
        'tournaments',
        tournament.tournamentId,
        'leagues',
        leagueId,
      )]: {
        leagueName,
        isAuctionEnabled: isAuction,
        leagueEntry: 'Open',
        maxSlots,
      },

      // My Leagues, for the owner.
      [service.path('users', ownerId, 'leagues', leagueId)]: {
        leagueName,
        tournamentId: tournament.tournamentId,
        tournamentName: tournament.tournamentName,
        isAuctionEnabled: isAuction,
        ownerName,
        maxSlots,
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

        const [members, finishedAt, auctionPhase] = await Promise.all([
          service.read<Record<string, LeagueMember>>(paths.leagueMembers(id)),
          service.read<number>(service.path('leagues', id, 'finishedAt')),
          entry.isAuctionEnabled ? liveAuctionPhase(id) : undefined,
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
            auctionPhase,
            now,
          }),
        }
      }),
    )
  }

  /**
   * Firebase stores neither `undefined` nor `null` as a value, so a key carrying
   * one simply would not exist. Dropping them here makes that explicit rather
   * than leaving it to the client to do quietly.
   */
  function omitUndefined<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(
      Object.entries(value).filter(([, v]) => v !== undefined),
    ) as T
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
  async function resolvePlayers(
    ids: readonly PlayerId[],
    leagueId: LeagueId,
  ): Promise<Player[]> {
    const [everyone, teamOf] = await Promise.all([
      service.read<Record<string, Player>>(paths.players()),
      leagueTeams(leagueId),
    ])

    return ids
      .map((id) => everyone?.[id])
      .filter((player): player is Player => player !== undefined)
      .map((player) => withTeam(player, teamOf))
  }

  /**
   * **Each player's team in this league's tournament, as a short name.** From
   * the tournament's frozen `participatingPlayers`, so a player who has since
   * moved club still shows the team they played for here.
   */
  async function leagueTeams(leagueId: LeagueId): Promise<Map<string, string>> {
    const tournamentId = await service.read<TournamentId>(
      service.path('leagues', leagueId, 'tournamentId'),
    )
    if (tournamentId === undefined) return new Map()
    return tournamentTeams(tournamentId)
  }

  async function tournamentTeams(
    tournamentId: TournamentId,
  ): Promise<Map<string, string>> {
    const [participants, teams] = await Promise.all([
      service.read<Partial<Record<string, TeamId>>>(
        service.path('tournaments', tournamentId, 'participatingPlayers'),
      ),
      service.read<Record<string, Team>>(paths.teams()),
    ])

    const teamOf = new Map<string, string>()
    for (const [playerId, teamId] of Object.entries(participants ?? {})) {
      const short =
        teamId === undefined ? undefined : teams?.[teamId]?.teamShortName
      // Every participant is kept, even one whose team has no record, so this
      // also answers "is this player in the tournament"; '' means no name.
      teamOf.set(playerId, short ?? '')
    }
    return teamOf
  }

  /**
   * **Refuses anything but an existing auction league.** The auction reads all
   * start here, so a regular league's id gets a clear answer rather than a
   * page of absences.
   */
  async function assertAuctionLeague(leagueId: LeagueId): Promise<void> {
    const isAuction = await service.read<boolean>(
      service.path('leagues', leagueId, 'isAuctionEnabled'),
    )
    if (isAuction === undefined) {
      throw new DataLayerError('notFound', 'That league no longer exists.')
    }
    if (!isAuction) {
      throw new DataLayerError('invalid', 'This league holds no auction.')
    }
  }

  /**
   * **The live auction's phase, and nothing else from it.** After an auction
   * the runtime node holds every bid and the whole timeline, and a league card
   * needs one word of it. Absent until the auction is started, which is the
   * normal pre-auction state rather than an error.
   */
  function liveAuctionPhase(
    leagueId: LeagueId,
  ): Promise<AuctionPhase | undefined> {
    return service.read<AuctionPhase>(
      service.path('liveAuctions', leagueId, 'auctionState', 'phase'),
    )
  }

  // -------------------------------------------------------------------------
  // The live auction: helpers for the writes
  // -------------------------------------------------------------------------

  /** A path under a league's live auction. */
  function livePath(leagueId: LeagueId, ...rest: string[]): DbPath {
    return service.path('liveAuctions', leagueId, ...rest)
  }

  /**
   * **Only the current auctioneer runs the auction.** Read per request from
   * `auctionDetails/primaryAuctioneer`, so a handover takes effect on the next
   * call with nothing cached to go stale.
   */
  async function assertAuctioneer(leagueId: LeagueId): Promise<void> {
    await assertAuctionLeague(leagueId)
    const session = requireSession()
    const auctioneer = await service.read<UserId>(
      auctionDetailsPath(leagueId, 'primaryAuctioneer'),
    )
    if (auctioneer !== session.uid) {
      throw new DataLayerError(
        'notAuctioneer',
        'Only the auctioneer can run the auction.',
      )
    }
  }

  /** The live state, refusing an auction that has not been started. */
  async function liveState(leagueId: LeagueId): Promise<AuctionState> {
    const state = await service.read<AuctionState>(
      livePath(leagueId, 'auctionState'),
    )
    if (state === undefined) {
      throw new DataLayerError('auctionState', 'The auction has not started.')
    }
    return state
  }

  /**
   * **Between rounds**: nothing is being bid on, so the batch may move and a
   * player may go up. A round in progress has to be sold or marked unsold
   * first.
   */
  const BETWEEN_ROUNDS: readonly AuctionPhase[] = [
    'notStarted',
    'betweenPlayers',
    'sold',
    'unsold',
  ]

  function assertPhase(
    state: AuctionState,
    allowed: readonly AuctionPhase[],
    message: string,
  ): void {
    if (!allowed.includes(state.phase)) {
      throw new DataLayerError('auctionState', message)
    }
  }

  /** The player up, refusing when it is not the one named. */
  function assertCurrent(state: AuctionState, playerId: PlayerId): void {
    if (state.currentPlayerId !== playerId) {
      throw new DataLayerError(
        'auctionState',
        'That player is not the one up right now.',
      )
    }
  }

  /**
   * **One timeline entry, as paths.** Id plus data, never a sentence, stamped
   * with this service's clock. Display only: nothing reads it to decide
   * anything.
   */
  function timelineEntry<Id extends TimelineEventId>(
    leagueId: LeagueId,
    timelineEventId: Id,
    timelineEventData: TimelineEventData[Id],
  ): Record<string, unknown> {
    const key = service.generateKey()
    return {
      [livePath(leagueId, 'timeline', key)]: {
        timelineMessageId: key,
        timelineEventId,
        timelineEventData,
        timestamp: Date.now(),
      },
    }
  }

  /** Prices move in steps of 0.5, so a bid must sit on that grid. */
  function assertPriceGrid(amount: unknown): asserts amount is number {
    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isInteger(amount * 2)
    ) {
      throw new DataLayerError(
        'invalid',
        'A price is above zero, in steps of 0.5.',
      )
    }
  }

  /**
   * **Whether this manager may take a player at this price**: still a manager,
   * the budget covers it (it may not go below zero), and the squad has room.
   * The squad's makeup is deliberately not checked — an illegal squad is the
   * manager's to choose.
   */
  async function assertCanBuy(
    leagueId: LeagueId,
    managerId: UserId,
    amount: number,
  ): Promise<void> {
    const [roles, status, maxSquadSize] = await Promise.all([
      service.read<LeagueMember['leagueRoles']>(
        service.path(
          'leagues',
          leagueId,
          'leagueMembers',
          managerId,
          'leagueRoles',
        ),
      ),
      service.read<ManagerAuctionStatus>(
        livePath(leagueId, 'managerStatus', managerId),
      ),
      service.read<number>(
        auctionDetailsPath(leagueId, 'auctionConfig', 'maxSquadSize'),
      ),
    ])
    if (roles?.manager !== true) {
      throw new DataLayerError('notAManager', 'That person is not bidding.')
    }
    if ((status?.budget ?? 0) < amount) {
      throw new DataLayerError('auctionState', 'Not enough budget for that.')
    }
    if (
      maxSquadSize !== undefined &&
      Object.keys(status?.playerList ?? {}).length >= maxSquadSize
    ) {
      throw new DataLayerError('auctionState', 'That squad is already full.')
    }
  }

  /** Whether a manager has passed on this round, by either record. */
  function hasPassed(
    round: AcceptedBidsForPlayer | undefined,
    submittedNoBids: Partial<Record<string, true>> | undefined,
    managerId: UserId,
  ): boolean {
    return (
      submittedNoBids?.[managerId] === true ||
      Object.values(round?.noBids ?? {}).some((p) => p.managerId === managerId)
    )
  }

  /**
   * **A sale, as paths — the whole of it in one atomic update.** The player's
   * status, the buyer's budget and holdings, the bid history with the winning
   * bid marked, the round closed, the timeline — and **the buyer's squad for
   * every match**, written now rather than when the auction ends, so squads
   * are right at every point during it. Stored densely: the same list in every
   * match until a transfer changes it.
   */
  async function saleUpdate(
    leagueId: LeagueId,
    playerId: PlayerId,
    managerId: UserId,
    amount: number,
    winningBid: Bid,
    /** The timeline entry, when the sale is not announced as `sold`. */
    announcement?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const tournamentId = await service.read<TournamentId>(
      service.path('leagues', leagueId, 'tournamentId'),
    )
    if (tournamentId === undefined) {
      throw new DataLayerError('notFound', 'That league no longer exists.')
    }
    const [budget, matches, squads] = await Promise.all([
      service.read<number>(
        livePath(leagueId, 'managerStatus', managerId, 'budget'),
      ),
      service.read<Record<string, Match>>(
        paths.tournamentMatches(tournamentId),
      ),
      service.read<Record<string, PlayerId[]>>(
        service.path('squads', leagueId, managerId),
      ),
    ])

    const update: Record<string, unknown> = {
      [livePath(leagueId, 'playerStatus', playerId)]: {
        playerId,
        status: 'Sold',
        managerId,
        winningBid: amount,
      },
      [livePath(leagueId, 'managerStatus', managerId, 'budget')]:
        (budget ?? 0) - amount,
      [livePath(leagueId, 'managerStatus', managerId, 'playerList', playerId)]:
        amount,
      [livePath(leagueId, 'playerWiseBiddingHistory', playerId, 'status')]:
        'Sold',
      [livePath(
        leagueId,
        'playerWiseBiddingHistory',
        playerId,
        'bids',
        winningBid.bidId,
      )]: { ...winningBid, sold: true },
      [livePath(leagueId, 'auctionState', 'phase')]: 'sold',
      [livePath(leagueId, 'currentSubmittedBids', 'takingBids')]: false,
      [livePath(leagueId, 'currentAcceptedBids', 'takingBids')]: false,
      ...(announcement ??
        timelineEntry(leagueId, 'sold', {
          playerId,
          winningBid: amount,
          managerId,
        })),
    }

    for (const matchId of Object.keys(matches ?? {})) {
      const squad = squads?.[matchId] ?? []
      if (!squad.includes(playerId)) {
        update[service.path('squads', leagueId, managerId, matchId)] = [
          ...squad,
          playerId,
        ]
      }
    }

    return update
  }

  /**
   * **Who in the current batch may still go up**: matching its category and
   * role, and neither sold nor marked unsold. Refuses outside a bidding batch
   * and mid-round.
   */
  async function eligibleInBatch(
    leagueId: LeagueId,
    state: AuctionState,
  ): Promise<PlayerId[]> {
    assertPhase(state, BETWEEN_ROUNDS, 'Finish this round first.')
    const batch = state.currentBatch
    if (batch === undefined || batch.kind !== 'auction') {
      throw new DataLayerError('auctionState', 'Choose a bidding batch first.')
    }
    const [details, statuses, players] = await Promise.all([
      service.read<Record<string, LeaguePlayerAuctionDetail>>(
        auctionDetailsPath(leagueId, 'auctionConfig', 'playerDetails'),
      ),
      service.read<Partial<Record<string, PlayerStatus>>>(
        livePath(leagueId, 'playerStatus'),
      ),
      service.read<Record<string, Player>>(paths.players()),
    ])
    return Object.entries(details ?? {})
      .filter(
        ([playerId, detail]) =>
          detail.playerCategory === batch.playerCategory &&
          players?.[playerId]?.playerRole === batch.playerRole &&
          statuses?.[playerId]?.status !== 'Sold' &&
          statuses?.[playerId]?.status !== 'Unsold',
      )
      .map(([playerId]) => playerId as PlayerId)
  }

  /**
   * **Puts a player up**, before bidding opens. The previous player's round
   * is cleared — keyed per player, so nothing of it can leak into the next —
   * and kept only as the last player, for the headline.
   */
  async function putUp(
    leagueId: LeagueId,
    state: AuctionState,
    playerId: PlayerId,
  ): Promise<void> {
    const previous = state.currentPlayerId
    await service.update({
      ...(previous === undefined || previous === playerId
        ? {}
        : {
            [livePath(leagueId, 'currentSubmittedBids', previous)]: null,
            [livePath(leagueId, 'currentAcceptedBids', previous)]: null,
            [livePath(leagueId, 'auctionState', 'lastPlayerId')]: previous,
          }),
      [livePath(leagueId, 'auctionState', 'currentPlayerId')]: playerId,
      [livePath(leagueId, 'auctionState', 'phase')]: 'betweenPlayers',
      [livePath(leagueId, 'currentSubmittedBids', 'currentPlayer')]: playerId,
      [livePath(leagueId, 'currentSubmittedBids', 'takingBids')]: false,
      [livePath(leagueId, 'currentAcceptedBids', 'currentPlayer')]: playerId,
      [livePath(leagueId, 'currentAcceptedBids', 'takingBids')]: false,
    })
  }

  /**
   * **The draft pool, priced**: every General player not yet sold, plus
   * everyone left unsold from the bidding batches, each at their base price.
   */
  async function draftPoolPrices(
    leagueId: LeagueId,
  ): Promise<Map<string, number>> {
    const [details, statuses] = await Promise.all([
      service.read<Record<string, LeaguePlayerAuctionDetail>>(
        auctionDetailsPath(leagueId, 'auctionConfig', 'playerDetails'),
      ),
      service.read<Partial<Record<string, PlayerStatus>>>(
        livePath(leagueId, 'playerStatus'),
      ),
    ])
    const prices = new Map<string, number>()
    for (const [playerId, detail] of Object.entries(details ?? {})) {
      const status = statuses?.[playerId]?.status
      if (
        status === 'Unsold' ||
        (status !== 'Sold' && detail.playerCategory === 'general')
      ) {
        prices.set(playerId, detail.playerBasePrice)
      }
    }
    return prices
  }

  /** The live state, refusing outside the draft. */
  async function draftState(leagueId: LeagueId): Promise<AuctionState> {
    const state = await liveState(leagueId)
    if (state.currentBatch?.kind !== 'draft') {
      throw new DataLayerError(
        'auctionState',
        'The draft has not been reached.',
      )
    }
    return state
  }

  /** A path under a league's auction details. Never read the node whole. */
  function auctionDetailsPath(leagueId: LeagueId, ...rest: string[]): DbPath {
    return service.path('leagues', leagueId, 'auctionDetails', ...rest)
  }

  function withTeam(player: Player, teamOf: Map<string, string>): Player {
    const teamShortName = teamOf.get(player.playerId)
    return teamShortName === undefined || teamShortName === ''
      ? player
      : { ...player, teamShortName }
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
    /** Keyed by the tournament's round id, which is how they are stored. */
    rounds: Record<string, RoundConfig>
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
      throw new DataLayerError('notFound', 'That league no longer exists.')
    }

    const stored = await service.read<Record<string, Match>>(
      paths.tournamentMatches(tournamentId),
    )

    return {
      tournamentId,
      matches: Object.values(stored ?? {}).sort(
        (a, b) => a.matchNumber - b.matchNumber,
      ),
      rounds: roundConfigs ?? {},
      offset: offset ?? 0,
    }
  }

  /** A manager's stored team for a match, resolved. No visibility check. */
  async function readMatchTeam(
    leagueId: LeagueId,
    userId: UserId,
    matchId: MatchId,
  ): Promise<MatchLineup | undefined> {
    const stored = await service.read<StoredLineup>(
      service.path('matchBasedLineups', leagueId, userId, matchId),
    )
    if (stored === undefined) return undefined

    return {
      ...stored,
      lineup: await resolvePlayers(stored.lineup, leagueId),
    }
  }

  /** A manager's stored team for a gameweek, resolved. No visibility check. */
  async function readGameWeekTeam(
    leagueId: LeagueId,
    userId: UserId,
    gameWeekId: GameWeekId,
  ): Promise<GameWeekLineup | undefined> {
    const stored = await service.read<StoredGameWeekLineup>(
      service.path('gameWeekBasedLineups', leagueId, userId, gameWeekId),
    )
    if (stored === undefined) return undefined

    const [startingLineup, postImpactSubLineup] = await Promise.all([
      resolvePlayers(stored.startingLineup, leagueId),
      stored.postImpactSubLineup === undefined
        ? undefined
        : resolvePlayers(stored.postImpactSubLineup, leagueId),
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
  }

  /**
   * **The owner or an admin**, per `03-roles.md`. The owner is checked by the
   * league's `leagueOwner` as well as the role, since that field is the
   * authority on who owns it.
   */
  async function assertLeagueAdmin(leagueId: LeagueId): Promise<void> {
    const session = requireSession()

    const [owner, roles] = await Promise.all([
      service.read<UserId>(service.path('leagues', leagueId, 'leagueOwner')),
      service.read<LeagueMember['leagueRoles']>(
        service.path(
          'leagues',
          leagueId,
          'leagueMembers',
          session.uid,
          'leagueRoles',
        ),
      ),
    ])

    if (
      owner !== session.uid &&
      roles?.leagueOwner !== true &&
      roles?.leagueAdmin !== true
    ) {
      throw new DataLayerError(
        'notLeagueAdmin',
        'Only the league owner or an admin can do that.',
      )
    }
  }

  /**
   * **The next moment a team locks**, which moves on as deadlines pass.
   *
   * A match-based league locks at every match, so it is the first match, by
   * `matchNumber`, whose deadline is still ahead. A gameweek league locks only
   * at each gameweek's first match, so matches inside a gameweek are not
   * deadlines and are passed over.
   *
   * **Absent when nothing is left, or when the next one is undated.** An
   * undated match is not skipped in favour of a later dated one: that would
   * show a deadline that is not the next one. Deadlines come from the scheduled
   * start and never shift with delays.
   */
  async function upcomingDeadline(
    leagueId: LeagueId,
    isGameWeeks: boolean,
  ): Promise<number | undefined> {
    const { matches, offset } = await leagueFixtures(leagueId)

    const lockers = isGameWeeks
      ? (await api.getGameWeeks(leagueId))
          .map((week) => matches.find((m) => m.matchId === week.matchIds[0]))
          .filter((m): m is Match => m !== undefined)
      : matches

    const now = Date.now()
    const next = lockers.find(
      (m) => m.startTimestamp === undefined || m.startTimestamp - offset > now,
    )

    return next?.startTimestamp === undefined
      ? undefined
      : next.startTimestamp - offset
  }

  // -------------------------------------------------------------------------
  // Scoring
  // -------------------------------------------------------------------------

  /** Fixed, and the vice-captain is never promoted when the captain does not play. */
  const CAPTAIN_MULTIPLIER = 2
  const VICE_CAPTAIN_MULTIPLIER = 1.5

  /**
   * Everything a score is computed from, for one league.
   *
   * **Read once per call and never kept.** A loader returns this, the caller
   * computes from it and returns numbers, and nothing else holds a reference,
   * so it is garbage the moment the call resolves. There is deliberately no
   * cache: a points correction must show on the next read, and a stale cache
   * is exactly the kind of drift that storing totals was rejected for.
   */
  interface Scoring {
    /** In `matchNumber` order. */
    matches: Match[]
    offset: number
    isGameWeeks: boolean
    /** Empty in a match-based league. */
    weeks: LeagueGameWeek[]
    /** Match-major, for the whole tournament or league, in one read. */
    points: Partial<Record<MatchId, PlayerPoints>>
    /** Per manager, keyed by match or by gameweek according to the league. */
    lineups: Partial<
      Record<UserId, Record<string, StoredLineup | StoredGameWeekLineup>>
    >
    members: Partial<Record<UserId, LeagueMember>>
    watermark: ScoringWatermark
  }

  /**
   * **Three subtree reads, not one per manager**: the league's lineups, the
   * points node, and its members. `only` narrows the lineups and members to one
   * manager, for the single-manager reads.
   */
  async function loadScoring(
    leagueId: LeagueId,
    only?: UserId,
  ): Promise<Scoring> {
    const [fixtures, isCustom, isGameWeeks] = await Promise.all([
      leagueFixtures(leagueId),
      service.read<boolean>(
        service.path('leagues', leagueId, 'isCustomScoringSystem'),
      ),
      service.read<boolean>(
        service.path('leagues', leagueId, 'isGameWeeksEnabled'),
      ),
    ])

    const node =
      isGameWeeks === true ? 'gameWeekBasedLineups' : 'matchBasedLineups'

    const [points, lineups, members, weeks, tillId] = await Promise.all([
      service.read<Scoring['points']>(
        isCustom === true
          ? paths.customPointsByMatch(leagueId)
          : paths.standardPointsByMatch(fixtures.tournamentId),
      ),
      only === undefined
        ? service.read<Scoring['lineups']>(service.path(node, leagueId))
        : service
            .read<Record<string, StoredLineup | StoredGameWeekLineup>>(
              service.path(node, leagueId, only),
            )
            .then((mine) => (mine === undefined ? {} : { [only]: mine })),
      only === undefined
        ? service.read<Scoring['members']>(paths.leagueMembers(leagueId))
        : service
            .read<LeagueMember>(paths.leagueMembers(leagueId, only))
            .then((member) => (member === undefined ? {} : { [only]: member })),
      isGameWeeks === true ? api.getGameWeeks(leagueId) : Promise.resolve([]),
      isCustom === true
        ? Promise.resolve(undefined)
        : service.read<MatchId>(
            service.path(
              'tournaments',
              fixtures.tournamentId,
              'pointsUpdatedTillMatchId',
            ),
          ),
    ])

    return {
      matches: fixtures.matches,
      offset: fixtures.offset,
      isGameWeeks: isGameWeeks === true,
      weeks,
      points: points ?? {},
      lineups: lineups ?? {},
      members: members ?? {},
      watermark: watermarkOf(
        fixtures.matches,
        isCustom === true,
        tillId,
        points,
      ),
    }
  }

  /**
   * Standard scoring has a marker written with the points. Custom scoring has
   * none yet, so it is the furthest match with anything entered.
   */
  function watermarkOf(
    matches: readonly Match[],
    isCustom: boolean,
    tillId: MatchId | undefined,
    points: Scoring['points'] | undefined,
  ): ScoringWatermark {
    if (!isCustom) return matches.find((m) => m.matchId === tillId)

    return [...matches]
      .reverse()
      .find((m) => Object.keys(points?.[m.matchId] ?? {}).length > 0)
  }

  /**
   * The eleven a manager fielded in one match. A gameweek league uses that
   * gameweek's team, switching to the post-sub eleven from the impact sub's
   * match onward.
   */
  function elevenFor(
    scoring: Scoring,
    userId: UserId,
    match: Match,
  ): StoredLineup | undefined {
    const mine = scoring.lineups[userId]
    if (mine === undefined) return undefined

    if (!scoring.isGameWeeks) {
      return mine[match.matchId] as StoredLineup | undefined
    }

    const week = scoring.weeks.find((w) => w.matchIds.includes(match.matchId))
    const stored =
      week === undefined
        ? undefined
        : (mine[week.gameWeek.gameWeekId] as StoredGameWeekLineup | undefined)
    if (stored === undefined) return undefined

    const from = scoring.matches.find(
      (m) => m.matchId === stored.impactSub?.applicableFromMatch,
    )
    const subbed =
      stored.postImpactSubLineup !== undefined &&
      from !== undefined &&
      match.matchNumber >= from.matchNumber

    return {
      lineup: subbed
        ? (stored.postImpactSubLineup ?? stored.startingLineup)
        : stored.startingLineup,
      captainId: stored.captainId,
      viceCaptainId: stored.viceCaptainId,
    }
  }

  /** No team, or no points for the match, scores zero. */
  function matchScore(scoring: Scoring, userId: UserId, match: Match): number {
    const eleven = elevenFor(scoring, userId, match)
    if (eleven === undefined) return 0

    const points = scoring.points[match.matchId] ?? {}

    return eleven.lineup.reduce((sum, playerId) => {
      const multiplier =
        playerId === eleven.captainId
          ? CAPTAIN_MULTIPLIER
          : playerId === eleven.viceCaptainId
            ? VICE_CAPTAIN_MULTIPLIER
            : 1
      return sum + (points[playerId] ?? 0) * multiplier
    }, 0)
  }

  function weekScore(
    scoring: Scoring,
    userId: UserId,
    week: LeagueGameWeek,
  ): number {
    return scoring.matches
      .filter((m) => week.matchIds.includes(m.matchId))
      .reduce((sum, match) => sum + matchScore(scoring, userId, match), 0)
  }

  /** Every match, plus the transfer adjustment, which is absent outside auctions. */
  function leagueScore(scoring: Scoring, userId: UserId): number {
    return (
      scoring.matches.reduce(
        (sum, match) => sum + matchScore(scoring, userId, match),
        0,
      ) + (scoring.members[userId]?.pointsAdjustment ?? 0)
    )
  }

  function isLocked(match: Match | undefined, offset: number): boolean {
    return (
      match?.startTimestamp !== undefined &&
      match.startTimestamp - offset <= Date.now()
    )
  }

  function isScored(scoring: Scoring, match: Match | undefined): boolean {
    return (
      match !== undefined &&
      scoring.watermark !== undefined &&
      match.matchNumber <= scoring.watermark.matchNumber
    )
  }

  /**
   * **Managers only**, so an owner who does not play, a spectator and a banned
   * member are all absent. Highest first, then by name; a tie shares a rank and
   * the next rank skips by the number tied — 1, 2, 2, 4.
   */
  async function rank(
    scoring: Scoring,
    scoreOf: (userId: UserId) => number,
  ): Promise<LeaderboardRow[]> {
    const managers = Object.entries(scoring.members).filter(
      ([, member]) => member?.leagueRoles?.manager === true,
    ) as [UserId, LeagueMember][]

    const names = await Promise.all(
      managers.map(([userId]) =>
        service.read<string>(service.path('users', userId, 'userName')),
      ),
    )

    const unranked = managers.map(([userId, member], index) => ({
      managerId: userId,
      managerName: names[index] ?? 'Unknown',
      ...(member.fantasyTeamName === undefined
        ? {}
        : { fantasyTeamName: member.fantasyTeamName }),
      points: scoreOf(userId),
    }))

    unranked.sort(
      (a, b) =>
        b.points - a.points || a.managerName.localeCompare(b.managerName),
    )

    return unranked.map((row) => ({
      ...row,
      rank: unranked.findIndex((other) => other.points === row.points) + 1,
    }))
  }

  // -------------------------------------------------------------------------
  // The leaderboard cache
  // -------------------------------------------------------------------------

  /** When standard points last changed, overall and per match. */
  interface PointsStamps {
    overall?: number
    matches?: Partial<Record<MatchId, number>>
  }

  /**
   * **A derived copy, thrown away whenever what it came from changes.** Never
   * the source of truth: a scoring correction is still one edited number, and
   * this is rebuilt from it.
   *
   * `basedOn` holds the stamp values it was computed from. It is valid only
   * while both still equal the current ones. **That is an equality check, not a
   * comparison of times**, so a browser clock that runs slow cannot leave a
   * correction looking older than the standings it should have replaced.
   */
  interface StoredLeaderboard {
    /** Absent when nobody is playing, since Firebase does not keep an empty list. */
    rows?: LeaderboardRow[]
    /** A match's own number, or a gameweek's first. Absent for the overall. */
    firstMatchNumber?: number
    /** A gameweek's matches, which is what its points stamp is taken over. */
    matchIds?: MatchId[]
    basedOn: { points: number; members: number }
    leaderboardComputedAt: number
  }

  interface Computed {
    rows: LeaderboardRow[]
    isScored: boolean
    firstMatchNumber?: number
    matchIds?: readonly MatchId[]
  }

  /**
   * **Serves a stored leaderboard when it is still valid, and otherwise computes
   * it, stores it and returns that.**
   *
   * A hit reads three small stamps and the stored rows, and nothing else: no
   * lineups, no points, no names. The stamps are read **before** computing and
   * are what gets stored, so a correction that lands mid-compute leaves the
   * result already out of date rather than quietly current. Two people
   * computing at once write the same thing, so no transaction is needed.
   *
   * **The locked-period gate lives in `compute`**, which a hit skips. A stored
   * period can only exist if it was locked when computed.
   *
   * **A custom-scoring league is not cached yet.** Its points are entered per
   * league, and that entry does not exist to stamp them.
   */
  async function serveLeaderboard(
    leagueId: LeagueId,
    slot: readonly string[],
    stampOf: (
      stamps: PointsStamps | undefined,
      matchIds: readonly MatchId[] | undefined,
    ) => number,
    compute: (scoring: Scoring) => Promise<Computed>,
  ): Promise<PeriodLeaderboard> {
    const [isCustom, tournamentId] = await Promise.all([
      service.read<boolean>(
        service.path('leagues', leagueId, 'isCustomScoringSystem'),
      ),
      service.read<TournamentId>(
        service.path('leagues', leagueId, 'tournamentId'),
      ),
    ])

    if (isCustom === true || tournamentId === undefined) {
      const live = await compute(await loadScoring(leagueId))
      return { rows: live.rows, isScored: live.isScored }
    }

    const at = service.path('leaderboards', leagueId, ...slot)

    // The marker's match number, only for a period: whether it has been scored
    // depends on how far scoring has got, which moves without touching it.
    const watermark =
      slot[0] === 'main'
        ? Promise.resolve(undefined)
        : service
            .read<MatchId>(
              service.path(
                'tournaments',
                tournamentId,
                'pointsUpdatedTillMatchId',
              ),
            )
            .then((tillId) =>
              tillId === undefined
                ? undefined
                : service.read<number>(
                    service.path(
                      'tournaments',
                      tournamentId,
                      'matches',
                      tillId,
                      'matchNumber',
                    ),
                  ),
            )

    const [stamps, membersStamp, cached, watermarkNumber] = await Promise.all([
      service.read<PointsStamps>(paths.standardPointsUpdatedAt(tournamentId)),
      service.read<number>(
        service.path('leaderboards', leagueId, 'membersUpdatedAt'),
      ),
      service.read<StoredLeaderboard>(at),
      watermark,
    ])
    const members = membersStamp ?? 0

    if (
      cached !== undefined &&
      cached.basedOn.points === stampOf(stamps, cached.matchIds) &&
      cached.basedOn.members === members
    ) {
      return {
        rows: cached.rows ?? [],
        isScored:
          cached.firstMatchNumber === undefined ||
          (watermarkNumber !== undefined &&
            cached.firstMatchNumber <= watermarkNumber),
      }
    }

    const computed = await compute(await loadScoring(leagueId))

    const stored: StoredLeaderboard = {
      rows: computed.rows,
      ...(computed.firstMatchNumber === undefined
        ? {}
        : { firstMatchNumber: computed.firstMatchNumber }),
      ...(computed.matchIds === undefined
        ? {}
        : { matchIds: [...computed.matchIds] }),
      basedOn: { points: stampOf(stamps, computed.matchIds), members },
      leaderboardComputedAt: Date.now(),
    }
    await service.write(at, stored)

    return { rows: computed.rows, isScored: computed.isScored }
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
        'notAManager',
        'You are not playing in this league. Join it as a manager first.',
      )
    }
  }

  /**
   * **System admins only**, the same rule the interface uses to show the page:
   * `systemAdmin` or `systemOwner`. Checked here because hiding a button is
   * convenience and anyone can write to the database with the client SDK.
   */
  /**
   * **Asks rather than refuses**, for the reads that show an admin more
   * instead of turning everyone else away.
   */
  async function isSystemAdmin(): Promise<boolean> {
    if (session === undefined) return false

    const roles = await service.read<User['systemUserRoles']>(
      service.path('users', session.uid, 'systemUserRoles'),
    )
    return roles?.systemAdmin === true || roles?.systemOwner === true
  }

  async function assertSystemAdmin(): Promise<void> {
    const session = requireSession()

    const roles = await service.read<User['systemUserRoles']>(
      service.path('users', session.uid, 'systemUserRoles'),
    )

    if (roles?.systemAdmin !== true && roles?.systemOwner !== true) {
      throw new DataLayerError(
        'notSystemAdmin',
        'Only a system admin can do that.',
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
        'illegalLineup',
        `A team is eleven players. This one has ${lineup.length}.`,
      )
    }

    const ids = new Set(lineup.map((player) => player.playerId))
    if (ids.size !== 11) {
      throw new DataLayerError(
        'illegalLineup',
        'The same player cannot be picked twice.',
      )
    }
    if (!ids.has(captainId) || !ids.has(viceCaptainId)) {
      throw new DataLayerError(
        'illegalLineup',
        'The captain and vice-captain must both be in the eleven.',
      )
    }
    if (captainId === viceCaptainId) {
      throw new DataLayerError(
        'illegalLineup',
        'The captain and vice-captain cannot be the same player.',
      )
    }

    const rules = await api.getLineupRules(leagueId)

    for (const [role, rule] of Object.entries(rules)) {
      if (rule === undefined) continue
      const count = lineup.filter((p) => p.playerRole === role).length

      if (count < rule.min) {
        throw new DataLayerError(
          'illegalLineup',
          `This league needs at least ${rule.min} of role ${role}. You have ${count}.`,
        )
      }
      // Absent means no upper limit.
      if (rule.max !== undefined && count > rule.max) {
        throw new DataLayerError(
          'illegalLineup',
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

    async createCompetition(config: CompetitionConfig): Promise<CompetitionId> {
      await assertSystemAdmin()

      const competitionName = await uniqueCompetitionName(
        config.competitionName,
      )
      assertFormat(config.formatId)
      const homeNation = config.homeNation?.trim() ?? ''

      const competitionId = service.generateKey() as CompetitionId

      await service.write(paths.competitions(competitionId), {
        competitionId,
        competitionName,
        formatId: config.formatId,
        // Absent is how "no notion of overseas" is spelled.
        ...(homeNation === '' ? {} : { homeNation }),
      } satisfies Competition)

      return competitionId
    },

    /**
     * **Changing the format does not reach existing tournaments' matches**, and
     * nothing here pretends otherwise: a tournament reads its format through the
     * competition, so it follows. The home nation does not, because each
     * tournament froze its own copy when it was created.
     */
    async updateCompetition(
      competitionId: CompetitionId,
      changes: Partial<CompetitionConfig>,
    ): Promise<void> {
      await assertSystemAdmin()

      const existing = await service.read<Competition>(
        paths.competitions(competitionId),
      )
      if (existing === undefined) {
        throw new DataLayerError('notFound', 'No such base tournament.')
      }

      const update: Record<string, unknown> = {}
      const at = (field: string) =>
        service.path('competitions', competitionId, field)

      if (changes.competitionName !== undefined) {
        update[at('competitionName')] = await uniqueCompetitionName(
          changes.competitionName,
          competitionId,
        )
      }
      if (changes.formatId !== undefined) {
        assertFormat(changes.formatId)
        update[at('formatId')] = changes.formatId
      }
      if (changes.homeNation !== undefined) {
        const homeNation = changes.homeNation.trim()
        // Null deletes the key, which is what clearing it means.
        update[at('homeNation')] = homeNation === '' ? null : homeNation
      }

      if (Object.keys(update).length === 0) return
      await service.update(update)
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
      await assertSystemAdmin()

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
      await assertSystemAdmin()

      const team = await service.read<Team>(paths.teams(teamId))
      if (team === undefined) {
        throw new DataLayerError('notFound', `firebase: no team ${teamId}`)
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
    /**
     * **Carries each player's standard auction values**, from one extra read of
     * `standardAuctionConfig/playerDetails`, so the admin's player dialog can
     * show and edit them. Players created before they were required have none.
     */
    async getPlayers(filter?: PlayerFilter): Promise<Player[]> {
      const [all, auctionDetails] = await Promise.all([
        service.read<Record<string, Player>>(paths.players()),
        service.read<Record<string, LeaguePlayerAuctionDetail>>(
          paths.standardPlayerAuctionDetails(),
        ),
      ])
      let players = Object.values(all ?? {}).map((player) => {
        const detail = auctionDetails?.[player.playerId]
        return detail === undefined ? player : { ...player, ...detail }
      })

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
     *
     * **Every row is checked before anything is written**, including the
     * category and base price, which land in `standardAuctionConfig` in the
     * same update. One bad row refuses the whole batch rather than saving the
     * rest and leaving the admin to work out which were missed.
     */
    async createPlayers(
      players: readonly PlayerConfig[],
    ): Promise<CreatePlayersResult> {
      await assertSystemAdmin()

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
        const playerName = (config.playerName ?? '').trim()
        if (playerName === '') {
          throw new DataLayerError('invalid', 'Every player needs a name.')
        }
        if ((config.country ?? '').trim() === '') {
          throw new DataLayerError('invalid', `${playerName} needs a country.`)
        }
        if (!(PLAYER_ROLES as readonly unknown[]).includes(config.playerRole)) {
          throw new DataLayerError('invalid', `${playerName} needs a role.`)
        }
        const auctionDetail = auctionDetailFor(
          playerName,
          config.playerCategory,
          config.playerBasePrice,
        )

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
        update[paths.standardPlayerAuctionDetails(playerId)] = auctionDetail

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
      await assertSystemAdmin()

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

      // The two auction values are one record, so either changing rewrites it
      // whole — merged with what is stored, since a player created before they
      // were required has nothing to merge with and must be given both.
      if (
        changes.playerCategory !== undefined ||
        changes.playerBasePrice !== undefined
      ) {
        const stored = await service.read<LeaguePlayerAuctionDetail>(
          paths.standardPlayerAuctionDetails(playerId),
        )
        update[paths.standardPlayerAuctionDetails(playerId)] = auctionDetailFor(
          changes.playerName?.trim() || 'This player',
          changes.playerCategory ?? stored?.playerCategory,
          changes.playerBasePrice ?? stored?.playerBasePrice,
        )
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
      await assertSystemAdmin()

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
      await assertSystemAdmin()

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
      await assertSystemAdmin()

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

      /*
        **A draft belongs to whoever is building it.** The flag comes from the
        caller, so it cannot be the thing that decides: an unpublished
        tournament carries unannounced fixtures, squads and dates, and
        `08-pages/tournaments.md` says it is invisible until published.
        Dropped rather than refused, so the tournaments page keeps working
        for everyone and the admin panel sees more.
      */
      if (filter?.includeUnpublished !== true || !(await isSystemAdmin())) {
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
          'notFound',
          `No tournament with id ${tournamentId}.`,
        )
      }

      // Knowing the id is not permission to read a draft.
      if (tournament.publishedAt === undefined) await assertSystemAdmin()

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
        throw new DataLayerError('invalid', 'Pick a team name first.')
      }

      const [league, banned] = await Promise.all([
        service.read<League>(paths.leagues(leagueId)),
        service.read<BannedUser>(paths.bannedUsers(leagueId, userId)),
      ])

      if (league === undefined) {
        throw new DataLayerError('banned', 'That league no longer exists.')
      }
      if (banned !== undefined) {
        throw new DataLayerError(
          'banned',
          'You are banned from this league and cannot rejoin it.',
        )
      }
      if (league.leagueEntry !== 'Open') {
        throw new DataLayerError(
          'joinDeadlinePassed',
          'This league is closed, so joining needs its admin to approve you. Requesting to join is not built yet.',
        )
      }
      if (Date.now() > league.fantasyLeagueJoinDeadline) {
        throw new DataLayerError(
          'alreadyMember',
          'The deadline to join this league has passed.',
        )
      }

      /*
        **Joining closes when the auction starts**, even before the scheduled
        time. A manager arriving mid-auction would have no budget and no draft
        seat, and would be bidding against squads already half built.
      */
      if (
        league.isAuctionEnabled &&
        (await liveAuctionPhase(leagueId)) !== undefined
      ) {
        throw new DataLayerError(
          'joinDeadlinePassed',
          'The auction has started, so joining has closed.',
        )
      }

      const members = league.leagueMembers ?? {}
      const mine = members[userId]

      if (mine?.leagueRoles?.manager === true) {
        throw new DataLayerError(
          'alreadyMember',
          'You are already playing in this league.',
        )
      }

      const filled = Object.values(members).filter(
        (member) => member.leagueRoles?.manager === true,
      ).length

      if (filled >= league.maxSlots) {
        throw new DataLayerError('leagueFull', 'This league is full.')
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

      const membership: Record<string, unknown> = {
        /*
          **Leaf paths on the membership, deliberately.** Writing the member
          object whole would erase `leagueOwner` and `leagueAdmin` from anyone
          joining a league they run — which is every official league.
        */
        [paths.leagueMembers(leagueId, userId) + '/fantasyTeamName']: teamName,
        [paths.leagueMembers(leagueId, userId) + '/leagueRoles/manager']: true,

        // Stored standings list who is in the league, so this retires them.
        [service.path('leaderboards', leagueId, 'membersUpdatedAt')]:
          Date.now(),

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
      }

      // Before the membership, so a league with no position left refuses the
      // join rather than admitting a manager the draft has no seat for.
      const claimedPosition = league.isAuctionEnabled
        ? await claimDraftPosition(league, userId)
        : undefined

      try {
        await service.update(membership)
      } catch (error) {
        // A failed join must not keep a seat in the draft.
        if (claimedPosition !== undefined) {
          await service.update({
            [draftPositionPath(leagueId, claimedPosition)]: null,
          })
        }
        throw error
      }
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
      await assertSystemAdmin()

      if (!Number.isInteger(config.matchCount) || config.matchCount < 1) {
        throw new DataLayerError(
          'invalidConfig',
          'A tournament needs at least one match.',
        )
      }

      const competition = await service.read<Competition>(
        paths.competitions(config.competitionId),
      )
      if (competition === undefined) {
        throw new DataLayerError('notFound', 'No such base tournament.')
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
        throw new DataLayerError('invalidConfig', 'A tournament needs a match.')
      }

      await service.write(paths.tournaments(tournamentId), {
        tournamentId,
        tournamentName: config.tournamentName.trim(),
        competitionId: config.competitionId,
        // Copied and frozen, so editing the base tournament later never shifts
        // who is overseas here.
        ...(competition.homeNation === undefined
          ? {}
          : { homeNation: competition.homeNation }),
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
      await assertSystemAdmin()

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
      await assertSystemAdmin()

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
      await assertSystemAdmin()

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
            'notFound',
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
      await assertSystemAdmin()

      if (!Number.isInteger(count) || count < 1) {
        throw new DataLayerError('invalidConfig', 'Add at least one match.')
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
      await assertSystemAdmin()

      if (!Number.isInteger(count) || count < 1) {
        throw new DataLayerError('notFound', 'Remove at least one match.')
      }

      const tournament = await service.read<Tournament>(
        paths.tournaments(tournamentId),
      )
      if (tournament === undefined) {
        throw new DataLayerError('notFound', 'No such tournament.')
      }
      if (tournament.publishedAt !== undefined) {
        throw new DataLayerError(
          'invalidConfig',
          'This tournament is published, so its matches may already have lineups and points against them. Matches can only be removed from a draft.',
        )
      }

      const ordered = Object.values(tournament.matches ?? {}).sort(
        (a, b) => a.matchNumber - b.matchNumber,
      )
      if (count >= ordered.length) {
        throw new DataLayerError(
          'invalidConfig',
          `A tournament needs at least one match, and this one has ${ordered.length}.`,
        )
      }

      const removed = ordered.slice(ordered.length - count)
      const remaining = ordered.slice(0, ordered.length - count)
      const survivor = remaining[remaining.length - 1]
      if (survivor === undefined) {
        throw new DataLayerError('invalidConfig', 'A tournament needs a match.')
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
      await assertSystemAdmin()

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
          'invalidConfig',
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
          throw new DataLayerError('invalidConfig', 'Every round needs a name.')
        }
        if (round.firstMatchNumber !== expected) {
          throw new DataLayerError(
            'invalidConfig',
            `Rounds must cover every match with no gaps or overlaps. Expected a round starting at match ${expected}.`,
          )
        }
        if (round.lastMatchNumber < round.firstMatchNumber) {
          throw new DataLayerError('invalidConfig', 'A round cannot be empty.')
        }
        expected = round.lastMatchNumber + 1
      }

      if (expected !== lastNumber + 1) {
        throw new DataLayerError(
          'invalidConfig',
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
          throw new DataLayerError(
            'invalidConfig',
            'A round names a missing match.',
          )
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
      await assertSystemAdmin()

      const session = requireSession()

      const tournament = await service.read<Tournament>(
        paths.tournaments(tournamentId),
      )
      if (tournament === undefined) {
        throw new DataLayerError('notFound', 'No such tournament.')
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
          'invalidConfig',
          'A tournament cannot be published until at least its first match has a start time.',
        )
      }

      const auction = officialLeagues?.auction
      const wantsLeague =
        officialLeagues?.matchBased === true ||
        officialLeagues?.gameWeekBased === true ||
        auction !== undefined

      if (
        wantsLeague &&
        Object.keys(tournament.participatingPlayers ?? {}).length === 0
      ) {
        throw new DataLayerError(
          'invalidConfig',
          'This tournament has no players, so a league against it would have nobody to pick. Set its teams and players first.',
        )
      }

      /*
        Everything below is checked before anything is claimed or written, so
        a bad input refuses the publish outright rather than half-way through.
        Each gameweek league gets its own call, so no two leagues share a
        gameweek id.
      */
      const roundConfigs =
        officialLeagues?.gameWeekBased === true
          ? gameWeeksFor(tournament, officialLeagues.gameWeekLengths)
          : undefined
      const auctionRoundConfigs =
        auction !== undefined
          ? gameWeeksFor(tournament, officialLeagues?.gameWeekLengths)
          : undefined

      // Squads are won before teams are picked, so the auction has to finish
      // before the first ball. Before the first match is the checkable part.
      const firstMatchStart = Math.min(
        ...dated.map((match) => match.startTimestamp ?? Number.MAX_VALUE),
      )
      if (auction !== undefined) {
        const start = auction.auctionStartTime
        if (typeof start !== 'number' || !Number.isFinite(start)) {
          throw new DataLayerError(
            'invalidConfig',
            'Choose when the auction starts.',
          )
        }
        if (start <= Date.now()) {
          throw new DataLayerError(
            'invalidConfig',
            'The auction has to start in the future.',
          )
        }
        if (start >= firstMatchStart) {
          throw new DataLayerError(
            'invalidConfig',
            'The auction has to start before the first match, so squads are won before teams are picked.',
          )
        }
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

        const common = {
          tournament,
          ownerId: session.uid as UserId,
          ownerName: owner?.userName ?? 'System admin',
          rules,
          offset,
          // No later than the first match's deadline, which is its start
          // minus the offset teams lock by.
          joinDeadline: firstMatchStart - offset,
        }

        if (officialLeagues?.matchBased === true) {
          Object.assign(update, await officialLeague(common, { type: 'match' }))
        }
        if (roundConfigs !== undefined) {
          Object.assign(
            update,
            await officialLeague(common, { type: 'gameWeek', roundConfigs }),
          )
        }
        if (auction !== undefined && auctionRoundConfigs !== undefined) {
          Object.assign(
            update,
            await officialLeague(common, {
              type: 'auction',
              roundConfigs: auctionRoundConfigs,
              auctionConfig: await auctionConfigFor(
                tournament,
                session.uid as UserId,
              ),
              auctionStartTime: auction.auctionStartTime,
            }),
          )
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
        teamAllowance,
        captainAllowance,
        viceCaptainAllowance,
      ] = await Promise.all([
        service.read<string>(at('leagueName')),
        service.read<string>(at('leagueJoinCode')),
        service.read<TournamentId>(at('tournamentId')),
        service.read<boolean>(at('isAuctionEnabled')),
        service.read<boolean>(at('isGameWeeksEnabled')),
        service.read<number>(at('finishedAt')),
        service.read<LeagueMember>(paths.leagueMembers(leagueId, userId)),
        service.read<number>(at('totalChangesAllowed')),
        service.read<number>(at('totalCaptainChangesAllowed')),
        service.read<number>(at('totalViceCaptainChangesAllowed')),
      ])

      if (leagueName === undefined || tournamentId === undefined) {
        throw new DataLayerError('notFound', 'That league no longer exists.')
      }

      const [tournamentName, startDate, offset, auctionPhase, nextDeadline] =
        await Promise.all([
          service.read<string>(
            service.path('tournaments', tournamentId, 'tournamentName'),
          ),
          service.read<number>(
            service.path('tournaments', tournamentId, 'startDate'),
          ),
          service.read<number>(at('fantasyLeagueTeamChangesDeadlineOffset')),
          isAuctionEnabled === true ? liveAuctionPhase(leagueId) : undefined,
          upcomingDeadline(leagueId, isGameWeeksEnabled === true),
        ])

      const phase = derivePhase({
        finishedAt,
        tournamentStartDate: startDate,
        isAuctionEnabled: isAuctionEnabled === true,
        auctionPhase,
        now: Date.now(),
      })

      /*
        **Your place in the overall standings, read from the stored
        leaderboard**, so it costs a few small reads rather than a recompute —
        and a miss here warms the cache for the Leaderboard page.

        Only for a manager, and only once the league is under way: before then
        everyone is on zero and would read as joint first. A failure leaves it
        absent rather than failing the whole header.
      */
      let myRank: number | undefined
      if (
        me?.leagueRoles?.manager === true &&
        (phase === 'active' || phase === 'finished')
      ) {
        try {
          const rows = await api.getLeaderboardForLeague(leagueId)
          myRank = rows.find((row) => row.managerId === userId)?.rank
        } catch {
          myRank = undefined
        }
      }

      return {
        leagueId,
        leagueName,
        leagueJoinCode: leagueJoinCode ?? '',
        phase,
        ...(nextDeadline === undefined ? {} : { nextDeadline }),
        ...(myRank === undefined ? {} : { myRank }),
        deadlineOffset: offset ?? 0,
        changeAllowances: {
          ...(teamAllowance === undefined
            ? {}
            : { teamChanges: teamAllowance }),
          ...(captainAllowance === undefined
            ? {}
            : { captainChanges: captainAllowance }),
          ...(viceCaptainAllowance === undefined
            ? {}
            : { viceCaptainChanges: viceCaptainAllowance }),
        },
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
        throw new DataLayerError(
          'invalidConfig',
          'This tournament has no matches.',
        )
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

    /**
     * **Ordered by `matchNumber`, and resolved the same way.** A gameweek
     * stores a first and last match id, and ids are push keys sorting by
     * creation time rather than fixture order, so membership is worked out by
     * number here rather than left to a caller to get wrong.
     */
    async getGameWeeks(leagueId: LeagueId): Promise<LeagueGameWeek[]> {
      const { tournamentId, matches, rounds } = await leagueFixtures(leagueId)

      const tournamentRounds = await service.read<Record<string, Round>>(
        paths.tournamentRounds(tournamentId),
      )

      const numberOf = (matchId: MatchId) =>
        matches.find((m) => m.matchId === matchId)?.matchNumber ?? 0

      const entries: { roundId: string; week: LeagueGameWeek }[] = []

      for (const [roundId, config] of Object.entries(rounds)) {
        const roundName = tournamentRounds?.[roundId]?.roundName ?? ''

        for (const gameWeek of Object.values(config.gameWeeks ?? {})) {
          const first = numberOf(gameWeek.startMatchId)
          const last = numberOf(gameWeek.endMatchId)

          const spanned = matches.filter(
            (m) => first <= m.matchNumber && m.matchNumber <= last,
          )

          entries.push({
            roundId,
            week: {
              gameWeek,
              roundName,
              matchIds: spanned.map((m) => m.matchId),
              startsAt: spanned[0]?.startTimestamp,
            },
          })
        }
      }

      entries.sort(
        (a, b) =>
          a.week.gameWeek.gameWeekNumber - b.week.gameWeek.gameWeekNumber,
      )

      /*
        **The cap on changes going into each gameweek, from the one before.**

        The first gameweek has nothing before it, so it has no cap. After that,
        a gameweek that opens a new round is limited by that round's "before the
        round starts" allowance, and one inside the same round by its "between
        gameweeks" allowance. Absent in either means unlimited.
      */
      return entries.map(({ roundId, week }, index) => {
        if (index === 0) return week

        const config = rounds[roundId]
        const cap =
          entries[index - 1]?.roundId === roundId
            ? config?.maxNumberOfChangesAllowedBetweenGameWeeks
            : config?.maxNumberOfChangesAllowedBeforeRoundStart

        return cap === undefined ? week : { ...week, changeCap: cap }
      })
    },

    /**
     * **The last saved team before this gameweek, not necessarily the previous
     * one.** A team applies forward until it is changed, so a manager who
     * skipped a gameweek is still fielding what they had, and that is what the
     * next change is measured from.
     *
     * **After an impact sub, the eleven that finished that gameweek.** The sub
     * changes who is in the team from its chosen match onward, and the next
     * gameweek starts from there, not from the starting eleven.
     */
    async getMyTeamBeforeGameWeek(
      leagueId: LeagueId,
      gameWeekId: GameWeekId,
    ): Promise<LineupSubmission | undefined> {
      const session = requireSession()
      const weeks = await api.getGameWeeks(leagueId)

      const index = weeks.findIndex((w) => w.gameWeek.gameWeekId === gameWeekId)
      if (index <= 0) return undefined

      const saved = await service.read<Record<string, StoredGameWeekLineup>>(
        service.path('gameWeekBasedLineups', leagueId, session.uid),
      )

      for (let i = index - 1; i >= 0; i -= 1) {
        const earlier = saved?.[weeks[i]?.gameWeek.gameWeekId ?? '']
        if (earlier === undefined) continue

        const ids = earlier.postImpactSubLineup ?? earlier.startingLineup
        return {
          lineup: await resolvePlayers(ids, leagueId),
          captainId: earlier.captainId,
          viceCaptainId: earlier.viceCaptainId,
        }
      }

      return undefined
    },

    async getFixtures(tournamentId: TournamentId): Promise<Match[]> {
      const stored = await service.read<Record<string, Match>>(
        paths.tournamentMatches(tournamentId),
      )

      return Object.values(stored ?? {}).sort(
        (a, b) => a.matchNumber - b.matchNumber,
      )
    },

    /**
     * **The flag decides the store, and there is no second look.** A
     * custom-scoring league reads its own node only; every other league reads
     * the tournament's. A match nobody has scored comes back empty, which the
     * caller reads as zero — the model treats zero and absent as the same
     * thing, and does not record why a player scored nothing.
     */
    /**
     * **One request, one decision about the store, then one read per match in
     * parallel.** The league's scoring flag and tournament are read once
     * rather than once per match.
     *
     * Read, open to any signed-in caller, like the single call: points are
     * public, and nothing here says who fielded whom.
     */
    async getPlayerPointsForMatches(
      leagueId: LeagueId,
      matchIds: readonly MatchId[],
    ): Promise<MatchPlayerPoints[]> {
      // Validated as unknown: the arguments come off the wire, and the
      // declared type is a hope rather than a guarantee.
      const raw: unknown = matchIds
      if (
        !Array.isArray(raw) ||
        raw.some((id: unknown) => typeof id !== 'string' || id === '')
      ) {
        throw new DataLayerError('invalid', 'Ask for a list of match ids.')
      }
      const ids = raw as MatchId[]

      // A tournament is at most a few dozen matches. Anything far larger is a
      // mistake, and would otherwise be a fan-out of reads on one request.
      if (ids.length > MAX_MATCHES_PER_POINTS_READ) {
        throw new DataLayerError(
          'invalid',
          `Ask for at most ${MAX_MATCHES_PER_POINTS_READ} matches at once.`,
        )
      }
      if (ids.length === 0) return []

      const pathFor = await pointsPathFor(leagueId)
      const perMatch = await Promise.all(
        ids.map((matchId) => service.read<PlayerPoints>(pathFor(matchId))),
      )

      return ids.map((matchId, i) => ({
        matchId,
        points: perMatch[i] ?? {},
      }))
    },

    async getPlayerPointsForMatch(
      leagueId: LeagueId,
      matchId: MatchId,
    ): Promise<PlayerPoints> {
      const pathFor = await pointsPathFor(leagueId)
      return (await service.read<PlayerPoints>(pathFor(matchId))) ?? {}
    },

    /**
     * **Each side is that team's squad in this tournament**, from
     * `participatingTeamPlayers`, not the team's current squad, which can have
     * moved on since. Names come from the whole catalogue, for the same reason
     * as `getSelectablePlayers`.
     */
    async getPlayersForMatch(
      tournamentId: TournamentId,
      matchId: MatchId,
    ): Promise<MatchPlayers> {
      const [match, squads] = await Promise.all([
        service.read<Match>(paths.tournamentMatches(tournamentId, matchId)),
        service.read<Tournament['participatingTeamPlayers']>(
          service.path('tournaments', tournamentId, 'participatingTeamPlayers'),
        ),
      ])

      if (match === undefined) {
        throw new DataLayerError(
          'teamsNotSet',
          'That match is not in this tournament.',
        )
      }

      const { team1Id, team2Id } = match
      if (team1Id === undefined || team2Id === undefined) {
        throw new DataLayerError(
          'teamsNotSet',
          'Set both teams for this match in the fixtures editor first.',
        )
      }

      const [team1, team2, everyone] = await Promise.all([
        service.read<Team>(paths.teams(team1Id)),
        service.read<Team>(paths.teams(team2Id)),
        service.read<Record<string, Player>>(paths.players()),
      ])

      const side = (team: Team | undefined, teamId: TeamId): MatchSide => {
        if (team === undefined) {
          throw new DataLayerError('notFound', `No team with id ${teamId}.`)
        }
        const ids = new Set(Object.keys(squads?.[teamId] ?? {}))
        return {
          team,
          players: Object.values(everyone ?? {})
            .filter((player) => ids.has(player.playerId))
            .sort((a, b) => a.playerName.localeCompare(b.playerName)),
        }
      }

      return { match, sides: [side(team1, team1Id), side(team2, team2Id)] }
    },

    async getStandardPointsForMatch(
      tournamentId: TournamentId,
      matchId: MatchId,
    ): Promise<PlayerPoints> {
      return (
        (await service.read<PlayerPoints>(
          paths.standardPointsByMatch(tournamentId, matchId),
        )) ?? {}
      )
    },

    /**
     * **One atomic update carries all three writes**: the match-major node as
     * a whole, the player-major leaf for every player involved, and the
     * scored-till marker. Any one landing without the others would leave the
     * copies disagreeing with nobody told.
     *
     * **Zero is stored as absent**, which the model treats as the same thing.
     *
     * **The player-major side clears old entries too.** A player scored before
     * and since moved out of either team would otherwise keep a points leaf the
     * match-major copy no longer has.
     */
    async updateStandardPoints(
      tournamentId: TournamentId,
      matchId: MatchId,
      playerPoints: PlayerPoints,
    ): Promise<void> {
      await assertSystemAdmin()

      const { match, sides } = await api.getPlayersForMatch(
        tournamentId,
        matchId,
      )
      const eligible = new Set(
        sides.flatMap((s) => s.players.map((p) => p.playerId)),
      )

      const byMatch: PlayerPoints = {}
      for (const [playerId, value] of Object.entries(playerPoints)) {
        if (!eligible.has(playerId as PlayerId)) {
          throw new DataLayerError(
            'invalidPoints',
            'These points include a player who is in neither team for this match.',
          )
        }
        if (!Number.isFinite(value)) {
          throw new DataLayerError('invalidPoints', 'Points must be numbers.')
        }
        if (value !== 0) byMatch[playerId as PlayerId] = value
      }

      const [previous, tillId] = await Promise.all([
        api.getStandardPointsForMatch(tournamentId, matchId),
        service.read<MatchId>(
          service.path('tournaments', tournamentId, 'pointsUpdatedTillMatchId'),
        ),
      ])

      const tillNumber =
        tillId === undefined
          ? undefined
          : await service.read<number>(
              service.path(
                'tournaments',
                tournamentId,
                'matches',
                tillId,
                'matchNumber',
              ),
            )

      // The same moment for both stamps, in the same atomic write as the points.
      const stampedAt = Date.now()

      const changes: Record<string, unknown> = {
        [service.path('standardPointsUpdatedAt', tournamentId, 'overall')]:
          stampedAt,
        [service.path(
          'standardPointsUpdatedAt',
          tournamentId,
          'matches',
          matchId,
        )]: stampedAt,
        [paths.standardPointsByMatch(tournamentId, matchId)]:
          Object.keys(byMatch).length === 0 ? null : byMatch,
      }

      const involved = new Set([...eligible, ...Object.keys(previous)])
      for (const playerId of involved) {
        changes[
          service.path(
            'standardPointsByPlayer',
            tournamentId,
            playerId,
            matchId,
          )
        ] = byMatch[playerId as PlayerId] ?? null
      }

      // Forward only, so a correction to an earlier match leaves it alone. A
      // marker pointing at a match that no longer exists is replaced.
      if (tillNumber === undefined || match.matchNumber > tillNumber) {
        changes[
          service.path('tournaments', tournamentId, 'pointsUpdatedTillMatchId')
        ] = matchId
      }

      await service.update(changes)
    },

    /**
     * **Any manager's total, deliberately.** The leaderboard shows these
     * anyway, and a total is not a team: it cannot be worked back into an
     * eleven. The rule that matters — nobody sees an unlocked team — is
     * enforced in `getTeamForMatch`, and an unscored match totals zero.
     */
    async getPointsForMatch(
      userId: UserId,
      leagueId: LeagueId,
      matchId: MatchId,
    ): Promise<number> {
      const scoring = await loadScoring(leagueId, userId)
      const match = scoring.matches.find((m) => m.matchId === matchId)
      if (match === undefined) {
        throw new DataLayerError(
          'notFound',
          'That match is not in this league.',
        )
      }
      return matchScore(scoring, userId, match)
    },

    async getPointsForGameWeek(
      userId: UserId,
      leagueId: LeagueId,
      gameWeekId: GameWeekId,
    ): Promise<number> {
      const scoring = await loadScoring(leagueId, userId)
      const week = scoring.weeks.find(
        (w) => w.gameWeek.gameWeekId === gameWeekId,
      )
      if (week === undefined) {
        throw new DataLayerError('notFound', 'No such gameweek in this league.')
      }
      return weekScore(scoring, userId, week)
    },

    async getPointsForLeague(
      userId: UserId,
      leagueId: LeagueId,
    ): Promise<number> {
      return leagueScore(await loadScoring(leagueId, userId), userId)
    },

    async getLeaderboardForLeague(
      leagueId: LeagueId,
    ): Promise<LeaderboardRow[]> {
      const { rows } = await serveLeaderboard(
        leagueId,
        ['main'],
        (stamps) => stamps?.overall ?? 0,
        async (scoring) => ({
          rows: await rank(scoring, (userId) => leagueScore(scoring, userId)),
          isScored: true,
        }),
      )
      return rows
    },

    async getLeaderboardForGameWeek(
      leagueId: LeagueId,
      gameWeekId: GameWeekId,
    ): Promise<PeriodLeaderboard> {
      return serveLeaderboard(
        leagueId,
        ['gameWeeks', gameWeekId],
        // A gameweek is as new as the newest of its matches.
        (stamps, matchIds) =>
          Math.max(
            0,
            ...(matchIds ?? []).map((id) => stamps?.matches?.[id] ?? 0),
          ),
        async (scoring) => {
          const week = scoring.weeks.find(
            (w) => w.gameWeek.gameWeekId === gameWeekId,
          )
          if (week === undefined) {
            throw new DataLayerError(
              'notFound',
              'No such gameweek in this league.',
            )
          }

          // A gameweek locks, and starts scoring, with its first match.
          const first = scoring.matches.find(
            (m) => m.matchId === week.matchIds[0],
          )
          if (!isLocked(first, scoring.offset)) {
            throw new DataLayerError(
              'periodNotLocked',
              'That gameweek has not reached its deadline yet.',
            )
          }

          return {
            rows: await rank(scoring, (userId) =>
              weekScore(scoring, userId, week),
            ),
            isScored: isScored(scoring, first),
            ...(first === undefined
              ? {}
              : { firstMatchNumber: first.matchNumber }),
            matchIds: week.matchIds,
          }
        },
      )
    },

    async getLeaderboardForMatch(
      leagueId: LeagueId,
      matchId: MatchId,
    ): Promise<PeriodLeaderboard> {
      return serveLeaderboard(
        leagueId,
        ['matches', matchId],
        (stamps) => stamps?.matches?.[matchId] ?? 0,
        async (scoring) => {
          const match = scoring.matches.find((m) => m.matchId === matchId)
          if (match === undefined) {
            throw new DataLayerError(
              'periodNotLocked',
              'That match is not in this league.',
            )
          }
          if (!isLocked(match, scoring.offset)) {
            throw new DataLayerError(
              'periodNotLocked',
              'That match has not reached its deadline yet.',
            )
          }

          return {
            rows: await rank(scoring, (userId) =>
              matchScore(scoring, userId, match),
            ),
            isScored: isScored(scoring, match),
            firstMatchNumber: match.matchNumber,
          }
        },
      )
    },

    /**
     * Lighter than a leaderboard: standard scoring needs only the marker.
     * Custom scoring has no marker yet, so it reads its points to find one.
     */
    async getScoringWatermark(leagueId: LeagueId): Promise<ScoringWatermark> {
      const [{ tournamentId, matches }, isCustom] = await Promise.all([
        leagueFixtures(leagueId),
        service.read<boolean>(
          service.path('leagues', leagueId, 'isCustomScoringSystem'),
        ),
      ])

      if (isCustom === true) {
        const points = await service.read<Scoring['points']>(
          paths.customPointsByMatch(leagueId),
        )
        return watermarkOf(matches, true, undefined, points)
      }

      const tillId = await service.read<MatchId>(
        service.path('tournaments', tournamentId, 'pointsUpdatedTillMatchId'),
      )
      return watermarkOf(matches, false, tillId, undefined)
    },

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
          'notFound',
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

      for (const round of Object.values(rounds)) {
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
        'invalidConfig',
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
        throw new DataLayerError('notFound', 'That league no longer exists.')
      }

      const [teamOf, everyone] = await Promise.all([
        tournamentTeams(tournamentId),
        service.read<Record<string, Player>>(paths.players()),
      ])

      // Every participant is in the map, so it doubles as the membership test.
      return Object.values(everyone ?? {})
        .filter((player) => teamOf.has(player.playerId))
        .map((player) => withTeam(player, teamOf))
        .sort((a, b) => a.playerName.localeCompare(b.playerName))
    },

    async getMyTeamForMatch(
      leagueId: LeagueId,
      matchId: MatchId,
    ): Promise<MatchLineup | undefined> {
      const session = requireSession()
      return readMatchTeam(leagueId, session.uid as UserId, matchId)
    },

    async getMyTeamForGameWeek(
      leagueId: LeagueId,
      gameWeekId: GameWeekId,
    ): Promise<GameWeekLineup | undefined> {
      const session = requireSession()
      return readGameWeekTeam(leagueId, session.uid as UserId, gameWeekId)
    },

    async getTeamForMatch(
      leagueId: LeagueId,
      managerId: UserId,
      matchId: MatchId,
    ): Promise<MatchLineup | undefined> {
      const session = requireSession()

      if (managerId !== session.uid) {
        const { matches, offset } = await leagueFixtures(leagueId)
        const match = matches.find((m) => m.matchId === matchId)
        // Nothing, rather than an error: a caller cannot tell a hidden team
        // from a missing one, which is the point.
        if (!isLocked(match, offset)) return undefined
      }

      return readMatchTeam(leagueId, managerId, matchId)
    },

    async getTeamForGameWeek(
      leagueId: LeagueId,
      managerId: UserId,
      gameWeekId: GameWeekId,
    ): Promise<GameWeekLineup | undefined> {
      const session = requireSession()
      const team = await readGameWeekTeam(leagueId, managerId, gameWeekId)
      if (team === undefined || managerId === session.uid) return team

      const [{ matches, offset }, weeks] = await Promise.all([
        leagueFixtures(leagueId),
        api.getGameWeeks(leagueId),
      ])

      const week = weeks.find((w) => w.gameWeek.gameWeekId === gameWeekId)
      const first = matches.find((m) => m.matchId === week?.matchIds[0])
      if (!isLocked(first, offset)) return undefined

      // **A sub is visible per match**, from its own match's deadline, so a
      // pending one cannot be read off a gameweek that is already locked.
      const subFrom = matches.find(
        (m) => m.matchId === team.impactSub?.applicableFromMatch,
      )
      if (team.impactSub !== undefined && !isLocked(subFrom, offset)) {
        return {
          startingLineup: team.startingLineup,
          captainId: team.captainId,
          viceCaptainId: team.viceCaptainId,
        }
      }

      return team
    },

    async getLeagueDetails(leagueId: LeagueId): Promise<LeagueDetails> {
      const at = (field: string) => service.path('leagues', leagueId, field)

      const [
        leagueName,
        ownerId,
        isAuctionEnabled,
        isGameWeeksEnabled,
        leagueEntry,
        maxSlots,
        isCustom,
        scoringRulesText,
        teamAllowance,
        captainAllowance,
        viceCaptainAllowance,
        finishedAt,
        members,
        fixtures,
      ] = await Promise.all([
        service.read<string>(at('leagueName')),
        service.read<UserId>(at('leagueOwner')),
        service.read<boolean>(at('isAuctionEnabled')),
        service.read<boolean>(at('isGameWeeksEnabled')),
        service.read<LeagueDetails['leagueEntry']>(at('leagueEntry')),
        service.read<number>(at('maxSlots')),
        service.read<boolean>(at('isCustomScoringSystem')),
        service.read<string>(at('scoringRulesText')),
        service.read<number>(at('totalChangesAllowed')),
        service.read<number>(at('totalCaptainChangesAllowed')),
        service.read<number>(at('totalViceCaptainChangesAllowed')),
        service.read<number>(at('finishedAt')),
        service.read<Partial<Record<string, LeagueMember>>>(
          paths.leagueMembers(leagueId),
        ),
        leagueFixtures(leagueId),
      ])

      if (leagueName === undefined) {
        throw new DataLayerError('notFound', 'That league no longer exists.')
      }

      const [tournamentName, ownerName, tournamentRounds] = await Promise.all([
        service.read<string>(
          service.path('tournaments', fixtures.tournamentId, 'tournamentName'),
        ),
        ownerId === undefined
          ? undefined
          : service.read<string>(service.path('users', ownerId, 'userName')),
        service.read<Record<string, Round>>(
          paths.tournamentRounds(fixtures.tournamentId),
        ),
      ])

      const numberOf = (matchId: MatchId | undefined) =>
        fixtures.matches.find((m) => m.matchId === matchId)?.matchNumber ?? 0

      // In fixture order, by each round's first match — never by id.
      const rounds: RoundDetails[] = Object.entries(fixtures.rounds)
        .sort(
          ([a], [b]) =>
            numberOf(tournamentRounds?.[a]?.firstMatchId) -
            numberOf(tournamentRounds?.[b]?.firstMatchId),
        )
        .map(([roundId, config]) => ({
          roundName: tournamentRounds?.[roundId]?.roundName ?? '',
          gameWeeks: Object.keys(config.gameWeeks ?? {}).length,
          ...omitUndefined({
            beforeRoundCap: config.maxNumberOfChangesAllowedBeforeRoundStart,
            betweenGameWeeksCap:
              config.maxNumberOfChangesAllowedBetweenGameWeeks,
          }),
          isImpactSubAllowed: config.isImpactSubAllowed === true,
        }))

      const last = fixtures.matches[fixtures.matches.length - 1]

      return {
        leagueId,
        leagueName,
        tournamentName: tournamentName ?? '',
        ownerName: ownerName ?? 'Unknown',
        isAuctionEnabled: isAuctionEnabled === true,
        isGameWeeksEnabled: isGameWeeksEnabled === true,
        leagueEntry: leagueEntry ?? 'Open',
        managers: Object.values(members ?? {}).filter(
          (m) => m?.leagueRoles?.manager === true,
        ).length,
        maxSlots: maxSlots ?? 0,
        deadlineOffset: fixtures.offset,
        isCustomScoringSystem: isCustom === true,
        ...omitUndefined({ scoringRulesText }),
        changeAllowances: omitUndefined({
          teamChanges: teamAllowance,
          captainChanges: captainAllowance,
          viceCaptainChanges: viceCaptainAllowance,
        }),
        rounds: isGameWeeksEnabled === true ? rounds : [],
        ...omitUndefined({
          finishedAt,
          lastMatchStartsAt: last?.startTimestamp,
        }),
      }
    },

    /**
     * **Field by field, never `auctionConfig` whole**, which carries a price
     * for every player in the tournament — the pool is its own read.
     */
    async getAuctionSettings(leagueId: LeagueId): Promise<AuctionSettings> {
      await assertAuctionLeague(leagueId)

      const config = (field: string) =>
        auctionDetailsPath(leagueId, 'auctionConfig', field)

      const [
        auctionStartTime,
        auctioneerId,
        totalBudget,
        minSquadSize,
        maxSquadSize,
        maxOverseas,
        batchSequence,
      ] = await Promise.all([
        service.read<number>(auctionDetailsPath(leagueId, 'auctionStartTime')),
        service.read<UserId>(auctionDetailsPath(leagueId, 'primaryAuctioneer')),
        service.read<number>(config('totalBudget')),
        service.read<number>(config('minSquadSize')),
        service.read<number>(config('maxSquadSize')),
        service.read<number>(config('maxOverseasPlayersAllowedInXI')),
        service.read<AuctionBatch[]>(config('batchSequence')),
      ])

      if (
        auctionStartTime === undefined ||
        auctioneerId === undefined ||
        totalBudget === undefined ||
        minSquadSize === undefined ||
        maxSquadSize === undefined
      ) {
        throw new DataLayerError(
          'internal',
          'This auction league is missing part of its configuration.',
        )
      }

      const [auctioneerName, tournamentId] = await Promise.all([
        service.read<string>(service.path('users', auctioneerId, 'userName')),
        service.read<TournamentId>(
          service.path('leagues', leagueId, 'tournamentId'),
        ),
      ])
      // India when the tournament names nobody — see DEFAULT_HOME_NATION.
      const homeNation =
        (tournamentId === undefined
          ? undefined
          : await service.read<string>(
              service.path('tournaments', tournamentId, 'homeNation'),
            )) ?? DEFAULT_HOME_NATION

      return {
        auctionStartTime,
        totalBudget,
        minSquadSize,
        maxSquadSize,
        bidIncrement: BID_INCREMENT,
        roundSeconds: ROUND_SECONDS,
        auctioneer: {
          userId: auctioneerId,
          userName: auctioneerName ?? 'Unknown',
        },
        homeNation,
        ...omitUndefined({
          maxOverseasPlayersAllowedInXI: maxOverseas,
          batchSequence,
        }),
      }
    },

    /**
     * **Every position from 1 to the league's slots**, held or not.
     *
     * Stored position → manager, which RTDB hands back as an array with holes
     * where positions are free, so both shapes are read.
     */
    async getDraftOrder(leagueId: LeagueId): Promise<DraftOrderEntry[]> {
      await assertAuctionLeague(leagueId)

      const [maxSlots, raw] = await Promise.all([
        service.read<number>(service.path('leagues', leagueId, 'maxSlots')),
        service.read<unknown>(auctionDetailsPath(leagueId, 'draftOrder')),
      ])

      const held = new Map<number, UserId>()
      if (raw !== null && typeof raw === 'object') {
        for (const [key, holder] of Object.entries(raw)) {
          if (typeof holder === 'string') {
            held.set(Number(key), holder as UserId)
          }
        }
      }

      const positions = Array.from({ length: maxSlots ?? 0 }, (_, i) => i + 1)

      return Promise.all(
        positions.map(async (position): Promise<DraftOrderEntry> => {
          const managerId = held.get(position)
          if (managerId === undefined) return { position }

          const [managerName, fantasyTeamName] = await Promise.all([
            service.read<string>(service.path('users', managerId, 'userName')),
            service.read<string>(
              service.path(
                'leagues',
                leagueId,
                'leagueMembers',
                managerId,
                'fantasyTeamName',
              ),
            ),
          ])

          return {
            position,
            managerId,
            managerName: managerName ?? 'Unknown',
            ...omitUndefined({ fantasyTeamName }),
          }
        }),
      )
    },

    /**
     * **The league's frozen pool**, not the tournament's participants as they
     * are today: the prices and categories managers bid against were copied
     * when the league was created.
     */
    async getAuctionPlayerPool(
      leagueId: LeagueId,
    ): Promise<AuctionPoolPlayer[]> {
      await assertAuctionLeague(leagueId)

      const [tournamentId, details] = await Promise.all([
        service.read<TournamentId>(
          service.path('leagues', leagueId, 'tournamentId'),
        ),
        service.read<Record<string, LeaguePlayerAuctionDetail>>(
          auctionDetailsPath(leagueId, 'auctionConfig', 'playerDetails'),
        ),
      ])
      if (tournamentId === undefined) {
        throw new DataLayerError('notFound', 'That league no longer exists.')
      }

      const [teamOf, everyone] = await Promise.all([
        tournamentTeams(tournamentId),
        service.read<Record<string, Player>>(paths.players()),
      ])

      const pool: AuctionPoolPlayer[] = []
      for (const [playerId, detail] of Object.entries(details ?? {})) {
        const player = everyone?.[playerId]
        if (player === undefined) continue
        pool.push({
          player: withTeam(player, teamOf),
          playerCategory: detail.playerCategory,
          playerBasePrice: detail.playerBasePrice,
        })
      }

      // The order the auction runs in: category, then role, then name.
      return pool.sort(
        (a, b) =>
          PLAYER_CATEGORIES.indexOf(a.playerCategory) -
            PLAYER_CATEGORIES.indexOf(b.playerCategory) ||
          PLAYER_ROLES.indexOf(a.player.playerRole) -
            PLAYER_ROLES.indexOf(b.player.playerRole) ||
          a.player.playerName.localeCompare(b.player.playerName),
      )
    },

    // -----------------------------------------------------------------------
    // The live auction: the auctioneer's writes
    // -----------------------------------------------------------------------

    /**
     * **Creates the live auction** — the only thing that does. Every manager
     * starts on the full budget, and from here the league is in its auction
     * until the auctioneer ends it. Joining closes now.
     */
    async startAuction(leagueId: LeagueId): Promise<void> {
      await assertAuctioneer(leagueId)

      const [existing, members, totalBudget] = await Promise.all([
        service.read<AuctionState>(livePath(leagueId, 'auctionState')),
        service.read<Partial<Record<string, LeagueMember>>>(
          paths.leagueMembers(leagueId),
        ),
        service.read<number>(
          auctionDetailsPath(leagueId, 'auctionConfig', 'totalBudget'),
        ),
      ])
      if (existing !== undefined) {
        throw new DataLayerError(
          'auctionState',
          'The auction has already started.',
        )
      }
      if (totalBudget === undefined) {
        throw new DataLayerError('internal', 'This auction has no budget set.')
      }

      const update: Record<string, unknown> = {
        [livePath(leagueId, 'auctionState')]: { phase: 'notStarted' },
        ...timelineEntry(leagueId, 'auctionStarted', {}),
      }
      for (const [userId, member] of Object.entries(members ?? {})) {
        if (member?.leagueRoles?.manager !== true) continue
        update[livePath(leagueId, 'managerStatus', userId, 'budget')] =
          totalBudget
      }
      await service.update(update)
    },

    /**
     * **The next batch in the sequence, in order only.** No argument, so no
     * batch can be skipped or revisited. Clears the player up; the previous
     * one is kept as the last, for the headline.
     */
    async nextBatch(leagueId: LeagueId): Promise<void> {
      await assertAuctioneer(leagueId)
      const [state, sequence] = await Promise.all([
        liveState(leagueId),
        service.read<AuctionBatch[]>(
          auctionDetailsPath(leagueId, 'auctionConfig', 'batchSequence'),
        ),
      ])
      assertPhase(state, BETWEEN_ROUNDS, 'Finish this round before moving on.')

      const order = sequence ?? []
      const at =
        state.currentBatch === undefined
          ? -1
          : order.findIndex((batch) =>
              state.currentBatch?.kind === 'draft'
                ? batch.kind === 'draft'
                : batch.kind === 'auction' &&
                  state.currentBatch?.kind === 'auction' &&
                  batch.playerCategory === state.currentBatch.playerCategory &&
                  batch.playerRole === state.currentBatch.playerRole,
            )
      const next = order[at + 1]
      if (next === undefined) {
        throw new DataLayerError(
          'auctionState',
          'Every batch in the order has been reached.',
        )
      }

      // Every player in a bidding batch goes up, sold or unsold, before the
      // next batch begins.
      if (state.currentBatch?.kind === 'auction') {
        const left = (await eligibleInBatch(leagueId, state)).length
        if (left > 0) {
          throw new DataLayerError(
            'auctionState',
            `${left} ${left === 1 ? 'player is' : 'players are'} still to go up in this batch.`,
          )
        }
      }

      await service.update({
        [livePath(leagueId, 'auctionState', 'currentBatch')]: next,
        [livePath(leagueId, 'auctionState', 'currentPlayerId')]: null,
        ...(state.currentPlayerId === undefined
          ? {}
          : {
              [livePath(leagueId, 'auctionState', 'lastPlayerId')]:
                state.currentPlayerId,
            }),
        [livePath(leagueId, 'auctionState', 'phase')]: 'betweenPlayers',
        // The draft is announced when it starts, which is the next phase's.
        ...(next.kind === 'auction'
          ? timelineEntry(leagueId, 'nextBatch', {
              playerCategory: next.playerCategory,
              playerRole: next.playerRole,
            })
          : {}),
      })
    },

    async putUpPlayer(leagueId: LeagueId, playerId: PlayerId): Promise<void> {
      await assertAuctioneer(leagueId)
      const state = await liveState(leagueId)
      const eligible = await eligibleInBatch(leagueId, state)
      if (!eligible.includes(playerId)) {
        throw new DataLayerError(
          'auctionState',
          'That player is not in this batch, or has already gone up.',
        )
      }
      await putUp(leagueId, state, playerId)
    },

    async putUpRandomPlayer(leagueId: LeagueId): Promise<void> {
      await assertAuctioneer(leagueId)
      const state = await liveState(leagueId)
      const eligible = await eligibleInBatch(leagueId, state)
      const pick = eligible[Math.floor(Math.random() * eligible.length)]
      if (pick === undefined) {
        throw new DataLayerError(
          'auctionState',
          'Nobody is left in this batch. Move to the next one.',
        )
      }
      await putUp(leagueId, state, pick)
    },

    /** Opens bidding on the player up, at base price, with the clock running. */
    async startBidding(leagueId: LeagueId): Promise<void> {
      await assertAuctioneer(leagueId)
      const state = await liveState(leagueId)
      const playerId = state.currentPlayerId
      if (state.phase !== 'betweenPlayers' || playerId === undefined) {
        throw new DataLayerError('auctionState', 'Put a player up first.')
      }
      const [round, basePrice] = await Promise.all([
        service.read<AcceptedBidsForPlayer>(
          livePath(leagueId, 'currentAcceptedBids', playerId),
        ),
        service.read<number>(
          auctionDetailsPath(
            leagueId,
            'auctionConfig',
            'playerDetails',
            playerId,
            'playerBasePrice',
          ),
        ),
      ])
      if (round !== undefined) {
        throw new DataLayerError('auctionState', 'Bidding has already started.')
      }
      if (basePrice === undefined) {
        throw new DataLayerError(
          'notFound',
          'That player is not in this auction.',
        )
      }

      await service.update({
        [livePath(leagueId, 'currentAcceptedBids', playerId)]: {
          basePrice,
          minNextBid: basePrice,
          deadline: Date.now() + ROUND_SECONDS * 1000,
        },
        [livePath(leagueId, 'currentAcceptedBids', 'takingBids')]: true,
        [livePath(leagueId, 'currentSubmittedBids', 'takingBids')]: true,
        [livePath(leagueId, 'playerWiseBiddingHistory', playerId, 'status')]:
          'Pending',
        [livePath(leagueId, 'auctionState', 'phase')]: 'bidding',
        ...timelineEntry(leagueId, 'nextPlayer', {
          playerId,
          basePrice,
          timeLimit: ROUND_SECONDS,
        }),
      })
    },

    /**
     * **Accepts one submitted bid, checked again here.** The auctioneer's
     * browser has already judged it against the round it holds in memory; this
     * is the guard. The bid must be the one the manager actually submitted, at
     * exactly the asking price, before the deadline by this service's clock.
     */
    async acceptBid(
      leagueId: LeagueId,
      playerId: PlayerId,
      managerId: UserId,
      amount: number,
    ): Promise<void> {
      await assertAuctioneer(leagueId)
      assertPriceGrid(amount)
      const state = await liveState(leagueId)
      assertPhase(state, ['bidding'], 'Bidding is not open.')
      assertCurrent(state, playerId)

      const [round, submitted, submittedNoBids] = await Promise.all([
        service.read<AcceptedBidsForPlayer>(
          livePath(leagueId, 'currentAcceptedBids', playerId),
        ),
        service.read<number>(
          livePath(
            leagueId,
            'currentSubmittedBids',
            playerId,
            'bids',
            managerId,
          ),
        ),
        service.read<Partial<Record<string, true>>>(
          livePath(leagueId, 'currentSubmittedBids', playerId, 'noBids'),
        ),
      ])
      const now = Date.now()
      if (round === undefined) {
        throw new DataLayerError('auctionState', 'Bidding has not started.')
      }
      if (submitted !== amount) {
        throw new DataLayerError(
          'auctionState',
          'That is not the bid this manager submitted.',
        )
      }
      if (amount !== round.minNextBid) {
        throw new DataLayerError(
          'auctionState',
          'That bid is not at the asking price.',
        )
      }
      if (now > round.deadline) {
        throw new DataLayerError('auctionState', 'That bid came in after time.')
      }
      if (round.currentLeadingManager === managerId) {
        throw new DataLayerError(
          'auctionState',
          'That manager is already leading.',
        )
      }
      if (hasPassed(round, submittedNoBids, managerId)) {
        throw new DataLayerError('auctionState', 'That manager has passed.')
      }
      await assertCanBuy(leagueId, managerId, amount)

      const bidId = service.generateKey() as BidId
      const bid: Bid = {
        bidId,
        bidNumber: Object.keys(round.bids ?? {}).length + 1,
        bid: amount,
        managerId,
        timestamp: now,
      }
      const at = (field: string) =>
        livePath(leagueId, 'currentAcceptedBids', playerId, field)

      await service.update({
        [livePath(leagueId, 'currentAcceptedBids', playerId, 'bids', bidId)]:
          bid,
        [at('currentLeadingBid')]: amount,
        [at('currentLeadingManager')]: managerId,
        [at('minNextBid')]: amount + BID_INCREMENT,
        // Every accepted bid restarts the clock.
        [at('deadline')]: now + ROUND_SECONDS * 1000,
        [at('lastAcceptedBid')]: bidId,
        [livePath(
          leagueId,
          'playerWiseBiddingHistory',
          playerId,
          'bids',
          bidId,
        )]: bid,
        ...timelineEntry(leagueId, 'bid', { playerId, bid: amount, managerId }),
      })
    },

    /** Records a pass the manager submitted. Irreversible for the round. */
    async acceptNoBid(
      leagueId: LeagueId,
      playerId: PlayerId,
      managerId: UserId,
    ): Promise<void> {
      await assertAuctioneer(leagueId)
      const state = await liveState(leagueId)
      assertPhase(state, ['bidding', 'timeUp'], 'Bidding is not open.')
      assertCurrent(state, playerId)

      const [round, submitted] = await Promise.all([
        service.read<AcceptedBidsForPlayer>(
          livePath(leagueId, 'currentAcceptedBids', playerId),
        ),
        service.read<boolean>(
          livePath(
            leagueId,
            'currentSubmittedBids',
            playerId,
            'noBids',
            managerId,
          ),
        ),
      ])
      if (submitted !== true) {
        throw new DataLayerError('auctionState', 'That manager has not passed.')
      }
      if (hasPassed(round, undefined, managerId)) return // already recorded

      const noBidId = service.generateKey() as NoBidId
      await service.update({
        [livePath(
          leagueId,
          'currentAcceptedBids',
          playerId,
          'noBids',
          noBidId,
        )]: {
          noBidNumber: Object.keys(round?.noBids ?? {}).length + 1,
          managerId,
          timestamp: Date.now(),
        },
        ...timelineEntry(leagueId, 'noBid', { playerId, managerId }),
      })
    },

    /** A call onto the timeline. Changes no state; the clock already says it. */
    async announceCall(leagueId: LeagueId, call: AuctionCall): Promise<void> {
      await assertAuctioneer(leagueId)
      if (!(AUCTION_CALLS as readonly unknown[]).includes(call)) {
        throw new DataLayerError('invalid', 'Not a call.')
      }
      const state = await liveState(leagueId)
      assertPhase(state, ['bidding'], 'Bidding is not open.')
      await service.update(
        timelineEntry(leagueId, call, { timeRemaining: CALL_AT_SECONDS[call] }),
      )
    },

    /**
     * **Closes bidding once the deadline has passed by this service's clock**,
     * allowing a second's difference between it and the auctioneer's. Selling
     * stays manual.
     */
    async markTimeUp(leagueId: LeagueId): Promise<void> {
      await assertAuctioneer(leagueId)
      const state = await liveState(leagueId)
      assertPhase(state, ['bidding'], 'Bidding is not open.')
      const playerId = state.currentPlayerId
      if (playerId === undefined) {
        throw new DataLayerError('auctionState', 'Nobody is up.')
      }
      const deadline = await service.read<number>(
        livePath(leagueId, 'currentAcceptedBids', playerId, 'deadline'),
      )
      if (deadline !== undefined && Date.now() < deadline - 1000) {
        throw new DataLayerError('auctionState', 'There is still time left.')
      }
      await service.update({
        [livePath(leagueId, 'auctionState', 'phase')]: 'timeUp',
        [livePath(leagueId, 'currentSubmittedBids', 'takingBids')]: false,
        [livePath(leagueId, 'currentAcceptedBids', 'takingBids')]: false,
        ...timelineEntry(leagueId, 'timeUp', {}),
      })
    },

    /**
     * **Sells the player up to the leader at the leading bid**, both read here
     * rather than passed in. Manual, deliberately: allowed while bidding or
     * after time up, at the auctioneer's judgement.
     */
    async sellPlayer(leagueId: LeagueId): Promise<void> {
      await assertAuctioneer(leagueId)
      const state = await liveState(leagueId)
      assertPhase(state, ['bidding', 'timeUp'], 'Nothing is being sold.')
      const playerId = state.currentPlayerId
      if (playerId === undefined) {
        throw new DataLayerError('auctionState', 'Nobody is up.')
      }
      const round = await service.read<AcceptedBidsForPlayer>(
        livePath(leagueId, 'currentAcceptedBids', playerId),
      )
      const leader = round?.currentLeadingManager
      const amount = round?.currentLeadingBid
      const winning =
        round?.lastAcceptedBid === undefined
          ? undefined
          : round.bids?.[round.lastAcceptedBid]
      if (
        leader === undefined ||
        amount === undefined ||
        winning === undefined
      ) {
        throw new DataLayerError(
          'auctionState',
          'Nobody has bid. Mark the player unsold instead.',
        )
      }
      await assertCanBuy(leagueId, leader, amount)
      await service.update(
        await saleUpdate(leagueId, playerId, leader, amount, winning),
      )
    },

    /**
     * **The last-resort sale**, to a chosen manager at a chosen price. The
     * bidding so far is kept; the sale becomes the final bid unless it already
     * is the last one accepted.
     */
    async sellPlayerManually(
      leagueId: LeagueId,
      managerId: UserId,
      amount: number,
    ): Promise<void> {
      await assertAuctioneer(leagueId)
      assertPriceGrid(amount)
      const state = await liveState(leagueId)
      const playerId = state.currentPlayerId
      if (
        playerId === undefined ||
        !(['betweenPlayers', 'bidding', 'paused', 'timeUp'] as const).includes(
          state.phase as 'betweenPlayers',
        )
      ) {
        throw new DataLayerError('auctionState', 'Nobody is up to sell.')
      }
      const status = await service.read<PlayerStatus>(
        livePath(leagueId, 'playerStatus', playerId),
      )
      if (status?.status === 'Sold' || status?.status === 'Unsold') {
        throw new DataLayerError(
          'auctionState',
          'That player is already decided.',
        )
      }
      await assertCanBuy(leagueId, managerId, amount)

      const round = await service.read<AcceptedBidsForPlayer>(
        livePath(leagueId, 'currentAcceptedBids', playerId),
      )
      const last =
        round?.lastAcceptedBid === undefined
          ? undefined
          : round.bids?.[round.lastAcceptedBid]
      const winning: Bid =
        last !== undefined &&
        last.managerId === managerId &&
        last.bid === amount
          ? last
          : {
              bidId: service.generateKey() as BidId,
              bidNumber: Object.keys(round?.bids ?? {}).length + 1,
              bid: amount,
              managerId,
              timestamp: Date.now(),
            }
      await service.update(
        await saleUpdate(leagueId, playerId, managerId, amount, winning),
      )
    },

    async markPlayerUnsold(leagueId: LeagueId): Promise<void> {
      await assertAuctioneer(leagueId)
      const state = await liveState(leagueId)
      assertPhase(state, ['bidding', 'timeUp'], 'Nothing is being sold.')
      const playerId = state.currentPlayerId
      if (playerId === undefined) {
        throw new DataLayerError('auctionState', 'Nobody is up.')
      }
      await service.update({
        [livePath(leagueId, 'playerStatus', playerId)]: {
          playerId,
          status: 'Unsold',
        },
        [livePath(leagueId, 'playerWiseBiddingHistory', playerId, 'status')]:
          'Unsold',
        [livePath(leagueId, 'auctionState', 'phase')]: 'unsold',
        [livePath(leagueId, 'currentSubmittedBids', 'takingBids')]: false,
        [livePath(leagueId, 'currentAcceptedBids', 'takingBids')]: false,
        ...timelineEntry(leagueId, 'unsold', { playerId }),
      })
    },

    // -----------------------------------------------------------------------
    // The live auction: the draft
    // -----------------------------------------------------------------------

    /**
     * **The next turn in the draft**, which the first call also starts. The
     * order snakes, and anyone who can no longer pick — a full squad, or a
     * budget below the cheapest player left — is skipped rather than waited
     * on. Refused while a pick is still going through, and once nobody can
     * pick at all.
     */
    async nextDraftManager(leagueId: LeagueId): Promise<void> {
      await assertAuctioneer(leagueId)
      const state = await draftState(leagueId)
      assertPhase(state, BETWEEN_ROUNDS, 'Finish this round first.')

      // The turn has to be settled first: a pick that has gone through, or a
      // deliberate skip. Next never moves past a manager still deciding, so a
      // double click cannot skip anyone.
      const turn = state.currentDraftTurn
      if (turn !== undefined) {
        const pick = await service.read<DraftPick>(
          livePath(leagueId, 'draftPicks', String(turn)),
        )
        if (pick === undefined) {
          throw new DataLayerError(
            'auctionState',
            'This manager has not picked yet. Skip their turn to move on.',
          )
        }
        if (pick.skipped !== true && pick.accepted !== true) {
          throw new DataLayerError(
            'auctionState',
            'A pick is still going through. Wait for it.',
          )
        }
      }

      const [rawOrder, managers, maxSquadSize, pool] = await Promise.all([
        service.read<unknown>(auctionDetailsPath(leagueId, 'draftOrder')),
        service.read<Partial<Record<string, ManagerAuctionStatus>>>(
          livePath(leagueId, 'managerStatus'),
        ),
        service.read<number>(
          auctionDetailsPath(leagueId, 'auctionConfig', 'maxSquadSize'),
        ),
        draftPoolPrices(leagueId),
      ])
      const cheapest = Math.min(...pool.values())
      const canPick = (managerId: UserId) => {
        const status = managers?.[managerId]
        const squad = Object.keys(status?.playerList ?? {}).length
        return (
          (maxSquadSize === undefined || squad < maxSquadSize) &&
          (status?.budget ?? 0) >= cheapest
        )
      }

      const next = nextDraftTurn(
        draftOrderList(rawOrder),
        turn === undefined ? 0 : turn + 1,
        canPick,
      )
      if (next === undefined) {
        throw new DataLayerError(
          'auctionState',
          'Nobody can pick any more. The draft is over.',
        )
      }

      await service.update({
        [livePath(leagueId, 'auctionState', 'currentDraftTurn')]: next.turn,
        [livePath(leagueId, 'auctionState', 'currentDraftManagerId')]:
          next.managerId,
        [livePath(leagueId, 'auctionState', 'phase')]: 'betweenPlayers',
        ...(turn === undefined
          ? timelineEntry(leagueId, 'draftStarted', {})
          : {}),
        ...timelineEntry(leagueId, 'nextDraftManager', {
          managerId: next.managerId,
        }),
      })
    },

    /**
     * **Accepts the current turn's pick**, from the auctioneer's browser as it
     * arrives. Re-checks everything, then sells at base price in one update —
     * the same sale as a bid's, announced as a draft pick — and marks the pick
     * accepted.
     */
    async acceptDraftPick(leagueId: LeagueId, turn: number): Promise<void> {
      await assertAuctioneer(leagueId)
      const state = await draftState(leagueId)
      if (state.currentDraftTurn !== turn) {
        throw new DataLayerError('auctionState', 'That turn is over.')
      }
      const pick = await service.read<DraftPick>(
        livePath(leagueId, 'draftPicks', String(turn)),
      )
      if (pick === undefined) {
        throw new DataLayerError('auctionState', 'Nobody has picked yet.')
      }
      if (pick.skipped === true) {
        throw new DataLayerError('auctionState', 'That turn was skipped.')
      }
      if (pick.accepted === true) {
        throw new DataLayerError(
          'auctionState',
          'That pick has already gone through.',
        )
      }
      if (pick.managerId !== state.currentDraftManagerId) {
        throw new DataLayerError(
          'auctionState',
          'That pick is not from the manager whose turn it is.',
        )
      }
      const price = (await draftPoolPrices(leagueId)).get(pick.playerId)
      if (price === undefined) {
        throw new DataLayerError(
          'auctionState',
          'That player is no longer available.',
        )
      }
      await assertCanBuy(leagueId, pick.managerId, price)

      const bidId = service.generateKey() as BidId
      const update = await saleUpdate(
        leagueId,
        pick.playerId,
        pick.managerId,
        price,
        {
          bidId,
          bidNumber: 1,
          bid: price,
          managerId: pick.managerId,
          timestamp: Date.now(),
        },
        timelineEntry(leagueId, 'draftPick', {
          managerId: pick.managerId,
          playerId: pick.playerId,
          basePrice: price,
        }),
      )
      update[livePath(leagueId, 'draftPicks', String(turn), 'accepted')] = true
      await service.update(update)
    },

    /**
     * **A manager's pick for their turn.** The manager is the caller, never an
     * argument. Checked as far as it can be here — their turn, the player in
     * the pool, budget and squad space — then **claimed**: written only if this
     * turn has no pick yet, so a second pick, however it is sent, is refused.
     * The auctioneer's browser makes the sale.
     */
    async submitDraftPick(
      leagueId: LeagueId,
      playerId: PlayerId,
    ): Promise<void> {
      await assertAuctionLeague(leagueId)
      await assertManager(leagueId)
      const uid = requireSession().uid as UserId
      const state = await draftState(leagueId)
      const turn = state.currentDraftTurn
      if (turn === undefined || state.currentDraftManagerId !== uid) {
        throw new DataLayerError('auctionState', "It isn't your turn.")
      }
      const price = (await draftPoolPrices(leagueId)).get(playerId)
      if (price === undefined) {
        throw new DataLayerError(
          'auctionState',
          'That player is not available in the draft.',
        )
      }
      await assertCanBuy(leagueId, uid, price)

      const won = await service.claim(
        livePath(leagueId, 'draftPicks', String(turn)),
        {
          managerId: uid,
          playerId,
          submittedAt: Date.now(),
        } satisfies DraftPick,
      )
      if (!won) {
        const taken = await service.read<DraftPick>(
          livePath(leagueId, 'draftPicks', String(turn)),
        )
        throw new DataLayerError(
          'auctionState',
          taken?.skipped === true
            ? 'Your turn was skipped.'
            : 'You have already picked this turn.',
        )
      }
    },

    /**
     * **Skips the current manager's turn**, for one taking too long. A
     * deliberate action of its own, separate from Next, so a double click can
     * never skip anyone. Claims the turn like a pick does, so a pick and a
     * skip landing together cannot both succeed: whichever is first wins.
     */
    async skipDraftTurn(leagueId: LeagueId): Promise<void> {
      await assertAuctioneer(leagueId)
      const state = await draftState(leagueId)
      const turn = state.currentDraftTurn
      const managerId = state.currentDraftManagerId
      if (turn === undefined || managerId === undefined) {
        throw new DataLayerError('auctionState', 'Nobody is picking yet.')
      }

      const won = await service.claim(
        livePath(leagueId, 'draftPicks', String(turn)),
        {
          managerId,
          skipped: true,
          submittedAt: Date.now(),
        } satisfies DraftPick,
      )
      if (!won) {
        throw new DataLayerError(
          'auctionState',
          'This turn is already settled — they have picked, or it was skipped.',
        )
      }
      await service.update(
        timelineEntry(leagueId, 'draftTurnSkipped', { managerId }),
      )
    },

    /**
     * **Every player left in the current bidding batch, marked unsold at
     * once**, for testing — so the batches can be run through to the draft
     * without putting each player up. Between rounds only, and refused in
     * production. No timeline entries: one per player would bury the rest.
     */
    async markBatchUnsold(leagueId: LeagueId): Promise<void> {
      await assertAuctioneer(leagueId)

      if (service.environment === 'prod') {
        throw new DataLayerError(
          'forbidden',
          'A batch cannot be skipped in production.',
        )
      }

      const state = await liveState(leagueId)
      const left = await eligibleInBatch(leagueId, state)

      const update: Record<string, unknown> = {}
      for (const playerId of left) {
        update[livePath(leagueId, 'playerStatus', playerId)] = {
          playerId,
          status: 'Unsold',
        }
        update[
          livePath(leagueId, 'playerWiseBiddingHistory', playerId, 'status')
        ] = 'Unsold'
      }
      if (Object.keys(update).length > 0) await service.update(update)
    },

    /**
     * **Back to before Start auction**, for testing. The auction writes the
     * live node and, on each sale, the league's squads; lineups and the
     * leaderboard cache are built on those squads, so they go too. Members and
     * the draft order come from joining and stay.
     *
     * One atomic update. Refused in production whoever asks.
     */
    async resetAuction(leagueId: LeagueId): Promise<void> {
      await assertAuctioneer(leagueId)

      if (service.environment === 'prod') {
        throw new DataLayerError(
          'forbidden',
          'An auction cannot be reset in production.',
        )
      }

      await service.update({
        [paths.liveAuctions(leagueId)]: null,
        [paths.squads(leagueId)]: null,
        [paths.matchBasedLineups(leagueId)]: null,
        [paths.gameWeekBasedLineups(leagueId)]: null,
        [paths.leaderboards(leagueId)]: null,
      })
    },

    // -----------------------------------------------------------------------
    // The live auction: a manager's writes
    // -----------------------------------------------------------------------

    /**
     * **Writes only the bidder's own field.** The manager is the caller, never
     * an argument. Whether the bid is accepted — the price, the clock — is the
     * auctioneer's to judge; this refuses only what could never be valid.
     */
    async submitBid(
      leagueId: LeagueId,
      playerId: PlayerId,
      amount: number,
    ): Promise<void> {
      await assertAuctionLeague(leagueId)
      await assertManager(leagueId)
      const uid = requireSession().uid as UserId
      assertPriceGrid(amount)

      const state = await liveState(leagueId)
      assertPhase(state, ['bidding'], 'Bidding is not open.')
      assertCurrent(state, playerId)

      const [round, submittedNoBids] = await Promise.all([
        service.read<AcceptedBidsForPlayer>(
          livePath(leagueId, 'currentAcceptedBids', playerId),
        ),
        service.read<Partial<Record<string, true>>>(
          livePath(leagueId, 'currentSubmittedBids', playerId, 'noBids'),
        ),
      ])
      if (round?.currentLeadingManager === uid) {
        throw new DataLayerError(
          'auctionState',
          "You're already the highest bidder.",
        )
      }
      if (hasPassed(round, submittedNoBids, uid)) {
        throw new DataLayerError('auctionState', 'You passed on this player.')
      }
      await assertCanBuy(leagueId, uid, amount)

      await service.update({
        [livePath(leagueId, 'currentSubmittedBids', playerId, 'bids', uid)]:
          amount,
      })
    },

    /** A pass, written to the passer's own field. **Irreversible.** */
    async submitNoBid(leagueId: LeagueId, playerId: PlayerId): Promise<void> {
      await assertAuctionLeague(leagueId)
      await assertManager(leagueId)
      const uid = requireSession().uid as UserId

      const state = await liveState(leagueId)
      assertPhase(state, ['bidding', 'timeUp'], 'Bidding is not open.')
      assertCurrent(state, playerId)

      const [round, submittedNoBids] = await Promise.all([
        service.read<AcceptedBidsForPlayer>(
          livePath(leagueId, 'currentAcceptedBids', playerId),
        ),
        service.read<Partial<Record<string, true>>>(
          livePath(leagueId, 'currentSubmittedBids', playerId, 'noBids'),
        ),
      ])
      if (round?.currentLeadingManager === uid) {
        throw new DataLayerError(
          'auctionState',
          "You're the highest bidder, so you can't pass.",
        )
      }
      if (hasPassed(round, submittedNoBids, uid)) return // already out

      await service.update({
        [livePath(leagueId, 'currentSubmittedBids', playerId, 'noBids', uid)]:
          true,
      })
    },

    async getMembers(leagueId: LeagueId): Promise<LeagueMemberSummary[]> {
      const members = await service.read<Partial<Record<string, LeagueMember>>>(
        paths.leagueMembers(leagueId),
      )

      const present = Object.entries(members ?? {}).filter(
        (entry): entry is [string, LeagueMember] =>
          entry[1] !== undefined &&
          entry[1].leagueRoles?.bannedFromLeague !== true,
      )

      const names = await Promise.all(
        present.map(([userId]) =>
          service.read<string>(service.path('users', userId, 'userName')),
        ),
      )

      const standing = (roles: LeagueMember['leagueRoles']) =>
        roles?.leagueOwner === true ? 0 : roles?.leagueAdmin === true ? 1 : 2

      return present
        .map(([userId, member], index): LeagueMemberSummary => ({
          userId: userId as UserId,
          userName: names[index] ?? 'Unknown',
          leagueRoles: member.leagueRoles ?? {},
          ...omitUndefined({
            fantasyTeamName: member.fantasyTeamName,
            pointsAdjustment: member.pointsAdjustment,
          }),
        }))
        .sort(
          (a, b) =>
            standing(a.leagueRoles) - standing(b.leagueRoles) ||
            a.userName.localeCompare(b.userName),
        )
    },

    async markLeagueFinished(leagueId: LeagueId): Promise<void> {
      await assertLeagueAdmin(leagueId)

      /*
        **Gated on the last match having started.** The docs ask for every
        match to have ended, but nothing records an end, so the last scheduled
        start is the nearest thing the layer can check.
      */
      const { matches } = await leagueFixtures(leagueId)
      const last = matches[matches.length - 1]
      if (
        last?.startTimestamp === undefined ||
        last.startTimestamp > Date.now()
      ) {
        throw new DataLayerError(
          'periodNotLocked',
          "The league's last match has not started yet.",
        )
      }

      await service.write(
        service.path('leagues', leagueId, 'finishedAt'),
        Date.now(),
      )
    },

    async unmarkLeagueFinished(leagueId: LeagueId): Promise<void> {
      await assertLeagueAdmin(leagueId)
      await service.write(service.path('leagues', leagueId, 'finishedAt'), null)
    },

    async markTournamentComplete(tournamentId: TournamentId): Promise<void> {
      await assertSystemAdmin()
      await service.write(
        service.path('tournaments', tournamentId, 'completedAt'),
        Date.now(),
      )
    },

    async unmarkTournamentComplete(tournamentId: TournamentId): Promise<void> {
      await assertSystemAdmin()
      await service.write(
        service.path('tournaments', tournamentId, 'completedAt'),
        null,
      )
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
        throw new DataLayerError(
          'deadlinePassed',
          'No such match in this tournament.',
        )
      }
      if (
        from.startTimestamp !== undefined &&
        from.startTimestamp - offset <= Date.now()
      ) {
        throw new DataLayerError(
          'deadlinePassed',
          'The deadline for this match has passed.',
        )
      }

      await assertLegal(leagueId, lineup)

      /*
        **What this submission costs, and what is left after it.**

        One change is one player out and one player in, so swapping three spends
        three. Captain and vice-captain changes are counted separately against
        their own allowances and are neither team changes nor each other.

        **The baseline is the PREVIOUS match, never this one.** A match is not
        locked until its deadline, so until then you can rearrange as often as
        you like, and what is being measured is how this match differs from the
        one before it. Comparing against this match's own stored team would
        charge a second change for swapping Virat for Rohit after already
        swapping Hardik for Virat, when the answer is still one: Hardik out,
        Rohit in.

        Found by `matchNumber`, not by id — ids are push keys and sort by
        creation time rather than fixture order.

        **Match one has no previous match**, and neither does a manager's first
        ever submission wherever it happens. Nothing is spent in either case,
        which is why "the first team is free" needs no rule of its own.
      */
      const before = matches
        .filter((match) => match.matchNumber < from.matchNumber)
        .sort((a, b) => b.matchNumber - a.matchNumber)[0]

      const previous =
        before === undefined
          ? undefined
          : await service.read<StoredLineup>(
              service.path(
                'matchBasedLineups',
                leagueId,
                session.uid,
                before.matchId,
              ),
            )

      /*
        Three leaves, never the league itself. A league read is subtree-shaped
        and would drag an auction config — a base price for every player in the
        tournament — plus the gameweek structure, to fetch three numbers.
      */
      const at = (field: string) => service.path('leagues', leagueId, field)

      const [teamAllowance, captainAllowance, viceCaptainAllowance] =
        await Promise.all([
          service.read<number>(at('totalChangesAllowed')),
          service.read<number>(at('totalCaptainChangesAllowed')),
          service.read<number>(at('totalViceCaptainChangesAllowed')),
        ])

      const next = lineup.lineup.map((player) => player.playerId)

      const spentOnTeam =
        previous === undefined
          ? 0
          : previous.lineup.filter((id) => !next.includes(id)).length

      const spentOnCaptain =
        previous !== undefined && previous.captainId !== lineup.captainId
          ? 1
          : 0

      const spentOnViceCaptain =
        previous !== undefined &&
        previous.viceCaptainId !== lineup.viceCaptainId
          ? 1
          : 0

      /*
        Absent stays absent, which is how the model says unlimited, and an
        unlimited allowance can never be overspent.

        **An overspend is refused, not clamped.** Clamping at zero let a manager
        with one change left make five and read 0, which made the allowance a
        display rather than a rule. Nothing is written when this throws.
      */
      const remaining = (
        beforeThis: number | undefined,
        configured: number | undefined,
        spent: number,
        what: string,
      ): number | undefined => {
        const start = beforeThis ?? configured
        if (start === undefined) return undefined

        if (spent > start) {
          const noun = (n: number) => (n === 1 ? what : `${what}s`)
          throw new DataLayerError(
            'allowanceExceeded',
            `You have ${start} ${noun(start)} left and this uses ${spent}.`,
          )
        }
        return start - spent
      }

      const stored: StoredLineup = {
        lineup: next,
        captainId: lineup.captainId,
        viceCaptainId: lineup.viceCaptainId,
        ...omitUndefined({
          changesRemaining: remaining(
            previous?.changesRemaining,
            teamAllowance,
            spentOnTeam,
            'transfer',
          ),
          captainChangesRemaining: remaining(
            previous?.captainChangesRemaining,
            captainAllowance,
            spentOnCaptain,
            'captain change',
          ),
          viceCaptainChangesRemaining: remaining(
            previous?.viceCaptainChangesRemaining,
            viceCaptainAllowance,
            spentOnViceCaptain,
            'vice captain change',
          ),
        }),
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

      const gameWeek = Object.values(rounds)
        .flatMap((round) => Object.values(round.gameWeeks ?? {}))
        .find((gw) => gw.gameWeekId === gameWeekId)

      if (gameWeek === undefined) {
        throw new DataLayerError('notFound', 'No such gameweek in this league.')
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
          'deadlinePassed',
          'The deadline for this gameweek has passed.',
        )
      }

      await assertLegal(leagueId, lineup)

      /*
        **A cap on each transition, measured from the team standing before this
        gameweek.** A save here writes this gameweek and later ones, never an
        earlier one, so re-saving before the deadline is always measured from the
        same baseline and can never spend twice. Captain and vice-captain changes
        have no allowance here.
      */
      const [weeks, before] = await Promise.all([
        api.getGameWeeks(leagueId),
        api.getMyTeamBeforeGameWeek(leagueId, gameWeekId),
      ])

      const cap = weeks.find(
        (w) => w.gameWeek.gameWeekId === gameWeekId,
      )?.changeCap

      if (cap !== undefined && before !== undefined) {
        const next = lineup.lineup.map((player) => player.playerId)
        const spent = before.lineup.filter(
          (player) => !next.includes(player.playerId),
        ).length

        if (spent > cap) {
          throw new DataLayerError(
            'allowanceExceeded',
            `You can change ${cap} ${cap === 1 ? 'player' : 'players'} going into this gameweek, and this changes ${spent}.`,
          )
        }
      }

      /*
        **Copied forward, like a match-based team.** A team applies until it is
        changed, so saving here writes the same eleven to this gameweek and every
        later one, in one atomic update. Each node is replaced whole, which
        clears a later gameweek's impact sub: its team has changed, and every
        later gameweek is still before its deadline because this one is.
      */
      const from = weeks.findIndex((w) => w.gameWeek.gameWeekId === gameWeekId)
      const team: StoredGameWeekLineup = {
        startingLineup: lineup.lineup.map((player) => player.playerId),
        captainId: lineup.captainId,
        viceCaptainId: lineup.viceCaptainId,
      }

      // A gameweek missing from the resolved schedule is written alone rather
      // than guessing where "later" starts.
      const targets =
        from === -1
          ? [gameWeekId]
          : weeks.slice(from).map((w) => w.gameWeek.gameWeekId)

      const changes: Record<string, unknown> = {}
      for (const id of targets) {
        changes[
          service.path('gameWeekBasedLineups', leagueId, session.uid, id)
        ] = team
      }

      await service.update(changes)
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
      await assertSystemAdmin()

      const competitions = await api.getCompetitions()
      const competition = competitions.find(
        (c) => c.competitionName === SAMPLE_COMPETITION_NAME,
      )

      if (competition === undefined) {
        throw new DataLayerError(
          'invalidConfig',
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
            ...(SAMPLE_AUCTION_VALUES[player.playerName] ??
              SAMPLE_DEFAULT_AUCTION_VALUE),
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

    /**
     * **Test data, and destructive.** Every player, team, tournament and
     * league goes, with everything that points at them, and the IPL 2026 pool
     * replaces them. User records, base tournaments, reference tables and the
     * standards stay.
     *
     * **Refused in production**, whoever asks.
     *
     * **One atomic update.** The wiped nodes are set to null and the replaced
     * ones written whole — `players`, `teams` and the standard auction details
     * — because an update may not name a node and something beneath it
     * together. Either the environment is reset and loaded, or untouched.
     */
    async populateSeedData(): Promise<SeedDataResult> {
      await assertSystemAdmin()

      if (service.environment === 'prod') {
        throw new DataLayerError(
          'forbidden',
          'Seed data cannot be loaded into production.',
        )
      }

      const [competitions, users] = await Promise.all([
        api.getCompetitions(),
        service.read<Record<string, unknown>>(paths.users()),
      ])
      const competitionIdOf = new Map(
        competitions.map((c) => [c.competitionName, c.competitionId]),
      )
      const missing = new Set<string>()
      const resolve = (names: readonly string[]): CompetitionId[] =>
        names.flatMap((name) => {
          const id = competitionIdOf.get(name)
          if (id === undefined) missing.add(name)
          return id === undefined ? [] : [id]
        })

      const iplCompetition = resolve([IPL_COMPETITION])
      const intlCompetitions = resolve(
        Object.values(FORMAT_COMPETITIONS).flat(),
      )

      // Teams, keyed so the players below can find them.
      const teams: Record<string, Team & { teamId: TeamId }> = {}
      const franchiseId = new Map<string, TeamId>()
      const nationId = new Map<string, TeamId>()
      const addTeam = (
        teamName: string,
        teamShortName: string,
        competitionIds: readonly CompetitionId[],
      ): TeamId => {
        const teamId = service.generateKey() as TeamId
        teams[teamId] = {
          teamId,
          teamName,
          teamShortName,
          competitionIds: Object.fromEntries(
            competitionIds.map((id) => [id, true]),
          ),
          playerIds: {},
        }
        return teamId
      }
      for (const [code, name] of Object.entries(IPL_TEAMS)) {
        franchiseId.set(code, addTeam(name, code, iplCompetition))
      }
      for (const [nation, code] of Object.entries(NATIONAL_TEAMS)) {
        nationId.set(nation, addTeam(nation, code, intlCompetitions))
      }

      const players: Record<string, Player> = {}
      const auctionDetails: Record<string, LeaguePlayerAuctionDetail> = {}
      const shortNameList = shortNames(IPL_2026_PLAYERS.map(([name]) => name))

      IPL_2026_PLAYERS.forEach(
        ([playerName, franchise, country, role, formats], index) => {
          const playerId = service.generateKey() as PlayerId
          const currentTeams: Partial<Record<CompetitionId, TeamId>> = {}

          const memberships: [readonly CompetitionId[], TeamId | undefined][] =
            [[iplCompetition, franchiseId.get(franchise)]]
          for (const format of formats.split(' ').filter(Boolean)) {
            memberships.push([
              resolve(FORMAT_COMPETITIONS[format as IntlFormat]),
              nationId.get(country),
            ])
          }
          for (const [competitionIds, teamId] of memberships) {
            if (teamId === undefined) continue
            for (const competitionId of competitionIds) {
              currentTeams[competitionId] = teamId
              const roster = (teams[teamId]!.playerIds[competitionId] ??= {})
              roster[playerId] = true
            }
          }

          players[playerId] = {
            playerId,
            playerName,
            playerShortName: shortNameList[index]!,
            country,
            playerRole: ROLE_OF[role],
            isRetired: false,
            currentTeams,
          }
          auctionDetails[playerId] = auctionValueAt(index + 1)
        },
      )

      const update: Record<string, unknown> = {
        [paths.players()]: players,
        [paths.teams()]: teams,
        [paths.standardPlayerAuctionDetails()]: auctionDetails,
      }
      for (const node of [
        paths.tournaments(),
        paths.leagues(),
        paths.leagueCodeToLeagueMapping(),
        paths.matchBasedLineups(),
        paths.gameWeekBasedLineups(),
        paths.squads(),
        paths.joinRequests(),
        paths.bannedUsers(),
        paths.transferProposals(),
        paths.transferProposalsByManager(),
        paths.liveAuctions(),
        paths.leaderboards(),
        paths.customPointsByMatch(),
        paths.customPointsByPlayer(),
        paths.standardPointsByMatch(),
        paths.standardPointsByPlayer(),
        paths.standardPointsUpdatedAt(),
      ]) {
        update[node] = null
      }
      const userIds = Object.keys(users ?? {})
      for (const userId of userIds) {
        update[service.path('users', userId, 'leagues')] = null
        update[service.path('users', userId, 'archivedLeagues')] = null
      }

      await service.update(update)

      return {
        environment: service.root,
        teamsCreated: Object.keys(teams).length,
        playersCreated: Object.keys(players).length,
        usersCleared: userIds.length,
        missingCompetitions: [...missing],
      }
    },

    /**
     * **Test data: an unpublished IPL 2027 on the 2026 schedule.** Built from
     * the same calls the tournament editor makes — create, participants,
     * matches, rounds — so it is checked exactly as a hand-built one would be.
     *
     * **Not atomic across those calls.** A failure part way leaves an
     * unpublished IPL 2027 behind, which Populate seed data clears.
     *
     * Needs the IPL teams by short name, so it follows Populate seed data.
     */
    async createSampleIplTournament(): Promise<SampleTournamentResult> {
      await assertSystemAdmin()

      if (service.environment === 'prod') {
        throw new DataLayerError(
          'forbidden',
          'A sample tournament cannot be created in production.',
        )
      }

      const tournamentName = 'IPL 2027'
      const competition = (await api.getCompetitions()).find(
        (c) => c.competitionName === IPL_COMPETITION,
      )
      if (competition === undefined) {
        throw new DataLayerError(
          'invalidConfig',
          `There is no ${IPL_COMPETITION} base tournament. Press Set up basic system first.`,
        )
      }
      const competitionId = competition.competitionId

      const [existing, teams, players] = await Promise.all([
        api.getTournaments({ competitionId, includeUnpublished: true }),
        api.getTeams({ competitionId }),
        api.getPlayers({ competitionId }),
      ])

      if (existing.some((t) => t.tournamentName === tournamentName)) {
        throw new DataLayerError(
          'invalidConfig',
          `${tournamentName} already exists. Populate seed data clears it.`,
        )
      }

      const teamIdOf = new Map(teams.map((t) => [t.teamShortName, t.teamId]))
      const missing = Object.keys(IPL_TEAMS).filter((c) => !teamIdOf.has(c))
      if (missing.length > 0) {
        throw new DataLayerError(
          'invalidConfig',
          `No ${missing.join(', ')} in ${IPL_COMPETITION}. Press Populate seed data first.`,
        )
      }

      const participants: Partial<Record<PlayerId, TeamId>> = {}
      for (const player of players) {
        const teamId = player.currentTeams?.[competitionId]
        if (teamId !== undefined) participants[player.playerId] = teamId
      }

      const schedule = iplScheduleIn(2027)
      const tournamentId = await api.createTournament({
        tournamentName,
        competitionId,
        matchCount: schedule.length,
      })

      await api.updateTournamentParticipants(tournamentId, participants)

      const created = await api.getTournament(tournamentId)
      const matchIdOf = new Map(
        Object.values(created.matches).map((m) => [m.matchNumber, m.matchId]),
      )
      await api.updateMatches(
        tournamentId,
        schedule.map(({ matchNumber, startTimestamp, fixture }) => {
          const matchId = matchIdOf.get(matchNumber)
          if (matchId === undefined) {
            throw new DataLayerError(
              'internal',
              `The new tournament has no match ${matchNumber}.`,
            )
          }
          // A playoff gets its date and nothing else: TBA vs TBA.
          return {
            matchId,
            startTimestamp,
            ...(fixture === undefined
              ? {}
              : {
                  team1Id: teamIdOf.get(fixture.team1),
                  team2Id: teamIdOf.get(fixture.team2),
                  venue: fixture.venue,
                }),
          }
        }),
      )

      await api.setRounds(tournamentId, IPL_ROUNDS)

      return {
        tournamentId,
        tournamentName,
        matches: schedule.length,
        teams: new Set(Object.values(participants)).size,
        players: Object.keys(participants).length,
        rounds: IPL_ROUNDS.map((r) => r.roundName),
      }
    },

    async setUpBasicSystem(): Promise<SystemSetupResult> {
      await assertSystemAdmin()

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
