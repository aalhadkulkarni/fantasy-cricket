# League home

The hub for a single league. Everything about that league lives under this page.

## Layout

**A persistent summary strip, always visible whichever section is open:**

- League name
- **League code**, with a copy or share affordance
- Current phase
- Next deadline
- Your rank

> **The league code belongs here.** A new league is useless until people join,
> and the code is the quickest way to invite. Note it is not the only way in —
> closed leagues are publicly visible and can be found and requested from the
> tournament page. Visible to all members so anyone can invite.

**Navigation is a collapsible sidebar, not horizontal tabs.**

> **Why a sidebar:** the site header already takes vertical space. A second
> horizontal bar beneath it gives too much of the screen to navigation, and it
> is hard to make work on a phone. Most usage is mobile browser, so that is the
> constraint to design against.

> **Why in-page navigation at all, rather than a back link:** a manager on My
> Team who wants the leaderboard should not have to go back first. Every league
> view should be reachable from every other. It also makes the containment
> visible — all of these are views of *one league*.

## Sidebar items

| Item | Visible to |
|---|---|
| **League Details** | Everyone |
| **My Team** | Everyone except spectators |
| **Leaderboard** | Everyone |
| **Members** | Everyone |
| **Auction Center** | Auction leagues only |
| **Squads** | Auction leagues, after the auction is done |
| **Transfers Center** | Auction leagues only |
| **Admin Center** | Owner and admins only |

## Auction Center

The auction as an event, before it runs, while it runs and after. Specified in
`auction-center.md`, including the button through to the live auction and who
sees it when.

## Which section opens by default

The page preselects a sidebar item based on league phase, so the user lands
where the action is.

| Phase | Lands on |
|---|---|
| Pre-auction | Auction Center |
| Auction live | Auction Center |
| Team submission | My Team |
| Active | My Team |
| Finished | Leaderboard |

> **Rejected: a static "league details" landing section.** Nobody wants a
> display-only page after their first visit. Phase-based preselection puts the
> user where the pending action is, and the summary strip keeps league identity
> permanently visible anyway.

## Members and Leaderboard both exist, despite overlap

Pre-season the leaderboard shows every accepted team on zero points, so it
doubles as a roster early on. Members still earns its place: the leaderboard is
*ranked*, not a roster, and Members is the natural place to see who is in.

## Spectators

No My Team. **Squads is visible**, since squads are public and the page simply
shows every manager with no squad of the spectator's own on it. Transfers Center
is read-only — completed transfers only.
