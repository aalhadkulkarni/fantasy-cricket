# Data Layer

Every read, write and subscription the app needs, organised by the page that
needs it.

**This is a specification of the surface, not of the implementation.** Method
names here are the agreed vocabulary. Exact signatures, return shapes and how
calls are grouped into modules are yours to settle — but the boundary rules
below are not.

---

## Why this layer exists

**Phase 2 replaces Firebase with a real backend.** The data layer is the seam
that makes that possible without touching anything above it.

Four rules follow, and none is negotiable:

1. **No component imports Firebase.** Ever.
2. **No Firebase-shaped type crosses the boundary.** Snapshots, references and
   RTDB-specific objects stay inside.
3. **All reads, writes and subscriptions go through the layer.**
4. **Reads and subscriptions are distinct.** A one-shot fetch and a live
   listener are different things with different lifecycles.

If Firebase leaks upward, the Phase 2 promise breaks and the layer was pointless.

---

## The layer is the server

**Any rule that will be a server-side check in Phase 2 is enforced here now.**

The data layer is effectively the Phase 1 server. UI gating is convenience; this
is the actual guard. It applies to:

- **Team visibility** — a manager's team for a match is returned to others only
  after that match's deadline
- **Join deadlines** — a join after the deadline is rejected here, not merely
  hidden in the UI
- **Squad validity** — an illegal XI cannot be submitted
- **Bid legality** — budget, asking price, deadline
- **Transfer validity** — ownership, legal XI on both sides, points balances
- **Ban checks**

> Hiding something in the UI is not enforcement. Anyone can read the database
> directly with the client SDK.

---

## Conventions

### Identity comes from context, not from parameters

**Where a call needs to know _who is asking_, it takes that from context — never
as an argument.**

```
getMyTeam(leagueId, matchId)              // correct
getMyTeam(currentUserId, leagueId, ...)   // wrong
```

**Where a parameter identifies _who is being acted upon_, it stays a parameter**
and is named accordingly — `targetUserId`, `requestedUserId`, `managerId`.

```
banManager(leagueId, targetUserId)        // correct
getTeamFor(leagueId, managerId, matchId)  // correct
```

> **Why:** a client-supplied "who is asking" is exactly the cheating vector on
> team visibility. In Phase 2 the server reads identity from the session and
> never trusts a client value. The layer should behave the same way now, so
> nothing above it has to change later.

### Subscriptions

**Shape:** `functionName(params..., callback)`

Two things to settle at implementation:

- **Unsubscribe.** RTDB listeners leak if not detached. Return an unsubscribe
  handle — that is what a `useEffect` cleanup expects.
- **Errors.** A subscription can fail with permission denied or a lost
  connection, and a single callback has nowhere to report it. Pick `(error,
data)` or a second error callback, and apply it uniformly.

### One auction per league

Auctions are keyed by `leagueId`. **There is no `auctionId`** — a league has
exactly one auction, so a separate identity would only force a lookup back to
the league.

---

## Three decisions that shape the implementation

### 1. The leaderboard is one subtree read, not N calls

Points are **computed on the fly.** There is no materialised alternative,
because standard points cannot be pre-computed into every league for every
manager.

**So: read `lineups/{leagueId}` once, read the points node once, and compute in
the layer.** Not one call per manager.

At the expected size — twenty managers, sixty-four matches — that is roughly
100KB across three reads, and the arithmetic is single-digit milliseconds.

### 2. Points computation belongs in the layer

Summing player points across a manager's teams, applying captain and
vice-captain multipliers, and layering transfer adjustments — **all of it happens
here.** That logic belongs on a server, and this is the Phase 1 server.

**The multipliers are 2x for the captain and 1.5x for the vice-captain, and
they are fixed.** The vice-captain is **not** promoted to 2x when the captain
does not play.

### 3. Squad membership depends on the match

After a transfer, an incoming player is available from the next match onward. So
`getSquad` takes a match — the squad at match 25 is not the squad at match 35.

This matters most in team selection, where the player dropdown is filtered by
squad.

---

# Calls by page

## Login

**Reads**

- `getUserByGoogleIdentifier(googleIdentifier)` — resolves the auth identity to
  a user record, or nothing if this is a first visit

**Writes**

- `createUser(googleIdentifier, email, displayName)` — **claims
  `googleIdentifierToUserIdMapping/{googleIdentifier}` transactionally** before
  writing the user

> **The same person can arrive twice.** Two tabs, a double-tapped button, a
> retry after a timeout: both attempts find no user record and both create one,
> and because ids are push keys the result is two distinct records for one
> human rather than an overwrite. Nothing detects that afterwards. Whoever
> claims the mapping first wins; the loser discards its draft and adopts the
> winner's id.

> `googleIdentifier` is deliberately non-committal — it may end up being the
> Google user id or the email. Decide at implementation based on how Firebase
> auth actually behaves; nothing else in the model depends on which.

---

## Site header

**Reads**

- `getCurrentUser()`
- `getActionsCount()`

The count is fetched once at load and held in a store, not re-fetched per page.

---

## Actions Center

**Reads**

- `getActions()` — derived entirely from standing conditions

**Subscriptions**

- `onActionReceived(callback)`

**No writes.** Actions cannot be marked done — they disappear when the
underlying thing resolves.

> **Known gap:** new items arrive by subscription, but items _disappearing_
> because they were resolved elsewhere are not covered. A slightly stale count
> is acceptable.

---

## My Leagues

**Reads** — one per tab, preserving the lazy-load boundary

- `getActiveLeagues()` — joined and spectated, merged
- `getPendingLeagues()`
- `getArchivedLeagues()` — reads `users/{uid}/archivedLeagues`, and only when
  that tab is opened
- `getRejectedLeagues()` — fetched only when the side panel is opened

**Writes**

- `requestToJoin(leagueId, teamName)`
- `requestToJoinAsSpectator(leagueId)`

**Subscriptions**

- `onJoinRequestResolved(callback)`

### The index alone is not enough, and that is accepted

The card carries a **status** and a **count**, and neither is in the user's
league index. Status is derived from timings, and `filledSlots` is derived by
counting members who hold the manager role. So `getActiveLeagues` reads the
index and then makes a small number of further reads per league.

**Read `leagues/{leagueId}/leagueMembers`, never `leagues/{leagueId}`.** Reads
are subtree-shaped, so reading the league pulls its auction config — a base
price and category for every player in the tournament — plus the whole gameweek
structure. That is twenty to thirty kilobytes per league against roughly one,
on the page users return to daily, and avoiding exactly that is why the index
exists at all.

Status derivation additionally needs `finishedAt`, the auction start time, the
live auction phase for auction leagues, and the first match's start time. The
first three are league-scoped narrow reads. **The tournament is read once per
distinct `tournamentId`, not once per league**, since leagues cluster on
tournaments.

> **The live auction phase is usually absent here, and that is the answer, not
> a failure.** `liveAuctions/{leagueId}` is created by `startAuction` and by
> nothing else, so an auction league sitting in the pre-auction state — which is
> where it sits for weeks, on this very page — has no such node. **Absence means
> the auction has not started**, which is exactly what the derivation needs to
> conclude. Treating it as an error, or dereferencing it unguarded, is the
> likeliest place for that bug to land in the whole product.

> **Why no stored counter.** A `slotsUsed` field would have to fan out to every
> existing member's index entry on every join, which is the most frequent write
> in the model.

> **Why the timings are not copied into the index either.** They change once or
> rarely, so the fan-out objection does not apply, and copying them would make
> status free. They are still not copied because a failed fan-out leaves one
> member's entry permanently wrong, and since the archive migration keys off
> `finishedAt`, that member's league would then never archive. Reads are always
> correct; a stale copy is silently and permanently wrong.

### Archiving is a lazy migration, and it must be atomic

A league belongs in Archived once `finishedAt` is set **and** the current time
is past `finishedAt` plus 24 hours. Phase 1 has no scheduler, so nothing moves
it at that moment.

**`getActiveLeagues` performs the move**, for the current user's own entries
only, whenever it encounters one that has crossed the boundary. Each user
migrates their own subtree, so there is no contention, and repeating it is
harmless.

> **One atomic multi-path `update()`** writing `users/{uid}/archivedLeagues/{lid}`
> and deleting `users/{uid}/leagues/{lid}` together. **Never a write followed by
> a delete.** RTDB cannot answer "which leagues contain this user", which is the
> entire reason this index exists, so a lost entry cannot be rebuilt and would
> hide that league from that user permanently.

> **The record moves unchanged**, plus the snapshot below. The archived _card_
> renders less; the stored entry does not shrink, because a shrunk record cannot
> be moved back.

**The move snapshots the manager's final position** — their rank and the number
of managers it was out of. It is computed once, ever, at migration.

> This does not violate "points are never stored per manager". That rule exists
> so corrections propagate, and marking a league finished is precisely the
> assertion that no corrections remain, so the value is immutable from that
> moment.

> **Best effort.** If the leaderboard computation fails, the move still happens
> and the card omits the position. There is no retry machinery in Phase 1.

> **Membership is never decided from this index.** It is a view. Now that
> archived entries live elsewhere, any check that asks "is this user in this
> league" must read `leagues/{leagueId}/leagueMembers/{userId}`, which is the
> source of truth. See `docs/04-navigation.md`.

---

## Tournaments

**Reads**

- `getTournaments(status)` — upcoming, active or past. **Published only**: a
  tournament with no `publishedAt` is never returned to a non-admin caller.
- `getTournament(tournamentId)`
- `getFixtures(tournamentId)`
- `getTeamsForTournament(tournamentId)`
- `getPlayersForTournament(tournamentId)`
- `getLeaguesForTournament(tournamentId)` — the thin index, not full leagues

**Writes**

- The join-request calls, same as My Leagues

**Subscriptions**

- `onLeagueAddedToTournament(tournamentId, callback)`

**Filtering is client-side.** The list is small and already fetched.

---

## Join by code

**Reads**

- `getLeagueByCode(code)`

**Writes**

- `joinLeague(leagueId, teamName)` — public leagues
- `requestToJoin(leagueId, teamName)` — closed leagues

> **A code is a shortcut, not a bypass.** A closed league still requires
> approval.

---

## Create League

**Reads**

- `getPublishedTournaments()` — those carrying a `publishedAt`. This is what
  populates the tournament dropdown, so an unpublished tournament cannot have a
  league created against it.
- `getRoundsForTournament(tournamentId)` — needed to configure gameweeks per
  round
- `getStandardAuctionConfig()`
- `getStandardLineupRules()`

**Writes**

- `createLeague(config)` — returns the new league id and its join code. **The
  code is claimed transactionally** on `leagueCodeToLeagueMapping`, retrying
  with a fresh one on failure, since a read-then-write check can lose.

The config object carries everything on the create form: tournament, name,
accessibility, max slots, join deadline, deadline offset, points source and
description, whether an auction is held, round and gameweek structure, change
allowances, and the full auction configuration.

> Creating a league also writes both indexes — the creator's league index and
> the tournament's league index — **in the same atomic multi-path update.**

---

## League home

**Reads**

- `getLeagueSummary(leagueId)` — name, code, phase, next deadline, your rank

**Subscriptions**

- `onLeagueSummaryChanged(leagueId, callback)`

> **Phase is derived, not stored.** The layer computes it from auction state,
> deadlines and `finishedAt`.

---

## League Details

**Reads**

- `getLeagueConfig(leagueId)` — everything passed to `createLeague`, plus which
  fields are currently editable

**Writes**

- `updateLeagueConfig(leagueId, changes)`
- `assignAuctioneer(leagueId, targetUserId)`
- `assignBackupAuctioneer(leagueId, targetUserId)`

**Subscriptions**

- `onLeagueConfigChanged(leagueId, callback)`

> **Edit locks are enforced here.** The layer rejects a write to a locked field
> rather than relying on the form to disable it. Returning _which_ fields are
> currently editable lets the UI reflect the same rules without duplicating them.

---

## Admin Center

**Reads**

- `getJoinRequests(leagueId)` — pending and rejected
- `getMembers(leagueId)` — with roles
- `getBannedUsers(leagueId)`

**Writes**

- `acceptJoinRequest(leagueId, requestedUserId)`
- `rejectJoinRequest(leagueId, requestedUserId)`
- `rejectJoinRequestAndBan(leagueId, requestedUserId)`
- `banManager(leagueId, targetUserId)`
- `unbanUser(leagueId, targetUserId, roleToGrant)`
- `makeAdmin(leagueId, targetUserId)`
- `revokeAdmin(leagueId, targetUserId)`
- `markLeagueFinished(leagueId)`

**Subscriptions**

- `onJoinRequestReceived(leagueId, callback)`

> **The owner cannot be removed as admin.** Enforced in the layer.

> Accepting a join request writes the membership _and_ the new member's league
> index, atomically.

---

## My Team

**Reads**

- `getCurrentRound(leagueId)`
- `getCurrentGameWeek(leagueId)`
- `getCurrentMatch(leagueId)`
- `getMyTeamForGameWeek(leagueId, gameWeekId)` — the lineup per match, plus the
  impact sub
- `getMyTeamForMatch(leagueId, matchId)`
- `getSquad(leagueId, matchId)` — auction leagues; what may be selected
- `getSelectablePlayers(leagueId, matchId)` — regular leagues; the tournament
  pool
- `getPointsForMatch(leagueId, matchId)` — reads custom **or** standard
  according to the league's `isCustomScoringSystem` flag. **Not a fallback
  chain:** a custom-scoring league never reads standard points, so a match its
  admin has not entered yet has no points rather than borrowed ones.
- `getChangesRemaining(leagueId, roundId)`

**Writes**

- `updateTeamForGameWeek(leagueId, gameWeekId, team)`
- `updateTeamForMatch(leagueId, matchId, team)`
- `setImpactSub(leagueId, gameWeekId, outPlayerId, inPlayerId, fromMatchId)`

> The current-round and current-gameweek calls exist as their own reads rather
> than being taken from league config, because a user may sit on the page long
> enough for a deadline to pass beneath them.

> **A team write propagates forward** — it applies to every subsequent match
> until changed again. The layer owns that behaviour; the UI only warns about it.

> **An illegal team is rejected here**, not merely disabled in the form.

---

## Leaderboard

**Reads**

- `getLeaderboard(leagueId)` — overall
- `getLeaderboardForGameWeek(leagueId, gameWeekId)`
- `getLeaderboardForMatch(leagueId, matchId)`
- `getScoringWatermark(leagueId)` — the match up to which points are entered
- `getTeamFor(leagueId, managerId, matchId)` — subject to the visibility rule

> **Each leaderboard call is one subtree read plus computation**, not one call
> per manager. See decision 1 above.

> `getTeamFor` **enforces visibility inside the layer.** If the deadline has not
> passed and the requester is not that manager, it returns nothing — it does not
> return the team and trust the caller to hide it.

---

## Members

**Reads**

- `getMembers(leagueId)` — name, team name, admin badge

**Subscriptions**

- `onMemberJoined(leagueId, callback)`

---

## Squads

**Reads**

- `getSquad(leagueId, matchId)` — your own
- `getAllSquads(leagueId, matchId)`
- `getLockedTeamFor(leagueId, managerId, matchId)` — for the XI highlighting

> Squads are always public. Only the **locked** XI is highlighted for other
> managers.

---

## Transfers Center

**Reads**

- `getIncomingOffers(leagueId)`
- `getOutgoingOffers(leagueId)`
- `getMyCompletedTransfers(leagueId)`
- `getAllCompletedTransfers(leagueId)`
- `getTransferWindow(leagueId)` — the current window, or none
- `getAllSquads(leagueId, matchId)` — for the offer builder
- `getPointsBalance(leagueId, managerId)` — so an offer cannot exceed it

**Writes**

- `proposeTransfer(leagueId, targetManagerId, offer)`
- `acceptTransfer(leagueId, transferId)`
- `rejectTransfer(leagueId, transferId, reason)`
- `withdrawTransfer(leagueId, transferId)`

**Subscriptions**

- `onTransferOfferReceived(leagueId, callback)`
- `onTransferResolved(leagueId, callback)`

> **Validation runs three times, all in the layer:** at proposal, again at
> acceptance, and on acceptance re-checking both parties' other offers and
> auto-rejecting any now invalid.

> **Window-close rejection is lazy, because Phase 1 has nothing to run it on a
> schedule.** An offer still pending when its window's last match starts is
> dead, but no client is necessarily open at that moment to say so. The layer
> therefore infers the outcome on the next read of that offer and writes the
> rejection then. Callers never see a pending offer from a closed window.

> **Accepting a transfer is one atomic write** touching both squads, both points
> adjustments, and the offer's status.

> **A known concurrency risk, accepted:** two managers accepting conflicting
> offers for the same player in the same instant could both pass validation.
> Rare, both parties are human, and an admin can correct it.

---

## League points entry — custom-scoring leagues

**Reads**

- `getNextUnscoredMatch(leagueId)`
- `getEligiblePlayersForMatch(leagueId, matchId)`
- `getCustomPointsForMatch(leagueId, matchId)` — to prefill

**Writes**

- `updateCustomPoints(leagueId, matchId, playerPoints)`

> **This is a full replace.** Blank and zero are equivalent, so submitting
> rewrites every player's value for that match. Prefill must be reliable.

---

## Auction Center

**Split by phase, because the load-bearing fact is what pre-auction does _not_
read.** See `08-pages/auction-center.md`.

### Pre-auction — no auction-runtime reads at all

- `getLeagueConfig(leagueId)` — the rules summary, and the **scheduled auction
  start**, which lives on the league rather than in the runtime
- `getMembers(leagueId)` — who is bidding, and who holds the auctioneer roles

> **`liveAuctions/{leagueId}` does not exist yet.** It is created by
> `startAuction` and by nothing else, so before an auction begins there is no
> node to read. **The layer must treat an absent runtime node as the normal
> pre-auction case, not as an error** — this is exactly the shape that produces
> a null-reference bug on first implementation.

> **`NotStarted` is not this moment.** That phase describes the state after the
> auctioneer has opened the room and before the first player goes up, not the
> weeks preceding it.

### Live and after — existing calls, reused

Same calls as the live auction page, but as **one-shot reads rather than
subscriptions**.

- `getAuctionState(leagueId)`
- `getAuctionPlayerPool(leagueId)`
- `getSoldPlayers(leagueId)` / `getUnsoldPlayers(leagueId)`
- `getManagerStatuses(leagueId)`
- `getDraftOrder(leagueId)`

**One subscription, and only in the live state:** `onAuctionStateChanged`, so
the button and the running counts stay current. The detailed live subscriptions
belong to the auction page itself.

### On drill-down only

- `getPlayerBiddingHistory(leagueId, playerId)` — every bid on one player, in
  order

> **Never fetched with the page.** The full history for every player is the
> entire auction, so it is read one player at a time, when asked for.

**No writes.** Auction Center changes nothing. Its only action is navigation.

---

## Auction — shared display

**Reads**

- `getAuctionState(leagueId)` — current player, phase, batch, leading bid,
  minimum next bid, deadline. **Needed because a client joining mid-round has no
  transition to receive.**
- `getAuctionPlayerPool(leagueId)`
- `getSoldPlayers(leagueId)`
- `getUnsoldPlayers(leagueId)`
- `getRemainingPlayers(leagueId)`
- `getManagerStatuses(leagueId)` — budget and squad size per manager
- `getDraftOrder(leagueId)`

**Subscriptions**

- `onAuctionStateChanged(leagueId, callback)`
- `onTimelineEvent(leagueId, callback)`

> **The countdown is computed client-side against Firebase server time**, never
> the local clock, from the deadline in auction state.

---

## Auction — bidder

**Writes**

- `submitBid(leagueId, playerId, amount)`
- `submitNoBid(leagueId, playerId)`

> These write **only** to the bidder's own path. That is the entire reason the
> auction is safe without transactions — see `docs/05-data-model.md`.

> **Passing is irreversible for that round.** The layer rejects a bid from
> someone who has already passed on the current player.

> **A bid that would overdraw the budget is rejected.**

---

## Auction — auctioneer

**Writes**

- `startAuction(leagueId)`
- `generateDraftOrder(leagueId)`
- `selectBatch(leagueId, category, role)` — **ids, not display names**, matching
  how `currentBatch` stores them
- `selectPlayer(leagueId, playerId)`
- `selectRandomPlayerFromBatch(leagueId)`
- `acceptBid(leagueId, playerId, managerId, amount)`
- `acceptNoBid(leagueId, playerId, managerId)`
- `sellPlayer(leagueId, playerId, managerId, amount)` — updates bid history,
  writes the player into that manager's squad, decrements their budget. **The
  squad is written here, on every sale, not materialised when the auction
  ends**, so squads are correct at every point during the auction.
- `markPlayerUnsold(leagueId, playerId)`
- `pauseAuction(leagueId)`
- `resumeAuction(leagueId)`
- `addTimeToCurrentRound(leagueId, seconds)`
- `rewindLastRound(leagueId)` — rewrites the player's bid subtree entirely and
  restores budgets and squad membership
- `startDraft(leagueId)`
- `acceptDraftPick(leagueId, playerId, managerId)`
- `endAuction(leagueId)`
- `handOffAuctioneerRole(leagueId, targetUserId)` — **one atomic multi-path
  write** covering both the auctioneer roles on the membership records and the
  `primaryAuctioneer` field on the auction config. The duplication is
  deliberate, so that showing who the auctioneer is costs one field read rather
  than a scan of every member's roles; the two must never be written separately.

**Subscriptions**

- `onBidSubmitted(leagueId, callback)` — the auctioneer validates against the
  asking price and deadline, then accepts or ignores
- `onNoBidSubmitted(leagueId, callback)`
- `onDraftPickSubmitted(leagueId, callback)`

> **Rejection is silence.** There is no explicit reject call — an invalid bid is
> simply not accepted.

> `sellPlayer` is one atomic write across bid history, squad and budget.

---

## System admin

**Reads**

- `getCompetitions()` / `getCompetition(id)`
- `getTournaments()` / `getTournament(id)`
- `getTeams(filter)` — by competition, tournament or format
- `getPlayers(filter)` — by team, competition or format
- `getMatch(matchId)`
- `getFormats()`

**Writes — cricket reference data**

- `createCompetition(config)` / `updateCompetition(id, changes)`
- `createTeam(team)` / `createTeams(teams)` / `updateTeam(id, changes)`
- `createPlayer(player)` / `createPlayers(players)` / `updatePlayer(id, changes)`
- `setCurrentTeam(competitionId, playerId, teamId)` — the **only** writer of a
  player's current team
- `addPlayerToTeam(teamId, playerId)` / `removePlayerFromTeam(teamId, playerId)`

> **There is no per-format retirement call.** Retiring a player from a
> competition means removing that competition from their `currentTeams`, which
> `setCurrentTeam` and its inverse already cover. A player can retire from T20
> internationals and still play the IPL, so a format-level flag would be wrong
> at the source. Full retirement from cricket is the separate `isRetired` case,
> which is the one thing absence from `currentTeams` cannot express, since an
> empty map is indistinguishable from a newly created player.

- `markPlayerAsRetired(playerId)` / `markPlayerAsUnRetired(playerId)` — the
  full-retirement flag only, not per format and not per competition

**Writes — tournaments**

- `createTournament(config)` — reads each player's current team to prefill, and
  writes the tournament-scoped mapping. **It does not write back.**
- `updateTournamentPlayers(tournamentId, players)`
- `updateMatch(matchConfig)` / `updateMatches(matchConfigs)` — **also recompute
  the tournament's `startDate` and `endDate`, in the same atomic write**
- `publishTournament(tournamentId)` — sets `publishedAt`. **Rejected here** if
  no match has a start time yet, rather than merely disabled in the admin UI.
- `markTeamEliminated(tournamentId, teamId, fromMatchId)`
- `markTournamentComplete(tournamentId)` — sets `completedAt`. Never set
  automatically; the layer only records the admin's assertion that every point
  and correction is in.

**Writes — scoring**

- `updateStandardPoints(tournamentId, matchId, playerPoints)`

**Writes — access**

- `grantSystemAdmin(targetUserId)`

> **Tournament timing is maintained on write, never derived on read.**
> `startDate` and `endDate` are the earliest and latest match start times, and
> they are the only thing anything reads to place a tournament in the Upcoming,
> Active or Past tab, or to find a league's first match deadline. Any write that
> touches a match start time must recompute both in the same multi-path
> `update()`, or they drift and every reader is wrong at once. `endDate` is left
> absent while any match is undated.

> **The admin flow is: set current teams first, then create the tournament.**
> Tournament creation prefills from current teams but never writes back to them.

> **Standard points must write both index orders in one atomic update**, or the
> match-major and player-major copies diverge.

---

# Open at implementation

| Item                            | What needs deciding                                                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Subscription error handling** | `(error, data)` or a separate error callback. Pick one and apply it everywhere.                                                                     |
| **Unsubscribe shape**           | Returned handle, or a matching `off` call. A returned handle fits React cleanup better.                                                             |
| **`googleIdentifier`**          | Google user id or email. Depends on how Firebase auth behaves in practice.                                                                          |
| **Timeline construction**       | Whether the timeline is derived in the UI from the event subscription, or read as its own list.                                                     |
| **Squad derivation**            | Whether a squad is computed from auction wins plus transfers, or materialised and mutated. Decides whether the match parameter filters or looks up. |
| **Auctioneer presence**         | No calls specified — Phase 2. For now an admin reassigns manually.                                                                                  |

> **These are marked open deliberately.** Do not pick one and proceed — raise it
> and we decide together, per `docs/02-working-with-me.md`.
