# Create League

**Two entry points, one page.** From the site header, or from a tournament page
— where the tournament dropdown arrives **prefilled and disabled**.

## Common fields

| Field | Notes |
|---|---|
| **Tournament** | Dropdown. Prefilled and locked if arriving from a tournament page. |
| **League name** | Prefilled with something like *"\<admin name\>'s league"* |
| **Accessibility** | Public or closed. **State explicitly** that anyone can join a public league, and that a closed league requires the admin to approve each request. |
| **Max slots** | **Regular:** up to 200, defaulting to 200. **Auction:** capped at 8, defaulting to the standard auction config's slot count. This is the only place a slot count is set. |
| **Join deadline** | Regular: no later than the first match's deadline. Auction: no later than the **scheduled auction start**. |
| **Team changes deadline** | Defaults to **"match start time"**. Editing reveals an *X minutes before match start* option. |
| **Points system** | Standard or custom. **State explicitly** that custom means the admin calculates points themselves and the system will not help. |
| **Points system description** | Free text. Only if custom. |
| **Hold an auction** | **An explicit opt-in, not a two-way Auction/Regular choice.** Regular is the baseline; an auction is the interesting addition. Framing it as a binary makes people deliberate over something that should be obvious. |

## If regular

**Is this a gameweek-based league?**

**If not:** total changes allowed across the tournament, and the same for
captain and vice-captain.

**If yes:** show the list of **rounds**, and for each round ask:

- **Gameweek length** — a dropdown of divisors of that round's match count,
  including 1 and N
- **Changes allowed before the round starts** — forced to unlimited for round 1,
  since the team can be edited freely before the tournament begins
- **Changes allowed between gameweeks in this round**
- **Impact sub allowed in this round?** — hidden when the round's gameweek
  length is 1, since there is no "during the gameweek"

> **Gameweeks are equal length within a round, which is why that constraint is
> not restrictive.** IPL: the group stage of 60 matches divides into six
> ten-match gameweeks; the playoffs of 4 become one gameweek of four, or two of
> two, or four of one. **Rounds are what make the knockout tail expressible.**

## If auction

**Gameweek-based is forced.** The admin sets **gameweek boundaries per round and
nothing else.**

**No change configuration is shown at all.** These fixed rules are simply
applied:

- Unlimited changes between gameweeks
- One impact sub during a gameweek

> **Why:** the squad is already the constraint. A manager picks from a limited,
> static set won at auction, so a change cap on top would be redundant. It also
> means transfers and change allowances never interact.

**The admin must still be told what configuration is being applied**, even
though they cannot alter it.

## Auction configuration

| Field | Notes |
|---|---|
| **Scheduled auction start** | Date and time |
| **Squad size** | Minimum and maximum. Two separate values, defaulting to 13 and 20. |
| **Budget** | Default 100 |
| **Player values** | Starts as standard, with an option to view and adjust |
| **Team combination rules** | Per role: minimum and maximum |
| **Overseas limit** | Maximum overseas players in the XI |
| **Allow transfers** | Yes or no. If yes: how many windows, and the start and end match of each. |

> **Slots are not repeated in this section.** The standard auction config
> carries a slot count and it seeds the **Max slots** field above, but the
> league stores that number once and only once. Two editable fields holding one
> number can only desync, and it would leave the edit locks unanswerable, since
> max slots stays editable while the rest of the auction config freezes when the
> auction starts. Beyond 8 an auction stops being fun, which is why the cap
> exists.

> **"Edit player list" would be misleading labelling.** The admin can adjust
> **base price and category** per player. They **cannot add or remove
> players**, and **cannot change a role.** Something like "Customise auction
> values" reads better — the wording is yours, but the constraint must be
> clear.

> **Roles are deliberately not overridable.** Standard points depend on role: a
> bowler is not penalised for a duck where a batsman, keeper or all-rounder is.
> A league that overrode roles while using standard points would be scoring
> against a role the points system does not recognise. Roles stay system-wide
> in Phase 1.

## After creation

A **"League created successfully"** modal showing the **league code**, and a
**Go to league** button.

> A brand-new league is empty and useless until people join, so surfacing the
> code immediately is the point of this screen.

## Deliberately not here

| Item | Why |
|---|---|
| **Auctioneer assignment** | Nobody has joined yet, so there is nobody to assign. This happens later, in League Details. |
| **Chips** (triple captain and similar) | Each is its own rule, state and display. Cut for Phase 1 — they would fit the round-config structure later. |
| **Transfer caps** | Phase 2. |
