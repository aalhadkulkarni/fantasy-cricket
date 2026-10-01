import { useMemo } from 'react'

import { PlayerName } from '@/components/leagues/player-name'
import { RoleTag } from '@/components/leagues/role-tag'
import type { AuctionPoolPlayer } from '@fantasy-cricket/shared'

import { draftPool, playerLists } from './auction-derived'
import { useAuction, useAuctionStatic } from './auction-store'
import { batchName, crore } from './labels'
import { OverseasMark } from './overseas-mark'

/**
 * **The batch that is up, and who in it is still to go** — what a bidder reads
 * to decide whether to spend now or wait for someone later in the same batch.
 * Each player with their team and base price, and an airplane where they are
 * overseas, since the overseas cap is the constraint people forget. The
 * player currently up is marked.
 *
 * In the draft, the draft pool instead: every General player not yet taken,
 * plus everyone left unsold, marked as such.
 *
 * **Its height is capped and the list scrolls inside it**, so a forty-player
 * batch never pushes the live round off a phone's screen.
 */
export function BatchBox() {
  const data = useAuctionStatic()
  const batch = useAuction((s) => s.state?.currentBatch)
  const started = useAuction((s) => s.state !== undefined)
  const currentId = useAuction((s) => s.state?.currentPlayerId)
  const statuses = useAuction((s) => s.players)

  const rows = useMemo((): { entry: AuctionPoolPlayer; note?: string }[] => {
    if (batch === undefined) return []
    if (batch.kind === 'draft') {
      return draftPool(data.pool, statuses).map(({ entry, wasUnsold }) => ({
        entry,
        ...(wasUnsold ? { note: 'was unsold' } : {}),
      }))
    }
    return playerLists(data.pool, statuses)
      .remaining.filter(
        (entry) =>
          entry.playerCategory === batch.playerCategory &&
          entry.player.playerRole === batch.playerRole,
      )
      .map((entry) => ({ entry }))
  }, [batch, data.pool, statuses])

  if (!started) return null

  const homeNation = data.settings.homeNation

  return (
    <section className="rounded-xl border bg-card text-card-foreground">
      <h2 className="flex flex-wrap items-baseline gap-x-2 border-b px-4 py-3 text-[15px]">
        <span className="text-muted-foreground">Current batch</span>
        {batch === undefined ? (
          <span className="text-muted-foreground">— not chosen yet</span>
        ) : (
          <>
            <span className="font-semibold">{batchName(batch)}</span>
            <span className="text-sm text-muted-foreground">
              · {rows.length}{' '}
              {batch.kind === 'draft' ? 'to pick from' : 'remaining'}
            </span>
          </>
        )}
      </h2>

      {batch !== undefined &&
        (rows.length === 0 ? (
          <p className="px-4 py-3 text-sm text-subtle-foreground">
            {batch.kind === 'draft'
              ? 'Nobody is left to pick.'
              : 'Everyone in this batch has gone up.'}
          </p>
        ) : (
          <ul className="max-h-56 divide-y overflow-y-auto">
            {rows.map(({ entry, note }) => {
              const up = entry.player.playerId === currentId
              return (
                <li
                  key={entry.player.playerId}
                  className={`flex items-center justify-between gap-3 px-4 py-2 ${
                    up ? 'bg-secondary' : ''
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
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
                    {up && (
                      <span className="shrink-0 font-mono text-[10px] text-live-text uppercase">
                        up now
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {note !== undefined && `${note} · `}
                    {crore(entry.playerBasePrice)}
                  </span>
                </li>
              )
            })}
          </ul>
        ))}
    </section>
  )
}
