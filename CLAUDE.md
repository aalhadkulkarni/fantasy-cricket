# CLAUDE.md

A fantasy cricket platform. Users create private leagues, pick teams from real
cricketers, and score points from real match performances. Auction leagues run a
live auction first, where managers bid for the squad they will pick from.

**This is a frontend rewrite of an existing working system.** The requirements
have been redefined from scratch rather than reverse-engineered. Do not assume
existing behaviour — work from the documents.

**Read `docs/01-overview.md` before doing anything else.**

---

## Rules that apply to every task

These are the ones that cost real work when broken. The rest are in
`docs/02-working-with-me.md`, which should be read in full before starting.

### 1. Do not implement anything without explicit approval

If I say _"we should go with this approach — a `leagues.tsx` and a separate
`league.tsx`"_, **that is not an instruction to create those files.** It is me
describing a plan. Help me refine it. Implementation happens only when I say to
go ahead.

Thinking out loud, proposing and planning all look like instructions if you are
looking for instructions. **Assume I am still deciding unless I clearly say
otherwise.**

### 2. Deferred decisions are not yours to make

Several documents say a decision is _"deferred to implementation"_ or _"yours to
decide at this stage"_. **That does not mean you decide it alone.** It means it
was postponed so we could settle it together with real code in front of us.

When you hit one: stop, say which decision it is, and we settle it before you
continue. Do not pick an option and proceed.

### 3. Flag discrepancies. Never resolve them silently

These documents were written over several weeks and will contradict each other
somewhere. **Do not pick whichever version seems more likely, and do not assume
the newer document wins. Stop and ask.**

Every decision in them is mine, but the prose was drafted by AI from those
decisions. So the substance is deliberate while the wording may not always be.
**When something reads oddly, a drafting artefact is more likely than a
considered decision** — but a wrong assumption written into code is far more
expensive than a question.

### 4. Stay on the task

Implement what I asked for. If you notice something else that should change,
finish the task first, keep a list, and raise it at the end. **Never silently
change something I did not ask about.**

### 5. Do not agree by default

Judge what I propose on technical reality, not on whether I seem committed to
it. I want genuine feedback, not validation. **But do not manufacture
disagreement either** — a pushback needs substance.

### 6. Verify before saying something works

Run it. Build it. Check the output. Say what you actually verified and what you
did not. _"The build passes and the three cases return what was expected"_ is
worth something. _"Done"_ is not.

### 7. "Done" has a definition

A component is finished when its **loading, empty, error and mobile states** are
all handled — not when it renders correctly with data. If any is missing, say so
rather than reporting completion.

---

## Architecture rules

### All data access goes through the data layer

**Phase 1 is the frontend only.** The app talks directly to Firebase Realtime
Database from the browser; there is no server. **Phase 2 will put a real backend
behind it**, and the data layer is what makes that possible without touching
anything above it.

1. **No component imports Firebase.** Ever.
2. **No Firebase-shaped type crosses the boundary** — no snapshots, no
   references.
3. **All reads, writes and subscriptions go through the layer.**
4. **Reads and subscriptions are distinct**, with different lifecycles.
5. **The schema does not leak either.** The layer is the contract between client
   and server — the equivalent of a set of REST endpoints. **No function may
   require its caller to know how the backend schema is shaped**, in its
   parameters or in what it returns. If a caller has to know that lineups are
   split across two nodes, or that points are held in both a match-major and a
   player-major copy, the function is wrong.

### The data layer is the Phase 1 server

**Any rule that will be a server-side check in Phase 2 is enforced in the data
layer now** — not in components.

This covers team visibility, join deadlines, squad validity, bid legality,
transfer validity and ban checks.

> UI-level gating is convenience, never the guard. Anyone can read the database
> directly with the client SDK.

### Firebase security rules stay permissive

Deliberate for Phase 1. The data layer enforces access. **Do not write
restrictive rules — they will break reads.**

---

## Things that look wrong but are deliberate

Each of these is a settled decision with a reason recorded. **Do not "fix"
them.**

|                                                    |                                                                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **The auction has a known race condition**         | The auctioneer may read one manager's bid before another's even when the other wrote first. This has run through multiple real auctions. It is accepted, not a defect.                                                         |
| **Points are never stored per manager**            | They are stored per player per match and totalled at read time, so a scoring correction means editing one number.                                                                                                              |
| **Standard points are never copied into a league** | A league checks its own store first and falls back to standard. Copying would mean fixing a correction in every league that opted in.                                                                                          |
| **A league's phase is never stored**               | It is derived from auction state, deadlines and `finishedAt`. The old system had it as a constant in source, so advancing a league required a redeploy.                                                                        |
| **Illegal squads are permitted at auction**        | A manager can buy ten batsmen. The consequence lands later — they score zero for a gameweek they cannot field a legal XI for.                                                                                                  |
| **Selling in the auction is manual**               | The system does not auto-resolve on timeout, so the auctioneer can make allowances for someone with connection trouble.                                                                                                        |
| **Match-based lineups are stored densely**         | One entry per match, with values copied forward. Gameweek leagues store one entry per gameweek and are not affected. Sparse storage is a known optimisation, deliberately deferred — it only matters at 60+ match tournaments. |

---

## Naming: the UI and the model use different words

| UI says                                  | Model calls it |
| ---------------------------------------- | -------------- |
| **Tournament** — IPL 2027                | `tournaments`  |
| **Base Tournament** — IPL, ODI World Cup | `competitions` |

Users say "the IPL tournament", so **Tournament** is the user-facing word for the
thing you create a league against. The level above it is a system-admin concept
that never appears in user-facing UI.

**This will confuse anyone reading code against the documents if they have not
been told.**

Two more worth knowing:

- **Manager** is a fantasy participant. **Player** is a cricketer.
- **Squad** is the set of players a manager owns. **Lineup** is the eleven they
  field.

---

## Stack

|            |                                                         |
| ---------- | ------------------------------------------------------- |
| Language   | TypeScript, strict                                      |
| Build      | Vite                                                    |
| Styling    | Tailwind, themed through CSS custom properties          |
| Components | shadcn/ui — added individually as needed, not upfront   |
| Data       | Firebase Realtime Database, through the data layer only |
| Auth       | Firebase Google auth                                    |

**Routing and state management libraries are not yet chosen.** One hard
requirement on state: **live auction updates must not re-render unrelated
components.** Plain React Context re-renders every consumer on any change, which
is a real problem for a screen updating several times a second.

---

## Non-negotiables

**Responsive design is a primary requirement, not a later fix.** Most usage is a
phone browser — people check their team and bid in auctions from phones. Every
layout must survive 390px with no horizontal scroll. When deciding whether a
table can scroll sideways, that fact governs.

**Accessibility floor during the build:** semantic HTML, visible focus states,
alt text. A full audit comes later, but these are nearly free now and expensive
to retrofit. Contrast is already handled by the design tokens.

---

## Where to find things

| Document                     | Contents                                                         |
| ---------------------------- | ---------------------------------------------------------------- |
| `docs/01-overview.md`        | **Read first.** What the product is and which decisions shape it |
| `docs/02-working-with-me.md` | **Read second.** How to collaborate here, in full                |
| `docs/03-roles.md`           | What each of the six roles can do                                |
| `docs/04-navigation.md`      | Routes, redirects, and what happens on refused access            |
| `docs/05-data-model.md`      | Principles and structural rules behind the schema                |
| `docs/data-model.js`         | The schema itself — a worked example with reasoning in comments  |
| `docs/06-data-layer.md`      | Every read, write and subscription each page needs               |
| `docs/07-design-system.md`   | Tokens, typography, and the rules governing them                 |
| `docs/design-reference.html` | **Open in a browser.** The source of truth for exact CSS values  |
| `docs/08-pages/`             | One document per page. Start at `index.md`.                      |
| `src/types/`                 | The frontend's data types. **Not the schema** — see below        |

**`src/types/` is not a copy of the schema.** It started as one, which is why
most of it still looks like `docs/data-model.js`. It is being built towards
types the interface is designed against: resolved entities and derived values,
so a component receives what it renders rather than ids to chase. The `DERIVED`
and `JOIN` markers in those files are a build list, not a record of things
deliberately left out. `src/types/index.ts` states the direction in full.

**Where a general document conflicts with a specific one, the specific document
wins** — but flag the conflict rather than silently choosing.
