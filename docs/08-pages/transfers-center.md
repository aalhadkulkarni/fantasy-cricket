# Transfers Center

**Sidebar item on league home. Auction leagues only.**

> **Terminology: "offer", not "proposal".** Shorter, and "propose an offer"
> reads worse than "make an offer".

**Layout is yours to decide.** This document records what must be shown, not
where.

## Squads

Rendered exactly as in `squads.md` — your squad plus collapsible items for every
other manager.

## Offers

| List | Contents |
|---|---|
| **Incoming** | Summary per offer, truncated. Opens a modal with full detail and **accept / reject**. |
| **Outgoing** | Same, with **withdraw**. |
| **Rejected** | **With a reason.** Auto-rejections carry a system-generated reason. Manual rejections default to *"Not interested"*; an optional manager-written reason is droppable in Phase 1. |
| **Your accepted offers** | Your own completed trades. A manager should not have to hunt through the league-wide list to find their own history. |
| **Completed transfers, league-wide** | Public. This is how managers know who currently owns whom. |

**Every completed offer shows the applicable match** — the match from which the
squad change takes effect. Without it a manager cannot tell when a trade
actually landed.

> Your accepted offers and the league-wide list **overlap deliberately**. One is
> your history, the other is league context.

**Offer detail modal:** counterpart manager · players offered · players demanded
· points offered or demanded · the relevant action button.

## New offer builder

- Manager dropdown
- **Your squad and theirs side by side**, players selectable on both sides
- **Live summary** of the offer as it is built
- **Live validation** — neither side may be left unable to field a legal XI
- **Points control** — offer *or* demand, never both. **Capped so neither
  manager can go negative**, showing both balances.
- **Submit** → confirmation modal with the full offer → confirm or cancel

> **Live validation matters here for the same reason it does in My Team.**
> Without it you construct an offer, submit it, and get rejected with no
> warning.

## Validation runs three times

1. **At offer creation**
2. **Again at acceptance** — squads change in between
3. **On acceptance**, re-check both parties' other offers and **auto-reject any
   that are now invalid**, with a stated reason

> **A known concurrency risk, accepted for Phase 1:** two managers accepting
> conflicting offers for the same player in the same instant could both pass
> validation. It is rare, both parties are human, and an admin can correct it.

## States

| State | Shows |
|---|---|
| **Window open** | Everything above |
| **Window closed** | No new offers. Pending offers are auto-rejected. Completed transfers and squads only. |
| **Spectator** | Completed transfers and squads only. No offer machinery. |

**A transfer window is defined by a range of matches**, so "closed" is derived
from the start time of its last match — there is no stored open/closed flag.

> **Auto-rejection at window close is lazy, and has to be.** Phase 1 has no
> server, so nothing runs on a schedule and no client is guaranteed to be open
> at the moment a window ends. The data layer therefore infers the rejection
> the next time the offer is read, and writes it then. Nobody ever sees a
> pending offer belonging to a closed window, which is what matters; the write
> just happens later than the event.
