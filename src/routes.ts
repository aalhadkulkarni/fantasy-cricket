/**
 * Every path in one place, so nothing is spelled out by hand at a call site.
 *
 * A typo in a `to` prop is otherwise invisible: React Router renders the
 * not-found route and no error appears anywhere. Naming them once means a wrong
 * path is a compile error instead.
 *
 * Taken from the route table in `docs/04-navigation.md`. **Path segments are
 * plural** — `/leagues/:id`, never `/league/:id` — because the segment names
 * the collection and the id selects from it.
 *
 * **Ids in URLs are always the internal id, never a league join code.** The
 * code is a capability rather than an identifier: anyone who sees a URL would
 * have the code, and codes can be regenerated, which would break every existing
 * link.
 */
export const ROUTES = {
  home: '/',
  tournaments: '/tournaments',
  createLeague: '/leagues/new',
  actions: '/actions',
  admin: '/admin',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

/**
 * NOT YET ROUTED, and deliberately.
 *
 * `docs/04-navigation.md` also specifies `/login`, `/tournaments/:tournamentId`
 * and nine sections beneath `/leagues/:leagueId`. None is here yet:
 *
 * - **`/login`** needs auth, and the header it belongs to is the signed-out
 *   variant that does not exist.
 * - **The league sections** need a real `leagueId`, and the entry route
 *   `/leagues/:leagueId` is meant to redirect by league phase — which is
 *   derived from auction state, deadlines and `finishedAt`, none of which can
 *   be read yet.
 * - **A tournament detail page** needs a tournament to read.
 *
 * Adding them as placeholders would mean inventing the redirect behaviour that
 * makes them work, so they wait for data.
 */
