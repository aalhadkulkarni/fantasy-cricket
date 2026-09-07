# Actions Center

Open items awaiting the user. **Purely derived** — no writes, no read-state
tracking, nothing stored.

**Route: `/actions`.** Reached from the site header, where a count is
displayed.

> **It gets a real route like everything else**, so the count in the header is a
> link rather than a popover, and so an item can be linked to directly. Lowercase
> and plural, matching every other path.

## Contents

All derived from standing conditions:

- Join requests awaiting **your** approval, as a league admin
- **Your** pending join requests
- Incoming transfer offers
- A live auction in a league you belong to
- An upcoming team deadline where you have not set a team
- Your unpicked draft turn

## Why this rather than notifications

Real notifications need read-state. Read-state needs writes. With no server, the
writer would be whichever client happened to fire the event — fragile, and a
notification bell that does not track read state is a *broken* notification
bell.

More fundamentally, **every item worth surfacing here is something awaiting
action, not passive news.** "New transfer offer" is not information; it is
something waiting on you.

**The failure modes differ, and this one is better.** A dismissed notification
for a pending transfer is a lost transfer. An actions-center item **stays until
the underlying thing is actually resolved.**

## Deliberately dropped

**"Join request approved"** and **"Match X points are in"** are past events with
no standing condition to derive from. Approval shows up as the league appearing
in My Leagues; points show up as the leaderboard changing. Neither needs its own
item.

## Fetching

**Fetched once at load and held in a store**, not re-fetched per page — the
count appears in the header everywhere.

> **Known limitation:** new items arrive via subscription, but items
> *disappearing* because they were resolved elsewhere are not covered. A
> slightly stale count is acceptable; it is a known gap rather than an
> oversight.
