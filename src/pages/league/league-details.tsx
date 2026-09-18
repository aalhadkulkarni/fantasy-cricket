import { useLeague } from '@/hooks/use-league'

/**
 * League Details — `/leagues/:leagueId/details`.
 *
 * The configuration a league was created with, and which parts of it an admin
 * may still change. Every field carries its own edit lock, and those locks are
 * a fairness mechanism rather than a convenience.
 */
export function LeagueDetails() {
  const { league } = useLeague()

  return (
    <section className="floodlit rounded-xl border bg-card p-5 text-card-foreground sm:p-7">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
        League Details
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {league.isAuctionEnabled ? 'Auction' : 'Regular'} ·{' '}
        {league.isGameWeeksEnabled ? 'Gameweek based' : 'Match based'}
      </p>

      <p className="mt-5 text-sm text-subtle-foreground">
        The full configuration and which parts an admin can still change are not
        built yet. See docs/08-pages/league-details.md.
      </p>
    </section>
  )
}
