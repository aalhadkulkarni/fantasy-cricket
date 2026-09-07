# Project Overview

Read this first. It exists to give you the mental model everything else
assumes. Other documents go deep on specifics; this one explains what the
product is, how it is shaped, and which decisions are already settled and
should not be relitigated.

---

## What this is

A fantasy cricket platform. Users create private leagues, pick fantasy teams
from real cricketers, and score points based on how those cricketers perform
in real matches.

It already exists. A crude version was built in three days and has run real
seasons with 40-50 users. **This project is a full frontend rewrite** — the
requirements have been redefined from scratch rather than reverse-engineered
from the old code. Do not assume existing behaviour; work from these docs.

The one exception is the live auction's core mechanic, which is deliberately
preserved. See "The auction" below.

---

## Who uses it

Six roles. Full detail in the roles document — the shape at a glance:

| Role         | Scope                                                                             |
| ------------ | --------------------------------------------------------------------------------- |
| System admin | Universal — owns cricketers, teams, tournaments, match schedules, standard points |
| League owner | One league — created it, can add/remove admins                                    |
| League admin | One league — config, join requests, running the auction                           |
| Manager      | One league — plays: picks teams, bids, trades                                     |
| Auctioneer   | One league — runs its auction                                                     |
| Spectator    | One league — read-only                                                            |

**Roles are additive.** One person is routinely owner, admin and manager in
the same league simultaneously. Nothing should assume they are exclusive.

---

## The three subsystems

**1. The live auction.** An auctioneer puts cricketers up one at a time; five
to eight managers bid in fixed increments or pass. Real-time, all participants
watching the same state. This is the product's differentiator and the most
interesting engineering in it.

**2. Team selection, scoring and leaderboards.** Managers pick an XI, name a
captain and vice-captain, and accrue points as real matches are played. Shared
by both league types.

**3. Administration.** Two levels — system admins manage cricket data used by
everyone; league admins manage their own league.

---

## Two kinds of league

**Auction leagues.** Managers first win a squad of players at a live auction,
then each gameweek pick their XI _only from that squad_. Squads can change
during transfer windows, when managers trade players and points with each
other.

**Regular leagues.** No auction. Managers pick from the entire tournament
player pool every time.

**They diverge in exactly one place: squad eligibility.** Everything
downstream — team selection, scoring, leaderboards, impact subs — is identical.
Do not build two parallel implementations.

---

## Phase 1 and Phase 2 — why the data layer matters

**This project is Phase 1: the frontend only.** The app talks directly to
Firebase Realtime Database from the browser. There is no server.

**Phase 2 will put a real backend behind it.** That is not in scope now, but it
is the reason for the single most important architectural rule here:

> **All data access goes through a data layer. No component imports Firebase.
> No Firebase-shaped type crosses that boundary. Every read, write and
> subscription goes through it.**

When Phase 2 arrives, the data layer's implementation is replaced and nothing
above it changes. If Firebase calls leak into components, that promise breaks.

**A direct consequence:** any rule that will be a server-side check in Phase 2
is enforced in the data layer _now_, not in components. The data layer is
effectively the server. UI-level gating is convenience; the data layer is the
actual guard. This applies to join deadlines, squad validity, bid legality,
transfer acceptance, and team visibility.

---

## Decisions that shape everything

These are settled. They are recorded here because each looks arbitrary without
its reason, and each is easy to accidentally undo.

### Scoring is derived, never stored per manager

Points are stored **per player per match**. A manager's total is computed at
read time by resolving which players were in their team and summing.

**Why:** a scoring correction then means editing one number, and every view is
instantly right. If totals were stored per manager, one correction would mean
finding and fixing every manager it touched.

The only exception is `pointsAdjustment` — the net effect of accepted transfers,
which is not derivable from player points.

### Standard and custom points resolve by fallback, never by copying

A league either uses standard points (entered once by a system admin at
tournament level) or enters its own. **A league reading points checks its own
store first and falls back to standard.** Standard points are never copied into
a league — that would reintroduce the fan-out problem above.

### Team visibility is a correctness rule, not a UI preference

**A manager's team for match X is readable by that manager at any time. It is
readable by anyone else only once the deadline for match X has passed.**

League admins are not exempt. In most leagues the admin also plays, which is
exactly why.

**Why it matters:** without it, cheating is trivial — join as a spectator under
a second account, read everyone's teams, then lock your own. **Enforce this in
the data layer.**

### Lifecycle is derived, never a stored phase field

A league's state — pre-auction, auction phase, team submission, active,
finished — is computed from auction state, deadlines and `finishedAt`. There is
no `phase` column.

**Why:** the old system had a hardcoded constant in source. Advancing a league
meant editing code and redeploying. Only the developer could do it, it could
not happen on schedule, and every transition carried deploy risk.

The single exception is **marking a league finished**, which is a manual admin
action — only a human knows whether all points and corrections are actually in.

### Team changes propagate forward

A team applies to every subsequent match until changed again. Changing your
team at match 15 overwrites everything from 15 onward, including any change
previously made at match 30.

The UI must warn before doing this.

---

## The auction

**Its core mechanic is preserved from the existing system and must not be
redesigned.** It has run multiple real auctions and works.

**The design, and why it is safe without transactions:**

- Bidders write **only** to their own field: `{playerId}/bids/{managerId}` and
  `{playerId}/noBids/{managerId}`. Nothing else.
- The auctioneer's client is the **sole writer** of authoritative state — the
  current player, leading bid, minimum next bid, deadline.
- The auctioneer subscribes to bidders' fields, validates each incoming bid
  against the current asking price and the deadline, and accepts or ignores it.

Because bidders cannot touch authoritative state, there is nothing to contend
over.

> **There is a known race: the auctioneer may read B's bid before A's even if A
> wrote first. This is ACCEPTED. It is not a defect and must not be "fixed".**

**Other preserved behaviour:**

- **Selling is manual.** The auctioneer clicks to sell rather than the system
  auto-resolving on timeout. This is deliberate — it lets the auctioneer make
  allowances for someone with connection trouble.
- **Passing is irreversible for that round.** Once a manager passes on a player
  they are out until the next one.
- **Illegal squads are permitted.** The auction does not stop a manager buying
  ten batsmen. It shows them everything needed to decide — squad rules, current
  composition, remaining budget — and lets them be wrong. The consequence lands
  later: a manager who cannot field a legal XI scores zero for that gameweek.

**The draft** is turn-based rather than concurrent, uses a snake order, and is
new — it currently happens over WhatsApp. It is not preserved behaviour.

---

## Stack

|            |                                                                  |
| ---------- | ---------------------------------------------------------------- |
| Language   | TypeScript, strict                                               |
| Build      | Vite                                                             |
| Styling    | Tailwind, themed through CSS custom properties                   |
| Components | shadcn/ui (Radix primitives + Tailwind, copied into the repo)    |
| Data       | Firebase Realtime Database, accessed only through the data layer |
| Auth       | Firebase Google auth                                             |

Routing and state management libraries are not yet chosen. One hard
requirement on state: **live auction updates must not re-render unrelated
components.** Plain React Context re-renders every consumer on any change,
which is a real problem for a screen updating several times a second.

---

## Non-negotiables

**Responsive design is a primary requirement, not a later fix.** Most usage is
mobile browser — people check their team and bid in auctions from phones. When
deciding whether a table can scroll horizontally or a layout can assume desktop
width, the answer is governed by that fact.

**Nothing is "done" until its loading, empty, error and mobile states are
handled.** A component that renders correctly with data is not finished.

**Accessibility floor during the build:** semantic HTML, visible focus states,
alt text. A full audit comes later, but these are nearly free now and expensive
to retrofit. Colour contrast is already handled by the design tokens.

---

## Deliberately deferred — do not build

|                                                         |                                                                                                                |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Backend APIs                                            | Phase 2                                                                                                        |
| Firebase security rules                                 | Rules stay permissive. The data layer enforces access. Do not write restrictive rules — they will break reads. |
| Live chat during auctions                               | Later                                                                                                          |
| Auctioneer presence detection and automatic failover    | Phase 2. For now an admin reassigns the auctioneer manually.                                                   |
| Custom prizes (head-to-head brackets, rank-jump awards) | Cut                                                                                                            |
| Multi-tournament leagues                                | One league covers one tournament                                                                               |
| Leaving a league                                        | No use case                                                                                                    |
| Retired players view                                    | Phase 2. Nothing lists fully retired players or brings one back. Rare enough not to matter in Phase 1.         |
| Deleting anything except an empty league                | Deliberate, not missing. A league's owner can delete it while they are its only member, for the created-twice case. Nothing else deletes: an unwanted tournament goes unpublished, a duplicate player is retired, a duplicate team is removed from its competitions. |
| Sparse storage of lineups and squads                    | A known optimisation, deliberately deferred — it only matters at 60+ match tournaments                         |

---

## Where to find things

| Document                     | Contents                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| `docs/02-working-with-me.md` | How to collaborate on this project — read before starting work |
| `docs/03-roles.md`           | What each role can do, in full                                 |
| `docs/04-navigation.md`      | How pages connect, and what is reachable from where            |
| `docs/05-data-model.md`      | The RTDB schema, with reasoning for every structural decision  |
| `docs/06-data-layer.md`      | Every read, write and subscription each page needs             |
| `docs/07-design-system.md`   | Tokens, typography, and the rules governing them               |
| `docs/08-pages/`             | One document per page. Start at its `README.md` for the index. |

**When something here conflicts with a more specific document, the specific
document wins** — but flag the conflict rather than silently choosing.
