import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'

import { PageContainer } from '@/components/layout/page-container'
import { getLeagueSummary } from '@/data-layer'
import { leaguePath } from '@/routes'
import type { LeagueId, LeagueSummary } from '@fantasy-cricket/shared'

/**
 * The live auction — `/leagues/:leagueId/auction`.
 *
 * **Its own page, outside the league's layout.** Auction Center opens it in a
 * new tab, so a manager cannot lose the auction by clicking something else, and
 * a new tab has to be able to load it from the URL alone.
 *
 * **One page, three renderings** — spectator, bidder, auctioneer — decided by
 * who holds which role at the moment, so a handover is a data change rather
 * than a navigation. None of that exists yet: Phase C builds the page and the
 * way to it, and Phase D fills it.
 */
export function Auction() {
  const { leagueId } = useParams<{ leagueId: string }>()

  const [league, setLeague] = useState<LeagueSummary | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (leagueId === undefined) return
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getLeagueSummary(leagueId as LeagueId)
        if (!cancelled) {
          setLeague(loaded)
          setError(undefined)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [leagueId])

  if (error !== undefined) {
    return (
      <main className="py-10 sm:py-14">
        <PageContainer>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Auction not available
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The league may not exist, or you may not be able to see it.
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {error}
          </p>
        </PageContainer>
      </main>
    )
  }

  if (league === undefined) {
    return (
      <main className="py-10 sm:py-14">
        <PageContainer>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </PageContainer>
      </main>
    )
  }

  // A regular league has no auction. Its own page is the useful place to land.
  if (!league.isAuctionEnabled) {
    return <Navigate to={leaguePath(league.leagueId)} replace />
  }

  return (
    <main className="py-10 sm:py-14">
      <PageContainer>
        <p className="font-mono text-[11px] tracking-[0.14em] text-subtle-foreground uppercase">
          Live auction
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {league.leagueName}
        </h1>

        <section className="floodlit mt-8 rounded-xl border bg-card p-5 text-card-foreground sm:p-7">
          <h2 className="text-lg font-semibold">The auction room opens here</h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Bidding, the timeline and the managers&apos; budgets will appear on
            this page. Until then, everything you need to prepare is in Auction
            Center.
          </p>
          <Link
            to={leaguePath(league.leagueId, 'auction-center')}
            className="mt-4 inline-block text-sm font-medium underline underline-offset-4 hover:text-foreground"
          >
            Back to Auction Center
          </Link>
        </section>
      </PageContainer>
    </main>
  )
}
