# Auction Center

**Sidebar item on league home. Auction leagues only.**
**Route:** `/leagues/:leagueId/auction-center`

The auction as an **event**, across its whole lifecycle — before it runs, while
it runs, and after. It is the default landing section for both the pre-auction
and auction-live phases.

> **Not to be confused with the live auction page.** Auction Center is a section
> inside league home, reachable at any time. The live auction is a separate
> page at `/leagues/:leagueId/auction`, opened in a new browser tab, where
> bidding actually happens. The names are adjacent and the pages are not — see
> `08-pages/auction.md`.

---

## What this page is not

**It does not edit anything.** All auction configuration — budget, squad sizes,
combination rules, per-player base prices and categories, the scheduled start,
the auctioneer and backup — lives in **League Details**, where admins edit it in
place.

Auction Center _displays_ the settings a manager needs in order to prepare, and
links to League Details for the rest. Duplicating the editing surface would give
two places to change the same thing.

---

## Reachable by

Every member of an auction league, and spectators. **The page changes nothing
itself** — its only action is leaving for the live auction, which is navigation
rather than a write.

Absent entirely in regular leagues. Hitting the route there redirects to the
league's default section, per `04-navigation.md`.

---

## What the page shows

**The same page in every phase.** It is the reference a manager prepares from
and checks back against mid-auction:

- **The auction rules** — budget, squad size minimum and maximum, per-role
  combination limits, the overseas cap, the bid increment and the round timer
- **When the auction is scheduled**, and how long until it
- **Who is bidding** — every member holding the manager role, with their team
  names
- **Who is running it** — the auctioneer
- **The player pool**, with each player's base price, category and role.
  Filterable by category and role, since that is how the auction is batched.
- **The draft order**, with positions nobody holds yet shown as **TBA**. It is
  assigned as managers join, not generated at the start — see
  `08-pages/auction.md`.
- **The batch sequence** — Marquee, then Star, then the draft

> **The rules are read-only and abbreviated.** They exist so a manager can plan
> without leaving the page. The full configuration is in League Details.

**A Go to auction button, shown to everyone** — managers, spectators and admins
alike, in every phase. It opens the live auction in a **new browser tab**, so a
manager cannot lose it by clicking something else. Someone with no role there
sees it with no controls, which is harmless.

> **The auctioneer reaches Start auction the same way.** That control lives on
> the live auction page, and the button being there from the start is what
> makes it reachable.

> **The after-auction record is not here.** Every sale, and the bidding on each
> player, is shown on the live auction page, which stays open after the auction
> ends. See `08-pages/auction.md`.

> **Nothing before the auction reads the auction runtime, because it does not
> exist yet.** `liveAuctions/{leagueId}` is created by `startAuction` and by
> nothing else. Any code that assumes the runtime node exists whenever a league
> is an auction league will fail here.
>
> **The `NotStarted` phase is not this moment.** It describes the state after
> the auctioneer has opened the room and before the first player goes up — not
> the weeks preceding it.

---

## Spectators

See exactly what a manager sees, with no distinction. There is nothing on this
page framed as _yours_ — no squad, no budget — so the spectator rendering is the
same page.

Go to auction works for them too, in every phase. They arrive at the live
auction as a spectator, with no controls.

---

## Data layer

- `getLeagueConfig(leagueId)` — the rules, the scheduled start, the auctioneer
- `getMembers(leagueId)` — who is bidding
- `getAuctionPlayerPool(leagueId)` — with base prices and categories
- `getDraftOrder(leagueId)` — including the positions still unclaimed

**No writes.** The page changes nothing.

**No subscriptions.** The live detail belongs to the auction page itself.

---

## Loading, empty, error and mobile

**Loading.** The player pool is the slow part — every participating player with
their auction values. Render the scheduled time and the rules first; those come
from the league and arrive quickly.

**Empty.** Two distinct cases, and they should not look alike:

- **No auction scheduled yet.** The admin has not set a date. Say so, and say
  who can set it.
- **Auction scheduled, but the player pool is empty.** Participants are chosen
  when a system admin creates the tournament, but **nothing gates publishing on
  them** — the publish gate only requires the first match to have a start time.
  So this is reachable, and it must say so rather than rendering nothing.

**Error.** A failed read here is not blocking — a manager can still reach the
live auction from the actions center if one is running. Say what failed and
offer a retry rather than replacing the page.

**Mobile.** The player pool is a long list with several columns of values, and
it is the one thing on this page at real risk of a horizontal scroll at 390px.
Aggregate rather than tabulate: player, base price and category on one row, with
role as an icon or tag.

The draft order is short and needs no special handling.
