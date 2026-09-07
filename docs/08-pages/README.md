# Pages

One document per page. Each says what the page is for, who can reach it, what it
shows, what can be done from it, and which states it has.

**These documents describe behaviour, not layout.** Component structure and
visual arrangement are yours to decide unless a document says otherwise — where
it does, the constraint has a reason attached.

## Index

| File | Page |
|---|---|
| `login.md` | Sign-in and first-time account creation |
| `site-header.md` | Persistent navigation across the whole app |
| `my-leagues.md` | Home. The leagues a user is in, has requested, or has archived |
| `actions-center.md` | Open items awaiting the user, derived not stored |
| `tournaments.md` | Browsing tournaments and the leagues within them |
| `create-league.md` | Creating a league |
| `league-home.md` | The hub for one league; everything below lives under it |
| `league-details.md` | League configuration, viewable by all, editable by admins |
| `admin-center.md` | Join requests, roles, bans, lifecycle, league points entry |
| `my-team.md` | Picking, viewing and editing a fantasy XI |
| `leaderboard.md` | Standings, and viewing another manager's team |
| `members.md` | Who is in this league |
| `squads.md` | Squads — your squad and every other manager's, auction leagues only |
| `transfers-center.md` | Trading players and points — auction leagues only |
| `auction-center.md` | The auction as an event, before, during and after — auction leagues only |
| `auction.md` | The live auction, all three role renderings |
| `system-admin.md` | Cricket reference data and standard points |

## Conventions that apply to every page

**Detail views open as a side panel, not a modal.** A side panel does not block
the rest of the page.

**Nothing is finished until its loading, empty, error and mobile states work.**
A page that renders correctly with data is not done.

**Mobile is the primary target.** Most usage is a phone browser. Every layout
must survive 390px without horizontal scrolling.

**The team visibility rule applies everywhere a team is rendered.** A manager's
team for a match is visible to others only after that match's deadline. See
`docs/03-roles.md`.
