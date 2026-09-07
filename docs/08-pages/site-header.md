# Site header

Persistent navigation across the whole app. Called a header for convenience — it
may equally be a sidebar. What matters is that these items are always reachable.

**Right corner:** display name, avatar (`photoURL` with initials fallback), and
**sign out**.

## Navigation items

| Item | Notes |
|---|---|
| **Home** | The logo links here. Home is My Leagues. |
| **My Leagues** | The primary surface — where a user returns daily during a season |
| **Tournaments** | Discovery |
| **Join a League** | Opens the league-code modal |
| **Create a League** | Also reachable from a tournament page |
| **Actions Center** | See `actions-center.md` |
| **Admin panel** | **System admins only** |

**The header varies by auth state.** A signed-out visitor sees a minimal header
— most items are meaningless without a session, and the login page is reachable
by everyone.

## Naming: "Tournaments" in the UI

Users see **Tournaments**. That is what people say — "the IPL tournament", "the
World Cup".

**Internally that concept is called a `tournament`.** The level above it —
`competitions` (IPL, ODI World Cup, Generic ODI) — is a system-admin concept
that never appears in user-facing UI, so there is no collision anywhere a user
can see.

> Anyone reading the code against these documents will hit this. UI
> "Tournament" = model `tournaments`. UI "Base Tournament" = model
> `competitions`.

## Create a League — two entry points, one page

- **From a tournament page** — the tournament is already chosen. Natural when
  browsing and thinking "I'll run one for this".
- **From the header** — for someone who arrived intending to create one; the
  tournament becomes the first field.

Same page, different prefill.
