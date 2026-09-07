# My Team

Picking, viewing and editing a fantasy XI.

## First-time team creation

**The team name is not asked for here.** It is captured with the join request,
so an admin can reject or reject-and-ban over an inappropriate name before it
is ever visible in the league. It is per league, so the same person can have
different names in different leagues, and **it cannot be changed afterwards.**

- **11 dropdowns**, one per player. Auction leagues offer **only that manager's
  squad**; regular leagues offer the full tournament pool.
- **2 further dropdowns** for **captain** and **vice-captain**, populated from
  the current eleven. **They cannot be the same player.**

> **Dropdowns rather than a Dream11-style grid of player cards.** That grid
> works because you are picking from one match's two squads — about thirty
> players, a natural browsing set. Picking eleven from an entire tournament of
> roughly two hundred is not browsing, it is searching. Dropdowns with
> type-ahead match that.

**Slots are not pre-assigned by role.** Any player can go in any slot. Role
composition is *validated*, not structurally enforced — pre-slotting cannot be
done honestly when the rules specify ranges (minimum three bowlers, maximum five
batsmen) rather than exact counts.

## The live summary panel

Sits alongside the dropdowns and updates as selections change.

**This panel is doing real work, not decorating.** With free slots it is the
only thing telling a manager whether their team is legal.

- Current selection, **sorted by role**
- **Count of each role**, and **overseas count**, against their limits
- **Illegal values highlighted**

> **Overseas means the player's country is not India.** The cap exists in
> auction leagues only; regular leagues have none, so the overseas count is not
> shown there.

**An illegal team cannot be submitted.**

> This is consistent with the auction deliberately permitting illegal squads. A
> manager who cannot field a legal XI scores zero for that gameweek — blocking
> submission produces exactly that outcome and states it clearly, rather than
> accepting a team the system would silently void.

## Missed deadline

If the deadline passes with no team submitted, the team simply **applies to the
next gameweek or match**. The manager scores zero for the missed period and
resumes normally.

> **Rejected: removing the manager from the league.** Disproportionate to the
> failure — someone forgot, or lost connectivity — and destructive in an auction
> league, where they own a squad they paid for. Removing them raises questions
> with no good answer: what happens to their players, does the leaderboard
> renumber, can they be re-added. Scoring zero is already a real penalty, it is
> self-correcting, and it needs no admin intervention.

---

## Existing team — match-based leagues

**Which match is shown:** the current match, if it has not ended.

> **Determining "ended":** end times are not stored. Start plus four hours for
> T20, nine for ODI, five days and nine hours for a Test is close enough.
> **Being slightly wrong here breaks nothing** — a rain delay just means the
> user clicks "previous match", and that match is not editable anyway because
> its deadline has passed. **Deadlines always come from the scheduled start time
> and never shift with delays.**

**Navigation:** previous and next, plus a dropdown to jump to any match. All
matches are navigable **for viewing**.

> **Editing is available only where the deadline has not passed.** Viewing is
> unrestricted; editing is not. Editing a past match would invalidate changes at
> every later match, including ones already played.

**Display:**

- Player list with points for that match
- **(C)** and **(VC)** marked
- **Multipliers shown transparently.** A captain who earned 50 shows as
  **100 (50×2)** — never a bare `100`. Same convention in gameweek display.
  **The captain multiplier is 2×, the vice-captain 1.5×**, so a vice-captain on
  50 shows as **75 (50×1.5)**. **The vice-captain is not promoted when the
  captain does not play** — the multipliers are fixed, and a captain who does
  not take the field simply scores nothing doubled.
- **Total points for the match**, summing the multiplied values

## Existing team — gameweek-based leagues

**Which gameweek is shown:** the current one if a gameweek is running, otherwise
the next one.

**Also show which round the gameweek belongs to.**

**Navigation:** previous and next gameweek, **up to next gameweek only**.

**Display — two options considered:**

| Option | Shape |
|---|---|
| 1 | Two tables split around the impact sub, **one column per match** |
| 2 | Same split, but **aggregate points per player** for the gameweek, with the per-match breakdown on hover or tap |

**Build option 2 first, everywhere. Add option 1 for desktop only if time
permits.**

> Option 1 gives a proper summary of the gameweek but takes a lot of space and
> cannot fit a phone without a scroll. Option 2 works identically on both. A
> frozen-player-column horizontal scroll was considered — a known pattern, but
> fiddly on mobile browsers, and it still leaves a cramped table.

## Impact substitution

- **Gameweek running, no sub done** → a **Perform impact sub** option
- **Sub done, but the match it applies from has not started** → **Edit impact
  sub**, shown beside the sub details between the two tables

The modal offers a player to remove, a player to bring in, and the match to
apply from. **The match dropdown lists only matches that have not started**, so
the choice set shrinks as the gameweek progresses.

**The captain and vice-captain cannot be impact subbed.** The out-player list
excludes both, so a sub can never leave the gameweek without one.

## Editing

Available where the deadline has not passed. **Editing turns the view into the
same submission form used for first-time creation.**

The live summary panel gains extra content in edit mode:

- **Players out** and **players in** — lists and counts
- **Changes left**, and **changes you are about to use**
- The same for captain and vice-captain changes

- In gameweek leagues, changes for **this round** and **this gameweek**

> **One change is one player out and one player in.** Swapping three players
> uses three changes. **Captain and vice-captain changes are counted
> separately**, against their own allowances, and neither is a team change.

**On submit, a confirmation dialog:** *"This will overwrite your team for all
future matches, are you sure?"* The change applies only on confirmation.

> **This warning is not optional.** A team applies forward until changed again,
> so editing at match 15 overwrites everything from 15 onward — including a
> change the manager made at match 30 and has since forgotten about.

## Note for whoever builds the squad dropdown

**Squad membership depends on the match, not just the manager.** After a
transfer, the incoming player is available from the next match onward. So the
options for match X depend on what the squad was at match X — not on what it is
now.
