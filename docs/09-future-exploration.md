# Future Exploration

**Optimisations, not gaps.** Everything in this document is something the
current model can already do. It would just do it better.

The types in `src/types/` are sufficient to build the system. Nothing here
blocks implementation, and nothing here should be taken on mid-feature because
it seemed tidier at the time. Each entry is a deliberate change with a cost, to
be picked up on its own.

**Several of these change the database, not only the frontend types.** Where
that is true it is said explicitly, because it means a migration and a rewrite
of `docs/data-model.js`, not a refactor.

---

## 1. Thin team and player records on a tournament

**Changes the database.**

`tournaments/{tournamentId}/participatingTeams` is a set of team ids, and
`participatingPlayers` is a map from player id to team id. Neither carries
anything renderable, so every screen that shows a tournament's players or teams
has to read the global `players` and `teams` nodes and join.

There is no query that fetches a chosen two hundred players, so that join means
reading the entire catalogue — every cricketer in the system across every
competition — to render two hundred of them.

**The change is the one `LeagueIndexEntry` already makes for leagues:** carry
exactly the fields a screen renders, and nothing more.

```js
participatingTeams: {
  team001: {
    teamId: 'team001',
    teamName: 'Royal Challengers Bengaluru',
    teamShortName: 'RCB',
  },
}
```

Dropping `competitionIds` and `playerIds`, which are global facts about a team
and have no meaning scoped to one tournament.

```js
participatingPlayers: {
  player001: {
    playerId: 'player001',
    playerName: 'Virat Kohli',
    playerShortName: 'Kohli',
    country: 'India',
    playerRole: 'batsman',
  },
}
```

`getPlayersForTournament` then becomes one read of exactly the players that
matter, and the frontend never touches the global catalogue to draw a lineup.

**A side benefit worth naming.** A `Player` carries `currentTeams`, which is
live. Embed a full `Player` in a finished tournament's lineup and it reports
today's clubs, not the ones from that season. A tournament-scoped record has no
`currentTeams` at all, so the trap disappears rather than being documented
around.

### Two things to settle before doing this

**Where does "which team is this player in, here" live?** That question is why
`participatingPlayers` exists at all — see TBD5 in `docs/data-model.js`. The
shape above has no team field, so the answer would have to come from
`participatingTeamPlayers`, the reverse map, which turns a direct lookup into a
scan. Either the record keeps a `teamId`, or the reverse map becomes the only
answer and the cost of that is accepted.

**`playerRole` becomes a second copy.** It is deliberately system-wide and not
overridable per league, because standard points depend on it: a bowler is not
penalised for a duck where a batsman is. A frozen copy on the tournament can
drift from the global one, and then lineup rules would validate composition
against a different role than scoring used. Options are to refresh the copy, or
to treat the tournament copy as the display answer while scoring keeps reading
the global record. Not hard, but it must be chosen rather than discovered.

---

## 2. A league should carry its tournament, not a tournament id

Every screen that shows a league shows something about its tournament — the
name at minimum, and often the fixtures. Today `League.tournamentId` is an id,
and `LeagueIndexEntry` works around it by denormalising `tournamentName`
alongside `tournamentId` so the My Leagues card can be drawn without a second
read.

Carrying the tournament directly removes both the second read and that
workaround.

**Not the whole tournament, though.** A `Tournament` carries its matches, its
participating players, the reverse map of those, its rounds and its league
index. Embedding all of that into a league would move the read cost rather than
remove it — reading a league to show its name would drag sixty-four matches and
two hundred players, which is the exact problem the model split lineups and
squads out of `leagues` to avoid.

So this is really "a league carries a thin tournament", and **it is much cheaper
after item 1**, which is what defines what thin means. Worth doing in that
order.

Check when picking it up whether `LeagueIndexEntry` still needs its
`tournamentName` copy, or whether it collapses into this.

---

## 3. How components are grouped in folders

**Undecided, and deliberately left alone.**

`src/components/` currently holds `ui/` for the generated shadcn primitives,
`layout/` for the app shell, and two files loose at the root. That is fine at
this size. The question is what happens as it grows, and there are two answers.

**By page** — `components/my-leagues/`, `components/auction/`,
`components/leaderboard/`. Matches how `docs/08-pages/` is organised and how the
work is actually being done, one screen at a time. Finding something is easy
because you already know which screen it was on.

**By domain** — `components/leagues/`, `components/tournaments/`,
`components/lineups/`. Matches the model, and matches the route segments:
`/leagues/:leagueId`, `leagues/{leagueId}` and `components/leagues/` would all
agree.

### What decides it is how much gets shared

Grouping by page only stays clean while components belong to one screen. This
product has a fair amount that does not, and **two cases are mandated by name**:

> **One derivation shared by both** — do not implement it twice.
> (`08-pages/my-leagues.md`, on league status)

> **This is the same view as My Team** ... One shared component, not a second
> implementation. (`08-pages/leaderboard.md`, on viewing another manager's team)

Several more are implied. The league card appears on My Leagues and again in the
rejected-requests panel "with the same card styling", and a tournament page
lists leagues too. The member list is read by Members, Admin Center and Auction
Center. A squad shows on the Squads page and inside a modal during the auction.
The join dialog opens from the site header and from a tournament page. A player
row turns up on My Team, Squads, the auction and the transfer offer builder.

**Under page grouping all of those go to `shared/`** — which would then hold the
league card, the team view, the member list, the player row and the squad view,
most of the components that matter. The page folders keep the leftovers.

### Why it is not urgent

The two schemes nearly coincide here. My Leagues maps to leagues, Tournaments to
tournaments, My Team to lineups, Squads to squads, Transfers Center to
transfers. They only diverge on the shared cases above, and none of those exists
yet.

**Revisit when the first component is genuinely wanted by two pages.** That is
the moment the answer stops being theoretical. Until then the flat arrangement
costs nothing, and `join-league-dialog.tsx` stays at the root of
`src/components/` rather than being moved twice.

If it goes to domain, the rule that makes it decidable is: **a component lives
in the folder of the thing it renders, not the page it appears on.**

---

## Adding to this document

An entry belongs here when it is an optimisation with a real cost that the
system does not need in order to work. Something that blocks a feature is not
future exploration; raise it instead. Say what changes, why, and whether the
database moves.
