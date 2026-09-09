# Login / account creation

**Purpose** — authenticate the user and guarantee a user record exists before
they reach the app.

**Reachable by** — everyone. This is the entry point for signed-out visitors.

## Flow

1. On any visit, check for an existing session. **This is asynchronous**, so
   until it resolves the app does not know — see States below
2. **Not signed in** → prompt Google sign-in
3. **Signed in** → look up a user record
4. **No record** → display-name modal, single required field, **no prefill** →
   confirm → record written → home
5. **Record exists** → straight to home

> **There is no "creation refused" case.** `users/` is keyed by the Firebase
> Auth UID, so two tabs signing in as the same person address the same path.
> Two records for one human cannot happen, and nothing needs claiming. See
> `docs/06-data-layer.md`.

> **If both tabs reach the modal and submit different names, one is discarded.**
> Last write wins. Accepted rather than solved — the alternative is asking
> someone which of their own two names they meant.

## Sign-in outcomes

Three, and only one is a failure:

| What happened                           | Behaviour                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **The browser blocked the popup**       | A real message saying so. Nothing on screen explains it otherwise, and the person cannot act without being told. |
| **They closed the popup**               | **Not an error.** They changed their mind. Back to the sign-in prompt.                                           |
| **A second popup superseded the first** | Ignored.                                                                                                         |

> **Popup rather than redirect.** `signInWithRedirect` breaks on browsers that
> partition third-party storage unless the auth handler is self-hosted, which
> makes it the more fragile option on a product used mostly on phones. So the
> blocked-popup path is worth handling properly rather than falling back.

## Data captured

**Display name only.**

The avatar comes from Google's `photoURL` on the auth user object. No storage,
no upload, no extra permissions — just a URL to render.

**An initials fallback is required**, for two separate cases: the account has no
picture at all (`photoURL` is null), and the hotlinked Google image fails to
load later because the user changed or removed it.

## States

| State                         | Behaviour                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Resolving the session**     | A loading state. Without one, every visit flashes this page before redirecting a signed-in person to home.                                                   |
| Signed out                    | Google sign-in prompt                                                                                                                                        |
| **Signed in, no user record** | Mid-creation. **If the tab is closed here, the next visit must route back to the modal.** The user is authenticated but has no profile, so home would break. |
| Signed in with a record       | Straight to home                                                                                                                                             |

> **What decides "no user record" is our own lookup**, never Firebase's
> `isNewUser`. That flag says whether Firebase Auth just created the account,
> which is a different question. Someone who abandoned the modal and came back
> is `isNewUser: false` and still has no record — which is precisely the row
> above.

**Sign out** lives in the site header, not here.

## Considered and rejected

| Rejected                              | Why                                                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phone number**                      | Nothing consumes it — no SMS, no 2FA, no out-of-app notifications. Storing it means protecting personal data nothing reads. Ask for it later if a reason appears.                                       |
| **A default team name**               | Team names are per league, not per user. Someone in three leagues may want three names. The old system's single team name only worked because there was one league. This moved to the join-league flow. |
| **Separate name and nickname fields** | Two similar-sounding fields needing explanation. One display name is enough.                                                                                                                            |
| **Custom avatar upload**              | Firebase Storage is a separate product with its own SDK, rules and quota, plus cropping and size limits. Not worth it for an avatar Google already provides.                                            |
| **Prefilling the name from Google**   | Many long-standing Gmail accounts carry a nickname or a joke as the account name, and people leave defaults alone. An embarrassing prefill is worse than an empty field.                                |
