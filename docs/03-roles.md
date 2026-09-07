# Roles

What each role can do. This document is about **capabilities and permissions**,
not about pages or mechanics — it says a manager can propose a transfer, not
which screen they do it from or how the offer resolves.

- For which screen: `docs/08-pages/`
- For how the auction works: `docs/08-pages/auction.md`

---

## The six roles

| Role         | Scope      |
| ------------ | ---------- |
| System admin | Universal  |
| League owner | One league |
| League admin | One league |
| Manager      | One league |
| Auctioneer   | One league |
| Spectator    | One league |

**One universal role; the other five are league-scoped.** A user is a manager
_in league A_, an owner _in league B_, and nothing in league C.

**Roles are additive.** A person routinely holds several in the same league — a
league owner who also plays is the common case, not an edge case. Nothing may
assume the roles are exclusive.

**Auctioneer and spectator only carry meaning in an auction league**, but they
are still granted at league level.

> There is a further entry in the role table — **`BannedFromLeague`**
> (`userRoles009`). It is handled separately at the end of this document,
> because it works by removing capability rather than granting it.

---

## System admin

Universal. Owns the cricket data that every league reads.

**Cricket reference data**

- Create and edit competitions (IPL, ODI World Cup, and so on)
- Create and edit tournaments — one running of a competition, e.g. IPL 2027
- Create and edit teams, including marking a team defunct
- Create and edit players, individually or in bulk from pasted CSV
- Set a player's current team, per competition
- Retire a player from a competition, by removing that competition from their
  current teams. **There is no per-format retirement flag** — a player can
  retire from T20 internationals and still play the IPL, so retirement is
  recorded per competition, not per format.
- Mark a player fully retired from cricket, which is the one case absence from
  current teams cannot express
- Mark a team eliminated from a tournament, from a given match onward

**Tournament structure**

- Define a tournament's participating teams and, from those, its participating
  players
- Define rounds — group stage, playoffs, and so on
- Create matches, singly or in bulk, including adding matches to a tournament
  already under way
- **Publish a tournament**, which is what makes it selectable when creating a
  league. A tournament cannot be published until at least its first match has a
  start time.
- Mark a tournament complete

**Scoring**

- Enter standard points per player per match. These are the source of truth for
  every league that has not opted into its own scoring.
- Re-enter points for a match to correct them

**Access**

- Grant system admin to another user

**Cannot:** anything league-scoped. A system admin has no special powers inside
a league they are not a member of.

---

## League owner

The creator of a league. **An owner is also an admin** — every league admin
capability below applies to the owner too. This section covers only what is
_additionally_ theirs.

- Grant and revoke league admin
- Overrule any admin action

**Designating the auctioneer and the backup auctioneer is not owner-only.** Any
admin can do it, so it is listed under League admin below.

**Owner protections, which the system must enforce:**

- The owner **cannot be removed as admin**, by anyone including themselves
- The owner **can remove every other admin** — and because the owner remains an
  admin, a league can never end up with zero admins

---

## League admin

**League configuration**

- Create a league: choose its tournament, name, whether it holds an auction,
  whether it is open or closed, maximum slots, join deadline, team-changes
  deadline offset, and whether it uses standard or custom scoring
- Edit that configuration afterwards — **but each field has its own deadline
  after which it locks.** Those locks are a fairness mechanism, not a
  convenience: managers must be able to rely on the rules not changing under
  them once they have committed. The specific locks are in the league details
  page document.
- Define gameweek structure per round, and how many team changes are allowed
  before a round and between gameweeks. **There is no allowance for changes
  during a gameweek** — the impact substitution is the only mid-gameweek
  change, and it is a yes or no per round rather than a count.

**Auction configuration** _(auction leagues only)_

- Set the budget, squad size limits, and per-role composition limits
- Override any player's base price or category for this league. **The role
  cannot be overridden.** Standard points depend on role — a bowler is not
  penalised for a duck where a batsman, keeper or all-rounder is — so a league
  overriding roles while using standard points would score against a role the
  points system does not recognise. Roles are system-wide in Phase 1.
- Set the auction's scheduled start time
- Define transfer windows, each as a range of matches
- Designate the auctioneer and the backup auctioneer

**Membership**

- Approve a join request
- **Reject** a join request — a soft reject; the person may request again
- **Reject and ban** — the hard version; the person cannot request again
- Ban an existing manager
- Unban someone, and choose which role to grant them on the way back in

**Lifecycle**

- Mark the league finished. This is manual and deliberately so — only a person
  knows whether every point and correction is actually in.

**Scoring** _(custom-scoring leagues only)_

- Enter points per player per match for this league, and re-enter them to
  correct

**Cannot:**

- See another manager's team before that team's deadline. **Admins are not
  exempt from this** — see below.
- Add or remove admins, unless they are also the owner

---

## Manager

The role that plays.

**Finding and joining**

- Browse tournaments and the leagues within them
- Find a league by its join code
- Request to join a league, choosing a team name for that league
- See their own pending and rejected requests, and re-request after a soft
  rejection

**Team selection**

- Create and update their XI, and name a captain and vice-captain
- In an auction league, pick only from the squad they own
- Perform one impact substitution per gameweek, and edit it while the match it
  applies from has not started
- Navigate to past gameweeks or matches to view, and to upcoming ones to edit

**In the auction** _(auction leagues only)_

- Bid on the player currently up, at the current asking price
- Pass on that player. **Passing is irreversible for that round.**
- See the full player pool, what has sold and for how much, every manager's
  budget and squad, and their own remaining budget
- Take their turn in the draft when it comes

**Transfers** _(auction leagues only, and only while a window is open)_

- Propose a trade to another manager: players and points, in either direction
- Accept, reject or withdraw an offer
- See every completed transfer in the league, including ones they were not part
  of

**Viewing**

- The leaderboard, overall and per gameweek
- Every manager's squad
- Another manager's team — **only after that team's deadline has passed**

**Cannot:**

- See another manager's team before its deadline
- Change captain or vice-captain once a gameweek has started

---

## Auctioneer

Runs a live auction. **Must be an admin or the owner** — an ordinary manager
cannot be made auctioneer.

**Exactly one auctioneer at a time.** The owner is the auctioneer by default at
league creation, and can reassign at any time, including mid-auction. The
current auctioneer can also hand off to another admin. Reassignment takes effect
immediately and revokes the previous auctioneer's control.

**Running the auction**

- Start the auction
- Generate the draft order — done at the very start, before any bidding,
  because a manager's auction strategy depends on where they sit in the draft
- Choose the current batch, by player category and role
- Put a player up, either chosen directly or picked at random from the batch
- **Sell the player.** This is manual on purpose. The system does not
  auto-resolve when the timer expires, so that the auctioneer can make
  allowances for someone with connection trouble.
- Mark a player unsold
- Pause and resume bidding, which freezes and resets the timer
- Add extra seconds to the current round _(good to have, not essential)_
- **Rewind** the last round, undoing a sale or an unsold result, restoring
  budgets and squad membership
- Accept a manager's draft pick when it is their turn
- End the auction. The system prompts when the end looks reached, but the
  auctioneer decides.

**Not in Phase 1:** autopilot, where the system advances rounds automatically
and the auctioneer only monitors.

**An auctioneer may also be a manager and bid** — nothing prevents it, though
usually they are a non-playing admin.

---

## Spectator

Read-only access to a league. Granted so that someone who is not playing can
still watch — most often during an auction.

**Spectators do not occupy a slot**, and they require approval to join just as
managers do.

**Can:**

- View the leaderboard, and open any manager's team subject to the same
  deadline rule as everyone else
- View every manager's squad
- Watch the auction — everything a bidder sees, with no controls and nothing
  framed as theirs
- View completed transfers

**Cannot:** anything at all that changes state. No team, no squad, no bidding,
no proposals.

> Members of a league can already watch its auction. The spectator role exists
> for people who are **not** members.

---

## Banned from league

Ban is modelled as a role rather than as deletion. Two reasons: the person's
data survives — which matters in an auction league, where they own a squad they
paid for — and reversing a ban is then a single change rather than a restore.

**The role is `BannedFromLeague`, `userRoles009`.** Banning is one write that
removes the Manager role and adds this one.

**An existing member can be banned mid-season**, by the same mechanism. Their
squad, lineups and points adjustment all survive, which is the whole reason ban
is a role rather than a deletion.

**Banning strips the manager role.** That is what makes everything else work
without special cases: slot counting and the leaderboard already filter by
manager role, so a banned user stops occupying a slot and stops appearing in the
standings automatically. In practice a banned user becomes like a spectator —
present in the league, counting for nothing.

**A reject-and-ban creates a league membership record holding only this role**,
for someone who was never a member. That is consistent — membership already
holds non-playing relationships, since spectators live there too.

**On unban, the admin chooses which role to grant.** Nothing needs to remember
what the person held before.

---

## The rule that overrides role

**A manager's team for a given match is readable by that manager at any time. It
is readable by anyone else only once that match's deadline has passed.**

This applies to **every role**. League admins are not exempt, and neither are
owners.

**Why it is absolute:** without it, cheating is trivial. Join your own league as
a spectator under a second account, read everyone's team, then set your own
knowing exactly what you need.

Two details that matter:

- **It is per match, not per gameweek.** An impact substitution takes effect
  from a specific match, so it must stay hidden until _that_ match locks — not
  until the gameweek does.
- **Visibility unlocks at the deadline, not at the start of play.** Once nobody
  can change anything, the information is harmless.

**Squads are different and are always public.** The rule protects _which eleven
you are fielding_, because that is what can be exploited. Which players you own
was public at the auction while everyone watched you buy them, and knowing who
owns whom is a prerequisite for proposing transfers.

**Enforce this in the data layer.** UI-level hiding is not sufficient — anyone
can read the database directly with the client SDK.
