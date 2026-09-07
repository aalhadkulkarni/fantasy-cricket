# Login / account creation

**Purpose** — authenticate the user and guarantee a user record exists before
they reach the app.

**Reachable by** — everyone. This is the entry point for signed-out visitors.

## Flow

1. On any visit, load the Firebase Google auth module and check for an existing
   session
2. **Not signed in** → prompt Google sign-in
3. **Signed in** → look up a user record
4. **No record** → display-name modal, single required field, **no prefill** →
   confirm → record written → home
5. **Record exists** → straight to home
6. **Creation refused** → look the record up again and go home with it

> **Step 6 is not an error the user sees.** The same person can be part-way
> through this flow in two tabs, and only one of them can claim the identity.
> The other is refused, re-reads, and lands on home with the account that won.
> They do have an account; it just is not the one that tab was drafting. See
> `docs/06-data-layer.md`.

> **The refused tab's typed name is discarded.** If both tabs reached the modal
> and submitted different names, the first to claim wins. Accepted rather than
> solved — the alternative is asking someone which of their own two names they
> meant, about an account they did not know they were creating twice.

## Data captured

**Display name only.**

The avatar comes from Google's `photoURL` on the auth user object. No storage,
no upload, no extra permissions — just a URL to render.

**An initials fallback is required**, for two separate cases: the account has no
picture at all (`photoURL` is null), and the hotlinked Google image fails to
load later because the user changed or removed it.

## States

| State | Behaviour |
|---|---|
| Signed out | Google sign-in prompt |
| **Signed in, no user record** | Mid-creation. **If the tab is closed here, the next visit must route back to the modal.** The user is authenticated but has no profile, so home would break. |
| **Signed in, creation refused** | Another tab claimed this identity first. Re-read and go home. **Never rendered as a failure** — the account exists. |
| Signed in with a record | Straight to home |

**Sign out** lives in the site header, not here.

## Considered and rejected

| Rejected | Why |
|---|---|
| **Phone number** | Nothing consumes it — no SMS, no 2FA, no out-of-app notifications. Storing it means protecting personal data nothing reads. Ask for it later if a reason appears. |
| **A default team name** | Team names are per league, not per user. Someone in three leagues may want three names. The old system's single team name only worked because there was one league. This moved to the join-league flow. |
| **Separate name and nickname fields** | Two similar-sounding fields needing explanation. One display name is enough. |
| **Custom avatar upload** | Firebase Storage is a separate product with its own SDK, rules and quota, plus cropping and size limits. Not worth it for an avatar Google already provides. |
| **Prefilling the name from Google** | Many long-standing Gmail accounts carry a nickname or a joke as the account name, and people leave defaults alone. An embarrassing prefill is worse than an empty field. |
