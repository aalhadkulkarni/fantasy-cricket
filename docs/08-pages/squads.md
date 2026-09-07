# Squads

**One sidebar item on league home, at `/leagues/:leagueId/squads`. Auction
leagues, after the auction only.**

**One page, not two.** There is no separate All Squads screen: your own squad
and everyone else's are the same view, because you look at them together.

**Your squad**, with the **current locked playing XI highlighted**, and **C** and
**VC** marked.

**Every other manager** appears as a **collapsed item** — name and team name —
expanding to show their squad with the same locked-XI highlighting. With six
managers that is your squad plus five collapsed items.

> **Locked XI only.** An unlocked selection is never shown to anyone else — see
> the team visibility rule in `docs/03-roles.md`.

> **Squads themselves are always public.** The visibility rule protects *which
> eleven you are fielding*, not *which players you own*. Your squad was public
> at the auction while everyone watched you buy it, and knowing who owns whom is
> a prerequisite for proposing transfers.

## Shared component

The squad-pair view is one component used in two modes:

- **Here** — read-only
- **In the Transfers Center offer builder** — selectable

> **Squad viewing does not depend on a transfer window being open.** These are
> their own sidebar items deliberately, not folded into Transfers Center. You
> look at your squad right after the auction, and check who owns whom long
> before deciding to trade.
