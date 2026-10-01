import { useEffect, useState, type ReactNode } from 'react'

import { useAuth } from '@/auth/auth-context'
import { PageTab, PageTabsList } from '@/components/page-tabs'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  getAuctionPlayerPool,
  getAuctionSettings,
  getDraftOrder,
  getLineupRules,
  getMembers,
} from '@/data-layer'
import { useMediaQuery } from '@/hooks/use-media-query'
import type { LeagueSummary } from '@fantasy-cricket/shared'

import { momentOf } from './auction-derived'
import {
  AuctionStoreContext,
  createAuctionStore,
  startLiveFeed,
  useAuction,
  viewerFor,
} from './auction-store'
import { AuctioneerPanel } from './auctioneer-panel'
import { BatchBox } from './batch-box'
import { BidderPanel } from './bidder-panel'
import { ManagersPanel } from './managers-panel'
import { PlayersPanel } from './players-panel'
import { Stage } from './stage'
import { TimelinePanel } from './timeline-panel'

/**
 * **The live auction, for one league.** Owns the page's store: reads the
 * fixed facts once, then attaches the live listeners, and tears every one of
 * them down on the way out.
 *
 * **One page, three renderings.** Everyone sees the stage and the lists; the
 * current auctioneer also gets the control panel, and a manager the bid panel
 * — both, for an auctioneer who also plays. Decided by who holds the role now,
 * so a handover changes what renders.
 */
export function AuctionRoom({ league }: { league: LeagueSummary }) {
  const [store] = useState(createAuctionStore)
  const auth = useAuth()
  const userId =
    auth.state.status === 'signedIn' ? auth.state.userId : undefined

  const [loadToken, setLoadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    let stop: (() => void) | undefined

    void (async () => {
      store.setState({ staticError: undefined })
      try {
        const [settings, pool, members, draftOrder, rules] = await Promise.all([
          getAuctionSettings(league.leagueId),
          getAuctionPlayerPool(league.leagueId),
          getMembers(league.leagueId),
          getDraftOrder(league.leagueId),
          getLineupRules(league.leagueId),
        ])
        if (cancelled) return
        const data = { league, settings, pool, members, draftOrder, rules }

        store.setState({ static: data, viewer: viewerFor(data, userId) })
        stop = startLiveFeed(store, league.leagueId)
      } catch (e) {
        if (!cancelled) {
          store.setState({
            staticError: e instanceof Error ? e.message : String(e),
          })
        }
      }
    })()

    return () => {
      cancelled = true
      stop?.()
    }
  }, [store, league, userId, loadToken])

  return (
    <AuctionStoreContext.Provider value={store}>
      <Room league={league} onRetry={() => setLoadToken((n) => n + 1)} />
    </AuctionStoreContext.Provider>
  )
}

function Room({
  league,
  onRetry,
}: {
  league: LeagueSummary
  onRetry: () => void
}) {
  const loaded = useAuction((s) => s.static !== undefined)
  const staticError = useAuction((s) => s.staticError)

  return (
    <main className="py-4 sm:py-6">
      <PageContainer>
        <Header league={league} />

        {staticError !== undefined ? (
          <div className="mt-6 text-sm">
            <p className="font-semibold text-destructive">
              Could not load the auction
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {staticError}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onRetry}
            >
              Retry
            </Button>
          </div>
        ) : !loaded ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Body />
        )}
      </PageContainer>
    </main>
  )
}

/**
 * **One small line**, not a page title. This page changes every few seconds
 * and its height belongs to the round; the league name is only a reminder of
 * where you are. Banners appear below it only when there is something to say.
 */
function Header({ league }: { league: LeagueSummary }) {
  const liveError = useAuction((s) => s.liveError)

  return (
    <header>
      <h1 className="flex min-w-0 items-baseline gap-2 text-sm">
        <span className="truncate font-semibold">{league.leagueName}</span>
        <span className="shrink-0 font-mono text-[11px] tracking-[0.14em] text-subtle-foreground uppercase">
          Live auction
        </span>
      </h1>

      {liveError !== undefined && (
        <p
          role="alert"
          className="mt-2 rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive"
        >
          Live updates have stopped. Reload the page to reconnect.
          <span className="mt-1 block font-mono text-xs text-muted-foreground">
            {liveError}
          </span>
        </p>
      )}
    </header>
  )
}

/**
 * **Stage and the viewer's panel first**, where a thumb is. Below them the
 * timeline, managers and players — tabs on a phone, so the stage stays near
 * the top; columns on a wide screen. Only one arrangement is mounted.
 */
function Body() {
  const isAuctioneer = useAuction((s) => s.viewer.isAuctioneer)
  const isManager = useAuction((s) => s.viewer.isManager)
  const state = useAuction((s) => s.state)
  const round = useAuction((s) => s.round)
  const desktop = useMediaQuery('(min-width: 1024px)')

  // After the auction, the record comes first: open on the players.
  const ended = momentOf(state, round) === 'ended'

  const panels = (
    <>
      {isAuctioneer && <AuctioneerPanel />}
      {isManager && <BidderPanel />}
    </>
  )

  if (desktop) {
    return (
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_22rem] gap-5">
        <div className="grid content-start gap-4">
          <BatchBox />
          <Stage />
          {panels}
          <div className="grid grid-cols-2 gap-5">
            <Card title="Managers">
              <ManagersPanel />
            </Card>
            <Card title="Players">
              <PlayersPanel />
            </Card>
          </div>
        </div>
        <Card title="Timeline" className="max-h-[80vh] overflow-y-auto">
          <TimelinePanel />
        </Card>
      </div>
    )
  }

  return (
    <div className="mt-3 grid gap-3">
      <BatchBox />
      <Stage />
      {panels}
      <Tabs defaultValue={ended ? 'players' : 'timeline'}>
        <PageTabsList>
          <PageTab value="timeline">Timeline</PageTab>
          <PageTab value="managers">Managers</PageTab>
          <PageTab value="players">Players</PageTab>
        </PageTabsList>
        <TabsContent value="timeline">
          <TimelinePanel />
        </TabsContent>
        <TabsContent value="managers" className="pt-3">
          <ManagersPanel />
        </TabsContent>
        <TabsContent value="players">
          <PlayersPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Card({
  title,
  className = '',
  children,
}: {
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={`rounded-xl border bg-card p-5 text-card-foreground ${className}`}
    >
      <h2 className="mb-3 font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}
