# Data Model

**The schema itself lives in `docs/data-model.js`.** That file is a worked
example of what actually sits in Firebase Realtime Database, with representative
data filled in and the reasoning for each field written as comments.

**This document is the layer above it** — the principles, the structural rules,
and the decisions that span more than one node. Read this first, then the JS
file for exact shapes.

> The JS file is deliberately JavaScript rather than JSON, so it can carry
> comments. It is not imported by anything. It exists so the schema can be read,
> checked, and parsed.

> **`src/types/` is not this document, and is not `data-model.js`.** Those are
> the frontend's data types. They began as a mirror of the schema, which is why
> most of them still resemble it, but they are being built towards what the
> interface needs — resolved entities and derived values rather than ids to
> chase. **The two are expected to diverge**, and a difference between them is
> not automatically a defect in either. This document stays the authority on
> what Firebase holds.

---

## Environments

Four roots, identical structure under each: **prod · preprod · test · local**,
selected by hostname.

The example file shows one environment's contents. Everything below sits inside
whichever root is active.

---

## The one rule that shapes everything else

**RTDB reads are subtree-shaped.** Reading a path pulls everything beneath it —
there is no partial fetch, and no way to say "give me this node but not its
children".

Every structural decision below follows from that.

### What it means in practice

**Things that are read together are nested. Things that are not are split
apart**, even when one logically belongs to the other.

The clearest case: lineups, squads, join requests, transfer offers and the live
auction are all keyed by `leagueId` — but they sit at the **top level**, not
inside `leagues`. If they were nested, reading a league to display its name
would drag twenty managers' team selections across sixty-four matches.

```
leagues/{leagueId}        config + thin membership only
matchBasedLineups/{leagueId}/...     split out, and split from each other
gameWeekBasedLineups/{leagueId}/...  because a league is only ever one
squads/{leagueId}/...     split out
liveAuctions/{leagueId}   split out
```

**The live auction is split for a second reason:** it is written many times per
second during a session. Nested, every bid would invalidate every reader of
league configuration.

---

## Entities and where they live

**Global — the cricket world, owned by system admins**

| Node           | Holds                                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `competitions` | IPL, ODI World Cup, Generic ODI — shown to users as "Base Tournament"                                                                              |
| `tournaments`  | IPL 2027 — one running of a competition. **Shown to users simply as "Tournament".** Contains matches, rounds, and participating teams and players. |
| `teams`        | Cricket teams — RCB, India                                                                                                                         |
| `players`      | Cricketers                                                                                                                                         |
| `users`        | Global identity: display name, avatar, email, system role. **Keyed by the Firebase Auth UID** — see below                                          |

**Reference tables — fixed enums stored as data**

`userRoles` · `formats` · `playerRoles` · `playerCategories` ·
`liveAuctionPhases` · `timelineEvents`

**Standards — defaults a league inherits unless it overrides them**

`standardAuctionConfig` · `standardFantasyLineupRules` ·
`standardFantasyLeagueTeamChangesDeadlineOffset`

**Per league**

| Node                                               | Holds                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leagues`                                          | Config, round and gameweek structure, and thin membership                                                                                                                                                                                                                                         |
| `matchBasedLineups` · `gameWeekBasedLineups`       | Every manager's XI. Two nodes, because a match-based league keys by match and carries change counters while a gameweek league keys by gameweek and carries an impact sub. A league is one type for life, so they are never read together, and keeping them apart makes the path the discriminant. |
| `squads`                                           | Auction-won players, per manager                                                                                                                                                                                                                                                                  |
| `joinRequests` · `bannedUsers`                     | Membership pipeline                                                                                                                                                                                                                                                                               |
| `transferProposals` · `transferProposalsByManager` | Trading                                                                                                                                                                                                                                                                                           |
| `liveAuctions`                                     | The auction runtime                                                                                                                                                                                                                                                                               |

**Points**

`standardPointsByMatch` · `standardPointsByPlayer` ·
`customPointsByMatch` · `customPointsByPlayer`

**Indexes**

`leagueCodeToLeagueMapping`

---

## `users` is keyed by the Firebase Auth UID

Every other node created at runtime carries a push key. `users` does not.

**Why.** The UID is the only value a Phase 2 security rule can verify, because
`auth.uid` resolves to exactly it. It is also immutable, where an email address
is not. And keying on it **removes the duplicate-account problem rather than
guarding against it**: two tabs signing in as the same person address the same
path, so two records for one human cannot happen and there is nothing to claim.

That is why there is no table translating an auth identity into an id of our
own, and no transactional claim at sign-up.

### What it costs, and why this is written down

**Leaving Firebase Auth changes every user id.** The Google subject stored on
each record makes the remap _possible_ — it says which person a UID belonged to
— but the remap itself is the work, and it is larger than it looks.

**User ids appear as values about as often as they appear as keys.** A script
that rewrites keys alone would leave the database subtly wrong, with membership
intact but ownership, bids and transfers pointing at ids that no longer exist.

| As keys                                   | As values                                              |
| ----------------------------------------- | ------------------------------------------------------ |
| `leagues/{id}/leagueMembers`              | `leagues/{id}/leagueOwner`                             |
| `matchBasedLineups/{id}`                  | `primaryAuctioneer`, `secondaryAuctioneer`             |
| `gameWeekBasedLineups/{id}`               | `bannedUsers/{id}/{uid}/bannedBy`                      |
| `squads/{id}`                             | `manager1`, `manager2`, `proposedBy` on every transfer |
| `joinRequests/{id}`                       | `managerId` on every accepted bid and no-bid           |
| `bannedUsers/{id}`                        | `managerId` on every sold player status                |
| `transferProposalsByManager/{id}`         | `auctionState/currentDraftManagerId`                   |
| `auctionDetails/draftOrder`               |                                                        |
| `liveAuctions/{id}/managerStatus`         |                                                        |
| the bid and no-bid maps in a live auction |                                                        |

So a migration is a walk of the whole tree that has to know, per node, which
fields hold a user id — not a key rewrite.

**One thing is unrecoverable and is guarded against.** If the Firebase project
were ever deleted, nothing outside it could say which UID belonged to which
person. That is why `googleSubjectId` is stored on the user record even though
nothing reads it.

---

## Naming: what users see versus what the model calls it

| UI              | Model                                      |
| --------------- | ------------------------------------------ |
| Tournament      | `tournaments` — one running, e.g. IPL 2027 |
| Base Tournament | `competitions` — e.g. IPL                  |

Users say "the IPL tournament" and "the World Cup", so **Tournament** is the
user-facing word for the thing you create a league against. The level above it
is a system-admin concept that never appears in user-facing UI.

**This mapping will confuse anyone reading code against these documents if they
have not been told.** It is stated here, in the site header page doc, and in the
system admin page doc.

---

## Cross-cutting rules

These are the ones that break quietly if not understood.

### Scoring is derived, never stored per manager

Points are stored **per player per match**. A manager's total is computed at read
time — resolve which players were in their team for each match, sum, apply
captain and vice-captain multipliers.

**Why:** a scoring correction means editing one number, and every view is
instantly right. Stored totals would mean finding and fixing every manager the
mistake touched.

**The one exception** is `pointsAdjustment` on a league member — the net effect
of accepted transfers, which is not derivable from player points. It is kept as
a running total, and the per-transfer amounts remain in `transferProposals` so it
can be rebuilt if it ever drifts.

### Points resolve by the league's scoring flag, never by copying

A league either uses standard points or enters its own, and
`isCustomScoringSystem` decides which.

**Reading points follows the flag, not a search order:**

- **`isCustomScoringSystem` false** — read `standardPoints*` for the
  tournament.
- **`isCustomScoringSystem` true** — read `customPoints*` for the league, and
  **only** that. There is no fall back to standard for a match the admin has
  not entered yet; that match simply has no points recorded.

> **This is not a first-hit-wins lookup.** Falling back per match would let one
> league score some matches by its own rules and others by the standard ones,
> which is worse than showing nothing, because nobody would see it happen.

Standard points are **never copied into a league.** Copying would mean a
correction had to be applied in every league that opted in — the same fan-out
problem the derived-scoring rule exists to avoid.

### Standards are copied, except points

Three nodes hold defaults a league inherits: `standardAuctionConfig`,
`standardFantasyLineupRules` and
`standardFantasyLeagueTeamChangesDeadlineOffset`.

**The auction config, the lineup rules and the team-changes deadline offset are
all copied into the league at creation.** Points are not, and resolve
dynamically instead. That looks inconsistent and is not.

**Why the auction config is copied.** `standardAuctionConfig.playerDetails`
holds a base price and category for **every player in the system**. A league
needs only the players actually participating in its tournament. So the copy is
not a snapshot of the standard, it is a **projection of it onto one
tournament** — a genuinely different and much smaller thing. Resolving
dynamically would mean reading every player in the system on every read and
intersecting against the tournament's participants, which is the subtree rule
biting again.

**And it must be frozen anyway.** Managers commit against these values when they
bid. If a system admin edited a standard base price mid-season and leagues
resolved dynamically, a completed auction would retroactively appear to have run
under prices nobody bid against.

**Why points are not copied.** Points are corrected after the fact, and a
correction must reach every league that opted in. Copying would mean applying
one fix in every league separately, which is the fan-out problem the whole model
avoids.

> **The rule, stated once:** anything **corrected after the fact** resolves
> dynamically. Anything **managers commit against** is frozen by copy. Points
> are the only thing in the first category.

> **The team-changes deadline offset follows the rule too.** It is written at
> creation, seeded from the standard, and never resolved at read time. Managers
> commit against their deadline as much as they commit against a base price, so
> a standard edited mid-season must not move lock times under a running league.

### Points are stored both ways, for now

```
standardPointsByMatch  : tournamentId / matchId  / playerId
standardPointsByPlayer : tournamentId / playerId / matchId
```

**This is the one place the model duplicates values rather than
relationships.** Everywhere else a two-sided structure stores `true` on one
side; here both sides hold the actual score.

**So a correction must write both paths in the same atomic multi-path
`update()`,** or the copies diverge silently.

> **Revisit this during implementation.** Match-major serves points entry and the
> leaderboard; player-major serves "this player's season so far". If both earn
> their place, keep both. If only one is doing real work, drop the other and the
> dual-write requirement goes with it.

### Team visibility is enforced here, not in the UI

**A manager's team for a match is readable by that manager at any time, and by
anyone else only once that match's deadline has passed.**

Per match, not per gameweek — an impact sub takes effect from a specific match
and must stay hidden until _that_ match locks.

**A match locks at its deadline**, which is its scheduled start time minus the
league's team-changes deadline offset. **A gameweek locks at the deadline of
its first match.**

**Enforced in the data layer.** Hiding it in the UI is not sufficient: anyone can
read the database directly with the client SDK.

**Squads are different and are always public.** The rule protects _which eleven
you are fielding_, because that is what can be exploited. Which players you own
was public at the auction, and knowing who owns whom is a prerequisite for
trading.

> Firebase security rules _could_ express this — they evaluate the requesting
> user and can compare against stored deadlines. Writing and testing them is
> real work that is invisible in the product, so **Phase 1 leaves rules
> permissive and relies on the data layer.** This is a known and deliberate
> limitation, not an oversight.

### Lifecycle is derived, never stored

A league's phase — pre-auction, auction, team submission, active, finished — is
computed from auction state, deadlines and `finishedAt`. **There is no phase
field.**

The old system had a hardcoded constant in source code. Advancing a league meant
editing it and redeploying: only the developer could do it, it could not happen
on a schedule, and every transition carried deploy risk.

**`finishedAt` is the single exception**, and it is set by a deliberate admin
action — only a person knows whether every point and correction is in.

**`slotsUsed` is also derived**, by counting members who hold the manager role.

### Ban is a role, not a deletion

Banning someone adds the **`bannedFromLeague`** role and
**strips the manager role**. It is one write.

**An existing member can be banned mid-season**, by the same mechanism and with
no special case.

Two consequences that make everything else simple:

- **Their data survives** — squad, lineups, points adjustments. This matters in
  an auction league, where a banned manager owns players they paid for.
- **Nothing needs special-casing.** Slot counting and the leaderboard already
  filter by manager role, so a banned user stops occupying a slot and stops
  appearing in standings automatically.

A reject-and-ban creates a membership record holding only that role, for someone
who was never a member. That is consistent — membership already holds
non-playing relationships, since spectators live there too.

### Overseas is derived from the player's country

**A player is overseas when `players/{playerId}/country` is not India.** There
is no stored overseas flag, and nothing on the competition records what counts
as home.

The overseas cap lives only in `auctionConfig`, as
`maxOverseasPlayersAllowedInXI`. Regular leagues have no cap — that is
deliberate, and recorded on `league001` in the example file.

> **This hardcodes India**, which is correct for the IPL and wrong for any base
> tournament that is not an Indian competition. It holds for Phase 1 because
> the IPL is the only auction tournament in play.

---

## Structural conventions

### Maps, not arrays

`{ team001: true, team004: true }` rather than `["team001", "team004"]`.

Three reasons, all specific to RTDB:

1. **Atomic updates.** Adding one player to a team is a single-path write. With
   an array you read, mutate and write back — and two admins doing that at once
   lose one edit.
2. **Security rules match paths.** `teams/{teamId}/players/{playerId}` is a rule
   you can write. `teams/{teamId}/players/3` is not meaningfully guardable.
3. **RTDB has no array type.** It stores `["a","b"]` as `{0:"a", 1:"b"}` and
   converts back only when keys are contiguous integers from zero. Delete the
   first element and you get an object back instead of an array.

**The one exception is a lineup**, which is always read and written whole and is
fixed at eleven.

### Indexes carry the fields their page renders

RTDB cannot answer "which leagues is this user in" — there is no query across
`leagues` for a nested member key. So:

```
users/{userId}/leagues/{leagueId}               for My Leagues
users/{userId}/archivedLeagues/{leagueId}       for the Archived tab
tournaments/{tournamentId}/leagues/{leagueId}   for the tournament page
```

**Each index copies exactly the fields its page displays** — nothing more, or it
drifts into being a second copy of the league.

**The cost is fan-out on change.** Renaming a league updates every member's
entry. That is one atomic multi-path `update()` with at most eight paths, and
renames are rare.

#### An index is a view, never the source of truth

Membership lives at `leagues/{leagueId}/leagueMembers/{userId}`. **Any check
asking "is this user in this league" reads that, not the index.** This matters
now that archived entries live in a second node: a check against
`users/{uid}/leagues` would report non-membership for every finished league.

**And the index cannot be rebuilt.** RTDB cannot answer "which leagues contain
this user", which is the entire reason it exists, so a lost entry hides that
league from that user permanently. Every write that moves an entry between the
two nodes must be a single atomic `update()` carrying both paths, never a write
followed by a delete.

#### Why archived entries are split out

Reads are subtree-shaped. With every entry under `users/{uid}/leagues`, one read
drags the whole archive along with the active leagues, and the My Leagues tab
boundary is a filter wearing a tab's clothes. Lifecycle is derived, so the index
cannot be queried around it either. Archived is also the only one of the
categories that grows without bound; pending and rejected stay small.

**A league moves when `finishedAt` is set and the current time is past
`finishedAt` plus 24 hours**, which is what Archived means. There is no
scheduler in Phase 1, so the move happens lazily on the next My Leagues load,
performed by each user against their own subtree.

**Neither status nor counts are stored in either node.** Status is a function of
the current time and nothing can write it; a slot counter would fan out to every
member on every join. Both are read at render time, narrowly — see
`docs/06-data-layer.md`.

> **Atomic multi-path writes are the tool that makes denormalisation safe here.**
> A single `update()` with several paths either applies entirely or not at all.
> This is different from `runTransaction`, which handles read-modify-write
> contention and is deliberately _not_ used in the auction.

### Ids in URLs, codes for humans

A league's join code is **not** its identifier. See `docs/04-navigation.md`.

`leagueCodeToLeagueMapping` exists so a typed code can be resolved to an id in a
single read.

**A code is eight alphanumeric characters, generated at league creation.** That
same mapping is where it is claimed: **write the candidate key
transactionally**, and on failure generate another and try again.

> **Read-then-write would not actually be safe.** Two creations can both read a
> code as free and both take it. At eight alphanumeric characters and a few
> hundred leagues the odds are nil, so this is correctness rather than risk —
> but a check that can lose is not a guarantee, and it costs nothing to make it
> one.

### Ids are push keys, except where they are not

**Anything created at runtime gets a Firebase push key.** Users, leagues,
players, teams, competitions, tournaments, matches, gameweeks, transfer
proposals, bids. Twenty characters, generated on the client from a millisecond
timestamp plus randomness, chronologically sortable, and unique **without any
coordination between clients**.

> **This is what makes concurrent creation safe.** A counter is a read followed
> by a write, so two clients can read the same next value and both write it, and
> the second silently wins. With push keys no client ever asks what the next id
> is, so there is nothing to lose a race over.

**The six reference tables use semantic keys instead** — `manager`, `t20`,
`batsman`, `marquee`, `bidding`, `firstCall`. They are configuration rather than
records: authored once, by one person, referenced from code. Nothing creates a
role at runtime, so the problem push keys solve does not arise, and their
opacity would be pure cost. `leagueRoles: { manager: true }` says what it means;
`leagueRoles: { userRoles005: true }` does not.

**The id is repeated inside the object**, as everywhere else in this model, so
an object detached from its key still knows what it is.

#### Uniqueness on a natural key is a different problem

Push keys guarantee that two actors get **different** ids. They do nothing about
one actor acting **twice** — two tabs, a double-tap, a retry after a timeout —
and there they make things worse, because two distinct records for one person is
harder to detect than an overwrite.

**That needs a conditional write on the thing that must be unique**, not a
better key generator. `leagueCodeToLeagueMapping/{code}` is the one case left:
claim it with a transaction, so **the loser is rejected rather than creating a
duplicate**, then generate another code and try again.

> **A user account used to be the second case and no longer is.** Keying
> `users` by the Firebase Auth UID means two tabs address the same path, so
> there is no duplicate to prevent and nothing to claim — see above. That is
> the better answer where it is available: a natural key that is already unique
> beats a transaction guarding a generated one.

> **`runTransaction` is ruled out for the auction specifically**, where the
> read/write split makes it unnecessary. Claiming a unique natural key is
> exactly what it is for, and is not an exception to that rule.

#### Ordering never comes from an id

Rounds carry `firstMatchId` and `lastMatchId`; gameweeks carry `startMatchId`
and `endMatchId`. **Whether a match falls inside one is decided by
`matchNumber`, never by comparing id strings.** Sequential ids made that
comparison work by accident, and push keys break it silently.

---

## The auction runtime

**The read/write split is the whole design, and it is what makes the auction
safe with no transactions.**

- Bidders write **only** to `{playerId}/bids/{managerId}` and
  `{playerId}/noBids/{managerId}` — their own paths, nothing else.
- The auctioneer is the **sole writer** of everything else, including which
  player is up and whether bidding is open.

**`takingBids` and `currentPlayer` live in a bidder-readable node but must be
auctioneer-written.** Without that rule a bidder could reopen bidding.

**Bids are keyed per player**, so there is no clearing step between rounds and no
risk of a previous player's value leaking into the current one.

> **The known race is accepted.** The auctioneer may read one manager's bid
> before another's even when the other wrote first. This has run through multiple
> real auctions. **It is not a defect and must not be "fixed".**

**The timeline stores typed events** — an event id plus its data — rather than
pre-written sentences. That is what lets each client render them itself, and lets
the countdown be a live timer instead of a series of "20 seconds left" log lines.

**Squads are written as each player sells**, not materialised when the auction
ends. Selling is one atomic write across bid history, the buyer's budget and
their squad, so `squads/{leagueId}/{managerId}` is correct at every point
during the auction rather than only after it.

**Bidding constants, fixed for Phase 1:** the increment is **0.5** and the round
timer is **30 seconds**, refreshed from the last accepted bid. Neither is
configurable. The auctioneer can add seconds to a round in progress.

---

## Deliberately deferred

| Item                          | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sparse lineups and squads** | **`matchBasedLineups` only.** Those are one entry per match, with the same value copied forward, and since a lineup applies forward until changed, most of those copies carry no information. Writing only on change would cut the leaderboard read by roughly 8×. **Deferred because it only matters at 60+ match tournaments**, and Phase 1 runs on short series. Structure and field names would be identical; only the number of entries changes. **`gameWeekBasedLineups` is not affected** — one entry per gameweek, never dense. Squads are match-keyed in both. |
| **Game-week-keyed squads**    | Keying squads by gameweek rather than match, so a transfer takes effect only once the current gameweek ends. Independent of sparseness — either could be taken without the other.                                                                                                                                                                                                                                                                                                                                                                                       |
| **Auctioneer presence**       | Detecting that an auctioneer has gone offline, and promoting the backup automatically. Phase 2. For now an admin reassigns manually.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Firebase security rules**   | Permissive in Phase 1. The data layer enforces access. **Do not write restrictive rules — they will break reads.**                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Materialised leaderboards** | Computing standings on write rather than read. Only worth it at a scale this will not reach in Phase 1, and the model supports it without reshaping.                                                                                                                                                                                                                                                                                                                                                                                                                    |

---

## Reading the example file

`docs/data-model.js` uses one worked scenario throughout:

- **`league001`** — a regular, match-based league using standard points
- **`league002`** — an auction league, gameweek-based, using custom points, with
  a live auction in progress

**Read it for structure, not for values.** Each node is a correct illustration
of its own shape and of what its fields mean. Values are **not** consistent
across nodes, deliberately — covering every role, request and ban state with a
mutually consistent cast would take a dozen users and obscure the shapes the
file exists to show. If an id in one node does not resolve in another, that is
the file doing its job cheaply, not a defect to report.

**Every decision in that file is marked `RESOLVED` with its reasoning.** Where a
comment says something was considered and rejected, that is a record of a
decision — not an open question.
