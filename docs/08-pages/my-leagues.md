# My Leagues

**This is home.** Both the logo and the My Leagues header item point here.

**Why home is this and not Tournaments:** Tournaments is a discovery surface
used a handful of times ever. My Leagues is where a user goes every day during a
season. Home should be what they are actually returning for.

## Tabs

| Tab | Contents |
|---|---|
| **Active** | Leagues you have joined **and** leagues you spectate, merged, with a **spectator tag** where applicable |
| **Pending** | Your outstanding join requests |
| **Archived** | Leagues finished more than **24 hours** ago |

**Landing logic:** land on **Active**. If there are no active leagues, land on
**Pending**. If neither has anything, show the empty state.

**Rejected requests are not a tab.** A **"View rejected requests"** button sits
on the Pending tab, opening the list in a side panel with the same card styling
and a **request to join again** action.

> **Why rejected is not a tab:** a rejected league is not one of "my leagues" —
> it is a league you are *not* in. Putting it beside active leagues flattens a
> real category difference. Pending is where you go to check whether a request
> came through, so it is the natural place to look.

> **Why tabs rather than one filtered list:** this is a **lazy-loading
> boundary**. Archived grows without bound and should not be fetched unless
> asked for. Filters were considered — they are better for *combining* views,
> tabs for *switching* between them, and this is mostly switching.

> **The boundary is only real because archived entries live in their own node.**
> Reads are subtree-shaped, so if every entry sat under `users/{uid}/leagues`,
> one read would drag the whole archive along with the active leagues and the
> tab would be a filter wearing a tab's clothes. Status is derived, so the index
> cannot be queried to avoid that either. See `docs/05-data-model.md`.

> **Active and spectating are merged deliberately.** A spectated league is one
> you are in. Separating them would mean checking two places to answer "what am
> I involved in", and a spectator's card differs only in which actions it
> offers.

## The league card

Shows: **league name · owner · type · tournament · status**, plus start time and
deadline where they fit. Everything else goes behind **view details**.

**What the card shows for numbers depends on the phase:**

| Phase | Shows |
|---|---|
| Pre-auction · Auction phase · Team submission | **`filledSlots` of `maxSlots`** |
| Active | **`<n>` members** |
| Finished, inside the 24-hour window | Status only |
| Archived | Name, tournament, type, and **your final position** |

> **Max slots is dropped once a league is active.** Nobody can join any more, so
> the ceiling stops meaning anything. The count itself stays, as league context.

> **No rank on an active card.** Rank needs the league's whole lineup subtree
> plus the points node, which at forty managers across sixty matches is a
> quarter to half a megabyte *per league*. That is fine on league home, which is
> one league, and wrong on a page rendering several cards. Rank lives on the
> league home summary strip.

> **The counts are not free and are not stored.** `filledSlots` is derived by
> counting members who hold the manager role, and status is derived from
> timings, so both come from reads against the league rather than from the
> user's league index. `docs/06-data-layer.md` says exactly which reads.

**Status** is one of: **Pre-auction · Auction phase · Team submission · Active ·
Finished**

> These are the same five states as the league home page lifecycle. **One
> derivation shared by both** — do not implement it twice.

> **Not all five are reachable by every league.** Pre-auction and Auction phase
> apply to auction leagues only. A regular league never enters either.

**The card body itself is the link to league home.** Buttons are reserved for
secondary actions, which keeps the card clean as roles multiply.

| Card variant | Behaviour |
|---|---|
| Joined or spectating | Card links to league home |
| Pending request | **No** link to league home |
| Rejected, not banned | **Request to join again** button |
| **Banned** | Clearly stated. No re-request. |

**"Manage league" is not on the card** — it lives on league home, and the
actions center already surfaces admin work.

## Sort order

**Order joined**, for now.

Later: earliest upcoming deadline. Low priority — it only matters when a user
has many leagues, which is the same case that made pagination unnecessary.

## Empty state

**"You have no leagues"** with a **Join a league** button, shown when Active and
Pending are both empty.

> This screen matters more than its size suggests. A brand-new user lands here,
> and so does anyone evaluating the project for the first time. The eventual
> target is a fuller exploration screen offering three paths — join by code,
> browse tournaments, create a league — but the simple version ships first.

> **Rejected: a guided tour.** Substantial to build, most people skip them, and
> a first-time visitor will click straight through. A well-designed empty state
> with clear paths does the job.

## Cut for Phase 1

| Cut | Why |
|---|---|
| **Infinite scroll / pagination** | Nobody will have ten or more active leagues. Even fifty is one small read. Real complexity for a case that will not occur — and Archived, the one list that does grow, is handled by the tab boundary. |
| **"Go to auction" on the card** | A fourth button competing for space. The auction is reachable from league home, and a live auction is already surfaced by the actions center. |
