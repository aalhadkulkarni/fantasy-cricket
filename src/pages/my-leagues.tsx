/**
 * My Leagues — `/`, and **this is home**.
 *
 * Both the logo and the My Leagues header item point here. Home is this rather
 * than Tournaments because Tournaments is a discovery surface used a handful of
 * times ever, while this is where someone returns daily during a season.
 *
 * **A placeholder.** The real page carries three tabs, league cards and an
 * empty state — see `docs/08-pages/my-leagues.md`. None of that is built,
 * because the data layer does not talk to a database yet.
 */
export function MyLeagues() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        My Leagues
      </h1>

      <p className="mt-2 text-sm text-muted-foreground">
        Home. Every league you have joined or are spectating.
      </p>

      <div className="mt-8 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
        <p className="font-mono text-xs tracking-wide text-subtle-foreground uppercase">
          Placeholder
        </p>
        <p className="mt-3 text-sm">
          Nothing renders here yet. The tabs, league cards and empty state come
          once the data layer can read a league.
        </p>
      </div>
    </main>
  )
}
