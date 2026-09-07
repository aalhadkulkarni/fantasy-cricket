# Admin Center

**Sidebar item on league home. Owner and admins only.**

People and lifecycle: join requests, roles, bans, marking the league finished,
and league-scoped points entry.

> **Why this is separate from League Details:** join requests, role grants,
> bans, finishing a league and entering points are actions on *people* and on
> the league's *lifecycle*. They have no manager-facing view to attach to, so
> they cannot use the view-with-inline-edit pattern that configuration uses.

## Requests and members

**Pending and rejected** join requests, shown in a side panel, alongside the
member list.

> **Accepted requests are kept but not shown.** The record keeps its `Accepted`
> status, because a request that was granted is still a fact worth having. It
> has no place in the UI though: once someone is a member the member list is
> where you look for them, and a second list saying the same thing beside it
> only invites the question of which one is real.

| Action | Behaviour |
|---|---|
| **Accept a join request** | The requester becomes a member |
| **Reject** | **Soft** — the requester may request again. Covers the common case of an admin misclicking or changing their mind. |
| **Reject and ban** | The hard version. The person cannot request again. |
| **Ban an existing manager** | From the member list |
| **Unban** | An option against each entry in the banned list. The admin chooses which role to grant on the way back in. |
| **Make admin / remove admin** | In the member list. **Admins sort to the top.** |
| **Mark league finished** | Manual, and gated on all matches having ended |

**Owner protections, which must be enforced:**

- The **owner cannot be removed as admin**
- The owner **can remove every other admin** — and since the owner remains an
  admin, a league can never end up with zero admins

**Marking a league finished is deliberately manual.** Only a person knows
whether every point and correction is actually in.

> How a ban is represented — as a role that strips the manager role, rather than
> by deleting the person — is in `docs/03-roles.md`. It matters here because
> banning does *not* remove someone's data.

## Points entry — custom-scoring leagues only

A **points update box**: a match dropdown with the next match preselected, and
an **Update points** button leading to the points entry page.

**Points entry page:** every applicable player for that match, with an input
each. **If points already exist, the form is prefilled.**

> **This is the same page as system-admin points entry**, scoped to a league
> rather than to standard points. One implementation, not two.

> **The write is a full replace.** Blank and zero are equivalent, so
> resubmitting rewrites every player's value. Prefill must therefore be
> reliable — if it silently fails, resubmitting one correction would blank
> everyone else.
