import { useEffect, useMemo, useState } from 'react'

import { PageTab, PageTabsList } from '@/components/page-tabs'
import { PlayerName } from '@/components/leagues/player-name'
import { RoleTag } from '@/components/leagues/role-tag'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { getPlayerBiddingHistory } from '@/data-layer'
import type {
  AuctionPoolPlayer,
  LeagueId,
  PlayerBiddingHistory,
} from '@fantasy-cricket/shared'

import { playerLists } from './auction-derived'
import { useAuction, useAuctionStatic } from './auction-store'
import { CATEGORY_NAME, price } from './labels'
import { OverseasMark } from './overseas-mark'

/**
 * **Remaining, sold and unsold**, with counts. Before the auction, remaining
 * is the whole pool and the other two are empty. After it, this is the
 * record: who bought whom and for how much, and — on tap — the bidding on any
 * player who went up.
 */
export function PlayersPanel() {
  const data = useAuctionStatic()
  const statuses = useAuction((s) => s.players)
  const viewerId = useAuction((s) => s.viewer.userId)

  const lists = useMemo(
    () => playerLists(data.pool, statuses),
    [data.pool, statuses],
  )
  const teamName = (userId: string) => {
    if (userId === viewerId) return 'You'
    return buyerName(userId)
  }
  /** The team's name even when it is the viewer's, as a sale reads. */
  const buyerName = (userId: string) => {
    const member = data.members.find((m) => m.userId === userId)
    return member?.fantasyTeamName ?? member?.userName ?? 'A manager'
  }

  const [history, setHistory] = useState<AuctionPoolPlayer | undefined>(
    undefined,
  )

  return (
    <>
      <Tabs defaultValue="remaining">
        <PageTabsList>
          <PageTab value="remaining" count={lists.remaining.length}>
            Remaining
          </PageTab>
          <PageTab value="sold" count={lists.sold.length}>
            Sold
          </PageTab>
          <PageTab value="unsold" count={lists.unsold.length}>
            Unsold
          </PageTab>
        </PageTabsList>

        <TabsContent value="remaining">
          <List
            homeNation={data.settings.homeNation}
            empty="Every player has gone up."
            rows={lists.remaining.map((entry) => ({ entry }))}
          />
        </TabsContent>
        <TabsContent value="sold">
          <List
            homeNation={data.settings.homeNation}
            empty="Nobody has been sold yet."
            rows={lists.sold.map(({ entry, managerId, winningBid }) => ({
              entry,
              trailing: `${buyerName(managerId)} · ${price(winningBid)}`,
              highlight: managerId === viewerId,
              onOpen: () => setHistory(entry),
            }))}
          />
        </TabsContent>
        <TabsContent value="unsold">
          <List
            homeNation={data.settings.homeNation}
            empty="Nobody has gone unsold."
            rows={lists.unsold.map((entry) => ({
              entry,
              trailing: 'Unsold',
              onOpen: () => setHistory(entry),
            }))}
          />
        </TabsContent>
      </Tabs>

      {history !== undefined && (
        <HistoryDialog
          leagueId={data.league.leagueId}
          entry={history}
          teamName={teamName}
          onClose={() => setHistory(undefined)}
        />
      )}
    </>
  )
}

/** One line per player — never a wide table, which would scroll on a phone. */
function List({
  rows,
  empty,
  homeNation,
}: {
  rows: {
    entry: AuctionPoolPlayer
    trailing?: string
    /** The viewer's own purchase. */
    highlight?: boolean
    onOpen?: () => void
  }[]
  empty: string
  homeNation: string | undefined
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-sm text-subtle-foreground">{empty}</p>
  }

  return (
    // Capped and scrolling inside, so a long list never lengthens the page.
    <ul className="mt-2 max-h-80 divide-y overflow-y-auto border-b">
      {rows.map(({ entry, trailing, highlight, onOpen }) => {
        const content = (
          <>
            <span className="flex min-w-0 items-center gap-2.5">
              <OverseasMark
                player={entry.player}
                homeNation={homeNation}
                keepSpace
              />
              <PlayerName
                player={entry.player}
                className="text-[15px] font-medium"
              />
              <RoleTag role={entry.player.playerRole} />
            </span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {trailing ??
                `${CATEGORY_NAME[entry.playerCategory]} · ${price(entry.playerBasePrice)}`}
            </span>
          </>
        )
        return (
          <li
            key={entry.player.playerId}
            className={highlight === true ? 'bg-primary/10' : undefined}
          >
            {onOpen === undefined ? (
              <div className="flex items-center justify-between gap-3 px-2 py-2.5">
                {content}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpen}
                className="flex w-full items-center justify-between gap-3 px-2 py-2.5 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {content}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * **The bidding on one player, in order.** Read when opened and not before:
 * the history of every player is the whole auction.
 */
function HistoryDialog({
  leagueId,
  entry,
  teamName,
  onClose,
}: {
  leagueId: LeagueId
  entry: AuctionPoolPlayer
  teamName: (userId: string) => string
  onClose: () => void
}) {
  const [history, setHistory] = useState<
    PlayerBiddingHistory | null | undefined
  >(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const loaded = await getPlayerBiddingHistory(
          leagueId,
          entry.player.playerId,
        )
        if (!cancelled) setHistory(loaded ?? null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [leagueId, entry.player.playerId])

  // Newest first, so the winning bid is the first thing read. The numbers
  // still say the order.
  const bids = Object.values(history?.bids ?? {}).sort(
    (a, b) => b.bidNumber - a.bidNumber,
  )

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{entry.player.playerName}</DialogTitle>
          <DialogDescription>
            {CATEGORY_NAME[entry.playerCategory]} · base{' '}
            {price(entry.playerBasePrice)}
          </DialogDescription>
        </DialogHeader>

        {error !== undefined ? (
          <div className="text-sm">
            <p className="font-semibold text-destructive">
              Could not load the bidding
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {error}
            </p>
          </div>
        ) : history === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : bids.length === 0 ? (
          <p className="text-sm text-subtle-foreground">
            Nobody bid on this player.
          </p>
        ) : (
          <ol className="divide-y border-t border-b">
            {bids.map((bid) => (
              <li
                key={bid.bidId}
                className="flex items-baseline justify-between gap-3 py-2"
              >
                <span className="flex items-baseline gap-3">
                  <span className="w-5 text-right font-mono text-xs text-subtle-foreground">
                    {bid.bidNumber}
                  </span>
                  <span>{teamName(bid.managerId)}</span>
                </span>
                <span className="font-mono text-sm">
                  {price(bid.bid)}
                  {bid.sold === true && (
                    <span className="ml-2 text-[10px] text-settled uppercase">
                      sold
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
