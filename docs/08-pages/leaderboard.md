# Leaderboard

## The table

Columns: **rank · name · team name · points**

Opens as the **overall** leaderboard.

**Filters:** by gameweek, and by match. **Only locked matches and gameweeks
appear in the filter.**

> **A match locks at its deadline**, which is its scheduled start minus the
> league's team-changes offset. **A gameweek locks at the deadline of its first
> match**, since that is the point after which nothing in it can be changed.

> A round filter was considered and cut as unnecessary.

## Scoring watermark

A label reading **"Points calculated till match X"**.

> **Always expressed in matches, never gameweeks.** Whether the league is
> gameweek-based or match-based, **points are always match-based.** This makes
> the scoring frontier visible instead of leaving users to guess why the
> standings look stale.

**Locked is not the same as scored.** A match can have started but not yet been
scored. If the user filters to a locked match whose points are not in, show
**"Points not calculated yet."**

## Ties

**Tied managers share a rank, and subsequent ranks are offset by the number
tied.**

```
1 - John  - 100
2 - Kyle  -  90
2 - Ray   -  90
4 - Smith -  80
```

**Pre-season everyone is on zero**, so by the same rule everyone shows as rank
1. Ordering within that is arbitrary.

## Viewing another manager's team

Clicking a name or team name opens that manager's team in a modal.

| Clicked from | Opens |
|---|---|
| Overall leaderboard | Their **latest locked** team |
| A specific gameweek or match | Their team for **that** gameweek or match |

**This is the same view as My Team** — same navigation, player list, aggregate
points, hover-for-detail. One shared component, not a second implementation.

**Differences when viewing someone else:**

- **Only the locked team is shown.** If an impact sub has been made but the
  match it applies from has not started, that sub is not visible.
- **No edit affordances.**

> **Visibility should be derived inside the component**, by comparing the
> current user against the manager being viewed — rather than passing a boolean
> the caller could get wrong. This is a correctness rule with a cheating vector
> behind it, so it should be enforced in one place rather than duplicated across
> every view that renders a team.

> **League admins are not exempt.** They cannot see another manager's team
> before the deadline either. In most leagues the admin also plays, which is
> exactly why.
