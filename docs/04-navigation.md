# Navigation

How pages connect, what the URLs are, and what happens when someone reaches a
page they should not be on.

---

## Routes

**Everything is a real route.** No screen is reachable only through in-page
state.

### Top level

| Route                        | Page                         |
| ---------------------------- | ---------------------------- |
| `/`                          | My Leagues — this is home    |
| `/login`                     | Sign-in and account creation |
| `/actions`                   | Actions Center               |
| `/tournaments`               | Tournament list              |
| `/tournaments/:tournamentId` | Tournament detail            |
| `/leagues/new`               | Create a league              |
| `/admin`                     | System admin panel           |

### Inside a league

| Route                               | Section                                                |
| ----------------------------------- | ------------------------------------------------------ |
| `/leagues/:leagueId`                | Redirects to the phase-appropriate section — see below |
| `/leagues/:leagueId/details`        | League Details                                         |
| `/leagues/:leagueId/team`           | My Team                                                |
| `/leagues/:leagueId/leaderboard`    | Leaderboard                                            |
| `/leagues/:leagueId/members`        | Members                                                |
| `/leagues/:leagueId/auction-center` | Auction Center                                         |
| `/leagues/:leagueId/squads`         | Squads                                                 |
| `/leagues/:leagueId/transfers`      | Transfers Center                                       |
| `/leagues/:leagueId/admin`          | Admin Center                                           |
| `/leagues/:leagueId/auction`        | The live auction                                       |

### Why sidebar sections are routes rather than in-page state

Considered, and routes chosen. The deciding reason is the **back gesture**:
most usage is a phone browser, where back is a swipe people use constantly. With
routes it moves between sections — from Leaderboard to My Team, where you just
were. With in-page state it throws you out of the league entirely, which users
will trigger by reflex over and over.

Four further consequences follow from the same choice:

- **Refresh keeps you where you were**, rather than dropping you on the
  phase-based default. This matters during an auction if a tab reloads.
- **The actions center can deep-link.** "You have not set your team for gameweek
  6" can go straight to My Team. Without routes it could only reach league home
  and hope the default landed right.
- **Sections are shareable.** "Look at the standings" is a link.
- **Bug reports carry a URL** you can open, rather than a description of what
  was clicked.

---

## Identifiers in URLs

**Always the internal id. Never the league join code.**

`/leagues/-Nx7k2pQ` — not `/leagues/7XKQ2M`.

Three reasons:

1. **The join code is a capability, not an identifier.** It exists so someone
   can be handed a short string and get into a league. If it is also the URL,
   then anyone who sees a URL has the code — a screenshot, a shared link,
   browser history on a borrowed laptop. For a closed league, that quietly
   weakens the gate.
2. **Codes can be regenerated.** If a code ever changes, every existing URL
   breaks. The id does not change.
3. **It would cost a lookup on every page load**, since the code has to resolve
   to an id before anything can be read.

The join code stays what it is for: typed into the join modal, displayed on
league home with a copy button, shared over WhatsApp. It is not the address.

**Path segments are plural.** `/leagues/:id`, not `/league/:id` — the segment
names the collection, and the id selects one item from it. Plural also composes:
`/leagues` and `/leagues/abc123` share a stem, where singular would give you two
different ones for the same concept.

---

## Landing and redirects

### On arrival, before anything else

1. Not signed in → **`/login`**
2. Signed in but **no user record** → the display-name modal. This must happen
   even if the user typed a deep link — they are authenticated but have no
   profile, so every other page would break.
3. Signed in with a record → the route they asked for

### `/` — My Leagues

Lands on the **Active** tab. If there are no active leagues, lands on
**Pending**. If neither has anything, the empty state.

### `/leagues/:leagueId` — no section given

**Redirects to a section based on league phase**, so the user lands where the
action is:

| Phase           | Redirects to      |
| --------------- | ----------------- |
| Pre-auction     | `/auction-center` |
| Auction live    | `/auction-center` |
| Team submission | `/team`           |
| Active          | `/team`           |
| Finished        | `/leaderboard`    |

**Pre-auction and Auction live are auction-league phases only.** A regular
league never reaches either, so the first two rows never apply to one.

**A spectator has no My Team**, so where the table says `/team` they get
`/leaderboard` instead.

### After an action

| After                              | Goes to                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Signing in for the first time      | `/`                                                                                                      |
| Creating a league                  | A success modal showing the join code, then `/leagues/:newId`                                            |
| Joining a public league            | `/leagues/:leagueId`                                                                                     |
| Requesting to join a closed league | Stays put; the request appears under Pending in My Leagues                                               |
| Being accepted into a league       | Nothing automatic. The league appears in My Leagues, and the actions center no longer lists the request. |
| Submitting a team                  | Stays on My Team, now in view mode                                                                       |

---

## The auction opens in a new tab

**The button through to `/leagues/:leagueId/auction` lives in Auction Center and
opens a new browser tab.**

**Who sees it is role-conditional, not phase-conditional.** The auctioneer and
the backup see it from the pre-auction state onward, labelled *Open auction
room*; everyone else sees it only once the auction is live, labelled *Go to
Auction*.

> **Otherwise no auction could ever start.** The Start auction control lives on
> the auction page, so a button that appeared only once an auction was live
> would be waiting on something that could never happen. See
> `08-pages/auction-center.md`.

The auction is a self-contained, high-focus activity. Keeping it in its own tab
means a manager cannot lose it by clicking something else — and if they do
navigate away in the main tab, the auction is still there.

This is why it needs a real route rather than a modal or an overlay: a new tab
has to be able to load it from a URL alone.

---

## Access control

**Every rule below is enforced in the data layer, not only by hiding links.**
Anyone can type a URL, and anyone can read the database directly with the client
SDK. Route guards are convenience; the data layer is the guard.

> **Membership is decided from `leagues/{leagueId}/leagueMembers/{userId}`, not
> from the user's league index.** The index is a view, and archived leagues are
> moved out of it into `users/{userId}/archivedLeagues`. A guard reading the
> index would tell a user they are not a member of a league they played all
> season.

### What happens when access is refused

| Situation                                  | Behaviour                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Not signed in, any protected route         | Redirect to `/login`, **remembering where they were going** so they land there after signing in |
| Signed in, no user record                  | The display-name modal, whatever route was requested                                            |
| Not a member of the league                 | Redirect to that league's page on the tournament, where they can request to join                |
| **Banned** from the league                 | Say so plainly. Do not pretend the league does not exist, and do not offer a join action.       |
| Spectator on `/team`                       | Redirect to `/leaderboard`. **Not `/squads`** — squads are public, so a spectator sees the page with every manager on it and no squad of their own. |
| Manager on `/leagues/:id/admin`            | Redirect to `/leagues/:id`                                                                      |
| Non-system-admin on `/admin`               | Redirect to `/`                                                                                 |
| League, tournament or match does not exist | A not-found state, not a blank page                                                             |

### Sections that only exist sometimes

Some sidebar items are absent rather than forbidden, and hitting their URL
should redirect to the league's default section rather than showing an error:

| Section                          | Exists when                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Auction Center, Transfers Center | Auction leagues only                                                                                                                  |
| Squads                           | Auction leagues, **after the auction has run**. One page, not two — see `docs/08-pages/squads.md`                                      |
| My Team                          | Everyone except spectators — and in an auction league, **not before the auction has completed**, since there is no squad to pick from |
| Admin Center                     | Owner and admins only                                                                                                                 |

> **My Team before an auction is a real case, not an edge case.** A manager
> joins an auction league days before the auction. There is nothing for them to
> pick yet. The sidebar item should be absent or disabled with an explanation —
> never a link to an empty page.

---

## Entry points that appear in more than one place

**Create a League** — from the site header, and from a tournament page. Same
page; arriving from a tournament prefills and locks the tournament field.

**Join a League** — from the site header, opening a modal that takes a join
code. Also from a tournament page, where leagues are listed with a join or
request action. The code is a shortcut, not the only way in.

**A league** — reachable from My Leagues, from a tournament page, from the
actions center, and by join code.

**Another manager's team** — from the leaderboard, by clicking a name. It opens
as a modal rather than a route, since it is a view _of_ the leaderboard rather
than a place of its own.

---

## Conventions

**Detail views open as a side panel, not a modal.** A side panel does not block
the rest of the page. This applies to league details from a card, rejected
requests, and similar.

**A modal is for something that must be finished or dismissed** — the
display-name prompt, an impact sub, the offer builder, a confirmation.

**Nothing navigates away silently on success.** Where a route change follows an
action, the user should see what happened first — the league-created modal being
the clearest case.
