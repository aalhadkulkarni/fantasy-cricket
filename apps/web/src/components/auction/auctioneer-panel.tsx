import { useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { resolveEnvironment } from '@/config/environments'
import type { AuctionBatch, PlayerId, UserId } from '@fantasy-cricket/shared'

import {
  indexPool,
  managerRows,
  momentOf,
  playerLists,
} from './auction-derived'
import { useAuction, useAuctionStatic } from './auction-store'
import { batchName, price, sameBatch } from './labels'
import { OverseasMark } from './overseas-mark'

/**
 * **The auctioneer's controls**, shown to whoever holds the role right now —
 * so a handover changes what renders, not where anyone navigates.
 *
 * **Each control follows the moment.** Start before the auction exists; the
 * next batch and a player between rounds; sell, unsold, pause and extra time
 * while bidding; the draft's controls in the draft; rewind only inside
 * recovery. Batches step through the league's sequence **in order only**.
 *
 * NOT WIRED YET. Phase E onwards makes each one act; until then a click says
 * so and changes nothing.
 */
export function AuctioneerPanel() {
  const data = useAuctionStatic()
  const state = useAuction((s) => s.state)
  const round = useAuction((s) => s.round)
  const statuses = useAuction((s) => s.players)
  const managerStatuses = useAuction((s) => s.managers)

  const [note, setNote] = useState<string | undefined>(undefined)
  const tried = (what: string) => () =>
    setNote(`${what} isn't wired yet — it comes with the auction actions.`)

  const pool = useMemo(() => indexPool(data.pool), [data.pool])
  const lists = useMemo(
    () => playerLists(data.pool, statuses),
    [data.pool, statuses],
  )
  const managers = useMemo(
    () => managerRows(data.members, managerStatuses, data.settings, pool),
    [data.members, managerStatuses, data.settings, pool],
  )

  const moment = momentOf(state, round)
  const sequence = data.settings.batchSequence ?? []
  const currentIndex =
    state?.currentBatch === undefined
      ? -1
      : sequence.findIndex((b) =>
          sameBatch(b, state.currentBatch as AuctionBatch),
        )
  const nextBatch = sequence[currentIndex + 1]

  // The current bidding batch's players still to go up.
  const batch = state?.currentBatch
  const inBatch =
    batch === undefined || batch.kind === 'draft'
      ? []
      : lists.remaining.filter(
          (entry) =>
            entry.playerCategory === batch.playerCategory &&
            entry.player.playerRole === batch.playerRole,
        )

  const leaderName =
    round?.currentLeadingManager === undefined
      ? undefined
      : (managers.find((m) => m.userId === round.currentLeadingManager)
          ?.teamName ?? 'the leader')

  const live = moment !== 'notStarted' && moment !== 'ended'
  const canReset = resolveEnvironment() !== 'prod'

  return (
    <section className="rounded-xl border border-primary/40 bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold">Auctioneer</h3>
        {batch !== undefined && (
          <span className="font-mono text-xs text-muted-foreground">
            {batchName(batch)}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3">
        {moment === 'notStarted' && (
          <Actions>
            <Button onClick={tried('Start auction')}>Start auction</Button>
          </Actions>
        )}

        {(moment === 'betweenPlayers' ||
          moment === 'sold' ||
          moment === 'unsold') && (
          <>
            {batch !== undefined && batch.kind === 'auction' && (
              <PickPlayer
                homeNation={data.settings.homeNation}
                players={inBatch.map((entry) => ({
                  id: entry.player.playerId,
                  country: entry.player.country,
                  label: `${entry.player.playerName} · ${price(entry.playerBasePrice)}`,
                }))}
                onSelect={tried('Selecting a player')}
                onRandom={tried('Picking at random')}
              />
            )}
            <Actions>
              {nextBatch === undefined ? (
                <p className="text-sm text-muted-foreground">
                  {sequence.length === 0
                    ? 'This league has no batch order.'
                    : 'Every batch in the order has been reached.'}
                </p>
              ) : (
                <Button variant="outline" onClick={tried('Next batch')}>
                  Next batch: {batchName(nextBatch)}
                </Button>
              )}
            </Actions>
          </>
        )}

        {moment === 'selected' && (
          <Actions>
            <Button onClick={tried('Start bidding')}>Start bidding</Button>
          </Actions>
        )}

        {(moment === 'bidding' || moment === 'timeUp') && (
          <>
            <Actions>
              <Button
                onClick={tried('Selling')}
                disabled={round?.currentLeadingBid === undefined}
              >
                {round?.currentLeadingBid === undefined
                  ? 'Sell (no bids yet)'
                  : `Sell to ${leaderName} for ${price(round.currentLeadingBid)}`}
              </Button>
              <Button variant="outline" onClick={tried('Marking unsold')}>
                Mark unsold
              </Button>
              {moment === 'bidding' && (
                <>
                  <Button variant="outline" onClick={tried('Pausing')}>
                    Pause
                  </Button>
                  <Button variant="outline" onClick={tried('Adding time')}>
                    +10 s
                  </Button>
                </>
              )}
            </Actions>
            <ManualSell
              managers={managers.map((m) => ({
                id: m.userId,
                label: m.teamName,
              }))}
              onSell={tried('Manual sell')}
            />
          </>
        )}

        {moment === 'paused' && (
          <Actions>
            <Button onClick={tried('Resuming')}>Resume</Button>
          </Actions>
        )}

        {moment === 'draft' && (
          <Actions>
            {state?.currentDraftManagerId === undefined ? (
              <Button onClick={tried('Starting the draft')}>Start draft</Button>
            ) : (
              <>
                <Button disabled title="No pick submitted yet">
                  Accept pick
                </Button>
                <Button variant="outline" onClick={tried('Next manager')}>
                  Next manager
                </Button>
              </>
            )}
          </Actions>
        )}

        {moment === 'recovering' && (
          <Actions>
            <Button onClick={tried('Rewinding')}>Rewind last round</Button>
            <Button variant="outline" onClick={tried('Ending recovery')}>
              End recovery
            </Button>
          </Actions>
        )}

        {moment === 'ended' && (
          <p className="text-sm text-muted-foreground">
            The auction is over. Nothing left to run.
          </p>
        )}

        {/*
          Rare and consequential, so folded away from the controls used every
          round. Recovery is entered deliberately, so a rewind can never fire
          mid-round by accident.
        */}
        {live && moment !== 'recovering' && (
          <details className="rounded-md border px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-muted-foreground">
              More
            </summary>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <Button variant="outline" onClick={tried('Start recovery')}>
                Start recovery
              </Button>
              <Button variant="outline" onClick={tried('Ending the auction')}>
                End auction
              </Button>
              {canReset && (
                <Button
                  variant="destructive"
                  onClick={tried('Resetting the auction')}
                >
                  Reset auction (testing only)
                </Button>
              )}
            </div>
          </details>
        )}

        {note !== undefined && (
          <p className="text-xs text-subtle-foreground">{note}</p>
        )}
      </div>
    </section>
  )
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2.5">{children}</div>
}

/** A player from the current batch, chosen or drawn at random. */
function PickPlayer({
  players,
  homeNation,
  onSelect,
  onRandom,
}: {
  players: { id: PlayerId; country: string; label: string }[]
  homeNation: string | undefined
  onSelect: () => void
  onRandom: () => void
}) {
  const [chosen, setChosen] = useState<string>('')

  if (players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nobody left in this batch. Move to the next one.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      <Select value={chosen} onValueChange={setChosen}>
        <SelectTrigger className="w-full sm:w-64" aria-label="Next player">
          <SelectValue placeholder={`Choose from ${players.length} left`} />
        </SelectTrigger>
        <SelectContent>
          {players.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <OverseasMark
                player={{ country: p.country }}
                homeNation={homeNation}
                keepSpace
              />
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={onSelect} disabled={chosen === ''}>
        Put up
      </Button>
      <Button variant="outline" onClick={onRandom}>
        Random
      </Button>
    </div>
  )
}

/**
 * **A last resort**, for when something has broken and the auction must not
 * stall: sell to a chosen manager at a chosen price. Folded away so it is
 * never mistaken for the normal sell.
 */
function ManualSell({
  managers,
  onSell,
}: {
  managers: { id: UserId; label: string }[]
  onSell: () => void
}) {
  const [manager, setManager] = useState<string>('')
  const [amount, setAmount] = useState('')

  return (
    <details className="rounded-md border px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-muted-foreground">
        Fallback: sell manually
      </summary>
      <p className="mt-2 text-xs text-subtle-foreground">
        Only if something has gone wrong. The bidding so far is kept, and this
        sale is added as the final bid.
      </p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        <Select value={manager} onValueChange={setManager}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Sell to">
            <SelectValue placeholder="Sell to…" />
          </SelectTrigger>
          <SelectContent>
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          inputMode="decimal"
          min={0.5}
          step={0.5}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Price"
          className="w-28"
          aria-label="Price"
        />
        <Button
          variant="outline"
          onClick={onSell}
          disabled={manager === '' || amount === ''}
        >
          Sell
        </Button>
      </div>
    </details>
  )
}
