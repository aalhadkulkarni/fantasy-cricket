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

Fix these, or read them with this list beside them.

| Where | What it says | What is true |
| --- | --- | --- |
| `CLAUDE.md` ("Standard points are never copied…" row), `docs/01-overview.md` ("Standard and custom points resolve by fallback"), `docs/data-model.js` (points header, "falls back to standardPoints") | A league reads its own points store first and **falls back** to standard. | **There is no fallback.** A league reads custom points **or** standard points according to `isCustomScoringSystem`, never both. A custom-scoring league with no entry for a match scores zero for it. `docs/06-data-layer.md` and the code agree on this; the three places listed do not. |
| `docs/08-pages/site-header.md`, `docs/08-pages/my-leagues.md` | Create a League is in the header and on the empty My Leagues state. | Removed from both for now (see deferred). |
| `docs/05-data-model.md`, future-work table, "Materialised leaderboards" | Deferred. | Still deferred as described (computing on write). **Separately**, a read-side leaderboard *cache* now exists — see below. They are different things. |
| `src/data-layer/firebase/paths.ts` header | "Nothing is implemented; every function returns `notImplemented`." | About 65 are implemented, behind the `Api` interface. |
| `src/App.tsx` comment | "No route guards yet." | `RequireAccount` and `RequireSystemAdmin` guard routes. |
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

### Enforcement — what is and is not real

**The data layer checks everything a server would:** system-admin role on every
system-admin write, `manager` role on team writes, deadlines, squad legality,
change allowances and caps, owner or admin for league finishing, and team
visibility.

**But the data layer runs in the browser and the security rules are
permissive**, so none of this is enforced against someone writing to the
database directly with the client SDK. It becomes real when the backend
arrives. Known read-side gap: `getTournament` returns unpublished draft
tournaments to anyone.

---

## Next

**Agreed order: the backend, then the auction.**

The backend is still being decided. The leading option is a **Node service on
Google Cloud** using the Firebase Admin SDK, with the browser holding no
database access (`.read` and `.write` false) apart from whichever auction nodes
need live listeners. The `Api` interface in `src/data-layer/api.ts` is the
contract: a new implementation calls the service, and nothing above the data
layer changes.

Things the backend design has to settle:

- **Where it runs, and the region**, which follows the database's region.
- **Which reads stay direct.** Only the auction needs live updates; everything
  else can go through the service, with polling where freshness matters. The
  auction nodes need a node-by-node look, since bids may need to be private.
- **The leaderboard cache** can move from the database into server memory, or
  stay.
- **Sparse lineups** (`docs/05-data-model.md`) are the other large cost saving
  and are cheaper to do during the move than after.

**Known costs** at 100 managers over a 74-match season: dense lineups make an
uncached leaderboard read about 3.8 MB, the dominant cost. The cache removes
most repeat reads; sparse lineups would cut the rest by roughly 5–7×.

---

## Backlog

Small items logged instead of fixed. None blocks anything.

- Fix the stale documents listed above, in particular the points fallback.
- `getTournament` should not return unpublished drafts to non-admins.
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
