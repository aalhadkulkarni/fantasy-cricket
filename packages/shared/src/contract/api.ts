/**
 * The contract between the app and whatever is behind it.
 *
 * **This is the seam.** The browser talks to the API service over HTTP; the
 * service talks to Firebase. Both compile against this one interface, so what
 * the server builds and what the browser reads cannot disagree about shape.
 *
 * ```
 * component  →  dataLayer.getLeagueDetails()     public, backend-agnostic
 *            →  httpApi.getLeagueDetails()       one implementation of Api
 *            →  GET /v1/getLeagueDetails         the wire
 *            →  firebaseApi.getLeagueDetails()   the same interface, server side
 *            →  FirebaseService.read(path)       the Admin SDK, private to the service
 * ```
 *
 * **A backend client is not an `Api`.** `FirebaseService` knows about paths,
 * snapshots and multi-path updates; the HTTP client knows about URLs and
 * status codes. Neither belongs here, and a path *is* the schema, which the
 * fifth boundary rule keeps below this line. What goes here are operations.
 *
 * **This interface is deliberately small.** It carries only what is genuinely
 * implemented; `docs/06-data-layer.md` names about 140 operations and the rest
 * still throw `notImplemented` from their own files.
 *
 * **Three methods never cross the wire**: `onAuthChanged`, `signInWithGoogle`
 * and `signOut` are the Google popup and the auth-state listener, which are
 * browser-side by nature. The HTTP implementation satisfies them locally.
 */

import type {
  ArchivedLeagueCard,
  AuctionCall,
  AuctionPoolPlayer,
  AuctionSettings,
  Competition,
  CompetitionConfig,
  CompetitionId,
  DraftOrderEntry,
  FormatRecord,
  GameWeek,
  GameWeekId,
  GameWeekLineup,
  JoinableLeague,
  LeagueCard,
  LeagueGameWeek,
  LeagueId,
  LeagueSummary,
  LineupRules,
  LineupSubmission,
  Match,
  MatchConfig,
  MatchId,
  MatchPlayers,
  PeriodLeaderboard,
  LeagueDetails,
  LeagueMemberSummary,
  LeaderboardRow,
  ScoringWatermark,
  Fixture,
  SquadsView,
  MatchLineup,
  Player,
  PlayerConfig,
  PlayerFilter,
  PlayerId,
  PlayerPoints,
  PlayerRoleRecord,
  Round,
  RoundId,
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
} from '../index.ts'
import type { Subscriber, Unsubscribe } from './subscriptions.ts'

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

/** One match's points, as `getPlayerPointsForMatches` returns them. */
export interface MatchPlayerPoints {
  matchId: MatchId
  points: PlayerPoints
}

/**
 * Which official leagues to open alongside publishing a tournament.
 *
 * **The publisher owns and administers them but does not play them.** Being a
 * manager means having a fantasy team name, which is chosen when joining, so
 * the admin joins through the same door as everyone else. In the auction
 * league the publisher is also the auctioneer.
 *
 * All are public and use standard points — the whole point is that anyone can
 * walk in.
 */
export interface OfficialLeagues {
  /** Changes counted across the whole tournament. */
  matchBased?: boolean
  gameWeekBased?: boolean

  /**
   * **How many matches make a gameweek, per round.** Required for every round
   * whenever a gameweek league is asked for, and refused unless it divides that
   * round's match count — gameweeks are equal length within a round.
   *
   * One set serves every gameweek league opened in the same publish. A length
   * of one has no "during the gameweek", so the impact sub is off there.
   */
  gameWeekLengths?: Partial<Record<RoundId, number>>

  /**
   * **Present means open an official auction league.** Standard rules, public,
   * six slots, and joining closes when the auction starts. Gameweek-based, so
   * it needs `gameWeekLengths` too.
   *
   * The start is refused unless it is in the future and before the first
   * match starts, since squads have to be won before teams can be picked.
   */
  auction?: {
    auctionStartTime: number
  }
}

/**
 * What creating the sample squads did.
 *
 * **Safe to press twice.** Names already present are skipped rather than
 * duplicated, so a second run adds whatever the first one missed and nothing
 * else.
 */
export interface SamplePlayersResult {
  created: number
  /** Names already in the catalogue. Re-running is safe rather than doubling it. */
  skipped: readonly string[]
  /** Teams that had to be created because they did not exist yet. */
  teamsCreated: readonly string[]
  /** The base tournament they were all put in. */
  competitionName: string
}

/**
 * What resetting an environment to the IPL 2026 test data did.
 *
 * **Base tournaments are matched by name**, so one renamed or never created is
 * listed in `missingCompetitions` rather than failing the reset. The teams and
 * players that would have joined it are written without that membership.
 */
export interface SeedDataResult {
  environment: string
  teamsCreated: number
  playersCreated: number
  missingCompetitions: readonly string[]
}

/** What resetting an environment cleared. */
export interface ResetEnvironmentResult {
  environment: string
  /** Users whose league lists were cleared, so their home screen starts empty. */
  usersCleared: number
}

/** What creating the sample IPL tournament did. */
export interface SampleTournamentResult {
  tournamentId: TournamentId
  tournamentName: string
  matches: number
  teams: number
  players: number
  rounds: readonly string[]
}

/** What refreshing the standards wrote. */
export interface StandardsRefreshResult {
  environment: string
  /** The nodes written, `standardAuctionConfig` field by field. */
  written: readonly string[]
}

/** Which environment this is, and whether it has gone live. */
export interface SystemStatus {
  environment: string
  /**
   * Set by hand when the environment goes live. Until then the testing tools
   * work here, production included; once true they are refused.
   */
  released: boolean
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
   * **System admins only.** Names are unique, ignoring case — the interface
   * picks base tournaments from a list by name, so two called "IPL" could not be
   * told apart.
   */
  createCompetition(config: CompetitionConfig): Promise<CompetitionId>

  /**
   * **System admins only.** A home nation of `''` clears it. Changing it
   * reaches tournaments created afterwards and never one already created,
   * which carries its own frozen copy.
   */
  updateCompetition(
    competitionId: CompetitionId,
    changes: Partial<CompetitionConfig>,
  ): Promise<void>

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
   * The leagues running on a tournament, **public and closed alike**. Closed
   * leagues are visible to everyone; only entry is restricted.
   *
   * Carries how many slots are filled, which is not stored anywhere — it counts
   * members holding `manager`, one read per league. `docs/data-model.js` leaves
   * that trade open; it is settled in favour of showing it, because a full
   * league cannot be joined and the row has to say so.
   */
  getLeaguesForTournament(tournamentId: TournamentId): Promise<JoinableLeague[]>

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

  // -- leagues and membership ----------------------------------------------

  /**
   * A league from its join code, or nothing if no league has that code.
   *
   * **A code is a shortcut, not a bypass.** It finds the league; whether you can
   * walk in still depends on the league being public, which is why this returns
   * the same card a tournament row renders rather than joining anything.
   */
  getLeagueByCode(leagueJoinCode: string): Promise<JoinableLeague | undefined>

  /**
   * **Public leagues only, and joining is immediate.**
   *
   * Every refusal is decided here rather than hidden in the interface: the join
   * deadline, the ban, a full league, a closed one. Anyone can read the database
   * directly with the client SDK, so interface gating is convenience and this is
   * the guard.
   *
   * **Adds `manager` to whatever roles you already hold**, so someone who owns a
   * league can join and play it. Roles are additive; running a league is not
   * playing in it.
   *
   * Identity comes from the session, never a parameter.
   */
  joinLeague(leagueId: LeagueId, fantasyTeamName: string): Promise<void>

  /**
   * The leagues you are in, **joined and spectated together**. Separating them
   * would mean checking two places to answer "what am I involved in", and a
   * spectator's card differs only in which actions it offers.
   *
   * Carries the phase and the member count, neither of which is stored: the
   * phase is a function of the current time, and a slot counter would fan out to
   * every member's index entry on every join.
   */
  getActiveLeagues(): Promise<LeagueCard[]>

  /** Requested but not yet accepted or rejected. */
  getPendingLeagues(): Promise<LeagueCard[]>

  /** Read only when that tab is opened, since it grows without bound. */
  getArchivedLeagues(): Promise<ArchivedLeagueCard[]>

  /**
   * The strip at the top of league home, and what the sidebar needs to know
   * which sections exist.
   *
   * **Rank is absent until the league is active.** Working it out needs every
   * manager's lineups across every match plus the points node, and before a ball
   * is bowled everyone is on zero, so the cost buys nothing.
   */
  getLeagueSummary(leagueId: LeagueId): Promise<LeagueSummary>

  /** The composition limits a legal XI must satisfy in this league. */
  getLineupRules(leagueId: LeagueId): Promise<LineupRules>

  /**
   * The match a team is being picked for: the earliest whose deadline has not
   * passed, or the last one once they all have.
   *
   * **Its own read rather than something taken from config**, because someone
   * may sit on the page long enough for a deadline to pass beneath them.
   */
  getCurrentMatch(leagueId: LeagueId): Promise<Match>

  /**
   * The phase of the tournament that match falls in — group stage, playoffs.
   *
   * Answers for a match-based league too, since a round belongs to the
   * tournament rather than to a league's gameweek structure.
   */
  getCurrentRound(leagueId: LeagueId): Promise<Round>

  /** The gameweek containing that match. */
  getCurrentGameWeek(leagueId: LeagueId): Promise<GameWeek>

  /**
   * Every gameweek in the league, in order, for moving between them.
   *
   * No specified call returns these — a league's gameweeks live under its round
   * configs, keyed by the tournament's round ids, and resolving which matches
   * each spans is the layer's job.
   */
  getGameWeeks(leagueId: LeagueId): Promise<LeagueGameWeek[]>

  /** Every match in the tournament, in `matchNumber` order. */
  getFixtures(tournamentId: TournamentId): Promise<Fixture[]>

  /**
   * What each player scored in one match.
   *
   * **Resolution follows the league's scoring flag, never a search order.** A
   * custom-scoring league reads only its own store, so a match its admin has
   * not entered has no points rather than borrowed ones. Falling back per match
   * would let one league score some matches by its own rules and others by the
   * standard ones, which is worse than showing nothing because nobody would see
   * it happen.
   *
   * **Zero and absent are equivalent.** The reason a player scored nothing is
   * not recorded.
   */
  getPlayerPointsForMatch(
    leagueId: LeagueId,
    matchId: MatchId,
  ): Promise<PlayerPoints>

  /**
   * **The same, for several matches in one call** — a gameweek's, typically.
   * One entry per match asked for, **in the order asked**, so a gameweek's
   * fixtures come back in fixture order. A match with no points has an empty
   * map rather than no entry.
   *
   * Exists because a gameweek's total was being built from one request per
   * match: five round trips for a five-match gameweek, and twelve for an IPL
   * one. Resolution is the same as the single call — the league's scoring flag
   * decides the store, once, for every match.
   */
  getPlayerPointsForMatches(
    leagueId: LeagueId,
    matchIds: readonly MatchId[],
  ): Promise<MatchPlayerPoints[]>

  /**
   * **One manager's score for one match**: their eleven for it, each player's
   * points, the captain doubled and the vice-captain at one and a half. Zero
   * with no team or no points.
   */
  getPointsForMatch(
    userId: UserId,
    leagueId: LeagueId,
    matchId: MatchId,
  ): Promise<number>

  /** The sum of `getPointsForMatch` over the gameweek's matches. */
  getPointsForGameWeek(
    userId: UserId,
    leagueId: LeagueId,
    gameWeekId: GameWeekId,
  ): Promise<number>

  /**
   * A manager's league total: every match, plus their `pointsAdjustment` from
   * transfers, which is zero outside an auction league.
   */
  getPointsForLeague(userId: UserId, leagueId: LeagueId): Promise<number>

  /**
   * **Overall standings, managers only.** Lineups and points are each read
   * once for the whole league and every total is computed from them, never one
   * read per manager. Nothing is kept once the rows are returned.
   *
   * Ties share a rank and the next rank skips by the number tied.
   */
  getLeaderboardForLeague(leagueId: LeagueId): Promise<LeaderboardRow[]>

  /** **Refused before the gameweek's first match deadline.** */
  getLeaderboardForGameWeek(
    leagueId: LeagueId,
    gameWeekId: GameWeekId,
  ): Promise<PeriodLeaderboard>

  /** **Refused before the match's deadline.** */
  getLeaderboardForMatch(
    leagueId: LeagueId,
    matchId: MatchId,
  ): Promise<PeriodLeaderboard>

  /** The match points are entered up to. Absent before any are. */
  getScoringWatermark(leagueId: LeagueId): Promise<ScoringWatermark>

  /**
   * **Another manager's team for a match, or nothing.** Returned to anyone
   * other than that manager only once the match's deadline has passed, and
   * admins are not exempt. Who is asking comes from the session, never from
   * the caller.
   */
  getTeamForMatch(
    leagueId: LeagueId,
    managerId: UserId,
    matchId: MatchId,
  ): Promise<MatchLineup | undefined>

  /**
   * The same rule for a gameweek, which locks at its first match's deadline.
   * **An impact sub is left out until the deadline of the match it applies
   * from.**
   */
  getTeamForGameWeek(
    leagueId: LeagueId,
    managerId: UserId,
    gameWeekId: GameWeekId,
  ): Promise<GameWeekLineup | undefined>

  /** Everything League Details shows, resolved. */
  getLeagueDetails(leagueId: LeagueId): Promise<LeagueDetails>

  /**
   * Name, team name and roles, banned members excluded. Owner first, then
   * admins, then by name.
   */
  getMembers(leagueId: LeagueId): Promise<LeagueMemberSummary[]>

  // -- the auction, before it runs ------------------------------------------

  /**
   * **What a manager prepares from**: the start, the rules, the batch order and
   * the auctioneer. Reads only the league, never the auction runtime, which
   * does not exist before the auction starts.
   *
   * Open to any signed-in caller. Refused for a league that holds no auction.
   */
  getAuctionSettings(leagueId: LeagueId): Promise<AuctionSettings>

  /**
   * **Every draft position, 1 to the league's slots**, with the manager holding
   * it or none — a position nobody has claimed yet reads as TBA. Positions are
   * claimed as managers join.
   */
  getDraftOrder(leagueId: LeagueId): Promise<DraftOrderEntry[]>

  /**
   * Every player in the auction, with this league's frozen category and base
   * price and the team they play for in this tournament. Ordered by category,
   * then role, then name. The slow read on Auction Center, so it is its own.
   */
  getAuctionPlayerPool(leagueId: LeagueId): Promise<AuctionPoolPlayer[]>

  // -- the auction, running: the auctioneer --------------------------------
  //
  // **Every one of these is the current auctioneer's alone**
  // (`auctionDetails/primaryAuctioneer`), checked here; the panel showing them
  // is convenience. Each writes authoritative state and its timeline entry in
  // one atomic update.

  /** **Creates the live auction**, with every manager on the full budget. */
  startAuction(leagueId: LeagueId): Promise<void>

  /**
   * The next batch in the league's sequence — **in order only**, so it takes
   * nothing to choose. Refused mid-round, and after the last batch.
   */
  nextBatch(leagueId: LeagueId): Promise<void>

  /**
   * Puts a player from the current batch up: "Current player is X", before
   * bidding opens. Clears the previous player's round.
   */
  putUpPlayer(leagueId: LeagueId, playerId: PlayerId): Promise<void>

  /** The same, for a player drawn at random from those left in the batch. */
  putUpRandomPlayer(leagueId: LeagueId): Promise<void>

  /** Opens bidding on the player up, at base price, with the clock running. */
  startBidding(leagueId: LeagueId): Promise<void>

  /**
   * **Accepts one submitted bid**, after checking it again here: it must be
   * the bid the manager actually submitted, at exactly the asking price, before
   * the deadline by this service's clock, from someone who has not passed and
   * can afford it. Moves the price up 0.5 and restarts the clock.
   */
  acceptBid(
    leagueId: LeagueId,
    playerId: PlayerId,
    managerId: UserId,
    amount: number,
  ): Promise<void>

  /** Records a manager's pass, which they submitted. Irreversible. */
  acceptNoBid(
    leagueId: LeagueId,
    playerId: PlayerId,
    managerId: UserId,
  ): Promise<void>

  /** A first, second or last call, onto the timeline. Changes no state. */
  announceCall(leagueId: LeagueId, call: AuctionCall): Promise<void>

  /** Closes bidding once the deadline has passed by this service's clock. */
  markTimeUp(leagueId: LeagueId): Promise<void>

  /**
   * **Sells the player up to the leader at the leading bid**, both read here
   * rather than passed in. One atomic write across status, budget, bid
   * history and the buyer's squad for every match.
   */
  sellPlayer(leagueId: LeagueId): Promise<void>

  /**
   * **The last-resort sale**, to a chosen manager at a chosen price, for when
   * something has broken. Keeps the bidding and adds the sale as the final bid.
   */
  sellPlayerManually(
    leagueId: LeagueId,
    managerId: UserId,
    amount: number,
  ): Promise<void>

  markPlayerUnsold(leagueId: LeagueId): Promise<void>

  /** Freezes the round. Bidding only. */
  pauseAuction(leagueId: LeagueId): Promise<void>

  /** Resumes a paused round with the clock reset to 30 seconds. */
  resumeAuction(leagueId: LeagueId): Promise<void>

  /**
   * More time on the round, 1–60 seconds. After time up, reopens bidding with
   * that much time from now.
   */
  addTimeToCurrentRound(leagueId: LeagueId, seconds: number): Promise<void>

  /** Enters recovery, the only place a rewind is allowed. Between rounds. */
  startRecovery(leagueId: LeagueId): Promise<void>

  /**
   * **Undoes the newest round result** — a sale, unsold, draft pick or skip —
   * and moves the auction back to where it happened. Recovery only; repeated
   * rewinds walk back to the start.
   */
  rewindLastRound(leagueId: LeagueId): Promise<void>

  /** Leaves recovery. */
  endRecovery(leagueId: LeagueId): Promise<void>

  /** Ends the auction; team submission opens. Reversible. */
  endAuction(leagueId: LeagueId): Promise<void>

  /** Reopens an ended auction exactly as it was. */
  reopenAuction(leagueId: LeagueId): Promise<void>

  /**
   * **Everything the Squads page shows**: every manager's squad, the price
   * each player went for, and the eleven to highlight — your own saved XI,
   * anyone else's latest locked one. Auction leagues only; squads are public.
   */
  getSquads(leagueId: LeagueId): Promise<SquadsView>

  /**
   * **The next turn in the draft**; the first call starts it. The order
   * snakes, and anyone who can no longer pick is skipped. Refused while a pick
   * is going through, and once nobody can pick.
   */
  nextDraftManager(leagueId: LeagueId): Promise<void>

  /**
   * **Sells the turn's pick at base price.** Called by the auctioneer's
   * browser as a pick arrives; everything is re-checked here.
   */
  acceptDraftPick(leagueId: LeagueId, turn: number): Promise<void>

  /**
   * **Skips the current manager's turn**, for one taking too long. Separate
   * from Next on purpose, so a double click never skips anyone; Next is
   * refused until the turn has a pick or a skip.
   */
  skipDraftTurn(leagueId: LeagueId): Promise<void>

  /**
   * **Puts the league back to before Start auction**, for testing: the live
   * auction, the squads it filled, and anything built on them — lineups and
   * leaderboards — are deleted. Members and the draft order stay; they come
   * from joining, not from the auction.
   *
   * **Refused in production.** The auctioneer only, in any phase.
   */
  resetAuction(leagueId: LeagueId): Promise<void>

  /**
   * **Marks everyone left in the current bidding batch unsold**, for testing,
   * so the draft can be reached quickly. Between rounds only; the auctioneer
   * only; refused in production.
   */
  markBatchUnsold(leagueId: LeagueId): Promise<void>

  // -- the auction, running: a manager -------------------------------------

  /**
   * **A bid, written to the bidder's own field only** — the manager is the
   * caller, never an argument. Refused for a player not up, after passing,
   * when leading, over budget or with a full squad. Whether it is accepted is
   * the auctioneer's to decide; an invalid one is silently ignored.
   */
  submitBid(
    leagueId: LeagueId,
    playerId: PlayerId,
    amount: number,
  ): Promise<void>

  /** A pass on the player up. **Irreversible for the round.** */
  submitNoBid(leagueId: LeagueId, playerId: PlayerId): Promise<void>

  /**
   * **A pick for the caller's turn in the draft.** One per turn: a second is
   * refused. The auctioneer's browser makes the sale.
   */
  submitDraftPick(leagueId: LeagueId, playerId: PlayerId): Promise<void>

  /**
   * Sets `finishedAt`. Owner and admins only, and refused until the league's
   * last match has started. Never derived.
   */
  markLeagueFinished(leagueId: LeagueId): Promise<void>

  /** Clears `finishedAt`, for a league marked finished too early. */
  unmarkLeagueFinished(leagueId: LeagueId): Promise<void>

  /** Sets `completedAt`, which moves a tournament to Past. System admins only. */
  markTournamentComplete(tournamentId: TournamentId): Promise<void>

  /** Clears `completedAt`, putting the tournament back in Active. */
  unmarkTournamentComplete(tournamentId: TournamentId): Promise<void>

  /**
   * **Both teams' players for a match, from this tournament's squads**, for
   * scoring it. Refused while either team is not yet known, because there is
   * nobody to score.
   */
  getPlayersForMatch(
    tournamentId: TournamentId,
    matchId: MatchId,
  ): Promise<MatchPlayers>

  /** Standard points already entered for a match, to prefill the entry form. */
  getStandardPointsForMatch(
    tournamentId: TournamentId,
    matchId: MatchId,
  ): Promise<PlayerPoints>

  /**
   * **A full replace of one match's standard points.** Blank and zero are the
   * same and stored as absent, so a player missing from `playerPoints` is
   * zeroed. That is why the form must be prefilled before it is shown.
   *
   * **Both index orders, and the tournament's scored-till marker, in one atomic
   * update.** The marker only moves forward, so correcting an earlier match
   * does not pull it back.
   *
   * System admins only, checked here rather than by hiding the page.
   */
  updateStandardPoints(
    tournamentId: TournamentId,
    matchId: MatchId,
    playerPoints: PlayerPoints,
  ): Promise<void>

  /**
   * **Regular leagues: the whole tournament pool.** An auction league picks
   * from its squad instead, which is filtered by match because squad membership
   * changes with transfers.
   */
  getSelectablePlayers(leagueId: LeagueId, matchId: MatchId): Promise<Player[]>

  getMyTeamForMatch(
    leagueId: LeagueId,
    matchId: MatchId,
  ): Promise<MatchLineup | undefined>

  getMyTeamForGameWeek(
    leagueId: LeagueId,
    gameWeekId: GameWeekId,
  ): Promise<GameWeekLineup | undefined>

  /**
   * The eleven that stands going into a gameweek — the one a change is measured
   * against.
   *
   * **The last gameweek with a saved team, not necessarily the one before.** A
   * team applies forward until changed, so someone who skipped a gameweek is
   * still fielding what they had. And **after an impact sub, the eleven at the
   * end of that gameweek**, since that is who is actually in the team next.
   *
   * Absent for the first gameweek and for a manager's first ever team, where
   * there is nothing to differ from.
   */
  getMyTeamBeforeGameWeek(
    leagueId: LeagueId,
    gameWeekId: GameWeekId,
  ): Promise<LineupSubmission | undefined>

  /**
   * **An illegal team is rejected here**, not merely disabled in the form.
   *
   * **A team applies forward until changed again**, so this writes every match
   * from this one to the end of the tournament. The layer owns that; the
   * interface only warns about it.
   */
  updateTeamForMatch(
    leagueId: LeagueId,
    matchId: MatchId,
    lineup: LineupSubmission,
  ): Promise<void>

  /** **Propagates forward** to every later gameweek, like a match team. */
  updateTeamForGameWeek(
    leagueId: LeagueId,
    gameWeekId: GameWeekId,
    lineup: LineupSubmission,
  ): Promise<void>

  // -- system --------------------------------------------------------------

  setUpBasicSystem(): Promise<SystemSetupResult>

  /**
   * Two international T20 squads, so there is something to pick from.
   *
   * **Test data, not reference data.** It creates the teams it needs if they
   * are missing, puts every player in the T20 Series, and skips any name
   * already in the catalogue.
   */
  createSamplePlayers(): Promise<SamplePlayersResult>

  /**
   * **Wipes the environment**: every player, team, tournament and league,
   * with everything that points at them. Users, base tournaments and the
   * standards stay. System owner only; refused once released.
   */
  resetEnvironment(): Promise<ResetEnvironmentResult>

  /**
   * **Loads the IPL 2026 pool into an empty environment.** Refused if any
   * players or teams exist — reset first. System owner only; refused once
   * released.
   */
  populateSeedData(): Promise<SeedDataResult>

  /**
   * **An unpublished IPL 2027 on the 2026 schedule**, so testing publish and
   * everything after it does not start with entering 74 matches by hand.
   *
   * Every IPL team and every player in one, the 70 league fixtures with their
   * dates and venues, the four playoffs dated but TBA vs TBA, and three rounds:
   * League stage, Playoffs, Final. **Refused in production, and refused if an
   * IPL 2027 already exists.**
   */
  createSampleIplTournament(): Promise<SampleTournamentResult>

  /**
   * **Rewrites the reference tables and the standards** from the seed data,
   * leaving every player, team, tournament and league alone. System owner only;
   * refused once the environment is released.
   */
  refreshStandards(): Promise<StandardsRefreshResult>

  /** Which environment this is, and whether it has been released. */
  getSystemStatus(): Promise<SystemStatus>
}
