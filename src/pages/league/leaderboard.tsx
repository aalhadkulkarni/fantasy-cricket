/**
 * Leaderboard — `/leagues/:leagueId/leaderboard`.
 *
 * **Always expressed in matches, never gameweeks**, whichever kind of league
 * this is. Points are match-based either way.
 */
export function Leaderboard() {
  return (
    <section className="floodlit rounded-xl border bg-card p-5 text-card-foreground sm:p-7">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
        Leaderboard
      </h2>
      <p className="mt-5 text-sm text-subtle-foreground">
        Not built yet. Ranking needs points, which nothing enters so far. See
        docs/08-pages/leaderboard.md.
      </p>
    </section>
  )
}
