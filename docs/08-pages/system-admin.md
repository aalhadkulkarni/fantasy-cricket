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

- **Bulk upload via CSV paste** on every entity
- **In-place editing** for existing records

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

- Add in **bulk**
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

Select a match, see every eligible player, enter points, submit.

**If points already exist the form is prefilled**, and submitting overwrites.

> **The write is a full replace.** Blank and zero are equivalent, so reopening a
> match to fix one player resubmits every player's value. Prefill must be
> reliable — if it silently fails, correcting one player would blank everyone
> else.

## Everything else

Publish gates, on-the-fly team and player creation, adding a system admin, and
adding matches to a tournament already under way are all specified in
`docs/03-roles.md` under System admin. **How these group into screens beyond the
structure above is yours to organise.**
