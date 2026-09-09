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
  login: '/login',
  tournaments: '/tournaments',
  createLeague: '/leagues/new',
  actions: '/actions',
  admin: '/admin',

  /**
   * One tournament, in the admin panel. **Not in the route table in
   * `docs/04-navigation.md`**, which lists only `/admin` — but a tournament
   * carries teams, players, matches and rounds, which is more than a panel on a
   * shared page can hold. `08-pages/system-admin.md` leaves how the admin
   * groups into screens open.
   *
   * Distinct from the user-facing `/tournaments/:tournamentId`, which shows a
   * published tournament and its leagues.
   */
  adminTournament: '/admin/tournaments/:tournamentId',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

/** Built rather than spelled out, for the reason in the header above. */
export function adminTournamentPath(tournamentId: string): string {
  return `/admin/tournaments/${tournamentId}`
}

/**
 * NOT YET ROUTED, and deliberately.
 *
 * `docs/04-navigation.md` also specifies `/login`, `/tournaments/:tournamentId`
 * and nine sections beneath `/leagues/:leagueId`. None is here yet:
 *
 * - **The league sections** need a real `leagueId`, and the entry route
 *   `/leagues/:leagueId` is meant to redirect by league phase — which is
 *   derived from auction state, deadlines and `finishedAt`, none of which can
 *   be read yet.
 * - **A tournament detail page** needs a tournament to read.
 *
 * Adding them as placeholders would mean inventing the redirect behaviour that
 * makes them work, so they wait for data.
 */
