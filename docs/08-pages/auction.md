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

**The round timer is 30 seconds**, refreshed from the last accepted bid. Thirty
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

> **The auction does not prevent an illegal squad.** A manager may buy ten
> batsmen. The consequence lands later — they cannot field a legal XI and score
> zero for that gameweek. Across eight real auctions nobody has ever done this.
> Show them what they need and let them be wrong.

## Auctioneer controls

- **Start auction**
- **Generate the draft order** — done at the very start, before any bidding,
  because a manager's strategy depends on where they sit in the draft
- **Select batch** — by category and role
- **Select player** — chosen directly, or picked at random from the batch
- **Sell** — **manual, deliberately.** The system does not auto-resolve on
  timeout, so the auctioneer can make allowances for someone with connection
  trouble.
- **Mark unsold**
- **Pause / resume** — freezes the timer; it resets on resume
- **Add extra seconds** *(good to have, not essential)*
- **Rewind** the last round — undoing a sale or unsold result, restoring budgets
  and squad membership. **Gated behind the `Recovering` phase**, which the
  auctioneer enters deliberately, so a rewind cannot fire mid-round by accident
- **Accept a draft pick** when a manager takes their turn
- **End auction** — the system prompts when the end looks reached, but the
  auctioneer decides
- **Hand off** to another admin

**Not in Phase 1:** autopilot, where the system advances rounds automatically.

## Batch progression and the draft

**Marquee → Star → Draft.**

The draft is **turn-based rather than concurrent**, and differs from the auction
proper:

- The order is **randomly generated and snakes** — 1 to 6, then 6 back to 1,
  repeating
- The manager whose turn it is picks a player and confirms; the auctioneer
  accepts
- **All draft picks go at base price**, with budget deducted
- **Unsold players re-enter here.** Everyone unsold during Marquee and Star is
  available in the draft, and should be **visibly marked as previously unsold**
- **No round limit.** The draft continues while valid choices remain — a single
  manager with budget and squad space keeps picking after everyone else is
  finished
- **A manager who can no longer pick is skipped, not blocked on.** The draft
  proceeds with a shrinking set of eligible pickers and ends when nobody is
  eligible

> The draft currently happens over WhatsApp. This is new, not preserved
> behaviour.

## Auctioneer handover

The owner may reassign at any time, including mid-auction, and the current
auctioneer may hand off. Either takes effect immediately and revokes the
previous auctioneer's control.

**Presence detection and automatic failover are Phase 2.** For now, if an
auctioneer goes silent, an admin reassigns manually.

> **The `Recovering` phase covers this and the mistake case**, and is entered
> deliberately rather than detected. Its mechanics — what enters and leaves it,
> how far back a rewind may go, and who may do either — are **deferred to
> implementation** rather than specified here.
