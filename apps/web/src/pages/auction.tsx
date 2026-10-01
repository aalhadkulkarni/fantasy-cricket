import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router'

import { AuctionRoom } from '@/components/auction/auction-room'
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
 * than a navigation. This page only finds the league; `AuctionRoom` is the
 * auction itself.
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

  return <AuctionRoom league={league} />
}
