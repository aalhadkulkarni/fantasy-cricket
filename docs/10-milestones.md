# Milestones

What each milestone shipped, what it deferred, and **where the built system
departs from the other documents in this folder**.

> **Read the "Where the code departs from the docs" section before trusting any
> other document on the points listed there.** Those documents were written
> before implementation. Some have been updated to match the code; the ones
> listed as stale below have not, and on those points **the code is right and
> the document is wrong.**

---

## Milestone 2 — the site usable end to end

**Status: complete, 19 September 2026.** Merged to `main`.

**Goal:** a system admin creates a tournament and its official public leagues;
users join, submit and edit a team, see points, and follow a leaderboard.

### What shipped

**System admin**

- Seed an environment (`setUpBasicSystem`) and create sample players.
- Create a tournament: teams, participating players, matches, rounds; publish
  it. **Publishing optionally creates the official leagues in the same atomic
  write** — one match-based, one gameweek-based.
- **Points entry** for a match, which is also the correction screen: it opens
  with any stored points already filled in, and saving replaces them.
- Mark a tournament finished, and undo it.

**Managers**

- My Leagues, Tournaments, tournament home with its leagues and fixtures.
- Join a league by code or from a tournament. Joining asks for a fantasy team
  name and grants the `manager` role.
- **My Team**, for both league kinds: pick eleven, a captain and a vice-captain;
  navigate between matches or gameweeks; see each player's points and the
  captain ×2 / vice-captain ×1.5 working; see the change a draft costs against
  the previous period. The team locks at the deadline and is then read-only.
- **Leaderboard**: overall, per locked match and per locked gameweek, with ties
  sharing a rank. Clicking a manager opens their locked team in a modal.
- League Details (read-only), Members, a Points System reference page.
- League owner or admin: mark the league finished, and undo it.

### What was deferred

| Item | State |
| --- | --- |
| **Impact sub (B11)** | Not built. Scoring already honours a stored sub, from its match onward. |
| **Creating a league** | Hidden from the navigation, the tournament page and My Leagues. `/leagues/new` exists but is unlinked and a placeholder. Only official leagues exist. |
| **Custom-scoring points entry** | Not built, so custom-scoring leagues cannot be scored. None exist yet, since only official (standard) leagues can be created. |
| **Actions Center items** | The page is a short guide with links. No action is derived yet. |
| **League Details editing** | Read-only. Per-field edit locks are not built. |
| **Admin Center** | No page. Its "mark league finished" lives on League Details. |
| **Auction, squads, transfers, bans, join requests** | Not started. |
| **Security rules** | Still permissive. See "Enforcement" below. |

---

## Where the code departs from the docs

### Documents that are now wrong

One left. The others on this list have been corrected at source.

| Where | What it says | What is true |
| --- | --- | --- |
| `docs/data-model.js`, `formats` (TBD3) | Formal scoring rules will live on each format. | The Points System page reads a **static file**, `src/content/points-system.ts`. A deliberate choice; moving it into `formats` later changes only where the page reads from. |

### Decisions taken during the build

These are recorded in the documents already, but they changed direction and a
planner should know them.

**Data model and storage**

- **Gameweek lineups are copied forward**, like match lineups. Saving gameweek N
  writes the same team to N and every later gameweek in one update. This
  reversed "gameweek lineups are one per gameweek, never dense". Writing a later
  gameweek replaces its whole node, clearing any impact sub there.
- **A leaderboard cache**, `leaderboards/{leagueId}` — `main`,
  `gameWeeks/{id}`, `matches/{id}` — holds computed standings. It is the one
  exception to "points are never stored per manager", and is never the source
  of truth: each entry records the stamp values it was built from and is
  recomputed when they no longer **equal** the current ones (an equality test,
  never a clock comparison).
  - `standardPointsUpdatedAt/{tournamentId}`: `overall` and
    `matches/{matchId}`, written in the same atomic update as the points.
  - `leaderboards/{leagueId}/membersUpdatedAt`, written by `joinLeague`.
    **Any future write that changes membership, a team name or a transfer
    adjustment must bump it.**
  - Custom-scoring leagues are not cached, because nothing stamps their points.
- **`tournaments/{id}/pointsUpdatedTillMatchId`**, the furthest match with
  standard points entered. It only moves forward: correcting an earlier match
  leaves it alone. It drives the "Points calculated till" label, whether a
  period counts as scored, and which match points entry opens on.
- **Zero points are stored as absent.**
- **Top-level nodes are now 31.** The two new ones are above.

**Changes and allowances**

- **Match-based leagues:** each change is measured against the **previous
  match's** stored team, never the same match's, so re-saving a match before
  its deadline cannot spend twice. Match 1 spends nothing. The remaining
  counters (`changesRemaining` and the captain and vice-captain ones) are
  derived from the previous match's and copied forward with the team. **An
  overspend is refused**, not clamped.
- **The official match-based league's allowance** is set by match count:
  1–5 matches → 4, 6–15 → 6, 16–25 → 8, 26+ → 11, the same number for team,
  captain and vice-captain changes. (15 is read as the lower band.)
- **Gameweek leagues:** a **cap on each transition**, not a running total.
  Going into the first gameweek of a round uses that round's "changes allowed
  before the round starts"; going between gameweeks inside a round uses
  "changes allowed between gameweeks". The very first gameweek has no cap, and
  an absent value means unlimited. Captain and vice-captain changes are
  unlimited. The baseline is the last saved team before the gameweek, after any
  impact sub.
- **The official gameweek league** has one gameweek per round and no caps. See
  `docs/09-future-exploration.md` item 5 on why one gameweek per round stops
  being right for long rounds.

**Lifecycle**

- **Marking a league finished** is gated on the league's **last match having
  started** (the docs said "ended"; nothing records a match ending), is
  **reversible**, and is allowed for the owner and league admins.
- **Marking a tournament finished** is reversible, and prompted — never done
  automatically — after the last match's points are saved.
- **Next deadline** is the next deadline still ahead: the next match's, or in a
  gameweek league the next gameweek's first match's. It is absent when the next
  one is undated.
- **Your rank** comes from the cached overall leaderboard, and only once the
  league is active or finished.

**Data layer contract** (`src/data-layer/api.ts`)

- `getPointsForMatch(leagueId, matchId)` was **renamed**
  `getPlayerPointsForMatch`. `getPointsForMatch`, `getPointsForGameWeek` and
  `getPointsForLeague` now take a `userId` and return **one manager's score**.
- `getLeaderboard` was renamed **`getLeaderboardForLeague`**. The period
  versions return `{ rows, isScored }`, so an unscored locked period can say so.
- `getTeamFor` and `getLockedTeamFor` were replaced by
  **`getTeamForMatch`** and **`getTeamForGameWeek`**. Both enforce visibility
  in the layer: another manager's team returns nothing before its deadline,
  admins included, and an impact sub is hidden until its own match's deadline.
- New: `getMyTeamBeforeGameWeek`, `getPlayersForMatch`,
  `getStandardPointsForMatch`, `updateStandardPoints`, `getLeagueDetails`,
  `getMembers`, `markLeagueFinished` / `unmarkLeagueFinished`,
  `markTournamentComplete` / `unmarkTournamentComplete`, `getScoringWatermark`.
- **`Player.teamShortName`** is resolved per tournament from the tournament's
  frozen `participatingPlayers`, wherever players are returned for a league.

**Pages and navigation**

- **Points entry is on tournament home**, not the admin panel:
  `/tournaments/:tournamentId/points`, system admins only.
- `/points-system` is new.
- Official leagues: **whoever publishes owns and administers them but does not
  play them.** To play, they join like anyone else.
- The league header is collapsible (collapsed by default, remembered per
  browser), and the site header is pinned to the top.

**Design**

- The blue "floodlit" treatment is used throughout. `docs/07-design-system.md`
  rule 1, which reserved blue for live states, **was removed**.

### Authorization, as it stands

**Writes are role-checked.** `assertSystemAdmin` on the 20 system-admin
writes, `assertManager` on team submissions, `assertLeagueAdmin` on league
lifecycle, plus the join checks (slots, ban, deadline, membership).

**Reads are open to any signed-in caller.** Leagues, tournaments, members and
leaderboards are public by design, and a read cannot be pointed at another
user's own data: `getMyTeam*`, `getActiveLeagues` and `getCurrentUser` take
their uid from the token.

**The one exception is an unlocked team.** `getTeamForMatch` and
`getTeamForGameWeek` return another manager's eleven only once that period's
deadline has passed; an impact sub stays hidden until its own match locks; a
leaderboard for an unlocked period is refused with `periodNotLocked`.
`getPointsForMatch(userId, …)` deliberately accepts any uid — it returns a
total, never a lineup.

**Unpublished tournaments are system-admin only**, in both the list and the
single read.

**A new endpoint must say which of those it is.**

### Enforcement — what is and is not real

**The data layer checks everything a server would:** system-admin role on every
system-admin write, `manager` role on team writes, deadlines, squad legality,
change allowances and caps, owner or admin for league finishing, and team
visibility.

**This is now real.** The checks run in `apps/api`, the browser holds no
database access, and the rules deny every client in every environment, so
there is no path around them. Both known gaps are closed: drafts are
admin-only, and nothing in the browser reads the database.

---

## Milestone 3 — a real backend

**Status: complete, 30 September 2026.** Built in a day; the estimate was a
week, and the estimate was wrong because the seam did its job.

**Goal:** make the rules real. Every check the data layer performed ran in the
browser, and the security rules were permissive, so anyone could skip all of it
and write to the database with the client SDK.

### What shipped

- **An Express service on Cloud Run** (`apps/api`), `asia-southeast1`, beside
  the database. It verifies the caller's Firebase ID token, runs the checks,
  and reaches the database with the Admin SDK.
- **The browser holds no database access.** It keeps Firebase Auth, which is
  what produces the token, and calls the service for everything else. The
  bundle lost 192KB with the database SDK.
- **The rules deny every client**, in every environment. The service is
  privileged, so it is unaffected — which is the whole point.
- **An npm workspaces monorepo**: `apps/web`, `apps/api`, `packages/shared`.
- **`packages/shared` holds the contract** both sides compile against: the
  `Api` interface, the error codes with their HTTP statuses, the environment
  union, and `API_METHODS` — one table giving each operation its verb and
  argument order, so a name or verb cannot drift between client and server.
- **Keyless deploys.** GitHub Actions authenticates through Workload Identity
  Federation; no service-account key exists anywhere. The frontend and the
  service deploy independently, both from `release`.

### Decisions

| | |
| --- | --- |
| **Host** | Cloud Run, container, `asia-southeast1`. Cloud Functions was the alternative; the container is portable and can hold a WebSocket if the auction ever needs one |
| **Framework** | Express, deliberately boring. Fastify was considered and rejected: with zod covering validation, its advantages did not apply here |
| **Endpoints** | One per `Api` method, named after it — `GET /v1/getLeagueDetails`, `POST /v1/updateTeamForMatch`. Reads are GET, writes are POST |
| **Types** | One shared package, not duplicated copies. Changes are additive; a structural change means a new type rather than an edited one |
| **Auth** | Firebase ID token per request, verified with the Admin SDK. Roles are read from the database per request rather than baked into claims |
| **Session** | The api object is built per request, closing over the caller, so `requireSession()` reads a closure and a handler cannot see another caller's identity |
| **Errors** | A code per rule plus the server-rendered message. The code is for branching and logs; the message is what a person reads |
| **Environments** | One service per environment, and **the environment comes from the deployment, never from the request** |
| **Cutover** | Big bang, not method by method: a routing table between two backends is a mechanism that exists only to be deleted |

### Authorization

Audited across all 64 operations and written down in full under
"Authorization, as it stands" above, and in `CLAUDE.md`. The audit found the
rules already enforced; the two gaps it closed were both about unpublished
tournaments rather than teams.

### Verified

By hand, with ID tokens minted for an admin and a non-admin: reads with and
without arguments, an object filter, a write, an admin-only call, a refusal
returning the right code and status, drafts hidden from the non-admin, and
another manager's team returned on a locked match but not an open one. Then
the whole app clicked through with the rules denying clients.

### Deferred

| Item | State |
| --- | --- |
| **Automated tests** | None. Every rule above is guarded by having been clicked once. The user's stated next priority |
| **`preprod` and `test`** | Placeholders in `environments.ts`; no service, no hosting target |
| **`apps/web/src/data-layer/firebase/archived`** | The pre-service browser copies, kept for reference, excluded from typecheck, lint and formatting. They no longer compile, so they are not a fallback |
| **Renaming `firebase-api.ts`** | "api" means three things in this repo. *Adapter* is the accurate word — see the backlog |
| **Response validation (zod)** | Responses are cast, not parsed. The same trust the Firebase reads had |

## Milestone 4 — the auction

**Status: in progress.** Phases A–C merged (#74, #75, #78), plus live reads (#79). Phase D merged (#80). Phase E under way.

**Goal:** a live auction for an **official auction league**, end to end — from
publishing the tournament that opens the league to managers picking an XI from
the squad they won. The BBL in January is the playtest.

### Phases

| Phase                    | What                                                                                                                                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — prerequisites**    | **A1** gameweek length per round, chosen at publish. **A2** category and base price required on every new player, written to `standardAuctionConfig`. **A3** base tournaments (competitions) created and edited, with an optional home nation copied onto each tournament. |
| **B — the league**       | A "create official auction league" option at **publish**: standard rules, public, 6 slots, join deadline equal to the auction start, which the admin picks. The publishing system admin is owner and auctioneer.                                                           |
| **C — navigation**       | A blank auction page; Auction Center in the league; a Go to auction button for everyone.                                                                                                                                                                                   |
| **D — display only**     | Everything the auction page shows, rendered from the data if it existed, tested with temporary fake data. The auctioneer and manager control panels, with no actions.                                                                                                      |
| **E — live bidding**     | Start the auction, pick the batch and the player, start bidding; bid and pass; accepting bids, the timer and the calls; sell to the leader, the manual fallback sale, unsold.                                                                                              |
| **F — the draft**        | Start the draft, next manager (skipping anyone who cannot pick), the manager's pick, the auctioneer accepting it.                                                                                                                                                          |
| **G — running the room** | Rewind inside Start/End recovery, pause and resume, add time, end the auction.                                                                                                                                                                                             |
| **H — in the league**    | The Squads page; My Team picking only from the manager's squad, under the XI rules and the overseas cap.                                                                                                                                                                   |

**An action is done only end to end:** the UI to perform it, every database
write it implies (squads, budgets, history, phase), the change on the actor's
screen and on everyone else's, and its timeline event.

### Not in this milestone

- The backup auctioneer, and switching auctioneers
- Custom auction rules — only the official league's standard ones
- UI polish such as the countdown, added at the end of the milestone
- Transfers

### Decisions

Recorded in the documents they belong to; listed here so a planner sees them
together.

- **Overseas** is a player's country not matching the tournament's
  `homeNation`, copied from the competition at tournament creation. **No home
  nation counts as India.** It replaced
  a hardcoded India, which would have made the BBL unplayable.
- **The draft order is assigned as managers join**, at random from the
  positions still free; unclaimed positions show as TBA. There is no "generate
  draft order" step.
- **Bidding:** the only budget check is not going below zero, and a manager at
  the maximum squad size cannot bid. The draft pool is General plus everything
  unsold in Marquee and Star.
- **The timer restarts from each accepted bid**, and lateness is judged by the
  server's clock when it processes the bid.
- **The live auction page is open to everyone, always**, and after the auction
  it is the historical record. Auction Center is a reference page, the same in
  every phase.
- **Manual sell** exists as a last-resort fallback.
- **Rewind** undoes the last round's result, repeatedly, only inside recovery,
  and appends to the timeline rather than rewriting it. A non-production reset
  exists for testing. **Results are logged in order** at
  `liveAuctions/<leagueId>/roundResults`, since the timeline is never read to
  decide anything; a rewind also moves the auction back to that round's batch
  or draft turn. One `roundRewound` entry per rewind.
- **Ending the auction is reversible**: Reopen auction restores it as it was.
  **Lineups saved between an end and a reopen are left alone; Phase H must
  validate a lineup against the manager's current squad and discard one that
  falls outside it.**
- **Pause** resets the clock to 30 seconds on resume. **+10 seconds** works
  while bidding and after time up, when it reopens bidding.
- **Team submission begins only when the auctioneer ends the auction.** An
  auction league is pre-auction until the auction is started and in its auction
  until it is ended, regardless of the scheduled start or the first ball; only
  then do team submission and active follow. `league-phase.ts` derives it from
  the live auction's own phase field, read alone.
- **Existing players are not backfilled** with auction values; environments are
  re-seeded. **In a league's pool, a participant without values goes in as
  General at 2**, applied when the league copies the standard values.
- **A draft position is claimed transactionally on join**, like a join code, so
  two simultaneous joins cannot share one. `draftOrder` is keyed position →
  manager for that reason.
- **Joining closes when the auction starts**, even before the scheduled time —
  a manager arriving mid-auction would have no budget or draft seat.
- **Bids are processed in the auctioneer's browser**, the original design: it
  listens to submitted bids, accepts them through the service one at a time
  against the round it keeps in memory, and owns the timer and the calls. If
  it disconnects the auction stalls, which is accepted — selling is manual, so
  a missing auctioneer stalls it anyway. Bidders' `submitBid` takes no manager
  id; the service uses the token.
- **Live auction reads come straight from the database in the browser**, per
  league, through a read-only rule set in the console
  (`$env/liveAuctions/$leagueId`, signed-in only; `/liveAuctions` itself stays
  closed). Writes still go through the service. The database SDK is loaded only
  where it is used. **State on the auction page is Zustand.**
- **The draft mirrors bidding**: the auctioneer moves the turn on (Start
  draft, then Next in draft order, skipping anyone who cannot pick); the
  manager submits a pick; the auctioneer's browser accepts it through the
  service, which re-checks and sells at base price. **Picks live at
  `liveAuctions/<leagueId>/draftPicks/<turn>`**, keyed by a turn counter in
  `auctionState`, and are claimed transactionally — one per turn. **Next waits
  for the turn to be settled**, by a pick gone through or a deliberate **Skip**
  (its own button and endpoint, timeline `draftTurnSkipped`), which claims the
  turn the same way, so a pick and a skip cannot both land.
- **The batch sequence** lives in `standardAuctionConfig.batchSequence` and is
  copied into each auction league: Marquee batsmen, bowlers, keepers,
  all-rounders, then the same for Star, then the draft as a batch of its own.
  **A batch is finished before the next begins**: Next batch is refused while
  any of its players has not gone up.
- **My Team stays in an auction league's sidebar** and says "Team submission
  will open after the auction" until the auction is ended. An auction league
  lands on Auction Center.
- **The official auction league** is created at publish: public, six slots,
  standard auction rules, join deadline equal to the auction start. The start
  must be in the future and before the first match. The publisher owns it and
  is its auctioneer, but does not play unless they join.

- **Testing runs on the IPL 2026 pool**, loaded by the admin panel's Populate
  seed data, which resets a non-production environment and replaces the old
  sample data. See `08-pages/system-admin.md`.

### Phase E must also

- **Write the timeline in the typed shape** `TimelineEventData` in
  `packages/shared/src/live-auction.ts` fixes, with a `timestamp`.
- **Write `auctionState` in its Phase D shape**: `currentBatch` is an
  `AuctionBatch` (`kind: 'draft'` for the draft); a selected player has no
  round until bidding starts.

### Open

| Item                                                   | State                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scheduled start passed, auction not started**        | What the league shows. Decided at implementation.                                                                                                                                                                                                                                                                                                                                                               |

---

## Next

### What decides the timing

- **BBL in January is the auction playtest.** Eight teams and a deep enough
  pool for six managers to fill squads; a bilateral series is not — two squads
  is about thirty players, and six managers need eighty or more.
- **IPL squads are not settled until the mini auction in January**, after the
  transfer window closes in December. There is no point holding a fantasy
  auction before then, which is why BBL comes first and IPL follows in
  February–March.
- **AUS vs SA runs on the current system**, as a match-based league with about
  five people. It is the first time the season loop has been exercised by more
  than one human, and worth treating as the experiment it is — including
  timing how long one match's points entry actually takes.
- **The auction's mechanics need no audience.** A synthetic tournament with
  enough sample players exercises bidding, selling, undo, purses and squad
  limits with one person. Only the atmosphere needs a room full of people.

### Ideas raised, with the reasoning

- **Live chat during the auction** — cheap, rides on the rules carve-out the
  auction needs anyway, and makes the room self-contained. First choice if the
  auction is buffed.
- **Co-managers on one team** — more people in the room, but it changes the
  single-writer-per-team property the bidding design relies on, and touches
  every "is this your team" check. Most of its value lands in the season,
  which January will not have.
- **Head-to-head fixtures, survivor, chips** — engagement features derived
  from points already collected, so they add **no recurring admin work**. The
  best of the cheap wins, once there are users to engage.
- **Predict-and-win** — rejected for now, not because it is dull but because
  it adds per-match admin work forever, on top of manual points entry.
- **Automated scoring ingestion** — the sleeper. Points are typed in by hand
  today, which is survivable for five people and not for a season with real
  users. Needs lead time, and the hard part (matching external player names to
  internal ids) is the interesting part.

---

## Backlog

Small items logged instead of fixed. None blocks anything.

- **A dedicated bid processor**, if the auctioneer's browser proves fragile: one
  always-on Cloud Run instance (exactly one, CPU always allocated), separate
  from the API, holding the listeners and the timer. Tens of dollars a month
  if left running; never deploy it mid-auction, or add a database lock so only
  one copy processes.

- **Every API request pays a CORS preflight.** The site and the service are on
  different origins and requests carry `Authorization`, so the browser sends an
  `OPTIONS` before each one, and `cors()` in `apps/api/src/index.ts` sets no
  `maxAge`, so the browser re-asks almost every time. A gameweek switch on My
  Team is 3 requests plus up to 3 preflights. **Latency, not money** — preflights
  never touch the database and sit far inside Cloud Run's free tier. Two fixes,
  either or both:
  - `maxAge` on `cors()` (Chrome caps it at 2 hours): one line, but cached per
    exact URL, so each gameweek's first visit still preflights;
  - serving the API from the site's origin — a Firebase Hosting rewrite of
    `/api/**` to Cloud Run, and a Vite proxy locally — which removes CORS
    entirely. An infrastructure change; check Hosting can rewrite to Cloud Run
    in `asia-southeast1` first.
- **My Team refetches a gameweek on every visit.** Remembering loaded periods
  (cleared on save), and fetching the neighbouring ones in the background, would
  make going back instant. Page-only.

- Custom-scoring points entry, and a cache stamp for it
  (`customPointsUpdatedAt/{leagueId}`).
- Actions Center: derive real items, starting with "a team deadline with no
  team set".
- Role icons from a proper icon set, if revisited (hand-drawn ones were
  rejected).
- The captain and vice-captain multipliers are defined twice, in the data layer
  and in `lineup-view.tsx`. They should share one definition.
- "Transfers" (the changes box on My Team) collides with the auction's
  Transfers Center.
- **`apps/api/src/firebase/firebase-api.ts` is misnamed.** "api" already means
  the `Api` contract, the `apps/api` workspace and the deployed service.
  *Adapter* is the accurate word — `Api` is the port, this is its Firebase
  adapter — so `firebase/adapter.ts` with `createFirebaseAdapter`, and
  `firebase-service.ts` becomes `firebase/client.ts`, which is what it calls
  itself in its own header.
