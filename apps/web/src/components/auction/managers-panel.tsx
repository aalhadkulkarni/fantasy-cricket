import { useMemo, useState } from 'react'

import { PlayerName } from '@/components/leagues/player-name'
import { RoleTag } from '@/components/leagues/role-tag'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { indexPool, managerRows, type ManagerRow } from './auction-derived'
import { useAuction, useAuctionStatic } from './auction-store'
import { price } from './labels'
import { OverseasMark } from './overseas-mark'

/**
 * **Everyone bidding: team, budget left, players bought.** Before the
 * auction starts every manager is on the full budget with none — the table is
 * never empty while there are managers. Tapping the player count opens that
 * squad, with what was paid.
 */
export function ManagersPanel() {
  const data = useAuctionStatic()
  const statuses = useAuction((s) => s.managers)
  const viewerId = useAuction((s) => s.viewer.userId)

  const pool = useMemo(() => indexPool(data.pool), [data.pool])
  const rows = useMemo(
    () => managerRows(data.members, statuses, data.settings, pool),
    [data.members, statuses, data.settings, pool],
  )

  const [open, setOpen] = useState<ManagerRow | undefined>(undefined)

  if (rows.length === 0) {
    return (
      <p className="py-4 text-sm text-subtle-foreground">
        Nobody has joined to bid yet.
      </p>
    )
  }

  return (
    <>
      <div className="flex items-baseline justify-between gap-3 pb-2 font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
        <span>Team</span>
        <span className="flex gap-6">
          <span>Budget</span>
          <span className="w-14 text-right">Players</span>
        </span>
      </div>
      <ul className="divide-y border-t border-b">
        {rows.map((row) => (
          <li
            key={row.userId}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium">
                {row.teamName}
                {row.userId === viewerId && (
                  <span className="ml-1.5 font-mono text-[10px] text-subtle-foreground uppercase">
                    you
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {row.name}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-6">
              <span className="font-mono text-sm">{price(row.budget)}</span>
              <button
                type="button"
                onClick={() => setOpen(row)}
                className="w-14 rounded-md py-1 text-right font-mono text-sm underline decoration-dotted underline-offset-4 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`${row.teamName}: ${row.squad.length} players, show squad`}
              >
                {row.squad.length}
              </button>
            </span>
          </li>
        ))}
      </ul>

      {open !== undefined && (
        <SquadDialog
          row={open}
          homeNation={data.settings.homeNation}
          onClose={() => setOpen(undefined)}
        />
      )}
    </>
  )
}

function SquadDialog({
  row,
  homeNation,
  onClose,
}: {
  row: ManagerRow
  homeNation: string | undefined
  onClose: () => void
}) {
  const spent = row.squad.reduce((sum, p) => sum + p.price, 0)

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{row.teamName}</DialogTitle>
          <DialogDescription>
            {row.squad.length} {row.squad.length === 1 ? 'player' : 'players'} ·
            spent {price(spent)} · {price(row.budget)} left
          </DialogDescription>
        </DialogHeader>

        {row.squad.length === 0 ? (
          <p className="text-sm text-subtle-foreground">
            No players bought yet.
          </p>
        ) : (
          <ul className="divide-y border-t border-b">
            {row.squad.map(({ entry, price: paid }) => (
              <li
                key={entry.player.playerId}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <OverseasMark
                    player={entry.player}
                    homeNation={homeNation}
                    keepSpace
                  />
                  <PlayerName player={entry.player} className="font-medium" />
                  <RoleTag role={entry.player.playerRole} />
                </span>
                <span className="shrink-0 font-mono text-sm">
                  {price(paid)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
