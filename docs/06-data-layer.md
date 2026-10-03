# Data Layer

Every read, write and subscription the app needs, organised by the page that
needs it.

**This is a specification of the surface, not of the implementation.** Method
names here are the agreed vocabulary. Exact signatures, return shapes and how
calls are grouped into modules are yours to settle — but the boundary rules
below are not.

**Treat the function lists loosely.** They say roughly what the layer must
support, what goes into each call and what comes back out. They are not a fixed
API. Adding a function, splitting one, renaming one, or changing what it takes
and returns is fine whenever the use case calls for it. Nothing below should be
preserved just because it is written down.

> **Reads and writes need not use the same shapes.** A write may accept a
> resolved object and pull the id out of it inside the layer, so the caller
> never has to unpack anything first. Whether a given call does that is a
> per-function judgement, not a rule.

---

## Why this layer exists

**The backend arrived, and nothing above this layer changed.** That was the
point of the seam: `getApi()` returns `HttpApi` instead of `FirebaseApi`, the
browser holds no database access, and the implementation now runs in
`apps/api` against the Admin SDK. The rules below are why that swap cost one
line.

Four rules follow, and none is negotiable:

1. **No component imports Firebase.** Ever.
2. **No Firebase-shaped type crosses the boundary.** Snapshots, references and
   RTDB-specific objects stay inside.
3. **All reads, writes and subscriptions go through the layer.**
4. **Reads and subscriptions are distinct.** A one-shot fetch and a live
   listener are different things with different lifecycles.
5. **The schema does not leak either.**

Firebase leaking upward would have made that swap a rewrite instead of a line.

### On the fifth rule

**This layer is the contract between client and server** — the equivalent of a
set of REST endpoints. Everything above it is a client talking to a server that
happens to run in the same process for now.

So **no function may require its caller to know how the backend schema is
shaped**, in its parameters or in what it returns. Concretely, a caller must
never need to know:

- that lineups are split across `matchBasedLineups` and `gameWeekBasedLineups`
- that points are held in both a match-major and a player-major copy
- that a league's tournament name is denormalised into the user's league index
- that the live auction node does not exist until the auction starts

Each of those is a storage decision made to suit how Realtime Database reads.
They are the layer's business and nobody else's. A signature that exposes one is
a signature that Phase 2 will have to break.

> **The test:** could this function be reimplemented against a completely
> different backend without changing its callers? If not, the schema is showing
> through.

---

## The layer is the server

**Every rule is enforced in `apps/api`, and is now genuinely enforced**: the
database refuses clients outright, so the only way to its data is through an
endpoint that checks first. UI gating is convenience; this is the guard. It
applies to:

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
getTeamForMatch(leagueId, managerId, matchId)  // correct
```

> **Why:** a client-supplied "who is asking" is exactly the cheating vector on
> team visibility. The server reads identity from the verified token and
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

Points are **computed on the fly.** There is no materialised source of truth,
because standard points cannot be pre-computed into every league for every
manager, and storing totals would mean a correction had to chase every manager it
touched.

**A leaderboard is however kept as a cache.** Each computed standing is stored
under `leaderboards/{leagueId}` and served until something it came from changes.
It is derived, rebuilt on demand and never edited, so a correction is still one
number and every view is right on its next read. See "Leaderboard" below.

**So: read the league's lineups node once — `matchBasedLineups/{leagueId}` or
`gameWeekBasedLineups/{leagueId}` depending on the league type — read the points
node once, and compute in the layer.** Not one call per manager.

At the expected size — twenty managers, sixty-four matches — that is roughly
100KB across three reads, and the arithmetic is single-digit milliseconds.

### 2. Points computation belongs in the layer

Summing player points across a manager's teams, applying captain and
vice-captain multipliers, and layering transfer adjustments — **all of it happens
here.** That logic belongs on a server, and now runs on one.

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

- `getCurrentUser()` — the signed-in person's record, or **nothing when they are
  authenticated but have no record yet**
- `onAuthChanged(callback)` — whether anyone is signed in, and who

**Writes**

- `signInWithGoogle()` / `signOut()`
- `createUser(userName)` — writes the record for the signed-in person

### `users/` is keyed by the Firebase Auth UID

**There is no table translating an auth identity into an id of our own**, and no
transactional claim at sign-up.

The UID is what a Phase 2 security rule can verify, since `auth.uid` resolves to
exactly it, and it is immutable where an email address is not.

> **This removes the duplicate-account problem rather than guarding against it.**
> The same person can arrive twice — two tabs, a double-tapped button, a retry
> after a timeout. All of them address `users/{sameUid}`, so two records for one
> human cannot happen. There is nothing to claim and no race to lose.

**Only the display name can differ**, and last write wins. Both tabs can reach
the modal and submit different names; one of them is discarded. Accepted rather
than solved, for the same reason as before: the alternative is asking someone
which of their own two names they meant.

### The lookup is the guard, not `isNewUser`

**`getCurrentUser()` returning nothing is what says "show the display-name
modal".** Never `getAdditionalUserInfo(result).isNewUser`.

That flag reports whether _Firebase Auth_ just created the account, which is a
different question from whether _we_ have a record. Someone who signs in,
abandons the modal and returns is `isNewUser: false` with still no record — the
exact mid-creation state `08-pages/login.md` requires the app to route back
into.

### Identity is never a parameter

`createUser` takes only the display name. The UID, the email and the Google
subject all come from the auth session, because a client-supplied identity is
the cheating vector this layer exists to close.

> **The Google subject is stored and never read.** It is insurance: if the
> Firebase project were deleted, it is the only thing that could say which
> person a `userId` belonged to.

### Sign-in uses a popup

Three outcomes, and only one is a failure:

| Firebase code                  | Treatment                                                |
| ------------------------------ | -------------------------------------------------------- |
| `auth/popup-blocked`           | A real message. Nothing on screen explains it otherwise. |
| `auth/popup-closed-by-user`    | **Not an error.** They changed their mind.               |
| `auth/cancelled-popup-request` | Ignored. A second popup superseded the first.            |

> **Popup rather than redirect**, and not only because it is simpler.
> `signInWithRedirect` breaks on browsers that partition third-party storage
> unless the auth handler is self-hosted, which makes it the more fragile option
> on a product used mostly on phones.

`account-exists-with-different-credential` cannot occur with a single provider.
Nothing handles it.

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

> **In an auction league, joining as a manager also claims a draft position** —
> a random one nobody holds yet, **claimed transactionally** like a join code,
> so two simultaneous joins can never hold the same one. If the membership
> write then fails, the position is released. No position left means the
> league is full.

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
- `markLeagueFinished(leagueId)` — refused until the last match has started,
  since nothing records a match ending. `unmarkLeagueFinished(leagueId)` puts a
  league finished too early back. Both owner and admins only. Until Admin
  Center exists, the action lives on League Details.
- `deleteLeague(leagueId)` — **owner only, and only while the owner is the
  league's only member**

> **This exists for one case: a league created twice by mistake.** A league has
> no natural key, correctly, since two people running leagues with the same name
> is legitimate. So a double-tapped Create produces two distinct leagues and
> something has to remove the spare.

> **The emptiness condition is the whole safety story.** Once anyone else has
> joined, the league holds other people's season, and no confirmation dialog
> makes that safe to destroy. Enforced here, not in the button.

> **One atomic multi-path `update()`, or it leaves orphans.** A league's data
> spans eleven nodes keyed by `leagueId` — `leagues`, `matchBasedLineups`,
> `gameWeekBasedLineups`, `squads`,
> `joinRequests`, `bannedUsers`, `transferProposals`,
> `transferProposalsByManager`, `liveAuctions`, `customPointsByMatch` and
> `customPointsByPlayer` — plus four reverse references:
> `leagueCodeToLeagueMapping/{code}`,
> `tournaments/{tournamentId}/leagues/{leagueId}`, and the owner's entry in
> `users/{userId}/leagues`. Most are empty under the emptiness condition; clear
> them anyway, so a bug in that check cannot leave a half-deleted league behind.

> **The index reference is the one that must not survive.** As recorded under My
> Leagues, `users/{userId}/leagues` cannot be rebuilt, so a leftover entry there
> points at a league that no longer exists and the owner cannot clear it
> themselves.

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
- `getSelectablePlayers(leagueId, matchId)` — **one call for both kinds of
  league**, diverging only here: a regular league gets the tournament pool, an
  auction league the caller's squad at that match. My Team asks per period.
- `getPlayerPointsForMatch(leagueId, matchId)` — reads custom **or** standard
  according to the league's `isCustomScoringSystem` flag. **Not a fallback
  chain:** a custom-scoring league never reads standard points, so a match its
  admin has not entered yet has no points rather than borrowed ones.
- `getPlayerPointsForMatches(leagueId, matchIds)` — the same for several
  matches in one request, one entry per match in the order asked. **What a
  gameweek's points are read with**, so a gameweek costs one round trip however
  many matches it holds.
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

- `getLeaderboardForLeague(leagueId)` — overall
- `getLeaderboardForGameWeek(leagueId, gameWeekId)`
- `getLeaderboardForMatch(leagueId, matchId)`
- `getScoringWatermark(leagueId)` — the match up to which points are entered
- `getPointsForMatch(userId, leagueId, matchId)`,
  `getPointsForGameWeek(userId, leagueId, gameWeekId)` and
  `getPointsForLeague(userId, leagueId)` — one manager's score. The leaderboard
  runs the same computation for every manager from one shared read. These are
  not cached; only the leaderboards are.

> **Each leaderboard is stored and served until it goes stale.** A hit reads
> three small stamps and the stored rows, and nothing else. Otherwise it is
> computed as before, stored with the stamp values it was built from, and
> returned. **Valid means those stamps still equal the current ones** — an
> equality check, never a comparison of browser clocks. Points stamps are written
> with the points (`standardPointsUpdatedAt/{tournamentId}`, overall and per
> match, so a gameweek uses the newest of its matches) and a membership stamp by
> every write that changes who is in the league. Anything new that changes
> membership, team names or transfer adjustments must bump it. A custom-scoring
> league is not cached until its points entry exists to stamp them.
- `getTeamForMatch(leagueId, managerId, matchId)` and
  `getTeamForGameWeek(leagueId, managerId, gameWeekId)` — subject to the
  visibility rule, for the leaderboard's team modal

> **Each leaderboard call is one subtree read plus computation**, not one call
> per manager. See decision 1 above.

> Both **enforce visibility inside the layer.** If the deadline has not
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

- `getSquads(leagueId)` — **one read for the page**: every manager's squad at
  the current match, the price each player went for, and the eleven to
  highlight. Replaces a planned `getSquad`, `getAllSquads` and a
  `getTeamForGameWeek` per manager, which was N+1 round trips for one page.

> Squads are always public. **Your own squad highlights the XI you have saved
> for the current period; anyone else's only their latest locked XI**, through
> the same visibility rule as everywhere else. A lineup outside its squad is
> highlighted for nobody.

> **The rules a save is checked against, in an auction league** (in the
> service, on both `updateTeamForGameWeek` and `updateTeamForMatch`): every
> player in the caller's squad at the period's first match, and no more
> overseas than `maxOverseasPlayersAllowedInXI`. Roles and countries are read
> from the stored players, never taken from the request.

> **A lineup outside the squad is treated as absent** wherever it is read —
> visibility reads, scoring, the leaderboard — except the manager's own read,
> which returns it marked `discarded` so My Team can say why. A rewind bumps
> the leaderboard cache stamp, since it can change which lineups count.

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

A reference page, the same in every phase. See `08-pages/auction-center.md`.

**Reads**

- `getAuctionSettings(leagueId)` — the start, the rules (budget, squad size,
  overseas cap, bid step, round timer), the batch sequence and the auctioneer.
  The fast part; reads league fields one by one, never `auctionConfig` whole
- `getDraftOrder(leagueId)` — every position, with TBA for those nobody holds
- `getMembers(leagueId)` and `getLineupRules(leagueId)` — who is bidding, and
  the XI rules
- `getAuctionPlayerPool(leagueId)` — base prices, categories, roles, team. The
  slow part, so it is its own read

All are reads open to any signed-in caller, and refuse a league that holds no
auction.

> **`liveAuctions/{leagueId}` does not exist before the auction.** It is
> created by `startAuction` and by nothing else. **The layer must treat an
> absent runtime node as the normal pre-auction case, not as an error** — this
> is exactly the shape that produces a null-reference bug on first
> implementation. Nothing on this page needs the runtime, so it reads none of
> it.

> **`NotStarted` is not the pre-auction state.** That phase describes the state
> after the auctioneer has opened the room and before the first player goes up.

**No writes and no subscriptions.** Its only action is navigation.

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
- `getPlayerBiddingHistory(leagueId, playerId)` — every bid on one player, in
  order, for the after-auction record. **On drill-down only**, since the full
  history for every player is the entire auction.

**Subscriptions**

- `onAuctionStateChanged(leagueId, callback)` — `undefined` until the auction
  is started, which is normal
- `onTimelineEvent(leagueId, callback)` — every entry so far, then each new one
- `onServerTimeOffset(callback)` — this device's clock against the database's,
  for the countdown
- `onManagerStatusesChanged(leagueId, callback)` — budgets and holdings
- `onPlayerStatusesChanged(leagueId, callback)` — sold, unsold, pending
- `onCurrentRoundChanged(leagueId, playerId, callback)` — the current player's
  accepted round; the page moves to the next player's as they go up
- `onDraftPick(leagueId, turn, callback)` — the current draft turn's pick, if
  made; the auctioneer's browser accepts it from here
- `onSubmittedNoBids(leagueId, playerId, callback)` — who has passed
- `getPlayerBiddingHistory(leagueId, playerId)` — a one-shot read from the
  database, on drill-down only

> **These are read straight from the database in the browser**, not through
> the service — the auction changes several times a second for everyone
> watching. A console rule allows signed-in reads of `liveAuctions/<leagueId>`
> and nothing else; writes still go through the service. See `CLAUDE.md`.

> **The page stays open after the auction**, and is then the historical record:
> every sale, every unsold player, and the bidding on each.

> **The countdown is computed client-side against Firebase server time**, never
> the local clock, from the deadline in auction state.

---

## Auction — bidder

**Writes** — manager role, checked by the service; the manager is the caller,
never an argument.

- `submitBid(leagueId, playerId, amount)` — refused for a player not up, after
  passing, when leading, off the 0.5 grid, over budget or with a full squad
- `submitNoBid(leagueId, playerId)` — refused when leading
- `submitDraftPick(leagueId, playerId)` — refused when it is not the caller's
  turn, for a player not in the draft pool, over budget or with a full squad.
  **Claimed**: written to `draftPicks/<turn>` only if that turn has no pick, so
  a second pick, however it is sent, is refused

> These write **only** to the bidder's own path,
> `currentSubmittedBids/<playerId>/bids|noBids/<uid>`. Whether a bid is
> accepted — the price, the clock — is the auctioneer's to judge.

> **Passing is irreversible for that round.**

> **A bid that would take the budget below zero is refused**, and so is any
> bid from a manager whose squad is at the maximum size. There is no reserve
> for filling the minimum squad.

---

## Auction — auctioneer

**Writes** — **the current auctioneer only** (`auctionDetails/primaryAuctioneer`,
read per request so a handover takes effect at once). Each is one atomic update
with its timeline entry.

- `startAuction(leagueId)` — **creates `liveAuctions/<leagueId>`**, every
  manager on the full budget. Joining closes from here.
- `nextBatch(leagueId)` — the next batch in the sequence, **in order only**, so
  it takes no choice. Refused mid-round and after the last batch.
- `putUpPlayer(leagueId, playerId)` / `putUpRandomPlayer(leagueId)` — a player
  from the current batch, before bidding opens. Clears the previous player's
  round.
- `startBidding(leagueId)` — the round at base price, the clock running
- `acceptBid(leagueId, playerId, managerId, amount)` — **checked again here**:
  the bid the manager actually submitted, at exactly the asking price, before
  the deadline by this service's clock, not passed, affordable. Raises the
  price 0.5 and restarts the clock. Writes the bid history too.
- `acceptNoBid(leagueId, playerId, managerId)`
- `announceCall(leagueId, 'firstCall' | 'secondCall' | 'lastCall')` — timeline
  only
- `markTimeUp(leagueId)` — refused while time is left, by this service's clock
  with a second's tolerance
- `sellPlayer(leagueId)` — to the stored leader at the stored leading bid, so
  nothing passed in can disagree. **One atomic write** across the player's
  status, the buyer's budget and holdings, the bid history and **the buyer's
  squad for every match** — written on every sale, densely, not when the
  auction ends, so squads are correct throughout.
- `sellPlayerManually(leagueId, managerId, amount)` — **a last resort**, for
  when something has broken. Same writes; keeps the bid history and appends
  the sale as the final bid if it is not already the last one.
- `markPlayerUnsold(leagueId)`
- `pauseAuction(leagueId)` — bidding only; bids, calls and time up all refuse
  while paused. `resumeAuction(leagueId)` — **the clock resets to 30 seconds**
  rather than continuing. *(Phase G)*
- `addTimeToCurrentRound(leagueId, seconds)` — 1–60 seconds; the panel offers
  +10. While bidding it extends the deadline; **after time up it reopens
  bidding** with that much time from now. *(Phase G)*
- `startRecovery(leagueId)` / `endRecovery(leagueId)` — enter and leave the
  `recovering` phase. Start is between rounds only, and not while a draft pick
  is going through; End writes how many rounds were undone. Draft picks and
  skips are refused during recovery. *(Phase G)*
- `rewindLastRound(leagueId)` — **refused outside recovery.** Undoes the newest
  round result from the **results log** (below) in one update: the player back
  in the pool with their round and history gone, the buyer refunded and the
  player out of their squad for every match, and **the auction moved back to
  where that round happened** — its batch, or for the draft, that turn and
  manager, whose turn it is again. A draft pick of a previously unsold player
  puts them back as unsold, keeping their earlier bidding. The round before
  then becomes the last, so repeated rewinds walk back to the start. Appends a
  `roundRewound` entry rather than removing any. Does not undo individual
  bids. *(Phase G)*

> **The results log**, `liveAuctions/<leagueId>/roundResults/<pushKey>`, holds
> every round's result in order — sold, unsold, draft pick, skipped turn, and
> the testing button's whole batch at once — written in the same update that
> makes it. A rewind pops the newest. It exists because the timeline is
> display-only and is never read to decide anything.
- `resetAuction(leagueId)` — **refused in production.** A testing fallback:
  puts the league back to before Start auction by deleting the live auction,
  the league's squads, and the lineups and leaderboard built on them, in one
  update. Members and the draft order stay. The auctioneer only, in any phase
  once the auction exists. *(Built early, in Phase E, for testing.)*
- `markBatchUnsold(leagueId)` — **refused in production.** Marks everyone left
  in the current bidding batch unsold, between rounds, so the draft can be
  reached without bidding. No timeline entries. *(Testing, Phase F.)*
- `nextDraftManager(leagueId)` — the next turn in the draft; **the first call
  starts it**, so there is no `startDraft`. The order snakes, and it **skips any
  manager who can no longer pick** — a full squad, or a budget below the
  cheapest base price left. **Refused until the current turn is settled** — a
  pick that has gone through, or a skip — and once nobody can pick. *(Phase F)*
- `skipDraftTurn(leagueId)` — skips the current manager's turn, for one taking
  too long. **Separate from Next on purpose**, so a double click never skips
  anyone. Claims the turn the way a pick does, so a pick and a skip landing
  together cannot both succeed. Writes `draftTurnSkipped`. *(Phase F)*
- `acceptDraftPick(leagueId, turn)` — **called by the processor in the
  auctioneer's browser** as a pick arrives, never by hand. Re-checks the turn,
  the manager, the player, budget and squad, then sells at base price in one
  update — the same sale as a bid's — and marks the pick accepted. *(Phase F)*
- `endAuction(leagueId)` — between rounds, not while a draft pick is going
  through. The league moves to team submission. **Reversible**:
  `reopenAuction(leagueId)` puts it back exactly as it was, for an accidental
  end or an error found later. *(Phase G)*
- `handOffAuctioneerRole(leagueId)` — **always to the backup.** **One atomic
  multi-path write** covering both the auctioneer roles on the membership
  records and the `primaryAuctioneer` field on the auction config. *(Not in
  Milestone 4.)*

**Subscriptions** — read straight from the database, in the auctioneer's
browser only

- `onSubmittedBids(leagueId, playerId, callback)` — what each manager has bid
- `onSubmittedNoBids(leagueId, playerId, callback)` — who has passed

> **Bids are processed in the auctioneer's browser** (settled for Milestone 4),
> by `components/auction/bid-processor.ts`. It judges each submitted bid against
> the round it keeps in memory — one step ahead of the database, so a second
> bid at a price that has just moved is ignored — and accepts the valid ones
> through the service **one at a time**. It also runs the clock: the calls at
> 20, 10 and 5 seconds left, and time up at zero. If the auctioneer's browser
> drops, the auction stalls; that is accepted.

> **Rejection is silence.** There is no explicit reject call — an invalid bid is
> simply not accepted.

> **The timer restarts from each accepted bid**, thirty seconds on. Lateness is
> decided by the service's clock when it accepts the bid; bids carry no
> timestamp of their own.

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

- `createCompetition(config)` / `updateCompetition(id, changes)` — name,
  format, and an optional **home nation**, which decides who is overseas
- `createTeam(team)` / `createTeams(teams)` / `updateTeam(id, changes)`
- `createPlayer(player)` / `createPlayers(players)` / `updatePlayer(id, changes)`
  — **category and base price are required on creation**, and written to
  `standardAuctionConfig` in the same atomic update as the player
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
  writes the tournament-scoped mapping. **It does not write back.** It also
  **copies the competition's home nation onto the tournament**, frozen from
  then on.
- `updateTournamentPlayers(tournamentId, players)`
- `updateMatch(matchConfig)` / `updateMatches(matchConfigs)` — **also recompute
  the tournament's `startDate` and `endDate`, in the same atomic write**
- `publishTournament(tournamentId, officialLeagues)` — sets `publishedAt`, and
  opens the requested official leagues in the same write. A gameweek league
  needs **a gameweek length for every round**, a divisor of that round's match
  count, rejected here if missing or not a divisor. **Rejected here** if
  no match has a start time yet, rather than merely disabled in the admin UI.
- `markTeamEliminated(tournamentId, teamId, fromMatchId)`
- `markTournamentComplete(tournamentId)` — sets `completedAt`. Never set
  automatically; the layer only records the admin's assertion that every point
  and correction is in. `unmarkTournamentComplete(tournamentId)` clears it.

**Reads — scoring**

- `getPlayersForMatch(tournamentId, matchId)` — both teams' squads in this
  tournament. Refused while either team is TBD.
- `getStandardPointsForMatch(tournamentId, matchId)` — to prefill the form.

**Writes — scoring**

- `updateStandardPoints(tournamentId, matchId, playerPoints)` — a full replace.
  Zero is stored as absent. In the same atomic update it advances the
  tournament's `pointsUpdatedTillMatchId`, **forward only**, so correcting an
  earlier match does not pull it back. System admins only, checked here.

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
| **Timeline construction**       | Whether the timeline is derived in the UI from the event subscription, or read as its own list.                                                     |
| **Squad derivation**            | **Settled (Milestone 4):** materialised, written per match on every sale and rewind, so the match parameter looks up.                               |
| **Auctioneer presence**         | No calls specified — Phase 2. For now an admin reassigns manually.                                                                                  |

> **These are marked open deliberately.** Do not pick one and proceed — raise it
> and we decide together, per `docs/02-working-with-me.md`.
