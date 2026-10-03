/**
 * Every operation that crosses the wire, with its verb and the order of its
 * arguments.
 *
 * **One table, so the two sides cannot disagree.** The service registers a
 * route per entry; the HTTP client builds its calls from the same entry. A
 * method renamed in one place and not the other fails to compile, because the
 * keys are checked against the `Api` interface.
 *
 * **Reads are GET, writes are POST.** Arguments to a GET are query parameters
 * named after the parameter — an object argument is JSON in one of them —
 * and arguments to a POST are a JSON body keyed the same way. The verb is not
 * decoration: it decides what is safe to retry and what a log line means.
 *
 * **`onAuthChanged`, `signInWithGoogle` and `signOut` are absent.** They are
 * the Google popup and the auth-state listener, which the browser satisfies
 * itself.
 */

import type { Api } from './api.ts'

export interface MethodSpec {
  verb: 'get' | 'post'
  /** In signature order, which is how the server applies them. */
  params: readonly string[]
}

/** Every `Api` method except the three the browser keeps. */
export type WireMethod = Exclude<
  keyof Api,
  'onAuthChanged' | 'signInWithGoogle' | 'signOut'
>

export const API_METHODS: Readonly<Record<WireMethod, MethodSpec>> = {
  getCurrentUser: { verb: 'get', params: [] },
  createUser: { verb: 'post', params: ['userName'] },
  getCompetitions: { verb: 'get', params: [] },
  createCompetition: { verb: 'post', params: ['config'] },
  updateCompetition: { verb: 'post', params: ['competitionId', 'changes'] },
  getPlayerRoles: { verb: 'get', params: [] },
  getFormats: { verb: 'get', params: [] },
  getTeams: { verb: 'get', params: ['filter'] },
  createTeam: { verb: 'post', params: ['team'] },
  updateTeam: { verb: 'post', params: ['teamId', 'changes'] },
  getPlayers: { verb: 'get', params: ['filter'] },
  createPlayers: { verb: 'post', params: ['players'] },
  updatePlayer: { verb: 'post', params: ['playerId', 'changes'] },
  addPlayerToTeam: {
    verb: 'post',
    params: ['playerId', 'teamId', 'competitionId'],
  },
  removePlayerFromTeam: { verb: 'post', params: ['playerId', 'competitionId'] },
  setPlayerRetired: { verb: 'post', params: ['playerId', 'isRetired'] },
  getTournaments: { verb: 'get', params: ['filter'] },
  getTournament: { verb: 'get', params: ['tournamentId'] },
  getLeaguesForTournament: { verb: 'get', params: ['tournamentId'] },
  createTournament: { verb: 'post', params: ['config'] },
  renameTournament: {
    verb: 'post',
    params: ['tournamentId', 'tournamentName'],
  },
  updateTournamentParticipants: {
    verb: 'post',
    params: ['tournamentId', 'participants'],
  },
  updateMatches: { verb: 'post', params: ['tournamentId', 'matches'] },
  addMatches: { verb: 'post', params: ['tournamentId', 'count'] },
  removeMatches: { verb: 'post', params: ['tournamentId', 'count'] },
  setRounds: { verb: 'post', params: ['tournamentId', 'rounds'] },
  publishTournament: {
    verb: 'post',
    params: ['tournamentId', 'officialLeagues'],
  },
  getLeagueByCode: { verb: 'get', params: ['leagueJoinCode'] },
  joinLeague: { verb: 'post', params: ['leagueId', 'fantasyTeamName'] },
  getActiveLeagues: { verb: 'get', params: [] },
  getPendingLeagues: { verb: 'get', params: [] },
  getArchivedLeagues: { verb: 'get', params: [] },
  getLeagueSummary: { verb: 'get', params: ['leagueId'] },
  getLineupRules: { verb: 'get', params: ['leagueId'] },
  getCurrentMatch: { verb: 'get', params: ['leagueId'] },
  getCurrentRound: { verb: 'get', params: ['leagueId'] },
  getCurrentGameWeek: { verb: 'get', params: ['leagueId'] },
  getGameWeeks: { verb: 'get', params: ['leagueId'] },
  getFixtures: { verb: 'get', params: ['tournamentId'] },
  getPlayerPointsForMatch: { verb: 'get', params: ['leagueId', 'matchId'] },
  getPlayerPointsForMatches: {
    verb: 'get',
    params: ['leagueId', 'matchIds'],
  },
  getPointsForMatch: { verb: 'get', params: ['userId', 'leagueId', 'matchId'] },
  getPointsForGameWeek: {
    verb: 'get',
    params: ['userId', 'leagueId', 'gameWeekId'],
  },
  getPointsForLeague: { verb: 'get', params: ['userId', 'leagueId'] },
  getLeaderboardForLeague: { verb: 'get', params: ['leagueId'] },
  getLeaderboardForGameWeek: {
    verb: 'get',
    params: ['leagueId', 'gameWeekId'],
  },
  getLeaderboardForMatch: { verb: 'get', params: ['leagueId', 'matchId'] },
  getScoringWatermark: { verb: 'get', params: ['leagueId'] },
  getTeamForMatch: {
    verb: 'get',
    params: ['leagueId', 'managerId', 'matchId'],
  },
  getTeamForGameWeek: {
    verb: 'get',
    params: ['leagueId', 'managerId', 'gameWeekId'],
  },
  getLeagueDetails: { verb: 'get', params: ['leagueId'] },
  getMembers: { verb: 'get', params: ['leagueId'] },
  getAuctionSettings: { verb: 'get', params: ['leagueId'] },
  getDraftOrder: { verb: 'get', params: ['leagueId'] },
  getAuctionPlayerPool: { verb: 'get', params: ['leagueId'] },
  startAuction: { verb: 'post', params: ['leagueId'] },
  nextBatch: { verb: 'post', params: ['leagueId'] },
  putUpPlayer: { verb: 'post', params: ['leagueId', 'playerId'] },
  putUpRandomPlayer: { verb: 'post', params: ['leagueId'] },
  startBidding: { verb: 'post', params: ['leagueId'] },
  acceptBid: {
    verb: 'post',
    params: ['leagueId', 'playerId', 'managerId', 'amount'],
  },
  acceptNoBid: { verb: 'post', params: ['leagueId', 'playerId', 'managerId'] },
  announceCall: { verb: 'post', params: ['leagueId', 'call'] },
  markTimeUp: { verb: 'post', params: ['leagueId'] },
  sellPlayer: { verb: 'post', params: ['leagueId'] },
  sellPlayerManually: {
    verb: 'post',
    params: ['leagueId', 'managerId', 'amount'],
  },
  markPlayerUnsold: { verb: 'post', params: ['leagueId'] },
  nextDraftManager: { verb: 'post', params: ['leagueId'] },
  acceptDraftPick: { verb: 'post', params: ['leagueId', 'turn'] },
  skipDraftTurn: { verb: 'post', params: ['leagueId'] },
  resetAuction: { verb: 'post', params: ['leagueId'] },
  markBatchUnsold: { verb: 'post', params: ['leagueId'] },
  submitBid: { verb: 'post', params: ['leagueId', 'playerId', 'amount'] },
  submitNoBid: { verb: 'post', params: ['leagueId', 'playerId'] },
  submitDraftPick: { verb: 'post', params: ['leagueId', 'playerId'] },
  markLeagueFinished: { verb: 'post', params: ['leagueId'] },
  unmarkLeagueFinished: { verb: 'post', params: ['leagueId'] },
  markTournamentComplete: { verb: 'post', params: ['tournamentId'] },
  unmarkTournamentComplete: { verb: 'post', params: ['tournamentId'] },
  getPlayersForMatch: { verb: 'get', params: ['tournamentId', 'matchId'] },
  getStandardPointsForMatch: {
    verb: 'get',
    params: ['tournamentId', 'matchId'],
  },
  updateStandardPoints: {
    verb: 'post',
    params: ['tournamentId', 'matchId', 'playerPoints'],
  },
  getSelectablePlayers: { verb: 'get', params: ['leagueId', 'matchId'] },
  getMyTeamForMatch: { verb: 'get', params: ['leagueId', 'matchId'] },
  getMyTeamForGameWeek: { verb: 'get', params: ['leagueId', 'gameWeekId'] },
  getMyTeamBeforeGameWeek: { verb: 'get', params: ['leagueId', 'gameWeekId'] },
  updateTeamForMatch: {
    verb: 'post',
    params: ['leagueId', 'matchId', 'lineup'],
  },
  updateTeamForGameWeek: {
    verb: 'post',
    params: ['leagueId', 'gameWeekId', 'lineup'],
  },
  setUpBasicSystem: { verb: 'post', params: [] },
  createSamplePlayers: { verb: 'post', params: [] },
  populateSeedData: { verb: 'post', params: [] },
  createSampleIplTournament: { verb: 'post', params: [] },
}
