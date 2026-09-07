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
itself** — its only action is leaving for the live auction, and even the
auctioneer's Open auction room button is navigation rather than a write.

Absent entirely in regular leagues. Hitting the route there redirects to the
league's default section, per `04-navigation.md`.

---

## What the page shows, by phase

The page changes substantially depending on where the league is. The third of
these covers everything from team submission through the season to a finished
league — most of a league's life — while the first two are brief.

### Pre-auction

The manager's question here is _"when is this, and what am I preparing for?"_

**The auctioneer sees an Open auction room button. Nobody else does.**

> **This is the only route to starting an auction.** The Start auction control
> lives on the live auction page, so if the button appeared only once an auction
> was live, nothing could ever make one live. The auctioneer needs to arrive
> before it begins anyway — to set up, to check the pool, and because starting
> it is the first thing they do there.
>
> **The backup auctioneer sees it too**, since they may need to take over.
>
> The label differs deliberately. Pre-auction the auctioneer is going somewhere
> to _begin_, not joining something already running.

- **When the auction is scheduled**, and how long until it
- **Who is bidding** — every member holding the manager role, with their team
  names. This is the field a manager is bidding against.
- **Who is running it** — the auctioneer, and the backup
- **The player pool**, with each player's base price, category and role.
  Filterable by category and role, since that is how the auction itself is
  batched.
- **A summary of the rules that shape bidding**: budget, squad size minimum and
  maximum, per-role combination limits, the overseas cap, the bid increment and
  the round timer

> **The rules summary is read-only and abbreviated.** It exists so a manager can
> plan without leaving the page. The full configuration, and any editing, is in
> League Details.

> **Nothing here reads the auction runtime, because it does not exist yet.**
> `liveAuctions/{leagueId}` is created by `startAuction` and by nothing else, so
> before the auction begins there is no node to read. The entire pre-auction
> state renders from `getLeagueConfig` and `getMembers`.
>
> **The `NotStarted` phase is not this moment.** It describes the state after
> the auctioneer has opened the room and before the first player goes up — not
> the weeks preceding it. Any code that assumes the runtime node exists whenever
> a league is an auction league will fail here.

**No draft order yet.** It is generated when the auction starts, deliberately —
a manager's bidding strategy depends on where they sit in the draft, so it is
settled before any money is spent rather than after.

### Auction live

The page's job shrinks to one thing: **get the manager into the auction.**

- **A prominent Go to Auction** button, now shown to **everyone** — managers,
  spectators and admins alike
- Enough state to confirm it is genuinely running — how long it has been going,
  how many players have sold, who is currently up

> **Go to Auction opens the live auction in a new browser tab.** The auction is
> a self-contained, high-focus activity, and keeping it in its own tab means a
> manager cannot lose it by clicking something else in the main one.

Everything from the pre-auction state stays available below, since the player
pool and the rules are still what a bidder wants to check mid-auction. But it is
secondary to the button.

### After the auction

**This is the historical record of what happened**, and nothing else in the
product covers it.

- **Every player and what became of them** — sold to whom and for how much, or
  unsold
- **Each manager's final position** — what they spent, what they had left, and
  the squad they finished with
- **The bidding on any individual player**, on drill-down: who bid what, in
  order, and what it finally went for
- **The draft order**, and which picks went where

> **This is not the same as Squads.** Squads shows who owns whom **now**, and
> that drifts as transfers happen. Auction Center shows what was **paid**, which
> never changes. A manager who traded away their most expensive buy still
> bought them, and the record should say so.

---

## Spectators

See exactly what a manager sees, with no distinction. There is nothing on this
page framed as _yours_ — no squad, no budget — so the spectator rendering is the
same page.

Go to Auction works for them too, once an auction is live. They arrive at the
live auction as a spectator, with no controls.

**They do not see the pre-auction Open auction room button** — that is
auctioneer and backup only, since there is nothing to spectate yet.

---

## Data layer

`06-data-layer.md` specifies the live auction page but not this one. These are
the reads this page needs. **Most already exist** for the live auction; the
distinction is that here they are one-shot reads rather than subscriptions.

**Pre-auction — no auction-runtime reads at all:**

- `getLeagueConfig(leagueId)` — the rules summary, **and the scheduled auction
  start**, which lives on the league rather than in the runtime
- `getMembers(leagueId)` — who is bidding, and who is auctioneer

**Live and after — existing calls, reused:**

- `getAuctionState(leagueId)` — current player, phase, batch, leading bid,
  minimum next bid, deadline
- `getAuctionPlayerPool(leagueId)` — with base prices and categories
- `getSoldPlayers(leagueId)` / `getUnsoldPlayers(leagueId)`
- `getManagerStatuses(leagueId)` — budget and squad size per manager
- `getDraftOrder(leagueId)`

**One new call:**

- `getPlayerBiddingHistory(leagueId, playerId)` — every bid on one player, in
  order. **On drill-down only, not with the page**, since fetching the full
  history for every player would pull the entire auction.

**No writes.** The page changes nothing.

**No subscriptions in the pre-auction and post-auction states.** In the live
state it subscribes to `onAuctionStateChanged` so the button and the running
counts stay current — but only that. The detailed live subscriptions belong to
the auction page itself.

---

## Loading, empty, error and mobile

**Loading.** The player pool is the slow part — every participating player with
their auction values. Render the scheduled time and the rules summary first;
those come from the league and arrive quickly.

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

The post-auction results have the same shape and the same risk.
