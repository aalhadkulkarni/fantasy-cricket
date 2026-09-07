# Tournaments — list and detail

*Users see "Tournaments". In the model these are `tournaments`; the level above
them is `competitions`, shown to users as "Base Tournament". See
`site-header.md`.*

## Public and closed leagues

Leagues are **public** or **closed**. **Closed leagues are visible to
everyone** — only *entry* is restricted, by admin approval.

> **Consequence:** the league code is a **convenience shortcut, not the access
> mechanism.** A closed league can be found on its tournament page and requested
> from there with no code at all.

## Tournament list

**Tabs:** Upcoming *(default)* · Active · Past

> **Upcoming is the default deliberately.** For a tournament already running,
> people reach their leagues through My Leagues. **Upcoming is where users go to
> find a league to join or to create one** — which also means a first-time
> visitor lands on the tab where creating a league makes sense.

> Tabs are also a lazy-load boundary. **Past** grows without bound and should
> not be fetched unless selected.

**Cards show:** tournament name · start date · end date · format

**Filter by format.**

**Only published tournaments appear** — those carrying a `publishedAt`.

**Tab membership comes from `startDate` and `completedAt`.** Readers never walk
the match list to work out tournament timing.

| Tab | When |
|---|---|
| **Upcoming** | `startDate` is in the future |
| **Active** | `startDate` has passed and `completedAt` is absent |
| **Past** | `completedAt` is set |

> **Past is a human decision, not a date.** `endDate` is the last match's
> *start* time, and a match is not over when it starts — a Test runs five days.
> Deriving Past from it would drop a tournament out of Active while its final
> was still being played. Adding a format duration would be right most of the
> time and wrong on every rain delay and early finish, so the tab follows the
> admin marking it complete.

**`endDate` earns its place on the card, not in the tabs.** It is absent while
any match is undated, which is what makes a tournament published with only its
first match dated behave correctly: the card simply shows no end date.

> **`startDate` and `endDate` are maintained on write, not derived on read.**
> Any change to a match's start time recomputes them as part of the same write.
> See `docs/06-data-layer.md`.

> **Cut: a "start a league" button on the card.** The detail page has one and so
> does the header. A third entry point competes for card space; cards should do
> one thing.

## Publish gate

**A tournament cannot be published unless at least its first match has a start
time.** Publishing sets `publishedAt`, and the gate is enforced in the data
layer rather than only in the admin form.

**Marking a tournament complete is what moves it to Past.** Until an admin does
that it stays **Active**, however long ago its last match was scheduled.

> Ideally every match of the first round would be dated — there is no real use
> case for publishing without it — but requiring only match 1 keeps the gate
> cheap for the system admin, and it is the minimum that makes the card and tab
> logic work.

## Tournament detail

Shows **number of matches** and **rounds**.

**Buttons opening modals:** Teams · Players · **Fixtures** (the full schedule).

**Existing leagues for this tournament** — both public and closed.

> **Rendered with the same league card component as My Leagues, in a variant.**
> There, cards are for *your* leagues and carry status, spectator tags and
> go-to-league targets. Here you may have no relationship with the league, so
> the card carries **join / request to join** and **slots remaining** instead.
> Shared component with variants, not two implementations.

**Create a League** button — prefills this tournament.

## Not in Phase 1

**Search across past tournaments.** Format filtering plus the tab split is
enough; a name search adds no immediate value.
