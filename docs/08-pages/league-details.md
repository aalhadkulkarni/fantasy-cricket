# League Details

**Sidebar item on league home. Everyone can view it; admins edit in place.**

Full configuration in one place: rules, scoring system, gameweek structure,
auction settings.

> **Given its own sidebar item rather than a side panel** because managers refer
> back to it often — especially in a custom-scoring league, where the free-text
> scoring description is how they know what scores. It has no length limit and a
> side panel would be cramped.

> **Why view-with-inline-edit rather than a separate admin form:** an admin sees
> exactly what managers see, which removes the chance of misconfiguring
> something because the admin form looked different from the display. One source
> of truth.

**Auction configuration also lives here**, rather than being duplicated inside
Auction Center. That includes **auctioneer and backup auctioneer assignment** —
member-related, but it belongs with the auction rather than with general
administration.

## Edit locks

Every field carries its own lock condition. **These are a fairness mechanism,
not a convenience.** Managers must be able to rely on the rules not changing
under them once they have committed.

| Field | Editable until |
|---|---|
| **League name** | Always |
| **League type** (auction / regular) | **Never** — not editable after creation |
| **Accessibility** (public / closed) | **Never** — set at creation only |
| **Max slots** | Always, but **never below the number of teams already joined**, and never above 8 in an auction league. It is the only slot field, so this row governs auction leagues too. |
| **Join deadline** | **Regular:** extendable up to the team submission deadline (first match start, minus the offset). **Auction:** extendable up to the scheduled auction start, since there is nothing to join after bidding begins. |
| **Team changes deadline offset** | **Cannot be brought forward once fewer than 24 hours remain** until the current deadline. Can be **extended** at any time, including after the deadline has passed, as long as match 1 has not started. |
| **Points source** | **Auction:** locked once the auction starts. **Regular:** locked 24 hours before the team submission deadline. |
| **Scoring rules text** | Same as points source |
| **Auction scheduled start** | Until the auction starts |
| **Transfer settings** | Until the auction starts |
| **Auction budget and player details** | Until the auction starts |
| **Gameweek structure** | **Auction:** until the auction starts. **Regular:** as long as no teams have been submitted. |

> The points source and scoring rules both lock at the moment people start
> making informed decisions. For an auction league that moment is the auction,
> not team submission — you bid differently depending on how points are scored.

> **Accessibility was considered as an editable field and cut.** No Phase 1
> value, and it raises awkward questions about whether flipping a league to
> public silently readmits people who were rejected or banned.
