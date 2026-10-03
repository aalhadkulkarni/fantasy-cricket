/**
 * The contract, over HTTP.
 *
 * **Every method is one line**: hand the call the method name and its
 * arguments in order, and let the shared manifest decide the verb and the
 * encoding. The bodies are uniform on purpose — there is no per-method
 * behaviour here, and anything that looks like behaviour belongs on the
 * server.
 *
 * **Three methods never leave the browser.** `onAuthChanged`,
 * `signInWithGoogle` and `signOut` are the Google popup and the auth-state
 * listener, so they delegate to the auth module instead.
 *
 * **The types come from the contract**, so a method whose arguments or return
 * type drift from the interface fails to compile here rather than at runtime
 * in a page.
 */

import type {
  Api,
  AuctionCall,
  AuctionPoolPlayer,
  AuctionSettings,
  DraftOrderEntry,
  Competition,
  CompetitionConfig,
  CompetitionId,
  CreatePlayersResult,
  Environment,
  FormatRecord,
  GameWeek,
  GameWeekId,
  GameWeekLineup,
  JoinableLeague,
  LeagueCard,
  LeagueDetails,
  LeagueGameWeek,
  LeagueId,
  LeagueMemberSummary,
  LeaderboardRow,
  LeagueSummary,
  LineupRules,
  LineupSubmission,
  Match,
  MatchConfig,
  MatchId,
  MatchLineup,
  MatchPlayerPoints,
  MatchPlayers,
  OfficialLeagues,
  PeriodLeaderboard,
  Player,
  PlayerConfig,
  PlayerFilter,
  PlayerId,
  PlayerPoints,
  PlayerRoleRecord,
  Round,
  SamplePlayersResult,
  SampleTournamentResult,
  ScoringWatermark,
  SeedDataResult,
  SignInOutcome,
  SignedInIdentity,
  Subscriber,
  SystemSetupResult,
  Team,
  TeamConfig,
  TeamFilter,
  TeamId,
  Tournament,
  TournamentConfig,
  TournamentFilter,
  TournamentId,
  TournamentRoundConfig,
  Unsubscribe,
  User,
  UserId,
  ArchivedLeagueCard,
} from '@fantasy-cricket/shared'

import {
  onAuthChanged,
  signInWithGoogle,
  signOut,
} from '../firebase/firebase-auth'
import { createClient } from './client'

export interface HttpApi extends Api {
  readonly environment: Environment
}

export function createHttpApi(
  environment: Environment,
  baseUrl: string,
): HttpApi {
  const call = createClient(baseUrl)

  return {
    environment,

    // -- the browser's own, which cannot cross the wire ----------------------

    onAuthChanged(
      callback: Subscriber<SignedInIdentity | undefined>,
    ): Unsubscribe {
      return onAuthChanged(callback)
    },

    signInWithGoogle(): Promise<SignInOutcome> {
      return signInWithGoogle()
    },

    signOut(): Promise<void> {
      return signOut()
    },

    // -- everything else -----------------------------------------------------

    getCurrentUser(): Promise<User | undefined> {
      return call('getCurrentUser', []) as Promise<User | undefined>
    },

    createUser(userName: string): Promise<User> {
      return call('createUser', [userName]) as Promise<User>
    },

    getCompetitions(): Promise<Competition[]> {
      return call('getCompetitions', []) as Promise<Competition[]>
    },

    createCompetition(config: CompetitionConfig): Promise<CompetitionId> {
      return call('createCompetition', [config]) as Promise<CompetitionId>
    },

    updateCompetition(
      competitionId: CompetitionId,
      changes: Partial<CompetitionConfig>,
    ): Promise<void> {
      return call('updateCompetition', [
        competitionId,
        changes,
      ]) as Promise<void>
    },

    getPlayerRoles(): Promise<PlayerRoleRecord[]> {
      return call('getPlayerRoles', []) as Promise<PlayerRoleRecord[]>
    },

    getFormats(): Promise<FormatRecord[]> {
      return call('getFormats', []) as Promise<FormatRecord[]>
    },

    getTeams(filter?: TeamFilter): Promise<Team[]> {
      return call('getTeams', [filter]) as Promise<Team[]>
    },

    createTeam(team: TeamConfig): Promise<TeamId> {
      return call('createTeam', [team]) as Promise<TeamId>
    },

    updateTeam(teamId: TeamId, changes: Partial<TeamConfig>): Promise<void> {
      return call('updateTeam', [teamId, changes]) as Promise<void>
    },

    getPlayers(filter?: PlayerFilter): Promise<Player[]> {
      return call('getPlayers', [filter]) as Promise<Player[]>
    },

    createPlayers(
      players: readonly PlayerConfig[],
    ): Promise<CreatePlayersResult> {
      return call('createPlayers', [players]) as Promise<CreatePlayersResult>
    },

    updatePlayer(
      playerId: PlayerId,
      changes: Partial<PlayerConfig>,
    ): Promise<void> {
      return call('updatePlayer', [playerId, changes]) as Promise<void>
    },

    addPlayerToTeam(
      playerId: PlayerId,
      teamId: TeamId,
      competitionId: CompetitionId,
    ): Promise<void> {
      return call('addPlayerToTeam', [
        playerId,
        teamId,
        competitionId,
      ]) as Promise<void>
    },

    removePlayerFromTeam(
      playerId: PlayerId,
      competitionId: CompetitionId,
    ): Promise<void> {
      return call('removePlayerFromTeam', [
        playerId,
        competitionId,
      ]) as Promise<void>
    },

    setPlayerRetired(playerId: PlayerId, isRetired: boolean): Promise<void> {
      return call('setPlayerRetired', [playerId, isRetired]) as Promise<void>
    },

    getTournaments(filter?: TournamentFilter): Promise<Tournament[]> {
      return call('getTournaments', [filter]) as Promise<Tournament[]>
    },

    getTournament(tournamentId: TournamentId): Promise<Tournament> {
      return call('getTournament', [tournamentId]) as Promise<Tournament>
    },

    getLeaguesForTournament(
      tournamentId: TournamentId,
    ): Promise<JoinableLeague[]> {
      return call('getLeaguesForTournament', [tournamentId]) as Promise<
        JoinableLeague[]
      >
    },

    createTournament(config: TournamentConfig): Promise<TournamentId> {
      return call('createTournament', [config]) as Promise<TournamentId>
    },

    renameTournament(
      tournamentId: TournamentId,
      tournamentName: string,
    ): Promise<void> {
      return call('renameTournament', [
        tournamentId,
        tournamentName,
      ]) as Promise<void>
    },

    updateTournamentParticipants(
      tournamentId: TournamentId,
      participants: Partial<Record<PlayerId, TeamId>>,
    ): Promise<void> {
      return call('updateTournamentParticipants', [
        tournamentId,
        participants,
      ]) as Promise<void>
    },

    updateMatches(
      tournamentId: TournamentId,
      matches: readonly MatchConfig[],
    ): Promise<void> {
      return call('updateMatches', [tournamentId, matches]) as Promise<void>
    },

    addMatches(tournamentId: TournamentId, count: number): Promise<void> {
      return call('addMatches', [tournamentId, count]) as Promise<void>
    },

    removeMatches(tournamentId: TournamentId, count: number): Promise<void> {
      return call('removeMatches', [tournamentId, count]) as Promise<void>
    },

    setRounds(
      tournamentId: TournamentId,
      rounds: readonly TournamentRoundConfig[],
    ): Promise<void> {
      return call('setRounds', [tournamentId, rounds]) as Promise<void>
    },

    publishTournament(
      tournamentId: TournamentId,
      officialLeagues?: OfficialLeagues,
    ): Promise<void> {
      return call('publishTournament', [
        tournamentId,
        officialLeagues,
      ]) as Promise<void>
    },

    getLeagueByCode(
      leagueJoinCode: string,
    ): Promise<JoinableLeague | undefined> {
      return call('getLeagueByCode', [leagueJoinCode]) as Promise<
        JoinableLeague | undefined
      >
    },

    joinLeague(leagueId: LeagueId, fantasyTeamName: string): Promise<void> {
      return call('joinLeague', [leagueId, fantasyTeamName]) as Promise<void>
    },

    getActiveLeagues(): Promise<LeagueCard[]> {
      return call('getActiveLeagues', []) as Promise<LeagueCard[]>
    },

    getPendingLeagues(): Promise<LeagueCard[]> {
      return call('getPendingLeagues', []) as Promise<LeagueCard[]>
    },

    getArchivedLeagues(): Promise<ArchivedLeagueCard[]> {
      return call('getArchivedLeagues', []) as Promise<ArchivedLeagueCard[]>
    },

    getLeagueSummary(leagueId: LeagueId): Promise<LeagueSummary> {
      return call('getLeagueSummary', [leagueId]) as Promise<LeagueSummary>
    },

    getLineupRules(leagueId: LeagueId): Promise<LineupRules> {
      return call('getLineupRules', [leagueId]) as Promise<LineupRules>
    },

    getCurrentMatch(leagueId: LeagueId): Promise<Match> {
      return call('getCurrentMatch', [leagueId]) as Promise<Match>
    },

    getCurrentRound(leagueId: LeagueId): Promise<Round> {
      return call('getCurrentRound', [leagueId]) as Promise<Round>
    },

    getCurrentGameWeek(leagueId: LeagueId): Promise<GameWeek> {
      return call('getCurrentGameWeek', [leagueId]) as Promise<GameWeek>
    },

    getGameWeeks(leagueId: LeagueId): Promise<LeagueGameWeek[]> {
      return call('getGameWeeks', [leagueId]) as Promise<LeagueGameWeek[]>
    },

    getFixtures(tournamentId: TournamentId): Promise<Match[]> {
      return call('getFixtures', [tournamentId]) as Promise<Match[]>
    },

    getPlayerPointsForMatch(
      leagueId: LeagueId,
      matchId: MatchId,
    ): Promise<PlayerPoints> {
      return call('getPlayerPointsForMatch', [
        leagueId,
        matchId,
      ]) as Promise<PlayerPoints>
    },

    getPlayerPointsForMatches(
      leagueId: LeagueId,
      matchIds: readonly MatchId[],
    ): Promise<MatchPlayerPoints[]> {
      return call('getPlayerPointsForMatches', [leagueId, matchIds]) as Promise<
        MatchPlayerPoints[]
      >
    },

    getPointsForMatch(
      userId: UserId,
      leagueId: LeagueId,
      matchId: MatchId,
    ): Promise<number> {
      return call('getPointsForMatch', [
        userId,
        leagueId,
        matchId,
      ]) as Promise<number>
    },

    getPointsForGameWeek(
      userId: UserId,
      leagueId: LeagueId,
      gameWeekId: GameWeekId,
    ): Promise<number> {
      return call('getPointsForGameWeek', [
        userId,
        leagueId,
        gameWeekId,
      ]) as Promise<number>
    },

    getPointsForLeague(userId: UserId, leagueId: LeagueId): Promise<number> {
      return call('getPointsForLeague', [userId, leagueId]) as Promise<number>
    },

    getLeaderboardForLeague(leagueId: LeagueId): Promise<LeaderboardRow[]> {
      return call('getLeaderboardForLeague', [leagueId]) as Promise<
        LeaderboardRow[]
      >
    },

    getLeaderboardForGameWeek(
      leagueId: LeagueId,
      gameWeekId: GameWeekId,
    ): Promise<PeriodLeaderboard> {
      return call('getLeaderboardForGameWeek', [
        leagueId,
        gameWeekId,
      ]) as Promise<PeriodLeaderboard>
    },

    getLeaderboardForMatch(
      leagueId: LeagueId,
      matchId: MatchId,
    ): Promise<PeriodLeaderboard> {
      return call('getLeaderboardForMatch', [
        leagueId,
        matchId,
      ]) as Promise<PeriodLeaderboard>
    },

    getScoringWatermark(leagueId: LeagueId): Promise<ScoringWatermark> {
      return call('getScoringWatermark', [
        leagueId,
      ]) as Promise<ScoringWatermark>
    },

    getTeamForMatch(
      leagueId: LeagueId,
      managerId: UserId,
      matchId: MatchId,
    ): Promise<MatchLineup | undefined> {
      return call('getTeamForMatch', [leagueId, managerId, matchId]) as Promise<
        MatchLineup | undefined
      >
    },

    getTeamForGameWeek(
      leagueId: LeagueId,
      managerId: UserId,
      gameWeekId: GameWeekId,
    ): Promise<GameWeekLineup | undefined> {
      return call('getTeamForGameWeek', [
        leagueId,
        managerId,
        gameWeekId,
      ]) as Promise<GameWeekLineup | undefined>
    },

    getLeagueDetails(leagueId: LeagueId): Promise<LeagueDetails> {
      return call('getLeagueDetails', [leagueId]) as Promise<LeagueDetails>
    },

    getMembers(leagueId: LeagueId): Promise<LeagueMemberSummary[]> {
      return call('getMembers', [leagueId]) as Promise<LeagueMemberSummary[]>
    },

    getAuctionSettings(leagueId: LeagueId): Promise<AuctionSettings> {
      return call('getAuctionSettings', [leagueId]) as Promise<AuctionSettings>
    },

    getDraftOrder(leagueId: LeagueId): Promise<DraftOrderEntry[]> {
      return call('getDraftOrder', [leagueId]) as Promise<DraftOrderEntry[]>
    },

    getAuctionPlayerPool(leagueId: LeagueId): Promise<AuctionPoolPlayer[]> {
      return call('getAuctionPlayerPool', [leagueId]) as Promise<
        AuctionPoolPlayer[]
      >
    },

    startAuction(leagueId: LeagueId): Promise<void> {
      return call('startAuction', [leagueId]) as Promise<void>
    },

    nextBatch(leagueId: LeagueId): Promise<void> {
      return call('nextBatch', [leagueId]) as Promise<void>
    },

    putUpPlayer(leagueId: LeagueId, playerId: PlayerId): Promise<void> {
      return call('putUpPlayer', [leagueId, playerId]) as Promise<void>
    },

    putUpRandomPlayer(leagueId: LeagueId): Promise<void> {
      return call('putUpRandomPlayer', [leagueId]) as Promise<void>
    },

    startBidding(leagueId: LeagueId): Promise<void> {
      return call('startBidding', [leagueId]) as Promise<void>
    },

    acceptBid(
      leagueId: LeagueId,
      playerId: PlayerId,
      managerId: UserId,
      amount: number,
    ): Promise<void> {
      return call('acceptBid', [
        leagueId,
        playerId,
        managerId,
        amount,
      ]) as Promise<void>
    },

    acceptNoBid(
      leagueId: LeagueId,
      playerId: PlayerId,
      managerId: UserId,
    ): Promise<void> {
      return call('acceptNoBid', [
        leagueId,
        playerId,
        managerId,
      ]) as Promise<void>
    },

    announceCall(leagueId: LeagueId, which: AuctionCall): Promise<void> {
      return call('announceCall', [leagueId, which]) as Promise<void>
    },

    markTimeUp(leagueId: LeagueId): Promise<void> {
      return call('markTimeUp', [leagueId]) as Promise<void>
    },

    sellPlayer(leagueId: LeagueId): Promise<void> {
      return call('sellPlayer', [leagueId]) as Promise<void>
    },

    sellPlayerManually(
      leagueId: LeagueId,
      managerId: UserId,
      amount: number,
    ): Promise<void> {
      return call('sellPlayerManually', [
        leagueId,
        managerId,
        amount,
      ]) as Promise<void>
    },

    markPlayerUnsold(leagueId: LeagueId): Promise<void> {
      return call('markPlayerUnsold', [leagueId]) as Promise<void>
    },

    nextDraftManager(leagueId: LeagueId): Promise<void> {
      return call('nextDraftManager', [leagueId]) as Promise<void>
    },

    acceptDraftPick(leagueId: LeagueId, turn: number): Promise<void> {
      return call('acceptDraftPick', [leagueId, turn]) as Promise<void>
    },

    skipDraftTurn(leagueId: LeagueId): Promise<void> {
      return call('skipDraftTurn', [leagueId]) as Promise<void>
    },

    resetAuction(leagueId: LeagueId): Promise<void> {
      return call('resetAuction', [leagueId]) as Promise<void>
    },

    markBatchUnsold(leagueId: LeagueId): Promise<void> {
      return call('markBatchUnsold', [leagueId]) as Promise<void>
    },

    submitBid(
      leagueId: LeagueId,
      playerId: PlayerId,
      amount: number,
    ): Promise<void> {
      return call('submitBid', [leagueId, playerId, amount]) as Promise<void>
    },

    submitNoBid(leagueId: LeagueId, playerId: PlayerId): Promise<void> {
      return call('submitNoBid', [leagueId, playerId]) as Promise<void>
    },

    submitDraftPick(leagueId: LeagueId, playerId: PlayerId): Promise<void> {
      return call('submitDraftPick', [leagueId, playerId]) as Promise<void>
    },

    markLeagueFinished(leagueId: LeagueId): Promise<void> {
      return call('markLeagueFinished', [leagueId]) as Promise<void>
    },

    unmarkLeagueFinished(leagueId: LeagueId): Promise<void> {
      return call('unmarkLeagueFinished', [leagueId]) as Promise<void>
    },

    markTournamentComplete(tournamentId: TournamentId): Promise<void> {
      return call('markTournamentComplete', [tournamentId]) as Promise<void>
    },

    unmarkTournamentComplete(tournamentId: TournamentId): Promise<void> {
      return call('unmarkTournamentComplete', [tournamentId]) as Promise<void>
    },

    getPlayersForMatch(
      tournamentId: TournamentId,
      matchId: MatchId,
    ): Promise<MatchPlayers> {
      return call('getPlayersForMatch', [
        tournamentId,
        matchId,
      ]) as Promise<MatchPlayers>
    },

    getStandardPointsForMatch(
      tournamentId: TournamentId,
      matchId: MatchId,
    ): Promise<PlayerPoints> {
      return call('getStandardPointsForMatch', [
        tournamentId,
        matchId,
      ]) as Promise<PlayerPoints>
    },

    updateStandardPoints(
      tournamentId: TournamentId,
      matchId: MatchId,
      playerPoints: PlayerPoints,
    ): Promise<void> {
      return call('updateStandardPoints', [
        tournamentId,
        matchId,
        playerPoints,
      ]) as Promise<void>
    },

    getSelectablePlayers(
      leagueId: LeagueId,
      matchId: MatchId,
    ): Promise<Player[]> {
      return call('getSelectablePlayers', [leagueId, matchId]) as Promise<
        Player[]
      >
    },

    getMyTeamForMatch(
      leagueId: LeagueId,
      matchId: MatchId,
    ): Promise<MatchLineup | undefined> {
      return call('getMyTeamForMatch', [leagueId, matchId]) as Promise<
        MatchLineup | undefined
      >
    },

    getMyTeamForGameWeek(
      leagueId: LeagueId,
      gameWeekId: GameWeekId,
    ): Promise<GameWeekLineup | undefined> {
      return call('getMyTeamForGameWeek', [leagueId, gameWeekId]) as Promise<
        GameWeekLineup | undefined
      >
    },

    getMyTeamBeforeGameWeek(
      leagueId: LeagueId,
      gameWeekId: GameWeekId,
    ): Promise<LineupSubmission | undefined> {
      return call('getMyTeamBeforeGameWeek', [leagueId, gameWeekId]) as Promise<
        LineupSubmission | undefined
      >
    },

    updateTeamForMatch(
      leagueId: LeagueId,
      matchId: MatchId,
      lineup: LineupSubmission,
    ): Promise<void> {
      return call('updateTeamForMatch', [
        leagueId,
        matchId,
        lineup,
      ]) as Promise<void>
    },

    updateTeamForGameWeek(
      leagueId: LeagueId,
      gameWeekId: GameWeekId,
      lineup: LineupSubmission,
    ): Promise<void> {
      return call('updateTeamForGameWeek', [
        leagueId,
        gameWeekId,
        lineup,
      ]) as Promise<void>
    },

    setUpBasicSystem(): Promise<SystemSetupResult> {
      return call('setUpBasicSystem', []) as Promise<SystemSetupResult>
    },

    createSamplePlayers(): Promise<SamplePlayersResult> {
      return call('createSamplePlayers', []) as Promise<SamplePlayersResult>
    },

    populateSeedData(): Promise<SeedDataResult> {
      return call('populateSeedData', []) as Promise<SeedDataResult>
    },

    createSampleIplTournament(): Promise<SampleTournamentResult> {
      return call(
        'createSampleIplTournament',
        [],
      ) as Promise<SampleTournamentResult>
    },
  }
}
