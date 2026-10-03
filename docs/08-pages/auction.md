# Auction

**One page, three role renderings. Not three pages.**

| Role | Sees |
|---|---|
| **Spectator** | The shared display. No actions, and **no "your team" framing anywhere.** |
| **Bidder** | Shared display, plus bid and pass controls |
| **Auctioneer** | Shared display, plus the control panel |

> **This must be one page.** Control is derived from *who currently holds the
> auctioneer role*, so the same route renders a control panel for whoever that
> is at that moment. Separate routes would turn a handover into a navigation
> problem instead of a data change.

Opened in a **new browser tab** from Auction Center, so a manager cannot lose
the auction by clicking something else.

**Anyone who can see the league can open it, at any time** — before, during and
after the auction. Someone without a role simply sees it with no controls.
There is no harm in looking, so there is no gate.

---

## The core mechanic — preserved, do not redesign

This has run multiple real auctions. It works. **The design below is deliberate
and must be reproduced, not improved on.**

- Bidders write **only** to their own field — their bid, or their pass, for the
  current player. Nothing else.
- The auctioneer's client is the **sole writer** of authoritative state: the
  current player, the leading bid, the minimum next bid, the deadline.
- The auctioneer subscribes to bidders' fields, validates each incoming bid
  against the current asking price and the deadline, and either accepts it or
  ignores it.

Because bidders cannot touch authoritative state, there is nothing to contend
over — which is why this needs no transactions.

> **There is a known race.** The auctioneer may read B's bid before A's, even if
> A wrote first. **This is accepted. It is not a defect and must not be
> "fixed".**

> **Settled for Milestone 4: bids are processed in the auctioneer's browser**,
> as above. With a server in place, every write still goes through it:
>
> - A bidder calls `submitBid`; the service checks they are a manager who has
>   not passed and can afford it, and writes only their own field.
> - The auctioneer's browser listens to the submitted bids, checks each against
>   the asking price and the deadline, and accepts it by calling the service,
>   which checks the auctioneer role and the bid again before writing.
> - **It processes bids one at a time**: the live round kept in memory, each
>   check-and-accept finished before the next starts, so two bids at the same
>   price arriving together cannot both be accepted — the second meets a price
>   that has already moved.
> - **It owns the round timer**, writing the first, second and last calls and
>   time up at 20, 10, 5 and 0 seconds.
>
> **Accepted cost:** if the auctioneer's browser disconnects or sleeps, the
> auction stalls. Selling is manual, so a missing auctioneer stalls it anyway.

## Layout

**Phone first, and the round gets the height.** The header is one small line —
league name and "Live auction" — because the page changes every few seconds.
Then, top to bottom:

- **Current batch** — "Marquee batsmen · 15 players remaining", or in the draft
  how many are left to pick from
- **The player box** — titled "Current player: Kohli (RCB) · Base price 5 cr"
  ("Next player" while only selected), with one line each for **current leading
  bid** and who holds it, **next asking bid**, **time remaining for the next
  bid**, and **managers out of bidding** (everyone who has passed). Between
  players it carries the headline instead.

Then the viewer's panel — the auctioneer's controls, a manager's bid panel, or
both for an auctioneer who plays — directly under it where a thumb is. Below
them, **Timeline · Managers · Players as tabs on a phone**, so the stage stays
near the top; **as columns on a wide screen**, with the timeline beside the
stage. Only one arrangement is mounted at a time.

**The auctioneer moves between batches in the order only** — one "Next batch:
<name>" control stepping through the league's sequence, with no jumping. Within
a batch they put up a chosen player or a random one. **Next batch stays
disabled until every player in the current batch has gone up**, sold or
unsold, and the service refuses it until then.

**A player is selected before bidding opens.** Selecting shows "Current player
is X"; Start bidding opens the round and starts the clock.

**Before Phase E, every control is "not wired yet"**: it renders in the state
the data puts it in and says so when clicked.

## Shared display

**Always visible:**

- **Current batch** — the category and role currently being auctioned
- **Headline** — either *"Current player is X"* or *"X sold to Y for Z"*,
  depending on the most recent event
- **Countdown timer** — its own element, **not a timeline entry.** Computed
  client-side against Firebase server time, never the local clock. Time-up is
  communicated by the countdown reaching zero.

**Aggregate summary:**

- Players **remaining / sold / unsold** — counts and lists
- **Managers table** — name · budget · number of players. Clicking the player
  count opens that squad in a modal.

**After the auction** the page stays open and becomes its historical record:

- **Every sale** — who bought whom, and for how much, plus every unsold player
- **The bidding on any individual player**, on drill-down: who bid what, in
  order, and what it finally went for

> This is not the same as Squads. Squads shows who owns whom **now**, and that
> drifts as transfers happen. The auction record shows what was **paid**, which
> never changes.

## Timeline

The timeline **remains**, but is **built from structured events** rather than
from prose strings.

Event types: next batch · next player · bid · no bid · sold · unsold · next in
draft · first call · second call · last call · time up.

**The three calls are time-driven, not buttons.** The auctioneer's client emits
them at **20, 10 and 5 seconds remaining** on the round timer, and time up at
zero. The auctioneer never clicks them.

> **The timer logic lives on the auctioneer's client**, which is consistent with
> the rest of the design: the auctioneer is the sole writer of authoritative
> state, so the calls are written by the same client that owns the deadline.
> Every other client renders them from the timeline like any other event.

> **This is a change from the old system**, where the auctioneer pushed
> pre-written sentences into an array. Structured events mean every client
> renders them itself, which is what allows role-specific wording and lets the
> countdown be a live timer rather than a series of "20 seconds left" log lines.

**The timeline is display only.** It is written to and read for rendering, and
**never dispatched on**. Nothing changes state, changes data, or fires a side
effect because an entry arrived. Anything that needs to react reads the auction
state instead, which is authoritative and always present.

> **The calls are not an exception**, though they look like one. Every client
> already computes the countdown against Firebase server time from the round
> deadline, so it knows five seconds remain without a last-call entry telling
> it. Reacting to the entry rather than to the deadline would put the reaction
> out of step with the countdown sitting beside it on screen. The calls exist so
> the timeline _reads_ like a real auction, not to carry information anyone
> lacks.

> **Why this needs saying.** The timeline is a log, and the state it describes
> is sitting right there. Hanging behaviour off a convenient event arriving
> would give two sources of truth for the same fact — whose turn it is, how long
> is left — and a dropped or replayed write would then change behaviour rather
> than merely leaving a gap in the history.

## Bidding constants

**The increment is 0.5.** Every bid is the current asking price, and the asking
price rises by 0.5 at a time regardless of the player's value.

**The round timer is 30 seconds**, and **every accepted bid restarts it**: the
deadline is the last accepted bid plus thirty seconds. A bid processed after the
deadline is ignored. **The clock that decides is the server's, at the moment the
bid is processed** — bids are not stamped with a time of their own. Thirty
seconds proved comfortably enough across real auctions. **Neither is
configurable in Phase 1** — the auctioneer can add seconds to a round in
progress, and making the timer a league setting is a Phase 2 idea.

## Bidder controls

- **Bid** at the current asking price
- **Pass** on the current player

**Passing is irreversible for that round.** Once a bidder passes they are out
until the next player. The bid control should show this state rather than
silently doing nothing.

> **Why irreversible:** if a pass could be withdrawn, the rule that resolves a
> round — everyone except the leader has passed, so it sells — becomes unstable.
> A resolved round could be un-resolved by someone changing their mind. This
> departs from a real auction, where passing at one price does not stop you
> bidding at the next, and that cost is accepted for a rule that terminates
> cleanly.

**The bidder needs everything required to make an informed decision on
screen:** squad rules, their current squad composition, remaining budget,
remaining players and their roles.

**Two checks, and only two:**

- **A bid may not take the budget below zero.** There is no reserve held back
  for filling the minimum squad — a manager who spends everything early is left
  unable to bid, and that is theirs to manage.
- **A manager whose squad is at the maximum size cannot bid.**

> **The auction does not prevent an illegal squad**, meaning one that cannot
> field a legal XI. A manager may buy ten batsmen. The consequence lands later — they cannot field a legal XI and score
> zero for that gameweek. Across eight real auctions nobody has ever done this.
> Show them what they need and let them be wrong.

## Auctioneer controls

- **Start auction**
- **Select batch** — by category and role
- **Select player** — chosen directly, or picked at random from the batch
- **Sell** — **manual, deliberately.** The system does not auto-resolve on
  timeout, so the auctioneer can make allowances for someone with connection
  trouble. Sells to the current leader at the leading bid.
- **Sell manually to a chosen manager at a chosen price** — **a last resort**,
  for when something unexpected has broken and the auction must not stall. The
  bid history is kept as it is, and the sale is appended as the final bid if it
  is not already there.
- **Mark unsold**
- **Pause / resume** — freezes the timer; it resets on resume
- **Add extra seconds** _(good to have, not essential)_
- **Start recovery / End recovery**, and **Rewind** inside it — see below
- **Start draft**, then **Next in draft order**. Picks are accepted
  automatically, in the auctioneer's browser. **Next stays disabled until the
  turn is settled**; for a manager taking too long, a separate **Skip <team>'s
  turn** button settles it — two buttons, so a double click never skips
  anyone
- **End auction** — the system prompts when the end looks reached, but the
  auctioneer decides
- **Hand off** — always to the backup auctioneer

**There is no "generate draft order" control.** The order is assigned as
managers join — see below.

### Recovery and rewind

- **Rewind undoes the last round** — a sale or an unsold result — restoring
  budgets and squad membership. Once it is undone, the round before it becomes
  the last round, so **rewinding repeatedly walks the auction back to its
  start.** That is needed for testing, where an auction is reset many times.
- **Only possible between Start recovery and End recovery.** The auctioneer
  enters recovery deliberately, so a rewind cannot fire mid-round by accident.
- **It does not undo individual bids**, or anything else that is not a round's
  result.
- **The timeline is appended to, never rewritten.** A rewind adds its own
  entries rather than removing the ones it undoes.
- **A reset-auction control exists outside production**, as a fallback for
  testing. It is hidden in prod because it is dangerous.

**Not in Phase 1:** autopilot, where the system advances rounds automatically.

## Batch progression and the draft

**Marquee → Star → Draft.**

The draft is **turn-based rather than concurrent**, and differs from the auction
proper:

- **The draft pool is the General category plus every player unsold in Marquee
  and Star**
- The order is **random and snakes** — 1 to 6, then 6 back to 1, repeating
- **A position is assigned when a manager joins**, at random from those not yet
  claimed, so the order is known before any bidding — a manager's strategy
  depends on where they sit. Positions nobody holds yet show as **TBA**:

  ```
  1 · TBA
  2 · Thane
  3 · Pune
  4 · TBA
  5 · TBA
  6 · Bangalore
  ```

- The auctioneer's **Start draft**, then **Next in draft order**, moves the
  turn on. The manager whose turn it is picks a player and confirms; the
  auctioneer's browser accepts the pick as it arrives, and the service
  re-checks it before the sale. **One pick per turn** — a second is refused.
  Picks are keyed by turn, since a manager picks many times in one draft
- **All draft picks go at base price**, with budget deducted
- **Unsold players re-enter here.** Everyone unsold during Marquee and Star is
  available in the draft, and should be **visibly marked as previously unsold**
- **No round limit.** The draft continues while valid choices remain — a single
  manager with budget and squad space keeps picking after everyone else is
  finished
- **A manager who can no longer pick is skipped, not blocked on.** The
  auctioneer's **Next in draft order** moves past them. The draft proceeds with a
  shrinking set of eligible pickers and ends when nobody is eligible

> The draft currently happens over WhatsApp. This is new, not preserved
> behaviour.

## Auctioneer handover

The owner may change the auctioneer or the backup at any time, including
mid-auction. The current auctioneer may hand off, **which always passes control
to the backup.** Either takes effect immediately and revokes the previous
auctioneer's control.

> **Not built in Milestone 4.** The official auction league has one auctioneer,
> the system admin who published it, and no backup.

**Presence detection and automatic failover are Phase 2.** For now, if an
auctioneer goes silent, an admin reassigns manually.

> **The `Recovering` phase covers this and the mistake case**, and is entered
> deliberately rather than detected — see "Recovery and rewind" above. Whether
> the old auctioneer becomes the backup after a handoff is left to
> implementation.
