/**
 * Members — `/leagues/:leagueId/members`.
 *
 * Who is in the league, with their team names and an admin badge. It earns its
 * place beside the leaderboard because that one is *ranked* rather than a
 * roster.
 */
export function Members() {
  return (
    <section className="rounded-xl border bg-card p-5 text-card-foreground sm:p-7">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Members</h2>
      <p className="mt-5 text-sm text-subtle-foreground">
        Not built yet. See docs/08-pages/members.md.
      </p>
    </section>
  )
}
