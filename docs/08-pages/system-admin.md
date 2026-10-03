# System admin panel

**Reached from the site header. System admins only.**

> **Labels versus model names.** The UI says **Base Tournament** (IPL, ODI World
> Cup, Generic ODI) and **Tournament** (IPL 2027) — the same words every other
> user sees. In the data model these are `competitions` and `tournaments`
> respectively.

## Aggregate views

One list each for **Base Tournaments · Tournaments · Players · Teams**, each
with search, sort and filter.

**Matches have no top-level view.** They are viewable and editable only from
inside a tournament.

## Conventions applied everywhere here

- **Bulk upload via CSV paste** for teams and players, on `/admin/bulk` (see
  Bulk upload below)
- **In-place editing** for existing records

## Base Tournaments

Create and edit: **name, format, and an optional home nation.**

**The home nation decides who is overseas** — IPL → India, BBL → Australia. A
player whose country is not the home nation counts as overseas in that base
tournament's tournaments, which matters for the auction league's overseas cap.
**Left empty, it counts as India.** There is no "no overseas" setting.

> **It is copied onto each tournament when the tournament is created, and frozen
> there.** Changing it later affects tournaments created afterwards, never one
> already running.

## Creating and editing a tournament

1. Choose the parent **Base Tournament** — **the format is derived from it**,
   not entered separately
2. **Pick the participating teams**
3. The system then shows existing players for those teams, and the admin selects
   which are participating
4. Matches are created as placeholders and filled in from within the tournament

**Publishing** sets `publishedAt`, and is what makes a tournament visible in the
tournament list and selectable when creating a league. It requires at least the
first match to have a start time.

**Publishing can open official leagues in the same write.** When any gameweek
league is among them, the admin **must choose a gameweek length for every
round** — a divisor of that round's match count, 1 to N, with no default. One
choice per round serves every gameweek league opened in that publish. A length
of one match has no "during the gameweek", so the impact sub is off in that
round.

**The official auction league** is the third option, unticked by default. It
asks for **when the auction starts**, which must be in the future and before
the first match. The league is public, has six slots, uses the standard
auction rules, and closes to joining when the auction starts. The publishing
admin is its auctioneer. Participants without auction values enter its pool as
General at 2. It is gameweek-based, so it needs the per-round lengths too.

**Marking a tournament complete** sets `completedAt`. It is prompted when points
for its last match are entered — but never done automatically, since the admin
may still need to add matches they forgot.

> **This is what moves a tournament to the Past tab.** It is not derived from
> dates, because `endDate` is the last match's *start* time and a Test runs five
> days — a tournament would leave Active while its final was still being played.
> A person decides instead.

**Marking a team eliminated** from a given match onward. Players of an
eliminated team are **still shown** in team selection, marked as eliminated — a
manager may be forced to pick one through combination constraints or having no
transfers left.

> **Elimination is marked manually, not derived.** A team can be mathematically
> out with league games still to play; this is not a knockout-only concept.

## Players

- Add in **bulk** — `/admin/bulk`, below
- **Category and base price are required when a player is created**, alongside
  name, country and role. They are the player's standard auction values, and
  are written with the player in one atomic update. Players created before this
  requirement have none; they are not backfilled.
- **Edit in place** — role, category, base price
- **Set a player's current team**, per competition
- **Mark retired from a competition** — done by removing that competition from
  their current teams, not by a separate flag
- **Mark fully retired from cricket**, and unretire, which is the one case
  absence from current teams cannot express

> **A Retired Players view is deferred to Phase 2.** A fully retired player
> drops out of the player list, and there is currently no screen that lists them
> or lets one be brought back. Retirement is rare enough that it will not come
> up in Phase 1.

## Points entry

**Reached from tournament home, not from this panel.** An **Update points**
button beside Fixtures, shown to system admins only, opens
`/tournaments/:tournamentId/points`. The tournament is already chosen there, so
the panel would only need a picker to choose it again.

Select a match, see every eligible player, enter points, submit. The dropdown
opens on the match after the tournament's `pointsUpdatedTillMatchId`, labelled
"Match 12 · IND v AUS", and **Select match** loads it. Eligible players are both
teams' squads in this tournament, so a match with a TBD team cannot be scored
until the fixtures editor sets it.

**If points already exist the form is prefilled**, and submitting overwrites.

> **The write is a full replace.** Blank and zero are equivalent, so reopening a
> match to fix one player resubmits every player's value. Prefill must be
> reliable — if it silently fails, correcting one player would blank everyone
> else.

## Bulk upload — `/admin/bulk`

**Pasted CSV, not files**: one row per entry, values separated by commas. The
first row is skipped **only if it is exactly the header** (any case or
spacing), so a real first row is never dropped. **Preview** runs the import as a
dry run, so every row is judged by the service's own rules — new, updated,
unchanged or an error with its reason; **Import** is offered only when no row
has an error, and writes everything in **one update, or nothing**. Upload teams
before players: players are matched to them.

**Teams** — `name,short name,base tournaments`, base tournaments separated by
`;` and matched by name. New teams only; an existing name is an error. No
roster: players join through their own rows.

**Players** — `name,short name,country,role,category,base price,IPL team,BBL team,international team,formats`,
formats separated by `/`.

**Fetch rather than type.** Above the text area, buttons fill it with existing
players as ready-made rows, to edit in place and import back: all IPL players,
or one IPL team's; the same for BBL; all international players, or one
national team's. **Each fetch replaces what is in the text area** — fetching
RCB then MI shows only MI. A row fetched and imported unchanged changes
nothing. A league with no base tournament yet says so instead.

- **Role** BAT, BOWL, WK or ALL (or the full words); **category** marquee, star
  or general. **Short name** may be left empty: the surname, or initial and
  surname on a collision.
- **IPL team** and **BBL team**: each matched within that league. The league
  columns are a list in the shared code (`LEAGUE_COLUMNS`), so another league
  is one entry. Not part of the seed data.
- **International team and formats**: t20 is T20 Series and World T20, odi is
  ODI Series and ODI World Cup, test is Test Series; the same team in each.
  Teams are matched by short or full name within the base tournament.
- **A new player** needs name, country, role, category and base price.
- **A name already in the catalogue is updated, and only what the row names
  changes**: filled values overwrite, empty ones are kept; a filled IPL or BBL
  team replaces their team in that league; a filled international team sets
  the base tournaments its listed formats mean and leaves the others as they
  were. So each season's league teams can be re-uploaded without restating
  anyone's international cricket. Dropping a format is done in the players
  panel. Both sides of every membership move: the player and the team
  rosters.
- The preview also flags a country not in the admin form's country list, as a
  likely typo; the service only requires one.

## Nothing here deletes

**There is no delete for a tournament, player, team, competition or match**, and
that is deliberate rather than missing. Each has a way to be taken out of
circulation without destroying anything that references it:

| Created by mistake | What to do instead |
|---|---|
| **Tournament** | Do not publish the duplicate. An unpublished tournament is invisible to users and cannot have a league created against it. |
| **Player** | Mark the duplicate fully retired. |
| **Team** | Remove it from its competitions, which takes it out of every tournament that could draw on it. |

> **Deleting would be the dangerous option, not the convenient one.** These are
> the nodes everything else references. A deleted player leaves dangling ids in
> squads, lineups and points across every league that ever used them, and none
> of those can be walked backwards to find what broke.

> **The one delete in the product is a league**, restricted to its owner while
> they are its only member. See `admin-center.md`.

> **This screen is deliberately not user-friendly.** Its only user is the person
> who built it, so a slightly awkward workaround beats a destructive button.

### The exception: `/setup`, until the environment is released

**Development tools live on their own page, `/setup`**, not on the admin
panel. **System owner only** — every other account is sent home — and **linked
from nowhere**. They work on **every environment, production included, until
it is released**: `systemReleased` at the environment's root, set by hand in
the console when the system goes live. Once it is true the service refuses
every testing tool there, even for the system owner — these four, and the
auction's Reset and Mark batch unsold.

#### Refresh standards

**Rewrites the reference tables and the standards** from the seed data — roles,
formats, auction phases, timeline events; the auction config, lineup rules and
deadline offset a new league inherits. For an environment seeded before they
changed, since Set up basic system runs only once. Players, teams, tournaments,
leagues and base tournaments are left alone, and **every player's auction
values survive** (the auction config is written field by field).

#### Reset environment

**A whole environment cleared, not a record deleted**, so nothing is left
dangling. Two taps: the first arms it and says what will go, the second runs
it. **One atomic update**, so a failure changes nothing.

- **Deletes:** every player, team, tournament and league, and everything that
  hangs off them — lineups, squads, join requests, bans, transfers, live
  auctions, leaderboards, standard and custom points, the standard auction
  values, and every user's league lists.
- **Keeps:** user records, base tournaments, the reference tables and the
  standards.

#### Populate seed data

**Loads the IPL 2026 pool into an empty environment.** It deletes nothing, so
one tap — and the service **refuses it while any players or teams exist**:
Reset environment first. One atomic update.

- **Loads:**
  - **the ten IPL franchises**, in the IPL base tournament;
  - **thirteen national teams**, each in every international base tournament;
  - **the 250 players of the IPL 2026 pool** (`apps/api/src/seed-ipl-2026.ts`),
    each in their franchise and, for each format they currently play, their
    national team: T20 is T20 Series and World T20, ODI is ODI Series and ODI
    World Cup, Test is Test Series.
- **Category and base price come from a player's place in the list:** 1–12
  Marquee at 6, 13–24 Marquee at 5, 25–36 Star at 4, 37–48 Star at 3, and the
  rest General at 2.
- **Base tournaments are matched by name.** One not found is reported, and no
  one is put in it.

#### Create sample IPL 2027

**Test data, for testing publish and everything after it** without entering a
tournament by hand. Needs Populate seed data first, since it finds the IPL
teams by short name.

- **IPL 2027, unpublished**, in the IPL base tournament.
- **Every IPL team, and every player** with an IPL team.
- **The 2026 schedule moved to 2027:** the 70 league fixtures on the same
  calendar dates, IST start times and venues (cities); weekdays shift. **The
  four playoffs are dated but TBA vs TBA**, with no venue.
- **Three rounds:** League stage (1–70), Playoffs (71–73), Final (74).
- **Refused if an IPL 2027 already exists.** It is built from the editor's own
  calls, so a failure part way can leave one behind; Populate seed data clears
  it.

## Everything else

Publish gates, on-the-fly team and player creation, adding a system admin, and
adding matches to a tournament already under way are all specified in
`docs/03-roles.md` under System admin. **How these group into screens beyond the
structure above is yours to organise.**
